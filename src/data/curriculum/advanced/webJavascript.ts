import type { AdvancedTrack } from '../types'
import { checked, examples, lesson, run } from './webGuide'
import type { StudyCase } from './webGuide'

const loadLabel = `function mockMinutes(id) {
  const records = { A: 12, B: 0 };
  return Promise.resolve(Object.hasOwn(records, id) ? records[id] : null);
}`

const readResult = `async function settle(id) {
  try {
    return id + "：" + await mockRead(id);
  } catch {
    return id + "：不可用";
  }
}`

const readFixture = `async function mockRead(id) {
  await Promise.resolve();
  if (id === "B") throw new Error("资料缺失");
  return id === "A" ? 12 : 8;
}`

const deferred = `function deferred() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}`

const latestMock = `function loader() {
  let latest = 0;
  let visible = "尚无资料";
  return {
    start(source) {
      const ticket = ++latest;
      return source.then(data => {
        if (ticket === latest) visible = data;
      });
    },
    shown() { return visible; },
  };
}`

const javascriptLessons = [
  lesson({
    id: 'promise-await', title: '用 Promise 和 await 读异步结果',
    summary: '区分发起工作、等待结果和继续执行，并观察异步函数返回的是什么。',
    primer: {
      lead: '资料列表有时要等待准备。JavaScript 把“结果稍后会确定”表示为 Promise，调用者可以先保存这个承诺，等真正需要其结果再等待。',
      terms: [['Promise', '代表未来将完成或失败的操作的对象'], ['await', '暂停当前异步函数，等待值可用后继续'], ['兑现', '异步操作成功并提供结果']],
    },
    objectives: ['辨认一个 Promise 与它最终提供的值。', '用 async 函数等待模拟资料，统一返回处理结果。'],
    sections: [
      run('标出发起、等待和取值三个时刻', [
        '下面 prepare 先返回 Promise.resolve("索引就绪")。它提供一个已经兑现的 Promise，可以作为不依赖计时器或网络的固定例子。这个对象本身仍然不是字符串；直接拿变量 ticket 拼接文字，会得到对象的显示形式。用 await ticket 才得到里面的「索引就绪」。',
        '顺着代码读，begin 先调用 prepare，保存返回对象，再打印第一行。接着它遇到 await，当前函数等结果可用后继续执行，取到 value。即使 Promise 已经兑现，这个 await 后续也会让给当前同步步骤；这里最后一行 begin() 发起函数，工作台会等待返回的 Promise。',
        '运行后把 prepare 的字符串改成「目录已更新」，观察只有第二行改变。再把 typeof ticket 改成 typeof value 并放到 await 后，预测从 object 变为 string。两种观察分别回答“票据是什么”和“最终值是什么”。',
      ], `function prepare() {
  return Promise.resolve("索引就绪");
}
async function begin() {
  const ticket = prepare();
  console.log(typeof ticket);
  const value = await ticket;
  console.log(value);
}
begin()`, 'object\n索引就绪'),
      {
        heading: 'async 函数把普通返回值包进 Promise',
        paragraphs: [
          '给函数名前加 async 后，调用时总会得到 Promise：即便里面没有 await，return 12 最终也是由这个 Promise 提供 12。一个函数可以直接返回它，让上层决定何时等待；也可以先 await，做校验后 return 新值。把异步调用留在普通同步函数中却读取未准备好的变量，常常会得到旧值。',
          '只在真正需要慢任务结果的地方等待。在一个 async 函数里使用多个 await 时，每条语句要等前一条结束才开始。若第二个操作依赖第一项返回的 ID，这是正确顺序；无依赖工作的并行将在下一章处理。',
          '异步不意味着多线程。当前示例中的 JavaScript 仍按语句运行，await 给其他可以执行的步骤留出机会。当你在浏览器中敲下输入时，等待加载资料通常不应阻止表单响应。',
        ],
      },
      run('在取值之后区分零与缺失', [
        '读取时长后需要分出三类：正数表示已记录，0 表示确认没有时长，null 表示资料缺失。只有 await 之后的值才能参与这个决策；对 Promise 做真值判断总是成立，因为它是对象。',
        '这次先跑完整示例，再把下方函数的校验值改成别的编号。试着用 if (!minutes) 替换 null 的显式判断，会发现零也被归到缺失。把严格比较改回来，为什么“暂缺”和“零分钟”不应该合并？',
        '最后试在下方编辑器将 return 结果改成 { id, minutes }，看看调用者如何决定展示格式。这是异步数据处理常见的职责分工：加载负责提供值，显示负责把结果翻译成读者看得懂的文字。',
      ], `${loadLabel}
async function show(id) {
  const minutes = await mockMinutes(id);
  if (minutes === null) return "资料缺失";
  return minutes + " 分钟";
}
(async () => {
  for (const id of ["A", "B", "C"]) console.log(await show(id));
})()`, '12 分钟\n0 分钟\n资料缺失'),
    ],
    pitfalls: [
      { mistake: '把返回的 Promise 当作数值比较', why: '结果还以 Promise 表示，直接比较会得到不合约定的结果。', fix: '在 async 函数中等待得到实际值。' },
      { mistake: '用 !minutes 表示没有结果', why: '0 会和缺失一起进入假分支。', fix: '用 === null 专门识别缺失。' },
    ],
    practice: {
      prompt: '实现 async solve(id)，等待 mockMinutes。找不到返回「资料缺失」，找到返回「时长 X 分钟」，0 分钟合法。',
      checkpoints: ['调用者等待 solve 完成后再读取结果。', '正常编号、0 分钟和不存在的编号各输出正确文案。'],
      hints: ['先写一行 const minutes = await mockMinutes(id)。', '在拼接文字前用 minutes === null 检查是否缺失。'],
      solution: '等待取到实际值，再检查 null；余下包括 0 的值都按数值展示。',
    },
    quiz: [
      ['Promise.resolve("就绪") 会直接返回什么？', ['字符串', 'Promise 对象', 'undefined'], 1, '它返回已兑现的 Promise，里面的结果是该字符串。'],
      ['await 之后负责继续执行什么？', ['整个浏览器暂停直到加载完毕', '当前异步函数在得到结果后继续', '编辑器重置'], 1, '等待让出当前异步函数的后续步骤。'],
      ['async 函数直接 return 0，调用处立即拿到什么？', ['0', 'false', '兑现为 0 的 Promise'], 2, 'async 函数统一返回 Promise。'],
      ['0 分钟与缺资料都应显示「资料缺失」吗？', ['应当区分，只在值为 null 时提示缺失', '应该合并', '应把 0 变成字符串 null'], 0, '零分钟是已确认的数值。'],
    ],
    exercise: checked(
      loadLabel + '\nasync function solve(id) {\n  return "资料缺失";\n}',
      loadLabel + '\nasync function solve(id) {\n  const minutes = await mockMinutes(id);\n  if (minutes === null) return "资料缺失";\n  return "时长 " + minutes + " 分钟";\n}',
      [{ label: '普通资料', input: ['A'], expected: '时长 12 分钟' }, { label: '零分钟', input: ['B'], expected: '时长 0 分钟' }, { label: '缺失编号', input: ['C'], expected: '资料缺失' }], true,
    ),
  }),
  lesson({
    id: 'bounded-async-work', title: '处理异步失败并限制并行数量',
    summary: '让单项失败保留错误信息，让无依赖的任务在受控范围内同时推进。',
    primer: {
      lead: '把三份资料同时交给工作台时，有的很快，有的失败。先给每份资料自己的结果，再约定顺序和同时处理的上限。',
      terms: [['拒绝', 'Promise 失败并提供原因'], ['并行上限', '同一时刻允许处于等待中的任务数量'], ['结果顺序', '最终结果按输入编号的位置排列']],
    },
    objectives: ['用 try/catch 把单项失败记录为结果。', '用 Promise.all 和分批队列控制顺序与在途数量。'],
    sections: [
      run('让失败的那一项得到自己的反馈', [
        'await 一个遭拒绝的 Promise 时，控制流会像碰到 throw 一样转到附近的 catch。把每条资料的 catch 放在 settle 里，可以让 B 的失败专属于 B。若把 try/catch 只放在外层整个批次周围，一项失败时往往丢掉同批可用结果。',
        'Promise.all 接收多个已经启动的 Promise。全部兑现后，它提供的结果数组保持传入顺序。先调用 settle("A")、settle("B")、settle("C")，再把三个异步结果交给 Promise.all 时，三个都已经开始。await 负责等待总结果，并不会规定它们完成的时间。',
        '运行后把输入顺序改成 C、B、A，核对输出顺序随输入改变。然后去掉 settle 中的 try/catch，把最后一行改成在外层 catch 打印错误，观察为何你会失去 A 和 C 的正常结果。',
      ], `${readFixture}
${readResult}
(async () => {
  const group = ["A", "B", "C"].map(settle);
  console.log((await Promise.all(group)).join(" / "));
})()`, 'A：12 / B：不可用 / C：8'),
      {
        heading: '什么时候串行，什么时候分批',
        paragraphs: [
          '同一条记录的两步工作若有数据依赖，例如先加载索引，再用索引中的编号取详情，应该前后等待。不同记录的详情已经有完整编号，可以同时开始。直接启动全部工作可能占同一资源太久，于是我们明确限制每一批的最多数量。',
          '简单的做法是用 offset 作为下一批的起点。slice(offset, offset + limit) 复制最多 limit 条记录，交给 Promise.all 等到这批全部结束，再继续切下一批。limit 为 1 时按顺序逐个执行，末批少于 limit 也正常。',
          '分批等待最慢项可能留下空闲位置。更细的办法是创建有限数量的工作者，每个工作者完成自己的任务就取下一项。工作者在第一次 await 之前同步预留独立下标，同一项便不会被取两次。这种写法还要把结果写回原下标，最后一章的批量项目会用到。',
        ],
      },
      run('用可复查的批次输出验证上限', [
        '本例只跟踪每批启动了哪些编号，每批之前先打印清单。limit 为 2，第一批出现 A 和 B，第二批只出现 C。检查最后的结果是否仍按原输入位置排列。通过这两行清单，可区分启动顺序和最终报表顺序。',
        '把 limit 改成 1，三批每批一项；改成 3，只有一批。若循环步长写成 1 而 slice 每批取两项，后面的任务就会重复启动。把 offset += limit 的步长与 slice 的右侧长度对应起来。',
        '在综合练习里让空列表返回空结果。对非正的上限先返回错误提示，否则 limit 为 0 会使循环步长变成 0，任务也无法推进。',
      ], `${readFixture}
${readResult}
(async () => {
  const ids = ["A", "B", "C"];
  const limit = 2;
  const report = [];
  for (let offset = 0; offset < ids.length; offset += limit) {
    const batch = ids.slice(offset, offset + limit);
    console.log("启动：" + batch.join(","));
    const rows = await Promise.all(batch.map(settle));
    report.push(...rows);
  }
  console.log("记录：" + report.join(" / "));
})()`, '启动：A,B\n启动：C\n记录：A：12 / B：不可用 / C：8'),
    ],
    pitfalls: [
      { mistake: '先 map 启动全部任务，再从返回的 Promise 切分批次', why: '操作已全部发起。', fix: '先切分输入，只对当前批的输入创建 Promise。' },
      { mistake: '只在整个 Promise.all 外处理错误', why: '某项失败可能让批次没有完整结果。', fix: '在单项处理函数里把异常转成错误记录。' },
    ],
    practice: {
      prompt: '实现 async solve(ids, limit)。用分批 Promise.all 载入 mockRead，逐项捕获失败。上限为正整数，非法时返回 null。',
      checkpoints: ['按原输入顺序返回各项文本，不因 B 失败丢失其它结果。', '上限为 1 也能得到相同有序结果，空输入返回 []。'],
      hints: ['先完成单项 settle(id)，在 catch 中生成「ID：不可用」。', '使用 slice 拿一批，等待这批后将所有行追加到结果，再推进 limit 项。'],
      solution: '先核对上限，再逐组启动。每项由 settle 把成功或异常转换成一行，Promise.all 已保留该组的输入相对顺序。',
    },
    quiz: [
      ['Promise.all 的结果按哪种顺序排列？', ['完成时间', '传入的 Promise 顺序', '字母顺序'], 1, '最终数组下标与输入一致。'],
      ['为什么先 slice 再 map？', ['只让当前批真正启动', '让三个任务自动缩为一个', '为了去重'], 0, '调用异步函数时就已发起任务。'],
      ['单项失败想保留其他结果，在哪里捕获？', ['单项 settle 函数里', '只在整个项目的浏览器中', '无需捕获'], 0, '该项会兑现为一条错误记录，批次仍可继续。'],
      ['limit 为 0 最好怎么处理？', ['一直循环等', '把步长写成负数', '在循环前拒绝'], 2, '非正的分组长度无法推进。'],
    ],
    exercise: checked(
      readFixture + '\nasync function solve(ids, limit) {\n  return [];\n}',
      readFixture + '\n' + readResult + `
async function solve(ids, limit) {
  if (!Number.isInteger(limit) || limit < 1) return null;
  const report = [];
  for (let offset = 0; offset < ids.length; offset += limit) {
    const batch = ids.slice(offset, offset + limit);
    report.push(...await Promise.all(batch.map(settle)));
  }
  return report;
}`,
      [
        { label: '并行结果与单项失败', input: [['C', 'B', 'A'], 2], expected: ['C：8', 'B：不可用', 'A：12'] },
        { label: '上限为一', input: [['B', 'A'], 1], expected: ['B：不可用', 'A：12'] },
        { label: '空批次', input: [[], 1], expected: [] },
        { label: '无法推进', input: [['A'], 0], expected: null },
      ], true,
    ),
  }),
  lesson({
    id: 'request-tickets', title: '用请求编号保护当前状态',
    summary: '读懂过期结果的来源，在回复前检查它是否仍对应当前请求。',
    primer: {
      lead: '你先找 A 资料、又改选 B。A 的结果若后到，它仍然正确，但已经不是你要看的内容。',
      terms: [['请求编号', '开始一次异步工作时保存的唯一值'], ['过期结果', '来自较早请求而与当前选择无关的结果'], ['快照', '保存到变量中供这一次操作使用的值']],
    },
    objectives: ['用编号把开始与相应回复关联起来。', '分别检查旧成功、旧失败和重复回复。'],
    sections: [
      run('按固定顺序回放请求和回复', [
        '把加载过程写成可阅读的动作列表。开始 A 时制作编号 1，开始 B 时编号 2 成为最新。B 的回复带编号 2，可以填写当前内容；之后 A 携带编号 1 到达，不符合当前编号，直接保留先前状态。',
        '下例依次打印每个动作之后的显示。状态只需要知道当前版本 ticket，回复里的 ticket 则告诉我们这份资料由哪次请求产生。仅比较所选课程名无法区分连续两次查询同一门课，编号仍能区分它们。',
        '运行后对调最后两条回复，在 B 到达前界面应显示「加载 B」，而不会短暂显示 A。把检查 action.ticket === state.ticket 省略再试，对照旧数据显示在哪一步。',
      ], `function update(state, action) {
  if (action.type === "start") return { ticket: state.ticket + 1, text: "加载 " + action.id };
  if (action.ticket !== state.ticket) return state;
  return { ticket: state.ticket, text: action.text };
}
let state = { ticket: 0, text: "-" };
const events = [
  { type: "start", id: "A" },
  { type: "start", id: "B" },
  { type: "reply", ticket: 2, text: "资料 B" },
  { type: "reply", ticket: 1, text: "资料 A" },
];
for (const event of events) {
  state = update(state, event);
  console.log(state.text);
}`, '加载 A\n加载 B\n资料 B\n资料 B'),
      {
        heading: '抓住开始那一刻，守住结束时的状态',
        paragraphs: [
          '在异步函数开始时写 const ticket = ++latest，局部常量保存这一次的编号，latest 保留当前最新编号。等待期间更晚的调用可改变 latest，却不会改变旧函数自己的 ticket。恢复执行后比较这两个量即可判断是否还允许写入。',
          '成功和失败都要守住同一条规则。旧请求失败时若不加判断，页面可能把新请求已显示的结果覆盖成错误。可以将所有结果统一交给 update 函数检查，也可以在成功与失败的回调里各加判断。',
          '编号负责防止写回旧状态，取消请求则负责节省工作量。即使应用可以停止旧请求，也必须考虑已经排队等待发送的回调。本站用固定回放验证状态约束，将网络与状态逻辑拆开。',
        ],
      },
      run('拒绝旧失败与同一次重复回复', [
        '把状态增加 phase 字段。开始后 phase 为 loading，收到合规的成功或失败才进入 ready 或 error。除了检查票号还检查 loading，就能忽略同一票号在结束后到来的重复结果。',
        '运行后尝试交换两条回复。第一次的失败编号过期，B 尚未收到答复时仍维持 loading。再给最新编号一次相同的 ready，随后再重复失败，已经确认的状态应保留。',
        '这种顺序敏感的练习可以先画表。每一步记录输入动作、当前 ticket 和 phase，特别注意列表最开头没有开始过请求时应保持 idle。在综合题中为无效动作保留同样的拒绝路径。',
      ], `function accept(state, event) {
  if (state.phase !== "loading" || state.ticket !== event.ticket) return state;
  return { ticket: state.ticket, phase: event.ok ? "ready" : "error" };
}
let state = { ticket: 2, phase: "loading" };
for (const event of [{ ticket: 1, ok: false }, { ticket: 2, ok: true }, { ticket: 2, ok: false }]) {
  state = accept(state, event);
  console.log(state.phase);
}`, 'loading\nready\nready'),
    ],
    pitfalls: [
      { mistake: '在 await 之后读取编号作为当前请求编号', why: '读取的是等待后最新的编号，可能来自别的调用。', fix: '发起时将版本记录在局部 const。' },
      { mistake: '只防止旧成功覆盖状态', why: '迟到的错误也可以覆盖新结果。', fix: '所有完成动作共用编号和阶段检查。' },
    ],
    practice: {
      prompt: '实现 solve(actions)，初始阶段 idle。start 加一编号并进入 loading，reply 仅匹配当前等待时接受，ok 决定 ready 或 error，输出每一步阶段。',
      checkpoints: ['旧回复、重复回复和 unknown 动作不改变当前阶段。', '首次编号是 1，正常失败进入 error 并可由下一次 start 重新加载。'],
      hints: ['先搭好 idle→loading，编号只在 start 递增。', '在 reply 中同时核对类型、票号和 loading；不通过就沿用之前的阶段。'],
      solution: '每一步先按动作类型处理。reply 必须处于活动票据的 loading 阶段，过期或重复回复保持原状。',
    },
    quiz: [
      ['先查询 A 后查询 B，最终处理哪一条？', ['始终最后到达的所有结果', '对应当前票号的 B', '最早开始的 A'], 1, '正在查看的是最近发起的请求。'],
      ['连续两次查询同名资料，怎样判断哪次回复有效？', ['比较资料名称', '比较两次请求编号', '查看字符串长度'], 1, '唯一请求编号可以区分同名操作。'],
      ['已 ready 后收到同一票号的失败，应该？', ['覆盖为 error', '继续保持 ready', '开始新请求'], 1, '当前已经不是 loading，回复不适用。'],
      ['旧请求失败时理由能否显示为当前错误？', ['必须显示', '可以覆盖最新数据', '应忽略该回复'], 2, '票号规则对成功与失败都生效。'],
    ],
    exercise: checked(
      'function solve(actions) {\n  return actions.map(() => "idle");\n}',
      `function solve(actions) {
  let ticket = 0;
  let phase = "idle";
  return actions.map(action => {
    if (action.type === "start") {
      ticket += 1;
      phase = "loading";
    } else if (action.type === "reply" && phase === "loading" && action.ticket === ticket) {
      phase = action.ok ? "ready" : "error";
    }
    return phase;
  });
}`,
      [
        { label: '先处理最新请求', input: [[{ type: 'start' }, { type: 'start' }, { type: 'reply', ticket: 2, ok: true }, { type: 'reply', ticket: 1, ok: false }]], expected: ['loading', 'loading', 'ready', 'ready'] },
        { label: '开始前收到回复', input: [[{ type: 'reply', ticket: 1, ok: true }]], expected: ['idle'] },
        { label: '最新失败与重复回复', input: [[{ type: 'start' }, { type: 'reply', ticket: 1, ok: false }, { type: 'reply', ticket: 1, ok: true }, { type: 'unknown' }]], expected: ['loading', 'error', 'error', 'error'] },
      ],
    ),
  }),
  lesson({
    id: 'deterministic-async-tests', title: '用手动兑现的 Promise 测试异步代码',
    summary: '由测试主动控制每次回复，让成功、失败与乱序都能准确复现。',
    primer: {
      lead: '靠“等 100 毫秒”猜测哪个结果先到，会让测试取决于机器是否繁忙。测试握住回复开关，就能稳定重现顺序。',
      terms: [['固定夹具', '测试预先准备的数据或替身'], ['可控 Promise', '由测试保存兑现函数并主动触发的承诺'], ['断言', '检查当前结果是否满足预先写出的期望']],
    },
    objectives: ['掌握手动兑现 Promise 的小工具。', '对反常到达顺序逐步断言中间状态。'],
    sections: [
      run('把兑现开关交给测试', [
        'new Promise 接收一个创建函数，创建时会立刻调用。它给出 resolve 函数；调用 resolve(value) 后，这份承诺便能交付 value。为测试保存该函数，令异步操作的完成时机完全由测试决定。运行一次创建函数后，每个对象的 resolve 只负责自己的承诺。',
        'deferred 返回 { promise, release }。代码先创建 A、B 两份承诺，再让后创建的 B 先兑现。await B 的 Promise 后查看屏幕文字，再主动兑现 A。没有真实计时器，也无需假设浏览器会在某段时间内完成某项工作。',
        '将 release 的顺序改成 A 再 B，查看输出反转。试图对一个承诺释放第二次，后来的值不会覆盖第一次。这与应用层的状态检查不同：应用会接收很多个不同 Promise，也要核对每份结果对应哪次调用。',
      ], `${deferred}
(async () => {
  const a = deferred();
  const b = deferred();
  b.release("B 先到");
  console.log(await b.promise);
  a.release("A 后到");
  console.log(await a.promise);
})()`, 'B 先到\nA 后到'),
      {
        heading: '同时写明事件顺序和观察点',
        paragraphs: [
          '一条测试可以由三段组成：准备数据、执行明确步骤、核对结果。请求乱序测试里，准备两份可手动兑现的资料；执行步骤是发起 A、发起 B、兑现 B、兑现 A；观察点分别在 B 到达后和 A 到达后。如果只检查最终结果，可能漏掉界面曾短暂显示错误资料。',
          '等待的是被测代码处理完的任务，而不仅仅是原始 promise。本例 loader.start 返回 source.then(...)，这个返回值在内部写回完成后才兑现。下面对每个 start 的返回值使用 await，确保检查时写回已经发生或已被拦截。',
          '每条测试重新创建 loader 与数据。若复用已经完成的可控 Promise，第二条测试就无法改变它的状态。每个用例都有自己的夹具，测试的执行次序也不会成为隐藏依赖。',
        ],
      },
      run('逐个核对乱序后的可见标题', [
        '先在纸上写出「B 就绪」之后又看到「B 就绪」这两个期望。模拟器保存 latest，start 的每次调用都截取当前票号，然后在兑现后的回调里核对是否仍是最新。下一次请求启动后，旧请求没有权限写回。',
        '运行后暂时去掉票号判断，第二条输出应变成「错误：A」。恢复判断，让 B 先到的测试再次通过。最后在同样的环境里改为 A 先到，验证在 B 已发起的前提下，即使 A 先于 B 完成也不会污染显示。',
        '到综合练习时，把期望写进用例表并运行两种到达顺序。练习中的函数每次调用都要创建一套新任务，避免上一条测试的数据泄漏到下一条。',
      ], `${deferred}
${latestMock}
(async () => {
  const a = deferred();
  const b = deferred();
  const panel = loader();
  const taskA = panel.start(a.promise);
  const taskB = panel.start(b.promise);
  b.release("B 就绪");
  await taskB;
  console.log(panel.shown() === "B 就绪" ? "通过" : "错误：B");
  a.release("A 就绪");
  await taskA;
  console.log(panel.shown() === "B 就绪" ? "通过" : "错误：A");
})()`, '通过\n通过'),
    ],
    pitfalls: [
      { mistake: '测试靠较长的 setTimeout 等结果', why: '运行环境的负载会改变时间，失败难以复查。', fix: '模拟层保存兑现函数，用它确定事件顺序。' },
      { mistake: '编辑器只看最终画面', why: '短暂出现的旧内容可能已经被新内容覆盖。', fix: '按动作设置多个观察点。' },
    ],
    practice: {
      prompt: '实现 async solve(order)，先启动模拟 A 再启动 B，然后按 order 释放两项并记录每步显示。有效 order 恰含 A 和 B 各一次，无效返回 null。',
      checkpoints: ['A 先兑现时仍显示「尚无资料」，B 到达后才出现。', 'B 先兑现后应始终保持 B 的结果，无效顺序无需创建任务。'],
      hints: ['将两组 deferred 与 start 返回值分别存起来。', '循环每次先兑现，再 await 关联的处理任务，最后读取 panel.shown()。'],
      solution: '手动兑现夹具后等待对应的写回任务，再按顺序记录快照；最新票号的判断由 loader 负责。',
    },
    quiz: [
      ['谁决定可控 Promise 何时完成？', ['随机计时器', '测试代码保存的 resolve', 'Promise.all 的结果排序'], 1, '测试用保存的兑现函数明确控制时机。'],
      ['释放后应该优先等待哪个值？', ['处理结果之后的 start 返回值', '固定的 2 秒', '页面某条 CSS'], 0, '这保证观察发生在状态处理完成之后。'],
      ['为什么每条测试创建自己的夹具？', ['复用会使已兑现状态影响后续测试', 'Promise 无法保存字符串', '这样会让加载变慢'], 0, '测试独立，才能重现不同到达顺序。'],
      ['A 先回复，然而较新的 B 已启动，A 能显示吗？', ['能，因为先到', '能，只要可读', '不能，该票号过期'], 2, '写回权在最新请求。'],
    ],
    exercise: checked(
      deferred + '\n' + latestMock + '\nasync function solve(order) {\n  return [];\n}',
      deferred + '\n' + latestMock + `
async function solve(order) {
  if (!Array.isArray(order) || order.length !== 2 || !order.includes("A") || !order.includes("B")) return null;
  const panel = loader();
  const sources = { A: deferred(), B: deferred() };
  const tasks = { A: panel.start(sources.A.promise), B: panel.start(sources.B.promise) };
  const states = [];
  for (const id of order) {
    sources[id].release(id + " 就绪");
    await tasks[id];
    states.push(panel.shown());
  }
  return states;
}`,
      [
        { label: '按开始顺序回传', input: [['A', 'B']], expected: ['尚无资料', 'B 就绪'] },
        { label: '乱序回传', input: [['B', 'A']], expected: ['B 就绪', 'B 就绪'] },
        { label: '重复释放的输入', input: [['A', 'A']], expected: null },
      ], true,
    ),
  }),
]

const batchFixtures = [
  { id: 'JS', ticks: 4, minutes: 12 },
  { id: 'SQL', ticks: 1, failure: '资料暂缺' },
  { id: 'HTML', ticks: 0, minutes: 0 },
]

const batchCases: StudyCase[] = [
  {
    label: '乱序完成且单项失败',
    input: [['JS', 'SQL', 'HTML'], batchFixtures, 2],
    expected: {
      status: 'ok',
      items: [{ id: 'JS', status: 'ready', minutes: 12 }, { id: 'SQL', status: 'error', reason: '资料暂缺' }, { id: 'HTML', status: 'ready', minutes: 0 }],
      peak: 2,
    },
  },
  {
    label: '单工作者且含未知编号',
    input: [['未知', 'JS'], batchFixtures, 1],
    expected: { status: 'ok', items: [{ id: '未知', status: 'error', reason: '未收录' }, { id: 'JS', status: 'ready', minutes: 12 }], peak: 1 },
  },
  { label: '空清单', input: [[], batchFixtures, 3], expected: { status: 'ok', items: [], peak: 0 } },
  { label: '并行数超出范围', input: [['JS'], batchFixtures, 4], expected: { status: 'invalid', items: [], peak: 0 } },
  { label: '清单项不是有效编号', input: [['', 'JS'], batchFixtures, 2], expected: { status: 'invalid', items: [], peak: 0 } },
]

const mock = `async function loadMock(id, fixtures) {
  const fixture = fixtures.find(row => row.id === id);
  if (!fixture) throw new Error("未收录");
  for (let step = 0; step < fixture.ticks; step += 1) await Promise.resolve();
  if (fixture.failure) throw new Error(fixture.failure);
  return fixture.minutes;
}`

export const javascriptAdvanced: AdvancedTrack = {
  direction: 'javascript',
  lessons: javascriptLessons,
  project: {
    title: '学习资料批量加载器',
    summary: '用一套固定的本地资料测试批量加载。保持清单顺序，汇报每项状态，并记录同时等待的峰值。',
    requirements: [
      '实现 async solve(ids, fixtures, limit)。ids 是数组，每项都是两端无空白的非空编号字符串，同名编号按各自的清单位置处理。limit 是 1 到 3 的整数。ids 或 limit 不符合要求时返回 { status: "invalid", items: [], peak: 0 }。',
      '保留已给的 loadMock。fixtures 是题目提供的固定内存数据，保证每项有 id、非负 ticks，以及 minutes 或 failure，无需校验。ticks 只控制 Promise 步骤。开始读取前将活跃数加一并维护峰值，每项结束时都减一。',
      '最多启用 limit 个工作者。每个工作者读完一项就领取下一下标。共享下标必须在 await 前预留，结果写到对应输入位置。成功记录 { id, status: "ready", minutes }，失败记录 { id, status: "error", reason }。',
      '返回 { status: "ok", items, peak }。未知编号作为一项失败保留，空清单是成功且峰值为 0。先核对输出顺序，再确认峰值没有超过上限。',
    ],
    examples: examples(batchCases),
    exercises: [checked(mock + `

async function solve(ids, fixtures, limit) {
  // TODO 校验输入、共享领取下标、按输入位置记录每项结果。
  return { status: "invalid", items: [], peak: 0 };
}`, mock + `

async function solve(ids, fixtures, limit) {
  if (!Array.isArray(ids) || !ids.every(id => typeof id === "string" && id.trim() === id && id.length > 0) ||
      !Number.isInteger(limit) || limit < 1 || limit > 3) {
    return { status: "invalid", items: [], peak: 0 };
  }
  const items = [];
  let next = 0;
  let active = 0;
  let peak = 0;

  async function worker() {
    while (next < ids.length) {
      const index = next;
      next += 1;
      const id = ids[index];
      active += 1;
      peak = Math.max(peak, active);
      try {
        const minutes = await loadMock(id, fixtures);
        items[index] = { id, status: "ready", minutes };
      } catch (error) {
        items[index] = { id, status: "error", reason: error.message };
      } finally {
        active -= 1;
      }
    }
  }

  const workers = [];
  for (let position = 0; position < Math.min(limit, ids.length); position += 1) workers.push(worker());
  await Promise.all(workers);
  return { status: "ok", items, peak };
}`, batchCases, true)],
    explanation: '领取下一项到登记该项正在读取之间没有 await，工作者不会领取同一下标。finally 在成功或失败后都会执行扣减。数组按输入位置写入，结果的排列与回复速度无关。',
  },
}
