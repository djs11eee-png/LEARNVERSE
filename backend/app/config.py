from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_SECCOMP_PROFILE = Path(__file__).resolve().parent / "data" / "seccomp-sandbox.json"


def _load_dotenv() -> None:
    """零依赖加载 .env（本项目未引入 python-dotenv）。

    查找顺序（只加载第一个命中的文件，且不覆盖已存在的真实环境变量）：
      1. 环境变量 LEARNVERSE_ENV_FILE 指定的文件
      2. backend/.env      <- uvicorn 在 backend 目录启动时的主位置
      3. 项目根/.env        <- 仓库根目录
      4. 当前工作目录/.env

    这样无论 `uvicorn app.main:app` 是从 backend/ 还是仓库根启动，都能读到配置。
    容器部署时环境变量由 compose 注入，本函数会因「已存在」而全部跳过，不影响生产。
    """
    here = Path(__file__).resolve()          # .../backend/app/config.py
    backend_dir = here.parent.parent         # .../backend
    root_dir = backend_dir.parent            # .../

    candidates = [
        os.getenv("LEARNVERSE_ENV_FILE", ""),
        str(backend_dir / ".env"),
        str(root_dir / ".env"),
        str(Path.cwd() / ".env"),
    ]

    for raw in candidates:
        if not raw:
            continue
        path = Path(raw)
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            if key.startswith("export "):
                key = key[7:].strip()
            if not key:
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            # 真实环境变量优先，绝不覆盖
            if key not in os.environ:
                os.environ[key] = value
        return  # 只加载第一份，避免多份 .env 互相覆盖


_load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw.strip())
    except ValueError:
        return default


def _env_list(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass
class Settings:
    """
    Centralized environment configuration tuned for Ubuntu 22.04 (2 vCPU / 2 GiB RAM / 40 GiB ESSD).
    No sensitive API keys or credentials are ever hardcoded in the repository.
    """

    env: str = field(default_factory=lambda: os.getenv("LEARNVERSE_ENV", "development"))
    debug: bool = field(default_factory=lambda: _env_bool("DEBUG", False))
    host: str = field(default_factory=lambda: os.getenv("LEARNVERSE_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _env_int("LEARNVERSE_PORT", 8000))
    trusted_proxies: list[str] = field(
        default_factory=lambda: _env_list(
            "LEARNVERSE_TRUSTED_PROXIES", "127.0.0.1/32,::1/128,172.16.0.0/12"
        )
    )
    allowed_origins: list[str] = field(
        default_factory=lambda: _env_list("LEARNVERSE_ALLOWED_ORIGINS", "")
    )

    # SQLite WAL settings
    sqlite_path: str = field(
        default_factory=lambda: os.getenv(
            "LEARNVERSE_SQLITE_PATH",
            str(Path(".learnverse") / "learnverse.sqlite"),
        )
    )
    legacy_discussion_db: str = field(
        default_factory=lambda: os.getenv(
            "LEARNVERSE_LEGACY_DISCUSSION_DB",
            str(Path(".learnverse") / "discussions.sqlite"),
        )
    )
    sqlite_cache_kb: int = field(
        default_factory=lambda: _env_int("LEARNVERSE_SQLITE_CACHE_KB", -16000)
    )
    sqlite_busy_timeout_ms: int = field(
        default_factory=lambda: _env_int("LEARNVERSE_SQLITE_BUSY_TIMEOUT_MS", 5000)
    )

    # Redis settings
    redis_url: str = field(
        default_factory=lambda: os.getenv("REDIS_URL", "memory://")
    )
    redis_key_prefix: str = field(
        default_factory=lambda: os.getenv("REDIS_KEY_PREFIX", "lv:")
    )

    # Auth, JWT & Argon2 settings
    jwt_secret_key: str = field(
        default_factory=lambda: os.getenv("JWT_SECRET_KEY", "")
    )
    jwt_algorithm: str = field(
        default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256")
    )
    jwt_access_token_expire_minutes: int = field(
        default_factory=lambda: _env_int("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 7)
    )
    jwt_cookie_name: str = field(
        default_factory=lambda: os.getenv("JWT_COOKIE_NAME", "lv_access_token")
    )
    jwt_cookie_secure: bool = field(
        default_factory=lambda: _env_bool("JWT_COOKIE_SECURE", False)
    )
    jwt_cookie_samesite: str = field(
        default_factory=lambda: os.getenv("JWT_COOKIE_SAMESITE", "lax")
    )
    password_hash_scheme: str = field(
        default_factory=lambda: os.getenv("PASSWORD_HASH_SCHEME", "argon2id")
    )
    argon2_memory_cost_kib: int = field(
        default_factory=lambda: _env_int("ARGON2_MEMORY_COST_KIB", 19456)
    )
    argon2_time_cost: int = field(
        default_factory=lambda: _env_int("ARGON2_TIME_COST", 2)
    )
    argon2_parallelism: int = field(
        default_factory=lambda: _env_int("ARGON2_PARALLELISM", 1)
    )
    auth_hash_concurrency_limit: int = field(
        default_factory=lambda: _env_int("AUTH_HASH_CONCURRENCY_LIMIT", 2)
    )
    captcha_ttl_seconds: int = field(
        default_factory=lambda: _env_int("CAPTCHA_TTL_SECONDS", 300)
    )


    # Optional Email Verification (465 SSL SMTP or HTTPS API)
    email_verification_enabled: bool = field(
        default_factory=lambda: _env_bool("EMAIL_VERIFICATION_ENABLED", False)
    )
    email_provider_mode: str = field(
        default_factory=lambda: os.getenv("EMAIL_PROVIDER_MODE", "smtp_ssl")
    )
    smtp_host: str = field(default_factory=lambda: os.getenv("SMTP_HOST", ""))
    smtp_port: int = field(default_factory=lambda: _env_int("SMTP_PORT", 465))
    smtp_user: str = field(default_factory=lambda: os.getenv("SMTP_USER", ""))
    smtp_password: str = field(default_factory=lambda: os.getenv("SMTP_PASSWORD", ""))
    smtp_from: str = field(
        default_factory=lambda: os.getenv("SMTP_FROM", "LEARNVERSE <noreply@example.com>")
    )
    email_https_api_url: str = field(
        default_factory=lambda: os.getenv("EMAIL_HTTPS_API_URL", "")
    )
    email_https_api_key: str = field(
        default_factory=lambda: os.getenv("EMAIL_HTTPS_API_KEY", "")
    )
    email_otp_ttl_seconds: int = field(
        default_factory=lambda: _env_int("EMAIL_OTP_TTL_SECONDS", 600)
    )
    email_resend_cooldown_seconds: int = field(
        default_factory=lambda: _env_int("EMAIL_RESEND_COOLDOWN_SECONDS", 60)
    )

    # OpenAI-Compatible AI Proxy (SSE)
    llm_base_url: str = field(
        default_factory=lambda: os.getenv("LLM_BASE_URL", "").rstrip("/")
    )
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", ""))
    llm_timeout_seconds: float = field(
        default_factory=lambda: _env_float("LLM_TIMEOUT_SECONDS", 30.0)
    )
    ai_daily_token_budget: int = field(
        default_factory=lambda: int(os.getenv("AI_DAILY_TOKEN_BUDGET", "200000"))
    )
    ai_intercept_passthrough: bool = field(
        default_factory=lambda: _env_bool("AI_INTERCEPT_PASSTHROUGH", False)
    )
    ai_rate_limit_user_per_minute: int = field(
        default_factory=lambda: _env_int("AI_RATE_LIMIT_USER_PER_MINUTE", 10)
    )
    ai_rate_limit_user_per_hour: int = field(
        default_factory=lambda: _env_int("AI_RATE_LIMIT_USER_PER_HOUR", 60)
    )
    ai_rate_limit_user_per_day: int = field(
        default_factory=lambda: _env_int("AI_RATE_LIMIT_USER_PER_DAY", 20)
    )
    ai_guardian_daily_bonus: int = field(
        default_factory=lambda: _env_int("AI_GUARDIAN_DAILY_BONUS", 10)
    )
    ai_rate_limit_ip_per_minute: int = field(
        default_factory=lambda: _env_int("AI_RATE_LIMIT_IP_PER_MINUTE", 20)
    )

    # GitHub Star Guardian (Seoul Genesis Node)
    github_client_id: str = field(
        default_factory=lambda: os.getenv("GITHUB_CLIENT_ID", "")
    )
    github_client_secret: str = field(
        default_factory=lambda: os.getenv("GITHUB_CLIENT_SECRET", "")
    )
    github_target_owner: str = field(
        default_factory=lambda: os.getenv("GITHUB_TARGET_OWNER", "learnverse-dev")
    )
    github_target_repo: str = field(
        default_factory=lambda: os.getenv("GITHUB_TARGET_REPO", "learning-station")
    )
    github_redirect_uri: str = field(
        default_factory=lambda: os.getenv(
            "GITHUB_REDIRECT_URI", "http://localhost:8000/api/github/callback"
        )
    )
    github_guardian_limit: int = field(
        default_factory=lambda: _env_int("GITHUB_GUARDIAN_LIMIT", 100)
    )
    ai_max_question_chars: int = field(
        default_factory=lambda: _env_int("AI_MAX_QUESTION_CHARS", 2000)
    )
    ai_max_code_chars: int = field(
        default_factory=lambda: _env_int("AI_MAX_CODE_CHARS", 8000)
    )
    ai_max_error_chars: int = field(
        default_factory=lambda: _env_int("AI_MAX_ERROR_CHARS", 2000)
    )

    # Discussions settings
    discussion_rate_limit_per_minute: int = field(
        default_factory=lambda: _env_int("DISCUSSION_RATE_LIMIT_PER_MINUTE", 20)
    )
    discussion_blocked_keywords: list[str] = field(
        default_factory=lambda: _env_list(
            "DISCUSSION_BLOCKED_KEYWORDS",
            "赌博,色情,代考,外挂,诈骗,刷单",
        )
    )

    # 2C2G Hardened Docker Micro-Sandbox settings
    sandbox_backend: str = field(
        default_factory=lambda: os.getenv("SANDBOX_BACKEND", "docker")
    )
    docker_bin: str = field(default_factory=lambda: os.getenv("DOCKER_BIN", "docker"))
    sandbox_temp_root: str = field(
        default_factory=lambda: os.getenv("SANDBOX_TEMP_ROOT", "")
    )
    sandbox_seccomp_profile: str = field(
        default_factory=lambda: os.getenv("SANDBOX_SECCOMP_PROFILE")
        or (str(DEFAULT_SECCOMP_PROFILE) if DEFAULT_SECCOMP_PROFILE.is_file() else "")
    )

    # C Sandbox: Alpine+GCC, semaphore = 2
    sandbox_c_image: str = field(
        default_factory=lambda: os.getenv("SANDBOX_C_IMAGE", "learnverse-sandbox-c:latest")
    )
    sandbox_c_concurrency: int = field(
        default_factory=lambda: _env_int("SANDBOX_C_CONCURRENCY", 2)
    )
    sandbox_c_max_queue: int = field(
        default_factory=lambda: _env_int("SANDBOX_C_MAX_QUEUE", 6)
    )
    sandbox_c_queue_timeout_seconds: float = field(
        default_factory=lambda: _env_float("SANDBOX_C_QUEUE_TIMEOUT_SECONDS", 3.0)
    )
    sandbox_c_memory_limit: str = field(
        default_factory=lambda: os.getenv("SANDBOX_C_MEMORY_LIMIT", "96m")
    )
    sandbox_c_cpus: str = field(
        default_factory=lambda: os.getenv("SANDBOX_C_CPUS", "0.75")
    )
    sandbox_c_pids_limit: int = field(
        default_factory=lambda: _env_int("SANDBOX_C_PIDS_LIMIT", 32)
    )
    sandbox_c_compile_timeout_seconds: float = field(
        default_factory=lambda: _env_float("SANDBOX_C_COMPILE_TIMEOUT_SECONDS", 6.0)
    )
    sandbox_c_run_timeout_seconds: float = field(
        default_factory=lambda: _env_float("SANDBOX_C_RUN_TIMEOUT_SECONDS", 4.0)
    )

    # Java Sandbox: Alpine+OpenJDK, GLOBAL SINGLE CONCURRENCY (semaphore = 1) + strict -Xmx
    sandbox_java_image: str = field(
        default_factory=lambda: os.getenv(
            "SANDBOX_JAVA_IMAGE", "learnverse-sandbox-java:latest"
        )
    )
    sandbox_java_concurrency: int = field(
        default_factory=lambda: _env_int("SANDBOX_JAVA_CONCURRENCY", 1)
    )
    sandbox_java_max_queue: int = field(
        default_factory=lambda: _env_int("SANDBOX_JAVA_MAX_QUEUE", 2)
    )
    sandbox_java_queue_timeout_seconds: float = field(
        default_factory=lambda: _env_float("SANDBOX_JAVA_QUEUE_TIMEOUT_SECONDS", 2.5)
    )
    sandbox_java_memory_limit: str = field(
        default_factory=lambda: os.getenv("SANDBOX_JAVA_MEMORY_LIMIT", "320m")
    )
    sandbox_java_cpus: str = field(
        default_factory=lambda: os.getenv("SANDBOX_JAVA_CPUS", "1.0")
    )
    sandbox_java_pids_limit: int = field(
        default_factory=lambda: _env_int("SANDBOX_JAVA_PIDS_LIMIT", 48)
    )
    sandbox_javac_max_heap: str = field(
        default_factory=lambda: os.getenv("SANDBOX_JAVAC_MAX_HEAP", "144m")
    )
    sandbox_java_max_heap: str = field(
        default_factory=lambda: os.getenv("SANDBOX_JAVA_MAX_HEAP", "96m")
    )
    sandbox_java_compile_timeout_seconds: float = field(
        default_factory=lambda: _env_float("SANDBOX_JAVA_COMPILE_TIMEOUT_SECONDS", 8.0)
    )
    sandbox_java_run_timeout_seconds: float = field(
        default_factory=lambda: _env_float("SANDBOX_JAVA_RUN_TIMEOUT_SECONDS", 5.0)
    )

    def __post_init__(self) -> None:
        if not self.jwt_secret_key and self.debug:
            self.jwt_secret_key = secrets.token_hex(32)
        if (len(self.jwt_secret_key.encode("utf8")) < 32
                or self.jwt_secret_key.upper().startswith("CHANGE_ME")):
            raise ValueError("Set JWT_SECRET_KEY to a private key of at least 32 bytes")
        if self.ai_daily_token_budget < 0:
            raise ValueError("AI_DAILY_TOKEN_BUDGET must be nonnegative")


def get_settings() -> Settings:
    return Settings()
