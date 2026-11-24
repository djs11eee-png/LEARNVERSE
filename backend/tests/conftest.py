from __future__ import annotations

import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
# The ASGI module constructs its default application at import time. Keep even
# that unused database and its signing key isolated from developer configuration.
_import_dir = tempfile.TemporaryDirectory(prefix="lv-test-bootstrap-")
with patch.dict(os.environ, {
    "LEARNVERSE_SQLITE_PATH": str(Path(_import_dir.name) / "bootstrap.sqlite"),
    "LEARNVERSE_LEGACY_DISCUSSION_DB": "",
    "REDIS_URL": "memory://",
    "JWT_SECRET_KEY": "isolated_test_bootstrap_key_32_bytes",
}):
    from app.main import app as _bootstrap_app, create_app
_bootstrap_app.state.container.db.close_all()
_import_dir.cleanup()

from app.core.security import create_jwt_token
from app.services.sandbox_service import ContainerExecutorProtocol, ContainerRunResult


class FakeDockerSandboxExecutor(ContainerExecutorProtocol):
    """
    Deterministic mock of DockerCliExecutor that records every `docker run`
    invocation, verifies security flags, simulates C/Java compile & run output,
    simulates infinite loop timeouts / OOM kills, and tracks active concurrency
    plus `docker rm -f -v` zombie cleanup calls.
    """

    def __init__(self) -> None:
        self.invocations: list[dict[str, Any]] = []
        self.removed_containers: list[str] = []
        self.active_c = 0
        self.max_active_c = 0
        self.active_java = 0
        self.max_active_java = 0
        self.simulated_delay_seconds: float = 0.0
        self.force_timeout: bool = False
        self.force_oom: bool = False
        self.custom_stderr: str = ""
        self.custom_stdout: str = "Hello, LEARNVERSE!\n"
        self.custom_exit_code: int = 0

    async def force_remove_container(self, container_name: str) -> None:
        self.removed_containers.append(container_name)

    async def reap_orphan_containers(self) -> int:
        return 0

    async def run_container(
        self,
        *,
        container_name: str,
        docker_args: list[str],
        stdin_data: str,
        timeout_seconds: float,
    ) -> ContainerRunResult:
        is_c = "-c-" in container_name
        if is_c:
            self.active_c += 1
            self.max_active_c = max(self.max_active_c, self.active_c)
        else:
            self.active_java += 1
            self.max_active_java = max(self.max_active_java, self.active_java)

        self.invocations.append(
            {
                "container_name": container_name,
                "docker_args": list(docker_args),
                "stdin_data": stdin_data,
                "timeout_seconds": timeout_seconds,
            }
        )
        try:
            if self.simulated_delay_seconds > 0:
                await __import__("asyncio").sleep(self.simulated_delay_seconds)

            if self.force_timeout:
                await self.force_remove_container(container_name)
                return ContainerRunResult(
                    exit_code=None,
                    stdout="",
                    stderr="",
                    timed_out=True,
                    stopped_reason="运行时间过长，已强制终止容器。请检查是否存在死循环或阻塞等待。",
                )

            if self.force_oom:
                return ContainerRunResult(
                    exit_code=137,
                    stdout="",
                    stderr="Killed",
                    oom_killed=True,
                    stopped_reason="程序超出 2C2G 容器内存或进程数上限（Exit 137 / OOM），已被内核隔离层强制终止。",
                )

            return ContainerRunResult(
                exit_code=self.custom_exit_code,
                stdout=self.custom_stdout,
                stderr=self.custom_stderr,
            )
        finally:
            if is_c:
                self.active_c -= 1
            else:
                self.active_java -= 1


@dataclass
class TestAppContext:
    temp_dir: Path
    settings: Settings
    executor: FakeDockerSandboxExecutor
    app: FastAPI
    client: TestClient

    def sign_in(self, username: str = "member", role: str = "student") -> str:
        with self.app.state.container.db.write_transaction() as conn:
            user_id = conn.execute(
                "INSERT INTO users(username,role,password_hash,created_at,updated_at) VALUES (?,?, 'unused','','')",
                (username, role),
            ).lastrowid
        token, _, _ = create_jwt_token(user_id=user_id, username=username, role=role,
                                       secret_key=self.settings.jwt_secret_key)
        self.client.cookies.set(self.settings.jwt_cookie_name, token, path="/api")
        return token

    def close(self) -> None:
        try:
            self.client.close()
        finally:
            self.app.state.container.db.close_all()
            shutil.rmtree(self.temp_dir, ignore_errors=True)


def make_test_context(**overrides: Any) -> TestAppContext:
    temp_dir = Path(tempfile.mkdtemp(prefix="lv-backend-test-"))
    defaults: dict[str, Any] = {
        "env": "test",
        "sqlite_path": str(temp_dir / "test_learnverse.sqlite"),
        "legacy_discussion_db": str(temp_dir / "nonexistent_legacy.sqlite"),
        "redis_url": "memory://",
        "jwt_secret_key": "test_secret_key_for_learnverse_unit_tests_32bytes!",
        "debug": False,
        "llm_base_url": "",
        "llm_api_key": "",
        "sandbox_temp_root": str(temp_dir / "sandbox-jobs"),
        "trusted_proxies": ["127.0.0.1/32", "::1/128", "testclient"],
        "jwt_cookie_secure": False,
        "allowed_origins": [],
        "email_verification_enabled": False,
        "ai_intercept_passthrough": False,
        "argon2_memory_cost_kib": 8192,
        "argon2_time_cost": 1,
    }
    defaults.update(overrides)
    settings = Settings(**defaults)
    executor = FakeDockerSandboxExecutor()
    app = create_app(settings=settings, sandbox_executor=executor)
    client = TestClient(app)
    return TestAppContext(
        temp_dir=temp_dir,
        settings=settings,
        executor=executor,
        app=app,
        client=client,
    )
