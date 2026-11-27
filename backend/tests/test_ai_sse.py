from __future__ import annotations

import asyncio
import json
import unittest
import time
from unittest.mock import patch

import httpx

from tests.conftest import make_test_context


def _parse_sse_stream(raw_text: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in raw_text.strip().split("\n\n"):
        if not block.strip():
            continue
        ev_type = "message"
        data_dict: dict = {}
        for line in block.splitlines():
            if line.startswith("event:"):
                ev_type = line[6:].strip()
            elif line.startswith("data:"):
                data_dict = json.loads(line[5:].strip())
        events.append((ev_type, data_dict))
    return events


class TestAISSEProxyAndZeroCostInterceptor(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = make_test_context(
            ai_rate_limit_user_per_minute=3,
            ai_rate_limit_ip_per_minute=4,
            ai_max_question_chars=120,
            ai_max_code_chars=300,
        )
        self.client = self.ctx.client
        self.container = self.ctx.app.state.container
        self.token = self._create_user_token("ai_learner")

    def tearDown(self) -> None:
        self.ctx.close()

    def _create_user_token(self, username: str) -> str:
        challenge, code = asyncio.run(self.container.captcha.generate())
        resp = self.client.post(
            "/api/auth/register",
            json={
                "username": username,
                "email": f"{username}@example.com",
                "password": "Password123!",
                "captcha_id": challenge.captcha_id,
                "captcha_code": code,
            },
        )
        self.assertEqual(resp.status_code, 201)
        return resp.json()["access_token"]

    def test_requires_authentication(self) -> None:
        self.client.cookies.clear()
        resp = self.client.post(
            "/api/ai/chat",
            json={"language": "python", "question": "为什么报错？", "code": "print(1)"},
        )
        self.assertEqual(resp.status_code, 401)

    def test_zero_cost_interception_fullwidth_and_syntax_errors_persisted_to_sqlite(
        self,
    ) -> None:
        headers = {"Authorization": f"Bearer {self.token}"}

        # Case 1: Full-width parentheses in Python code
        resp1 = self.client.post(
            "/api/ai/chat",
            headers=headers,
            json={
                "language": "python",
                "course_id": "lv-python-foundations",
                "lesson_id": "values",
                "code": 'price = 6\nprint（price）',
                "question": "这行 print 为什么运行报错？",
            },
        )
        self.assertEqual(resp1.status_code, 200)
        self.assertIn("text/event-stream", resp1.headers["content-type"])
        events1 = _parse_sse_stream(resp1.text)
        event_names1 = [e[0] for e in events1]
        self.assertIn("meta", event_names1)
        self.assertIn("diagnostic_card", event_names1)
        self.assertIn("code_reference", event_names1)
        self.assertIn("text_delta", event_names1)
        self.assertIn("done", event_names1)

        card_data = next(d for name, d in events1 if name == "diagnostic_card")
        self.assertEqual(card_data["line"], 2)
        self.assertIn("全角", card_data["title"])

        ref_data = next(d for name, d in events1 if name == "code_reference")
        self.assertEqual(ref_data["fix"], "print(price)")

        done_data = next(d for name, d in events1 if name == "done")
        self.assertTrue(done_data["intercepted"])
        self.assertEqual(done_data["status"], "intercepted")
        self.assertGreater(done_data["log_id"], 0)

        # Case 2: C scanf missing '&' address-of operator + overlong question truncation check
        time.sleep(4.05)
        resp2 = self.client.post(
            "/api/ai/chat",
            headers=headers,
            json={
                "language": "c",
                "code": '#include <stdio.h>\nint main(void) {\n    int n = 0;\n    scanf("%d", n);\n    return 0;\n}',
                "question": "为什么输入会崩溃？",
            },
        )
        self.assertEqual(resp2.status_code, 200)
        events2 = _parse_sse_stream(resp2.text)
        meta2 = next(d for name, d in events2 if name == "meta")
        self.assertFalse(meta2["truncated"]["question"])
        card2 = next(d for name, d in events2 if name == "diagnostic_card")
        self.assertIn("scanf", card2["title"])
        self.assertEqual(card2["line"], 4)

        # Verify both records were persisted in SQLite `ai_qa_logs`
        with self.container.db.read_connection() as conn:
            rows = conn.execute(
                "SELECT id, language, intercepted, status, question FROM ai_qa_logs ORDER BY id ASC"
            ).fetchall()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["intercepted"], 1)
        self.assertEqual(rows[1]["language"], "c")
        self.assertLessEqual(len(rows[1]["question"]), 120)

    def test_dual_dimension_redis_sliding_window_rate_limit(self) -> None:
        headers = {
            "Authorization": f"Bearer {self.token}",
            "X-Forwarded-For": "198.51.100.42",
        }
        # User limit is 3 req/min in this test fixture
        for _ in range(3):
            r = self.client.post(
                "/api/ai/chat",
                headers=headers,
                json={
                    "language": "python",
                    "code": "if True\n    print(1)",
                    "question": "语法错误",
                },
            )
            self.assertEqual(r.status_code, 200)
            time.sleep(4.05)

        # 4th request within 60s MUST be rejected with 429 Too Many Requests + Retry-After
        r_blocked = self.client.post(
            "/api/ai/chat",
            headers=headers,
            json={
                "language": "python",
                "code": "if True\n    print(1)",
                "question": "语法错误",
            },
        )
        self.assertEqual(r_blocked.status_code, 429)
        self.assertIn("Retry-After", r_blocked.headers)

        # Even if a second user registers on the SAME IP (198.51.100.42), the IP limit (4/min) catches the 5th request!
        token2 = self._create_user_token("ai_learner_2")
        headers_user2_same_ip = {
            "Authorization": f"Bearer {token2}",
            "X-Forwarded-For": "198.51.100.42",
        }
        r_user2_first = self.client.post(
            "/api/ai/chat",
            headers=headers_user2_same_ip,
            json={"language": "python", "code": "if True\n    pass", "question": "q"},
        )
        self.assertEqual(r_user2_first.status_code, 200)

        time.sleep(4.05)
        r_user2_ip_limited = self.client.post(
            "/api/ai/chat",
            headers=headers_user2_same_ip,
            json={"language": "python", "code": "if True\n    pass", "question": "q"},
        )
        self.assertEqual(r_user2_ip_limited.status_code, 429)

    def test_guest_chat_sse_qoder_contract_origin_and_quota_guards(self) -> None:
        qoder_origin = "https://learnverse-station-jrnjfyznx8q.qoder.zone"
        ctx = make_test_context(
            env="production",
            debug=False,
            allowed_origins=[qoder_origin],
            llm_base_url="http://127.0.0.1:8787/v1",
            llm_api_key="test-relay-key",
            ai_guest_rate_limit_ip_per_minute=5,
            ai_guest_rate_limit_ip_per_day=2,
            ai_guest_daily_global_limit=10,
            ai_daily_token_budget=50000,
        )
        try:
            async def fake_stream_chunks():
                yield 'data: {"choices":[{"delta":{"content":"for 循环先执行"}}]}\n\n'.encode("utf-8")
                yield 'data: {"choices":[{"delta":{"content":"初始化表达式。"}}],"usage":{"total_tokens":36}}\n\n'.encode("utf-8")
                yield b"data: [DONE]\n\n"

            captured_payloads: list[dict] = []

            class FakeStream(httpx.AsyncByteStream):
                async def __aiter__(self):
                    async for chunk in fake_stream_chunks():
                        yield chunk

            def respond(request: httpx.Request) -> httpx.Response:
                captured_payloads.append(json.loads(request.content))
                return httpx.Response(200, stream=FakeStream())

            mock_http = httpx.AsyncClient(transport=httpx.MockTransport(respond))
            with patch.object(
                ctx.app.state.container.ai_service,
                "_get_http_client",
                return_value=mock_http,
            ):
                # 1. Exact Qoder frontend request works without auth cookie
                r1 = ctx.client.post(
                    "/api/ai/guest/chat",
                    headers={
                        "Origin": qoder_origin,
                        "Accept": "text/event-stream",
                    },
                    json={
                        "question": "for 循环的执行顺序是什么？",
                        "language": "c",
                        "history": [
                            {"role": "user", "content": "你好"},
                            {"role": "assistant", "content": "你好，请问有什么问题？"},
                        ],
                    },
                )
                self.assertEqual(r1.status_code, 200, r1.text)
                self.assertEqual(r1.headers.get("access-control-allow-origin"), qoder_origin)
                events = _parse_sse_stream(r1.text)
                deltas = [d["delta"] for ev, d in events if ev == "text_delta"]
                self.assertEqual("".join(deltas), "for 循环先执行初始化表达式。")
                self.assertEqual(captured_payloads[0]["max_tokens"], 768)

                # 2. Rapid burst within 4s cooldown is rejected with 429
                r_cd = ctx.client.post(
                    "/api/ai/guest/chat",
                    headers={"Origin": qoder_origin},
                    json={"question": "再来一次", "language": "c"},
                )
                self.assertEqual(r_cd.status_code, 429)

                # 3. Foreign unauthorized Origin is rejected with 403
                r_evil = ctx.client.post(
                    "/api/ai/guest/chat",
                    headers={"Origin": "https://evil.example.net"},
                    json={"question": "偷额度", "language": "c"},
                )
                self.assertEqual(r_evil.status_code, 403)

                # 4. Daily per-IP cap (limit=2) triggers after second allowed call
                time.sleep(4.05)
                r2 = ctx.client.post(
                    "/api/ai/guest/chat",
                    headers={"Origin": qoder_origin},
                    json={"question": "break 和 continue 区别", "language": "c"},
                )
                self.assertEqual(r2.status_code, 200, r2.text)

                time.sleep(4.05)
                r3 = ctx.client.post(
                    "/api/ai/guest/chat",
                    headers={"Origin": qoder_origin},
                    json={"question": "第三次应该超日限", "language": "c"},
                )
                self.assertEqual(r3.status_code, 429)

            with ctx.app.state.container.db.read_connection() as conn:
                self.assertEqual(conn.execute("SELECT tokens FROM ai_token_day").fetchone()[0], 72)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM ai_qa_logs").fetchone()[0], 0)
        finally:
            asyncio.run(mock_http.aclose())
            ctx.close()


if __name__ == "__main__":
    unittest.main()
