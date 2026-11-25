from __future__ import annotations

import base64
import json
import unittest

from tests.conftest import make_test_context


class TestAuthAndLazySync(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = make_test_context()
        self.client = self.ctx.client
        self.container = self.ctx.app.state.container

    def tearDown(self) -> None:
        self.ctx.close()

    def _issue_captcha_pair(self) -> tuple[str, str]:
        """Generates a real captcha challenge via CaptchaService and returns (captcha_id, raw_code)."""
        import asyncio

        challenge, code = asyncio.run(self.container.captcha.generate())
        return challenge.captcha_id, code

    def _register_and_login(
        self, username: str = "alice_dev", email: str = "alice@example.com"
    ) -> str:
        cid, code = self._issue_captcha_pair()
        resp = self.client.post(
            "/api/auth/register",
            json={
                "username": username,
                "email": email,
                "password": "StrongPassword!2026",
                "captcha_id": cid,
                "captcha_code": code,
                "nickname": "小林",
            },
        )
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["username"], username)
        self.assertEqual(data["user"]["profile"]["nickname"], "小林")
        # Verify HttpOnly Cookie is also set
        self.assertIn(self.ctx.settings.jwt_cookie_name, resp.cookies)
        return data["access_token"]

    def test_captcha_endpoint_and_single_use_anti_replay(self) -> None:
        # 1. Public endpoint returns rasterized PNG bitmap data URL with ZERO plaintext SVG/<text>
        resp = self.client.get("/api/auth/captcha")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(len(body["captcha_id"]), 32)
        self.assertNotIn("image_svg", body)
        self.assertTrue(body["image_data_url"].startswith("data:image/png;base64,"))
        raw_png = base64.b64decode(body["image_data_url"].split(",", 1)[1])
        self.assertTrue(raw_png.startswith(b"\x89PNG\r\n\x1a\n"))

        # 2. Weak password on registration is rejected (422)
        cid_w, code_w = self._issue_captcha_pair()
        weak_resp = self.client.post(
            "/api/auth/register",
            json={
                "username": "weak_user",
                "email": "weak@example.com",
                "password": "password",
                "captcha_id": cid_w,
                "captcha_code": code_w,
            },
        )
        self.assertEqual(weak_resp.status_code, 422)

        # 3. Single-use atomic GETDEL test: even a valid captcha cannot be replayed twice
        cid, code = self._issue_captcha_pair()
        r1 = self.client.post(
            "/api/auth/register",
            json={
                "username": "user_one",
                "email": "one@example.com",
                "password": "Password123!",
                "captcha_id": cid,
                "captcha_code": code,
            },
        )
        self.assertEqual(r1.status_code, 201)

        # Replay the exact same (captcha_id, captcha_code) for a second registration -> MUST fail 400!
        r2 = self.client.post(
            "/api/auth/register",
            json={
                "username": "bot_two",
                "email": "two@example.com",
                "password": "Password123!",
                "captcha_id": cid,
                "captcha_code": code,
            },
        )
        self.assertEqual(r2.status_code, 400)
        self.assertIn("验证码", r2.json()["detail"])

        # 4. Distributed per-account brute-force lockout triggers identically for existent and nonexistent accounts (no enumeration)
        for idx_acct, acct in enumerate(("user_one", "no_such_user_99")):
            xff_ip = f"198.51.100.{10 + idx_acct}"
            for attempt in range(6):
                cid_l, code_l = self._issue_captcha_pair()
                r_fail = self.client.post(
                    "/api/auth/login",
                    headers={"X-Forwarded-For": xff_ip},
                    json={
                        "account": acct,
                        "password": "WrongPassword999!",
                        "captcha_id": cid_l,
                        "captcha_code": code_l,
                    },
                )
                self.assertEqual(r_fail.status_code, 401, f"{acct} attempt {attempt}: {r_fail.text}")
            cid_blk, code_blk = self._issue_captcha_pair()
            r_locked = self.client.post(
                "/api/auth/login",
                headers={"X-Forwarded-For": xff_ip},
                json={
                    "account": acct,
                    "password": "WrongPassword999!",
                    "captcha_id": cid_blk,
                    "captcha_code": code_blk,
                },
            )
            self.assertEqual(r_locked.status_code, 429)

    def test_login_jwt_security_alg_none_and_logout_revocation(self) -> None:
        token = self._register_and_login("bob_sec", "bob@example.com")

        # 1. /api/auth/me works with Bearer token
        me = self.client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["username"], "bob_sec")

        # 2. Forged JWT with `alg: "none"` MUST be rejected with 401
        none_header = (
            base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}')
            .rstrip(b"=")
            .decode()
        )
        payload_seg = token.split(".")[1]
        forged_none_token = f"{none_header}.{payload_seg}."
        self.client.cookies.clear()
        forged_resp = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {forged_none_token}"},
        )
        self.assertEqual(forged_resp.status_code, 401)

        # 3. Tampered payload with original signature MUST be rejected with 401
        bad_payload = (
            base64.urlsafe_b64encode(
                json.dumps(
                    {
                        "sub": "1",
                        "usr": "bob_sec",
                        "role": "admin",
                        "iss": "learnverse",
                        "aud": "learnverse-web",
                        "exp": 9999999999,
                        "jti": "forged",
                    }
                ).encode()
            )
            .rstrip(b"=")
            .decode()
        )
        tampered_token = f"{token.split('.')[0]}.{bad_payload}.{token.split('.')[2]}"
        tampered_resp = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {tampered_token}"},
        )
        self.assertEqual(tampered_resp.status_code, 401)

        # 4. Login by email works
        cid, code = self._issue_captcha_pair()
        login_resp = self.client.post(
            "/api/auth/login",
            json={
                "account": "BOB@example.com",
                "password": "StrongPassword!2026",
                "captcha_id": cid,
                "captcha_code": code,
            },
        )
        self.assertEqual(login_resp.status_code, 200)
        fresh_token = login_resp.json()["access_token"]

        # 5. Logout revokes JWT jti in Redis blacklist immediately
        logout_resp = self.client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {fresh_token}"},
        )
        self.assertEqual(logout_resp.status_code, 200)
        self.client.cookies.clear()
        after_logout = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {fresh_token}"},
        )
        self.assertEqual(after_logout.status_code, 401)

    def test_optional_email_verification_flow(self) -> None:
        token = self._register_and_login("carol_mail", "carol@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        send_resp = self.client.post("/api/auth/email/send-code", headers=headers)
        self.assertEqual(send_resp.status_code, 200)
        self.assertEqual(send_resp.json()["email_verification_enabled"], False)

        # Cooldown protects against immediate re-send within 60s
        cooldown_resp = self.client.post("/api/auth/email/send-code", headers=headers)
        self.assertEqual(cooldown_resp.status_code, 429)

    def test_lazy_auth_idempotent_union_sync_and_anti_pack_farming(self) -> None:
        token = self._register_and_login("sync_student", "sync@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        # 5 valid cards matching slots 1, 2, 3, 4, 5 in exact order
        valid_pack_a = [
            "python-001",  # slot 1
            "python-002",  # slot 2
            "python-003",  # slot 3
            "python-004",  # slot 4
            "python-005",  # slot 5
        ]
        # Another distinct valid 5-card tuple (slots 1..5) that an attacker might try to reroll into the same pack
        reroll_pack_b = [
            "python-006",  # slot 1
            "python-009",  # slot 2
            "python-007",  # slot 3
            "python-008",  # slot 4
            "python-011",  # slot 5
        ]

        sync_payload_1 = {
            "profile": {
                "nickname": "星际学员",
                "avatar": "",
                "welcome": "finished",
                "path": "major",
                "choice": "major-080901",
            },
            "progress": {
                "completed": ["lv-python-foundations"],
                "started": ["lv-python-foundations", "lv-c-foundations"],
                "favorites": ["exercism-python"],
                "minutes": 35,
                "activity": [
                    {
                        "type": "time-logged",
                        "minutes": 35,
                        "timestamp": "2026-11-20T10:00:00.000Z",
                    }
                ],
                "activeCourse": "lv-python-foundations",
                "activeRoute": "major-080901",
                "studyDays": ["2026-11-20"],
            },
            "courses": {
                "lv-python-foundations": {
                    "completed": ["values", "decisions", "invalid-lesson-id"],
                    "verified": ["values"],
                    "lastLesson": "decisions",
                    "projectCompleted": False,
                    "transferCompleted": False,
                }
            },
            "vault": {
                "earned": [
                    "welcome",
                    "lesson/lv-python-foundations/values",
                    "lesson/lv-python-foundations/functions",  # NOT completed yet -> must be rejected!
                    "day/2026-11-20",
                    "day/2099-12-31",  # Future date -> must be rejected!
                    "hacked/pack/999",  # Invalid key -> must be rejected!
                ],
                "opened": {
                    "welcome": valid_pack_a,
                    # Invalid slot order (all slot 1) -> must be rejected!
                    "day/2026-11-20": [
                        "python-001",
                        "python-001",
                        "python-001",
                        "python-001",
                        "python-001",
                    ],
                },
                "notes": {
                    "python-001": "第一课变量赋值笔记",
                    "nonexistent-card": "应被忽略",
                },
            },
        }

        r1 = self.client.post("/api/sync/union", headers=headers, json=sync_payload_1)
        self.assertEqual(r1.status_code, 200, r1.text)
        s1 = r1.json()

        # Verify course lesson filtering & auto-earned lesson packs
        self.assertEqual(
            s1["courses"]["lv-python-foundations"]["completed"],
            ["values", "decisions"],
        )
        self.assertIn("lesson/lv-python-foundations/values", s1["vault"]["earned"])
        self.assertIn("lesson/lv-python-foundations/decisions", s1["vault"]["earned"])
        # Uncompleted chapter pack and future daily pack MUST NOT be in earned
        self.assertNotIn(
            "lesson/lv-python-foundations/functions", s1["vault"]["earned"]
        )
        self.assertNotIn("day/2099-12-31", s1["vault"]["earned"])
        self.assertIn("lesson/lv-python-foundations/functions", s1["vault"]["rejected_packs"])
        self.assertIn("day/2099-12-31", s1["vault"]["rejected_packs"])
        self.assertIn("day/2026-11-20", s1["vault"]["rejected_packs"])

        # Only the valid `welcome` pack cards are owned
        self.assertEqual(sorted(s1["vault"]["owned"]), sorted(valid_pack_a))
        self.assertEqual(
            s1["vault"]["notes"], {"python-001": "第一课变量赋值笔记"}
        )
        self.assertEqual(s1["progress"]["minutes"], 35)

        # Second sync from another tab/device:
        # - Adds new completed lessons ('collections', 'functions')
        # - Attempts to REROLL/FARM the already-opened 'welcome' pack with `reroll_pack_b`!
        # - Sends the exact same 35 minutes activity log (must NOT double-count to 70!)
        sync_payload_2 = {
            "progress": {
                "favorites": ["mdn-js"],
                "minutes": 35,
                "activity": [
                    {
                        "type": "time-logged",
                        "minutes": 35,
                        "timestamp": "2026-11-20T10:00:00.000Z",
                    }
                ],
                "studyDays": ["2026-11-21"],
            },
            "courses": {
                "lv-python-foundations": {
                    "completed": ["collections", "functions"],
                    "verified": ["decisions", "collections"],
                    "lastLesson": "functions",
                    "projectCompleted": True,
                    "transferCompleted": True,
                }
            },
            "vault": {
                "earned": ["welcome"],
                "opened": {
                    # ATTACK: trying to overwrite/union 'welcome' pack with 5 different cards!
                    "welcome": reroll_pack_b,
                },
                "notes": {
                    "python-002": "第二张卡片笔记",
                },
            },
        }

        r2 = self.client.post("/api/sync/union", headers=headers, json=sync_payload_2)
        self.assertEqual(r2.status_code, 200, r2.text)
        s2 = r2.json()

        # 1. Union of completed & verified chapters succeeded
        self.assertEqual(
            s2["courses"]["lv-python-foundations"]["completed"],
            ["values", "decisions", "collections", "functions"],
        )
        self.assertEqual(
            s2["courses"]["lv-python-foundations"]["verified"],
            ["values", "decisions", "collections"],
        )
        self.assertTrue(s2["courses"]["lv-python-foundations"]["projectCompleted"])

        # 2. Minutes remained idempotent (35, not 70!)
        self.assertEqual(s2["progress"]["minutes"], 35)
        self.assertEqual(
            sorted(s2["progress"]["favorites"]), ["exercism-python", "mdn-js"]
        )

        # 3. ANTI-PACK-FARMING VERIFICATION:
        # 'welcome' pack MUST retain `valid_pack_a` and reject `reroll_pack_b`!
        self.assertEqual(s2["vault"]["opened"]["welcome"], valid_pack_a)
        self.assertEqual(sorted(s2["vault"]["owned"]), sorted(valid_pack_a))
        self.assertIn("welcome", s2["vault"]["rejected_packs"])

        # 4. Notes union preserved both cards' notes
        self.assertEqual(
            s2["vault"]["notes"],
            {
                "python-001": "第一课变量赋值笔记",
                "python-002": "第二张卡片笔记",
            },
        )

        # 5. Read-only /api/sync/state returns exact merged snapshot without mutating state
        r_state = self.client.get("/api/sync/state", headers=headers)
        self.assertEqual(r_state.status_code, 200, r_state.text)
        state_snap = r_state.json()
        self.assertEqual(state_snap["profile"], s2["profile"])
        self.assertEqual(state_snap["progress"], s2["progress"])
        self.assertEqual(state_snap["courses"], s2["courses"])
        self.assertEqual(state_snap["vault"]["earned"], s2["vault"]["earned"])
        self.assertEqual(state_snap["vault"]["opened"], s2["vault"]["opened"])
        self.assertEqual(state_snap["vault"]["owned"], s2["vault"]["owned"])
        self.assertEqual(state_snap["vault"]["pending"], s2["vault"]["pending"])
        self.assertEqual(state_snap["vault"]["notes"], s2["vault"]["notes"])
        self.assertEqual(state_snap["vault"]["rejected_packs"], [])

    def test_cookie_csrf_protection_and_untrusted_proxy_ip_spoofing_defense(self) -> None:
        # 1. Authenticate and keep HttpOnly cookie in client jar
        self._register_and_login("csrf_user", "csrf@example.com")

        # Cross-origin POST using HttpOnly cookie MUST be blocked with 403 CSRF check
        csrf_resp = self.client.post(
            "/api/sync/union",
            headers={"Origin": "https://attacker.evil.com", "Host": "testserver"},
            json={},
        )
        self.assertEqual(csrf_resp.status_code, 403)
        self.assertIn("CSRF", csrf_resp.json()["detail"])

        # 2. When peer is NOT in trusted_proxies, spoofed X-Forwarded-For is ignored
        untrusted_ctx = make_test_context(
            trusted_proxies=["10.255.255.1/32"],  # "testclient" is NOT trusted here
            discussion_rate_limit_per_minute=2,
        )
        try:
            untrusted_ctx.sign_in()
            room_url = "/api/discussions/lv-python-foundations/values"
            for i in range(2):
                r = untrusted_ctx.client.post(
                    room_url,
                    headers={"X-Forwarded-For": f"198.51.100.{i + 1}"},
                    json={
                        "id": f"{i + 1:032x}",
                        "parent": None,
                        "name": "测试",
                        "body": f"发言 {i}",
                    },
                )
                self.assertEqual(r.status_code, 200)

            # 3rd request spoofing a brand-new X-Forwarded-For still gets rate-limited (429)
            # because the untrusted peer's X-Forwarded-For header is ignored!
            r_spoof = untrusted_ctx.client.post(
                room_url,
                headers={"X-Forwarded-For": "203.0.113.250"},
                json={
                    "id": f"{99:032x}",
                    "parent": None,
                    "name": "测试",
                    "body": "伪造 XFF 绕过限流尝试",
                },
            )
            self.assertEqual(r_spoof.status_code, 429)
        finally:
            untrusted_ctx.close()

    def test_420_card_catalog_iot_rooms_and_multi_device_scalar_protection(self) -> None:
        from app.catalog import catalog

        self.assertEqual(len(catalog.courses), 33)
        self.assertEqual(len(catalog.valid_rooms), 132)
        self.assertEqual(len(catalog.cards_by_id), 420)
        self.assertTrue(catalog.is_valid_room("lv-iot-protocols/iot-frame-bits") or any(
            r.startswith("lv-iot-protocols/") for r in catalog.valid_rooms
        ))

        token = self._register_and_login("multidevice_student", "multi@example.com")
        self.client.cookies.clear()
        headers = {"Authorization": f"Bearer {token}"}

        # Pick 5 cards from expanded galaxies (web, backend, systems, robotics) across slots 1..5
        expanded_pack: list[str] = []
        for slot in (1, 2, 3, 4, 5):
            card = next(
                c for c in catalog.cards_by_id.values()
                if c.slot == slot and c.galaxy in ("web", "backend", "systems", "robotics")
            )
            expanded_pack.append(card.id)

        iot_course = catalog.courses["lv-iot-protocols"]
        iot_first = iot_course.lesson_ids[0]

        # PC syncs expanded-galaxy pack + IoT chapter + route + favorites + note
        pc_resp = self.client.post(
            "/api/sync/union",
            headers=headers,
            json={
                "profile": {
                    "nickname": "PC端新昵称",
                    "avatar": "",
                    "welcome": "finished",
                    "path": "major",
                    "choice": "major-080905",
                },
                "progress": {
                    "favorites": ["mdn-js", "python-docs"],
                    "activeCourse": "lv-iot-protocols",
                    "activeRoute": "major-080905",
                },
                "courses": {
                    "lv-iot-protocols": {
                        "completed": [iot_first],
                        "verified": [iot_first],
                        "lastLesson": iot_first,
                        "projectCompleted": False,
                        "transferCompleted": False,
                    }
                },
                "vault": {
                    "earned": ["welcome", f"lesson/lv-iot-protocols/{iot_first}"],
                    "opened": {"welcome": expanded_pack},
                    "notes": {expanded_pack[0]: "Web/Robotics 扩展卡笔记"},
                },
            },
        )
        self.assertEqual(pc_resp.status_code, 200, pc_resp.text)
        pc_body = pc_resp.json()
        self.assertEqual(pc_body["vault"]["rejected_packs"], [])
        self.assertEqual(sorted(pc_body["vault"]["owned"]), sorted(expanded_pack))
        self.assertEqual(pc_body["vault"]["notes"][expanded_pack[0]], "Web/Robotics 扩展卡笔记")

        # Phone syncs without touching profile/route and explicitly unfavorites 'mdn-js'
        phone_resp = self.client.post(
            "/api/sync/union",
            headers=headers,
            json={
                "profile": None,
                "progress": {
                    "favorites": ["python-docs"],
                    "activeCourse": None,
                    "activeRoute": None,
                },
                "unfavorited": ["mdn-js"],
                "courses": {},
                "vault": {},
            },
        )
        self.assertEqual(phone_resp.status_code, 200, phone_resp.text)
        phone_body = phone_resp.json()
        self.assertEqual(phone_body["profile"]["nickname"], "PC端新昵称")
        self.assertEqual(phone_body["progress"]["activeCourse"], "lv-iot-protocols")
        self.assertEqual(phone_body["progress"]["activeRoute"], "major-080905")
        self.assertEqual(phone_body["progress"]["favorites"], ["python-docs"])
        self.assertEqual(sorted(phone_body["vault"]["owned"]), sorted(expanded_pack))
        self.assertIsNotNone(phone_body["ai_quota"])


if __name__ == "__main__":
    unittest.main()
