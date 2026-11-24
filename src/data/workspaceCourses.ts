import { adaptedPython } from './adaptedPython'
import { additionalCourses } from './additionalCourses'
import { courseCatalog } from './courseCatalog'
import type { CourseSummary } from './courseCatalog'
import { curriculumCourses } from './curriculum'
import type { RunLanguage } from '../code/runner'

/**
 * Self-contained LEARNVERSE lessons, with attribution on adapted courses.
 */
export interface LessonSection {
  heading: string
  paragraphs: string[]
  code?: string
  codeLanguage?: string
  run?: { language: RunLanguage; starter?: string; expectedOutput?: string; stdin?: string; downloadName?: string }
}

export interface LessonQuestion {
  id: string
  prompt: string
  choices: string[]
  answer: number
  explanation: string
}

export type WorkspaceDemoKind =
  | 'range'
  | 'search'
  | 'publish-subscribe'
  | 'binary-carry'
  | 'bitmask-frame'
  | 'c-pointer'
  | 'bubble-sort'
  | 'stack-queue'
  | 'lru-cache'
  | 'iot-gateway'
  | 'cpu-cycle'

export interface WorkspaceLesson {
  id: string
  title: string
  summary: string
  sections: LessonSection[]
  questions: LessonQuestion[]
  demo?: WorkspaceDemoKind
}

export interface WorkspaceCourse extends CourseSummary {
  attribution?: {
    title: string
    author: string
    version: string
    license: string
    licensePath: string
    copyright: string
    changes: string
    sources: { title: string; url: string }[]
  }
  lessons: WorkspaceLesson[]
}

export const workspaceCourses: WorkspaceCourse[] = [
  {
    ...courseCatalog.python,
    lessons: [
      {
        id: 'values',
        title: '变量与数据',
        summary: '从一张水果摊小票起步，显示文字和数字，给数据起名字，再算出总价。',
        sections: [
          {
            heading: '先让 Python 显示一句话',
            paragraphs: [
              '想象水果摊的小票，第一行写着「今日水果」，第二行写着「苹果」。在 Python 里，直接写在代码中的一段文字叫字符串。用一对英文双引号 " " 围住文字，Python 就知道从哪里开始读、在哪里结束。',
              'print 是 Python 自带的函数。函数是有名字、可以调用的一项操作。调用 print 时，在名字后写一对英文圆括号 ( )，把要显示的内容放进去。',
              'Python 按顺序执行下面两条语句。每次 print 默认显示一行，屏幕先出现「今日水果」，再出现「苹果」。双引号只负责标出文字的范围，屏幕上显示引号里的文字。',
            ],
            code: 'print("今日水果")\nprint("苹果")',
            codeLanguage: 'Python · 可直接运行',
          },
          {
            heading: '看懂引号和小数点',
            paragraphs: [
              '「苹果」、4 和 2.5 都是程序能处理的值。值的种类叫类型。Python 把整数类型叫 int，把这里带小数点的数的类型叫 float（浮点数），把字符串类型叫 str。',
              '没有引号的 4 是整数，2.5 是可以参与计算的浮点数，引号里的 "4" 是一个字符组成的文本。直接写进代码的值叫字面量。',
              '运行下面的三行，依次看到 4、2.5、4。第一行和第三行看起来一样，代码中的引号决定了它们各自的类型。',
            ],
            code: 'print(4)\nprint(2.5)\nprint("4")',
            codeLanguage: 'Python · 可直接运行',
          },
          {
            heading: '用变量给数据起名字',
            paragraphs: [
              '小票会给数字加上标签，例如「单价」和「数量」。变量就像代码里的标签。下面用 item 表示商品名，price 表示单价，quantity 表示购买数量。',
              '英文等号 = 表示赋值。Python 先取右边的值，再把左边的名字和这个值关联起来。之后把变量名放进 print 的括号，就会显示这个名字对应的值。写成 print("price") 则会显示单词 price 本身。',
              '下面三条 print 依次显示「苹果」、4、3。变量名区分大小写，读写时要用同样的名字。两个英文单词可以用下划线 _ 连接，例如 unit_price 表示单价。',
            ],
            code: 'item = "苹果"\nprice = 4\nquantity = 3\nprint(item)\nprint(price)\nprint(quantity)',
            codeLanguage: 'Python · 可直接运行',
          },
        ],
        questions: [
          { id: 'type', prompt: '下面哪个值的类型是整数（int）？', choices: ['"4"', '4', '4.5', '"苹果"'], answer: 1, explanation: '直接写出的 4 是整数，4.5 是浮点数，英文双引号中的值是字符串。' },
          { id: 'assignment', prompt: '执行 price = 4 后，print(price) 会显示什么？', choices: ['price', '4', 'price = 4', '空白'], answer: 1, explanation: 'price 是变量名，print 会显示这个名字所对应的值 4。' },
        ],
      },
      {
        id: 'decisions',
        title: '条件与选择',
        summary: '像核对教室预约一样，先问一个能回答「是」或「否」的问题，再决定做什么。',
        sections: [
          {
            heading: '先提出一个能回答「是」或「否」的问题',
            paragraphs: [
              '教室一共有 12 个座位。要判断够不够，可以问「人数小于或等于座位数吗？」Python 用 <= 表示「小于或等于」。people 是人数，seats 是座位数。',
              '比较会得到 True（成立）或 False（不成立）。这两种值叫布尔值，用来表示判断结果。它们的首字母要大写，直接写成 True 和 False。下面两行分别显示 True 和 False。',
            ],
            code: 'people = 12\nseats = 12\nprint(people <= seats)\npeople = 13\nprint(people <= seats)',
            codeLanguage: 'Python · 可直接运行',
          },
          {
            heading: '让程序按判断结果选择一条路',
            paragraphs: [
              'if 可以读成「如果」。在 if 后写要检查的条件，行尾写英文冒号 :，表示下面开始写这条路要做的事。把下面的 print 向右缩进四个空格，Python 就知道它属于这条路。',
              '与 if 左边对齐的 else 可以读成「否则」。它的冒号后也有一组缩进的语句。人数 13 超过座位数 12，程序走 else，显示「座位不足」。把人数改成 12，程序走 if，显示「可以预约」。',
            ],
            code: 'people = 13\nseats = 12\nif people <= seats:\n    print("可以预约")\nelse:\n    print("座位不足")',
            codeLanguage: 'Python · 可直接运行',
          },
        ],
        questions: [
          { id: 'boundary', prompt: '有 12 人、12 个座位时，people <= seats 的结果是什么？', choices: ['True', 'False', '12', '报错'], answer: 0, explanation: '<= 包含相等的情况，12 人正好坐满 12 个座位。' },
          { id: 'and', prompt: '人数 8 人且房间已被占用。要求「最多 12 人而且房间空闲」时，整个条件是什么结果？', choices: ['True', 'False', '8', '无法判断'], answer: 1, explanation: '「而且」要求两件事都成立。人数达标，房间空闲这一项不成立，所以整个条件是 False。' },
        ],
      },
      {
        id: 'collections',
        title: '列表与循环',
        summary: '把多笔水果销售数量写进清单，再用循环逐项读取、累加和筛选。',
        sections: [
          {
            heading: '把几笔数量放在同一张清单里',
            paragraphs: [
              '水果摊上午分三次卖出 3、5 和 2 个苹果。列表可以把这些值按顺序放在一起。用英文方括号 [ ] 围起来，用英文逗号 , 分隔。列表中的每一个值叫元素。',
              '索引是元素的位置编号，从 0 开始。sales[0] 读取第一项，sales[1] 读取第二项。下面先显示整张清单 [3, 5, 2]，再显示第一项 3，最后显示第二项 5。',
            ],
            code: 'sales = [3, 5, 2]\nprint(sales)\nprint(sales[0])\nprint(sales[1])',
            codeLanguage: 'Python · 可直接运行',
          },
          {
            heading: '对清单里的每一项做同一件事',
            paragraphs: [
              '循环是重复执行一组语句的写法。for quantity in sales 可以读成「对于 sales 里的每一笔数量」。每轮从列表里取一项给 quantity，这个随循环轮次变化的名字叫循环变量。',
              '冒号后向右缩进四个空格，写下每一轮要做的事。这几条缩进语句合起来叫循环体。下面的 print 执行三次，依次显示 3、5、2。空列表写成 []，里面没有可取的值，循环体执行 0 次。',
            ],
            code: 'sales = [3, 5, 2]\nfor quantity in sales:\n    print(quantity)',
            codeLanguage: 'Python · 可直接运行',
          },
        ],
        questions: [
          { id: 'index', prompt: 'sales = [3, 5, 2] 时，sales[1] 是多少？', choices: ['3', '5', '2', '1'], answer: 1, explanation: 'Python 从索引 0 开始，因此索引 1 对应第二项 5。' },
          { id: 'empty', prompt: '对空列表执行 for 循环时，循环体会执行几次？', choices: ['0 次', '1 次', '无限次', '一定报错'], answer: 0, explanation: '空列表没有元素，循环体不会执行。' },
        ],
      },
      {
        id: 'functions',
        title: '函数与返回值',
        summary: '把算总价、算包装数量等重复步骤放进函数，再把结果交给下一步。',
        sections: [
          {
            heading: '给重复使用的计算起名字',
            paragraphs: [
              '水果摊卖苹果也卖香蕉，每次都要用单价乘数量。前面调用过 Python 自带的 print。这里用 def 定义自己的函数，把这项计算起名为 total_price（总价）。',
              '定义时，在函数名后的括号里为所需的值起名字，叫参数。price 和 quantity 用逗号隔开。冒号后缩进四个空格，写函数被调用时要执行的步骤。',
              'return 表示把结果交回调用的位置，并结束这次调用。调用 total_price(4, 3) 时，4 交给第一个参数 price，3 交给第二个参数 quantity。结果 12 存入 apple_total，由最后一行显示。',
            ],
            code: 'def total_price(price, quantity):\n    return price * quantity\n\napple_total = total_price(4, 3)\nprint(apple_total)',
            codeLanguage: 'Python · 可直接运行',
          },
          {
            heading: '区分屏幕上的字和函数交回的值',
            paragraphs: [
              'print 负责把内容显示在屏幕上。return 负责把值交回去，调用方可以把它加到下一笔小票上。函数运行到末尾时，如果没有用 return 交回值，Python 会给调用方一个特殊值 None，表示这次没有交回计算结果。',
              '下面的 show_price 先在屏幕显示 12。随后，result 接到的是 None，所以最后一行显示 None。想继续计算总价时，可以使用上一节带 return 的 total_price。',
            ],
            code: 'def show_price(price, quantity):\n    print(price * quantity)\n\nresult = show_price(4, 3)\nprint(result)',
            codeLanguage: 'Python · 可直接运行',
          },
        ],
        questions: [
          { id: 'return', prompt: '按上面的定义，total_price(4, 3) 返回什么？', choices: ['4', '3', '12', 'None'], answer: 2, explanation: 'return 交回两个参数的乘积，4 × 3 得到 12。' },
          { id: 'print', prompt: '需要把函数结果赋给变量供后续计算使用，应该采用什么？', choices: ['return 返回结果', '只用 print 显示', '只写注释', '删除参数'], answer: 0, explanation: 'return 将值交还给调用者，print 的作用是显示。' },
        ],
      },
    ],
  },
  {
    ...courseCatalog.javascript,
    lessons: [
      {
        id: 'variables',
        title: '变量与值',
        summary: '使用 const 和 let 保存文本、数字与布尔值。',
        sections: [
          {
            heading: '声明变量',
            paragraphs: [
              'JavaScript 用 const 声明不能重新赋值的绑定，用 let 声明需要重新赋值的变量。声明时可以为它们设置初始值。',
              '字符串用引号包围，数字用于计算，true 和 false 用于表达真假。分号用于结束语句，示例中统一保留。',
            ],
            code: 'const course = "JavaScript";\nlet minutes = 20;\nminutes = minutes + 10;\nconsole.log(course, minutes);',
            codeLanguage: 'javascript',
          },
          {
            heading: '值与绑定',
            paragraphs: [
              'let 允许之后给同一个变量重新赋值。const 绑定不能重新赋值，但这不表示对象或数组的内部内容自动不可修改。',
              '在读取变量之前声明它，使用能表达含义的名称，可以让代码更容易理解。',
            ],
          },
        ],
        questions: [
          { id: 'let', prompt: '需要先保存时间，再把它增加 10。哪个声明适合 minutes？', choices: ['let minutes = 20;', 'const minutes = 20; 并重新赋值', '"minutes"', 'return minutes;'], answer: 0, explanation: 'let 声明的绑定允许重新赋值。' },
          { id: 'boolean', prompt: '哪个值表示布尔类型的假？', choices: ['"false"', 'false', '"0"', '"no"'], answer: 1, explanation: 'false 是布尔值；"false" 是包含文字的字符串。' },
        ],
      },
      {
        id: 'conditions',
        title: '条件判断',
        summary: '通过比较和分支决定程序执行哪段代码。',
        sections: [
          {
            heading: '让条件控制分支',
            paragraphs: [
              'if 检查括号内的条件，条件为真时执行花括号中的代码。else 在条件为假时执行另一段代码。',
              '比较是否相等时，本课程使用严格相等运算符 ===，它不会先把不同类型的值转换成同一类型。',
            ],
            code: 'const score = 80;\nif (score >= 60) {\n  console.log("通过");\n} else {\n  console.log("再试一次");\n}',
            codeLanguage: 'javascript',
          },
          {
            heading: '组合判断',
            paragraphs: [
              '&& 表示两侧条件都需要成立，|| 表示至少一侧成立。用括号分组能让复杂条件更容易阅读。',
              '例如，完成阅读且通过测验后，才将章节标为完成。先明确规则，再把它写成条件。',
            ],
            code: 'const read = true;\nconst passed = true;\nif (read && passed) {\n  console.log("章节完成");\n}',
            codeLanguage: 'javascript',
          },
        ],
        questions: [
          { id: 'strict', prompt: '表达式 3 === "3" 的结果是什么？', choices: ['true', 'false', '3', '自动转换后始终为 true'], answer: 1, explanation: '严格相等比较不会先进行类型转换，数字与字符串不同。' },
          { id: 'both', prompt: '阅读完成且测验通过，哪个条件符合这条规则？', choices: ['read || passed', 'read && passed', '!read', 'read === false'], answer: 1, explanation: '&& 要求两项条件都成立。' },
        ],
      },
      {
        id: 'arrays',
        title: '数组与遍历',
        summary: '保存有序数据，并逐个访问数组中的元素。',
        sections: [
          {
            heading: '创建数组',
            paragraphs: [
              '数组保存有顺序的多个值。下标从 0 开始，length 属性给出元素个数。',
              'push 会在数组末尾添加元素。对已有数组使用 push 不会重新绑定变量，即使该数组使用 const 声明。',
            ],
            code: 'const topics = ["变量", "条件"];\ntopics.push("数组");\nconsole.log(topics[0]); // 变量\nconsole.log(topics.length); // 3',
            codeLanguage: 'javascript',
          },
          {
            heading: '遍历数组',
            paragraphs: [
              'for...of 每次取出数组中的一个元素，按顺序执行循环体。它适合逐项展示课程或处理任务。',
              '访问索引时要留意边界。长度为 3 的数组，最后一个元素的索引为 2。',
            ],
            code: 'for (const topic of topics) {\n  console.log("学习：", topic);\n}',
            codeLanguage: 'javascript',
          },
        ],
        questions: [
          { id: 'length', prompt: '长度为 3 的数组，最后一项的索引是多少？', choices: ['0', '1', '2', '3'], answer: 2, explanation: '数组索引从 0 开始，三个元素的索引依次是 0、1、2。' },
          { id: 'push', prompt: 'topics.push("数组") 会做什么？', choices: ['在末尾添加一项', '删除第一项', '返回数组长度但不修改数组', '重新声明 topics'], answer: 0, explanation: 'push 修改数组，在末尾添加元素并返回新的长度。' },
        ],
      },
      {
        id: 'functions',
        title: '函数与交互思维',
        summary: '用函数处理输入，返回可以继续使用的结果。',
        sections: [
          {
            heading: '从输入得到输出',
            paragraphs: [
              '函数将一段可复用的逻辑命名。调用函数时传入参数，return 将结果交还调用位置。',
              '函数可以专注于计算，而由其他代码决定如何显示结果。这样更容易理解和验证每一步。',
            ],
            code: 'function progress(completed, total) {\n  return completed / total * 100;\n}\nconst percent = progress(3, 4);\nconsole.log(percent); // 75',
            codeLanguage: 'javascript',
          },
          {
            heading: '处理边界情况',
            paragraphs: [
              '一个真实的进度计算需要考虑总数为 0 的情况。在计算之前先做判断，可以避免得到不符合预期的数值。',
              '设计网页交互时，先写清输入、处理和输出，再考虑用户看见的反馈。',
            ],
            code: 'function progress(completed, total) {\n  if (total === 0) return 0;\n  return completed / total * 100;\n}',
            codeLanguage: 'javascript',
          },
        ],
        questions: [
          { id: 'result', prompt: 'progress(3, 4) 返回的数字是多少？', choices: ['3', '4', '75', '100'], answer: 2, explanation: '3 除以 4 再乘以 100，得到 75。' },
          { id: 'edge', prompt: '为什么示例先判断 total === 0？', choices: ['确保函数总会输出文字', '避免用 0 作除数得到不符合预期的结果', '让 total 自动变成 100', '让函数只执行一次'], answer: 1, explanation: '总数为 0 时，示例明确返回 0，避免除以 0。' },
        ],
      },
    ],
  },
  {
    ...courseCatalog.computerScience,
    lessons: [
      {
        id: 'binary',
        title: '信息与二进制',
        demo: 'binary-carry',
        summary: '理解位、字节与二进制如何表示数字。',
        sections: [
          {
            heading: '从位开始',
            paragraphs: [
              '计算机使用位表示两种状态，通常记作 0 和 1。一个字节通常由 8 位组成。多位组合可以表示数字，也能在约定编码后表示文字或其他信息。',
              '位本身没有固定含义。相同的位序列可以按不同规则解释，阅读数据时需要知道它采用的表示方式。',
            ],
          },
          {
            heading: '理解位权',
            paragraphs: [
              '二进制数从右到左，每一位的权值依次是 1、2、4、8。某一位为 1 时计入对应权值，为 0 时不计入。',
              '例如 1011₂ = 8 + 2 + 1 = 11₁₀。下标表示使用的进制，帮助区分相同数字符号的不同解释。',
            ],
            code: '二进制位：  1  0  1  1\n对应权值：  8  4  2  1\n合计：      8 + 2 + 1 = 11',
            codeLanguage: 'text',
          },
        ],
        questions: [
          { id: 'byte', prompt: '一个字节通常包含多少位？', choices: ['2 位', '4 位', '8 位', '16 位'], answer: 2, explanation: '通常一个字节包含 8 位。' },
          { id: 'binary-value', prompt: '二进制 101₂ 对应的十进制数是多少？', choices: ['3', '5', '7', '101'], answer: 1, explanation: '101₂ 的位权为 4 + 0 + 1，合计 5。' },
        ],
      },
      {
        id: 'algorithms',
        title: '算法与查找',
        summary: '把解决问题的步骤写清楚，并比较查找方法。',
        sections: [
          {
            heading: '把问题拆成步骤',
            paragraphs: [
              '算法是解决问题的一组明确步骤。描述算法时，需要说明输入、输出，以及每一步在什么条件下执行。',
              '在线性查找中，从头到尾逐项比较目标。如果找到就返回位置，检查完仍没找到则报告不存在。',
            ],
            code: '输入：一组课程和目标名称\n依次检查每个课程\n如果名称相同，返回它的位置\n如果全部检查后仍未找到，报告不存在',
            codeLanguage: 'text',
          },
          {
            heading: '利用已有顺序',
            paragraphs: [
              '二分查找适用于按相同规则排好序的数据。它检查中间项，然后根据比较结果排除不可能包含目标的一半。',
              '长度为 n 的列表，线性查找最坏可能检查 n 项，二分查找每一步大致缩小一半。排序和比较规则必须一致。',
            ],
          },
        ],
        questions: [
          { id: 'sorted', prompt: '使用二分查找前，数据需要满足什么条件？', choices: ['所有值相同', '按一致的比较规则排序', '元素数量必须为偶数', '只能保存数字'], answer: 1, explanation: '二分查找依据数据的顺序排除一半范围，因此要求按一致规则排序。' },
          { id: 'linear', prompt: '线性查找在最坏情况下可能需要检查多少项？', choices: ['最多一项', '列表中的每一项', '永远只检查一半', '零项'], answer: 1, explanation: '目标可能位于末尾或不存在，因此最坏时需要逐项检查。' },
        ],
      },
      {
        id: 'structures',
        title: '数据结构',
        demo: 'stack-queue',
        summary: '根据需要选择保存与访问数据的方式。',
        sections: [
          {
            heading: '顺序与键',
            paragraphs: [
              '数组或列表适合按顺序保存数据，并用索引访问元素。字典或映射将键关联到值，适合根据名称查找对应信息。',
              '选择结构时，先考虑主要操作：需要保持顺序、按位置取值，还是根据一个唯一名称查找？不同结构的具体性能取决于实现。',
            ],
            code: '学习清单：["Python", "算法", "Web"]\n课程进度：{"Python": 2, "算法": 1}',
            codeLanguage: 'text',
          },
          {
            heading: '堆栈和队列',
            paragraphs: [
              '堆栈遵循后进先出：最后放入的项先取出，像撤销操作中最近的变更。队列遵循先进先出：先进入的项先处理，像排队等待处理的任务。',
              '这些名称描述的是操作顺序，实际程序可以使用不同的数据结构实现。',
            ],
          },
        ],
        questions: [
          { id: 'mapping', prompt: '要通过课程名称查找已完成的章节数，哪种表示更贴合需求？', choices: ['把名称映射到章节数', '只保存没有名称的数字', '把所有内容放进一段长文本', '只保存课程总数'], answer: 0, explanation: '映射把课程名作为键，关联到对应的章节数。' },
          { id: 'queue', prompt: '队列通常按什么顺序取出元素？', choices: ['后进先出', '先进先出', '随机', '按名称倒序'], answer: 1, explanation: '队列遵循先进先出，最早进入的元素先被取出。' },
        ],
      },
      {
        id: 'testing',
        title: '程序与测试',
        summary: '通过实例、边界和反馈检查程序是否符合预期。',
        sections: [
          {
            heading: '从预期行为开始',
            paragraphs: [
              '测试用具体输入检查程序输出是否符合预期。先写清规则，再选取能够代表正常情况和边界情况的输入。',
              '例如进度等于已完成章节数除以总章节数。总数为 0 是需要单独确定行为的边界情况。',
            ],
            code: '规则：总数大于 0 时，进度 = 已完成 / 总数\n输入：已完成 3，总数 4\n预期：0.75',
            codeLanguage: 'text',
          },
          {
            heading: '通过反馈定位问题',
            paragraphs: [
              '若实际结果与预期不同，先核对输入和预期，再缩小导致差异的代码范围。一次只改变一个条件，有助于理解原因。',
              '测试通过可以增加信心，但没有覆盖到的输入仍可能出现问题。随着需求变化，需要持续补充有代表性的测试。',
            ],
          },
        ],
        questions: [
          { id: 'expected', prompt: '总数为 4、已完成 3 时，按照示例规则的进度是多少？', choices: ['0.25', '0.75', '3', '4'], answer: 1, explanation: '3 除以 4 等于 0.75，也就是 75%。' },
          { id: 'boundary', prompt: '下面哪一种情况适合用来检查进度计算的边界？', choices: ['总章节数为 0', '每次只测 3 / 4', '改变按钮颜色', '隐藏进度数字'], answer: 0, explanation: '总数为 0 可能导致除数为 0，需要明确程序应该如何处理。' },
        ],
      },
    ],
  },
  {
    ...courseCatalog.c,
    lessons: [
      {
        id: 'first-program',
        title: '认识 C 程序',
        summary: '了解程序入口、头文件与输出语句。',
        sections: [
          {
            heading: '从 main 开始',
            paragraphs: [
              '一个常见的 C 程序从 main 函数开始执行。花括号中的语句依次执行，分号用于结束语句。',
              '下面的 include 指令引入标准输入输出库的声明，使程序可以使用 printf。return 0 表示 main 正常结束。',
            ],
            code: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, C!\\n");\n    return 0;\n}',
            codeLanguage: 'c',
          },
          {
            heading: '源代码到运行',
            paragraphs: [
              'C 源文件通常以 .c 为扩展名。编译器把源代码转换成可执行程序，随后运行程序得到结果。',
              '上例中的 \\n 是换行符。printf 使用它把下一次输出放到新的一行。',
            ],
          },
        ],
        questions: [
          { id: 'entry', prompt: '示例程序从哪个函数开始执行？', choices: ['printf', 'include', 'main', 'return'], answer: 2, explanation: '在常见的 C 程序中，main 是程序入口。' },
          { id: 'newline', prompt: 'printf 字符串中的 \\n 表示什么？', choices: ['一个数字', '换行', '注释结束', '删除输出'], answer: 1, explanation: '\\n 是转义序列，表示换行。' },
        ],
      },
      {
        id: 'values-and-operators',
        title: '变量与整数运算',
        summary: '声明整数变量并观察整数除法。',
        sections: [
          {
            heading: '声明并计算',
            paragraphs: [
              '变量保存数据。int 用于表示整数，声明时可以赋予初始值。',
              '表达式可以使用 +、-、* 和 / 等运算符。printf 的 %d 用来输出 int 类型的值。',
            ],
            code: '#include <stdio.h>\n\nint main(void) {\n    int sessions = 3;\n    int minutes = 25;\n    printf("%d\\n", sessions * minutes);\n    return 0;\n}',
            codeLanguage: 'c',
          },
          {
            heading: '整数除法',
            paragraphs: [
              '当两个操作数都是整数时，除法结果也是整数，小数部分向零截断。例如 7 / 2 的结果为 3。',
              '取余运算符 % 可得到整数除法的余数。例如 7 % 2 得到 1。除数不能为零。',
            ],
            code: '#include <stdio.h>\n\nint main(void) {\n    int groups = 7 / 2;\n    int remainder = 7 % 2;\n    printf("%d %d\\n", groups, remainder);  /* 3 1 */\n    return 0;\n}',
            codeLanguage: 'c',
          },
        ],
        questions: [
          { id: 'product', prompt: 'sessions 为 3、minutes 为 25 时，sessions * minutes 是多少？', choices: ['28', '75', '325', '8'], answer: 1, explanation: '3 乘以 25 等于 75。' },
          { id: 'division', prompt: '在 C 中，整数表达式 7 / 2 的值是多少？', choices: ['3', '3.5', '4', '1'], answer: 0, explanation: '两个操作数都是整数时，结果的小数部分向零截断。' },
        ],
      },
      {
        id: 'control-flow',
        title: '条件与循环',
        summary: '使用 if 和 for 组织程序的执行顺序。',
        sections: [
          {
            heading: '根据条件选择',
            paragraphs: [
              'if 根据条件决定是否执行代码块。条件为假时，可以使用 else 执行另一段代码。',
              '比较是否相等使用 ==。例如 score >= 60 在 score 等于 60 时也成立。',
            ],
            code: '#include <stdio.h>\n\nint main(void) {\n    int score = 60;\n    if (score >= 60) {\n        printf("通过\\n");\n    } else {\n        printf("继续练习\\n");\n    }\n    return 0;\n}',
            codeLanguage: 'c',
          },
          {
            heading: '重复执行',
            paragraphs: [
              'for 循环通常包括初始化、继续条件和每轮更新。每次进入循环体前都会检查条件。',
              '下面的变量 i 从 0 开始，每次增加 1，直到不再小于 3。因此循环体执行三次。',
            ],
            code: '#include <stdio.h>\n\nint main(void) {\n    for (int i = 0; i < 3; i++) {\n        printf("%d\\n", i);\n    }\n    return 0;\n}',
            codeLanguage: 'c',
          },
        ],
        questions: [
          { id: 'boundary', prompt: 'score 为 60 时，score >= 60 的条件成立吗？', choices: ['成立', '不成立', '必须大于 60', '无法判断'], answer: 0, explanation: '大于等于包含等于的情况。' },
          { id: 'loop-count', prompt: 'for (int i = 0; i < 3; i++) 的循环体执行几次？', choices: ['2 次', '3 次', '4 次', '无限次'], answer: 1, explanation: 'i 依次为 0、1、2，执行三次。' },
        ],
      },
      {
        id: 'functions-and-arrays',
        title: '函数与数组',
        demo: 'c-pointer',
        summary: '用函数组织计算，并按索引读取数组。',
        sections: [
          {
            heading: '定义函数',
            paragraphs: [
              '函数可以接收参数并返回结果。返回类型说明返回值的类型，return 将计算结果交还调用位置。',
              '下面的函数接收两次学习时间，返回它们的和。main 负责调用函数并输出结果。',
            ],
            code: '#include <stdio.h>\n\nint total(int first, int second) {\n    return first + second;\n}\n\nint main(void) {\n    printf("%d\\n", total(20, 25));\n    return 0;\n}',
            codeLanguage: 'c',
          },
          {
            heading: '使用数组',
            paragraphs: [
              '数组把同一类型的多个元素按顺序保存。下标从 0 开始，长度为 3 的数组有效下标是 0、1、2。',
              '访问数组时必须保证索引在有效范围内；越界访问会导致未定义行为。',
            ],
            code: '#include <stdio.h>\n\nint main(void) {\n    int minutes[3] = {20, 25, 30};\n    int first = minutes[0];\n    printf("%d\\n", first);  /* 20 */\n    return 0;\n}',
            codeLanguage: 'c',
          },
        ],
        questions: [
          { id: 'sum', prompt: 'total(20, 25) 返回多少？', choices: ['20', '25', '45', '2025'], answer: 2, explanation: '函数返回两个参数之和，20 + 25 = 45。' },
          { id: 'index', prompt: '长度为 3 的数组，最后一个元素的下标是多少？', choices: ['0', '1', '2', '3'], answer: 2, explanation: '数组下标从 0 开始，第三个元素的下标是 2。' },
        ],
      },
    ],
  },
  {
    ...courseCatalog.algorithms,
    lessons: [
      {
        id: 'arrays',
        title: '数组与索引',
        summary: '通过有序位置组织数据，并观察基本操作。',
        sections: [
          {
            heading: '按顺序保存',
            paragraphs: [
              '数组按顺序保存元素。用从 0 开始的索引可以描述元素的位置。不同语言对数组的长度和可存放的类型有不同规定。',
              '对于长度为 n 的数组，有效索引从 0 到 n - 1。访问前应确认数组非空，且索引处于范围内。',
            ],
            code: '值：    12   25   37\n索引：   0    1    2',
            codeLanguage: 'text',
          },
          {
            heading: '访问与插入',
            paragraphs: [
              '在常见数组实现中，根据有效索引读取元素通常不需要从头扫描。',
              '在数组中间插入元素时，后续元素可能需要移动，为新值腾出位置。具体成本取决于数据结构和实现。',
            ],
            code: '原数组：[12, 37]\n在索引 1 插入 25\n结果：  [12, 25, 37]',
            codeLanguage: 'text',
          },
        ],
        questions: [
          { id: 'index', prompt: '数组 [12, 25, 37] 中索引 1 对应哪个值？', choices: ['12', '25', '37', '1'], answer: 1, explanation: '索引从 0 开始，索引 1 对应第二个元素 25。' },
          { id: 'valid', prompt: '长度为 3 的数组，哪个索引超出范围？', choices: ['0', '1', '2', '3'], answer: 3, explanation: '长度为 3 时，有效索引是 0、1、2。' },
        ],
      },
      {
        id: 'search',
        title: '线性查找与二分查找',
        demo: 'search',
        summary: '选择查找方式，明确二分查找的前提。',
        sections: [
          {
            heading: '逐个比较',
            paragraphs: [
              '线性查找从一端开始，逐项与目标比较。找到目标时返回位置，全部检查后仍未找到则报告不存在。',
              '列表无需事先排序。最坏情况下，长度为 n 的列表可能需要检查全部 n 项。',
            ],
            code: '数据：[4, 9, 2]\n目标：2\n检查：4 → 9 → 2，找到位置 2',
            codeLanguage: 'text',
          },
          {
            heading: '缩小搜索范围',
            paragraphs: [
              '二分查找适合已按同一规则排序的数据。比较中间值后，保留可能包含目标的半边范围。',
              '重复操作直到找到目标或搜索范围为空。例如在 [2, 4, 9, 12, 15] 中找 12，先看 9，再在右半边查找。',
            ],
            code: '范围：[2, 4, 9, 12, 15]\n中间值 9 < 12 → 保留 [12, 15]\n检查 12 → 找到',
            codeLanguage: 'text',
          },
        ],
        questions: [
          { id: 'prerequisite', prompt: '二分查找要求数据满足什么条件？', choices: ['长度为偶数', '已经按一致规则排序', '所有值都不同', '只能保存整数'], answer: 1, explanation: '二分查找依靠顺序判断哪一半可以排除。' },
          { id: 'missing', prompt: '线性查找检查完整个列表仍未找到目标，应报告什么？', choices: ['目标不存在于列表中', '目标一定在末尾', '自动修改列表', '忽略搜索结果'], answer: 0, explanation: '所有元素都已比较且没有匹配项，说明列表中没有目标。' },
        ],
      },
      {
        id: 'sorting',
        title: '冒泡排序',
        demo: 'bubble-sort',
        summary: '通过比较相邻元素，逐轮整理顺序。',
        sections: [
          {
            heading: '比较与交换',
            paragraphs: [
              '升序冒泡排序从头开始比较相邻的两个元素。左边大于右边时交换它们，接着检查下一对。',
              '一轮完整遍历后，本轮范围内最大的元素移动到末尾。继续对剩余范围重复，直到完成排序。',
            ],
            code: '[5, 2, 4] → 比较 5 和 2 → [2, 5, 4]\n[2, 5, 4] → 比较 5 和 4 → [2, 4, 5]',
            codeLanguage: 'text',
          },
          {
            heading: '关注比较次数',
            paragraphs: [
              '一轮中可以记录是否发生过交换。如果整轮没有交换，说明当前序列已经满足升序，可以提前结束。',
              '常见冒泡排序在最坏情况下比较次数随 n² 的量级增长。对大量数据，通常需要选择更合适的算法。',
            ],
          },
        ],
        questions: [
          { id: 'swap', prompt: '升序排列时，相邻元素 5、2 比较后应如何处理？', choices: ['交换成 2、5', '保持 5、2', '删除 5', '把两个数相加'], answer: 0, explanation: '左边 5 大于右边 2，交换后较小的数在前。' },
          { id: 'early-stop', prompt: '某一轮没有发生任何交换，说明什么？', choices: ['序列已按要求有序', '必须倒序', '序列一定只有一项', '数据已丢失'], answer: 0, explanation: '完整一轮相邻比较都无需交换，说明序列已满足升序。' },
        ],
      },
      {
        id: 'stacks-and-queues',
        title: '栈与队列',
        demo: 'stack-queue',
        summary: '用进入和取出的顺序理解两种常见结构。',
        sections: [
          {
            heading: '后进先出的栈',
            paragraphs: [
              '栈只从同一端加入和取出数据，遵循后进先出。浏览器中的撤销历史可以用栈的思路理解。',
              '依次压入 A、B 后，先弹出的是 B；再次弹出才是 A。',
            ],
            code: '压入 A → [A]\n压入 B → [A, B]\n弹出   → B，剩余 [A]',
            codeLanguage: 'text',
          },
          {
            heading: '先进先出的队列',
            paragraphs: [
              '队列从一端加入、从另一端取出，遵循先进先出。等待处理的任务可以按照进入顺序排队。',
              '依次加入 A、B 后，先取出 A，再取出 B。实际系统也可能引入优先级等不同规则。',
            ],
            code: '入队 A → [A]\n入队 B → [A, B]\n出队   → A，剩余 [B]',
            codeLanguage: 'text',
          },
        ],
        questions: [
          { id: 'stack-order', prompt: '栈中依次压入 A、B，第一次弹出哪一项？', choices: ['A', 'B', '同时弹出 A 和 B', '无法判断'], answer: 1, explanation: '栈后进先出，最后压入的 B 先弹出。' },
          { id: 'queue-order', prompt: '普通队列中依次加入 A、B，第一次取出哪一项？', choices: ['A', 'B', '同时取出 A 和 B', '随机选取'], answer: 0, explanation: '普通队列先进先出，最早加入的 A 先取出。' },
        ],
      },
    ],
  },
  {
    ...courseCatalog.web,
    lessons: [
      {
        id: 'html-structure',
        title: '用 HTML 组织内容',
        summary: '理解元素、标题、段落和页面结构。',
        sections: [
          {
            heading: '标记内容',
            paragraphs: [
              'HTML 使用元素描述网页内容的结构。开始标签和结束标签通常包围内容，例如 h1 表示主要标题，p 表示段落。',
              '一个完整页面使用 html、head 和 body 组织。head 放元信息，body 放用户看到的页面内容。',
            ],
            code: '<!doctype html>\n<html lang="zh-CN">\n  <head><meta charset="utf-8"><title>学习计划</title></head>\n  <body>\n    <h1>今天学什么</h1>\n    <p>先完成一节 Python 课程。</p>\n  </body>\n</html>',
            codeLanguage: 'html',
          },
          {
            heading: '语义化结构',
            paragraphs: [
              '选择能说明用途的元素，有助于浏览器、辅助技术和维护者理解内容。例如 main 表示页面的主要内容。',
              '标题应反映内容层次。导航使用链接，触发操作使用按钮，这些元素自带适合键盘使用的行为。',
            ],
            code: '<main>\n  <h1>学习计划</h1>\n  <p>选择一门课程开始。</p>\n</main>',
            codeLanguage: 'html',
          },
        ],
        questions: [
          { id: 'heading', prompt: '哪个 HTML 元素适合表示页面的主要标题？', choices: ['h1', 'p', 'img', 'meta'], answer: 0, explanation: 'h1 是一级标题，通常用于页面的主要标题。' },
          { id: 'main', prompt: '哪个元素表示页面的主要内容？', choices: ['head', 'main', 'title', 'meta'], answer: 1, explanation: 'main 用于标记页面的主要内容。' },
        ],
      },
      {
        id: 'css-style',
        title: '用 CSS 设置样式',
        summary: '使用选择器、属性和值调整文字与间距。',
        sections: [
          {
            heading: '样式规则',
            paragraphs: [
              'CSS 规则由选择器和声明组成。选择器决定匹配哪些元素，声明中的属性和值决定如何呈现。',
              '下面的规则匹配 class 为 lesson-title 的元素，将文字颜色设为深色并设置字号。',
            ],
            code: '.lesson-title {\n  color: #25312a;\n  font-size: 24px;\n}',
            codeLanguage: 'css',
          },
          {
            heading: '理解盒模型',
            paragraphs: [
              '元素周围可以有内边距、边框和外边距。padding 增加内容与边框之间的空间，margin 控制元素外侧的间距。',
              '合适的间距能帮助读者区分标题、说明和按钮。文字与背景也应保持足够的对比。',
            ],
            code: '.lesson-card {\n  padding: 16px;\n  border: 1px solid #bac5bd;\n  margin: 12px;\n}',
            codeLanguage: 'css',
          },
        ],
        questions: [
          { id: 'selector', prompt: '选择 class 为 lesson-title 的元素，应使用哪个选择器？', choices: ['.lesson-title', '#lesson-title', 'lesson-title()', '*lesson-title'], answer: 0, explanation: '点号开头的选择器匹配对应的 class。' },
          { id: 'padding', prompt: '哪个属性设置内容与边框之间的间距？', choices: ['margin', 'padding', 'color', 'font-size'], answer: 1, explanation: 'padding 是内边距，位于内容与边框之间。' },
        ],
      },
      {
        id: 'links-and-forms',
        title: '链接、按钮与表单',
        summary: '让导航、操作和输入具有清晰的语义。',
        sections: [
          {
            heading: '选择正确的控件',
            paragraphs: [
              '链接用于导航到一个地址，href 指定目标。按钮用于触发操作，例如提交表单或展开内容。',
              '使用原生元素，浏览器能提供键盘交互等基础行为。描述性的文字也能让控件用途更清楚。',
            ],
            code: '<a href="/academy">浏览课程</a>\n<button type="button">显示学习提示</button>',
            codeLanguage: 'html',
          },
          {
            heading: '为输入添加标签',
            paragraphs: [
              '表单收集用户输入。label 的 for 对应输入框的 id，使标签与控件关联，点击标签也可以聚焦输入。',
              '这里的 type="email" 告诉浏览器该字段期望电子邮箱格式。实际提交前仍需按应用需求进行验证。',
            ],
            code: '<label for="email">邮箱</label>\n<input id="email" name="email" type="email">',
            codeLanguage: 'html',
          },
        ],
        questions: [
          { id: 'navigation', prompt: '用户点击后需要进入课程目录，哪个元素更合适？', choices: ['带 href 的链接', '只有样式的 div', '空的 span', '段落'], answer: 0, explanation: '链接表达导航，并通过 href 指定目标地址。' },
          { id: 'label', prompt: 'label 的 for 属性应与哪个值一致？', choices: ['input 的 id', 'input 的 placeholder', '表单标题', '按钮文字'], answer: 0, explanation: 'label 的 for 与 input 的 id 相同，可以关联标签和输入框。' },
        ],
      },
      {
        id: 'browser-interaction',
        title: '用 JavaScript 响应操作',
        summary: '选择页面元素，响应点击并更新文字。',
        sections: [
          {
            heading: '监听点击',
            paragraphs: [
              '浏览器将页面表示为 DOM。JavaScript 可以选择元素，并在用户点击时执行函数。',
              '下面的示例假定页面中已经有 id 为 start 的按钮和 id 为 status 的段落。点击后只修改这段提示文字。',
            ],
            code: '<button id="start" type="button">开始</button>\n<p id="status">准备学习</p>\n<script>\n  const button = document.querySelector("#start");\n  const status = document.querySelector("#status");\n  button.addEventListener("click", () => {\n    status.textContent = "学习开始";\n  });\n</script>',
            codeLanguage: 'html',
          },
          {
            heading: '分清结构、样式和行为',
            paragraphs: [
              'HTML 提供内容和控件，CSS 控制呈现，JavaScript 处理交互与状态。三者共同构成网页。',
              '脚本需要在目标元素存在后才能选择它们。上面的 script 放在两个元素之后，因此执行时能找到它们。',
            ],
          },
        ],
        questions: [
          { id: 'listener', prompt: '上面的代码在什么操作后更新提示文字？', choices: ['点击按钮', '页面失去焦点', '关闭浏览器', '鼠标移动到页面任意位置'], answer: 0, explanation: 'addEventListener("click", ...) 为按钮注册了点击事件处理函数。' },
          { id: 'text', prompt: '示例用哪个属性更新段落中的文字？', choices: ['href', 'textContent', 'font-size', 'padding'], answer: 1, explanation: 'textContent 设置元素的文本内容。' },
        ],
      },
    ],
  },
  adaptedPython,
  ...additionalCourses,
  ...curriculumCourses,
]
