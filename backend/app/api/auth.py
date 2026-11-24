from __future__ import annotations

import sqlite3
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from ..core.email import EmailDeliveryError
from ..core.security import create_jwt_token
from ..schemas.auth import (
    AuthTokenResponse,
    CaptchaResponse,
    EmailVerifyRequest,
    LoginRequest,
    RegisterRequest,
    StudentProfilePayload,
    UserProfileResponse,
)
from .deps import get_app_state, get_client_ip, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _row_to_user_profile(row: Any) -> UserProfileResponse:
    return UserProfileResponse(
        id=int(row["id"]),
        username=row["username"],
        email=row["email"],
        role=row["role"],
        email_verified=bool(row["email_verified"]),
        profile=StudentProfilePayload(
            nickname=row["nickname"] or "",
            avatar=row["avatar"] or "",
            welcome=row["welcome_state"] or "new",
            path=row["student_path"],
            choice=row["student_choice"] or "",
        ),
        created_at=row["created_at"],
    )


def _set_auth_cookie(
    response: Response, token: str, expires_in: int, settings: Any
) -> None:
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        max_age=expires_in,
        httponly=True,
        secure=bool(settings.jwt_cookie_secure),
        samesite=settings.jwt_cookie_samesite,
        path="/api",
    )


@router.get("/captcha", response_model=CaptchaResponse)
async def get_captcha(
    request: Request,
    response: Response,
    client_ip: str = Depends(get_client_ip),
) -> CaptchaResponse:
    container = get_app_state(request)
    allowed, _, retry_after = await container.redis.sliding_window_allow(
        f"rl:captcha:{client_ip}", window_seconds=60, limit=30
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="获取验证码过于频繁，请稍后再试。",
            headers={"Retry-After": str(retry_after)},
        )

    challenge, _ = await container.captcha.generate()
    response.headers["Cache-Control"] = "no-store"
    return CaptchaResponse(
        captcha_id=challenge.captcha_id,
        image_svg=challenge.svg,
        image_data_url=challenge.data_url,
        expires_in=challenge.expires_in,
    )


@router.post("/register", response_model=AuthTokenResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    client_ip: str = Depends(get_client_ip),
) -> AuthTokenResponse:
    container = get_app_state(request)
    allowed, _, retry_after = await container.redis.sliding_window_allow(
        f"rl:register:{client_ip}", window_seconds=60, limit=10
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="注册请求过于频繁，请稍后再试。",
            headers={"Retry-After": str(retry_after)},
        )

    # Atomic single-use graphic captcha verification (GETDEL)
    if not await container.captcha.verify_once(
        payload.captcha_id, payload.captcha_code
    ):
        raise HTTPException(
            status_code=400, detail="图形验证码错误或已过期，请刷新后重试。"
        )

    password_hash = await container.password_hasher.hash_password(payload.password)
    now_iso = _now_iso()
    nickname = payload.nickname or payload.username

    def _create_user_sync() -> tuple[int, dict[str, Any]]:
        with container.db.write_transaction() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (
                    username, email, password_hash, role, email_verified,
                    nickname, avatar, welcome_state, student_path, student_choice,
                    created_at, updated_at
                ) VALUES (?, ?, ?, 'student', 0, ?, '', 'new', NULL, '', ?, ?)
                """,
                (
                    payload.username,
                    payload.email,
                    password_hash,
                    nickname,
                    now_iso,
                    now_iso,
                ),
            )
            uid = int(cursor.lastrowid or 0)
            conn.execute(
                """
                INSERT OR IGNORE INTO user_vault_earned (user_id, pack_key, earned_at)
                VALUES (?, 'welcome', ?)
                """,
                (uid, now_iso),
            )
            row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
            return uid, dict(row)

    try:
        user_id, user_row = await container.db.run_sync(_create_user_sync)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail="该账号名或邮箱已被注册。"
        ) from exc

    token, _, expires_in = create_jwt_token(
        user_id=user_id,
        username=user_row["username"],
        role=user_row["role"],
        secret_key=container.settings.jwt_secret_key,
        expires_minutes=container.settings.jwt_access_token_expire_minutes,
    )
    _set_auth_cookie(response, token, expires_in, container.settings)
    return AuthTokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=_row_to_user_profile(user_row),
    )


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    client_ip: str = Depends(get_client_ip),
) -> AuthTokenResponse:
    container = get_app_state(request)
    allowed, _, retry_after = await container.redis.sliding_window_allow(
        f"rl:login:{client_ip}", window_seconds=60, limit=15
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="登录尝试过于频繁，请稍等一分钟再试。",
            headers={"Retry-After": str(retry_after)},
        )

    if not await container.captcha.verify_once(
        payload.captcha_id, payload.captcha_code
    ):
        raise HTTPException(
            status_code=400, detail="图形验证码错误或已过期，请刷新后重试。"
        )

    account = payload.account.strip()

    def _lookup_account_sync() -> dict[str, Any] | None:
        with container.db.read_connection() as conn:
            if "@" in account:
                row = conn.execute(
                    "SELECT * FROM users WHERE email = ?",
                    (account.lower(),),
                ).fetchone()
                if row is not None:
                    return dict(row)
            row = conn.execute(
                "SELECT * FROM users WHERE username = ?",
                (account,),
            ).fetchone()
            return dict(row) if row is not None else None

    user_row = await container.db.run_sync(_lookup_account_sync)

    stored_hash = user_row["password_hash"] if user_row is not None else None
    verified = await container.password_hasher.verify_password(
        payload.password, stored_hash
    )
    if not verified or user_row is None:
        raise HTTPException(status_code=401, detail="账号或密码错误。")

    token, _, expires_in = create_jwt_token(
        user_id=int(user_row["id"]),
        username=user_row["username"],
        role=user_row["role"],
        secret_key=container.settings.jwt_secret_key,
        expires_minutes=container.settings.jwt_access_token_expire_minutes,
    )
    _set_auth_cookie(response, token, expires_in, container.settings)
    return AuthTokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=_row_to_user_profile(user_row),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, bool]:
    container = get_app_state(request)
    if user and "_jwt_payload" in user:
        jwt_payload = user["_jwt_payload"]
        jti = jwt_payload.get("jti")
        exp = int(jwt_payload.get("exp", 0))
        remaining = max(1, exp - int(time.time()))
        if jti:
            await container.db.run_sync(container.db.revoke_jwt, jti, exp)
            await container.redis.setex(f"jwt_revoked:{jti}", remaining, "1")

    response.delete_cookie(key=container.settings.jwt_cookie_name, path="/api")
    return {"logged_out": True}


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user: dict[str, Any] = Depends(get_current_user),
) -> UserProfileResponse:
    return _row_to_user_profile(user)


@router.post("/email/send-code")
async def send_email_verification_code(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    client_ip: str = Depends(get_client_ip),
) -> dict[str, Any]:
    container = get_app_state(request)
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="当前账号尚未绑定电子邮箱。")
    if user.get("email_verified"):
        return {"sent": False, "already_verified": True}

    allowed, _, retry_after = await container.redis.sliding_window_allow(
        f"rl:email_send:{client_ip}", window_seconds=300, limit=5
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="邮件发送请求过于频繁，请稍后再试。",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        otp, ttl = await container.email_service.issue_otp(int(user["id"]), email)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    try:
        dispatched = await container.email_service.send_verification_email(email, otp)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail=f"邮件发送失败：{exc}") from exc

    return {
        "sent": dispatched,
        "email_verification_enabled": container.settings.email_verification_enabled,
        "expires_in": ttl,
    }


@router.post("/email/verify")
async def verify_email_code(
    payload: EmailVerifyRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, bool]:
    container = get_app_state(request)
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="当前账号尚未绑定电子邮箱。")

    ok = await container.email_service.verify_otp(
        int(user["id"]), email, payload.code
    )
    if not ok:
        raise HTTPException(
            status_code=400, detail="邮箱验证码错误、已过期或尝试次数过多。"
        )

    def _mark_email_verified_sync() -> None:
        with container.db.write_transaction() as conn:
            conn.execute(
                "UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?",
                (_now_iso(), int(user["id"])),
            )

    await container.db.run_sync(_mark_email_verified_sync)
    return {"email_verified": True}
