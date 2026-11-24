from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
import smtplib
import ssl
from email.message import EmailMessage

import httpx

from ..config import Settings
from .redis_client import RedisStore


class EmailDeliveryError(RuntimeError):
    """Raised when sending verification email fails."""


class EmailVerificationService:
    """
    Optional Email Verification Service (465 SSL SMTP or HTTPS Transactional API).
    - Never hardcodes any credentials; reads configuration strictly from `Settings`.
    - Stores a 6-digit OTP digest in Redis with TTL (default 600s) and enforces
      a 60s resend cooldown plus a 5-attempt brute-force lockout per OTP.
    """

    def __init__(self, settings: Settings, redis_store: RedisStore) -> None:
        self.settings = settings
        self.redis = redis_store
        self._rng = secrets.SystemRandom()

    def _otp_digest(self, user_id: int, email: str, otp: str) -> str:
        msg = f"{user_id}:{email.lower().strip()}:{otp.strip()}".encode("utf-8")
        return hmac.new(
            self.settings.jwt_secret_key.encode("utf-8"), msg, hashlib.sha256
        ).hexdigest()

    async def issue_otp(self, user_id: int, email: str) -> tuple[str, int]:
        """
        Generates a 6-digit OTP, enforces resend cooldown in Redis, and stores the OTP digest.
        Returns `(otp_code, expires_in_seconds)`.
        """
        cooldown_key = f"email_cooldown:{user_id}"
        if await self.redis.get(cooldown_key):
            raise ValueError("验证码发送过于频繁，请稍候 60 秒再试。")

        otp = "".join(str(self._rng.randint(0, 9)) for _ in range(6))
        digest = self._otp_digest(user_id, email, otp)
        ttl = max(60, int(self.settings.email_otp_ttl_seconds))

        await self.redis.setex(f"email_otp:{user_id}", ttl, digest)
        await self.redis.delete(f"email_otp_tries:{user_id}")
        await self.redis.setex(
            cooldown_key,
            max(10, int(self.settings.email_resend_cooldown_seconds)),
            "1",
        )
        return otp, ttl

    async def verify_otp(self, user_id: int, email: str, otp: str) -> bool:
        if not otp or not otp.strip().isdigit() or len(otp.strip()) != 6:
            return False
        otp_key = f"email_otp:{user_id}"
        tries_key = f"email_otp_tries:{user_id}"

        stored = await self.redis.get(otp_key)
        if not stored:
            return False

        tries = await self.redis.incr_with_ttl(
            tries_key, self.settings.email_otp_ttl_seconds
        )
        if tries > 5:
            await self.redis.delete(otp_key)
            await self.redis.delete(tries_key)
            return False

        expected = self._otp_digest(user_id, email, otp)
        if not hmac.compare_digest(stored, expected):
            return False

        await self.redis.delete(otp_key)
        await self.redis.delete(tries_key)
        return True

    def _send_via_smtp_ssl_sync(self, to_email: str, subject: str, body: str) -> None:
        if not self.settings.smtp_host or not self.settings.smtp_user:
            raise EmailDeliveryError("SMTP_HOST 或 SMTP_USER 未配置。")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.settings.smtp_from or self.settings.smtp_user
        msg["To"] = to_email
        msg.set_content(body)

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            host=self.settings.smtp_host,
            port=int(self.settings.smtp_port or 465),
            context=context,
            timeout=10.0,
        ) as smtp:
            if self.settings.smtp_password:
                smtp.login(self.settings.smtp_user, self.settings.smtp_password)
            smtp.send_message(msg)

    async def _send_via_https_api(self, to_email: str, subject: str, body: str) -> None:
        if not self.settings.email_https_api_url or not self.settings.email_https_api_key:
            raise EmailDeliveryError("EMAIL_HTTPS_API_URL 或 EMAIL_HTTPS_API_KEY 未配置。")

        headers = {
            "Authorization": f"Bearer {self.settings.email_https_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": self.settings.smtp_from,
            "to": [to_email],
            "subject": subject,
            "text": body,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self.settings.email_https_api_url, headers=headers, json=payload
            )
            if resp.status_code >= 400:
                raise EmailDeliveryError(f"HTTPS 邮件服务返回状态码 {resp.status_code}")

    async def send_verification_email(self, to_email: str, otp: str) -> bool:
        """
        Sends the verification OTP via 465 SSL SMTP or HTTPS API when enabled.
        Returns True if dispatched to upstream provider, False if email verification is disabled.
        """
        if not self.settings.email_verification_enabled:
            return False

        subject = "【LEARNVERSE】邮箱安全验证码"
        body = (
            f"你好！\n\n"
            f"你的 LEARNVERSE 邮箱验证码为：{otp}\n"
            f"该验证码在 {self.settings.email_otp_ttl_seconds // 60} 分钟内有效，请勿泄露给他人。\n"
        )
        mode = self.settings.email_provider_mode.strip().lower()
        if mode == "https_api":
            await self._send_via_https_api(to_email, subject, body)
        else:
            await asyncio.to_thread(
                self._send_via_smtp_ssl_sync, to_email, subject, body
            )
        return True
