from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .api import ai, auth, discussions, github_guardian, sandbox, sync
from .catalog import catalog
from .config import Settings, get_settings
from .core.captcha import CaptchaService
from .core.email import EmailVerificationService
from .core.redis_client import RedisStore
from .core.security import PasswordHasherService
from .db import DatabaseManager
from .services.ai_service import AIService
from .services.discussion_service import DiscussionService
from .services.sandbox_service import ContainerExecutorProtocol, SandboxService
from .services.sync_service import SyncService


class SecurityMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("X-Frame-Options", "DENY")
                headers.setdefault("Referrer-Policy", "same-origin")
            await send(message)

        size = 0

        async def bounded_receive() -> Message:
            nonlocal size
            message = await receive()
            size += len(message.get("body", b""))
            if size > 512 * 1024:
                raise HTTPException(413, "提问请求过大，请缩短代码或对话记录。")
            return message

        is_chat = scope["path"].rstrip("/") == "/api/ai/chat"
        await self.app(scope, bounded_receive if is_chat else receive, send_headers)


@dataclass
class AppContainer:
    settings: Settings
    db: DatabaseManager
    redis: RedisStore
    password_hasher: PasswordHasherService
    captcha: CaptchaService
    email_service: EmailVerificationService
    sync_service: SyncService
    ai_service: AIService
    discussion_service: DiscussionService
    sandbox_service: SandboxService


def create_app(
    settings: Settings | None = None,
    sandbox_executor: ContainerExecutorProtocol | None = None,
) -> FastAPI:
    cfg = settings or get_settings()

    db = DatabaseManager(
        db_path=cfg.sqlite_path,
        cache_kb=cfg.sqlite_cache_kb,
        busy_timeout_ms=cfg.sqlite_busy_timeout_ms,
    )
    db.initialize(legacy_discussion_db=cfg.legacy_discussion_db)

    redis_store = RedisStore(
        redis_url=cfg.redis_url,
        key_prefix=cfg.redis_key_prefix,
    )
    password_hasher = PasswordHasherService(
        scheme=cfg.password_hash_scheme,
        memory_cost_kib=cfg.argon2_memory_cost_kib,
        time_cost=cfg.argon2_time_cost,
        parallelism=cfg.argon2_parallelism,
        concurrency_limit=cfg.auth_hash_concurrency_limit,
    )
    captcha_service = CaptchaService(
        redis_store=redis_store,
        secret_key=cfg.jwt_secret_key,
        ttl_seconds=cfg.captcha_ttl_seconds,
    )
    email_service = EmailVerificationService(
        settings=cfg,
        redis_store=redis_store,
    )
    sync_service = SyncService(db=db)
    ai_service = AIService(settings=cfg, db=db)
    discussion_service = DiscussionService(
        db=db,
        blocked_keywords=cfg.discussion_blocked_keywords,
    )
    sandbox_service = SandboxService(
        settings=cfg,
        executor=sandbox_executor,
    )

    container = AppContainer(
        settings=cfg,
        db=db,
        redis=redis_store,
        password_hasher=password_hasher,
        captcha=captcha_service,
        email_service=email_service,
        sync_service=sync_service,
        ai_service=ai_service,
        discussion_service=discussion_service,
        sandbox_service=sandbox_service,
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        application.state.container = container
        await container.sandbox_service.executor.reap_orphan_containers()
        try:
            yield
        finally:
            await container.sandbox_service.executor.reap_orphan_containers()
            await container.ai_service.aclose()
            await github_guardian.close_github_http_client()
            await container.redis.close()
            container.db.close_all()

    application = FastAPI(
        title="LEARNVERSE Production Backend",
        version="1.0.0",
        description="2C2G Optimized FastAPI + SQLite WAL + Redis + Hardened Docker Micro-Sandbox",
        docs_url="/api/docs" if cfg.debug and cfg.env != "production" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if cfg.debug and cfg.env != "production" else None,
        lifespan=lifespan,
    )
    application.state.container = container

    if cfg.debug or cfg.env != "production":
        application.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://127.0.0.1:5173",
                "http://localhost:5173",
                "http://127.0.0.1:4173",
                "http://localhost:4173",
            ],
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=["*"],
        )

    application.add_middleware(SecurityMiddleware)

    @application.get("/api/health", tags=["system"])
    async def health_check() -> dict[str, object]:
        return {"status": "ok"}

    application.include_router(auth.router)
    application.include_router(sync.router)
    application.include_router(ai.router)
    application.include_router(discussions.router)
    application.include_router(sandbox.router)
    application.include_router(github_guardian.router)

    return application


app = create_app()
