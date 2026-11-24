from __future__ import annotations

import asyncio
import math
import time
import uuid

# Atomic Redis Lua Script for Sliding-Window Rate Limiting
SLIDING_WINDOW_LUA = """
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

local cutoff = now_ms - window_ms
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)
if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_ms = window_ms
    if oldest and oldest[2] then
        retry_ms = math.max(1000, (tonumber(oldest[2]) + window_ms) - now_ms)
    end
    return {0, count, math.ceil(retry_ms / 1000)}
end
redis.call('ZADD', key, now_ms, member)
redis.call('PEXPIRE', key, window_ms)
return {1, count + 1, 0}
"""

# Atomic Redis Lua Script for GETDEL (compatible with Redis 6.0+ and 7.x)
GETDEL_LUA = """
local val = redis.call('GET', KEYS[1])
if val then
    redis.call('DEL', KEYS[1])
end
return val
"""

# Atomic Redis Lua Script for Seoul Genesis Node Guardian deduplication & monotonic rank (1..N)
CLAIM_GUARDIAN_LUA = """
local claimed_set = KEYS[1]
local rank_hash = KEYS[2]
local seq_key = KEYS[3]
local member = ARGV[1]

local existing = redis.call('HGET', rank_hash, member)
if existing then
    return {tonumber(existing), 1}
end

redis.call('SADD', claimed_set, member)
local rank = redis.call('INCR', seq_key)
redis.call('HSET', rank_hash, member, rank)
return {rank, 0}
"""


class InMemoryRedisBackend:
    """
    Thread/Coroutine-safe in-memory Redis implementation supporting TTLs,
    atomic single-use GETDEL, counters, and ZSET sliding-window rate limiting.
    Used when `REDIS_URL=memory://` in local unit tests or fallback environments.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._kv: dict[str, tuple[str, float | None]] = {}
        self._zsets: dict[str, list[tuple[float, str]]] = {}
        self._sets: dict[str, set[str]] = {}
        self._hashes: dict[str, dict[str, str]] = {}

    def _purge_expired_key(self, key: str, now: float) -> None:
        entry = self._kv.get(key)
        if entry is not None and entry[1] is not None and now >= entry[1]:
            del self._kv[key]

    async def get(self, key: str) -> str | None:
        now = time.monotonic()
        async with self._lock:
            self._purge_expired_key(key, now)
            entry = self._kv.get(key)
            return entry[0] if entry else None

    async def setex(self, key: str, ttl_seconds: int, value: str) -> None:
        now = time.monotonic()
        async with self._lock:
            self._kv[key] = (str(value), now + max(1, int(ttl_seconds)))

    async def getdel(self, key: str) -> str | None:
        now = time.monotonic()
        async with self._lock:
            self._purge_expired_key(key, now)
            entry = self._kv.pop(key, None)
            return entry[0] if entry else None

    async def delete(self, key: str) -> int:
        async with self._lock:
            existed = key in self._kv or key in self._zsets
            self._kv.pop(key, None)
            self._zsets.pop(key, None)
            return 1 if existed else 0

    async def incr_with_ttl(self, key: str, ttl_seconds: int) -> int:
        now = time.monotonic()
        async with self._lock:
            self._purge_expired_key(key, now)
            entry = self._kv.get(key)
            if entry is None:
                val = 1
                exp = now + max(1, int(ttl_seconds))
            else:
                val = int(entry[0]) + 1
                exp = entry[1]
            self._kv[key] = (str(val), exp)
            return val

    async def sliding_window_allow(
        self, key: str, window_seconds: int, limit: int
    ) -> tuple[bool, int, int]:
        now_ms = time.monotonic() * 1000.0
        window_ms = max(1, int(window_seconds)) * 1000.0
        cutoff = now_ms - window_ms
        async with self._lock:
            bucket = [
                (ts, member)
                for ts, member in self._zsets.get(key, [])
                if ts > cutoff
            ]
            count = len(bucket)
            if count >= limit:
                self._zsets[key] = bucket
                oldest_ts = bucket[0][0] if bucket else now_ms
                retry_sec = max(1, math.ceil(((oldest_ts + window_ms) - now_ms) / 1000.0))
                return False, count, retry_sec
            bucket.append((now_ms, uuid.uuid4().hex))
            self._zsets[key] = bucket
            return True, count + 1, 0

    async def set(self, key: str, value: str) -> None:
        async with self._lock:
            self._kv[key] = (str(value), None)

    async def claim_guardian_rank(
        self, claimed_set: str, rank_hash: str, seq_key: str, member: str
    ) -> tuple[int, bool]:
        async with self._lock:
            ranks = self._hashes.setdefault(rank_hash, {})
            if member in ranks:
                return int(ranks[member]), True
            claimed = self._sets.setdefault(claimed_set, set())
            claimed.add(member)
            entry = self._kv.get(seq_key)
            next_rank = (int(entry[0]) if entry is not None else 0) + 1
            self._kv[seq_key] = (str(next_rank), None)
            ranks[member] = str(next_rank)
            return next_rank, False

    async def scard(self, key: str) -> int:
        async with self._lock:
            return len(self._sets.get(key, set()))

    async def flushall(self) -> None:
        async with self._lock:
            self._kv.clear()
            self._zsets.clear()
            self._sets.clear()
            self._hashes.clear()

    async def close(self) -> None:
        await self.flushall()


class RedisStore:
    """
    Unified async Redis security store for:
    - Graphic Captcha TTL & atomic single-use GETDEL verification
    - Dual-dimension (user_id + real_client_ip) sliding-window rate limiting
    - JWT token revocation blacklist
    - Email OTP verification & resend cooldowns
    """

    def __init__(self, redis_url: str = "memory://", key_prefix: str = "lv:") -> None:
        self.redis_url = redis_url
        self.key_prefix = key_prefix
        self._memory: InMemoryRedisBackend | None = None
        self._client = None

        if redis_url.startswith("memory://") or not redis_url:
            self._memory = InMemoryRedisBackend()
        else:
            try:
                import redis.asyncio as aioredis  # type: ignore

                self._client = aioredis.from_url(
                    redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=3.0,
                    socket_timeout=3.0,
                )
            except ImportError as exc:
                raise RuntimeError("Redis mode requires the redis package") from exc

    def _k(self, key: str) -> str:
        return f"{self.key_prefix}{key}"

    async def get(self, key: str) -> str | None:
        full_key = self._k(key)
        if self._memory is not None:
            return await self._memory.get(full_key)
        return await self._client.get(full_key)

    async def set(self, key: str, value: str) -> None:
        full_key = self._k(key)
        if self._memory is not None:
            await self._memory.set(full_key, value)
            return
        await self._client.set(full_key, str(value))

    async def setex(self, key: str, ttl_seconds: int, value: str) -> None:
        full_key = self._k(key)
        if self._memory is not None:
            await self._memory.setex(full_key, ttl_seconds, value)
            return
        await self._client.setex(full_key, int(ttl_seconds), str(value))

    async def claim_guardian_rank(
        self,
        github_user_id: str,
        claimed_set_key: str = "learnverse:guardian:claimed",
    ) -> tuple[int, bool]:
        """
        Atomically deduplicates `github_user_id` inside Redis SET `learnverse:guardian:claimed`
        and returns `(rank, already_claimed)`.
        """
        rank_hash_key = f"{claimed_set_key}:ranks"
        seq_key = f"{claimed_set_key}:seq"
        member = str(github_user_id)
        if self._memory is not None:
            return await self._memory.claim_guardian_rank(
                claimed_set_key, rank_hash_key, seq_key, member
            )
        res = await self._client.eval(
            CLAIM_GUARDIAN_LUA, 3, claimed_set_key, rank_hash_key, seq_key, member
        )
        return int(res[0]), bool(res[1] == 1)

    async def get_guardian_claimed_count(
        self, claimed_set_key: str = "learnverse:guardian:claimed"
    ) -> int:
        if self._memory is not None:
            return await self._memory.scard(claimed_set_key)
        return int(await self._client.scard(claimed_set_key))

    async def mark_genesis_guardian(
        self,
        *,
        user_id: int | None = None,
        session_id: str | None = None,
        github_user_id: str | None = None,
        rank: int = 1,
    ) -> None:
        """
        Marks `is_genesis_guardian` in Redis for the authenticated user, guardian session,
        and/or GitHub user ID so daily free AI Q&A quota automatically receives +10 bonus.
        """
        value = str(rank)
        if user_id is not None:
            await self.set(f"user:{user_id}:is_genesis_guardian", value)
        if session_id:
            await self.set(f"session:{session_id}:is_genesis_guardian", value)
        if github_user_id:
            await self.set(f"github:{github_user_id}:is_genesis_guardian", value)

    async def is_genesis_guardian(
        self,
        *,
        user_id: int | None = None,
        session_id: str | None = None,
    ) -> bool:
        if user_id is not None:
            if await self.get(f"user:{user_id}:is_genesis_guardian"):
                return True
        if session_id:
            if await self.get(f"session:{session_id}:is_genesis_guardian"):
                return True
        return False

    async def getdel(self, key: str) -> str | None:
        """
        Atomically fetches and deletes a key so a captcha or OTP token can never be replayed.
        """
        full_key = self._k(key)
        if self._memory is not None:
            return await self._memory.getdel(full_key)
        return await self._client.eval(GETDEL_LUA, 1, full_key)

    async def delete(self, key: str) -> int:
        full_key = self._k(key)
        if self._memory is not None:
            return await self._memory.delete(full_key)
        return int(await self._client.delete(full_key))

    async def incr_with_ttl(self, key: str, ttl_seconds: int) -> int:
        full_key = self._k(key)
        if self._memory is not None:
            return await self._memory.incr_with_ttl(full_key, ttl_seconds)
        pipe = self._client.pipeline()
        pipe.incr(full_key)
        pipe.expire(full_key, int(ttl_seconds), nx=True)
        res = await pipe.execute()
        return int(res[0])

    async def sliding_window_allow(
        self, key: str, window_seconds: int, limit: int
    ) -> tuple[bool, int, int]:
        """
        Atomic ZSET sliding-window rate limiter.
        Returns `(allowed: bool, current_count: int, retry_after_seconds: int)`.
        """
        full_key = self._k(key)
        if self._memory is not None:
            return await self._memory.sliding_window_allow(
                full_key, window_seconds, limit
            )
        now_ms = int(time.time() * 1000)
        window_ms = max(1, int(window_seconds)) * 1000
        member = f"{now_ms}:{uuid.uuid4().hex[:12]}"
        res = await self._client.eval(
            SLIDING_WINDOW_LUA,
            1,
            full_key,
            now_ms,
            window_ms,
            int(limit),
            member,
        )
        return bool(res[0] == 1), int(res[1]), int(res[2])

    async def flushall(self) -> None:
        if self._memory is not None:
            await self._memory.flushall()
        elif self._client is not None:
            await self._client.flushdb()

    async def close(self) -> None:
        if self._memory is not None:
            await self._memory.close()
        elif self._client is not None:
            await self._client.aclose()
