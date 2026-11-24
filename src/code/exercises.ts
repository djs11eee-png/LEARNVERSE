import type { LessonExpansion } from '../data/lessonExpansion'
import { getCurriculumLesson } from '../data/curriculum'
import type { RunLanguage } from './runner'

export interface ChapterExercise {
  language: RunLanguage
  starter: string
  stdin?: string
  expectedOutput?: string
  /** Labels for exercises that print one result per case, in fixture order. */
  caseLabels?: string[]
  /** A separate runnable practice for chapters whose main exercise is a paper simulation. */
  prompt?: string
  checkpoints?: string[]
  solution?: string
}

const coding = (language: RunLanguage, starter: string, expectedOutput?: string, stdin?: string): ChapterExercise => ({ language, starter, expectedOutput, stdin })

function cMain(body: string, expected: string) {
  return coding('c', `#include <stdio.h>\n\nint main(void) {\n${body}\n    return 0;\n}\n`, expected)
}

function javaMain(name: string, body: string, expected?: string, helper = '') {
  return coding('java', `public class ${name} {\n${helper}    public static void main(String[] args) {\n${body}\n    }\n}\n`, expected)
}

function simulated(prompt: string, parameters: string, invocation: string, expectedOutput: string, implementation: string): ChapterExercise {
  const front = `function solve(${parameters}) {\n`
  const back = `\n}\n\nconsole.log(solve(${invocation}));\n`
  return {
    language: 'javascript',
    prompt,
    starter: front + '  // 从这一行开始写。把计算结果用 return 交回去。' + back,
    solution: front + implementation + back,
    expectedOutput,
    checkpoints: [`用题目给定的输入运行，输出应为「${expectedOutput}」。`, '先说出每一步要处理什么，再修改一组输入，检查结果跟着变化。'],
  }
}

const python = (starter: string, output?: string, stdin?: string) => coding('python', starter, output, stdin)
const js = (starter: string, output?: string) => coding('javascript', starter, output)
const html = (starter: string) => coding('html', starter)
const fullHtml = (head: string, body: string) => `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8">\n  ${head}\n</head>\n<body>\n  ${body}\n</body>\n</html>\n`

function checkedExercise(language: RunLanguage, template: string, solution: string, expectedOutput: string, caseLabels?: string[]): ChapterExercise {
  return { language, starter: template, solution: template.replace(/\/\* 补全这一段 \*\/[^\n]*/, () => solution), expectedOutput, caseLabels }
}

const roomBooking = checkedExercise('java', `public class RoomBooking {
    private final String room;
    private final int people;

    public RoomBooking(String name, int count) {
        /* 补全这一段 */ room = name; people = count;
    }

    String summary() {
        return room + " " + people;
    }

    // 下方是固定验收代码，不需要修改。
    static void check(String room, int count) {
        try {
            System.out.println(new RoomBooking(room, count).summary());
        } catch (IllegalArgumentException exception) {
            System.out.println("拒绝");
        }
    }

    public static void main(String[] args) {
        RoomBooking first = new RoomBooking(" A2 ", 4);
        RoomBooking second = new RoomBooking("B1", 7);
        System.out.println(first.summary() + "；" + second.summary() + "；合计 " + (first.people + second.people));
        check("A2", 1);
        check("A2", 12);
        check("", 4);
        check(null, 4);
        check("A2", 0);
        check("A2", 13);
    }
}`, `if (name == null || name.strip().isEmpty() || count < 1 || count > 12) {
            throw new IllegalArgumentException("检查房间名和人数");
        }
        room = name.strip();
        people = count;`, 'A2 4；B1 7；合计 11\nA2 1\nA2 12\n拒绝\n拒绝\n拒绝\n拒绝',
['两笔预约', '最少 1 人', '最多 12 人', '空房间名', '缺少房间名', '人数小于下限', '人数大于上限'])

const readCourses = checkedExercise('javascript', `const courses = [
  { id: "html", topic: "web", title: "HTML 结构" },
  { id: "js", topic: "web", title: "JavaScript 起步" },
];

function readCourses(target) {
  // 用 URL 拆出路径和查询条件，再构造响应对象。
  /* 补全这一段 */ return { status: 0, body: {} };
}

// 固定验收代码。用 - 表示有效的空列表。
for (const target of ["/api/courses?topic=web", "/api/courses?topic=other", "/api/courses/html", "/api/courses/unknown"]) {
  const result = readCourses(target);
  const body = result.body ?? {};
  const value = body.items ? (body.items.map(course => course.id).join(",") || "-") : (body.id ?? body.message);
  console.log(result.status, value);
}`, `const url = new URL(target, "https://learnverse.example");
  if (url.pathname === "/api/courses") {
    const topic = url.searchParams.get("topic");
    const items = topic === null ? courses : courses.filter(course => course.topic === topic);
    return { status: 200, body: { items } };
  }
  const course = courses.find(item => "/api/courses/" + item.id === url.pathname);
  if (course) return { status: 200, body: course };
  return { status: 404, body: { message: "没有找到课程" } };`, '200 html,js\n200 -\n200 html\n404 没有找到课程', ['按主题匹配', '主题无匹配', '找到课程', '课程缺失'])

const createSession = checkedExercise('javascript', `const sessions = [];
const courses = new Set(["web", "python"]);

function reject(field, code) {
  return { status: 400, body: { field, code } };
}

function createSession(raw) {
  // 依次解析、校验、保存。用 reject 返回字段和机器代码。
  /* 补全这一段 */ return { status: 0 };
}

for (const raw of ["{", "null", '{"courseId":"web","minutes":"25"}', '{"courseId":"web","minutes":0}', '{"courseId":" web ","minutes":25}']) {
  const result = createSession(raw);
  console.log(result.status, result.body?.field ?? "-", result.body?.code ?? result.body?.id ?? "-", sessions.length);
}
const first = sessions[0];
console.log(first?.id ?? "-", first?.courseId ?? "-", first?.minutes ?? "-");`, `let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return reject(null, "invalid_json");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) return reject(null, "expected_object");
  if (typeof body.courseId !== "string") return reject("courseId", "invalid_type");
  const courseId = body.courseId.trim();
  if (!courses.has(courseId)) return reject("courseId", "unknown_course");
  const minutes = body.minutes;
  if (!Number.isInteger(minutes)) return reject("minutes", "invalid_type");
  if (minutes < 1 || minutes > 1440) return reject("minutes", "out_of_range");
  const id = "s" + (sessions.length + 1);
  sessions.push({ id, courseId, minutes });
  return { status: 201, body: { id } };`,
'400 - invalid_json 0\n400 - expected_object 0\n400 minutes invalid_type 0\n400 minutes out_of_range 0\n201 - s1 1\ns1 web 25',
['JSON 损坏', '需要对象', '错误类型', '分钟越界', '创建成功', '读回规范化记录'])

const sessionTotals = checkedExercise('sql', `WITH
  courses(id, title) AS (VALUES ('web', '网页设计'), ('js', 'JavaScript 起步')),
  sessions(id, course_id, minutes) AS (VALUES ('s1', 'web', 12), ('s2', 'web', 25))
/* 补全这一段 */ SELECT * FROM courses;`, `SELECT c.id, c.title,
       COUNT(s.id) AS session_count,
       COALESCE(SUM(s.minutes), 0) AS total_minutes
FROM courses AS c
LEFT JOIN sessions AS s ON s.course_id = c.id
GROUP BY c.id, c.title
ORDER BY total_minutes DESC, c.id;`, 'id\ttitle\tsession_count\ttotal_minutes\nweb\t网页设计\t2\t37\njs\tJavaScript 起步\t0\t0')

const sessionTests = checkedExercise('javascript', `function createSession(minutes, rows) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return { status: 400, body: { field: "minutes" } };
  }
  rows.push({ id: "s" + (rows.length + 1), minutes });
  return { status: 201, body: { id: rows[rows.length - 1].id } };
}

const cases = [[0, 400], [1, 201], [1440, 201], [1441, 400], ["25", 400]];
for (const [input, expectedStatus] of cases) {
  const rows = [{ id: "s1", minutes: 10 }];
  const result = createSession(input, rows);
  // 分别核对响应、旧记录、新纪录或错误字段。
  /* 补全这一段 */ const ok = false;
  console.log(JSON.stringify(input), ok ? "通过" : "未通过");
}`, `const untouched = rows[0]?.id === "s1" && rows[0]?.minutes === 10;
  let storageMatches;
  if (expectedStatus === 201) {
    storageMatches = rows.length === 2 && rows[1].minutes === input && result.body?.id === rows[1].id;
  } else {
    storageMatches = rows.length === 1 && result.body?.field === "minutes";
  }
  const ok = result.status === expectedStatus && untouched && storageMatches;`,
'0 通过\n1 通过\n1440 通过\n1441 通过\n"25" 通过', ['下限外', '恰好下限', '恰好上限', '上限外', '字符串分钟'])

const authored: Record<string, Record<string, ChapterExercise>> = {
  'lv-python-foundations': {
    values: python('item = "苹果"\nprice = 4\nquantity = 3\n\n# 先计算总价，再输出小票。\n', '苹果 12 元'),
    decisions: python('reserved = 5\narrivals = 2\n\n# 先判断是否没有预约，再判断到场人数。\n', '再等等'),
    collections: python('weights = [3, 0, -2, 5, 2]\nvalid_weights = []\ntotal = 0\n\n# 逐项检查重量，再输出筛选列表和总重量。\n', '[3, 5, 2]\n10'),
    functions: python('def packages_needed(items, capacity=6):\n    # 写出计算方法，把结果交回调用处。\n    return 0\n\nprint(packages_needed(0))\nprint(packages_needed(6))\nprint(packages_needed(7))\nprint(packages_needed(items=7, capacity=4))\nprint(packages_needed(items=7, capacity=3))\n', '0\n1\n2\n2\n3'),
  },
  'lv-python-practice': {
    iteration: python('def first_session(values, minimum):\n    # 找到第一条达标记录，再返回序号和分钟数。\n    return None\n\nprint(first_session([12, 5, 28, 30], 25))\nprint(first_session([5, 12], 25))\n', '(3, 28)\nNone'),
    'list-transformations': python('logs = [("读", 5), ("练", 25), ("记", 15), ("看", 25)]\n\n# 先筛选，再排序。\nresult = []\nprint(result)\nprint(len(logs))\n', "[('练', 25), ('看', 25), ('记', 15)]\n4"),
    'mapping-and-sets': python('plan = {"列表", "字典", "模块"}\nrecords = [("字典", 15), ("字典", 10)]\nminutes = {}\n\n# 先累计，再找出未学主题。\n', "25\n['列表', '模块']"),
    'function-arguments': python('def weekly_plan(days, daily=25):\n    # 生成一个新的列表。\n    return [0, 0, 0]\n\nfirst = weekly_plan(3)\nprint(first)\nfirst[0] = 5\nprint(weekly_plan(3))\nprint(weekly_plan(2, 0))\n', '[25, 25, 25]\n[25, 25, 25]\n[0, 0]'),
    'modules-and-json': python(`import json\n\ndef display(text):\n    # 解析文本、验证字段，再给出显示结果。\n    return ""\n\nprint(display('{"course":"Python","minutes":25}'))\nprint(display('{"course":"Python","minutes":true}'))\n`, 'Python 25\n需要有效的整数分钟'),
    exceptions: {
      ...python('def add_minutes(records, raw):\n    # 先解析，再检查范围，通过后才写入。\n    return ""\n\nentries = [15]\nfor raw in ("25", "abc", "0"):\n    print(add_minutes(entries, raw))\nprint(entries)\n', '已记录\n需要整数\n时长超出范围\n[15, 25]'),
      caseLabels: ['有效输入', '转换失败', '范围无效', '最终列表'],
    },
  },
  'lv-javascript-foundations': {
    variables: js('const baseCount = 8;\nconst raw = " 7 ";\n\n// 清理输入，检查是否为正整数，然后输出结果。\n', '总计 15 张'),
    conditions: js('const minutes = 60;\n\n// 先检查是否有效，再从最大的区间往下判断。\n', '安排休息'),
    arrays: js('const minutes = [9, 24, 15, 6];\n\n// 选出达标记录，逐条编号，最后输出合计。\n', '1. 24 分钟\n2. 15 分钟\n达标时长 39 分钟'),
    functions: js('function roundsNeeded(questions, perRound) {\n  // 检查输入，把计算结果返回给调用者。\n}\n\nfunction roundLabel(result) {\n  // 返回提示文本。\n}\n\nconsole.log(roundLabel(roundsNeeded(13, 5)));\nconsole.log(roundLabel(roundsNeeded(0, 5)));\nconsole.log(roundLabel(roundsNeeded(13, 0)));\n', '需要 3 轮\n需要 0 轮\n检查题数和每轮安排'),
  },
  'lv-c-foundations': {
    'first-program': cMain('    /* 用两条 printf 输出标题和百分数。 */', 'Lab report\nProgress: 75%'),
    'values-and-operators': cMain('    int pencils = 29;\n    const int capacity = 12;\n    /* 分别求整盒数、余数和小数比值。 */', '2 5 2.4'),
    'control-flow': cMain('    int limit = 15;\n    int count = 0;\n    /* 在循环中判断每个数是否符合条件。 */\n    printf("%d\\n", count);', '7'),
    'functions-and-arrays': coding('c', '#include <stddef.h>\n#include <stdio.h>\n\nsize_t count_above(const int readings[], size_t length, int limit) {\n    /* 统计严格大于 limit 的元素。 */\n    return 0;\n}\n\nint main(void) {\n    int readings[] = {18, 20, 23};\n    size_t length = sizeof readings / sizeof readings[0];\n    printf("%zu\\n", count_above(readings, length, 19));\n    printf("%zu\\n", count_above(readings, length, 23));\n    printf("%zu\\n", count_above(readings, 0, 19));\n    return 0;\n}\n', '2\n0\n0'),
  },
  'lv-java-foundations': {
    'types-and-programs': javaMain('PosterBags', '        int posters = 17;\n        int capacity = 4;\n        // 输出满袋数、剩余张数和容量比值。', 'Full bags: 4\nLoose posters: 1\nRatio: 4.25'),
    'branches-and-loops': javaMain('ValidReadings', '        int[] readings = {-2, 4, 7, 0, 9};\n        int count = 0;\n        long total = 0L;\n        // 遍历读数，按题意跳过或结束。\n        System.out.println(count + " " + total);', '2 11'),
    methods: javaMain('Racks', '        System.out.println(rackSlots(0, 4));\n        System.out.println(rackSlots(8, 4));\n        System.out.println(rackSlots(9, 4));\n        System.out.println(rackSlots(Integer.MAX_VALUE, 4));', '0\n2\n3\n536870912', '    static int rackSlots(int items, int perRack) {\n        // 检查参数，再计算架子数。\n        return 0;\n    }\n\n'),
    objects: roomBooking,
  },
  'lv-web-foundations': {
    'html-structure': html(fullHtml('<title>活动中心</title>', '<main>\n    <!-- 补上主标题与两个内容区。 -->\n  </main>')),
    'css-style': html(fullHtml('<title>学习任务</title>\n  <style>\n    /* 为容器和卡片编写样式。 */\n  </style>', '<div class="tasks">\n    <div class="task">阅读</div>\n    <div class="task">练习</div>\n  </div>')),
    'links-and-forms': html('<!-- 先写跳转链接，再为表单添加主题与分钟数。 -->\n<form method="get">\n</form>\n\n<h2>填写规则</h2>\n'),
    'browser-interaction': simulated('先把按钮背后的规则写成一个函数：点击完成时数字最多到 3，点击重置则回到 0。给定当前 2 题和“完成”，结果应为 3。再试 3 题和“完成”、3 题和“重置”。', 'completed, action', '2, "完成"', '3', '  if (action === "重置") return 0;\n  if (action === "完成" && completed < 3) return completed + 1;\n  return completed;'),
  },
  'lv-backend-foundations': {
    http: readCourses,
    validation: createSession,
    data: sessionTotals,
    testing: sessionTests,
  },
  'lv-computer-science': {
    binary: simulated('输入分区号和座位号，将座位限制在 0 到 63 内。用 8 位文字输出编码，例如 2 号分区、37 号座位输出 10100101。超过范围就返回“超出范围”。', 'zone, seat', '2, 37', '10100101', '  if (zone < 0 || zone > 3 || seat < 0 || seat > 63) return "超出范围";\n  return (zone * 64 + seat).toString(2).padStart(8, "0");'),
    algorithms: simulated('为数值列表建立辅助表，返回目标在原列表的位置（从 0 开始），没找到返回 -1。先联结数值和位置，再排序和查找。', 'values, target', '[32, 14, 25, 10], 25', '2', '  const table = values.map((value, index) => ({ value, index }));\n  table.sort((a, b) => a.value - b.value);\n  return table.find(row => row.value === target)?.index ?? -1;'),
    structures: simulated('从记录列表找出指定名称下的所有编号。相同标题的记录可以有不同编号，不能只保留最后一条。', 'records, name', '[{id:"s1", name:"星图"}, {id:"s2", name:"星图"}], "星图"', 's1, s2', '  return records.filter(record => record.name === name).map(record => record.id).join(", ");'),
    testing: simulated('实现分数判定。整数 0 到 100 可用；小于 60 返回“未通过”，其余返回“通过”。无效输入返回“检查分数”。输出中用逗号连接这些结果。', 'scores', '[0, 59, 60, 100, 101]', '未通过,未通过,通过,通过,检查分数', '  const results = scores.map(score => {\n    if (!Number.isInteger(score) || score < 0 || score > 100) return "检查分数";\n    return score >= 60 ? "通过" : "未通过";\n  });\n  return results.join(",");'),
  },
  'lv-algorithms-foundations': {
    arrays: simulated('把 9 插在索引 2，再删掉索引 1 的项目。最后按逗号连接剩下的数字。可尝试 JavaScript 的 splice：第二个数是要删除几项，之后可以给新项目。', 'items', '[6, 8, 11, 13]', '6,9,11,13', '  const result = [...items];\n  result.splice(2, 0, 9);\n  result.splice(1, 1);\n  return result.join(",");'),
    search: simulated('在排好序的数组中找第一个大于或等于目标的位置。找不到就返回数组长度。用二分缩小 left 到 right 的范围。', 'items, target', '[3, 7, 7, 12, 16], 7', '1', '  let left = 0;\n  let right = items.length;\n  while (left < right) {\n    const mid = Math.floor((left + right) / 2);\n    if (items[mid] < target) left = mid + 1;\n    else right = mid;\n  }\n  return left;'),
    sorting: simulated('用冒泡排序将 [3, 1, 3, 2] 排成从小到大。逐对比较相邻元素，只在左边更大时交换，最后返回逗号分隔的结果。', 'items', '[3, 1, 3, 2]', '1,2,3,3', '  const result = [...items];\n  for (let end = result.length - 1; end > 0; end--) {\n    for (let i = 0; i < end; i++) {\n      if (result[i] > result[i + 1]) {\n        [result[i], result[i + 1]] = [result[i + 1], result[i]];\n      }\n    }\n  }\n  return result.join(",");'),
    'stacks-and-queues': simulated('模拟容量为 3 的简化队列。事件数组里，空字符串代表一次出队，有字母代表入队。队列已满时拒绝入队，最后返回从队头到队尾的内容。', 'events, capacity', '["P", "Q", "R", "", "", "S", "T", "U"], 3', 'R,S,T', '  const queue = [];\n  for (const event of events) {\n    if (event === "") queue.shift();\n    else if (queue.length < capacity) queue.push(event);\n  }\n  return queue.join(",");'),
  },
  'lv-ai-foundations': {
    tokens: simulated('用简化的长度预算核算资料能占多少 token。80 个总额度中，固定包装占 8、说明占 14、输出留 20。余额为负时返回 0。', 'budget, wrapper, instructions, reserved', '80, 8, 14, 20', '38', '  return Math.max(0, budget - wrapper - instructions - reserved);'),
    generation: simulated('用一个处于 0 到 1 之间的随机数模拟抽样。先把 A 的区间定为 [0, 0.6)，然后将剩余区间给 B。用 0.75 测试，再试 0.6 和 0.1。', 'randomValue, probabilityA', '0.75, 0.60', 'B', '  return randomValue < probabilityA ? "A" : "B";'),
    instructions: simulated('只统计已经筛好的同一场次记录。列表中 null 表示时长缺失，只要有一项缺失，就返回“资料不足”。否则把分钟数加起来。', 'minutes', '[40, null]', '资料不足', '  if (minutes.some(value => value === null)) return "资料不足";\n  return minutes.reduce((total, value) => total + value, 0);'),
    evaluation: simulated('计算一版模型在多组样本中的总通过率。先分别求通过数和总样本数，再算比例；不要直接把各组百分比相加。', 'passed, totals', '[4, 0, 2], [4, 2, 2]', '75%', '  const sum = numbers => numbers.reduce((total, count) => total + count, 0);\n  return (sum(passed) / sum(totals) * 100) + "%";'),
  },
  'lv-ros2-foundations': {
    nodes: simulated('用普通 JavaScript 模拟观测面板处理数据这一步。只读取最后 windowSize 条温度记录，输出其中最大的读数。试试把最后一条改为 26。', 'readings, windowSize', '[25, 20, 23, 22], 3', '23', '  return Math.max(...readings.slice(-windowSize));'),
    topics: simulated('只模拟 QoS 的可靠性这一项：订阅者要求“可靠”时，尽力而为的发布者满足不了它；其余组合视为兼容。返回“兼容”或“不兼容”。', 'offers, requests', '"尽力而为", "可靠"', '不兼容', '  return requests === "可靠" && offers !== "可靠" ? "不兼容" : "兼容";'),
    services: simulated('模拟服务面板筛选回复：只有请求编号等于当前编号，才能更新显示。匹配的响应显示单位，否则显示“等待当前回复”。', 'activeId, replyId, unit', '12, 11, "celsius"', '等待当前回复', '  return replyId === activeId ? unit : "等待当前回复";'),
    actions: simulated('逐步模拟动作面板。发出请求后显示“已申请取消”，服务端接受后显示“正在取消”，最终状态到达后才显示“已取消”。按顺序输出每一步的显示。如果草稿只有两个事件，在请求与最终事件之间补上“接受取消”，再检查三步的输出。', 'events', '["请求取消", "接受取消", "已取消事件"]', '已申请取消 → 正在取消 → 已取消', '  let state = "运行中";\n  const trace = [];\n  for (const event of events) {\n    if (event === "请求取消") state = "已申请取消";\n    if (event === "接受取消") state = "正在取消";\n    if (event === "已取消事件") state = "已取消";\n    trace.push(state);\n  }\n  return trace.join(" → ");'),
  },
}

export function getChapterExercise(courseId: string, lessonId: string, practice?: LessonExpansion['practice']): ChapterExercise | undefined {
  if (!practice) return undefined
  return authored[courseId]?.[lessonId] ?? getCurriculumLesson(courseId, lessonId)?.exercise
}
