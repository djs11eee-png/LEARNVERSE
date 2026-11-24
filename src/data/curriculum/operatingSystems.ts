import { check, demo, exercise, lesson, step } from './advanced/languagesAuthoring'
import type { CourseProject } from './types'

const fill = '  // 在这里实现本节规则。'

const scheduling = lesson({
  id: 'round-robin',
  title: '从就绪队列到时间片',
  summary: '记录单核处理器每个时刻服务了谁，比较先来先服务与轮转的首次等待时间。',
  primer: {
    lead: '两份作业都已就绪，但只有一颗核心。让第一份跑到底很省事，短作业却要等它结束。让任务轮流用一个时间片会发生什么？',
    terms: [
      ['进程', '运行中的程序实例，有自己的执行状态。本章只用名字和剩余工作量代表一个进程。'],
      ['就绪队列', '能够运行、正在等处理器的进程名单。访问设备而等待的进程不在这张名单里。'],
      ['时间片', '调度器本轮允许进程连续占用核心的一段时间。模拟中一个 tick 就是一格时间。'],
    ],
  },
  objectives: ['逐格画出两种调度策略的执行顺序。', '让未完成的进程重新排队，并计算剩余工作量。'],
  sections: [
    step('给比较设定同一组条件',
      '模拟只有一颗核心，所有进程在 tick 0 就绪，队列从左向右表示先后。每占用核心一格，工作量减少 1。进程之间切换时，真实系统要保存和恢复运行状态，本章暂把这项开销当成 0。',
      '先来先服务让队首运行到结束。轮转让队首使用一个时间片，没做完则回到队尾。首次等待用「第一次获得核心的 tick」减去到达 tick；本章到达 tick 都是 0。'),
    demo('javascript', '先来先服务让长任务跑完', [
      'A 需要三格，B 需要一格。jobs 是 tick 0 的初始队列，按 A、B 排列。外层循环按队列选任务，内层循环一次写下一格。join 把数组中的记录连成一行。',
      '按输出给 tick 从 0 编号，B 要等到 tick 3。把 A 改成只需两格，B 的首次等待会降到 2。',
    ], `const jobs = [{ id: "A", ticks: 3 }, { id: "B", ticks: 1 }];
const timeline = [];
for (const job of jobs) {
  for (let used = 0; used < job.ticks; used++) timeline.push(job.id);
}
console.log(timeline.join(" "));`, 'A A A B'),
    demo('javascript', '轮转让未完成的任务重新排队', [
      'shift 取走并返回数组的第一项，push 加到末尾。remaining 保存本轮消耗一格后的剩余工作量。名字相同的记录代表同一个进程。',
      '用上一段的同一组输入，B 在 tick 1 就运行。若先放 B 再放 A，轮转也会先完成 B。轮转改善这个例子的首次等待，真实系统还需要考量切换开销。',
    ], `const queue = [{ id: "A", ticks: 3 }, { id: "B", ticks: 1 }];
const timeline = [];
while (queue.length > 0) {
  const job = queue.shift();
  timeline.push(job.id);
  const remaining = job.ticks - 1;
  if (remaining > 0) queue.push({ id: job.id, ticks: remaining });
}
console.log(timeline.join(" "));`, 'A B A A'),
  ],
  wrapUp: step('用剩余工作量复核调度',
    '逐格记下轮转队列。初始 A:3、B:1。A 运行后队列为 B:1、A:2；B 运行后只剩 A:2；再运行一格，剩 A:1。三格内没有其他作业结束或进入。',
    '下一章为每个进程增加一张自己的页表。之后模拟器每次取出一个进程，都要用该进程的表访问数据。'),
  pitfalls: [
    { mistake: '把未完成任务塞回队头。', why: '原队首会一直优先，轮转退化为先来先服务。', fix: '用 push 放到队尾，让其他就绪进程先用核心。' },
    { mistake: '让剩余工作量为零的任务重新就绪。', why: '它会多占一格，还可能导致队列一直不空。', fix: '只把剩余工作量大于 0 的记录排回去。' },
  ],
  practice: {
    prompt: '写 dispatch(queue, budget)，以一格为时间片，最多执行 budget 格。每条就绪记录的 ticks 为正整数，budget 为非负整数。直接更新传入的 queue，起始代码会把时间线与剩余队列用竖线隔开，空列显示一个短横线。',
    checkpoints: ['A:3 和 B:1 在三格后留下时间线 A B A、队列 A:1。', '预算为零时保留整个初始队列，空队列不消耗预算。'],
    hints: ['循环的两个停止条件是队列为空、时间用尽。', '每轮记下进程名，减掉一格，再决定是否放回队尾。'],
    solution: '先确定本轮占用核心的进程，再减少其剩余量。时间线长度正好是已消耗格数，可直接与预算比较。',
  },
  questions: [
    check('short-job', 'A:3 后接 B:1，先来先服务时 B 第一次运行在第几个 tick？', ['0', '1', '2', '3'], 3, 'A 使用 tick 0、1、2，B 从 3 开始。'),
    check('preempt', '时间片耗尽，A 还剩两格，队列中已有 B。如何重新排队？', ['A B', 'B A', '只有 A', '让 B 等设备'], 1, '未结束的 A 加到队尾。'),
    check('finished', '本轮开始时剩一格，执行后如何处理？', ['加回队尾', '加回队首', '不再入队', '另扣一格'], 2, '它已经完成。'),
    check('tradeoff', '时间片大到足够每个任务一次跑完时，这里的执行顺序像哪一种？', ['先来先服务', '随机选择', '最短任务优先', '倒序'], 0, '每个进程都在被选中后跑到底。'),
  ],
  exercise: exercise('javascript', `function dispatch(queue, budget) {
  const timeline = [];
${fill}
  return (timeline.join(" ") || "-") + " | " +
    (queue.map(job => job.id + ":" + job.ticks).join(",") || "-");
}

console.log(dispatch([{ id: "A", ticks: 3 }, { id: "B", ticks: 1 }], 3));
console.log(dispatch([{ id: "A", ticks: 1 }, { id: "B", ticks: 2 }], 0));
console.log(dispatch([], 5));`, fill, `  while (timeline.length < budget && queue.length > 0) {
    const job = queue.shift();
    timeline.push(job.id);
    if (job.ticks > 1) queue.push({ id: job.id, ticks: job.ticks - 1 });
  }`, 'A B A | A:1\n- | A:1,B:2\n- | -', ['提前停止', '零预算', '空队列']),
})

const pages = lesson({
  id: 'virtual-memory',
  title: '虚拟页、物理页框与隔离',
  summary: '把同一个进程地址翻译成不同的物理地址，在访问前定位无映射的页。',
  primer: {
    lead: '两个进程都写地址 5，操作系统为它们安排的存放位置可以不同。把地址按页分组，页表只需要记录每组的去向。',
    terms: [
      ['虚拟地址', '进程发出的地址，所属的进程决定翻译时用哪张页表。'],
      ['页和页框', '将虚拟空间切成固定大小的页，将物理内存切成同样大小的页框。'],
      ['页表', '为每个虚拟页编号记录对应的物理页框。这里用数组表示，用 null 明确标出未映射。'],
    ],
  },
  objectives: ['用整数商求虚拟页号，用余数求页内偏移。', '给两个进程使用各自的页表，拦截无映射及非法地址。'],
  sections: [
    step('把地址拆成页号和页内偏移',
      '每页四格，从 0 开始编号。虚拟地址 5 相当于 1 × 4 + 1，页号是 1，页内偏移是 1。Math.floor 向下取整，对非负地址相当于取整数商；% 取余数。',
      '翻译时页号会变成物理页框号，偏移保持不变。若第 1 页映射到页框 6，物理地址为 6 × 4 + 1 = 25。真实系统会由硬件和操作系统协作处理页表，本章只模拟地址变换。',
      '手算时写下四列：虚拟地址 5 → 页号 1、偏移 1 → 查页表第 1 项得到页框 6 → 物理地址 25。换成虚拟地址 4，页号和页框仍为 1 和 6，偏移变成 0，所以物理地址为 24。'),
    demo('javascript', '同一虚拟地址在两个进程里指向何处', [
      'A 的第 1 页在页框 6，B 的第 1 页在页框 2。两张页表由操作系统提供，进程输入只包含虚拟地址。先求页，再用本进程的表查页框。',
      '把两处调用的地址都改成 4，偏移会变成 0，结果分别为 24 和 8。',
    ], `function physical(pages, address) {
  const page = Math.floor(address / 4);
  const offset = address % 4;
  return pages[page] * 4 + offset;
}
console.log(physical([1, 6], 5));
console.log(physical([3, 2], 5));`, '25\n9'),
    demo('javascript', '在取不到页框时停止', [
      '合法地址必须是非负整数。数组中的 null 表示这页未映射，读到数组范围外的项会得到 undefined。Number.isInteger 对这两种值都返回 false，对页框 0 返回 true。',
      '下方只输出是否得到映射。地址 3 使用框 0；地址 4 对应明确未映射的页；地址 8 超出表的范围。',
    ], `function mapped(pages, address) {
  if (!Number.isInteger(address) || address < 0) return false;
  const frame = pages[Math.floor(address / 4)];
  return Number.isInteger(frame);
}
console.log(mapped([0, null], 3));
console.log(mapped([0, null], 4));
console.log(mapped([0, null], 8));`, 'true\nfalse\nfalse'),
  ],
  wrapUp: step('把翻译结果用作写入条件',
    '页内第一格的偏移为 0，最后一格为 3。地址跨过页尾时就要查新的一页，即使新页与上一页在虚拟地址里相邻，两个物理页框也可以相隔很远。',
    '结课项目会在本次地址翻译失败时结束该进程。下一章练习如何让这种中断不留下半批可见的修改。'),
  pitfalls: [
    { mistake: '用 if (!frame) 判断没有映射。', why: '页框 0 也是合法的物理位置。', fix: '用 Number.isInteger 检查表项。' },
    { mistake: '用其他进程的页表替当前进程翻译。', why: '会读写另一应用原本独立的空间。', fix: '切换进程时一同切换页表。本实验中预先为每个进程分配互不重叠的页框。' },
  ],
  practice: {
    prompt: '实现 translate(pages, address)。每页四格。输入的表项是非负整数或 null。正常时返回物理地址，负数、小数和无映射页返回字符串 FAULT。',
    checkpoints: ['页表 [0, 3] 翻译地址 0 得到 0，翻译 7 得到 15。', '负数、小数、空洞和超出页表均返回 FAULT。'],
    hints: ['先拦截不合法的虚拟地址，再访问页表。', '通过整数检查取到页框后，才计算 frame × 4 + offset。'],
    solution: '先确认地址合法，再确认存在页框。把这两个检查放在算物理地址之前，以免把空洞误算成页框零。',
  },
  questions: [
    check('quotient', '页大小为 4，虚拟地址 7 的页号和偏移是多少？', ['0 和 7', '1 和 3', '3 和 1', '2 和 0'], 1, '7 = 1 × 4 + 3。'),
    check('same-offset', '页框 6、偏移 1 对应哪个物理地址？', ['6', '7', '24', '25'], 3, '6 × 4 + 1 = 25。'),
    check('zero-frame', '表项等于数字 0 代表什么？', ['没有表项', '表已满', '映射到页框 0', '异常退出'], 2, '页框编号从 0 开始。'),
    check('cross-process', '同一虚拟地址为什么能被两个进程独立使用？', ['进程各用自己的页表', '偏移永远为 0', '硬件会更改输入', '两进程必须共用一个页框'], 0, '使用各自的页表可指向不同的物理页框。'),
  ],
  exercise: exercise('javascript', `function translate(pages, address) {
${fill}
}

console.log(translate([0, 3], 0), translate([0, 3], 7));
console.log(translate([0, null], 4), translate([0], 8));
console.log(translate([0], -1), translate([0], 2.5));`, fill, `  if (!Number.isInteger(address) || address < 0) return "FAULT";
  const frame = pages[Math.floor(address / 4)];
  if (!Number.isInteger(frame)) return "FAULT";
  return frame * 4 + address % 4;`, '0 15\nFAULT FAULT\nFAULT FAULT', ['正常和页尾', '未映射页', '无效地址']),
})

const journal = lesson({
  id: 'journal-replay',
  title: '中断之后怎样恢复数据',
  summary: '用暂存事件与提交标记复原文件索引，检查提交前断电和重复回放。',
  primer: {
    lead: '程序可能只写完一半就断电。把同一批变化先记入日志，等到提交标记也保存后，再让恢复程序承认这一批变化。',
    terms: [
      ['日志', '按发生顺序写入的记录。本课记录文件名对应的数据块编号。'],
      ['事务与提交', '需要一起确认的一组变化。提交标记说明同组变化都已进入本课的持久日志。'],
      ['重放', '从初始状态读取日志，按记录重建数据。本课把初始状态定义为空索引。'],
    ],
  },
  objectives: ['只重放已经提交的变化，并说明未提交的记录为什么不可见。', '让覆盖写入支持重复重放，比较提交前后的恢复结果。'],
  sections: [
    step('让文件索引只看到完整的一组变化',
      '这里的文件索引记录「文件 → 数据块号」。把文件移到新数据块时，可能要同时改变索引和数据块的占用记录。直接改这些位置，崩溃时容易只留下其中一项。课堂模型先记录一组变化，再写提交标记。',
      '模拟假定事件按顺序持久化，提交标记之前的事件已完整写入。真实系统还要处理刷盘时序、损坏的记录和检查点，课程模型用于练习如何从完整日志前缀得到一致结果。'),
    demo('javascript', '比较提交前后两个日志前缀', [
      '前缀就是从第一条开始连续读到某个位置。模拟日志只有一组变化，写入把 plan 指向块 6，提交后会返回 6。',
      'slice(0, 1) 取第一个事件。此时没有提交标记，应得到空索引。把 slice 的终点改为 2 就会读到提交。',
    ], `const log = [{ type: "stage", block: 6 }, { type: "commit" }];
function recover(events) {
  let pending = null;
  let visible = null;
  for (const event of events) {
    if (event.type === "stage") pending = event.block;
    if (event.type === "commit" && pending !== null) visible = pending;
  }
  return visible === null ? "空" : visible;
}
console.log(recover(log.slice(0, 1)));
console.log(recover(log));`, '空\n6'),
    demo('javascript', '为交错的两组变化分别暂存', [
      'A 和 B 的事件可能交错。Map 是按键取值的表，set 写入，get 读取，has 检查条目，delete 清掉条目。用事务名作为键，就能在 B 提交时只公开 B 的值。示例只公开同一个文件的位置，以便观察结果。',
      '在最后加一条 A 的提交事件，值会变成 3，因为此时 A 的提交更晚。同一条提交记录被重复读到时，暂存已清空，结果保持原样。',
    ], `const log = [
  { type: "stage", id: "A", block: 3 },
  { type: "stage", id: "B", block: 8 },
  { type: "commit", id: "B" },
  { type: "commit", id: "B" },
];
const pending = new Map();
let visible = null;
for (const event of log) {
  if (event.type === "stage") pending.set(event.id, event.block);
  if (event.type === "commit" && pending.has(event.id)) {
    visible = pending.get(event.id);
    pending.delete(event.id);
  }
}
console.log(visible);`, '8'),
  ],
  wrapUp: step('在提交点两侧各重放一次',
    '先只读到 B 暂存，确认 A 和 B 都不可见。再读到 B 提交，读出 8，再追加 A 提交，得到 3。这样可以用几个明确的中断位置复核恢复规则。',
    '结课项目会把同一进程的多次写入收集成一组。进程成功结束时提交整组。只要还缺一次写入，整组在重启后都不出现。'),
  pitfalls: [
    { mistake: '读取暂存事件就改文件索引。', why: '提交前中断也会留下部分变化。', fix: '分别维护暂存和可见状态，读到提交事件才更新可见状态。' },
    { mistake: '用一个变量存所有进程的暂存值。', why: '不同进程交错写入时，后来的暂存会覆盖前一组。', fix: '用唯一事务名区分待提交的数据。' },
  ],
  practice: {
    prompt: '补全 recover(events)。每个事务只有一个 stage，提交可能缺失或在原提交之后重复。提交将事务的 block 写入同一个可见索引，返回最后可见的块号。空索引返回字符串 空。',
    checkpoints: ['A 暂存、B 暂存、A 提交后，显示 A 的块号。', '只有暂存时返回 空，块号 0 提交后仍应显示 0。'],
    hints: ['用 Map 按事务名分别保存块号，并用 has 判断有没有暂存。', '提交后删除暂存。最后用 visible === null 判断索引是否为空。'],
    solution: '按日志顺序扫描，事务待确认的值与文件对外可见的值分别保存在 Map 和 visible。提交事件是两者发生关联的唯一入口。',
  },
  questions: [
    check('prefix', '日志读到 stage，后面还没有 commit，恢复时应公开什么？', ['刚暂存的值', '此前已提交的值', '所有待提交项', '时间片长度'], 1, '只有持久化的提交标记能使本组数据可见。'),
    check('owners', 'A 暂存 3、B 暂存 8、A 提交后，哪一个值可见？', ['空', '3', '8', '11'], 1, '提交通过事务名找到 A 对应的暂存记录。'),
    check('zero', '暂存块号 0 已存在，哪个方法能判定 Map 中有该事务？', ['直接判断 get 的结果真假', '用 has 检查键', '把块号设为 1', '查看最新事件类型即可'], 1, 'has 检查是否存在，0 作为值也能被正确识别。'),
    check('idempotent', '同一提交事件被重复读到，为什么示例中的结果保持原样？', ['第一次提交后已清除暂存', '每次都加 1', '重复提交会清空文件索引', '只保留第一条日志'], 0, '之后读到同名提交时已没有待确认的值。'),
  ],
  exercise: exercise('javascript', `function recover(events) {
${fill}
}
const a = { type: "stage", id: "A", block: 3 };
const b = { type: "stage", id: "B", block: 8 };
const zero = { type: "stage", id: "C", block: 0 };
const commitA = { type: "commit", id: "A" };
console.log(recover([a, b, commitA, commitA]));
console.log(recover([a, b]));
console.log(recover([zero, { type: "commit", id: "C" }]));`, fill, `  const pending = new Map();
  let visible = null;
  for (const event of events) {
    if (event.type === "stage") pending.set(event.id, event.block);
    if (event.type === "commit" && pending.has(event.id)) {
      visible = pending.get(event.id);
      pending.delete(event.id);
    }
  }
  return visible === null ? "空" : visible;`, '3\n空\n0', ['交错与重放', '提交前中断', '零值块号']),
})

const desk = exercise('javascript', `function runDesk(jobs, cutoff) {
  const queue = jobs.map(job => ({ ...job, next: 0, staged: [] }));
  const trace = [];
  const faults = [];
  const committed = [];
  function translate(pages, address) {
    if (!Number.isInteger(address) || address < 0) return null;
    const frame = pages[Math.floor(address / 4)];
    return Number.isInteger(frame) ? frame * 4 + address % 4 : null;
  }
${fill}
  const recovered = new Map();
  for (const group of committed) {
    for (const entry of group) recovered.set(entry.address, entry.value);
  }
  const values = [];
  for (const [address, value] of recovered) values.push(address + "=" + value);
  return (trace.join(" ") || "-") + " | " +
    (faults.join(",") || "-") + " | " + (values.join(",") || "-");
}

const a = { id: "A", pages: [0], writes: [[0, 4], [1, 7]] };
const b = { id: "B", pages: [2], writes: [[0, 9]] };
const broken = { id: "A", pages: [0], writes: [[0, 4], [4, 7]] };
console.log(runDesk([a, b], 9));
console.log(runDesk([a, b], 2));
console.log(runDesk([broken, b], 9));
console.log(runDesk([a, b], 0));`, fill, `  while (queue.length > 0 && trace.length < cutoff) {
    const job = queue.shift();
    trace.push(job.id);
    const write = job.writes[job.next];
    const address = translate(job.pages, write[0]);
    if (address === null) {
      faults.push(job.id);
      continue;
    }
    job.staged.push({ address, value: write[1] });
    job.next++;
    if (job.next === job.writes.length) committed.push(job.staged);
    else queue.push(job);
  }`, 'A B A | - | 8=9,0=4,1=7\nA B | - | 8=9\nA B A | A | 8=9\n- | - | -', ['两进程完成', '断电截断', '地址错误', '开始前断电'])

const project: CourseProject = {
  title: '结课项目 · 可恢复的作业台',
  summary: '两个校园服务共用一颗模拟核心。交付调度和恢复报告，说明哪些作业曾经运行、哪些作业失败，以及重启后能恢复什么。',
  requirements: [
    '所有作业都在 tick 0 就绪，名字唯一，页框互不重叠，每个作业至少有一次写入。每条 write 是 [虚拟地址, 数值]，每个 tick 尝试一次，直到执行完毕或达到非负整数 cutoff。',
    '每 tick 取出队首，先把名字加进 trace，再用提供的 translate 翻译地址。如果失败，在 faults 记录名字，移除该作业，丢弃它的全部暂存写入。失败的尝试也占一格。',
    '成功时把 { address, value } 加到 job.staged，再推进 job.next。还有写入则排到队尾，全部成功时把整批 staged 放入 committed。模拟假定最后一次写入和提交发生在同一 tick。',
    '起始代码已经提供队列初始化和恢复部分。job 初始化时用 ...job 拷贝原字段，再为执行单独保存 next 和 staged。恢复顺序按提交组排列，组内按写入顺序。同一地址重复写入时保留最后一个值，显示位置按第一次出现的顺序。显示用 | 分隔时间线、地址失败清单、恢复值，空列用 -。',
  ],
  examples: [
    { label: '两进程完成', input: 'A 写 0=4 与 1=7，B 写虚拟地址 0=9。B 的页框为 2。运行 9 格以内。', expected: 'A B A | - | 8=9,0=4,1=7' },
    { label: '断电截断', input: '沿用正常用例，第 2 格结束后中断。', expected: 'A B | - | 8=9' },
    { label: '地址错误', input: 'A 的第二次写入改为地址 4，A 只有一页。', expected: 'A B A | A | 8=9' },
    { label: '开始前断电', input: '沿用正常用例，预算为 0。', expected: '- | - | -' },
  ],
  exercises: [desk],
  explanation: '地址翻译发生在写入尝试之前。每个作业自己的暂存和下次写入位置随调度保留，恢复程序只扫描已提交的组。正常用例中，A 在 tick 0 暂存第一笔，B 在 tick 1 写完并提交，A 在 tick 2 提交。把 cutoff 从 1 改到 2、3，先看到空结果，再只看到 B，最后两组都能恢复。',
}

export const operatingSystems = { lessons: [scheduling, pages, journal], project }
