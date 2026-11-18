import type { WorkspaceCourse } from './workspaceCourses'
import { courseCatalog } from './courseCatalog'

/**
 * Adapted from the Python 3.14 Tutorial, under PSF License Version 2.
 * Copyright (c) 2001 Python Software Foundation; All Rights Reserved.
 * Changes: selected topics reordered into six Chinese learning units; examples
 * changed to study-planning tasks; original explanations and questions added.
 * Full upstream license: public/licenses/python-3.14.0.txt.
 */
export const adaptedPython: WorkspaceCourse = {
  ...courseCatalog.pythonPractice,
  attribution: {
    title: 'Python 官方教程 · 站内改编',
    author: 'Python Software Foundation 与 Python 文档贡献者；LEARNVERSE 改编',
    version: 'Python 3.14 教程，2026-11-18 核对；许可文本存档自 CPython v3.14.0',
    license: 'PSF License Version 2',
    licensePath: '/licenses/python-3.14.0.txt',
    copyright: 'Copyright (c) 2001 Python Software Foundation; All Rights Reserved.',
    changes: '选取控制流、数据结构、模块、输入输出和异常处理主题，重新编排为六章中文学习单元；示例改为学习计划场景，新增讲解、知识检查和答案解析。这是节选改编，并非完整官方教程。',
    sources: [
      { title: '控制流与函数', url: 'https://docs.python.org/3.14/tutorial/controlflow.html' },
      { title: '数据结构', url: 'https://docs.python.org/3.14/tutorial/datastructures.html' },
      { title: '模块', url: 'https://docs.python.org/3.14/tutorial/modules.html' },
      { title: '输入与输出', url: 'https://docs.python.org/3.14/tutorial/inputoutput.html' },
      { title: '错误与异常', url: 'https://docs.python.org/3.14/tutorial/errors.html' },
    ],
  },
  lessons: [
    {
      id: 'iteration',
      demo: 'range',
      title: '遍历：次数、位置与元素',
      summary: '区分 range 与 enumerate，给学习任务编号，并找出符合条件的任务。',
      sections: [
        {
          heading: '边界决定循环的次数',
          paragraphs: [
            'range(start, stop, step) 描述一个整数序列，包含起点，不包含终点。省略起点时从 0 开始，省略步长时每次增加 1。range 本身不是列表；需要查看全部元素时可以用 list 转换。',
            '把 10 分钟分为若干提醒点，range(0, 10, 3) 会得到 0、3、6、9。不要把终点 10 也计入。负步长可以倒数，但起点与终点也必须与方向一致。',
          ],
          codeLanguage: 'Python',
          code: 'reminders = list(range(0, 10, 3))\ncountdown = list(range(3, 0, -1))\nprint(reminders)  # [0, 3, 6, 9]\nprint(countdown)  # [3, 2, 1]',
        },
        {
          heading: '让位置和元素一起出现',
          paragraphs: [
            'for 可以直接遍历列表中的元素。若还需要编号，enumerate 会为每个元素配上一个计数值；start=1 适合展示给读者的任务编号，它不会改变列表原本从 0 开始的索引。',
            '下面在找到第一个耗时至少 20 分钟的任务后用 break 结束循环。如果只是想跳过当前元素而继续遍历后面的元素，应使用 continue。',
          ],
          codeLanguage: 'Python',
          code: 'durations = [10, 25, 15]\nfor number, minutes in enumerate(durations, start=1):\n    if minutes >= 20:\n        print(number, minutes)  # 2 25\n        break',
        },
      ],
      questions: [
        { id: 'range-stop', prompt: 'list(range(2, 8, 2)) 的结果是？', choices: ['[2, 4, 6, 8]', '[2, 4, 6]', '[0, 2, 4, 6]', '[2, 3, 4, 5, 6, 7]'], answer: 1, explanation: '起点为 2，步长为 2，终点 8 不包含在序列中。' },
        { id: 'enumeration', prompt: 'enumerate(["阅读", "练习"], start=1) 的第二组值是？', choices: ['(1, "练习")', '(2, "阅读")', '(2, "练习")', '(0, "练习")'], answer: 2, explanation: 'start=1 让展示编号从 1 开始，第二个元素对应编号 2。' },
      ],
    },
    {
      id: 'list-transformations',
      title: '列表：修改与生成新结果',
      summary: '分清原地修改和返回新列表，用推导式筛选学习记录。',
      sections: [
        {
          heading: 'sort 修改原列表，sorted 返回新列表',
          paragraphs: [
            '列表是可变的。append 在末尾添加元素；pop 删除并返回一个元素，省略位置时取走最后一个。sort 直接修改列表的顺序，返回 None。',
            '需要保留原顺序时使用 sorted。不要写 minutes = minutes.sort()，这样会把变量重新绑定到 None，失去通过这个名字访问列表的能力。',
          ],
          codeLanguage: 'Python',
          code: 'minutes = [25, 10, 40]\nordered = sorted(minutes)\nprint(minutes)  # [25, 10, 40]\nprint(ordered)  # [10, 25, 40]\nresult = minutes.sort()\nprint(minutes, result)  # [10, 25, 40] None',
        },
        {
          heading: '把筛选和转换写清楚',
          paragraphs: [
            '列表推导式把新元素的表达式放在前面，再描述遍历过程，最后可以加筛选条件。先理解普通 for 循环，再使用这种更紧凑的表达。',
            '这里先取出每个学习时长，只保留至少 20 分钟的记录，再把这些记录增加 5 分钟。它生成新列表，不会修改 minutes。逻辑复杂时拆成普通循环通常更容易阅读。',
          ],
          codeLanguage: 'Python',
          code: 'minutes = [10, 25, 40]\nextended = [value + 5 for value in minutes if value >= 20]\nprint(extended)  # [30, 45]\nprint(minutes)   # [10, 25, 40]',
        },
      ],
      questions: [
        { id: 'sort-result', prompt: 'items = [3, 1]；result = items.sort()。result 是什么？', choices: ['[1, 3]', '[3, 1]', 'True', 'None'], answer: 3, explanation: 'sort 原地排序 items，本身返回 None。需要新列表时可使用 sorted(items)。' },
        { id: 'comprehension-result', prompt: '[n * 2 for n in [1, 2, 3] if n > 1] 得到什么？', choices: ['[4, 6]', '[2, 4, 6]', '[2, 3]', '[6]'], answer: 0, explanation: '先筛选 n > 1，留下 2 和 3，再分别乘以 2。' },
      ],
    },
    {
      id: 'mapping-and-sets',
      title: '字典与集合：记录和去重',
      summary: '用字典关联课程和进度，用集合判断已学与待学主题。',
      sections: [
        {
          heading: '按名称查找一条记录',
          paragraphs: [
            '字典将键关联到值。向同一个键赋值会更新已有值。用方括号访问不存在的键会触发 KeyError；get 可以在键不存在时返回指定的默认值。',
            'get 不会把默认值写回字典。下面对算法的查询返回 0，但 progress 仍然只有 Python 这一个键。需要同时遍历键和值时，使用 items。',
          ],
          codeLanguage: 'Python',
          code: 'progress = {"Python": 2}\nprogress["Python"] = 3\nprint(progress.get("算法", 0))  # 0\nprint("算法" in progress)      # False\nfor course, chapters in progress.items():\n    print(course, chapters)    # Python 3',
        },
        {
          heading: '只关心是否存在，而不是次数',
          paragraphs: [
            '集合只保存互不重复的元素，不提供列表那样的位置索引，也不保证展示顺序。创建空集合用 set()；单独的 {} 创建的是空字典。',
            '集合的差集 A - B 表示在 A 中、但不在 B 中的元素。它适合计算待学习主题；如果需要稳定的展示顺序，再对结果使用 sorted。',
          ],
          codeLanguage: 'Python',
          code: 'required = {"变量", "函数", "循环"}\nlearned = {"变量", "函数", "函数"}\npending = required - learned\nprint(len(learned))       # 2\nprint(sorted(pending))   # [\'循环\']',
        },
      ],
      questions: [
        { id: 'default-key', prompt: 'd = {}；d.get("Python", 0) 执行后，d 是什么？', choices: ['{"Python": 0}', '{}', '{0: "Python"}', 'None'], answer: 1, explanation: 'get 只读取或返回默认值，不会新增键。' },
        { id: 'set-difference', prompt: '{1, 2, 3} - {2, 4} 包含哪些元素？', choices: ['1、2、3、4', '2', '1、3', '4'], answer: 2, explanation: '差集保留左侧集合中不属于右侧集合的元素。' },
      ],
    },
    {
      id: 'function-arguments',
      title: '函数参数与默认值',
      summary: '写出调用方式清楚的函数，并避开可变默认参数造成的状态共享。',
      sections: [
        {
          heading: '默认值让常见调用更简洁',
          paragraphs: [
            '函数可以为参数提供默认值。调用时省略该参数，就使用默认值；也可以用参数名明确指定。return 把结果交给调用者，print 只负责展示。',
            '下面用 days 表示学习天数，minutes 表示每天的分钟数。study_time(3) 使用默认的 25 分钟，而 study_time(3, minutes=40) 明确覆盖这个值。',
          ],
          codeLanguage: 'Python',
          code: 'def study_time(days, minutes=25):\n    return days * minutes\n\nprint(study_time(3))              # 75\nprint(study_time(3, minutes=40))  # 120',
        },
        {
          heading: '每次调用需要独立的列表',
          paragraphs: [
            '默认参数值在执行函数定义时求值，不会在每次调用时重新创建。若把 [] 作为默认值并不断 append，多次省略参数的调用会共享同一个列表。',
            '常见写法是默认传 None，在函数体内创建新列表。下例两次省略 tasks 的调用各自得到独立结果；如果调用者显式传入一个列表，函数仍然会修改那个列表。',
          ],
          codeLanguage: 'Python',
          code: 'def add_task(title, tasks=None):\n    if tasks is None:\n        tasks = []\n    tasks.append(title)\n    return tasks\n\nprint(add_task("阅读"))  # [\'阅读\']\nprint(add_task("练习"))  # [\'练习\']',
        },
      ],
      questions: [
        { id: 'keyword-value', prompt: '按本章定义，study_time(2, minutes=15) 返回什么？', choices: ['50', '17', 'None', '30'], answer: 3, explanation: '关键字实参将 minutes 设为 15，因此返回 2 × 15。' },
        { id: 'mutable-default', prompt: '为什么 add_task 的默认参数使用 None？', choices: ['让省略参数的每次调用在函数体内创建独立列表', 'None 会自动把字符串变成列表', 'Python 不允许列表作为默认值', '让函数禁止接收列表'], answer: 0, explanation: 'Python 允许可变默认值，但该对象可能被多次调用共享；None 配合函数内创建列表可以避免这个问题。' },
      ],
    },
    {
      id: 'modules-and-json',
      title: '模块与 JSON 学习记录',
      summary: '通过 import 使用标准库，把结构化学习记录转成文本，再恢复为 Python 对象。',
      sections: [
        {
          heading: '把相关能力放进模块',
          paragraphs: [
            '模块组织可复用的定义。import math 将模块名引入当前作用域，再通过 math.ceil 使用其中的函数。from math import ceil 则直接引入 ceil 这个名字。',
            '为自己编写的模块取名时，应避免与需要导入的标准库同名。例如把脚本命名为 json.py，可能遮蔽真正的 json 模块。',
          ],
          codeLanguage: 'Python',
          code: 'import math\n\nminutes = 65\nsession_minutes = 25\nsessions = math.ceil(minutes / session_minutes)\nprint(sessions)  # 3',
        },
        {
          heading: 'JSON 文本不等于 Python 字典',
          paragraphs: [
            'json.dumps 把支持的 Python 数据转换为 JSON 字符串；json.loads 把 JSON 字符串解析回来。ensure_ascii=False 让中文字符直接出现在输出文本中。',
            '下面只在内存中转换数据，不会保存文件。JSON 中的对象键是字符串，布尔值写作 true 或 false；解析后对应 Python 的 True 或 False。不是任意 Python 对象都能直接序列化为 JSON。',
          ],
          codeLanguage: 'Python',
          code: 'import json\n\nrecord = {"course": "Python", "completed": True}\ntext = json.dumps(record, ensure_ascii=False)\nrestored = json.loads(text)\nprint(type(text).__name__)  # str\nprint(restored["completed"])  # True',
        },
      ],
      questions: [
        { id: 'module-access', prompt: '执行 import math 后，哪个写法能使用该模块的 ceil 函数？', choices: ['ceil.math(2.1)', 'math.ceil(2.1)', 'import.ceil(2.1)', 'math[ceil](2.1)'], answer: 1, explanation: 'import math 引入模块名，用模块名.属性名访问函数。' },
        { id: 'json-type', prompt: 'json.dumps({"chapters": 3}) 的返回值类型是什么？', choices: ['dict', 'list', 'str', '文件'], answer: 2, explanation: 'dumps 返回 JSON 字符串；需要用 loads 解析回对象。它本身不写入文件。' },
      ],
    },
    {
      id: 'exceptions',
      title: '处理可预期的输入错误',
      summary: '区分语法错误和运行时异常，捕获具体错误，让学习记录输入有清楚的反馈。',
      sections: [
        {
          heading: '语法正确，也可能无法执行',
          paragraphs: [
            '语法错误意味着解释器不能按语言规则解析代码；运行时异常则可能出现在语法正确的程序里。int("二十") 是合法的表达式，但这个文本不能按十进制整数解析，会触发 ValueError。',
            'try 中发生匹配的异常时，剩余语句被跳过，程序进入相应的 except 块。捕获具体的异常类型，可以避免把其他程序错误误当成普通输入问题。',
          ],
          codeLanguage: 'Python',
          code: 'raw = "二十"\ntry:\n    minutes = int(raw)\n    print(minutes)\nexcept ValueError:\n    print("请输入整数，例如 20")',
        },
        {
          heading: '解析成功后，还要检查业务范围',
          paragraphs: [
            'int("-5") 可以成功解析，但负数不适合作为学习分钟数。数据类型有效和业务规则有效是两件事。可以在转换成功后检查范围，并用 raise 主动抛出清楚的错误。',
            '下面的函数只接受 1 到 1440 的整数分钟。这个上限来自一天的分钟数，是本练习的规则。调用者负责把错误转为用户能理解的提示；没有匹配处理器的异常仍会向外传播。',
          ],
          codeLanguage: 'Python',
          code: 'def parse_minutes(raw):\n    minutes = int(raw)\n    if not 1 <= minutes <= 1440:\n        raise ValueError("分钟数需要在 1 到 1440 之间")\n    return minutes\n\ntry:\n    print(parse_minutes("-5"))\nexcept ValueError as error:\n    print(error)  # 分钟数需要在 1 到 1440 之间',
        },
      ],
      questions: [
        { id: 'specific-exception', prompt: 'int("abc") 产生的异常应由哪个处理器匹配？', choices: ['except KeyError:', 'except ZeroDivisionError:', 'except IndexError:', 'except ValueError:'], answer: 3, explanation: '字符串不能被解析为整数时，int 会触发 ValueError。' },
        { id: 'business-rule', prompt: '按本章 parse_minutes 的实现，输入 "0" 会怎样？', choices: ['主动触发 ValueError，因为不在允许范围', '返回 0', '触发 SyntaxError', '自动改成 1'], answer: 0, explanation: '0 能转换为整数，但不满足 1 ≤ minutes ≤ 1440，所以执行 raise。' },
      ],
    },
  ],
}
