import type { AdvancedTrack } from '../types'
import { checked, examples, html, lesson, page, run } from './webGuide'
import type { StudyCase } from './webGuide'

const catalog = `const catalog = {
  html: { title: "HTML 结构", slots: ["H-1", "H-2"] },
  js: { title: "JavaScript 实战", slots: ["J-1"] },
  css: { title: "CSS 样式", slots: [] },
};
function initialState() {
  return { course: null, ticket: 0, phase: "idle", slots: [], pending: null, booking: null, message: "请选择课程" };
}`

const reservationReducer = `function update(state, action) {
  if (action.type === "load") {
    if (!Object.hasOwn(catalog, action.course)) return { ...state, message: "未知课程" };
    return { ...state, course: action.course, ticket: state.ticket + 1, phase: "loading", slots: [], pending: null, message: "正在加载" };
  }
  if (action.type === "reply") {
    if (state.phase !== "loading" || action.ticket !== state.ticket) return state;
    if (!action.ok) return { ...state, phase: "error", message: "加载失败，可重试" };
    const bookedSlot = state.booking?.course === state.course ? state.booking.slot : null;
    const slots = catalog[state.course].slots.filter(slot => slot !== bookedSlot);
    return { ...state, phase: "ready", slots, message: slots.length ? "时段已加载" : "当前无可预约时段" };
  }
  if (action.type === "open") {
    if (state.phase !== "ready" || !state.slots.includes(action.slot) || state.booking) {
      return { ...state, message: state.booking ? "已经有一条预约" : "该时段不可预约" };
    }
    return { ...state, pending: action.slot, message: "请确认预约" };
  }
  if (action.type === "cancel") {
    return state.pending === null ? state : { ...state, pending: null, message: "已取消，未预约" };
  }
  if (action.type === "confirm") {
    if (state.pending === null || state.booking) return state;
    return {
      ...state,
      slots: state.slots.filter(slot => slot !== state.pending),
      pending: null,
      booking: { course: state.course, slot: state.pending },
      message: "预约成功：" + state.pending,
    };
  }
  return state;
}`

const reservationStarter = `function update(state, action) {
  // TODO 依次完成 load、reply、open、cancel 和 confirm。
  return state;
}`

const reservationHarness = `
function solve(actions) {
  let state = initialState();
  return actions.map(action => {
    state = update(state, action);
    return [state.phase, state.course, state.slots, state.pending, state.booking?.slot ?? null, state.message];
  });
}`

const reservationCases: StudyCase[] = [
  {
    label: '后选课程优先并完成预约',
    input: [[{ type: 'load', course: 'html' }, { type: 'load', course: 'js' }, { type: 'reply', ticket: 2, ok: true }, { type: 'reply', ticket: 1, ok: true }, { type: 'open', slot: 'J-1' }, { type: 'confirm' }, { type: 'confirm' }]],
    expected: [
      ['loading', 'html', [], null, null, '正在加载'],
      ['loading', 'js', [], null, null, '正在加载'],
      ['ready', 'js', ['J-1'], null, null, '时段已加载'],
      ['ready', 'js', ['J-1'], null, null, '时段已加载'],
      ['ready', 'js', ['J-1'], 'J-1', null, '请确认预约'],
      ['ready', 'js', [], null, 'J-1', '预约成功：J-1'],
      ['ready', 'js', [], null, 'J-1', '预约成功：J-1'],
    ],
  },
  {
    label: '取消确认保留可选时段',
    input: [[{ type: 'load', course: 'html' }, { type: 'reply', ticket: 1, ok: true }, { type: 'open', slot: 'H-1' }, { type: 'cancel' }]],
    expected: [
      ['loading', 'html', [], null, null, '正在加载'],
      ['ready', 'html', ['H-1', 'H-2'], null, null, '时段已加载'],
      ['ready', 'html', ['H-1', 'H-2'], 'H-1', null, '请确认预约'],
      ['ready', 'html', ['H-1', 'H-2'], null, null, '已取消，未预约'],
    ],
  },
  {
    label: '已知课程暂时无时段',
    input: [[{ type: 'load', course: 'css' }, { type: 'reply', ticket: 1, ok: true }]],
    expected: [['loading', 'css', [], null, null, '正在加载'], ['ready', 'css', [], null, null, '当前无可预约时段']],
  },
  {
    label: '未知课程与加载失败',
    input: [[{ type: 'load', course: '未知' }, { type: 'load', course: 'js' }, { type: 'reply', ticket: 1, ok: false }, { type: 'open', slot: 'J-1' }]],
    expected: [
      ['idle', null, [], null, null, '未知课程'],
      ['loading', 'js', [], null, null, '正在加载'],
      ['error', 'js', [], null, null, '加载失败，可重试'],
      ['error', 'js', [], null, null, '该时段不可预约'],
    ],
  },
]

function reservationPage(reducer: string) {
  return page('课程预约面板', `    <label for="course">选择课程</label>
    <select id="course">
      <option value="html">HTML 结构</option>
      <option value="js">JavaScript 实战</option>
      <option value="css">CSS 样式</option>
    </select>
    <button id="load" type="button">加载时段</button>
    <h2>模拟回复</h2>
    <p>先发起一项或多项加载，再选择让哪一份回复先到达。</p>
    <ul id="responses" aria-label="待送达的回复"></ul>
    <h2 id="slot-heading">可预约时段</h2>
    <ul id="slot-list" aria-labelledby="slot-heading"></ul>
    <p id="reservation-summary">尚未预约</p>
    <p id="feedback" role="status">请选择课程</p>
    <dialog id="reservation-dialog" aria-labelledby="dialog-title" aria-describedby="dialog-detail">
      <h2 id="dialog-title">确认课程预约</h2>
      <p id="dialog-detail"></p>
      <button id="dialog-cancel" type="button">取消</button>
      <button id="dialog-confirm" type="button">确认预约</button>
    </dialog>`, `${catalog}
${reducer}

let state = initialState();
let renderedSlots;
const responses = new Map();
const course = document.querySelector("#course");
const load = document.querySelector("#load");
const responseList = document.querySelector("#responses");
const slotList = document.querySelector("#slot-list");
const slotHeading = document.querySelector("#slot-heading");
const feedback = document.querySelector("#feedback");
const summary = document.querySelector("#reservation-summary");
const dialog = document.querySelector("#reservation-dialog");
const detail = document.querySelector("#dialog-detail");
const cancel = document.querySelector("#dialog-cancel");
const confirm = document.querySelector("#dialog-confirm");

function findSlotButton(slot) {
  return Array.from(slotList.querySelectorAll("button")).find(button => button.dataset.slot === slot);
}

function render() {
  if (renderedSlots !== state.slots) {
    renderedSlots = state.slots;
    const rows = state.slots.map(slot => {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.slot = slot;
      button.textContent = "预约 " + slot;
      row.append(button);
      return row;
    });
    slotList.replaceChildren(...rows);
  }
  for (const button of slotList.querySelectorAll("button")) button.disabled = state.booking !== null;
  slotHeading.textContent = state.course === null ? "可预约时段" : catalog[state.course].title + "的可预约时段";
  feedback.textContent = state.message;
  summary.textContent = state.booking ? "已预约：" + catalog[state.booking.course].title + " · " + state.booking.slot : "尚未预约";
  if (state.pending !== null && !dialog.open) {
    detail.textContent = catalog[state.course].title + "时段 " + state.pending;
    dialog.showModal();
    cancel.focus();
  }
}

function dispatch(action) {
  const next = update(state, action);
  if (next === state) return;
  state = next;
  render();
}

function finishDialog(type) {
  const slot = state.pending;
  dispatch({ type });
  if (state.pending !== null) return;
  dialog.close();
  const opener = findSlotButton(slot);
  (opener && !opener.disabled ? opener : load).focus();
}

function enqueueReply(ticket, selectedCourse) {
  let deliver;
  const service = new Promise(resolve => { deliver = resolve; });
  const row = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.reply = ticket;
  button.textContent = "送达 " + catalog[selectedCourse].title + "（请求 " + ticket + "）";
  row.append(button);
  responseList.append(row);
  responses.set(ticket, { deliver, row });
  service.then(ok => dispatch({ type: "reply", ticket, ok }));
}

load.addEventListener("click", () => {
  const before = state.ticket;
  const selectedCourse = course.value;
  dispatch({ type: "load", course: selectedCourse });
  if (state.ticket !== before) enqueueReply(state.ticket, selectedCourse);
});
responseList.addEventListener("click", event => {
  const button = event.target.closest("button[data-reply]");
  if (!button) return;
  const ticket = Number(button.dataset.reply);
  const response = responses.get(ticket);
  if (!response) return;
  responses.delete(ticket);
  response.row.remove();
  response.deliver(true);
  (responseList.querySelector("button") || load).focus();
});
slotList.addEventListener("click", event => {
  const button = event.target.closest("button[data-slot]");
  if (button) dispatch({ type: "open", slot: button.dataset.slot });
});
confirm.addEventListener("click", () => finishDialog("confirm"));
cancel.addEventListener("click", () => finishDialog("cancel"));
dialog.addEventListener("cancel", event => {
  event.preventDefault();
  finishDialog("cancel");
});
render();`)
}

const reservationProject: AdvancedTrack['project'] = {
  title: '课程预约面板',
  summary: '做一个可用键盘操作的课程预约页面。使用固定数据模拟回复顺序，过期回复不能覆盖当前课程。',
  requirements: [
    '完成共享的 update(state, action)。站内纯 JavaScript 验收按列表回放动作，每步输出 [阶段, 课程, 可约列表, 待确认时段, 已预约时段, 提示]。',
    'load 为已知课程递增票号并进入 loading。reply 仅在票号是当前值且阶段为 loading 时接收。成功列出固定时段，空列表有提示；失败显示可重试。',
    'open 仅允许在就绪阶段选择可用时段。cancel 保留原有时段；confirm 确认一条预约、移除该时段，页面只保留一条预约，重复确认不写入。',
    '先检查站内静态预览里的带标签选择、列表和反馈，再下载编辑的 HTML。先加载 HTML 结构，再切到 JavaScript 实战并加载。用模拟回复按钮先送达 JavaScript、再送达 HTML，列表继续显示 J-1。',
    '用 Tab 到「预约 J-1」，用 Enter 打开确认框。初始焦点在「取消」。按 Escape 应关闭且焦点回到「预约 J-1」，没有写预约。再次打开并 Tab 到「确认预约」，按 Enter 完成，焦点回到「加载时段」且状态显示成功。',
  ],
  examples: [
    { label: '后选课程优先并完成预约', input: '先加载 HTML，再加载 JavaScript；先送达第 2 份，然后送达第 1 份，再预约 J-1。', expected: '时段列表保持 JavaScript 的 J-1。确认后反馈「预约成功：J-1」，再次确认不产生第二条。' },
    { label: '取消确认保留原数据', input: '加载 HTML，打开 H-1 确认框后按 Escape。', expected: '焦点回到 H-1 按钮，显示「已取消，未预约」，两个时段继续可选。' },
    { label: '已知课程无时段', input: '加载 CSS 样式并送达回复。', expected: '反馈「当前无可预约时段」，没有可选按钮。' },
    { label: '未知课程与加载失败', input: '向纯状态函数传未知课程，或对当期请求送达 ok: false。', expected: '分别提示「未知课程」与「加载失败，可重试」，都不会新增预约。' },
  ],
  exercises: [
    { title: '用浏览器核对预约和键盘交互', language: 'html', starter: reservationPage(reservationStarter), solution: reservationPage(reservationReducer), downloadName: 'course-reservation.html' },
    { title: '在站内核对预约状态', ...checked(catalog + '\n' + reservationStarter + reservationHarness, catalog + '\n' + reservationReducer + reservationHarness, reservationCases) },
  ],
  explanation: '界面与站内测试共用状态更新条件。每条 Promise 回复携带发起时的编号，送达按钮让乱序可以手动复现。模态关闭时回到仍存在且可用的原按钮，成功预约移走原按钮时回到继续加载的入口。',
}

const buttonDialog = page('确认学习预约', `    <button id="open" type="button">打开确认框</button>
    <p id="status" role="status">尚未操作</p>
    <dialog id="check" aria-labelledby="label" aria-describedby="details">
      <h2 id="label">确认预约</h2>
      <p id="details">保留这次学习时段吗？</p>
      <button id="leave" type="button">取消</button>
      <button id="confirm" type="button">确认</button>
    </dialog>`, `const opener = document.querySelector("#open");
const dialog = document.querySelector("#check");
const leave = document.querySelector("#leave");
const confirm = document.querySelector("#confirm");
const status = document.querySelector("#status");
opener.addEventListener("click", () => {
  dialog.showModal();
  leave.focus();
});
function finish(message) {
  dialog.close();
  status.textContent = message;
  opener.focus();
}
leave.addEventListener("click", () => finish("已取消"));
confirm.addEventListener("click", () => finish("已确认"));
dialog.addEventListener("cancel", event => {
  event.preventDefault();
  finish("已取消");
});`)

const viewLessons = [
  lesson({
    id: 'state-action-render', title: '从状态和动作得到可预测界面',
    summary: '明确状态、动作、更新与渲染的边界，并让同一动作序列得到同样结果。',
    primer: {
      lead: '界面可能同时有可约清单、当前选择、确认按钮。把这些控件背后的信息放进一个状态对象，再从它更新显示，更容易防止彼此矛盾。',
      terms: [['状态', '足以决定当前界面的一组数据'], ['动作', '说明刚刚发生了什么的记录'], ['更新函数', '根据旧状态和动作返回下一状态的函数'], ['渲染', '把状态翻译成可见内容与控件行为']],
    },
    objectives: ['用动作对象表达选择与取消。', '把是否可确认、提示等展示值从当前状态计算出来。'],
    sections: [
      run('先让状态脱离页面独立运行', [
        '假设只有两个可用时段。一种简单表示是 { slots, selected }：slots 保存候选项，selected 用 null 表示没有选中。点击按钮不应直接把标题里的文字从「未选择」改成某个 ID，而要产生 { type: "select", slot: "A" } 这样的动作。',
        'update 收到当前状态以及动作。如果类型为 select，先确认目标时段在可用清单中，再返回带新 selected 的对象。这里的 ...state 把第一层字段复制到新对象，再用后面的字段覆盖。非法选择返回同一个对象，页面可以识别没有更新。',
        '运行后把选择改成未知时段，看输出是否维持原来的选择。然后在开头打印 state.selected，核对旧状态仍可以用于重放测试。练习时先用常量模拟按钮传来的动作，再去写事件监听。',
      ], `function update(state, action) {
  if (action.type === "select" && state.slots.includes(action.slot)) {
    return { ...state, selected: action.slot };
  }
  return state;
}
const start = { slots: ["A", "B"], selected: null };
const picked = update(start, { type: "select", slot: "B" });
const skipped = update(picked, { type: "select", slot: "Z" });
console.log(String(start.selected));
console.log(String(picked.selected));
console.log(String(skipped === picked));`, 'null\nB\ntrue'),
      {
        heading: '从同一个状态推导文字和控件能力',
        paragraphs: [
          '如果对象里既保存 selected，又保存 canConfirm，两个字段可能彼此冲突。可以在 render 起始处用 selected !== null 推导 canConfirm，再据此设置按钮 disabled。提示文字也从 selected 判断。取消动作只需清除选中值，渲染会一并恢复显示。',
          '选中、等待确认和确认证实是不同活动。初始时 selected 为空，就不应该提供确认操作；选中后仍可反悔，取消也不修改时段列表。把这些条件写成可测试的规则，实际 DOM 只负责接收输入与展示。',
          '状态函数不读页面、不记录随机时间，也不直接改变输入。给定相同状态加相同动作，结果应相同。DOM 中何处获得焦点可以由渲染层处理，后面会通过对话框检查这种分工。',
        ],
      },
      run('用旧状态回放两条不同路径', [
        '实际界面的很多变更可以看作“取同一份初始状态，陆续送入动作”。为了比较，先执行选中 A、取消，再从同一初始值执行只选中 B。若 update 不修改传入对象，两个回放互不影响。',
        '选中重复的同一个时段时，第二次无需发生实际状态变化，但最终可确认状态仍为真。下例只驱动渲染模型，使用一个函数返回显示文案，让按钮是否能点也可在同一个模型里核对。',
        '运行后向第二组追加 cancel，核对最终两组文案相同。试着去掉 show 中的 null 判断，判断为何界面会出现「确认 null」。逐条验证展示规则，一般比从页面截图反猜状态容易。',
      ], `function update(state, event) {
  if (event.type === "cancel") return { ...state, selected: null };
  if (event.type === "select" && state.slots.includes(event.slot)) return { ...state, selected: event.slot };
  return state;
}
function show(state) {
  return state.selected === null ? "请选择时段" : "确认 " + state.selected;
}
const initial = { slots: ["A", "B"], selected: null };
const branchA = [{ type: "select", slot: "A" }, { type: "cancel" }];
const branchB = [{ type: "select", slot: "B" }];
console.log(show(branchA.reduce(update, initial)));
console.log(show(branchB.reduce(update, initial)));
console.log(show(initial));`, '请选择时段\n确认 B\n请选择时段'),
    ],
    pitfalls: [
      { mistake: '只改 DOM 文字，状态没有变', why: '后续重新渲染时文字和按钮状态可能互相矛盾。', fix: '先更新状态，再用新状态生成显示。' },
      { mistake: '另存一个可能与 selected 冲突的 canConfirm', why: '取消时可能忘记同步两个字段。', fix: '用当前 selected 派生是否允许确认。' },
    ],
    practice: {
      prompt: '实现 solve(slots, events)，从无选中项起回放选择与取消。仅当 select 目标在 slots 时更新。为每步返回 { selected, canConfirm }，忽略其他动作。',
      checkpoints: ['可用时段可以选择，未知时段不会覆盖已有选择。', '取消和空清单都让 canConfirm 为 false。'],
      hints: ['先用局部 selected 记录当前选择，初始为 null。', '循环消费事件后重新计算 canConfirm；不要维护另一套变化顺序。'],
      solution: '每个动作先更新选中值，再派生是否可确认。把每步结果放入日志数组。',
    },
    quiz: [
      ['哪个信息适合由选中项计算？', ['是否能确认', '历史动作的时间', '首次下载的文件名'], 0, 'selected 不为 null 即可推导可确认。'],
      ['点了一个无效时段，正确的状态转移是什么？', ['保存未知 ID', '维持原选择', '删除全部课程'], 1, '只有有效动作改变选中值。'],
      ['动作描述的内容是什么？', ['已经发生的事件及其参数', 'DOM 的全部样式', '服务器地址'], 0, '如 { type: "select", slot: "A" }。'],
      ['为什么两个回放可以共用初始对象？', ['所有对象永远只读', '更新返回新的状态而不改旧对象', '回放只跑一次'], 1, '初始状态未被此前回放改变。'],
    ],
    exercise: checked(
      'function solve(slots, events) {\n  return [];\n}',
      `function solve(slots, events) {
  let selected = null;
  return events.map(event => {
    if (event.type === "cancel") selected = null;
    if (event.type === "select" && slots.includes(event.slot)) selected = event.slot;
    return { selected, canConfirm: selected !== null };
  });
}`,
      [
        { label: '选择后取消', input: [['A', 'B'], [{ type: 'select', slot: 'B' }, { type: 'cancel' }]], expected: [{ selected: 'B', canConfirm: true }, { selected: null, canConfirm: false }] },
        { label: '空时段', input: [[], [{ type: 'select', slot: 'A' }]], expected: [{ selected: null, canConfirm: false }] },
        { label: '非法选择保留原值', input: [['A'], [{ type: 'select', slot: 'A' }, { type: 'select', slot: 'X' }]], expected: [{ selected: 'A', canConfirm: true }, { selected: 'A', canConfirm: true }] },
      ],
    ),
  }),
  lesson({
    id: 'modal-dialog-focus', title: '建立可访问的确认框和焦点回路',
    summary: '让打开、确认、取消和关闭都有明确的键盘落点。',
    primer: {
      lead: '预约确认框会暂时接管交互。用键盘的人需要知道它叫什么、焦点在哪、用 Escape 会发生什么，以及结束后能不能接着操作。',
      terms: [['模态', '先处理弹框才能回到页面其它区域的交互模式'], ['焦点', '接收接下来键盘输入的可交互元素'], ['可访问名称', '辅助技术用于识别控件或分区的文字名称']],
    },
    objectives: ['用原生 dialog 元素和标题为确认框命名。', '实现初始焦点、Escape 取消和返回焦点。'],
    sections: [
      html('下载完整例子，跟踪键盘从哪里来又回哪里', [
        '原生 dialog 适合表达模态确认。页面用它的 aria-labelledby 属性指向框内的标题 ID，aria-describedby 指向说明文字。showModal() 打开框并限制外部操作，框里仍使用真正的按钮，浏览器能处理 Tab、回车和空格的常规含义。',
        '在站内静态预览可以看页面按钮和结构，下载文件后可以在浏览器运行脚本。用 Tab 到「打开确认框」，按 Enter，焦点会进入「取消」按钮。按 Escape 触发取消事件，例子将它接到与取消按钮相同的收尾。在框外的状态区检查文字。',
        '再次打开，用 Tab 到「确认」，按 Enter。核对两次关闭分别显示「已取消」「已确认」，都回到打开按钮。再暂时去掉 leave.focus() 下载比较，思考为什么对不可逆操作，默认焦点放在取消按钮更稳妥。',
      ], buttonDialog, 'study-confirm-dialog.html'),
      {
        heading: '找出关闭后的正确焦点目标',
        paragraphs: [
          '最常见的关闭落点是打开弹框的按钮，用户可以继续原来的操作。不过确认动作有时会删除或禁用这个按钮，例如时段已经被预约。这时要在渲染完成之后选择合理的后备控件，例如重新加载时段，避免焦点丢到页面顶部。',
          '返回焦点前先判断原控件是否仍存在且可用。只保存引发操作的稳定 ID，也能在重新生成列表后找到相同按钮。该 ID 太晚读取时，拿到的可能已经是取消按钮本身，找不回原来的触发来源。',
          '关闭 modal 后再将焦点送回页面。若尝试在 dialog 仍打开时聚焦背景，浏览器通常会阻止幕后的操作。先更新模型、收尾并关闭确认框，再按实际可操作的列表安排焦点。',
        ],
      },
      run('为存在、缺失、禁用三种触发按钮建立规则', [
        '把浏览器操作前的决策抽出来。若 previous.exists 且 previous.enabled，返回 previous.id；否则返回已知的 fallback。逻辑只选择目标 ID，真正的 focus 调用交给页面。这样不需要模拟真实键盘也能测到最容易掉焦点的状态。',
        '先运行核对按钮丢失时的结果。把第二条从 exists=false 改成 true，再把 enabled 保持为 false，看是否仍选后备入口。若只检查元素存在，禁用状态就会漏掉。最后试着用自己写的序列描述“预约成功导致原按钮被移除”。',
        '在综合题里把这条规则扩展到取消和确认两条路径。除了焦点去处，还要检查提示文字返回中是否能区分成功、取消和重复关闭。',
      ], `function target(previous, fallback) {
  if (previous.exists && previous.enabled) return previous.id;
  return fallback;
}
const samples = [
  { id: "预约 A", exists: true, enabled: true },
  { id: "预约 A", exists: false, enabled: true },
  { id: "预约 A", exists: true, enabled: false },
];
for (const button of samples) console.log(target(button, "重新加载"));`, '预约 A\n重新加载\n重新加载'),
    ],
    pitfalls: [
      { mistake: '只监听点击，忘记 Escape', why: '键盘用户缺少一致的取消路径。', fix: '在 dialog 的 cancel 事件中调用同一个取消流程。' },
      { mistake: '成功后把焦点交给已移除按钮', why: '焦点可能落到不可见或不可操作处。', fix: '在渲染收尾时核对触发按钮是否可用，并提供后备目标。' },
    ],
    practice: {
      prompt: '实现 solve(actions)。open 进入 dialog 且 focus 为 cancel。escape 与 cancel 关闭，回到 trigger；confirm 关闭并将 focus 设为 fallback。关闭后收到其他事件，维持上一状态。每步返回 { open, focus }。',
      checkpoints: ['Escape 取消时仍有原按钮；确认后原按钮移除。', '只有 open 动作能进入模态；未打开时取消不移动焦点。'],
      hints: ['初始 focus 为 trigger；遇到 open 就改为 cancel。', '其余动作先看模态是否打开，再区别 confirm 与取消。'],
      solution: '用 open 存当前模式，用 focus 存逻辑落点。实物页将此落点映射到浏览器元素。',
    },
    quiz: [
      ['aria-labelledby 应该指向什么？', ['dialog 的标题元素 ID', '被禁用按钮的颜色', 'CSS 文件名'], 0, '它为辅助技术提供对话框名称。'],
      ['打开确认框后，默认焦点放哪里常常更稳妥？', ['背景列表', '取消按钮', '浏览器地址栏'], 1, '可以先退出，减少不小心确认。'],
      ['按 Escape 应执行什么？', ['取消并返回合理焦点', '确认', '关闭网站'], 0, '复用取消途径，保证没有提交。'],
      ['原按钮已被删除，焦点应该返回哪里？', ['消失元素', '一个明确、仍可用的后备控件', '任意指针位置'], 1, '后续键盘操作要有明确起点。'],
    ],
    exercise: checked(
      'function solve(actions) {\n  return [];\n}',
      `function solve(actions) {
  let open = false;
  let focus = "trigger";
  return actions.map(action => {
    if (action === "open") {
      open = true;
      focus = "cancel";
    } else if (open && ["escape", "cancel", "confirm"].includes(action)) {
      open = false;
      focus = action === "confirm" ? "fallback" : "trigger";
    }
    return { open, focus };
  });
}`,
      [
        { label: 'Escape 取消并复原', input: [['open', 'escape']], expected: [{ open: true, focus: 'cancel' }, { open: false, focus: 'trigger' }] },
        { label: '确认与重复确认', input: [['open', 'confirm', 'confirm']], expected: [{ open: true, focus: 'cancel' }, { open: false, focus: 'fallback' }, { open: false, focus: 'fallback' }] },
        { label: '无弹框的无效按键', input: [['tab', 'escape']], expected: [{ open: false, focus: 'trigger' }, { open: false, focus: 'trigger' }] },
      ],
    ),
  }),
  lesson({
    id: 'web-async-stale-state', title: '让异步回复属于正确的课程',
    summary: '对加载中的界面建模，处理成功、失败、空列表，同时拒绝旧回复。',
    primer: {
      lead: '同一个预约页可以连续查看几门课程，回复经常不会按发出顺序返回。页面需要记住“哪次请求代表我现在的选择”。',
      terms: [['异步替身', '用本地数据代替服务并模拟回复时机'], ['票号', '将一次开始操作与其最后回复对应的编号'], ['阶段', '界面当前为未开始、加载、就绪或失败']],
    },
    objectives: ['把加载请求和回复都表示为动作。', '通过票号和阶段区分有效、过期和重复结果。'],
    sections: [
      run('从已经演算得通的动作串开始', [
        '查询开始时应该换票号、清空当前列表并显示正在加载。这样在任务尚未完成时，用户就不会把旧课程的时段当成当前可选项。成功回复可包含空清单，表示没有空位；失败是另一种阶段，需要显示可重新加载。',
        '从手写动作开始，模拟选择 HTML 和 JS，然后让 JS 的票号 2 先返回。后到的 HTML 回复应忽略，页面不闪回。这个验证不需要 DOM 或真实服务，只需检查状态记录的当前票号与结果。',
        '运行后交换两条回复，检查 HTML 先返回时会不会短暂显示旧列表。把末尾输入增加票号 2 的重复失败，阶段已就绪，应维持真正的成功结果。状态函数的保护逻辑可独立于界面中的按钮进行测试。',
      ], `function update(state, action) {
  if (action.type === "load") return { ticket: state.ticket + 1, phase: "loading", text: action.course };
  if (state.ticket !== action.ticket || state.phase !== "loading") return state;
  return { ...state, phase: action.ok ? "ready" : "error" };
}
const events = [
  { type: "load", course: "HTML" },
  { type: "load", course: "JS" },
  { type: "reply", ticket: 2, ok: true },
  { type: "reply", ticket: 1, ok: true },
];
let state = { ticket: 0, phase: "idle", text: "-" };
for (const action of events) {
  state = update(state, action);
  console.log(state.phase + "：" + state.text);
}`, 'loading：HTML\nloading：JS\nready：JS\nready：JS'),
      {
        heading: '在服务回调里记住发起时的局部变量',
        paragraphs: [
          '实际事件处理器收到查询意图后，可以在局部 const ticket 保存最新版。随后查询函数返回 Promise，它将来成功或失败时，处理器用这份票号构建 reply。不要在回调里重新读当前票号当作回复自己的票号，旧回复会伪装成最新。',
          '页面还应关心非成功路径。旧失败与旧成功都不能覆盖当前界面，当期失败要结束 loading。已知课程的合法空列表仍是 ready，提示暂无时段，并避免显示不可用的按钮。状态字段比布尔型的 loading 更能表达这几种情况。',
          '项目使用送达按钮来控制本地 Promise。发出两个回复后，用户可以先送达任何一个。这和使用固定测试代码的好处相同：每次都能把两种到达顺序准确重现。',
        ],
      },
      run('用两份可控 Promise 再验一次票号', [
        '下面的 mock 返回一份 Promise 和手动送达函数 deliver。执行 deliver 后，再等待处理回调结束并读取当前文字。Promise 本身只提供数据，更新是否允许发生由票号确认。',
        '先送达较新的 JS，再送达 HTML，预期显示始终是 JS。试反过来，确认 HTML 到达时由于出票较早无法写回。真实页面里，碰到没有更新的 reply 时还可跳过渲染，以免重建仍有焦点的按钮。',
        '练习增加失败场景时，可以让 resolve 提供 { ok: false }，由 update 根据标记设定 error；或者让 Promise 抛错，catch 中仍要携带同一个发起编号。',
      ], `function mock() {
  let deliver;
  const promise = new Promise(resolve => { deliver = resolve; });
  return { promise, deliver };
}
let latest = 0;
let visible = "尚无时段";
function launch(source) {
  const ticket = ++latest;
  return source.then(text => {
    if (ticket === latest) visible = text;
  });
}
(async () => {
  const first = mock();
  const second = mock();
  const oldTask = launch(first.promise);
  const currentTask = launch(second.promise);
  second.deliver("JS 时段");
  await currentTask;
  console.log(visible);
  first.deliver("HTML 时段");
  await oldTask;
  console.log(visible);
})()`, 'JS 时段\nJS 时段'),
    ],
    pitfalls: [
      { mistake: '用回调执行时的当前编号标注旧回复', why: '回复对应的请求编号丢失了。', fix: '每次发起时捕获自己的局部编号。' },
      { mistake: '把合法空时段视为失败', why: '已知课程暂时无空位与服务失败需要不同反馈。', fix: '空列表进入 ready，失败进入 error。' },
    ],
    practice: {
      prompt: '实现 solve(actions)。load 按次序发票号，状态为 loading。当前票号的 reply 根据 ok 及 slots 返回 ready、empty 或 error。重复、过期和未知动作保留已有状态。输出每步阶段。',
      checkpoints: ['旧失败不会覆盖最新成功，合法空列表返回 empty。', '首次票号 1；完成后同票号的重复回复不能再次改变状态。'],
      hints: ['只在 load 时加一票号，并把阶段置为 loading。', '接收 reply 的三个条件是动作类型、当前票号及 loading；进入后再区分失败和合法空列表。'],
      solution: '用票号和加载阶段守卫回复，在有效回复中根据成功标志和列表长度选择下一阶段。',
    },
    quiz: [
      ['要在何时记录请求自己的票号？', ['发起任务时', '收到回复后再读取全局最新值', '每次渲染后'], 0, '发起时才能将工作和编号永久关联。'],
      ['已知课程返回空时段意味着什么？', ['有效数据，只是暂无时段', '程序必然崩溃', '应该继续显示旧课程'], 0, '成功返回的空清单有具体业务含义。'],
      ['旧失败到达时，新课程已就绪，应显示哪份状态？', ['旧失败', '新课程原状态', '重置'], 1, '旧请求不能改动当前界面。'],
      ['哪些信息一起防止重复回复？', ['课程颜色与标题', '票号与当前加载阶段', '只看消息长度'], 1, '票号相符且还在等待才可以被处理。'],
    ],
    exercise: checked(
      'function solve(actions) {\n  return [];\n}',
      `function solve(actions) {
  let ticket = 0;
  let phase = "idle";
  return actions.map(action => {
    if (action.type === "load") {
      ticket += 1;
      phase = "loading";
    } else if (action.type === "reply" && action.ticket === ticket && phase === "loading") {
      if (!action.ok) phase = "error";
      else phase = action.slots.length > 0 ? "ready" : "empty";
    }
    return phase;
  });
}`,
      [
        { label: '旧失败迟于新成功', input: [[{ type: 'load' }, { type: 'load' }, { type: 'reply', ticket: 2, ok: true, slots: ['J-1'] }, { type: 'reply', ticket: 1, ok: false }]], expected: ['loading', 'loading', 'ready', 'ready'] },
        { label: '空时段与重复回复', input: [[{ type: 'load' }, { type: 'reply', ticket: 1, ok: true, slots: [] }, { type: 'reply', ticket: 1, ok: false }]], expected: ['loading', 'empty', 'empty'] },
        { label: '错误后再加载', input: [[{ type: 'unknown' }, { type: 'load' }, { type: 'reply', ticket: 1, ok: false }, { type: 'load' }]], expected: ['idle', 'loading', 'error', 'loading'] },
      ],
    ),
  }),
  lesson({
    id: 'keyboard-workflow-testing', title: '验证完整键盘路径与结果回放',
    summary: '分别验证状态、可见反馈和焦点，并用清晰的动作序列重现问题。',
    primer: {
      lead: '仅验证一个按钮能点，可能漏掉确认框关闭后的焦点、重复确认或反馈消失。把整条操作路径拆成能重做的检查，每一步都看得见清楚的结果。',
      terms: [['操作序列', '按预先写好的顺序逐步执行的用户动作'], ['状态反馈', '让用户知道等待、成功、失败与取消的文字'], ['焦点断言', '检查下一个按键将由哪一个控件接收']],
    },
    objectives: ['设计键盘和鼠标共用的主要操作序列。', '把状态回放与实际浏览器焦点检查配合起来。'],
    sections: [
      run('为每一步写一个可以观测的预期', [
        '把检查从“预约成功”拆为三步。触发预约后，确认框出现且焦点在取消项；按 Escape 后，框关闭、原按钮获焦、未新增记录；重新打开并确认，出现唯一记录，焦点回到继续操作处。把这些观察点写在用例旁边，不必等到最后才检查。',
        '纯 JS 适合验证状态、当前记录和动作序列。下例将有序的观察值打印成一份小报告，能看到状态在哪一步与预期不同。真实键盘行为应下载 HTML 后演练两次：鼠标当作对照，Tab、Enter、Space 和 Escape 做主测。',
        '先运行报告示例，再改其中一项预期为错误的焦点。看看信息能否指出是“关闭后焦点”的预期不符，而非只说项目失败。最终报告可同时列出当前元素名称和文本，方便别人复现。',
      ], `const checks = [
  { step: "打开后的焦点", actual: "取消", expected: "取消" },
  { step: "取消后的焦点", actual: "预约 J-1", expected: "预约 J-1" },
  { step: "确认后的记录", actual: "1 条", expected: "1 条" },
];
for (const check of checks) {
  console.log(check.step + "：" + (check.actual === check.expected ? "通过" : "未通过"));
}`, '打开后的焦点：通过\n取消后的焦点：通过\n确认后的记录：通过'),
      {
        heading: '保证焦点、反馈和业务状态相互吻合',
        paragraphs: [
          '使用原生 select 和 button，用户能够用自然导航顺序走完选择、加载、送达和预约。不要用 div 冒充按钮。如果焦点样式缺失，键盘用户虽能触发操作，也无法知道下个按键会在哪。高亮焦点还要在小窗口里可见。',
          '动态结果放到已在 DOM 中的 role="status" 容器。用文字说明“加载失败，可重试”或“当前无可预约时段”等变化，不要只靠颜色。模态内给标题和说明明确名称。状态区也便于手工核对消息是否晚到。',
          '严谨的检查包括重复确认、退回后的再进入、较早结果在较新结果之后到达、空数据与错误。为每个状态准备固定输入。自动检查能提早发现模型变化，但仍要用真实浏览器核实焦点约束和默认键盘事件。',
        ],
      },
      html('检查鼠标点击与键盘是否共用同一结果', [
        '下载后用 Tab 到「预约一次」，先按空格验收，状态提示应变成已预约。预约按钮随后禁用，键盘焦点会移到「重置测试」。尝试按 Shift+Tab，已禁用的预约按钮不会再接收焦点。回到「重置测试」并按 Enter，焦点应回到恢复可用的预约入口。',
        '试着删除 render 中设置 disabled 的一行。按钮表面仍可用，但 phase 的检查应防止重复写入。再加回 disabled，确认控件能力、显示和状态一致。这个试验有助于区分业务保护与界面提示各起什么作用。',
        '在课程预约项目中用相同方法分阶段验收。保留浏览器内的当前状态文字，检查取消与确认各自的后果。若刷新页面从初始状态开始，按同一组动作重跑即可重现。',
      ], page('键盘回归小练习', `    <button id="reserve" type="button">预约一次</button>
    <button id="reset" type="button">重置测试</button>
    <p id="status" role="status">尚未预约，0 条</p>`, `let reserved = false;
const reserve = document.querySelector("#reserve");
const reset = document.querySelector("#reset");
const status = document.querySelector("#status");
function render() {
  reserve.disabled = reserved;
  status.textContent = reserved ? "预约成功，1 条" : "尚未预约，0 条";
}
reserve.addEventListener("click", () => {
  if (reserved) return;
  reserved = true;
  render();
  reset.focus();
});
reset.addEventListener("click", () => {
  reserved = false;
  render();
  reserve.focus();
});`), 'keyboard-reservation-test.html'),
    ],
    pitfalls: [
      { mistake: '只比较最后的记录数量', why: '中途焦点错误可能影响用户实际走完流程。', fix: '为打开、取消、确认分别观察焦点与状态。' },
      { mistake: '禁用按钮就省掉状态中的重复检查', why: '多条同类动作仍可能从代码内部发来。', fix: '独立验收状态拒绝重复写入。' },
    ],
    practice: {
      prompt: '实现 solve(actions)。open 只在未预约时打开确认框。escape 取消并返回 trigger。确认后记录只增为 1，关闭并落焦 fallback；重复 confirm 无效。输出每步 { count, open, focus }。',
      checkpoints: ['取消后的 count 为 0，之后仍可打开。', '确认后直到结束只保留 1 条；未启动确认框时直接 confirm 不增计数。'],
      hints: ['让 count、open、focus 各有清楚责任。只在 open 为真时执行关闭操作。', 'confirm 带来两个变化：确认记录并改变焦点。escape 只关闭并复原焦点。'],
      solution: '进入框需要尚无预约；只在打开时处理取消或确认，重复按键不能改变已经完成的记录。',
    },
    quiz: [
      ['实际键盘测试最直接验证什么？', ['焦点位置、键盘触发与可见反馈', '服务器传输速度', '对象在内存中的大小'], 0, '真实浏览器可以观察默认事件与焦点移动。'],
      ['怎样检查重复确认？', ['仅运行初次成功一次', '连续回放两次 confirm，最终记录仍为 1', '把所有按钮隐藏'], 1, '重复动作应无状态写入。'],
      ['成功结果只靠绿色提示行是否够？', ['够', '要有具体文字反馈', '只应发出声音'], 1, '文字可以直观验证，也可由辅助技术阅读。'],
      ['以前回复晚到的场景该如何稳定检查？', ['随机拖延两秒', '用固定事件顺序发送当前和旧回复', '删除所有过去的请求'], 1, '固定序列可以反复重现。'],
    ],
    exercise: checked(
      'function solve(actions) {\n  return [];\n}',
      `function solve(actions) {
  let count = 0;
  let open = false;
  let focus = "trigger";
  return actions.map(action => {
    if (action === "open" && count === 0) {
      open = true;
      focus = "cancel";
    } else if (action === "escape" && open) {
      open = false;
      focus = "trigger";
    } else if (action === "confirm" && open) {
      count = 1;
      open = false;
      focus = "fallback";
    }
    return { count, open, focus };
  });
}`,
      [
        { label: '取消后再确认', input: [['open', 'escape', 'open', 'confirm']], expected: [{ count: 0, open: true, focus: 'cancel' }, { count: 0, open: false, focus: 'trigger' }, { count: 0, open: true, focus: 'cancel' }, { count: 1, open: false, focus: 'fallback' }] },
        { label: '重复确认与尝试再开', input: [['open', 'confirm', 'confirm', 'open']], expected: [{ count: 0, open: true, focus: 'cancel' }, { count: 1, open: false, focus: 'fallback' }, { count: 1, open: false, focus: 'fallback' }, { count: 1, open: false, focus: 'fallback' }] },
        { label: '未打开就确认', input: [['confirm']], expected: [{ count: 0, open: false, focus: 'trigger' }] },
      ],
    ),
  }),
]

export const frontendAdvanced: AdvancedTrack = {
  direction: 'web',
  lessons: viewLessons,
  project: reservationProject,
}
