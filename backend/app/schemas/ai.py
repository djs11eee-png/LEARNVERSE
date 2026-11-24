from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=2000)


class AIChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(..., min_length=1, max_length=2000)
    code: str = Field(default="", max_length=32000)
    error_output: str = Field(default="", max_length=8000)
    language: Literal["python", "javascript", "sql", "html", "c", "java", "text"] = "python"
    course_id: str | None = Field(default=None, max_length=64)
    lesson_id: str | None = Field(default=None, max_length=64)
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=12)
    @field_validator("question")
    @classmethod
    def nonblank_question(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("提问内容不能为空。")
        return value


class AIDiagnosticCard(BaseModel):
    severity: Literal["error", "warning", "info"] = "error"
    title: str
    message: str
    line: int | None = None
    column: int | None = None
    suggestion: str


class AICodeReference(BaseModel):
    language: str
    line_start: int
    line_end: int
    snippet: str
    fix: str
