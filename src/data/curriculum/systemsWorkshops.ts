import type { LessonSection } from '../workspaceCourses'

type Workshop = [first: LessonSection, followUp: LessonSection]

function worked(heading: string, paragraphs: string[], code: string, expectedOutput: string, language: 'javascript' | 'sql' = 'javascript'): LessonSection {
  return {
    heading,
    paragraphs,
    code,
    codeLanguage: language === 'sql' ? 'SQLite · 独立运行' : 'JavaScript · 独立运行',
    run: { language, expectedOutput },
  }
}

export const systemsWorkshops = {
  'backend-routing-contracts': [
    worked('拿三张请求卡片走一遍路线', [
      '先在纸上画两列，左边写路径，右边写这个路径允许的方法。/sessions 对应 GET 和 POST，/sessions/s2 只对应 GET。查 POST /sessions/s2 时，第一列能找到，第二列找不到，所以处理函数不用查询存储，直接回 405。两列都找到才继续判断记录是否存在。这样很容易解释为什么 GET /sessions/s9 可能是 404，而 POST 同一个路径可能先得到 405。',
      '数组中的每个小对象用花括号写。route.method 取出名为 method 的字段，route.path 取出路径。for…of 一次取一条规则，遇到匹配时 return 把结果交回给调用者，后面的循环自然结束。先运行两次调用，再把第一行的 GET 改为 POST，预期从 list 变成 create。',
    ], `const routes = [
  { method: 'GET', path: '/sessions', target: 'list' },
  { method: 'POST', path: '/sessions', target: 'create' },
];
function routeTo(method, path) {
  for (const route of routes) {
    if (route.method === method && route.path === path) return route.target;
  }
  return '没有匹配规则';
}
console.log(routeTo('GET', '/sessions'));
console.log(routeTo('DELETE', '/sessions'));`, 'list\n没有匹配规则'),
    worked('先写清输入契约，再把碎片接起来', [
      'GET 筛选与 POST 正文来自不同位置。课程筛选在 ?course=web 中，JSON 正文则可能是字符串 {"courseId":"web"}。本节练习只需处理 GET 的筛选，把 get 的结果分别记成省略、无效、提供了课程三个状态。这里约定只输入空格也算空筛选，因此先检查 null，再用 trim 去掉两侧空白。如果顺序写反，省略参数时会在 null 上调用方法并报错。',
      '调试时把请求的 method、pathname、筛选状态并排写下来。修改第三个输入为 /sessions?course=%20%20，URL 会把编码转换成两个空格，trim 后得到空字符串。它与不带筛选的第一个输入应走不同分支。正式接口可再检查 course 是否属于已知目录；这步可以等路径、方法和参数有无都判断清楚后再加。',
    ], `function courseFilter(target) {
  const value = new URL(target, 'https://learnverse.example').searchParams.get('course');
  if (value === null) return '使用全部课程';
  if (value.trim() === '') return '400 空筛选';
  return '筛选 ' + value.trim();
}
for (const target of ['/sessions', '/sessions?course=', '/sessions?course=web']) {
  console.log(courseFilter(target));
}`, '使用全部课程\n400 空筛选\n筛选 web'),
  ],

  'backend-joins-reporting': [
    worked('让一张小表先回答三个问题', [
      '初次写 SQL 可以按这三个问题读查询。从哪张表取行决定 FROM，想保留哪些行决定 WHERE，每行要看哪些列决定 SELECT。最后再用 ORDER BY 指定顺序。例中 FROM 盘点三条记录，WHERE 留下分钟数至少 20 的 s2、s3，SELECT 展示 id 和 minutes，ORDER BY 从分钟数大到小排列。',
      '把 WHERE 的 20 改成 30，s3 的 25 会被排除。把 >= 改成 >，恰好 30 的 s2 也被排除。等号是否包含边界应该跟业务写法一致。若两个时长相同，第二个排序条件 id 会决定它们的顺序。这里用一张表来练列、行和顺序，再接上课程表。',
    ], `CREATE TABLE sessions(id TEXT PRIMARY KEY, minutes INTEGER);
INSERT INTO sessions VALUES ('s1', 15), ('s2', 30), ('s3', 25);
SELECT id, minutes FROM sessions
WHERE minutes >= 20
ORDER BY minutes DESC, id;`, 'id\tminutes\ns2\t30\ns3\t25', 'sql'),
    worked('展开左连接，逐行圈出哪些会参与计数', [
      '先暂时去掉 GROUP BY，只看这次连接产生了哪些行。courses 里有 web 和 js。在连接条件里，SQL 会尝试给每门课寻找 sessions.course_id 相等的记录。web 找到 s1 和 s2，因此出现两行。js 没找到，相当于留了一行空的右侧格。待会汇总时 COUNT(s.id) 会跳过这格，但 js 仍占报表一行。',
      '试一下把 LEFT JOIN 改为 INNER JOIN，js 这一行就会消失。再把 LEFT JOIN 改回去，在 sessions 的 INSERT 中为 js 加一笔 s3，留意右边从 NULL 变为可见记录。下一步再对同一 id 的行分组，就能把两条 Web 记录合成一个总数。',
      '若题目要求保留空课，先用这份明细检查剩余行。一旦明细就没有 js，给 SUM 加 COALESCE 也补不回行，因为 COALESCE 只能处理已经存在的一行中的空字段。',
    ], `CREATE TABLE courses(id TEXT PRIMARY KEY);
CREATE TABLE sessions(id TEXT PRIMARY KEY, course_id TEXT);
INSERT INTO courses VALUES ('web'), ('js');
INSERT INTO sessions VALUES ('s1', 'web'), ('s2', 'web');
SELECT c.id AS course, s.id AS session FROM courses AS c
LEFT JOIN sessions AS s ON s.course_id = c.id
ORDER BY c.id, s.id;`, 'course\tsession\njs\tNULL\nweb\ts1\nweb\ts2', 'sql'),
  ],

  'backend-transaction-safety': [
    worked('把一笔操作的活动记录与凭条写出来', [
      '从一张状态表开始。执行前两张表各有 r1。创建 r2 这个动作执行完毕后，预期看到预约 r1、r2 和凭条 r1、r2。若创建执行了一半，就列出数据库里此时能看到哪些数据，再问调用方能否把它当作成功。事务让你把“整件事成功”定义在可验证的边界上。',
      '照着例子读四条命令。BEGIN 开始记本次改动，两个 INSERT 分别写预约和凭条，COMMIT 才确认它们。最后的查询在事务后执行，按 id 对照两表。先用 r2 跑通，再尝试在一个新的事务中插入 r3 行；如果也要承认这笔新预约，凭条必须跟着一起写。真实业务的创建审核可以在事务中核对约束，示例只用两张很短的表演示写入顺序。',
    ], `CREATE TABLE reservations(id TEXT PRIMARY KEY);
CREATE TABLE receipts(id TEXT PRIMARY KEY);
INSERT INTO reservations VALUES ('r1');
INSERT INTO receipts VALUES ('r1');
BEGIN;
INSERT INTO reservations VALUES ('r2');
INSERT INTO receipts VALUES ('r2');
COMMIT;
SELECT id FROM reservations ORDER BY id;
SELECT id FROM receipts ORDER BY id;`, 'id\nr1\nr2\n\nid\nr1\nr2', 'sql'),
    worked('在写完第一张表时暂停并观察回滚', [
      '这一回先保留一条已确认的起始记录。新事务写入 r3 后模拟凭条无法写入。事务内部的 SELECT 看得到 r3，说明第一步确实做过。ROLLBACK 结束事务后，第二次 SELECT 只找到 r1，能验证中途写出的记录已撤回。旧的 r1 是事务开启前建立的，仍然保留。',
      '试着在 BEGIN 和 ROLLBACK 之间更新 r1 的状态，在最后再查看状态。回滚会撤销同一事务里的新增和修改。实际 SQLite 出错时要用调用库处理错误并按事务约定执行回滚。有些语句错误只中止当前语句，应用仍需处理事务；这里通过模拟故障保持演练可重复。先核对表的内容，再检查外层响应是否应该显示成功。',
    ], `CREATE TABLE reservations(id TEXT PRIMARY KEY);
INSERT INTO reservations VALUES ('r1');
BEGIN;
INSERT INTO reservations VALUES ('r3');
SELECT id AS inside_tx FROM reservations ORDER BY id;
ROLLBACK;
SELECT id AS after_tx FROM reservations ORDER BY id;`, 'inside_tx\nr1\nr3\n\nafter_tx\nr1', 'sql'),
  ],

  'backend-request-storage': [
    worked('在一份最小数据上走完创建和回读', [
      '程序中的 rows 只是一个数组，拿来扮演存储。create 把记录放进传入的数组，再返回该条的 ID。read 按这个 ID 遍历同一个数组。两个函数之间传递的不是显示文字，而是之后能稳定定位记录的编号。示例先完成最基本的成功路径，再拿一个不存在的编号查看 404。',
      '试运行后，将 read 的第一个实参改成 []，会得到 404。这个变化复现了常见联调错误：创建写在一份存储里，查询却读另一份。接入真正的数据库时，可以把“寻找同一个 ID”保留下来，只替换存储函数内部。这里先用固定 ID 方便跟踪；有多笔请求时还要落实不重复的分配规则。',
    ], `function create(rows, minutes) {
  rows.push({ id: 's2', minutes });
  return { status: 201, id: 's2' };
}
function read(rows, id) {
  for (const row of rows) {
    if (row.id === id) return '200 ' + row.minutes;
  }
  return '404';
}
const rows = [{ id: 's1', minutes: 10 }];
const result = create(rows, 25);
console.log(result.status, result.id);
console.log(read(rows, result.id));
console.log(read(rows, 'missing'));`, '201 s2\n200 25\n404'),
    worked('给失败用例保存一张执行前快照', [
      '准备、执行、验证是测试的三个步骤。准备时建好固定旧记录，再用 JSON.stringify 生成一份文字快照。数组和普通对象变成 JSON 文本后，后面修改数组不会改掉已经保存的文字。执行时把测试值交给 tryWrite。验证时分别检查状态码、记录条数和旧数据是否原样留下。',
      '本例只写三条边界记录来分清类型和范围。数字 1 应成功，但字符串 "1" 虽然看起来一样，应走 400。自己加一条 1441，并在运行前写下应看到的三列。也可给拒绝支路临时加一行 rows[0].minutes = 1，观察长度仍为 1 时快照已经不相同。实际接口上下游用相同的契约能避免客户端靠猜来决定重试。',
    ], `function tryWrite(rows, minutes) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return 400;
  rows.push({ id: 's2', minutes });
  return 201;
}
for (const input of [0, 1, '1']) {
  const rows = [{ id: 's1', minutes: 25 }];
  const before = JSON.stringify(rows);
  const status = tryWrite(rows, input);
  console.log(status, rows.length, JSON.stringify(rows) === before);
}`, '400 1 true\n201 2 false\n400 1 true'),
  ],

  'ai-chunk-records': [
    worked('先从两行文本找原始证据', [
      '假设有两条登记行。第一条含有 N1、已完成和 20 分钟，第二条属于 N2。问「N1 做了多久」时，第一条整行给出结论所需的范围、状态与时间。若将 N1 与分钟数字拆到两个没有联系的片段，检索虽然可能找到 20，却缺少核对这一数字的范围信息。先保证每条证据有足够的信息，再决定片段该多长。',
      '原始资料中的换行是分隔符。JavaScript 用 split 把一段文本拆成数组，数组按原来的行次序保存。for…of 取出一行，trim 去掉行首尾的空白。if 条件发现是空行便 continue 跳过；下一轮继续处理下一行。先运行并数出两行，再在中间加一个只有空格的行，仍应保留两条。',
    ], String.raw`const source = 'R1|N1 已完成 20 分钟\n\n R2|N2 已完成 25 分钟 ';
const lines = source.split('\n');
for (const original of lines) {
  const line = original.trim();
  if (line === '') continue;
  console.log(line);
}`, 'R1|N1 已完成 20 分钟\nR2|N2 已完成 25 分钟'),
    worked('把编号与文字放进同一个片段对象', [
      '用第一个竖线的位置划定边界。indexOf 给出某个符号首次出现的下标，找不到时返回 -1。slice 的开始位置包含在结果中，结束位置排除。要读编号，就从 0 取到竖线之前。要读正文，就从竖线之后取到末尾。这样正文里即使还有一个竖线，也会原样保留。',
      '组装对象时，把 id 和 text 放在一个对象中。对象是一组有名字的字段，后续可以直接用 chunk.id 打印来源，用 chunk.text 计算匹配。把本例的第二条正文末尾加上「|室内」，观察只改变正文。把最后一条换成没有分隔符的文字，会得到一条无法索引的提示。正式练习只给格式正确的有效记录，这个额外检查帮助定位实际资料里常见的录入错误。',
    ], String.raw`const lines = ['R1|N1 已完成 20 分钟', 'R2|布置|室内', '缺编号的文字'];
for (const line of lines) {
  const splitAt = line.indexOf('|');
  if (splitAt < 1) {
    console.log('跳过无法索引的行');
    continue;
  }
  const chunk = { id: line.slice(0, splitAt), text: line.slice(splitAt + 1) };
  console.log(chunk.id, chunk.text);
}`, 'R1 N1 已完成 20 分钟\nR2 布置|室内\n跳过无法索引的行'),
  ],

  'ai-keyword-retrieval': [
    worked('先手算一条记录的标签分数', [
      '把查询词写在纸的左侧，把某条记录的标签写在右侧。查询 N1、讲解时，标签为 N1、讲解的 R1 得 2 分；标签为 N2、讲解的 R2 得 1 分。相同查询词出现两次时仍只圈一次。标签按完整词匹配，比如 N1 与 N10 分别代表不同场次。先把单条记录的算分步骤写清楚，再把这套方法套到每条记录。',
      '例中 includes 用来检查数组里有没有同一个标签。scanned 保存本轮已经处理的词，遇到重复便跳过。学过 Set 可以直接在循环外去重，这份短例使用数组，方便核对每一步。把标签中的讲解换成场外，预期匹配项目会减少一项。把查询全换成地图，应得到 0 分。',
    ], `const tags = ['N1', '讲解'];
const query = ['讲解', '讲解', 'N1'];
const scanned = [];
let score = 0;
for (const word of query) {
  if (scanned.includes(word)) continue;
  scanned.push(word);
  if (tags.includes(word)) score += 1;
}
console.log('R1 得分', score);`, 'R1 得分 2'),
    worked('从有分数的明细收窄到候选列表', [
      '当每条记录都有分数时，可以把它们写成带 id 和 score 的对象。先 filter 留下分数大于 0 的对象，sort 的比较函数接收两个对象，返回 right.score - left.score 时高分对象排前面。两分相同就返回 0，保留输入顺序。最后从下标 0 开始取前两条，用 map 把整条对象换成可以展示的 ID。',
      '初学时也可以先把这四步各做一次打印。先检查过滤后是否还有 0 分，再检查排序结果，最后检查截断边界。改 limit 为 1 会丢失并列的第二条；改为 4 时仍只返回两条正分记录。实际问答需要证据完整时，要单独测“候选上限太低导致缺项”的情况，不只看第一条是否合理。',
      '给排序准备一份反例：让 R3 得 3 分，再把它移到数组末尾。预期它仍进入第一位，因为规则先看分数。这个反例能区分按输入顺序挑选和真正使用比较函数。',
    ], `const scored = [{ id: 'R1', score: 2 }, { id: 'R2', score: 0 }, { id: 'R3', score: 2 }];
const positive = scored.filter(row => row.score > 0);
const ranked = positive.sort((left, right) => right.score - left.score);
const limit = 2;
const ids = ranked.slice(0, limit).map(row => row.id);
console.log(ids.join(','));`, 'R1,R3'),
  ],

  'ai-check-evidence': [
    worked('用三张记录卡先圈出允许引用的编号', [
      '出一道核算题之前，先制定同一套范围规则。本题会用到站点 site 和是否已完成 done。R1 和 R2 属于 N1 且已完成，R3 属于 N2。把这三个编号一行一个写下来，再逐条判断是否同时满足两个条件。R3 就算有分钟数也不用计算。这个小练习先得到证据范围，之后才看输出是否引用了完整的信息。',
      '将条件写成两个 if 可减少读长表达式的负担。先跳过 site 不是 N1 的记录，再跳过未完成的记录。由于每次处理的是一份独立对象，两次判断都通过后，把 record.id 加入列表。试把 R2 的 done 改成 false，只应保留 R1。把 R3 改为 N1 且保持已完成，输出就会增加 R3。',
    ], `const records = [
  { id: 'R1', site: 'N1', done: true },
  { id: 'R2', site: 'N1', done: true },
  { id: 'R3', site: 'N2', done: true },
];
const expectedIds = [];
for (const record of records) {
  if (record.site !== 'N1') continue;
  if (!record.done) continue;
  expectedIds.push(record.id);
}
console.log(expectedIds.join(','));`, 'R1,R2'),
    worked('引用顺序可以不同，缺项和重复仍需发现', [
      '输出的 refs 是一列来源编号。原始资料按 R1、R2 排列，而回答中先说 R2 后说 R1。这两种顺序都引用了同一批资料。为了查重复，可以把 refs 交给 Set。Set 构造器把重复值合并，size 读出去重后的数量。再逐个用 has 检查正确编号是否都出现过。这样能区分 R1,R2 和 R1,R1 两种看起来一样长的列表。',
      '证据验证通过后，才按拿到的数字求和。若范围内有一笔分钟数为 null，可以继续报告这些来源编号，但结论标成「资料不足」。试把第二条输出变为 R1,R3，结果仍应不合格。再给一条由 0 和 25 分钟组成的记录组合，0 明确表示没有耗时，合计仍可确定为 25。',
    ], `const expected = ['R1', 'R2'];
function referencesMatch(refs) {
  const seen = new Set(refs);
  if (refs.length !== expected.length || seen.size !== expected.length) return false;
  for (const id of expected) {
    if (!seen.has(id)) return false;
  }
  return true;
}
console.log(referencesMatch(['R2', 'R1']));
console.log(referencesMatch(['R1', 'R1']));`, 'true\nfalse'),
  ],

  'ai-batch-error-types': [
    worked('给一条输出逐层盖章', [
      '把检查顺序写在显示器旁。第一格检查输出格式，第二格检查检索是否已经找到全部必须资料，第三格核对引用，第四格核算结论。每完成一格填 true，发现第一处错误时返回该格的名称。这样同一份答案即使同时有格式错误和数字错误，汇报中也只为它记录一次当前可确认的失败。问题修复后可以重跑，下一处偏差才会进入报告。',
      'indexOf(false) 能找到第一个布尔值 false 的下标，找不到返回 -1。下标为 0、1、2、3 时可以到对应位置读取标签。这是一次按约定顺序扫描的简写，也可以先用 for…of 逐条检查。将第一条样本的第一个值改为 true，同时保持第二个值为 false，输出应改成检索漏项。',
    ], `const labels = ['格式错误', '检索漏项', '证据错误', '结论错误'];
function firstProblem(checks) {
  const index = checks.indexOf(false);
  if (index < 0) return '通过';
  return labels[index];
}
console.log(firstProblem([false, false, false, false]));
console.log(firstProblem([true, true, false, false]));
console.log(firstProblem([true, true, true, true]));`, '格式错误\n证据错误\n通过'),
    worked('把小组分母留在通过率旁边', [
      '本例两条普通样本均通过，两条缺值样本一条通过。从总体看是 3/4，从缺值组看是 1/2。总体结果帮助快速对比版本，分组结果说明某类资料是否值得重点复查。要用真实输入对比，必须对所有版本用同一组参考答案。如果一个版本没有回答某个样本，也应该在该组分母中保留它，并根据事先规则记为失败。',
      '下面的 counts 按组名保存两个计数，total 记录该组有多少份测试，passed 记录多少条通过。首次看到某组时建立一对从 0 开始的计数，后续就可以按同样方式递增。把最后一条由 false 改为 true，核对缺值组应变为 2/2，普通组仍是 2/2。别忘了用能独立核对的输入专门检查刚修复的错误。',
    ], `const samples = [{ group: '普通', pass: true }, { group: '普通', pass: true },
  { group: '缺值', pass: true }, { group: '缺值', pass: false }];
const counts = {};
for (const sample of samples) {
  if (!counts[sample.group]) counts[sample.group] = { total: 0, passed: 0 };
  const count = counts[sample.group];
  count.total += 1;
  if (sample.pass) count.passed += 1;
}
for (const group of ['普通', '缺值']) {
  console.log(group, counts[group].passed + '/' + counts[group].total);
}`, '普通 2/2\n缺值 1/2'),
  ],

  'ros-message-contracts': [
    worked('先用两个对象练习读取消息字段', [
      '纸面上先写字段表：站点 site 取 east 或 west，seq 是正整数，celsius 是有限数值。一个 JavaScript 对象可以把三个值放在一起，例如 { site: "east", seq: 1, celsius: 20.5 }。点号取指定字段；packet.seq 和 packet.celsius 作用不同，前者用于确认顺序，后者用于显示温度。',
      '从两个完整对象开始观察字段检查。三个条件用 && 串起来，只有每项满足才接受。把第二条的温度从引号中的 22 改为数字 22，状态应变为接收。再把 seq 改成 0 或 1.5，它们都不符合序号规则。这一步负责业务值检查；后面的连接练习再核对两端名称和类型是否匹配。',
    ], `const packets = [{ site: 'east', seq: 1, celsius: 20.5 }, { site: 'west', seq: 2, celsius: '22' }];
for (const packet of packets) {
  const known = ['east', 'west'].includes(packet.site);
  const numbered = Number.isInteger(packet.seq) && packet.seq > 0;
  const measured = Number.isFinite(packet.celsius);
  console.log(packet.site, known && numbered && measured ? '接收' : '拒绝');
}`, 'east 接收\nwest 拒绝'),
    worked('按站点记住上一条，再比较新旧序号', [
      '假设面板先后看到东站 1、西站 2、东站 3。把记录本分为两列，分别记录东西两站最后一个有效序号。东站 3 到来时只读东站的上次值 1，因此可以指出 2 在当前日志中没有出现。西站 2 是它自己的第一条观察值，不需要拿去填补东站。',
      '下面用对象 last 记住上一条。方括号中的 packet.site 会先求值，再作为字段名，因此能够按不同来源更新。运行后把最后一个 seq 改成 4，预期东站缺 2 条。若希望处理乱序或重复，先比较新序号是否大于上次值，小于或等于时就保留当前记录；本例采用题目给定的顺序递增输入。',
    ], `const last = {};
const packets = [{ site: 'east', seq: 1 }, { site: 'west', seq: 2 }, { site: 'east', seq: 3 }];
for (const packet of packets) {
  const previous = last[packet.site];
  const missing = previous === undefined ? 0 : packet.seq - previous - 1;
  last[packet.site] = packet.seq;
  console.log(packet.site, packet.seq, '缺口', missing);
}`, 'east 1 缺口 0\nwest 2 缺口 0\neast 3 缺口 1'),
  ],

  'ros-connection-qos': [
    worked('给两个接收端分别填一张配对表', [
      '把发布方的 /temp 和 TemperatureReading 抄到表的左侧，将两个订阅端的有效话题名与类型抄到右侧。一对一比较后，在每行写下第一个不同项。面板订阅 /temp 且类型相同，可以继续检查可靠性。归档若订阅 /raw，这个阶段就能定位到名字，即使改变可靠性也不会改变结果。',
      '下面的 map 把很多个订阅对象转成同样数量的配对结果。传给 map 的简单函数每次收一个端点，返回一条诊断文字。也可以用 for…of 加 push 逐个检查。先修改归档的名称，使其与发布端一致；再改消息类型，观察首个失败位置跟着改变。',
    ], `const publisher = { topic: '/temp', type: 'TemperatureReading' };
const receivers = [
  { name: '面板', topic: '/temp', type: 'TemperatureReading' },
  { name: '归档', topic: '/raw', type: 'TemperatureReading' },
];
const results = receivers.map(receiver => {
  if (receiver.topic !== publisher.topic) return receiver.name + ' 话题不符';
  if (receiver.type !== publisher.type) return receiver.name + ' 类型不符';
  return receiver.name + ' 名称与类型匹配';
});
console.log(results.join(' / '));`, '面板 名称与类型匹配 / 归档 话题不符'),
    worked('把可靠性比较和实际接收拆成两栏', [
      '两端名称与类型相同后，再单独比较发布能提供什么、订阅要求什么。用提供值与所需值写一张两行表。尽力而为值为 0，可靠值为 1。尽力而为发布匹配尽力而为订阅，不能满足可靠订阅；可靠发布可以满足两者。表里的数字是教学表示，用于把规则翻译成一次比较。真实端点还要核对其他 QoS 策略。',
      '通过兼容检查以后，联系日志判断一条消息是否送到。示例给面板与归档都保留一份“收到的序号”列表。把提供等级改成 1，归档会得到“兼容，未观察到 3”。只有把 3 加入归档的收到列表，才能确认这条样本送达归档。这一步避免把修改配置当成故障已经修复。',
      '排查时最好同时写下发布端观察到的序号。如果发布端也没有第 3 条，先检查采集和发布环节。如果发布端记录了 3、面板收到、归档缺失，就沿归档的连接和接收日志继续找。',
    ], `const level = { bestEffort: 0, reliable: 1 };
const offer = 'bestEffort';
const receivers = [
  { name: '面板', request: 'bestEffort', received: [1, 3] },
  { name: '归档', request: 'reliable', received: [] },
];
for (const receiver of receivers) {
  if (level[offer] < level[receiver.request]) console.log(receiver.name, '可靠性不足');
  else console.log(receiver.name, receiver.received.includes(3) ? '收到 3' : '兼容，未观察到 3');
}`, '面板 收到 3\n归档 可靠性不足'),
  ],

  'ros-timeout-state': [
    worked('先在一条数字时间线上划出合法回复范围', [
      '用数字 4、5、6、7、8 在纸上画一条时间线。时间 4 发出请求，给定允许等待 4 个单位便得到截止点 8。回复从 4 到 7 时可继续处理，从 8 起属于超时。这条边界必须写在题目约定里，否则有人会用 >、有人会用 >=，恰好到 8 时两人的结果不同。',
      '示例只处理一个已知请求，练习截止规则。statusAt 接收候选回复的时间，返回可以填写进日志的状态名称。把 deadline 改为 9，时间 8 的回复应变成按时。接下来需要处理多条独立的查询，用请求 ID 标记每条回复属于哪一次，避免把旧请求的时间与新请求的截止点混用。',
    ], `const requestTime = 4;
const deadline = requestTime + 4;
function statusAt(time) {
  if (time >= deadline) return '查询超时';
  return '收到按时回复';
}
for (const time of [7, 8, 9]) console.log(time, statusAt(time));`, '7 收到按时回复\n8 查询超时\n9 查询超时'),
    worked('在同一张画面上保留当前请求的状态', [
      '面板发过 11 和 12，但现在只等待 12。对一条到达事件依序判断：编号是否当前，是否仍等待，时间是否已经到截止点，找到的配置是否存在。任何一步结束就可以返回现有或新的显示。旧回复先退出，即使它的单位字段看起来完整也不应改动当前面板。',
      '示例把状态放进 current 对象。收到一条按时的 found=false 后，显示未知传感器；即使再收到同 ID 的 found=true，本次请求已结束。试把前两条事件交换一下，旧回复的输出会变成已经结束的状态，但它不会改变当前请求的结论。这种小范围验证比一开始就使用真实计时更容易看到哪里走错分支。',
    ], `const current = { id: 12, deadline: 8, state: '等待' };
function apply(reply) {
  if (reply.id !== current.id || current.state !== '等待') return current.state;
  if (reply.time >= current.deadline) current.state = '查询超时';
  else current.state = reply.found ? reply.unit : '未知传感器';
  return current.state;
}
console.log(apply({ id: 11, time: 5, found: true, unit: 'celsius' }));
console.log(apply({ id: 12, time: 6, found: false }));
console.log(apply({ id: 12, time: 7, found: true, unit: 'celsius' }));`, '等待\n未知传感器\n未知传感器'),
  ],

  'ros-log-replay': [
    worked('先给单个任务画状态转换表', [
      '状态机记录当前处在哪一步，以及哪一条事件允许它前进。画四行：执行中可接受 request 并进入已申请取消，收到 accept 才能进入正在取消，拿到 canceled 最后进入已取消。程序里的 state 只记住处理到当前事件的结果。要把它追溯回原因，还需要同时打印收到的事件名和新状态。',
      '先运行合法事件顺序，再把 request 和 accept 调换。accept 提前到来时当前还是执行中，代码会保留原状态。最终 canceled 在这里代表明确的服务端终态，可结束任务，例如客户端漏掉了中间响应但仍拿到结果。若服务端最终报告成功，实际界面也应以收到的终态为准。在后面的练习中再增加第二个目标和旧反馈。',
    ], `let state = '执行中';
for (const event of ['request', 'accept', 'feedback', 'canceled']) {
  if (event === 'request' && state === '执行中') state = '已申请取消';
  if (event === 'accept' && state === '已申请取消') state = '正在取消';
  if (event === 'canceled') state = '已取消';
  console.log(event, state);
}`, 'request 已申请取消\naccept 正在取消\nfeedback 正在取消\ncanceled 已取消'),
    worked('从一份混合日志找到第一处意外修改', [
      '重放前先为每类数据写一个小规则。展示温度时按站点和序号更新；展示设置时必须匹配当前请求；动作状态由目标 ID 指定。写期望轨迹时可以只记受本行影响的字段，其余字段沿用上一行。这样当最后一行 g1 已取消不正确时，可以回头确定偏差到底始于请求、接受还是终态事件。',
      '例中两条动作事件和一条旧查询穿插到达。回放时旧查询只留下「忽略」的日志，保留动作状态和当前回复。把 reply 的 id 改为 12，观察只有当前查询的显示变为「读取配置」。联调时可以先重放最短的出错事件序列，再把已验证的读数、查询和动作轨迹合起来，核对彼此没有覆盖。',
    ], `const activeRequest = 12;
let action = '执行中';
const events = [{ kind: 'cancelRequest' }, { kind: 'reply', id: 11 }, { kind: 'cancelAccepted' }];
for (const event of events) {
  if (event.kind === 'cancelRequest') action = '已申请取消';
  if (event.kind === 'cancelAccepted') action = '正在取消';
  if (event.kind === 'reply') console.log(event.id === activeRequest ? '读取配置' : '忽略旧回复');
  else console.log('g1', action);
}`, 'g1 已申请取消\n忽略旧回复\ng1 正在取消'),
  ],
} satisfies Record<string, Workshop>

export const systemsHints: Record<keyof typeof systemsWorkshops, string[]> = {
  'backend-routing-contracts': [
    '先输出 url.pathname。带或不带查询参数的列表地址都应该得到 /sessions。',
    '路径匹配后依次判断 POST、其他方法和 GET 的筛选值。get 返回 null 时可跳过空白检查。',
  ],
  'backend-joins-reporting': [
    '先写不含聚合的 SELECT，把课程 ID 和匹配到的记录 ID 列出来。',
    '在 ON 中追加分钟数条件，再用 COUNT(s.id) 和 COALESCE(SUM(s.minutes), 0) 处理没有匹配项的课程。',
  ],
  'backend-transaction-safety': [
    '先只完成 s2 的事务。按顺序给两张表分别插入，成功后执行 COMMIT。',
    '用第二个 BEGIN 包住 s3 的插入，再写 ROLLBACK。最后的两个 SELECT 都应在事务之外。',
  ],
  'backend-request-storage': [
    '先实现两个有效边界。创建后查同一个数组，并核对读出的分钟数。',
    '检查 Number.isInteger 和闭区间。提前返回错误前，用 JSON.stringify 比较数组与原快照。',
  ],
  'ai-chunk-records': [
    '先访问 split("\\n") 的每一项。空白行经 trim 后变成空字符串。',
    '只找第一个竖线。用两个 slice 取编号与正文，汇总时再用换行拼接。',
  ],
  'ai-keyword-retrieval': [
    '先打印每条记录的分数。重复查询词只计一次，未命中的记录得 0 分。',
    '移除 0 分项，再降序排序并取前两条。最后只显示编号。',
  ],
  'ai-check-evidence': [
    '先从候选中过滤 N1 且已完成的活动，做出正确编号单。',
    '核对引用后，再检查是否有 null。没有缺失时才按分钟数求和。',
  ],
  'ai-batch-error-types': [
    '先找一行里首个 false 的位置。没有 false 就归到「通过」。',
    '准备与分类数目相同的计数数组。每处理一条样本只改变其中一个数字。',
  ],
  'ros-message-contracts': [
    '依次核对站点、序号和数值。无效读数提前返回，避免改变上一条记录。',
    '更新 last 前先保存旧值。新旧差距大于 1 时，缺口等于差距减 1。',
  ],
  'ros-connection-qos': [
    '先让话题或类型不同的用例分别返回错误。',
    '名称与类型锁定后，只有尽力而为发布遇到可靠订阅会触发此处的可靠性错误。',
  ],
  'ros-timeout-state': [
    '旧编号应返回「等待当前回复」，这时还不应该分析该回复的内容。',
    '当前编号先比较时间，恰好到截止点也算超时。按时才查看 found。',
  ],
  'ros-log-replay': [
    '先让 g1 的三种取消事件逐步改变状态，每一步都输出。',
    '用事件中的目标 ID 选择状态。处理新事件前，先看目标是否已处在终态。',
  ],
}
