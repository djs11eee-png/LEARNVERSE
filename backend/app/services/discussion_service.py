from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

from ..db import DatabaseManager

PAGE_SIZE = 8
MAX_BODY_BYTES = 12_000
MAX_SAFE_INTEGER = 9007199254740991
NONCE_RE = re.compile(r"^[a-f0-9]{32}$")
ZERO_WIDTH_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u202a-\u202e\ufeff]")
XSS_DANGEROUS_RE = re.compile(
    r"(?:<\s*/?\s*(?:script|iframe|object|embed|svg|math|style|link|meta)\b|javascript\s*:|vbscript\s*:|data\s*:\s*text/html|\bon(?:error|load|click|mouseover|focus|toggle)\s*=)",
    re.IGNORECASE,
)


class DiscussionRequestError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sanitize_and_filter_text(
    text: str, blocked_keywords: list[str]
) -> tuple[str, str | None]:
    """
    1. Strips null bytes, control chars, and zero-width evasion characters.
    2. Normalizes text with NFKC to defeat full-width / lookalike bypasses.
    3. Checks against XSS patterns and blocked keywords.
    Returns `(cleaned_text, matched_reason_or_none)`.
    """
    cleaned = ZERO_WIDTH_RE.sub("", text).strip()
    nfkc_lower = unicodedata.normalize("NFKC", cleaned).lower()
    collapsed = re.sub(r"[\s._\-*]+", "", nfkc_lower)

    if XSS_DANGEROUS_RE.search(nfkc_lower):
        return cleaned, "xss_payload"

    for kw in blocked_keywords:
        norm_kw = unicodedata.normalize("NFKC", kw.strip()).lower()
        if not norm_kw:
            continue
        if norm_kw in nfkc_lower or norm_kw in collapsed:
            return cleaned, norm_kw

    return cleaned, None


class DiscussionService:
    """
    Unified SQLite WAL Chapter Discussion Service:
    - Drop-in replacement for `scripts/discussions.mjs` with identical API contract.
    - Adds NFKC + zero-width-aware keyword & XSS filtering.
    - Adds Admin moderation & batch purge capabilities.
    """

    def __init__(
        self, db: DatabaseManager, blocked_keywords: list[str] | None = None
    ) -> None:
        self.db = db
        self.blocked_keywords = list(blocked_keywords or [])

    def validate_and_parse_post(self, raw_body: bytes) -> dict[str, Any]:
        if len(raw_body) > MAX_BODY_BYTES:
            raise DiscussionRequestError(413, "这条内容太长了。")
        try:
            value = __import__("json").loads(raw_body.decode("utf-8"))
        except Exception as exc:
            raise DiscussionRequestError(400, "讨论内容格式有误。") from exc

        if not isinstance(value, dict):
            raise DiscussionRequestError(400, "讨论内容格式有误。")

        raw_name = value.get("name") if isinstance(value.get("name"), str) else ""
        raw_content = value.get("body") if isinstance(value.get("body"), str) else ""
        if "\r" in raw_name or "\n" in raw_name:
            raise DiscussionRequestError(
                400, "署名最多 24 个字符，内容需要 1 至 1500 个字符。"
            )

        name, name_hit = sanitize_and_filter_text(raw_name, self.blocked_keywords)
        body, body_hit = sanitize_and_filter_text(raw_content, self.blocked_keywords)

        if not body or len(body) > 1500 or len(name) > 24:
            raise DiscussionRequestError(
                400, "署名最多 24 个字符，内容需要 1 至 1500 个字符。"
            )

        if name_hit or body_hit:
            raise DiscussionRequestError(
                400, "讨论内容包含不当或受限词汇，请修改后再发。"
            )

        post_id = value.get("id")
        if not isinstance(post_id, str) or not NONCE_RE.match(post_id):
            raise DiscussionRequestError(400, "提交标识有误，请重新编辑后再发。")

        parent = value.get("parent")
        if parent is not None:
            if (
                isinstance(parent, bool)
                or not isinstance(parent, int)
                or parent <= 0
                or parent > MAX_SAFE_INTEGER
            ):
                raise DiscussionRequestError(400, "请选择要回复的讨论。")

        return {
            "id": post_id,
            "parent": parent,
            "name": name or "访客",
            "body": body,
        }

    def list_replies(
        self, room: str, parent: int, before: int, limit: int = 12
    ) -> dict[str, Any]:
        with self.db.read_connection() as conn:
            rows = conn.execute(
                """
                SELECT id, name, body, created
                FROM posts
                WHERE room = ? AND parent = ? AND is_deleted = 0 AND id < ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (room, parent, before, limit + 1),
            ).fetchall()

        replies = [
            {
                "id": int(r["id"]),
                "name": r["name"],
                "body": r["body"],
                "created": r["created"],
            }
            for r in rows
        ]
        more = len(replies) > limit
        if more:
            replies.pop()
        replies.reverse()
        return {
            "replies": replies,
            "olderRepliesBefore": replies[0]["id"] if (more and replies) else None,
        }

    def list_posts(self, room: str, before: int) -> dict[str, Any]:
        replies_by_parent: dict[int, list[dict[str, Any]]] = {}
        with self.db.read_connection() as conn:
            rows = conn.execute(
                """
                SELECT id, name, body, created
                FROM posts
                WHERE room = ? AND parent IS NULL AND is_deleted = 0 AND id < ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (room, before, PAGE_SIZE + 1),
            ).fetchall()

            threads_raw = [
                {
                    "id": int(r["id"]),
                    "name": r["name"],
                    "body": r["body"],
                    "created": r["created"],
                }
                for r in rows
            ]
            more = len(threads_raw) > PAGE_SIZE
            if more:
                threads_raw.pop()

            if threads_raw:
                thread_ids = [t["id"] for t in threads_raw]
                placeholders = ",".join("?" for _ in thread_ids)
                reply_rows = conn.execute(
                    f"""
                    SELECT id, parent, name, body, created
                    FROM (
                        SELECT
                            id,
                            parent,
                            name,
                            body,
                            created,
                            ROW_NUMBER() OVER (
                                PARTITION BY parent ORDER BY id DESC
                            ) AS rn
                        FROM posts
                        WHERE room = ?
                          AND is_deleted = 0
                          AND id < ?
                          AND parent IN ({placeholders})
                    )
                    WHERE rn <= 4
                    ORDER BY parent ASC, id DESC
                    """,
                    (room, MAX_SAFE_INTEGER, *thread_ids),
                ).fetchall()

                for r in reply_rows:
                    pid = int(r["parent"])
                    replies_by_parent.setdefault(pid, []).append(
                        {
                            "id": int(r["id"]),
                            "name": r["name"],
                            "body": r["body"],
                            "created": r["created"],
                        }
                    )

        threads: list[dict[str, Any]] = []
        for t in threads_raw:
            bucket = replies_by_parent.get(t["id"], [])
            more_replies = len(bucket) > 3
            if more_replies:
                bucket.pop()
            bucket.reverse()
            threads.append(
                {
                    **t,
                    "replies": bucket,
                    "olderRepliesBefore": bucket[0]["id"]
                    if (more_replies and bucket)
                    else None,
                }
            )
        return {
            "threads": threads,
            "nextBefore": threads[-1]["id"] if (more and threads) else None,
        }

    def thread_exists(self, room: str, thread_id: int) -> bool:
        with self.db.read_connection() as conn:
            row = conn.execute(
                """
                SELECT id FROM posts
                WHERE room = ? AND parent IS NULL AND is_deleted = 0 AND id = ?
                """,
                (room, thread_id),
            ).fetchone()
        return row is not None

    def check_nonce_state(
        self, room: str, post: dict[str, Any]
    ) -> Literal_NonceState:
        """
        Pre-checks whether the submission nonce already exists before charging rate limit.
        """
        with self.db.read_connection() as conn:
            existing = conn.execute(
                "SELECT id, room, parent, name, body, is_deleted FROM posts WHERE nonce = ?",
                (post["id"],),
            ).fetchone()
        if existing is None:
            return "new"
        if (
            existing["room"] != room
            or existing["parent"] != post["parent"]
            or existing["name"] != post["name"]
            or existing["body"] != post["body"]
            or existing["is_deleted"] != 0
        ):
            raise DiscussionRequestError(409, "此次提交已使用，请重新编辑后再发。")
        return "duplicate_exact"

    def save_post(
        self,
        *,
        room: str,
        post: dict[str, Any],
        user_id: int | None = None,
        client_ip: str = "",
    ) -> bool:
        with self.db.write_transaction() as conn:
            existing = conn.execute(
                "SELECT id, room, parent, name, body, is_deleted FROM posts WHERE nonce = ?",
                (post["id"],),
            ).fetchone()
            if existing is not None:
                if (
                    existing["room"] != room
                    or existing["parent"] != post["parent"]
                    or existing["name"] != post["name"]
                    or existing["body"] != post["body"]
                    or existing["is_deleted"] != 0
                ):
                    raise DiscussionRequestError(
                        409, "此次提交已使用，请重新编辑后再发。"
                    )
                return False

            if post["parent"] is not None:
                thread = conn.execute(
                    """
                    SELECT id FROM posts
                    WHERE room = ? AND id = ? AND parent IS NULL AND is_deleted = 0
                    """,
                    (room, post["parent"]),
                ).fetchone()
                if thread is None:
                    raise DiscussionRequestError(404, "本章找不到这条讨论。")

            conn.execute(
                """
                INSERT INTO posts (room, nonce, parent, user_id, client_ip, name, body, is_deleted, created)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (
                    room,
                    post["id"],
                    post["parent"],
                    user_id,
                    client_ip,
                    post["name"],
                    post["body"],
                    _now_iso(),
                ),
            )
            return True

    # --- Admin Moderation & Cleanup APIs ---

    def admin_list_posts(
        self,
        *,
        room: str | None = None,
        keyword: str | None = None,
        include_deleted: bool = False,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        clauses = ["1=1"]
        params: list[Any] = []
        if not include_deleted:
            clauses.append("is_deleted = 0")
        if room:
            clauses.append("room = ?")
            params.append(room)
        if keyword:
            clauses.append("(body LIKE ? OR name LIKE ?)")
            like_pat = f"%{keyword}%"
            params.extend([like_pat, like_pat])

        params.append(max(1, min(limit, 200)))
        sql = f"""
            SELECT id, room, parent, user_id, client_ip, name, body, is_deleted, created
            FROM posts
            WHERE {' AND '.join(clauses)}
            ORDER BY id DESC
            LIMIT ?
        """
        with self.db.read_connection() as conn:
            rows = conn.execute(sql, tuple(params)).fetchall()
        return [dict(r) for r in rows]

    def admin_delete_post(self, post_id: int, hard_delete: bool = False) -> int:
        """
        Deletes a post by ID and cascades to its child replies (`parent = post_id`).
        Returns number of affected rows.
        """
        with self.db.write_transaction() as conn:
            if hard_delete:
                cursor = conn.execute(
                    "DELETE FROM posts WHERE id = ? OR parent = ?",
                    (post_id, post_id),
                )
            else:
                cursor = conn.execute(
                    "UPDATE posts SET is_deleted = 1 WHERE (id = ? OR parent = ?) AND is_deleted = 0",
                    (post_id, post_id),
                )
            return int(cursor.rowcount)

    def admin_purge_posts(
        self,
        *,
        room: str | None = None,
        client_ip: str | None = None,
        keyword: str | None = None,
        hard_delete: bool = False,
    ) -> int:
        clauses: list[str] = []
        params: list[Any] = []
        if room:
            clauses.append("room = ?")
            params.append(room)
        if client_ip:
            clauses.append("client_ip = ?")
            params.append(client_ip)
        if keyword:
            clauses.append("(body LIKE ? OR name LIKE ?)")
            like_pat = f"%{keyword}%"
            params.extend([like_pat, like_pat])

        if not clauses:
            raise DiscussionRequestError(
                400, "批量清理请至少指定章节（room）、IP（client_ip）或关键词（keyword）。"
            )

        where_sql = " AND ".join(clauses)
        with self.db.write_transaction() as conn:
            target_rows = conn.execute(
                f"SELECT id FROM posts WHERE {where_sql}", tuple(params)
            ).fetchall()
            target_ids = [int(r["id"]) for r in target_rows]
            if not target_ids:
                return 0
            placeholders = ",".join("?" for _ in target_ids)
            if hard_delete:
                cursor = conn.execute(
                    f"DELETE FROM posts WHERE id IN ({placeholders}) OR parent IN ({placeholders})",
                    tuple(target_ids + target_ids),
                )
            else:
                cursor = conn.execute(
                    f"UPDATE posts SET is_deleted = 1 WHERE (id IN ({placeholders}) OR parent IN ({placeholders})) AND is_deleted = 0",
                    tuple(target_ids + target_ids),
                )
            return int(cursor.rowcount)


from typing import Literal as _Literal

Literal_NonceState = _Literal["new", "duplicate_exact"]
