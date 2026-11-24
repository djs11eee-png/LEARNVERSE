from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import re
import secrets
import time
import uuid
from typing import Any


class JWTError(ValueError):
    """Raised when a JWT token is malformed, expired, revoked, or fails signature validation."""


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    try:
        return base64.urlsafe_b64decode((data + padding).encode("ascii"))
    except Exception as exc:
        raise JWTError("Malformed base64url segment in JWT") from exc


class PasswordHasherService:
    """
    2C2G Memory-Bounded Password Hasher supporting Argon2id, bcrypt, and OpenSSL scrypt.
    - Bounds concurrent password hashing operations via an `asyncio.Semaphore(2)`
      so a flood of concurrent login/register requests cannot exhaust the 2 GiB RAM.
    - Performs constant-time dummy verification when a username/email is not found
      to prevent user-enumeration timing attacks.
    """

    def __init__(
        self,
        scheme: str = "argon2id",
        memory_cost_kib: int = 19456,
        time_cost: int = 2,
        parallelism: int = 1,
        concurrency_limit: int = 2,
    ) -> None:
        self.scheme = scheme.lower()
        self.memory_cost_kib = max(8192, min(memory_cost_kib, 32768))
        self.time_cost = max(1, min(time_cost, 4))
        self.parallelism = max(1, min(parallelism, 2))
        self._semaphore = asyncio.Semaphore(max(1, concurrency_limit))

        self._argon2_hasher = None
        self._bcrypt_mod = None

        try:
            import argon2  # type: ignore

            self._argon2_hasher = argon2.PasswordHasher(
                time_cost=self.time_cost,
                memory_cost=self.memory_cost_kib,
                parallelism=self.parallelism,
            )
        except ImportError:
            pass

        try:
            import bcrypt  # type: ignore

            self._bcrypt_mod = bcrypt
        except ImportError:
            pass

        # Precompute a dummy hash at startup for constant-time user-not-found verification
        self._dummy_hash = self.hash_password_sync("__learnverse_dummy_password_guard__")

    def hash_password_sync(self, plain_password: str) -> str:
        if not isinstance(plain_password, str) or not plain_password:
            raise ValueError("Password must be a non-empty string")
        # Truncate overlong inputs at 128 chars before hashing to prevent DoS
        password_bytes = plain_password[:128].encode("utf-8")

        if self.scheme == "bcrypt" and self._bcrypt_mod is not None:
            return self._bcrypt_mod.hashpw(
                password_bytes[:72], self._bcrypt_mod.gensalt(rounds=12)
            ).decode("ascii")

        if self._argon2_hasher is not None:
            return self._argon2_hasher.hash(plain_password[:128])

        if self._bcrypt_mod is not None:
            return self._bcrypt_mod.hashpw(
                password_bytes[:72], self._bcrypt_mod.gensalt(rounds=12)
            ).decode("ascii")

        # Built-in Python/OpenSSL memory-hard scrypt fallback (N=16384, r=8, p=1 -> 16 MiB)
        salt = secrets.token_bytes(16)
        n, r, p = 16384, 8, 1
        derived = hashlib.scrypt(
            password_bytes, salt=salt, n=n, r=r, p=p, maxmem=32 * 1024 * 1024, dklen=32
        )
        return f"$scrypt$n={n},r={r},p={p}${_b64url_encode(salt)}${_b64url_encode(derived)}"

    def verify_password_sync(self, plain_password: str, stored_hash: str | None) -> bool:
        target_hash = stored_hash if stored_hash else self._dummy_hash
        is_dummy = not bool(stored_hash)
        password_str = (plain_password or "")[:128]
        password_bytes = password_str.encode("utf-8")

        matched = False
        try:
            if target_hash.startswith("$argon2") and self._argon2_hasher is not None:
                matched = bool(self._argon2_hasher.verify(target_hash, password_str))
            elif target_hash.startswith(("$2b$", "$2a$", "$2y$")) and self._bcrypt_mod is not None:
                matched = bool(
                    self._bcrypt_mod.checkpw(
                        password_bytes[:72], target_hash.encode("ascii")
                    )
                )
            elif target_hash.startswith("$scrypt$"):
                parts = target_hash.split("$")
                # Format: ['', 'scrypt', 'n=16384,r=8,p=1', '<salt>', '<hash>']
                if len(parts) == 5:
                    params = dict(
                        kv.split("=", 1) for kv in parts[2].split(",") if "=" in kv
                    )
                    n = int(params.get("n", 16384))
                    r = int(params.get("r", 8))
                    p = int(params.get("p", 1))
                    salt = _b64url_decode(parts[3])
                    expected = _b64url_decode(parts[4])
                    derived = hashlib.scrypt(
                        password_bytes,
                        salt=salt,
                        n=n,
                        r=r,
                        p=p,
                        maxmem=32 * 1024 * 1024,
                        dklen=len(expected),
                    )
                    matched = hmac.compare_digest(derived, expected)
        except Exception:
            matched = False

        return False if is_dummy else matched

    async def hash_password(self, plain_password: str) -> str:
        async with self._semaphore:
            return await asyncio.to_thread(self.hash_password_sync, plain_password)

    async def verify_password(
        self, plain_password: str, stored_hash: str | None
    ) -> bool:
        async with self._semaphore:
            return await asyncio.to_thread(
                self.verify_password_sync, plain_password, stored_hash
            )


def create_jwt_token(
    *,
    user_id: int,
    username: str,
    role: str,
    secret_key: str,
    expires_minutes: int = 10080,
) -> tuple[str, str, int]:
    """
    Creates an RFC 7519 HS256 JWT token with `sub`, `usr`, `role`, `iss`, `aud`, `iat`, `nbf`, `exp`, `jti`.
    Returns `(token, jti, expires_in_seconds)`.
    """
    if not secret_key or len(secret_key) < 16:
        raise ValueError("JWT_SECRET_KEY must be at least 16 characters")

    now = int(time.time())
    expires_in = max(60, int(expires_minutes) * 60)
    jti = uuid.uuid4().hex

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "usr": username,
        "role": role,
        "iss": "learnverse",
        "aud": "learnverse-web",
        "iat": now,
        "nbf": now - 5,
        "exp": now + expires_in,
        "jti": jti,
    }
    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(
        secret_key.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    token = f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"
    return token, jti, expires_in


def decode_and_verify_jwt(token: str, secret_key: str) -> dict[str, Any]:
    """
    Strictly validates an HS256 JWT token:
    - Explicitly rejects `alg: none` or any algorithm other than HS256.
    - Uses constant-time `hmac.compare_digest` for signature comparison.
    - Enforces `iss`, `aud`, `exp`, `nbf`, `sub`, and `jti` claims.
    """
    if not isinstance(token, str) or len(token) > 4096 or not re.fullmatch(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", token):
        raise JWTError("Invalid JWT structure")

    header_b64, payload_b64, sig_b64 = token.split(".")
    try:
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
    except Exception as exc:
        raise JWTError("Invalid JWT header") from exc

    if not isinstance(header, dict) or header.get("alg") != "HS256":
        raise JWTError("Unsupported or insecure JWT algorithm")

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(
        secret_key.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    actual_sig = _b64url_decode(sig_b64)
    if _b64url_encode(actual_sig) != sig_b64:
        raise JWTError("Noncanonical JWT signature")

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise JWTError("Invalid JWT signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        raise JWTError("Invalid JWT payload") from exc

    if not isinstance(payload, dict):
        raise JWTError("JWT payload must be a JSON object")

    now = int(time.time())
    exp = payload.get("exp")
    nbf = payload.get("nbf")
    iat = payload.get("iat")
    if type(exp) is not int or now >= exp:
        raise JWTError("JWT token has expired")
    if type(nbf) is not int or type(iat) is not int or now < max(iat, nbf) or iat >= exp:
        raise JWTError("JWT token is not yet valid")
    if payload.get("iss") != "learnverse" or payload.get("aud") != "learnverse-web":
        raise JWTError("Invalid JWT issuer or audience")
    if (not isinstance(payload.get("sub"), str) or not re.fullmatch(r"[1-9][0-9]{0,18}", payload["sub"])
            or int(payload["sub"]) > 2**63 - 1 or not isinstance(payload.get("jti"), str)
            or not re.fullmatch(r"[0-9a-f]{32}", payload["jti"])):
        raise JWTError("Missing subject or token ID in JWT")

    return payload
