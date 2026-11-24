from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..catalog import catalog
from ..core.network import verify_same_origin
from ..schemas.discussions import AdminDiscussionPurgeRequest
from ..services.discussion_service import MAX_SAFE_INTEGER, DiscussionRequestError
from .deps import get_admin_user, get_app_state, get_client_ip, get_current_user

router = APIRouter(tags=["discussions"])

DISCUSSION_HEADERS = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
}


def _discussion_json(
    content: dict[str, Any],
    status_code: int = 200,
    extra_headers: dict[str, str] | None = None,
) -> JSONResponse:
    headers = dict(DISCUSSION_HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    return JSONResponse(
        content=content,
        status_code=status_code,
        headers=headers,
        media_type="application/json; charset=utf-8",
    )


def _parse_safe_positive_int(raw: str | None, default: int) -> int | None:
    if raw is None:
        return default
    if not raw.strip().lstrip("-").isdigit():
        return None
    try:
        val = int(raw.strip())
    except ValueError:
        return None
    if val < 1 or val > MAX_SAFE_INTEGER:
        return None
    return val


@router.api_route(
    "/api/discussions/{course_id}/{lesson_id}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
)
async def handle_chapter_discussion(
    course_id: str,
    lesson_id: str,
    request: Request,
    client_ip: str = Depends(get_client_ip),
) -> JSONResponse:
    """
    100% compatible replacement for `scripts/discussions.mjs`:
    - Validates `room = f"{course_id}/{lesson_id}"` against the 128-chapter catalog.
    - Fixes reverse-proxy shared IP rate-limit bug using trusted X-Real-IP / X-Forwarded-For + user_id.
    - Enforces NFKC keyword & XSS filtering and nonce idempotency.
    """
    container = get_app_state(request)
    service = container.discussion_service
    room = f"{course_id}/{lesson_id}"

    user = await get_current_user(request) if request.method == "POST" else None

    try:
        if not catalog.is_valid_room(room):
            raise DiscussionRequestError(404, "找不到这个章节。")

        if request.method == "GET":
            raw_before = request.query_params.get("before")
            before = _parse_safe_positive_int(raw_before, MAX_SAFE_INTEGER)
            if before is None:
                raise DiscussionRequestError(400, "分页位置无效。")

            if "thread" in request.query_params:
                thread_id = _parse_safe_positive_int(
                    request.query_params.get("thread"), -1
                )
                if thread_id is None or not await container.db.run_sync(
                    service.thread_exists, room, thread_id
                ):
                    raise DiscussionRequestError(404, "本章找不到这条讨论。")
                return _discussion_json(
                    await container.db.run_sync(
                        service.list_replies, room, thread_id, before, 12
                    )
                )

            return _discussion_json(
                await container.db.run_sync(service.list_posts, room, before)
            )

        if request.method != "POST":
            return _discussion_json(
                {"error": "不支持此操作。"},
                status_code=405,
                extra_headers={"Allow": "GET, POST"},
            )

        if not verify_same_origin(request, container.settings.allowed_origins):
            raise DiscussionRequestError(403, "请从本学习站提交讨论。")

        content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise DiscussionRequestError(415, "请使用 JSON 提交讨论。")

        raw_body = await request.body()
        post = service.validate_and_parse_post(raw_body)

        # Check nonce idempotency first: if this exact nonce was already committed
        # (e.g. client retrying after a lost network ACK), return 200 without charging rate limit!
        nonce_state = await container.db.run_sync(service.check_nonce_state, room, post)
        if nonce_state == "duplicate_exact":
            return _discussion_json({"saved": True})

        assert user is not None
        user_id = int(user["id"])
        if post["name"] == "访客" and user.get("nickname"):
            post["name"] = user["nickname"][:24]

        # Dual-dimension rate limit: per real client IP and (if logged in) per user_id
        limit = container.settings.discussion_rate_limit_per_minute
        ok_ip, _, _ = await container.redis.sliding_window_allow(
            f"rl:disc:ip:{client_ip}", window_seconds=60, limit=limit
        )
        if not ok_ip:
            raise DiscussionRequestError(429, "发言较频繁，请稍等一分钟再试。")

        ok_usr, _, _ = await container.redis.sliding_window_allow(
            f"rl:disc:user:{user_id}", window_seconds=60, limit=limit
        )
        if not ok_usr:
            raise DiscussionRequestError(429, "发言较频繁，请稍等一分钟再试。")

        await container.db.run_sync(
            service.save_post,
            room=room,
            post=post,
            user_id=user_id,
            client_ip=client_ip,
        )
        return _discussion_json({"saved": True})

    except DiscussionRequestError as exc:
        return _discussion_json({"error": exc.message}, status_code=exc.status)
    except Exception:
        return _discussion_json(
            {"error": "讨论服务暂时无法读写，请稍后重试。"}, status_code=503
        )


# --- Admin Moderation Endpoints ---


@router.get("/api/admin/discussions")
async def admin_list_discussions(
    request: Request,
    room: str | None = None,
    keyword: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    _admin: dict[str, Any] = Depends(get_admin_user),
) -> dict[str, Any]:
    container = get_app_state(request)
    items = await container.db.run_sync(
        container.discussion_service.admin_list_posts,
        room=room,
        keyword=keyword,
        include_deleted=include_deleted,
        limit=limit,
    )
    return {"items": items, "count": len(items)}


@router.delete("/api/admin/discussions/{post_id}")
async def admin_delete_discussion(
    post_id: int,
    request: Request,
    hard_delete: bool = False,
    _admin: dict[str, Any] = Depends(get_admin_user),
) -> dict[str, Any]:
    container = get_app_state(request)
    affected = await container.db.run_sync(
        container.discussion_service.admin_delete_post,
        post_id,
        hard_delete=hard_delete,
    )
    return {"deleted": affected > 0, "affected_count": affected}


@router.post("/api/admin/discussions/purge")
async def admin_purge_discussions(
    payload: AdminDiscussionPurgeRequest,
    request: Request,
    _admin: dict[str, Any] = Depends(get_admin_user),
) -> JSONResponse:
    container = get_app_state(request)
    try:
        affected = await container.db.run_sync(
            container.discussion_service.admin_purge_posts,
            room=payload.room,
            client_ip=payload.client_ip,
            keyword=payload.keyword,
            hard_delete=payload.hard_delete,
        )
        return _discussion_json({"purged": True, "affected_count": affected})
    except DiscussionRequestError as exc:
        return _discussion_json({"error": exc.message}, status_code=exc.status)
