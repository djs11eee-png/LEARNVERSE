# LEARNVERSE 统一生产后端 API 契约文档

> **部署拓扑**：Ubuntu 22.04 LTS（2 vCPU / 2 GiB RAM / 40 GiB ESSD）  
> **网关路由**：Nginx 静态托管前端 `dist/`，并将同源 `/api/*` 反向代理至 FastAPI（`http://127.0.0.1:8000`）。

---

## 一、鉴权与图形验证码接口（`/api/auth/*`）

### 1.1 获取防注册机图形验证码
- **请求**：`GET /api/auth/captcha`
- **限流**：单真实 IP 每分钟最多 30 次（Redis ZSET 滑动窗口）
- **响应**（`200 OK`）：
```json
{
  "captcha_id": "9f8e7d6c5b4a32109f8e7d6c5b4a3210",
  "image_svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
  "image_data_url": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0...",
  "expires_in": 300
}
```
- **安全特性**：服务端仅在 Redis 中存储 `HMAC-SHA256(secret, captcha_id + ":" + code.lower())`（TTL 300 秒）。校验时执行原子 `GETDEL`，**不论校验成功或失败均立即销毁**，彻底杜绝验证码重放与暴力穷举。

### 1.2 账号注册
- **请求**：`POST /api/auth/register`
- **请求体**：
```json
{
  "username": "alice_dev",
  "email": "alice@example.com",
  "password": "StrongPassword!2026",
  "captcha_id": "9f8e7d6c5b4a32109f8e7d6c5b4a3210",
  "captcha_code": "7K9m",
  "nickname": "小林"
}
```
- **响应**（`201 Created`）：同时下发 `HttpOnly; SameSite=Lax; Path=/api` Cookie（默认 `lv_access_token`）与 JSON Bearer Token：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 604800,
  "user": {
    "id": 1,
    "username": "alice_dev",
    "email": "alice@example.com",
    "role": "student",
    "email_verified": false,
    "profile": {
      "nickname": "小林",
      "avatar": "",
      "welcome": "new",
      "path": null,
      "choice": ""
    },
    "created_at": "2026-11-22T14:00:00Z"
  }
}
```

### 1.3 账号/邮箱登录
- **请求**：`POST /api/auth/login`
- **请求体**：
```json
{
  "account": "alice_dev 或 alice@example.com",
  "password": "StrongPassword!2026",
  "captcha_id": "9f8e7d6c5b4a32109f8e7d6c5b4a3210",
  "captcha_code": "7K9m"
}
```
- **响应**（`200 OK`）：格式同 `1.2`，并刷新 `HttpOnly` Cookie。

### 1.4 退出登录与吊销令牌
- **请求**：`POST /api/auth/logout`
- **响应**（`200 OK`）：`{"logged_out": true}`（将当前 JWT 的 `jti` 写入 SQLite 和 Redis 吊销黑名单直至过期，并清除 Cookie）。

### 1.5 获取当前登录态
- **请求**：`GET /api/auth/me`
- **响应**（`200 OK`）：返回 `UserProfileResponse`；未登录返回 `401 Unauthorized`。

### 1.6 可选邮箱验证码发送与核验（465 SSL SMTP / HTTPS API）
- **发送验证码**：`POST /api/auth/email/send-code`
  - 需登录态；Redis 强制 60 秒重发冷却期（`429`）与 600 秒有效期。
- **核验验证码**：`POST /api/auth/email/verify`
  - 请求体：`{"code": "123456"}`
  - 单个验证码最多允许尝试 5 次，超限立即作废；核验通过后更新 `email_verified = true`。

---

## 二、Lazy Auth 幂等并集同步接口（`/api/sync/*`）

### 2.1 执行本地与云端并集同步
- **请求**：`POST /api/sync/union`（需登录态）
- **请求体**（兼容前端 `localStorage` 四类本地状态）：
```json
{
  "profile": {
    "nickname": "小林",
    "avatar": "",
    "welcome": "finished",
    "path": "major",
    "choice": "major-080901"
  },
  "progress": {
    "completed": ["lv-python-foundations"],
    "started": ["lv-python-foundations"],
    "favorites": ["exercism-python"],
    "minutes": 35,
    "activity": [
      {"type": "time-logged", "minutes": 35, "timestamp": "2026-11-22T10:00:00.000Z"}
    ],
    "activeCourse": "lv-python-foundations",
    "activeRoute": "major-080901",
    "studyDays": ["2026-11-22"]
  },
  "courses": {
    "lv-python-foundations": {
      "completed": ["values", "decisions"],
      "verified": ["values"],
      "lastLesson": "decisions",
      "projectCompleted": false,
      "transferCompleted": false
    }
  },
  "vault": {
    "earned": ["welcome", "lesson/lv-python-foundations/values", "day/2026-11-22"],
    "opened": {
      "welcome": ["python-001", "python-002", "python-003", "python-004", "python-005"]
    },
    "offers": {},
    "notes": {
      "python-001": "执行 price = 6 后，price 指向整数 6。"
    }
  }
}
```
- **防刷包与幂等合并契约**：
  1. **课程章节并集**：`completed` 与 `verified` 均按权威 32 门课 / 128 章节目录白名单过滤后求集合并集；`projectCompleted` 与 `transferCompleted` 执行布尔或（`OR`）。
  2. **防伪造补给包（Earned Validation）**：`lesson/<courseId>/<lessonId>` 补给包必须以该章节已存在于合并后的 `courses[courseId].completed` 为前提；`day/YYYY-MM-DD` 必须为不晚于服务端当前日期的合法日历日，未来日期或未知标识一律拒绝并记入 `vault.rejected_packs`。
  3. **防重开刷卡（Write-Once Immutable Latch）**：每个 `(user_id, pack_key)` 在 `user_vault_packs` 表中具有**一次写入不可变锁**，且卡组必须严格满足 `len == 5` 且第 $i$ 张卡对应图鉴 `slot == i + 1`（1~5 号卡槽）。一旦某卡包在服务端开启并绑定 5 张卡片，后续任何试图通过重复调用 `/api/sync/union` 替换该卡包卡组以刷取全图鉴的请求均被拦截，服务端始终返回首次落盘的 5 张卡片。
  4. **时长防膨胀**：基于 `(timestamp, minutes)` 对 `time-logged` 活动去重，重复同步相同负载永远不会累加学习分钟数（满足 $f(f(x)) = f(x)$）。

### 2.2 拉取云端完整同步状态
- **请求**：`GET /api/sync/state`（需登录态）
- **响应**（`200 OK`）：返回与 `POST /api/sync/union` 相同结构的 `UnionSyncResponse`。

---

## 三、标准 OpenAI 兼容 AI 问答代理接口（SSE）（`/api/ai/chat`）

- **请求**：`POST /api/ai/chat`（需登录态）
- 问题最多 2000 个字符，服务端可配置更低上限。请求体只接收下例的业务字段，未知字段及查询参数返回 422。
- 上游模型固定为 `learnverse-chat`，使用 Vesper 人设、1024 个输出 Token 和 0.2 温度。
- 同一账号同时只能有一条流，结束后冷却 4 秒。普通账号每天最多 20 次；绑定账号的守护者沿用额外奖励。并发、冷却、日额度用尽返回 429。
- 北京时间零点按请求准入日期换日。两种缓存模式共用同一 SQLite 账本；所有服务进程须连接同一数据库。预算默认每天 200000 Token，由 `AI_DAILY_TOKEN_BUDGET` 控制。发起上游请求前预留输入估算和最大输出，正常结束按上游 usage 结算，缺失用量或中断时保留预留额。余额不足返回 503 及中文提示，静态诊断仍可用。
- **防刷限流**：
  - 用户维度：默认每分钟 10 次、每小时 60 次（Redis 滑动窗口）
  - 真实 IP 维度：默认每分钟 20 次（仅信任 `LEARNVERSE_TRUSTED_PROXIES` 反代透传的 `X-Forwarded-For` / `X-Real-IP`）
- **请求体**：
```json
{
  "language": "python",
  "course_id": "lv-python-foundations",
  "lesson_id": "values",
  "code": "price = 6\nprint（price）",
  "error_output": "SyntaxError: invalid character '（' (U+FF08)",
  "question": "为什么这行 print 会报错？",
  "history": []
}
```
- **SSE 响应流**（`Content-Type: text/event-stream; charset=utf-8`，`X-Accel-Buffering: no`）：
```text
event: meta
data: {"intercepted":true,"passthrough":false,"truncated":{"question":false,"code":false,"error_output":false},"model":"zero-cost-rule-engine"}

event: diagnostic_card
data: {"severity":"error","title":"检测到中文全角标点符号","message":"第 2 行第 6 列使用了中文全角符号「（」，编译器/解释器只能识别英文半角符号 `(`。","line":2,"column":6,"suggestion":"请切换输入法为英文半角状态，将「（」替换为 `(`。"}

event: code_reference
data: {"language":"python","line_start":2,"line_end":2,"snippet":"print（price）","fix":"print(price)"}

event: text_delta
data: {"delta":"### 零成本语法诊断：全角标点符号\n\n在第 **2** 行第 **6** 列中..."}

event: done
data: {"log_id":1,"intercepted":true,"status":"intercepted","latency_ms":2}
```

---

## 四、章节讨论区与管理员治理接口（`/api/discussions/*`）

### 4.1 学员讨论接口（100% 兼容前端 `ChapterDiscussion.tsx`）
- **读取章节话题分页**：`GET /api/discussions/{courseId}/{lessonId}?before=<id>`
  - 响应：`{"threads": [{"id": 1, "name": "小林", "body": "...", "created": "...", "replies": [...], "olderRepliesBefore": null}], "nextBefore": null}`
- **读取某话题更早回复**：`GET /api/discussions/{courseId}/{lessonId}?thread=<threadId>&before=<id>`
  - 响应：`{"replies": [...], "olderRepliesBefore": null}`
- **发布话题或回复**：`POST /api/discussions/{courseId}/{lessonId}`
  - 请求体：`{"id": "<32位小写hex随机幂等标识>", "parent": null, "name": "小林", "body": "讨论正文"}`
  - 响应：`200 OK` -> `{"saved": true}`
  - **安全升级**：
    1. 修复原 Vite 插件在 Nginx 反代下 `req.socket.remoteAddress` 恒为 `127.0.0.1` 导致全站共用 20 次/分钟限流的隐患；
    2. 保留 `nonce`（`id`）幂等重传机制（网络丢包重发同一 `id` 直接返回 `200 {"saved": true}` 且不扣减限流配额）；
    3. 内置 Unicode NFKC 归一化、零宽字符剥离、XSS 标签/事件拦截与敏感词过滤。

讨论列表公开读取，发帖与回复均需有效 JWT。

### 4.2 管理员讨论治理接口（需管理员账号的有效 JWT）
- **检索讨论列表**：`GET /api/admin/discussions?room=...&keyword=...&include_deleted=false&limit=50`
- **删除单条讨论（自动级联清理子回复）**：`DELETE /api/admin/discussions/{postId}?hard_delete=false`
- **按章节 / IP / 关键词批量清理**：`POST /api/admin/discussions/purge`
  - 请求体：`{"room": "lv-python-foundations/values", "client_ip": "192.0.2.99", "keyword": "广告", "hard_delete": false}`

---

## 五、2C2G 专优 C / Java 公网安全运行沙盒接口（`/api/sandbox/*` & `/api/local-runner`）

### 5.1 查询沙盒状态与 2C2G 信号量队列水位
- **请求**：`GET /api/sandbox/status`
- **响应**（`200 OK`）：
```json
{
  "languages": ["c", "java"],
  "token": "64_hex_csrf_lab_token...",
  "sandbox_mode": "docker",
  "limits": {
    "c": {"concurrency": 2, "active": 0, "waiting": 0, "max_queue": 6, "memory_limit": "96m", "pids_limit": 32},
    "java": {"concurrency": 1, "active": 0, "waiting": 0, "max_queue": 2, "memory_limit": "320m", "javac_max_heap": "144m", "java_max_heap": "96m", "pids_limit": 48}
  }
}
```

### 5.2 执行 C17 / Java 代码（标准接口 & 前端 `/api/local-runner` 兼容接口）
- **请求**：`POST /api/sandbox/execute` 或 `POST /api/local-runner`（需有效 JWT）
- **请求体**：
```json
{
  "language": "c",
  "code": "#include <stdio.h>\nint main(void) {\n    printf(\"Hello, LEARNVERSE!\\n\");\n    return 0;\n}\n",
  "stdin": ""
}
```
- **成功响应**（`200 OK`）：
```json
{
  "output": "Hello, LEARNVERSE!\n",
  "diagnostics": [],
  "execution_time_ms": 185,
  "sandbox_mode": "docker"
}
```
- **Java 全局单并发排队满载快速降级响应**（`429 Too Many Requests`）：
```json
{
  "output": "",
  "diagnostics": [
    {
      "severity": "error",
      "message": "云端 Java 沙盒当前排队已满（2C2G 节点防 OOM 单并发保护中）。请稍候几秒重试，或在 Windows 本地运行「安装并启动实验室.cmd」流畅跑大题。"
    }
  ],
  "sandbox_mode": "docker"
}
```
