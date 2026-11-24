from __future__ import annotations

import sqlite3
import unittest
import uuid

from tests.conftest import make_test_context


class TestDiscussionsMigrationAndSecurity(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = make_test_context(discussion_rate_limit_per_minute=6)
        self.ctx.sign_in()
        self.client = self.ctx.client
        self.container = self.ctx.app.state.container
        self.room_url = "/api/discussions/lv-python-foundations/values"

    def tearDown(self) -> None:
        self.ctx.close()

    def test_frontend_contract_threads_replies_pagination_and_nonce_idempotency(
        self,
    ) -> None:
        # 1. Unknown chapter returns 404 with exact frontend message
        r_404 = self.client.get("/api/discussions/lv-python-foundations/nonexistent")
        self.assertEqual(r_404.status_code, 404)
        self.assertEqual(r_404.json()["error"], "找不到这个章节。")

        # 2. Unsupported HTTP method returns 405 with Allow: GET, POST
        r_405 = self.client.put(self.room_url)
        self.assertEqual(r_405.status_code, 405)
        self.assertEqual(r_405.headers.get("allow"), "GET, POST")

        # 3. Cross-origin submission is rejected with 403
        r_csrf = self.client.post(
            self.room_url,
            headers={"Origin": "https://evil.example.com", "Host": "testserver"},
            json={"id": uuid.uuid4().hex, "parent": None, "name": "小林", "body": "你好"},
        )
        self.assertEqual(r_csrf.status_code, 403)

        # 4. Create a top-level discussion thread and test lost-ACK nonce retry idempotency
        nonce = uuid.uuid4().hex
        payload = {
            "id": nonce,
            "parent": None,
            "name": "小林",
            "body": "我把例子换成了自己的输入。",
        }
        r_post1 = self.client.post(self.room_url, json=payload)
        self.assertEqual(r_post1.status_code, 200)
        self.assertEqual(r_post1.json(), {"saved": True})

        # Retrying the exact same nonce + payload returns 200 without duplicating
        r_post_retry = self.client.post(self.room_url, json=payload)
        self.assertEqual(r_post_retry.status_code, 200)
        self.assertEqual(r_post_retry.json(), {"saved": True})

        # Reusing the same nonce with different body returns 409 Conflict
        r_post_conflict = self.client.post(
            self.room_url,
            json={**payload, "body": "篡改后的不同内容"},
        )
        self.assertEqual(r_post_conflict.status_code, 409)

        # 5. List threads & post 4 replies to test reply pagination (`olderRepliesBefore`)
        listing = self.client.get(self.room_url).json()
        self.assertEqual(len(listing["threads"]), 1)
        thread_id = listing["threads"][0]["id"]
        self.assertEqual(listing["threads"][0]["name"], "小林")

        for idx in range(1, 5):
            r_rep = self.client.post(
                self.room_url,
                json={
                    "id": uuid.uuid4().hex,
                    "parent": thread_id,
                    "name": "",
                    "body": f"附记 {idx}",
                },
            )
            self.assertEqual(r_rep.status_code, 200)

        listing_after = self.client.get(self.room_url).json()
        thread_item = listing_after["threads"][0]
        # Thread preview shows latest 3 replies ('附记 2', '附记 3', '附记 4') and sets olderRepliesBefore
        self.assertEqual(
            [r["body"] for r in thread_item["replies"]],
            ["附记 2", "附记 3", "附记 4"],
        )
        self.assertIsNotNone(thread_item["olderRepliesBefore"])

        older_page = self.client.get(
            f"{self.room_url}?thread={thread_id}&before={thread_item['olderRepliesBefore']}"
        ).json()
        self.assertEqual([r["body"] for r in older_page["replies"]], ["附记 1"])
        self.assertIsNone(older_page["olderRepliesBefore"])

    def test_reverse_proxy_real_ip_rate_limit_isolation(self) -> None:
        """
        Verifies that behind Nginx reverse proxy, Student A hitting the rate limit
        does NOT block Student B who has a different X-Forwarded-For IP!
        """
        ip_a = "203.0.113.11"
        ip_b = "203.0.113.22"

        # Student A sends 6 posts (reaching the 6/min limit in this test fixture)
        for i in range(6):
            r = self.client.post(
                self.room_url,
                headers={"X-Forwarded-For": ip_a},
                json={
                    "id": uuid.uuid4().hex,
                    "parent": None,
                    "name": "学员A",
                    "body": f"A 的第 {i + 1} 条发言",
                },
            )
            self.assertEqual(r.status_code, 200)

        # Student A's 7th post is rate-limited (429)
        r_a_blocked = self.client.post(
            self.room_url,
            headers={"X-Forwarded-For": ip_a},
            json={
                "id": uuid.uuid4().hex,
                "parent": None,
                "name": "学员A",
                "body": "A 的第 5 条超限发言",
            },
        )
        self.assertEqual(r_a_blocked.status_code, 429)

        # Student B behind the SAME Nginx reverse proxy can still post normally!
        self.ctx.sign_in("student_b")
        r_b_ok = self.client.post(
            self.room_url,
            headers={"X-Forwarded-For": ip_b},
            json={
                "id": uuid.uuid4().hex,
                "parent": None,
                "name": "学员B",
                "body": "B 的正常发言不受 A 影响",
            },
        )
        self.assertEqual(r_b_ok.status_code, 200)

    def test_xss_zero_width_keyword_filter_and_sql_injection_defense(self) -> None:
        # 1. XSS payload in body or name -> rejected 400
        for xss in [
            "<script>alert(1)</script>",
            "<img src=x onerror=alert(document.cookie)>",
            "javascript:fetch('https://evil.com')",
        ]:
            r_xss = self.client.post(
                self.room_url,
                json={"id": uuid.uuid4().hex, "parent": None, "name": "测试", "body": xss},
            )
            self.assertEqual(r_xss.status_code, 400, f"XSS not blocked: {xss}")

        # 2. Keyword filter with zero-width char evasion & full-width NFKC evasion
        for spam in ["欢迎参与赌\u200b博网站", "专业代_考服务", "全自动外　挂下载"]:
            r_spam = self.client.post(
                self.room_url,
                json={
                    "id": uuid.uuid4().hex,
                    "parent": None,
                    "name": "测试",
                    "body": spam,
                },
            )
            self.assertEqual(r_spam.status_code, 400, f"Spam not blocked: {spam}")

        # 3. SQL injection attempt in discussion body or query params
        sqli_body = "'); DROP TABLE posts; --"
        r_sqli = self.client.post(
            self.room_url,
            json={
                "id": uuid.uuid4().hex,
                "parent": None,
                "name": "Robert');--",
                "body": sqli_body,
            },
        )
        self.assertEqual(r_sqli.status_code, 200)
        # Table posts is intact and stores the literal string safely
        listing = self.client.get(self.room_url).json()
        self.assertEqual(listing["threads"][0]["body"], sqli_body)

    def test_admin_moderation_and_legacy_sqlite_migration(self) -> None:
        # 1. Create a thread and a reply
        self.client.post(
            self.room_url,
            headers={"X-Forwarded-For": "192.0.2.99"},
            json={
                "id": uuid.uuid4().hex,
                "parent": None,
                "name": "违规号",
                "body": "需要管理员清理的测试帖",
            },
        )
        threads = self.client.get(self.room_url).json()["threads"]
        tid = threads[0]["id"]
        self.client.post(
            self.room_url,
            headers={"X-Forwarded-For": "192.0.2.99"},
            json={
                "id": uuid.uuid4().hex,
                "parent": tid,
                "name": "路人",
                "body": "这条下的回复",
            },
        )

        # 2. Without admin token -> 403 Forbidden
        r_unauth = self.client.delete(f"/api/admin/discussions/{tid}")
        self.assertEqual(r_unauth.status_code, 403)

        # 3. With valid X-Admin-Token -> cascades deletion to thread and its replies
        admin_headers = {"Authorization": "Bearer " + self.ctx.sign_in("moderator", "admin")}
        r_del = self.client.delete(
            f"/api/admin/discussions/{tid}", headers=admin_headers
        )
        self.assertEqual(r_del.status_code, 200)
        self.assertEqual(r_del.json()["affected_count"], 2)

        after_del = self.client.get(self.room_url).json()
        self.assertEqual(after_del["threads"], [])

        # 4. Test migrating a legacy `.learnverse/discussions.sqlite` database
        legacy_file = self.ctx.temp_dir / "legacy_discussions.sqlite"
        legacy_conn = sqlite3.connect(str(legacy_file))
        legacy_conn.executescript(
            """
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY, room TEXT NOT NULL, nonce TEXT NOT NULL UNIQUE,
                parent INTEGER, name TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL
            );
            INSERT INTO posts (id, room, nonce, parent, name, body, created)
            VALUES (100, 'lv-python-foundations/values', '0123456789abcdef0123456789abcdef', NULL, '老学员', '来自旧版 Vite SQLite 的讨论', '2026-10-01T00:00:00.000Z');
            """
        )
        legacy_conn.close()

        imported_count = self.container.db.migrate_legacy_discussions(legacy_file)
        self.assertEqual(imported_count, 1)
        # Second migration is idempotent (0 duplicates)
        self.assertEqual(self.container.db.migrate_legacy_discussions(legacy_file), 0)

        migrated_listing = self.client.get(self.room_url).json()
        self.assertEqual(len(migrated_listing["threads"]), 1)
        self.assertEqual(
            migrated_listing["threads"][0]["body"], "来自旧版 Vite SQLite 的讨论"
        )


if __name__ == "__main__":
    unittest.main()
