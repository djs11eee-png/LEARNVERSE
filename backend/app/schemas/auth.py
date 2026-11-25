from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]{3,24}$")
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$")
AVATAR_DATA_URL_RE = re.compile(r"^data:image/jpeg;base64,[a-zA-Z0-9+/=]+$")


WEAK_PASSWORDS = frozenset({
    "12345678",
    "123456789",
    "1234567890",
    "password",
    "password123",
    "qwerty123",
    "qwertyui",
    "88888888",
    "11111111",
    "00000000",
    "abc12345",
})


class CaptchaResponse(BaseModel):
    captcha_id: str
    image_data_url: str
    expires_in: int


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=24)
    email: str | None = Field(default=None, max_length=120)
    password: str = Field(..., min_length=8, max_length=128)
    captcha_id: str = Field(..., min_length=8, max_length=64)
    captcha_code: str = Field(..., min_length=1, max_length=16)
    nickname: str = Field(default="", max_length=24)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        lower = v.lower()
        if lower in WEAK_PASSWORDS or len(set(v)) < 4:
            raise ValueError("密码过于简单，请换用包含字母与数字或符号的组合密码。")
        classes = sum([
            any(ch.islower() for ch in v),
            any(ch.isupper() for ch in v),
            any(ch.isdigit() for ch in v),
            any(not ch.isalnum() for ch in v),
        ])
        if classes < 2:
            raise ValueError("为了保护学习记录，注册密码需至少包含大写字母、小写字母、数字或特殊符号中的两类。")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        cleaned = v.strip()
        if not USERNAME_RE.match(cleaned):
            raise ValueError("账号需为 3 至 24 位英文字母、数字、下划线或连字符。")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip().lower()
        if not cleaned:
            return None
        if len(cleaned) > 120 or not EMAIL_RE.match(cleaned):
            raise ValueError("请输入格式有效的电子邮箱地址。")
        return cleaned

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        cleaned = v.strip()
        if "\r" in cleaned or "\n" in cleaned:
            raise ValueError("昵称不能包含换行符。")
        return cleaned[:24]


class LoginRequest(BaseModel):
    account: str = Field(..., min_length=3, max_length=120, description="账号名或邮箱")
    password: str = Field(..., min_length=1, max_length=128)
    captcha_id: str = Field(..., min_length=8, max_length=64)
    captcha_code: str = Field(..., min_length=1, max_length=16)


class EmailVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class StudentProfilePayload(BaseModel):
    nickname: str = Field(default="", max_length=24)
    avatar: str = Field(default="", max_length=180000)
    welcome: Literal["new", "skipped", "finished"] = "new"
    path: Literal["major", "interest", "undecided"] | None = None
    choice: str = Field(default="", max_length=64)

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: str) -> str:
        if not v:
            return ""
        if len(v) > 180000 or not AVATAR_DATA_URL_RE.match(v):
            return ""
        return v


class UserProfileResponse(BaseModel):
    id: int
    username: str
    email: str | None
    role: Literal["student", "admin"]
    email_verified: bool
    profile: StudentProfilePayload
    created_at: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserProfileResponse
