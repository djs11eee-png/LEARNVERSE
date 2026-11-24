import { advancedCourseCatalog, computerSystemsCatalog, courseCatalog } from '../courseCatalog'

interface TransferTask {
  title: string
  prompt: string
  requirements: string[]
  starter: string
  downloadName?: string
}

interface ProgramCheck {
  runSuffix: string
  expectedOutput: string
  caseLabels: string[]
}

type TransferCheck = TransferTask & {
  language: 'javascript' | 'python'
  example: string
  createCheck: () => ProgramCheck
  handoff?: string[]
}

export type TransferExercise = TransferCheck | (TransferTask & {
  language: 'html'
  checklist: string[]
})

function buildCheck(cases: [label: string, command: string, expected: unknown][], setup = ''): ProgramCheck {
  return {
    runSuffix: [setup, ...cases.map(([, command]) => command)].join('\n'),
    expectedOutput: cases.map(([label, , expected]) => `${label}：${JSON.stringify(expected)}`).join('\n'),
    caseLabels: cases.map(([label]) => label),
  }
}

function makeGroupCheck(): ProgramCheck {
  const minutes = 6 + Math.floor(Math.random() * 25)
  const minimum = minutes + 15
  const member = ['dan', 'lin', 'mei'][Math.floor(Math.random() * 3)]
  const mixedRows = [null, ['Do', 50], ['t', true], ['k', 121], ['b', 3, 4], ['b', 1], ['a', 4], ['b', 120]]
  const cases: [label: string, rows: unknown[], minimum: number, expected: [string, number][]][] = [
    ['先累计再筛选', [['a', 12], ['b', 20], ['a', 13], ['c', 3]], 20, [['a', 25], ['b', 20]]],
    ['忽略坏记录', mixedRows, 1, [['b', 121], ['a', 4]]],
    ['空清单', [], 10, []],
    ['更换成员与门槛', [[member, minutes], ['kai', minimum - 1], [member, 15], ['ivy', minimum + 1]], minimum, [[member, minimum], ['ivy', minimum + 1]]],
  ]
  return buildCheck(cases.map(([label, rows, threshold, expected]) => [
    label,
    `;console.log(${JSON.stringify(label + '：')} + JSON.stringify(groupMinutes(${JSON.stringify(rows)}, ${threshold})));`,
    expected,
  ]))
}

function makeLogCheck(): ProgramCheck {
  const minutes = 2 + Math.floor(Math.random() * 100)
  const cases: [label: string, lines: string[], errors: number[], minutes: [number, number]][] = [
    ['按类别汇总', ['focus,25\n', 'review, 15\n', 'focus,5'], [], [30, 15]],
    ['坏行位置', ['focus,1\n', '\n', 'review,+12\n', 'review,180\n', 'other,40\n', 'review,0\n', 'focus,09\n', 'review,181\n', 'review,6,2'], [3, 5, 6, 7, 8, 9], [1, 180]],
    ['只有空行', ['\n', '\t', '   \r\n'], [], [0, 0]],
    ['更换结尾与分钟数', [`focus,${minutes}\n`, `review,${minutes + 2}\n`, 'broken\n', 'focus,1'], [3], [minutes + 1, minutes + 2]],
  ]
  return buildCheck(cases.map(([label, lines, errors, totals]) => [
    label,
    `print(${JSON.stringify(label + '：')} + _learnverse_json.dumps(analyze(iter(${JSON.stringify(lines)})), sort_keys=True, separators=(",", ":")))`,
    { errors, minutes: totals },
  ]), 'import json as _learnverse_json')
}

function makePythonAttendanceCheck(): ProgramCheck {
  const bonus = 10 + Math.floor(Math.random() * 20)
  const threshold = bonus + 15
  const student = ['lin', 'zhou', 'chen'][Math.floor(Math.random() * 3)]
  const cases: [label: string, records: unknown[], minimum: number, expected: [string, number][]][] = [
    ['合并同名并筛选', [['wu', 15], ['sun', 20], ['wu', 10], ['he', 5]], 20, [['wu', 25], ['sun', 20]]],
    ['忽略坏记录与非正值', [['a', 0], ['b', -5], ['c', TrueStub], ['  ', 30], ['a', 25]], 10, [['a', 25]]],
    ['空签到表', [], 15, []],
    ['更换门槛与姓名', [[student, bonus], ['gao', threshold - 1], [student, 15], ['xu', threshold + 2]], threshold, [[student, threshold], ['xu', threshold + 2]]],
  ]
  return buildCheck(cases.map(([label, records, minimum, expected]) => [
    label,
    `print(${JSON.stringify(label + '：')} + _learnverse_json.dumps(summarize_attendance(${toPyLiteral(records)}, ${minimum}), separators=(",", ":")))`,
    expected,
  ]), 'import json as _learnverse_json')
}

const TrueStub = '__PY_TRUE__'
function toPyLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/"__PY_TRUE__"/g, 'True')
}

function makePythonMistakeCheck(): ProgramCheck {
  const extra = 2 + Math.floor(Math.random() * 6)
  const cases: [label: string, text: string, expected: { bad: number; totals: Record<string, number> }][] = [
    ['按模块累加', JSON.stringify([{ topic: '循环', count: 2 }, { topic: '字典', count: 3 }, { topic: '循环', count: 1 }]), { bad: 0, totals: { '字典': 3, '循环': 3 } }],
    ['混合坏记录与布尔值', JSON.stringify([{ topic: ' ', count: 2 }, { topic: '函数', count: true }, { topic: '函数', count: 0 }, { topic: '函数', count: 4 }]), { bad: 3, totals: { '函数': 4 } }],
    ['JSON 损坏', '[{topic: bad', { bad: -1, totals: {} }],
    ['更换模块与次数', JSON.stringify([{ topic: '异常', count: extra }, { topic: '异常', count: 1 }, 'skip']), { bad: 1, totals: { '异常': extra + 1 } }],
  ]
  return buildCheck(cases.map(([label, text, expected]) => [
    label,
    `print(${JSON.stringify(label + '：')} + _learnverse_json.dumps(summarize_mistakes(${JSON.stringify(text)}), sort_keys=True, ensure_ascii=False, separators=(",", ":")))`,
    expected,
  ]), 'import json as _learnverse_json')
}

function makeTicketCheck(): ProgramCheck {
  const target = 20 + Math.floor(Math.random() * 15)
  const cases: [label: string, rows: { id: string; no: number }[], query: number, expected: { order: string[]; first: number }][] = [
    ['稳定排序并查首号', [{ id: 'A', no: 5 }, { id: 'B', no: 2 }, { id: 'C', no: 5 }, { id: 'D', no: 3 }], 5, { order: ['B', 'D', 'A', 'C'], first: 2 }],
    ['查询缺失号', [{ id: 'X', no: 9 }, { id: 'Y', no: 4 }], 6, { order: ['Y', 'X'], first: -1 }],
    ['空候诊列表', [], 1, { order: [], first: -1 }],
    ['更换动态号段', [{ id: 'P', no: target }, { id: 'Q', no: target - 3 }, { id: 'R', no: target }], target, { order: ['Q', 'P', 'R'], first: 1 }],
  ]
  return buildCheck(cases.map(([label, rows, query, expected]) => [
    label,
    `;console.log(${JSON.stringify(label + '：')} + JSON.stringify(locateTicket(${JSON.stringify(rows)}, ${query})));`,
    expected,
  ]))
}

function makeLoanCheck(): ProgramCheck {
  const maxDays = 7 + Math.floor(Math.random() * 14)
  const catalog = ['cs-01', 'py-02']
  const cases: [label: string, raw: string, limit: number, expected: { status: number; code: string }][] = [
    ['合法借阅', JSON.stringify({ bookId: ' py-02 ', days: maxDays }), maxDays, { status: 201, code: 'ok' }],
    ['JSON 损坏', '{bad', maxDays, { status: 400, code: 'bad_json' }],
    ['未知馆藏', JSON.stringify({ bookId: 'none', days: 3 }), maxDays, { status: 404, code: 'unknown_book' }],
    ['天数越界与类型错', JSON.stringify({ bookId: 'cs-01', days: maxDays + 1 }), maxDays, { status: 400, code: 'bad_days' }],
  ]
  return buildCheck(cases.map(([label, raw, limit, expected]) => [
    label,
    `;console.log(${JSON.stringify(label + '：')} + JSON.stringify(validateLoan(${JSON.stringify(raw)}, ${JSON.stringify(catalog)}, ${limit})));`,
    expected,
  ]))
}

function makeArchBatchCheck(): ProgramCheck {
  const start = 10 + Math.floor(Math.random() * 5)
  const addend = 7
  const low = (start + addend) % 16
  const cases: [label: string, program: [string, number?][], mem: number[], expected: { status: string; acc: number; carries: number }][] = [
    ['累加与进位计数', [['LOAD', 0], ['ADD', addend], ['HALT']], [start, 0, 0, 0], { status: '停机', acc: low, carries: start + addend >= 16 ? 1 : 0 }],
    ['越界地址拦截', [['LOAD', 4], ['HALT']], [1, 2, 3, 4], { status: '地址故障', acc: 0, carries: 0 }],
    ['缺少停机指令', [['LOAD', 1], ['ADD', 2]], [0, 5, 0, 0], { status: '未停机', acc: 7, carries: 0 }],
  ]
  return buildCheck(cases.map(([label, program, mem, expected]) => [
    label,
    `;console.log(${JSON.stringify(label + '：')} + JSON.stringify(execBatch(${JSON.stringify(program)}, ${JSON.stringify(mem)})));`,
    expected,
  ]))
}

function makeIotColdChainCheck(): ProgramCheck {
  const timeout = 4 + Math.floor(Math.random() * 4)
  const frames = [
    { kind: 'beat', seq: 1, at: 1 },
    { kind: 'tick', at: 1 + timeout },
    { kind: 'frame', raw: 0x2080 },
    { kind: 'frame', raw: 0x2090 },
    { kind: 'frame', raw: 0x20A0 },
    { kind: 'frame', raw: 0x21E1, msgId: 'H1' },
    { kind: 'frame', raw: 0x21E1, msgId: 'H1' },
  ]
  const cases: [label: string, input: typeof frames, cap: number, limit: number, expected: { offline: number; alarms: number; dropped: number; queue: number[] }][] = [
    ['冷链断连、背压与告警去重', frames, 2, timeout, { offline: 1, alarms: 1, dropped: 1, queue: [9, 10] }],
    ['零缓冲边界', [{ kind: 'frame', raw: 0x1050 }, { kind: 'frame', raw: 0x1141, msgId: 'H2' }], 0, timeout, { offline: 0, alarms: 1, dropped: 1, queue: [] }],
  ]
  return buildCheck(cases.map(([label, input, cap, limit, expected]) => [
    label,
    `;console.log(${JSON.stringify(label + '：')} + JSON.stringify(replayColdChain(${JSON.stringify(input)}, ${cap}, ${limit})));`,
    expected,
  ]))
}

export const transferExercises: Partial<Record<string, TransferExercise>> = {
  [courseCatalog.python.id]: {
    language: 'python',
    title: '实验课签到分组统计',
    prompt: '脱离水果摊小票模板，在一个全新的实验课签到场景中独立完成清洗、累计与门槛筛选。',
    requirements: [
      '实现 summarize_attendance(records, minimum)，返回 [[姓名, 累计分钟], …] 的列表。',
      '每条有效记录为长度 2 的列表 [name, minutes]：name 去空白后非空，minutes 为严格整数（type(minutes) is int，拒绝 bool）且大于 0。',
      '按姓名首次出现有效记录的顺序累计分钟，只保留累计达到 minimum 的同学。',
    ],
    example: 'summarize_attendance([["wu", 15], ["sun", 20], ["wu", 10]], 20) 返回 [["wu", 25], ["sun", 20]]。',
    starter: 'def summarize_attendance(records, minimum):\n    return []',
    downloadName: 'attendance_summary.py',
    createCheck: makePythonAttendanceCheck,
  },
  [courseCatalog.pythonPractice.id]: {
    language: 'python',
    title: '错题本 JSON 清洗与按模块汇总',
    prompt: '从一段带坏记录的 JSON 文本里统计各模块错题数，检验异常边界与严格类型规则。',
    requirements: [
      '实现 summarize_mistakes(raw_text)，返回 {"totals": {模块名: 总数}, "bad": 坏记录数}。',
      '若 raw_text 不是合法 JSON 或解析结果不是列表，返回 {"totals": {}, "bad": -1}。',
      '有效元素为字典：topic 为去空白后非空的字符串，count 为严格正整数（拒绝 True/False、0 和字符串）；其余元素计入 bad。',
    ],
    example: '输入含 1 条合法记录与 1 条 count=True 的 JSON 列表时，bad 为 1，仅累加合法记录。',
    starter: 'import json\n\ndef summarize_mistakes(raw_text):\n    return {"totals": {}, "bad": 0}',
    downloadName: 'mistakes_report.py',
    createCheck: makePythonMistakeCheck,
  },
  [courseCatalog.javascript.id]: {
    language: 'javascript',
    title: '小组复习时长达标名单',
    prompt: '把一组复习记录合并成达标名单。从函数签名开始，自己设计累计和筛选的顺序。',
    requirements: [
      '实现 groupMinutes(rows, minimum)，返回由 [成员编号, 累计分钟] 组成的数组。minimum 是正整数。',
      '有效记录恰好有两个字段。编号是一个或多个小写英文字母，分钟数是 1 到 120 的整数。跳过其它记录。',
      '同一成员的有效分钟相加，累计分钟达到门槛才保留。输出顺序按成员首次出现有效记录的位置排列。',
    ],
    example: 'groupMinutes([["a", 12], ["b", 20], ["a", 13], ["c", 3]], 20) 返回 [["a", 25], ["b", 20]]。',
    starter: 'function groupMinutes(rows, minimum) {\n  \n}',
    createCheck: makeGroupCheck,
  },
  [advancedCourseCatalog.python.id]: {
    language: 'python',
    title: '从逐行日志生成复习报告',
    prompt: '接手一种新的日志格式。从函数签名开始实现读取、校验和汇总，为后续命令行工具提供核心逻辑。',
    requirements: [
      '实现 analyze(lines)，接收可逐行迭代的文本，从第 1 行计数。检查每行时跳过空白行，坏行记下原始行号后继续。',
      '有效行恰好包含两个逗号分隔字段，去掉两端空白后，类别是 focus 或 review，分钟数是 1 到 180 的十进制整数，只含 ASCII 数字且无前导零。',
      '返回 {"minutes": [专注总分钟, 复习总分钟], "errors": [坏行号, …]}，坏行号按原顺序排列。',
    ],
    example: '输入依次为 focus,18、一个空行、review,no、review,5，返回 {"minutes": [18, 5], "errors": [3]}。',
    starter: 'def analyze(lines):\n    pass',
    downloadName: 'study-log.py',
    createCheck: makeLogCheck,
    handoff: [
      '下载代码，为 study-log.py 增加命令行入口，接收一个文件路径，用 UTF-8 打开并交给 analyze。找不到文件时，显示清楚的提示并以非零状态退出。',
      '自己写一份带空白行和坏行的 records.csv，并列出它应该产生的汇总和行号。用 python study-log.py records.csv 实际核对。',
      '附上启动命令、示例文件和预期输出，请另一人在干净目录按说明运行。',
    ],
  },
  [advancedCourseCatalog.web.id]: {
    language: 'html',
    title: '交付一个活动报名页',
    prompt: '从空白文件写一个可离线打开的报名页，把表单、交互状态和键盘操作组合成一份可交付的 HTML。',
    requirements: [
      '提供有文字标签的姓名和活动字段，支持报名、按活动筛选和删除报名。用简短文字显示当前可见的报名人数。',
      '拒绝空白姓名和同一活动的重复报名，并在表单旁说明如何修正。删除最后一项后显示空状态，键盘焦点仍可继续操作。',
      '把 HTML、样式和脚本放在同一个文件里。可在站内受控交互预览中直接点按测试，也可下载后在浏览器单独核对。',
    ],
    starter: '',
    downloadName: 'activity-signup.html',
    checklist: [
      '我已在下载的页面中提交两个不同活动的报名，并验证筛选、删除、人数和空状态。',
      '我已尝试空白姓名和重复报名，确认状态未错误更新，而且提示说明了如何修正。',
      '我已只用键盘提交、筛选和删除，确认操作过程中焦点清楚可见。',
      '我已让他人在干净浏览器按简短说明打开 HTML，或从无痕窗口核对部署后的页面。',
    ],
  },
  [courseCatalog.algorithms.id]: {
    language: 'javascript',
    title: '候诊叫号稳定排序与首号定位',
    prompt: '在医院候诊叫号场景里组合稳定排序与左边界二分，确认同号顺序不颠倒且能精确定位首次出现下标。',
    requirements: [
      '实现 locateTicket(rows, query)，不修改原数组 rows，按 no 升序稳定排序（同号保持原先后）。',
      '在排序后的数组中用二分查找找出第一个 no === query 的下标（找不到返回 -1）。',
      '返回 { order: 排好序的 id 数组, first: 首次命中下标 }。',
    ],
    example: '输入 A:5、B:2、C:5、D:3，查 5，返回 { order: ["B", "D", "A", "C"], first: 2 }。',
    starter: 'function locateTicket(rows, query) {\n  return { order: [], first: -1 };\n}',
    createCheck: makeTicketCheck,
  },
  [courseCatalog.backend.id]: {
    language: 'javascript',
    title: '图书借阅接口输入校验器',
    prompt: '换到图书借阅接口场景，独立按顺序区分 JSON 损坏、馆藏不存在和借期越界三类响应。',
    requirements: [
      '实现 validateLoan(raw, catalog, maxDays)，返回 { status, code }。',
      'raw 无法解析或非普通对象返回 { status: 400, code: "bad_json" }；bookId 清理空白后不在 catalog 内返回 { status: 404, code: "unknown_book" }。',
      'days 必须是 1 到 maxDays 的整数，否则返回 { status: 400, code: "bad_days" }；全部通过返回 { status: 201, code: "ok" }。',
    ],
    example: 'catalog 为 ["cs-01"]、maxDays 为 14，提交 {"bookId":" cs-01 ","days":7} 返回 201 ok。',
    starter: 'function validateLoan(raw, catalog, maxDays) {\n  return { status: 400, code: "bad_json" };\n}',
    createCheck: makeLoanCheck,
  },
  [computerSystemsCatalog.architecture.id]: {
    language: 'javascript',
    title: '四位微机进位统计器',
    prompt: '在微机诊断台基础上换一个新目标：统计一批指令执行过程中四位加法一共产生了多少次进位。',
    requirements: [
      '实现 execBatch(program, mem)，初始 acc = 0、carries = 0，支持 LOAD addr、ADD val 和 HALT。',
      'LOAD 地址超出 [0, mem.length - 1] 时立即停止并返回 { status: "地址故障", acc, carries }。',
      'ADD 每次若 acc + val >= 16 则 carries 加 1 并保留低四位 (acc + val) % 16；遇 HALT 返回 "停机"，跑完未停机返回 "未停机"。',
    ],
    example: 'mem=[12,0,0,0]，执行 LOAD 0 → ADD 7 → HALT，返回 { status: "停机", acc: 3, carries: 1 }。',
    starter: 'function execBatch(program, mem) {\n  return { status: "未停机", acc: 0, carries: 0 };\n}',
    createCheck: makeArchBatchCheck,
  },
  [computerSystemsCatalog.iotProtocols.id]: {
    language: 'javascript',
    title: '冷链仓库边缘网关迁移回放',
    prompt: '切换到冷链温控场景，独立实现 16 位传感帧解包、心跳超时统计、告警去重与容量受限队列。',
    requirements: [
      '实现 replayColdChain(events, capacity, timeout)，返回 { offline, alarms, dropped, queue }。',
      'beat 仅高序号更新 lastBeat；tick 遇 lastBeat === null 或 at - lastBeat >= timeout 时 offline 加 1。',
      'frame 拆出中 8 位温度 (raw >>> 4) & 0xFF 与最低位告警 (raw & 1) === 1；告警按 msgId 去重记入 alarms；常规温度进入容量为 capacity 的丢旧保新队列 queue，满时递增 dropped。',
    ],
    example: '容量 2 连续收到温度 8、9、10 时，淘汰 8（dropped=1），queue 最终保留 [9, 10]。',
    starter: 'function replayColdChain(events, capacity, timeout) {\n  return { offline: 0, alarms: 0, dropped: 0, queue: [] };\n}',
    createCheck: makeIotColdChainCheck,
  },
}
