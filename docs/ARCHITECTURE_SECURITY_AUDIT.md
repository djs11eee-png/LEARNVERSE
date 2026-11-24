# LEARNVERSE 2C2G 峰值并发内存预算与容器安全自审报告

## 一、2 vCPU / 2 GiB RAM（2048 MiB）峰值并发内存边界核算

在 `2 vCPU / 2 GiB RAM / 40 GiB ESSD` 的 Ubuntu 22.04 云主机上，任何未受控的 JVM 并发启动、Argon2 并发哈希或 SQLite 缓存膨胀都会直接触发 Linux 内核 `oom-killer`。本架构通过**全链路硬上限与信号量削峰**将整机极限峰值内存控制在 **1,247 MiB** 以内：

| 组件层 | 并发度 / 进程模型 | 硬限制参数与调优策略 | 极限峰值内存 (MiB) |
| :--- | :--- | :--- | ---: |
| Ubuntu 22.04 内核 + systemd + Docker 守护进程 | 常驻系统服务 | 关闭无关 snap 服务，内核预留 | ~380 MiB |
| Nginx 反向代理与静态资源托管 | 2 Workers | `client_max_body_size 256k; proxy_buffering off (SSE)` | ~30 MiB |
| Redis 7（验证码 TTL + 滑动窗口限流） | 单线程常驻 | `--maxmemory 96mb --maxmemory-policy allkeys-lru --save ""` | ~105 MiB |
| FastAPI / Uvicorn + Argon2id 哈希池 | 2 Workers (`--limit-concurrency 120`) | `ARGON2_MEMORY_COST_KIB=19456` + `asyncio.Semaphore(2)`（哈希峰值仅 $2 \times 19\text{ MiB} = 38\text{ MiB}$） | ~180 MiB |
| SQLite WAL 统一数据库 | WAL 模式 + 写锁串行化 | `PRAGMA journal_mode=WAL; PRAGMA cache_size=-16000`（单连接缓存上限 ~16 MiB） | ~40 MiB |
| **C 语言微沙盒容器池**（Alpine + GCC） | `c_semaphore = 2`（最多 2 并发） | `--memory=96m --memory-swap=96m --pids-limit=32` | $2 \times 96 = 192\text{ MiB}$ |
| **Java 微沙盒容器**（Alpine + OpenJDK 21） | **`java_semaphore = 1`（全局严格单并发）** | `--memory=320m --memory-swap=320m` + `javac -J-Xmx144m` + `java -Xmx96m -XX:+UseSerialGC -XX:TieredStopAtLevel=1` | $1 \times 320 = 320\text{ MiB}$ |
| **整机满载峰值合计** | — | **剩余 ~801 MiB（39.1%）内核与页缓存安全裕量** | **1,247 MiB / 2,048 MiB** |

> **为什么 Java 必须采用 `-XX:+UseSerialGC -XX:TieredStopAtLevel=1` 与 `semaphore = 1`？**  
> 默认 OpenJDK 在 2 vCPU 下会启用 G1GC 与 C2 JIT 编译线程，仅 Metaspace + CodeCache + GC 线程栈就会额外吞噬 180~250 MiB 原生内存。启用 `SerialGC` 并关闭 C2 编译（`TieredStopAtLevel=1`）不仅将单次冷启动耗时缩短 40%，还将 JVM 原生内存开销压降至最低；配合全局 `semaphore = 1` 与有界排队（`max_queue = 2`，超限立即返回本地 Windows 实验室降级指引），彻底消除多人同时点击运行 Java 导致 2G 主机死机的可能。

---

## 二、核心安全漏洞自我审查清单

### 1. SQL 注入防御（SQL Injection）
- **审查结论**：`backend/app/db.py`、`sync_service.py`、`discussion_service.py`、`ai_service.py`、`auth.py` 100% 采用 `?` 参数化占位符绑定，不存在任何将用户输入拼接到 SQL 语句的代码路径。
- **验证测试**：`test_xss_zero_width_keyword_filter_and_sql_injection_defense` 注入 `"'); DROP TABLE posts; --"`，验证表结构毫发无损且按字面文本安全落盘。

### 2. XSS 存储与内容过滤（Stored XSS & Evasion）
- **审查结论**：
  - 讨论区输入在入库前先经 `ZERO_WIDTH_RE` 剥离控制字符与零宽字符（`\u200b-\u200f`, `\ufeff`），再经 `unicodedata.normalize("NFKC")` 归一化识别全角变体，拦截 `<script`、`<iframe>`、`<svg`、`javascript:`、`data:text/html`、`onerror=`/`onload=` 等事件载荷与违规关键词。
  - 所有 JSON / SSE 响应强制附加 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`，前端 React 组件使用纯文本节点 `{post.body}` 渲染（无 `dangerouslySetInnerHTML`）。

### 3. JWT、密码学与防枚举/防重放安全（Authentication & Cryptography）
- **审查结论**：
  - **防 `alg: none` 与算法混淆**：`decode_and_verify_jwt` 显式校验 `header.get("alg") == "HS256"`，并使用恒定时间 `hmac.compare_digest` 比对签名，强制校验 `iss`、`aud`、`exp`、`nbf`、`sub`、`jti`。
  - **防用户枚举时序攻击**：登录时若账号/邮箱不存在，`PasswordHasherService.verify_password` 依然对预生成的 `_dummy_hash` 执行完整的 Argon2id/scrypt 计算，使“用户不存在”与“密码错误”响应耗时分布一致。
  - **图形验证码防重放**：Redis `GETDEL` 原子读取并删除，任何验证码仅可消费一次。
  - **Cookie CSRF 防护**：当使用 `HttpOnly` Cookie 认证且请求方法非 `GET/HEAD/OPTIONS` 时，`get_optional_user` 强制执行 `verify_same_origin` 校验 `Origin` 与 `Host`。

### 4. Lazy Auth 重复同步刷包漏洞防御（Anti-Pack-Farming）
- **审查结论**：
  - `user_vault_packs(user_id, pack_key)` 采用主键约束 + **一次写入不可变锁（Write-Once Immutable Latch）**。
  - 客户端上报的 `earned` 章节卡包必须与服务端已合并的 `completed` 章节交叉核验；未完成章节或未来日期补给包直接拒绝。
  - 已开启的卡包绝不允许后续同步请求覆盖或并集叠加新卡，且 `owned` 卡片集合完全由服务端已开启卡包记录实时派生，彻底封死通过清除本地缓存或重放同步接口刷取全图鉴的漏洞。

### 5. 路径穿越、容器逃逸与僵尸容器清理（Sandbox Escape & Zombie Reaping）
- **审查结论**：
  - **零宿主机代码执行**：绝不在宿主机直接调用 `gcc` / `javac` / `java`。
  - **防路径穿越**：宿主机临时作业目录通过 `tempfile.mkdtemp(prefix="lv-job-")` 创建后，强制使用 `os.path.realpath` 校验其父目录严格等于 `realpath(sandbox_temp_root)`；Java 类名严格匹配 `^[A-Za-z_$][A-Za-z0-9_$]{0,63}$` 并禁止 `package` 声明；源文件目录以**只读模式（`-v {job_dir}:/input:ro`）**挂载进容器，容器无法向宿主机磁盘写入任何字节。
  - **内核级容器加固**：强制启用 `--network=none`（断网）、`--read-only`（只读根文件系统）、`--cap-drop=ALL`（剥离全部 Linux Capability）、`--security-opt=no-new-privileges:true`、`--user=65534:65534`（非特权用户）、`--pids-limit`（防 Fork 炸弹）、`--memory` 与 `--memory-swap` 相等（禁用 Swap 抖动）、`--oom-score-adj=500`、`--ulimit nofile=64:64`、`--ulimit fsize=4194304:4194304`。
  - **死循环强杀与零僵尸容器**：容器内使用 `timeout -s KILL` 进行第一层强杀；宿主机 `DockerCliExecutor` 使用 `asyncio.wait_for` 进行第二层硬超时监控，一旦超时或连接中断，在 `finally` 块中无条件执行 `docker rm -f -v lv-sbx-...` 并清理宿主机临时目录；应用启动与关闭生命周期钩子额外运行 `reap_orphan_containers()` 清理任何历史残留的 `lv-sbx-*` 容器。
