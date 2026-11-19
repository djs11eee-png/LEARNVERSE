# 交接单 · Lab 与 Workspace

基线提交：`a285f02 chore: baseline snapshot before visual redesign`
（`vending/`、`.codex-remote-attachments/` 已通过 `.git/info/exclude` 排除，不进仓库）

状态：**仅完成阅读与结构分析，未改任何代码。**

---

## 1. 两个页面的结构与职责

### 1.1 `src/pages/Lab.tsx`（13.6 KB）

职责：站内"实验台"——自由练习、算法单步演示、每日自测发卡。不涉及外部跳转（C/Java 除外，见 §4）。

挂载点：`App.tsx` 的 lazy 路由 `/lab` → `import('./pages/Lab').then(m => ({ default: m.Lab }))`，渲染在 `.site-main` 内、`.app-frame` 内部（带 37px 圆角的外壳里）。

四个子组件 + 一个外壳：

| 区块 | 组件 | 状态 | 要点 |
|---|---|---|---|
| 页面头 | `Lab()` 内联 | 无 | `.lab-intro` 纯 CSS 轨道装饰（3 个 `<i>`），`#lab-code` 锚点跳转按钮 |
| 补给包条 | `Lab()` 内联 | `station.pending` | 有包 → `button.button.button-light` 调 `station.showPack`；无包 → `Link.button` 到 `/my-universe` |
| 自由练习 | `FreePractice` | `language`（6 种：python / javascript / sql / html / c / java） | `CodeWorkbench` 实例 **#1**，`draftKey="lab/free"`，`stdin` 仅 python 传 `''`；`<details class="lab-setup">` 讲本机安装 |
| 算法演示 | `AlgorithmBench` | `algorithm` / `input[]` / `target` / `step` / `playing` | `useMemo` 生成 frames；660 ms `setTimeout` 自动步进；`.lab-chart` 每列 `height: value%`，`data-active / confirmed / removed`；`.lab-timeline` 是原生 `input[type=range]`；`.lab-controls` 四键。右侧 `CodeWorkbench` 实例 **#2**，`draftKey="lab/{algorithm}"`、`language="javascript"` |
| 自测 | `KnowledgeCheck` | `index` / `choice` / `checked` / `correct` | 全对 → `earnDaily()` → `station.showPack(key)`；`earned` 由 `station.earned.includes(dailyKey())` 决定 |
| 实战练习 | `Lab()` 内联 | 无 | `projects` 的 `<details>` 手风琴 |

末尾必须保留 `{station.stage}`（拆卡舞台，fixed 覆盖层，页面级挂载）。

### 1.2 `src/pages/Workspace.tsx`（16.1 KB）

职责：站内课程阅读 + 可运行练习 + 章节答题 + 进度持久化。整个"不跳外链"承诺的核心载体。

挂载点：`App.tsx` 两条路由 —— `/academy/:courseId/learn` 与 `/academy/:courseId/lesson/:lessonId`，同样是 lazy，同样在 `.app-frame` 内。**注意它自带一套 `.workspace-header`，于是当前是双 header 叠加。**

职责分层：

| 层 | 职责 | 关键实现 |
|---|---|---|
| 持久化 | 章节完成记录 | `readRecord()` / `useLessonRecord()`：`localStorage['learnverse.workspace.v1.' + courseId]` 存 `{ completed[], lastLesson }`；防御性校验（过滤非字符串、过滤不存在的 lesson id、去重）；监听 `storage` 事件跨标签同步；写入经 `navigator.locks.request` 串行化，失败则回退内存态并置 `storageError` |
| 路由态 | 课程/章节解析 | `Workspace` 按 `courseId` 查 `workspaceCourses`，未命中 → `.workspace-empty`；命中 → `<CourseWorkspace key={course.id}>`（换课时靠 key 重置 state） |
| 编排 | 三个副作用 + 重定向 | 进课 → `startCourse`；进章 → 写 `lastLesson`；全章完成 → `completeCourse`。`!lessonId` 时 `<Navigate replace>` 到 `lastLesson` → 首个未完成章 → `lessons[0]` |
| 外壳 | 侧栏 + 主区 | `.workspace-particles`（装饰）+ `.workspace-header`（返回 / 品牌 / N/M 章）+ `.workspace-layout`（`.workspace-sidebar` 带自绘 `role="progressbar"` 的章节 `<ol>` + `.workspace-main`） |
| 内容 | `Lesson` 装配 | 三个数据源拼装：`getLessonExpansion()` + `corePrimers[courseId] ?? nativePrimers[courseId]` + `getChapterExercise()`。渲染顺序：eyebrow → h1 → lead → 大白话 primer → 学习目标 + `<details>本章目录`（锚点导航）→ 正文 sections（含 `CodeSample`）→ `lesson.demo` → 易错点 → 动手练习（含 `CodeWorkbench` 实例 + 折叠参考答案）→ 章节练习（fieldset 单选 + 逐题反馈）→ 上一章/下一章 |
| 交互原语 | `CodeSample` | 剪贴板写入失败 → 降级为 `document.createRange` 选中并给中文提示 |

进度完成链路：`submit()` 里 `answered && correct` → `onComplete()` → 父层 `update()` 写盘 + `earnLesson(courseId, lessonId)` → 若该章此前未完成则 `station.showPack(key)`。

---

## 2. 改造要动哪些地方

### 2.1 路由 / 外壳层（`App.tsx`）

- **双 header 必须解决**。Workspace 的 `.workspace-header` 与 `.site-header` 同时出现。两条路线选一：
  - 沉浸式：对 `/academy/:courseId/lesson/*` 弱化或隐藏 `.site-header`（需要在 `.app-frame` 上加 `data-immersive` 之类），Workspace 自己承担导航；
  - 面包屑化：删掉 `.workspace-header` 的品牌段，把返回/进度并进 `.site-header` 的第二行。
  两条都不能破坏：`#main-content` 的 `tabIndex={-1}` 焦点复位、路由切换 `window.scrollTo(0,0)`、`Escape` 关菜单逻辑。
- 导出名与文件路径**不能动**（`Lab` / `Workspace` 是 `.then(m => ({default: m.Lab}))` 形式的具名导出）。
- 若给 Lab 做 HTML-in-Canvas 入口，新增的 scene 必须走和 `SpaceField.tsx` 相同的 `IntersectionObserver` + `lazy import()` 门控。

### 2.2 Lab 页面

1. **纵向节奏缺失**：`.lab-page` 直接堆叠，没有和 `home.css` 的 `.home-section`（顶距 64px）/ `.home-more`（`clamp(24px,5vw,78px)`）对齐的栅格。改造要建立统一的 section rhythm，否则新视觉进来会和首页不在一个系统里。
2. **`.lab-intro` 是纯 CSS 装饰**：三个 `<i>` 轨道无 JS、无 WebGL。这是 HTML-in-Canvas 最自然的落点（把实验台入口做成 canvas 内的一台"仪器"），但必须保留 `h1 > em` 的"实验室"强调结构、`lang="en"` 的 `LAB` kicker、以及 `#lab-code` 锚点。
3. **两个 CodeWorkbench 不能合稿**：`lab/free` 与 `lab/{algorithm}` 是两个 draft key。任何"统一成一个大编辑器"的想法都会串稿；要合并必须先给出 key 迁移方案。
4. **图表语义先于视觉**：`.lab-chart` 用 `height: value%` 把 10–99 映射成百分比（并非真实比例），外层是 `role="img"` + `aria-label="数组当前值为 ..."`。做电影级柱状动画时，可视图层可以换成 canvas/SVG，但 `role="img"` 描述与 `data-active/confirmed/removed` 的语义信息必须原样保留（可迁移为 `aria-*` 或屏幕阅读器专用文本）。
5. **`.lab-timeline` 是原生 range**：样式全在 CSS。可换成自绘刻度轨，但 `aria-valuetext="第 N 步，共 M 步"` 与键盘行为必须保住。
6. `station.stage` 保持在 `.lab-page` 末尾，不嵌入任何滚动容器（否则 fixed 定位失效）。
7. `.lab-supply` 复用了全局 `.button` / `.button-light`（`global.css`）。改全局按钮会同时影响首页、图鉴、Lab —— 要么统一升级 `.button`，要么在 Lab 收窄为局部 class。

### 2.3 Workspace 页面

1. **侧栏形态**：`.workspace-sidebar` 目前是常驻 `<aside>` + 自绘 progressbar。移动端如何处理需先读 `workspace.css`（未读）。改造目标：桌面 sticky、移动端抽屉或顶部下拉，且 `aria-current="step"` 不能丢。
2. **阅读宽度**：`.workspace-article` 是长文流，`h1.workspace-title` / `.workspace-lead` 是最大字号落点。引入拆卡式"卡片化"时正文列要锁在约 66ch，否则中文长段落可读性直接崩。
3. **可运行练习是硬约束**：`draftKey={`${course.id}/${lesson.id}`}` 与 `expectedOutput`（驱动"输出与预期一致/不同"比对 UI）必须保留。`exercise.language` 决定是否走 `localRunner`。
4. **答题状态机**：`fieldset` + 原生 radio + `submitted` + `answers` 记录。可以重绘视觉，不能改成 div 点击；`disabled={checked}` 的 fieldset 语义（Lab 的 `KnowledgeCheck` 也有）保留。
5. 三个数据源（expansion / primer / exercise）任一为空都要正常渲染 —— 现有代码已经全部用可选链处理，新布局不能假设它们存在。
6. `station.stage` 同样挂在 `.workspace` 末尾。

### 2.4 样式层（改造主战场）

- 两套并行的按钮系统：全局 `.button`（`global.css`）vs 局部 `.workspace-button`。这是视觉不统一的根源之一，需要收敛出单一 primitive。
- `src/pages/lab.css`（11.2 KB）与 `src/pages/workspace.css`（16.7 KB）**尚未读**。§2.2 / §2.3 的样式结论是从 class 用法反推的，动手前必须先读这两个文件。
- 设计 token 已在 `global.css` 的 `:root`：`--ink #f2f4f3`、`--muted #a9b0ba`、`--accent #d5edb9`、`--line`、`--surface #0c1119`、`--bg #06090f`、`--ease-ui`、`--ease-enter`、`--motion-fast 160ms`、`--gutter-mobile 14px`。新样式只允许扩展这套，不允许另起一套调色。

### 2.5 不该动的地方

- `src/data/*`（`workspaceCourses` 47 KB、`expansions` 67 KB、`primers`、`lab.ts`、`resources.ts`）：纯内容，视觉改造零改动。
- `state/progress.tsx` 的存储格式；`Workspace` 的 `learnverse.workspace.v1.` 前缀；`CodeWorkbench` 的 `learnverse:code-draft:{lang}:{key}`。
- `src/code/*`（runner / worker / pyodide / sql.js / preview）：执行引擎，与视觉无关。

---

## 3. 依赖关系

```
App.tsx (lazy)
├── pages/Lab.tsx
│   ├── data/lab.ts            algorithms · projects · questions · traceBubbleSort · traceBinarySearch
│   ├── components/ThemeSelect.tsx (×3, compact)
│   ├── components/CodeWorkbench.tsx (×2)
│   │   ├── code/localRunner.ts   isNativeLanguage · checkNativeRunner · runWithNativeSupport
│   │   ├── code/runner.ts        RunLanguage · RunResult · Diagnostic
│   │   └── components/code-workbench.css
│   ├── cards/rewards.ts       earnDaily · dailyKey
│   ├── cards/usePackStation.tsx (autoOffer=true)
│   │   └── cards/HoloBoosterPack.tsx (lazy) + holo-booster.css
│   ├── cards/vault.css        (Lab 直接 import，为了拆卡舞台样式)
│   └── pages/lab.css
└── pages/Workspace.tsx
    ├── data/workspaceCourses.ts   WorkspaceCourse · WorkspaceLesson
    ├── data/expansions/index.ts   getLessonExpansion
    ├── data/primers/{core,native}.ts
    ├── code/exercises.ts          getChapterExercise
    ├── components/CodeWorkbench.tsx
    ├── pages/WorkspaceDemo.tsx
    ├── state/progress.tsx         startCourse · completeCourse · useProgress
    ├── cards/rewards.ts           earnLesson
    ├── cards/usePackStation.tsx (autoOffer=false)
    └── pages/workspace.css
```

共享上游：`state/progress`（`learnverse.learning-progress.v1`）、`cards/*` 的 `--h-*` 变量契约、`global.css` 的 `.button`。
共享下游：`App.tsx` 的 lazy 具名导出（改导出名即断路由）；`tests/*.mjs`（**未读**，重命名前必读）。

---

## 4. 前 75 步已确认的约束

1. **站内闭环是铁的**：课程学习、代码编写、运行、AI 辅导全部在站内完成。唯一例外是 Lab 里 C / Java 的"本机实验室"（`安装并启动实验室.cmd` + `scripts/local-lab.mjs` + `127.0.0.1`），这个例外本身要保留。首页 `source-strip` 的 `target="_blank"` 是"外部阅读"，与闭环不冲突，保持原样。
2. **性能预算真实存在**：`pyodide 314`、`three 0.187`、`sql.js` 都是重依赖。现有门控手段：`React.lazy` + `<Suspense>`、`IntersectionObserver` 后才 `import()`、JS 侧 `(min-width: 800px) and (prefers-reduced-motion: no-preference)`、`document.hidden` 暂停、WebGL 不可用/context lost 降级 CSS 或 2D canvas。HTML-in-Canvas 必须沿用同一套门控，不得无条件挂载 WebGL。
3. **动效只有一个范式**：全部是手写 rAF 弹簧/指数积分器 —— `useHoloMotion` 的 `1 - exp(-dt*10)`、`NavPill` 的 380/30 双积分、`useHeroMotion` 的 spring blend（`1 - exp(-dt/82)`）、`AlgorithmBench` 的 660 ms setTimeout。没有引入动画库。新动画要么复用这套积分器，要么整体替换，**不允许同一交互面上混两套**。
4. **拆卡视觉的接缝是 CSS 变量契约**：`--h-rx / --h-ry / --h-turn / --h-gain / --h-shift-x / --h-shift-y` + `HoloPrint` 的 `--plate-pearl/light/mid/shade/dark` + `.lv-plate` class + `data-series={galaxy}`。扩展只能加法，不能新起并行的变量体系。
5. **图鉴的承重结构**：owned tile 是 `<button>`（`station.inspect`），locked tile 是 `<Link>`（跳课时）；`--vault-origin-x/y` 从 tile 的 `getBoundingClientRect()` 写入，作为放大动画的"起点从哪来"。这两条不能简化成统一点击。
6. **四个存储 key 的格式不可变**：
   - `learnverse.learning-progress.v1`（`state/progress`，含跨标签 `storage` 同步 + `navigator.locks` + 存储不可用回退）
   - `learnverse.workspace.v1.{courseId}`（`Workspace`）
   - `learnverse:code-draft:{language}:{draftKey}`（`CodeWorkbench`）
   - `learnverse:intro-seen`（sessionStorage，开场）
7. **断点体系**：JS 侧 `min-width: 800px`；CSS 侧 `1150 / 980 / 799 / 510`；`--gutter-mobile: 14px`；510px 以下触控目标 44px（Lab 的 `.lab-icon-button`、Workspace 的章节链接都要按这个复核）。
8. **无障碍基线不可退让**：`role="img"` + `aria-label` 的图表描述、`aria-valuetext` 的进度语义、`role="status"` 播报、存储失败用 `role="alert"`、`fieldset disabled`、`aria-current="step|page"`、`sr-only` 快捷键提示（`Ctrl/⌘ + Enter`）、`.skip-link`。
9. **构建与测试**：`npm run build` = `tsc --noEmit && vite build`；`tsconfig` 是 `strict` + `verbatimModuleSyntax`（type-only import 必须写 `import type`）+ `moduleResolution: Bundler`。测试用 `node --test`（`tests/runner.test.mjs`、`tests/site.test.mjs`），另有 Playwright 1.65 产物目录（git 已忽略）。
10. **备份已就位**：`a285f02` 是改造前基线，任何时候可 `git diff a285f02` 或 `git restore`。除用户明确要求，不再新增提交。
11. **文案与语言**：简体中文优先，`lang="zh-CN"`，`brand.tagline = '从编程到人工智能，按路线学习，用实验巩固。'`，`wordmark = LEARNVERSE`。

---

## 5. 未读 / 动手前必须先确认

| 文件 | 为何重要 |
|---|---|
| `src/pages/lab.css`（11.2 KB） | §2.2 全部样式结论都是反推的 |
| `src/pages/workspace.css`（16.7 KB） | 同上，且侧栏移动端策略未知 |
| `tests/runner.test.mjs`、`tests/site.test.mjs` | 可能断言文件内容/导出名，重命名前必读 |
| `src/pages/learning.css`（20.7 KB） | 学院/资源库/我的宇宙共用，改造会波及 |
| `src/cards/HoloBoosterPack.tsx`（23.7 KB）+ `holo-booster.css`（22.2 KB） | 拆卡主舞台，`station.stage` 的真身 |
| `src/cards/catalog.ts`（33.9 KB） | 卡片内容源，`--plate-*` 调色的事实来源 |
| `src/data/lab.ts`（5.8 KB） | `traceBubbleSort` / `traceBinarySearch` 的 frame 结构 |
| `src/code/runner.ts` / `localRunner.ts` | `RunResult` / `Diagnostic` 形状，决定诊断 UI 能做什么 |
| `src/pages/WorkspaceDemo.tsx` | `lesson.demo` 的渲染器，正文流里的一个未知插槽 |
| `src/components/spaceScene.ts`（7.5 KB） | 现有 WebGL scene 的唯一实现，HTML-in-Canvas 要对齐的范本 |
