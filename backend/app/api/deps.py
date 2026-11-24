from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request

from ..core.network import get_real_client_ip, verify_same_origin
from ..core.security import JWTError, decode_and_verify_jwt


def get_app_state(request: Request) -> Any:
    return request.app.state.container


def get_client_ip(request: Request) -> str:
    container = get_app_state(request)
    return get_real_client_ip(request, container.settings.trusted_proxies)


def _fetch_user_row_by_id(db: Any, user_id: int, jti: str) -> dict[str, Any] | None:
    with db.read_connection() as conn:
        row = conn.execute(
            """
            SELECT id, username, email, role, email_verified,
                   nickname, avatar, welcome_state, student_path, student_choice, created_at
            FROM users WHERE id = ? AND NOT EXISTS (SELECT 1 FROM jwt_revocations WHERE jti=?)
            """,
            (user_id, jti),
        ).fetchone()
    return dict(row) if row is not None else None


async def get_optional_user(request: Request) -> dict[str, Any] | None:
    """
    Extracts and verifies the authenticated user from either:
    1. `Authorization: Bearer <jwt>` header, or
    2. `<JWT_COOKIE_NAME>` HttpOnly cookie (with Same-Origin CSRF validation on mutating verbs).
    """
    container = get_app_state(request)
    settings = container.settings

    token: str | None = None
    from_cookie = False
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    elif settings.jwt_cookie_name in request.cookies:
        token = request.cookies.get(settings.jwt_cookie_name)
        from_cookie = True

    if not token:
        return None

    if from_cookie and request.method not in ("GET", "HEAD", "OPTIONS"):
        if not verify_same_origin(request, settings.allowed_origins):
            raise HTTPException(
                status_code=403, detail="跨站请求校验未通过（CSRF 防护已拦截）。"
            )

    try:
        payload = decode_and_verify_jwt(token, settings.jwt_secret_key)
    except JWTError:
        return None

    jti = payload.get("jti", "")
    if jti and await container.redis.get(f"jwt_revoked:{jti}"):
        return None

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        return None

    user_dict = await container.db.run_sync(_fetch_user_row_by_id, container.db, user_id, jti)
    if user_dict is None:
        return None

    user_dict["_jwt_payload"] = payload
    return user_dict


async def get_current_user(request: Request) -> dict[str, Any]:
    user = await get_optional_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录账号后再执行此操作。")
    return user


async def get_admin_user(request: Request) -> dict[str, Any]:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限。")
    return user
