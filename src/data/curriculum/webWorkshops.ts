import type { LessonSection } from '../workspaceCourses'

function javascript(heading: string, paragraphs: string[], code: string, expectedOutput: string, starter?: string): LessonSection {
  return {
    heading, paragraphs, code, codeLanguage: 'JavaScript',
    run: { language: 'javascript', expectedOutput, starter },
  }
}

function html(heading: string, paragraphs: string[], code: string, downloadName: string, starter?: string): LessonSection {
  return {
    heading, paragraphs, code, codeLanguage: 'HTML',
    run: { language: 'html', downloadName, starter },
  }
}

function demoPage(title: string, body: string, script: string) {
  const scriptBlock = script ? '\n  <script>\n' + script + '\n  </script>' : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font: 1rem/1.6 system-ui, sans-serif; margin: 1.5rem; }
    input, button, select { font: inherit; }
  </style>
</head>
<body>
  <h1>${title}</h1>
${body}${scriptBlock}
</body>
</html>`
}

export const advancedWebWorkshops: Record<string, [LessonSection, LessonSection]> = {
  'signup-objects': [
    javascript(
      '先用字段名找到值，再给它起短名字',
      [
        '字段是对象里一个名字和一个值的配对。读 record.name 时，点左边指出要读哪个对象，右边指出其中哪个字段。字段名不等于变量名：下例用 firstName 保存 record.name，这两处的名字可以不同。先用点读取，等读懂了再把下一行改成解构。',
        '写在赋值号左边的 { name: secondName } 表示取出 record 的 name 字段，在当前区块中把值放进 secondName。若省略冒号和值，写成 const { name } = record，变量名就与字段名相同。赋值右边的 { name: "齐悦" } 则是在创建对象，可以用它练习区分两种位置的花括号。',
        '先运行，对照两个姓名与不存在的字段。然后在 record 中补上 club: "阅读"，保留前两行输出，让最后一行输出「阅读」。这种缺字段的情况可进入后续的校验测试。',
      ],
      `const record = { name: "齐悦", minutes: 20 };
const firstName = record.name;
const { name: secondName } = record;
console.log(firstName);
console.log(secondName);
console.log(String(record.club));`,
      '齐悦\n齐悦\nundefined',
    ),
    javascript(
      '用三条记录追踪提前返回',
      [
        '校验函数每次只看一行。遇到数组、null 或其他类型时立刻返回 null，下面访问 name 的语句便不会执行。通过形状检查后，再判断字段的类型，保证 trim 只在字符串上运行。',
        '空字符串同时可以来自空白文本、空字段或禁止的输入。给读代码的人一条稳定约定更有帮助。本例用 null 表示无法取到合格姓名，成功时新建对象保存清理后的姓名。比较原记录和结果时，可以看到中间过程没有改写输入中的空白。',
        '运行后把第二行记录的姓名改成数字，观察第二项结果仍为 null。再试把姓名换成 " 林安 "，核对清理后是否出现「林安」。到了本章练习，可以沿用这个顺序，再检查分钟数字段。',
      ],
      `function cleanName(record) {
  if (record === null || typeof record !== "object" || Array.isArray(record)) return null;
  if (typeof record.name !== "string") return null;
  const name = record.name.trim();
  if (name === "") return null;
  return { name: name };
}

const first = { name: " 周青 " };
for (const row of [first, { name: "   " }, null]) {
  console.log(JSON.stringify(cleanName(row)));
}
console.log(JSON.stringify(first));`,
      '{"name":"周青"}\nnull\nnull\n{"name":" 周青 "}',
    ),
  ],
  'signup-map-filter': [
    javascript(
      '给同一组输入写出循环和回调两种形式',
      [
        '回调是交给另一个函数执行的函数。下方 stripName 本身只会处理一项；传给 map 时，map 按顺序逐项调用 stripName 并收集每次的返回值。注意传入的是名字 stripName，写 stripName() 就会立刻在这个位置调用它，map 收到的将是调用结果。',
        '先在纸上写下三行“原值、返回值”，其中数字与空白姓名都得到空串。逐项循环也能完成一样的工作：拿当前项，调用处理函数，push 到新数组。map 把这三步封装起来，因此保留输入与输出的位置对应。',
        '运行看两行结果是否一样。删除列表里的中间项，重新预测两行长度；再在最后加上同名项，观察 map 会保留两份结果。map 的职责只有逐项转换，筛掉结果要交给 filter。',
      ],
      `function stripName(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}
const raw = [" 齐悦 ", 4, "   "];
const byLoop = [];
for (const value of raw) byLoop.push(stripName(value));
console.log(JSON.stringify(byLoop));
console.log(JSON.stringify(raw.map(stripName)));`,
      '["齐悦","",""]\n["齐悦","",""]',
    ),
    javascript(
      '观察中间数组，再缩成一条数据流',
      [
        '本例有两步，每一步都由独立变量保存。转换产生的是用来展示的词，筛选决定是否继续保留这些词。照着行号看输出，可以区分“清理结果不对”和“筛选判断不对”两类错误。空列表经过两步还是空列表，可以用相同代码处理。',
        '箭头函数 name => name !== "" 是一个接收 name 并返回真假值的函数。若加大括号，写成 name => { return name !== ""; } 仍是同一规则。只有在使用语句块时才需要这个 return。',
        '先运行，核对首项的空串被删掉，两份「林安」都留下。再把 filter 回调中的判断改成 name === ""，看保留结果如何翻转。最后改回正常规则，尝试把 map 与 filter 写在一条表达式里，输出应与原来一致。',
      ],
      `const raw = ["   ", " 林安 ", " 周青", "林安"];
const normalized = raw.map(name => name.trim());
const names = normalized.filter(name => name !== "");
console.log(JSON.stringify(normalized));
console.log(JSON.stringify(names));`,
      '["","林安","周青","林安"]\n["林安","周青","林安"]',
    ),
  ],
  'signup-group-sort': [
    javascript(
      '逐个登记活动，观察 Map 何时出现新键',
      [
        '可以把 Map 看作一份按标签查找的账本。set(key, value) 往标签下写值，同一标签已有值时会替换。get(key) 读取值，找不到时会得到 undefined。本例每读一个活动编号都先查旧人数，再用加 1 的值写回。',
        '示例先用 if 明写“若还没有记录，就从 0 开始”。进阶代码常写 counts.get(id) ?? 0，意思是左侧为 null 或 undefined 时才用右侧的 0。这样初次与以后统计可以共用一行，已经记录为 0 的值也会照常保留。',
        '先运行，看第一次碰到 A 是 1 而第二次是 2。再加一个 A，预测最末行输出。然后把 if 的两行改成 const before = counts.get(id) ?? 0，检验行为是否相同。后面的分组练习可以复用这一步。',
      ],
      `const counts = new Map();
for (const id of ["A", "B", "A"]) {
  let before = counts.get(id);
  if (before === undefined) before = 0;
  counts.set(id, before + 1);
  console.log(id + "：" + counts.get(id));
}`,
      'A：1\nB：1\nA：2',
    ),
    javascript(
      '先手算三对比较，再交给 sort',
      [
        '先只看两条记录：左项 3 人、右项 1 人时，右减左得到 -2，所以左项应提前；交换输入会得到 +2，排序器会让右项提前；人数相同就不能靠减法决定顺序。这正是比较函数约定的负数、正数和零。',
        '本例把比较人数与比较编号写成三句 if。最后一句只在两个编号都相等时返回 0。用这套规则可让 B 和 A 的人数并列时仍稳定呈现 A 在前，也可以把它提取到多个报表中复用。',
        '运行后把 B 的人数改成 4，预测顺序变为 B、A、C。改回原值，把排序所用数组换成由 map 派生出来的数组，核对原始数据位置。最后接到本章的统计代码，分别验证计数结果和呈现顺序。',
      ],
      `function compare(left, right) {
  const countDifference = right.count - left.count;
  if (countDifference !== 0) return countDifference;
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}
const groups = [{ id: "B", count: 3 }, { id: "C", count: 1 }, { id: "A", count: 3 }];
console.log(compare(groups[0], groups[1]));
console.log(compare(groups[0], groups[2]));
console.log(groups.sort(compare).map(group => group.id).join("、"));`,
      '-2\n1\nA、B、C',
    ),
  ],
  'signup-functions-testing': [
    javascript(
      '用两个小函数区别合法与出现过',
      [
        '函数边界可以用一句话描述。idOf 只读取一条报名并给出合法编号，伸手去查全局名单会让它难以独立测试。isNew 则只处理已经清理好的编号，它通过 Set 的 has 看标记是否出现过；add 增加这个标记。',
        '本例把 Set 作为显式参数传给 isNew。每次开始一组新的数据时新建 Set，避免上次跑过的编号影响这次。无效编号在调用 isNew 前就直接跳过，不能先占用名额。',
        '运行并根据两条保留消息反推程序访问的顺序。再把第一行有效报名的编号改成空白，看第三行相同编号能否进名单。调试结课项目时，可以单独对 idOf 与 isNew 增加类似测试。',
      ],
      `function idOf(row) {
  if (!row || typeof row.id !== "string") return null;
  const id = row.id.trim();
  if (!id) return null;
  return id;
}

function isNew(seen, id) {
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
}

const seen = new Set();
for (const row of [{ id: "  " }, { id: " A01 " }, { id: "A01" }, { id: "B02" }]) {
  const id = idOf(row);
  if (id !== null && isNew(seen, id)) console.log("保留 " + id);
}`,
      '保留 A01\n保留 B02',
    ),
    javascript(
      '让一条失败消息指出错的是哪种规则',
      [
        '把三种情况写成三行用例。每行有名称、输入和预期，循环只负责运行同一个待测函数。对文本与 null，用 === 比较就够了；比较多个数组时需要逐项比或使用已知格式的 JSON 文本，不能直接用 === 判断内容。',
        '把结果区分成正常、边界与无效后，测试未通过时至少知道哪条约定失效。先看不通过的用例输入，再沿函数分支走一遍。若为了通过一条用例而改动校验条件，三条都要重跑，避免破坏其它路径。',
        '先让三条测试全通过。删除 trim 调用后，预测哪条会变成未通过。最后再加一条非空的数字文本「07」来核对编号仍然按字符串处理，前导零原样保存。',
        '如果报告中所有用例都失败，先检查是否改动了返回值的类型或结构。如果只在边界失败，则优先核对等号是否写在了规则允许的一侧。',
      ],
      `function cleanId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (id === "") return null;
  return id;
}
const cases = [
  { label: "清理首尾", input: " A01 ", expected: "A01" },
  { label: "最短编号", input: "B", expected: "B" },
  { label: "数字无效", input: 7, expected: null },
];
for (const test of cases) {
  const passed = cleanId(test.input) === test.expected;
  console.log(test.label + "：" + (passed ? "通过" : "未通过"));
}`,
      '清理首尾：通过\n最短编号：通过\n数字无效：通过',
    ),
  ],
  'record-representation': [
    javascript(
      '把能修改的说明和不变的编号分开',
      [
        '书架上的记号可以是一个字符串，例如 "0012" 对人和程序都是四个字符。转成数字只剩 12，前导零就丢了。本例把 ID 当标签比较，允许标签 "0012" 与 "12" 同时存在。用点号读取对象字段，每本藏书的编号、书名和册数都保存在独立字段中。',
        '书名是描述，可有两册重名。编号是标识，后续借阅记录只需要保存该编号。把这两个角色分开，就能在修正录入错别字或调整书架后继续找到原来那册书。若只保存书名，同名借阅记录会变得难以核对。',
        '运行后改第二册的书名，观察编号不变。再把第一个判断里的字符串 "0012" 改成 "12"，核对两个判断的输出开始出现差异。这个变化说明数据表示本身会影响查找结果。',
      ],
      `const first = { id: "0012", title: "星图" };
const second = { id: "12", title: "星图" };
console.log(first.title === second.title);
console.log(first.id === second.id);
console.log(Number(first.id) === Number(second.id));`,
      'true\nfalse\ntrue',
    ),
    javascript(
      '用一张状态表找出容易被合并的情况',
      [
        '开始写代码前先把输入分组。已知非负整数显示册数，null 表示尚待确认，其他值是无效数据。先看 0，虽然它在 if 中会当作假值，但在这个业务里它是可信的库存结果。用 if (!copies) 会模糊已有的 0 与缺失数据。',
        '示例先判断 null，再用 Number.isInteger 确定数据确实是整数。文字 "0" 看起来与数字 0 相同，却属于不同类型；若把它一并接受，就无法发现表单或数据文件未经转换。用大于等于 0 把下限写进代码。',
        '先手写 0、null、"0" 三种预期再运行。修改最后一项为 2.5 或 -1，都应落在无效分支；改成 1 则应给确定册数。本章练习会在这个判断外层再加入藏书编号。',
      ],
      `function copiesLabel(copies) {
  if (copies === null) return "待核对";
  if (Number.isInteger(copies) && copies >= 0) return copies + " 册";
  return "记录无效";
}
for (const value of [0, null, "0"]) console.log(copiesLabel(value));`,
      '0 册\n待核对\n记录无效',
    ),
  ],
  'ordered-catalog-index': [
    javascript(
      '先做可手算的索引，再对照程序生成的位置',
      [
        '索引是为查询另外制作的清单，每行要能指回原记录。本例先从原书目复制出 [书名键, 编号] 这对值。用 for…of 可以逐本走完，push 把每对值放到索引尾部。后面会使用 map 完成同一个逐项复制动作，两种写法都能保留原目录。',
        '比较左右两条索引时先读 [0]，也就是书名，再在书名相同时比较 [1] 的编号。比较函数返回 -1 表示左项在前、返回 1 表示右项在前，返回 0 表示这一对在排序规则上相等。这里用 A/B 两个代号，便于在纸上核对。',
        '先运行比较两份清单，原表的第一个编号仍为 03。再把 A 的两个 ID 对调，预测索引里的 A 仍按 01、02 出现。排序之后才运行二分，否则它每次排掉半区的推理不成立。',
      ],
      `const books = [{ key: "B", id: "03" }, { key: "A", id: "02" }, { key: "A", id: "01" }];
const index = [];
for (const book of books) index.push([book.key, book.id]);
function compare(left, right) {
  if (left[0] < right[0]) return -1;
  if (left[0] > right[0]) return 1;
  if (left[1] < right[1]) return -1;
  if (left[1] > right[1]) return 1;
  return 0;
}
index.sort(compare);
console.log(books.map(book => book.id).join(" "));
console.log(index.map(row => row.join(":")).join(" "));`,
      '03 02 01\nA:01 A:02 B:03',
    ),
    javascript(
      '逐轮写下左右端点怎样收缩',
      [
        '用 [lo, hi) 记录还需要检查的位置。在 [0, 4) 查找 B 的左端时先访问下标 2，发现键正好是 B，于是保留它作为候选边界并写 hi = 2。下轮访问下标 1，仍为 B，令 hi = 1。最后访问下标 0，A 小于 B，排除 0，lo = 1。',
        'while 检查 lo < hi 才继续，每轮都要严格缩小范围。两端相等后元素范围为空，但这个位置可作为插入或切片边界。图书目录查尽所有同名藏书需要两个边界，左端保留相等，右端遇到相等就越过。',
        '先对照每轮输出，再改 target 为 C，纸上预测插入点在 D 前。之后把条件 keys[mid] < target 改成 keys[mid] <= target，重新查 B，最后应为 3。用同一段循环对比两条规则。',
      ],
      `const keys = ["A", "B", "B", "D"];
const target = "B";
let lo = 0;
let hi = keys.length;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  console.log(lo + " " + mid + " " + hi);
  if (keys[mid] < target) lo = mid + 1;
  else hi = mid;
}
console.log("位置 " + lo);`,
      '0 2 4\n0 1 2\n0 0 1\n位置 1',
    ),
  ],
  'search-work-count': [
    javascript(
      '让一次比较对应计数器的一次变化',
      [
        '统计性能时先约定单位。本节记“读一个键并和目标比较一次”为一个单位，打印、读数组长度和下标递增等其它工作不混入计数。代码里 visits 在 if 比较之前加一，因此当场找到的这一轮仍计数。',
        '直接扫描用于找齐同名书时，命中也不提早结束；如果需求是找一本任意匹配书，才可以遇到第一项就 break。这两种查询的成本不同，比较时要使用相同的问题，否则一种方法做的工作更少，报告会失真。',
        '运行并核对两册同名书仍然访问了三条。把 target 改为「月图」，预测 visits 还是 3，但 ID 为空。再加入第四条同名记录，核对命中项目和比较次数各怎样增加。',
      ],
      `const rows = [{ title: "星图", id: "02" }, { title: "潮汐", id: "03" }, { title: "星图", id: "05" }];
const target = "星图";
let visits = 0;
const ids = [];
for (const row of rows) {
  visits += 1;
  if (row.title === target) ids.push(row.id);
}
console.log("比较 " + visits);
console.log("命中 " + ids.join(" "));`,
      '比较 3\n命中 02 05',
    ),
    javascript(
      '用同一张成本表找出什么时候值得建表',
      [
        '同一份书目反复查询时，一次性成本只付一次。若每次扫描 10 条，已有索引每次查 4 条，但建表要 15 次，首次线性成本为 10，首次索引成本为 19。累计到第二次是 20 对 23，到了第三次才变成 30 对 27。',
        '这个例子各次查询的成本相同，方便把规律算出来。真实目录的二分访问次数会随位置不同，整批成本要用每次实际次数相加。实验可以像本例一样累加，同时报告明确的计数口径，让另一位同学复算。',
        '先预测第 4 次总账再运行。将 build 改为 27，观察在哪一次索引的累计计数更小。项目里的建表与查找不使用这组固定数值，会从算法运行中统计各项。',
      ],
      `const build = 15;
const linearPerQuery = 10;
const indexPerQuery = 4;
let linearTotal = 0;
let indexTotal = build;
for (let query = 1; query <= 4; query += 1) {
  linearTotal += linearPerQuery;
  indexTotal += indexPerQuery;
  console.log(query + " 次：" + linearTotal + " / " + indexTotal);
}`,
      '1 次：10 / 19\n2 次：20 / 23\n3 次：30 / 27\n4 次：40 / 31',
    ),
  ],
  'lookup-edge-model': [
    javascript(
      '先验证查询，再决定是否读取目录',
      [
        '可以把检索函数分成两扇门。第一扇门检查用户有没有给合法书名，通过才进入目录。空文本、只有空白的文本及非文本都属于查询无效。第二扇门在合法目录中逐项判断命中，书架上没有，就报告未命中。',
        '给函数返回同一组字段让调用者更容易写提示。无效分支与未命中分支都会返回空 ids，但 status 不同。否则代码若只看 ids.length，便无法告诉用户是该补查找词还是该换词。',
        '把表中没有的「月图」加入目录再运行，对应行应转为 hit。然后把整张表换成 []，合法的「星图」也只会变成 miss，传入 null 仍报 invalid。核对两类失败有没有混淆。',
      ],
      `function classify(raw, titles) {
  if (typeof raw !== "string" || raw.trim() === "") return "invalid";
  for (const title of titles) {
    if (title === raw.trim()) return "hit";
  }
  return "miss";
}
const titles = ["星图"];
for (const target of [" 星图 ", "月图", " ", null]) console.log(classify(target, titles));`,
      'hit\nmiss\ninvalid\ninvalid',
    ),
    javascript(
      '设计三个会让错解暴露的测试',
      [
        '单一的命中用例无法区分“找一本”和“找全所有同名书”。放入两册同名书，核对 ID 数量与顺序，就能抓住遇到第一册便终止的错法。合法目标排在索引末尾以外时，用两次边界得到的切片应为空。',
        '为了复查结果，用状态和 ID 一起组成判定，不能只比较数量。例如两种失败都有零本书，但用户反馈不同。本例把测试名与结果同排打印，这也适合检查任意数据结构的查询接口。',
        '先运行，再在 findAll 的循环中找到匹配后加一个 break，观察只有多册查询的预期被破坏。理解这个失败后改回，进入本章练习，为三类状态都做出同形状的返回值。',
        '测试中的“末尾缺席”也可换成比首项更小的书名。两个位置在建好索引后分别对应索引终点和起点，但都表示目录未命中。',
      ],
      `function findAll(records, target) {
  if (typeof target !== "string" || target.trim() === "") return { status: "invalid", ids: [] };
  const ids = [];
  for (const record of records) {
    if (record.title === target.trim()) ids.push(record.id);
  }
  return { status: ids.length > 0 ? "hit" : "miss", ids: ids };
}
const books = [{ title: "星图", id: "B01" }, { title: "星图", id: "B03" }];
for (const [label, target] of [["多册", "星图"], ["末尾缺席", "西岸"], ["查询为空", " "]]) {
  const found = findAll(books, target);
  console.log(label + "：" + found.status + " / " + found.ids.join(","));
}`,
      '多册：hit / B01,B03\n末尾缺席：miss / \n查询为空：invalid /',
    ),
  ],
  'task-form-validation': [
    html(
      '让一张小表单真正接到提交事件',
      [
        '先在静态预览找出输入框、真实标签、提交按钮和反馈区域。标签用 for 指向输入框的 id，输入框的 name 为稍后读取表单值提供查找键。浏览器原本可能把表单提交为一次导航；监听器接到 submit 后调用 preventDefault，当前页面就能保留表单和反馈。',
        '下载这个独立文件，用浏览器打开。输入「读第 2 章」并回车，观察地址没有变化，反馈区域显示读到的值。清空标题，再用鼠标按按钮，两种操作触发同一段监听逻辑。站内预览用于核对界面结构，下载的页面可运行脚本和监听事件。',
        '在代码框里把 get("title") 改成 get("course")，下载后再试一次。表单的字段仍叫 title，读错名字就得到 null。把名字接回去，再自己添加分支：读取到的标题只含空白时显示「请填写标题」。',
      ],
      demoPage('先读取表单字段', `  <form id="note-form">
    <label for="title">任务标题</label>
    <input id="title" name="title">
    <button type="submit">提交</button>
  </form>
  <p id="feedback" role="status">等待提交</p>`, `    const form = document.querySelector("#note-form");
    const feedback = document.querySelector("#feedback");
    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(form);
      feedback.textContent = "读到：" + String(data.get("title"));
    });`),
      'form-submit-example.html',
    ),
    javascript(
      '从四种输入推导一条完整的标题规则',
      [
        '这一步只处理标题，先不改页面。输入可能来自表单或测试调用，我们先把字符串与其他类型分开。对字符串执行 trim 后才判断长度。例如「 阅读 」只有「阅读」两个字符，中间的空格则照常保留。',
        'JavaScript 的 length 对字符串计算 UTF-16 代码单元。展开成 [...title] 后，数组的每一项对应一个 Unicode 码点。「📚」这一项正好占两个代码单元，却只计一个码点。实际业务也可能选择其它计数方式，重要的是界面提示、函数与用例使用同一规则。',
        '把原例的上限 3 改为 2，预测应该有哪些输入仍通过，再运行查看。最后试一条只含空格的标题，确认它不会因为原始长度落在范围内而被错误接受。把这个只验证数据的函数移回表单后，先验证再修改任务数组。',
      ],
      `function checkTitle(raw, limit) {
  if (typeof raw !== "string") return "无效";
  const title = raw.trim();
  const length = [...title].length;
  if (length < 1 || length > limit) return "无效";
  return title;
}
for (const value of [" 读 📚 ", "整理计划", " ", 12]) console.log(checkTitle(value, 3));`,
      '读 📚\n无效\n无效\n无效',
    ),
  ],
  'data-driven-task-list': [
    javascript(
      '先把一条状态记录翻译成可读文字',
      [
        '一条记录告诉我们三件事：编号、标题与 done 状态。先写一个小函数，把状态转换成标签，再将标签和标题拼起来。这样语言措辞变更时，只需要调整显示规则，原始状态仍保持 true 或 false。',
        '状态与显示之间存在一对多关系。两条任务可能都翻译成相同标题，却仍要独立切换。遍历数组时使用 ID 区分不同任务，把已完成计数从 done 重新求出。这里先用数行输出核对数据，不依赖浏览器元素。',
        '运行核对完成数。把第二条改成已完成，观察总数如何变化。再把两个标题都改为同一个词，确认编号与状态仍能为每一条提供单独的反馈。',
      ],
      `function label(task) {
  const status = task.done ? "已完成" : "待完成";
  return task.id + "：" + task.title + "（" + status + "）";
}
const tasks = [{ id: 1, title: "读书", done: true }, { id: 2, title: "读书", done: false }];
let completed = 0;
for (const task of tasks) {
  console.log(label(task));
  if (task.done) completed += 1;
}
console.log("完成 " + completed + " 项");`,
      '1：读书（已完成）\n2：读书（待完成）\n完成 1 项',
    ),
    html(
      '亲手把任务文字接到列表',
      [
        '先预览列表位置，然后下载页面打开。这个例子准备两条记录，render 函数逐项创建 li。元素应先填好内容，再传给 replaceChildren，一次替换整个列表。这样每次点击切换状态时只会刷新两行，不会积累成四行、六行。',
        '试着填好代码里的 TODO，把 item.textContent 写成标题加状态。原来的标题「<读>」必须按普通文本显示。不要用 innerHTML 把输入变成 HTML 内容；textContent 用来写文字，正好与本题的输入含义一致。',
        '完成后下载你改过的 HTML，打开并按两次「切换第一项」。第一次状态改变，第二次应复原，任务列表始终有两行。如果状态变化但行数增加，回到 render 检查你选择的是替换还是追加。',
      ],
      taskListPage(true),
      'render-task-list.html',
      taskListPage(false),
    ),
  ],
  'task-filter-edit': [
    javascript(
      '把主表和筛选显示分两次打印',
      [
        '把筛选当作窗口。待完成窗口只看 done 为 false 的条目，切换窗口不会改写原来的资料。窗口内的序号只是它的显示位置，编辑器要把稳定编号带回主表。',
        '示例主表的下标 0 保存编号 1，但待完成窗口的第一行对应编号 2。若点“第一行编辑”便写回 tasks[0]，会误改编号 1。使用 task.id 作为更新条件，两个表的位置不必保持一致。',
        '先看两行结果，再改待编辑的编号为 1，预测哪些行会变化。隐藏记录应被正确更新，从待完成视图看不到改动是预期行为。试把编号改为 99，则两条都保持原标题。',
      ],
      `const tasks = [{ id: 1, title: "读文档", done: true }, { id: 2, title: "写笔记", done: false }];
const visible = tasks.filter(task => !task.done);
const editId = visible[0].id;
const updated = tasks.map(task => {
  if (task.id !== editId) return task;
  return { id: task.id, title: "补写笔记", done: task.done };
});
console.log("原表：" + tasks.map(task => task.title).join("、"));
console.log("更新：" + updated.map(task => task.title).join("、"));`,
      '原表：读文档、写笔记\n更新：读文档、补写笔记',
    ),
    html(
      '接上筛选控件并复查完整数组',
      [
        '这个页面里的 select 和 li 都已经建立。要让下拉菜单控制展示，只需读取选择值并按新模式重新渲染。这里 change 与 click 的职责不同，前者处理控件值已改变，后者适合显式按钮操作。',
        '下载页面，先从「全部」切到「待完成」，记录主表数字与列表行数。切回来应重新看到两条同名任务。这个试验能确认我们的筛选没有误写回 tasks。如果切回时记录丢失，检查是否把 tasks.filter 的结果赋给了 tasks。',
        '把 change 监听体中 render() 一行删掉再下载。原生控件仍能显示新的选项，列表却不会更新。恢复 render，让样例成为你能从头解释的一段 DOM 连接代码。',
        '渲染函数只读当前筛选条件和完整数据。以后给页面加“编辑”时，也可以在保存后调用同一个函数，让结果立即反映到当前视图。',
      ],
      demoPage('筛选任务但保留原表', `  <label for="mode">只看</label>
  <select id="mode"><option value="all">全部</option><option value="open">待完成</option></select>
  <p id="count" role="status"></p>
  <ul id="tasks"></ul>`, `    const tasks = [{ id: 1, title: "复习", done: true }, { id: 2, title: "复习", done: false }];
    const mode = document.querySelector("#mode");
    const count = document.querySelector("#count");
    const list = document.querySelector("#tasks");
    function render() {
      const visible = tasks.filter(task => mode.value === "all" || !task.done);
      const rows = visible.map(task => {
        const row = document.createElement("li");
        row.textContent = task.id + " " + task.title;
        return row;
      });
      list.replaceChildren(...rows);
      count.textContent = "显示 " + visible.length + " 项，共 " + tasks.length + " 项";
    }
    mode.addEventListener("change", () => {
      render();
    });
    render();`),
      'filter-task-list.html',
    ),
  ],
  'task-keyboard-feedback': [
    html(
      '从编辑按钮走一遍焦点来回',
      [
        '先 Tab 到「编辑标题」，再按 Enter。焦点应该跳到标题框，选中原标题以便修改。如果脚本只切换表单的可见性，键盘焦点可能还留在按钮上。调用 input.focus 后，下一次按键才会进入输入框。',
        '下载打开网页后，分别做两次编辑。第一次改成「复习函数」，按 Enter 保存，按钮重新获得焦点。第二次输入「不要保存」，按 Escape 退出，检查结果仍为「复习函数」。状态区域用文字区分保存和取消，方便在看不到样式变化时核对结果。',
        '接着把 finishEditing 里的 editButton.focus() 暂时去掉，下载重试。观察关闭输入区之后 Tab 的位置。恢复焦点返回这一行，然后试着输入空标题，给 submit 监听器添加一个有效性判断。',
      ],
      demoPage('用键盘编辑标题', `  <p id="saved">复习数组</p>
  <button id="edit" type="button">编辑标题</button>
  <form id="editor" hidden>
    <label for="title">标题</label>
    <input id="title" name="title">
    <button type="submit">保存</button>
  </form>
  <p id="status" role="status">等待操作</p>`, `    const editButton = document.querySelector("#edit");
    const saved = document.querySelector("#saved");
    const form = document.querySelector("#editor");
    const input = document.querySelector("#title");
    const status = document.querySelector("#status");

    editButton.addEventListener("click", () => {
      form.hidden = false;
      input.value = saved.textContent;
      input.focus();
      input.select();
    });
    function finishEditing(message) {
      form.hidden = true;
      status.textContent = message;
      editButton.focus();
    }
    form.addEventListener("submit", event => {
      event.preventDefault();
      saved.textContent = input.value.trim();
      finishEditing("已保存");
    });
    form.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishEditing("已取消");
      }
    });`),
      'restore-editor-focus.html',
    ),
    javascript(
      '只对编辑中的 Escape 接手',
      [
        '页面上同一个键可能触发不同动作。原生表单会响应回车，也会按 Tab 的自然顺序前进。自写键盘监听时先确立“接手条件”，仅在当前有编辑动作且收到 Escape 时取消编辑，其它按键继续默认行为。',
        '把按键判断留在小函数中，可以在没有 DOM 的环境测试不同状态。这里的函数只报告应做哪件事。真正的取消、焦点返回和提示文字由界面代码完成，两边容易分开调试。不要把 event.preventDefault 放在每一个 keydown 中，否则可能阻止默认聚焦。',
        '运行并核对 Tab 两次都继续交给浏览器。将某个 Escape 的编辑状态从 true 改成 false，应变成「保留默认行为」。这个思想可延伸到关闭菜单或结束对话框，但每个控件只处理属于自己的活动状态。',
      ],
      `function keyboardAction(key, isEditing) {
  if (key === "Escape" && isEditing) return "取消编辑";
  return "保留默认行为";
}
for (const isEditing of [true, false]) {
  for (const key of ["Escape", "Tab"]) {
    console.log(key + "：" + keyboardAction(key, isEditing));
  }
}`,
      'Escape：取消编辑\nTab：保留默认行为\nEscape：保留默认行为\nTab：保留默认行为',
    ),
  ],
}

function taskListPage(showStatus: boolean) {
  return demoPage('任务数据生成列表', `  <button id="toggle" type="button">切换第一项</button>
  <ul id="list"></ul>`, `    const tasks = [{ title: "<读>", done: false }, { title: "写笔记", done: true }];
    const list = document.querySelector("#list");
    function render() {
      const rows = [];
      for (const task of tasks) {
        const item = document.createElement("li");
        ${showStatus ? 'item.textContent = task.title + (task.done ? "（已完成）" : "（待完成）");' : '// TODO 把标题和完成状态写进 item.textContent。\n        item.textContent = task.title;'}
        rows.push(item);
      }
      list.replaceChildren(...rows);
    }
    document.querySelector("#toggle").addEventListener("click", () => {
      tasks[0].done = !tasks[0].done;
      render();
    });
    render();`)
}

export const foundationWebWorkshops: Record<string, Record<string, LessonSection[]>> = {
  'lv-javascript-foundations': {
    variables: [
      javascript(
        '动手分辨看起来一样的数字和文字',
        [
          '下方一个值来自文本框，另一个值是已经知道的数字。typeof 会报告值的类型，String 用相同的方式把它们转为文字展示。当表达式里参与相加的一方是字符串时，JavaScript 会把它当作拼接；先用 Number 转换，才能让两个数真正相加。',
          '运行后将输入改为有三个空格的 "   "，观察 Number 会得到 0。后面的条件章会把“是否填了文字”和“能否转成数字”分成两个检查。再将它改成 " 不足 "，查看为什么单靠输出外观很难查错。',
        ],
        `const input = " 5 ";
const known = 3;
const amount = Number(input.trim());
console.log(typeof input);
console.log(typeof known);
console.log("合计 " + (known + amount));`,
        'string\nnumber\n合计 8',
      ),
    ],
    conditions: [
      javascript(
        '先排除缺值，再判断数值所在区间',
        [
          '条件多时，一行塞下所有判断不容易看出失败原因。先判断数值是否正当，再去判断它所在的区间。!Number.isInteger(amount) 会在 amount 不是整数数字时成立。第一个分支先排除无效输入，这些值随后不再进入其它分支。',
          '先用原来的数值 20 运行。再逐次把它改为 19、-1 和文字 "20"，核对三条结果能区分什么。最后改回数值 20，把 amount < 20 试改成 amount <= 20，直接观察紧贴判断线的输入落入了哪个分支。',
        ],
        `const amount = 20;
if (!Number.isInteger(amount) || amount < 0) {
  console.log("无效");
} else if (amount < 20) {
  console.log("未达标");
} else {
  console.log("达标");
}`,
        '达标',
      ),
    ],
    arrays: [
      javascript(
        '用 for 指明从哪里开始、何时继续、怎样推进',
        [
          'for (let i = 0; i < minutes.length; i += 1) 的三部分分别做一件事。第一部分只执行一次，把 i 设成 0。每轮开始前检查第二部分，让 i 最大只到 length - 1。第三部分等循环体执行完再把 i 增加 1。用原下标取值，在需要看相邻位置时尤其常用。',
          '运行后用纸记录每一轮 i 的值，说明为什么打印 0、1、2 后停止。尝试把检查改为 i <= minutes.length，最后一项读到 undefined。改回来，再试空数组，程序应直接结束循环。',
        ],
        `const minutes = [30, 10, 20];
for (let i = 0; i < minutes.length; i += 1) {
  console.log(i + "：" + minutes[i]);
}`,
        '0：30\n1：10\n2：20',
      ),
      javascript(
        '用 while 表达“直到找到为止”',
        [
          'while 每次先检查括号里的条件，再进入循环体。想找第一个达标项时，条件里既要检查下标还在范围内，也要检查当前位置仍不达标。JavaScript 先看 && 左边，若已经到数组末尾，就不会继续读取右边的值。',
          '运行后把门槛改为 30，预测查找终止时 index 等于列表长度。不要在循环体里漏掉 index += 1，否则条件一直判断同一个位置。for 适合固定地走过所有位置，while 适合突出“满足这个条件才继续”。',
        ],
        `const minutes = [10, 14, 25, 18];
const minimum = 20;
let index = 0;
while (index < minutes.length && minutes[index] < minimum) {
  index += 1;
}
if (index === minutes.length) console.log("没有达标项");
else console.log("首个达标项：" + minutes[index]);`,
        '首个达标项：25',
      ),
      javascript(
        '同一个判断，根据需要问有没有、找第一项或留下所有',
        [
          '把判断写成 hasReadEnough 可以交给不同数组方法。some 只问是否有任意一项符合，得到布尔值；find 返回第一项，找不到返回 undefined；filter 返回全部符合的项，新数组仍保持先后顺序。map 则会为每一项计算新值，可接在 filter 后转换成显示文字。',
          '先运行定位三种返回值。将达标线改为 31，然后推断为什么 some 得 false、find 得 undefined、filter 却得到一个正常的空数组。数组里同时有两条 30 分钟也不要自行去重，是否去重由题意单独决定。',
        ],
        `const minutes = [30, 10, 20, 30];
function hasReadEnough(value) {
  return value >= 20;
}
console.log(String(minutes.some(hasReadEnough)));
console.log(String(minutes.find(hasReadEnough)));
console.log(minutes.filter(hasReadEnough).map(value => value + " 分钟").join("、"));`,
        'true\n30\n30 分钟、20 分钟、30 分钟',
      ),
      javascript(
        '把累加循环翻译成 reduce，再数一遍',
        [
          '先看熟悉的写法，把总和设成 0，再加上每条时间。reduce 用回调逐步得到下一个总和。回调先收到累加值 subtotal，再收到当前元素 value。末尾的 0 是第一次使用的累加值，列表为空时会直接得到这个 0。',
          '运行后把列表改成空数组，确认两种合计都是 0。再换成 ["10", 2] 看看为什么相加变成字符串拼接。输入未经校验时，先筛出数字，再求和。刚开始读代码时也可以保留容易逐行核对的 for…of 写法。',
        ],
        `const minutes = [12, 18, 5];
let loopTotal = 0;
for (const value of minutes) loopTotal += value;
const reducedTotal = minutes.reduce((subtotal, value) => subtotal + value, 0);
console.log(loopTotal);
console.log(reducedTotal);`,
        '35\n35',
      ),
      javascript(
        '用比较函数给数字副本排序',
        [
          'sort 可以接收一个比较函数。它一次拿到两个值 a 和 b，返回负数会把 a 放在 b 前面，返回正数会把 b 放在 a 前面。顺序不受两项当前下标影响。与该约定配合，a - b 排升序，b - a 排降序。',
          'sort 会修改数组本身。数组前的 [...minutes] 指把原来的元素排进一个新数组，然后再排序这份副本。先运行两行结果，再把 compare 写成 return b - a，看看哪一行改变。去掉副本也试一次，核对原数组如何被改写。',
        ],
        `const minutes = [30, 7, 20, 5];
function compare(a, b) {
  return a - b;
}
const ranked = [...minutes].sort(compare);
console.log(minutes.join("、"));
console.log(ranked.join("、"));`,
        '30、7、20、5\n5、7、20、30',
      ),
    ],
    functions: [
      javascript(
        '创建对象、读字段，再重建一份记录',
        [
          '把数据按名字放进 { … }，调用者就能用点号读出相应字段。对象字段可以是数值、文本和布尔值。即便用 const 给对象起名字，仍可用 original.done = true 修改这个对象中的字段。const 保证变量名字不会改指另一份对象，字段仍由对象本身管理。',
          '有时要保留原始输入，可以新建 { ...original, done: true }。展开先将原对象的第一层字段复制过来，再用后面的 done 覆盖副本。const { title } = updated 则把 updated.title 拿出来并声明为同名变量。',
          '把展开语句改成 const updated = original，另写 updated.done = true。运行看看为什么原始记录也变了。再恢复到展开副本的形式。这个区别会在报名校验和 Web 列表编辑中用到。',
        ],
        `const original = { id: "A01", title: "读例子", done: false };
const updated = { ...original, done: true };
const { title } = updated;
console.log(original.title);
console.log(title);
console.log(String(original.done));
console.log(String(updated.done));`,
        '读例子\n读例子\nfalse\ntrue',
      ),
      javascript(
        '用 Set 找重复、用 Map 找到累计值',
        [
          '数组按位置读取，Set 用 has 判断值是否已经收录，重复 add 不产生新条目。Map 把一个值与一个键配对：这里活动编号是键，报名人数是值。Map 中找不到键时返回 undefined，本例用 ?? 0 从零开始计数。',
          '下方先把每条编号放进 Set，得到不同活动的数量；再把每条输入都计入 Map，得到 A 的次数。如果任务要求每人只计一次，应该先用 Set 检查报名编号再让 Map 按活动加一。想清某个值是“分组键”还是“去重键”。',
        ],
        `const events = ["B", "A", "A"];
const unique = new Set();
const counts = new Map();
for (const event of events) {
  unique.add(event);
  counts.set(event, (counts.get(event) ?? 0) + 1);
}
console.log("不同活动：" + unique.size);
console.log("A 的报名数：" + counts.get("A"));`,
        '不同活动：2\nA 的报名数：2',
      ),
      javascript(
        '把 JSON 文字转成值并处理解析错误',
        [
          'JSON 用文字保存常见的数据类型。JSON.stringify(task) 把对象变成文字，可以打印或保存。JSON.parse(text) 把合规的文字读回 JS 值。对象的字段在 JSON 里要有双引号，末尾不能多一个逗号。解析出来还可能不是对象，例如 "[]" 会得到数组。',
          'try 里放可能失败的解析语句。语法无效时 parse 会抛出异常，程序转到 catch，给出字段之外的格式提示。解析成功后如需使用 parsed.title，还要核对形状和类型。试着把第三个样例改成 "null"，看看能否识别这也是合法 JSON 的文字。',
        ],
        `const saved = JSON.stringify({ title: "复习" });
for (const input of [saved, '{"title":}', "[]"]) {
  try {
    const parsed = JSON.parse(input);
    console.log(JSON.stringify(parsed));
  } catch {
    console.log("JSON 格式错误");
  }
}`,
        '{"title":"复习"}\nJSON 格式错误\n[]',
      ),
    ],
  },
  'lv-web-foundations': {
    'html-structure': [
      html(
        '在预览里核对标题、说明和步骤',
        [
          '浏览器会按页面中的顺序展示内容。先放整个页面的主标题 h1，再把“今天的计划”和“复习顺序”写成 h2。步骤顺序有意义时用 ol，便于用户知道第几步该做什么。',
          '先在站内静态预览核对最初的两步，再增加一个 li，让第三步成为「记下疑问」。标题和清单应由正确元素提供含义，视觉改动留给 CSS。把 ol 暂时改为 ul，比较标记的变化。',
        ],
        demoPage('复习安排', `  <main>
    <h2>今天的计划</h2><p>先看示例，再亲自运行。</p>
    <h2>复习顺序</h2>
    <ol><li>读示例</li><li>运行代码</li></ol>
  </main>`, ''),
        'review-outline.html',
      ),
    ],
    'css-style': [
      html(
        '让卡片在空间不足时换行',
        [
          '先运行静态预览。父容器打开 flex 排列，并启用 flex-wrap，容器不足以容纳两项时，下一项便落到后面一行。gap 定义项目间隔，border-box 让宽度包含内边距。不要靠增加临时空格去对齐。',
          '把父容器的 width 由 18rem 改为 12rem，核对第二个项目是否换行。再把 flex-wrap 注释掉，比较两个长标题在同一行时的表现。这个例子只用静态 HTML 和 CSS，修改后可以直接点预览。',
        ],
        demoPage('两张复习卡片', `  <style>
    .cards { display: flex; flex-wrap: wrap; gap: .75rem; width: 18rem; max-width: 100%; padding: 0; }
    .card { box-sizing: border-box; flex: 0 0 7rem; border: 1px solid; padding: .5rem; list-style: none; }
  </style>
  <ul class="cards"><li class="card">阅读示例</li><li class="card">整理笔记</li></ul>`, ''),
        'review-card-layout.html',
      ),
    ],
    'links-and-forms': [
      html(
        '给字段加上说明和有效范围',
        [
          '下面的数字输入框要求填写 1 到 90 的整数。选中标签或用 Tab 找到输入框，再输入几种相邻的数值。点击同页链接应跳到规则说明；它的 href 有 #，对应元素的 id 却不带井号。',
          '站内预览允许填写和查看页面结构，表单导航需要下载页面后测试。下载打开，分别提交空值、1、90 和 91，观察哪些会被浏览器阻止，成功时地址的查询部分应出现 minutes 字段。修改 name 后再提交，核对地址上的键名变化。',
        ],
        demoPage('学习时长表单', `  <p><a href="#rules">查看约束</a></p>
  <form method="get">
    <label for="minutes">学习分钟</label>
    <input id="minutes" name="minutes" type="number" min="1" max="90" step="1" required>
    <button type="submit">提交</button>
  </form>
  <h2 id="rules">约束</h2>
  <p>分钟须为 1 到 90 的整数。</p>`, ''),
        'minutes-form.html',
      ),
    ],
    'browser-interaction': [
      html(
        '把一次点击连接到页面状态',
        [
          '页面中先有按钮和状态文字，再出现脚本。querySelector 找到按钮，addEventListener 将点击连到一个函数。点击发生时让 count 增加 1，随后统一用 render 更新提示。按下键盘 Enter 与点击同一个原生按钮，都会触发 click。',
          '在站内预览先找按钮和状态区，然后下载完整文件打开。用 Tab 和 Enter 增加一次，再用鼠标点一次，核对数字从 0 到 1 再到 2。接着在页面里添加一个「重置」按钮，选择它并绑定监听器，将 count 设回 0，最后记得调用 render。',
        ],
        demoPage('复习计数', `  <button id="plus" type="button">多读一页</button>
  <p id="progress" role="status">读了 0 页</p>`, `    let count = 0;
    const button = document.querySelector("#plus");
    const progress = document.querySelector("#progress");
    function render() {
      progress.textContent = "读了 " + count + " 页";
    }
    button.addEventListener("click", () => {
      count += 1;
      render();
    });`),
        'review-click-example.html',
      ),
    ],
  },
}
