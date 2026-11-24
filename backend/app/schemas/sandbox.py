from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SandboxDiagnostic(BaseModel):
    severity: Literal["error", "warning"]
    message: str
    line: int | None = None
    column: int | None = None


class SandboxRunRequest(BaseModel):
    language: Literal["c", "java"]
    code: str
    stdin: str = ""


class SandboxRunResponse(BaseModel):
    output: str
    diagnostics: list[SandboxDiagnostic] = Field(default_factory=list)
    execution_time_ms: int | None = None
    sandbox_mode: str = "docker"
