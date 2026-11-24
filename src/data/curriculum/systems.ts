import type { CurriculumTrack } from './types'
import { systemsHints, systemsWorkshops } from './systemsWorkshops'

type Lesson = CurriculumTrack['advanced']['lessons'][number]
type Project = CurriculumTrack['foundationProject']
type Question = [prompt: string, choices: string[], answer: number, explanation: string]
type LessonContent = Omit<Lesson, 'id' | 'expansion' | 'exercise'> & {
  id: keyof typeof systemsWorkshops
  objectives: string[]
  sections: Lesson['expansion']['sections']
  pitfalls: [mistake: string, why: string, fix: string][]
  prompt: string
  checkpoints: string[]
  approach: string
  questions: Question[]
  exercise: Project['exercises'][number]
}

function makeLesson({ id, title, summary, primer, objectives, sections, pitfalls, prompt, checkpoints, approach, questions, exercise }: LessonContent): Lesson {
  const [firstExample, secondExample] = systemsWorkshops[id]
  const [introduction, ...explanation] = sections
  return {
    id,
    title,
    summary,
    primer,
    expansion: {
      objectives,
      sections: [introduction, firstExample, ...explanation, secondExample],
      pitfalls: pitfalls.map(([mistake, why, fix]) => ({ mistake, why, fix })),
      practice: { prompt, checkpoints, hints: systemsHints[id], solution: approach },
      questions: questions.map(([prompt, choices, answer, explanation], index) => ({
        id: `${id}-${index + 1}`, prompt, choices, answer, explanation,
      })),
    },
    exercise,
  }
}

function jsExercise(signature: string, starter: string, body: string, harness: string, expectedOutput: string, title?: string): Project['exercises'][number] {
  const program = (implementation: string) => `function ${signature} {\n${implementation}\n}\n\n${harness}\n`
  return { title, language: 'javascript', starter: program(starter), solution: program(body), expectedOutput }
}

function sqlExercise(fixture: string, starter: string, query: string, expectedOutput: string, title?: string): Project['exercises'][number] {
  return { title, language: 'sql', starter: fixture + '\n\n' + starter, solution: fixture + '\n\n' + query, expectedOutput }
}

const coursesFixture = `CREATE TABLE courses(id TEXT PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE sessions(id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id), minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 1440));
INSERT INTO courses VALUES ('web', '网页'), ('sql', '数据库'), ('js', 'JavaScript');
INSERT INTO sessions VALUES ('s1', 'web', 15), ('s2', 'web', 30), ('s3', 'sql', 12);`

const summaryQuery = `SELECT c.id, COUNT(s.id) AS session_count, COALESCE(SUM(s.minutes), 0) AS total_minutes
FROM courses AS c LEFT JOIN sessions AS s ON s.course_id = c.id
GROUP BY c.id
ORDER BY c.id;`

const sqlSummaryOutput = 'id\tsession_count\ttotal_minutes\njs\t0\t0\nsql\t1\t12\nweb\t2\t45'

const backendLessons = [
  makeLesson({
    id: 'backend-routing-contracts',
    title: '让方法、路径和状态码对上',
    summary: '用一张路由表区分课程列表、记录详情和创建请求，处理参数或方法错误。',
    primer: { lead: '把请求当成一张工单，先读它要做什么、要找谁，再交给负责的函数。', terms: [
      ['路由', '由 HTTP 方法与路径一起决定走哪段处理逻辑。'],
      ['路径参数', '路径中的动态部分，例如 /sessions/s2 里的 s2。'],
      ['405 与 Allow', '路径存在而方法不受支持时返回 405，并说明可用的方法。'],
    ] },
    objectives: ['从请求目标拆出路径与查询参数。', '为路径不匹配、方法不匹配与输入不合法选择不同响应。'],
    sections: [
      { heading: '先看路径，再决定接受的方法', paragraphs: ['把 /sessions 交给列表或创建逻辑，把 /sessions/s2 交给指定记录的读取逻辑。对 /sessions/s2 发 POST，路径可以识别，方法违反约定，返回 405 并给 Allow: GET。对 /reports 发 GET，当前路由表没有这条路径，返回 404。'] },
      { heading: '过滤参数要先区分缺失与空白', paragraphs: ['new URL 可以拆出 pathname 和 searchParams。?course= 传入了空值，省略参数时 get 返回 null。可约定省略时列出全部，空值时返回 400。先按类型和范围验证，再使用输入。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `for (const target of ['/sessions', '/sessions?course=']) {
  const request = new URL(target, 'https://learnverse.example');
  console.log(request.searchParams.has('course'), request.searchParams.get('course') === '');
}` },
      { heading: '把路由层和处理函数分开检查', paragraphs: ['路由匹配成功后转交处理函数，处理函数负责查询或新增记录。分别记录方法、路径、响应码，能判断 404 来自路径还是记录本身。用同一路径和不同方法测试，可以发现代码只按路径分派的问题。'] },
    ],
    pitfalls: [
      ['把查询参数当成路径的一部分。', '同一列表带筛选时就无法匹配。', '用 pathname 匹配路由，另读 searchParams。'],
      ['用 404 处理所有失败。', '调用方无法区分资源缺失和参数错误。', '分别定义路径不存在、方法不允许和输入非法。'],
    ],
    prompt: '补全 classify，按约定为列表、创建、错误方法、空筛选和未知路径返回摘要。',
    checkpoints: ['GET /sessions 返回 200 list，POST 返回 201 create。', '空筛选返回 400，错误方法返回 405 并列出可用方法。'],
    approach: '先拆出路径。确认路径后检查方法，然后根据 GET 的参数是否为空返回对应结果。',
    questions: [
      ['GET /sessions?course=web 的 pathname 是？', ['/sessions?course=web', '/sessions', 'web', 'course'], 1, '查询串可用 searchParams 单独读取。'],
      ['已存在的列表路径仅支持 GET、POST，收到 DELETE 应返回？', ['201', '200', '404', '405'], 3, '路径能识别，此处应说明支持的方法。'],
      ['省略 course 参数时，searchParams.get 返回？', ['null', '0', 'false', '空数组'], 0, '空字符串意味着参数存在而值为空。'],
      ['筛选成功但结果为零条，应返回？', ['404', '400', '200 和空列表', '405'], 2, '列表查询成功，响应可用空数组表达结果。'],
    ],
    exercise: jsExercise('classify(method, target)', '  return "待实现";', `  const url = new URL(target, 'https://learnverse.example');
  if (url.pathname !== '/sessions') return '404 路径不存在';
  if (method === 'POST') return '201 create';
  if (method !== 'GET') return '405 Allow: GET, POST';
  const course = url.searchParams.get('course');
  if (course !== null && course.trim() === '') return '400 课程筛选为空';
  return '200 list';`, `for (const [method, target] of [
  ['GET', '/sessions?course=web'], ['POST', '/sessions'],
  ['DELETE', '/sessions'], ['GET', '/sessions?course='], ['GET', '/reports'],
]) console.log(classify(method, target));`, '200 list\n201 create\n405 Allow: GET, POST\n400 课程筛选为空\n404 路径不存在'),
  }),
  makeLesson({
    id: 'backend-joins-reporting',
    title: '用连接和汇总检查每门课程',
    summary: '从课程主表出发连接学习记录，给零记录课程保留一行。',
    primer: { lead: '先列出每门课程，再把相关的记录摊到课程下方，最后才按课程汇总。', terms: [
      ['主键与外键', '主键区分行，外键指出依赖哪一张表中的哪一行。'],
      ['LEFT JOIN', '保留左表的所有行，右表缺少匹配时以 NULL 补齐。'],
      ['聚合', '用 COUNT、SUM 等函数把多行变成一个结果。'],
    ] },
    objectives: ['追踪一门课程如何对应多条记录。', '输出包含零记录课程的稳定报表。'],
    sections: [
      { heading: '先决定报表必须有什么行', paragraphs: ['报表说“每门课程”时，应从课程表出发。把 sessions.course_id 接到 courses.id，课程有两条记录就变成两行，课程无匹配项仍保留一行。练习时先查询连接后的明细，再写 GROUP BY。'] },
      { heading: '用实际记录的主键计数', paragraphs: ['零记录的课程在 LEFT JOIN 结果里仍有一行。COUNT(*) 会把这行算进去，COUNT(s.id) 忽略右侧的 NULL。SUM 没有可加的数时返回 NULL，明确约定显示 0，再用 COALESCE。'], codeLanguage: 'SQLite · 独立运行', run: { language: 'sql' }, code: `${coursesFixture}\n${summaryQuery}` },
      { heading: '右侧筛选放在连接条件里', paragraphs: ['如果报表只统计至少 20 分钟的记录，把 s.minutes >= 20 加进 ON。放在 WHERE 会先丢掉右表为 NULL 的行，使零记录课程消失。ORDER BY c.id 让每次核对都有相同的行顺序。'] },
    ],
    pitfalls: [
      ['用 COUNT(*) 统计左连接后的次数。', '没有匹配的占位行也会被计算。', '统计右表非空的主键。'],
      ['在 WHERE 写 s.minutes >= 20。', '没有符合条件的课程会消失。', '把这个过滤写进 ON，保留课程行。'],
    ],
    prompt: '生成每门课程至少 20 分钟的记录次数和时长总和。',
    checkpoints: ['保留三门课程，js 和 sql 都是 0 次、0 分钟。', 'web 只统计 30 分钟的记录，报表按课程 ID 排序。'],
    approach: '先在 ON 里连接并筛选，再按课程 ID 聚合。对 COUNT(s.id) 和 COALESCE(SUM(s.minutes), 0) 分别起名。',
    questions: [
      ['统计每门课程应从哪张表出发？', ['sessions', '按分钟排序的临时表', 'courses', '任选一表都一样'], 2, '左表决定要保留的课程范围。'],
      ['LEFT JOIN 有一个右表值全为 NULL 的占位行，COUNT(s.id) 为？', ['0', 'NULL', '1', '不返回该课程'], 0, 'COUNT(列) 只统计不为 NULL 的值。'],
      ['希望低于 20 分钟的记录不参加汇总，同时保留课程，筛选应放哪里？', ['ORDER BY', 'LIMIT', 'WHERE', 'ON'], 3, '把右侧限制放入 ON 就只改变哪些记录能匹配。'],
      ['为方便对照报表，怎样保证课程按 ID 排列？', ['依靠插入次序', '用 ORDER BY c.id', '仅 GROUP BY c.id', '先执行 COUNT'], 1, 'ORDER BY 明确规定输出顺序。'],
    ],
    exercise: sqlExercise(coursesFixture, '-- 先完成 LEFT JOIN，再加汇总。\nSELECT * FROM courses;',
      summaryQuery.replace('s.course_id = c.id', 's.course_id = c.id AND s.minutes >= 20'),
      'id\tsession_count\ttotal_minutes\njs\t0\t0\nsql\t0\t0\nweb\t1\t30'),
  }),
  makeLesson({
    id: 'backend-transaction-safety',
    title: '让相关写入一起提交或撤回',
    summary: '模拟添加学习记录后同时写入日志，检查提交与回滚的结果。',
    primer: { lead: '一条申请需要同时登记记录和凭条，任何一张登记失败都不应留下半套结果。', terms: [
      ['事务', '把一组数据库操作放进同一个成功或回滚的边界。'],
      ['COMMIT', '确认事务的所有修改。'],
      ['ROLLBACK', '撤回自事务开始以来尚未提交的修改。'],
    ] },
    objectives: ['为相互依赖的写入选择同一个事务边界。', '使用查询验证已提交及已撤回的记录。'],
    sections: [
      { heading: '先画出成功后应存在的两条记录', paragraphs: ['学习记录保存课程和分钟，日志记录何时创建了哪个条目。两次写入如果分开提交，第一条成功、第二条失败会留下缺日志的记录。先开启事务，确保两条均成功再提交。'] },
      { heading: '用回滚观察一条已执行的修改如何消失', paragraphs: ['事务内执行 INSERT 并不等于最终确认。这段 SQL 先提交 1，再写入 2 并主动回滚，最后只剩 1。浏览器每次重新创建内存数据库，把建表和测试写在本次运行的脚本里。'], codeLanguage: 'SQLite · 独立运行', run: { language: 'sql' }, code: `CREATE TABLE journal(id INTEGER PRIMARY KEY);
BEGIN;
INSERT INTO journal VALUES (1);
COMMIT;
BEGIN;
INSERT INTO journal VALUES (2);
ROLLBACK;
SELECT id FROM journal ORDER BY id;` },
      { heading: '确认失败原因，并显式结束事务', paragraphs: ['实际应用在捕获执行错误后应按数据库接口回滚。练习用给定的失败事件触发 ROLLBACK，目的是让后续查询仍能运行并核对数据。外键或 CHECK 负责在存储层限制无效行，事务负责整组操作的最终状态。'] },
    ],
    pitfalls: [
      ['先提交记录，再写日志。', '后续失败时，已提交记录不在这次回滚边界内。', '两次成功后再执行 COMMIT。'],
      ['只看错误提示，略过存储验证。', '仅凭异常无法确认旧记录与新增记录各自的状态。', '回滚后查询两个表，并对比预期内容。'],
    ],
    prompt: '提交 s2 和相应日志，再模拟 s3 写入之后日志失败并回滚。',
    checkpoints: ['两张表都保留最初的 s1 和成功的 s2。', 's3 在回滚后不出现在任何最终查询中。'],
    approach: '先为 s2 开启事务、写入两表并提交。为 s3 开启另一事务，写入记录后按给定事件回滚。',
    questions: [
      ['一起写学习记录和日志，两次写完且都成功才执行？', ['BEGIN', 'COMMIT', 'ROLLBACK', 'SELECT'], 1, 'COMMIT 才确认本次事务的两项写入。'],
      ['在未提交事务里成功插入一行后回滚，该行最终怎样？', ['被复制两次', '变成 NULL', '仍然保留', '被撤回'], 3, '回滚撤回事务内尚未提交的修改。'],
      ['验证回滚最直接的方法是？', ['查询涉及的两张表', '只检查前端提示', '重载浏览器', '检查 SQL 是否换行'], 0, '最终数据能说明哪些记录确实保留。'],
      ['浏览器重新运行 SQLite 练习时应怎样准备？', ['依赖上次的 CREATE TABLE', '等待前一位学习者写入', '把建表和初始数据放在本次脚本内', '只保留 INSERT'], 2, '新的内存数据库需要重新建表和插入初始数据。'],
    ],
    exercise: sqlExercise(`CREATE TABLE sessions(id TEXT PRIMARY KEY);
CREATE TABLE audit(session_id TEXT PRIMARY KEY);
INSERT INTO sessions VALUES ('s1');
INSERT INTO audit VALUES ('s1');`, `-- 补上成功事务和需要主动回滚的事务。
SELECT id FROM sessions ORDER BY id;
SELECT session_id FROM audit ORDER BY session_id;`, `BEGIN;
INSERT INTO sessions VALUES ('s2');
INSERT INTO audit VALUES ('s2');
COMMIT;
BEGIN;
INSERT INTO sessions VALUES ('s3');
ROLLBACK;
SELECT id FROM sessions ORDER BY id;
SELECT session_id FROM audit ORDER BY session_id;`, 'id\ns1\ns2\n\nsession_id\ns1\ns2'),
  }),
  makeLesson({
    id: 'backend-request-storage',
    title: '按请求、响应和存储决定测试顺序',
    summary: '用同一份状态连接写入和读取，定位表面上的成功与实际入库之间的偏差。',
    primer: { lead: '测试像验收收据，拿到新编号以后再查一次，确认系统保存了正确的内容。', terms: [
      ['测试初始数据', '每个场景独立准备、执行前已知的一组记录。'],
      ['读后验证', '使用创建响应给出的 ID 再查询一次，核对保存结果。'],
      ['状态不变', '失败后，已存在记录的数量和内容与执行前一致。'],
    ] },
    objectives: ['把响应核验与存储核验放进同一用例。', '复现有效边界和无效输入而不互相干扰。'],
    sections: [
      { heading: '让不同处理函数共享同一份状态', paragraphs: ['创建函数返回新记录的 ID，读取函数必须从同一份存储查找。若两个函数各建了自己的数组，创建能返回 201，读取却返回 404。用明确的参数传递同一存储，能让测试为每个场景重新准备。'] },
      { heading: '验证输入失败后的完整状态', paragraphs: ['失败后只看 rows.length 不够，程序可能改了旧记录却没有新增。对本练习的普通记录数组可用 JSON.stringify 保存比较用的快照，并固定字段和顺序。边界值 1、1440 应接收，0、1441 和字符串数字应拒绝。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `const rows = [{ id: 's1', minutes: 25 }];
const before = JSON.stringify(rows);
rows[0].minutes = 0;
console.log(rows.length, before === JSON.stringify(rows));` },
      { heading: '从失败在哪一层选择检查对象', paragraphs: ['如果 400 用例却得到 201，先看解析和字段验证。若 201 后读取失败，核对 ID 和两段代码是否共享存储。若库里行已经正确、响应读到的字段错误，再检查读取是否整理成约定的正文。'] },
    ],
    pitfalls: [
      ['只检查创建返回 201。', '程序可能忘记实际保存。', '追加按返回 ID 读取的断言。'],
      ['让前一个用例留下的数据决定后一个用例的预期。', '用例换序后会出现意外结果。', '为每个场景创建自己的初始数组。'],
    ],
    prompt: '补全 createAndCheck，返回成功后读取的分钟数，或失败后数据是否保留。',
    checkpoints: ['整数 1、1440 能创建并读到相同分钟数。', '0 和字符串 25 返回 400，并保留初始记录。'],
    approach: '在函数开头创建固定数据。对非法输入用快照确认未改变。合法输入创建记录，再按新 ID 找到它。',
    questions: [
      ['创建返回 201 后怎样验证确实保存？', ['检查日期格式', '重新打印 201', '按同一个 ID 读取并核对内容', '只查列表长度'], 2, '读到同一 ID 的正确内容可验证写入和读取之间的连接。'],
      ['验证失败不改状态时，应比较什么？', ['前后记录内容与数量', '只比较日志里的单词', '只比较 400', '仅比较请求方法'], 0, '记录数相同也可能有字段被改动。'],
      ['接口要求整数，JSON 正文中的 "25" 应如何处理？', ['转换后一定接受', '当作 0', '删除已有记录', '按类型规则返回 400'], 3, '字符串形式不符合这里明确的输入契约。'],
      ['多个测试共享可修改数据，最直接的风险是？', ['它们都无法运行', '测试结果依赖执行顺序', 'SQL 会变成 HTML', '每个结果一定重复两次'], 1, '前一个用例的副作用会改变后一个用例的初始状态。'],
    ],
    exercise: jsExercise('createAndCheck(minutes)', '  return "待实现";', `  const rows = [{ id: 's1', minutes: 25 }];
  const before = JSON.stringify(rows);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return '400 原样=' + (before === JSON.stringify(rows));
  }
  const created = { id: 's2', minutes };
  rows.push(created);
  const read = rows.find(row => row.id === created.id);
  return '201 读回=' + read.minutes;`, `for (const minutes of [1, 1440, 0, '25']) console.log(createAndCheck(minutes));`,
      '201 读回=1\n201 读回=1440\n400 原样=true\n400 原样=true'),
  }),
]

const backendFoundation: Project = {
  title: '学习记录接口模拟',
  summary: '在内存里模拟学习记录接口，另用给定的 SQLite 数据生成课程汇总。',
  requirements: [
    'POST /sessions 仅接受 web、sql、js 三门课程及 1～1440 的整数分钟数。成功返回 201 和新 ID，可用 GET /sessions/{id} 读回。',
    '无法解析的 JSON、错误类型、越界或未知课程返回 400。失败前后记录内容和条数相同。未知记录返回 404。',
    '用 SQL 输出每门课程的记录数与总分钟数，保留没有记录的课程，并按课程 ID 排序。',
  ],
  examples: [
    { label: '创建并读回', input: 'POST /sessions，{"courseId":" web ","minutes":25}', expected: '201 s2；用 s2 读取时得到 200 web 25。' },
    { label: '上限可以接收', input: 'POST /sessions，{"courseId":"sql","minutes":1440}', expected: '201 s3；同一存储可以读到 1440。' },
    { label: '拒绝类型与规则错误', input: 'minutes 为 0 或字符串 "25"，或者课程为 unknown。', expected: '400；旧记录和条数保持原样。' },
    { label: 'SQL 保留空课程', input: '网页 15 和 30 分钟，数据库 12 分钟，JavaScript 没有记录。', expected: 'js 0 次 0 分钟；sql 1 次 12 分钟；web 2 次 45 分钟。' },
  ],
  exercises: [
    jsExercise('handle(method, path, raw, rows)', '  // 先分派读取和创建，再完成解析、校验和写入。\n  return { status: 0 };', `  if (method === 'GET' && path.startsWith('/sessions/')) {
    const id = path.slice('/sessions/'.length);
    const row = rows.find(item => item.id === id);
    return row ? { status: 200, body: { ...row } } : { status: 404 };
  }
  if (method !== 'POST' || path !== '/sessions') return { status: 404 };
  let data;
  try { data = JSON.parse(raw); } catch { return { status: 400 }; }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return { status: 400 };
  const { minutes } = data;
  const courseId = typeof data.courseId === 'string' ? data.courseId.trim() : '';
  if (!['web', 'sql', 'js'].includes(courseId) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return { status: 400 };
  }
  const id = 's' + (rows.length + 1);
  rows.push({ id, courseId, minutes });
  return { status: 201, body: { id } };`, `const rows = [{ id: 's1', courseId: 'web', minutes: 10 }];
for (const [courseId, minutes] of [[' web ', 25], ['sql', 1440]]) {
  const created = handle('POST', '/sessions', JSON.stringify({ courseId, minutes }), rows);
  const read = handle('GET', '/sessions/' + created.body?.id, '', rows);
  console.log(created.status, created.body?.id ?? '?', read.status, read.body?.courseId ?? '?', read.body?.minutes ?? '?');
}
const backup = JSON.stringify(rows);
for (const raw of ['{', 'null', '{"courseId":"web","minutes":"25"}', '{"courseId":"unknown","minutes":25}', '{"courseId":"web","minutes":0}']) {
  const response = handle('POST', '/sessions', raw, rows);
  console.log(response.status, backup === JSON.stringify(rows));
}
console.log(handle('GET', '/sessions/missing', '', rows).status);`,
    '201 s2 200 web 25\n201 s3 200 sql 1440\n400 true\n400 true\n400 true\n400 true\n400 true\n404', '模拟读取与创建'),
    sqlExercise(coursesFixture, '-- 写一个能保留零记录课程的汇总。\nSELECT * FROM courses;', summaryQuery, sqlSummaryOutput, '按课程汇总 SQLite 数据'),
  ],
  explanation: '先校验再写入，创建与读取必须共用同一数组。SQL 部分使用题目内给定的数据单独核对汇总规则，左连接从课程表出发。',
}

const backendAdvanced: Project = {
  title: '活动预约后端',
  summary: '实现创建与取消预约，验证重复和满员拒绝，并用 SQLite 重现提交与中途失败后的回滚。',
  requirements: [
    'POST /reservations 创建后返回 201 和预约编号，GET /reservations/{id} 可读回，DELETE /reservations/{id} 取消后返回 204 并释放名额。',
    '重复预约返回 409 duplicate，满员返回 409 full，均不写入。未知活动或空姓名返回 400，查不到的预约返回 404。',
    '创建或取消时在同一事务中更新预约和审计表。模拟中途日志失败时返回 500，整个状态与执行前一致。',
    '用独立 SQLite 脚本提交一笔创建和一笔取消，再在另一笔分开执行的事务中模拟失败并回滚。查询预约、日志和剩余名额。',
  ],
  examples: [
    { label: '占用最后一个名额', input: '活动 a1 有 2 个名额，阿岚已有 r1，小周提交预约。', expected: '201 r2；读回小周的预约，同时出现 r2 的创建日志。' },
    { label: '重复及满员拒绝', input: '小周再次提交；此时小林也来预约。', expected: '小周收到 409 duplicate，小林收到 409 full，执行前后两表相同。' },
    { label: '取消释放名额', input: 'DELETE /reservations/r2。', expected: '204，再查询 r2 得到 404；a1 剩下 1 个名额，同时出现取消日志。' },
    { label: '部分写入回滚', input: '小林预约，暂存记录后模拟审计写失败。', expected: '500，查询不到小林的预约，审计表仍只有原先的日志。' },
  ],
  exercises: [
    jsExercise('handle(method, path, request, store, auditFailure = false)', `  // store.activities 给出容量，store.state 有 active、audit、nextId。
  // 先实现创建和回读，再实现重复、满员与取消。
  // 等预约和审计都准备好，再整体替换 state。
  return { status: 0 };`, `  const { active, audit, nextId } = store.state;
  if (path.startsWith('/reservations/')) {
    if (!['GET', 'DELETE'].includes(method)) return { status: 405 };
    const id = path.slice('/reservations/'.length);
    const reservation = active.find(item => item.id === id);
    if (!reservation) return { status: 404 };
    if (method === 'GET') return { status: 200, body: { ...reservation } };
    const pending = active.filter(item => item.id !== id);
    if (auditFailure) return { status: 500 };
    store.state = { active: pending, audit: [...audit, { id, action: 'cancel' }], nextId };
    return { status: 204 };
  }
  if (path !== '/reservations') return { status: 404 };
  if (method !== 'POST') return { status: 405 };
  const { activityId, attendee } = request ?? {};
  const name = typeof attendee === 'string' ? attendee.trim() : '';
  const activity = store.activities.find(item => item.id === activityId);
  if (!activity || !name) return { status: 400 };
  const bookings = active.filter(item => item.activityId === activityId);
  if (bookings.some(item => item.attendee === name)) return { status: 409, body: { reason: 'duplicate' } };
  if (bookings.length >= activity.capacity) return { status: 409, body: { reason: 'full' } };
  const id = 'r' + nextId;
  const pending = [...active, { id, activityId, attendee: name }];
  if (auditFailure) return { status: 500 };
  store.state = { active: pending, audit: [...audit, { id, action: 'create' }], nextId: nextId + 1 };
  return { status: 201, body: { id } };`, `const store = {
  activities: [{ id: 'a1', capacity: 2 }, { id: 'a2', capacity: 2 }],
  state: { active: [{ id: 'r1', activityId: 'a1', attendee: '阿岚' }], audit: [{ id: 'r1', action: 'create' }], nextId: 2 },
};
const created = handle('POST', '/reservations', { activityId: 'a1', attendee: ' 小周 ' }, store);
const id = created.body?.id ?? '?';
const item = handle('GET', '/reservations/' + id, null, store);
console.log(created.status, id, item.body?.attendee ?? '?', store.state.audit.at(-1).action);
let before = JSON.stringify(store.state);
for (const attendee of ['小周', '小林', '   ']) {
  const response = handle('POST', '/reservations', { activityId: 'a1', attendee }, store);
  console.log(response.status, response.body?.reason ?? '-', before === JSON.stringify(store.state));
}
const canceled = handle('DELETE', '/reservations/' + id, null, store);
console.log(canceled.status, handle('GET', '/reservations/' + id, null, store).status, store.state.active.length, store.state.audit.at(-1).action);
before = JSON.stringify(store.state);
const failed = handle('POST', '/reservations', { activityId: 'a1', attendee: '小林' }, store, true);
console.log(failed.status, handle('GET', '/reservations/r3', null, store).status, before === JSON.stringify(store.state));
console.log(handle('DELETE', '/reservations/r1', null, store, true).status, before === JSON.stringify(store.state));`,
      '201 r2 小周 create\n409 duplicate true\n409 full true\n400 - true\n204 404 1 cancel\n500 404 true\n500 true', '模拟创建、取消与失败回退'),
    sqlExercise(`PRAGMA foreign_keys = ON;
CREATE TABLE activities(id TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity > 0));
CREATE TABLE reservations(id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES activities(id), attendee TEXT NOT NULL, UNIQUE(activity_id, attendee));
CREATE TABLE audit(event_id INTEGER PRIMARY KEY, reservation_id TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('create', 'cancel')));
INSERT INTO activities VALUES ('a1', 2), ('a2', 2);
INSERT INTO reservations VALUES ('r1', 'a1', '阿岚');
INSERT INTO audit VALUES (1, 'r1', 'create');`, `-- 创建 r2 及其日志并提交，再取消 r2 并记录日志。
-- 插入 r3 并模拟写入审计失败，然后回滚。
SELECT id FROM reservations ORDER BY id;
SELECT reservation_id, action FROM audit ORDER BY event_id;`, `BEGIN;
INSERT INTO reservations VALUES ('r2', 'a1', '小周');
INSERT INTO audit VALUES (2, 'r2', 'create');
COMMIT;

BEGIN;
DELETE FROM reservations WHERE id = 'r2';
INSERT INTO audit VALUES (3, 'r2', 'cancel');
COMMIT;

BEGIN;
INSERT INTO reservations VALUES ('r3', 'a1', '小林');
-- 给定失败事件：日志无法写入。此时回滚本次事务。
ROLLBACK;

SELECT id FROM reservations ORDER BY id;
SELECT reservation_id, action FROM audit ORDER BY event_id;
SELECT a.id, a.capacity - COUNT(r.id) AS remaining
FROM activities AS a LEFT JOIN reservations AS r ON r.activity_id = a.id
GROUP BY a.id, a.capacity
ORDER BY a.id;`, 'id\nr1\n\nreservation_id\taction\nr1\tcreate\nr2\tcreate\nr2\tcancel\n\nid\tremaining\na1\t1\na2\t2', '执行 SQLite 提交与回滚'),
  ],
  explanation: 'JavaScript 中先查重复和容量，用待提交数组保留新状态，预约与日志同时准备完成才公布。SQL 使用实际事务，同时保留已取消预约的历史编号。事务结束后可核对两个表与余量。',
}

const aiLessons = [
  makeLesson({
    id: 'ai-chunk-records',
    title: '按记录切分并保留来源',
    summary: '把活动原始资料分成可检索的小段，给每段保存原始记录编号。',
    primer: { lead: '把整理好的记录卡放进索引，每张卡都带着出处，别人才能找回原件。', terms: [
      ['片段', '从原始资料切出的一段内容，供后续检索与引用。'],
      ['稳定编号', '原始记录保持不变的标识，如 R1。'],
      ['预算', '任务说明和输出留足空间后，可以放进本次输入的资料长度。'],
    ] },
    objectives: ['用明确的边界分离记录。', '保持每个片段与原始资料编号的对应。'],
    sections: [
      { heading: '选边界时先找证据的最小单位', paragraphs: ['一条活动记录同时提供编号、场次、状态和时长。20 分钟只有和场次、状态放在一起时，才足以决定是否计入统计。课堂题用每行一条，因此按行切比固定字数切更适合。'] },
      { heading: '切分时保留编号与正文', paragraphs: ['这一例用第一个竖线分隔编号与内容。按行拆后跳过空白，再分别取编号和文字。正文有额外竖线时仍应保留。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `const row = 'R1|N1 已完成 20 分钟|讲解';
const marker = row.indexOf('|');
console.log(row.slice(0, marker), row.slice(marker + 1));` },
      { heading: '记录太长时保留能连接回原文的位置', paragraphs: ['真实资料可能长于资料预算。可按段落拆，并为每个片段记录原始编号和片段序号，例如 R1#2。对这类记录，统计时仍按原始编号去重。预算应基于最终打包后的 token 数，本节按行切分练习无需真实分词器。'] },
    ],
    pitfalls: [
      ['只保存片段正文。', '结果中的答案难以定位到原记录。', '每个片段保留稳定编号。'],
      ['按长度切掉数字前面的状态。', '可能把已取消的活动算进去。', '优先完整保留活动行，超长时附可回查的段号。'],
    ],
    prompt: '把给定原始文本整理成编号与内容，跳过空行，保留正文中的竖线。',
    checkpoints: ['两条非空记录按原顺序输出。', 'R2 正文中的第二个竖线保持原样，片段包含可查编号。'],
    approach: '对每行先 trim，再检查第一个竖线的索引。用它切出编号和正文，最后拼成新输出。',
    questions: [
      ['活动状态与时长最适合怎样切？', ['按每两字切', '把状态留在上一条记录', '按完整活动记录切', '只留下时长'], 2, '同一条记录的字段一起使用才能判断是否符合统计规则。'],
      ['证据最重要的回查信息是什么？', ['片段字数', '原始记录的稳定编号', '当前运行时间', '结果的字体'], 1, '编号可以把输出引用连接到原始记录。'],
      ['R1 切成 R1#1 和 R1#2，统计活动次数时怎样处理？', ['作为同一原始活动核对', '计为两条活动', '总是抛弃第二段', '依据编号排序后全部忽略'], 0, '片段可以有多个，原始活动只有一条。'],
      ['何时确认真实模型的资料预算是否够用？', ['只看源文档字数', '插入分隔符之前', '一直用 80', '按实际打包内容和配套分词器检查'], 3, '包装、说明、资料和输出预留都影响可用空间。'],
    ],
    exercise: jsExercise('chunk(text)', '  return "待实现";', String.raw`  const result = [];
  for (const raw of text.split('\n')) {
    const row = raw.trim();
    if (!row) continue;
    const separator = row.indexOf('|');
    result.push(row.slice(0, separator) + ': ' + row.slice(separator + 1));
  }
  return result.join('\n');`, String.raw`console.log(chunk('R1|N1 讲解 20 分钟\n\nR2|N1 演示 25 分钟|室内'));`, 'R1: N1 讲解 20 分钟\nR2: N1 演示 25 分钟|室内'),
  }),
  makeLesson({
    id: 'ai-keyword-retrieval',
    title: '按关键词从资料库检索候选',
    summary: '用可解释的匹配分数和确定的并列顺序，从全部片段中选候选。',
    primer: { lead: '先在人手的索引里找可能相关的记录，把匹配理由留给下一步核对。', terms: [
      ['查询词', '本轮用来匹配资料的小词表。'],
      ['匹配分数', '本节把一个词命中记一分，每个不同词至多加一分。'],
      ['检索限制', '最多返回多少条候选，以及怎样处理同分和无命中的情况。'],
    ] },
    objectives: ['从给定全集计算匹配分数。', '复现并列和无命中的情况。'],
    sections: [
      { heading: '匹配表达需要先定清楚', paragraphs: ['这堂课按精确标签匹配。把查询词去掉两端空白并去重，再逐项判断标签是否包含它。每词至多一分，重复出现“讲解 讲解”与只查“讲解”得分相同。'] },
      { heading: '先排分，再用一个稳定规则打破平局', paragraphs: ['过滤零分候选。按得分从高到低排列，同分保留给定资料顺序。这样重跑题目时，返回的记录编号按相同顺序呈现。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `const rows = [{ id: 'R1', score: 1 }, { id: 'R2', score: 2 }, { id: 'R3', score: 2 }];
console.log(rows.filter(row => row.score > 0).sort((a, b) => b.score - a.score).map(row => row.id).join(','));` },
      { heading: '匹配列表需要再核对来源与范围', paragraphs: ['关键词没有命中时返回空候选，汇报无法计算或请人补查。即使有匹配，标签允许误差，仍应核对场次和状态。若限制只返回一项却需要完整统计，题目应改变查询范围或移除该限制。'] },
    ],
    pitfalls: [
      ['给重复关键词反复加分。', '查询格式会意外抬高分数。', '先去重，再逐词匹配。'],
      ['无命中时照样返回排第一的记录。', '无关资料可能变成答案来源。', '先丢弃零分，再限制数量。'],
    ],
    prompt: '把真实的片段标签与给定查询词逐个匹配，返回最高分的两条候选。',
    checkpoints: ['同分保留输入顺序，重复查询词只计算一次。', '空查询或没有命中时返回「无候选」。'],
    approach: '用 Set 去重。给每个资料片段评分，再过滤、排序并取前两条。',
    questions: [
      ['查询词为「讲解、讲解」，教程约定下每条记录的最高分是多少？', ['2', '1', '0', '与记录编号相同'], 1, '相同的词只计算一次。'],
      ['所有片段的得分都为 0，返回什么？', ['第一条', '按 ID 排序后的全部', '第二条', '空候选'], 3, '题目约定只保留正分片段。'],
      ['同分时为什么要明确先后？', ['同样的查询重跑可复现候选顺序', '让所有分数变大', '减少资料的真实时长', '代替核对来源'], 0, '稳定的并列规则便于比较和定位评估差异。'],
      ['检索结果有一条匹配「讲解」但状态为已取消，汇总已完成活动时怎样处理？', ['仍要相加', '改成已完成', '按状态规则排除', '把该记录记两次'], 2, '关键词只产生候选，业务范围由活动状态等字段决定。'],
    ],
    exercise: jsExercise('retrieve(records, words)', '  return "待实现";', `  const keywords = [...new Set(words.map(word => word.trim()).filter(Boolean))];
  const found = records.map(record => ({
    id: record.id, score: keywords.filter(word => record.tags.includes(word)).length,
  })).filter(record => record.score > 0);
  found.sort((first, second) => second.score - first.score);
  return found.slice(0, 2).map(record => record.id).join(',') || '无候选';`, `const records = [
  { id: 'R1', tags: ['讲解'] },
  { id: 'R2', tags: ['讲解', '室内'] },
  { id: 'R3', tags: ['室内', '讲解'] },
];
console.log(retrieve(records, ['讲解', '讲解', '室内']));
console.log(retrieve(records, ['户外']));
console.log(retrieve(records, []));`, 'R2,R3\n无候选\n无候选'),
  }),
  makeLesson({
    id: 'ai-check-evidence',
    title: '核对证据引用与可重算结果',
    summary: '检查录入编号是否确实存在，以及它们能否支持范围、状态和数值。',
    primer: { lead: '读到「合计 45 分钟」时，把编号对应的原记录找出来，自己按同样的规则算一次。', terms: [
      ['可追溯引用', '输出中的编号可在给定资料中找到原文。'],
      ['范围', '依题意纳入统计的记录集合，例如 N1 已完成活动。'],
      ['资料不足', '在范围内有信息缺失，暂时无法得到可信的结果。'],
    ] },
    objectives: ['从给定候选计算证据范围和参考结果。', '区分引用、状态和数字的错误。'],
    sections: [
      { heading: '结构合格之后再读证据', paragraphs: ['先检查输出有 status、totalMinutes 和 refs。然后核对 refs 是否正好包含范围内的编号。一个未知编号、重复编号或无关场次编号都构成证据错误，即使合计碰巧相同。'] },
      { heading: '缺失与明确的 0 有不同含义', paragraphs: ['一条活动可明确记为 0 分钟，这是一条有效数值。null 表示资料缺失。如果符合范围的一条记录缺失，不应报告已知部分的合计。统一成 status 为 incomplete 且分钟数为 null。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `for (const durations of [[20, 25], [0, 25], [null, 25]]) {
  const incomplete = durations.some(minutes => minutes === null);
  console.log(incomplete ? '资料不足' : durations.reduce((sum, minutes) => sum + minutes, 0));
}` },
      { heading: '把答案写成复查得出的结论', paragraphs: ['筛选范围后依编号记录每行，再统一单位并求和。由于决定相关性的字段附在同一条记录里，读者能定位具体错误，例如引用了 N2 的记录，或把一小时算成一分钟。'] },
    ],
    pitfalls: [
      ['检查合计而跳过引用。', '不相关记录碰巧相加也可能得到相同结果。', '先核对编号，之后根据这些编号重算。'],
      ['用 if (!minutes) 判断资料缺失。', '数值 0 也会被误判。', '本练习用 minutes === null 判断。'],
    ],
    prompt: '检验给定候选中的 N1 已完成记录是否被完整引用，并复算合计或缺失状态。',
    checkpoints: ['R1、R2 共 45 分钟时能给出「通过」。', '同样的总数配未知引用判为证据错误；缺失活动需要 incomplete 与 null。'],
    approach: '从范围内的记录得到正确引用列表，检查编号数量和集合，再按 null 与总数规则核对回答。',
    questions: [
      ['合计是 45，但引用了不存在的编号，应该判为？', ['通过', '换算失败', '查询超时', '证据错误'], 3, '数字不能替代对原始引用的核对。'],
      ['合格记录中有一条分钟数明确为 0，怎样处理？', ['作为已知值参与核算', '当作 null', '排除这个编号', '改成 1'], 0, '0 是题目允许的实际分钟数。'],
      ['合格记录缺时长时，约定的 totalMinutes 是？', ['已知条目之和', '0', 'null', '空字符串'], 2, 'incomplete 状态意味着没有可核验的完整合计。'],
      ['两个不同编号里有一条在范围外，应何时排除？', ['输出之后', '求和之前', '先按名称排序后不再筛选', '只在结果很大时'], 1, '先确定符合规则的记录，才能知道该核算哪些值。'],
    ],
    exercise: jsExercise('grade(records, answer)', '  return "待实现";', `  const relevant = records.filter(row => row.site === 'N1' && row.done);
  const ids = relevant.map(row => row.id);
  if (new Set(answer.refs).size !== ids.length || answer.refs.length !== ids.length || !ids.every(id => answer.refs.includes(id))) {
    return '证据错误';
  }
  const missing = relevant.some(row => row.minutes === null);
  const expectedStatus = missing ? 'incomplete' : 'ok';
  const expectedSum = missing ? null : relevant.reduce((sum, row) => sum + row.minutes, 0);
  return answer.status === expectedStatus && answer.totalMinutes === expectedSum ? '通过' : '结论错误';`, `const records = [
  { id: 'R1', site: 'N1', done: true, minutes: 20 },
  { id: 'R2', site: 'N1', done: true, minutes: 25 },
  { id: 'R3', site: 'N2', done: true, minutes: 25 },
];
console.log(grade(records, { status: 'ok', totalMinutes: 45, refs: ['R1', 'R2'] }));
console.log(grade(records, { status: 'ok', totalMinutes: 45, refs: ['R1', 'X9'] }));
records[1].minutes = null;
console.log(grade(records, { status: 'incomplete', totalMinutes: null, refs: ['R1', 'R2'] }));
console.log(grade(records, { status: 'ok', totalMinutes: 20, refs: ['R1', 'R2'] }));`, '通过\n证据错误\n通过\n结论错误'),
  }),
  makeLesson({
    id: 'ai-batch-error-types',
    title: '用一批给定样本定位首个错误',
    summary: '把格式、检索、证据与业务结论分开核对，统计各类样本的通过率。',
    primer: { lead: '一次评估像抽查一批记录。先确定每条怎样算合格，再从失败分布决定回查哪里。', terms: [
      ['首个失败点', '按约定顺序检查时遇到的第一处错误。'],
      ['分组计数', '记录不同场景通过数和总量，如缺值组 1/2。'],
      ['保留样本', '在调整提问或检索前保留的独立案例。'],
    ] },
    objectives: ['实现固定的逐案判定顺序。', '说明整体通过率和各场景通过率各能发现什么。'],
    sections: [
      { heading: '为什么先读最早出现的问题', paragraphs: ['若输出不是可解析的 JSON，就无法可靠读取字段。若候选缺少已知必需证据，即使输出引用了某些候选，也应先定位检索漏项。其余依次核对引用和结论，保证一个样本不会在统计中被重复归类。'] },
      { heading: '用可读的分类计数定位问题', paragraphs: ['为每条样本记录期望范围、候选和检查结果。看整体通过数时保留分母，也报各组通过数。下面这四项里有两项通过，进一步分析时还需保留各样本所属的组。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `const outcomes = ['通过', '证据错误', '通过', '结论错误'];
console.log(outcomes.filter(value => value === '通过').length + '/' + outcomes.length);` },
      { heading: '留一个困难案例给下一次验证', paragraphs: ['如果根据缺失时填 0 的失败来修改提示，之后用另一条含 0 和缺失的混合记录来检查转移能力。固定输入和参考答案，允许人工重算，记录每个组有哪些数据。'] },
    ],
    pitfalls: [
      ['只报告 80% 通过。', '普通组越多，越容易盖住少数边界组全面失败。', '报告总体数、各组的分母和错误类型。'],
      ['用同一批样本迭代和检验新情况。', '练习可能只适应了固定案例。', '保留部分样本直到最后再评估。'],
    ],
    prompt: '将给定检查状态转成首个错误分类并统计各分类的样本数量。',
    checkpoints: ['无法解析且证据错误时，只记格式错误。', '检索缺证与引用错误分别记数，合格项计入通过。'],
    approach: '从格式、检索、引用、结论顺序查找首个失败条件。用一个对象保存分类计数，并按固定顺序打印。',
    questions: [
      ['JSON 无法解析，同时表面上也缺字段，首先记录？', ['格式错误', '结论错误', '证据错误', '四项都失败'], 0, '最早的格式问题使后续字段检查无法可靠执行。'],
      ['候选遗漏正确记录，正确输出从材料中无从产生，先查？', ['排序后的输出格式', '检索及取候选范围', '小时换算', '最终通过率'], 1, '先找必须资料为何没有进入候选。'],
      ['整体 8/10，缺值组 0/2，这两个结果怎样报告？', ['只写 0%', '只写 80%', '整体 80%，缺值组 0/2', '把两组取平均得到 40%'], 2, '两个分母回答不同的问题，应该一起展示。'],
      ['保留样本被加入提示作为示例后，需要怎样恢复独立评估？', ['只把名称改掉', '重新跑同样样本', '认为保留不受影响', '加入未用于调整、能独立核对的用例'], 3, '加入提示的样本可以回归复查，新保留样本检验未看过的情况。'],
    ],
    exercise: jsExercise('countChecks(samples)', '  return "待实现";', `  const labels = ['格式错误', '检索漏项', '证据错误', '结论错误', '通过'];
  const counts = [0, 0, 0, 0, 0];
  for (const checks of samples) {
    const firstFailure = checks.indexOf(false);
    counts[firstFailure < 0 ? 4 : firstFailure] += 1;
  }
  return labels.map((label, index) => label + ':' + counts[index]).join(' ');`, `const samples = [[false, true, false, false], [true, false, false, false], [true, true, false, true],
  [true, true, true, false], [true, true, true, true], [true, true, true, true]];
console.log(countChecks(samples));`, '格式错误:1 检索漏项:1 证据错误:1 结论错误:1 通过:2'),
  }),
]

const aiFoundation: Project = {
  title: '校园活动问答评测',
  summary: '用给定词表和概率表手算生成过程，写出证据约束，并核对固定的回答样本。',
  requirements: [
    '用最长片段优先从左向右编码「北 星图。」，计算总容量 100、包装 10、说明 25、预留输出 20 时可留给资料的容量。',
    '候选 A 和 B 分别为 0.60、0.40，随机数 0.75 采样，比较贪心选项。A、B 的立即结束概率分别为 0.30、0.80，给出两条完整路径概率。',
    '写一段任务说明，要求仅汇总 N1 已完成活动、用分钟、引用全部相关编号。范围内任一缺值输出 incomplete 与 null，报告上显示「资料不足」。',
    '对给定的回答样本依次核对结构、引用和结论；检测引用错误、重复引用、缺资料时填数字。',
  ],
  examples: [
    { label: '编码、预算与采样', input: '北 星图。；总容量 100；随机数 0.75。', expected: '20,40,6,31；资料可占 45 个 token；贪心 A、抽到 B、路径概率 0.18 和 0.32。' },
    { label: '已知资料', input: 'N1 完成记录 R1=20、R2=25；N2 记录 R3=25。', expected: 'ok，45 分钟，引用 R1、R2。' },
    { label: '少一条时长', input: 'R2 时长为空，仍是 N1 已完成活动。', expected: '资料不足：incomplete、null，仍引用 R1、R2。' },
    { label: '错引同数值记录', input: '输出 45，但引用 R1、R3。', expected: '证据错误，即使 R3 和 R2 都是 25 分钟。' },
  ],
  exercises: [
    jsExercise('work(text, vocabulary, randomValue)', '  // 先编码，再算预算、贪心、采样与两条路径。\n  return "待实现";', `  const pieces = Object.keys(vocabulary).sort((first, second) => second.length - first.length);
  const ids = [];
  let position = 0;
  while (position < text.length) {
    const token = pieces.find(piece => text.startsWith(piece, position));
    if (!token) return '词表无法编码';
    ids.push(vocabulary[token]);
    position += token.length;
  }
  const budget = 100 - 10 - 25 - 20;
  const sampled = randomValue < 0.60 ? 'A' : 'B';
  const pathA = (0.60 * 0.30).toFixed(2);
  const pathB = (0.40 * 0.80).toFixed(2);
  return '编号=' + ids.join(',') + ' 预算=' + budget + ' 贪心=A 采样=' + sampled + ' 路径=' + pathA + ',' + pathB;`, `const vocabulary = { '星图': 6, '星': 11, '图': 14, '北': 20, '。': 31, ' ': 40 };
console.log(work('北 星图。', vocabulary, 0.75));
console.log(work('星图', vocabulary, 0.60));
console.log(work('北山', vocabulary, 0.10));`, '编号=20,40,6,31 预算=45 贪心=A 采样=B 路径=0.18,0.32\n编号=6 预算=45 贪心=A 采样=B 路径=0.18,0.32\n词表无法编码', '编码与采样工作表'),
    jsExercise('review(records, output)', '  // 格式 → 引用编号 → 资料状态与总和。\n  return "待实现";', `  if (!output || !['ok', 'incomplete'].includes(output.status) || !Array.isArray(output.refs)
      || !(output.totalMinutes === null || Number.isInteger(output.totalMinutes))) return '格式错误';
  const valid = records.filter(row => row.site === 'N1' && row.status === '已完成');
  const ids = valid.map(row => row.id);
  const refs = new Set(output.refs);
  if (refs.size !== ids.length || output.refs.length !== ids.length || ids.some(id => !refs.has(id))) return '证据错误';
  const missing = valid.some(row => row.minutes === null);
  const total = missing ? null : valid.reduce((sum, row) => sum + row.minutes, 0);
  const status = missing ? 'incomplete' : 'ok';
  if (output.status !== status || output.totalMinutes !== total) return '结论错误';
  return missing ? '通过：资料不足' : '通过：' + total + ' 分钟';`, `const records = [
  { id: 'R1', site: 'N1', status: '已完成', minutes: 20 },
  { id: 'R2', site: 'N1', status: '已完成', minutes: 25 },
  { id: 'R3', site: 'N2', status: '已完成', minutes: 25 },
  { id: 'R4', site: 'N1', status: '已取消', minutes: 10 },
];
console.log(review(records, { status: 'ok', totalMinutes: 45, refs: ['R1', 'R2'] }));
console.log(review(records, { status: 'ok', totalMinutes: 45, refs: ['R1', 'R3'] }));
console.log(review(records, { status: 'ok', totalMinutes: 45, refs: ['R1', 'R2', 'R2'] }));
records[1].minutes = null;
console.log(review(records, { status: 'incomplete', totalMinutes: null, refs: ['R1', 'R2'] }));
console.log(review(records, { status: 'ok', totalMinutes: 20, refs: ['R1', 'R2'] }));
console.log(review(records, { status: 'ok', totalMinutes: '20', refs: ['R1', 'R2'] }));`,
    '通过：45 分钟\n证据错误\n证据错误\n通过：资料不足\n结论错误\n格式错误', '按给定样本核对回答'),
  ],
  explanation: '先按教学规则手算分词和概率。任务说明可写成「只汇总 N1 已完成活动，统一用分钟，输出 status、totalMinutes 与完整 refs。有符合范围的缺值时，status 写 incomplete，totalMinutes 写 null，并仍引用缺值记录」。样本里的回答已经提供，可逐一复算。',
}

const aiAdvanced: Project = {
  title: '校园办事问答评测台',
  summary: '从未筛选资料中切分和检索，再核对固定回答，报告每类错误。',
  requirements: [
    '每行资料按 给定编号|场次|活动状态|分钟数|标签 切分，保留编号，破折号表示时长缺失，标签用逗号分隔。',
    '从全部片段中逐个匹配查询词，去重后每词一分，过滤零分，按分数降序和原文顺序取题目指定数量。',
    '对每条样本按格式、检索是否覆盖基准证据、引用与结论依次检查。引用集合必须等于基准范围，每个编号仅出现一次。',
    '报告逐条状态和整体通过数。用给定的正常、缺值、错误引用、格式错误和截断候选用例复查。',
  ],
  examples: [
    { label: '检索并核对', input: '查询 N1、讲解，取前 3 条。R1=20、R2=25 为 N1 已完成。', expected: '候选 R1,R2,R3。引用 R1,R2 且合计 45 时通过。' },
    { label: '缺失与 0', input: '查询 N3，R4 明确为 0，R5 时长用 - 标记。', expected: '引用 R4、R5，incomplete 且 totalMinutes 为 null 时通过。' },
    { label: '候选上限导致漏项', input: '查询 N1、讲解，但只允许 1 个候选。', expected: '候选 R1，漏掉基准证据 R2，记为检索漏项。' },
    { label: '错误引用或响应格式', input: '有完整候选但引用 N2 的 R3，或回答是无效 JSON。', expected: '分别记为证据错误、格式错误。' },
  ],
  exercises: [
    jsExercise('evaluate(source, sample)', `  // 1. 切分资料、保留来源编号。
  // 2. 从全部片段检索，按分数取候选。
  // 3. 按约定核对输出，返回「分组 候选编号 分类」。
  return sample.group + ' 待实现';`, String.raw`  const records = source.split('\n').filter(line => line.trim()).map(line => {
    const [id, site, status, duration, labels] = line.split('|');
    return { id, site, status, minutes: duration === '-' ? null : Number(duration), tags: labels.split(',') };
  });
  const keywords = [...new Set(sample.keywords)];
  const candidates = records.map(record => ({
    ...record, score: keywords.filter(word => record.tags.includes(word)).length,
  })).filter(record => record.score > 0).sort((a, b) => b.score - a.score).slice(0, sample.limit);
  const result = reason => sample.group + ' ' + (candidates.map(record => record.id).join(',') || '无候选') + ' ' + reason;

  let output;
  try { output = JSON.parse(sample.answer); } catch { return result('格式错误'); }
  if (!output || !Array.isArray(output.refs) || output.refs.some(id => typeof id !== 'string')
      || !['ok', 'incomplete'].includes(output.status)
      || !(output.totalMinutes === null || Number.isInteger(output.totalMinutes))) return result('格式错误');
  const allFound = sample.requiredIds.every(id => candidates.some(record => record.id === id));
  if (!allFound) return result('检索漏项');
  const relevant = candidates.filter(record => record.site === sample.site && record.status === '已完成');
  const relevantIds = relevant.map(record => record.id);
  if (output.refs.length !== relevantIds.length || relevantIds.some(id => !output.refs.includes(id))
      || relevantIds.length !== sample.requiredIds.length || relevantIds.some(id => !sample.requiredIds.includes(id))) return result('证据错误');
  const missing = relevant.some(record => record.minutes === null);
  const total = missing ? null : relevant.reduce((sum, record) => sum + record.minutes, 0);
  const status = missing ? 'incomplete' : 'ok';
  return result(output.status === status && output.totalMinutes === total ? '通过' : '结论错误');`, String.raw`const source = [
  'R1|N1|已完成|20|N1,讲解', 'R2|N1|已完成|25|N1,讲解', 'R3|N2|已完成|25|N2,讲解',
  'R4|N3|已完成|0|N3,布置', 'R5|N3|已完成|-|N3,布置', 'R6|N1|已取消|10|N1,布置',
].join('\n');
const normal = {
  group: '普通', keywords: ['N1', '讲解'], site: 'N1', limit: 3, requiredIds: ['R1', 'R2'],
  answer: '{"status":"ok","totalMinutes":45,"refs":["R1","R2"]}',
};
const cases = [normal,
  { group: '缺值', keywords: ['N3', 'N3'], site: 'N3', limit: 2, requiredIds: ['R4', 'R5'],
    answer: '{"status":"incomplete","totalMinutes":null,"refs":["R4","R5"]}' },
  { ...normal, group: '截断', limit: 1 },
  { ...normal, group: '错引', answer: '{"status":"ok","totalMinutes":45,"refs":["R1","R3"]}' },
  { ...normal, group: '格式', answer: '{bad' },
  { ...normal, group: '错算', answer: '{"status":"ok","totalMinutes":20,"refs":["R1","R2"]}' },
];
const results = cases.map(sample => evaluate(source, sample));
for (const item of results) console.log(item);
console.log('通过 ' + results.filter(item => item.endsWith(' 通过')).length + '/' + cases.length);`,
      '普通 R1,R2,R3 通过\n缺值 R4,R5 通过\n截断 R1 检索漏项\n错引 R1,R2,R3 证据错误\n格式 R1,R2,R3 格式错误\n错算 R1,R2,R3 结论错误\n通过 2/6', '运行批量检索与评估'),
  ],
  explanation: '基准证据专供判卷；候选必须从原始资料独立检索。遇到样本失败时，从第一处失败回查切分、候选截断、编号或计算规则。固定样本可在浏览器重跑。',
}

const rosLessons = [
  makeLesson({
    id: 'ros-message-contracts',
    title: '检查话题上的消息契约',
    summary: '用稳定的站点编号、序号和单位检查虚拟温度读数。',
    primer: { lead: '发送和接收的两边先约好消息是什么，再谈收到后怎样显示。', terms: [
      ['消息类型', '通信双方对字段及其类型的约定。'],
      ['序号', '同一来源每次发布的编号，可帮助检测跳号与重复。'],
      ['单位', '测量值采用的标度，如摄氏度。字段名称和接口说明都应一致。'],
    ] },
    objectives: ['分别检查话题、类型和字段的含义。', '用序号找出可能需要复查的读数缺口。'],
    sections: [
      { heading: '把话题和数据字段写进接口表', paragraphs: ['本题统一用 /station/temperature 和 TemperatureReading，字段有 site、seq、celsius。site 取 east 或 west，seq 从 1 开始递增，celsius 是有限数值。名称相同但字段意义不同会导致面板错误，例如把华氏值送进 celsius。'] },
      { heading: '在使用前检查字段类型', paragraphs: ['Number.isFinite(20.5) 为真，Number.isFinite("20.5") 为假。按固定接口要求接收数字有助于早发现上游错误。真实 ROS 2 会在通信层匹配类型，业务字段值仍由应用判断。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `for (const value of [20.5, '20.5', Infinity]) console.log(Number.isFinite(value));` },
      { heading: '按唯一来源追踪序号', paragraphs: ['东站收到第 1 条和第 3 条时，可以把 2 列为当前缺口。西站的第 2 条不能填补东站缺口。实际系统还需区分重启、乱序和丢包，本课练习采用同一来源严格递增的事件。'] },
    ],
    pitfalls: [
      ['直接把字符串温度当作数值。', '后续比较或求和行为与接口约定不一致。', '先检查类型和有限性。'],
      ['用一个序号追踪所有观测站。', '西站读数会打断东站的序号检查。', '每个站点独立保留最后序号。'],
    ],
    prompt: '补全 inspect，拒绝不合契约的消息，并报告正常读数或当前站点的序号跳变。',
    checkpoints: ['东站由 1 到 3 时报告一个缺口。', '西站首条不造成跳号，字符串温度和未知站点均被拒绝。'],
    approach: '先校验站点、整数序号和有限温度。在写入 last 之前保存上一次观察，比较两次序号。',
    questions: [
      ['celsius 的类型应是什么？', ['任意字符', '布尔值', '有限数值', '只允许整数文本'], 2, '题目中的读数允许小数，字段类型约定为有限数值。'],
      ['东站现收到 1、3，西站也收到 2，能确认什么？', ['东站目前的日志仍缺第 2 条', '东站的第 2 条已经补齐', '有三个东站读数', '东站 3 是重复'], 0, '序号需要与来源一起使用。'],
      ['两端都用浮点字段，但把摄氏和华氏混用会怎样？', ['一定匹配失败', '统一转成摄氏', '字段自动变整数', '通信可以匹配，读数含义会错'], 3, '传输类型和测量单位是两个契约。'],
      ['Number.isFinite("21") 在此应当为？', ['true', 'false', '21', '无法执行'], 1, 'Number.isFinite 不把字符串转成数值。'],
    ],
    exercise: jsExercise('inspect(message, last)', '  return "待实现";', `  const { site, seq, celsius } = message;
  if (!['east', 'west'].includes(site) || !Number.isInteger(seq) || seq < 1 || !Number.isFinite(celsius)) return '无效读数';
  const previous = last[site];
  last[site] = seq;
  if (previous !== undefined && seq > previous + 1) return site + ' 缺 ' + (seq - previous - 1) + ' 条';
  return site + ' 收到第 ' + seq + ' 条';`, `const last = {};
for (const packet of [
  {site:'east',seq:1,celsius:20}, {site:'west',seq:2,celsius:22}, {site:'east',seq:3,celsius:23},
  {site:'east',seq:4,celsius:'25'}, {site:'roof',seq:1,celsius:24},
]) console.log(inspect(packet, last));`, 'east 收到第 1 条\nwest 收到第 2 条\neast 缺 1 条\n无效读数\n无效读数'),
  }),
  makeLesson({
    id: 'ros-connection-qos',
    title: '逐段检查连接与 QoS 兼容性',
    summary: '对同一发布端分别检查面板和归档的名称、类型及可靠性要求。',
    primer: { lead: '有订阅者还要核对它订对了话题、认得消息类型，并接受发布端提供的服务质量。', terms: [
      ['QoS', '规定通信端对可靠性、历史等属性的要求或承诺。'],
      ['发布端提供', '发布者能提供的策略，例如可靠或尽力而为。'],
      ['订阅端请求', '订阅者为配对所要求的策略。'],
    ] },
    objectives: ['逐个订阅端对比匹配条件。', '区分配对兼容与日志显示的实际收到。'],
    sections: [
      { heading: '先检查名称和类型', paragraphs: ['两个端点必须约定同一话题名称和类型。拼写或命名空间有偏差时，即使同样选择可靠也无法按预期通信。日志中保留完整的解析后名称和消息类型，便于检查具体哪对端点不匹配。'] },
      { heading: '从提供到请求判断方向', paragraphs: ['发布端提供尽力而为时，不能满足要求可靠的订阅端。发布端提供可靠可满足要求尽力而为的订阅端。只比较这一项时，可令 reliable 的级别为 1、bestEffort 为 0，再逐对比较。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `const level = { bestEffort: 0, reliable: 1 };
console.log(level.reliable >= level.bestEffort);
console.log(level.bestEffort >= level.reliable);` },
      { heading: '从兼容性继续查实际接收', paragraphs: ['课堂模拟默认其他策略兼容。观察日志时先看发布端是否发出，再看每个订阅端是否有对应序号。两个端点配置兼容，也需要端点发现和实际投递才能看到读数。'] },
    ],
    pitfalls: [
      ['把订阅请求当作发布保证。', '比较方向颠倒会误判配对。', '明确写出发布提供和订阅请求。'],
      ['看到一个订阅端收到就认定所有端都正常。', '面板和归档可能拥有不同的类型或 QoS。', '独立检查每个接收端，并核对日志。'],
    ],
    prompt: '判断发布端与每个订阅端的首个不匹配原因，并列出可靠升级后的结果。',
    checkpoints: ['原始发布端可匹配面板，归档提示可靠性不足。', '更改发布端为可靠后，归档匹配，错名称和错类型仍分别被标记。'],
    approach: '先比较话题，再比较类型，最后检查可靠性。用相同输入分别运行原始与升级后的发布端。',
    questions: [
      ['发布端提供尽力而为、订阅端要求可靠时，可靠性兼容吗？', ['兼容', '不兼容', '只要有两个订阅端就兼容', '只看发布次数'], 1, '发布端提供的策略达不到订阅端的最低要求。'],
      ['两边名称不同但都选可靠，先修哪里？', ['采样频率', '温度初始值', '序号从哪里开始', '实际解析后的话题名称'], 3, '参与匹配的名称应一致。'],
      ['只看可靠性，发布端提供可靠时能与尽力而为的订阅端匹配吗？', ['能', '不能', '要订阅者再发一次消息', '只有日志节点能'], 0, '可靠这个提供级别能够满足尽力而为的要求。'],
      ['确认某条消息确实送到面板，应该检查？', ['其他话题的数量', '发送代码的行数', '面板日志中相同来源与序号的接收记录', '是否有归档目录'], 2, '接收日志比仅检查配置更直接。'],
    ],
    exercise: jsExercise('compare(publisher, subscriber)', '  return "待实现";', `  if (publisher.topic !== subscriber.topic) return '话题不符';
  if (publisher.type !== subscriber.type) return '类型不符';
  if (publisher.reliability === 'bestEffort' && subscriber.reliability === 'reliable') return '可靠性不足';
  return '兼容';`, `const pub = { topic: '/temp', type: 'TemperatureReading', reliability: 'bestEffort' };
const receivers = [pub, { ...pub, reliability: 'reliable' }, { ...pub, topic: '/raw' }, { ...pub, type: 'String' }];
for (const receiver of receivers) console.log(compare(pub, receiver));
console.log(compare({ ...pub, reliability: 'reliable' }, receivers[1]));`, '兼容\n可靠性不足\n话题不符\n类型不符\n兼容'),
  }),
  makeLesson({
    id: 'ros-timeout-state',
    title: '用请求编号和截止时间更新面板',
    summary: '让当前请求的成功、未知编号及超时各自对应清楚的界面状态。',
    primer: { lead: '面板只更新正在等待的工单。过期的信和上一张工单的信都不能覆盖当前显示。', terms: [
      ['截止时间', '客户端承诺等待回复到哪个时刻。'],
      ['请求编号', '面板为一次查询分配的 ID，用来识别哪个回复属于当前选择。'],
      ['业务结果', '收到成功响应后正文表达的结果，如传感器不存在。'],
    ] },
    objectives: ['区分超时、确实不存在和收到数据。', '使用给定时间重现迟到响应。'],
    sections: [
      { heading: '先定义明确的时限规则', paragraphs: ['本模拟在 time >= deadline 时判为超时。请求由 request 事件开始，交给给定时间和编号驱动，不依赖真实计时。收到与当前 ID 匹配、在时限内的消息才处理 found 与 unit。'] },
      { heading: '成功回包里的 false 是业务信息', paragraphs: ['found 为 false 说明服务答复传感器不在配置表中。超时只说明没按时收到结果。两者显示不同状态，出现超时时可保留之前已确认的温度单位并标注它属于上次确认。'] },
      { heading: '旧请求先返回时保留当前显示', paragraphs: ['用户先发 11 查室内，再发 12 查楼顶。收到 11 的迟到回复时比较编号，直接保留当前状态。请求已经超时后也不能由同 ID 的迟到响应改变状态，应由一次新请求重新查询。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `const current = { id: 12, deadline: 8 };
for (const reply of [{ id: 11, time: 5 }, { id: 12, time: 7 }, { id: 12, time: 8 }]) {
  console.log(reply.id === current.id && reply.time < current.deadline);
}` },
    ],
    pitfalls: [
      ['把超时显示为不存在。', '查询服务可能已经处理或仍在回复。', '区分明确的 found=false 和超时。'],
      ['允许旧编号的回复更新当前值。', '用户看到的结果可能对应上一次选择。', '先确认当前 ID，再处理业务正文及时间。'],
    ],
    prompt: '给定一个待处理请求，用编号与时间判断回复，再返回业务显示。',
    checkpoints: ['旧编号仍显示等待；同编号且按时回复时查看 found。', '恰好到截止时间也判超时，found=false 单独显示未知传感器。'],
    approach: '先区分旧编号，再比较时间，最后处理 found。',
    questions: [
      ['请求 11 和 12 已发送，当前等待 12，收到 11 应怎样更新？', ['保留当前状态', '显示 11 的单位', '将 12 标成失败', '开始新的计时器'], 0, '回复必须对应当前的请求编号。'],
      ['本题截止时刻为 8，同一请求在 8 时收到算什么？', ['成功', '未知编号', '超时', '总是等待'], 2, '题目定义大于等于截止时间都算超时。'],
      ['何时可显示「未知传感器」？', ['任何超时时', '按时收到当前请求的 found=false', '一点击查询就显示', '收到旧编号的 found=false'], 1, '只有有效业务回复能确认该条配置不存在。'],
      ['收到超时后的迟到回复，如果想获取新状态，应？', ['让它覆盖新请求结果', '把旧时间改成当前时间', '将 found 改为 true', '启动带新 ID 的查询'], 3, '为新请求分配编号，旧回复仍属于已结束的查询。'],
    ],
    exercise: jsExercise('display(current, reply)', '  return "待实现";', `  if (current.id !== reply.id) return '等待当前回复';
  if (reply.time >= current.deadline) return '查询超时';
  return reply.found ? reply.unit : '未知传感器';`, `const current = { id: 12, deadline: 8 };
for (const input of [
  { id: 11, time: 5, found: true, unit: 'fahrenheit' }, { id: 12, time: 7, found: true, unit: 'celsius' },
  { id: 12, time: 8, found: true, unit: 'celsius' }, { id: 12, time: 6, found: false },
]) console.log(display(current, input));`, '等待当前回复\ncelsius\n查询超时\n未知传感器'),
  }),
  makeLesson({
    id: 'ros-log-replay',
    title: '重放日志，定位不同状态之间的断点',
    summary: '以给定日志逐条重现读数缺口、旧回复和动作取消延迟，留下可复查的状态轨迹。',
    primer: { lead: '把出现问题时的事件按顺序放回面板，找出从哪一行开始偏离预期。', terms: [
      ['事件轨迹', '每条输入之后记录关键状态，帮助定位首次偏差。'],
      ['目标标识', '动作客户端和服务器各自关联同一个任务所用的 ID。'],
      ['终态', '动作明确结束的状态，例如已取消或成功。'],
    ] },
    objectives: ['为不同事件保留来源、请求或目标 ID。', '追踪取消提交、接受和最终结束。'],
    sections: [
      { heading: '挑选可以稳定重放的日志字段', paragraphs: ['一行日志记录时间、类别、参与方 ID 和数据。例如时间 2 收到温度第 3 条，时间 8 回复查询 11，时间 12 动作 g1 接受取消。重放时按给定顺序读，用最小事件序列复现问题。'] },
      { heading: '取消尚未结束时显示所处阶段', paragraphs: ['点击取消把界面改为「已申请取消」。服务端接受取消后变为「正在取消」。接到动作最终状态 CANCELED 后才变为「已取消」。如果动作最终为 SUCCEEDED，界面显示「成功」。每条事件只影响目标 ID 对应的动作。'], codeLanguage: 'JavaScript', run: { language: 'javascript' }, code: `const labels = { cancelRequest: '已申请取消', cancelAccepted: '正在取消', canceled: '已取消' };
for (const event of ['cancelRequest', 'cancelAccepted', 'canceled']) console.log(labels[event]);` },
      { heading: '按终态与最终显示比较', paragraphs: ['将期望轨迹写成「g1 执行中→已申请取消→正在取消→已取消」。成功或取消后，旧反馈只能用于日志，不能重置界面。一份联调记录应指出首次偏差事件和对应 ID，让下一次重放可以复检修复。'] },
    ],
    pitfalls: [
      ['点击取消立即画上已取消。', '动作可能仍在处理，甚至已经成功。', '最终结果到达后再显示终态。'],
      ['只对比轨迹最后一行。', '错误中间状态可能碰巧进入正确终态。', '把提交、接受、终态和旧反馈都写进预期。'],
    ],
    prompt: '把两个动作目标的给定事件逐步重放，保留每个事件处理后的界面状态。',
    checkpoints: ['g1 依次显示已申请取消、正在取消、已取消。', 'g2 仍能成功，g1 的终态不会被旧进度反馈改写。'],
    approach: '以目标 ID 为键保存状态。分配输入中的事件，遇到已结束目标便跳过旧事件。',
    questions: [
      ['用户刚发出取消、尚无服务端答复，界面显示？', ['已取消', '成功', '正在取消', '已申请取消'], 3, '取消请求已发出，还未被服务器确认处理。'],
      ['服务器确认接受取消，清理还在进行时显示？', ['已取消', '正在取消', '成功', '未知编号'], 1, '接受请求到动作进入终态之前仍在处理取消。'],
      ['g1 的终态已取消，旧的执行反馈到达，怎样处理？', ['改回执行中', '改成成功', '保留已取消，可在日志留旧反馈', '一并改变 g2'], 2, '最终结果决定显示，旧进度不应覆盖。'],
      ['重放定位首次偏差需要哪样数据？', ['每条关键事件后的实际与预期状态', '只记录最终标题', '只看消息总数', '换一个随机输入'], 0, '逐步状态可把异常限制在特定事件。'],
    ],
    exercise: jsExercise('replay(events)', '  return "待实现";', `  const labels = { cancelRequest: '已申请取消', cancelAccepted: '正在取消', canceled: '已取消', success: '成功', feedback: '执行中' };
  const goals = { g1: '执行中', g2: '执行中' };
  const trace = [];
  for (const [goal, event] of events) {
    if (!['已取消', '成功'].includes(goals[goal])) goals[goal] = labels[event];
    trace.push(goal + ' ' + goals[goal]);
  }
  return trace.join(' / ');`, `console.log(replay([['g1', 'cancelRequest'], ['g1', 'cancelAccepted'], ['g2', 'success'], ['g1', 'canceled'], ['g1', 'feedback']]));`,
      'g1 已申请取消 / g1 正在取消 / g2 成功 / g1 已取消 / g1 已取消'),
  }),
]

const rosFoundation: Project = {
  title: '虚拟观测站',
  summary: '用一组固定事件模拟温度发布、配置查询和生成报告的取消过程。',
  requirements: [
    '一条温度消息送给所有当前订阅者。记录节点未订阅时，仅面板接收。没有订阅者时依然可以发布。',
    '收到配置回复时区分正常结果与未知传感器。期限内无回复时显示「查询超时」。',
    '区分报告的「已申请取消」「正在取消」「已取消」。另一份报告可以正常完成。',
  ],
  examples: [
    { label: '发布扇出', input: '面板与记录节点都订阅、发布 21.5℃；记录节点随后退出。', expected: '第一条送达面板和记录节点，下一条只发送给面板。' },
    { label: '收到业务结果或超时', input: '配置回复正常、业务返回 found=false、截止未回复。', expected: '三个场景分别显示配置单位、未知传感器和查询超时。' },
    { label: '取消延期', input: '对 g1 先请求取消，后获接受，最后收到 CANCELED；g2 单独成功。', expected: 'g1 依次显示已申请取消、正在取消、已取消；g2 显示成功。' },
    { label: '没有订阅者', input: '面板和记录节点均未订阅；发布读数。', expected: '显示「无订阅者」，读数事件无需阻塞。' },
  ],
  exercises: [
    jsExercise('simulate(event)', '  // 按 type 处理 publish、reply、timeout 与 action。\n  return "待实现";', `  if (event.type === 'publish') {
    const receivers = [event.panel ? '面板' : '', event.logger ? '记录' : ''].filter(Boolean);
    return event.celsius + ' ℃ → ' + (receivers.join('、') || '无订阅者');
  }
  if (event.type === 'reply') return event.found ? '已收到配置 ' + event.unit : '未知传感器';
  if (event.type === 'timeout') return '查询超时';
  const states = { request: '已申请取消', accept: '正在取消', canceled: '已取消', succeeded: '成功' };
  return event.goal + ' ' + states[event.phase];`, `for (const event of [
  {type:'publish',celsius:21.5,panel:true,logger:true}, {type:'publish',celsius:22,panel:true,logger:false},
  {type:'publish',celsius:22.5,panel:false,logger:false}, {type:'reply',found:true,unit:'celsius'},
  {type:'reply',found:false}, {type:'timeout'}, {type:'action',goal:'g1',phase:'request'},
  {type:'action',goal:'g1',phase:'accept'}, {type:'action',goal:'g2',phase:'succeeded'}, {type:'action',goal:'g1',phase:'canceled'},
]) console.log(simulate(event));`, '21.5 ℃ → 面板、记录\n22 ℃ → 面板\n22.5 ℃ → 无订阅者\n已收到配置 celsius\n未知传感器\n查询超时\ng1 已申请取消\ng1 正在取消\ng2 成功\ng1 已取消', '逐条查看给定事件'),
  ],
  explanation: '画出采集到面板和记录节点的话题关系，再逐条写出预期。用不同事件表示实际收到的业务响应、等待超时和动作最终状态。',
}

const rosAdvanced: Project = {
  title: '虚拟观测站联调',
  summary: '从消息契约和连接配置出发，重放含读数缺口、旧回复和延迟取消的日志。',
  requirements: [
    '只接受来自 east 或 west 的 TemperatureReading，seq 为大于 0 的整数，celsius 为有限值。跳号后记录缺失数量，重复或更旧的序号不能改写最后值。',
    '核对话题、类型和可靠性；尽力而为的发布端不能满足要求可靠的订阅端。',
    '配置查询仅让当前且按时的请求更新显示。给定时刻达到截止时间即超时，迟到回复不得覆盖。',
    '以动作目标 ID 跟踪取消请求、接受和终态。终态出现后保留原值，并打印每条关键日志后的表现。',
  ],
  examples: [
    { label: '连接与缺读数', input: '面板请求尽力而为，归档请求可靠。面板收到东站 1 与 3，随后收到重复 3。', expected: '面板兼容，归档可靠性不足；发现缺 1 条，重复 3 忽略。' },
    { label: '旧回复和时限边界', input: '当前请求 12，先收 11；请求 13 的回复在截止时刻才到。', expected: '11 忽略，13 显示查询超时，迟到回复不能重新更新。' },
    { label: '延迟取消', input: 'g1 申请取消，两个事件后服务器才接受，再延迟报告最终 CANCELED。', expected: '先已申请取消，处理期间为正在取消，最终已取消；g2 的成功保持。' },
    { label: '拒绝无效读数', input: 'seq 为 4，但温度是字符串 "24"。', expected: '报告无效读数，最后确认的序号仍是 3。' },
  ],
  exercises: [
    jsExercise('replay(events)', `  // 分别记住最后读数、正在等待的查询以及各动作目标。
  // 对每条事件处理后，打印实际状态用于比对。
  return ['待实现'];`, `  const trace = [];
  const lastRead = {};
  let current = null;
  const goals = { g1: '执行中', g2: '执行中' };
  const terminal = ['已取消', '成功'];
  for (const event of events) {
    if (event.kind === 'connect') {
      const { publisher, receiver } = event;
      let reason = '兼容';
      if (publisher.topic !== receiver.topic) reason = '话题不符';
      else if (publisher.type !== receiver.type) reason = '类型不符';
      else if (publisher.reliability === 'bestEffort' && receiver.reliability === 'reliable') reason = '可靠性不足';
      trace.push(receiver.name + ' ' + reason);
    } else if (event.kind === 'reading') {
      const { site, seq, celsius, type } = event;
      if (type !== 'TemperatureReading' || !['east', 'west'].includes(site)
          || !Number.isInteger(seq) || seq < 1 || !Number.isFinite(celsius)) {
        trace.push('无效读数');
        continue;
      }
      const previous = lastRead[site];
      if (previous !== undefined && seq <= previous) {
        trace.push(site + ' 忽略旧序号 ' + seq);
        continue;
      }
      lastRead[site] = seq;
      const gap = previous === undefined ? 0 : seq - previous - 1;
      trace.push(site + ' 收到 ' + seq + (gap ? ' 缺 ' + gap + ' 条' : ''));
    } else if (event.kind === 'request') {
      current = { id: event.id, deadline: event.deadline, done: false };
      trace.push('查询 ' + event.id + ' 等待');
    } else if (event.kind === 'reply' || event.kind === 'timeout') {
      if (!current || current.id !== event.id || current.done) {
        trace.push('忽略旧查询 ' + event.id);
        continue;
      }
      if (event.time >= current.deadline) {
        current.done = true;
        trace.push('查询 ' + event.id + ' 超时');
      } else if (event.kind === 'reply') {
        current.done = true;
        trace.push('查询 ' + event.id + ' ' + (event.found ? event.unit : '未知传感器'));
      }
    } else if (event.kind === 'action') {
      const before = goals[event.goal];
      if (!terminal.includes(before)) {
        if (event.phase === 'request' && before === '执行中') goals[event.goal] = '已申请取消';
        if (event.phase === 'accept' && before === '已申请取消') goals[event.goal] = '正在取消';
        if (event.phase === 'canceled') goals[event.goal] = '已取消';
        if (event.phase === 'succeeded') goals[event.goal] = '成功';
      }
      trace.push(event.goal + ' ' + goals[event.goal]);
    }
  }
  return trace;`, `const publisher = {topic:'/temp',type:'TemperatureReading',reliability:'bestEffort'};
const reading = {kind:'reading',site:'east',type:'TemperatureReading'};
const events = [
  {kind:'connect',publisher,receiver:{...publisher,name:'面板'}},
  {kind:'connect',publisher,receiver:{...publisher,name:'归档',reliability:'reliable'}},
  {...reading,seq:1,celsius:20}, {...reading,seq:3,celsius:23}, {...reading,seq:3,celsius:23}, {...reading,seq:4,celsius:'24'},
  {kind:'request',id:11,time:3,deadline:7}, {kind:'request',id:12,time:4,deadline:8},
  {kind:'reply',id:11,time:5,found:true,unit:'fahrenheit'}, {kind:'reply',id:12,time:6,found:true,unit:'celsius'},
  {kind:'action',goal:'g1',phase:'request'}, {kind:'request',id:13,time:8,deadline:10},
  {kind:'reply',id:13,time:10,found:true,unit:'celsius'}, {kind:'reply',id:13,time:11,found:false},
  {kind:'action',goal:'g1',phase:'accept'}, {kind:'action',goal:'g2',phase:'succeeded'},
  {kind:'action',goal:'g1',phase:'canceled'}, {kind:'action',goal:'g1',phase:'feedback'},
];
for (const line of replay(events)) console.log(line);`, [
      '面板 兼容', '归档 可靠性不足', 'east 收到 1', 'east 收到 3 缺 1 条', 'east 忽略旧序号 3', '无效读数',
      '查询 11 等待', '查询 12 等待', '忽略旧查询 11', '查询 12 celsius', 'g1 已申请取消', '查询 13 等待',
      '查询 13 超时', '忽略旧查询 13', 'g1 正在取消', 'g2 成功', 'g1 已取消', 'g1 已取消',
    ].join('\n'), '重放虚拟观测站日志'),
  ],
  explanation: '按时间和输入顺序重放，区别配对、接收记录、查询结果以及动作进度。工作台运行的是固定 JavaScript 模拟，可以对照第一条出现差异的日志定位问题。',
}

export const systemsTracks: CurriculumTrack[] = [
  { direction: 'backend', foundationProject: backendFoundation, advanced: { lessons: backendLessons, project: backendAdvanced } },
  { direction: 'ai', foundationProject: aiFoundation, advanced: { lessons: aiLessons, project: aiAdvanced } },
  { direction: 'ros', foundationProject: rosFoundation, advanced: { lessons: rosLessons, project: rosAdvanced } },
]
