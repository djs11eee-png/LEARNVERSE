import type { AdvancedTrack, CourseProject } from '../types'
import { check, demo, exercise, lesson, step } from './languagesAuthoring'
import { dijkstraSource, dijkstraTemplate, heapSource, relaxSource } from './languagesGraphCore'

const pathSource = `function pathFrom(parents, goal) {
  const path = [];
  for (let node = goal; node !== null; node = parents.get(node)) {
    path.push(node);
  }
  return path.reverse();
}`

const graphCases = `const example = new Map([
  ["A", ["B", "C"]], ["B", ["A", "D"]], ["C", ["A", "D"]],
  ["D", ["B", "C"]], ["E", []],
]);`

const algorithmsLessons = [
  lesson({
    id: 'graph-adjacency',
    title: '用邻接表表达地点和连接',
    summary: '区分顶点、边和方向，按输入顺序为每个顶点建立可遍历的邻居清单。',
    primer: { lead: '地图上的每个地点是一张卡，一张卡上只列一步能去哪里。沿着这些卡片就能描述复杂的路线。', terms: [['顶点', '图中的一个独立地点或状态。'], ['边', '连接两个顶点的一次可移动关系。'], ['邻接表', '用顶点作键，值是该点经一条边所能到达的邻居清单。']] },
    objectives: ['从一组地点和边建立邻接表', '区分单向与双向边', '保存孤点并拒绝未知端点'],
    sections: [
      demo('javascript', '先为每个地点建一份清单', [
        '用 Map 把地点编号映射到数组。graph.set(id, []) 创建空清单，graph.get(id) 取得刚才存进去的数组。通过 push 改动该数组，同时也改变 Map 里该编号对应的值。只有已登记的键才能安全地调用 graph.get(id).push(...)。',
        '下面 A 可以去 B，但 B 没有回 A 的一条边。C 没有邻居仍要保留为已知地点。试着在两条输出之间给 B 补一条返回 A 的边，运行后 B 的清单为 A，C 仍是空数组。项目会明确哪些连接按双向处理。',
      ], `const graph = new Map();
for (const node of ["A", "B", "C"]) graph.set(node, []);
graph.get("A").push("B");
for (const id of ["A", "B", "C"]) {
  console.log(id + ":" + graph.get(id).join(","));
}`, 'A:B\nB:\nC:'),
      step('建立邻接表时明确输入顺序和拒绝条件',
        '无向图中的 A—B 要加两条邻居关系。若编号 B 不在地点表中，就无法判断这条边连向哪里，应报告输入错误。不要临时补建 B，否则拼写错误会悄悄变成新地点。先确认地点登记完成，再读取边；确认两个端点都出现过才能修改清单。',
        '同一张图还可以用二维表保存，行和列表示顶点，交点表示是否连接。邻接表适合地点很多、但每个地点只有少量可走路线的情况。一条边可按规定记录一到两项。保存地点与边需要的空间与 V + E 同阶，不必为所有可能的组合分配格子。',
        '某些地图保留平行路线，如同两个地点间有室内和室外两条走廊。若题目允许，就依次保存两项，搜索时各自比较。自环 L—L 不会让 L 成为新的顶点，遍历时依然可以用已见集避免重复进入。',
        '构造错误测试时，可以登记 A 和 B 后输入 A—X。把 X 当作一张新卡会掩盖地图数据问题。相反，只登记 A 而不输入任何边仍是合法图，A 的邻居为空。两例一起跑，能确认实现区分「未知地点」和「没有相邻地点」。'),
      demo('javascript', '动手检查双向边和孤点', [
        '每条 edge 是一个含两个位置的小数组。用 edge[0]、edge[1] 取两个端点，has 只判断编号已登记，不在次数上做假设。若某一个端点未知就返回 invalid edge，函数中的局部邻接表不用公开。',
        '先运行，A 依输入次序连 B、C，C 的返回边只到 A，D 仍为空。把第二条边改成 ["A","X"]，预期只显示 invalid edge。章末练习要返回 Map 本身，由给定显示函数处理输出。',
      ], `function neighbors(nodes, edges) {
  const graph = new Map();
  for (const id of nodes) graph.set(id, []);
  for (const edge of edges) {
    const a = edge[0];
    const b = edge[1];
    if (!graph.has(a) || !graph.has(b)) return "invalid edge";
    graph.get(a).push(b);
    graph.get(b).push(a);
  }
  return nodes.map(id => id + ":" + graph.get(id).join(",")).join(" ");
}
console.log(neighbors(["A", "B", "C", "D"], [["A", "B"], ["A", "C"]]));`,
      'A:B,C B:A C:A D:'),
    ],
    pitfalls: [
      { mistake: '只登记至少出现过一次边的地点。', why: '孤点会被错误归类为未知地点。', fix: '先为每个声明地点建立空数组。' },
      { mistake: '双向连接只添加一边。', why: '从反方向就无路可走。', fix: '按无向合同同时追加两个邻接项。' },
    ],
    practice: { prompt: '在 makeGraph 中建立双向图。未知端点返回 null，地点与邻居顺序照模板给定。', checkpoints: ['三点两边保留方向两侧。', '孤点和未知端点在输出上可区分。'], hints: ['先循环节点，为每个编号建立一个空数组。', '再检查边两端，成功时各 push 一次。'], solution: '节点登记独立于边，双向连接为两个已有数组各增加一项。' },
    questions: [
      check('ga1-isolated', '无连接但已经登记的 C 在邻接表应是什么？', ['没有键', 'C 指向空数组', 'C 指向 A', 'C 指向自身'], 1, '空数组表示已知地点当前没有邻居。'),
      check('ga1-undirected', 'A—B 双向应保存怎样的关系？', ['只 A 到 B', '只 B 到 A', 'A 到 B 和 B 到 A', '都省去'], 2, '邻接表访问每个方向独立。'),
      check('ga1-unknown', '边引用未知地点，按本课应怎样？', ['拒绝此图', '临时创建并继续', '忽略所有边', '把端点改成第一个地点'], 0, '未知端点表示输入资料不合格。'),
      check('ga1-sparse', '相较 V×V 表，边少的邻接表有什么优势？', ['不会加入新顶点', '可以删除需登记的顶点', '所有比较都变成 0', '不为不存在的边预留格子'], 3, '邻接表只存顶点和实际边。'),
    ],
    exercise: exercise('javascript', `function makeGraph(nodes, edges) {
  /* 建图 */
  return null;
}

function show(nodes, edges) {
  const graph = makeGraph(nodes, edges);
  if (graph === null) {
    console.log("invalid graph");
    return;
  }
  console.log(nodes.map(id => id + ":" + graph.get(id).join(",")).join(" "));
}

show(["A", "B", "C"], [["A", "B"], ["B", "C"]]);
show(["X"], []);
show(["A"], [["A", "X"]]);`, '/* 建图 */\n  return null;', `const graph = new Map();
  for (const id of nodes) graph.set(id, []);
  for (const edge of edges) {
    const a = edge[0];
    const b = edge[1];
    if (!graph.has(a) || !graph.has(b)) return null;
    graph.get(a).push(b);
    graph.get(b).push(a);
  }
  return graph;`, 'A:B B:A,C C:B\nX:\ninvalid graph', ['双向邻接', '孤点', '未知端点']),
  }),
  lesson({
    id: 'bfs-path',
    title: '用广度优先搜索找到最少边数的路径',
    summary: '用 FIFO 队列一层一层扩展顶点，记录父节点并重建路径。',
    primer: { lead: '从入口先看所有一步可达的地方，再看两步，像一圈圈向外找。先被找到的层就是最少步数。', terms: [['BFS', '广度优先搜索，按离起点的边数逐层访问。'], ['父节点', '记录当前节点是从哪一节点第一次看到的。'], ['不可达', '起点所在可达范围里没有目标。']] },
    objectives: ['用队列按层访问', '在入队时标记已见', '从父节点表重建路径与区分不可达'],
    sections: [
      demo('javascript', '在入队的同一刻登记已见', [
        '队列取出最早加入的一项，再看它的邻居。为了避免数组每次 shift 可能需要移动多项，这里用 head 记录下一个待处理下标，读取后令 head 增一。push 总是在数组末尾追加。头下标最终追上 length 时，队列已经空了。',
        'A 连 B 与 C，B 与 C 都能到 D。第一次发现 D 就把它登记到集合并入队。检查 visited.has(next) 可避免另一条边再次加入 D，也防止环形路线回到 A。先运行，再交换 A 邻居的顺序，输出会变成 A,C,B,D。',
      ], `const graph = new Map([
  ["A", ["B", "C"]], ["B", ["A", "D"]], ["C", ["D"]], ["D", []],
]);
const visited = new Set(["A"]);
const queue = ["A"];
for (let head = 0; head < queue.length; head++) {
  const at = queue[head];
  for (const next of graph.get(at)) {
    if (visited.has(next)) continue;
    visited.add(next);
    queue.push(next);
  }
}
console.log(queue.join(","));`, 'A,B,C,D'),
      step('追踪第一条发现路线',
        '搜索按每个顶点在队列中的层次处理。层 0 只有起点，层 1 是一步可达的新顶点，每次扩展一条边后到下一层。第一次发现 D 的父节点一定来自可以达到它的最早一层，所以父节点链给出最少边数。',
        '保存 parents，键为新发现的顶点，值为发现它的当前顶点。用 parents.has(next) 同时当已见集合。起点的父设为 null，重建时从目标沿父节点倒走，遇到 null 后把数组 reverse。父节点在更早一层，不会产生循环。',
        '如果起终点同一地点，返回只含一个顶点的路径，边数 0。若图里知道终点但搜索没有登记它，报告不可达。未知顶点在访问 get 之前检查，应该与不可达分开。BFS 最少的是边数，边有不同路程时需要另一个算法。',
        '每个可达顶点最多入队一次，出队时只遍历它已有的邻居，整个搜索的时间与顶点和边的数量相加同阶。多个并列路线的具体选择由邻居在表里的顺序决定。若 A 同时连 B 和 C，先扫 B 会得到经 B 的路径，交换输入顺序可得到经 C 的同长路径。'),
      demo('javascript', '动手追一张父节点表', [
        '给定表是 A→B→D 这一条搜索路线的记录。从 D 读到 B，从 B 读到 A，A 的值是 null。把倒序的 D,B,A 反转得到 A,B,D。只有 parents 里确实存在的目标才能交给 pathFrom。',
        '把 D 的父改为 C，再补 C 的父 A，预期第一行变成 A>C>D。章末题保留重建帮助函数，专心实现每次入队时登记父节点的逻辑。',
      ], `${pathSource}
const parents = new Map([["A", null], ["B", "A"], ["D", "B"]]);
console.log(pathFrom(parents, "D").join(">"));
console.log(pathFrom(parents, "A").join(">"));`, 'A>B>D\nA'),
    ],
    pitfalls: [
      { mistake: '等到出队后才标记已见。', why: '多个父顶点可能在之前反复把同一邻居压入队列。', fix: '发现后立即登记，再入队。' },
      { mistake: '对从未发现的目标沿父节点倒走。', why: '父节点链没有合法起点。', fix: '先判断 parents.has(goal)。' },
    ],
    practice: { prompt: '实现 bfs，返回由 > 连接的最少边路径，区分同点、不可达和未知位置。', checkpoints: ['A 到 D 采用 A>B>D，邻居顺序决定并列。', 'A 到 E 不可达，A 到 A 只输出 A，未知点要提前拒绝。'], hints: ['已有的 parents 可以兼任访问标记。', '先把起点关联到 null，然后用 head 从队列顺序遍历。'], solution: '在入队时设父节点，遍历后看目标是否出现。只有到达的目标调用 pathFrom。' },
    questions: [
      check('ga2-fifo', 'BFS 逐层扩展使用哪种取出顺序？', ['后进先出', '按字母', '先进先出', '全随机'], 2, '同一层待处理项先入队，先于下一层处置。'),
      check('ga2-mark', '应何时登记邻居已见？', ['首次入队时', '最终打印时', '所有搜索结束后', '它第二次出队时'], 0, '入队同时记录就不会重复加入。'),
      check('ga2-start', 'A 到 A 的路径有几条边？', ['两条', '零条', '一条', '未定义'], 1, '留在起点不需经过边。'),
      check('ga2-limit', 'BFS 默认最小化什么？', ['所有顶点数', '边权总和', '最小单边', '行走的边数'], 3, '普通 BFS 按步数分层，不累计不同边权。'),
    ],
    exercise: exercise('javascript', `${pathSource}
${graphCases}

function bfs(graph, start, goal) {
  /* 搜索并重建 */
  return "TODO";
}

console.log(bfs(example, "A", "D"));
console.log(bfs(example, "A", "A"));
console.log(bfs(example, "A", "E"));
console.log(bfs(example, "A", "X"));`, '/* 搜索并重建 */\n  return "TODO";', `if (!graph.has(start) || !graph.has(goal)) return "unknown location";
  const parents = new Map([[start, null]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    if (at === goal) return pathFrom(parents, goal).join(">");
    for (const next of graph.get(at)) {
      if (parents.has(next)) continue;
      parents.set(next, at);
      queue.push(next);
    }
  }
  return "unreachable";`, 'A>B>D\nA\nunreachable\nunknown location', ['并列取先发现的路径', '起终点相同', '已知但不可达', '未知地点']),
  }),


  lesson({
    id: 'dijkstra-queue',
    title: '用最小优先队列写 Dijkstra 搜索',
    summary: '先处理当前距离最短的候选，持续比较通过边到达的更短路线。',
    primer: { lead: '要找路程最短的路线，下一个该展开的位置要看已经走了多远。候选路线可能在后来被更短路径替换。', terms: [['优先队列', '按优先键取出最小或最大元素，不以单纯入队次序决定。'], ['松弛', '发现一条到邻居更短的路线时，更新距离与父节点。'], ['过期候选', '队列中的距离已被另一路径改短，取出后应跳过的旧条目。']] },
    objectives: ['解释最小堆怎样维护最小候选', '按严格更短更新距离和父节点', '说明非负边权与安全提前结束的关系'],
    sections: [
      demo('javascript', '先观察同距离的候选谁先取出', [
        'MinQueue 把候选按距离组织成二叉堆。用数组表示树，父节点下标为 floor((i - 1) / 2)，孩子为 2i + 1、2i + 2。每个父亲都不大于其孩子，因此堆顶是全体最小项。堆不保证整个数组有序。',
        '新候选追加到尾端后向上换到合适位置。取出顶项时把末项放到顶，与较小孩子交换直到满足父子约束。两条距离相等时查看登记号 order，让先到的候选先取出。queue.size 是 getter 属性，代码中读取它无需括号。',
        '运行后取出 A、B、X。把 B 的距离改为 1，预期改为 B、A、X。后面的练习已提供堆代码，重点在队列怎样为搜索提供下一个候选。',
      ], `${heapSource}
const queue = new MinQueue();
queue.push("X", 8);
queue.push("A", 2);
queue.push("B", 2);
const order = [];
while (queue.size > 0) order.push(queue.pop().id);
console.log(order.join(","));`, 'A,B,X'),
      step('只接受严格改短的候选',
        '起点距离为 0，其余暂未登记。拿当前地点与某条边计算 candidate = current.distance + edge.weight。若邻居还没有已知距离，或 candidate 比已知更小，就写入距离与父节点，再把新候选入队。距离相等时保留先见的记录，这也避免零权环反复更改父节点。',
        '考虑 A→X 为 8，A→B 为 1，B→X 为 1。最早将 X 以 8 入队，先取出 B 时又找到 X 的距离 2。旧候选 8 仍留在堆，弹出时与 distances.get("X") 比较，发现它和当前最佳不一致，直接跳过。',
        '当某个当前最佳候选被取出，没有待处理项比它近。如果边都非负，从更远的待处理项再走一步也不可能变得更近，因此目标弹出时可以返回。若允许负权，这条推断会失效。别在首次加入队列时结束，因为还可能通过较近的点改短。'),
      demo('javascript', '动手让另一条路线赢过直达边', [
        '下面的三点图最早看到直达 X 的记录，但从 B 转一次更短。运行后输出 2 A>B>X，再把直达边的权重改为 0，预期输出 0 A>X。',
        '尝试将目标换成 B，输出 1 A>B。看父节点变化来核对路线，而不只看距离。继续到正式练习时，堆和冗余候选的判定已经写好，要你补的是遍历边、更新距离、设置父节点和入队。',
      ], `${heapSource}
${pathSource}
${dijkstraSource}
const graph = new Map([
  ["A", [{to: "X", weight: 8}, {to: "B", weight: 1}]],
  ["B", [{to: "X", weight: 1}]],
  ["X", []],
]);
const result = dijkstra(graph, "A", "X");
console.log(result.distance + " " + result.path.join(">"));`, '2 A>B>X'),
    ],
    pitfalls: [
      { mistake: '看到目标第一次入队就返回。', why: '此时其他候选还可能找到更短路径。', fix: '目标作为当前最新最短候选出队才结束。' },
      { mistake: '用 <= 修改相同距离的父节点。', why: '并列时的顺序可能漂移，零权附近还可能反复入队。', fix: '只在严格更短时覆盖。' },
    ],
    practice: { prompt: '补全松弛步骤。输入图与点已经验证，对同一点保留先发现的同距离候选。', checkpoints: ['较短中转替代直达。', '同点为 0，孤点不可达；去终点 Z 时要安全跳过 X 的过期条目。'], hints: ['遍历 graph.get(current.id) 获取带 to 与 weight 的边。', '先看 known，严格改短才同时更新 distances、parents 后入堆。'], solution: '保留有效最短候选的父节点。旧条目在取出时过滤，遇到最新目标候选即可重建。' },
    questions: [
      check('ga3-min', '最小堆直接保证哪个位置是最小条目？', ['堆顶', '最后', '中点', '第一个叶子'], 0, '每条父子边都遵循父不大于子。'),
      check('ga3-old', 'X 的距离已改为 2，弹出旧条目 8 怎么做？', ['覆盖成 8', '立即结束', '跳过旧条目', '重新登记起点'], 2, '它已不再代表当前最佳距离。'),
      check('ga3-stop', '何时可以提前交回目标？', ['第一次作为邻居出现', '用当前最佳距离取出目标时', '所有顶点仍未处理时', '只能在初始化时'], 1, '非负权保证最新最小候选弹出时为最短。'),
      check('ga3-equal', '发现到邻居的 candidate 等于 known，按本课应怎样？', ['重新入队并删已有记录', '无条件使用新父节点', '增加距离', '保留已有距离和父节点'], 3, '严格改短保持并列选择稳定，避免无谓循环。'),
    ],
    exercise: exercise('javascript', `${heapSource}
${pathSource}
${dijkstraTemplate}
const graph = new Map([
  ["A", [{to: "X", weight: 8}, {to: "B", weight: 1}, {to: "Z", weight: 11}]],
  ["B", [{to: "X", weight: 1}]],
  ["X", []], ["Y", []], ["Z", []],
]);
function show(goal) {
  const result = dijkstra(graph, "A", goal);
  console.log(result ? result.distance + " " + result.path.join(">") : "unreachable");
}
show("X");
show("A");
show("Z");
show("Y");`, '/* 更新找到的更短路径 */', relaxSource,
      '2 A>B>X\n0 A\n11 A>Z\nunreachable', ['中转比直达短', '原地不移动', '安全略过旧候选', '孤点不可达']),
  }),
  lesson({
    id: 'graph-validation',
    title: '校验图输入并用独立方法交叉核对',
    summary: '区分坏图、未知地点和无路，并通过小图或等权对照验证结果。',
    primer: { lead: '路线失败可能是地图坏、问了不存在的入口，也可能真的不通。先训练把原因分开，再检查路线是否最优。', terms: [['校验', '在搜索之前检查邻接关系、端点和权重合同。'], ['交叉核对', '在适用条件下用另一种可信方法比较结果。'], ['路径证据', '能逐段核对方向、权重和总长度的路线。']] },
    objectives: ['验证整张图再接收路线请求', '用连通、孤点、零权与坏权重样本区分错误', '在小图和单位边权图上独立验证最短路线'],
    sections: [
      demo('javascript', '先过滤每条数据的形状和范围', [
        '项目里的边有三个位置，依次为两个顶点与一个权重。验证 Array.isArray(edge) 与长度后，用 const [from, to, weight] = edge 按位置取出三个值。端点须在顶点集合中。用 Number.isInteger(weight) 拒绝数字文本、NaN、小数，再检查从 0 到 1000000 的范围。零权可表示不计路程的连接，仍是有效边。',
        '下例依次传正常边、零权边、未知端、负数和文本。把其中一个坏值改成 4 验证接受。边允许输入多条，判断其中一条失败就把整图报告为 invalid graph，不能静默丢弃它再给出看似正确的路线。',
      ], `function validEdge(edge, known) {
  if (!Array.isArray(edge) || edge.length !== 3) return false;
  const [from, to, weight] = edge;
  return known.has(from) && known.has(to) &&
    Number.isInteger(weight) && weight >= 0 && weight <= 1000000;
}
const known = new Set(["A", "B"]);
for (const edge of [["A", "B", 4], ["A", "B", 0], ["A", "Z", 4],
                    ["A", "B", -1], ["A", "B", "4"]]) {
  console.log(validEdge(edge, known));
}`, 'true\ntrue\nfalse\nfalse\nfalse'),
      step('用能手算的小图验证，而不只核对总数字',
        '面对一条算法结果，可先检查路线从指定起点开始、最后到目标。接着沿相邻顶点对找边，按路径累加每一步的最小可用边权。如果有平行边，算法可能选择相同端点间较短的一条。校验路径合法和总长正确仍没有证明最短，要另外提供可靠的小图期望。',
        '所有边权都等于 1 时，BFS 的边数就是总距离，可独立对照 Dijkstra。边权不同则不能以 BFS 验证距离。例如直达边长 11，而中转两条各长 2，BFS 挑一条边的路线，总距离应该用 Dijkstra 得到 4。用这组样本能发现错误地拿步数当距离。',
        '测试同点、已知但孤立的地点以及未知地点。相同起点和终点为 0，但起点如果不存在仍属于未知。有效图的不可达和整张图的输入有误应分别输出。并列时用 Z 在 A 前插入这样的顺序，避免字母排序偶然通过。'),
      demo('javascript', '动手把等权与异权测试分开', [
        '同一个三角形有两条候选路径。直达只走一条边，中转走两条。单位权重下两种方法都认定直达好；把直达改成 11，仍是最少边，但中转选择的距离为 4。把第二组直达权改成 4，两个距离并列，正确距离仍应是 4。',
        '正式题给出两种方法的结果，用函数辨别什么时候能够比较，以及是否一致。到结课项目则由你实现整图校验与距离计算，并通过内置的不同场景验证公开结果。',
      ], `function checkRoutes(direct, firstLeg, secondLeg) {
  const fewestEdges = 1;
  const shortest = Math.min(direct, firstLeg + secondLeg);
  console.log(fewestEdges + " " + shortest);
}
checkRoutes(1, 1, 1);
checkRoutes(11, 2, 2);`, '1 1\n1 4'),
    ],
    pitfalls: [
      { mistake: '遇到一条坏边就静默跳过。', why: '搜索结果不再来自用户提供的整张有效图。', fix: '先确认整图合法再开始搜索。' },
      { mistake: '有权图总拿 BFS 当对照。', why: '两者优化目标可能不同。', fix: '等权为 1 才核对步数，其余用手算路径和边界。' },
    ],
    practice: { prompt: '补全 verifyUnit。当所有边权都等于 1，用 BFS 步数比较 Dijkstra 路程。只有两者同时不可达也算一致。', checkpoints: ['12 与 12 一致，2 与 3 不一致。', '两者同时 null 一致，只一方为 null 不一致，有异质权重时不比较。'], hints: ['第一步确认样本可用 BFS 交叉核对。', '同类型的数字或 null 可用严格相等判断。'], solution: '先检查权重全为 1，随后以严格相等比较结果。两边的 null 同样可比较。' },
    questions: [
      check('ga4-unit', '什么时候 BFS 步数可以直接对照 Dijkstra 距离？', ['所有边权均为 1', '存在一条负边', '所有边权均为 2', '所有路径都含一条零权边'], 0, '每条边一次步数恰贡献一单位距离。'),
      check('ga4-null', '已登记的终点孤立且不同于起点，应报告？', ['未知地点', '自动补边', '不可达', '非法权重'], 2, '图认识两端，但不存在连接它们的路线。'),
      check('ga4-shape', '为什么先检查 edge 的数组形状再读其内容？', ['索引从 1 开始', '避免对缺失或不合合同的数据成员寻值', '用来判断总距离', '为了节省排序'], 1, '错误输入应变成明确的提示，而不是意外读值失败。'),
      check('ga4-proof', '路线每一段都存在且总和等于声称距离，单凭这些能证明什么？', ['路线一定是最短', '精确计算器无用', '目标不存在', '该返回路线及其总长可复查'], 3, '路径可行性与全局最短性是不同的核对。'),
    ],
    exercise: exercise('javascript', `function verifyUnit(weights, steps, distance) {
  /* 实现适用范围与比较 */
  return "TODO";
}
console.log(verifyUnit([1, 1], 12, 12));
console.log(verifyUnit([1], 2, 3));
console.log(verifyUnit([1], null, null));
console.log(verifyUnit([1], null, 0));
console.log(verifyUnit([1, 4], 2, 5));`, '/* 实现适用范围与比较 */\n  return "TODO";', `for (const weight of weights) {
    if (weight !== 1) return "not comparable";
  }
  return steps === distance ? "agree" : "disagree";`,
      'agree\ndisagree\nagree\ndisagree\nnot comparable', ['单位权一致', '单位权结果冲突', '同时不可达', '仅一方不可达', '异质边权']),
  }),
]

const graphProject = exercise('javascript', `${heapSource}
${pathSource}

function buildGraph(nodes, edges) {
  /* 建立并校验邻接表 */
  return null;
}

${dijkstraTemplate}

function plan(nodes, edges, start, goal) {
  const graph = buildGraph(nodes, edges);
  if (graph === null) return "invalid graph";
  if (!graph.has(start) || !graph.has(goal)) return "unknown location";
  const result = dijkstra(graph, start, goal);
  if (result === null) return "unreachable";
  return result.distance + " " + result.path.join(">");
}

const campus = ["A", "B", "C", "D", "E"];
const walks = [["A", "D", 11], ["A", "B", 2], ["B", "C", 1],
               ["C", "D", 2], ["A", "C", 6], ["B", "D", 8]];
console.log(plan(campus, walks, "A", "D"));
console.log(plan(campus, walks, "A", "A"));
console.log(plan(campus, walks, "A", "E"));
console.log(plan(campus, walks, "A", "X"));
console.log(plan(campus, [["A", "B", -1]], "A", "B"));
console.log(plan(campus, [["A", "X", 1]], "A", "B"));
console.log(plan(["S", "Z", "A", "T"], [["S", "Z", 0], ["S", "A", 0],
                ["Z", "T", 2], ["A", "T", 2]], "S", "T"));`,
  `function buildGraph(nodes, edges) {
  /* 建立并校验邻接表 */
  return null;
}

${dijkstraTemplate}`, `function buildGraph(nodes, edges) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null;
  const graph = new Map();
  for (const node of nodes) {
    if (typeof node !== "string" || node.trim() === "" || graph.has(node)) return null;
    graph.set(node, []);
  }
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 3) return null;
    const [from, to, weight] = edge;
    if (!graph.has(from) || !graph.has(to) || !Number.isInteger(weight) ||
        weight < 0 || weight > 1000000) return null;
    graph.get(from).push({ to, weight });
    graph.get(to).push({ to: from, weight });
  }
  return graph;
}

${dijkstraSource}`,
  '5 A>B>C>D\n0 A\nunreachable\nunknown location\ninvalid graph\ninvalid graph\n2 S>Z>T',
  ['加权中转比直达短', '零距离', '孤点不可达', '未知地点', '坏权值', '坏端点', '零权和并列顺序'])

const project: CourseProject = {
  title: '校园路线规划',
  summary: '把双向通道组织成邻接表，输出最短距离和可复查的地点序列。',
  requirements: [
    '地点须是非空白且唯一的编号。每条双向边指定两个已经登记的地点与 0 到 1000000 的整数路程。检查整图后再规划，出错返回 invalid graph。',
    '用最小优先队列和 Dijkstra 计算路程，严格更短才替换。按输入顺序添加邻居，队列同距离取先加入项。',
    '未知地点、已知但不可达分别输出 unknown location 与 unreachable。合法同点返回零距离和单一地点。',
    '堆、路径重建和报告已给。补全 buildGraph 与搜索中的松弛步骤，保留所有验收样本。',
  ],
  examples: [
    { label: '加权中转胜过直达', input: 'A 到 D 直达 11，经 B、C 分别为 2、1、2', expected: '5 A>B>C>D' },
    { label: '同点、孤点与未知点', input: '从 A 查 A、已登记的孤点 E 和未登记的 X', expected: '0 A、unreachable、unknown location' },
    { label: '输入图有错误', input: '用负权边 A—B，或未知端点 A—X 建图', expected: 'invalid graph' },
    { label: '零权及并列', input: 'S 先连接 Z 再连 A，均为 0；两者到 T 均为 2', expected: '2 S>Z>T' },
  ],
  exercises: [{ ...graphProject, title: '校验地图并计算最短路线', downloadName: 'campus-routes.js' }],
  explanation: '建图先检查原始结构，再向两端分别登记邻居。搜索先处理最短候选，再登记变短的路径。重建函数沿父节点取得完整路线，输出顺序能检查并列行为。',
}

export const advancedAlgorithms: AdvancedTrack = { direction: 'algorithms', lessons: algorithmsLessons, project }


