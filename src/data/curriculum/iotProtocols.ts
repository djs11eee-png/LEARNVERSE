import { check, demo, exercise, lesson, step } from './advanced/languagesAuthoring'
import type { CourseProject } from './types'

const fill = '  // 在这里补全逻辑。'

const framesAndQos = lesson({
  id: 'iot-frames-and-qos',
  title: '传感帧解码、主题路由与 QoS 匹配',
  summary: '把 16 位传感器原始帧拆成设备号、温度和告警位，再核对主题名称与 QoS 投递等级。',
  primer: {
    lead: '温湿度采集板通常把一条读数压缩进两个字节发给边缘网关。网关先按位解包，再决定转发到哪条主题以及给哪些订阅端。',
    terms: [
      ['传感帧（Frame）', '设备按固定位段打包的一串二进制数据。本课用 16 位无符号整数表示：高 4 位是设备号，中间 8 位是温度整数，低 4 位是状态标志位。'],
      ['主题（Topic）', '发布-订阅协议（如 MQTT）用来分类消息的层级路径，例如 /farm/temp。发布端只管发到主题，订阅端按主题接收。'],
      ['QoS（服务质量等级）', '规定消息投递的保证力度。QoS 0 表示尽力而为（最多一次），QoS 1 表示带确认重传（至少一次）。'],
    ],
  },
  objectives: [
    '用无符号右移与位掩码从 16 位传感帧提取设备号、温度和告警位。',
    '按主题名称与 QoS 提供/请求方向判断发布端和订阅端是否兼容。',
  ],
  sections: [
    step('从 C 位运算衔接物联网传感帧',
      '如果你刚学完 C 语言进阶的位运算和计算机组成原理，这里的位掩码写法几乎完全一致。浏览器模拟器使用轻量 JavaScript，运算符 >>、&、=== 与 C 语言的思维相同，无需额外搭建硬件环境就能验证协议逻辑。',
      '约定一个 16 位无符号传感帧 frame（范围 0 到 0xFFFF）：第 12～15 位（高 4 位）存设备编号 nodeId（0～15），第 4～11 位（中 8 位）存摄氏温度 temp（0～255），第 0～3 位（低 4 位）存状态标志 flags，其中最低位（flags & 1）为 1 表示触发高温告警。',
      '例如十六进制 0x3191 写成二进制是 0011 00011001 0001：高 4 位 0011 是设备 3，中 8 位 00011001 是十进制 25（25 °C），低 4 位 0001 的最低位为 1，表示带告警标志。'),
    demo('javascript', '用右移和掩码拆开 16 位传感帧', [
      '先把 frame 向右移位，把目标字段推到最右侧，再与对应宽度的全 1 掩码做按位与（&）。高 4 位右移 12 位并掩码 0xF，中间 8 位右移 4 位并掩码 0xFF，告警位直接取 frame & 1。',
      '先手算 0x3191 和 0x2140 各自的设备号、温度和告警状态，再运行核对。把第二帧改为 0x2141，告警位会从 0 变成 1。',
    ], `function unpack(frame) {
  const nodeId = (frame >>> 12) & 0xF;
  const temp = (frame >>> 4) & 0xFF;
  const alarm = (frame & 1) === 1;
  return "N" + nodeId + " " + temp + "C" + (alarm ? " [告警]" : "");
}

console.log(unpack(0x3191));
console.log(unpack(0x2140));`, 'N3 25C [告警]\nN2 20C'),
    demo('javascript', '按主题与 QoS 等级判断订阅兼容性', [
      '边缘网关解包后会把消息发往指定主题。订阅端能否收到，取决于两项：主题路径完全一致，且发布端提供的 QoS 等级不低于订阅端要求的最低等级。',
      'QoS 1（至少一次）可以满足只要求 QoS 0 的展示面板；反过来，发布端只提供 QoS 0 时，无法满足要求 QoS 1 的告警归档服务。试着把 pub.qos 改成 1，观察两个订阅端的结果变化。',
    ], `function checkLink(pub, sub) {
  if (pub.topic !== sub.topic) return "主题不符";
  if (pub.qos < sub.qos) return "QoS不足";
  return "兼容";
}

const pub = { topic: "/farm/temp", qos: 0 };
console.log(checkLink(pub, { topic: "/farm/temp", qos: 0 }));
console.log(checkLink(pub, { topic: "/farm/temp", qos: 1 }));
console.log(checkLink(pub, { topic: "/farm/hum", qos: 0 }));`, '兼容\nQoS不足\n主题不符'),
  ],
  wrapUp: step('先把帧解对，再把路选对',
    '遇到传感数据异常，先检查掩码宽度和移位位数是否与协议手册一致（4 位用 0xF，8 位用 0xFF），再核对发布端与订阅端的主题拼写和 QoS 方向。',
    '下一章把时间轴加进来：即使帧格式和 QoS 都正确，设备掉线、消息乱序或确认包丢失依然会让面板显示过时读数。'),
  pitfalls: [
    { mistake: '提取中间 8 位时忘记先按位与 0xFF。', why: 'frame >>> 4 会把高 4 位的设备号留在温度高位里，导致算出的温度大出几百。', fix: '移位后始终用对应宽度的掩码截断无关高位。' },
    { mistake: '把订阅端请求的 QoS 和发布端提供的 QoS 写反。', why: '方向写反会让 QoS 0 的传感器错误接入要求可靠交付的告警链路。', fix: '记住规则：提供方 pub.qos 必须大于等于请求方 sub.qos。' },
  ],
  practice: {
    prompt: '补全 routeFrame(frame, pub, sub)。若 frame 不是 0 到 0xFFFF 的整数返回「无效帧」；否则先检验主题与 QoS，兼容时返回「N设备号 温度C」并在告警位为 1 时追加「 告警」。',
    checkpoints: [
      '0x3191 匹配 /farm/temp 且 QoS 兼容时返回「N3 25C 告警」。',
      '主题不同返回「主题不符」，QoS 0 对 QoS 1 返回「QoS不足」，负帧或超 0xFFFF 返回「无效帧」。',
    ],
    hints: [
      '先验证 frame 是否为合法的 16 位无符号整数（Number.isInteger 且在 0 到 0xFFFF 之间），再检查 pub 和 sub 的主题与 QoS。',
      '通过链路检查后再提取 nodeId = (frame >>> 12) & 0xF、temp = (frame >>> 4) & 0xFF、alarm = (frame & 1) === 1，并按格式拼接字符串。',
    ],
    solution: '依次完成帧合法性检查、主题与 QoS 兼容性判断、位段解包与格式化输出，保证每个非法分支都提前返回。',
  },
  questions: [
    check('iot-q1-mask', '在 16 位传感帧 [4位设备|8位温度|4位标志] 中，提取中间 8 位温度应使用哪个表达式？', ['(frame >>> 4) & 0xFF', 'frame & 0xFF', '(frame >>> 12) & 0xF', 'frame >>> 4'], 0, '先右移 4 位去掉状态位，再与 0xFF 按位与清掉高 4 位设备号。'),
    check('iot-q1-alarm', '帧 0x11E1 的低 4 位是 0001，它的告警位（最低位）状态是？', ['0（无告警）', '1（有告警）', '16', '无法判断'], 1, '0x11E1 & 1 等于 1，表示最低位告警标志已置位。'),
    check('iot-q1-qos', '采集端提供 QoS 1，展示面板只要求 QoS 0，两者是否兼容？', ['不兼容，等级必须严格相等', '兼容，提供等级不低于请求等级', '不兼容，QoS 1 不能发给面板', '取决于温度是否为正'], 1, 'QoS 1 至少一次投递可以满足只要求 QoS 0 的订阅者。'),
    check('iot-q1-range', '为什么解包前要先检查 frame 在 0 到 0xFFFF 之间？', ['让温度自动加 1', '排除负数、小数和超过 16 位的异常输入', '跳过主题检查', '把十六进制转成十进制'], 1, '超出 16 位或非整数的数据不符合协议帧定义，应在解包前拦截。'),
  ],
  exercise: exercise('javascript', `function routeFrame(frame, pub, sub) {
${fill}
}

const p0 = { topic: "/farm/temp", qos: 0 };
const p1 = { topic: "/farm/temp", qos: 1 };
console.log(routeFrame(0x3191, p1, { topic: "/farm/temp", qos: 1 }));
console.log(routeFrame(0x2140, p1, { topic: "/farm/temp", qos: 0 }));
console.log(routeFrame(0x2140, p0, { topic: "/farm/temp", qos: 1 }));
console.log(routeFrame(0x2140, p1, { topic: "/farm/hum", qos: 0 }));
console.log(routeFrame(-1, p1, { topic: "/farm/temp", qos: 0 }));`, fill, `  if (!Number.isInteger(frame) || frame < 0 || frame > 0xFFFF) return "无效帧";
  if (pub.topic !== sub.topic) return "主题不符";
  if (pub.qos < sub.qos) return "QoS不足";
  const nodeId = (frame >>> 12) & 0xF;
  const temp = (frame >>> 4) & 0xFF;
  const alarm = (frame & 1) === 1;
  return "N" + nodeId + " " + temp + "C" + (alarm ? " 告警" : "");`,
  'N3 25C 告警\nN2 20C\nQoS不足\n主题不符\n无效帧',
  ['带告警兼容', '高QoS兼容低QoS', 'QoS不足', '主题不符', '非法帧拦截']),
})

const heartbeatAndDedup = lesson({
  id: 'iot-heartbeat-and-dedup',
  title: '设备心跳、离线判定与确认去重',
  summary: '用单调时刻与心跳超时判断传感器在线状态，并用序号与消息 ID 挡住乱序和重复告警。',
  primer: {
    lead: '大棚终端 10 分钟前断电了，但监控屏幕上依然显示着上次收到的 24 °C。把“最后读数”和“此刻在线吗”拆开记录，才能第一时间发现断连。',
    terms: [
      ['心跳（Heartbeat）', '终端按固定周期发出的轻量存活信号，网关只记录自己收到最新心跳的时刻。'],
      ['单调虚拟时钟', '只增不减的整数时刻（如 0、2、7），让离线超时测试不依赖真实系统时钟，可以随时精确重放。'],
      ['幂等去重（Deduplication）', '告警确认包（PUBACK）丢失后设备会重发同一条消息 ID，网关记住已处理的 ID，避免把同一告警触发两次。'],
    ],
  },
  objectives: [
    '根据最近心跳时刻和超时期限判定未上线、在线与离线超时，且不让旧心跳续期。',
    '用递增序号过滤乱序/重复读数，用消息 ID 限制重试副作用至多生效一次。',
  ],
  sections: [
    step('把在线状态、读数顺序与告警确认拆开看',
      '物联网现场常同时遇到三种干扰：无线休眠或断电导致节点失联、多跳转发导致旧传感器读数晚到、上行链路丢掉确认包导致同一条高温告警被重发三次。',
      '解决办法是给三件事各留一份独立状态：心跳只看最新序号对应的接收时刻，当前时刻减最后心跳时刻达到期限（now - lastBeat >= timeout）即判「离线」；读数只接受严格大于 latestSeq 的新序号；关键告警每次重试沿用同一个 msgId，网关查已处理集合决定是「新建告警」还是「复用确认」。'),
    demo('javascript', '按单调时刻判定在线、超时与恢复', [
      '从未收到过心跳时 lastBeat 是 null，状态为「未上线」。收到心跳 1（时刻 2）后，在期限 5 内（时刻 6 差值为 4）在线，到时刻 7（差值等于 5）判「离线」。随后时刻 6 的重复旧心跳（序号仍为 1）不能续期，只有时刻 8 的新心跳 2 才能恢复在线。',
      '把 timeout 改成 6，重新预测时刻 7 的状态，再运行验证。',
    ], `const timeout = 5;
let lastBeat = null;
let lastBeatSeq = 0;

for (const [kind, a, b] of [["tick", 0], ["beat", 1, 2], ["tick", 6], ["beat", 1, 6], ["tick", 7], ["beat", 2, 8], ["tick", 9]]) {
  if (kind === "beat") {
    if (a > lastBeatSeq) { lastBeatSeq = a; lastBeat = b; }
  } else {
    const state = lastBeat === null ? "未上线" : (a - lastBeat >= timeout ? "离线" : "在线");
    console.log("t=" + a + " " + state);
  }
}`, 't=0 未上线\nt=6 在线\nt=7 离线\nt=9 在线'),
    demo('javascript', '告警重试上限与接收端幂等去重', [
      'QoS 1 告警最多尝试 3 次（含首次发送）。当确认包丢失（lostAck）时，网关其实已经记下告警，只是设备没收到回执所以原样重发同一个 msgId。网关通过 seen 集合识别重复 ID，只返回确认而不再多记一条告警。',
      '观察下面两组结果：第一组确认丢失后重发成功，尝试 2 次但只生效 1 次；第二组三次全丢，达到上限后停止重试，生效 0 次。',
    ], `function sendAlarm(outcomes, limit) {
  let attempts = 0;
  let applied = 0;
  for (const status of outcomes.slice(0, limit)) {
    attempts += 1;
    if (status === "lostAck" || status === "ack") applied = 1;
    if (status === "ack") return "尝试" + attempts + " 已确认 生效" + applied;
  }
  return "尝试" + attempts + " 超限 生效" + applied;
}

console.log(sendAlarm(["lostAck", "ack", "ack"], 3));
console.log(sendAlarm(["lost", "lost", "lost", "ack"], 3));`, '尝试2 已确认 生效1\n尝试3 超限 生效0'),
  ],
  wrapUp: step('三份独立记忆挡住三类现场故障',
    '心跳期限解决“失联却还挂着旧温度”，递增序号解决“晚到读数把最新值盖回去”，稳定 msgId 解决“确认丢失导致告警发两遍”。',
    '下一章把视角拉到边缘网关本身：当几十个传感器同时发来突发数据、4G 上行暂时变慢时，有限内存该如何排布队列与背压策略？'),
  pitfalls: [
    { mistake: '收到重复的旧心跳序号也更新 lastBeat 时刻。', why: '网络重传的一条陈旧心跳会错误地把已经掉线的设备续成在线。', fix: '给心跳带上递增序号，只有 seq > lastBeatSeq 时才更新接收时刻。' },
    { mistake: '把每次重试的告警生成新的 msgId。', why: '接收端无法判断两条消息来自同一次高温事件，会重复拉响告警。', fix: '同一次告警重试必须复用相同的 msgId。' },
  ],
  practice: {
    prompt: '补全 monitor(events, timeout)。事件为 ["beat", seq, at]、["tick", at]、["read", seq, temp]。旧心跳和旧/重复读数都要忽略；tick 输出未上线/在线/离线，有效读数输出「采纳 序号:温度」，忽略的读数输出「忽略 序号」。用 " / " 拼成轨迹。',
    checkpoints: [
      '时刻 7 距时刻 2 恰好达到期限 5，应判定为「离线」，重复旧心跳不能续期。',
      '读数序号 1、3、2、3 中，2 和第二个 3 必须输出忽略，不覆盖最新温度。',
    ],
    hints: [
      '分别维护 lastBeat（初值 null）、lastBeatSeq（初值 0）与 latestReadSeq（初值 0），互不干扰。',
      '处理 read 时先判断 seq > latestReadSeq：成立就更新并 push 采纳文本，否则直接 push 忽略文本；处理 beat 时不向 trace 追加输出。',
    ],
    solution: '三条分支各自只改对应的状态字段。心跳只维护存活时间，读数只维护最新序号，检查时刻按差值输出在线状态。',
  },
  questions: [
    check('iot-q2-timeout', '最新心跳在 t=2，超时期限为 5，在 t=7 检查设备状态应为？', ['未上线', '在线', '离线', '自动重启'], 2, '7 - 2 = 5 恰好达到期限，按规则判定为离线。'),
    check('iot-q2-stale', '最新读数序号已是 4，此时收到迟到的序号 3，正确处理是？', ['覆盖当前显示为 3', '忽略旧读数，保留 4', '把设备标为离线', '清空全部历史'], 1, '同一节点的旧序号属于迟到数据包，不能让最新读数倒退。'),
    check('iot-q2-ack', '告警确认包丢失（lostAck）后终端重发同一 msgId 并收到 ack，业务侧应记录几次告警？', ['0 次', '1 次', '2 次', '3 次'], 1, '接收端按 msgId 去重，多次送达只生效一次。'),
    check('iot-q2-clock', '为什么协议回归测试用给定虚拟时刻而不是读取当前系统时间？', ['系统时间无法相减', '虚拟时刻可精确重现边界超时且不随机器快慢波动', '可以省略序号检查', '能让网络永远不丢包'], 1, '确定性虚拟时刻让超时边界在任何设备上都可重复验收。'),
  ],
  exercise: exercise('javascript', `function monitor(events, timeout) {
${fill}
}

console.log(monitor([["tick", 0], ["beat", 1, 2], ["beat", 1, 6], ["tick", 7], ["beat", 2, 8], ["tick", 9]], 5));
console.log(monitor([["read", 1, 21], ["read", 3, 24], ["read", 2, 22], ["read", 3, 24]], 5));`, fill, `  let lastBeat = null;
  let lastBeatSeq = 0;
  let latestReadSeq = 0;
  const trace = [];
  for (const [kind, a, b] of events) {
    if (kind === "beat") {
      if (a > lastBeatSeq) {
        lastBeatSeq = a;
        lastBeat = b;
      }
    } else if (kind === "tick") {
      trace.push(lastBeat === null ? "未上线" : (a - lastBeat >= timeout ? "离线" : "在线"));
    } else if (kind === "read") {
      if (a > latestReadSeq) {
        latestReadSeq = a;
        trace.push("采纳 " + a + ":" + b);
      } else {
        trace.push("忽略 " + a);
      }
    }
  }
  return trace.join(" / ");`,
  '未上线 / 离线 / 在线\n采纳 1:21 / 采纳 3:24 / 忽略 2 / 忽略 3',
  ['心跳边界与旧心跳保护', '乱序与重复读数过滤']),
})

const gatewayBackpressure = lesson({
  id: 'iot-gateway-backpressure',
  title: '边缘网关的有界缓冲与背压分流',
  demo: 'iot-gateway',
  summary: '在内存受限的物联网网关里限制常规遥测队列长度，同时为关键告警保留独立可靠通道。',
  primer: {
    lead: '4G 信号抖动时，网关一秒钟收到三条温度却只能上传一条。如果队列无限增长，单片机或边缘盒子很快就会内存耗尽。',
    terms: [
      ['背压（Backpressure）', '上游产数据快于下游消化速度时，通过限容、丢旧保新或限流防止系统崩塌的策略。'],
      ['丢弃最旧（Drop-Oldest）', '常规温度队列满时先踢掉最早的一条再放入最新读数，确保监控面板始终看到最新趋势。'],
      ['通道隔离', '把不可丢失的高温/火灾告警放进独立通道，绝不和可淘汰的常规温度挤在同一个缓冲里。'],
    ],
  },
  objectives: [
    '在固定容量下跟踪队列长度、淘汰数与峰值占用，验证不变量 length <= capacity。',
    '把常规遥测与关键告警分流处理，用固定事件轨迹检查每一步状态。',
  ],
  sections: [
    step('为什么物联网网关不能用“无限长数组”',
      '桌面服务器也许有几十 GB 内存，而部署在农田或工厂的边缘网关可能只有几百 KB 到几十 MB 可用缓冲区。遇到上行断网 10 分钟，常规温湿度如果只进不出，就会把整个网关拖死，连真正致命的告警也发不出去。',
      '因此工程上会做两件事：第一，给常规遥测队列设定硬上限 capacity，满时执行「丢弃最旧」，把本地淘汰次数 discarded 单独记账（不能与无线丢包混为一谈）；第二，给关键告警单独建一条可靠通道，按 msgId 去重且不参与常规队列淘汰。'),
    demo('javascript', '常规遥测的丢旧保新与峰值不变量', [
      '把序号 1、2、3 连续送入容量为 2 的遥测缓冲区。第 3 条到达时队列已满，先 shift 踢掉最旧的 1，再 push 放入 3，同时把 dropped 加 1。',
      '再试着把 capacity 改成 1：任何时刻缓冲区只保留最新一条，前两条都会被记为本地淘汰。',
    ], `const capacity = 2;
const queue = [];
let dropped = 0;
for (const seq of [1, 2, 3]) {
  if (queue.length === capacity) { queue.shift(); dropped += 1; }
  queue.push(seq);
  console.log("缓冲=" + queue.join(",") + " 淘汰=" + dropped);
}`, '缓冲=1 淘汰=0\n缓冲=1,2 淘汰=0\n缓冲=2,3 淘汰=1'),
    demo('javascript', '常规读数与关键告警分流处理', [
      '下面的网关把 read 放进容量为 1 的常规队列（满了就丢旧），而 alarm 放进独立去重集合 alarms，即使常规队列发生淘汰，告警一条也不会少。',
      '把事件里的重复 alarm A1 删掉再跑一遍，对比 alarms.size 是否始终保持 1。',
    ], `const telemetry = [];
const alarms = new Set();
let dropped = 0;
for (const [kind, id] of [["read", "T1"], ["alarm", "A1"], ["read", "T2"], ["alarm", "A1"]]) {
  if (kind === "alarm") alarms.add(id);
  else {
    if (telemetry.length === 1) { telemetry.shift(); dropped += 1; }
    telemetry.push(id);
  }
}
console.log("常规=" + telemetry.join(",") + " 淘汰=" + dropped + " 告警=" + [...alarms].join(","));`, '常规=T2 淘汰=1 告警=A1'),
  ],
  wrapUp: step('用不变量守护有限资源',
    '做完本章练习后，再回头看三条不变量：常规缓冲占用永远不超过 capacity、网络缺口和本地淘汰分开计数、关键告警绝不被常规流量挤掉。',
    '现在进入结课项目：把三章学到的 16 位传感帧解包、QoS 校验、心跳离线检测和有界背压拼成一台完整的智能温室边缘网关。'),
  pitfalls: [
    { mistake: '把常规队列淘汰算成传感器掉包。', why: '数据其实已经到达网关，只是上行消费慢，混算会让人误查无线天线而不是上行带宽。', fix: '分别记录序列缺口和本地队列淘汰数。' },
    { mistake: '容量为 0 时仍先 shift 再 push。', why: '会把数据塞进本该零缓冲的队列里，违背 length <= capacity。', fix: '单独拦截 capacity === 0，直接增加淘汰计数并跳过入队。' },
  ],
  practice: {
    prompt: '补全 dispatch(events, capacity)。事件为 ["read", id]、["alarm", id]、["flush"]（消费常规队头）。常规队列满时淘汰最旧（capacity 为 0 时直接淘汰），告警独立去重保留。返回「上传:… 告警:… 淘汰:… 峰值:…」。',
    checkpoints: [
      '常规读数突发超过容量 2 时淘汰最旧一条，告警 A1 重复提交仍只保留一次且不受淘汰影响。',
      '容量为 0 时常规读数全部计淘汰、峰值为 0，告警通道依然正常记录。',
    ],
    hints: [
      '用数组 queue 存常规读数、uploaded 存被 flush 取出的读数、Set alarms 存告警，再维护 dropped 和 peak。',
      '遇到 read 且 capacity === 0 直接 dropped++；否则满时 shift 并 dropped++，push 后更新 peak = Math.max(peak, queue.length)。',
    ],
    solution: '三条事件分支彼此隔离：flush 只消费常规队列，alarm 只写入去重集合，read 严格遵守容量上限和峰值记录。',
  },
  questions: [
    check('iot-q3-policy', '实时温湿度监控面板在短暂断网积压时，为什么常选「丢弃最旧」策略？', ['为了增大内存占用', '保留最新趋势同时控制内存上限', '让旧温度覆盖新温度', '省去心跳检测'], 1, '监控面板优先关心最新状态，丢旧保新能把缓冲占用锁在固定上限内。'),
    check('iot-q3-isolate', '高温火灾告警为什么不能和常规温湿度共用一个可淘汰缓冲队列？', ['告警数据量一定比温度大', '常规流量突发可能把关键告警挤出队列造成漏报', '队列只能存数字', '告警不需要去重'], 1, '关键告警必须使用独立可靠通道，避免被普通遥测背压拖垮。'),
    check('iot-q3-zero', '若配置常规缓冲容量 capacity = 0，此时到来一条常规读数应如何处理？', ['入队后立刻清空', '不入队，计一次淘汰，峰值保持 0', '把容量临时改成 1', '把读数放进告警通道'], 1, '容量 0 表示不缓冲，不能违反 length <= capacity 不变量。'),
    check('iot-q3-metric', '如何区分“无线链路丢包”和“网关内存满被淘汰”？', ['两者无法区分', '只看当前温度大小', '分别记录入站序号缺口与本地缓冲淘汰计数', '把所有计数合并成一个数字'], 2, '分账记录能帮运维直接判断该调天线功率还是扩容上行吞吐。'),
  ],
  exercise: exercise('javascript', `function dispatch(events, capacity) {
${fill}
}

console.log(dispatch([["read", "T1"], ["read", "T2"], ["alarm", "A1"], ["read", "T3"], ["alarm", "A1"], ["flush"], ["flush"], ["flush"]], 2));
console.log(dispatch([["read", "T1"], ["alarm", "A2"], ["flush"]], 0));`, fill, `  const queue = [];
  const uploaded = [];
  const alarms = [];
  const seenAlarms = new Set();
  let dropped = 0;
  let peak = 0;
  for (const [kind, id] of events) {
    if (kind === "alarm") {
      if (!seenAlarms.has(id)) {
        seenAlarms.add(id);
        alarms.push(id);
      }
    } else if (kind === "flush") {
      uploaded.push(queue.shift() ?? "空");
    } else if (kind === "read") {
      if (capacity === 0) {
        dropped += 1;
      } else {
        if (queue.length === capacity) {
          queue.shift();
          dropped += 1;
        }
        queue.push(id);
        peak = Math.max(peak, queue.length);
      }
    }
  }
  return "上传:" + (uploaded.join(",") || "-") + " 告警:" + (alarms.join(",") || "-") + " 淘汰:" + dropped + " 峰值:" + peak;`,
  '上传:T2,T3,空 告警:A1 淘汰:1 峰值:2\n上传:空 告警:A2 淘汰:1 峰值:0',
  ['背压丢旧与告警分流', '零容量边界']),
})

const gatewaySim = exercise('javascript', `function runGateway(events, capacity, timeout) {
  // 处理 connect、beat、tick、frame、flush 五类事件，返回逐条轨迹与汇总。
${fill}
}

console.log(runGateway([
  { kind: "connect", pub: { topic: "/gh/temp", qos: 1 }, sub: { topic: "/gh/temp", qos: 1 } },
  { kind: "beat", seq: 1, at: 2 },
  { kind: "tick", at: 6 },
  { kind: "frame", seq: 1, raw: 0x3190 },
  { kind: "frame", seq: 2, raw: 0x3211, msgId: "A1" },
  { kind: "frame", seq: 2, raw: 0x3211, msgId: "A1" },
  { kind: "flush" },
], 2, 5));

console.log(runGateway([
  { kind: "connect", pub: { topic: "/gh/temp", qos: 0 }, sub: { topic: "/gh/temp", qos: 1 } },
  { kind: "tick", at: 0 },
  { kind: "beat", seq: 1, at: 2 },
  { kind: "beat", seq: 1, at: 6 },
  { kind: "tick", at: 7 },
  { kind: "beat", seq: 2, at: 8 },
  { kind: "tick", at: 9 },
], 2, 5));

console.log(runGateway([
  { kind: "frame", seq: 1, raw: 0x1140 },
  { kind: "frame", seq: 2, raw: 0x1150 },
  { kind: "frame", seq: 3, raw: 0x1160 },
  { kind: "frame", seq: 4, raw: -5 },
  { kind: "flush" },
  { kind: "flush" },
], 2, 5));`, fill, `  const trace = [];
  let lastBeat = null;
  let lastBeatSeq = 0;
  let latestFrameSeq = 0;
  const queue = [];
  const alarms = new Set();
  let dropped = 0;
  for (const event of events) {
    if (event.kind === "connect") {
      if (event.pub.topic !== event.sub.topic) trace.push("主题不符");
      else if (event.pub.qos < event.sub.qos) trace.push("QoS不足");
      else trace.push("链路兼容");
    } else if (event.kind === "beat") {
      if (event.seq > lastBeatSeq) {
        lastBeatSeq = event.seq;
        lastBeat = event.at;
        trace.push("心跳" + event.seq);
      } else {
        trace.push("旧心跳");
      }
    } else if (event.kind === "tick") {
      trace.push(lastBeat === null ? "未上线" : (event.at - lastBeat >= timeout ? "离线" : "在线"));
    } else if (event.kind === "frame") {
      if (!Number.isInteger(event.raw) || event.raw < 0 || event.raw > 0xFFFF) {
        trace.push("无效帧");
        continue;
      }
      const nodeId = (event.raw >>> 12) & 0xF;
      const temp = (event.raw >>> 4) & 0xFF;
      const alarm = (event.raw & 1) === 1;
      if (alarm) {
        const key = event.msgId ?? ("S" + event.seq);
        if (alarms.has(key)) trace.push("重复告警" + key);
        else {
          alarms.add(key);
          trace.push("告警N" + nodeId + ":" + temp + "C");
        }
        continue;
      }
      if (event.seq <= latestFrameSeq) {
        trace.push("旧帧" + event.seq);
        continue;
      }
      latestFrameSeq = event.seq;
      if (capacity === 0) {
        dropped += 1;
        trace.push("淘汰N" + nodeId + ":" + temp + "C");
      } else {
        if (queue.length === capacity) {
          queue.shift();
          dropped += 1;
        }
        queue.push("N" + nodeId + ":" + temp + "C");
        trace.push("入队N" + nodeId + ":" + temp + "C");
      }
    } else if (event.kind === "flush") {
      trace.push("上传" + (queue.shift() ?? "空"));
    }
  }
  trace.push("待发=" + queue.length + " 告警=" + alarms.size + " 淘汰=" + dropped);
  return trace.join(" | ");`, [
  '链路兼容 | 心跳1 | 在线 | 入队N3:25C | 告警N3:33C | 重复告警A1 | 上传N3:25C | 待发=0 告警=1 淘汰=0',
  'QoS不足 | 未上线 | 心跳1 | 旧心跳 | 离线 | 心跳2 | 在线 | 待发=0 告警=0 淘汰=0',
  '入队N1:20C | 入队N1:21C | 入队N1:22C | 无效帧 | 上传N1:21C | 上传N1:22C | 待发=0 告警=0 淘汰=1',
].join('\n'), ['完整链路与告警去重', 'QoS校验与心跳超时恢复', '突发背压与非法帧拦截'])

const project: CourseProject = {
  title: '结课项目 · 智能温室边缘网关模拟器',
  summary: '把 16 位传感帧解包、主题/QoS 校验、心跳离线判定与有界缓冲背压整合到同一台模拟边缘网关。',
  requirements: [
    '支持五类输入事件：connect（检查主题一致与 pub.qos >= sub.qos）、beat（仅高序号心跳更新在线时刻）、tick（未上线/在线/离线，差值 >= timeout 为离线）、frame（16 位无符号帧解包）、flush（从常规队头上传一条）。',
    'frame 校验范围 0 到 0xFFFF。解出高 4 位 nodeId、中 8 位 temp 和最低位 alarm。alarm 为 1 时走独立告警通道并按 msgId 去重；常规帧按递增 seq 过滤旧帧，进入容量为 capacity 的常规队列，满时淘汰最旧并计入 dropped。',
    '每条事件记录一步轨迹，末尾追加「待发=X 告警=Y 淘汰=Z」，全部步骤用 " | " 连接返回。',
  ],
  examples: [
    { label: '完整链路与告警去重', input: 'QoS 1 兼容、心跳 1 在线、常规帧 0x3190（25°C）、重复告警帧 0x3211（33°C, A1）与一次上传', expected: '入队 N3:25C，A1 仅触发一次告警，第二次标为重复告警 A1，上传 N3:25C。' },
    { label: 'QoS 校验与心跳超时恢复', input: 'QoS 0 对 QoS 1；心跳 1 在 t=2，旧心跳 1 在 t=6，t=7 检查，心跳 2 在 t=8，t=9 检查', expected: '报 QoS不足；旧心跳不续期，t=7 离线，t=8 心跳 2 恢复在线。' },
    { label: '突发背压与非法帧拦截', input: '容量 2 连续收到 20°C、21°C、22°C 及非法帧 -5，随后 flush 两次', expected: '第 3 条挤出 20°C（淘汰=1），非法帧 -5 被拦截，两次上传依次发出 21°C 和 22°C。' },
  ],
  exercises: [{ ...gatewaySim, title: '实现边缘网关事件回放', downloadName: 'iot-gateway-sim.js' }],
  explanation: '边缘网关把链路匹配、节点存活、告警幂等和遥测背压拆成互不干扰的四块状态。这样任何一条异常帧或突发流量都不会破坏告警通道或在线判定。',
}

export const iotProtocols = {
  lessons: [framesAndQos, heartbeatAndDedup, gatewayBackpressure],
  project,
}
