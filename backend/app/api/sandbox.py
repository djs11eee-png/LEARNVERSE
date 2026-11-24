from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..core.network import verify_same_origin
from ..schemas.sandbox import SandboxDiagnostic, SandboxRunRequest, SandboxRunResponse
from ..services.sandbox_service import SandboxBusyError
from .deps import get_app_state, get_client_ip, get_current_user

router = APIRouter(tags=["sandbox"], dependencies=[Depends(get_current_user)])

MAX_BODY_BYTES = 245_000
SANDBOX_HEADERS = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
}


def _sandbox_json(content: dict[str, Any], status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        content=content,
        status_code=status_code,
        headers=SANDBOX_HEADERS,
        media_type="application/json; charset=utf-8",
    )


@router.get("/api/sandbox/status")
async def get_sandbox_status(request: Request) -> JSONResponse:
    container = get_app_state(request)
    return _sandbox_json(container.sandbox_service.status())


@router.post("/api/sandbox/execute", response_model=SandboxRunResponse)
async def execute_sandbox_code(
    payload: SandboxRunRequest,
    request: Request,
    client_ip: str = Depends(get_client_ip),
) -> JSONResponse:
    container = get_app_state(request)
    if not verify_same_origin(request, container.settings.allowed_origins):
        return _sandbox_json(
            {
                "output": "",
                "diagnostics": [
                    {"severity": "error", "message": "跨站运行请求已被拒绝。"}
                ],
            },
            status_code=403,
        )

    allowed, _, _ = await container.redis.sliding_window_allow(
        f"rl:sandbox:ip:{client_ip}", window_seconds=60, limit=15
    )
    if not allowed:
        return _sandbox_json(
            {
                "output": "",
                "diagnostics": [
                    {
                        "severity": "error",
                        "message": "运行代码过于频繁，请稍候片刻再试。",
                    }
                ],
            },
            status_code=429,
        )

    try:
        result = await container.sandbox_service.execute(payload)
        return _sandbox_json(result.model_dump(exclude_none=True))
    except SandboxBusyError as exc:
        return _sandbox_json(
            {
                "output": "",
                "diagnostics": [
                    SandboxDiagnostic(
                        severity="error", message=exc.message
                    ).model_dump(exclude_none=True)
                ],
                "sandbox_mode": "docker",
            },
            status_code=429,
        )


@router.api_route("/api/local-runner", methods=["GET", "POST"])
async def handle_compatible_local_runner(
    request: Request,
    client_ip: str = Depends(get_client_ip),
) -> JSONResponse:
    """
    Frontend-compatible `/api/local-runner` endpoint that bridges `src/code/localRunner.ts`
    directly to the 2C2G hardened Docker micro-sandbox when deployed behind Nginx.
    """
    container = get_app_state(request)
    sandbox = container.sandbox_service

    if request.method == "GET":
        return _sandbox_json({"token": sandbox.lab_token, "languages": ["c", "java"]})

    if not verify_same_origin(request, container.settings.allowed_origins):
        return _sandbox_json({}, status_code=403)

    content_type = (
        request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    )
    if content_type != "application/json":
        return _sandbox_json({}, status_code=403)

    raw_body = await request.body()
    if len(raw_body) > MAX_BODY_BYTES:
        return _sandbox_json({}, status_code=413)

    try:
        decoded = __import__("json").loads(raw_body.decode("utf-8"))
        if not isinstance(decoded, dict):
            return _sandbox_json({}, status_code=400)
        lang = decoded.get("language")
        code = decoded.get("code")
        stdin = decoded.get("stdin", "")
        if (
            lang not in ("c", "java")
            or not isinstance(code, str)
            or not code.strip()
            or len(code) > 32_000
            or not isinstance(stdin, str)
            or len(stdin) > 8_000
        ):
            return _sandbox_json({}, status_code=400)
        run_req = SandboxRunRequest(language=lang, code=code, stdin=stdin)
    except Exception:
        return _sandbox_json({}, status_code=400)

    allowed, _, _ = await container.redis.sliding_window_allow(
        f"rl:sandbox:ip:{client_ip}", window_seconds=60, limit=15
    )
    if not allowed:
        return _sandbox_json(
            {
                "output": "",
                "diagnostics": [
                    {
                        "severity": "error",
                        "message": "运行代码过于频繁，请稍候片刻再试。",
                    }
                ],
            },
            status_code=429,
        )

    try:
        result = await sandbox.execute(run_req)
        return _sandbox_json(
            {
                "output": result.output,
                "diagnostics": [
                    d.model_dump(exclude_none=True) for d in result.diagnostics
                ],
            }
        )
    except SandboxBusyError as exc:
        return _sandbox_json(
            {
                "output": "",
                "diagnostics": [{"severity": "error", "message": exc.message}],
            },
            status_code=429,
        )
