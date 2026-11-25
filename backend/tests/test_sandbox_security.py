from __future__ import annotations

import asyncio
import unittest

from app.schemas.sandbox import SandboxRunRequest
from app.services.sandbox_service import SandboxBusyError
from tests.conftest import make_test_context


class TestSandboxSecurityAnd2C2GConcurrency(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = make_test_context(
            sandbox_c_concurrency=2,
            sandbox_c_max_queue=4,
            sandbox_java_concurrency=1,
            sandbox_java_max_queue=1,
            sandbox_java_queue_timeout_seconds=0.3,
        )
        self.ctx.sign_in()
        self.client = self.ctx.client
        self.sandbox = self.ctx.app.state.container.sandbox_service
        self.executor = self.ctx.executor

    def tearDown(self) -> None:
        self.ctx.close()

    def test_docker_hardening_flags_for_c_and_java(self) -> None:
        # 1. Execute valid C17 program and inspect Docker security flags
        c_code = '#include <stdio.h>\nint main(void) {\n    printf("Hello, LEARNVERSE!\\n");\n    return 0;\n}\n'
        r_c = self.client.post(
            "/api/sandbox/execute",
            json={"language": "c", "code": c_code, "stdin": ""},
        )
        self.assertEqual(r_c.status_code, 200, r_c.text)
        self.assertEqual(r_c.json()["output"], "Hello, LEARNVERSE!\n")

        c_call = self.executor.invocations[-1]
        c_args = c_call["docker_args"]
        self.assertIn("--network=none", c_args)
        self.assertIn("--read-only", c_args)
        self.assertIn("--cap-drop=ALL", c_args)
        self.assertIn("--security-opt=no-new-privileges:true", c_args)
        self.assertIn("--user=65534:65534", c_args)
        self.assertIn("--memory=96m", c_args)
        self.assertIn("--memory-swap=96m", c_args)
        self.assertIn("--pids-limit=32", c_args)
        self.assertIn("--oom-score-adj=500", c_args)
        # Verify input volume is strictly mounted read-only (:ro)
        vol_arg = c_args[c_args.index("-v") + 1]
        self.assertTrue(vol_arg.endswith(":/input:ro"), vol_arg)

        # Also verify seccomp + lv_seccomp.o + ulimit -v 98304 are present in C args/cmd
        self.assertTrue(any(str(a).startswith("seccomp=") for a in c_args))
        self.assertIn("/usr/local/lib/lv_seccomp.o", c_args[-1])
        self.assertIn("ulimit -v 98304", c_args[-1])

        # Unauthenticated /api/health hides internal limits; non-admin /api/sandbox/status hides limits
        h = self.client.get("/api/health")
        self.assertEqual(h.status_code, 200)
        self.assertEqual(h.json(), {"status": "ok"})
        st_student = self.client.get("/api/sandbox/status")
        self.assertEqual(st_student.status_code, 200)
        self.assertNotIn("limits", st_student.json())

        # 2. Execute valid Java program and inspect JVM memory & GC flags
        java_code = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, LEARNVERSE!");\n    }\n}\n'
        r_java = self.client.post(
            "/api/sandbox/execute",
            json={"language": "java", "code": java_code, "stdin": ""},
        )
        self.assertEqual(r_java.status_code, 200, r_java.text)

        java_call = self.executor.invocations[-1]
        java_args = java_call["docker_args"]
        self.assertIn("--network=none", java_args)
        self.assertIn("--read-only", java_args)
        self.assertIn("--cap-drop=ALL", java_args)
        self.assertIn("--memory=320m", java_args)
        self.assertIn("--memory-swap=320m", java_args)
        self.assertIn("--pids-limit=48", java_args)
        # Verify Java workspace tmpfs has `noexec`
        tmpfs_idx = java_args.index("--tmpfs")
        self.assertIn("noexec", java_args[tmpfs_idx + 1])
        # Verify strict -Xmx and SerialGC in shell command
        java_cmd = java_args[-1]
        self.assertIn("-J-Xmx144m", java_cmd)
        self.assertIn("-Xmx96m", java_cmd)
        self.assertIn("-XX:+UseSerialGC", java_cmd)
        self.assertIn("-XX:TieredStopAtLevel=1", java_cmd)

    def test_malicious_code_interception_fork_bomb_network_and_path_traversal(
        self,
    ) -> None:
        initial_calls = len(self.executor.invocations)

        malicious_cases = [
            # 1. C Fork Bomb
            (
                "c",
                "#include <unistd.h>\nint main(void) { while(1) { fork(); } return 0; }",
                "进程派生",
            ),
            # 2. C system() shell escape
            (
                "c",
                '#include <stdlib.h>\nint main(void) { system("cat /etc/passwd"); return 0; }',
                "进程派生",
            ),
            # 3. C Network socket access
            (
                "c",
                "#include <sys/socket.h>\nint main(void) { int s = socket(2, 1, 0); return s; }",
                "网络",
            ),
            # 4. C #include path traversal
            (
                "c",
                '#include "/etc/passwd"\nint main(void) { return 0; }',
                "路径穿越",
            ),
            # 5. C Inline Assembly kernel probing
            (
                "c",
                'int main(void) { __asm__("mov $60, %rax; syscall"); return 0; }',
                "内联汇编",
            ),
            # 6. Java ProcessBuilder / Runtime.exec escape
            (
                "java",
                'public class Main { public static void main(String[] args) throws Exception { Runtime.getRuntime().exec("sh"); } }',
                "外部系统进程",
            ),
            # 7. Java Network Socket connection
            (
                "java",
                'import java.net.Socket;\npublic class Main { public static void main(String[] args) throws Exception { new Socket("1.1.1.1", 80); } }',
                "网络",
            ),
            # 8. Java sensitive host file read
            (
                "java",
                'import java.nio.file.*;\npublic class Main { public static void main(String[] args) throws Exception { Files.readString(Path.of("/etc/shadow")); } }',
                "敏感目录",
            ),
            # 9. Java package declaration rejected
            (
                "java",
                "package evil.escape;\npublic class Main { public static void main(String[] a) {} }",
                "省略 package",
            ),
            # 10. C token-paste macro bypass (`##`) rejected
            (
                "c",
                '#define CAT(a,b) a##b\n#define XCAT(a,b) CAT(a,b)\nint main(void){ XCAT(sys,tem)("id"); return 0; }',
                "宏拼接",
            ),
            # 11. C posix_spawn bypass rejected
            (
                "c",
                '#include <spawn.h>\nint main(void){ posix_spawn(0, "/bin/sh", 0, 0, 0, 0); return 0; }',
                "受限|禁止|头文件",
            ),
            # 12. C line-continuation evasion (`sys\\\ntem`) & function-pointer alias rejected
            (
                "c",
                '#include <stdlib.h>\nint main(void){ int (*f)(const char*) = sys\\\ntem; f("id"); return 0; }',
                "进程派生",
            ),
            # 13. C sensitive /proc/self/mountinfo path access rejected
            (
                "c",
                '#include <stdio.h>\nint main(void){ fopen("/proc/self/mountinfo", "r"); return 0; }',
                "敏感目录",
            ),
            # 14. C macro-computed #include rejected
            (
                "c",
                '#define HDR "/etc/passwd"\n#include HDR\nint main(void){ return 0; }',
                "宏展开",
            ),
        ]

        import re as _re
        for lang, bad_code, expected_keyword in malicious_cases:
            resp = self.client.post(
                "/api/sandbox/execute",
                json={"language": lang, "code": bad_code, "stdin": ""},
            )
            self.assertEqual(resp.status_code, 200)
            body = resp.json()
            self.assertEqual(body["output"], "")
            self.assertTrue(
                any(
                    d["severity"] == "error" and _re.search(expected_keyword, d["message"])
                    for d in body["diagnostics"]
                ),
                f"Failed to block ({lang}): {bad_code} -> got {body}",
            )

        # Static defense intercepted all 9 malicious payloads BEFORE even spawning a container!
        self.assertEqual(len(self.executor.invocations), initial_calls)

    def test_infinite_loop_hard_timeout_and_zero_zombie_container_cleanup(
        self,
    ) -> None:
        self.executor.force_timeout = True
        infinite_c = "int main(void) { while (1) {} return 0; }"
        resp = self.client.post(
            "/api/sandbox/execute",
            json={"language": "c", "code": infinite_c, "stdin": ""},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(
            any("强制终止容器" in d["message"] for d in body["diagnostics"])
        )
        # Verify the timed-out container was forcefully removed (`docker rm -f -v`)
        self.assertEqual(len(self.executor.removed_containers), 1)
        self.assertTrue(self.executor.removed_containers[0].startswith("lv-sbx-c-"))
        # Verify temporary host job directories were all cleaned up (zero leftover folders)
        leftover_jobs = list(self.sandbox.temp_root.glob("lv-job-*"))
        self.assertEqual(leftover_jobs, [])

        # Also verify cgroup OOM kill (Exit 137) is reported clearly
        self.executor.force_timeout = False
        self.executor.force_oom = True
        oom_resp = self.client.post(
            "/api/sandbox/execute",
            json={"language": "java", "code": "public class Main { public static void main(String[] a) {} }", "stdin": ""},
        )
        self.assertEqual(oom_resp.status_code, 200)
        self.assertTrue(
            any("OOM" in d["message"] or "137" in d["message"] for d in oom_resp.json()["diagnostics"])
        )

    def test_2c2g_java_single_concurrency_semaphore_and_fast_queue_degradation(
        self,
    ) -> None:
        """
        Verifies the critical 2C2G anti-OOM requirement:
        - Java has a global single-concurrency semaphore (semaphore = 1).
        - When multiple users click Run Java simultaneously:
          * Task 1 acquires the single semaphore and runs.
          * Task 2 enters the 1-slot waiting queue.
          * Task 3 sees `waiting >= max_queue` (or times out) and is IMMEDIATELY rejected
            with the fast degradation prompt without spawning a JVM!
        """
        self.executor.simulated_delay_seconds = 0.25
        java_code = 'public class Main { public static void main(String[] args) { System.out.println("ok"); } }'
        req = SandboxRunRequest(language="java", code=java_code, stdin="")

        async def run_concurrent_java_burst() -> list[object]:
            tasks = [
                asyncio.create_task(self.sandbox.execute(req)),
                asyncio.create_task(self.sandbox.execute(req)),
                asyncio.create_task(self.sandbox.execute(req)),
                asyncio.create_task(self.sandbox.execute(req)),
            ]
            return await asyncio.gather(*tasks, return_exceptions=True)

        results = asyncio.run(run_concurrent_java_burst())

        # CRITICAL INVARIANT: Peak concurrent Java containers NEVER exceeded 1!
        self.assertEqual(self.executor.max_active_java, 1)

        busy_errors = [r for r in results if isinstance(r, SandboxBusyError)]
        self.assertGreaterEqual(len(busy_errors), 2)
        self.assertIn("2C2G", busy_errors[0].message)
        self.assertIn("安装并启动实验室.cmd", busy_errors[0].message)

    def test_2c2g_c_dual_concurrency_semaphore(self) -> None:
        """
        Verifies that C sandbox allows up to `semaphore = 2` concurrent Alpine+GCC containers,
        and never exceeds 2 even when 4 requests arrive simultaneously.
        """
        self.executor.simulated_delay_seconds = 0.15
        c_code = "int main(void) { return 0; }"
        req = SandboxRunRequest(language="c", code=c_code, stdin="")

        async def run_concurrent_c_burst() -> list[object]:
            tasks = [asyncio.create_task(self.sandbox.execute(req)) for _ in range(4)]
            return await asyncio.gather(*tasks, return_exceptions=True)

        results = asyncio.run(run_concurrent_c_burst())
        self.assertEqual(self.executor.max_active_c, 2)
        self.assertTrue(all(not isinstance(r, Exception) for r in results))

    def test_local_runner_endpoint_compatibility_and_compiler_diagnostics(
        self,
    ) -> None:
        # 1. GET /api/local-runner returns 64-hex token and ['c', 'java']
        status_resp = self.client.get("/api/local-runner")
        self.assertEqual(status_resp.status_code, 200)
        status_data = status_resp.json()
        self.assertEqual(len(status_data["token"]), 64)
        self.assertEqual(status_data["languages"], ["c", "java"])

        # 2. Simulate GCC compiler error with line & column numbers
        self.executor.custom_exit_code = 1
        self.executor.custom_stdout = ""
        self.executor.custom_stderr = (
            "main.c:4:5: error: expected ';' before 'return'\n"
            '    return 0;\n'
            "    ^~~~~~\n"
        )
        run_resp = self.client.post(
            "/api/local-runner",
            headers={"X-Learnverse-Lab": status_data["token"]},
            json={
                "language": "c",
                "code": '#include <stdio.h>\nint main(void) {\n    printf("hi")\n    return 0;\n}',
                "stdin": "",
            },
        )
        self.assertEqual(run_resp.status_code, 200)
        run_data = run_resp.json()
        self.assertEqual(len(run_data["diagnostics"]), 1)
        self.assertEqual(run_data["diagnostics"][0]["severity"], "error")
        self.assertEqual(run_data["diagnostics"][0]["line"], 4)
        self.assertEqual(run_data["diagnostics"][0]["column"], 5)


if __name__ == "__main__":
    unittest.main()
