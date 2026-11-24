import type { LessonQuestion, LessonSection } from '../../workspaceCourses'
import type { AdvancedTrack, CurriculumLesson } from '../types'

type Exercise = CurriculumLesson['exercise']
type Quiz = [prompt: string, choices: string[], answer: number, explanation: string]

function sample(heading: string, paragraphs: string[], code: string, expectedOutput: string): LessonSection {
  return { heading, paragraphs, code, codeLanguage: 'Python', run: { language: 'python', expectedOutput } }
}

function workshop(heading: string, paragraphs: string[], starter: string, expectedOutput: string): LessonSection {
  return { heading, paragraphs, run: { language: 'python', starter, expectedOutput } }
}

function checked(template: string, implementation: string, expectedOutput: string, caseLabels?: string[]): Exercise & { solution: string } {
  return {
    language: 'python',
    starter: template,
    solution: template.replace('    # 在这里完成函数\n    return None', () => implementation),
    expectedOutput,
    caseLabels,
  }
}

type Lesson = Omit<CurriculumLesson, 'expansion'> & {
  objectives: string[]
  sections: LessonSection[]
  pitfalls: [mistake: string, why: string, fix: string][]
  prompt: string
  checkpoints: string[]
  hints: string[]
  approach: string
  quiz: Quiz[]
}

function lesson({ objectives, sections, pitfalls, prompt, checkpoints, hints, approach, quiz, ...content }: Lesson): CurriculumLesson {
  const questions: LessonQuestion[] = quiz.map(([prompt, choices, answer, explanation], index) => ({
    id: `${content.id}-${index + 1}`, prompt, choices, answer, explanation,
  }))
  return {
    ...content,
    expansion: {
      objectives, sections,
      pitfalls: pitfalls.map(([mistake, why, fix]) => ({ mistake, why, fix })),
      practice: { prompt, checkpoints, hints, solution: approach }, questions,
    },
  }
}

const iteration = lesson({
  id: 'lazy-iteration',
  title: '按需读取，少走多余的路',
  summary: '观察迭代器的当前位置，用生成器逐项产出，并检查只取前几项时到底读了多少。',
  primer: {
    lead: '窗口问工作人员要下一张登记单。每次只递一张，窗口关闭时后面的单子可以留在抽屉里。Python 的迭代模型也允许消费者先停下来。',
    terms: [
      ['可迭代对象', '可以交给 iter 取得迭代器的对象，如列表。'],
      ['迭代器', '保存当前位置，每次 next 向它索取下一项。'],
      ['生成器', '执行到 yield 时交出一个值、暂停并保留局部状态的一种迭代器。'],
    ],
  },
  objectives: ['追踪 iter、next 和耗尽状态', '用 yield 逐项交付已校验的数据', '记录源读取次数来证实只读所需项'],
  sections: [
    sample('先在手边追踪两个读取位置', [
      '列表保留整批值。对同一列表调用两次 iter 可以拿到两个独立的读取位置。advance = next(a) 表示从 a 读一项并推进 a；b 仍在起点。下一轮跑到末尾时，next(a) 会以 StopIteration 通知调用方。带第二个参数的 next(a, fallback) 在耗尽时交回给定值。',
      '下面先消耗 a 再碰 b。把列表改为空，在每次 next 调用都提供第二个参数后运行，观察耗尽和正常读取的区别。若 None 本身是有效数据，业务中就不要用它兼任无下一项的标志。',
    ], `values = [12, 25]
a = iter(values)
b = iter(values)
print(next(a), next(a), next(a, "结束"))
print(next(b))`, '12 25 结束\n12'),
    sample('yield 把继续处理的时点交给调用方', [
      '函数体含 yield 时，调用函数会创建迭代器。第一次 next 才进入函数体。每次遇到 yield，生成器保留自己的局部变量与执行位置，直到下一次被取用。下面故意给读取动作加一行 print，用它观察是不是提前扫完了源。',
      '第一个正数之前有 0，所以一次 next 读了两条。随后消费者停下来，第三个值没有访问。用 list(valid()) 会请求直到生成器耗尽，适合非常小的演示或调试，大文件处理时也能用 for 一项项接收。',
    ], `def valid():
    for value in [0, 12, 25]:
        print("读", value)
        if value > 0:
            yield value

items = valid()
print("收到", next(items))`, '读 0\n读 12\n收到 12'),
    workshop('小练习：写一个只交出合格值的生成器', [
      '保留控制台给出的轨迹。补上检查，使 next(items) 遇到第一个至少为 20 的值就返回。返回前只能看到 15 和 25，尾部 45 暂时还在源里。',
      '用 yield 代替构建列表。若把 for 循环的输入换成 [15, 19]，给 next 的第二个参数写成「无」，就能观察到所有项读完才返回备用值。正式练习会再加类型和空输入。',
    ], `def selected(values):
    for minutes in values:
        print("读取", minutes)
        # 补上门槛判断后再交出这一项。
        if False:
            yield minutes

items = selected([15, 25, 45])
print("收到", next(items, "无"))`, '读取 15\n读取 25\n收到 25'),
    {
      heading: '用一遍遍历组织消费者',
      paragraphs: [
        '生成器已经交出去的值不会自动回来。两次对同一个生成器求和，第二轮通常已经没有输入。需要独立比较时，可以从同一个短列表重新创建两只生成器；若源本身只可读取一次，就让同一个消费者同时更新计数、总和等信息。',
        '调试惰性程序时分别核对返回值和源访问轨迹。结果正确但提前读了上百条，仍违背了只取前两条的约定。小练习的「读取」打印是诊断探针，生产代码通常改成测试用的记录或计数。',
      ],
    },
  ],
  pitfalls: [
    ['调用生成器函数后立刻等输出', '函数体要等消费者取值才开始。', '对生成器调用 next 或放到 for 中。'],
    ['收集所有结果之后才取前两项', '会读完整个源，也增加内存占用。', '让生产者用 yield，消费者按量取用。'],
  ],
  prompt: '实现 valid_minutes(source)，按原顺序交出 1 到 1440 的严格整数分钟，用给定读取轨迹验证按需访问。',
  checkpoints: ['第一次只读到 12，第二次才读 25', '空源交出空列表，混合输入只保留 1 和 1440'],
  hints: ['直接遍历 source，把类型与范围判断放在同一个 if 中。', '合格时 yield value。不要先把 source 或输出转成列表。'],
  approach: '过滤后立即 yield。类型使用 type(value) is int，布尔值不会被当作整数。',
  quiz: [
    ['对同一个列表调用两次 iter，两个读取位置怎样变化？', ['彼此独立', '共享同一个下标', '第二个必定从末尾开始'], 0, '每次对列表调用 iter 得到独立迭代器。'],
    ['调用生成器函数后，什么时候开始执行函数体？', ['完成导入时', '第一次请求一个值时', '调用函数之前'], 1, '生成器按需执行，next 或 for 请求值时才推进。'],
    ['next(it, "无") 在 it 耗尽时给什么？', ['None', '上一个值', '无'], 2, '第二个参数是指定的备用值。'],
    ['要验证只读两条，除了结果还应观察什么？', ['源迭代器被推进的次数', '打印函数的名字', '列表的变量名'], 0, '访问轨迹能区分按需处理和先全量读取。'],
  ],
  exercise: checked(`def valid_minutes(source):
    # 在这里完成函数
    return None

def traced():
    for value in [False, 12, 25, 60]:
        print("读取", value)
        yield value

items = iter(valid_minutes(traced()) or [])
print("第一次", next(items, "无"))
print("第二次", next(items, "无"))
print("空源", list(valid_minutes([]) or []))
print("筛选", list(valid_minutes([0, True, 1, "25", 1440, 1441]) or []))`,
    `    for minutes in source:
        if type(minutes) is int and 1 <= minutes <= 1440:
            yield minutes`, '读取 False\n读取 12\n第一次 12\n读取 25\n第二次 25\n空源 []\n筛选 [1, 1440]'),
})

const records = lesson({
  id: 'typed-records',
  title: '把外部输入转换成稳定的记录',
  summary: '使用数据类表达字段契约，用独立函数检查原始字典，并让后续步骤接收已经整理好的值。',
  primer: {
    lead: '进入教室前，工作人员核对原始登记单，再打印统一格式的座签。座签只有下游确实使用的字段。查错发生在入口，后面的步骤就可以专注统计。',
    terms: [
      ['数据类', '用类体声明主要字段，让 dataclass 生成初始化、显示与值比较等常见方法。'],
      ['类型注解', '告诉阅读者和检查工具一个值预期是什么类型的说明。'],
      ['冻结实例', '已建立的对象禁止重新赋值给字段，本课的字段都是不可变的文本和整数。'],
    ],
  },
  objectives: ['读懂 @dataclass 与字段注解', '区分类型契约与运行时校验', '把原始字典统一成不可变记录或缺失结果'],
  sections: [
    sample('用字段声明代替到处传裸字典', [
      'from dataclasses import dataclass 引入标准库工具。@dataclass(...) 放在类定义前面，对这个类补齐常用行为。类体里的 course: str、minutes: int 写下两个字段及其类型。创建 Event("Python", 25) 后，用点号读 event.minutes，不必记字典里是否叫 minute、minutes 或 duration。',
      '默认的比较会逐字段比较同类实例。两条字段一样的记录可以用 == 核对。运行例子，再把 b 的分钟改为 20，第二行就由 True 变为 False。',
    ], `from dataclasses import dataclass

@dataclass(frozen=True)
class Event:
    course: str
    minutes: int

a = Event("Python", 25)
b = Event("Python", 25)
print(a.course, a.minutes)
print(a == b)`, 'Python 25\nTrue'),
    sample('注解表达意图，检查仍在输入边界完成', [
      'Python 在普通调用时不会因为字段注解而拒绝字符串，因此构造 Event("Python", "25") 可以成功。把校验集中放在 normalize，先确认输入是 dict，再读取字段，最后构造记录。dict.get 在找不到键时默认给 None，正适合表示缺失。',
      'frozen=True 防止已校验字段被后续逻辑随手改掉。这里两个字段都是不可变值。若字段是列表，冻结只限制重新赋值给字段，仍应通过值类型或复制来决定谁能修改内部数据。',
    ], `from dataclasses import dataclass

@dataclass(frozen=True)
class Event:
    course: str
    minutes: int

raw = Event("Python", "25")
print(type(raw.minutes).__name__)
print(type(True) is int)`, 'str\nFalse'),
    workshop('小练习：清理标签后才建立记录', [
      'clean_course 接收一个任意值。若它是字符串，调用 strip() 清理两边空白。清理得到空串时交回 None。先检查类型，可以避免对 None 调用 strip。',
      '仅补函数内部，三种输入分别得到 Python、None、None。下一步在成功清理后才组装 Event，错误行就不会掉进汇总函数。',
    ], `def clean_course(value):
    # 判断是文本之后再 strip。
    return None

for raw in [" Python ", "   ", 42]:
    print(clean_course(raw))`, 'Python\nNone\nNone'),
    {
      heading: '把归一化与汇总的职责分开',
      paragraphs: [
        '入口允许带空白的课程名，内部记录各处都用清理后的名字。若统计时也每次 strip，其他调用者仍可能忘记遵守同一规则。集中在 normalize 处理即可让错误走向明确。返回 Event | None 的注解表示两种合法返回，调用方应区分 None 与已有记录。',
        '分钟数要求 1 至 1440 的严格整数。用 True、"25" 和边界 1440 试验这些条件。范围和类型应同时满足，先判断类型，再比较大小，避免意外进行文本与整数的比较。',
      ],
    },
  ],
  pitfalls: [
    ['依靠 minutes: int 自动转换字符串', '注解可供工具和读者理解，普通构造不会完成转换。', '先在 normalize 检查类型范围，再创建记录。'],
    ['冻结实例里存共享的可变列表', '列表内容仍可被其他引用改动。', '本课用文本和整数保证记录的两个字段都稳定。'],
  ],
  prompt: '完成 normalize(raw)，把合法字典变为冻结的 Event，非法输入返回 None。',
  checkpoints: ['课程名去掉两端空白后再保存', '区分布尔值、字符串数字、空名和上限 1440'],
  hints: ['先用 isinstance(raw, dict) 判断形状。用 get 取 course 和 minutes。', '名称要在 strip 后检查。分钟先检查严格整数，再比较范围。'],
  approach: '各失败路径提前返回 None。直到全部条件通过才创建 Event。',
  quiz: [
    ['以下哪个写法是在对象上取字段？', ['event["minutes"]', 'event.minutes', 'Event.get(event)'], 1, '数据类实例使用点号读取字段。'],
    ['minutes: int 的运行时效果是什么？', ['自动调用 int', '任何时候拒绝字符串', '说明预期类型'], 2, '类型注解不会替代输入校验。'],
    ['为什么要在 strip 前先判断值是文本？', ['避免对其他类型调用文本方法', '让文本自动变大写', '让字符串成为可变对象'], 0, '只有约定的文本对象进入清理步骤。'],
    ['冻结的数据类中，一个列表字段怎样处理？', ['冻结会递归冻结列表', '列表内容仍可被修改', '不能使用任何容器字段'], 1, '冻结限制字段赋值，不改变字段指向对象自身的行为。'],
  ],
  exercise: checked(`from dataclasses import dataclass

@dataclass(frozen=True)
class Event:
    course: str
    minutes: int

def normalize(raw) -> Event | None:
    # 在这里完成函数
    return None

for raw in [
    {"course": " Python ", "minutes": 25},
    {"course": "SQL", "minutes": 1440},
    {"course": "  ", "minutes": 25},
    {"course": "Python", "minutes": True},
    {"course": "Python", "minutes": "25"},
    None,
]:
    event = normalize(raw)
    print(event.course, event.minutes) if event is not None else print("无效")`, `    if not isinstance(raw, dict):
        return None
    course = raw.get("course")
    minutes = raw.get("minutes")
    if not isinstance(course, str) or not course.strip():
        return None
    if type(minutes) is not int or not 1 <= minutes <= 1440:
        return None
    return Event(course.strip(), minutes)`,
    'Python 25\nSQL 1440\n无效\n无效\n无效\n无效', ['规范化课程名', '上限 1440', '纯空白名', '布尔值', '字符串数字', '顶层不是字典']),
})

const streaming = lesson({
  id: 'jsonl-input',
  title: '逐行解析，把坏行留在错误清单',
  summary: '用文本流模拟文件，从每一行解码一个值，保留原始行号并让合法输入继续流动。',
  primer: {
    lead: '一摞记录中夹有一张无法辨读的纸。只要能找到下一张的边界，后面的登记单仍可处理。逐行输入就给程序提供了这样的边界。',
    terms: [
      ['JSON Lines', '这里约定每个非空物理行独立存放一个 JSON 值，简称 JSONL。'],
      ['文本流', '能按顺序提供文本片段的输入，本章在内存中用 StringIO 模拟文件。'],
      ['诊断', '对失败事项的可核对描述。本章记录原始行号和稳定的错误标识。'],
    ],
  },
  objectives: ['区分 JSON 数组与逐行独立的 JSON 值', '使用 StringIO、enumerate 与逐行输入', '保留错误行号并区分解析结果和格式错误'],
  sections: [
    sample('从物理行出发，行号先于任何筛选', [
      '普通 JSON 文件的整体可以是一个数组。把数组拆开随意跨物理行读取，行与行通常不能单独解析。逐行输入的约定是先拿到一个完整行，再把那一行交给 json.loads。本课额外约定忽略全空白行，仍保留其行号位置。',
      'StringIO(text) 提供能被 for 遍历的文本流。这里读到的每行可能带换行符，strip() 会清理首尾空白。enumerate(source, start=1) 给原始流依次编号，跳过空行之前编号已经发生，所以后续诊断会指向原始文件。',
    ], `from io import StringIO

source = StringIO("first\\n\\nthird")
for number, line in enumerate(source, start=1):
    text = line.strip()
    if text:
        print(number, text)`, '1 first\n3 third'),
    sample('把解析成功和得到 None 分开记录', [
      '解析器可能成功拿到 null 对应的 None，也可能因为一行缺少括号而抛出 JSONDecodeError。如果只靠结果是否为 None 判断格式错误，就会把这两种情况合并。本章统一交付三项：行号、解析值、错误。错误为 None 表示语法解析成功；业务层再判断对象形状。',
      '用 try 把转换包起来，只捕获预期的 JSONDecodeError。无论坏行或正常行，消费者接到该行的结果后可以继续请求下一行。不要让一条诊断隐式表示文件已经结束。',
    ], `import json

def decode(line):
    try:
        return json.loads(line), None
    except json.JSONDecodeError:
        return None, "坏 JSON"

for line in ["null", "{", "25"]:
    value, error = decode(line)
    print(value, error)`, 'None None\nNone 坏 JSON\n25 None'),
    workshop('小练习：检查空行与数字 0', [
      '只补循环内的条件。空白行完全跳过，解析成数字 0 的行仍应打印出来。保留编号 1、3、4 的真实顺序。输出里的「格式错误」来自给定异常分支。',
      '先只用 strip 后的文本判断空白，然后解码。若先解码再用 if value 判断，合法数字 0 会被当成假值丢掉。',
    ], `import json
from io import StringIO

source = StringIO('0\\n \\n{\\n{"ok": true}\\n')
for number, line in enumerate(source, start=1):
    text = line.strip()
    # 在这里跳过真正的空白行。
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        print(number, "格式错误")
        continue
    print(number, value)`, "1 0\n3 格式错误\n4 {'ok': True}"),
    {
      heading: '由调用方管理流的生命周期',
      paragraphs: [
        '如果函数接收一个已经打开的流，由打开者安排关闭时间。解析函数只遍历输入，调用方可以自由选择内存样本或本地文件。with StringIO(text) as source 会在代码块结束时关闭流；生成器的完整消费应发生在这个范围内。',
        '错误清单可以由外层调用者收集。本章用小数据演示，实际长流可把诊断交给独立写入者，并决定记录条数上限。逐行读取减少原始输入的常驻量，最终汇总和诊断仍各自占用空间。',
      ],
    },
  ],
  pitfalls: [
    ['过滤完以后才枚举行号', '过滤会改变后续行的位置。', '先对原始输入 enumerate，再跳过空行。'],
    ['把 None 同时当成解析失败与空值', '合法 JSON null 也会得到 None。', '用独立 error 字段表示解析失败。'],
  ],
  prompt: '实现 read_lines(source)。跳过空白，按原始行号逐行产出 (number, value, error)。',
  checkpoints: ['异常行用「坏 JSON」，给出实际物理行号', '合法的 null 和 0 有各自的解析值，空输入产出 0 条'],
  hints: ['先枚举行和清理空白，仅在文本为空时 continue。', 'try 只包含 json.loads。为异常和成功都产出三项。'],
  approach: '让解析器逐条通知消费者状态。格式正确的值暂时不做业务验证。',
  quiz: [
    ['第一行空白，第二行损坏。损坏行号应该是多少？', ['0', '1', '2'], 2, '沿用原始流的行号，跳过空白不重新编号。'],
    ['合法的 JSON null 被解码后，error 应是什么？', ['None', '坏 JSON', '文件末尾'], 0, 'null 对应 Python 的 None，但语法仍解析成功。'],
    ['谁更适合管理已经打开的流？', ['任意下游函数', '打开该流的调用方', '第一次收到数据的记录'], 1, '资源所有者安排关闭，下游函数只消费上下文内的流。'],
    ['为什么换行是这里的恢复边界？', ['每一行约定独立组成一个 JSON 值', '字典没有行号', 'EOF 会重试'], 0, '上一行的解析失败不会改变下一行需要提交的文本。'],
  ],
  exercise: checked(`import json
from io import StringIO

def read_lines(source):
    # 在这里完成函数
    return None

with StringIO('null\\n\\n{\\n0\\n"Python"\\n') as source:
    for number, value, error in (read_lines(source) or []):
        print(number, repr(value), error)
with StringIO("  \\n") as source:
    print("空源", list(read_lines(source) or []))`, `    for number, line in enumerate(source, start=1):
        text = line.strip()
        if not text:
            continue
        try:
            value = json.loads(text)
        except json.JSONDecodeError:
            yield number, None, "坏 JSON"
        else:
            yield number, value, None`, "1 None None\n3 None 坏 JSON\n4 0 None\n5 'Python' None\n空源 []"),
})

const integration = lesson({
  id: 'pipeline-regression',
  title: '把解析、校验和统计串起来，再用小样本回归',
  summary: '将有副作用的输入输出留在边界，用顺序无关的统计规则和可重复的回归用例验收。',
  primer: {
    lead: '收件员认格式，审核员判有效，统计员合计。出了错，可以先核对各桌交接的内容，再追踪整批处理结果。程序也能按同样的边界逐步验证。',
    terms: [
      ['流水线', '把每一步的输出按明确契约交给下一步。'],
      ['纯计算', '固定输入得到固定结果，本章的排序与汇总属于这类步骤。'],
      ['回归用例', '保留实际曾出问题的输入和独立写下的预期，供之后的修改反复核对。'],
    ],
  },
  objectives: ['在一遍遍历中累计字典并稳定排序', '用不同阶段的用例缩小错误范围', '用旧故障样本和变式检验合并后的流水线'],
  sections: [
    sample('一次遍历同时更新需要的统计', [
      '已校验的记录带有 course 和 minutes，纯计算不必知道它来自字符串还是文件。对课程按键查找旧合计，用 totals.get(name, 0) 得到默认零。如果同一课程依次有 20、15 分钟，就先写入 20 再写入 35。',
      '汇总后的输出顺序是公开契约。sorted 的 key 在这里返回二元组 (-total, name)。时长大的值取负后排在前面；并列记录再按名称升序。变换输入顺序后，汇总结果和显示顺序应该保持一致。',
    ], `def summarize(rows):
    totals = {}
    for name, minutes in rows:
        totals[name] = totals.get(name, 0) + minutes
    return sorted(totals.items(), key=lambda row: (-row[1], row[0]))

print(summarize([("SQL", 35), ("Python", 20), ("Python", 15)]))
print(summarize([]))`, "[('Python', 35), ('SQL', 35)]\n[]"),
    sample('单步检查用来定位，组合检查验证交接', [
      '只测最后报告的总数，可能看不到课程名被错误并在一起的情况。先用合计函数自己的小输入核对重复键、空列表和排序。再用一份混合的原始文本，确认入口会拒绝坏记录，下游收到的内容与诊断都符合契约。',
      'assert 可以做学习用的回归检查。assert 条件, "说明" 在条件为假时抛出 AssertionError。它面向开发和测试，用户输入的验证仍用显式分支。任何一个检查失败就停止，让完成提示只在所有检查通过后出现。',
    ], `def total(values):
    result = 0
    for minutes in values:
        result += minutes
    return result

assert total([]) == 0, "空输入应保留初始值"
assert total(iter([20, 15])) == 35, "需要支持只走一遍的输入"
print("两项回归检查通过")`, '两项回归检查通过'),
    workshop('小练习：固定并列规则，交换输入做变式', [
      '模板给出两组相同内容但不同顺序的汇总数据。只修改 key 函数，使时长降序、名称升序。两次结果都应当是 Python、SQL、Web。若只取负时长，第二次中的并列结果会依赖输入先后。',
      '先手算三个键，再让程序输出。切换排序规则时只改一个条件，便于定位哪一项比较导致变化。',
    ], `def show(rows):
    result = sorted(rows, key=lambda row: row[0])
    print([name for name, minutes in result])

show([("SQL", 35), ("Python", 35), ("Web", 20)])
show([("Web", 20), ("Python", 35), ("SQL", 35)])`, "['Python', 'SQL', 'Web']\n['Python', 'SQL', 'Web']"),
    {
      heading: '定义失败后的可观察结果',
      paragraphs: [
        '一部分数据损坏后，调用者仍应得到正常部分的汇总和坏行清单。测试分别核对两部分。不要用诊断数量反推出合法总分钟数，也不要只看成功路径上的一行输出。',
        '回归用例从最小样本开始，让每个输入都能指出一种错误。先单独测合法空输入，再测有效值与坏值混排，最后检查并列、重复课程和边界时长。后续维护若发现漏报某一种行，就把那一行放进固定测试。',
        '预期值应在运行程序前独立写好。若把函数刚打印的结果直接当作答案，漏掉的诊断也会被记成正确。可以先手算两组极小数据，再用它们作参照检查更长的样本。',
        '汇总表的大小取决于不同课程数。原始文本能一行行释放，但诊断仍会随坏行增加。观察这两类状态各自的增长，才能说明程序在哪部分节省了空间。',
      ],
    },
  ],
  pitfalls: [
    ['汇总前多次遍历同一个迭代器', '第二轮可能没有数据。', '在一遍遍历中累计，之后只操作已经生成的汇总结果。'],
    ['只验证总分钟数', '键分错或坏行漏报也可能得到同一个总数。', '验证分组、排序和诊断清单。'],
  ],
  prompt: '实现 summarize(source)，按课程归并分钟数，并用降序总时长、升序课程名返回新列表。',
  checkpoints: ['能接收只读取一遍的迭代器', '空输入返回 []，并列顺序与原始输入先后无关'],
  hints: ['for 循环内更新 totals[name]，用 get 的默认值处理首次出现。', '先按分钟的负值排序，同值再比较课程名。'],
  approach: '哈希映射聚合同名课程，再按约定给汇总项排序。',
  quiz: [
    ['新课程第一次出现时，字典中没有合计，合适的起点是？', ['0', '当前课程名', 'None 加分钟数'], 0, '从零开始才能在同一个表达式中处理首次出现和已有值。'],
    ['课程并列时为什么还要比较名称？', ['使结果与同分数据的输入顺序无关', '让一个课程变成两个', '使所有分钟数相等'], 0, '有明确次要键才能固定并列输出。'],
    ['assert 是否适合作为用户输入的唯一检查？', ['是', '否，业务异常用显式分支处理', '只有文本才行'], 1, '业务校验是正常工作逻辑，assert 用于开发与测试中的不变量。'],
    ['哪项测试最能暴露坏行处理打断流水线？', ['混排合法行和坏行再核对总量及诊断', '只看空文件', '打印运行时间'], 0, '同时观察后续合法数据和错误清单能证明处理确实继续了。'],
  ],
  exercise: checked(`def summarize(source):
    # 在这里完成函数
    return None

fixtures = [
    ("累计与并列", [("SQL", 35), ("Python", 20), ("Python", 15)]),
    ("交换顺序", [("Python", 15), ("Python", 20), ("SQL", 35)]),
    ("较大优先", [("A", 20), ("Z", 25)]),
    ("空流", []),
]
for label, rows in fixtures:
    print(label + "：" + repr(summarize(iter(rows))))`, `    totals = {}
    for course, minutes in source:
        totals[course] = totals.get(course, 0) + minutes
    return sorted(totals.items(), key=lambda row: (-row[1], row[0]))`,
    "累计与并列：[('Python', 35), ('SQL', 35)]\n交换顺序：[('Python', 35), ('SQL', 35)]\n较大优先：[('Z', 25), ('A', 20)]\n空流：[]",
    ['累计与并列', '交换顺序', '较大优先', '空流']),
})

const pipelineFixture = `
def print_report(label, text):
    with StringIO(text) as source:
        report = analyze(source)
    print(label + "：" + json.dumps(report, ensure_ascii=False, separators=(",", ":")))

print_report("正常累计", """{"course":" Python ","minutes":20}
{"course":"SQL","minutes":35}
{"course":"Python","minutes":15}
{"course":"Web","minutes":50}""")
print_report("空流与空行", " \\n\\n")
print_report("混合坏行", """{"course":"Web","minutes":25}
{

null
{"course":"Web","minutes":true}
{"course":" Web ","minutes":15}""")
print_report("分钟边界", """{"course":"Python","minutes":0}
{"course":"Python","minutes":1}
{"course":"SQL","minutes":1440}
{"course":"Python","minutes":1441}""")

visited = []
def traced_source():
    for line in ["\\n", '{"course":"Web","minutes":9}\\n', '{"course":"SQL","minutes":10}']:
        visited.append(line)
        yield line

first = next(iter(read_lines(traced_source())), None)
number = first[0] if first is not None else None
print("按需读取：" + json.dumps([len(visited), number], separators=(",", ":")))
`

const pipelineStarter = `import json
from dataclasses import dataclass
from io import StringIO

@dataclass(frozen=True)
class Event:
    course: str
    minutes: int

def read_lines(source):
    # 产出 (物理行号, 解码值, 错误)。跳过空白行。
    return []

def normalize(raw) -> Event | None:
    # 检查字典、名称与时长。只构造合法记录。
    return None

def analyze(source):
    # 依次消费 read_lines 的结果，累计总量并收集诊断。
    return {"totals": [], "errors": []}
`

const pipelineSolution = `import json
from dataclasses import dataclass
from io import StringIO

@dataclass(frozen=True)
class Event:
    course: str
    minutes: int

def read_lines(source):
    for number, line in enumerate(source, start=1):
        text = line.strip()
        if not text:
            continue
        try:
            value = json.loads(text)
        except json.JSONDecodeError:
            yield number, None, "坏 JSON"
        else:
            yield number, value, None

def normalize(raw) -> Event | None:
    if not isinstance(raw, dict):
        return None
    course = raw.get("course")
    minutes = raw.get("minutes")
    if not isinstance(course, str) or not course.strip():
        return None
    if type(minutes) is not int or not 1 <= minutes <= 1440:
        return None
    return Event(course.strip(), minutes)

def analyze(source):
    totals = {}
    errors = []
    for number, raw, error in read_lines(source):
        if error is not None:
            errors.append([number, error])
            continue
        event = normalize(raw)
        if event is None:
            errors.append([number, "记录无效"])
            continue
        totals[event.course] = totals.get(event.course, 0) + event.minutes
    order = sorted(totals.items(), key=lambda row: (-row[1], row[0]))
    return {"totals": order, "errors": errors}
`

export const advancedPythonTrack: AdvancedTrack = {
  direction: 'python',
  lessons: [iteration, records, streaming, integration],
  project: {
    title: '课程活动日志流水线',
    summary: '将可逐行读取的学习日志整理为稳定的课程总量和带原始行号的错误清单。',
    requirements: [
      '先实现 read_lines(source)。使用一遍遍历按物理行号解码，每条非空行单独解析，损坏行记为「坏 JSON」。',
      '再实现 normalize(raw)。接受字典，课程名去空后非空，分钟数必须是 1 到 1440 的严格整数。返回 Event 或 None。',
      '最后实现 analyze(source)。保持对输入的单次消费，坏行写入 errors，合法行按课程累计。totals 按总分钟数降序，并列按课程名升序。输出字段依次为 totals、errors。',
      '保留给定的 StringIO 和验收样本。单独测试每一阶段，再跑正常、空流、混合坏行和边界输入。按需读取用可观察的源确认只扫描到第一条结果。验收模板负责打印。',
    ],
    examples: [
      { label: '正常累计', input: 'Python 20、15 分钟，SQL 35 分钟，Web 50 分钟', expected: 'Web 50、Python 35、SQL 35；错误清单为空。' },
      { label: '空流与空行', input: '输入只包含空白行', expected: '课程总量和错误清单都为空。' },
      { label: '混合坏行', input: 'Web 25 分钟、坏 JSON、空行、null、布尔值时长、Web 15 分钟', expected: 'Web 40 分钟；报告第 2 行「坏 JSON」，第 4、5 行「记录无效」。' },
      { label: '分钟边界', input: '时长依次为 0、1、1440、1441 分钟', expected: '第 1、4 行无效，第 2、3 行计入相应课程。' },
      { label: '按需读取', input: '第 1 行空白，第 2、3 行合法。消费者只取一个结果。', expected: '访问两行，返回原始行号 2。第 3 行仍未读取。' },
    ],
    exercises: [{
      language: 'python',
      starter: pipelineStarter + pipelineFixture,
      solution: pipelineSolution + pipelineFixture,
      expectedOutput: [
        '正常累计：{"totals":[["Web",50],["Python",35],["SQL",35]],"errors":[]}',
        '空流与空行：{"totals":[],"errors":[]}',
        '混合坏行：{"totals":[["Web",40]],"errors":[[2,"坏 JSON"],[4,"记录无效"],[5,"记录无效"]]}',
        '分钟边界：{"totals":[["SQL",1440],["Python",1]],"errors":[[1,"记录无效"],[4,"记录无效"]]}',
        '按需读取：[2,2]',
      ].join('\n'),
      caseLabels: ['正常累计', '空流与空行', '混合坏行', '分钟边界', '按需读取'],
    }],
    explanation: '三个阶段有各自的输入约定。逐行解析保留原始位置，校验把字典变为稳定记录，汇总使用字典和独立诊断清单。总时长并列时按课程名排序，错误可定位到原始行，也不会打断后续记录。',
  },
}
