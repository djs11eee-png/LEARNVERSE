import type { AdvancedTrack } from '../types'
import { jsProgram, lesson, sqlProgram, worked } from './systemsSupport'

const lessons = [
  lesson({
    id: 'backend-idempotency-keys',
    title: '让同一报名请求可以安全重试',
    summary: '用提交者、幂等键与规范化内容识别重试，并复用第一次结果。',
    primer: { lead: '用户点了活动报名，界面没收到回执。他再点一次时，系统要找到先前那次办理结果。', terms: [
      ['幂等键', '由客户端为一次逻辑办理生成的标识，重试同一次办理时沿用。'],
      ['内容指纹', '按已约定字段和顺序表示请求内容，便于比较两次输入是否等价。'],
      ['结果回放', '取出首次保存的状态和正文，给相同请求重发，业务动作只执行一次。'],
    ] },
    objectives: ['区分请求次数和实际报名次数。', '说明令牌的作用域、输入冲突与结果保存的边界。'],
    sections: [
      { heading: '先画一次失去回执的提交', paragraphs: [
        '想象客户端在 10:00 发出报名请求。服务端落库得到 r1，回执却在中途丢失。客户端只知道自己没收到回复。它再用同一幂等键提交，服务端查到原结果，仍交回 r1。对外看见两次请求，对业务看见一次登记。因此重试前不能简单用“查不到客户端的回执”推断没有提交。',
        '键的有效范围要写清楚。课堂中按账号加幂等键查找，林同学和陈同学碰巧都选 key-1，他们应拥有各自的占位记录。真实接口可能将方法和路径也纳入范围。键的有效期必须与重试的时间窗口配套，超过保留期需规定查询既有结果或重新提交的流程。',
      ] },
      worked('把会影响办理结果的字段压成固定顺序', [
        '本题固定字段是 eventId 与 seatType。JSON 对象中字段写在前面还是后面，不会改变报名的意义。按照固定顺序把这两个字段组成数组，再用 JSON.stringify 生成便于比较的指纹。改 writeA 的字段顺序，观察等价关系仍然成立。试把 seatType 改掉，判断结果会在哪里变为 false。',
        '在正式系统中，接口要在生成指纹前定义大小写、空格和缺省值等规范化规则，也要校验字段是否齐全。示例把输入限制为已经校验的短字符串，方便直接观察顺序。只在指纹中放会影响办理的字段，客户端的诊断信息和本次重试次数不应改变报名含义。',
      ], `function fingerprint(body) {
  return JSON.stringify([body.eventId, body.seatType]);
}
const writeA = { eventId: 'a1', seatType: '普通' };
const retry = { seatType: '普通', eventId: 'a1' };
const changed = { eventId: 'a1', seatType: '无障碍' };
console.log(fingerprint(writeA) === fingerprint(retry));
console.log(fingerprint(writeA) === fingerprint(changed));`, 'true\nfalse'),
      worked('用两条查询决定是否可以重用原结果', [
        '查到了键时还要比较内容指纹。相同指纹返回保存的 201 与 r1。不同指纹则表示把同一个键用于另一笔办理，本题约定 409，并请调用者为新办理使用新键。若键还不存在，交给后续报名路径检查容量。调试时先输出是否命中，再输出同一键下指纹是否相等，便能区分重试与冲突。',
        '下例给出三个输入。把第二个 account 改成 chen，观察同样的 key-1 此时可以进入新办理。课堂方案保存成功响应；如果要缓存因输入错误产生的响应，也需提前规定错误响应在哪些情况下可复用。业务拒绝与暂时性故障的客户端处置不一样。',
      ], `const ledger = new Map([['lin:key-1', { fingerprint: '["a1","普通"]', response: '201 r1' }]]);
function inspect(account, key, eventId, seatType) {
  const previous = ledger.get(account + ':' + key);
  if (!previous) return '新办理';
  const current = JSON.stringify([eventId, seatType]);
  if (previous.fingerprint !== current) return '409 内容冲突';
  return previous.response;
}
console.log(inspect('lin', 'key-1', 'a1', '普通'));
console.log(inspect('lin', 'key-1', 'a1', '无障碍'));
console.log(inspect('chen', 'key-1', 'a1', '普通'));`, '201 r1\n409 内容冲突\n新办理'),
    ],
    pitfalls: [
      ['每次重试都生成新键。', '服务端无法把重试关联到上一次成功办理。', '一次逻辑办理生成一次键，直到完成前沿用。'],
      ['只存键而不核对请求内容。', '新输入被误判为前一笔，用户可能看到不相关回执。', '保存规范化后的内容指纹与首次响应。'],
    ],
    questions: [
      ['服务器返回报名已提交，但客户端没收到。重试时应沿用什么？', ['客户端的新时间戳', '原账号的原幂等键', '上一位用户的键', '任意空键'], 1, '原账号和原键标识同一次逻辑办理。'],
      ['相同账号与键，第二次改了活动编号，本题怎么处理？', ['删除旧记录', '再创建一笔', '返回旧的 201 并覆盖正文', '返回 409 内容冲突'], 3, '同一个键只能表示原来的请求内容。'],
      ['两份正文的字段前后顺序不同，如何比较相同业务含义？', ['按固定字段顺序生成指纹', '按原 JSON 文本逐字比', '仅比较正文长度', '略过内容校验'], 0, '字段顺序规范化让等价输入得到相同指纹。'],
      ['幂等键过期后仍可能重试，接口应该先明确什么？', ['把键变成数字', '每次都成功', '过期与查回结果的规则', '把有效期写进学员姓名'], 2, '保留期应配合重试窗口并处置超期请求。'],
    ],
    practice: {
      prompt: '补全 inspect。相同账号、键和活动使用原响应，内容变化提示冲突，新账号或新键进入新办理。',
      checkpoints: ['首次快照可通过同一键查到 201 与 r1。', '修改活动时返回 409，其他账号和键没有误用旧结果。'],
      hints: ['先按账号和键找之前的条目。没找到就报告新办理。', '找到条目后比较 eventId，匹配时取保存的 response。'],
      solution: '使用 scope 精确查找已保存的请求。在生成新记录之前判断内容是否与原请求一致。',
    },
    exercise: jsProgram('辨认重试与键冲突', 'inspect(entries, account, key, eventId)', '  return "待实现";', `  const previous = entries.get(account + ':' + key);
  if (!previous) return '新办理';
  if (previous.eventId !== eventId) return '409 内容冲突';
  return previous.response;`, `const entries = new Map([['lin:k1', { eventId: 'a1', response: '201 r1' }]]);
console.log(inspect(entries, 'lin', 'k1', 'a1'));
console.log(inspect(entries, 'lin', 'k1', 'a2'));
console.log(inspect(entries, 'chen', 'k1', 'a1'));
console.log(inspect(entries, 'lin', 'k2', 'a1'));`, [['原样重试', '201 r1'], ['同键新内容', '409 内容冲突'], ['其他账号', '新办理'], ['新键', '新办理']]),
  }),
  lesson({
    id: 'backend-concurrent-enrollment',
    title: '重放最后一个名额的并发竞争',
    summary: '用可控执行顺序复现竞争，并让写入阶段的容量检查和数据库约束守住边界。',
    primer: { lead: '两位同学看到最后一个空位，两个请求按同样顺序检查，都认为还有位置。', terms: [
      ['交错顺序', '多段处理过程的事件穿插到达，每段内部先后关系仍在。'],
      ['过时读数', '先前读到的状态在写入前已经发生变化，不能依赖它承诺新预约。'],
      ['唯一约束', '数据库拒绝使同一列或同一组列重复的写入。'],
    ] },
    objectives: ['逐步复现两个请求都看到余量的原因。', '解释容量和唯一性需要各自的保护条件。'],
    sections: [
      { heading: '把读取和真正写入拆成四格', paragraphs: [
        '假设活动只有一个空位。把「林读余量」「陈读余量」「林写入」「陈写入」写为四个事件。读取的两步都看到 1。如果写入只信之前读到的 1，两次写入都会成功。交换林和陈前后顺序仍会出现同样问题。一种新的执行顺序则可能碰巧不失败，所以不能只用顺利的顺序来验收。',
        '在练习里只用给定的事件列表和共享数组，重放可以每次走到同样的位置。实际多进程程序还要依靠数据库事务隔离或条件写入，在能互相排他的边界里重新验证。应用的在先查询可用于预览剩余位置，最终确认从写入路径取得。',
        '一种条件更新是只在 remaining > 0 时将 remaining 减一，再检查改变的行数是否为 1。若后续插入碰到同用户唯一约束，在同一事务中回滚，刚扣下的名额也会恢复。保留这个案例，可验证重复请求不会消耗剩余位置。',
      ] },
      worked('在预约最终确认时重新检查余量', [
        '例中的 observed 保存之前看到的值，模拟已经发出的预览。commit 真正修改共享数组前，先用当前的 rows.length 计算余量。先运行林读、陈读、林提交、陈提交。再交换两个提交顺序，观察胜出的名字交换，拒绝规则仍成立。检查某个用户名已存在也要读取当下的状态。',
        '这里每次调用同步执行，读取当前长度和追加不会被另一段代码插入。在真实应用中，多个进程同时访问数据库就不能假定这一点。课程第五行的 if 是写入保护的纸面表达，不是一种语言层的并发锁。接入数据库时，可考虑同事务更新容量并检查受影响行数。',
      ], `const rows = [];
const capacity = 1;
const observed = { lin: capacity - rows.length, chen: capacity - rows.length };
function commit(account) {
  if (rows.length >= capacity) return account + ' 满员';
  rows.push(account);
  return account + ' 成功';
}
console.log(observed.lin, observed.chen);
console.log(commit('lin'));
console.log(commit('chen'));`, '1 1\nlin 成功\nchen 满员'),
      worked('让两个字段一起决定是否重复报名', [
        '报名表可以用 UNIQUE(event_id, account) 表达同一用户对于同一个活动只报名一次。第二次插入 r2 时尝试重复 a1 与 lin，SQL 的 ON CONFLICT 指定这组字段冲突时跳过该行。随后换一个活动，仍可创建 r3。若需要返回重复原因，可以在业务层检查语句实际更改了几行，再返回相应状态。',
        '容量限制是另一条规则。就算账号不重复，两个人仍可能竞争同一个空位。请把检测重复和限制总人数分别写进验收，并包含「其他活动可报名」的案例。测试顺序还要交换提交次序，确认结果不依赖某个客户端总是先到。',
      ], `CREATE TABLE reservations(id TEXT PRIMARY KEY, event_id TEXT NOT NULL, account TEXT NOT NULL, UNIQUE(event_id, account));
INSERT INTO reservations VALUES ('r1','a1','lin');
INSERT INTO reservations VALUES ('r2','a1','lin') ON CONFLICT(event_id, account) DO NOTHING;
INSERT INTO reservations VALUES ('r3','a2','lin');
SELECT id, event_id, account FROM reservations ORDER BY id;`, 'id\tevent_id\taccount\nr1\ta1\tlin\nr3\ta2\tlin', 'sql'),
    ],
    pitfalls: [
      ['在看到还有位置时马上给用户成功承诺。', '提交前可能已经被其他请求占用。', '在写入保护边界内决定成功。'],
      ['以为唯一约束自动限制活动人数。', '不同账号可以同时满足唯一约束。', '用独立的容量保护和并发测试补充。'],
    ],
    questions: [
      ['林、陈读到剩余 1，林先提交成功。陈提交时应该检查？', ['林的姓名', '之前读过就直接创建', '写入时最新余量', '今天的日期'], 2, '预览值可能已经过时，写入路径应重新验证。'],
      ['UNIQUE(event_id, account) 对哪个组合生效？', ['同一活动同一账号', '所有活动总共只能一个账号', '只限制 event_id', '所有时间都不能重复'], 0, '两个字段合在一起才构成唯一条件。'],
      ['交换两个客户端的写入顺序有什么作用？', ['一定会增加容量', '把两个操作合成一个', '可以省去容量检查', '验证限制规则与哪位客户端先到无关'], 3, '正确规则对两种交错都能保持最多一个新报名。'],
      ['同步内存练习在真实多进程数据库中还要借助什么？', ['更多客户端格子', '受保护的事务或原子条件更新', '删除共享状态', '先把余量发给所有用户'], 1, '实际执行可能同时跨进程，必须用存储层保证。'],
    ],
    practice: {
      prompt: '重放 read 和 commit 事件。读取可以看到同一余量，提交检查实际占用，并区分重复与满员。',
      checkpoints: ['两个读请求都可看到 1，但两个不同提交仅成功一个。', '相同账号再次提交会报告重复，已有的成功编号仍留在占用中。'],
      hints: ['先在 read 分支写出 capacity - booked.length。', 'commit 分支先检查账号重复，再检查容量，最后追加。'],
      solution: '保存一份当前已报名数组，在事件到来时读取或更新它。每一步都记录结果，最后打印整条轨迹。',
    },
    exercise: jsProgram('重放竞争交错', 'replay(events, capacity)', '  return "待实现";', `  const booked = [];
  const trace = [];
  for (const [kind, account] of events) {
    if (kind === 'read') trace.push('读 ' + (capacity - booked.length));
    else if (booked.includes(account)) trace.push(account + ' 重复');
    else if (booked.length >= capacity) trace.push(account + ' 满员');
    else {
      booked.push(account);
      trace.push(account + ' 成功');
    }
  }
  return trace.join(' / ');`, `const reads = [['read','lin'], ['read','chen']];
console.log(replay([...reads, ['commit','lin'], ['commit','chen']], 1));
console.log(replay([...reads, ['commit','chen'], ['commit','lin']], 1));
console.log(replay([['commit','lin'], ['commit','lin']], 2));`, [
      ['林先提交', '读 1 / 读 1 / lin 成功 / chen 满员'],
      ['陈先提交', '读 1 / 读 1 / chen 成功 / lin 满员'],
      ['重复账号', 'lin 成功 / lin 重复'],
    ]),
  }),
  lesson({
    id: 'backend-outbox-replay',
    title: '让报名与待派发事件随同一事务提交',
    summary: '用 outbox 保存待发送事件，通过稳定事件编号、确认和去重恢复派发。',
    primer: { lead: '报名成功之后要通知登记台。如果服务在两步之间停掉，重启后仍应知道要补哪条通知。', terms: [
      ['事务型发件箱（outbox）', '和业务记录在同一事务写入的待派发事件表。'],
      ['确认', '接收者表示已处理某条事件，工作进程据此更新派发状态。'],
      ['重复交付', '同一事件可能因中途掉线再次送达，接收端按同一编号复用已有结果。'],
    ] },
    objectives: ['说明数据库提交与对外通知之间的故障窗口。', '跟踪同一编号的事件如何重放并去重。'],
    sections: [
      { heading: '标清本地数据库和登记台之间的边界', paragraphs: [
        '先写报名再立即发送，如果进程在两步之间退出，报名已成功却没有通知。先发送再写报名也会出问题：发送后报名可能因为满员回滚，但登记台已经记录过它。把报名和一条待发送事件放进同一个本地事务，提交通知才进入待办队列。之后由工作进程派发，不在数据库事务里等待外部响应。',
        '写入两张表的状态可以在同一 SQLite 事务内检查。发送端定期查询未确认事件，尝试投递，收到确认再改变发送状态。可以重试的时间由实际进程监测，课程用给定事件顺序模拟。需要记录错误原因和尝试次数，避免一条数据格式有误的事件不断占据所有派发机会。',
        '如果同一报名同时产生邮件与登记通知，两项各自确认，把同一个报名号当成唯一事件号可能误跳过第二条。用例可顺序重放「邮件收到两次、登记收到一次」，分别核对两个接收方各发生一次实际更新。',
      ] },
      worked('回滚时同时撤销预约与待发送记录', [
        '第一段事务写预约 r1 和事件 e1 并提交。第二段事务模拟在准备好 r2 和 e2 后发生故障，因此两者一起回滚。查询时只看最终状态：r1 对应 e1，r2 和 e2 都不留在表里。试把第二个 ROLLBACK 暂时改为 COMMIT，观察两个表会同时增加一行。',
        '事件表中每个 id 都独立唯一，并用 booking_id 关联业务记录。这个编号沿用到派发确认与后续重试。一笔登记可能发出多个不同业务事件，现实系统应分别给每条事件提供稳定编号。此处字段刻意很少，让你先核对每笔业务写入是否有对应的待办事件。',
      ], `PRAGMA foreign_keys = ON;
CREATE TABLE reservations(id TEXT PRIMARY KEY);
CREATE TABLE outbox(id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES reservations(id));
BEGIN;
INSERT INTO reservations VALUES ('r1');
INSERT INTO outbox VALUES ('e1','r1');
COMMIT;
BEGIN;
INSERT INTO reservations VALUES ('r2');
INSERT INTO outbox VALUES ('e2','r2');
ROLLBACK;
SELECT id FROM reservations ORDER BY id;
SELECT id, booking_id FROM outbox ORDER BY id;`, 'id\nr1\n\nid\tbooking_id\ne1\tr1', 'sql'),
      worked('模拟确认丢失与同一事件的第二次派发', [
        '某次发件箱派发的 e1 已经到达，但确认响应没有回来。发送方下次仍会尝试 e1，接收方通过 Set 保存处理过的编号，检查 e1 已经办理后继续回复确认。将第三个输入改为与第二个相同，试着预期印出第三行“已处理”。这样确认丢失只增加告知次数，不会重复更新登记台。',
        '练习里的 Set 随一次运行保留；真实接收方需要跨重启存住去重记录。记录“已处理”和更新接收方状态也应有一致的保存边界。只有在消费方自己的持久化边界里才可保证副作用发生一次；两边之间仍可能发生重复交付。验证时分别数发送次数和实际业务更新。',
      ], `const processed = new Set();
function receive(eventId) {
  if (processed.has(eventId)) return eventId + ' 已处理，重新确认';
  processed.add(eventId);
  return eventId + ' 写入登记台';
}
for (const eventId of ['e1', 'e1', 'e2']) console.log(receive(eventId));`, 'e1 写入登记台\ne1 已处理，重新确认\ne2 写入登记台'),
    ],
    pitfalls: [
      ['按发送次数生成新的事件 ID。', '派发重试无法与之前已经处理的事件关联。', '生成待办时固定 ID，后续每次使用原编号。'],
      ['发送后立即标记完成。', '派发返回前可能中断，接收方尚未实际处理。', '收到确认后再标已完成，接收端能处理重复派发。'],
    ],
    questions: [
      ['为什么业务记录和 outbox 要同事务？', ['方便统一排序', '事后关掉数据库连接', '保证都写入或都撤回', '使外部响应无需确认'], 2, '提交前两项仍在同一个回滚范围。'],
      ['发送端在接收者处理后、确认前崩溃，重启后可能怎样？', ['相同事件再次派发', '事件 ID 自动改变', '业务登记会撤销', '接收端的持久化记录一定丢失'], 0, '发送端还没有写下确认，可能会重放同一个事件。'],
      ['标记事件已处理应该保存在哪里？', ['发送前打印的日志即可', '客户端新标签页', '任意下一条请求里', '接收方可恢复的持久化状态'], 3, '接收方重启以后仍需辨认重复事件。'],
      ['发送重试的次数大于实际更新次数，能否符合要求？', ['永远不行', '可以，接收方按事件编号去重', '只能无限尝试', '要为每次重试创建新事件'], 1, '重复发送可由接收方去重，再返回确认。'],
    ],
    practice: {
      prompt: '补全派发模拟，用固定 ID 识别对同一事件的重复发送，分别报告尝试次数和实际应用次数。',
      checkpoints: ['e1 发送两次只应用一次。', '空列表为 0 次，三个不同事件全部应用。'],
      hints: ['每读一个事件都增加发送次数。', '用 Set 保存已处理过的编号。接收新编号才改变实际应用次数。'],
      solution: '逐项读取事件 ID，用集合记录处理过的编号。最终分别返回输入次数与去重后的实际写入次数。',
    },
    exercise: jsProgram('核对尝试与应用次数', 'deliver(events)', '  return "待实现";', `  const applied = new Set();
  for (const id of events) {
    if (!applied.has(id)) applied.add(id);
  }
  return '发送 ' + events.length + ' 应用 ' + applied.size;`, `for (const events of [['e1','e1','e2'], [], ['e1','e2','e3']]) console.log(deliver(events));`, [
      ['确认丢失后重试', '发送 3 应用 2'], ['没有待办', '发送 0 应用 0'], ['三个不同事件', '发送 3 应用 3'],
    ]),
  }),
  lesson({
    id: 'backend-recovery-scenarios',
    title: '用确定故障点检验服务能否恢复',
    summary: '在提交、回执和确认边界注入故障，比较重启前后的持久状态与结果。',
    primer: { lead: '恢复测试不靠反复点按钮碰运气。先标出每一步发生在提交前、提交后还是确认后。', terms: [
      ['故障注入', '在选定位置提供一个可重复的失败事件。'],
      ['持久状态', '进程重启后仍能读到的记录、结果和未确认事件。'],
      ['不变量', '任意合法事件序列都应维持的条件，如余位不能为负。'],
    ] },
    objectives: ['识别不同故障点会保留什么数据。', '设计同时验证快照、客户端结果和事件副作用的断言。'],
    sections: [
      { heading: '把每个故障点前后的事实写成表', paragraphs: [
        '做一张三行验收表。发生在事务提交前的中断应留下原样，恢复后重试可办理。提交后回执没有到达时，业务已办理，恢复后客户端沿用键可以读回原编号。登记台已处理、确认未到达时，发件箱仍显示待派发，恢复会重发，但接收方通过编号保留一次效果。这个表把故障时看见的现象与需要核实的原因对应起来。',
        '每个用例从同一个小初始状态重新开始，如 a1 有一个位置以及一个空的发件箱表。再加无故障的对照组，可以先排除种子数据、数据库约束或输出格式的问题。所有运行都从给定事件顺序开始，读者可以重跑并定位第一处不一致。',
        '另设一次确认已经写入、工作进程才停止的场景。恢复后待办列表应不含这个事件，派发次数不再增加。与确认未写入的故障对照，可以发现恢复任务错误地扫描全部历史事件的情况。',
      ] },
      worked('观察回执与提交状态对用户的不同含义', [
        '把过程切成三步：准备预约和事件、公开持久状态、给客户端回执。示例直接标出位置，用 before-commit 和 after-commit 两个字符串表示发生故障的位置。修改参数顺序，预期故障提示会相应变化；只有提交成功才有可回读的编号。恢复代码不宜根据有没有回执来修改容量。',
        '就算在最小模型里，也应同时返回是否提交、预约编号和客户端是否收到回执。启用自动断言前，先手算三行结果再运行。把正常分支的 receipt 临时写成 false，可以观察它与“已提交但无回执”的故障具有相同的可见信号。需要持久记录才能诊断哪次操作已生效。',
      ], `function simulate(fault) {
  if (fault === 'before-commit') return '提交=false 编号=无 回执=false';
  if (fault === 'after-commit') return '提交=true 编号=r1 回执=false';
  return '提交=true 编号=r1 回执=true';
}
for (const point of ['before-commit', 'after-commit', 'none']) console.log(simulate(point));`, '提交=false 编号=无 回执=false\n提交=true 编号=r1 回执=false\n提交=true 编号=r1 回执=true'),
      worked('为接受第二次办理之前核对三处状态', [
        '运行前把两个预期写在同一行：回复是否仍等于原编号，报名数和成功事件数是否都为 1。把它们组合成一个核对函数，可以调用几份已知快照验证断言本身。若重复请求误占两个名额，预期编号可能仍对，完整的核对仍会失败。也可以再加条检查，确认整个活动不会超出自己的容量。',
        '验收的输入应该保留故障步骤和哪条记录最先偏离。测试报告用场景名称帮助查找。真实系统可保存一段经过脱敏的事件轨迹，用相同的故障切点在测试环境重放。通过这里列出的若干场景只说明这些路径符合约定，更复杂的同时失败组合需要独立建模并扩展用例。',
      ], `function stateIsGood(snapshot) {
  return snapshot.id === 'r1' && snapshot.bookings === 1 && snapshot.events === 1;
}
console.log(stateIsGood({ id: 'r1', bookings: 1, events: 1 }));
console.log(stateIsGood({ id: 'r1', bookings: 2, events: 1 }));
console.log(stateIsGood({ id: 'r1', bookings: 1, events: 0 }));`, 'true\nfalse\nfalse'),
    ],
    pitfalls: [
      ['只看重试最终是 201。', '错误实现可能已创建两条记录。', '同时检查持久记录、未确认事件和实际更新。'],
      ['依赖真实休眠让竞争恰好发生。', '运行负载会改变顺序，失败难复现。', '显式给出事件和故障点，复现确定交错。'],
    ],
    questions: [
      ['提交前的故障应该留下什么预约和发件箱记录？', ['事务前已有数据', '新增预约但没有通知', '新增通知但没有预约', '自动删除整个库'], 0, '未提交的修改都在回滚的边界内。'],
      ['已提交但回执未达，客户端同键重试应怎样？', ['创建新编号', '先删原预约', '返回已有编号', '必须更换账号'], 2, '持久状态里原办理已存在。'],
      ['测试确认丢失时最有区分力的是？', ['只看记录颜色', '一起核对派发次数与实际更新次数', '用一次不稳定网络请求', '只检查键是否有字符'], 1, '两项计数体现是否做到重复派发仍只更新一次。'],
      ['不变量的一个有效示例是？', ['程序有四个函数', '回执需要任意编号', '失败时机器一定不重启', '任何时刻报名数都不超过容量'], 3, '容量条件适用于全部合法执行顺序。'],
    ],
    practice: {
      prompt: '计算给定故障点重启后的持久记录，再模拟同键重试，并返回执行前后快照。',
      checkpoints: ['提交前失败时快照为 0/0，恢复后为 1/1。', '提交后无回执时恢复中始终为 1/1，并返回原编号。'],
      hints: ['用 bookings 和 pending 记录两个可重启后读取的计数。', '若故障时已经提交，直接复用原编号；尚未提交才创建两项。'],
      solution: '从故障点推导重启时的持久快照。只有旧状态为空时安排新写入，最后记录恢复后的数值。',
    },
    exercise: jsProgram('根据故障点预测恢复快照', 'recover(point)', '  return "待实现";', `  let bookings = point === 'before-commit' ? 0 : 1;
  let pending = bookings;
  const before = bookings + '/' + pending;
  if (bookings === 0) {
    bookings += 1;
    pending += 1;
  }
  return before + ' → ' + bookings + '/' + pending + ' 201 r1';`, `for (const point of ['before-commit','after-commit','none']) console.log(recover(point));`, [
      ['提交前失败', '0/0 → 1/1 201 r1'], ['提交后失去回执', '1/1 → 1/1 201 r1'], ['健康对照', '1/1 → 1/1 201 r1'],
    ]),
  }),
]

const project: AdvancedTrack['project'] = {
  title: '可重试的活动报名服务',
  summary: '用确定事件模拟最后一个名额竞争与重试，再用 SQLite 核对报名、幂等结果和待发送事件的事务边界。',
  requirements: [
    '提交先查账号与键，范围内同键同内容返回原 201 编号，同键不同活动返回 409。新键也要检查重复账号及容量。',
    '给定两个客户端都曾读到最后一席，提交时按当前状态再次验证，只允许一个成功。未知活动拒绝，且不修改三个存储。',
    '提交前失败无残余，提交后回执丢失时返回原编号。派发可重试，按事件编号核对实际接收副作用。',
    '在 SQLite 脚本内搭建表和唯一约束。提交一个包含报名、键结果和事件的事务，再演示写入后的回滚。',
  ],
  examples: [
    { label: '正常提交与重试', input: 'lin 用 k1 报 a1，派发 e1，再用 k1 报 a1。', expected: '首次 201 r1，派发确认 e1，回放 201 r1。报名 1 条，实际更新 1 次。' },
    { label: '最后一个名额竞争', input: 'lin 和 chen 都读到 a1 剩 1，随后 lin 先提交，chen 后提交。', expected: '林成功，陈收到 409 满员。待发送事件只有 e1。' },
    { label: '事务失败与确认丢失', input: '提交前故障，第二次提交后回执丢失，第三次同键重试。通知第一次没有确认。', expected: '只留下 r1 与 e1。通知尝试两次，接收方实际更新一次。' },
    { label: '冲突与未知活动', input: '已成功的 k1 改报 a2，或把新请求发到未知活动。', expected: '分别为 409 内容冲突、400 未知活动，既有预约保持原样。' },
  ],
  exercises: [
    jsProgram('重放报名、恢复与通知', 'replay(events)', `  // 使用 accounts + key 定位已有结果，用 bookings 重新验证当前空位。
  // 失败时保留旧状态。通知用 eventId 去重，最后汇报待办和实际效果。
  return '待实现';`, `  const capacities = new Map([['a1', 1], ['a2', 2]]);
  const bookings = [];
  const requestLog = new Map();
  const outbox = new Map();
  const received = new Set();
  const trace = [];
  for (const event of events) {
    if (event.kind === 'read') {
      const occupied = bookings.filter(row => row.activity === event.activity).length;
      trace.push('读余位 ' + (capacities.get(event.activity) - occupied));
      continue;
    }
    if (event.kind === 'deliver') {
      const message = outbox.get(event.id);
      if (!message || message.confirmed) continue;
      received.add(event.id);
      if (event.loseAck) trace.push('派发无确认 ' + event.id);
      else {
        message.confirmed = true;
        trace.push('确认 ' + event.id);
      }
      continue;
    }
    const scope = JSON.stringify([event.account, event.key]);
    const stored = requestLog.get(scope);
    if (stored) {
      trace.push(stored.activity === event.activity ? '回放 201 ' + stored.id : '409 内容冲突');
      continue;
    }
    if (!capacities.has(event.activity)) {
      trace.push('400 未知活动');
      continue;
    }
    const active = bookings.filter(row => row.activity === event.activity);
    if (active.some(row => row.account === event.account)) {
      trace.push('409 重复');
      continue;
    }
    if (active.length >= capacities.get(event.activity)) {
      trace.push('409 满员');
      continue;
    }
    if (event.fault === 'beforeCommit') {
      trace.push('提交前故障');
      continue;
    }
    const number = bookings.length + 1;
    const booking = { id: 'r' + number, account: event.account, activity: event.activity };
    bookings.push(booking);
    requestLog.set(scope, booking);
    outbox.set('e' + number, { confirmed: false });
    trace.push(event.fault === 'lostReceipt' ? '回执丢失' : '201 ' + booking.id);
  }
  const pending = [...outbox.values()].filter(event => !event.confirmed).length;
  trace.push('报名 ' + bookings.length + ' 键 ' + requestLog.size + ' 待办 ' + pending + ' 更新 ' + received.size);
  return trace.join(' / ');`, `const lin = {kind:'submit',account:'lin',key:'k1',activity:'a1'};
const chen = {kind:'submit',account:'chen',key:'k1',activity:'a1'};
const read = {kind:'read',activity:'a1'};
const send = {kind:'deliver',id:'e1'};
console.log(replay([lin, send, lin]));
console.log(replay([read, read, lin, chen]));
console.log(replay([{...lin,fault:'beforeCommit'}, {...lin,fault:'lostReceipt'}, lin, {...send,loseAck:true}, send]));
console.log(replay([lin, {...lin,activity:'a2'}, {...lin,key:'k2'}, {...chen,activity:'bad'}]));`, [
      ['正常回放', '201 r1 / 确认 e1 / 回放 201 r1 / 报名 1 键 1 待办 0 更新 1'],
      ['并发争最后一席', '读余位 1 / 读余位 1 / 201 r1 / 409 满员 / 报名 1 键 1 待办 1 更新 0'],
      ['提交与确认故障', '提交前故障 / 回执丢失 / 回放 201 r1 / 派发无确认 e1 / 确认 e1 / 报名 1 键 1 待办 0 更新 1'],
      ['无效与重复请求', '201 r1 / 409 内容冲突 / 409 重复 / 400 未知活动 / 报名 1 键 1 待办 1 更新 0'],
    ]),
    sqlProgram('检查 SQLite 事务边界', `PRAGMA foreign_keys = ON;
CREATE TABLE activities(id TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity > 0));
CREATE TABLE reservations(id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES activities(id), account TEXT NOT NULL, UNIQUE(activity_id, account));
CREATE TABLE idempotency(account TEXT NOT NULL, request_key TEXT NOT NULL, activity_id TEXT NOT NULL REFERENCES activities(id), reservation_id TEXT NOT NULL REFERENCES reservations(id), PRIMARY KEY(account, request_key));
CREATE TABLE outbox(event_id TEXT PRIMARY KEY, reservation_id TEXT NOT NULL UNIQUE REFERENCES reservations(id), confirmed INTEGER NOT NULL DEFAULT 0);
INSERT INTO activities VALUES ('a1',1), ('a2',2);`, `-- 使用同一个事务写入 r1、k1 与 e1，再准备另一笔并回滚。
SELECT id FROM reservations ORDER BY id;`, `BEGIN IMMEDIATE;
INSERT INTO reservations VALUES ('r1','a1','lin');
INSERT INTO idempotency VALUES ('lin','k1','a1','r1');
INSERT INTO outbox(event_id,reservation_id) VALUES ('e1','r1');
COMMIT;

INSERT INTO reservations VALUES ('r99','a1','lin') ON CONFLICT(activity_id, account) DO NOTHING;

BEGIN IMMEDIATE;
INSERT INTO reservations VALUES ('r2','a2','chen');
INSERT INTO idempotency VALUES ('chen','k1','a2','r2');
INSERT INTO outbox(event_id,reservation_id) VALUES ('e2','r2');
ROLLBACK;

SELECT reservation_id AS replay_id FROM idempotency WHERE account='lin' AND request_key='k1' AND activity_id='a1';
SELECT id, activity_id FROM reservations ORDER BY id;
SELECT event_id, reservation_id, confirmed FROM outbox ORDER BY event_id;`, 'replay_id\nr1\n\nid\tactivity_id\nr1\ta1\n\nevent_id\treservation_id\tconfirmed\ne1\tr1\t0'),
  ],
  explanation: '先用事件表复现正式提交、回执重放和中途失败，再用 SQLite 核对真实提交与回滚。SQLite 脚本专门验证固定事务、唯一性和回读；容量争用与确认故障由 JavaScript 的确定事件验证。实际并发的提交仍需在存储事务中完成容量裁决。',
}

export const advancedBackend: AdvancedTrack = { direction: 'backend', lessons, project }
