"""Durable admission shared by all workers using the station's SQLite database."""
import math
import time
import uuid
from dataclasses import dataclass

from fastapi import HTTPException

from ..db import DatabaseManager


STREAM_SECONDS = 120
COOLDOWN_SECONDS = 4


@dataclass
class Admission:
    owner: str
    user_id: int
    day: int
    reserved: int
    deadline: float
    reported_tokens: int | None = None
    used_today: int = 0
    daily_limit: int = 0


def get_daily_usage(db: DatabaseManager, user_id: int) -> tuple[int, int]:
    """Returns `(used_today, seconds_until_shanghai_midnight_reset)`."""
    now = time.time()
    day = int((now + 8 * 3600) // 86400)
    reset = math.ceil((day + 1) * 86400 - 8 * 3600 - now)
    with db.read_connection() as conn:
        row = conn.execute(
            "SELECT calls FROM ai_user_day WHERE day=? AND user_id=?",
            (day, user_id),
        ).fetchone()
        used = int(row["calls"]) if row else 0
    return used, reset


def admit(db: DatabaseManager, user_id: int, daily_limit: int, reserved: int,
          budget: int) -> Admission:
    with db.write_transaction() as conn:
        now = time.time()
        # Shanghai midnight, independent of the server's timezone.
        day = int((now + 8 * 3600) // 86400)
        reset = math.ceil((day + 1) * 86400 - 8 * 3600 - now)
        lock = conn.execute("SELECT owner, until FROM ai_user_lock WHERE user_id=?",
                            (user_id,)).fetchone()
        if lock and lock["until"] > now:
            message = "Vesper 正在回复上一条提问。" if lock["owner"] else "请等待 4 秒后再提问。"
            retry = COOLDOWN_SECONDS if lock["owner"] else math.ceil(lock["until"] - now)
            raise HTTPException(429, message, headers={"Retry-After": str(retry)})
        row = conn.execute("SELECT calls FROM ai_user_day WHERE day=? AND user_id=?",
                           (day, user_id)).fetchone()
        calls_before = int(row["calls"]) if row else 0
        if calls_before >= daily_limit:
            raise HTTPException(
                429,
                f"今日 {daily_limit} 次免费提问额度已用完，明天再来吧。",
                headers={
                    "Retry-After": str(reset),
                    "X-AI-Daily-Limit": str(daily_limit),
                    "X-AI-Daily-Used": str(calls_before),
                    "X-AI-Daily-Remaining": "0",
                },
            )
        if reserved:
            row = conn.execute("SELECT tokens FROM ai_token_day WHERE day=?", (day,)).fetchone()
            if (row["tokens"] if row else 0) + reserved > budget:
                raise HTTPException(503, "Vesper 今日 AI 预算暂时不足，请先使用本地代码诊断或稍后再试。",
                                    headers={"Retry-After": str(reset)})
            conn.execute("""INSERT INTO ai_token_day VALUES (?, ?)
                            ON CONFLICT(day) DO UPDATE SET tokens=tokens+excluded.tokens""",
                         (day, reserved))
        conn.execute("""INSERT INTO ai_user_day VALUES (?, ?, 1)
                        ON CONFLICT(day,user_id) DO UPDATE SET calls=calls+1""", (day, user_id))
        used_today = calls_before + 1
        lease = Admission(
            uuid.uuid4().hex,
            user_id,
            day,
            reserved,
            time.monotonic() + STREAM_SECONDS,
            used_today=used_today,
            daily_limit=daily_limit,
        )
        conn.execute("INSERT OR REPLACE INTO ai_user_lock VALUES (?,?,?)",
                     (user_id, lease.owner, now + STREAM_SECONDS + COOLDOWN_SECONDS + 5))
        return lease


def finish(db: DatabaseManager, lease: Admission) -> None:
    with db.write_transaction() as conn:
        changed = conn.execute(
            "UPDATE ai_user_lock SET owner='', until=? WHERE user_id=? AND owner=?",
            (time.time() + COOLDOWN_SECONDS, lease.user_id, lease.owner),
        ).rowcount
        # Missing usage, a disconnect or a crash conservatively retains the reservation.
        if changed and lease.reserved and lease.reported_tokens is not None:
            conn.execute("UPDATE ai_token_day SET tokens=tokens+? WHERE day=?",
                         (lease.reported_tokens - lease.reserved, lease.day))
