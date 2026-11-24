import type { CurriculumTrack } from './types'
import { advancedWebWorkshops } from './webWorkshops'

type AdvancedLesson = CurriculumTrack['advanced']['lessons'][number]
type Project = CurriculumTrack['foundationProject']
type QuizItem = [prompt: string, choices: string[], answer: number, explanation: string]
type Case = { label: string; input: unknown[]; expected: unknown }

function checked(starter: string, solution: string, cases: Case[]) {
  const inputs = cases.map(({ label, input }) => ({ label, input }))
  const harness = '\n\nconst cases = ' + JSON.stringify(inputs, null, 2) + ';\n' + [
    'for (const test of cases) {',
    '  const actual = solve(...test.input);',
    '  console.log(test.label + "：" + JSON.stringify(actual));',
    '}',
  ].join('\n')
  return {
    language: 'javascript' as const,
    starter: starter + harness,
    solution: solution + harness,
    expectedOutput: cases.map(({ label, expected }) => label + '：' + JSON.stringify(expected)).join('\n'),
    caseLabels: cases.map(({ label }) => label),
  }
}

function lesson(content: {
  id: string
  title: string
  summary: string
  primer: AdvancedLesson['primer']
  objectives: string[]
  sections: AdvancedLesson['expansion']['sections']
  pitfalls: AdvancedLesson['expansion']['pitfalls']
  practice: AdvancedLesson['expansion']['practice']
  quiz: QuizItem[]
  exercise: AdvancedLesson['exercise']
}): AdvancedLesson {
  const { id, title, summary, primer, objectives, sections, pitfalls, practice, quiz, exercise } = content
  const workshop = advancedWebWorkshops[id]
  return {
    id, title, summary, primer, exercise,
    expansion: {
      objectives,
      sections: workshop ? [workshop[0], ...sections, workshop[1]] : sections,
      pitfalls,
      practice,
      questions: quiz.map(([prompt, choices, answer, explanation], index) => ({
        id: id + '-' + (index + 1), prompt, choices, answer, explanation,
      })),
    },
  }
}

function projectExamples(cases: Case[]) {
  return cases.map(({ label, input, expected }) => ({
    label,
    input: input.map((argument) => JSON.stringify(argument)).join('，'),
    expected: JSON.stringify(expected),
  }))
}

const javascriptLessons = [
  lesson({
    id: 'signup-objects', title: '用对象整理报名记录',
    summary: '读懂记录的字段，清理文本，并返回可以安全交给下一步的对象。',
    primer: {
      lead: '报名表的一行有姓名、活动和时长。对象可以把有关系的值放在一起，每个值由字段名标记。',
      terms: [['属性', '对象里由名字标记的值'], ['解构', '用字段名从对象取出几个值'], ['空值', '这里用 null 表示没有可用记录']],
    },
    objectives: ['从一条记录中取出有用的字段。', '按约定验证形状、文本与数值，并返回新对象。'],
    sections: [
      {
        heading: '用字段名字保留含义',
        paragraphs: ['把姓名和时长放在 [“林青”, 20] 中时，读者必须记住两个位置。对象把这种约定写进字段名里。只取需要的字段时，解构可以减少重复写路径。'],
        codeLanguage: 'JavaScript', code: 'const signup = { name: "林青", minutes: 20 };\nconst { name, minutes } = signup;\nconsole.log(name, minutes);',
      },
      {
        heading: '从外到内检查形状',
        paragraphs: ['typeof null 的结果也是 "object"，数组的类型也会显示为 "object"。程序先排除这两类，再读字段。用于总计的分钟数应为正整数，Number.isInteger 会拒绝文本 "20"，避免无意中接受格式错误的数据。'],
        codeLanguage: 'JavaScript', code: 'const data = [null, [], { minutes: "20" }, { minutes: 20 }];\nfor (const value of data) {\n  const valid = value !== null && typeof value === "object" && !Array.isArray(value) && Number.isInteger(value.minutes);\n  console.log(valid);\n}',
      },
      {
        heading: '返回专门供下游使用的记录',
        paragraphs: ['去除首尾空白后再检查姓名是否为空。通过校验的记录可以用字面量重建，只把约定的字段交给下一步，原始输入保留给调用方复查。失败统一返回 null，后续才能明确筛掉它。'],
      },
    ],
    pitfalls: [
      { mistake: '直接对 raw.name 调用 trim', why: 'raw 可能是 null，姓名也可能是数字。', fix: '先检查记录形状，再确认 name 是字符串。' },
      { mistake: '写回 raw.name 来清理数据', why: '其他代码可能仍在引用这条原始记录。', fix: '新建包含清理后字段的对象。' },
    ],
    practice: {
      prompt: '实现 solve(raw)。保留去掉前后空白的 name 和正整数 minutes，其他字段丢弃；非法数据返回 null。',
      hints: ['把校验分成“这是一条记录吗”和“这两个字段可用吗”。先写返回 null 的分支。', '清理姓名后再查空串。构建一个新对象把两个字段返回，其他字段留在原始记录里。'],
      checkpoints: ['带空白的合法姓名会被清理，1 分钟可以通过。', '纯空白、null 和字符串分钟数均返回 null。'],
      solution: '守卫条件分别检查记录和字段。name.trim() 得到清理后的值，成功时由对象字面量建立新记录。',
    },
    quiz: [
      ['为什么要单独排除 null？', ['它是一个数组', '只检查 typeof 仍会把它认作 object', '它会变成 0'], 1, 'JavaScript 的 typeof null 返回 object。'],
      ['姓名是 "\\t "，清理后可用吗？', ['始终可用', '只有分钟数为 0 时可用', '不可用，trim 后为空'], 2, '应在清理后再检查必填文本。'],
      ['Number.isInteger("20") 的结果是什么？', ['false', 'true', '20'], 0, '它要求输入已经是数字且为整数。'],
      ['返回 { name, minutes } 会怎样？', ['清空输入对象', '新建只含这两个字段的对象', '把值拼成字符串'], 1, '对象字面量建立新的对象，原输入依旧可读。'],
    ],
    exercise: checked(
      'function solve(raw) {\n  // 校验记录和两个必填字段。\n  return null;\n}',
      'function solve(raw) {\n  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;\n  if (typeof raw.name !== "string" || !Number.isInteger(raw.minutes) || raw.minutes < 1) return null;\n  const name = raw.name.trim();\n  return name ? { name, minutes: raw.minutes } : null;\n}',
      [
        { label: '清理姓名', input: [{ name: ' 林青 ', minutes: 20, source: '表单' }], expected: { name: '林青', minutes: 20 } },
        { label: '最低时长', input: [{ name: '齐悦', minutes: 1 }], expected: { name: '齐悦', minutes: 1 } },
        { label: '分钟是文本', input: [{ name: '林青', minutes: '20' }], expected: null },
        { label: '姓名为空白', input: [{ name: '  ', minutes: 20 }], expected: null },
        { label: '空记录', input: [null], expected: null },
      ],
    ),
  }),
  lesson({
    id: 'signup-map-filter', title: '用 map 和 filter 处理数组',
    summary: '区分变换与保留，用可解释的流水线从报名记录提取有效结果。',
    primer: {
      lead: '报名表有很多行。先把每行变成统一格式，再把无效结果去掉，就能追踪哪一步改变了什么。',
      terms: [['map', '对每个元素调用函数，按原顺序生成等长数组'], ['filter', '保留条件为真的元素'], ['回调函数', '作为参数交给另一段代码调用的函数']],
    },
    objectives: ['分别用 map 清理字段与用 filter 筛选无效值。', '预先计算空输入和筛选后的顺序。'],
    sections: [
      {
        heading: 'map 对齐输入和输出位置',
        paragraphs: ['回调收到当前元素。返回值写入新数组中对应的位置，所以 map 适合把外来的数据变成内部统一格式。无效输入可暂时用 null 占位，让发生过的转换仍按顺序对得上。'],
        codeLanguage: 'JavaScript', code: 'const names = [" 安然 ", 19, "周青", "  "];\nconsole.log(names.map(name => typeof name === "string" ? name.trim() : null));',
      },
      {
        heading: 'filter 回答当前值是否保留',
        paragraphs: ['filter 把条件应用到当前元素；条件为真就保留原元素。对清理后的姓名，可明确要求非 null 且不为空字符串。数字列表另有规则，不能把 filter(Boolean) 当作通用清理方法，因为它也会丢掉合法的 0。'],
        codeLanguage: 'JavaScript', code: 'const readings = [null, 0, 14];\nconsole.log(readings.filter(value => value !== null)); // [0, 14]',
      },
      {
        heading: '中间结果让失败易于查找',
        paragraphs: ['如果一条姓名看起来有字却被去掉，先打印 map 得到的数组，核对它被转换成了什么，再看 filter 条件。两种操作都保留相对顺序，出现第二次的姓名也会保留，直到下一个明确负责去重的步骤。'],
      },
    ],
    pitfalls: [
      { mistake: '用 map 返回 true 或 false 期待过滤元素', why: '结果将包含布尔值，数量与输入相同。', fix: '在 filter 里编写保留条件。' },
      { mistake: '用箭头函数的大括号却省略 return', why: '带语句块的回调默认返回 undefined。', fix: '明确写 return，或者使用表达式形式。' },
    ],
    practice: {
      prompt: '实现 solve(rawNames)。清理字符串姓名，保留非空项的原顺序及重复项。非数组输入返回空数组。',
      hints: [
        '入口先用 Array.isArray(rawNames) 拦截非数组输入，直接返回 []。',
        '先用 map 把字符串修剪空白、把非字符串映射为 ""，再接 filter(name => name !== "") 筛掉空串，顺序和重复项会自动保留。',
      ],
      checkpoints: ['先处理字符串类型与 trim，再去掉空姓名。', '重复姓名仍出现两次，空数组和非数组无记录。'],
      solution: '在 map 中将非字符串映射为空串，接着 filter 掉空串。两个方法均保持相对顺序。',
    },
    quiz: [
      ['map 回调返回 false 会怎样？', ['跳过这项', '重新调用一次', '对应位置写入 false'], 2, 'map 使用回调返回值作为这个位置的新元素。'],
      ['filter 访问 [3, 1, 2] 并保留大于 1 的值，结果是什么？', ['[3, 2]', '[2, 3]', '[true, false, true]'], 0, 'filter 逐项保留，顺序与输入一致。'],
      ['清理 ["  "] 为什么要先 trim？', ['为了排序', '只含空白的原字符串并非空串', '为了得到 null'], 1, 'trim 把纯空白变成空串，空值检查才会符合表单约定。'],
      ['对 [] 调用 map 和 filter 后会得到什么？', ['[undefined]', '抛出异常', '[]'], 2, '空列表没有元素可转换或保留。'],
    ],
    exercise: checked(
      'function solve(rawNames) {\n  // 先转换，再过滤。\n  return [];\n}',
      'function solve(rawNames) {\n  if (!Array.isArray(rawNames)) return [];\n  return rawNames\n    .map(name => typeof name === "string" ? name.trim() : "")\n    .filter(name => name !== "");\n}',
      [
        { label: '按输入顺序', input: [[' 周青 ', null, '安然', ' 周青', '\t']], expected: ['周青', '安然', '周青'] },
        { label: '空列表', input: [[]], expected: [] },
        { label: '输入不是数组', input: ['周青'], expected: [] },
      ],
    ),
  }),
  lesson({
    id: 'signup-group-sort', title: '分组汇总并处理并列',
    summary: '用 Map 按活动累计人数，按人数和活动编号排出确定的顺序。',
    primer: {
      lead: '两条记录可以属于同一活动。先把它们计入同一个格子，再整理这些格子之间的顺序。',
      terms: [['Map', '存储键和值，用键取回对应值的结构'], ['比较函数', '决定排序时两项谁先谁后的函数'], ['并列规则', '主排序条件相同时采用的后备条件']],
    },
    objectives: ['借助 Map 统计活动人数。', '用明确的活动编号顺序处理并列。'],
    sections: [
      {
        heading: '按键找回累计状态',
        paragraphs: ['每条记录的活动编号是键。取出旧人数，没找到就从 0 开始，加 1 后写回。Map 允许把用户输入的字符串作为普通键，诸如 constructor 的字符串也可照常计数。'],
        codeLanguage: 'JavaScript', code: 'const counts = new Map();\nfor (const key of ["B", "A", "B"]) {\n  counts.set(key, (counts.get(key) ?? 0) + 1);\n}\nconsole.log([...counts.entries()]);',
      },
      {
        heading: '把比较顺序写成两级条件',
        paragraphs: ['比较函数返回负数表示左项在前。人数降序要用右边人数减左边人数。有差值就直接返回，只有差值为零才比较活动编号。在本章，编号使用大写字母 A 到 Z，可以用 < 和 > 按字母顺序比较。'],
        codeLanguage: 'JavaScript', code: 'const rows = [["B", 2], ["C", 1], ["A", 2]];\nrows.sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));\nconsole.log(rows);',
      },
      {
        heading: '排序只改展示所用的数据',
        paragraphs: ['sort 会修改传入的数组。汇总先从 Map 生成新数组，排序就不会改变原始记录或 Map 的迭代顺序。空表会生成空数组，可当成正常结果继续展示。'],
      },
    ],
    pitfalls: [
      { mistake: '把人数相同的活动合成一条', why: '并列表示排名依据相同，活动键仍不同。', fix: '保留两个分组，用编号决定先后。' },
      { mistake: '省略比较函数直接排序', why: '默认按字符串比较，10 和 2 的位置可能与数字顺序不符。', fix: '先比较人数差，再比较活动编号。' },
    ],
    practice: {
      prompt: '实现 solve(groups)。输入是一组活动编号，只统计 A 到 Z 的单个大写字母。输出 [编号, 人数] 的数组，先按人数降序，再按编号升序。',
      hints: ['先用 Map 计数，再把每组键和值取出来。可以暂时打印这份表，先确认计数。', '比较函数先处理人数差。差值为 0 时，再比较两个活动的字母编号。'],
      checkpoints: ['打乱数据中的活动出现顺序，人数并列时仍按编号。', '非法编号跳过，空输入返回 []。'],
      solution: '遍历编号更新 Map，将条目转成数组，然后对人数差和活动编号使用两级比较。',
    },
    quiz: [
      ['Map 的键应该是哪一项？', ['本行在数组里的下标', '活动编号', '本行统计前的人数'], 1, '活动编号相同的行应写回同一个 Map 条目。'],
      ['若左项 5 人、右项 2 人，右减左是多少？', ['-3', '3', '0'], 0, '负数把有 5 人的左项排在前面。'],
      ['为什么人数一样还要比较编号？', ['Map 无法存两个相同数值', '编号决定人数大小', '给相同人数的活动提供确定的展示顺序'], 2, '明确次级规则，打乱输入时并列顺序仍一致。'],
      ['怎样避免 sort 修改调用者传来的列表？', ['先生成新的汇总数组', '把差值反转', '改用两个 Map'], 0, 'sort 原地排序，只给它新的汇总数组便不会写回原列表。'],
    ],
    exercise: checked(
      'function solve(groups) {\n  // 累计有效编号后排序。\n  return [];\n}',
      'function solve(groups) {\n  const counts = new Map();\n  for (const code of groups) {\n    if (typeof code !== "string" || code.length !== 1 || !/^[A-Z]$/.test(code)) continue;\n    counts.set(code, (counts.get(code) ?? 0) + 1);\n  }\n  return [...counts].sort(([leftCode, leftCount], [rightCode, rightCount]) =>\n    rightCount - leftCount || (leftCode < rightCode ? -1 : leftCode > rightCode ? 1 : 0));\n}',
      [
        { label: '人数并列', input: [['B', 'D', 'B', 'A', 'A']], expected: [['A', 2], ['B', 2], ['D', 1]] },
        { label: '空列表', input: [[]], expected: [] },
        { label: '非法编号', input: [[null, 'AA', 'b', 'Z']], expected: [['Z', 1]] },
      ],
    ),
  }),
  lesson({
    id: 'signup-functions-testing', title: '拆分函数并测试输入边界',
    summary: '把验证、去重和展示变成各有明确输入输出的步骤，再按规则验收。',
    primer: {
      lead: '报名反馈错了时，分别检查“这条报名合不合规”和“这名同学是否报过”会更容易找出原因。',
      terms: [['纯函数', '返回值取决于输入，且没有修改外部状态等副作用'], ['契约', '某个函数接受什么、返回什么和失败时怎样处理的约定'], ['测试样例', '输入和明确预期组成的一组检查']],
    },
    objectives: ['把验证与有序去重拆成可单测单元。', '用普通、空表及坏数据确认契约。'],
    sections: [
      {
        heading: '先明确什么是重复',
        paragraphs: ['先看业务规则：报名表为每次提交分配一个全局编号。这时使用编号就能认出重复记录。姓名相同的两人可以拥有不同编号，同编号的两行就算活动不同，也属于同一次报名。'],
        codeLanguage: 'JavaScript', code: 'const a = { id: "R01", name: "林青", event: "A" };\nconst b = { id: "R02", name: "林青", event: "A" };\nconsole.log(a.id === b.id); // false',
      },
      {
        heading: '让无效项无法影响保留顺序',
        paragraphs: ['先拆分验证函数得到规范键，返回 null 时就跳过。有效键每次都先询问 Set，再决定是否写入。无效的第一行不应阻止后来同编号的第一条有效报名入选。'],
        codeLanguage: 'JavaScript', code: 'const seen = new Set();\nfor (const key of ["A", "B", "A"]) {\n  if (seen.has(key)) continue;\n  seen.add(key);\n  console.log(key);\n}',
      },
      {
        heading: '预期应能分辨不同的实现错误',
        paragraphs: ['只测一条成功报名无法发现去重顺序错误。可把同编号的“先有非法、接着有效、最后又有效”三条放在一个用例里，断言保留的是中间一条。另测空表及同名不同编号，分别验证无数据与辨识标准。'],
      },
    ],
    pitfalls: [
      { mistake: '用姓名作去重键', why: '不同编号的报名可能拥有相同的姓名。', fix: '先清理并验证记录，再按报名编号去重。' },
      { mistake: '总是覆盖 Map 里的现有条目', why: '这会保留最后一次，有别于按输入顺序保留首次。', fix: '首次出现才记录，后续相同键直接跳过。' },
    ],
    practice: {
      prompt: '实现 solve(names) 并拆出 cleanName(value)。仅保留第一次出现的有效姓名，合法姓名是 trim 后非空的字符串。返回清理后的姓名数组。',
      hints: [
        '先独立完成 cleanName(value)：确认 typeof value === "string" 后做 trim()，非空就返回清理后的文字，否则返回 null。',
        '在 solve 中建一个 Set，遍历 names 时只把 cleanName 返回非 null 的姓名加入 Set，最后用 [...seen] 保持首次出现的顺序返回。',
      ],
      checkpoints: ['空白和其他非字符串项不写入 Set。', '重复姓名只保留第一次，遇到空数组时正常返回。'],
      solution: '逐项调用 cleanName，通过后查询 Set。发现新键就加入 Set，按第一次加入的顺序生成结果。',
    },
    quiz: [
      ['哪一步适合单独测试？', ['关闭浏览器', '清理一个姓名并报告是否有效', '改变页面字体'], 1, '清理函数有可控输入和明确返回值。'],
      ['同编号先出现无效行，再出现有效行，应该保留哪条？', ['第一条', '两条都保留', '后来的有效条目'], 2, '只有有效条目才占据去重键。'],
      ['同名者以不同编号分别报名 A 和 B，如何处理？', ['分别保留', '删除第二条', '都返回 null'], 0, '不同报名编号标识不同的报名。'],
      ['怎样验证“保留第一次”？', ['检查返回值存在', '给重复项不同来源，核对返回的来源', '只测试空名单'], 1, '来源差异可以直接区分保留的究竟是哪项。'],
    ],
    exercise: checked(
      'function cleanName(value) {\n  return null;\n}\n\nfunction solve(names) {\n  return [];\n}',
      'function cleanName(value) {\n  return typeof value === "string" ? value.trim() || null : null;\n}\n\nfunction solve(names) {\n  const seen = new Set();\n  for (const value of names) {\n    const name = cleanName(value);\n    if (name !== null) seen.add(name);\n  }\n  return [...seen];\n}',
      [
        { label: '保留首次顺序', input: [['周青', ' 周青 ', '林安']], expected: ['周青', '林安'] },
        { label: '空名单', input: [[]], expected: [] },
        { label: '从混合输入恢复', input: [[null, [], ' ', '安然']], expected: ['安然'] },
      ],
    ),
  }),
]

const javascriptFoundationCases: Case[] = [
  { label: '给定样例', input: [[15, 30, 45, -1], 25], expected: { rows: ['1. 30 分钟', '2. 45 分钟'], total: 75 } },
  { label: '保持输入顺序', input: [[45, 15, 30, -1], 25], expected: { rows: ['1. 45 分钟', '2. 30 分钟'], total: 75 } },
  { label: '恰好达标', input: [[24, 25], 25], expected: { rows: ['1. 25 分钟'], total: 25 } },
  { label: '空数组', input: [[], 25], expected: { rows: [], total: 0 } },
  { label: '混合无效记录', input: [['30', null, 30, -3, 31.5], 25], expected: { rows: ['1. 30 分钟'], total: 30 } },
]

const javascriptFoundationProject: Project = {
  title: '复习时长报表',
  summary: '从记下来的学习时长中挑出达标的有效记录，保留原来的先后，并算出共学习了多少分钟。',
  requirements: [
    '完成 selectMinutes(minutes, minimum)，仅保留大于 0 且至少达到 minimum 的整数分钟，维持输入顺序。minimum 是给定的正整数。',
    '完成 formatReport(selected)，给筛选后的记录从 1 开始编号，并把有效分钟数逐项相加。空数组合计 0。',
    'solve 依次调用这两个函数，返回带编号的 rows 和合计 total。忽略分钟字符串、小数和非正值。',
  ],
  examples: projectExamples(javascriptFoundationCases),
  exercises: [checked(
    `function selectMinutes(minutes, minimum) {
  return [];
}

function formatReport(selected) {
  const rows = [];
  let total = 0;
  // 逐项编号并累计分钟数。
  return { rows, total };
}

function solve(minutes, minimum) {
  return formatReport(selectMinutes(minutes, minimum));
}`,
    `function selectMinutes(minutes, minimum) {
  return minutes.filter(value => Number.isInteger(value) && value > 0 && value >= minimum);
}

function formatReport(selected) {
  const rows = [];
  let total = 0;
  for (const value of selected) {
    rows.push((rows.length + 1) + ". " + value + " 分钟");
    total += value;
  }
  return { rows, total };
}

function solve(minutes, minimum) {
  return formatReport(selectMinutes(minutes, minimum));
}`,
    javascriptFoundationCases,
  )],
  explanation: '筛选步骤保持每条记录的相对位置。生成报表时，当前已输出的行数加 1 就是下一行的编号。循环每添加一行，也把同一条记录的分钟数加到总量中。',
}

const javascriptAdvancedCases: Case[] = [
  {
    label: '按报名编号去重再输出活动名单',
    input: [[
      { id: ' R01 ', event: 'B', name: ' 林青 ' },
      { id: 'R02', event: 'A', name: '齐悦' },
      { id: 'R01', event: 'A', name: '孟雨' },
      { id: 'R03', event: 'C', name: '孟雨' },
      { id: 'R04', event: 'A', name: '林青' },
      { id: 'R05', event: 'A', name: '林青' },
    ]],
    expected: [
      { event: 'A', count: 3, members: [{ id: 'R02', name: '齐悦' }, { id: 'R04', name: '林青' }, { id: 'R05', name: '林青' }] },
      { event: 'B', count: 1, members: [{ id: 'R01', name: '林青' }] },
      { event: 'C', count: 1, members: [{ id: 'R03', name: '孟雨' }] },
    ],
  },
  { label: '空报名表', input: [[]], expected: [] },
  {
    label: '无效先到和人数并列',
    input: [[null, { id: 'R01', event: 'B', name: ' ' }, { id: 'R01', event: 'B', name: '齐悦' }, { id: 'R02', event: ' A ', name: '孟雨' }, { id: '', event: 'C', name: '安然' }]],
    expected: [
      { event: 'A', count: 1, members: [{ id: 'R02', name: '孟雨' }] },
      { event: 'B', count: 1, members: [{ id: 'R01', name: '齐悦' }] },
    ],
  },
  { label: '报名表形状错误', input: [{ event: 'A' }], expected: [] },
]

const javascriptAdvancedProject: Project = {
  title: '社团报名统计器',
  summary: '清理报名表单，按报名编号去重，再列出每个活动的名单和人数。',
  requirements: [
    '实现 solve(rawRows)。非数组输入返回 []。对记录的 id、event、name 三个字符串去除首尾空白。id 和 name 必须非空，event 必须为 A 到 Z 的一个大写字母。',
    '先排除无效记录，再全局按清理后的报名 id 去重。相同 id 保留输入顺序中的第一条有效记录，即使后续行换了活动或姓名。同名而 id 不同是独立报名。',
    '输出 { event, count, members } 数组，其中 members 为 { id, name } 的有序名单。名单保持有效报名的先后，活动按人数降序、活动编号升序排列。',
  ],
  examples: projectExamples(javascriptAdvancedCases),
  exercises: [checked(
    'function normalize(row) {\n  // 检查记录形状并清理三个字段。\n  return null;\n}\n\nfunction solve(rawRows) {\n  // 调用 normalize。按报名编号去重，再分组与排序。\n  return [];\n}',
    `function normalize(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  if (typeof row.id !== "string" || typeof row.event !== "string" || typeof row.name !== "string") return null;
  const id = row.id.trim();
  const event = row.event.trim();
  const name = row.name.trim();
  if (!id || !name || !/^[A-Z]$/.test(event)) return null;
  return { id, event, name };
}

function solve(rawRows) {
  if (!Array.isArray(rawRows)) return [];
  const seen = new Set();
  const groups = new Map();
  for (const { id, event, name } of rawRows.map(normalize).filter(Boolean)) {
    if (seen.has(id)) continue;
    seen.add(id);
    const members = groups.get(event) ?? [];
    members.push({ id, name });
    groups.set(event, members);
  }
  const report = [...groups].map(([event, members]) => ({ event, count: members.length, members }));
  return report.sort((left, right) => {
    const countDifference = right.count - left.count;
    if (countDifference) return countDifference;
    return left.event < right.event ? -1 : left.event > right.event ? 1 : 0;
  });
}`,
    javascriptAdvancedCases,
  )],
  explanation: '先统一字段格式。用一个 Set 记录已接受的报名编号，重复 ID 不再加入任何活动。第一组例子中，R01 首次在 B 组报名，后来同编号的一行不能占用 A 组名额。A 组的 R04 和 R05 虽然同名，仍应分别进入名单。',
}

const csLessons = [
  lesson({
    id: 'record-representation', title: '选择记录、标识与单位',
    summary: '把图书信息与借阅状态组织成能判断和核对的数据。',
    primer: {
      lead: '同名的两本书仍可能是不同的书。给每一本分配编号，程序才知道一次查询具体取到了哪一本。',
      terms: [['标识', '稳定地区分记录的值'], ['数据表示', '用程序中的类型和字段保存现实信息的方式'], ['哨兵值', '专门表示找不到或缺少数据的值']],
    },
    objectives: ['区分书名、唯一编号和借阅状态。', '在表示中区分零值、空字符串和资料缺失。'],
    sections: [
      {
        heading: '用唯一编号取代会重复的书名',
        paragraphs: ['书名可能相同，书架位置也可能会变。用藏书编号找记录，书名和位置只是可以修改的字段。此处编号是文本，能原样保留 "0012" 的前导零。'],
        codeLanguage: 'JavaScript', code: 'const books = [{ id: "0012", title: "星图" }, { id: "0013", title: "星图" }];\nconsole.log(books.find(book => book.id === "0013"));',
      },
      {
        heading: '把状态与缺值写清楚',
        paragraphs: ['可借册数为 0 表示确认没有可借册，null 表示资料暂缺。两者需要不同的提示，简单的真值判断会把 0 和 null 放到同一分支。用严格等于号判断可以保留差异。'],
        codeLanguage: 'JavaScript', code: 'for (const copies of [0, null, 3]) {\n  console.log(copies === null ? "待核对" : copies + " 册");\n}',
      },
      {
        heading: '用字段约束保证后续操作有意义',
        paragraphs: ['规定 ID 是非空字符串，可借册数为非负整数或 null。字段类型一致后才可以查询和累加。给定一条记录时，先验证 ID 和可借册数，再决定是否生成展示摘要。'],
      },
    ],
    pitfalls: [
      { mistake: '把 ID 转成数字参与比较', why: '0012 和 12 可能是不同的藏书编号。', fix: '把 ID 当字符串，用严格相等判断。' },
      { mistake: '把 null、0 和负数全部报为无可借', why: '三种结果分别表示缺失、已知无库存与输入错误。', fix: '分别判断 null 与合法整数范围。' },
    ],
    practice: {
      prompt: '实现 solve(id, copies)。合法 ID 是长度至少为 1 的字符串。册数为 null 时输出“编号：待核对”，非负整数输出“编号：X 册”，其他情况输出“记录无效”。',
      hints: [
        '先检查 typeof id === "string" && id.length > 0，把编号按原字符串保留（不要转 Number，避免丢失 "0012" 的前导零）。',
        '接着先用严格等于判断 copies === null 返回待核对，再用 Number.isInteger(copies) && copies >= 0 处理 0 册和正数册，其余返回记录无效。',
      ],
      checkpoints: ['0 册和待核对显示不同文本。', '保留编号的前导零，拒绝空编号和非法册数。'],
      solution: '先确定编号类型和长度，再区分 null 与非负整数，构造预期句子。',
    },
    quiz: [
      ['哪一项适合标识一册藏书？', ['分配后保持唯一的编号', '可能重名的标题', '书架上的当前顺序'], 0, '唯一编号稳定地区分同名记录。'],
      ['copies 为 0 表示什么？', ['资料暂缺', '已知可借册数是 0', '负数'], 1, '0 是已知数值，缺失用 null 表示。'],
      ['把 "0012" 转成 Number 会丢掉什么？', ['整数部分', '书名', '前导零'], 2, '数字 12 不保留原来文本的位数。'],
      ['哪一种输入必须拒绝？', ['编号 "12"，册数为 null', '编号 "12"，册数为 -1', '编号 "0012"，册数为 0'], 1, '可借册数只接受非负整数或规定的缺失值。'],
    ],
    exercise: checked(
      'function solve(id, copies) {\n  return "记录无效";\n}',
      'function solve(id, copies) {\n  if (typeof id !== "string" || id.length === 0) return "记录无效";\n  if (copies === null) return id + "：待核对";\n  if (!Number.isInteger(copies) || copies < 0) return "记录无效";\n  return id + "：" + copies + " 册";\n}',
      [
        { label: '有库存', input: ['0012', 4], expected: '0012：4 册' },
        { label: '暂无可借', input: ['0012', 0], expected: '0012：0 册' },
        { label: '待核对', input: ['0012', null], expected: '0012：待核对' },
        { label: '册数非法', input: ['0012', -1], expected: '记录无效' },
        { label: '空编号', input: ['', 2], expected: '记录无效' },
      ],
    ),
  }),
  lesson({
    id: 'ordered-catalog-index', title: '建立有序索引并找区间',
    summary: '用书名和藏书编号建立辅助表，找出所有同名记录的位置。',
    primer: {
      lead: '书不必按书名放在同一架。做一张单独的书名索引，查询时只读索引就能找到号码。',
      terms: [['索引', '按查询所用的字段组织的一份辅助数据'], ['左边界', '第一个大于等于目标的位置'], ['右边界', '第一个大于目标的位置']],
    },
    objectives: ['从原记录建可独立排序的索引。', '用两个边界找齐重复名称并判断未命中。'],
    sections: [
      {
        heading: '保持记录位置，排序索引',
        paragraphs: ['把每条记录映射为 [查询键, ID]。索引可比较第一个元素，键相同再比较 ID。原记录仍保留录入顺序。此处示例使用大写字母书名代号，统一按 JavaScript 字符串顺序比较。'],
        codeLanguage: 'JavaScript', code: 'const records = [{ key: "B", id: "03" }, { key: "A", id: "02" }, { key: "A", id: "01" }];\nconst index = records.map(row => [row.key, row.id]);\nindex.sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0);\nconsole.log(index);',
      },
      {
        heading: '每轮缩小半开区间',
        paragraphs: ['从 [0, length) 开始。左边界中，若中点键小于目标，令 lo = mid + 1；否则令 hi = mid。两端重合时得到第一个不小于目标的位置，即使这个位置等于数组长度也有效。'],
        codeLanguage: 'JavaScript', code: 'const keys = ["A", "B", "B", "D"];\nlet lo = 0, hi = keys.length;\nwhile (lo < hi) {\n  const mid = Math.floor((lo + hi) / 2);\n  if (keys[mid] < "B") lo = mid + 1;\n  else hi = mid;\n}\nconsole.log(lo); // 1',
      },
      {
        heading: '用右边界把所有同名项取出',
        paragraphs: ['右边界将比较从 < 改为 <=，因此会越过中点的同名项。左闭右开的 slice(left, right) 取出完整同名区间。若目标未出现，两次搜索落到同一个插入位置，切片为空。'],
      },
    ],
    pitfalls: [
      { mistake: '命中任意一条就结束', why: '同名记录可能在命中位置前后。', fix: '分别找同名区间的两端。' },
      { mistake: '左端遇到更小值时写 lo = mid', why: '只剩一个候选位时 mid 等于 lo，搜索无法结束。', fix: '确认排除 mid 后写 lo = mid + 1。' },
    ],
    practice: {
      prompt: '实现 solve(keys, target)。keys 已按字母升序排列。返回 [left, right]，分别表示第一个 >= target 和第一个 > target 的位置。',
      hints: ['先用一份带两个 B 的数组画出每轮的 lo、mid、hi。相等时，左边界需要向左继续找。', '右边界在键与目标相等时排除中点，令 lo = mid + 1。相等的边界表示没有命中项。'],
      checkpoints: ['重复的 B 占据 [1, 3)。', '目标插入在结尾或输入为空时，边界仍在 0 到 length 之间。'],
      solution: '用同一个 boundary 函数，通过布尔参数改动相等时是否向右推进。',
    },
    quiz: [
      ['为什么先用 map 生成索引？', ['排序索引不会改变原记录的先后', '会自动去重', '会让整个目录变成字符串'], 0, '这是新的数组，可以独立排序。'],
      ['["A", "B", "B", "D"] 中 B 的右边界是多少？', ['1', '2', '3'], 2, '第一个大于 B 的元素 D 在下标 3。'],
      ['同一数组中 C 的两个边界是什么？', ['[2, 3]', '[3, 3]', '[3, 4]'], 1, 'C 缺席，两个边界均指向 D 处的插入位置。'],
      ['只有一个元素且比目标小时，为什么 lo = mid + 1？', ['排除已确认太小的位置并保证收缩', '保留 mid 便于重复查找', '把 hi 改成 0'], 0, '下轮不再询问同一个位置。'],
    ],
    exercise: checked(
      'function boundary(keys, target, upper) {\n  return 0;\n}\n\nfunction solve(keys, target) {\n  return [boundary(keys, target, false), boundary(keys, target, true)];\n}',
      'function boundary(keys, target, upper) {\n  let lo = 0;\n  let hi = keys.length;\n  while (lo < hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (keys[mid] < target || (upper && keys[mid] === target)) lo = mid + 1;\n    else hi = mid;\n  }\n  return lo;\n}\n\nfunction solve(keys, target) {\n  return [boundary(keys, target, false), boundary(keys, target, true)];\n}',
      [
        { label: '完整重复区间', input: [['A', 'B', 'B', 'D'], 'B'], expected: [1, 3] },
        { label: '中间未命中', input: [['A', 'B', 'D'], 'C'], expected: [2, 2] },
        { label: '末尾边界', input: [['A', 'B'], 'Z'], expected: [2, 2] },
        { label: '空表', input: [[], 'A'], expected: [0, 0] },
      ],
    ),
  }),
  lesson({
    id: 'search-work-count', title: '分别统计建表与查询成本',
    summary: '用可重放的比较次数区分一次性建表成本与每次检索成本。',
    primer: {
      lead: '建索引像是先整理书架。只查一本时可能来不及省下时间，多次查找才有机会分摊整理成本。',
      terms: [['建表成本', '建立索引所需的一次性工作'], ['查询成本', '使用现有资料完成一次查找的工作'], ['比较次数', '本章记录两个键被比较了多少次']],
    },
    objectives: ['为插入排序和二分查找添加比较计数。', '用相同计量规则比较一组多次查询的总成本。'],
    sections: [
      {
        heading: '数实际发生的键比较',
        paragraphs: ['本节只计值之间的比较，循环下标检查不计。插入排序比较就加一次，包括一次“已经找到插入处”所触发的比较。用自己的建表代码可重放这套计数，内置 sort 的比较次数可能因引擎而异。'],
        codeLanguage: 'JavaScript', code: 'const values = [3, 1, 2];\nlet comparisons = 0;\nfor (let i = 1; i < values.length; i++) {\n  let j = i;\n  while (j > 0) {\n    comparisons++;\n    if (values[j - 1] <= values[j]) break;\n    [values[j - 1], values[j]] = [values[j], values[j - 1]];\n    j--;\n  }\n}\nconsole.log(values, comparisons);',
      },
      {
        heading: '建表一次，查询可重复',
        paragraphs: ['先记 build，再累加每次 query。若每次线性查找都扫描 4 条，查 3 次共 12 次比较；若建表花 5 次、每次二分花 2 次，总成本是 11。记录所有数字才知道什么时候开始节省比较。'],
        codeLanguage: 'JavaScript', code: 'const build = 5;\nconst searches = [2, 2, 2];\nconst query = searches.reduce((sum, count) => sum + count, 0);\nconsole.log({ build, query, total: build + query });',
      },
      {
        heading: '让比较口径可以复查',
        paragraphs: ['一个三路比较可报告小于、等于或大于，本章把检查一个位置与目标的关系算作一次键比较。实际运行时间还受收集数据和机器影响。用相同输入和相同计数规则比较，读者才可逐步复现你的结果。'],
      },
    ],
    pitfalls: [
      { mistake: '只展示二分查找的 query', why: '第一次查询以前已经发生了建表工作。', fix: '同时报告 build、query 和 total。' },
      { mistake: '把循环每轮当作一次固定键比较', why: '下标检查与键比较是两种操作。', fix: '在真正检查键的地方维护计数。' },
    ],
    practice: {
      prompt: '实现 solve(values, targets)。复制 values 并用相邻比较的插入排序建表。对每个目标用二分命中即停，每次访问中点计一次。返回 { build, query, total }。',
      hints: ['先在排序里只记 build 并打印排序后数组。包括一次没发生交换的比较。', '为每个目标重新初始化左右边界，保留共享的 query。每访问一次中点就加一。'],
      checkpoints: ['插入排序中遇到顺序正确也计一次键比较，末端下标判断不计。', '空表查任何目标都计 0，空目标表仍报告建表成本。'],
      solution: '先复制并插入排序，再针对每个目标独立初始化二分区间。把每轮的中点访问累加到 query，最后相加。',
    },
    quiz: [
      ['4 条记录建表需 5 次，随后两次查询各需 2 次，总计多少？', ['4', '9', '5'], 1, '建表一次为 5，两次查询一共 4。'],
      ['插入排序中哪项在本章算一次？', ['j > 0', '交换两个元素', '比较相邻键大小'], 2, '本章计的是键比较，循环条件和写入均分开。'],
      ['报告建表但无查询时，query 应是多少？', ['0', '与 build 相同', '无法定义'], 0, '没有访问查询中点，建表成本仍可单独报告。'],
      ['为什么用同一算法测同一组输入？', ['以便复查计数口径和比较结果', '因为所有排序成本固定', '因为空表无法测试'], 0, '数据顺序和算法都能影响比较次数。'],
    ],
    exercise: checked(
      'function solve(values, targets) {\n  return { build: 0, query: 0, total: 0 };\n}',
      `function solve(values, targets) {
  const ordered = [...values];
  let build = 0;
  let query = 0;
  for (let i = 1; i < ordered.length; i++) {
    let j = i;
    while (j > 0) {
      build++;
      if (ordered[j - 1] <= ordered[j]) break;
      [ordered[j - 1], ordered[j]] = [ordered[j], ordered[j - 1]];
      j--;
    }
  }
  for (const target of targets) {
    let lo = 0;
    let hi = ordered.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      query++;
      if (ordered[mid] === target) break;
      if (ordered[mid] < target) lo = mid + 1;
      else hi = mid;
    }
  }
  return { build, query, total: build + query };
}`,
      [
        { label: '一次建表两次查询', input: [[3, 1, 2], [2, 4]], expected: { build: 3, query: 3, total: 6 } },
        { label: '空表仍可查询', input: [[], [1]], expected: { build: 0, query: 0, total: 0 } },
        { label: '只建立索引', input: [[2, 1], []], expected: { build: 1, query: 0, total: 1 } },
      ],
    ),
  }),
  lesson({
    id: 'lookup-edge-model', title: '用边界模型区分查询结果',
    summary: '用相同接口区分查询成功、未命中及无效输入，检查目录极端情况。',
    primer: {
      lead: '查不到书可能是目录里没有，也可能是查询词没有填。这两种情形需要不同的反馈。',
      terms: [['输入边界', '合法输入与非法输入相邻的位置或情形'], ['状态字段', '明确说明操作结果类别的字段'], ['前置条件', '运行查询算法前必须满足的条件']],
    },
    objectives: ['用状态字段区分命中、未命中、无效查询。', '设计能检出空表、重复行和末尾越界错误的用例。'],
    sections: [
      {
        heading: '先定合法、再查找',
        paragraphs: ['清理查询词的首尾空白，清理后没有内容就返回 invalid。只在合法时查索引。这样程序可以给出“请输入查询词”的指导，而目录无结果时可以单独显示“没有对应藏书”。'],
        codeLanguage: 'JavaScript', code: 'function normalizedKey(value) {\n  return typeof value === "string" ? value.trim() : "";\n}\nconsole.log(normalizedKey(" A "), normalizedKey(" "), normalizedKey(null));',
      },
      {
        heading: '让每种状态都具有同一字段',
        paragraphs: ['hit、miss、invalid 都返回 status 和 ids。调用者只需要看 status 就知道发生了什么，也能总是把 ids 用于列表渲染。空索引是合法目录，应产生 miss。'],
        codeLanguage: 'JavaScript', code: 'const ids = ["B12", "B19"];\nconsole.log(ids.length ? { status: "hit", ids } : { status: "miss", ids });',
      },
      {
        heading: '挑能把几个错法区分开的用例',
        paragraphs: ['相同书名有两本时，断言两个 ID 都返回。再加几个用例：首个条目、最后条目、超过末尾、空索引和非字符串目标。同样返回空 ID 时，分别核对 miss 或 invalid。'],
      },
    ],
    pitfalls: [
      { mistake: '所有失败都返回 undefined', why: '调用方既看不出失败原因，又要额外处理缺失字段。', fix: '为每个约定状态返回统一形状的对象。' },
      { mistake: '未命中时直接读 index[length]', why: '数组长度是有效插入位置，却没有对应元素。', fix: '先检查边界或直接按区间切片。' },
    ],
    practice: {
      prompt: '实现 solve(index, target)。index 是 [书名, ID] 条目数组。将 target 清理首尾空白，查找精确匹配项。按索引顺序返回 { status, ids }，状态为 hit、miss 或 invalid。',
      hints: [
        '先验证查询词：若 target 不是字符串或 trim() 后为空串，直接返回 { status: "invalid", ids: [] }，不要再去查目录。',
        '查询词有效时，筛选所有 title === key 的条目并映射出 id 数组；最后按 ids.length 是否大于 0 决定返回 "hit" 还是 "miss"。',
      ],
      checkpoints: ['返回同名项的所有 ID。', '空目录和不存在的合法书名报 miss，空白和非字符串目标报 invalid。'],
      solution: '在运行筛选前验证查询词。用 filter 识别标题，再将条目映射到 ID，根据数组长度决定结果状态。',
    },
    quiz: [
      ['空索引里查一个合法词，得到什么状态？', ['miss', 'invalid', 'hit'], 0, '查询条件有效，目录中没有匹配项。'],
      ['目标为空白时为什么先返回 invalid？', ['空白是最常见的书名', '便于让界面提示补写查询词', '防止所有字符串相等'], 1, '无效查询需要补输入，而合法未命中需要改变查找词。'],
      ['下界恰好等于索引长度说明什么？', ['最后一项等于目标', '长度是末尾插入位置', '范围从末尾倒数一位开始'], 1, '不能在索引长度的位置读取任何记录。'],
      ['怎么发现漏掉同名书的实现？', ['查询同名的两册，核对两条 ID', '只查第一本书', '清空索引后查书'], 0, '同名多条用例能区分返回任意一条和返回完整集合。'],
    ],
    exercise: checked(
      'function solve(index, target) {\n  return { status: "miss", ids: [] };\n}',
      'function solve(index, target) {\n  const key = typeof target === "string" ? target.trim() : "";\n  if (!key) return { status: "invalid", ids: [] };\n  const ids = index.filter(([title]) => title === key).map(([, id]) => id);\n  return { status: ids.length ? "hit" : "miss", ids };\n}',
      [
        { label: '两册同名', input: [[['星图', 'B01'], ['星图', 'B03']], ' 星图 '], expected: { status: 'hit', ids: ['B01', 'B03'] } },
        { label: '空目录', input: [[], '星图'], expected: { status: 'miss', ids: [] } },
        { label: '空白查询', input: [[['星图', 'B01']], ' '], expected: { status: 'invalid', ids: [] } },
      ],
    ),
  }),
]

const seatTable = [
  { zone: 2, seat: 37, name: '林青' },
  { zone: 0, seat: 0, name: '齐悦' },
  { zone: 3, seat: 63, name: '孟雨' },
]

const csFoundationCases: Case[] = [
  { label: '命中已登记座位', input: [seatTable, 2, 37], expected: { status: 'hit', code: '10100101', name: '林青' } },
  { label: '合法空座', input: [seatTable, 1, 12], expected: { status: 'miss', code: '01001100', name: null } },
  { label: '两个字段都在上边界', input: [seatTable, 3, 63], expected: { status: 'hit', code: '11111111', name: '孟雨' } },
  { label: '两个字段都在下边界', input: [seatTable, 0, 0], expected: { status: 'hit', code: '00000000', name: '齐悦' } },
  { label: '座位超出六位范围', input: [seatTable, 2, 64], expected: { status: 'invalid', code: null, name: null } },
  { label: '分区超出两位范围', input: [seatTable, 4, 0], expected: { status: 'invalid', code: null, name: null } },
]

const csFoundationProject: Project = {
  title: '教学楼座位查询',
  summary: '合成 8 位座位代码，再从已有的座位表查找登记姓名，分清查到、空座和非法编号。',
  requirements: [
    '编写 seatCode(zone, seat)。分区是 0 到 3 的整数，座位是 0 到 63 的整数。把 2 位分区码与 6 位座位码接成固定 8 位字符串。越界或非整数返回 null。',
    '实现 solve(table, zone, seat)。给定的登记表由 { zone, seat, name } 组成，匹配分区和座位两个字段。命中返回 { status: "hit", code, name }，合法空座返回 { status: "miss", code, name: null }。',
    '非法输入返回 { status: "invalid", code: null, name: null }。须保留前导零，也不要修改给定登记表。',
  ],
  examples: projectExamples(csFoundationCases),
  exercises: [checked(
    'function seatCode(zone, seat) {\n  return null;\n}\n\nfunction solve(table, zone, seat) {\n  return { status: "invalid", code: null, name: null };\n}',
    `function seatCode(zone, seat) {
  if (!Number.isInteger(zone) || zone < 0 || zone > 3) return null;
  if (!Number.isInteger(seat) || seat < 0 || seat > 63) return null;
  const zoneBits = zone.toString(2).padStart(2, "0");
  const seatBits = seat.toString(2).padStart(6, "0");
  return zoneBits + seatBits;
}

function solve(table, zone, seat) {
  const code = seatCode(zone, seat);
  if (code === null) return { status: "invalid", code, name: null };
  const row = table.find(entry => entry.zone === zone && entry.seat === seat);
  if (!row) return { status: "miss", code, name: null };
  return { status: "hit", code, name: row.name };
}`,
    csFoundationCases,
  )],
  explanation: '将两段分别补齐后拼接，分区 2 和座位 37 分别得到 10 和 100101。非法输入在查表前被拒绝，而合法但未登记的座位仍有完整的 8 位代码。',
}

const library = [
  { id: 'B03', title: '星图' }, { id: 'B02', title: '潮汐' }, { id: 'B01', title: '星图' }, { id: 'B05', title: '地貌' },
]

const orderedLibrary = Array.from({ length: 16 }, (_, position) => {
  const number = String(position).padStart(2, '0')
  return { id: 'B' + number, title: '书' + number }
})

const csAdvancedCases: Case[] = [
  {
    label: '同名命中再查一个缺席书名',
    input: [library, [' 星图 ', '山河']],
    expected: {
      matches: [{ status: 'hit', ids: ['B01', 'B03'] }, { status: 'miss', ids: [] }],
      linear: { first: 4, total: 8 },
      indexed: { build: 6, query: 11, first: 11, total: 17 },
    },
  },
  {
    label: '多查几次可分摊建表',
    input: [orderedLibrary, ['书07', '书08', '书09', '书10']],
    expected: {
      matches: [{ status: 'hit', ids: ['B07'] }, { status: 'hit', ids: ['B08'] }, { status: 'hit', ids: ['B09'] }, { status: 'hit', ids: ['B10'] }],
      linear: { first: 16, total: 64 },
      indexed: { build: 15, query: 32, first: 23, total: 47 },
    },
  },
  {
    label: '空目录',
    input: [[], ['星图']],
    expected: { matches: [{ status: 'miss', ids: [] }], linear: { first: 0, total: 0 }, indexed: { build: 0, query: 0, first: 0, total: 0 } },
  },
  {
    label: '空白或非文本查询',
    input: [library, [' ', null]],
    expected: { matches: [{ status: 'invalid', ids: [] }, { status: 'invalid', ids: [] }], linear: { first: 0, total: 0 }, indexed: { build: 0, query: 0, first: 0, total: 0 } },
  },
]

const csAdvancedProject: Project = {
  title: '校园图书检索对比',
  summary: '用直接扫描与有序索引在同一份书目查找多个书名，比较两种方法的首次成本和整批成本。',
  requirements: [
    '实现 solve(rows, targets)。每条藏书记录有非空 title 和唯一字符串 id。清理各查询词的首尾空白。对有效词直接扫描整份原表，每读一条书名计一次。命中后继续扫描以找齐同名书。',
    '同一批查询只为第一个有效词建一次索引。复制原表条目，用插入排序按书名再按 ID 升序排列，按 JavaScript 字符串顺序比较。每次比较两条索引记录计一次 build，无论是否交换。',
    '对每个有效词在索引上做两次二分，定位第一个 >= 及第一个 > 的位置。每次访问中点计一次 query。两法的匹配 ID 都用字符串升序列出，以供比较；直接法最后的 ID 排序不计入目录键比较。',
    '返回 { matches, linear, indexed }。每个匹配对象为 { status, ids }，状态可为 hit、miss 或 invalid。空白或非文本词判 invalid，不建表也不查询。linear 返回 first 和 total，分别为首次有效查询和全批扫描次数。indexed 返回 build、query、first 和 total，首次与全批均只计一次建表；没有有效查询时所有计数为 0。',
  ],
  examples: projectExamples(csAdvancedCases),
  exercises: [checked(
    'function scan(rows, key) {\n  // 直接扫描整份书目。\n  return { ids: [], visits: 0 };\n}\n\nfunction solve(rows, targets) {\n  // 建一次索引，用两种方法完成每次有效查询。\n  return { matches: [], linear: { first: 0, total: 0 }, indexed: { build: 0, query: 0, first: 0, total: 0 } };\n}',
    `function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function scan(rows, key) {
  const ids = [];
  let visits = 0;
  for (const { title, id } of rows) {
    visits++;
    if (title === key) ids.push(id);
  }
  return { ids: ids.sort(compareText), visits };
}

function buildIndex(rows) {
  const index = rows.map(({ title, id }) => [title, id]);
  let build = 0;
  for (let i = 1; i < index.length; i++) {
    let j = i;
    while (j > 0) {
      const [previousTitle, previousId] = index[j - 1];
      const [title, id] = index[j];
      build++;
      if ((compareText(previousTitle, title) || compareText(previousId, id)) <= 0) break;
      [index[j - 1], index[j]] = [index[j], index[j - 1]];
      j--;
    }
  }
  return { index, build };
}

function boundary(index, key, upper) {
  let lo = 0;
  let hi = index.length;
  let visits = 0;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const compared = compareText(index[mid][0], key);
    visits++;
    if (compared < 0 || (upper && compared === 0)) lo = mid + 1;
    else hi = mid;
  }
  return { position: lo, visits };
}

function solve(rows, targets) {
  let catalog;
  let firstLinear = 0;
  let firstIndexed = 0;
  let totalLinear = 0;
  let query = 0;
  const matches = [];

  for (const target of targets) {
    const key = typeof target === "string" ? target.trim() : "";
    if (!key) {
      matches.push({ status: "invalid", ids: [] });
      continue;
    }
    const firstQuery = catalog === undefined;
    catalog ??= buildIndex(rows);

    const direct = scan(rows, key);
    const left = boundary(catalog.index, key, false);
    const right = boundary(catalog.index, key, true);
    const ids = catalog.index.slice(left.position, right.position).map(([, id]) => id);
    if (ids.length !== direct.ids.length || ids.some((id, index) => id !== direct.ids[index])) {
      throw new Error("两种查找的结果不同");
    }
    const visits = left.visits + right.visits;
    if (firstQuery) {
      firstLinear = direct.visits;
      firstIndexed = catalog.build + visits;
    }
    totalLinear += direct.visits;
    query += visits;
    matches.push({ status: ids.length ? "hit" : "miss", ids });
  }

  const build = catalog?.build ?? 0;
  return {
    matches,
    linear: { first: firstLinear, total: totalLinear },
    indexed: { build, query, first: firstIndexed, total: build + query },
  };
}`,
    csAdvancedCases,
  )],
  explanation: '直接扫描会看过每一条藏书。索引先用书名把同名书放在相邻位置，再以两次二分定位边界并取出完整结果。16 条书目的样例中，第一次是 16 对 23 次，但一共查 4 次是 64 对 47 次，因为后续共用已建好的索引。',
}

const webLessons = [
  lesson({
    id: 'task-form-validation', title: '处理表单提交与输入校验',
    summary: '从有标签的表单读取数据，在更改任务列表前验证标题。',
    primer: {
      lead: '任务名称由学习者填写。即使表单看起来已经输入文字，程序也要先读出内容并检查。',
      terms: [['label', '给表单控件命名的标签'], ['submit', '表单提交时触发的事件'], ['preventDefault', '阻止事件默认行为的方法']],
    },
    objectives: ['用 label 和 name 建立可读、可取值的输入控件。', '处理 submit 并反馈校验结果。'],
    sections: [
      {
        heading: '由表单接管点击和回车',
        paragraphs: ['按钮使用 type="submit"，点击与输入框中的回车都能提交。事件监听设在 form 上，调用 preventDefault 保持当前页面。标签的 for 对应输入框的 id，浏览器和辅助工具可以读懂字段名称。'],
        codeLanguage: 'HTML', code: '<form id="task-form">\n  <label for="title">任务标题</label>\n  <input id="title" name="title" aria-describedby="hint">\n  <p id="hint">输入 1 到 40 个字符。</p>\n  <button type="submit">新增任务</button>\n</form>',
      },
      {
        heading: '先清理文字，再检查规则',
        paragraphs: ['读取 FormData 前确保控件有 name。get 会返回该名称对应的值。trim 去掉头尾空白，保留文字中间的空格。只含空白就视为缺少标题。字数用 [...title].length 计算 Unicode 码点，避免一个非基本平面字符被计算两次。'],
        codeLanguage: 'JavaScript', code: 'function cleanTitle(value) {\n  const title = typeof value === "string" ? value.trim() : "";\n  return title && [...title].length <= 40 ? title : null;\n}\nconsole.log(cleanTitle(" 整理笔记 "));',
      },
      {
        heading: '失败后保留用户输入',
        paragraphs: ['无效提交先提示原因，把焦点送回输入框并保留当前草稿。通过才新增任务、清空表单并反馈。用 aria-describedby 连接说明或错误文本，用 aria-invalid 报告当前字段是否有错误。'],
      },
    ],
    pitfalls: [
      { mistake: '只监听按钮的 click', why: '通过输入框回车提交时，提交逻辑可能无法统一处理。', fix: '在表单的 submit 事件中统一获取数据和校验。' },
      { mistake: '校验前把任务插入数组', why: '失败后还要撤回无效记录。', fix: '只有通过验证的标题才可写入。' },
    ],
    practice: {
      prompt: '实现 solve(rawTitle)。清理标题的首尾空白，清理后要求 1 到 40 个 Unicode 码点。合法返回标题，其他情况返回 null。',
      hints: [
        '先检查 typeof rawTitle === "string"，再调用 trim() 去掉首尾空白（中间空格要保留）。',
        '用 [...title].length 计算码点个数，确认它至少为 1 且不超过 40；通过就返回清理后的 title，否则返回 null。',
      ],
      checkpoints: ['恰好 40 个码点可以通过，41 个应拒绝。', '保留中间空格，纯空白和非字符串返回 null。'],
      solution: '先类型检查再 trim。展开字符串得到码点数组，用长度范围判定是否可用。',
    },
    quiz: [
      ['用户按回车提交时，适合统一处理哪个事件？', ['mouseover', 'submit', 'focus'], 1, '表单的 submit 统一接收键盘和按钮发起的提交。'],
      ['label 的 for 应匹配什么？', ['输入框的 id', '按钮文字', '页面标题'], 0, 'for 与 id 建立标签到控件的关系。'],
      ['什么情况下清空输入框？', ['只要点击按钮就清空', '校验失败立刻清空', '验证成功且任务写入后清空'], 2, '保留失败草稿让用户可以修改。'],
      ['标题 " 读 示例 " 清理后是什么？', ['"读示例"', '"读 示例"', '空串'], 1, 'trim 去掉首尾空白，保留中间空格。'],
    ],
    exercise: checked(
      'function solve(rawTitle) {\n  return null;\n}',
      'function solve(rawTitle) {\n  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";\n  return title && [...title].length <= 40 ? title : null;\n}',
      [
        { label: '带空格的标题', input: [' 复习 数组 '], expected: '复习 数组' },
        { label: '恰好四十个字', input: ['字'.repeat(40)], expected: '字'.repeat(40) },
        { label: '超过上限', input: ['字'.repeat(41)], expected: null },
        { label: '只有空白', input: ['  '], expected: null },
      ],
    ),
  }),
  lesson({
    id: 'data-driven-task-list', title: '从任务数据渲染列表',
    summary: '用同一份任务数据生成可见的行、完成状态和统计数字。',
    primer: {
      lead: '如果任务从未完成变成已完成，行上的样式、文字和统计应该一起更新。把它们统一从任务数据算出来。',
      terms: [['状态', '决定界面当前显示什么的数据'], ['渲染', '把数据转换成界面元素'], ['textContent', '把文字按原样写进 DOM 的属性']],
    },
    objectives: ['用稳定 ID 区分同名任务，并从数组得出统计。', '用 textContent 渲染用户输入的纯文本。'],
    sections: [
      {
        heading: '为每项任务保留稳定 ID',
        paragraphs: ['最小任务有 id、title、done 三个字段。title 可以编辑也允许重复，id 在这条任务存在期间保持不变。筛选改变行的位置后，事件仍能用 ID 找回正确的任务。'],
        codeLanguage: 'JavaScript', code: 'const tasks = [{ id: 1, title: "阅读示例", done: true }, { id: 2, title: "阅读示例", done: false }];\nconsole.log(tasks.filter(task => task.done).length);',
      },
      {
        heading: '创建元素并放入纯文本',
        paragraphs: ['用 document.createElement("li") 创建行，用 textContent 填入标题。这样学习者输入的 <b>复习</b> 只会显示为文字。渲染完成后 replaceChildren 一次替换列表，避免每次点击不断追加重复的行。'],
        codeLanguage: 'JavaScript', code: 'const item = document.createElement("li");\nitem.textContent = "<b>复习</b>";\nconsole.log(item.outerHTML); // 标签内容按文字转义',
      },
      {
        heading: '统计与空状态也来自数组',
        paragraphs: ['总数取 tasks.length，完成数取 done 为真的任务数。没有数据时给出“暂无任务”的文本。不要另外维护一个靠点击加减的计数器，否则修改、筛选和重新渲染容易让统计与列表分离。'],
      },
    ],
    pitfalls: [
      { mistake: '用标题查找被点击的任务', why: '同标题可能来自两条不同任务，标题也会被改。', fix: '让事件携带任务 ID。' },
      { mistake: '使用 innerHTML 拼接用户文字', why: '尖括号等内容会被当作标记解析。', fix: '创建元素后设置 textContent。' },
    ],
    practice: {
      prompt: '实现 solve(tasks)，输出 { lines, completed }。lines 按原顺序输出“ID 标题（已完成/待完成）”，completed 记录已完成任务数。',
      hints: [
        '用 tasks.map 把每条 { id, title, done } 格式化为 "ID 标题（已完成）" 或 "ID 标题（待完成）"，原样保留标题中的尖括号等文字。',
        'completed 直接从同一份 tasks 计算：tasks.filter(task => task.done).length；空数组会自然得出空行数组和 0。',
      ],
      checkpoints: ['允许同标题任务，编号保持可区分。', '空输入返回空行和 0，尖括号按输入原样留在文字中。'],
      solution: 'map 构造状态文字，filter 选出已完成项，再读取其长度。界面上把这些值放入 textContent。',
    },
    quiz: [
      ['哪项最适合绑定任务行与任务数据？', ['行的当前位置', '任务标题', '稳定的任务 ID'], 2, '筛选、编辑和排序都不改变任务 ID。'],
      ['用户标题含有尖括号时如何原样展示？', ['设置 textContent', '设置 innerHTML', '替换成空标题'], 0, 'textContent 把内容作为文字展示。'],
      ['从哪里得到已完成数？', ['按钮上次的文本', '当前任务数组中 done 为真的数量', '当前页面的标题'], 1, '当前数据是统计的唯一来源。'],
      ['空任务数组的统计应如何显示？', ['已完成 0 项', '显示 undefined', '报 JavaScript 错误'], 0, '空数组的长度与完成数量都是 0。'],
    ],
    exercise: checked(
      'function solve(tasks) {\n  return { lines: [], completed: 0 };\n}',
      'function solve(tasks) {\n  const lines = tasks.map(({ id, title, done }) => id + " " + title + (done ? "（已完成）" : "（待完成）"));\n  const completed = tasks.filter(task => task.done).length;\n  return { lines, completed };\n}',
      [
        { label: '相同标题保留两个编号', input: [[{ id: 2, title: '复习', done: false }, { id: 4, title: '复习', done: true }]], expected: { lines: ['2 复习（待完成）', '4 复习（已完成）'], completed: 1 } },
        { label: '空看板', input: [[]], expected: { lines: [], completed: 0 } },
        { label: '标题含有尖括号', input: [[{ id: 1, title: '<b>复习</b>', done: false }]], expected: { lines: ['1 <b>复习</b>（待完成）'], completed: 0 } },
      ],
    ),
  }),
  lesson({
    id: 'task-filter-edit', title: '保持筛选与编辑同步',
    summary: '从同一任务数组派生筛选结果，并通过 ID 改对那一条任务。',
    primer: {
      lead: '切换到“未完成”时，被藏起来的已完成任务还在。切回“全部”，它们应该重新出现。',
      terms: [['派生数据', '可以从当前状态重新算出的值'], ['筛选条件', '决定哪些元素可见的规则'], ['更新', '按照明确的 ID 更改一条记录']],
    },
    objectives: ['根据筛选模式计算当前可见任务。', '编辑后统一更新完整数组与当前视图。'],
    sections: [
      {
        heading: '筛选决定展示，原记录继续保留',
        paragraphs: ['用模式 all、open、done 区分展示范围。filter 返回新数组；如果把它覆盖到任务状态，切回全部也无法取回刚才被筛掉的行。保存完整 tasks 和当前 filter，结果每次重新计算。'],
        codeLanguage: 'JavaScript', code: 'const tasks = [{ id: 1, done: true }, { id: 2, done: false }];\nconsole.log(tasks.filter(task => !task.done));\nconsole.log(tasks.length);',
      },
      {
        heading: '编辑以主记录的 ID 为准',
        paragraphs: ['渲染“待完成”时，第一行只代表第一条可见记录，未必是主数组的第一项。编辑时让按钮保存任务 ID，按 ID 更新。用对象展开复制已有记录，只替换要改的标题，其他字段继续保留。'],
        codeLanguage: 'JavaScript', code: 'const tasks = [{ id: 7, title: "读", done: true }, { id: 8, title: "写", done: false }];\nconst edited = tasks.map(task => task.id === 8 ? { ...task, title: "写测试" } : task);\nconsole.log(edited);',
      },
      {
        heading: '通过一个结果核对两个视图',
        paragraphs: ['编辑完成后同时检查主记录和可见记录。以编辑隐藏项为例，主记录的标题应更新，当前筛选结果可能不变。处理不存在的 ID 时应保留输入数组的内容并给予提示。'],
      },
    ],
    pitfalls: [
      { mistake: '按筛选后的行下标更新主表', why: '隐藏行会让两套下标错位。', fix: '使用稳定 ID 查找原始任务。' },
      { mistake: '替换成只有标题的新对象', why: '任务的 ID 和完成状态也会丢失。', fix: '复制原对象，再覆盖 title。' },
    ],
    practice: {
      prompt: '实现 solve(tasks, id, title, mode)。给定合法标题和模式，按 ID 改标题。返回 { titles, visibleIds }，其中 titles 为所有标题，visibleIds 是筛选后的 ID。缺失 ID 不修改数据。',
      hints: ['第一步用 map 改主表，遇到 ID 不同的行就原样返回。', '第二步在更新结果上筛选。用 open、done 各试一次，确认没有误改完成状态。'],
      checkpoints: ['编辑不会改变原顺序或完成状态。', 'hidden 记录仍可按 ID 更新，未知 ID 原样保留。'],
      solution: '先以 map 按 ID 生成更新后的数组，再以模式筛选并提取可见 ID。已完成和未完成分别检查 done 和 !done。',
    },
    quiz: [
      ['全部 3 条，筛选出 1 条后，主数组还应该有几条？', ['1 条', '0 条', '3 条'], 2, '筛选只决定展示范围。'],
      ['为何按 ID 更新？', ['可见行下标可能与主数组不同', '它总是 1', 'ID 要随标题改动'], 0, 'ID 用于跨视图识别同一条数据。'],
      ['{ ...task, title } 保留了什么？', ['仅 title', 'task 的其他字段', '只有筛选条件'], 1, '展开复制旧字段，再用新标题覆盖同名字段。'],
      ['在待完成视图中成功编辑了一条已完成任务，会发生什么？', ['这条任务变成未完成', '必须清空列表', '它的新标题已保存，但仍不可见'], 2, '标题编辑与完成状态是独立属性。'],
    ],
    exercise: checked(
      'function solve(tasks, id, title, mode) {\n  return { titles: [], visibleIds: [] };\n}',
      'function solve(tasks, id, title, mode) {\n  const updated = tasks.map(task => task.id === id ? { ...task, title } : task);\n  const visible = updated.filter(task => mode === "all" || task.done === (mode === "done"));\n  return { titles: updated.map(task => task.title), visibleIds: visible.map(task => task.id) };\n}',
      [
        { label: '筛选状态下编辑', input: [[{ id: 1, title: '读', done: true }, { id: 2, title: '写', done: false }], 2, '写测试', 'open'], expected: { titles: ['读', '写测试'], visibleIds: [2] } },
        { label: '空列表', input: [[], 1, '新标题', 'all'], expected: { titles: [], visibleIds: [] } },
        { label: '未知 ID', input: [[{ id: 3, title: '读', done: true }], 4, '新标题', 'done'], expected: { titles: ['读'], visibleIds: [3] } },
      ],
    ),
  }),
  lesson({
    id: 'task-keyboard-feedback', title: '支持键盘操作和状态反馈',
    summary: '通过原生控件、稳定焦点和明确反馈，让任务板能用键盘完成操作。',
    primer: {
      lead: '只用键盘的人既要知道焦点在哪，也要知道这次操作是否成功。按钮、状态文字与焦点转移都有各自职责。',
      terms: [['焦点', '当前接收键盘输入的元素'], ['aria-live', '告诉辅助技术动态文本需要播报的属性'], ['Escape', '常用于退出当前输入或编辑操作的键']],
    },
    objectives: ['用原生按钮和表单支持 Tab、回车与空格。', '为编辑取消、失败与成功设置合适的焦点和消息。'],
    sections: [
      {
        heading: '优先使用原生交互元素',
        paragraphs: ['button 自带键盘激活和焦点能力。多个“编辑”按钮可以在可访问名称里包含任务标题。使用 select 表达单选筛选，默认键盘行为可随操作系统工作。'],
        codeLanguage: 'HTML', code: '<label for="filter">筛选任务</label>\n<select id="filter"><option>全部</option><option>待完成</option></select>\n<button type="button" aria-label="编辑：阅读示例">编辑</button>',
      },
      {
        heading: '开始和退出编辑时管理焦点',
        paragraphs: ['进入编辑时把焦点移到标题输入框，并可选中当前标题。取消时恢复原数据，焦点送回触发编辑的按钮。若刚才的按钮已随筛选消失，把焦点送回输入框或其他仍可见的控件。'],
        codeLanguage: 'JavaScript', code: 'form.addEventListener("keydown", event => {\n  if (event.key === "Escape" && editingId !== null) {\n    event.preventDefault();\n    cancelEdit();\n  }\n});',
      },
      {
        heading: '用文字说明每次操作的结果',
        paragraphs: ['在 DOM 中预先放入 role="status" 的容器，之后更新其中的文本。新增成功、取消、没有符合筛选的任务、标题错误都值得给出明确反馈。错误可同时在输入控件上设 aria-invalid。'],
      },
    ],
    pitfalls: [
      { mistake: '在 div 上绑定 onclick 当按钮', why: '普通 div 默认无法用 Tab 聚焦或用空格点击。', fix: '使用真正的 button 并为它提供可读的名称。' },
      { mistake: '取消编辑时仍写入草稿', why: 'Escape 应取消当前操作，已保存的标题应保持原样。', fix: '仅在显式保存并通过验证时写回数据。' },
    ],
    practice: {
      prompt: '实现 solve(key, editing)。Enter 返回“提交当前表单”；正在编辑时 Escape 返回“取消编辑”；其它情况返回“交给浏览器”。',
      hints: [
        '把两个需要拦截的按键写成独立的 if：先判断 key === "Enter"，再判断 key === "Escape" && editing。',
        '空闲时的 Escape（editing 为 false）和 Tab 等导航键都不进入上述分支，统一落到最后的 return "交给浏览器"。',
      ],
      checkpoints: ['Escape 只在正在编辑时取消。', 'Tab 继续按原生规则移动焦点，未识别按键交给浏览器。'],
      solution: '分别判断 Enter 与编辑中的 Escape，其余统一保持浏览器默认行为。',
    },
    quiz: [
      ['选用哪种元素默认可以通过 Tab 和空格操作？', ['section', 'div', 'button'], 2, '原生按钮支持标准键盘交互。'],
      ['编辑启动后焦点应去哪？', ['标题输入框', '页面底部', '随意留在列表'], 0, '用户可以立即修改标题。'],
      ['按 Escape 取消编辑时怎么办？', ['保存草稿', '保留已保存的原标题', '删除这条任务'], 1, '取消只丢掉当前草稿。'],
      ['操作之后的提示适合放在哪？', ['只设置 CSS 颜色', '不显示', '预先存在的 role="status" 容器'], 2, '状态区可以传达动态的文字反馈。'],
    ],
    exercise: checked(
      'function solve(key, editing) {\n  return "交给浏览器";\n}',
      'function solve(key, editing) {\n  if (key === "Enter") return "提交当前表单";\n  if (key === "Escape" && editing) return "取消编辑";\n  return "交给浏览器";\n}',
      [
        { label: '键盘提交', input: ['Enter', false], expected: '提交当前表单' },
        { label: '退出编辑', input: ['Escape', true], expected: '取消编辑' },
        { label: '空闲时的 Escape', input: ['Escape', false], expected: '交给浏览器' },
        { label: '移动焦点的 Tab', input: ['Tab', true], expected: '交给浏览器' },
      ],
    ),
  }),
]

const reviewUpdateStarter = `function updateReview(completed, action) {
  // 实现 reset 和 A/B/C 三项的完成规则。
  return completed;
}`

const reviewUpdate = `function updateReview(completed, action) {
  if (action === "reset") return [];
  if (!["A", "B", "C"].includes(action) || completed.includes(action)) return completed;
  return [...completed, action];
}`

const reviewHarness = `

function solve(actions) {
  let completed = [];
  return actions.map(action => {
    completed = updateReview(completed, action);
    return completed.length;
  });
}`

function reviewPage(update: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>三项复习任务板</title>
  <style>
    body { font: 1rem/1.6 system-ui, sans-serif; margin: 0; }
    main { max-width: 34rem; margin: 0 auto; padding: 1.5rem; }
    li { margin-block: .75rem; }
    button { font: inherit; padding: .35rem .7rem; }
    button:focus-visible { outline: 3px solid #2855ad; outline-offset: 3px; }
  </style>
</head>
<body>
  <main>
    <h1>三项复习任务板</h1>
    <ul id="reviews">
      <li>阅读示例 <button type="button" data-task="A" aria-label="完成阅读示例" aria-pressed="false">完成</button></li>
      <li>运行代码 <button type="button" data-task="B" aria-label="完成运行代码" aria-pressed="false">完成</button></li>
      <li>整理笔记 <button type="button" data-task="C" aria-label="完成整理笔记" aria-pressed="false">完成</button></li>
    </ul>
    <p id="progress" role="status">已完成 0/3</p>
    <button id="reset" type="button">重置</button>
  </main>
  <script>
    ${update}

    let completed = [];
    const buttons = document.querySelectorAll("#reviews button");
    const progress = document.querySelector("#progress");

    function render() {
      for (const button of buttons) {
        const done = completed.includes(button.dataset.task);
        button.setAttribute("aria-pressed", String(done));
        button.textContent = done ? "已完成" : "完成";
      }
      progress.textContent = "已完成 " + completed.length + "/3";
    }

    function apply(action) {
      completed = updateReview(completed, action);
      render();
    }

    for (const button of buttons) {
      button.addEventListener("click", () => apply(button.dataset.task));
    }
    document.querySelector("#reset").addEventListener("click", () => apply("reset"));
  </script>
</body>
</html>`
}

const webFoundationCases: Case[] = [
  { label: '依次点击含一次重复', input: [['A', 'A', 'B', 'C', 'reset', 'A']], expected: [1, 1, 2, 3, 0, 1] },
  { label: '空状态重置', input: [['reset', 'reset']], expected: [0, 0] },
  { label: '未知动作保持现状', input: [['B', 'D', null]], expected: [1, 1, 1] },
]

const webFoundationProject: Project = {
  title: '三项复习任务板',
  summary: '制作能独立打开的网页，列出三项复习任务并显示完成数量。再把状态规则放进站内练习，验证重复点击和重置。',
  requirements: [
    '用 HTML 写出标题、复习任务列表、完成数和重置按钮。三项分别有可用键盘操作的完成按钮，CSS 排清层次并保留焦点轮廓。',
    '实现 updateReview(completed, action)。A、B、C 分别完成各自任务，重复点击不重复计数。reset 总是恢复 0/3，未知动作不改变当前状态。',
    '在站内开启「同页交互预览（受控沙箱）」直接点击 A、A、B、C、重置、A，并用 Tab 和回车核对键盘焦点；也可以随时下载 HTML 单独在浏览器验证。',
    '完成下方独立的 JavaScript 状态练习，自动化核对每次动作之后的累计数。',
  ],
  examples: [
    { label: '重复点击只记一次', input: '完成阅读示例两次，再完成运行代码、整理笔记，重置后再完成阅读示例。', expected: '完成数依次为 1/3、1/3、2/3、3/3、0/3、1/3。' },
    { label: '空状态重置', input: '初始页面连续点击两次重置。', expected: '两次都显示 0/3。' },
    { label: '未知动作保持现状', input: '完成运行代码后，向状态函数传入 D 和 null。', expected: '每一步都保持 1/3，页面的三个按钮始终对应 A、B、C。' },
  ],
  exercises: [
    { title: '制作单页任务板', language: 'html', starter: reviewPage(reviewUpdateStarter), solution: reviewPage(reviewUpdate), downloadName: 'review-board.html' },
    { title: '在站内检查完成状态', ...checked(reviewUpdateStarter + reviewHarness, reviewUpdate + reviewHarness, webFoundationCases) },
  ],
  explanation: '完成集合保存任务标识。每次由集合长度生成完成数，已经在集合里的编号无需再加入。重置用空数组替换完成集合，三个按钮的状态和计数随同一次渲染恢复。',
}

const taskUpdateStarter = `function updateTasks(state, action) {
  // 先实现校验和新增，再实现完成状态、编辑与筛选。
  return { ...state, message: "等待处理" };
}

function visibleTasks(state) {
  return state.tasks;
}`

const taskUpdate = `function updateTasks(state, action) {
  if (action.type === "filter") {
    if (!["all", "open", "done"].includes(action.value)) return { ...state, message: "未知筛选" };
    return { ...state, filter: action.value, message: "已更新筛选" };
  }
  if (!["add", "rename", "toggle"].includes(action.type)) return { ...state, message: "未知操作" };

  const target = action.type === "add" ? null : state.tasks.find(task => task.id === action.id);
  if (action.type !== "add" && !target) return { ...state, message: "任务不存在" };

  if (action.type === "toggle") {
    const tasks = state.tasks.map(task => task.id === action.id ? { ...task, done: !task.done } : task);
    return { ...state, tasks, message: target.done ? "已恢复待完成" : "已标为完成" };
  }

  const title = typeof action.title === "string" ? action.title.trim() : "";
  if (!title || [...title].length > 40) return { ...state, message: "请输入 1 到 40 个字符的标题" };
  if (action.type === "rename") {
    const tasks = state.tasks.map(task => task.id === action.id ? { ...task, title } : task);
    return { ...state, tasks, message: "已保存标题" };
  }

  const task = { id: state.nextId, title, done: false };
  return { ...state, nextId: state.nextId + 1, tasks: [...state.tasks, task], message: "已新增任务" };
}

function visibleTasks(state) {
  return state.tasks.filter(task => state.filter === "all" || task.done === (state.filter === "done"));
}`

const taskHarness = `

function solve(actions) {
  let state = { tasks: [], nextId: 1, filter: "all", message: "" };
  return actions.map(action => {
    state = updateTasks(state, action);
    const visible = visibleTasks(state).map(({ id, title, done }) => [id, title, done]);
    return [state.filter, state.tasks.length, visible, state.message];
  });
}`

function taskPage(update: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>课程任务管理页</title>
  <style>
    body { font: 1rem/1.6 system-ui, sans-serif; margin: 0; }
    main { max-width: 40rem; padding: 1.5rem; margin: 0 auto; }
    input, button, select { font: inherit; padding: .35rem .6rem; max-width: 100%; box-sizing: border-box; }
    :focus-visible { outline: 3px solid #2855ad; outline-offset: 3px; }
    form, li { margin-block: .75rem; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
    .status { min-height: 1.6em; }
  </style>
</head>
<body>
  <main>
    <h1>课程任务管理页</h1>
    <form id="task-form">
      <label id="title-label" for="title">新任务标题</label>
      <p id="title-hint">请输入 1 到 40 个字符。编辑时可按 Esc 取消。</p>
      <div class="actions">
        <input id="title" name="title" aria-describedby="title-hint result">
        <button id="submit" type="submit">新增任务</button>
        <button id="cancel" type="button" hidden>取消编辑</button>
      </div>
    </form>
    <label for="filter">筛选任务</label>
    <select id="filter">
      <option value="all">全部</option>
      <option value="open">待完成</option>
      <option value="done">已完成</option>
    </select>
    <p id="stats">已完成 0 项，共 0 项</p>
    <p id="empty">暂无任务</p>
    <ul id="tasks" aria-label="学习任务"></ul>
    <p id="result" class="status" role="status"></p>
  </main>
  <script>
    ${update}

    let state = { tasks: [], nextId: 1, filter: "all", message: "" };
    let editingId = null;
    const form = document.querySelector("#task-form");
    const title = document.querySelector("#title");
    const titleLabel = document.querySelector("#title-label");
    const submit = document.querySelector("#submit");
    const cancel = document.querySelector("#cancel");
    const filter = document.querySelector("#filter");
    const list = document.querySelector("#tasks");
    const stats = document.querySelector("#stats");
    const empty = document.querySelector("#empty");
    const result = document.querySelector("#result");

    function taskButton(action, task, label) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-label", label + "：" + task.title);
      button.dataset.action = action;
      button.dataset.id = task.id;
      return button;
    }

    function render() {
      const visible = visibleTasks(state);
      const rows = visible.map(task => {
        const row = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = task.title + (task.done ? "（已完成）" : "（待完成）");
        const actions = document.createElement("div");
        actions.className = "actions";
        actions.append(taskButton("toggle", task, task.done ? "恢复待完成" : "标为完成"), taskButton("edit", task, "编辑"));
        row.append(label, actions);
        return row;
      });
      list.replaceChildren(...rows);
      const completed = state.tasks.filter(task => task.done).length;
      stats.textContent = "已完成 " + completed + " 项，共 " + state.tasks.length + " 项";
      empty.hidden = visible.length !== 0;
      empty.textContent = state.tasks.length ? "没有符合当前筛选的任务" : "暂无任务";
      result.textContent = state.message;
    }

    function returnToButton(action, id, fallback) {
      const button = Array.from(list.querySelectorAll("button")).find(button => (
        button.dataset.action === action && Number(button.dataset.id) === id
      ));
      (button || fallback).focus();
    }

    function editingControls() {
      const editing = editingId !== null;
      titleLabel.textContent = editing ? "编辑任务标题" : "新任务标题";
      submit.textContent = editing ? "保存标题" : "新增任务";
      cancel.hidden = !editing;
      title.removeAttribute("aria-invalid");
    }

    function finishEditing() {
      const lastId = editingId;
      editingId = null;
      title.value = "";
      editingControls();
      returnToButton("edit", lastId, title);
    }

    function cancelEditing() {
      if (editingId === null) return;
      finishEditing();
      result.textContent = "已取消编辑";
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      const value = new FormData(form).get("title");
      const action = editingId === null ? { type: "add", title: value } : { type: "rename", id: editingId, title: value };
      const previousTasks = state.tasks;
      state = updateTasks(state, action);
      if (state.tasks === previousTasks) {
        title.setAttribute("aria-invalid", "true");
        result.textContent = state.message;
        title.focus();
        return;
      }
      render();
      finishEditing();
    });

    form.addEventListener("keydown", event => {
      if (event.key === "Escape" && editingId !== null) {
        event.preventDefault();
        cancelEditing();
      }
    });
    cancel.addEventListener("click", cancelEditing);

    list.addEventListener("click", event => {
      const button = event.target.closest("button[data-id]");
      if (!button) return;
      const id = Number(button.dataset.id);
      if (button.dataset.action === "edit") {
        const task = state.tasks.find(task => task.id === id);
        editingId = id;
        title.value = task.title;
        editingControls();
        title.focus();
        title.select();
        result.textContent = "正在编辑：" + task.title;
        return;
      }
      state = updateTasks(state, { type: "toggle", id });
      render();
      returnToButton("toggle", id, filter);
    });

    filter.addEventListener("change", () => {
      state = updateTasks(state, { type: "filter", value: filter.value });
      render();
      if (!empty.hidden) result.textContent = empty.textContent;
    });
  </script>
</body>
</html>`
}

const webAdvancedCases: Case[] = [
  {
    label: '新增、完成、筛选并编辑',
    input: [[
      { type: 'add', title: ' 阅读数组 ' },
      { type: 'add', title: '写测试' },
      { type: 'toggle', id: 1 },
      { type: 'filter', value: 'done' },
      { type: 'rename', id: 1, title: '阅读数组并整理' },
      { type: 'filter', value: 'all' },
    ]],
    expected: [
      ['all', 1, [[1, '阅读数组', false]], '已新增任务'],
      ['all', 2, [[1, '阅读数组', false], [2, '写测试', false]], '已新增任务'],
      ['all', 2, [[1, '阅读数组', true], [2, '写测试', false]], '已标为完成'],
      ['done', 2, [[1, '阅读数组', true]], '已更新筛选'],
      ['done', 2, [[1, '阅读数组并整理', true]], '已保存标题'],
      ['all', 2, [[1, '阅读数组并整理', true], [2, '写测试', false]], '已更新筛选'],
    ],
  },
  {
    label: '无符合筛选的任务',
    input: [[{ type: 'filter', value: 'open' }, { type: 'add', title: '写代码' }, { type: 'toggle', id: 1 }, { type: 'filter', value: 'all' }]],
    expected: [
      ['open', 0, [], '已更新筛选'],
      ['open', 1, [[1, '写代码', false]], '已新增任务'],
      ['open', 1, [], '已标为完成'],
      ['all', 1, [[1, '写代码', true]], '已更新筛选'],
    ],
  },
  {
    label: '空白标题和未知任务',
    input: [[{ type: 'add', title: ' ' }, { type: 'rename', id: 99, title: '写测试' }, { type: 'filter', value: 'missing' }]],
    expected: [
      ['all', 0, [], '请输入 1 到 40 个字符的标题'],
      ['all', 0, [], '任务不存在'],
      ['all', 0, [], '未知筛选'],
    ],
  },
  {
    label: '同名任务保持独立',
    input: [[{ type: 'add', title: '复习' }, { type: 'add', title: '复习' }, { type: 'toggle', id: 2 }, { type: 'toggle', id: 2 }]],
    expected: [
      ['all', 1, [[1, '复习', false]], '已新增任务'],
      ['all', 2, [[1, '复习', false], [2, '复习', false]], '已新增任务'],
      ['all', 2, [[1, '复习', false], [2, '复习', true]], '已标为完成'],
      ['all', 2, [[1, '复习', false], [2, '复习', false]], '已恢复待完成'],
    ],
  },
]

const webAdvancedProject: Project = {
  title: '课程任务管理页',
  summary: '把表单、任务列表、筛选和编辑做成一张能用键盘操作的页面。站内既可直接用受控沙箱交互预览，也可自动化验收核心状态逻辑。',
  requirements: [
    '实现 updateTasks(state, action) 和 visibleTasks(state)。新增或改名时清理首尾空白，标题须含 1 到 40 个 Unicode 码点。允许同标题任务，每项保留独立 ID。',
    '支持按 ID 完成或恢复、编辑标题及选择全部/待完成/已完成。筛选只影响展示。空筛选和错误操作都应给出反馈；非法操作不修改任务列表。',
    '站内 JS 每次操作输出 [筛选模式, 全部任务数, 可见任务, 状态消息]。其中每条可见任务的格式是 [ID, 标题, 已完成]。如果只更新消息，保留原 tasks 数组。',
    '在站内开启「同页交互预览（受控沙箱）」直接用 Tab 走到标题框并按 Enter 新增，编辑后按 Esc 取消，核对标题、焦点、空白标题、同名任务及筛选空状态；也可下载单页 HTML 离线交付。',
  ],
  examples: [
    { label: '新增、完成、筛选并编辑', input: '新增「阅读数组」和「写测试」。完成第一项，切换到已完成，改名为「阅读数组并整理」，再切回全部。', expected: '已完成视图只显示第一项。切回全部时，两项都可见，第一项保留改后的标题和完成状态。' },
    { label: '无符合筛选的任务', input: '切到待完成，新增「写代码」并标为完成，再切回全部。', expected: '待完成视图显示空状态。切回全部能看到已完成的「写代码」。' },
    { label: '空白标题和未知任务', input: '提交空白标题，或向状态函数传入不存在的任务 ID。', expected: '分别提示输入标题或任务不存在，已有任务不变。' },
    { label: '同名任务保持独立', input: '新增两个「复习」，将第二项标为完成后再恢复为待完成。', expected: '两项保留各自的编号，状态变化只影响第二项。' },
  ],
  exercises: [
    { title: '制作并打开单页管理器', language: 'html', starter: taskPage(taskUpdateStarter), solution: taskPage(taskUpdate), downloadName: 'task-manager.html' },
    { title: '在站内验收任务状态', ...checked(taskUpdateStarter + taskHarness, taskUpdate + taskHarness, webAdvancedCases) },
  ],
  explanation: '页面事件将用户操作转换成动作，由同一函数更新任务。列表、统计与空状态从完整数据派生，因此在待完成视图中标记一条任务完成后，任务只从当前视图消失。编辑取消由表单处理，不提交改名动作。',
}

export const webTracks: CurriculumTrack[] = [
  {
    direction: 'javascript',
    foundationProject: javascriptFoundationProject,
    advanced: { lessons: javascriptLessons, project: javascriptAdvancedProject },
  },
  {
    direction: 'computerScience',
    foundationProject: csFoundationProject,
    advanced: { lessons: csLessons, project: csAdvancedProject },
  },
  {
    direction: 'web',
    foundationProject: webFoundationProject,
    advanced: { lessons: webLessons, project: webAdvancedProject },
  },
]
