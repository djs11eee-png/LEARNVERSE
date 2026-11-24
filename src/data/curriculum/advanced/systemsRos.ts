import type { AdvancedTrack } from '../types'
import { jsProgram, lesson, worked } from './systemsSupport'

const lessons = [
  lesson({
    id: 'ros-heartbeat-and-reorder',
    title: '用心跳和序号判断虚拟节点状态',
    summary: '分开观察节点是否按时更新、读数是否重复或乱序，并保留可核对的事件记录。',
    primer: { lead: '面板还显示着上一条温度。要确定采集端此刻是否在线，还需要独立的活动信号。', terms: [
      ['心跳', '节点按约定周期发出的轻量活动信号。观察者按自己的接收时刻记录。'],
      ['序号', '单一来源与运行代次内递增的编号，可帮助区分新、重复或旧数据。'],
      ['观测期限', '最后一次新心跳之后允许静默多久，过期后标记超时。'],
      ['乱序', '收到的先后次序与发布次序不同，较早消息可能晚到。'],
    ] },
    objectives: ['从给定接收时刻算出在线、超时和恢复状态。', '使用序号区分重复、迟到和可观测缺口。'],
    sections: [
      { heading: '把面板上的数值和节点可靠性分开记录', paragraphs: [
        '一条 20.5℃ 的温度曾经按时收到，过了几分钟仍可读到这个历史值。可显示最后值与更新时间，同时用单独状态说明采集端是否在预期期限内活跃。心跳只证明观察者看到信号，不能证明所有读数、服务或内部组件都正常。可以用两种事件观察：心跳更新活动时间，读数更新最近测量和序号。',
        '示例中的 at 是接收端相对某个固定起点的虚拟时刻。计算时取当前时刻减最后一次新心跳的接收时刻，结果大于等于时限则报超时。无需用两台机器的实时时钟互减；如果设备时钟没有同步，这样做会得出错误延迟。',
        '将心跳自身也编号，可以分辨新活动和旧消息重传。若时刻 2 收到心跳 7，时刻 6 又收到心跳 7，仍以时刻 2 为准。节点可能恢复，要等真正的新序号进入活动记录才更新判断。',
      ] },
      worked('没有观察到任何心跳，与已超时有区别', [
        '面板刚启动时还没有收到信号，lastBeat 用 null 表示。这时显示「未发现」。第一次心跳在时间 2 到达，时间 6 相隔 4，仍在线。时间 7 相隔 5，按课堂边界判超时。请把 limit 改成 6，预期时间 7 的状态变成在线。',
        '如果下一条新心跳在时间 8 到达，就把 lastBeat 设为 8，再看时间 8、9 的观察结果。恢复时间应由这条实际观察记录决定，不必猜后台是何时重启。面板只有一份活动轨迹，诊断原因时还要检查发布、订阅与进程日志。',
      ], `function presence(lastBeat, now, limit) {
  if (lastBeat === null) return '未发现';
  return now - lastBeat >= limit ? '超时' : '在线';
}
console.log(presence(null, 0, 5));
console.log(presence(2, 6, 5));
console.log(presence(2, 7, 5));
console.log(presence(8, 9, 5));`, '未发现\n在线\n超时\n在线'),
      worked('用同一来源的序号保护最新显示', [
        '同一站点曾依次发布 1、2、3，但面板实际收到 1、3、2、3。收到 3 时可记一个历史缺口；2 随后送到，已晚于当前值，保留记录用于排查，不把最新值回退到 2。第二次收到 3 是重复。试把第一项改成 2，再比较检测缺口的结果。',
        '缺口反映观察端在当时没有收到某些序号，其中一些可能后来补到，并不代表已证实永久丢失。设备重启可能从 1 重新编号。实际应用需要运行代次、重启标记或类似上下文，才能区分新运行与旧消息。课堂例子固定为单个来源的一次连续运行。',
      ], `let latest = null;
for (const seq of [1,3,2,3]) {
  if (seq === latest) console.log(seq, '重复');
  else if (latest !== null && seq < latest) console.log(seq, '迟到');
  else {
    const gap = latest === null ? 0 : seq - latest - 1;
    latest = seq;
    console.log(seq, '采用 缺口', gap);
  }
}`, '1 采用 缺口 0\n3 采用 缺口 1\n2 迟到\n3 重复'),
    ],
    pitfalls: [
      ['看到面板还有温度就认定节点在线。', '可能仍在显示上次记录的旧值。', '单独记录心跳和活动期限。'],
      ['迟到读数覆盖最新值。', '面板状态会回退，增量告警可能重复触发。', '按同一来源的序号仅使用更新读数。'],
    ],
    questions: [
      ['最后心跳在时刻 2，期限 5，时刻 7 状态应是？', ['首次发现', '始终在线', '超时', '读数重复'], 2, '时间差达到期限的边界，按约定超时。'],
      ['最近序号为 3，收到序号 2，显示应怎样？', ['仍保留序号 3 的值', '改成 2', '自动判定掉线', '自动重启发布节点'], 0, '本次运行内的较小序号是迟到读数。'],
      ['心跳存在可直接证明什么？', ['所有缓冲区都已处理', '每个服务都正常', '温度单位正确', '接收端在给定时刻看到活动信号'], 3, '心跳的证据范围是活动信号。'],
      ['观察到 1 然后 3，序号 2 的缺口说明？', ['永久丢失已经证实', '到处理 3 时还未观察到 2', '收到 2 副本', '节点没有启动过'], 1, '消息还可能稍后到达。'],
    ],
    practice: {
      prompt: '补全重放函数。按给定时刻接收心跳，处理在线状态和最新读数，拒绝较旧序号。',
      checkpoints: ['空心跳为未发现，恰好 5 个时间单位为超时。', '新的心跳恢复在线，读数乱序和重复均不改变最近一次记录。'],
      hints: ['准备 lastBeat 和 latest 两个变量。beat 更新前者，read 只可能更新后者。', '查看事件 kind 决定分支。read 先比较序号，再决定是否更新，tick 用现在与心跳时间的差。'],
      solution: '每条事件只更新属于自己的观测字段，逐步打印即可复现超时、恢复和读数乱序。',
    },
    exercise: jsProgram('重放心跳与读数', 'observe(events)', '  return "待实现";', `  let lastBeat = null;
  let latest = 0;
  const trace = [];
  for (const [kind, value] of events) {
    if (kind === 'beat') lastBeat = value;
    else if (kind === 'tick') trace.push(lastBeat === null ? '未发现' : value - lastBeat >= 5 ? '超时' : '在线');
    else if (value > latest) {
      latest = value;
      trace.push('采用 ' + latest);
    } else trace.push('保留 ' + latest);
  }
  return trace.join(' / ');`, `console.log(observe([['tick',0],['beat',2],['tick',6],['tick',7],['beat',8],['tick',9]]));
console.log(observe([['read',1],['read',3],['read',2],['read',3]]));
console.log(observe([['beat',4],['read',8],['tick',9]]));`, [
      ['发现、超时与恢复', '未发现 / 在线 / 超时 / 在线'], ['重复与乱序', '采用 1 / 采用 3 / 保留 3 / 保留 3'], ['读数不续心跳期限', '采用 8 / 超时'],
    ]),
  }),
  lesson({
    id: 'ros-retry-and-deduplicate',
    title: '给虚拟请求设计重试上限和去重',
    summary: '在确认可能丢失的合成输入中，使用稳定编号、明确终点和接收方去重。',
    primer: { lead: '观测日志已经写入，但面板没收到确认。这条日志还可以原样提交一次。', terms: [
      ['尝试次数', '每触发一次发送就增加，不代表接收侧实际修改相同次数。'],
      ['稳定编号', '重试时为同一个逻辑事件沿用的标识。'],
      ['去重', '再次收到相同标识时复用已有结果，不重复写入日志。'],
    ] },
    objectives: ['区分发送失败与确认丢失下的可恢复状态。', '用固定事件验证重发、接收方应用次数和重试耗尽。'],
    sections: [
      { heading: '先在两栏中追踪发送端和接收端', paragraphs: [
        '发送端提交一条归档通知 n1，接收端已保存，但回信没传到发送端。两边各有一份事实：发送端仍等待，接收端已应用。发送端按规则使用原编号重新提交，接收端能确认见过 n1，因此只返回原处理结果。这里只模拟对事件日志的更新，观察数据是否重复。',
        '还要决定什么时候停止。课堂将尝试数规定为 3，含第一次发送及之后两次重试。达到上限仍没有确认就报告重试耗尽，并保留相关日志或交给人工复查。实际系统可以退避，即让两次尝试之间等待时间变长。题目用现成时间或结果串替代真实计时，测试可以重复。',
        '故障事件表提供观察者知道的底层结果。lost 表示消息没有到达，lostAck 表示已经到达但确认未返，ack 表示收到确认。发送端在前两种情况下只看见同样的超时，因此只能保留待办并按原编号继续。验收可以使用接收端计数将两个故障区分开。',
      ] },
      worked('把网络结果变成固定的尝试序列', [
        '例子准备三个结果，第一次丢失，第二次到达。循环从编号 0 的位置读结果，每读一次增加 attempts，遇到 ack 已经得到确认即可退出。把 limit 改成 1，第一次丢失后不会继续读第二项。再把三个结果都改成 lost，核对报告会在上限结束。',
        '发起重试前要核对业务允许这种操作。发送语句返回失败有可能是另一端已处理，需要按同一次办理继续。取消、查询或发一条观测记录的重复副作用可能各不相同，应该在接口合同中定义。课堂只给允许重试且按 ID 去重的固定归档流程。',
      ], `const outcomes = ['lost','ack','ack'];
const limit = 3;
let result = '耗尽';
let attempts = 0;
for (const outcome of outcomes.slice(0, limit)) {
  attempts += 1;
  if (outcome === 'ack') {
    result = '已确认';
    break;
  }
}
console.log(attempts, result);`, '2 已确认'),
      worked('重复收到同一归档事件时保留原记录', [
        '把两条消息 n1、n1、n2 依次放进接收端。用 Map 保存已经写过的编号和温度。如果 n1 出现两次，第二次仍回原温度，即使本次携带不同值。改变第二项的 temp，观察输出仍为原值。这份练习只允许合法重试使用相同内容；不符的真实输入应明确报告冲突。',
        '做故障排查时尝试数和接收方写入数应分开统计。尝试多次而只有一次持久变化，使回放可以安全恢复。若接收端也可能重启，去重状态应与实际写入放在同一份可恢复状态里；练习用同一次程序运行中的 Map 表达这个记忆。',
      ], `const journal = new Map();
function receive(id, temp) {
  if (journal.has(id)) return '复用 ' + journal.get(id);
  journal.set(id, temp);
  return '保存 ' + temp;
}
console.log(receive('n1',21));
console.log(receive('n1',21));
console.log(receive('n2',22));
console.log('总更新',journal.size);`, '保存 21\n复用 21\n保存 22\n总更新 2'),
    ],
    pitfalls: [
      ['把每次重试当成一个新 ID。', '接收端没有办法识别重复。', '同一逻辑事件沿用编号。'],
      ['在超时后无限发出重试。', '故障期间会不断占用处理资源。', '明确最大次数和终止后的处置。'],
    ],
    questions: [
      ['接收端保存了 n1，确认丢失后收到 n1，应怎样？', ['再追加同样记录', '返回旧处理结果并确认', '等待新编号', '删除原结果'], 1, '同一稳定编号可以复用已经确认的处理结果。'],
      ['最大尝试 3 次，首次发送也算一次，最多重试几次？', ['3', '4', '不限次数', '2'], 3, '总数减去第一次发送得到剩余机会。'],
      ['发生三次尝试、一条业务更新，表示？', ['可能符合重复发送与去重规则', '必然有两条更新丢失', '一直没有送达', '系统应删除所有日志'], 0, '尝试与实际更新是两类指标。'],
      ['重启后仍要去重，应保存？', ['启动时生成的随机颜色', '最近一次页面访问', '已处理编号及对应更新', '偶数序号'], 2, '去重记录要与接收方业务效果保持对应。'],
    ],
    practice: {
      prompt: '模拟一次通知的多次尝试，确认后结束，达到上限停止，成功送达只应用一次。',
      checkpoints: ['lostAck 隐式表示送达但未确认。', '待办最多尝试 3 次，应用次数至多为 1。'],
      hints: ['slice(0, limit) 限制最多处理多少个结果。', 'lostAck 和 ack 都表示接收方已经见过。只在出现 ack 时提前返回已确认。'],
      solution: '分别记录是否发生过业务更新和是否收到确认，根据事件列表同时输出两项。',
    },
    exercise: jsProgram('回放通知尝试与业务效果', 'send(outcomes, limit)', '  return "待实现";', `  let attempts = 0;
  let applied = 0;
  for (const outcome of outcomes.slice(0, limit)) {
    attempts += 1;
    if (outcome === 'lostAck' || outcome === 'ack') applied = 1;
    if (outcome === 'ack') return attempts + ' 已确认 更新 ' + applied;
  }
  return attempts + ' 未确认 更新 ' + applied;`, `console.log(send(['lostAck','ack','lost'],3));
console.log(send(['lost','lost','lost','ack'],3));
console.log(send(['lostAck','lostAck','ack'],2));`, [
      ['确认丢失后复用', '2 已确认 更新 1'], ['到上限仍未到达', '3 未确认 更新 0'], ['已应用但直到停止仍未确认', '2 未确认 更新 1'],
    ]),
  }),
  lesson({
    id: 'ros-bounded-backpressure',
    title: '在有限缓冲区里处理积压',
    summary: '用给定产出消费速度观察积压，选择容量和溢出规则，分开统计各类缺口。',
    primer: { lead: '一秒内来了三条温度，但显示程序一次只处理一条。先决定待处理记录最多可以存几条。', terms: [
      ['背压', '下游处理速度跟不上产出，需要限速、缓冲或其他明确的流量处理策略。'],
      ['容量', '队列同时能够保留的元素上限，控制内存与排队时间。'],
      ['丢弃最旧', '缓冲已满时先移除最早的一项再加入最新项，适合只关心趋势的展示数据。'],
      ['关键事件', '有独立可靠性与处置要求的事件，例如归档确认；本题不放入温度缓冲。'],
    ] },
    objectives: ['按给定发布和消费日志跟踪队列长度及淘汰。', '说明温度读数和关键事件为何使用不同策略。'],
    sections: [
      { heading: '按业务用途选择缓冲已满时的行为', paragraphs: [
        '监测面板关心最新温度。短时积压时保留最近两条、淘汰最旧一条可以维持相对新鲜的显示。历史归档则可能要求完整记录，需考虑限速、暂停生产或额外可靠存储。报警确认和归档回执与读数有不同含义，通常要单独通道和可恢复记录，不能随意塞进可淘汰的温度队列。',
        '这里讨论应用侧的 JavaScript 队列。ROS 2 通信里历史深度、可靠策略、发布和订阅资源也会影响保留行为；工作台使用固定事件验证自己定义的溢出政策。可以把容量画成格子，观察第三项到来前哪两个格子已经占用，再决定淘汰哪一格。',
        '想一想同样有三条读数到达的两种安排。先连续送入三条再消费会触发一次淘汰；每送一条就消费则不积压。验收时固定生产和消费的交错次序，不能只记录一共到了几条。',
      ] },
      worked('用两个格子保留最新的遥测读数', [
        '将序号 1、2、3 依次送进容量 2 的队列。接收每个新读数前先检查长度已满，则 shift 移除头部最旧项，接着 push 加入最新项。输出队列状态和被淘汰的编号。把容量从 2 改成 1，验证它一直只剩最后一个序号。',
        '这个输入中三个序号都已经到达应用，因此淘汰 1 是应用缓冲策略造成的，不应归因于传输未达。另设计数记录本地淘汰，可以把它与收到的序号跳号区分开。两者趋势差异能够提示下一步检查网络、频率还是下游处理。',
      ], `const capacity = 2;
const pending = [];
for (const seq of [1,2,3]) {
  const dropped = pending.length === capacity ? pending.shift() : '-';
  pending.push(seq);
  console.log('队列 ' + pending.join(',') + ' 淘汰 ' + dropped);
}`, '队列 1 淘汰 -\n队列 1,2 淘汰 -\n队列 2,3 淘汰 1'),
      worked('每次取走一项，再看空队列与峰值', [
        '拿一份已经有两个读数的队列。第一次消费得到 2，第二次得到 3，第三次得到 undefined 本例显示空。更新需求若只要最新值，可以按另一个约定直接取最后一项，再清除已过时的项。此处保持先进入先消费，便于通过一目了然的轨迹对照。',
        '队列峰值是重放期间观测到的最大长度。对给定容量，任意一步的队列长度都不应超过峰值上界。若容量设为 0，本题明确规定不缓存，任何到来的读数只计入淘汰。边界输入应单独验证；常见错误是循环不断移除空队列但仍尝试加入新项。',
      ], `const queue = [2,3];
for (let turn = 0; turn < 3; turn += 1) {
  const consumed = queue.shift();
  console.log('取出', consumed ?? '空', '剩余', queue.length);
}`, '取出 2 剩余 1\n取出 3 剩余 0\n取出 空 剩余 0'),
    ],
    pitfalls: [
      ['把本地淘汰算成未收到的序号。', '无法区分网络未观察到与应用保留策略。', '分开记录进入前的序号缺口和缓冲淘汰。'],
      ['温度和归档确认共用可丢弃队列。', '积压可能丢下恢复需要的确认。', '为关键通知定义独立保留策略。'],
    ],
    questions: [
      ['容量 2、队列 [1,2]，收到 3 后丢最旧得到？', ['[1,2,3]', '[1,3]', '[1,2]', '[2,3]'], 3, '先移除头部 1，再加入 3。'],
      ['1、2、3 均已到达应用，随后队列丢了 1，应归类为？', ['网络永久丢包', '本地缓冲淘汰', '心跳停止', '重复确认'], 1, '到达后由本地容量策略丢弃。'],
      ['若消费者处理速度停滞，什么可以限制占用？', ['固定缓冲上限和溢出策略', '持续扩充队列', '不断打印全部历史', '把容量当作处理量'], 0, '有界队列，在写入时处理满队列。'],
      ['归档确认宜怎样处理？', ['与普通遥测同时淘汰', '自动替换较新确认', '给它独立的可靠处置', '每次都重新编号'], 2, '确认关系到后续恢复。'],
    ],
    practice: {
      prompt: '重放 push 和 take，满时淘汰最旧一条，打印消费记录、淘汰数与最高占用。',
      checkpoints: ['容量 2 最多缓存两项，第三项能替代第一项。', '容量 0 只计淘汰，空 take 显示空，峰值为 0。'],
      hints: ['用数组表示队列，shift 取头、push 加尾。', '容量为 0 别进入追加分支；每次追加后再更新峰值。'],
      solution: '区分生产与消费事件。用两条独立条件表达不缓存和已满；最后输出最高长度及消费轨迹。',
    },
    exercise: jsProgram('重放有界温度队列', 'simulate(events, capacity)', '  return "待实现";', `  const queue = [];
  const taken = [];
  let discarded = 0;
  let peak = 0;
  for (const event of events) {
    if (event === 'take') taken.push(queue.shift() ?? '空');
    else if (capacity === 0) discarded += 1;
    else {
      if (queue.length === capacity) {
        queue.shift();
        discarded += 1;
      }
      queue.push(event);
      peak = Math.max(peak, queue.length);
    }
  }
  return '消费 ' + (taken.join(',') || '-') + ' 淘汰 ' + discarded + ' 峰值 ' + peak;`, `console.log(simulate([1,2,3,'take','take','take'],2));
console.log(simulate([1,'take'],0));
console.log(simulate([1,'take',2,'take'],1));`, [
      ['突发积压', '消费 2,3,空 淘汰 1 峰值 2'], ['不缓存边界', '消费 空 淘汰 1 峰值 0'], ['消费跟得上', '消费 1,2 淘汰 0 峰值 1'],
    ]),
  }),
  lesson({
    id: 'ros-fault-trace-regression',
    title: '用可重放的故障轨迹做回归确认',
    summary: '冻结事件、预期与不变量，定位一次超时、堆积或重试中的首个异常步骤。',
    primer: { lead: '两次运行最后都在线，中途有没有在截止点识别超时，需要查看当时那一行。', terms: [
      ['事件轨迹', '带编号的输入与每一步状态快照，可以按原顺序重放。'],
      ['首个差异', '期望与实际第一次出现不同的步骤，有助缩小排查范围。'],
      ['不变量', '每一步都应成立的规则，例如缓冲区占用始终不超过容量。'],
    ] },
    objectives: ['为合成事件编写明确的步骤预期。', '报告首个差异、回归类别与有关的不变量。'],
    sections: [
      { heading: '给故障回放固定输入、初态与边界', paragraphs: [
        '一份可重复的测试需要三个条件：起初的心跳和缓存状态、带编号的下一条事件，以及这个事件处理完后的预期。事件时间用题目给出的数字，切勿让真实时钟决定先后。拿掉最后一个一直通过的事件，测试仍应指出之前已经出现的错误；仅比较最终状态会错过中途掉线判定和覆盖状态。',
        '不同故障可以先拆开做最小轨迹。心跳序列用于测试截止与恢复；乱序检查数据不回退；积压检查长度始终有上限；发送确认丢失验证业务效果只记录一次。遇到复合故障，再把能够单独复现的故障拼到一个清楚的顺序，以便复查相互影响。',
        '做一份复合轨迹时，给时刻相同的事件也保留稳定的输入顺序。例如时刻 7 先收新心跳再检查，与先检查再收心跳会出现不同的中途读数。修改代码后仍沿用旧输入和独立算出的期望，避免用新实现重新生成所有指标来验证自己。',
      ] },
      worked('只比较最后一行会遗漏的超时', [
        '预期与实际都在第三步恢复在线，但预期第二步是超时，实际仍为在线。用下标循环比较两列，每行都记录状态。找到第一个不一致就停，并保存序号、预期与实际。把 actual 第二项改成超时，运行便不会报告差异。再删掉中间状态，看看列表长度检查为何还需要单独写。',
        '如果测试输出还携带时间戳，固定快照应该明确用哪个时刻。比较依赖生成时刻的字符串会使两次运行出现伪差异。课堂按给定数组下标取步骤，复合场景可使用明确的事件 ID 配对测量，特别是不同版本为了诊断插入日志行时。',
      ], `const expected = ['在线','超时','在线'];
const actual = ['在线','在线','在线'];
for (let step = 0; step < expected.length; step += 1) {
  if (expected[step] !== actual[step]) {
    console.log('第', step + 1, '步', '预期', expected[step], '实际', actual[step]);
    break;
  }
}`, '第 2 步 预期 超时 实际 在线'),
      worked('给混合故障写两条相互独立的检查', [
        '有界队列规定占用不得大于 2；一次固定通知规定实际更新不得超过 1。这两条都能从状态快照判断。示例三次执行的快照里，一条碰到占用峰值但合法，一条因积压超过上限失败，一条因重复生效失败。把记录的 attempts 加到任意值只会描述发送过程，不应替代实际应用数。',
        '不变量只能覆盖写下的条件。例如「实际应用不超过 1」允许始终没有送达。还需写下健康场景应成功送达，以及失效场景在何处停止。回归报告最好同时保留不变量和具体预期，确定修改提高了可恢复性，而没有误伤正常处理。',
      ], `for (const [queue,applied] of [[2,1],[3,1],[1,2]]) {
  const bufferOkay = queue <= 2;
  const dedupOkay = applied <= 1;
  console.log(bufferOkay, dedupOkay);
}`, 'true true\nfalse true\ntrue false'),
    ],
    pitfalls: [
      ['只核对全部事件结束后的摘要。', '短时错误可能在后续被覆盖而仍显示正确。', '逐步核对重要状态、错误点和终态。'],
      ['测试依赖墙上时钟和运行速度。', '难以复现超时与拥塞。', '用显式时刻和事件顺序重放。'],
    ],
    questions: [
      ['轨迹最后都在线，但期望中途超时、实际从未超时，应？', ['忽略中间状态', '定位首次应超时的步骤', '修改最终报文字样', '缩短题目输出'], 1, '恢复不能掩盖截止状态曾经错误。'],
      ['下列哪项适合作为有界队列的不变量？', ['第一个事件永远是更新', '每条消息适用同一时间', '队列长度不超过预设容量', '运行完成后时钟重置'], 2, '容量必须在所有步骤满足。'],
      ['给出固定时刻而非等待真实时间的好处？', ['更容易重现边界故障', '自动恢复所有错误', '绕开保留策略', '无需建立初态'], 0, '重放在不同负载下保持同样顺序。'],
      ['只有最多应用一次的检查，但一直没应用仍通过，缺什么？', ['更新数改成最大整数', '只多打印发送次数', '删掉去重检查', '健康场景成功与恢复的独立预期'], 3, '上限检查无法证明按规定完成。'],
    ],
    practice: {
      prompt: '比对给定步骤的预期和实际，第一个偏差报告步号及两侧状态，能识别轨迹有额外或缺失事件。',
      checkpoints: ['中途偏差在恢复后仍被报告。', '长度不同需要指出哪一步开始缺少状态。'],
      hints: ['循环上限使用两条轨迹的较长长度。', '需要读到超出数组的位置时用「缺失」表示，从 1 记步骤号。'],
      solution: '用固定顺序比较事件后的状态。在第一个不等的位置返回差异，全部一致时返回通过。',
    },
    exercise: jsProgram('定位首个轨迹偏差', 'firstDifference(expected, actual)', '  return "待实现";', `  for (let i = 0; i < Math.max(expected.length, actual.length); i += 1) {
    if (expected[i] !== actual[i]) return '第 ' + (i + 1) + ' 步 ' + (expected[i] ?? '缺失') + ' → ' + (actual[i] ?? '缺失');
  }
  return '一致';`, `console.log(firstDifference(['在线','超时','在线'],['在线','在线','在线']));
console.log(firstDifference(['1','3'],['1']));
console.log(firstDifference(['确认'],['确认']));
console.log(firstDifference([],['意外']));`, [
      ['终态相同但中途偏差', '第 2 步 超时 → 在线'], ['实际缺一步', '第 2 步 3 → 缺失'], ['全一致', '一致'], ['额外事件', '第 1 步 缺失 → 意外'],
    ]),
  }),
]

const project: AdvancedTrack['project'] = {
  title: '观测站可靠性回放',
  summary: '用同一组虚拟事件检查心跳、迟到温度、积压淘汰和通知去重，核对每一步及最终计数。',
  requirements: [
    '使用单调虚拟时刻处理心跳，从未收到为未发现，距离最近新心跳恰好 5 或更久为超时，较旧心跳不续期。',
    '温度序号为正整数，忽略迟到和重复；新读数进入容量 2 的队列，满时淘汰最旧项，take 按进入顺序消费。',
    '按固定通知 ID 重试，最多 3 次。未收到确认的成功交付仍只保留一次更新，确认后后续尝试直接跳过。',
    '按输入顺序返回状态轨迹和计数，便于定位首个状态偏差。所有输入都为合成观测事件。',
  ],
  examples: [
    { label: '正常观测与确认', input: '时刻 1 收到第一心跳，时刻 3 查询。送入温度 1，消费一次，通知 n1 正常确认。', expected: '在线，消费 1，应用 1 次，没有淘汰。' },
    { label: '截止点与恢复', input: '最后新心跳在时刻 2，时刻 6 收到同一个旧心跳，时刻 7 检查，时刻 8 来新序号。', expected: '旧心跳不续期，时刻 7 超时，时刻 8 后恢复在线。' },
    { label: '迟到读数和缓冲积压', input: '温度依次送入 1、3、2、4、4 和非法序号 0。', expected: '2、重复的 4 与 0 均不产生写入，收到 4 时淘汰 1，随后可按序读 3、4。' },
    { label: '重试后确认及耗尽', input: 'n1 已送达却无确认，第二次确认；n2 三次丢失，第四次到达。', expected: 'n1 只应用一次，n2 第四次被上限挡住。' },
  ],
  exercises: [
    jsProgram('回放并核对虚拟事件', 'replay(events)', `  // events 描述心跳、时刻检查、读数、消费和通知尝试。
  // 为每种状态建立可观察的轨迹，再核对淘汰数和实际更新次数。
  return '待实现';`, `  let lastBeat = null;
  let beatSequence = 0;
  let latestReading = 0;
  const pending = [];
  let discarded = 0;
  const attempts = new Map();
  const applied = new Set();
  const confirmed = new Set();
  const trace = [];
  for (const event of events) {
    if (event.kind === 'heartbeat') {
      if (event.seq <= beatSequence) trace.push('忽略旧心跳');
      else {
        lastBeat = event.at;
        beatSequence = event.seq;
        trace.push('心跳 ' + beatSequence);
      }
    } else if (event.kind === 'tick') {
      trace.push(lastBeat === null ? '未发现' : event.at - lastBeat >= 5 ? '超时' : '在线');
    } else if (event.kind === 'reading') {
      const seq = event.seq;
      if (!Number.isInteger(seq) || seq < 1) trace.push('无效读数');
      else if (seq <= latestReading) trace.push('忽略旧读数 ' + seq);
      else {
        latestReading = seq;
        if (pending.length >= 2) {
          trace.push('淘汰 ' + pending.shift());
          discarded += 1;
        }
        pending.push(seq);
        trace.push('入队 ' + seq);
      }
    } else if (event.kind === 'take') {
      trace.push('消费 ' + (pending.shift() ?? '空'));
    } else if (event.kind === 'send') {
      const count = attempts.get(event.id) ?? 0;
      if (confirmed.has(event.id)) trace.push('已确认 ' + event.id);
      else if (count === 3) trace.push('停止重试 ' + event.id);
      else {
        attempts.set(event.id, count + 1);
        if (event.outcome !== 'lost') applied.add(event.id);
        if (event.outcome === 'ack') confirmed.add(event.id);
        const state = { lost:'未达', lostAck:'待确认', ack:'确认' }[event.outcome];
        trace.push(event.id + ' 尝试 ' + (count + 1) + ' ' + state);
      }
    }
  }
  trace.push('待处理 ' + pending.length + ' 淘汰 ' + discarded + ' 更新 ' + applied.size);
  return trace.join(' / ');`, `const beat = (seq,at) => ({kind:'heartbeat',seq,at});
const tick = at => ({kind:'tick',at});
const reading = seq => ({kind:'reading',seq});
const take = {kind:'take'};
const send = (id,outcome) => ({kind:'send',id,outcome});
console.log(replay([beat(1,1),tick(3),reading(1),take,send('n1','ack')]));
console.log(replay([tick(0),beat(1,2),beat(1,6),tick(7),beat(2,8),tick(8)]));
console.log(replay([reading(1),reading(3),reading(2),reading(4),reading(4),reading(0),take,take,take]));
console.log(replay([send('n1','lostAck'),send('n1','ack'),send('n1','ack'),send('n2','lost'),send('n2','lost'),send('n2','lost'),send('n2','ack')]));`, [
      ['健康流量', '心跳 1 / 在线 / 入队 1 / 消费 1 / n1 尝试 1 确认 / 待处理 0 淘汰 0 更新 1'],
      ['心跳过期与恢复', '未发现 / 心跳 1 / 忽略旧心跳 / 超时 / 心跳 2 / 在线 / 待处理 0 淘汰 0 更新 0'],
      ['积压、无效与乱序', '入队 1 / 入队 3 / 忽略旧读数 2 / 淘汰 1 / 入队 4 / 忽略旧读数 4 / 无效读数 / 消费 3 / 消费 4 / 消费 空 / 待处理 0 淘汰 1 更新 0'],
      ['确认丢失与重试限额', 'n1 尝试 1 待确认 / n1 尝试 2 确认 / 已确认 n1 / n2 尝试 1 未达 / n2 尝试 2 未达 / n2 尝试 3 未达 / 停止重试 n2 / 待处理 0 淘汰 0 更新 1'],
    ]),
  ],
  explanation: '将活动状态、温度缓冲和通知确认分别记录，按虚拟时间及文件顺序重放。遇到断言差异就对照本条事件前后的状态。只用合成输入，所以可精确复现截止、乱序、积压和重发。',
}

export const advancedRos: AdvancedTrack = { direction: 'ros', lessons, project }
