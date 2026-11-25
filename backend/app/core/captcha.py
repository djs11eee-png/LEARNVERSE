from __future__ import annotations

import base64
import hashlib
import hmac
import math
import secrets
import struct
import zlib
from dataclasses import dataclass

from .redis_client import RedisStore

# Exclude visually ambiguous characters: 0, O, o, 1, I, i, l
CAPTCHA_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"

# Crisp 5x7 pixel bitmap glyphs (row-major 5-bit strings) for zero-dependency raster PNG rendering.
FONT_5X7: dict[str, tuple[str, ...]] = {
    "2": ("01110", "10001", "00001", "00110", "01000", "10000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
    "5": ("11111", "10000", "11110", "00001", "00001", "10001", "01110"),
    "6": ("00110", "01000", "10000", "11110", "10001", "10001", "01110"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
    "9": ("01110", "10001", "10001", "01111", "00001", "00010", "01100"),
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01110", "10001", "10000", "10000", "10000", "10001", "01110"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "G": ("01110", "10001", "10000", "10111", "10001", "10001", "01110"),
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "J": ("00111", "00010", "00010", "00010", "10010", "10010", "01100"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "N": ("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "Q": ("01110", "10001", "10001", "10001", "10101", "10010", "01101"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
    "W": ("10001", "10001", "10001", "10101", "10101", "11011", "10001"),
    "X": ("10001", "10001", "01010", "00100", "01010", "10001", "10001"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    "Z": ("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
    "a": ("00000", "00000", "01110", "00001", "01111", "10001", "01111"),
    "b": ("10000", "10000", "11110", "10001", "10001", "10001", "11110"),
    "c": ("00000", "00000", "01110", "10001", "10000", "10001", "01110"),
    "d": ("00001", "00001", "01111", "10001", "10001", "10001", "01111"),
    "e": ("00000", "00000", "01110", "10001", "11111", "10000", "01110"),
    "f": ("00110", "01001", "01000", "11110", "01000", "01000", "01000"),
    "g": ("00000", "01111", "10001", "01111", "00001", "10001", "01110"),
    "h": ("10000", "10000", "10110", "11001", "10001", "10001", "10001"),
    "j": ("00010", "00000", "00110", "00010", "00010", "10010", "01100"),
    "k": ("10000", "10000", "10010", "10100", "11000", "10100", "10010"),
    "m": ("00000", "00000", "11010", "10101", "10101", "10001", "10001"),
    "n": ("00000", "00000", "10110", "11001", "10001", "10001", "10001"),
    "p": ("00000", "00000", "11110", "10001", "11110", "10000", "10000"),
    "q": ("00000", "00000", "01111", "10001", "01111", "00001", "00001"),
    "r": ("00000", "00000", "10110", "11001", "10000", "10000", "10000"),
    "s": ("00000", "00000", "01111", "10000", "01110", "00001", "11110"),
    "t": ("01000", "01000", "11110", "01000", "01000", "01001", "00110"),
    "u": ("00000", "00000", "10001", "10001", "10001", "10011", "01101"),
    "v": ("00000", "00000", "10001", "10001", "10001", "01010", "00100"),
    "w": ("00000", "00000", "10001", "10001", "10101", "11011", "10001"),
    "x": ("00000", "00000", "10001", "01010", "00100", "01010", "10001"),
    "y": ("00000", "00000", "10001", "10001", "01111", "00001", "01110"),
    "z": ("00000", "00000", "11111", "00010", "00100", "01000", "11111"),
}

_GLYPH_PALETTE: tuple[tuple[int, int, int], ...] = (
    (74, 212, 255),
    (110, 231, 183),
    (251, 191, 36),
    (244, 114, 182),
    (167, 139, 250),
)


def _png_chunk(tag: bytes, payload: bytes) -> bytes:
    body = tag + payload
    return struct.pack("!I", len(payload)) + body + struct.pack("!I", zlib.crc32(body) & 0xFFFFFFFF)


def _encode_png_rgb(width: int, height: int, rgb: bytearray) -> bytes:
    stride = width * 3
    raw = bytearray((stride + 1) * height)
    for y in range(height):
        dst = y * (stride + 1)
        raw[dst] = 0
        src = y * stride
        raw[dst + 1 : dst + 1 + stride] = rgb[src : src + stride]
    ihdr = struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), level=6)
    return b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", idat) + _png_chunk(b"IEND", b"")


@dataclass(frozen=True)
class CaptchaChallenge:
    captcha_id: str
    png_bytes: bytes
    data_url: str
    expires_in: int


class CaptchaService:
    """
    Graphic Captcha Anti-Bot Defense:
    - Renders a true rasterized PNG bitmap image with randomized character rotation,
      shear, sinusoidal ripple distortion, interference curves, and noise dots.
    - Contains ZERO plaintext characters or SVG DOM `<text>` elements.
    - Stores only an HMAC-SHA256 digest of the lowercase answer in Redis with strict TTL.
    - Uses atomic `GETDEL` on verification so every `captcha_id` is strictly single-use.
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

    def _render_png(self, code: str) -> bytes:
        width, height = 168, 54
        buf = bytearray(width * height * 3)

        # 1. Subtle dark observatory gradient background + micro texture
        for y in range(height):
            for x in range(width):
                idx = (y * width + x) * 3
                buf[idx] = 14 + (x * 10) // width
                buf[idx + 1] = 22 + (y * 14) // height
                buf[idx + 2] = 40 + ((x + y) * 18) // (width + height)

        def set_px(px: int, py: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
            if not (0 <= px < width and 0 <= py < height):
                return
            idx = (py * width + px) * 3
            if alpha >= 0.99:
                buf[idx], buf[idx + 1], buf[idx + 2] = color
            else:
                inv = 1.0 - alpha
                buf[idx] = min(255, int(buf[idx] * inv + color[0] * alpha))
                buf[idx + 1] = min(255, int(buf[idx + 1] * inv + color[1] * alpha))
                buf[idx + 2] = min(255, int(buf[idx + 2] * inv + color[2] * alpha))

        # 2. Background distraction lines
        for _ in range(5):
            color = self._rng.choice(_GLYPH_PALETTE)
            x0, y0 = self._rng.uniform(0, 32), self._rng.uniform(4, height - 4)
            cx, cy = self._rng.uniform(45, 125), self._rng.uniform(2, height - 2)
            x1, y1 = self._rng.uniform(135, width - 1), self._rng.uniform(4, height - 4)
            for step in range(90):
                t = step / 89.0
                mt = 1.0 - t
                px = int(mt * mt * x0 + 2 * mt * t * cx + t * t * x1)
                py = int(mt * mt * y0 + 2 * mt * t * cy + t * t * y1)
                set_px(px, py, color, 0.35)
                set_px(px, py + 1, color, 0.22)

        # 3. Warped rotated & sheared raster glyphs
        wave_amp = self._rng.uniform(1.1, 2.0)
        wave_freq = self._rng.uniform(0.11, 0.18)
        wave_phase = self._rng.uniform(0.0, math.tau)
        n_chars = len(code)
        slot_w = (width - 20) / max(1, n_chars)

        for idx, ch in enumerate(code):
            bitmap = FONT_5X7.get(ch, FONT_5X7["X"])
            color = self._rng.choice(_GLYPH_PALETTE)
            cx = 16.0 + idx * slot_w + slot_w * 0.42 + self._rng.uniform(-2.0, 2.0)
            cy = height * 0.5 + self._rng.uniform(-3.0, 3.0)
            angle = self._rng.uniform(-0.36, 0.36)
            shear = self._rng.uniform(-0.22, 0.22)
            sx = self._rng.uniform(3.1, 3.8)
            sy = self._rng.uniform(3.3, 4.1)
            cos_a, sin_a = math.cos(angle), math.sin(angle)

            for py in range(max(0, int(cy - 22)), min(height, int(cy + 22))):
                for px in range(max(0, int(cx - 20)), min(width, int(cx + 20))):
                    dx = px - cx - wave_amp * math.sin(py * wave_freq + wave_phase)
                    dy = py - cy
                    rx = (dx * cos_a + dy * sin_a) - shear * (-dx * sin_a + dy * cos_a)
                    ry = -dx * sin_a + dy * cos_a
                    gx = int(round(rx / sx + 2.0))
                    gy = int(round(ry / sy + 3.0))
                    if 0 <= gx < 5 and 0 <= gy < 7 and bitmap[gy][gx] == "1":
                        set_px(px, py, color, 0.96)

        # 4. Foreground interference arcs & speckles (breaks naive threshold/segmentation)
        for _ in range(3):
            color = self._rng.choice(_GLYPH_PALETTE)
            y0 = self._rng.uniform(6, height - 6)
            y1 = self._rng.uniform(6, height - 6)
            for px in range(6, width - 6):
                t = px / float(width)
                py = int(y0 + (y1 - y0) * t + 4.0 * math.sin(t * math.pi * 2.0 + wave_phase))
                set_px(px, py, color, 0.42)

        for _ in range(42):
            color = self._rng.choice(_GLYPH_PALETTE)
            px = self._rng.randint(2, width - 3)
            py = self._rng.randint(2, height - 3)
            set_px(px, py, color, 0.52)

        return _encode_png_rgb(width, height, buf)

    async def generate(self) -> tuple[CaptchaChallenge, str]:
        """
        Generates a new single-use raster PNG captcha and stores its digest in Redis with TTL.
        Returns `(challenge, raw_code)` (raw_code is only used internally or in test fixtures).
        """
        captcha_id = secrets.token_hex(16)
        code = "".join(self._rng.choice(CAPTCHA_ALPHABET) for _ in range(5))
        digest = self._digest(captcha_id, code)
        await self.redis.setex(f"captcha:{captcha_id}", self.ttl_seconds, digest)

        png_bytes = self._render_png(code)
        b64 = base64.b64encode(png_bytes).decode("ascii")
        data_url = f"data:image/png;base64,{b64}"
        return (
            CaptchaChallenge(
                captcha_id=captcha_id,
                png_bytes=png_bytes,
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
