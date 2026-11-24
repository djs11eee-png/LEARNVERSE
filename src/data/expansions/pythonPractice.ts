import type { CourseExpansions } from '../lessonExpansion'

export const pythonPracticeExpansions: CourseExpansions = {
  'lv-python-practice': {
    iteration: {
      objectives: ['从起点、终点和步长准确列出 range 的值', '区分用于展示的编号和用于取值的索引', '用 break 和 continue 表达不同的停止条件'],
      sections: [
        {
          heading: '先判断方向，再检查终点',
          paragraphs: [
            '读 range(8, 2, -2) 时，可以把 8 放在纸上，每次减 2，并在写下新值前问“它还严格大于 2 吗”。结果为 8、6、4。向上走时改用“严格小于终点”。方向与边界不匹配时，循环体一次都不执行：range(2, 8, -2) 是空序列。',
            'range 的三个参数必须是整数一类的值，步长不能为零。它不会预先为每个值分配列表位置。所以 range(1_000_000) 可以直接遍历；只有确实需要一次拿到整个序列时才使用 list。',
          ],
          codeLanguage: 'Python',
          code: 'print(list(range(8, 2, -2)))  # [8, 6, 4]\nprint(list(range(2, 8, -2)))  # []\nprint(6 in range(8, 2, -2))   # True',
        },
        {
          heading: '逐项登记序号和原始位置',
          paragraphs: [
            '一个列表的索引从 0 开始。enumerate(tasks, start=1) 的计数从 1 开始，适合打印“第 1 项”。循环体已经收到了任务本身，输出时直接用 task，无须再用 tasks[number] 重新查找。',
            '需要记录“第几项”和“用哪个索引删除”时，可以使用默认的 enumerate(tasks)，展示位置用 index + 1。不要边按原列表遍历边删除元素，因为删除会让后面的元素左移，下一次迭代可能跳过元素。用一个列表保存保留项，遍历结束后再替换。',
          ],
          codeLanguage: 'Python',
          code: 'tasks = ["复习", "重复项", "实验"]\nkept = []\nfor index, task in enumerate(tasks):\n    if task == "重复项":\n        continue\n    kept.append(task)\n    print(f"原第 {index + 1} 项：{task}")\n# 原第 1 项：复习\n# 原第 3 项：实验',
        },
        {
          heading: '查找任务时分清命中与耗尽',
          paragraphs: [
            '设想寻找第一条不少于 30 分钟的记录。遇到 15 分钟还要查下一条，遇到 35 分钟就知道答案，后面的 40 分钟无须检查。用 None 表示“尚未找到”，命中时赋值后 break。循环结束后再统一决定提示。空列表也会进入同一个未找到分支。',
            '判断“找到了吗”可用 found is not None。不要只写 if found，因为如果记录的是索引，索引 0 也会被当作假值。',
          ],
          codeLanguage: 'Python',
          code: 'minutes = [15, 35, 40]\nfound = None\nfor index, value in enumerate(minutes):\n    if value >= 30:\n        found = index\n        break\nprint(found)  # 1',
        },
      ],
      pitfalls: [
        { mistake: '把 range 的终点也算进去', why: '终点总是排除的。倒序时也一样，-1 仅用于让 0 有机会被取到。', fix: '想要依次得到 3、2、1、0，写 range(3, -1, -1)。' },
        { mistake: '命中时写 continue', why: 'continue 只结束当前一轮，后续命中可能覆盖第一次的结果。', fix: '只找第一个时，保存结果后立即 break。' },
      ],
      practice: {
        prompt: '为记录 [12, 5, 28, 30] 找出第一条达到 25 分钟的学习任务。按从 1 开始编号。再测试没有命中的列表 [5, 12]。',
        hints: [
          '先用 enumerate(values, start=1) 同时拿到从 1 开始的序号与对应分钟数，无需自己维护计数器。',
          '遇到第一个 minutes >= minimum 时直接 return (number, minutes)（或 break 退出循环）；若整轮遍历结束仍未命中，最后返回 None。',
        ],
        checkpoints: ['必须先检查每条记录的分钟数再决定是否停止。', '第一组应得到第 3 项、28 分钟。第二组应得到“未找到”。'],
        solution: '用 enumerate(..., start=1) 产生展示序号。找到后把序号和分钟数成对保存并退出。第二组循环执行完毕时，结果仍为 None。',
        codeLanguage: 'Python',
        code: 'def first_session(values, minimum):\n    for number, minutes in enumerate(values, start=1):\n        if minutes >= minimum:\n            return number, minutes\n    return None\n\nprint(first_session([12, 5, 28, 30], 25))  # (3, 28)\nprint(first_session([5, 12], 25))          # None',
      },
      questions: [
        { id: 'extra-direction', prompt: 'list(range(2, 8, -2)) 返回什么？', choices: ['[2, 4, 6]', '[2, 0, -2]', '[]', '抛出步长为 0 的错误'], answer: 2, explanation: '负步长要求起点严格大于终点。2 已不满足该条件，第一次也不执行。' },
        { id: 'extra-first', prompt: '找第一条达标记录时，赋值后要用哪个语句结束当前循环？', choices: ['break', 'continue', 'pass', 'import'], answer: 0, explanation: 'break 退出当前循环。continue 会继续检查后面的元素。' },
      ],
    },
    'list-transformations': {
      objectives: ['判断操作会改变原列表还是生成新列表', '理解排序键、稳定性与列表浅拷贝', '用普通循环检验推导式的每一步'],
      sections: [
        {
          heading: '先决定原始记录是否要保留',
          paragraphs: [
            '学习记录的原始顺序可能代表记录时间，按时长排序后仍需恢复时间线。用 sorted(logs) 得到新列表，logs 保持输入顺序。若旧顺序已经没有意义，可以对现有列表调用 logs.sort()；正在使用同一个列表的其他变量也会看到修改。赋值 backup = logs 只会给同一对象增加名字。',
            '用 logs.copy() 会复制外层列表，不会复制里面的可变对象。例如 logs 装的是字典，修改拷贝中的某个字典也会改变原记录。只有需要独立修改内部结构时再逐项复制，范围应依据数据形状确定。',
          ],
          codeLanguage: 'Python',
          code: 'logs = [{"minutes": 10}, {"minutes": 25}]\nouter = logs.copy()\nouter.append({"minutes": 50})\nprint(len(logs))  # 2\nouter[0]["minutes"] = 12\nprint(logs[0]["minutes"])  # 12',
        },
        {
          heading: '用 key 检索排序依据',
          paragraphs: [
            '如果一条记录包含名称和时长，排序时先挑出用于比较的字段。key 接受一个函数，为每条记录计算排序依据。下面把第三条记录放到最前，前两条的时长相同，排序会保留它们原先的相对次序。这叫稳定排序。',
            'reverse=True 表示按键从大到小排列。稳定排序仍保留相同键的原有顺序。若并列时应按名称排，使用元组作为键：先比较时长，再比较名称。是否需要保留原次序取决于需求，而不是由排序函数代做决定。',
          ],
          codeLanguage: 'Python',
          code: 'logs = [("阅读", 20), ("复盘", 20), ("实验", 10)]\nby_duration = sorted(logs, key=lambda item: item[1])\nprint(by_duration)  # [(\'实验\', 10), (\'阅读\', 20), (\'复盘\', 20)]',
        },
        {
          heading: '时长降序，名字升序',
          paragraphs: [
            '元组按位置从左向右比较。只在第一项相等时才看第二项。时长按大到小排，可以让时长大的记录获得更小的排序键：35 变成 -35，20 变成 -20。这里变的是比较用的值，记录本身仍保存正数。',
            '先用具名函数写出来，确认每一步能解释。把输入中两条 35 分钟的记录交换位置再运行，预期仍是 C 在 Python 之前。若对整个排序使用 reverse=True，名字也会倒过来。',
          ],
          codeLanguage: 'Python',
          code: `rows = [("Python", 35), ("Web", 20), ("C", 35)]

def order_by(row):
    name, minutes = row
    return (-minutes, name)

for name, minutes in sorted(rows, key=order_by):
    print(name, minutes)`,
          run: { language: 'python', expectedOutput: 'C 35\nPython 35\nWeb 20' },
        },
        {
          heading: '把推导式拆成可以追踪的循环',
          paragraphs: [
            '把 [n * 60 for n in durations if n > 0] 展开时，先创建空结果，再遍历每个 n。只在 n > 0 时执行 append(n * 60)。输入 [0, 2, 5] 的第一项被过滤，后两项依次变成 120 和 300。空输入返回空列表。',
            '写推导式只需要新的列表，不应该为了在遍历中顺便改原数据而调用 append 或执行打印。若筛选、换算和异常处理叠在一起，普通循环更容易定位是哪一项没有通过。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '用 backup = logs 保存原顺序，再对 logs.sort()', why: '两个变量指向同一个列表。原地排序会被两个名字同时看到。', fix: '用 ordered = sorted(logs) 生成排序结果，原变量保留顺序。' },
        { mistake: '把 key 当成某一个字段的当前值', why: '排序要为每条记录取得键，传入一个数字无法被调用。', fix: '把取值逻辑作为函数传给 key，例如 key=lambda row: row[1]。' },
      ],
      practice: {
        prompt: '从 [("读", 5), ("练", 25), ("记", 15), ("看", 25)] 中保留至少 15 分钟的记录，再按分钟从大到小排序。原列表要保持原样。',
        hints: [
          '先用列表推导式生成只包含 row[1] >= 15 的新列表，这样不会改动原列表 logs。',
          '再用 sorted(..., key=lambda row: row[1], reverse=True) 降序排列。Python 的稳定排序会自动保留两条 25 分钟记录的原有先后。',
        ],
        checkpoints: ['并列的“练”和“看”按原顺序出现。', '5 分钟的记录被筛掉，原数组仍有四项。'],
        solution: '先用推导式按分钟过滤，再对过滤结果用 key 和 reverse=True。稳定性意味着两个 25 分钟的项目会继续按照输入顺序相邻。',
        codeLanguage: 'Python',
        code: 'logs = [("读", 5), ("练", 25), ("记", 15), ("看", 25)]\nselected = [row for row in logs if row[1] >= 15]\nresult = sorted(selected, key=lambda row: row[1], reverse=True)\nprint(result)  # [(\'练\', 25), (\'看\', 25), (\'记\', 15)]\nprint(len(logs))  # 4',
      },
      questions: [
        { id: 'extra-alias', prompt: 'a = [2, 1]，b = a，再执行 a.sort()。b 变成什么？', choices: ['[2, 1]', '[1, 2]', 'None', '[]'], answer: 1, explanation: 'a 和 b 指向同一个列表，a.sort() 原地改变了这个对象。' },
        { id: 'extra-stable', prompt: '按时长排序时，“读”和“写”的时长相同，输入先出现“读”。排序后如果两项仍并列，谁在前？', choices: ['随机决定', '字母顺序决定', '写', '读'], answer: 3, explanation: 'Python 排序是稳定的。键相同的条目保持输入中的相对顺序。' },
      ],
    },
    'mapping-and-sets': {
      objectives: ['用字典累计同一个课程的多条记录', '区分键不存在、值为零和值为 None', '用集合交集和差集回答不同问题'],
      sections: [
        {
          heading: '同一个键可以更新多次',
          paragraphs: [
            '统计每个主题的学习分钟数时，一条输入记录由主题和时长组成。字典里的值保存已经累计的总数。每次先读取原值，不存在就按零计算，然后把新总数写回同一键。输入顺序是“算法 10、前端 8、算法 15”时，最后一次更新会把算法从 10 改为 25。',
            '这和把字典直接用作课程列表不同：重复键不会多保留一条记录。要保存每次学习开始时间或次序，应保留原记录列表，字典只负责统计。',
          ],
          codeLanguage: 'Python',
          code: 'rows = [("算法", 10), ("前端", 8), ("算法", 15)]\ntotals = {}\nfor topic, minutes in rows:\n    totals[topic] = totals.get(topic, 0) + minutes\nprint(totals)  # {\'算法\': 25, \'前端\': 8}',
        },
        {
          heading: '查询缺失和保存零不是一回事',
          paragraphs: [
            '下面“算法”实际存在，但值为 0。“数据库”尚未记录，get("数据库", 0) 也得到 0。如果产品要区分“已经记录零分钟”和“还没有记录”，就要先用 in 检查键，而不能将读取到零视为没有键。',
            '字典可以存 None。如果查找时也用 None 当默认值，单看返回值分不清两种情况。需要两个状态时先判断键是否存在，或者用专门的哨兵对象区分。迭代字典默认得到键，需要同时读取值时显式调用 items()。',
          ],
          codeLanguage: 'Python',
          code: 'minutes = {"算法": 0, "前端": None}\nfor topic in ("算法", "前端", "数据库"):\n    print(topic, topic in minutes, minutes.get(topic))\n# 算法 True 0\n# 前端 True None\n# 数据库 False None',
        },
        {
          heading: '先弄清左边集合代表什么',
          paragraphs: [
            '计划主题和已学主题都是集合。planned & learned 得到本计划已经完成的部分，planned - learned 得到待学主题，learned - planned 则得到课外已学主题。差集有方向，不能把两边调换。并集 planned | learned 表示两个集合中出现过的全部主题。',
            '集合有助于去重和判断成员，但不承诺迭代顺序。用户界面要按原计划排列时，可以遍历原始计划列表，只留下未完成项；只需按固定的字典序展示时可以用 sorted。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '写 totals[topic] += minutes 直接累计所有记录', why: '首次遇到该键还没有值，读取时会触发 KeyError。', fix: '先用 totals.get(topic, 0) 取默认零，计算后写回。' },
        { mistake: '把 learned - planned 当成待学主题', why: '差集从左侧集合取值，左侧已经是学过的主题。', fix: '写 planned - learned，并用两个只出现一次的例子核对方向。' },
      ],
      practice: {
        prompt: '计划为 {"列表", "字典", "模块"}，两条已学记录是 [("字典", 15), ("字典", 10)]。算出字典总时长，再列出未学的计划主题。',
        hints: [
          '遍历 records 时用 minutes[lesson] = minutes.get(lesson, 0) + duration 累加，避免首次写入触发 KeyError。',
          '已学主题集合就是 set(minutes)，用差集 plan - set(minutes) 得到未学主题，再包一层 sorted(...) 输出稳定顺序的列表。',
        ],
        checkpoints: ['字典的累计值为 25。', '未学主题包含列表和模块，不重复出现。'],
        solution: '先建立时长映射。映射的键就能生成已记录的主题集合。用计划减去该集合，再按需要排序。',
        codeLanguage: 'Python',
        code: 'plan = {"列表", "字典", "模块"}\nminutes = {}\nfor lesson, duration in [("字典", 15), ("字典", 10)]:\n    minutes[lesson] = minutes.get(lesson, 0) + duration\nprint(minutes["字典"])  # 25\nprint(sorted(plan - set(minutes)))  # [\'列表\', \'模块\']',
      },
      questions: [
        { id: 'extra-missing', prompt: 'd = {"算法": 0} 时，哪个表达式能区分已登记的 0 与没有记录？', choices: ['d.get("算法", 0) == 0', '"算法" in d', 'bool(d.get("算法"))', 'len("算法")'], answer: 1, explanation: 'in 查询字典中是否存在该键，不关心该键关联的值是不是零。' },
        { id: 'extra-intersection', prompt: 'A 是计划主题，B 是已学主题。哪个表达式表示本计划已完成的部分？', choices: ['A | B', 'B - A', 'A - B', 'A & B'], answer: 3, explanation: '交集只保留同时存在于 A 和 B 的主题。' },
      ],
    },
    'function-arguments': {
      objectives: ['区分形参与实参及位置与关键字调用', '跟踪默认值求值的时间', '判断函数是否修改调用者传入的列表'],
      sections: [
        {
          heading: '同一个函数可以用不同方式传参',
          paragraphs: [
            '定义函数时，参数名决定函数体怎么使用这些值。调用 plan_total(3, 20) 时，第一个实参交给 days，第二个交给 minutes。用关键字调用 plan_total(minutes=20, days=3) 也得到 60，并且读者不必猜数字对应哪个量。',
            '位置参数要放在普通关键字参数之前。plan_total(3, days=2) 两次为 days 赋值，调用就会报错。默认值只在调用者省略对应参数时参与绑定：plan_total(days=2) 使用 25 分钟，显式传入 minutes=0 则真的使用零。',
          ],
          codeLanguage: 'Python',
          code: 'def plan_total(days, minutes=25):\n    return days * minutes\n\nprint(plan_total(3, 20))                 # 60\nprint(plan_total(minutes=20, days=3))    # 60\nprint(plan_total(days=2))                 # 50\nprint(plan_total(2, minutes=0))           # 0',
        },
        {
          heading: '从两次调用看默认列表何时共享',
          paragraphs: [
            '假设函数定义写成 def add(task, tasks=[])。执行 def 的时候，括号里的 [] 已经创建好了。第一次省略 tasks 会向它追加“读书”，第二次省略时又追加“练习”，刚才保存的第一次返回值也指向同一对象，因此后来看到的是两项。',
            '默认值并不禁止传入列表。写成 tasks=None，再在函数体里根据 tasks is None 创建空列表，可以保证每次省略都得到新对象。不要换成 if not tasks，因为显式传进来的空列表也是假值，这会把调用者提供的列表替换掉。',
          ],
        },
        {
          heading: '决定是修改原列表还是返回新计划',
          paragraphs: [
            '当函数接收外部列表时，tasks.append 会直接修改共享的对象。若希望返回一个新的计划，可以只复制外层列表，再把任务追加进去。当列表里只是字符串时，浅拷贝已经足够；处理嵌套字典时要考虑内部值是否也会被修改。',
            '对比两种契约时先看调用者。想保留旧计划方便撤回，通常返回新列表；想让多处界面看到同一份更新后的清单，则可以显式设计为修改原列表，并说明这个变化。在示例中 original 一直只有一项，updated 有两项。',
          ],
          codeLanguage: 'Python',
          code: 'def with_task(title, tasks=None):\n    result = [] if tasks is None else list(tasks)\n    result.append(title)\n    return result\n\noriginal = ["读书"]\nupdated = with_task("练习", original)\nprint(original)  # [\'读书\']\nprint(updated)   # [\'读书\', \'练习\']',
        },
      ],
      pitfalls: [
        { mistake: '定义函数时把 [] 当作每次调用的新列表', why: '默认值在 def 执行时创建，省略参数的多次调用会共享它。', fix: '用 None 表示缺省，在函数体内创建列表。' },
        { mistake: '用 print 显示计算结果后就结束函数', why: '看得到文字不代表调用者拿到了值。没有 return 语句时，函数返回 None。', fix: '计算函数 return 结果；由调用者决定是否打印。' },
      ],
      practice: {
        prompt: '写 weekly_plan(days, daily=25)，返回每天分钟数的列表。测试默认 3 天，以及显式 daily=0 的 2 天。再改动第一次返回的列表，检查第二次调用是否独立。',
        hints: [
          '在函数体内部每次调用时新建列表（例如 [daily] * days 或列表推导式），绝不要在函数参数里把可变列表写为默认值。',
          '注意显式传入 daily=0 属于合法值，不要用 daily or 25 之类会把 0 误当假值的写法。',
        ],
        checkpoints: ['默认 3 天返回 [25, 25, 25]，两天、每天零分钟返回 [0, 0]。', '修改某次返回的结果不会污染下一次。'],
        solution: '在函数体内按天数创建新列表即可。这里重复的是整数，整数不可变，因此不需要为每项另建可变容器。',
        codeLanguage: 'Python',
        code: 'def weekly_plan(days, daily=25):\n    return [daily] * days\n\nfirst = weekly_plan(3)\nprint(first)               # [25, 25, 25]\nfirst[0] = 5\nprint(weekly_plan(3))      # [25, 25, 25]\nprint(weekly_plan(2, 0))   # [0, 0]',
      },
      questions: [
        { id: 'extra-binding', prompt: 'plan_total(days, minutes=25) 的哪种调用会给 days 传入两次值？', choices: ['plan_total(3)', 'plan_total(days=3, minutes=20)', 'plan_total(3, days=2)', 'plan_total(minutes=20, days=3)'], answer: 2, explanation: '第一个位置实参已绑定 days，关键字 days 又指定一次，调用失败。' },
        { id: 'extra-mutation', prompt: '函数接收列表 tasks 后直接调用 tasks.append("新任务")，调用者的列表会怎样？', choices: ['增加一项', '完全不变', '自动被复制', '变成 None'], answer: 0, explanation: 'append 原地修改列表，函数和调用者都能看到对同一列表的变化。' },
      ],
    },
    'modules-and-json': {
      objectives: ['识别 import 绑定了哪个名字', '在字符串和 Python 对象之间正确转换', '在解析后检查数据的形状与字段'],
      sections: [
        {
          heading: '模块名同时也是读代码的线索',
          paragraphs: [
            'import math 后，math.ceil(2.1) 清楚地标明函数来自数学标准库。from math import ceil 后，可以直接写 ceil(2.1)，但同一文件再定义同名函数就会覆盖这个名字。接口较多时保留模块前缀通常更便于读懂来源。',
            '模块导入时会执行顶层代码，通常首次导入后会复用已加载模块。同一个文件既要被导入又要作为脚本运行时，可以把演示放进 if __name__ == "__main__"。这样导入者得到函数，演示输出只在直接执行时出现。',
          ],
          codeLanguage: 'Python · 单文件示例',
          code: 'import math\n\ndef sessions(minutes):\n    return math.ceil(minutes / 25)\n\nif __name__ == "__main__":\n    print(sessions(51))  # 3',
        },
        {
          heading: '序列化以后仍然只是文本',
          paragraphs: [
            'json.dumps(record) 的输出是字符串，适合传输或写文件。字符串索引 text[0] 拿到的是第一个字符，不能用 text["course"] 取字段。只有 json.loads(text) 转回 Python 对象，才可以像查字典那样访问键。',
            'JSON 的对象键必须是字符串，所以尽量用字符串作记录键。Python 元组序列化时会成为 JSON 数组，再解析回来就成为列表。往返转换能保持许多常见值，却不会恢复每种 Python 对象的原类型。',
          ],
          codeLanguage: 'Python',
          code: 'import json\n\nencoded = json.dumps({"goal": ("阅读", 25)}, ensure_ascii=False)\nprint(encoded)                  # {"goal": ["阅读", 25]}\nrecord = json.loads(encoded)\nprint(type(record["goal"]).__name__)  # list',
        },
        {
          heading: '能解析与符合约定要分别验证',
          paragraphs: [
            '字符串 "null" 是合法 JSON，解析成 None；"[12, 25]" 解析成列表。若课程记录预期字典，就要先检查 isinstance(data, dict)，再读取需要的字段。不存在的键、错误的类型和超出范围的整数应给出不同的提示。',
            '检查整数分钟时需留意布尔值。JSON true 转成 Python True，True 在 Python 中属于 int 的子类，isinstance(True, int) 会返回 True。要求严格的整数时可以用 type(minutes) is int，并单独限制数字范围。',
          ],
          codeLanguage: 'Python',
          code: 'import json\n\ndata = json.loads(\'{"minutes": true}\')\nprint(isinstance(data["minutes"], int))  # True\nprint(type(data["minutes"]) is int)       # False',
        },
      ],
      pitfalls: [
        { mistake: '文件取名 json.py，然后 import json', why: '项目里的同名模块可能优先被导入，标准库的 dumps 和 loads 因而不可用。', fix: '把脚本改名为 study_records.py 等能体现用途的名字。' },
        { mistake: '收到 JSON 后直接使用 data["minutes"]', why: 'JSON 可以表示其他类型，合法对象也可能缺少这个字段。', fix: '先检查对象类型与所需字段，再做数值和业务范围校验。' },
      ],
      practice: {
        prompt: '读取 {"course":"Python","minutes":25}，只有 course 是非空字符串、minutes 是 1 到 1440 的整数时才打印课程和分钟数。试试把 minutes 改成 true 或 "25"。',
        hints: [
          '先调用 json.loads(text) 并检查 isinstance(data, dict)，再分别用 data.get 读取 course 和 minutes。',
          'Python 里 True 是 int 的子类，检验 minutes 必须写 type(minutes) is int 再判断 1 <= minutes <= 1440，才能同时拦住 true 和 "25"。',
        ],
        checkpoints: ['有效输入得到 Python 25。', '布尔值和字符串分钟数返回相同的清楚提示。'],
        solution: 'JSON 解码后先判断 data 是字典。再分别取两个字段，按类型和规则判断后返回。这里假设传入的是合法 JSON，下一章会处理非法文本。',
        codeLanguage: 'Python',
        code: 'import json\n\ndef display(text):\n    data = json.loads(text)\n    if not isinstance(data, dict):\n        return "需要一个对象"\n    course, minutes = data.get("course"), data.get("minutes")\n    if not isinstance(course, str) or not course.strip():\n        return "需要课程名"\n    if type(minutes) is not int or not 1 <= minutes <= 1440:\n        return "需要有效的整数分钟"\n    return f"{course} {minutes}"\n\nprint(display(\'{"course":"Python","minutes":25}\'))  # Python 25\nprint(display(\'{"course":"Python","minutes":true}\'))  # 需要有效的整数分钟',
      },
      questions: [
        { id: 'extra-shape', prompt: 'json.loads("null") 返回什么？', choices: ['空字典', '空字符串', '抛出 JSONDecodeError', 'None'], answer: 3, explanation: 'null 是合法 JSON，解析成 Python 的 None。应用仍需检查形状。' },
        { id: 'extra-strict-int', prompt: '要拒绝 JSON true 作为整数时长，哪个条件可用于接收 Python 的严格 int？', choices: ['type(minutes) is int', 'bool(minutes)', 'minutes != 0', 'isinstance(minutes, int)'], answer: 0, explanation: 'True 的类型是 bool，严格类型检查会拒绝它。isinstance(True, int) 则为真。' },
      ],
    },
    exceptions: {
      objectives: ['根据回溯找到异常类型、出错位置与输入', '只捕获可以解释或处理的异常', '区分解析错误、业务规则错误和程序错误'],
      sections: [
        {
          heading: '读回溯时先找到异常和触发点',
          paragraphs: [
            '遇到回溯时，先读最后一行，例如 ValueError: invalid literal for int()，再往上找自己的代码行。文件名和行号说明发生错误的位置，函数调用顺序帮助还原输入是怎样到达这里的。先做一个能稳定触发问题的最短例子，再改代码。',
            '例如 int("25.5") 会触发 ValueError，因为这个文本并不是整数形式。int(None) 则会触发 TypeError，表示传入值的类型不适用于该操作。两种输入的业务含义不同。如果协议要求文本，None 往往应该在调用前就被识别。',
          ],
          codeLanguage: '回溯片段',
          code: 'File "study.py", line 8, in parse_minutes\n    return int(raw)\nValueError: invalid literal for int() with base 10: \'25.5\'',
        },
        {
          heading: '缩小 try 的范围',
          paragraphs: [
            'try 只包住预期会出错的转换，把正常路径放在它后面或 else 内。这样不会把后来某个无关问题错误地报告成输入不合法。比如把查找字典字段、计算均值、转换文字全部放进一个宽泛的 except，用户只会看到同一条消息，开发者就失去了区别错误的线索。',
            '下面若转换失败，就立即返回提示。转换成功才进入 else，继续判断是否是正数。except 只捕获 ValueError。函数约定 raw 是字符串，其他类型应由调用方先校验，不尝试吞下所有运行错误。',
          ],
          codeLanguage: 'Python',
          code: 'def message(raw):\n    try:\n        number = int(raw)\n    except ValueError:\n        return "请输入整数文本"\n    else:\n        return "记录已接收" if number > 0 else "分钟数必须大于零"\n\nprint(message("5.5"))  # 请输入整数文本\nprint(message("0"))    # 分钟数必须大于零\nprint(message("25"))   # 记录已接收',
        },
        {
          heading: '用边界数据检查异常处理',
          paragraphs: [
            '转换成功和业务校验通过是两个阶段。文本 " 25 " 可被 int 接受，是否允许空格由产品约定决定。"0" 也能转换成整数，但是不符合记录时长的规则。如果规则允许 1 到 1440，检查 0、1、1440、1441 这四个紧挨边界的值。',
            '错误的输入和失败后的状态都要检查。例如一次记录失败之后，列表的长度应保持原样。先验证再追加数据，就能使失败的操作停在写入之前。异常信息适合给调用者定位错误，界面提示可以用更明确的中文说明下一步该填什么。',
          ],
        },
        {
          heading: '区分 JSON 损坏和记录列表不合规',
          paragraphs: [
            '先把 JSON 当成一段文本。json.loads 负责读懂这段文本。缺少右方括号时，它抛出 JSONDecodeError，程序没有拿到列表。输入 {} 则是合法文本，解析得到字典，再由业务规则指出需要列表。',
            '逐条校验发生在拿到列表以后。有一条 minutes 不合规时，可以记下它的序号再继续遍历。先把这三种结果分开，周报项目就能保留仍然有效的记录。',
            '运行下面的三组输入，再给测试元组添加字符串 "null"。它也能成功解析，因此应和 {} 走同一条分支。',
          ],
          codeLanguage: 'Python',
          code: `import json

def load_rows(text):
    try:
        rows = json.loads(text)
    except json.JSONDecodeError:
        return "JSON 无法解析"
    if not isinstance(rows, list):
        return "需要记录列表"
    return f"读取 {len(rows)} 条"

for text in ("[", "{}", "[1, 2]"):
    print(load_rows(text))`,
          run: { language: 'python', expectedOutput: 'JSON 无法解析\n需要记录列表\n读取 2 条' },
        },
        {
          heading: '小练习：收集坏记录的序号',
          paragraphs: [
            'enumerate(rows, start=1) 每次交回一个从 1 开始的序号和对应的值。把各组输出核对清楚再写周报。判断严格整数可用 type(minutes) is int，因此布尔值和字符串都会被识别为坏记录。',
            '只补循环。把每条坏记录的序号 append 到 bad，合法时长不改动 bad。最终三个输入应显示 [2, 3]、[]、[1]。',
          ],
          run: { language: 'python', expectedOutput: '[2, 3]\n[]\n[1]', starter: `def bad_rows(rows):
    bad = []
    # 遍历并检查严格整数和 1 到 1440 的范围。
    return bad

print(bad_rows([25, True, 0]))
print(bad_rows([]))
print(bad_rows(["25", 1440]))` },
        },
      ],
      pitfalls: [
        { mistake: '用 except: pass 让程序看起来没有报错', why: '预期外的程序错误也会被吞掉，用户可能以为记录已保存。', fix: '捕获明确的异常类型，写明结果和可采取的改正方式。' },
        { mistake: '把无效记录先追加再验证', why: '验证失败后，列表已留下脏数据，其他统计可能读取到它。', fix: '先把新值解析并校验，到所有条件成立时再修改列表。' },
      ],
      practice: {
        prompt: '尝试向记录 [15] 添加 "25"、"abc"、"0"。对有效输入增加一项，对无效输入给提示，并保持已有记录。',
        hints: ['先让 int(raw) 单独待在 try 块内，只抓 ValueError。', '有了整数再检查 1 到 1440 的范围。把 append 放到两个失败分支之后。'],
        checkpoints: ['"25" 成功后为 [15, 25]。', '两条无效输入各有提示，最终长度仍为 2。'],
        solution: '把转换和范围检查都放在 append 前。输入 abc 走异常分支，0 走范围校验分支，两个分支都在修改数据之前返回。',
        codeLanguage: 'Python',
        code: 'def add_minutes(records, raw):\n    try:\n        minutes = int(raw)\n    except ValueError:\n        return "需要整数"\n    if not 1 <= minutes <= 1440:\n        return "时长超出范围"\n    records.append(minutes)\n    return "已记录"\n\nentries = [15]\nfor raw in ("25", "abc", "0"):\n    print(add_minutes(entries, raw))\nprint(entries)  # [15, 25]',
      },
      questions: [
        { id: 'extra-boundary', prompt: '规则允许 1 到 1440 分钟。哪个用例能检查上界是否被错误写成小于 1440？', choices: ['0', '25', '1440', '1441'], answer: 2, explanation: '1440 正好等于允许的上界，正确实现接受它，误用 < 1440 的实现会拒绝它。' },
        { id: 'extra-order', prompt: '处理输入并更新学习记录，哪个顺序能保证无效输入不会写入？', choices: ['先追加、再校验', '先转换和校验，成功后再追加', '先返回成功、再转换', '输入错误时追加默认值'], answer: 1, explanation: '只有解析和业务校验都通过时才修改已有记录，错误路径不会进入写入步骤。' },
      ],
    },
  },
}

