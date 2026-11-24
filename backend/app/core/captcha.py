from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass

from .redis_client import RedisStore

# Exclude visually ambiguous characters: 0, O, 1, I, l
CAPTCHA_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"


@dataclass(frozen=True)
class CaptchaChallenge:
    captcha_id: str
    svg: str
    data_url: str
    expires_in: int


class CaptchaService:
    """
    Graphic Captcha Anti-Bot Defense:
    - Generates an distorted SVG image with randomized character rotation, jitter,
      Bezier interference curves, and noise dots.
    - Stores only an HMAC-SHA256 digest of the lowercase answer in Redis with strict TTL.
    - Uses atomic `GETDEL` on verification so every `captcha_id` is strictly single-use
      (impossible to replay or brute-force across multiple attempts).
    """

    def __init__(
        self,
        redis_store: RedisStore,
        secret_key: str,
        ttl_seconds: int = 300,
    ) -> None:
        self.redis = redis_store
        self.secret_key = secret_key
        self.ttl_seconds = max(30, int(ttl_seconds))
        self._rng = secrets.SystemRandom()

    def _digest(self, captcha_id: str, code: str) -> str:
        normalized = code.strip().lower()
        msg = f"{captcha_id}:{normalized}".encode("utf-8")
        return hmac.new(
            self.secret_key.encode("utf-8"), msg, hashlib.sha256
        ).hexdigest()

    def _render_svg(self, code: str) -> str:
        width, height = 140, 48
        palette = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa"]

        curves: list[str] = []
        for _ in range(4):
            color = self._rng.choice(palette)
            x1, y1 = self._rng.randint(2, 30), self._rng.randint(6, height - 6)
            cx, cy = self._rng.randint(40, 100), self._rng.randint(2, height - 2)
            x2, y2 = self._rng.randint(110, width - 4), self._rng.randint(6, height - 6)
            curves.append(
                f'<path d="M{x1},{y1} Q{cx},{cy} {x2},{y2}" '
                f'stroke="{color}" stroke-width="1.6" fill="none" stroke-opacity="0.55"/>'
            )

        dots: list[str] = []
        for _ in range(18):
            color = self._rng.choice(palette)
            cx = self._rng.randint(6, width - 6)
            cy = self._rng.randint(6, height - 6)
            r = self._rng.choice(("1", "1.4", "1.8"))
            dots.append(
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}" fill-opacity="0.45"/>'
            )

        glyphs: list[str] = []
        for idx, ch in enumerate(code):
            color = self._rng.choice(palette)
            x = 22 + idx * 27 + self._rng.randint(-3, 3)
            y = 32 + self._rng.randint(-4, 4)
            angle = self._rng.randint(-22, 22)
            glyphs.append(
                f'<text x="{x}" y="{y}" fill="{color}" font-family="monospace" '
                f'font-size="24" font-weight="bold" '
                f'transform="rotate({angle} {x} {y})">{ch}</text>'
            )

        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-label="安全验证码">'
            f'<rect width="100%" height="100%" rx="8" fill="#0f172a"/>'
            f'{"".join(curves)}'
            f'{"".join(dots)}'
            f'{"".join(glyphs)}'
            f"</svg>"
        )

    async def generate(self) -> tuple[CaptchaChallenge, str]:
        """
        Generates a new single-use graphic captcha and stores its digest in Redis with TTL.
        Returns `(challenge, raw_code)` (raw_code is only used internally or in test fixtures).
        """
        captcha_id = secrets.token_hex(16)
        code = "".join(self._rng.choice(CAPTCHA_ALPHABET) for _ in range(4))
        digest = self._digest(captcha_id, code)
        await self.redis.setex(f"captcha:{captcha_id}", self.ttl_seconds, digest)

        svg = self._render_svg(code)
        b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
        data_url = f"data:image/svg+xml;base64,{b64}"
        return (
            CaptchaChallenge(
                captcha_id=captcha_id,
                svg=svg,
                data_url=data_url,
                expires_in=self.ttl_seconds,
            ),
            code,
        )

    async def verify_once(self, captcha_id: str, user_input: str) -> bool:
        """
        Atomically fetches and deletes the captcha challenge from Redis (`GETDEL`).
        Even if the user submits a wrong answer, the captcha_id is burned immediately.
        """
        if not captcha_id or not user_input or len(captcha_id) > 64 or len(user_input) > 16:
            return False
        stored_digest = await self.redis.getdel(f"captcha:{captcha_id.strip()}")
        if not stored_digest:
            return False
        candidate_digest = self._digest(captcha_id.strip(), user_input)
        return hmac.compare_digest(stored_digest, candidate_digest)
