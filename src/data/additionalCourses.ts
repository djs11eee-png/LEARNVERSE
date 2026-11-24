import type { WorkspaceCourse, WorkspaceLesson } from './workspaceCourses'
import { courseCatalog } from './courseCatalog'

function course(key: keyof typeof courseCatalog, lessons: WorkspaceLesson[]): WorkspaceCourse {
  return { ...courseCatalog[key], lessons }
}

const java = course('java', [
    {
      id: 'types-and-programs', title: '从 main 方法开始', summary: '理解一个 Java 程序从哪里开始，以及变量为什么要声明类型。',
      sections: [
        { heading: '入口与输出', paragraphs: [
          '这个例子将类命名为 StudyPlan，保存时文件名为 StudyPlan.java。这里使用 public static void main(String[] args) 作为程序入口，程序从大括号里的语句开始执行。',
          'System.out.println 将括号内的值输出并换行。用分号结束这一条语句。类和方法的大括号分别确定它们各自包含的内容。',
        ], codeLanguage: 'Java', code: `public class StudyPlan {
    public static void main(String[] args) {
        System.out.println("今天学习 Java");
    }
}` },
        { heading: '声明一个有类型的变量', paragraphs: [
          'int 适合表示本例中的整数分钟，double 可保存带小数的数值，boolean 只有 true 和 false，String 用双引号表示文本。选择类型时先考虑数据需要支持的操作。',
          '两个 int 相除得到整数商。将其中一个操作数转成 double 会执行浮点除法。把 90 / 60 的结果再赋给 double 也无法找回已被截去的小数部分。',
        ], codeLanguage: 'Java · 方法内片段', code: `int minutes = 90;
double hours = (double) minutes / 60;
boolean reachedGoal = minutes >= 60;
System.out.println(hours);        // 1.5
System.out.println(reachedGoal);  // true` },
      ],
      questions: [
        { id: 'entry', prompt: '本例中，哪个方法作为程序入口？', choices: ['println', 'main', 'StudyPlan.java', 'String'], answer: 1, explanation: 'main 方法的大括号内是入口逻辑。println 只是输出语句调用的方法。' },
        { id: 'integer-division', prompt: 'int a = 90; int b = 60; 表达式 a / b 的结果是？', choices: ['1.5', '2', '1', '0'], answer: 2, explanation: '两个 int 相除会取整数商，结果的小数部分被舍去。' },
      ],
    },
    {
      id: 'branches-and-loops', title: '判断与循环', summary: '通过条件选择提示，通过循环统计一组学习记录。',
      sections: [
        { heading: '先判断，再选择一条路径', paragraphs: [
          'if 括号中的条件需要产生 boolean 值。条件成立就进入它的代码块，否则进入可选的 else。',
          '用 >= 表达“至少”。目标等于实际分钟数时也应达标，这个等号决定了边界测试的结果。',
        ], codeLanguage: 'Java · 方法内片段', code: `int minutes = 25;
if (minutes >= 25) {
    System.out.println("达标");
} else {
    System.out.println("继续学习");
}` },
        { heading: '用累加变量统计数组', paragraphs: [
          'int[] 用于保存一组整数。创建数组后长度固定，可以用 .length 读取元素个数。这里不需要知道位置，使用增强 for 循环逐个取得元素。',
          '累加变量应定义在循环前，否则每次循环体开始时就重新得到 0。循环结束后再输出总值。',
        ], codeLanguage: 'Java · 方法内片段', code: `int[] sessions = {15, 25, 10};
int total = 0;
for (int minutes : sessions) {
    total += minutes;
}
System.out.println(total);  // 50` },
      ],
      questions: [
        { id: 'boundary', prompt: '第一段示例中 minutes 等于 25 时输出什么？', choices: ['继续学习', 'false', '没有输出', '达标'], answer: 3, explanation: '25 >= 25 为 true，因此执行第一个代码块。' },
        { id: 'total', prompt: '对空的 int[] 执行第二段累加逻辑，total 最终是多少？', choices: ['0', '1', 'null', '会发生索引越界'], answer: 0, explanation: '增强 for 不会进入空数组的循环体，total 保持初始化的 0。' },
      ],
    },
    {
      id: 'methods', title: '方法与返回值', summary: '提取可复用的计算，并用普通输入和边界输入检查结果。',
      sections: [
        { heading: '让计算和显示分开', paragraphs: [
          '方法签名声明它接受的数据。示例中的 int 是返回值类型，target 与 done 是两个参数。return 结束这次调用，并把结果送回调用处。',
          '剩余时长不会小于 0。先算差值，再用 Math.max 取它和 0 中较大的值，调用方可以打印这个结果或继续计算。',
        ], codeLanguage: 'Java', code: `public class StudyPlan {
    static int remaining(int target, int done) {
        return Math.max(0, target - done);
    }

    public static void main(String[] args) {
        System.out.println(remaining(60, 35));  // 25
    }
}` },
        { heading: '从边界写出预期结果', paragraphs: [
          '测试方法时，先写出输入和预期输出。已经达标与超出目标都很常见，要分别检查。若结果与你的预期不符，可以由这个小范围定位差值或边界处理的问题。',
        ], codeLanguage: '预期输出', code: 'remaining(60, 35) → 25\nremaining(60, 60) → 0\nremaining(60, 70) → 0' },
      ],
      questions: [
        { id: 'return-type', prompt: 'remaining 方法的返回值类型是什么？', choices: ['int', 'void', 'boolean', 'String'], answer: 0, explanation: '方法名前的 int 声明它返回整数。' },
        { id: 'over-target', prompt: '按本章方法，remaining(60, 75) 返回什么？', choices: ['-15', '0', '15', '75'], answer: 1, explanation: '差值是 -15，Math.max(0, -15) 选取 0。' },
      ],
    },
    {
      id: 'objects', title: '用对象表示一条学习记录', summary: '用类描述结构，用构造方法初始化每次学习的数据。',
      sections: [
        { heading: '字段和构造方法', paragraphs: [
          '学习记录需要名称和时长，类可把它们组织到一起。构造方法与类同名，不声明返回类型。this.title 指当前对象的字段，右侧的 title 是收到的参数。',
          '下面用 private 限制外部直接访问字段，通过 summary 提供需要展示的内容。final 让这两个字段在初始化之后不再被重新赋值。',
        ], codeLanguage: 'Java · StudySession.java', code: `public class StudySession {
    private final String title;
    private final int minutes;

    public StudySession(String title, int minutes) {
        this.title = title;
        this.minutes = minutes;
    }

    public String summary() {
        return title + " · " + minutes + " 分钟";
    }
}` },
        { heading: '从同一个类创建不同记录', paragraphs: [
          'new 创建实例并调用构造方法。不同实例保存各自的字段值。在同一目录的 StudyPlan 类中使用下面两次构造，会得到两条独立的学习记录。',
        ], codeLanguage: 'Java · main 方法内片段', code: `StudySession reading = new StudySession("阅读", 15);
StudySession practice = new StudySession("练习", 25);
System.out.println(reading.summary());   // 阅读 · 15 分钟
System.out.println(practice.summary());  // 练习 · 25 分钟` },
      ],
      questions: [
        { id: 'this-field', prompt: '构造方法中 this.minutes 表示什么？', choices: ['另一个对象的时长', '当前对象的 minutes 字段', '构造方法的返回值', '数组长度'], answer: 1, explanation: 'this 引用正在初始化的对象。this.minutes 指这个对象自己的字段。' },
        { id: 'new-object', prompt: '上面两次执行 new StudySession 后，practice.summary() 使用哪个时长？', choices: ['15', '40', '25', '0'], answer: 2, explanation: '两次 new 分别创建实例。practice 记录构造时传入的 25。' },
      ],
    },
  ])

const backend = course('backend', [
    {
      id: 'http', title: '读懂 HTTP 请求和响应', summary: '跟踪一次课程查询，分清方法、路径、状态码和内容。',
      sections: [
        { heading: '客户端提出请求', paragraphs: [
          '客户端可以是浏览器，也可以是其他程序。它用方法和目标地址说明要做什么。这个学习站接口示例用 GET 查询编号为 python 的课程，服务器根据路径选择处理逻辑。',
          '这里用简化的 HTTP/1.1 文本帮助你识别各部分。示例域名和接口只用于阅读。',
        ], codeLanguage: 'HTTP · 请求', code: 'GET /api/courses/python HTTP/1.1\nHost: learnverse.example\nAccept: application/json' },
        { heading: '状态码说明处理结果', paragraphs: [
          '服务器返回状态码、响应头和可选的内容。200 表示这个请求成功，Content-Type 描述内容格式。没有找到指定课程时，可用 404 表示目标不存在。',
          'JSON 对象里的 title 是应用提供的信息。状态码属于 HTTP，应用字段属于响应正文，处理接口时需要分别检查。',
        ], codeLanguage: 'HTTP · 响应示意', code: 'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"id":"python","title":"Python 编程起步"}' },
      ],
      questions: [
        { id: 'method', prompt: '示例用什么方法读取课程详情？', choices: ['POST', 'GET', 'PUT', 'DELETE'], answer: 1, explanation: 'GET 用于获取资源的表示。它适合读取课程详情。' },
        { id: 'missing', prompt: '课程查询接口确认目标课程不存在时，最合适的状态码是？', choices: ['200', '201', '404', '500'], answer: 2, explanation: '404 表示服务器没有找到此请求的目标资源。' },
      ],
    },
    {
      id: 'validation', title: '接收数据与校验', summary: '设计一条学习记录的提交规则，为输入错误给出具体提示。',
      sections: [
        { heading: '约定请求正文', paragraphs: [
          'POST 常用于向服务器提交数据。例如 POST /api/study-sessions 提交一条记录。这里约定 courseId 为有内容的字符串，minutes 为 1 到 1440 的整数。',
          '浏览器的输入提示能帮助用户填写，服务器仍需要检查收到的数据，因为其他客户端也可以调用接口。',
        ], codeLanguage: 'JSON', code: '{ "courseId": "python", "minutes": 25 }' },
        { heading: '在写入前说明哪里出错', paragraphs: [
          '解析 JSON 后先检查类型，再检查范围。如果本接口用 400 表示输入错误，正文可以指出具体字段和规则，客户端就能在表单上提示用户。',
          '当记录创建成功，可返回 201 和新记录的 ID。先确认数据满足规则，再写入存储，避免把无法使用的记录留给后续页面。',
        ], codeLanguage: 'JSON · 400 响应正文', code: '{ "field": "minutes", "message": "请输入 1 到 1440 之间的整数" }' },
      ],
      questions: [
        { id: 'type-check', prompt: '按本课约定，minutes 写成字符串 "25" 时应如何处理？', choices: ['校验失败，说明需要整数', '自动随机选择数字', '直接保存字符串', '返回创建成功'], answer: 0, explanation: 'JSON 字符串和数字是不同类型，接口约定接收整数。' },
        { id: 'created', prompt: '成功创建一条新记录时，下列哪个状态码最明确？', choices: ['404', '500', '400', '201'], answer: 3, explanation: '201 明确表示请求已完成并创建了资源。' },
      ],
    },
    {
      id: 'data', title: '从对象到数据记录', summary: '给记录分配唯一标识，并从存储中取回用户想看的数据。',
      sections: [
        { heading: '记录 ID 与课程 ID 有不同用途', paragraphs: [
          '每次学习都会生成一条记录，同一个课程可以有多次学习记录。因此使用 session_id 唯一标识记录，course_id 则表示记录属于哪个课程。',
          '在关系数据库中，主键保证一条记录有唯一的身份。是否需要把课程引用约束为外键，需要结合表之间的关系决定。',
        ], codeLanguage: '数据表 · 示例行', code: 'session_id | course_id | minutes\ns101       | python    | 25\ns102       | python    | 15\ns103       | web       | 20' },
        { heading: '只读取需要的行和字段', paragraphs: [
          'SELECT 后面列出要读取的列，WHERE 指定筛选条件。这个固定示例读取 Python 课程的记录，ORDER BY 指定结果顺序。',
          '数据库用于保留记录，接口根据用途选择响应字段。页面显示课程总时长时，需要按课程汇总，而查看每次学习则保留每条记录。',
        ], codeLanguage: 'SQL', code: "SELECT session_id, minutes\nFROM study_sessions\nWHERE course_id = 'python'\nORDER BY session_id;" },
      ],
      questions: [
        { id: 'unique-id', prompt: '表中哪个字段应唯一标识每次学习？', choices: ['minutes', 'course_id', 'session_id', '同一天的日期'], answer: 2, explanation: '同一课程和同样时长都可能重复，session_id 用来区分每条记录。' },
        { id: 'where-result', prompt: '用示例中的 WHERE 条件筛选，会得到哪两条记录？', choices: ['s101 和 s103', 's101 和 s102', 's102 和 s103', '全部记录'], answer: 1, explanation: '只有 s101 与 s102 的 course_id 等于 python。' },
      ],
    },
    {
      id: 'testing', title: '用测试锁定接口行为', summary: '在新增功能前，给正常、缺失和越界场景设置可以检查的预期。',
      sections: [
        { heading: '列出输入、状态与结果', paragraphs: [
          '写测试前先固定数据。例如测试数据库中存在 python，不存在 unknown。测试应同时检查状态码和重要字段，这样即使返回 200 也能发现内容错了。',
          '创建接口需要检查是否真的写入数据。失败时也要确认没有增加记录，避免客户端看到错误提示但数据库已被修改。',
        ], codeLanguage: '测试用例', code: 'GET /api/courses/python  → 200，正文 id 为 python\nGET /api/courses/unknown → 404\nPOST minutes=25          → 201，增加一条记录\nPOST minutes=0           → 400，记录数不变' },
        { heading: '边界两侧都要检查', paragraphs: [
          '对允许 1 到 1440 的分钟数规则，1 和 1440 是有效边界，0 和 1441 是无效边界。成对验证可发现比较符号写反或漏掉等号。',
          '先准备测试数据，再调用接口，最后验证结果。每个用例结束后恢复数据，后续用例就不依赖前一个是否成功。',
        ], codeLanguage: '预期结果', code: '0 → 不通过\n1 → 通过\n1440 → 通过\n1441 → 不通过' },
      ],
      questions: [
        { id: 'failure-state', prompt: '校验失败的创建请求，除了状态码还该验证什么？', choices: ['背景颜色', '服务器名称长度', '浏览器语言', '没有新增记录'], answer: 3, explanation: '请求失败后不应留下一条本不该写入的记录。' },
        { id: 'boundary', prompt: '要检查上限 1440 是否被正确包含，哪一组最贴近边界？', choices: ['1440 和 1441', '20 和 25', '1 和 2', '-8 和 -7'], answer: 0, explanation: '1440 在允许区间内，紧邻的 1441 在区间外。' },
      ],
    },
  ])

const ai = course('ai', [
    {
      id: 'tokens', title: '模型怎样读到文字', summary: '区分原始文本、token 和编号，理解为什么使用模型配套的分词器。',
      sections: [
        { heading: '一段文字先被转换成编号', paragraphs: [
          '分词器会把输入拆成 token，再映射到模型词表里的编号。一个 token 可以对应字词、词的一部分、标点或其他片段。不同分词器对同一句话的切分和编号可能不同。',
          '下面是教学用的虚构词表。真实模型会使用自己训练时匹配的分词器，因此不能把这个例子里的数字交给任意模型。',
        ], codeLanguage: '教学示意', code: '文本：「学习计划」\n切分：「学习」 | 「计划」\n词表：「学习」→ 12，「计划」→ 47\n输入编号：[12, 47]' },
        { heading: '按 token 计算输入长度', paragraphs: [
          '模型能处理的上下文长度通常用 token 计量。字符数、单词数和 token 数之间没有统一的换算公式，中文和英文都需要按所用分词器计算。',
          '整理长输入时，先保留回答需要用到的资料，删去重复段落，再检查是否给生成结果留下足够空间。',
        ] },
      ],
      questions: [
        { id: 'token-count', prompt: '为什么不能用汉字数量直接当作模型的 token 数？', choices: ['模型从不处理中文', '分词规则取决于所用分词器', '汉字数量永远是 token 数的一半', 'token 只表示数字'], answer: 1, explanation: '分词器可能识别多个字组成的片段，也可能用不同方式拆分同一段文本。' },
        { id: 'vocab', prompt: '按示意词表，「计划学习」切分为「计划」「学习」后对应什么？', choices: ['[12, 47]', '[47, 47]', '[47, 12]', '[12, 12]'], answer: 2, explanation: '编号依次按 token 顺序取出，计划是 47，学习是 12。' },
      ],
    },
    {
      id: 'generation', title: '下一步预测怎样形成整段文字', summary: '逐步跟踪生成过程，区分最高概率选取与采样。',
      sections: [
        { heading: '每次选择下一个 token', paragraphs: [
          '对于常见的自回归语言模型，已给出的输入和已经生成的 token 一起影响下一步的概率分布。选出一个 token 后将它追加到上下文，再计算下一步。',
          '下表只是用来理解方法的假设结果。随着上下文改变，候选和概率也会改变。一个高概率续写仍可能与事实不符。',
        ], codeLanguage: '示意分布', code: '输入：今天先学习\n候选：Python 0.55，算法 0.30，英语 0.15\n选择 Python 后：今天先学习 Python' },
        { heading: '同一输入可能产生不同输出', paragraphs: [
          '每次挑最大的概率称为贪心选择。采样则依据概率抽取，较低概率的候选也可能出现。改变生成规则会影响文字的稳定性和多样性。',
          '需要核验的事实应通过资料或程序检查。仅把生成调得更稳定，无法证明答案准确。',
        ] },
      ],
      questions: [
        { id: 'greedy', prompt: '按图中的概率做贪心选择，会追加哪个候选？', choices: ['英语', '算法', '随机选', 'Python'], answer: 3, explanation: 'Python 的概率 0.55 在给出的三个候选中最高。' },
        { id: 'grounding', prompt: '下一步的高概率代表什么？', choices: ['这个 token 在当前上下文下更可能被模型选中', '模型已查证它对应的事实', '它一定是正确答案', '输出从此不会变化'], answer: 0, explanation: '概率衡量的是模型对续写的预测，事实正确需要另行核验。' },
      ],
    },
    {
      id: 'instructions', title: '给出资料和清楚的任务', summary: '分清任务说明、待处理资料和输出要求。',
      sections: [
        { heading: '先告诉模型要做什么', paragraphs: [
          '把动作、依据和输出形式写清楚。要统计学习总时长，可以将记录作为资料，把求和与输出字段作为任务。明确要求资料不足时怎么回答。',
          '同一段文字既可能是说明，也可能是资料。用清楚的标签区分它们，方便人阅读，也有助于模型理解。',
        ], codeLanguage: '任务说明示例', code: '任务：根据资料统计学习分钟数。\n资料：阅读 15 分钟；练习 25 分钟。\n输出：整数分钟。如果资料缺失，写“资料不足”。' },
        { heading: '模型的格式还需检查', paragraphs: [
          '要求输出 JSON 并不能保证每次都产生合法 JSON。程序需要解析结果，再检查必需字段和字段类型。面向计算的步骤可以直接用确定的代码完成。',
          '本例可以先用加法算出 40，再用程序检查输出。换用没有时长的例子，检验它会不会凭空填数。',
        ] },
      ],
      questions: [
        { id: 'source-total', prompt: '示例中有足够资料支持的结果是？', choices: ['25', '40', '15', '资料不足'], answer: 1, explanation: '记录里有阅读 15 分钟和练习 25 分钟，两项之和为 40。' },
        { id: 'schema', prompt: '任务要求返回 JSON，收到内容后第一步该做什么？', choices: ['假定一定合法', '直接删除全部字段', '解析并检查结构', '把所有数字改成字符串'], answer: 2, explanation: '先确认 JSON 能解析，再用约定检查字段是否齐全、类型是否正确。' },
      ],
    },
    {
      id: 'evaluation', title: '设计可以复查的评估', summary: '用普通样本、缺资料样本和边界样本对比模型回答。',
      sections: [
        { heading: '预期结果先于运行', paragraphs: [
          '先准备几条能独立算出答案的输入，再查看模型如何回答。为每条输入写下合格标准，例如总数正确、没有添加资料中不存在的时长。',
          '还要覆盖资料缺失、零值和单位不同的情况。对比任务说明的两个版本时，用相同的一组样本才方便判断变化。',
        ], codeLanguage: '评估样例', code: '15 分钟 + 25 分钟 → 40 分钟\n阅读未提供时长 → 资料不足\n1 小时 + 5 分钟 → 65 分钟' },
        { heading: '记录错误的来源', paragraphs: [
          '区分格式错误、单位换算错误和缺资料时臆造。这样可以选择合适的改进方式，例如修改输入说明，或把换算交给普通程序。',
          '一小组样本有助于发现问题，但只能说明在这些样本上的表现。扩大使用范围之前，需要添加能代表实际情况的更多例子。',
        ] },
      ],
      questions: [
        { id: 'missing-case', prompt: '测试缺资料场景时，最符合要求的回答是什么？', choices: ['凭经验估计 30 分钟', '默认 0 分钟', '猜测最常见值', '资料不足'], answer: 3, explanation: '没有提供足够的学习时长，无法计算可核实的总数。' },
        { id: 'same-samples', prompt: '比较两版任务说明时，哪种做法更容易公平比较？', choices: ['用同一组样本和合格标准', '给两版使用难度完全不同的样本', '只看输出长度', '只保留表现最好的一个例子'], answer: 0, explanation: '控制样本和判断标准，才能把观察到的差异更多归因于任务说明的变化。' },
      ],
    },
  ])

/** Adapted from ROS 2 Jazzy documentation (CC BY 4.0). See course attribution. */
const ros = course('ros', [
    {
      id: 'nodes', title: '把系统拆成节点', summary: '用职责清晰的节点组织虚拟观测站。',
      sections: [
        { heading: '每个节点处理一类任务', paragraphs: [
          'ROS 2 节点是参与通信的程序单元。它可以发布数据、接收数据，或处理请求。在这个例子里，采集节点生成虚拟温度，面板节点展示温度，记录节点负责保存观测。',
          '这种职责划分便于单独检查每一部分。面板显示不更新时，可以分别查看采集是否产生数据、接收端是否接对接口。',
        ], codeLanguage: '节点关系', code: '采集节点 ──温度消息──→ 面板节点\n                     └→ 记录节点' },
        { heading: '节点和通信接口是两件事', paragraphs: [
          '节点是参与者，接口是节点交换信息的方式。一个节点可以同时使用多个接口。同一个观察面板可以订阅温度话题，也可以向服务查询配置。',
        ] },
      ],
      questions: [
        { id: 'producer', prompt: '例子里由哪个节点生成虚拟温度？', choices: ['面板节点', '采集节点', '记录节点', '服务名称'], answer: 1, explanation: '采集负责生成数据，面板负责显示，记录负责保存。' },
        { id: 'multiple', prompt: '同一个节点能使用多个通信接口吗？', choices: ['不能，每个节点只能通信一次', '仅当设备处于关机状态', '能，例如同时订阅话题和查询服务', '只能发送不能接收'], answer: 2, explanation: '节点可以承担多种通信角色，接口与节点不是一对一关系。' },
      ],
    },
    {
      id: 'topics', title: '通过话题传递连续消息', summary: '用发布和订阅传递读数，检查为什么同一条消息可以到达多个节点。',
      demo: 'publish-subscribe',
      sections: [
        { heading: '发布端与订阅端各自接入话题', paragraphs: [
          '话题适合传递持续更新的数据，例如温度读数。采集节点把消息发布到 /station/temperature，面板和记录节点分别订阅这个话题。发布端不需要逐个指定接收者。',
          '下面的消息结构是本课的示意。在 ROS 2 中，通信双方需要就话题名称和消息类型匹配，并配置兼容的服务质量（QoS）。本章的交互演示只模拟话题名称和接收关系。',
        ], codeLanguage: '话题示意', code: '发布者：采集节点\n话题：/station/temperature\n消息：{celsius: 21.5}\n订阅者：面板节点、记录节点' },
        { heading: '沿数据路径查问题', paragraphs: [
          '一个接收端没有看到新读数时，先确认有消息发出，再比较双方的话题名和消息类型。如果其他订阅者能收到，也要检查该接收端自己的配置。',
        ] },
      ],
      questions: [
        { id: 'stream', prompt: '持续更新的温度读数，最适合用哪类接口？', choices: ['服务', '动作', '构造方法', '话题'], answer: 3, explanation: '话题适合把连续数据发送给一个或多个订阅端。' },
        { id: 'receivers', prompt: '面板和记录节点都匹配地订阅同一个话题时，一条读数可以交给谁？', choices: ['两个节点都可以收到', '只能给面板', '只能给记录', '只有发布者自己能看到'], answer: 0, explanation: '同一话题可以有多个订阅者，每个订阅者独立接收。' },
      ],
    },
    {
      id: 'services', title: '通过服务发起一次查询', summary: '区分请求与响应，选择适合快速返回结果的接口。',
      sections: [
        { heading: '查询当前配置时需要一条回复', paragraphs: [
          '客户端可以向服务发出请求，服务端检查请求后给出响应。温度单位查询只需返回一个设置值，适合用服务表达。',
          '定义接口时要写明请求需要哪些字段，以及响应返回哪些数据。下面的 unit 字段让调用者知道显示何种温度单位。',
        ], codeLanguage: '请求与响应示意', code: '/station/get_unit\n请求：{sensor: "room"}\n响应：{unit: "celsius"}' },
        { heading: '服务适合短时处理', paragraphs: [
          '持续读数可用话题，一次快速查询可用服务。如果处理需要较长时间且要报告进度，就要考虑动作。区分这三种需求可以让接口更贴近使用场景。',
        ] },
      ],
      questions: [
        { id: 'reply', prompt: '查询一个指定传感器的温度单位并立即得到响应，最适合什么？', choices: ['服务', '持续发布话题', '动作', '每次重启采集节点'], answer: 0, explanation: '这是带有输入的一次短时请求，并且调用方需要一条明确的响应。' },
        { id: 'response', prompt: '这个示例返回的响应字段是什么？', choices: ['sensor', 'unit', 'minutes', 'goal'], answer: 1, explanation: 'sensor 是请求字段，unit 是响应里被查询到的设置。' },
      ],
    },
    {
      id: 'actions', title: '用动作跟踪一个长任务', summary: '分清目标、反馈和结果，并了解取消请求的用途。',
      sections: [
        { heading: '长任务可以在进行中提供反馈', paragraphs: [
          '动作适合处理持续一段时间、有反馈并可能需要取消的任务。客户端提交目标，服务端接受后执行。中途状态用反馈表示，结束后用结果表示。',
          '虚拟观测站可以用动作生成一份温度统计报告。目标描述要汇总的时长，反馈显示当前已处理多少记录，结果包含最终报告。',
        ], codeLanguage: '动作示意', code: '目标：汇总过去 60 分钟\n反馈：已处理 80 / 120 条读数\n结果：均值 21.4 °C，共 120 条' },
        { heading: '取消与完成是不同结果', paragraphs: [
          '客户端发出取消请求后显示「已申请取消」。服务端接受请求后显示「正在取消」，收到最终取消状态后才显示「已取消」。如果任务抢先成功或取消被拒绝，仍按该任务的实际状态显示。',
        ] },
      ],
      questions: [
        { id: 'feedback', prompt: '显示“已处理 80 / 120 条”属于动作的哪个部分？', choices: ['目标', '结果', '反馈', '节点名称'], answer: 2, explanation: '反馈描述任务执行中的进展，结果则在任务结束后给出。' },
        { id: 'cancel', prompt: '客户端刚提交取消请求，服务端尚未回应，界面应显示什么？', choices: ['报告已生成', '已取消', '正在取消', '已申请取消'], answer: 3, explanation: '服务端接受请求后显示正在取消，任务进入最终取消状态后才显示已取消。' },
      ],
    },
  ])

ros.attribution = {
  title: 'ROS 2 Jazzy 文档 · 站内改编',
  author: 'ROS 2 Documentation 贡献者；LEARNVERSE 改编',
  version: 'Jazzy，2026-11-18 核对',
  license: 'CC BY 4.0',
  licensePath: '/licenses/ros2-jazzy.txt',
  copyright: 'ROS 2 Documentation contributors',
  changes: '选取通信基础概念，改写为四章中文短课，使用虚拟环境观测站示例，新增本地交互演示、题目和答案解析。',
  sources: [
    { title: 'Topics', url: 'https://github.com/ros2/ros2_documentation/blob/jazzy/source/Concepts/Basic/About-Topics.rst' },
    { title: 'Services', url: 'https://github.com/ros2/ros2_documentation/blob/jazzy/source/Concepts/Basic/About-Services.rst' },
    { title: 'Actions', url: 'https://github.com/ros2/ros2_documentation/blob/jazzy/source/Concepts/Basic/About-Actions.rst' },
  ],
}

export const additionalCourses = [java, backend, ai, ros]

