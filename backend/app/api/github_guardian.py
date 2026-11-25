from __future__ import annotations

import asyncio
import json
import secrets
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from .deps import get_app_state, get_current_user, get_optional_user

router = APIRouter(prefix="/api/github", tags=["github-guardian"])

GUARDIAN_CLAIMED_SET_KEY = "learnverse:guardian:claimed"
GUARDIAN_SESSION_COOKIE = "lv_guardian_session"
STARS_CACHE_KEY = "github:seoul_node:stars_cache"
STARS_STALE_KEY = "github:seoul_node:stars_stale"
STARS_CACHE_TTL_SECONDS = 60
STARS_FAILURE_BACKOFF_TTL_SECONDS = 15
STARS_STALE_TTL_SECONDS = 86400
OAUTH_STATE_TTL_SECONDS = 300

_github_http_client: httpx.AsyncClient | None = None
_github_http_loop: asyncio.AbstractEventLoop | None = None


def _get_github_http_client() -> httpx.AsyncClient:
    global _github_http_client, _github_http_loop
    loop = asyncio.get_running_loop()
    if (
        _github_http_client is None
        or _github_http_client.is_closed
        or _github_http_loop is not loop
    ):
        _github_http_client = httpx.AsyncClient(
            limits=httpx.Limits(
                max_keepalive_connections=8,
                max_connections=24,
                keepalive_expiry=30.0,
            ),
        )
        _github_http_loop = loop
    return _github_http_client


async def close_github_http_client() -> None:
    global _github_http_client, _github_http_loop
    if _github_http_client is not None and not _github_http_client.is_closed:
        try:
            await _github_http_client.aclose()
        except RuntimeError:
            pass
    _github_http_client = None
    _github_http_loop = None


def _get_stars_refresh_lock(container: Any) -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    lock = getattr(container, "_stars_refresh_lock", None)
    lock_loop = getattr(container, "_stars_refresh_lock_loop", None)
    if lock is None or lock_loop is not loop:
        lock = asyncio.Lock()
        setattr(container, "_stars_refresh_lock", lock)
        setattr(container, "_stars_refresh_lock_loop", loop)
    return lock


def _safe_js_json(payload: dict[str, Any]) -> str:
    """Serialize JSON safely for inline <script> blocks without XSS vectors."""
    return (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def _render_popup_callback_html(
    *,
    ok: bool,
    payload: dict[str, Any],
    headline: str,
    detail: str,
) -> HTMLResponse:
    js_payload = _safe_js_json(payload)
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>LEARNVERSE · Seoul Genesis Node</title>
  <style>
    body {{
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: radial-gradient(circle at 50% 25%, #122430, #07090f 70%);
      color: #eef6f8; font: 15px/1.6 system-ui, -apple-system, sans-serif;
    }}
    main {{
      max-width: 380px; margin: 20px; padding: 24px 26px; border-radius: 18px;
      border: 1px solid rgba(0, 245, 212, .38); background: rgba(9, 15, 24, .92);
      box-shadow: 0 20px 60px rgba(0, 0, 0, .65); text-align: center;
    }}
    h1 {{ margin: 0 0 8px; font-size: 18px; color: {"#00f5d4" if ok else "#ffbcb2"}; }}
    p {{ margin: 0; color: #b7c8d0; font-size: 13px; }}
  </style>
</head>
<body>
  <main>
    <h1>{headline}</h1>
    <p>{detail}</p>
  </main>
  <script>
    (function () {{
      var data = {js_payload};
      var notified = false;
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(data, '*');
          notified = true;
        }}
      }} catch (e) {{}}
      if (notified) {{
        window.setTimeout(function () {{ window.close(); }}, 180);
      }} else {{
        try {{
          sessionStorage.setItem('learnverse.guardian.oauth_result', JSON.stringify(data));
        }} catch (e) {{}}
        window.setTimeout(function () {{
          window.location.replace(data && data.type === 'STAR_SUCCESS' ? '/?guardian_reveal=1' : '/');
        }}, 600);
      }}
    }})();
  </script>
</body>
</html>"""
    return HTMLResponse(
        content=html,
        headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"},
    )


async def _fetch_repo_stargazers(owner: str, repo: str) -> int | None:
    if not owner or not repo:
        return None
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "LEARNVERSE-Seoul-Guardian/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    try:
        client = _get_github_http_client()
        resp = await client.get(
            url,
            headers=headers,
            timeout=httpx.Timeout(connect=2.5, read=3.5, write=3.5, pool=2.5),
        )
        if resp.status_code == 200:
            data = resp.json()
            count = data.get("stargazers_count")
            if isinstance(count, int) and count >= 0:
                return count
    except Exception:
        return None
    return None


async def _exchange_code_for_token(
    *, client_id: str, client_secret: str, code: str, redirect_uri: str
) -> str:
    """
    Exchanges OAuth code for a short-lived in-memory access token.
    NEVER logs or persists the returned token.
    """
    client = _get_github_http_client()
    resp = await client.post(
        "https://github.com/login/oauth/access_token",
        headers={
            "Accept": "application/json",
            "User-Agent": "LEARNVERSE-Seoul-Guardian/1.0",
        },
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        },
        timeout=httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=5.0),
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="GitHub OAuth 换取凭证失败。")
    data = resp.json()
    token = str(data.get("access_token") or "").strip()
    if not token:
        raise HTTPException(
            status_code=400, detail="GitHub 授权码无效或已过期，请重试。"
        )
    return token


async def _fetch_github_identity_and_star(
    *, access_token: str, owner: str, repo: str
) -> tuple[str, str]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "LEARNVERSE-Seoul-Guardian/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    client = _get_github_http_client()
    oauth_timeout = httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=5.0)
    user_resp = await client.get(
        "https://api.github.com/user", headers=headers, timeout=oauth_timeout
    )
    if user_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="无法获取 GitHub 账号身份。")
    user_data = user_resp.json()
    gh_id = str(user_data.get("id") or "").strip()
    gh_login = str(user_data.get("login") or "").strip()
    if not gh_id or not gh_login:
        raise HTTPException(status_code=502, detail="GitHub 用户信息不完整。")

    star_resp = await client.put(
        f"https://api.github.com/user/starred/{owner}/{repo}",
        headers={**headers, "Content-Length": "0"},
        timeout=oauth_timeout,
    )
    if star_resp.status_code not in (204, 304):
        raise HTTPException(
            status_code=502, detail="自动点亮 GitHub Star 失败，请确认授权权限。"
        )
    return gh_id, gh_login


def _parse_non_negative_int(raw: str | None) -> int | None:
    if raw is None:
        return None
    try:
        return max(0, int(raw))
    except ValueError:
        return None


@router.get("/status")
async def github_guardian_status(
    request: Request,
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> dict[str, Any]:
    """
    Returns live GitHub repository star count (Redis-cached 60s with singleflight + stale fallback),
    Genesis Node remaining seats, and current user/session `is_genesis_guardian` AI daily bonus status.
    """
    container = get_app_state(request)
    settings = container.settings
    limit = max(1, int(settings.github_guardian_limit))

    redis_claimed = await container.redis.get_guardian_claimed_count(GUARDIAN_CLAIMED_SET_KEY)
    db_claimed = await container.db.run_sync(container.db.get_durable_guardian_claimed_count)
    claimed = max(redis_claimed, db_claimed)
    cached_val = _parse_non_negative_int(await container.redis.get(STARS_CACHE_KEY))

    stars: int
    if cached_val is not None:
        stars = max(cached_val, claimed)
    else:
        async with _get_stars_refresh_lock(container):
            rechecked = _parse_non_negative_int(
                await container.redis.get(STARS_CACHE_KEY)
            )
            if rechecked is not None:
                stars = max(rechecked, claimed)
            else:
                fetched = await _fetch_repo_stargazers(
                    settings.github_target_owner, settings.github_target_repo
                )
                if fetched is not None:
                    stars = max(fetched, claimed)
                    await container.redis.setex(
                        STARS_CACHE_KEY, STARS_CACHE_TTL_SECONDS, str(stars)
                    )
                    await container.redis.setex(
                        STARS_STALE_KEY, STARS_STALE_TTL_SECONDS, str(stars)
                    )
                else:
                    stale_val = _parse_non_negative_int(
                        await container.redis.get(STARS_STALE_KEY)
                    )
                    stars = max(
                        stale_val if stale_val is not None else claimed, claimed
                    )
                    await container.redis.setex(
                        STARS_CACHE_KEY, STARS_FAILURE_BACKOFF_TTL_SECONDS, str(stars)
                    )

    remaining = max(0, limit - stars)
    next_rank = min(limit, max(claimed, stars) + 1)

    guardian_record: dict[str, Any] | None = None
    is_guardian = False
    if user:
        uid = int(user["id"])
        guardian_record = await container.db.run_sync(container.db.get_user_guardian, uid)
        is_guardian = await container.redis.is_genesis_guardian(user_id=uid)
        if guardian_record is not None and not is_guardian:
            is_guardian = True
            await container.redis.mark_genesis_guardian(
                user_id=uid, rank=int(guardian_record["rank"])
            )

    return {
        "stars": stars,
        "remaining": remaining,
        "limit": limit,
        "claimed": claimed,
        "next_rank": next_rank,
        "repo": f"{settings.github_target_owner}/{settings.github_target_repo}",
        "oauth_configured": bool(
            settings.github_client_id and settings.github_client_secret
        ),
        "debug_mock_enabled": bool(settings.debug),
        "is_genesis_guardian": is_guardian,
        "daily_ai_bonus": settings.ai_guardian_daily_bonus if is_guardian else 0,
        "guardian": guardian_record,
    }


@router.get("/login")
async def github_guardian_login(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> RedirectResponse:
    """
    Generates an anti-CSRF `state` stored in Redis (5 min TTL) and redirects to GitHub OAuth
    with strictly minimal `scope=public_repo`.
    """
    container = get_app_state(request)
    settings = container.settings
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=503,
            detail="尚未配置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET（本地调试可使用 DEBUG=true 下的 /api/github/mock-star）。",
        )

    state = secrets.token_urlsafe(24)
    session_id = secrets.token_hex(16)
    state_payload = json.dumps(
        {
            "user_id": int(user["id"]),
            "session_id": session_id,
        },
        separators=(",", ":"),
    )
    await container.redis.setex(
        f"github:oauth_state:{state}", OAUTH_STATE_TTL_SECONDS, state_payload
    )

    query = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "public_repo",
            "state": state,
        }
    )
    resp = RedirectResponse(
        url=f"https://github.com/login/oauth/authorize?{query}", status_code=302
    )
    resp.set_cookie(
        key=GUARDIAN_SESSION_COOKIE,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=settings.jwt_cookie_secure,
        max_age=60 * 60 * 24 * 365,
        path="/api",
    )
    return resp


@router.get("/callback", response_class=HTMLResponse)
async def github_guardian_callback(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    code: str = Query(default="", max_length=256),
    state: str = Query(default="", max_length=256),
    error: str = Query(default="", max_length=128),
) -> HTMLResponse:
    """
    Verifies atomic Redis OAuth `state`, exchanges `code` for an in-memory `access_token`,
    stars the target repository, immediately destroys the token in `finally`, assigns atomic
    Genesis Guardian `rank` via Redis SET `learnverse:guardian:claimed`, marks `is_genesis_guardian`
    for +10 daily free AI Q&A bonus, and posts `STAR_SUCCESS` back to `window.opener`.
    """
    if error:
        return _render_popup_callback_html(
            ok=False,
            payload={"type": "STAR_ERROR", "error": "已取消 GitHub 授权。"},
            headline="已取消授权",
            detail="窗口即将自动关闭，你随时可以重新点击助力。",
        )

    if not code or not state:
        return _render_popup_callback_html(
            ok=False,
            payload={"type": "STAR_ERROR", "error": "缺少回调参数，请重新发起授权。"},
            headline="回调参数缺失",
            detail="请关闭窗口后重试。",
        )

    container = get_app_state(request)
    settings = container.settings

    raw_state = await container.redis.getdel(f"github:oauth_state:{state}")
    if not raw_state:
        return _render_popup_callback_html(
            ok=False,
            payload={"type": "STAR_ERROR", "error": "授权会话已过期或已使用，请重试。"},
            headline="授权状态已失效",
            detail="请关闭窗口后重新发起 Star 助力。",
        )

    try:
        state_data = json.loads(raw_state)
    except json.JSONDecodeError:
        state_data = {}

    bound_user_id = state_data.get("user_id")
    session_id = state_data.get("session_id")
    if (bound_user_id != user["id"] or not session_id
            or session_id != request.cookies.get(GUARDIAN_SESSION_COOKIE)):
        raise HTTPException(status_code=403, detail="授权会话与当前账号不匹配。")

    # Strictly keep access_token in local memory only and wipe immediately in `finally`.
    access_token = ""
    try:
        access_token = await _exchange_code_for_token(
            client_id=settings.github_client_id,
            client_secret=settings.github_client_secret,
            code=code,
            redirect_uri=settings.github_redirect_uri,
        )
        gh_user_id, gh_login = await _fetch_github_identity_and_star(
            access_token=access_token,
            owner=settings.github_target_owner,
            repo=settings.github_target_repo,
        )
    except HTTPException as exc:
        return _render_popup_callback_html(
            ok=False,
            payload={"type": "STAR_ERROR", "error": str(exc.detail)},
            headline="星火接入未完成",
            detail=str(exc.detail),
        )
    finally:
        # Burn-after-reading: overwrite local reference immediately.
        access_token = ""
        del access_token

    redis_rank, _already_claimed = await container.redis.claim_guardian_rank(
        gh_user_id, claimed_set_key=GUARDIAN_CLAIMED_SET_KEY
    )
    durable = await container.db.run_sync(
        container.db.claim_guardian_durable,
        user_id=int(user["id"]),
        github_user_id=gh_user_id,
        github_login=gh_login,
        ai_daily_bonus=settings.ai_guardian_daily_bonus,
        preferred_rank=redis_rank,
        count_in_global_ledger=True,
    )
    rank = int(durable["rank"])
    await container.redis.mark_genesis_guardian(
        user_id=int(bound_user_id) if isinstance(bound_user_id, int) else None,
        session_id=session_id,
        github_user_id=gh_user_id,
        rank=rank,
    )
    # Invalidate star count cache so next /status reflects the newly lit Star immediately.
    await container.redis.delete(STARS_CACHE_KEY)

    limit = max(1, int(settings.github_guardian_limit))
    badge_no = f"NO.{rank:04d} / {limit:04d}" if rank <= limit else "SUPPORTER"

    resp = _render_popup_callback_html(
        ok=True,
        payload={
            "type": "STAR_SUCCESS",
            "rank": rank,
            "githubUser": gh_login,
            "claimedAt": durable["claimedAt"],
            "isGenesisGuardian": True,
            "aiDailyBonus": settings.ai_guardian_daily_bonus,
        },
        headline=f"⚡ 原初星火已注入 · {badge_no}",
        detail="首尔服务器守护者限定卡正在为你拆封，窗口即将自动关闭…",
    )
    resp.set_cookie(
        key=GUARDIAN_SESSION_COOKIE,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=settings.jwt_cookie_secure,
        max_age=60 * 60 * 24 * 365,
        path="/api",
    )
    return resp


@router.get("/mock-star")
async def github_guardian_mock_star(
    request: Request,
    mode: str = Query(default="json", max_length=16),
):
    """
    Local visual-debugging backdoor — ONLY enabled when `DEBUG=true`.
    Returns rank=1 STAR_SUCCESS directly and activates Redis `is_genesis_guardian`
    without calling external GitHub OAuth endpoints.
    """
    container = get_app_state(request)
    settings = container.settings
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Not Found")

    session_id = request.cookies.get(GUARDIAN_SESSION_COOKIE) or secrets.token_hex(16)
    user = await get_current_user(request)
    uid = int(user["id"])
    gh_login = (user.get("username") if user else None) or "seoul-debug-pilot"
    durable = await container.db.run_sync(
        container.db.claim_guardian_durable,
        user_id=uid,
        github_user_id=f"debug-seoul-node-{uid}",
        github_login=gh_login,
        ai_daily_bonus=settings.ai_guardian_daily_bonus,
        preferred_rank=1,
        count_in_global_ledger=False,
    )
    await container.redis.mark_genesis_guardian(
        user_id=uid,
        session_id=session_id,
        github_user_id=f"debug-seoul-node-{uid}",
        rank=int(durable["rank"]),
    )

    payload = {
        "type": "STAR_SUCCESS",
        "rank": int(durable["rank"]),
        "githubUser": gh_login,
        "claimedAt": durable["claimedAt"],
        "isGenesisGuardian": True,
        "aiDailyBonus": settings.ai_guardian_daily_bonus,
    }

    if mode == "popup":
        resp = _render_popup_callback_html(
            ok=True,
            payload=payload,
            headline="⚡ 调试模式 · NO.0001 / 0100",
            detail="正在向主页面派发 STAR_SUCCESS 模拟事件…",
        )
    else:
        resp = JSONResponse(content=payload, headers={"Cache-Control": "no-store"})

    resp.set_cookie(
        key=GUARDIAN_SESSION_COOKIE,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=settings.jwt_cookie_secure,
        max_age=60 * 60 * 24 * 365,
        path="/api",
    )
    return resp
