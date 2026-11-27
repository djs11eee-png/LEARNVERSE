from __future__ import annotations

import time
from typing import Any, Callable

import anyio
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.types import Receive, Scope, Send

from ..core.network import verify_same_origin
from ..db import DatabaseManager
from ..schemas.ai import AIChatRequest, GuestAIChatRequest
from ..services import ai_quota
from .deps import get_app_state, get_client_ip, get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])


async def _resolve_guardian_and_limit(container: Any, user_id: int) -> tuple[bool, int, int]:
    is_guardian = await container.redis.is_genesis_guardian(user_id=user_id)
    if not is_guardian:
        durable = await container.db.run_sync(container.db.get_user_guardian, user_id)
        if durable is not None:
            is_guardian = True
            await container.redis.mark_genesis_guardian(
                user_id=user_id, rank=int(durable["rank"])
            )
    base_limit = min(20, container.settings.ai_rate_limit_user_per_day)
    bonus = container.settings.ai_guardian_daily_bonus if is_guardian else 0
    return is_guardian, base_limit + bonus, bonus


@router.get("/quota")
async def get_ai_quota_status(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    container = get_app_state(request)
    user_id = int(user["id"])
    is_guardian, daily_limit, bonus = await _resolve_guardian_and_limit(container, user_id)
    used_today, reset_sec = await container.db.run_sync(
        ai_quota.get_daily_usage, container.db, user_id
    )
    return {
        "used_today": used_today,
        "daily_limit": daily_limit,
        "remaining_today": max(0, daily_limit - used_today),
        "is_genesis_guardian": is_guardian,
        "daily_bonus": bonus,
        "reset_in_seconds": reset_sec,
    }


class ChatResponse(StreamingResponse):
    """Own the lease until ASGI has sent the last event, including disconnects."""
    def __init__(
        self,
        stream,
        *,
        db: DatabaseManager,
        lease: Any,
        headers: dict[str, str],
        on_finish: Callable[[DatabaseManager, Any], None] = ai_quota.finish,
    ):
        super().__init__(stream, media_type="text/event-stream; charset=utf-8", headers=headers)
        self.db = db
        self.lease = lease
        self.on_finish = on_finish

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            with anyio.fail_after(max(0, self.lease.deadline - time.monotonic())):
                await super().__call__(scope, receive, send)
        finally:
            with anyio.CancelScope(shield=True):
                try:
                    await self.body_iterator.aclose()
                finally:
                    await self.db.run_sync(self.on_finish, self.db, self.lease)


@router.post("/chat")
async def ai_chat_sse(
    payload: AIChatRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    client_ip: str = Depends(get_client_ip),
) -> StreamingResponse:
    """
    OpenAI-Compatible AI Q&A Streaming Endpoint (SSE).
    Enforces:
    1. Authenticated user session (`user_id`).
    2. Dual-dimension Redis sliding-window rate limits (`user_id` per minute/hour + trusted `client_ip` per minute).
    3. Pre-flight zero-cost syntax & beginner error interception before calling upstream LLM.
    """
    container = get_app_state(request)
    settings = container.settings
    user_id = int(user["id"])

    if request.query_params:
        raise HTTPException(422, "请仅通过 JSON 正文提交提问。")
    if len(payload.question) > min(settings.ai_max_question_chars, 2000):
        raise HTTPException(422, f"提问请控制在 {min(settings.ai_max_question_chars, 2000)} 字以内。")

    # Dimension 1a: Per-User 1-minute sliding window
    ok_user_min, _, retry_user_min = await container.redis.sliding_window_allow(
        f"rl:ai:user:min:{user_id}",
        window_seconds=60,
        limit=settings.ai_rate_limit_user_per_minute,
    )
    if not ok_user_min:
        raise HTTPException(
            status_code=429,
            detail="AI 提问过于频繁（每分钟配额已满），请先根据上方诊断提示排查后再试。",
            headers={"Retry-After": str(retry_user_min)},
        )

    # Dimension 1b: Per-User 1-hour sliding window
    ok_user_hr, _, retry_user_hr = await container.redis.sliding_window_allow(
        f"rl:ai:user:hr:{user_id}",
        window_seconds=3600,
        limit=settings.ai_rate_limit_user_per_hour,
    )
    if not ok_user_hr:
        raise HTTPException(
            status_code=429,
            detail="本小时 AI 助教提问次数已达上限，请稍后再试。",
            headers={"Retry-After": str(retry_user_hr)},
        )

    # Dimension 2: Per-Trusted-Real-IP 1-minute sliding window
    ok_ip_min, _, retry_ip_min = await container.redis.sliding_window_allow(
        f"rl:ai:ip:min:{client_ip}",
        window_seconds=60,
        limit=settings.ai_rate_limit_ip_per_minute,
    )
    if not ok_ip_min:
        raise HTTPException(
            status_code=429,
            detail="当前网络节点 AI 请求过于频繁，请稍等片刻再试。",
            headers={"Retry-After": str(retry_ip_min)},
        )

    is_guardian, daily_limit, _bonus = await _resolve_guardian_and_limit(container, user_id)
    prepared = container.ai_service.prepare(payload)
    lease = await container.db.run_sync(
        ai_quota.admit, container.db, user_id, daily_limit, prepared.reserved, settings.ai_daily_token_budget
    )
    remaining_today = max(0, daily_limit - lease.used_today)
    stream = container.ai_service.stream_chat(
        user_id=user_id,
        client_ip=client_ip,
        req=payload,
        prepared=prepared,
        lease=lease,
    )
    return ChatResponse(
        stream,
        db=container.db,
        lease=lease,
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
            "X-Genesis-Guardian": "1" if is_guardian else "0",
            "X-AI-Daily-Limit": str(daily_limit),
            "X-AI-Daily-Used": str(lease.used_today),
            "X-AI-Daily-Remaining": str(remaining_today),
        },
    )


@router.post("/guest/chat")
async def ai_guest_chat_sse(
    payload: GuestAIChatRequest,
    request: Request,
    client_ip: str = Depends(get_client_ip),
) -> StreamingResponse:
    """
    CORS-enabled unauthenticated guest relay SSE endpoint for competition/demo embeds.
    Protected by origin allowlist check (when Origin header is sent), 4s per-IP cooldown,
    per-IP sliding-window & daily caps, global guest daily cap, and shared SQLite token budget.
    """
    container = get_app_state(request)
    settings = container.settings

    if not settings.ai_guest_enabled:
        raise HTTPException(403, "游客体验接口已关闭，请登录主站账号后使用 Vesper。")
    if request.query_params:
        raise HTTPException(422, "请仅通过 JSON 正文提交提问。")
    if request.headers.get("origin") and not verify_same_origin(request, settings.allowed_origins):
        raise HTTPException(403, "未授权的站点来源请求。")

    ok_cd, _, retry_cd = await container.redis.sliding_window_allow(
        f"rl:ai:guest:cd:{client_ip}", window_seconds=ai_quota.COOLDOWN_SECONDS, limit=1
    )
    if not ok_cd:
        raise HTTPException(
            status_code=429,
            detail="请等待 4 秒后再提问。",
            headers={"Retry-After": str(retry_cd)},
        )

    ok_min, _, retry_min = await container.redis.sliding_window_allow(
        f"rl:ai:guest:min:{client_ip}",
        window_seconds=60,
        limit=max(1, settings.ai_guest_rate_limit_ip_per_minute),
    )
    if not ok_min:
        raise HTTPException(
            status_code=429,
            detail="游客体验提问过于频繁，请稍等片刻再试。",
            headers={"Retry-After": str(retry_min)},
        )

    prepared = container.ai_service.prepare(
        payload,
        max_tokens=settings.ai_guest_max_tokens,
        guest_mode=True,
    )
    lease = await container.db.run_sync(
        ai_quota.admit_guest,
        container.db,
        client_ip,
        max(1, settings.ai_guest_rate_limit_ip_per_day),
        max(1, settings.ai_guest_daily_global_limit),
        prepared.reserved,
        settings.ai_daily_token_budget,
    )
    remaining_today = max(0, lease.daily_limit - lease.used_today)
    stream = container.ai_service.stream_chat(
        user_id=None,
        client_ip=client_ip,
        req=payload,
        prepared=prepared,
        lease=lease,
    )
    return ChatResponse(
        stream,
        db=container.db,
        lease=lease,
        on_finish=ai_quota.finish_guest,
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
            "X-AI-Daily-Limit": str(lease.daily_limit),
            "X-AI-Daily-Used": str(lease.used_today),
            "X-AI-Daily-Remaining": str(remaining_today),
        },
    )
