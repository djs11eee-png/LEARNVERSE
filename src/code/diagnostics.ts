export interface DiagnosticRule {
  pattern: RegExp
  hint: string
}

const diagnosticRules: DiagnosticRule[] = [
  // 无限循环、爆栈与输出过量（跨语言）
  {
    pattern: /运行超过\s*\d+\s*秒|timed out|timeout|Time Limit Exceeded|运行输出超过上限/i,
    hint: '程序可能陷入了死循环，或循环条件永远为真。检查 while / for 中的计数器有没有按预期推进、出口条件能不能到达。',
  },
  {
    pattern: /Maximum call stack size exceeded|RecursionError|StackOverflowError/i,
    hint: '函数递归层数过深导致调用栈溢出。检查是否漏写了“基本情况（终止条件）”，或递归参数没有向终止条件靠拢。',
  },

  // 空值与空指针（JS / Java / Python / C）
  {
    pattern: /Cannot read propert(?:y|ies) of (?:undefined|null)|Cannot set propert(?:y|ies) of (?:undefined|null)|undefined is not an object|null is not an object/i,
    hint: '正在访问一个 null 或 undefined 里的属性。先确认变量是否已赋值、数组下标有没有越界，或用 ?. / if 先判空。',
  },
  {
    pattern: /NullPointerException/i,
    hint: 'Java 空指针异常：对值为 null 的对象调用了方法或读取了字段。先检查对象是否已完成 new 初始化，或用 if (x != null) 判空。',
  },
  {
    pattern: /'NoneType' object (?:has no attribute|is not subscriptable|is not iterable)/i,
    hint: '当前变量的值其实是 None。常见原因是忘记在函数里写 return，或 list.sort() / dict.get() 返回了 None。',
  },
  {
    pattern: /Segmentation fault|SIGSEGV|Access violation|invalid type argument of unary '\*'/i,
    hint: 'C 语言内存访问异常或非法解引用：常见于解引用 NULL/未初始化指针、数组下标越界、或 scanf 漏写取地址符 &。',
  },

  // 越界与键缺失（Python / Java / C / JS）
  {
    pattern: /ArrayIndexOutOfBoundsException|StringIndexOutOfBoundsException|IndexOutOfBoundsException|IndexError|list index out of range|string index out of range/i,
    hint: '下标越界了：长度为 n 的数组或列表有效下标只有 0 到 n - 1。检查循环条件是不是把 < 写成了 <=，或空集合直接取了 [0]。',
  },
  {
    pattern: /KeyError/i,
    hint: '字典里找不到这个键。先检查键名拼写与大小写，或改用 dict.get(键, 默认值) 安全读取。',
  },
  {
    pattern: /stack smashing detected|buffer overflow|array subscript .* is above array bounds/i,
    hint: 'C 语言数组写入超出了分配长度（例如字符数组忘了给结尾 \\0 留 1 字节，或循环多写了一位）。请检查数组大小与边界条件。',
  },

  // SQL（SQLite / sql.js）高频错误
  {
    pattern: /no such table/i,
    hint: 'SQL 找不到这张表。检查表名拼写、大小写，以及前面是否已经执行了对应的 CREATE TABLE 建表语句。',
  },
  {
    pattern: /no such column/i,
    hint: 'SQL 找不到这一列。检查列名拼写；如果在写文字常量（如 \'张三\'），请确认外层用的是单引号而不是双引号或无引号。',
  },
  {
    pattern: /ambiguous column name/i,
    hint: '多表 JOIN 时两张表都有同名列，数据库不知道取哪张。请在列名前加上表名或别名，例如 orders.id。',
  },
  {
    pattern: /UNIQUE constraint failed|PRIMARY KEY constraint failed/i,
    hint: '违反唯一约束 / 主键约束：插入或更新的值与已有记录重复了。请检查主键或 UNIQUE 列的数据是否重复。',
  },
  {
    pattern: /NOT NULL constraint failed/i,
    hint: '违反非空约束：某个标记了 NOT NULL 的列被写入了 NULL 或在 INSERT 时漏填了值。',
  },
  {
    pattern: /FOREIGN KEY constraint failed/i,
    hint: '违反外键约束：引用的主表记录不存在，或正尝试删除仍被子表引用的记录。请先插入主表记录再插子表。',
  },
  {
    pattern: /CHECK constraint failed/i,
    hint: '写入的值不满足表结构里的 CHECK 校验规则（例如负数、超出区间或非法状态值）。',
  },
  {
    pattern: /has \d+ columns but \d+ values were supplied/i,
    hint: 'INSERT 提供的字段数量和 VALUES 里的数值个数对不上。建议显式写出列名列表，并逐个核对数量。',
  },
  {
    pattern: /misuse of aggregate/i,
    hint: '聚合函数（COUNT/SUM/AVG 等）用错了位置：不能直接写在 WHERE 里，筛选分组结果请改用 HAVING。',
  },
  {
    pattern: /near ["'`].*["'`]: syntax error|no such function/i,
    hint: 'SQL 语法或函数名有误。检查报错关键字附近是否少了逗号、括号、分号，或子句顺序写反了（SELECT → FROM → WHERE → GROUP BY → ORDER BY）。',
  },

  // C 语言编译与链接高频错误
  {
    pattern: /format ['"`]%[^'"`]+['"`] expects argument of type|format specifies type/i,
    hint: 'printf / scanf 的格式占位符与变量类型不匹配：int 用 %d、double 用 %lf（scanf）或 %f（printf）、size_t 用 %zu，且 scanf 读基础变量要加 &。',
  },
  {
    pattern: /implicit declaration of function/i,
    hint: 'C 函数在调用前没有声明。检查是不是漏了对应的头文件（如 #include <stdio.h> / <stdlib.h> / <string.h>），或函数定义写在了 main 后面。',
  },
  {
    pattern: /undefined reference to/i,
    hint: 'C 链接阶段找不到函数实现：检查函数名拼写是否与定义一致，或是否只写了原型声明却忘了写函数体。',
  },
  {
    pattern: /lvalue required/i,
    hint: '赋值号 = 左边必须是可修改的变量或内存位置，不能是常量或表达式；如果是做相等判断，请改用 ==。',
  },
  {
    pattern: /incompatible pointer type|makes pointer from integer|makes integer from pointer/i,
    hint: 'C 指针类型和整数/其他指针混用了。检查是不是多写或少写了取地址符 &、解引用符 *，或把字符串写成单引号字符。',
  },

  // Java 编译与运行高频错误
  {
    pattern: /NumberFormatException/i,
    hint: 'Java 数字转换失败：传入 Integer.parseInt / Double.parseDouble 的字符串含空白或非数字字符，先 trim() 并校验格式。',
  },
  {
    pattern: /ClassCastException/i,
    hint: 'Java 类型强转失败：对象实际类型和目标类型不兼容。强转前先用 instanceof 确认类型。',
  },
  {
    pattern: /incompatible types/i,
    hint: 'Java 类型不兼容：等号左右两侧或方法返回值与声明类型不一致（例如把 String 赋给 int，或 double 未转换赋给 int）。',
  },
  {
    pattern: /missing return statement/i,
    hint: '有返回值的方法必须保证每条分支（包括 if/else 之外）最终都有 return 语句。',
  },
  {
    pattern: /class .+ is public, should be declared in a file named/i,
    hint: 'Java 规定 public class 的类名必须与文件名完全一致（区分大小写）；本地运行入口通常使用 public class Main。',
  },
  {
    pattern: /non-static (?:variable|method) .+ cannot be referenced from a static context/i,
    hint: '在 static 方法（如 main）里不能直接访问非 static 成员。请先 new 一个对象再调用，或把辅助方法声明为 static。',
  },
  {
    pattern: /reached end of file while parsing/i,
    hint: '代码末尾缺少闭合大括号 }。顺着类和方法逐层核对 { 与 } 是否成对。',
  },

  // JavaScript 特有常见错误
  {
    pattern: /Assignment to constant variable|invalid assignment to const/i,
    hint: '给 const 声明的常量重新赋值了。如果这个变量后续需要改动，请把声明改为 let。',
  },
  {
    pattern: /is not a function/i,
    hint: '正尝试把一个不是函数的值当函数调用。检查方法名拼写、大小写，或变量是不是被意外覆盖成了数字/字符串。',
  },
  {
    pattern: /JSON\.parse|not valid JSON|JSONDecodeError|Unexpected token .* in JSON/i,
    hint: 'JSON 格式不合法。JSON 的键名和字符串都必须使用双引号 ""，末尾不能有多余逗号。',
  },

  // Python 特有常见错误
  {
    pattern: /UnboundLocalError/i,
    hint: '在函数内部先读取再给同名变量赋值，Python 会把它当成尚未初始化的局部变量。请改用参数传入，或先给它赋初值。',
  },
  {
    pattern: /AttributeError/i,
    hint: '这个对象没有你调用的属性或方法。先用 type() 确认它的真实类型，再核对方法名拼写（例如列表是 append 不是 push）。',
  },
  {
    pattern: /ModuleNotFoundError|ImportError/i,
    hint: '找不到要导入的模块或名称。检查模块名拼写；浏览器内置环境支持 Python 标准库，不包含需单独安装的第三方包。',
  },
  {
    pattern: /ValueError.*invalid literal for int/i,
    hint: 'int() 需要整数形式的文字，例如 25。先检查输入是不是空白、小数或其他非数字文字。',
  },
  {
    pattern: /ValueError.*(?:not enough values to unpack|too many values to unpack)/i,
    hint: '拆包赋值时左右两边数量不一致。先打印右侧数据确认每一项拆开后的实际元素个数。',
  },

  // 通用基础诊断（兜底在具体规则之后）
  {
    pattern: /NameError|ReferenceError|cannot find symbol|undeclared/i,
    hint: '程序找不到这个名字。检查拼写、大小写，以及前面有没有定义它。',
  },
  {
    pattern: /IndentationError|TabError/i,
    hint: '检查每行开头的空格，同一块代码要对齐。冒号后的新代码块需要统一使用 4 个空格缩进，不要混用 Tab 和空格。',
  },
  {
    pattern: /EOFError|输入已用完/i,
    hint: '程序还在读输入。运行前在「标准输入」框补上它需要的行。',
  },
  {
    pattern: /ZeroDivisionError|division by zero|ArithmeticException.*\/ by zero/i,
    hint: '除数是 0。先检查分母来自哪里，在除法前增加分母不为 0 的判断。',
  },
  {
    pattern: /TypeError/i,
    hint: '当前操作碰到了不合适的值类型（例如把字符串和数字直接混算，或传参个数不对）。先打印检查各变量的实际类型。',
  },
  {
    pattern: /SyntaxError|unexpected token|Unexpected end of input|expected .+ before/i,
    hint: '语法解析失败：检查报错这一行以及上一行，重点核对引号、小括号 ()、大括号 {}、分号或冒号是否成对遗漏。',
  },
  {
    pattern: /unused variable|never used/i,
    hint: '这个变量定义了却没有使用。检查是不是写错了名字，或者这行其实可以省略。',
  },
]

export function diagnosticHint(message: string): string {
  for (const rule of diagnosticRules) {
    if (rule.pattern.test(message)) return rule.hint
  }
  return ''
}
