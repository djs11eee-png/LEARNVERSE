import type { HoloCard } from './types'
import { importCardSources } from './importCards'

type CardText = Pick<HoloCard, 'title' | 'subtitle' | 'body' | 'back' | 'code' | 'quiz' | 'slot'>
type Chapter = [lessonId: string, cards: CardText[]]

function card(slot: HoloCard['slot'], title: string, subtitle: string, body: string, back: string, code?: string): CardText {
  return { slot, title, subtitle, body, back, ...(code === undefined ? {} : { code }) }
}

function quiz(title: string, subtitle: string, question: string, options: string[], answer: number, explanation: string, code?: string): CardText {
  return { ...card(3, title, subtitle, question, explanation, code), quiz: { question, options, answer, explanation } }
}

function bug(title: string, subtitle: string, question: string, options: string[], answer: number, explanation: string, code: string): CardText {
  return { ...quiz(title, subtitle, question, options, answer, explanation, code), slot: 4 }
}

const pythonBasics: Chapter[] = [
  ['values', [
    card(1, '名字里的数', '变量与赋值', '把装订一本笔记的费用记成 price，以后只要写 price 就能取用这笔费用。', '执行 price = 6 后，右边的数字 6 成为 price 当前指向的值。下一次赋值可以给这个名字换一个值。', 'price = 6\nprint(price)'),
    card(2, '三本笔记', '计算并显示总价', '每本 6 元，买 3 本。把乘法结果存下来，再交给 print 显示。', '第一行算出 18，第二行输出「总价 18」。把数量换成 4，输出就会变成「总价 24」。', 'total = 6 * 3\nprint("总价", total)'),
    quiz('换价之后', '跟踪两次赋值', '最后一行会显示几？', ['6', '8', '14'], 1, '先取旧值 6，算出 6 + 2，再让 price 指向所得的 8。', 'price = 6\nprice = price + 2\nprint(price)'),
    bug('多出一个七', '字符串的加法', '预期合计 9，屏幕却显示 72。怎样改才能算出总和？', ['调换两个值的位置', '删去两对引号', '把加号换成逗号'], 1, '两对引号让两个值都成为文字。用 print(7 + 2) 做整数加法，结果才是 9。', 'print("7" + "2")'),
    card(5, '看见引号', '整数、文字与乘号', '3 * 2 会算出 6。把左边的 3 换成文字 "3"，相同的乘号就会把文字重复两次。', '检查顺序：看引号 → 判类型 → 算结果。\nprint(3 * 2)    # 6\nprint("3" * 2)  # 33\n边界：重复 0 次得到空字符串，print("3" * 0) 只显示空行。', 'print(3 * 2)\nprint("3" * 2)'),
  ]],
  ['decisions', [
    card(1, '轮到哪一档', '分支的检查顺序', '分数从高到低分档。程序遇到第一个成立的条件，就执行那一档并跳过后续分支。', '若先检查分数是否达到 60，达到 90 的分数也会进入这一档。把较窄的高分条件放在前面。'),
    quiz('刚好满座', '比较符号的边界', '教室正好有 24 人，以下代码显示什么？', ['还有位置', '两行都显示', '已满'], 2, '24 < 24 为假，程序执行 else。试着把人数改为 23，判断会翻转。', 'people = 24\nif people < 24:\n    print("还有位置")\nelse:\n    print("已满")'),
    bug('门槛前的文字', '输入的类型', '在输入框键入 12，比较时却报告类型错误。怎样正确比较数值？', ['把 12 改成 "12"', '把 >= 改成 >', '输入后先用 int 转换'], 2, 'input() 返回字符串。把第一行改为 age = int(input())，整数输入 12 就能与整数门槛比较。', 'age = input()\nprint(age >= 12)'),
  ]],
  ['collections', [
    card(2, '称重记录', '逐项筛选再累加', '三次称重含一条无效的负数记录。只加上大于零的重量。', 'total 依次变为 4、4、9。把输入列表换成 [] 时，循环一次也不执行，结果保留 0。', 'total = 0\nfor w in [4, -2, 5]:\n    if w > 0:\n        total += w\nprint(total)'),
    quiz('空清单添一项', 'append 与下标', '下面最后取出的数字是几？', ['0', '12', '3'], 1, '第一次追加把 12 放在下标 0，第二次追加只在末尾添加 3。', 'pages = []\npages.append(12)\npages.append(3)\nprint(pages[0])'),
    card(5, '找第几件', '列表位置速查', '说“第一个”从 1 开始数，写下标从 0 开始数。因此读第二个元素要写 items[1]。', '先数项，再选位置。非空列表的第 n 项用下标 n − 1。\nitems = ["笔", "尺"]\nitems[0]  # 笔\nitems[1]  # 尺\n边界：items[2] 已越界。若列表是 []，连下标 0 也不能读。'),
  ]],
  ['functions', [
    card(1, '把结果交回去', '函数的返回值', '算出邮费之后，还要把邮费加进总价。用 return 把数字交回调用处，外层才能接着计算。', 'fee(3) 返回 6，外层再加 10，输出 16。若函数只 print(6) 就走到结尾，调用结果会是 None。', 'def fee(n):\n    return n * 2\nprint(10 + fee(3))'),
    card(2, '最后一个袋子', '整除和余数', '装满的袋数可以直接整除求出。还有零散物品时，额外用一个袋子。', 'bags(8) 得 2，bags(9) 得 3，bags(0) 得 0。这里约定物品数非负，容量为正整数。', 'def bags(n, size=4):\n    full = n // size\n    if n % size:\n        return full + 1\n    return full'),
    bug('只写了函数名', '调用需要圆括号', '想打印两倍的 5，屏幕却出现了一段函数说明。哪种写法会得到 10？', ['print(double(5))', 'print("double(5)")', 'print(double)'], 0, 'print(double) 显示函数对象。加上 (5) 会真正调用函数，参数 x 取得 5，再返回 10。', 'def double(x):\n    return x * 2\nprint(double)'),
  ]],
]

const pythonPractice: Chapter[] = [
  ['iteration', [
    card(1, '终点前停步', 'range 的半开区间', '从第 2 格开始，每次前进 3 格，走到 11 之前停下。range 给出的数依次是 2、5、8。', '下一步将到 11，已经触到排除的终点。改成 range(2, 12, 3) 才会包含 11。', 'print(list(range(2, 11, 3)))'),
    card(2, '给书名编号', 'enumerate 同时取两项', '清单里只有书名，显示时要附上从 1 开始的编号。用 enumerate 逐次拿到编号和原来的书名。', '打印两行，先是「1 潮汐」，再是「2 山风」。start=1 只影响生成的编号，原清单内容照旧。', 'for n, book in enumerate(["潮汐", "山风"], start=1):\n    print(n, book)'),
    quiz('跳过一站', '预测 continue', '循环会依次显示哪些数？', ['1、3', '1', '2、3'], 0, '遇到 2 时 continue 跳过这次 print，随后还会进入值为 3 的下一轮。', 'for n in [1, 2, 3]:\n    if n == 2:\n        continue\n    print(n)'),
    bug('倒数没有启动', '起点、终点和步长', '想打印 3、2、1，运行这段循环却没有输出。应如何修改？', ['把起点改成 1', '把终点改成 1', '指定步长 -1'], 2, '默认步长是 +1，从 3 出发已经无法向上走到 0 之前。改成 range(3, 0, -1) 就能逐步倒数。', 'for n in range(3, 0):\n    print(n)'),
    card(5, '找到就收工', 'break 与 continue', '找第一本符合条件的书，用 break 在命中后离开循环。只想跳过破损的书，用 continue 开始下一轮。', '遇到 0 时跳过本项，继续处理后续项：\nfor n in [3, 0, 5]:\n    if n == 0: continue\n    print(n)\n输出 3、5。把 continue 换为 break，只输出 3。空列表不进入循环。'),
  ]],
  ['list-transformations', [
    card(2, '挑出待复习页', '用条件筛选的推导式', '页码 0 是空记录。保留正页码，把每个留下来的数乘以 2，换成练习册页码。', '先筛选出 3 和 5，再计算它们的两倍。结果是新列表 [6, 10]，原来的 pages 不变。', 'pages = [3, 0, 5]\nreview = [p * 2 for p in pages if p > 0]'),
    bug('排序后的空结果', '原地排序的返回值', '想同时保留原顺序和排序结果，哪行可以替换第二行？', ['ranked = scores', 'ranked = sorted(scores)', 'ranked = sorted([])'], 1, 'sorted 生成新列表 [2, 7]。sort() 会直接修改原列表并返回 None。', 'scores = [7, 2]\nranked = scores.sort()\nprint(ranked)'),
  ]],
  ['mapping-and-sets', [
    card(2, '第一次也能记账', '字典累加', '还没有“阅读”这笔账时，从零开始。已有记录时，从旧值接着加。', 'get 在找不到键时给出默认值 0，右边算出 8；左边的赋值才真正把键与值写入字典。', 'times = {}\ntimes["阅读"] = times.get("阅读", 0) + 8'),
    quiz('还缺哪门课', '集合差集', '需要阅读和写作，已完成阅读和绘画。下面的差集还剩哪一项？', ['绘画', '阅读', '写作'], 2, '左集合中，只有写作未出现在右集合。把两个集合调换位置，结果就会是绘画。', 'need = {"阅读", "写作"}\ndone = {"阅读", "绘画"}\nprint(need - done)'),
  ]],
  ['function-arguments', [
    card(1, '叫出参数名字', '关键字传参', '安排两轮各 8 分钟的练习，写出 rounds 和 minutes 的名字，就能清楚表达每个数的用途。', '关键字按名称匹配，示例得到 16。只传 rounds=2 时，minutes 会采用默认值 15。', 'def plan(minutes=15, rounds=1):\n    return minutes * rounds\nprint(plan(rounds=2, minutes=8))'),
    bug('上次留下的脚印', '可变默认值', '连续调用两次 record("A")，第二次的列表里竟有两个 A。原因是什么？', ['append 把一个值加了两遍', 'return 会复制上一项', '两次调用共用默认列表'], 2, '默认列表在定义函数时创建。将默认值改成 None，并在函数开头判断 items is None 时新建列表，就能让两次调用各用一份。', 'def record(x, items=[]):\n    items.append(x)\n    return items'),
  ]],
  ['modules-and-json', [
    card(2, '从文本里取分数', 'JSON 解码', '收到一条 JSON 文本，先把它还原成 Python 数据，再按键读取分数。', 'loads 得到字典，取出 score 是整数 8。若要反向生成 JSON 文本，可把字典交给 json.dumps。', 'import json\nrow = json.loads(\'{"score": 8}\')\nprint(row["score"] + 1)'),
    card(5, '来回转换', 'dumps 与 loads', 'dumps 的输入是 Python 数据，输出是 JSON 文本。loads 则读取 JSON 文本，得到对应的 Python 数据。', 'import json\ntext = json.dumps([2, 4])\nrows = json.loads(text)\nrows[1]  # 4\n边界：JSON 对象的键必须用双引号。例如 {"a":1} 合法，{a:1} 无法解码。', 'import json\ntext = json.dumps([2, 4])\nagain = json.loads(text)'),
  ]],
  ['exceptions', [
    card(1, '给错误取对名字', 'ValueError', 'int 可以读懂 "12"，读到 "半天" 时却无法转换。只捕获本步骤预期的 ValueError，才能给出有针对性的提示。', '给代码输入“半天”会看到“请输入整数”。输入“0”可以正常转换，是否合法需要另外检查。', 'try:\n    n = int(input())\nexcept ValueError:\n    print("请输入整数")'),
    quiz('收尾顺序', 'finally 的执行时机', '这段代码依次显示什么？', ['只有收尾', '重填，再显示收尾', '只有重填'], 1, '转换引发 ValueError，先进入 except 显示“重填”，离开时还要执行 finally。', 'try:\n    int("十")\nexcept ValueError:\n    print("重填")\nfinally:\n    print("收尾")'),
    card(5, '两道检查', '转换与范围', '先检查一段文字能否转为整数，再检查这个整数是否处于允许的范围。两步对应两类不同的输入问题。', '在处理输入的函数里依次核对：\nn = int(text)\nif n < 0:\n    raise ValueError("时长不能为负")\n"abc" 在转换时报错，"-2" 在范围检查时报错，"0" 两关都能通过。'),
  ]],
]

const cBasics: Chapter[] = [
  ['first-program', [
    card(1, '开场第一行', 'main 函数', '示例程序从 main 的函数体开始执行。大括号圈住这次要做的事，圆括号里的 void 表示无需传入参数。', 'return 0 把成功结束的状态交回运行环境。若要让人在屏幕上看见 0，还需要一条输出语句。', 'int main(void) {\n    return 0;\n}'),
    card(2, '小票的空格', 'printf 的占位符', '小票要把张数填进一句话。%d 留出整数的位置，逗号后的值填进这个位置。', '这一行输出 Tickets: 4 并换行。在完整程序里，源文件顶部需要包含 stdio.h，以取得 printf 的声明。', 'printf("Tickets: %d\\n", 4);'),
    quiz('两次发声', '逐行读输出', '下面两个调用按顺序执行，屏幕上会怎样显示？', ['A 和 B 分两行', '先 B 后 A', 'AB 同在第一行'], 2, '第一句后面没有换行符，第二句紧接着输出 B，最后才换行。', 'printf("A");\nprintf("B\\n");'),
    bug('消失的分号', '语句结束符', '构建时编译器在 return 附近报错。应先修哪一处？', ['给 printf 那行末尾加分号', '把 main 改成 Main', '删去 stdio.h'], 0, '函数调用作为语句要以分号结束。编译器看到下一行的 return 才确认前一条语句无法继续。', '#include <stdio.h>\nint main(void) {\n    printf("Hi")\n    return 0;\n}'),
    card(5, '终端小抄', '三种输出记号', '显示整数用 %d，显示百分号用 %%，换到下一行用反斜杠加 n。', '在包含 <stdio.h> 的程序中输出进度：\nprintf("Power %d%%\\n", 80);\n得到 Power 80% 并换行。%d 读取一个 int，%% 显示一个百分号，\\n 换行。只写一个 % 不能用来打印百分号。', 'printf("Power %d%%\\n", 80);'),
    card(1, '先构建，再运行', '从源文件到输出', '保存 .c 文件只留下了程序文本。构建工具编译代码并连接需要的库，运行生成的程序才能看见输出。', '假如你把 Hello 改成 Hi，仍运行旧的可执行文件，屏幕还会显示 Hello。重新构建后再运行一次。'),
    quiz('被略过的问候', '行末注释', '这两行放进 main 并运行，会输出什么？', ['Ready', 'Wait', 'ReadyWait'], 0, '第二行从 // 起直到行尾都是注释。第一行的输出调用仍会执行。', 'printf("Ready");\n// printf("Wait");'),
    card(2, '把声明带进来', '标准输入输出头文件', '在文件开头包含 stdio.h，编译器就能读取 printf 等标准输入输出函数的声明。', '尖括号标出要查找的头文件。#include 是预处理指令，这一行无需在末尾另加分号。', '#include <stdio.h>'),
  ]],
  ['values-and-operators', [
    card(1, '满箱与散瓶', '整数商和余数', '把 23 瓶水装进每箱 5 瓶的箱子。整数除法求装满的箱数，取余求桌上剩下的瓶数。', '23 / 5 得到 4，23 % 5 得到 3。检验这两个答案的方法是把它们放回 4 × 5 + 3 = 23。', 'int boxes = 23 / 5;\nint loose = 23 % 5;'),
    card(2, '先换一种数', '浮点除法', '计算平均数时，先让一个参与除法的数成为 double，就可以保留小数。', '转换发生在除法之前，所以 7 除以 2 得到 3.5。若写 (double)(7 / 2)，括号里先得到 3。', 'double mean = (double)7 / 2;'),
    quiz('括号的次序', '运算优先级', '程序会按什么次序打印结果？', ['18 18', '14 18', '14 14'], 1, '第一项先算 4 × 3，再加 2。第二项先算括号里的 2 + 4，再乘 3。', 'printf("%d %d", 2 + 4 * 3, (2 + 4) * 3);'),
    bug('迟到的小数', '整数除法的截断', '预期输出 2.50，实际输出 2.00。修改哪一处能保留小数？', ['把 %.2f 改为 %.3f', '在除法完成后再转 double', '把 5 改为 5.0'], 2, '5 / 2 先按整数算出 2，再赋给 double。写成 5.0 / 2 会从除法开始就使用浮点运算。', 'double half = 5 / 2;\nprintf("%.2f", half);'),
    card(5, '打印数值', '常见格式速查', 'printf 里，int 对应 %d，long long 对应 %lld，double 用 %.2f 可以按两位小数显示。', '依次匹配格式与值：\nint → %d\nlong long → %lld\ndouble → %.2f（两位小数）\nprintf("%.2f", 5.0 / 2);   // 2.50\n边界：若先写 double x = 5 / 2，整数除法会先截断。再输出 x 只能得到 2.00。', 'printf("%d %lld %.2f", 27, 90000LL, 1.5);'),
    card(1, '让乘法用宽整数', '整数字面量后缀 LL', '如果两个操作数都是 int，乘法就先按 int 做。需要较大范围时，从参与计算的数开始选择 long long。', '50000LL 让这次乘法按 long long 进行，得到 2500000000。只把结果变量改成 long long 无法扩大先前运算的范围。', 'long long cells = 50000LL * 50000;'),
    quiz('差一瓶满箱', '读懂余数', '买 29 瓶，每箱容量 6。屏幕显示哪一对数？', ['5 0', '4 5', '5 4'], 1, '能装满 4 箱，余下 5 瓶，4 × 6 + 5 正好还原 29。', 'printf("%d %d", 29 / 6, 29 % 6);'),
    card(2, '让机器回答上限', 'limits.h 的常量', '想知道当前环境的 int 最大能表示多少，可以读取 <limits.h> 提供的 INT_MAX。', '编译环境决定具体上限。把当前环境打印出来，比照搬另一个平台的数字更可靠。', '#include <limits.h>\n#include <stdio.h>\nint main(void) {\n    printf("%d", INT_MAX);\n    return 0;\n}'),
  ]],
  ['control-flow', [
    card(1, '恰在分界线上', '包含端点的比较', '规定“至少 4 人成团”，用 people >= 4 来表达。输入 3 和 4 正好能检查门槛两侧。', '3 达不到条件，4 恰好达到。若不小心写成 > 4，正好 4 人时就会被误判。'),
    card(2, '每轮前问一次', 'while 的检查时机', '倒计时从 2 开始，每轮先检查是否大于 0，打印后才减 1。', '依次打印 2 和 1。变量减到 0 后，下一次检查失败，程序离开循环。', 'int n = 2;\nwhile (n > 0) {\n    printf("%d ", n);\n    n--;\n}'),
    quiz('跨过偶数', 'continue 在 for 中的行为', '累加完成后，total 等于多少？', ['10', '6', '4'], 2, 'i 为 2、4 时跳过加法。只加上 1 和 3，两项合为 4。', 'int total = 0;\nfor (int i = 1; i <= 4; i++) {\n    if (i % 2 == 0) continue;\n    total += i;\n}'),
    bug('条件被改写', '赋值与相等判断', 'level 原本是 2，却也打印了 OK。条件里该改哪一个符号？', ['把 = 改为 ==', '把 = 改为 +', '把圆括号改为大括号'], 0, 'level = 1 会先把 level 写为 1，这个表达式的值也就是 1，条件成立。== 才检查是否相等。', 'int level = 2;\nif (level = 1) printf("OK");'),
    card(5, '退出到哪里', 'break 与 continue 速查', '在一层循环里，break 结束整个循环；continue 跳过当前一轮剩余语句，再进入更新或下次检查。', 'for (int i = 1; i <= 5; i++) {\n    if (i == 2) continue;\n    if (i == 4) break;\n    printf("%d ", i);\n}\n只打印 1 和 3。continue 会进入 for 的更新步骤，break 则离开最近一层循环或 switch。'),
    card(1, '先检查分母', '逻辑与的短路', '两个条件用 && 连起来时，左边已经为假，右边就不会执行。可以把“人数非零”放在需要除以人数的判断之前。', 'people 等于 0 时，左半句为假，除法会被跳过。把两半颠倒，除法反而会先执行。', 'if (people != 0 && pages / people >= 3) {\n    printf("enough");\n}'),
    quiz('停在第五格', 'break 的位置', '这段代码一共打印几个点？', ['5 个', '4 个', '6 个'], 1, 'i 为 1 到 4 时各打印一次。i 到 5 时先遇到 break，轮不到本轮的 printf。', 'for (int i = 1; i <= 6; i++) {\n    if (i == 5) break;\n    printf(".");\n}'),
  ]],
  ['functions-and-arrays', [
    card(1, '带着副本出门', '整数按值传参', '把整数传进函数时，参数取得一份值的副本。在函数里修改参数，只会改变这份副本。', '调用 add_one(score) 会得到返回值 6。想让原变量也更新，需要写 score = add_one(score)。', 'int add_one(int x) {\n    x += 1;\n    return x;\n}'),
    card(2, '把长度一起带上', '数组参数', '函数收到数组首项的位置后，还需要知道这次允许读取多少项。通常由调用者另外传入长度。', '令 a 为 {8, 9, 4}，sum(a, 2) 只访问下标 0 和 1，返回 17。传入的长度不能超过可读项数。', 'int sum(const int a[], int n) {\n    int s = 0;\n    for (int i = 0; i < n; i++) s += a[i];\n    return s;\n}'),
    quiz('读取表格', '二维下标', 'grid[1][0] 会取出哪个整数？', ['7', '5', '9'], 0, '先按下标 1 选第二行 {7, 9}，再按下标 0 选这一行的第一个数。', 'int grid[2][2] = {{3, 5}, {7, 9}};\nprintf("%d", grid[1][0]);'),
    bug('最后一格之外', '数组下标边界', '要依次打印数组里的三个数，应如何修正循环条件？', ['i <= 4', 'i < 3', 'i > 3'], 1, '三个有效下标是 0、1、2。原条件还会让 i 取到 3，越界读取在 C 中没有定义的结果。', 'int a[3] = {4, 7, 9};\nfor (int i = 0; i <= 3; i++) {\n    printf("%d ", a[i]);\n}'),
    card(5, '地址与所指的值', '指针记号速查', '&n 取得变量 n 的地址。把这个地址存在指针 p 中，表达式 *p 就能访问 n 本身。', 'int n = 4;\nint *p = &n;  // 保存 n 的地址\n*p = 8;       // 将 n 写成 8\n读 n 或 *p 都得到 8。边界：先让指针指向仍然有效的对象，再通过它读写。', 'int n = 4;\nint *p = &n;\n*p = 8;'),
    card(2, '字符串的末格', '字符数组与结束标记', '用 "cat" 初始化字符数组，除了三个字母，还会存入一个空字符作为结束标记。', '这个局部数组的 sizeof 是 4。包含 <string.h> 后调用 strlen(word) 得 3，因为它只数结束标记之前的字节。', 'char word[] = "cat";'),
    quiz('谁真的变了', '通过指针写入', '两次赋值后，输出中先后是哪两个数？', ['7 7', '3 3', '7 3'], 2, 'b 复制了原来的 3。p 指向 a，写 *p 只会更改 a，所以 b 仍为 3。', 'int a = 3;\nint b = a;\nint *p = &a;\n*p = 7;\nprintf("%d %d", a, b);'),
  ]],
]

const algorithms: Chapter[] = [
  ['arrays', [
    card(1, '第零个格子', '位置与长度', '三个座位各写一个名字，用索引 0、1、2 区分它们。数组的长度是 3，最后一位的索引是 2。', '一般地，有 n 项的非空数组最后一个索引是 n − 1。数组为空时没有任何位置可以读取。', 'const seats = ["云", "舟", "岩"];'),
    card(2, '中间加一位', '数组插入', '在下标 1 放进新元素时，原先占据这个位置的元素和它右边的元素都要往后挪。', 'splice 的第二个参数是删除数量，写 0 表示只插入。队伍从 A、C、D 变成 A、B、C、D。', 'const line = ["A", "C", "D"];\nline.splice(1, 0, "B");'),
    quiz('移走一个座位', '跟踪下标变化', '移除中间一项后，seats[1] 是什么？', ['蓝', '红', '绿'], 2, '删除原下标 1 的蓝色后，原下标 2 的绿色左移一格，成为新的 seats[1]。', 'const seats = ["红", "蓝", "绿"];\nseats.splice(1, 1);'),
    bug('最后一本书', '长度与末项', '要取书架上的最后一本，哪项可以替换方括号里的表达式？', ['books.length - 1', 'books.length + 1', '0'], 0, 'books.length 为 3，但这三个元素的索引是 0、1、2。减去 1 才能取到 C。', 'const books = ["A", "B", "C"];\nconsole.log(books[books.length]);'),
    card(5, '挪动几格', '插入与删除速查', '紧凑存放的四个元素，删除首项时要把右边的三项左移。删除末项时，右边没有元素需要左移。', '把 n 项紧凑排放，位置从 0 开始。\n在 i 处插入：右移 n − i 项，0 ≤ i ≤ n。\n删除 i 处：左移 n − i − 1 项，0 ≤ i < n。\n例如 n = 4，删首项移 3 项，删末项移 0 项。空数组可在 0 处插入，但无法删除任何项。'),
  ]],
  ['search', [
    card(1, '从头比起', '线性查找', '抽屉里的号牌没有排顺序，就从头逐一比较；第一次遇到目标时即可报告位置。', '在 [8, 2, 8] 找 8，第一个匹配位于下标 0。找 5 则要检查三项，才能确认目标缺席。'),
    card(2, '缩小一半', '二分查找的前提', '在升序号码牌里，中间号码若小于目标，它自己和左边所有号码都可以排除。', '在 [2, 4, 6, 8, 10] 中找 8，先比较中间的 6，接下来只需考虑 8 和 10。顺序混乱时这种排除没有依据。'),
    quiz('新左端在哪里', '左闭右开的二分区间', '读到中点的值后，下一步 left 将是多少？', ['2', '3', '4'], 1, '初始 mid 是 2，a[2] 为 6，小于目标 8。索引 2 本身也能排除，所以 left 更新为 3。', 'const a = [2, 4, 6, 8, 10];\nlet left = 0, right = a.length;\nconst mid = Math.floor((left + right) / 2);\nif (a[mid] < 8) left = mid + 1;'),
    bug('停住的中点', '二分循环的进展', '已知当前范围为 [2, 3)，索引 2 的值小于目标。怎样更新才能排除这项？', ['left = mid', 'right = mid + 1', 'left = mid + 1'], 2, '这时 mid 正好等于 2。若让 left = mid，范围仍是 [2, 3)，下一轮还会检查同一项。', 'const mid = Math.floor((left + right) / 2);\nif (a[mid] < target) left = mid;'),
  ]],
  ['sorting', [
    card(1, '较大者向右', '冒泡的一趟', '从左到右比较相邻的两个数，左边较大就交换。一趟走完，本轮最大的数会到达最右端。', '从 [4, 1, 3] 开始，比较 4 和 1 得 [1, 4, 3]，再比较 4 和 3 得 [1, 3, 4]。'),
    quiz('只走一趟', '跟踪相邻交换', '这一趟循环结束时，a 的内容是什么？', ['[1, 2, 3]', '[2, 1, 3]', '[2, 3, 1]'], 1, '先交换 3 和 2，随后交换 3 和 1。1 与 2 之间的次序要在下一趟处理。', 'const a = [3, 2, 1];\nfor (let i = 0; i < 2; i++) {\n  if (a[i] > a[i+1])\n    [a[i], a[i+1]] = [a[i+1], a[i]];\n}'),
    card(5, '平手时留队形', '稳定排序速查', '两人分数相同，若排完后他们的先后次序与原来相同，这一对保住了原顺序。稳定排序会为所有平手项保住顺序。', '升序冒泡每次比较一对相邻项：\n左值 > 右值 → 交换\n左值 ≤ 右值 → 保持原位\n用同分的甲(8)、乙(8) 检查边界：原来甲在前，排完仍应在前。若改用 >= 就可能换掉他们的顺序。'),
  ]],
  ['stacks-and-queues', [
    card(2, '盘子和取餐号', '栈与队列', '把 A、B 依次放入，栈从顶上取出 B；队列从入口另一头取出 A。选择结构时先问谁该先出来。', '编辑器撤销最近一次操作适合栈。按下单顺序叫号适合队列。两者的差别在取出的次序。'),
    quiz('叫到谁的号', '队列的头与尾', '新号追加到队尾，取走一次队头。最后屏幕显示谁？', ['乙', '甲', '丙'], 0, '加入丙后队伍是甲、乙、丙。shift 取走甲，乙就成了队首。', 'const q = ["甲", "乙"];\nq.push("丙");\nq.shift();\nconsole.log(q[0]);'),
    bug('队尾要绕回来', '环形队列下标', '队列分配了 4 格，tail 现在指向 3。下一格应为 0，该怎样计算？', ['tail - 1', 'tail + 1', '(tail + 1) % 4'], 2, '下标只能是 0、1、2、3。把 4 对容量 4 取余，刚好回到 0。', 'const capacity = 4;\nlet tail = 3;\ntail = tail + 1;'),
  ]],
]

const ai: Chapter[] = [
  ['tokens', [
    card(1, '词表里的小块', 'token 与编号', '分词器先把一段文字切成小块，再给每一块查编号。一块可能是完整词语、字的一部分或标点。', '假设某词表把“雨天”作为一块，另一词表把“雨”和“天”分开。同一段文字就可能得到不同的 token 数。'),
    card(2, '编号也有顺序', '编码文本', '在这个教学词表中，“海”编号 4，“风”编号 9。把两个片段各查一次，就能写出它们排成的序列。', '“海风”按示意切分为海、风，对应 [4, 9]；倒过来的“风海”对应 [9, 4]。真实编号由实际使用的分词器决定。', '海 → 4\n风 → 9\n海 | 风 → [4, 9]'),
    quiz('读回短句', '按词表解码', '根据这个教学词表，序列 [6, 2, 6] 将读成哪段文字？', ['山河山', '河河山', '河山河'], 2, '依次查表可得河、山、河。相同编号 6 在这张固定的词表中对应同一个片段。', '2 → 山\n6 → 河\n输入 = [6, 2, 6]'),
    bug('少算了一截', '上下文预算', '预算共 100 个 token。有人说资料可占 80 个，漏扣了哪一项？', ['任务说明的 15 个', '资料标题的字数一定翻倍', '预算应换算成字节'], 0, '先扣 20 个预留输出，再扣 15 个任务说明，这个简化例子中只剩 65 个给资料。', '总预算 100\n任务说明 15\n预留输出 20\n预计可放资料 80'),
    card(5, '先分词再计数', '预算核对速查', '核对一段输入时，先选用目标模型配套的分词器，再数所有输入片段的 token，并留出输出空间。', '选目标模型的分词器，分别计入说明、资料等输入。\n可留给输出的额度 = 窗口 − 全部输入。\n假设只计输入与输出，200 − 135 = 65。\n若差值为 0，就需缩短输入才能留出输出空间；字符数不能直接替代 token 数。'),
  ]],
  ['generation', [
    card(1, '把刚选的接回去', '逐步生成', '模型给当前上下文列出下一块文字的候选。选出一块并接在末尾后，才开始下一步预测。', '提示是“早餐喝”，若先选“豆浆”，下一步预测就会同时看到“早餐喝豆浆”。下一步的候选和概率可能随之变化。'),
    quiz('落在哪一格', '按概率区间采样', '按下面的区间抽样，抽到 0.62 会选谁？', ['读书', '散步', '画画'], 1, '0.62 大于等于 0.50，且小于 0.80，所以落在散步区间。若按最大概率贪心选择，则会选读书。', '[0.00, 0.50) → 读书\n[0.50, 0.80) → 散步\n[0.80, 1.00) → 画画'),
    bug('把概率当成绩', '续写与事实核验', '同学据此声称某地点有 90% 的把握是正确答案。应怎样核验？', ['将概率写为 100%', '多打印一次相同答案', '查阅可核实的地点资料'], 2, '下一 token 的概率描述在当前上下文中模型预测的续写倾向。地点是否正确，需要拿原始资料核对。', '教学示意\n候选地点甲 0.90\n候选地点乙 0.10'),
  ]],
  ['instructions', [
    card(1, '留白也有含义', '缺失与零值', '登记表里，“未填写时长”和“明确记录 0 分钟”代表不同的信息。任务说明要分别约定怎样输出。', '可以规定未填时输出 null，确实记录为零时输出 0。以后统计缺失项时，两种记录仍能区分。'),
    card(2, '把依据摆在旁边', '动作、资料与格式', '请助手提取阅读时长时，把要做的动作、可使用的记录和返回字段写清楚，便于逐项核验。', '依据只给出 12 分钟，因此可核对的返回值是 {"minutes":12}。若资料未给时长，可事先约定返回 null。', '动作：提取阅读分钟数\n资料：今天阅读了 12 分钟\n格式：{"minutes": 整数或 null}'),
    quiz('读懂有效记录', '结构化结果', '给定这些资料和规则，返回值应当是哪一项？', ['{"minutes":7}', '{"minutes":0}', '{"minutes":null}'], 0, '资料明确写了 7 分钟，应取数字 7。null 专用于缺失，0 会更改实际数值。', '资料：听讲 7 分钟\n规则：缺失填 null，已知时长填整数'),
    bug('引号藏起的数字', '字段类型校验', '这份 JSON 能解析，却未满足字段约定。应修正哪一项？', ['删去整个字段', '把 "7" 改成 7', '把字段名改成 7'], 1, '引号中的 "7" 是字符串。校验器还要确认 minutes 是约定的整数，才能放心用它参加计算。', '约定：minutes 必须是整数\n收到：{"minutes":"7"}'),
  ]],
  ['evaluation', [
    card(2, '先把判分写下来', '测试样本与预期', '准备一条本身就能验算的记录，并在看到回答之前写好通过条件。之后换模型或改说明，都沿用这条条件。', '样本“走路 1 小时又 8 分钟”的预期值是 68。若要求 JSON，数值正确与格式正确都应纳入判分。'),
    quiz('合起来过了几题', '按样本汇总通过率', '两组合并后，总通过率是多少？', ['75%', '90%', '80%'], 1, '一共通过 8 + 1 = 9 题，一共有 8 + 2 = 10 题。直接平均两个分组的百分比会忽略它们大小不同。', '普通题：8 / 8 通过\n缺失题：1 / 2 通过'),
    card(5, '留一组新题', '评估速查', '固定题目和判分标准比较两个版本，按题型记下错误，再用未参与调整的保留样本检查修改后的效果。', '样本模板：输入 → 预期 → 实际 → 是否通过。\n1 小时加 8 分钟 → 68；明确 0 分钟 → 0；时长未填 → 资料不足。\n每类留出未参与调试的新题。按相同标准复测，组内通过率 = 本组通过数 ÷ 本组样本数；空组标为“无样本”。'),
  ]],
]

const slotFinishes: HoloCard['finish'][] = ['standard', 'reverse', 'cosmos', 'crosshatch', 'gold']

function series(galaxy: HoloCard['galaxy'], prefix: string, courses: [string, Chapter[]][]): HoloCard[] {
  const result: HoloCard[] = []
  for (const [courseId, chapters] of courses) {
    for (const [lessonId, cards] of chapters) {
      for (const content of cards) {
        const number = (result.length + 1).toString().padStart(3, '0')
        const finish = content.slot === 3 && result.length % 2 === 1 ? 'rainbow' : slotFinishes[content.slot - 1]
        result.push({ ...content, galaxy, courseId, lessonId, id: `${galaxy}-${number}`, number: `${prefix}-${number}`, finish })
      }
    }
  }
  return result
}

export const cardCatalog = importCardSources([
  ...series('python', 'PY', [['lv-python-foundations', pythonBasics], ['lv-python-practice', pythonPractice]]),
  ...series('c', 'C', [['lv-c-foundations', cBasics]]),
  ...series('algorithms', 'AL', [['lv-algorithms-foundations', algorithms], ['lv-ai-foundations', ai]]),
], import.meta.glob('./sources/*.json', { eager: true, import: 'default' }))
