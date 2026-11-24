import type { AdvancedTrack } from '../types'
import { checked, examples, lesson, run } from './webGuide'
import type { StudyCase } from './webGuide'

const cache = `function simulate(blocks, capacity, policy) {
  const slots = [];
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let refreshes = 0;
  for (const block of blocks) {
    const position = slots.indexOf(block);
    if (position !== -1) {
      hits += 1;
      if (policy === "LRU") {
        slots.splice(position, 1);
        slots.push(block);
        refreshes += 1;
      }
      continue;
    }
    misses += 1;
    if (capacity === 0) continue;
    if (slots.length === capacity) {
      slots.shift();
      evictions += 1;
    }
    slots.push(block);
  }
  return { hits, misses, evictions, refreshes };
}`

const computerScienceLessons = [
  lesson({
    id: 'locality-working-set', title: '从访问序列识别局部性与工作集',
    summary: '把地址归入块，用滑动窗口看最近经常被访问的内容。',
    primer: {
      lead: '程序并不会同等频繁地阅读所有数据。它常在很短时间内再次读到同一处，或者顺手读取附近的数据。缓存利用这些行为减少离开快速存储的次数。',
      terms: [['时间局部性', '近期访问的项目可能很快再被访问'], ['空间局部性', '一次访问的邻近位置可能接下来被访问'], ['工作集', '在选定时间窗口中访问过的不同项目集合']],
    },
    objectives: ['把整数地址映射到固定大小的块。', '用工作集大小解释局部性与容量的关系。'],
    sections: [
      run('把相邻地址放回同一块中', [
        '假设块大小为 4 个地址单位。块 0 覆盖地址 0 到 3，块 1 覆盖 4 到 7。地址除以块大小再向下取整，就能找到所属编号。这个简化模型从 0 开始编号，用 Math.floor 对非负整数作整除。',
        '一次访问地址 1 后，如果同一块被留在缓存里，接着访问地址 3 就可能复用它。例子中的前两项正好同块，第三项跨到下一块。最后访问 1 又回到了之前的块，既能从序列中辨认空间相邻，也能观察重复返回的时间关系。',
        '运行后把块大小改成 2，再核对地址 1 和 3 会不会同块。尝试比较 [0, 1, 2, 3] 与 [0, 4, 8, 12]。同样有四次访问，地址覆盖的块数可以完全不同。',
      ], `const addresses = [1, 3, 4, 1];
const blockSize = 4;
for (const address of addresses) {
  const block = Math.floor(address / blockSize);
  console.log(address + " → " + block);
}`, '1 → 0\n3 → 0\n4 → 1\n1 → 0'),
      {
        heading: '让窗口只描述最近一段工作',
        paragraphs: [
          '先固定窗口的长度。例如观察最近 3 次对块序列 [0, 1, 0, 2, 2] 的访问，取到尾段 [0, 2, 2]。去重后得到工作集 {0, 2}，大小为 2。窗口走到别处可能看到不同的集合，所以一条轨迹往往需要多个观察点。',
          '工作集只是访问模式的描述。容量为 2 时能装进最近这两个块，但缓存是否真的保留它们还取决于替换历史和策略。不能从“工作集大小不超容量”直接推出每次访问都命中。',
          '地址与块不要混为一谈。访问 3 和访问 2 在原始序列中是两笔不同记录，但块大小为 4 时它们由同一个块服务。报告应同时保留所用的地址单位、块大小和窗口长度，方便别人重跑同一个实验。',
        ],
      },
      run('查看窗口移动后哪些块还活跃', [
        'slice(start, end) 复制从 start 到 end 之前的元素。把 end 设成当前已观察到的访问数，再用 end - width 找到窗口起点。开始几轮数据不足时，用 Math.max(0, …) 避免负索引。',
        'Set 用来保存不同的块。这里打印为数组时沿第一次出现的顺序查看，不需要把它排序。先手算读到第三项时的工作集，再运行核对。增加新的访问 3，看看哪一块走出最近三次。',
        '在本章综合题中只需要最终一段工作集。可以从整条块序列末尾切片，但 width 为 0 时也应自然得到空窗口。计算显式起点比直接写 slice(-width) 更稳妥，因为 JavaScript 的 -0 与 0 会取到整张表。',
      ], `const trace = [0, 1, 0, 2, 2];
const width = 3;
for (let end = 1; end <= trace.length; end += 1) {
  const start = Math.max(0, end - width);
  const recent = trace.slice(start, end);
  console.log([...new Set(recent)].join(","));
}`, '0\n0,1\n0,1\n1,0,2\n0,2'),
    ],
    pitfalls: [
      { mistake: '用四舍五入找块', why: '块号取决于完整跨过了几个块。', fix: '对地址除以块大小再向下取整。' },
      { mistake: '把最近窗口长度当工作集大小', why: '同一块可出现在多个位置。', fix: '用 Set 去重后计算数量。' },
    ],
    practice: {
      prompt: '实现 solve(addresses, blockSize, window)，返回 { blocks, active }。active 为末窗口中去重后的块号，保持第一次出现的顺序。blockSize 为正整数，window 为非负整数，地址须为非负整数，否则返回 null。',
      checkpoints: ['窗口不足时检查全部已读取块，零窗口返回空 active。', '保持原序列，不把相邻地址直接当成各自不同的缓存块。'],
      hints: ['将每个地址转换成块号，先打印 blocks 对照。', '从 Math.max(0, blocks.length - window) 处切片，再用 Set 去重。'],
      solution: '先检查输入结构。逐个地址求块号，再按窗口边界取尾部并保留各块的首次出现。',
    },
    quiz: [
      ['大小为 4 的块中，地址 7 属于哪块？', ['0', '1', '2'], 1, 'Math.floor(7 / 4) 为 1。'],
      ['相邻的地址一定在同一块吗？', ['不一定，可能正跨过边界', '一定', '始终在不同块'], 0, '3 和 4 相邻，但大小为 4 时属于两个块。'],
      ['[0, 2, 2] 的工作集大小是什么？', ['1', '3', '2'], 2, '不同块只有 0 和 2。'],
      ['从工作集得到的直接信息是什么？', ['观察窗内访问过哪些不同的块', '所有访问的命中率', '每个块的物理地址'], 0, '替换历史与容量仍会影响命中。'],
    ],
    exercise: checked(
      'function solve(addresses, blockSize, window) {\n  return { blocks: [], active: [] };\n}',
      `function solve(addresses, blockSize, window) {
  if (!Array.isArray(addresses) || !addresses.every(value => Number.isInteger(value) && value >= 0) ||
      !Number.isInteger(blockSize) || blockSize < 1 || !Number.isInteger(window) || window < 0) return null;
  const blocks = addresses.map(value => Math.floor(value / blockSize));
  return { blocks, active: [...new Set(blocks.slice(Math.max(0, blocks.length - window)))] };
}`,
      [
        { label: '有相邻和重复访问', input: [[1, 3, 4, 1], 4, 3], expected: { blocks: [0, 0, 1, 0], active: [0, 1] } },
        { label: '零观察窗口', input: [[0, 4], 4, 0], expected: { blocks: [0, 1], active: [] } },
        { label: '负地址', input: [[0, -1], 4, 3], expected: null },
      ],
    ),
  }),
  lesson({
    id: 'cache-fifo-lru', title: '逐步模拟 FIFO 与 LRU',
    demo: 'lru-cache',
    summary: '在相同容量下，比较先进入者与最久未访问者的淘汰顺序。',
    primer: {
      lead: '可以把缓存想成学习桌上只摆得下两本书。桌已经满时，拿第三本就得收走一本。FIFO 与 LRU 用不同办法决定收走谁。',
      terms: [['命中', '需要的内容已在缓存'], ['淘汰', '为新内容腾位置时移除已有块'], ['FIFO', '按进入缓存的先后决定淘汰'], ['LRU', '按最近使用时间决定淘汰']],
    },
    objectives: ['逐步跟踪缓存命中、未命中和淘汰。', '在同一序列上解释两种策略为什么给出不同结果。'],
    sections: [
      run('让 FIFO 的队头记录最先进入者', [
        '用一个数组表示两格缓存，约定左边最早进入，右边最晚进入。includes 检查块是否已经存在。命中时可以立即报告成功，FIFO 不移动数组。遇到未命中，若两格都满，用 shift 取走最左一项，再用 push 放到右端。',
        '从空表起模拟 A、B、A、C、A。第三次 A 是命中，仍在左边；第四次 C 需要腾位置，因此先进入的 A 被移出。第五次又访问 A，只好进一步移出 B。',
        '逐行核对下面的桌面状态。把第四项 C 改为 B，试算两次连续命中会不会改变进入顺序。若某次 miss 时桌面还未满，就有装入但没有淘汰，这两个计数要分开。',
      ], `const slots = [];
for (const key of ["A", "B", "A", "C", "A"]) {
  if (slots.includes(key)) {
    console.log("命中：" + slots.join(","));
    continue;
  }
  if (slots.length === 2) slots.shift();
  slots.push(key);
  console.log("未命中：" + slots.join(","));
}`, '未命中：A\n未命中：A,B\n命中：A,B\n未命中：B,C\n未命中：C,A'),
      {
        heading: '让 LRU 的队头记录最久未访问者',
        paragraphs: [
          '沿用左旧右新的数组，新进入的块放右边。命中时暂时从原位置移除该块，再将其追加在最右边。这样队头代表最久没有被访问的块，而不是进入时间最早的块。indexOf 找出位置，-1 表示没有那个值。',
          '使用 splice(position, 1) 前先核对 position 不为 -1。JavaScript 接受负下标，splice(-1, 1) 会删掉最后一项，数据悄悄变了。若忘记移除命中块又 push，同一个块会占两格。',
          '跟踪应用时每步可记录［前状态、当前块、命中或未命中、后状态］，发现问题可以回溯到具体一笔。数组模型适合学习和小规模可重放测试，真实缓存的实现还要考虑移动记录的开销。',
        ],
      },
      run('用同一段轨迹观察策略在何处分岔', [
        '本例对同样的序列分别运行 FIFO 与 LRU。输入先开始时为空，容量相等。改变 policy 是两次模拟中唯一的一项，结果差异可以归因于替换策略。',
        '先预测第四次访问哪个块会走。FIFO 的第三次命中 A 不改顺序，第四次淘汰 A；LRU 会把 A 刷新到右端，第四次淘汰 B。查看第五次 A 的命中差异。再把容量由 2 改为 3，试算两种结果是否相同。',
        '若容量为 0，每次访问都未命中，不保留块，也不会淘汰，因为缓存里从来没有块。这比模拟时始终执行 shift 更准确，后续成本比较也会用到这个边界。',
      ], `${cache}
for (const policy of ["FIFO", "LRU"]) {
  const result = simulate(["A", "B", "A", "C", "A"], 2, policy);
  console.log(policy + "：" + result.hits + " 次命中，" + result.evictions + " 次淘汰");
}`, 'FIFO：1 次命中，2 次淘汰\nLRU：2 次命中，1 次淘汰'),
    ],
    pitfalls: [
      { mistake: 'FIFO 在命中时改变顺序', why: '队头变成最近访问顺序，策略被改了。', fix: 'FIFO 命中只改计数。' },
      { mistake: '容量为 0 时仍装入一个块', why: '假容量会出现不存在的命中。', fix: '计一次 miss 然后直接处理下一个块。' },
    ],
    practice: {
      prompt: '实现 solve(blocks, capacity, policy)，模拟指定策略，返回 hits、misses、evictions、refreshes。LRU 命中计一次刷新。容量为非负整数，策略只接受 FIFO 和 LRU，非法返回 null。',
      checkpoints: ['命中与未命中数相加等于访问数。', '容量为零不装入或淘汰，FIFO 刷新始终为 0。'],
      hints: ['为 FIFO 先写队头最老的数组，处理命中与未命中。', '在命中分支给 LRU 加“按下标移除并放到尾端”，增记一次刷新。'],
      solution: '每次先查是否命中。只有 LRU 命中时更新顺序，只有容量大于 0 且满时 miss 才会淘汰。',
    },
    quiz: [
      ['FIFO 命中时需要改缓存顺序吗？', ['需要，置末尾', '无需，仍按进入顺序', '需要，置队头'], 1, '访问不使进入日期改变。'],
      ['LRU 淘汰谁？', ['最近刚访问', '最久没被访问的块', '块号最大'], 1, '把最近使用的块留在缓存里。'],
      ['空缓存有两格，首次 miss 会淘汰吗？', ['会', '只在 FIFO 会', '不会，有空闲格'], 2, '未命中只需首次装入，不用替换旧块。'],
      ['A、B、A、C 连访，容量 2，LRU 淘汰谁？', ['A', 'B', 'C'], 1, 'A 在第三次访问后比 B 更新。'],
    ],
    exercise: checked(
      'function solve(blocks, capacity, policy) {\n  return { hits: 0, misses: 0, evictions: 0, refreshes: 0 };\n}',
      cache + `
function solve(blocks, capacity, policy) {
  if (!Number.isInteger(capacity) || capacity < 0 || !["FIFO", "LRU"].includes(policy)) return null;
  return simulate(blocks, capacity, policy);
}`,
      [
        { label: 'FIFO 保持初始顺序', input: [['A', 'B', 'A', 'C', 'A'], 2, 'FIFO'], expected: { hits: 1, misses: 4, evictions: 2, refreshes: 0 } },
        { label: 'LRU 更新最近访问', input: [['A', 'B', 'A', 'C', 'A'], 2, 'LRU'], expected: { hits: 2, misses: 3, evictions: 1, refreshes: 2 } },
        { label: '零容量', input: [['A', 'A'], 0, 'LRU'], expected: { hits: 0, misses: 2, evictions: 0, refreshes: 0 } },
        { label: '未知策略', input: [['A'], 1, 'unknown'], expected: null },
      ],
    ),
  }),
  lesson({
    id: 'cache-weighted-cost', title: '把命中率和维护开销放进同一成本表',
    summary: '按明确公式计算总成本，并让无访问时的比率具有清楚含义。',
    primer: {
      lead: '命中更多通常有好处，但更复杂的策略会花时间追踪最近使用情况。通用比较要同时看省下了多少和为了省下它付出了多少。',
      terms: [['命中率', '命中次数除以总访问次数'], ['权重', '一种操作在总成本中计入的单位数量'], ['维护开销', '为维持缓存结构而付出的额外操作']],
    },
    objectives: ['从统计值与价格假设计算总成本。', '区分未测量、0% 命中和 100% 命中。'],
    sections: [
      run('给不同操作标出单价', [
        '先明确计费规则。本章约定命中计一次命中费用，未命中计一次读取费用，加上策略维护费用。把统计项乘各自的价格再求和。这里不另外对淘汰计费，因为示例假设读取费用包含移走旧块的工作。',
        '观察一次表格：3 次命中各 1 单位，2 次未命中各 6 单位，3 次刷新各 2 单位，总和是 3 + 12 + 6，等于 21。单项清单能帮助解释报告，价格变化后也方便重新计算而无需重放地址。',
        '先运行核对每部分。把刷新单价改为 0 模拟几乎没有维护成本的情况。再把 miss 的 6 改为 20，预测未命中成本会抬高多少。实际价格可能随平台和工作负载改变，报告要写明使用了哪套假设。',
      ], `const data = { hits: 3, misses: 2, refreshes: 3 };
const hit = data.hits * 1;
const miss = data.misses * 6;
const maintenance = data.refreshes * 2;
console.log(hit + " + " + miss + " + " + maintenance);
console.log(hit + miss + maintenance);`, '3 + 12 + 6\n21'),
      {
        heading: '在同一口径下比较命中和时间',
        paragraphs: [
          '算命中率使用 hits + misses 作分母。如果一次访问也没有，就用 null 表示无测量数据。用 0% 会让人误以为真的发生了访问且没有任何命中。对空轨迹仍可报告总成本为 0，因为三项成本都没有发生。',
          '命中率和总成本回答不同问题。一种策略命中率更高但维护开销也高，可能仍更贵；在某个平台上恰好相反。总成本是在声明过的模型下提供的一项可比较指标，不应读作实际测到的毫秒数。',
          '命中、未命中、刷新次数来自固定规则的回放。费用参数不能是负数；演示用整数单位便于在表格中核对。选错模型时最精确的对比数字也可能误导，所以先保留每个构成项，再决定报告看什么。',
        ],
      },
      run('切换维护费用看排序如何反转', [
        '假设两种策略访问数都是 5，FIFO 命中 2 次，LRU 命中 3 次，并为三次命中支付刷新费用。命中价 1、未命中价 6。若刷新单价为 0，LRU 成本为 15，比 FIFO 的 20 少。',
        '现在把每次刷新费设为 3。LRU 多付 9，总价变成 24，比 FIFO 更贵。要理解这一次反转，可以分别跟踪“少一次未命中省 5”与“三次刷新花 9”，无需记住哪一种策略在所有平台都快。',
        '运行后搜索一个恰好相等的整数单价组合。可以保持刷新为 1，再把 miss 的单价调成 4，注意此时减少的未命中费用差为 3。并列结果在后面的项目里应明确输出 tie。',
      ], `function cost(hits, misses, refreshes, refreshPrice) {
  return hits + misses * 6 + refreshes * refreshPrice;
}
for (const price of [0, 3]) {
  console.log("刷新价 " + price + "：" + cost(2, 3, 0, price) + " / " + cost(3, 2, 3, price));
}`, '刷新价 0：20 / 15\n刷新价 3：20 / 24'),
    ],
    pitfalls: [
      { mistake: '命中率更高就认定总成本更低', why: '维护费用可能改变结论。', fix: '单独比较计价后的总成本。' },
      { mistake: '空轨迹命中率写 0%', why: '没有任何可用测量对应分母。', fix: '使用 null 表示无数据。' },
    ],
    practice: {
      prompt: '实现 solve(stats, prices)，分别提供 hits/misses/refreshes 与 hit/miss/refresh，均为非负整数。回传 { accesses, hitRate, cost }，空轨迹的 hitRate 为 null，非法数值返回 null。',
      checkpoints: ['cost 由三项独立相乘后相加，和命中率的比例无关。', '拒绝负数与文本数字。'],
      hints: ['先检查需读取的六个值，再相加求 accesses。', '命中率先判断分母，成本分别按 prices 中相应字段计。'],
      solution: '访问数是 hits + misses；空时不用除。三个统计值分别乘参数给定的费用并求和。',
    },
    quiz: [
      ['3 次命中、1 次未命中的命中率？', ['1/4', '3/4', '4/3'], 1, '分母是四次总访问。'],
      ['零次访问的命中率怎么记？', ['null 表示无数据', '1', '必然 0'], 0, '没有可用分母。'],
      ['什么变化会让策略成本排序反转？', ['改变输出颜色', '改变维护操作单价', '改变表头文字'], 1, '成本取决于操作数与每项权重。'],
      ['一次 miss 的价格已包含淘汰费用时怎么办？', ['不再重复叠加', '全记为命中', '总价除以二'], 0, '一笔操作只按已说明的定义计费。'],
    ],
    exercise: checked(
      'function solve(stats, prices) {\n  return { accesses: 0, hitRate: null, cost: 0 };\n}',
      `function solve(stats, prices) {
  const { hits, misses, refreshes } = stats;
  const { hit, miss, refresh } = prices;
  if (![hits, misses, refreshes, hit, miss, refresh].every(value => Number.isInteger(value) && value >= 0)) return null;
  const accesses = hits + misses;
  return { accesses, hitRate: accesses === 0 ? null : hits / accesses, cost: hits * hit + misses * miss + refreshes * refresh };
}`,
      [
        { label: '加权费用', input: [{ hits: 3, misses: 1, refreshes: 2 }, { hit: 1, miss: 6, refresh: 2 }], expected: { accesses: 4, hitRate: 0.75, cost: 13 } },
        { label: '零次访问', input: [{ hits: 0, misses: 0, refreshes: 0 }, { hit: 1, miss: 6, refresh: 2 }], expected: { accesses: 0, hitRate: null, cost: 0 } },
        { label: '负的维护费', input: [{ hits: 1, misses: 0, refreshes: 1 }, { hit: 1, miss: 6, refresh: -2 }], expected: null },
      ],
    ),
  }),
  lesson({
    id: 'reproducible-cache-comparison', title: '让缓存策略对照可以重跑',
    summary: '控制输入与初始条件，从多种轨迹得到可追踪的策略判断。',
    primer: {
      lead: '同一组跑分能被别人重做，才知道差异来自策略还是实验起点。先固定数据和设置，再比较输出。',
      terms: [['冷启动', '测量开始时缓存为空'], ['对照实验', '控制其它条件，只改变需要比较的因素'], ['复现', '用同样的安排得到同样的记录和结论']],
    },
    objectives: ['从同一起点比较两个实现。', '用边界和反例检验报告的解释范围。'],
    sections: [
      run('从同一份冷启动轨迹出发', [
        '对同一个缓存大小与访问序列，分别运行两种策略。不要先运行策略 A 后把它留下的缓存交给策略 B，否则第二组继承了第一组的工作。让 simulate 在内部每次都创建空数组，顺序颠倒时结果也应一致。',
        '跟踪固定案例短序列 A、B、A、C、A，使用这条规则得到的差异才可解释。先核对返回的命中数和未命中数相加等于输入长度，再看两个策略的更新规则是否在意料之中的位置分开。',
        '运行后交换循环里的策略顺序，比较每个策略的记录是否不变。再把长度为零的列表交给每个策略，核对报告的命中、未命中、淘汰全为 0。测试无需生成随机数，别人可以用同一组序列手算。',
      ], `${cache}
const visitOrder = ["A", "B", "A", "C", "A"];
for (const policy of ["FIFO", "LRU"]) {
  const result = simulate(visitOrder, 2, policy);
  console.log(policy + "：" + result.hits + "/" + (result.hits + result.misses));
}`, 'FIFO：1/5\nLRU：2/5'),
      {
        heading: '跨几种输入观察模型的适用边界',
        paragraphs: [
          '高局部性的轨迹可能连续读同一块，看两法都能多快走到稳定状态。顺序扫描远大于容量的区域时，复用机会会降低。混合的轨迹能帮助看到切换阶段。用预先准备的多种序列防止从一个例子过早得出普遍结论。',
          '报告中记录策略、块宽、容量、初始状态、各操作数和成本假设。对于相同的轨迹，同一策略总应给出相同数字。若更改容量或刷新成本，结果可以变化，但读者应知道具体改了哪一项。',
          '比较时不要外推很远。本章的数组模拟没有真实 CPU 并行、预取、内存层次或写回。结论仅覆盖固定轨迹与设置。遇到结果一样时可以明确标为 tie，再通过另外几条轨迹检验是否稳定。',
          '可以保存一条小轨迹用作回归基线。修改模拟程序后先以这组输入跑出已核对的计数，再试更长的真实访问记录。这可以区分程序行为变化和数据自身的差别。',
        ],
      },
      run('用易核对的差值解释排名', [
        '做一个比较函数，接收两个已经计算的总成本。定义差值为 FIFO - LRU。差为正表示 LRU 更省，差为负表示 FIFO 更省，差为 0 就是平手。直接汇报差值既说明方向，也能看出两个结果有多接近。',
        '用三组小整数依次覆盖易混的分支。先预测 25 - 22 正负、谁被推荐，再预测 10 - 12。如果只有同一组正数用例，写反减法顺序可能让文字和实际相减方向同时写错而不易发现。',
        '运行后把差值改成 lru - fifo，保持分支不变，看哪个例子立刻露出问题；恢复公式后继续综合练习。只有声明相差值的方向，调用者才知道报告的正负应如何理解。',
      ], `function compare(fifo, lru) {
  const difference = fifo - lru;
  if (difference > 0) return "LRU：" + difference;
  if (difference < 0) return "FIFO：" + difference;
  return "tie：0";
}
for (const [fifo, lru] of [[25, 22], [10, 12], [0, 0]]) console.log(compare(fifo, lru));`, 'LRU：3\nFIFO：-2\ntie：0'),
    ],
    pitfalls: [
      { mistake: '第二种策略复用第一种留下的缓存', why: '比较起点改变，可能人为增多命中。', fix: '每次模拟创建独立空缓存。' },
      { mistake: '只报告好坏结论，省略输入和假设', why: '别人无法重跑也无法解释反常情况。', fix: '在报告附上轨迹、容量、块宽和费用。' },
    ],
    practice: {
      prompt: '实现 solve(fifo, lru)。两项为已经得到的非负整数成本。返回 difference = fifo - lru 与较省的 preferred（FIFO、LRU、tie）。无效返回 null。',
      checkpoints: ['正、负、0 三种差值各有结果。', '拒绝负数、非整数及文本参数。'],
      hints: ['先检查两个值，再用 fifo - lru 算差值。', '若差值为正，说明左侧 FIFO 更大，推荐的是 LRU。'],
      solution: '先检查范围，再由差值方向选择较低的一方，相等返回 tie。',
    },
    quiz: [
      ['如何避免两个策略互相污染？', ['使用两条随机轨迹', '每次从独立空缓存开始', '用前一次结果初始化下一次'], 1, '冷启动状态一致才方便比较。'],
      ['FIFO - LRU = 6 说明哪项更省？', ['LRU', 'FIFO', '一样'], 0, '当差值为正，LRU 数字更低。'],
      ['为什么要记录块大小？', ['它决定地址如何归并到块', '只为了填表', '它改变 HTML 样式'], 0, '不同块宽可能改变访问序列和局部性。'],
      ['只有一条轨迹表明某策略更优，该如何报告？', ['总是优', '仅在这条轨迹和设置下更省', '数据应该删除'], 1, '轨迹和模型的范围决定解释范围。'],
    ],
    exercise: checked(
      'function solve(fifo, lru) {\n  return { difference: 0, preferred: "tie" };\n}',
      `function solve(fifo, lru) {
  if (![fifo, lru].every(value => Number.isInteger(value) && value >= 0)) return null;
  const difference = fifo - lru;
  const preferred = difference === 0 ? "tie" : difference > 0 ? "LRU" : "FIFO";
  return { difference, preferred };
}`,
      [
        { label: 'LRU 更省', input: [25, 22], expected: { difference: 3, preferred: 'LRU' } },
        { label: 'FIFO 更省', input: [10, 12], expected: { difference: -2, preferred: 'FIFO' } },
        { label: '两边都为空', input: [0, 0], expected: { difference: 0, preferred: 'tie' } },
        { label: '非数值费用', input: ['10', 12], expected: null },
      ],
    ),
  }),
]

const costs = { blockSize: 4, capacity: 2, hitCost: 1, missCost: 6, refreshCost: 1 }
const cacheCases: StudyCase[] = [
  {
    label: '重复块让 LRU 更省',
    input: [[0, 4, 0, 8, 0], costs],
    expected: { FIFO: { hits: 1, misses: 4, evictions: 2, refreshes: 0, cost: 25 }, LRU: { hits: 2, misses: 3, evictions: 1, refreshes: 2, cost: 22 }, preferred: 'LRU' },
  },
  {
    label: '单个热块产生额外维护',
    input: [[0, 1, 2, 3], costs],
    expected: { FIFO: { hits: 3, misses: 1, evictions: 0, refreshes: 0, cost: 9 }, LRU: { hits: 3, misses: 1, evictions: 0, refreshes: 3, cost: 12 }, preferred: 'FIFO' },
  },
  {
    label: '零容量，两法平手',
    input: [[0, 1, 6], { ...costs, capacity: 0 }],
    expected: { FIFO: { hits: 0, misses: 3, evictions: 0, refreshes: 0, cost: 18 }, LRU: { hits: 0, misses: 3, evictions: 0, refreshes: 0, cost: 18 }, preferred: 'tie' },
  },
  {
    label: '可复查的空日志',
    input: [[], costs],
    expected: { FIFO: { hits: 0, misses: 0, evictions: 0, refreshes: 0, cost: 0 }, LRU: { hits: 0, misses: 0, evictions: 0, refreshes: 0, cost: 0 }, preferred: 'tie' },
  },
  { label: '非法地址', input: [[0, -1], costs], expected: null },
  { label: '块大小非法', input: [[0], { ...costs, blockSize: 0 }], expected: null },
]

export const computerScienceAdvanced: AdvancedTrack = {
  direction: 'computerScience',
  lessons: computerScienceLessons,
  project: {
    title: '访问日志缓存策略对照',
    summary: '将固定地址日志映射为缓存块，用同一容量回放 FIFO 与 LRU，从计数和总成本解释差异。',
    requirements: [
      '实现 solve(addresses, config)。地址为非负整数数组。config 含 blockSize（正整数）、capacity（非负整数）以及 hitCost、missCost、refreshCost（非负整数费用）。输入非法返回 null。',
      '使用 Math.floor(address / blockSize) 归块，基于同一块序列从各自的空缓存回放 FIFO 和 LRU。容量为零时每项都未命中，且没有装入或淘汰。',
      '记录 hits、misses、evictions、refreshes。每次 LRU 命中计一次刷新，包括该块原已位于末尾时；FIFO 命中只计命中。读取费用包含替换工作的成本，evictions 仅展示次数。',
      '把三项费用乘对应次数并求和。返回 { FIFO, LRU, preferred }，每种策略记录上述计数与 cost，总成本低的一方获选，相等返回 tie。',
    ],
    examples: examples(cacheCases),
    exercises: [checked(
      `function simulate(blocks, capacity, policy) {
  // TODO 按相同初始状态记录命中、未命中、淘汰和维护数。
  return { hits: 0, misses: 0, evictions: 0, refreshes: 0 };
}
function solve(addresses, config) {
  // TODO 检查输入，归块后分别调用 simulate，按成本比较。
  return null;
}`,
      cache + `
function solve(addresses, config) {
  if (!Array.isArray(addresses) || !addresses.every(value => Number.isInteger(value) && value >= 0) || !config) return null;
  const { blockSize, capacity, hitCost, missCost, refreshCost } = config;
  if (![blockSize, capacity, hitCost, missCost, refreshCost].every(value => Number.isInteger(value) && value >= 0) ||
      blockSize < 1) return null;
  const blocks = addresses.map(value => Math.floor(value / blockSize));
  function priced(policy) {
    const metrics = simulate(blocks, capacity, policy);
    const cost = metrics.hits * hitCost + metrics.misses * missCost + metrics.refreshes * refreshCost;
    return { ...metrics, cost };
  }
  const FIFO = priced("FIFO");
  const LRU = priced("LRU");
  const preferred = FIFO.cost === LRU.cost ? "tie" : FIFO.cost < LRU.cost ? "FIFO" : "LRU";
  return { FIFO, LRU, preferred };
}`,
      cacheCases,
    )],
    explanation: '两组模拟每次创建自己的空缓存，但以同样的块序列为输入。第一个例子里，LRU 用两次维护换来一次未命中转为命中。第二个例子所有地址同块，命中率相同，FIFO 省下维护费用。',
  },
}
