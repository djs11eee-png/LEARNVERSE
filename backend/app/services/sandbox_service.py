from __future__ import annotations

import asyncio
import os
import re
import shutil
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from ..config import Settings
from ..schemas.sandbox import SandboxDiagnostic, SandboxRunRequest, SandboxRunResponse

MAX_CODE_CHARS = 32_000
MAX_STDIN_CHARS = 8_000
MAX_OUTPUT_CHARS = 26_000
MAX_DIAGNOSTICS = 32
MAX_DIAGNOSTIC_LENGTH = 4_000

# Matches scripts/local-lab.mjs comment & string stripper for safe static analysis
COMMENT_AND_STRING_RE = re.compile(
    r"/\*[\s\S]*?\*/|//[^\r\n]*|\"(?:\\.|[^\"\\\r\n])*\"|'(?:\\.|[^'\\\r\n])*'"
)
COMMENT_ONLY_RE = re.compile(r"/\*[\s\S]*?\*/|//[^\r\n]*")
JAVA_PUBLIC_CLASS_RE = re.compile(
    r"\bpublic\s+(?:(?:final|abstract)\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]{0,63})\b"
)
JAVA_ANY_CLASS_RE = re.compile(r"\bclass\s+([A-Za-z_$][A-Za-z0-9_$]{0,63})\b")
JAVA_PACKAGE_RE = re.compile(r"\bpackage\s+[\w$]")
SAFE_JAVA_IDENTIFIER_RE = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]{0,63}$")

COMPILER_DIAG_RE = re.compile(
    r"^[^\r\n]+?\.(?:c|java):(\d+)(?::(\d+))?:\s*(fatal error|error|warning):\s*(.*)$",
    re.IGNORECASE,
)
CARET_LINE_RE = re.compile(r"^(\s*)\^")
JAVA_STACK_LINE_RE = re.compile(r"\.java:(\d+)\)")

# Pre-execution defense-in-depth static security rules (complementing Docker isolation)
C_FORBIDDEN_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r'#\s*include\s*[<"]\s*(?:/|\.\.|\\)'),
        "安全拦截：禁止在 #include 中引用绝对路径或上级目录（防路径穿越读取宿主机文件）。",
    ),
    (
        re.compile(
            r"\b(?:fork|vfork|clone|system|popen|execl|execle|execlp|execv|execve|execvp|ptrace|mount|umount|umount2|chroot|pivot_root|unshare|setns|syscall)\s*\("
        ),
        "安全拦截：公网沙盒禁止调用进程派生（fork/system/exec）或特权系统调用。",
    ),
    (
        re.compile(
            r"#\s*include\s*<\s*(?:sys/socket\.h|netinet/in\.h|arpa/inet\.h|netdb\.h|sys/ptrace\.h|sys/mount\.h)\s*>|\b(?:socket|connect|bind|listen|accept|sendto|recvfrom)\s*\("
        ),
        "安全拦截：公网沙盒已启用网络完全隔离（--network=none），禁止使用网络套接字接口。",
    ),
    (
        re.compile(r"\b(?:__asm__|__asm|asm)\b"),
        "安全拦截：公网教学沙盒禁止嵌入内联汇编指令。",
    ),
)

JAVA_FORBIDDEN_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(
            r"\b(?:ProcessBuilder|Runtime\s*\.\s*getRuntime\s*\(\s*\)\s*\.\s*exec|System\s*\.\s*load(?:Library)?|sun\.misc\.Unsafe)\b"
        ),
        "安全拦截：公网 Java 沙盒禁止派生外部系统进程、加载本地 JNI 库或访问 Unsafe。",
    ),
    (
        re.compile(
            r"\b(?:java\.net\.|javax\.net\.|Socket|ServerSocket|HttpURLConnection|HttpClient|InetAddress|DatagramSocket|URLConnection)\b"
        ),
        "安全拦截：公网 Java 沙盒已禁用网络（--network=none），禁止发起网络连接。",
    ),
    (
        re.compile(
            r'"\s*(?:/etc/|/proc/|/sys/|/var/run/docker|/root/|\.\./)'
        ),
        "安全拦截：公网沙盒根文件系统只读，禁止访问系统敏感目录。",
    ),
)


class SandboxBusyError(Exception):
    """Raised when the language execution queue is saturated or times out."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


@dataclass
class ContainerRunResult:
    exit_code: int | None
    stdout: str
    stderr: str
    timed_out: bool = False
    oom_killed: bool = False
    stopped_reason: str = ""


class ContainerExecutorProtocol(Protocol):
    async def run_container(
        self,
        *,
        container_name: str,
        docker_args: list[str],
        stdin_data: str,
        timeout_seconds: float,
    ) -> ContainerRunResult: ...

    async def force_remove_container(self, container_name: str) -> None: ...

    async def reap_orphan_containers(self) -> int: ...


class DockerCliExecutor:
    """
    Production Docker CLI executor that spawns ephemeral hardened containers
    and guarantees `docker rm -f -v <container_name>` cleanup on timeout or abort.
    """

    def __init__(self, docker_bin: str = "docker") -> None:
        self.docker_bin = docker_bin

    async def force_remove_container(self, container_name: str) -> None:
        if not container_name or not container_name.startswith("lv-sbx-"):
            return
        try:
            proc = await asyncio.create_subprocess_exec(
                self.docker_bin,
                "rm",
                "-f",
                "-v",
                container_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=5.0)
        except Exception:
            pass

    async def reap_orphan_containers(self) -> int:
        """
        Finds and forcefully removes any leftover `lv-sbx-*` sandbox containers
        (e.g., from a previous backend crash or power loss) to prevent zombie containers.
        """
        try:
            proc = await asyncio.create_subprocess_exec(
                self.docker_bin,
                "ps",
                "-aq",
                "--filter",
                "name=^lv-sbx-",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
            container_ids = [
                cid.strip()
                for cid in stdout_bytes.decode("utf-8", errors="ignore").splitlines()
                if cid.strip()
            ]
            if not container_ids:
                return 0
            rm_proc = await asyncio.create_subprocess_exec(
                self.docker_bin,
                "rm",
                "-f",
                "-v",
                *container_ids,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(rm_proc.wait(), timeout=8.0)
            return len(container_ids)
        except Exception:
            return 0

    async def run_container(
        self,
        *,
        container_name: str,
        docker_args: list[str],
        stdin_data: str,
        timeout_seconds: float,
    ) -> ContainerRunResult:
        cmd = [self.docker_bin, "run", "--rm", "--name", container_name, *docker_args]
        proc: asyncio.subprocess.Process | None = None
        timed_out = False
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdin_bytes = stdin_data.encode("utf-8") if stdin_data else b""
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(input=stdin_bytes),
                    timeout=timeout_seconds,
                )
            except asyncio.TimeoutError:
                timed_out = True
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                await self.force_remove_container(container_name)
                return ContainerRunResult(
                    exit_code=None,
                    stdout="",
                    stderr="",
                    timed_out=True,
                    stopped_reason="运行时间过长，已强制终止容器。请检查是否存在死循环或阻塞等待。",
                )

            stdout_str = stdout_bytes.decode("utf-8", errors="replace")[
                :MAX_OUTPUT_CHARS
            ]
            stderr_str = stderr_bytes.decode("utf-8", errors="replace")[
                :MAX_OUTPUT_CHARS
            ]
            exit_code = proc.returncode
            # Exit code 137 = 128 + SIGKILL (9), triggered by cgroup memory limit OOM killer or PIDS limit
            oom_killed = exit_code == 137 or "OutOfMemoryError" in stderr_str
            stopped_reason = ""
            if oom_killed:
                stopped_reason = "程序超出 2C2G 容器内存或进程数上限（Exit 137 / OOM），已被内核隔离层强制终止。"
            return ContainerRunResult(
                exit_code=exit_code,
                stdout=stdout_str,
                stderr=stderr_str,
                timed_out=False,
                oom_killed=oom_killed,
                stopped_reason=stopped_reason,
            )
        except FileNotFoundError:
            return ContainerRunResult(
                exit_code=None,
                stdout="",
                stderr="",
                stopped_reason="云端沙盒未检测到 Docker 守护进程，请确认容器服务已启动。",
            )
        finally:
            if timed_out or (proc is not None and proc.returncode is None):
                await self.force_remove_container(container_name)


def parse_compiler_diagnostics(stderr: str) -> list[SandboxDiagnostic]:
    """
    Parses GCC and javac compiler output into structured line/column diagnostics.
    Matches `compilerDiagnostics` in `scripts/local-lab.mjs` lines 29-39.
    """
    lines = stderr.splitlines()
    diagnostics: list[SandboxDiagnostic] = []
    for idx, text in enumerate(lines):
        m = COMPILER_DIAG_RE.match(text)
        if not m:
            continue
        line_str, col_str, kind, message = m.groups()
        caret_match = (
            CARET_LINE_RE.match(lines[idx + 2]) if (idx + 2) < len(lines) else None
        )
        col_num: int | None = None
        if col_str:
            col_num = int(col_str)
        elif caret_match:
            col_num = len(caret_match.group(1)) + 1

        severity = "warning" if kind.lower() == "warning" else "error"
        diagnostics.append(
            SandboxDiagnostic(
                severity=severity,
                message=message.strip()[:MAX_DIAGNOSTIC_LENGTH],
                line=int(line_str),
                column=col_num,
            )
        )
        if len(diagnostics) >= MAX_DIAGNOSTICS - 1:
            break
    return diagnostics


def extract_java_entry_class(code: str) -> str | None:
    """
    Extracts and validates the single entry class name from Java source code.
    Rejects any source containing a `package` declaration or non-identifier class name
    to prevent filename path traversal inside `/workspace`.
    """
    stripped = COMMENT_AND_STRING_RE.sub(" ", code)
    if JAVA_PACKAGE_RE.search(stripped):
        return None
    m_pub = JAVA_PUBLIC_CLASS_RE.search(stripped)
    class_name = m_pub.group(1) if m_pub else None
    if not class_name:
        m_any = JAVA_ANY_CLASS_RE.search(stripped)
        class_name = m_any.group(1) if m_any else None
    if not class_name or not SAFE_JAVA_IDENTIFIER_RE.match(class_name):
        return None
    return class_name


def audit_untrusted_code(language: str, code: str) -> str | None:
    """
    Pre-execution static defense-in-depth audit.
    Returns an error message if a forbidden syscall/escape pattern is detected, or None if clean.
    """
    if "\x00" in code:
        return "安全拦截：代码包含非法空字节（Null Byte）。"

    if language == "c":
        code_no_comments = COMMENT_ONLY_RE.sub(" ", code)
        for pattern, reason in C_FORBIDDEN_PATTERNS:
            if pattern.search(code_no_comments):
                return reason
    elif language == "java":
        code_no_comments = COMMENT_ONLY_RE.sub(" ", code)
        for pattern, reason in JAVA_FORBIDDEN_PATTERNS:
            if pattern.search(code_no_comments):
                return reason
    return None


class SandboxService:
    """
    2C2G-Optimized Hardened Docker Micro-Sandbox Orchestrator for C and Java.
    - Enforces tiered concurrency:
        * C: Alpine+GCC, `semaphore = 2`, 96 MiB RAM cap, `--pids-limit 32`
        * Java: Alpine+OpenJDK, **GLOBAL SINGLE CONCURRENCY (`semaphore = 1`)**,
          320 MiB container cap, `-Xmx96m -XX:+UseSerialGC -XX:TieredStopAtLevel=1`,
          and bounded queue fast degradation so concurrent clicks NEVER OOM the 2 GiB host!
    - Enforces `--network=none`, `--read-only`, `--cap-drop=ALL`,
      `--security-opt=no-new-privileges:true`, `--user=65534:65534`,
      and hard timeout `docker rm -f -v` cleanup with zero zombie containers.
    """

    def __init__(
        self,
        settings: Settings,
        executor: ContainerExecutorProtocol | None = None,
    ) -> None:
        self.settings = settings
        self.executor: ContainerExecutorProtocol = executor or DockerCliExecutor(
            settings.docker_bin
        )

        # Tiered 2C2G semaphores: C allows 2 concurrent runs; Java strictly capped at 1!
        self.c_concurrency = max(1, min(int(settings.sandbox_c_concurrency), 4))
        self.java_concurrency = 1  # Hard architectural invariant for 2 GiB RAM protection

        self._c_semaphore = asyncio.Semaphore(self.c_concurrency)
        self._java_semaphore = asyncio.Semaphore(self.java_concurrency)

        self._c_active = 0
        self._c_waiting = 0
        self._java_active = 0
        self._java_waiting = 0

        # Ephemeral CSRF/lab session token for `/api/local-runner` compatibility
        self.lab_token = uuid.uuid4().hex + uuid.uuid4().hex

        base_tmp = (
            Path(settings.sandbox_temp_root)
            if settings.sandbox_temp_root
            else Path(tempfile.gettempdir()) / "learnverse-sandbox"
        )
        base_tmp.mkdir(parents=True, exist_ok=True)
        self.temp_root = Path(os.path.realpath(base_tmp))

    def status(self) -> dict[str, object]:
        return {
            "languages": ["c", "java"],
            "sandbox_mode": "docker",
            "limits": {
                "c": {
                    "concurrency": self.c_concurrency,
                    "active": self._c_active,
                    "waiting": self._c_waiting,
                    "max_queue": self.settings.sandbox_c_max_queue,
                    "memory_limit": self.settings.sandbox_c_memory_limit,
                    "pids_limit": self.settings.sandbox_c_pids_limit,
                },
                "java": {
                    "concurrency": self.java_concurrency,
                    "active": self._java_active,
                    "waiting": self._java_waiting,
                    "max_queue": self.settings.sandbox_java_max_queue,
                    "memory_limit": self.settings.sandbox_java_memory_limit,
                    "javac_max_heap": self.settings.sandbox_javac_max_heap,
                    "java_max_heap": self.settings.sandbox_java_max_heap,
                    "pids_limit": self.settings.sandbox_java_pids_limit,
                },
            },
        }

    def build_docker_args(
        self,
        *,
        language: str,
        job_dir: Path,
        entry_class: str = "Main",
    ) -> list[str]:
        """
        Builds the hardened `docker run` argument vector with strict network,
        filesystem, capability, PID, CPU, and memory isolation.
        """
        is_c = language == "c"
        image = self.settings.sandbox_c_image if is_c else self.settings.sandbox_java_image
        mem_limit = (
            self.settings.sandbox_c_memory_limit
            if is_c
            else self.settings.sandbox_java_memory_limit
        )
        cpus = self.settings.sandbox_c_cpus if is_c else self.settings.sandbox_java_cpus
        pids_limit = (
            self.settings.sandbox_c_pids_limit
            if is_c
            else self.settings.sandbox_java_pids_limit
        )

        # C needs exec on /workspace to run the compiled binary; Java only needs bytecode read
        workspace_tmpfs = (
            "/workspace:rw,exec,nosuid,nodev,size=16m,uid=65534,gid=65534,mode=1777"
            if is_c
            else "/workspace:rw,noexec,nosuid,nodev,size=16m,uid=65534,gid=65534,mode=1777"
        )

        args = [
            "-i",
            "--network=none",
            "--read-only",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges:true",
            "--user=65534:65534",
            f"--memory={mem_limit}",
            f"--memory-swap={mem_limit}",
            "--oom-score-adj=500",
            f"--cpus={cpus}",
            f"--pids-limit={pids_limit}",
            "--ulimit",
            "nofile=64:64",
            "--ulimit",
            "fsize=4194304:4194304",
            "--ulimit",
            "core=0:0",
            "--tmpfs",
            workspace_tmpfs,
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,nodev,size=8m,uid=65534,gid=65534,mode=1777",
            "--workdir",
            "/workspace",
            "-v",
            f"{job_dir}:/input:ro",
        ]

        if self.settings.sandbox_seccomp_profile:
            args.extend(
                ["--security-opt", f"seccomp={self.settings.sandbox_seccomp_profile}"]
            )

        if is_c:
            c_run_timeout = max(1, int(self.settings.sandbox_c_run_timeout_seconds))
            shell_script = (
                "cp /input/main.c /workspace/main.c && "
                "gcc -std=c17 -O0 -Wall -Wextra -Wpedantic -fdiagnostics-color=never "
                "-fmax-errors=10 main.c -o /workspace/practice -lm && "
                f"timeout -s KILL {c_run_timeout}s /workspace/practice"
            )
        else:
            java_run_timeout = max(
                1, int(self.settings.sandbox_java_run_timeout_seconds)
            )
            javac_heap = self.settings.sandbox_javac_max_heap
            java_heap = self.settings.sandbox_java_max_heap
            shell_script = (
                f"cp /input/{entry_class}.java /workspace/{entry_class}.java && "
                f"javac -J-Xms16m -J-Xmx{javac_heap} -J-XX:+UseSerialGC "
                f"-J-XX:TieredStopAtLevel=1 -J-XX:MaxMetaspaceSize=64m "
                f"-J-Duser.language=en -J-Duser.country=US -encoding UTF-8 "
                f"-Xlint:all -proc:none {entry_class}.java && "
                f"timeout -s KILL {java_run_timeout}s java -Xms16m -Xmx{java_heap} "
                f"-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=48m "
                f"-XX:CompressedClassSpaceSize=16m -Xss512k -Dfile.encoding=UTF-8 "
                f"-cp /workspace {entry_class}"
            )

        args.extend([image, "/bin/sh", "-c", shell_script])
        return args

    def _create_isolated_job_dir(self) -> Path:
        raw_dir = tempfile.mkdtemp(prefix="lv-job-", dir=str(self.temp_root))
        resolved = Path(os.path.realpath(raw_dir))
        if resolved.parent != self.temp_root or not resolved.name.startswith("lv-job-"):
            raise RuntimeError("沙盒临时目录路径校验失败（疑似符号链接穿越）。")
        try:
            os.chmod(resolved, 0o755)
        except OSError:
            pass
        return resolved

    def _cleanup_job_dir(self, job_dir: Path | None) -> None:
        if job_dir is None:
            return
        try:
            resolved = Path(os.path.realpath(job_dir))
            if resolved.parent == self.temp_root and resolved.name.startswith("lv-job-"):
                shutil.rmtree(resolved, ignore_errors=True)
        except OSError:
            pass

    async def execute(self, req: SandboxRunRequest) -> SandboxRunResponse:
        start_ts = time.perf_counter()
        lang = req.language
        code = req.code or ""
        stdin = req.stdin or ""

        # 1. Input bounds validation (matches scripts/local-lab.mjs)
        if not code.strip() or len(code) > MAX_CODE_CHARS or len(stdin) > MAX_STDIN_CHARS:
            return SandboxRunResponse(
                output="",
                diagnostics=[
                    SandboxDiagnostic(
                        severity="error",
                        message="代码或标准输入超过运行上限（代码最多 32000 字符，输入最多 8000 字符）。请缩短后重试。",
                    )
                ],
                execution_time_ms=0,
            )

        # 2. Java single-file entry class & package validation
        entry_class = "Main"
        if lang == "java":
            extracted = extract_java_entry_class(code)
            if not extracted:
                return SandboxRunResponse(
                    output="",
                    diagnostics=[
                        SandboxDiagnostic(
                            severity="error",
                            message="请用一个带 main 方法的 Java 类，并省略 package。类名使用英文字母、数字或下划线。",
                        )
                    ],
                    execution_time_ms=0,
                )
            entry_class = extracted

        # 3. Pre-execution static defense-in-depth audit
        violation = audit_untrusted_code(lang, code)
        if violation:
            return SandboxRunResponse(
                output="",
                diagnostics=[SandboxDiagnostic(severity="error", message=violation)],
                execution_time_ms=0,
            )

        # 4. Tiered 2C2G Concurrency Scheduling & Fast Queue Degradation
        is_c = lang == "c"
        semaphore = self._c_semaphore if is_c else self._java_semaphore
        max_queue = (
            self.settings.sandbox_c_max_queue
            if is_c
            else self.settings.sandbox_java_max_queue
        )
        queue_timeout = (
            self.settings.sandbox_c_queue_timeout_seconds
            if is_c
            else self.settings.sandbox_java_queue_timeout_seconds
        )

        current_waiting = self._c_waiting if is_c else self._java_waiting
        if current_waiting >= max_queue:
            if not is_c:
                raise SandboxBusyError(
                    "云端 Java 沙盒当前排队已满（2C2G 节点防 OOM 单并发保护中）。请稍候几秒重试，或在 Windows 本地运行「安装并启动实验室.cmd」流畅跑大题。"
                )
            raise SandboxBusyError("云端 C 语言编译沙盒当前请求较多，请稍候重试。")

        if is_c:
            self._c_waiting += 1
        else:
            self._java_waiting += 1

        acquired = False
        try:
            try:
                await asyncio.wait_for(semaphore.acquire(), timeout=queue_timeout)
                acquired = True
            except asyncio.TimeoutError as exc:
                if not is_c:
                    raise SandboxBusyError(
                        "云端 Java 沙盒排队等待超时（2C2G 全局单并发保护中）。请稍后重试，或使用本地 Windows 实验室运行。"
                    ) from exc
                raise SandboxBusyError("云端 C 语言沙盒排队超时，请稍后重试。") from exc
        finally:
            if is_c:
                self._c_waiting -= 1
            else:
                self._java_waiting -= 1

        if is_c:
            self._c_active += 1
        else:
            self._java_active += 1

        job_dir: Path | None = None
        container_name = f"lv-sbx-{lang}-{uuid.uuid4().hex[:12]}"
        try:
            job_dir = self._create_isolated_job_dir()
            source_filename = "main.c" if is_c else f"{entry_class}.java"
            source_path = job_dir / source_filename
            source_path.write_text(code, encoding="utf-8")
            try:
                os.chmod(source_path, 0o644)
            except OSError:
                pass

            docker_args = self.build_docker_args(
                language=lang, job_dir=job_dir, entry_class=entry_class
            )
            total_timeout = (
                self.settings.sandbox_c_compile_timeout_seconds
                + self.settings.sandbox_c_run_timeout_seconds
                if is_c
                else self.settings.sandbox_java_compile_timeout_seconds
                + self.settings.sandbox_java_run_timeout_seconds
            )

            run_res = await self.executor.run_container(
                container_name=container_name,
                docker_args=docker_args,
                stdin_data=stdin,
                timeout_seconds=total_timeout,
            )

            diagnostics = parse_compiler_diagnostics(run_res.stderr)
            output = run_res.stdout[:MAX_OUTPUT_CHARS]

            if run_res.timed_out or run_res.oom_killed or run_res.stopped_reason:
                diagnostics.append(
                    SandboxDiagnostic(
                        severity="error",
                        message=(
                            run_res.stopped_reason
                            or "运行时间过长，已停止。检查循环是否能结束。"
                        )[:MAX_DIAGNOSTIC_LENGTH],
                    )
                )
            elif run_res.exit_code != 0:
                # Exit code 124/137 from inner `timeout -s KILL` command
                if run_res.exit_code in (124, 137):
                    diagnostics.append(
                        SandboxDiagnostic(
                            severity="error",
                            message="运行时间过长或超出资源上限，已被沙盒强制终止。请检查循环结束条件或内存分配。",
                        )
                    )
                elif not any(d.severity == "error" for d in diagnostics):
                    java_line_match = JAVA_STACK_LINE_RE.search(run_res.stderr)
                    line_no = int(java_line_match.group(1)) if java_line_match else None
                    err_msg = (
                        run_res.stderr.strip()
                        or f"程序结束，返回码为 {run_res.exit_code}。"
                    )[:MAX_DIAGNOSTIC_LENGTH]
                    diagnostics.append(
                        SandboxDiagnostic(
                            severity="error",
                            message=err_msg,
                            line=line_no,
                        )
                    )
            elif run_res.stderr.strip() and not diagnostics:
                sep = "\n" if (output and not output.endswith("\n")) else ""
                output = (output + sep + run_res.stderr)[:MAX_OUTPUT_CHARS]

            elapsed_ms = int((time.perf_counter() - start_ts) * 1000)
            return SandboxRunResponse(
                output=output,
                diagnostics=diagnostics[:MAX_DIAGNOSTICS],
                execution_time_ms=elapsed_ms,
                sandbox_mode="docker",
            )
        finally:
            if is_c:
                self._c_active -= 1
            else:
                self._java_active -= 1
            if acquired:
                semaphore.release()
            self._cleanup_job_dir(job_dir)
