from __future__ import annotations

import asyncio
import unittest
import time
from urllib.parse import parse_qs, urlparse
from unittest.mock import AsyncMock, patch

from tests.conftest import make_test_context


class TestGitHubGuardianAndAIQuota(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = make_test_context(
            debug=True,
            github_client_id="gh_test_client_id",
            github_client_secret="gh_test_client_secret",
            github_target_owner="learnverse-dev",
            github_target_repo="learning-station",
            github_redirect_uri="http://localhost:8000/api/github/callback",
            github_guardian_limit=100,
            ai_rate_limit_user_per_minute=20,
            ai_rate_limit_user_per_hour=50,
            ai_rate_limit_user_per_day=2,
            ai_guardian_daily_bonus=10,
            ai_rate_limit_ip_per_minute=50,
        )
        self.client = self.ctx.client
        self.container = self.ctx.app.state.container

    def tearDown(self) -> None:
        self.ctx.close()

    def _register_user(self, username: str) -> str:
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

    def test_status_caches_github_stars_for_60s(self) -> None:
        with patch(
            "app.api.github_guardian._fetch_repo_stargazers",
            new=AsyncMock(return_value=23),
        ) as mock_fetch:
            r1 = self.client.get("/api/github/status")
            self.assertEqual(r1.status_code, 200)
            body1 = r1.json()
            self.assertEqual(body1["stars"], 23)
            self.assertEqual(body1["remaining"], 77)
            self.assertEqual(body1["limit"], 100)
            self.assertTrue(body1["debug_mock_enabled"])

            # Second request MUST hit Redis 60s cache instead of calling GitHub API again
            r2 = self.client.get("/api/github/status")
            self.assertEqual(r2.status_code, 200)
            self.assertEqual(r2.json()["stars"], 23)
            self.assertEqual(mock_fetch.await_count, 1)

    def test_oauth_login_callback_atomic_rank_and_zero_token_persistence(self) -> None:
        self.ctx.sign_in()
        login_resp = self.client.get("/api/github/login", follow_redirects=False)
        self.assertEqual(login_resp.status_code, 302)
        loc = login_resp.headers["location"]
        parsed = urlparse(loc)
        qs = parse_qs(parsed.query)
        self.assertEqual(qs["scope"], ["public_repo"])
        self.assertEqual(qs["client_id"], ["gh_test_client_id"])
        state = qs["state"][0]

        with (
            patch(
                "app.api.github_guardian._exchange_code_for_token",
                new=AsyncMock(return_value="gho_ephemeral_secret_token_never_stored"),
            ),
            patch(
                "app.api.github_guardian._fetch_github_identity_and_star",
                new=AsyncMock(return_value=("9001", "seoul_stargazer")),
            ),
        ):
            cb = self.client.get(f"/api/github/callback?code=abc123&state={state}")
            self.assertEqual(cb.status_code, 200)
            self.assertIn("STAR_SUCCESS", cb.text)
            self.assertIn("seoul_stargazer", cb.text)
            self.assertIn('"rank":1', cb.text)
            # Token MUST NEVER appear in response HTML or Redis!
            self.assertNotIn("gho_ephemeral_secret_token_never_stored", cb.text)

        # Verify state cannot be replayed (consumed atomically via GETDEL)
        replay = self.client.get(f"/api/github/callback?code=abc123&state={state}")
        self.assertEqual(replay.status_code, 200)
        self.assertIn("STAR_ERROR", replay.text)

        # Verify atomic deduplication: same github_user_id keeps rank=1; new user gets rank=2
        r_dup, already = asyncio.run(
            self.container.redis.claim_guardian_rank("9001")
        )
        self.assertEqual(r_dup, 1)
        self.assertTrue(already)

        r_new, already2 = asyncio.run(
            self.container.redis.claim_guardian_rank("9002")
        )
        self.assertEqual(r_new, 2)
        self.assertFalse(already2)

    def test_mock_star_requires_debug_true_and_boosts_daily_ai_quota(self) -> None:
        token = self._register_user("genesis_coder")
        headers = {"Authorization": f"Bearer {token}"}

        # Before guardian boost: daily limit = 2
        for _ in range(2):
            r = self.client.post(
                "/api/ai/chat",
                headers=headers,
                json={"language": "python", "code": "if True\n    pass", "question": "q"},
            )
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.headers.get("X-Genesis-Guardian"), "0")
            self.assertEqual(r.headers.get("X-AI-Daily-Limit"), "2")
            time.sleep(4.05)

        # 3rd request hits daily limit before becoming guardian
        r_blocked = self.client.post(
            "/api/ai/chat",
            headers=headers,
            json={"language": "python", "code": "if True\n    pass", "question": "q"},
        )
        self.assertEqual(r_blocked.status_code, 429)

        # Claim Genesis Guardian via DEBUG=true mock-star -> sets Redis is_genesis_guardian -> +10 daily bonus!
        mock_resp = self.client.get("/api/github/mock-star", headers=headers)
        self.assertEqual(mock_resp.status_code, 200)
        self.assertEqual(mock_resp.json()["rank"], 1)
        self.assertTrue(mock_resp.json()["isGenesisGuardian"])

        # Now daily limit is 2 + 10 = 12, so the 3rd request immediately succeeds!
        r_unlocked = self.client.post(
            "/api/ai/chat",
            headers=headers,
            json={"language": "python", "code": "if True\n    pass", "question": "q"},
        )
        self.assertEqual(r_unlocked.status_code, 200)
        self.assertEqual(r_unlocked.headers.get("X-Genesis-Guardian"), "1")
        self.assertEqual(r_unlocked.headers.get("X-AI-Daily-Limit"), "12")

    def test_mock_star_disabled_when_debug_false(self) -> None:
        prod_ctx = make_test_context(debug=False)
        try:
            resp = prod_ctx.client.get("/api/github/mock-star")
            self.assertEqual(resp.status_code, 404)
        finally:
            prod_ctx.close()


if __name__ == "__main__":
    unittest.main()
