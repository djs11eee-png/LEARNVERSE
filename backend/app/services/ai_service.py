from __future__ import annotations

import ast
import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncIterator

import httpx

from ..config import Settings
from ..db import DatabaseManager
from ..schemas.ai import AIChatRequest, AICodeReference, AIDiagnosticCard, GuestAIChatRequest

from .ai_quota import Admission, GuestAdmission

MODEL = "learnverse-chat"
MAX_TOKENS = 1024
TEMPERATURE = 0.2

FULLWIDTH_MAP = {
    "（": "(",
    "）": ")",
    "：": ":",
    "；": ";",
    "，": ",",
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
}
FULLWIDTH_CHARS = tuple(FULLWIDTH_MAP.keys())
PYTHON_BLOCK_HEADER_RE = re.compile(
    r"^\s*(?:if|elif|else|for|while|def|class|try|except|finally|with)\b[^:]*$"
)
C_SCANF_NO_ADDR_RE = re.compile(
    r'\bscanf\s*\(\s*"[^"]*%[dflLFuoxX][^"]*"\s*,\s*([a-zA-Z_]\w*)\s*\)'
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sse_event(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n"


def _find_fullwidth_outside_strings_and_comments(
    code: str, comment_prefix: str = "#"
) -> tuple[int, int, str, str, str] | None:
    """
    Scans code line-by-line for full-width Chinese punctuation outside string literals and comments.
    Returns `(line_no, col_no, bad_char, original_line, fixed_line)` if found.
    """
    for line_idx, raw_line in enumerate(code.splitlines(), start=1):
        in_single = False
        in_double = False
        escaped = False
        for col_idx, ch in enumerate(raw_line, start=1):
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
                continue
            if not in_single and not in_double:
                if comment_prefix == "#" and ch == "#":
                    break
                if (
                    comment_prefix == "//"
                    and ch == "/"
                    and col_idx < len(raw_line)
                    and raw_line[col_idx] == "/"
                ):
                    break
            if ch == "'" and not in_double:
                in_single = not in_single
                continue
            if ch == '"' and not in_single:
                in_double = not in_double
                continue
            if not in_single and not in_double and ch in FULLWIDTH_MAP:
                fixed_line = raw_line
                for fw, ascii_rep in FULLWIDTH_MAP.items():
                    fixed_line = fixed_line.replace(fw, ascii_rep)
                return line_idx, col_idx, ch, raw_line, fixed_line
    return None


@dataclass
class InterceptionResult:
    matched: bool = False
    cards: list[AIDiagnosticCard] = field(default_factory=list)
    references: list[AICodeReference] = field(default_factory=list)
    answer_markdown: str = ""


def inspect_zero_cost_diagnostics(
    language: str, code: str, error_output: str, question: str
) -> InterceptionResult:
    """
    Pre-Flight Zero-Cost Syntax & Common Beginner Pitfall Interceptor.
    Detects deterministic syntax/runtime errors locally in <1ms without spending LLM tokens.
    """
    lang = language.lower().strip()
    combined_err = f"{error_output}\n{question}".strip()
    lines = code.splitlines()

    # 1. Universal check: Full-width Chinese punctuation in code (outside strings/comments)
    if code.strip() and lang in ("python", "c", "java", "javascript", "sql"):
        comment_prefix = "#" if lang == "python" else "//"
        fw_hit = _find_fullwidth_outside_strings_and_comments(code, comment_prefix)
        if fw_hit is not None:
            line_no, col_no, bad_ch, orig_line, fixed_line = fw_hit
            ascii_ch = FULLWIDTH_MAP[bad_ch]
            card = AIDiagnosticCard(
                severity="error",
                title="检测到中文全角标点符号",
                message=f"第 {line_no} 行第 {col_no} 列使用了中文全角符号「{bad_ch}」，编译器/解释器只能识别英文半角符号 `{ascii_ch}`。",
                line=line_no,
                column=col_no,
                suggestion=f"请切换输入法为英文半角状态，将「{bad_ch}」替换为 `{ascii_ch}`。",
            )
            ref = AICodeReference(
                language=lang,
                line_start=line_no,
                line_end=line_no,
                snippet=orig_line,
                fix=fixed_line,
            )
            explanation = (
                f"### 零成本语法诊断：全角标点符号\n\n"
                f"在第 **{line_no}** 行第 **{col_no}** 列中，代码混入了中文全角符号 `{bad_ch}`。\n"
                f"- **原代码**：`{orig_line.strip()}`\n"
                f"- **建议修改为**：`{fixed_line.strip()}`\n\n"
                f"提示：写代码时建议开启英文输入法，字符串引号以外的括号 `()`、冒号 `:`、分号 `;` 和逗号 `,` 都必须使用英文半角字符。"
            )
            return InterceptionResult(
                matched=True,
                cards=[card],
                references=[ref],
                answer_markdown=explanation,
            )

    # 2. Python-specific AST & runtime diagnostics
    if lang == "python":
        # 2a. Check runtime error patterns first if error_output is present
        name_err = re.search(r"NameError:\s*name '([^']+)' is not defined", combined_err)
        if name_err:
            missing_name = name_err.group(1)
            line_match = re.search(r"line (\d+)", combined_err)
            line_no = int(line_match.group(1)) if line_match else 1
            line_no = max(1, min(line_no, max(1, len(lines))))
            orig_line = lines[line_no - 1] if lines else ""
            builtin_typos = {
                "pritn": "print",
                "pirnt": "print",
                "prnit": "print",
                "imput": "input",
                "inptu": "input",
                "lenght": "len",
                "ture": "True",
                "flase": "False",
                "true": "True",
                "false": "False",
            }
            suggested_name = builtin_typos.get(missing_name.lower())
            fix_line = (
                orig_line.replace(missing_name, suggested_name)
                if (suggested_name and orig_line)
                else f"# 请在使用 {missing_name} 前先定义它，或检查拼写/大小写"
            )
            hint = (
                f"是不是想写 `{suggested_name}`？Python 区分大小写与拼写。"
                if suggested_name
                else f"请检查 `{missing_name}` 是否拼写有误、大小写不一致，或者在使用前忘了先用 `=` 赋值。"
            )
            return InterceptionResult(
                matched=True,
                cards=[
                    AIDiagnosticCard(
                        severity="error",
                        title=f"未定义的名称：{missing_name}",
                        message=f"Python 找不到名为 `{missing_name}` 的变量或函数。",
                        line=line_no,
                        suggestion=hint,
                    )
                ],
                references=[
                    AICodeReference(
                        language="python",
                        line_start=line_no,
                        line_end=line_no,
                        snippet=orig_line,
                        fix=fix_line,
                    )
                ],
                answer_markdown=(
                    f"### 零成本诊断：`NameError`（名称未定义）\n\n"
                    f"程序在运行到第 **{line_no}** 行时报错：`name '{missing_name}' is not defined`。\n\n"
                    f"- **原因**：{hint}\n"
                    f"- **修复建议**：`{fix_line.strip()}`"
                ),
            )

        if "EOFError" in combined_err or "EOF when reading a line" in combined_err:
            return InterceptionResult(
                matched=True,
                cards=[
                    AIDiagnosticCard(
                        severity="error",
                        title="标准输入已读完（EOFError）",
                        message="程序调用了 `input()`，但标准输入框中没有足够的数据行。",
                        suggestion="请在点击「运行代码」前，在编辑器下方的「标准输入」框中填好程序需要的每一行输入。",
                    )
                ],
                references=[],
                answer_markdown=(
                    "### 零成本诊断：`EOFError`（输入行数不足）\n\n"
                    "每次调用 `input()` 都会从「标准输入」框读取一行文字。当输入框为空或行数不够时，就会触发 `EOFError`。\n"
                    "- **解决方法**：先在编辑器下方的「标准输入」文本框里填写测试数据（每行对应一次 `input()`），再点击运行。"
                ),
            )

        if "ZeroDivisionError" in combined_err:
            return InterceptionResult(
                matched=True,
                cards=[
                    AIDiagnosticCard(
                        severity="error",
                        title="除数为零（ZeroDivisionError）",
                        message="在除法 `/`、`//` 或取余 `%` 运算中，右边的除数等于 0。",
                        suggestion="在执行除法前，先用 `if divisor != 0:` 检查分母是否为 0。",
                    )
                ],
                references=[],
                answer_markdown=(
                    "### 零成本诊断：`ZeroDivisionError`（除以零）\n\n"
                    "数学与编程中都不能除以 `0`。请检查参与 `/`、`//` 或 `%` 的分母变量在什么输入下会变成 `0`，并在除法前加上分支判断 `if n != 0:`。"
                ),
            )

        # 2b. Parse Python AST to catch exact SyntaxError / IndentationError
        if code.strip():
            try:
                ast.parse(code)
            except IndentationError as exc:
                line_no = exc.lineno or 1
                orig_line = lines[line_no - 1] if 1 <= line_no <= len(lines) else ""
                fixed_line = "    " + orig_line.lstrip()
                return InterceptionResult(
                    matched=True,
                    cards=[
                        AIDiagnosticCard(
                            severity="error",
                            title="Python 缩进错误（IndentationError）",
                            message=f"第 {line_no} 行的缩进空格数不对齐，或冒号 `:` 下方缺少缩进块。",
                            line=line_no,
                            column=exc.offset,
                            suggestion="同一层代码块请统一使用 4 个空格缩进，不要混用 Tab 和空格。",
                        )
                    ],
                    references=[
                        AICodeReference(
                            language="python",
                            line_start=line_no,
                            line_end=line_no,
                            snippet=orig_line,
                            fix=fixed_line,
                        )
                    ],
                    answer_markdown=(
                        f"### 零成本语法诊断：缩进不对齐（第 {line_no} 行）\n\n"
                        f"Python 依靠行首缩进来区分代码块层次。请检查第 **{line_no}** 行：\n"
                        f"1. 如果上一行以冒号 `:` 结尾（如 `if`、`for`、`def`），这一行必须向右缩进 **4 个空格**；\n"
                        f"2. 同一代码块内的每一行开头空格数必须完全一致。"
                    ),
                )
            except SyntaxError as exc:
                line_no = exc.lineno or 1
                orig_line = lines[line_no - 1] if 1 <= line_no <= len(lines) else ""
                stripped = orig_line.split("#", 1)[0].rstrip()
                if PYTHON_BLOCK_HEADER_RE.match(stripped):
                    fixed_line = stripped + ":"
                    suggestion = "在 `if` / `else` / `for` / `while` / `def` 语句末尾补上英文冒号 `:`。"
                elif re.search(r"^\s*if\s+[^=<>!]+=(?!=)", stripped):
                    fixed_line = re.sub(r"(?<![=!<>])=(?!=)", "==", stripped, count=1)
                    suggestion = "在 `if` 条件中判断相等请用双等号 `==`，单等号 `=` 用于给变量赋值。"
                else:
                    fixed_line = orig_line
                    suggestion = "请检查这一行及上一行的括号 `()`、引号 `\"\"` 或冒号 `:` 是否成对闭合。"

                return InterceptionResult(
                    matched=True,
                    cards=[
                        AIDiagnosticCard(
                            severity="error",
                            title="Python 语法错误（SyntaxError）",
                            message=f"第 {line_no} 行存在语法错误：{exc.msg}",
                            line=line_no,
                            column=exc.offset,
                            suggestion=suggestion,
                        )
                    ],
                    references=[
                        AICodeReference(
                            language="python",
                            line_start=line_no,
                            line_end=line_no,
                            snippet=orig_line,
                            fix=fixed_line,
                        )
                    ],
                    answer_markdown=(
                        f"### 零成本语法诊断：`SyntaxError`（第 {line_no} 行）\n\n"
                        f"- **出错位置**：第 **{line_no}** 行 `{orig_line.strip()}`\n"
                        f"- **原因分析**：{suggestion}\n"
                        f"- **建议写法**：`{fixed_line.strip()}`"
                    ),
                )

    # 3. C17 Specific Diagnostics
    if lang == "c" and code.strip():
        for idx, raw_line in enumerate(lines, start=1):
            m_scanf = C_SCANF_NO_ADDR_RE.search(raw_line)
            if m_scanf:
                var_name = m_scanf.group(1)
                fixed = raw_line.replace(var_name, f"&{var_name}", 1)
                return InterceptionResult(
                    matched=True,
                    cards=[
                        AIDiagnosticCard(
                            severity="error",
                            title="scanf 缺少取地址符 &",
                            message=f"第 {idx} 行调用 `scanf` 读取基本类型变量 `{var_name}` 时未传地址 `&{var_name}`。",
                            line=idx,
                            suggestion=f"将 `{var_name}` 改为 `&{var_name}`，把变量的内存地址传给 `scanf`。",
                        )
                    ],
                    references=[
                        AICodeReference(
                            language="c",
                            line_start=idx,
                            line_end=idx,
                            snippet=raw_line,
                            fix=fixed,
                        )
                    ],
                    answer_markdown=(
                        f"### 零成本 C 语言诊断：`scanf` 缺少取地址符 `&`\n\n"
                        f"在第 **{idx}** 行中，`scanf` 需要知道变量在内存中的地址才能写入输入值。\n"
                        f"- **原代码**：`{raw_line.strip()}`\n"
                        f"- **修复后**：`{fixed.strip()}`"
                    ),
                )

        if (
            re.search(r"\b(?:printf|scanf)\s*\(", code)
            and "#include <stdio.h>" not in code
            and "#include<stdio.h>" not in code
        ):
            return InterceptionResult(
                matched=True,
                cards=[
                    AIDiagnosticCard(
                        severity="error",
                        title="缺少标准输入输出头文件 <stdio.h>",
                        message="代码调用了 `printf` 或 `scanf`，但源文件顶部未包含 `#include <stdio.h>`。",
                        line=1,
                        suggestion="在文件第一行添加 `#include <stdio.h>`。",
                    )
                ],
                references=[
                    AICodeReference(
                        language="c",
                        line_start=1,
                        line_end=1,
                        snippet=lines[0] if lines else "",
                        fix="#include <stdio.h>\n" + (lines[0] if lines else ""),
                    )
                ],
                answer_markdown=(
                    "### 零成本 C 语言诊断：未包含 `<stdio.h>`\n\n"
                    "使用 `printf` 或 `scanf` 前，必须在源文件顶部加上 `#include <stdio.h>` 来引入标准输入输出函数声明。"
                ),
            )

        if "expected ';'" in combined_err:
            line_match = re.search(r"\.c:(\d+):", combined_err)
            line_no = int(line_match.group(1)) if line_match else 1
            prev_line = max(1, line_no - 1)
            snippet = lines[prev_line - 1] if 1 <= prev_line <= len(lines) else ""
            return InterceptionResult(
                matched=True,
                cards=[
                    AIDiagnosticCard(
                        severity="error",
                        title="C 语句末尾缺少分号 `;`",
                        message=f"编译器在第 {line_no} 行之前发现未结束的语句，通常是因为第 {prev_line} 行末尾漏了英文分号 `;`。",
                        line=prev_line,
                        suggestion=f"检查第 {prev_line} 行末尾并补上 `;`。",
                    )
                ],
                references=[
                    AICodeReference(
                        language="c",
                        line_start=prev_line,
                        line_end=prev_line,
                        snippet=snippet,
                        fix=snippet.rstrip() + ";",
                    )
                ],
                answer_markdown=(
                    f"### 零成本 C 语言诊断：缺少分号 `;`\n\n"
                    f"C 语言的每条简单语句都必须以英文分号 `;` 结尾。请检查第 **{prev_line}** 行：`{snippet.strip()}`，在行尾补上 `;`。"
                ),
            )

    # 4. Java Specific Diagnostics
    if lang == "java" and code.strip():
        if re.search(r"^\s*package\s+[\w.]+;", code, re.MULTILINE):
            return InterceptionResult(
                matched=True,
                cards=[
                    AIDiagnosticCard(
                        severity="error",
                        title="单文件 Java 实验室需省略 package 声明",
                        message="LEARNVERSE 单文件 Java 沙盒直接编译运行入口类，不支持顶层 `package` 声明。",
                        line=1,
                        suggestion="请删去顶部的 `package ...;` 语句，直接保留 `public class Main { ... }`。",
                    )
                ],
                references=[],
                answer_markdown=(
                    "### 零成本 Java 诊断：请省略 `package` 语句\n\n"
                    "在单文件沙盒中运行 Java 代码时，请删去文件开头的 `package ...;`，并确保包含带 `public static void main(String[] args)` 的入口类。"
                ),
            )
        for idx, raw_line in enumerate(lines, start=1):
            if "system.out.print" in raw_line:
                fixed = raw_line.replace("system.out.print", "System.out.print")
                return InterceptionResult(
                    matched=True,
                    cards=[
                        AIDiagnosticCard(
                            severity="error",
                            title="Java 类名大小写错误：System 首字母需大写",
                            message=f"第 {idx} 行将 `System` 写成了小写的 `system`。",
                            line=idx,
                            suggestion="将 `system.out.println` 改为 `System.out.println`。",
                        )
                    ],
                    references=[
                        AICodeReference(
                            language="java",
                            line_start=idx,
                            line_end=idx,
                            snippet=raw_line,
                            fix=fixed,
                        )
                    ],
                    answer_markdown=(
                        f"### 零成本 Java 诊断：`System` 首字母需大写\n\n"
                        f"Java 严格区分大小写，标准输出类名为 `System`。请将第 **{idx}** 行的 `system.out` 改为 `System.out`。"
                    ),
                )

    return InterceptionResult(matched=False)


@dataclass
class PreparedChat:
    question: str
    code: str
    error_output: str
    truncated: dict[str, bool]
    interception: InterceptionResult
    messages: list[dict[str, str]]
    reserved: int
    max_tokens: int = MAX_TOKENS


class AIService:
    def __init__(self, settings: Settings, db: DatabaseManager) -> None:
        self.settings = settings
        self.db = db
        self._http_client: httpx.AsyncClient | None = None
        self._http_client_loop: asyncio.AbstractEventLoop | None = None

    def _get_http_client(self) -> httpx.AsyncClient:
        loop = asyncio.get_running_loop()
        if (
            self._http_client is None
            or self._http_client.is_closed
            or self._http_client_loop is not loop
        ):
            read_timeout = max(5.0, float(self.settings.llm_timeout_seconds))
            timeout = httpx.Timeout(
                connect=min(5.0, read_timeout),
                read=read_timeout,
                write=min(15.0, read_timeout),
                pool=min(5.0, read_timeout),
            )
            self._http_client = httpx.AsyncClient(
                timeout=timeout,
                limits=httpx.Limits(
                    max_keepalive_connections=16,
                    max_connections=64,
                    keepalive_expiry=30.0,
                ),
            )
            self._http_client_loop = loop
        return self._http_client

    async def aclose(self) -> None:
        if self._http_client is not None and not self._http_client.is_closed:
            try:
                await self._http_client.aclose()
            except RuntimeError:
                pass
        self._http_client = None
        self._http_client_loop = None

    def _record_log(
        self,
        *,
        user_id: int,
        client_ip: str,
        course_id: str | None,
        lesson_id: str | None,
        language: str,
        question: str,
        code_snippet: str,
        error_input: str,
        intercepted: bool,
        diagnostics: list[AIDiagnosticCard],
        answer_text: str,
        model: str,
        status: str,
        latency_ms: int,
    ) -> int:
        now_iso = _now_iso()
        with self.db.write_transaction() as conn:
            cursor = conn.execute(
                """
                INSERT INTO ai_qa_logs (
                    user_id, client_ip, course_id, lesson_id, language,
                    question, code_snippet, error_input, intercepted,
                    diagnostics_json, answer_text, model, status, latency_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    client_ip,
                    course_id,
                    lesson_id,
                    language,
                    question,
                    code_snippet,
                    error_input,
                    1 if intercepted else 0,
                    json.dumps([c.model_dump() for c in diagnostics], ensure_ascii=False),
                    answer_text,
                    model,
                    status,
                    latency_ms,
                    now_iso,
                ),
            )
            return int(cursor.lastrowid or 0)

    def prepare(
        self,
        req: AIChatRequest | GuestAIChatRequest,
        *,
        max_tokens: int = MAX_TOKENS,
        guest_mode: bool = False,
    ) -> PreparedChat:
        # 1. Enforce strict input length truncation
        q_limit = max(100, int(self.settings.ai_max_question_chars))
        c_limit = max(200, int(self.settings.ai_max_code_chars))
        e_limit = max(100, int(self.settings.ai_max_error_chars))

        question = req.question.strip()[:q_limit]
        code = req.code[:c_limit]
        error_output = req.error_output[:e_limit]
        truncated = {
            "question": len(req.question.strip()) > q_limit,
            "code": len(req.code) > c_limit,
            "error_output": len(req.error_output) > e_limit,
        }

        # 2. Pre-Flight Zero-Cost Syntax & Common Error Interception
        interception = inspect_zero_cost_diagnostics(
            req.language, code, error_output, question
        )
        if guest_mode:
            system_prompt = (
                "你是 LEARNVERSE 学习观测站的编程与计算机科学伴学助手 Vesper（游客体验模式）。"
                "主要围绕 C 语言循环与基础语法、编程学习、以及 Learnverse 的学习实验台、积分与 3D 知识卡包玩法作答。"
                "请用简洁、清晰的简体中文分点解释，总字数严格控制在 260 字以内，不要生成超过 5 行的长表格，确保所有代码块与句子完整收尾。"
            )
        else:
            system_prompt = (
                "你是 LEARNVERSE 学习站的编程与计算机科学助教 Vesper。仅回答与编程、课程和学习有关的问题。"
                "请用简洁、准确的简体中文启发式引导学员定位问题，优先指出具体行号与边界条件，不要直接替学员代写整道大题。"
            )
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        for turn in req.history[-6:]:
            messages.append({"role": turn.role, "content": turn.content[:1000]})

        user_prompt_parts = [f"【语言】{req.language}"]
        if req.course_id or req.lesson_id:
            user_prompt_parts.append(
                f"【章节】{req.course_id or ''}/{req.lesson_id or ''}"
            )
        if code.strip():
            user_prompt_parts.append(f"【代码】\n```{req.language}\n{code}\n```")
        if error_output.strip():
            user_prompt_parts.append(f"【运行报错】\n```\n{error_output}\n```")
        user_prompt_parts.append(f"【学员提问】\n{question}")
        messages.append({"role": "user", "content": "\n\n".join(user_prompt_parts)})

        bounded_max_tokens = max(128, min(MAX_TOKENS, int(max_tokens)))
        reserved = 0
        if ((not interception.matched or self.settings.ai_intercept_passthrough)
                and self.settings.llm_api_key and self.settings.llm_base_url):
            # UTF-8 byte upper estimate plus per-message framing and the full completion allowance.
            reserved = bounded_max_tokens + 256 + sum(
                len(m["content"].encode("utf8")) + 32 for m in messages
            )
        return PreparedChat(
            question,
            code,
            error_output,
            truncated,
            interception,
            messages,
            reserved,
            max_tokens=bounded_max_tokens,
        )

    async def stream_chat(
        self,
        *,
        user_id: int | None,
        client_ip: str,
        req: AIChatRequest | GuestAIChatRequest,
        prepared: PreparedChat,
        lease: Admission | GuestAdmission,
    ) -> AsyncIterator[str]:
        start_time = time.perf_counter()

        question, code, error_output = prepared.question, prepared.code, prepared.error_output
        interception = prepared.interception
        passthrough = self.settings.ai_intercept_passthrough
        yield _sse_event(
            "meta",
            {
                "intercepted": interception.matched,
                "passthrough": bool(interception.matched and passthrough),
                "truncated": prepared.truncated,
                "model": (
                    "zero-cost-rule-engine"
                    if (interception.matched and not passthrough)
                    else MODEL
                ),
            },
        )

        collected_cards: list[AIDiagnosticCard] = list(interception.cards)
        collected_text_parts: list[str] = []

        if interception.matched:
            for card in interception.cards:
                yield _sse_event("diagnostic_card", card.model_dump())
            for ref in interception.references:
                yield _sse_event("code_reference", ref.model_dump())

            if not passthrough:
                collected_text_parts.append(interception.answer_markdown)
                yield _sse_event("text_delta", {"delta": interception.answer_markdown})
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                log_id = (
                    await self.db.run_sync(
                        self._record_log,
                        user_id=user_id,
                        client_ip=client_ip,
                        course_id=req.course_id,
                        lesson_id=req.lesson_id,
                        language=req.language,
                        question=question,
                        code_snippet=code,
                        error_input=error_output,
                        intercepted=True,
                        diagnostics=collected_cards,
                        answer_text="".join(collected_text_parts),
                        model="zero-cost-rule-engine",
                        status="intercepted",
                        latency_ms=latency_ms,
                    )
                    if user_id is not None
                    else 0
                )
                yield _sse_event(
                    "done",
                    {
                        "log_id": log_id,
                        "intercepted": True,
                        "status": "intercepted",
                        "latency_ms": latency_ms,
                    },
                )
                return

        # 3. Forward to Standard OpenAI-Compatible Upstream (`/chat/completions`)
        if not self.settings.llm_base_url or not self.settings.llm_api_key:
            fallback_msg = (
                "已为你完成本地静态语法检查。当前节点未配置上游大模型密钥（`LLM_BASE_URL` / `LLM_API_KEY`），"
                "请先核对报错行号与变量类型，或在 `.env` 中配置兼容 OpenAI 的模型接口。"
            )
            if not collected_cards:
                card = AIDiagnosticCard(
                    severity="info",
                    title="本地学习诊断提示",
                    message="未配置上游 LLM_API_KEY，当前仅启用零成本静态语法诊断层。",
                    suggestion="在服务端环境变量中设置 LLM_BASE_URL 和 LLM_API_KEY 即可开启深度问答。",
                )
                collected_cards.append(card)
                yield _sse_event("diagnostic_card", card.model_dump())
            collected_text_parts.append(fallback_msg)
            yield _sse_event("text_delta", {"delta": fallback_msg})
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            log_id = (
                await self.db.run_sync(
                    self._record_log,
                    user_id=user_id,
                    client_ip=client_ip,
                    course_id=req.course_id,
                    lesson_id=req.lesson_id,
                    language=req.language,
                    question=question,
                    code_snippet=code,
                    error_input=error_output,
                    intercepted=interception.matched,
                    diagnostics=collected_cards,
                    answer_text="".join(collected_text_parts),
                    model=MODEL,
                    status="unconfigured_fallback",
                    latency_ms=latency_ms,
                )
                if user_id is not None
                else 0
            )
            yield _sse_event(
                "done",
                {
                    "log_id": log_id,
                    "intercepted": interception.matched,
                    "status": "unconfigured_fallback",
                    "latency_ms": latency_ms,
                },
            )
            return

        endpoint = f"{self.settings.llm_base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }
        payload = {
            "model": MODEL,
            "messages": prepared.messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            "max_tokens": prepared.max_tokens,
            "temperature": TEMPERATURE,
        }

        status = "ok"
        reported = None
        try:
            client = self._get_http_client()
            async with client.stream(
                "POST", endpoint, headers=headers, json=payload
            ) as resp:
                if resp.status_code >= 400:
                    status = f"upstream_http_{resp.status_code}"
                    yield _sse_event(
                        "error",
                        {
                            "code": "UPSTREAM_HTTP_ERROR",
                            "message": f"上游模型服务暂时繁忙（HTTP {resp.status_code}），已切换至本地诊断建议。",
                            "fallback": True,
                        },
                    )
                else:
                    async for raw_line in resp.aiter_lines():
                        line = raw_line.strip()
                        if not line or not line.startswith("data:"):
                            continue
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            lease.reported_tokens = reported
                            break
                        try:
                            chunk = json.loads(data_str)
                            usage = chunk.get("usage") or {}
                            total = usage.get("total_tokens")
                            if type(total) is int and 0 < total < 2**60:
                                reported = total
                            choices = chunk.get("choices") or []
                            if choices:
                                delta = (choices[0].get("delta") or {}).get(
                                    "content"
                                )
                                if delta:
                                    collected_text_parts.append(delta)
                                    yield _sse_event(
                                        "text_delta", {"delta": delta}
                                    )
                        except json.JSONDecodeError:
                            continue
        except httpx.TimeoutException:
            status = "upstream_timeout"
            yield _sse_event(
                "error",
                {
                    "code": "UPSTREAM_TIMEOUT",
                    "message": "上游大模型响应超时，连接已安全关闭。",
                    "fallback": True,
                },
            )
        except Exception:
            status = "upstream_exception"
            yield _sse_event(
                "error",
                {
                    "code": "UPSTREAM_ERROR",
                    "message": "大模型流式传输中断，请稍后重试。",
                    "fallback": True,
                },
            )

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        log_id = (
            await self.db.run_sync(
                self._record_log,
                user_id=user_id,
                client_ip=client_ip,
                course_id=req.course_id,
                lesson_id=req.lesson_id,
                language=req.language,
                question=question,
                code_snippet=code,
                error_input=error_output,
                intercepted=interception.matched,
                diagnostics=collected_cards,
                answer_text="".join(collected_text_parts),
                model=MODEL,
                status=status,
                latency_ms=latency_ms,
            )
            if user_id is not None
            else 0
        )
        yield _sse_event(
            "done",
            {
                "log_id": log_id,
                "intercepted": interception.matched,
                "status": status,
                "latency_ms": latency_ms,
            },
        )
