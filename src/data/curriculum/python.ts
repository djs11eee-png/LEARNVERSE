import type { CourseProject } from './types'

const receiptCases = `
for sales in ([3, 0, 2], [], [0, 0]):
    count, total = receipt(4, sales)
    print("卖出", count, "个，收入", total, "元")
`

export const pythonProject: CourseProject = {
  title: '水果摊营业小票',
  summary: '摊位上一批水果统一定价。把多笔销量合成一张营业小票，零销量和空清单都能正常结算。',
  requirements: [
    '完成 receipt(price, sales)，用循环合计销量，遇到零销量时跳过该笔。',
    '用函数根据单价和总销量计算收入。这里的清单只包含非负整数，数量与金额都从 0 开始累计。',
    '保留起始代码中的三组输入和输出格式。函数返回总销量和收入，给定的打印代码会生成小票。',
  ],
  examples: [
    { label: '混合销量', input: '单价 4 元，销量 [3, 0, 2]', expected: '卖出 5 个，收入 20 元' },
    { label: '没有任何交易', input: '单价 4 元，销量 []', expected: '卖出 0 个，收入 0 元' },
    { label: '两笔销量均为零', input: '单价 4 元，销量 [0, 0]', expected: '卖出 0 个，收入 0 元' },
  ],
  explanation: '每笔记录只有数量，固定单价乘以总销量即可。将计数初始化为 0 后，空清单会自然得到零销量和零收入。',
  exercises: [{
    language: 'python',
    starter: `def amount(price, count):
    # 算出这一批的收入。
    return 0

def receipt(price, sales):
    count = 0
    # 遍历 sales，按规则更新 count。
    return count, amount(price, count)
${receiptCases}`,
    solution: `def amount(price, count):
    return price * count

def receipt(price, sales):
    count = 0
    for quantity in sales:
        if quantity > 0:
            count = count + quantity
    return count, amount(price, count)
${receiptCases}`,
    expectedOutput: '卖出 5 个，收入 20 元\n卖出 0 个，收入 0 元\n卖出 0 个，收入 0 元',
  }],
}

const studyCases = `
plan = {"列表", "字典", "异常"}
week = """[
  {"course":"Python","topic":"列表","minutes":20},
  {"course":"Python","topic":"字典","minutes":15},
  {"course":"JavaScript","topic":"循环","minutes":35},
  {"course":"Python","topic":"异常","minutes":true},
  {"course":"Python","topic":"异常","minutes":0}
]"""

for data in (week, "[]", "[", "{}"):
    print(analyze(data, plan))
`

export const pythonPracticeProject: CourseProject = {
  title: '一周学习清单分析器',
  summary: '把一周的 JSON 记录整理成课程用时、待学主题和错误清单。',
  requirements: [
    '输入应当解析为记录列表。JSON 语法损坏时返回「JSON 无法解析」，顶层为其他类型时返回「需要记录列表」。',
    '记录必须含非空的 course 和 topic 文本，以及 1 到 1440 的严格整数 minutes。忽略坏记录并按 1 开始的序号报告。布尔值也要拒绝。',
    '对有效记录按课程累计分钟数，按时长降序，时长相同时按课程名称升序。用集合差找待学主题并排序。',
    '保留给定的输出标签与分隔符。空汇总、空主题清单或没有错误时，使用「无」。',
  ],
  examples: [
    { label: '混合记录与并列', input: 'Python 20+15 分钟，JavaScript 35 分钟，两条异常记录的 minutes 为 true 和 0', expected: '课程 JavaScript=35、Python=35。待学 异常。坏记录 4、5。' },
    { label: '空清单', input: '[]', expected: '没有课程汇总，没有坏记录，三个计划主题均待学' },
    { label: 'JSON 语法损坏', input: '[', expected: 'JSON 无法解析' },
    { label: '顶层类型错误', input: '{}', expected: '需要记录列表' },
  ],
  explanation: '先解析并检查外层类型。遍历有效记录时同步更新课程总量和已学主题。报告坏记录只影响对应序号。排序键的第一项取时长的负数，第二项用课程名处理并列。',
  exercises: [{
    language: 'python',
    starter: `import json

def analyze(text, plan):
    # 先解析，再逐条检查。最后汇总、排序并计算集合差。
    return ""
${studyCases}`,
    solution: `import json

def read_record(row):
    if not isinstance(row, dict):
        return None
    course = row.get("course")
    topic = row.get("topic")
    minutes = row.get("minutes")
    if not isinstance(course, str) or not course.strip():
        return None
    if not isinstance(topic, str) or not topic.strip():
        return None
    if type(minutes) is not int or not 1 <= minutes <= 1440:
        return None
    return course.strip(), topic.strip(), minutes

def analyze(text, plan):
    try:
        rows = json.loads(text)
    except json.JSONDecodeError:
        return "JSON 无法解析"
    if not isinstance(rows, list):
        return "需要记录列表"

    totals = {}
    learned = set()
    bad_rows = []
    for number, row in enumerate(rows, start=1):
        record = read_record(row)
        if record is None:
            bad_rows.append(str(number))
            continue
        course, topic, minutes = record
        totals[course] = totals.get(course, 0) + minutes
        learned.add(topic)
    ordered = sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    courses = "、".join(f"{name}={minutes}" for name, minutes in ordered) or "无"
    pending = "、".join(sorted(plan - learned)) or "无"
    invalid = "、".join(bad_rows) or "无"
    return f"课程 {courses}。待学 {pending}。坏记录 {invalid}。"
${studyCases}`,
    expectedOutput: '课程 JavaScript=35、Python=35。待学 异常。坏记录 4、5。\n课程 无。待学 列表、字典、异常。坏记录 无。\nJSON 无法解析\n需要记录列表',
  }],
}
