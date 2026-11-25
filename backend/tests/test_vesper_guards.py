import asyncio
import json
import os
import threading
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from app.db import DatabaseManager
from app.schemas.ai import AIChatRequest
from app.services import ai_quota
from tests.conftest import make_test_context


class TestVesperGuards(unittest.TestCase):
    def setUp(self):
        self.ctx = make_test_context(debug=False, llm_api_key="", llm_base_url="",
                                     redis_url=os.getenv("LEARNVERSE_TEST_REDIS_URL", "memory://"),
                                     redis_key_prefix=f"lv:test:{uuid.uuid4().hex}:")
        self.addCleanup(self.ctx.close)
        self.client = self.enterContext(self.ctx.client)
        token = self.ctx.sign_in()
        self.client.cookies.clear()
        self.headers = {"Authorization": f"Bearer {token}"}

    def test_sensitive_routes_require_jwt(self):
        for method, path, body in (
            ("GET", "/api/ai/quota", None),
            ("POST", "/api/ai/chat", {"question": "q"}),
            ("GET", "/api/sync/state", None),
            ("POST", "/api/sync/union", {}),
            ("GET", "/api/local-runner", None),
            ("POST", "/api/sandbox/execute", {"language": "c", "code": "int main(){}"}),
            ("POST", "/api/discussions/lv-python-foundations/values", {}),
            ("GET", "/api/admin/discussions", None),
            ("GET", "/api/github/login", None),
        ):
            for credential in ({}, {"Authorization": "Bearer invalid"}):
                with self.subTest(path=path, credential=bool(credential)):
                    r = self.client.request(method, path, follow_redirects=False, json=body, headers={
                        **credential, "X-Admin-Token": "old-admin-token"})
                    self.assertEqual(r.status_code, 401)

    def chat(self, **params):
        return self.client.post("/api/ai/chat", headers=self.headers, json={"question": "q", **params})

    def test_input_allowlist(self):
        for field in ("model", "max_tokens", "temperature", "system_prompt", "pass_through_on_intercept"):
            with self.subTest(field=field):
                self.assertEqual(self.chat(**{field: True}).status_code, 422)
        self.assertEqual(self.chat(question="问" * 2001).status_code, 422)
        self.assertEqual(self.chat(question="a" * (512 * 1024)).status_code, 413)
        self.assertEqual(self.chat(question="问" * 2000).status_code, 200)
        self.assertEqual(self.chat(history=[{"role": "user", "content": "q", "model": "abc"}]).status_code, 422)

    def test_followup_waits_for_cooldown(self):
        self.assertEqual(self.chat().status_code, 200)
        again = self.chat()
        self.assertEqual(again.status_code, 429)
        self.assertEqual(again.headers["retry-after"], "4")

    def test_budget_refuses_before_contacting_upstream(self):
        cfg = self.ctx.settings
        cfg.llm_api_key = "local-test"
        cfg.llm_base_url = "http://upstream.invalid/v1"
        cfg.ai_daily_token_budget = 1
        with patch.object(self.ctx.app.state.container.ai_service, "_get_http_client") as upstream:
            self.assertEqual(self.chat().status_code, 503)
            upstream.assert_not_called()

    def test_open_stream_holds_lock_and_global_reservation(self):
        container = self.ctx.app.state.container
        container.settings.llm_api_key = "test"
        container.settings.llm_base_url = "http://isolated.invalid/v1"
        reserved = container.ai_service.prepare(AIChatRequest(question="q")).reserved
        container.settings.ai_daily_token_budget = reserved
        token2 = self.ctx.sign_in("second")
        opened, release = threading.Event(), threading.Event()
        payloads = []

        class PausedStream(httpx.AsyncByteStream):
            async def __aiter__(self):
                opened.set()
                if not await asyncio.to_thread(release.wait, 8):
                    raise TimeoutError("test stream did not resume")
                yield b'data: {"choices":[],"usage":{"total_tokens":42}}\n\ndata: [DONE]\n\n'

        def respond(request):
            payloads.append(json.loads(request.content))
            return httpx.Response(200, stream=PausedStream())

        upstream = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch.object(container.ai_service, "_get_http_client", return_value=upstream), ThreadPoolExecutor(1) as pool:
            first = pool.submit(self.chat)
            try:
                self.assertTrue(opened.wait(5))
                self.assertEqual(self.chat().status_code, 429)
                other = self.client.post("/api/ai/chat", json={"question": "q"},
                                         headers={"Authorization": f"Bearer {token2}"})
                self.assertEqual(other.status_code, 503)
            finally:
                release.set()
            self.assertIn("event: done", first.result(5).text)
        self.assertEqual(len(payloads), 1)
        payload = payloads[0]
        self.assertEqual((payload["model"], payload["max_tokens"], payload["temperature"]),
                         ("learnverse-chat", 1024, 0.2))
        self.assertIn("Vesper", payload["messages"][0]["content"])
        with container.db.read_connection() as conn:
            self.assertEqual(conn.execute("SELECT tokens FROM ai_token_day").fetchone()[0], 42)
            self.assertEqual(conn.execute("SELECT SUM(calls) FROM ai_user_day").fetchone()[0], 1)

    def test_daily_limit_survives_reopen_and_resets_at_shanghai_midnight(self):
        db = self.ctx.app.state.container.db
        second = DatabaseManager(db.db_path)
        self.addCleanup(second.close_all)
        start = 86400 * 21000 - 28800
        for i in range(20):
            with patch("app.services.ai_quota.time.time", return_value=start + i * 5):
                lease = ai_quota.admit(db, 1, 20, 100, 2000)
                ai_quota.finish(db, lease)
        with patch("app.services.ai_quota.time.time", return_value=start + 86399):
            second.initialize()
            with self.assertRaises(HTTPException) as full:
                ai_quota.admit(second, 1, 20, 100, 2000)
            self.assertEqual(full.exception.status_code, 429)
            # No upstream usage was reported for the 20 calls. Keep their full reservations.
            with self.assertRaises(HTTPException) as budget:
                ai_quota.admit(second, 2, 20, 100, 2000)
            self.assertEqual(budget.exception.status_code, 503)
        with patch("app.services.ai_quota.time.time", return_value=start + 86400):
            fresh = ai_quota.admit(second, 1, 20, 100, 2000)
            self.assertEqual(fresh.day, lease.day + 1)

    def test_cancelled_stream_releases_owned_lock_without_refunding_unknown_usage(self):
        from app.api.ai import ChatResponse
        from starlette.requests import ClientDisconnect

        db = self.ctx.app.state.container.db
        lease = ai_quota.admit(db, 1, 20, 200, 2000)
        closed = []
        async def events():
            try:
                yield "first"
                yield "second"
            finally:
                closed.append(True)

        async def disconnected_send(message):
            if message["type"] == "http.response.body":
                raise OSError("disconnected")

        async def disconnected_receive():
            return {"type": "http.disconnect"}

        response = ChatResponse(events(), db=db, lease=lease, headers={})
        with self.assertRaises((ClientDisconnect, OSError)):
            asyncio.run(response({"type":"http","asgi":{"spec_version":"2.4"}},
                                 disconnected_receive, disconnected_send))
        self.assertEqual(closed, [True])
        with db.read_connection() as conn:
            self.assertEqual(conn.execute("SELECT owner FROM ai_user_lock").fetchone()[0], "")
            self.assertEqual(conn.execute("SELECT tokens FROM ai_token_day").fetchone()[0], 200)
