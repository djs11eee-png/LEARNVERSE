from __future__ import annotations

import asyncio
import functools
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator, ParamSpec, TypeVar

P = ParamSpec("P")
T = TypeVar("T")

SCHEMA_SQL = """
-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    email_verified INTEGER NOT NULL DEFAULT 0,
    nickname TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    welcome_state TEXT NOT NULL DEFAULT 'new' CHECK (welcome_state IN ('new', 'skipped', 'finished')),
    student_path TEXT CHECK (student_path IS NULL OR student_path IN ('major', 'interest', 'undecided')),
    student_choice TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Overall Learning Progress (Lazy Auth Union Target)
CREATE TABLE IF NOT EXISTS user_progress (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    completed_courses_json TEXT NOT NULL DEFAULT '[]',
    started_courses_json TEXT NOT NULL DEFAULT '[]',
    favorites_json TEXT NOT NULL DEFAULT '[]',
    minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
    activity_json TEXT NOT NULL DEFAULT '[]',
    active_course TEXT,
    active_route TEXT,
    study_days_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
);

-- 3. Per-Course Workspace Records (completed, verified, projectCompleted, transferCompleted)
CREATE TABLE IF NOT EXISTS user_course_records (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    completed_lessons_json TEXT NOT NULL DEFAULT '[]',
    verified_lessons_json TEXT NOT NULL DEFAULT '[]',
    last_lesson TEXT NOT NULL DEFAULT '',
    project_completed INTEGER NOT NULL DEFAULT 0,
    transfer_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, course_id)
);

-- 4. Card Vault Earned Entitlements (Idempotent Set Union)
CREATE TABLE IF NOT EXISTS user_vault_earned (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_key TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    PRIMARY KEY (user_id, pack_key)
);

-- 5. Card Vault Packs (Write-Once Latch: prevents duplicate sync pack-farming / reroll exploits)
CREATE TABLE IF NOT EXISTS user_vault_packs (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('offered', 'opened')),
    cards_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    opened_at TEXT,
    PRIMARY KEY (user_id, pack_key)
);

-- 6. Card Vault Personal Notes
CREATE TABLE IF NOT EXISTS user_vault_notes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    note TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, card_id)
);

-- 7. Chapter Discussions (Compatible with scripts/discussions.mjs + Admin Moderation)
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    parent INTEGER,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    client_ip TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_by_room ON posts(room, is_deleted, parent, id);
CREATE INDEX IF NOT EXISTS posts_by_parent ON posts(parent, is_deleted, id);
CREATE INDEX IF NOT EXISTS posts_by_ip_created ON posts(client_ip, created);

-- 8. AI Q&A Audit & Structured Diagnostics Log
CREATE TABLE IF NOT EXISTS ai_qa_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_ip TEXT NOT NULL,
    course_id TEXT,
    lesson_id TEXT,
    language TEXT,
    question TEXT NOT NULL,
    code_snippet TEXT NOT NULL DEFAULT '',
    error_input TEXT NOT NULL DEFAULT '',
    intercepted INTEGER NOT NULL DEFAULT 0,
    diagnostics_json TEXT NOT NULL DEFAULT '[]',
    answer_text TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_qa_logs_by_user ON ai_qa_logs(user_id, id DESC);

CREATE TABLE IF NOT EXISTS ai_user_day (
    day INTEGER NOT NULL, user_id INTEGER NOT NULL, calls INTEGER NOT NULL,
    PRIMARY KEY(day, user_id)
);
CREATE TABLE IF NOT EXISTS ai_token_day (day INTEGER PRIMARY KEY, tokens INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ai_user_lock (user_id INTEGER PRIMARY KEY, owner TEXT NOT NULL, until REAL NOT NULL);
CREATE TABLE IF NOT EXISTS jwt_revocations (jti TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS jwt_revocations_exp ON jwt_revocations(expires);
CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY);

-- 9. Durable Seoul Genesis Node Guardian Ledger & Per-User Claims
CREATE TABLE IF NOT EXISTS guardian_github_ranks (
    github_user_id TEXT PRIMARY KEY,
    github_login TEXT NOT NULL DEFAULT '',
    rank INTEGER NOT NULL UNIQUE CHECK (rank >= 1),
    claimed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_guardian_claims (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    github_user_id TEXT NOT NULL,
    github_login TEXT NOT NULL,
    rank INTEGER NOT NULL CHECK (rank >= 1),
    ai_daily_bonus INTEGER NOT NULL DEFAULT 10,
    claimed_at TEXT NOT NULL
);
"""


class DatabaseManager:
    """
    SQLite WAL database manager tuned for 2 vCPU / 2 GiB RAM.
    - Uses WAL journal mode so concurrent readers never block writers.
    - Caps per-connection page cache to ~16 MiB (`PRAGMA cache_size = -16000`).
    - Serializes write transactions cleanly via `BEGIN IMMEDIATE` and a write lock
      while allowing concurrent read connections across threads.
    """

    def __init__(
        self,
        db_path: str | Path,
        cache_kb: int = -16000,
        busy_timeout_ms: int = 5000,
    ) -> None:
        self.db_path = Path(db_path)
        self.cache_kb = cache_kb
        self.busy_timeout_ms = busy_timeout_ms
        self._write_lock = threading.RLock()
        self._local = threading.local()
        self._connections: list[sqlite3.Connection] = []
        self._conn_lock = threading.Lock()
        # Bounded SQLite worker pool keeps event loop non-blocking while capping per-thread page caches on 2C2G
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="lv-sqlite")

    async def run_sync(self, func: Callable[P, T], /, *args: P.args, **kwargs: P.kwargs) -> T:
        loop = asyncio.get_running_loop()
        call = functools.partial(func, *args, **kwargs)
        return await loop.run_in_executor(self._executor, call)

    def initialize(self, legacy_discussion_db: str | Path | None = None) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._write_lock:
            conn = self.get_connection()
            conn.executescript(SCHEMA_SQL)
        with self.write_transaction() as conn:
            if conn.execute("INSERT OR IGNORE INTO schema_migrations VALUES ('ai-daily-ledger-v1')").rowcount:
                # Carry today's completed calls forward on upgrade. Older logs did not record token usage.
                conn.execute("""
                    INSERT INTO ai_user_day(day,user_id,calls)
                    SELECT (unixepoch(created_at)+28800)/86400, user_id, count(*) FROM ai_qa_logs
                    WHERE unixepoch(created_at) >= ((unixepoch()+28800)/86400)*86400-28800
                    GROUP BY 1,2
                """)
            # Ensure older discussion databases migrated in-place have new columns if needed
            existing_cols = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(posts)").fetchall()
            }
            if "user_id" not in existing_cols:
                conn.execute("ALTER TABLE posts ADD COLUMN user_id INTEGER")
            if "client_ip" not in existing_cols:
                conn.execute("ALTER TABLE posts ADD COLUMN client_ip TEXT NOT NULL DEFAULT ''")
            if "is_deleted" not in existing_cols:
                conn.execute("ALTER TABLE posts ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")

        if legacy_discussion_db:
            self.migrate_legacy_discussions(legacy_discussion_db)

    def revoke_jwt(self, jti: str, expires: int) -> None:
        with self.write_transaction() as conn:
            conn.execute("DELETE FROM jwt_revocations WHERE expires <= unixepoch()")
            conn.execute("INSERT OR REPLACE INTO jwt_revocations VALUES (?,?)", (jti, expires))

    def claim_guardian_durable(
        self,
        *,
        user_id: int,
        github_user_id: str,
        github_login: str,
        ai_daily_bonus: int = 10,
        preferred_rank: int | None = None,
        count_in_global_ledger: bool = True,
    ) -> dict[str, Any]:
        """
        Durably records a Seoul Genesis Node Guardian claim in SQLite so neither
        cross-device logins nor ephemeral Redis restarts ever lose a user's rank or +10 AI bonus.
        """
        now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        clean_gh_id = str(github_user_id).strip()[:96]
        clean_login = (str(github_login).strip() or "GitHub Star")[:64]

        with self.write_transaction() as conn:
            existing_user = conn.execute(
                """
                SELECT rank, github_login, ai_daily_bonus, claimed_at
                FROM user_guardian_claims WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()

            if count_in_global_ledger:
                ledger_row = conn.execute(
                    "SELECT rank, claimed_at FROM guardian_github_ranks WHERE github_user_id = ?",
                    (clean_gh_id,),
                ).fetchone()
                if ledger_row is not None:
                    rank = int(ledger_row["rank"])
                    claimed_at = str(ledger_row["claimed_at"])
                else:
                    max_row = conn.execute(
                        "SELECT COALESCE(MAX(rank), 0) AS max_rank FROM guardian_github_ranks"
                    ).fetchone()
                    next_db_rank = int(max_row["max_rank"] if max_row else 0) + 1
                    rank = max(next_db_rank, int(preferred_rank or 1))
                    claimed_at = str(existing_user["claimed_at"]) if existing_user else now_iso
                    conn.execute(
                        """
                        INSERT INTO guardian_github_ranks (github_user_id, github_login, rank, claimed_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (clean_gh_id, clean_login, rank, claimed_at),
                    )
            else:
                rank = int(existing_user["rank"]) if existing_user else max(1, int(preferred_rank or 1))
                claimed_at = str(existing_user["claimed_at"]) if existing_user else now_iso

            conn.execute(
                """
                INSERT INTO user_guardian_claims (
                    user_id, github_user_id, github_login, rank, ai_daily_bonus, claimed_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    github_user_id = excluded.github_user_id,
                    github_login = excluded.github_login,
                    rank = excluded.rank,
                    ai_daily_bonus = excluded.ai_daily_bonus
                """,
                (user_id, clean_gh_id, clean_login, rank, int(ai_daily_bonus), claimed_at),
            )

        return {
            "rank": rank,
            "githubUser": clean_login,
            "claimedAt": claimed_at,
            "aiDailyBonus": int(ai_daily_bonus),
        }

    def get_user_guardian(self, user_id: int) -> dict[str, Any] | None:
        with self.read_connection() as conn:
            row = conn.execute(
                """
                SELECT rank, github_login, ai_daily_bonus, claimed_at
                FROM user_guardian_claims WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "rank": int(row["rank"]),
            "githubUser": str(row["github_login"]),
            "claimedAt": str(row["claimed_at"]),
            "aiDailyBonus": int(row["ai_daily_bonus"]),
        }

    def get_durable_guardian_claimed_count(self) -> int:
        with self.read_connection() as conn:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM guardian_github_ranks").fetchone()
        return int(row["cnt"]) if row else 0

    def _create_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(
            str(self.db_path),
            timeout=max(1.0, self.busy_timeout_ms / 1000.0),
            isolation_level=None,  # Explicit transaction control
            check_same_thread=False,
        )
        conn.row_factory = sqlite3.Row
        conn.execute(f"PRAGMA busy_timeout = {int(self.busy_timeout_ms)};")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute(f"PRAGMA cache_size = {int(self.cache_kb)};")
        conn.execute("PRAGMA temp_store = MEMORY;")
        with self._conn_lock:
            self._connections.append(conn)
        return conn

    def get_connection(self) -> sqlite3.Connection:
        conn: sqlite3.Connection | None = getattr(self._local, "conn", None)
        if conn is None:
            conn = self._create_connection()
            self._local.conn = conn
        return conn

    @contextmanager
    def read_connection(self) -> Iterator[sqlite3.Connection]:
        yield self.get_connection()

    @contextmanager
    def write_transaction(self) -> Iterator[sqlite3.Connection]:
        """
        Acquires thread-level write lock and starts an immediate SQLite WAL transaction.
        Automatically commits on normal exit and rolls back on exception.
        """
        with self._write_lock:
            conn = self.get_connection()
            conn.execute("BEGIN IMMEDIATE")
            try:
                yield conn
                if conn.in_transaction:
                    conn.execute("COMMIT")
            except Exception:
                try:
                    if conn.in_transaction:
                        conn.execute("ROLLBACK")
                except sqlite3.Error:
                    pass
                raise

    def migrate_legacy_discussions(self, legacy_path: str | Path) -> int:
        """
        Smoothly imports any posts from the legacy Vite `.learnverse/discussions.sqlite`
        into the unified SQLite WAL database idempotently by `nonce`.
        """
        path = Path(legacy_path)
        if not path.is_file() or path.resolve() == self.db_path.resolve():
            return 0
        imported = 0
        try:
            legacy_conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
            legacy_conn.row_factory = sqlite3.Row
            try:
                rows = legacy_conn.execute(
                    "SELECT id, room, nonce, parent, name, body, created FROM posts ORDER BY id ASC"
                ).fetchall()
            finally:
                legacy_conn.close()
        except sqlite3.Error:
            return 0

        if not rows:
            return 0

        with self.write_transaction() as conn:
            for row in rows:
                cursor = conn.execute(
                    """
                    INSERT OR IGNORE INTO posts (id, room, nonce, parent, name, body, created)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["id"],
                        row["room"],
                        row["nonce"],
                        row["parent"],
                        row["name"],
                        row["body"],
                        row["created"],
                    ),
                )
                imported += cursor.rowcount
        return imported

    def close_all(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=False)
        with self._conn_lock:
            conns = list(self._connections)
            self._connections.clear()
        self._local = threading.local()
        for conn in conns:
            try:
                conn.close()
            except sqlite3.Error:
                pass
