from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from ..schemas.sync import AIQuotaSyncPayload, UnionSyncRequest, UnionSyncResponse
from ..services import ai_quota
from .ai import _resolve_guardian_and_limit
from .deps import get_app_state, get_client_ip, get_current_user

router = APIRouter(prefix="/api/sync", tags=["sync"])


async def _attach_live_quota(
    container: Any, user_id: int, resp: UnionSyncResponse
) -> UnionSyncResponse:
    is_guardian, daily_limit, bonus = await _resolve_guardian_and_limit(container, user_id)
    used_today, _reset = await container.db.run_sync(
        ai_quota.get_daily_usage, container.db, user_id
    )
    resp.ai_quota = AIQuotaSyncPayload(
        usedToday=used_today,
        dailyLimit=daily_limit,
        remainingToday=max(0, daily_limit - used_today),
        isGenesisGuardian=is_guardian,
        dailyBonus=bonus,
    )
    return resp


@router.post("/union", response_model=UnionSyncResponse)
async def union_sync_endpoint(
    payload: UnionSyncRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    client_ip: str = Depends(get_client_ip),
) -> UnionSyncResponse:
    container = get_app_state(request)
    uid = int(user["id"])
    allowed, _, retry_after = await container.redis.sliding_window_allow(
        f"rl:sync:{uid}:{client_ip}", window_seconds=60, limit=30
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="同步请求过于频繁，请稍后再试。",
            headers={"Retry-After": str(retry_after)},
        )

    resp = await container.db.run_sync(
        container.sync_service.union_sync, uid, payload
    )
    return await _attach_live_quota(container, uid, resp)


@router.get("/state", response_model=UnionSyncResponse)
async def get_sync_state_endpoint(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> UnionSyncResponse:
    container = get_app_state(request)
    uid = int(user["id"])
    resp = await container.db.run_sync(
        container.sync_service.get_state, uid
    )
    return await _attach_live_quota(container, uid, resp)
