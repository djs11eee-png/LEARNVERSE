from __future__ import annotations

import time
from typing import Any

import anyio
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.types import Receive, Scope, Send

from ..db import DatabaseManager
from ..schemas.ai import AIChatRequest
from ..services import ai_quota
from .deps import get_app_state, get_client_ip, get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatResponse(StreamingResponse):
    """Own the lease until ASGI has sent the last event, including disconnects."""
    def __init__(self, stream, *, db: DatabaseManager, lease: ai_quota.Admission, headers: dict[str, str]):
        super().__init__(stream, media_type="text/event-stream; charset=utf-8", headers=headers)
        self.db = db
        self.lease = lease

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            with anyio.fail_after(max(0, self.lease.deadline - time.monotonic())):
                await super().__call__(scope, receive, send)
        finally:
            with anyio.CancelScope(shield=True):
                try:
                    await self.body_iterator.aclose()
                finally:
                    await self.db.run_sync(ai_quota.finish, self.db, self.lease)


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

    is_guardian = await container.redis.is_genesis_guardian(user_id=user_id)
    daily_limit = min(20, settings.ai_rate_limit_user_per_day) + (
        settings.ai_guardian_daily_bonus if is_guardian else 0
    )
    prepared = container.ai_service.prepare(payload)
    lease = await container.db.run_sync(
        ai_quota.admit, container.db, user_id, daily_limit, prepared.reserved, settings.ai_daily_token_budget
    )
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
        },
    )
