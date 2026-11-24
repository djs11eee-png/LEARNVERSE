from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from ..schemas.sync import UnionSyncRequest, UnionSyncResponse
from .deps import get_app_state, get_client_ip, get_current_user

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/union", response_model=UnionSyncResponse)
async def union_sync_endpoint(
    payload: UnionSyncRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    client_ip: str = Depends(get_client_ip),
) -> UnionSyncResponse:
    container = get_app_state(request)
    allowed, _, retry_after = await container.redis.sliding_window_allow(
        f"rl:sync:{user['id']}:{client_ip}", window_seconds=60, limit=30
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="同步请求过于频繁，请稍后再试。",
            headers={"Retry-After": str(retry_after)},
        )

    return await container.db.run_sync(
        container.sync_service.union_sync, int(user["id"]), payload
    )


@router.get("/state", response_model=UnionSyncResponse)
async def get_sync_state_endpoint(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> UnionSyncResponse:
    container = get_app_state(request)
    return await container.db.run_sync(
        container.sync_service.get_state, int(user["id"])
    )
