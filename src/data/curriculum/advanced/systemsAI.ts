import type { AdvancedTrack } from '../types'
import { jsProgram, lesson, worked } from './systemsSupport'

const lessons = [
  lesson({
    id: 'ai-retrieval-quality',
    title: '用 Top-K 指标读懂候选排序',
    summary: '从带标准证据的查询出发，分开检查检回多少、前排有多少证据，以及首条证据出现在何处。',
    primer: { lead: '用户只会看返回列表的前几项。找到第一条有用资料和把相关资料都找全，需要分别核对。', terms: [
      ['Top-K', '取排名最靠前的 K 个候选。本文按 ID 去重后截断。'],
      ['召回率 Recall@K', '前 K 项找到的相关资料数，除以标准相关资料总数。'],
      ['精确率 Precision@K', '前 K 项里的相关资料数除以 K。此处空位按未命中处理。'],
      ['首条相关项倒数排名', '第一个命中的位置取倒数，没有命中时给 0。位置从 1 起算。'],
    ] },
    objectives: ['从固定候选和参考编号计算三个指标。', '处理重复、列表不足 K 和没有参考证据的查询。'],
    sections: [
      { heading: '拿着参考资料清单逐项打勾', paragraphs: [
        '先挑一个查询，人工标出确实与问题有关的资料 ID。问通借规则时，R1 和 R4 是参考证据，检索返回 R2、R1、R3。取前三项后只有 R1 命中，因此召回为 1/2，精确率为 1/3。R1 排第 2 位，倒数排名为 1/2。召回帮助问「是否找齐」，精确率帮助问「前排夹杂了多少无关资料」，倒数排名反映第一个有用结果的位置。',
        '比较两个检索版本时给同一批查询、同一 K 和相同标准证据，才能分清改进来自排序还是截断规则。参考答案应以有资格提供结论的资料为准。仅看含相同关键词的段落容易把无关条目标成相关，进而高估效果。',
      ] },
      worked('把查找、截断与分母写成能逐项核对的代码', [
        'Set 会保留首次出现的唯一编号。把它转回数组后，用 slice 从 0 取 K 项。对这些候选逐项找参考集合中的相同编号。参考资料有三条时，召回的分母始终是 3。调整 K 到 2，核对精确率的分母改变，召回分母保持不变。',
        '注意题目约定按文档 ID 去重。若检索对象是片段，需要明确究竟按片段还是文档判定相关；本文以能够被引用的资料条目为单位。重复返回同一编号只能命中一次。记录这个约定可以防止两个版本因为去重规则不同而无法公平比较。',
      ], `const ranked = ['R2', 'R1', 'R1', 'R4', 'R5'];
const gold = new Set(['R1', 'R4', 'R6']);
const k = 3;
const top = [...new Set(ranked)].slice(0, k);
let hits = 0;
for (const id of top) {
  if (gold.has(id)) hits += 1;
}
console.log(top.join(','));
console.log('召回 ' + hits + '/' + gold.size + ' 精确 ' + hits + '/' + k);`, 'R2,R1,R4\n召回 2/3 精确 2/3'),
      worked('用首条命中区分两个召回相同的列表', [
        '下例的两份列表都找到了 R1 和 R4，前 3 项的召回均为 1，但首条命中一个在第 2 位，一个在第 1 位。用 findIndex 可找第一个命中，JavaScript 数组下标从 0 开始，因此要先加 1。把第二份列表换成没有参考 ID 的列表，预期得 0。',
        '无参考证据的查询没有可用于召回分母的条目，单独记为“不适用”，用它来测试系统会不会凭空回答。另一种情况是参考资料存在但列表没有命中，召回为 0，这是可观察的漏检。把这两类带进小样本结果表，能更具体地确定要改检索还是要改拒答策略。',
      ], `const gold = new Set(['R1', 'R4']);
function reciprocalRank(ids) {
  const at = ids.findIndex(id => gold.has(id));
  return at < 0 ? '0' : '1/' + (at + 1);
}
console.log(reciprocalRank(['R2','R1','R4']));
console.log(reciprocalRank(['R4','R1','R2']));
console.log(reciprocalRank(['R2','R3','R6']));`, '1/2\n1/1\n0'),
    ],
    pitfalls: [
      ['将 K 用作召回率分母。', '它只说明检查了多少个候选位置。', '召回分母是参考相关条目数。'],
      ['将没有参考证据与检索漏项都记成召回为 0。', '两者需要不同的排查和修复。', '空参考标不适用，漏检记 0。'],
    ],
    questions: [
      ['共有 4 条参考证据，前 2 项找到 1 条，Recall@2 为？', ['1/2', '1/4', '2/4', '1/1'], 1, '找到的相关数除以参考证据总数。'],
      ['K 为 3，只返回两条且两条都相关，按本课约定精确率是多少？', ['2/3', '2/2', '0/3', '3/3'], 0, '分母为 K，未填的位置也占候选预算。'],
      ['首条相关资料在第 4 位，倒数排名是多少？', ['4', '1/3', '1/4', '0'], 2, '按从 1 开始的位置取倒数。'],
      ['一个问题没有标准相关资料，最适合怎么记录？', ['自动命中率 100%', '增加一条无关参考', '按普通漏检归类', '召回记不适用，另评拒答'], 3, '空参考场景是拒答和资料范围测试。'],
    ],
    practice: {
      prompt: '实现 metrics。对候选去重后取前 K 项，报告召回分数、精确分数和首条证据的倒数排名。',
      checkpoints: ['候选重复 ID 只占一个位置。', '无参考证据报告不适用；有参考但没命中时输出 0。'],
      hints: ['先创建参考编号集合，用 slice 截取去重后的候选。', '分别数命中数并查找第一个命中的下标，别让两个指标共用分母。'],
      solution: '在代码里分别保留 top、gold 和命中位置。换算分数前先识别无参考证据的情况。',
    },
    exercise: jsProgram('计算固定候选指标', 'metrics(ranked, reference, k)', '  return "待实现";', `  const gold = new Set(reference);
  if (gold.size === 0) return '召回不适用';
  const top = [...new Set(ranked)].slice(0, k);
  const hits = top.filter(id => gold.has(id)).length;
  const first = top.findIndex(id => gold.has(id));
  return '召回 ' + hits + '/' + gold.size + ' 精确 ' + hits + '/' + k + ' 首中 ' + (first < 0 ? '0' : '1/' + (first + 1));`, `console.log(metrics(['R3','R1','R1','R2'], ['R1','R2'], 3));
console.log(metrics(['R1'], ['R1','R2'], 3));
console.log(metrics(['R3'], ['R1'], 2));
console.log(metrics(['R1'], [], 2));`, [
      ['重复去重后命中', '召回 2/2 精确 2/3 首中 1/2'], ['候选不足 K', '召回 1/2 精确 1/3 首中 1/1'],
      ['参考存在但漏检', '召回 0/1 精确 0/2 首中 0'], ['没有参考证据', '召回不适用'],
    ]),
  }),
  lesson({
    id: 'ai-evidence-support-matching',
    title: '让引用真正支撑回答里的结论',
    summary: '先查资料编号和摘句，再对照范围、单位与值，区分引用有效和证据充足。',
    primer: { lead: '回答给了一个链接，仍要翻到原文，核对它提供的条件和结论能否对应起来。', terms: [
      ['证据定位', '把回答中的编号与资料编号配对，并找到引用的准确位置。'],
      ['结构化事实', '用明确的字段记录适用范围、规则名称、数值与单位。'],
      ['覆盖', '回答的每一条可检验结论都能找到相应证据。'],
    ] },
    objectives: ['检查引用编号、原句与结构化事实的一致性。', '区分上下文无关、引文错误和缺覆盖。'],
    sections: [
      { heading: '把一整段回答拆成能重算的声明', paragraphs: [
        '假设校园资料写「本科生普通图书可借 30 天，教师可借 90 天」。回答「本科生普通图书可借 90 天」引用了真实段落，也用了真实数字，却混淆主体。核对时先拆成对象：规则是借期，范围是本科生普通图书，数值是 90，单位是天。随后逐字段与资料匹配，才能识别把教师规则挪给本科生的问题。',
        '课程使用小型结构化资料，便于精确比对。现实中的自然语言还可能含否定、例外和时间生效范围，逐字找到一段引文只是起点。课堂判定只覆盖事先列明的事实字段，解释时保留原句与适用范围，让读者能够独立核验。',
        '同一规则还可能随生效日期变化。若 2025 年通借规则为 20 天、2026 年起为 30 天，查询今天的期限时需要先确定有效版本。两条原文都真实，但适用日期不同。在设计评分表时注明日期与资料版本，才能判断引用的事实是否适用。',
      ] },
      worked('在目录中找编号，再检查摘句', [
        '先准备资料编号及其原句。map 中每个值保存一条允许引用的完整句子。本例规定引用使用完整句子，因此只接受与来源一致的文字。未知编号需要标记为无来源，已知编号但改了字则标记摘句不符。自己改一改 R1 的 30 天，观察错误落在摘句这一步。',
        '编号正确可以帮助定位资料，但它不会自动保证所引内容支持答案。例如 R1 的完整句子确实提到 30 天，所给的结论却写成 30 小时。报告时可以先把合法编号和摘句保留下来，再给字段错误具体原因。这样不必为同一条资料重新做一遍无效查找。',
      ], `const sources = new Map([['R1','本科生可借30天。'], ['R2','教师可借90天。']]);
function checkQuote(id, quote) {
  if (!sources.has(id)) return '无来源';
  return sources.get(id) === quote ? '摘句一致' : '摘句不符';
}
console.log(checkQuote('R1','本科生可借30天。'));
console.log(checkQuote('R1','本科生可借90天。'));
console.log(checkQuote('R9','本科生可借30天。'));`, '摘句一致\n摘句不符\n无来源'),
      worked('拿两个字段差一点的结论练习支持判断', [
        '下面用 fact 装一条资料事实，claim 装模型答复中的可检验结论。先比较对象范围，再比较天数与单位。有了已知字段后，可以用布尔表达式检查是否所有条件都匹配。把一个 claim 中的 unit 改成小时，观察结果变成 false。把范围改成教师同样会失败。',
        '复杂回答可能有多条结论，比如借期与续借次数。检查时判断每个必要结论是否都出现，各自是否有支持资料。用一条证据支持其中一项，无法自动给整段回答盖章。项目验收给定两条事实及其可引用编号，因此可以报告究竟少了哪个规则。',
      ], `const fact = { audience: '本科生', value: 30, unit: '天' };
function supports(claim) {
  return claim.audience === fact.audience && claim.value === fact.value && claim.unit === fact.unit;
}
console.log(supports({ audience: '本科生', value: 30, unit: '天' }));
console.log(supports({ audience: '教师', value: 30, unit: '天' }));
console.log(supports({ audience: '本科生', value: 30, unit: '小时' }));`, 'true\nfalse\nfalse'),
    ],
    pitfalls: [
      ['只核对回答里的数字是否出现在所引段落。', '数字所属范围、规则或单位可能不相同。', '先规范事实字段，再逐项比对。'],
      ['看到第一条引用有效就通过整份回答。', '后续结论可能没有任何支持。', '对所有必要结论单独检查证据覆盖。'],
    ],
    questions: [
      ['引用真实，但把教师规则用于本科生，属于哪类偏差？', ['编号不存在', '范围不匹配', '无法解析 JSON', '格式完全合格且结论正确'], 1, '事实支撑依赖适用对象。'],
      ['引用编号能定位到资料后还应检查？', ['输入光标位置', '随机换一个资料', '输出的字号', '摘句与事实字段'], 3, '找到原文后要核验是否支持具体结论。'],
      ['答案给出借期和续借次数，只能支持借期，应判定？', ['证据覆盖不完整', '全部通过', '目录格式一定无效', '两条结论都错误'], 0, '已支持的第一条无法替代第二条的证据。'],
      ['对真实的自然语言问答，完全相同引文意味着？', ['自动覆盖所有结论', '模型推理一定正确', '可定位原文，仍需核对语境', '不需要知道资料范围'], 2, '原文范围、否定和例外都可能影响支持关系。'],
    ],
    practice: {
      prompt: '按编号匹配资料，检查完整摘句与四个事实字段并给出首个失败原因。',
      checkpoints: ['编号、引文、范围、规则、值和单位都正确才支持。', '未知引用、原句篡改、事实不符可以分别定位。'],
      hints: ['先用 find 查编号，没有文档立即退出。', '摘句一致后逐项比较 scope、rule、value 和 unit。'],
      solution: '从是否能定位来源开始检查，再比较引文及结构化事实。让每个失败分支拥有稳定的分类。',
    },
    exercise: jsProgram('核对引用与事实', 'verify(docs, claim)', '  return "待实现";', `  const source = docs.find(doc => doc.id === claim.ref);
  if (!source) return '未知引用';
  if (source.quote !== claim.quote) return '摘句不符';
  const fields = ['scope','rule','value','unit'];
  return fields.every(field => source[field] === claim[field]) ? '证据支持' : '事实不符';`, `const source = { id: 'R1', quote: '本科生可借30天。', scope: '本科生', rule: '借期', value: 30, unit: '天' };
const claim = { ...source, ref: 'R1' };
console.log(verify([source], claim));
console.log(verify([source], { ...claim, ref:'R9' }));
console.log(verify([source], { ...claim, quote:'本科生可借90天。' }));
console.log(verify([source], { ...claim, unit:'小时' }));`, [['支持成立', '证据支持'], ['编号不存在', '未知引用'], ['引文被改', '摘句不符'], ['单位错误', '事实不符']]),
  }),
  lesson({
    id: 'ai-abstention-thresholds',
    title: '在证据薄弱或候选歧义时拒答',
    summary: '用分数、差距和证据覆盖决定是否答复，观察阈值如何影响风险与覆盖率。',
    primer: { lead: '校内办事答复一旦选错校区，数字再精确也无法给人正确指引。查不清时应说明还缺什么。', terms: [
      ['拒答', '证据不足时不提供具体结论，提示还需要哪份资料或哪个范围。'],
      ['阈值', '判断是否满足最低要求的一道数值界限，包含边界还是超出边界要事先约定。'],
      ['候选差距', '首位与次位的分数差，用于寻找可能需要澄清的歧义。'],
      ['覆盖率', '能够给出作答的输入数量占全部待处理输入的比例，要与错误率一起看。'],
    ] },
    objectives: ['确定无候选、低分、并列与证据不足的处置顺序。', '使用数值边界和证据缺项检验拒答规则。'],
    sections: [
      { heading: '先把每个门槛填进决策表', paragraphs: [
        '固定检索器按精确关键词加分。分数 2 表示匹配了两个词，不能读成回答正确的概率。没有正分候选便报告资料不足。有候选时，先要求首位至少 2 分，再要求它至少比次位高 1 分。如果两个不同校区的资料在高分并列，说明有必要先核对问题范围，提示用户补充校区。通过数值检查以后，还要判断资料能否支持问题需要的全部结论。',
        '门槛降低通常能让系统回答更多问题，也可能放行证据薄弱的数据。设置门槛时先对开发数据做对照，用另一批未参与调整的样本检验普通、歧义和缺资料。要留意格式标准与检索器可能随版本变化。分值定义改变后，沿用同一个数字门槛可能得到完全不同的决策。',
      ] },
      worked('手验两个恰好达到要求的分值', [
        '列表已经从高分到低分排列，只返回一个候选时，以 0 作为次位分数。[2,1] 的首位和差距恰好通过两个门槛，[3,3] 两份资料的差距为 0，应报告歧义。把 minGap 改为 0，再比较并列案例进入了哪一步。要记录下“以前被拒，现在可过”的具体样本，才知道放宽的后果。',
        '若希望阈值随输入而变，先为不同类型的任务定义一致的场景标识，再分别评估它们；不要为了让某一条样本好看而额外开一个分支。下方只做可复查的静态门槛工具。换成真实系统时，仍要使用相同版本的检索分数，并保留候选列表以便诊断。',
      ], `function gate(scores, minScore, minGap) {
  if (scores.length === 0) return '无候选';
  const first = scores[0];
  const second = scores[1] ?? 0;
  if (first < minScore) return '分数不足';
  if (first - second < minGap) return '候选歧义';
  return '继续核验证据';
}
for (const scores of [[2,1],[3,3],[1],[]]) console.log(gate(scores, 2, 1));`, '继续核验证据\n候选歧义\n分数不足\n无候选'),
      worked('把必需结论列出来，再找证据缺项', [
        '用户同时问借期和续借次数。首位段落即使高分也可能只说明借期。这时应提示「未找到续借规则，暂时无法确认」，不能为缺项编一个次数。示例把问题所需的规则写成 required，再与 available 对照。给 available 加上续借，观察两种状态的变化。',
        '如果规则允许部分答复，可以明确说明“已确认借期，续借仍待核实”，并给已确认项附证据。本练习采用全部必需项都具备才能答的约定。保留拒答原因有助于决定下一步应修检索范围、增加资料还是引导用户澄清。两条拒答的外观一样，修复位置可能各不相同。',
      ], `const required = ['借期', '续借'];
for (const available of [['借期'], ['借期','续借']]) {
  const missing = required.filter(rule => !available.includes(rule));
  console.log(missing.length ? '资料不足 缺少' + missing.join('、') : '证据完整');
}`, '资料不足 缺少续借\n证据完整'),
    ],
    pitfalls: [
      ['把关键词分数读成事实正确率。', '分值表达规则命中数，未经过概率校准。', '先用阈值粗筛，再验证来源和证据。'],
      ['提高阈值后只看错误答复减少。', '正常问题也可能被误拒。', '同时报告有效答复覆盖和适当拒答情况。'],
    ],
    questions: [
      ['最低分 2、最低差距 1，首位 2、次位 1，能否过门槛？', ['能，两个阈值都含边界', '不能，首位必须超过 2', '不能，差距必须超过 1', '直接确认作答'], 0, '达到两道数值门槛后继续核查证据。'],
      ['东西馆资料高分且并列，怎样处置？', ['选列表第一项', '选文档更长的一项', '先确认校区', '平均两个楼层'], 2, '候选范围不同，适合先澄清。'],
      ['首条高分但缺少续借次数依据时，本练习应怎样？', ['将次数填 0', '省略规则但声称已完整确认', '套用上次答案', '报告资料不足'], 3, '分数无法补足缺少的一项要求。'],
      ['下调最低分数后主要检查？', ['只有最高分查询', '有用答复和误答两类变化', '提示文字字号', '最初版本创建时间'], 1, '风险和作答覆盖都会受门槛调整影响。'],
    ],
    practice: {
      prompt: '实现离线答复门槛，分别报告空候选、低分、歧义和证据缺项。',
      checkpoints: ['最低分 2 与差距 1 恰好可以通过。', '高分但必需事实不足时仍报告资料不足。'],
      hints: ['先处理空候选，再比较首位与次位的分差。', 'covered 表示必需证据已经找齐，最后用它决定是否可答。'],
      solution: '按拒答原因的优先级依次筛选，最后一个分支只保留足够证据且分数达标的情况。',
    },
    exercise: jsProgram('判断是否有足够证据作答', 'decide(scores, covered)', '  return "待实现";', `  if (scores.length === 0) return '无候选';
  if (scores[0] < 2) return '分数不足';
  if (scores[0] - (scores[1] ?? 0) < 1) return '候选歧义';
  if (!covered) return '资料不足';
  return '可答';`, `for (const [scores,covered] of [[[2,1],true],[[2,2],true],[[4,1],false],[[1],true],[[],false]]) {
  console.log(decide(scores,covered));
}`, [['恰好过门槛', '可答'], ['高分并列', '候选歧义'], ['事实缺项', '资料不足'], ['匹配低分', '分数不足'], ['空候选', '无候选']]),
  }),
  lesson({
    id: 'ai-offline-regression-groups',
    title: '用固定样本分组报告问答回归',
    summary: '用相同样本比较两个版本，保留失败组、变化方向和可追溯的样本编号。',
    primer: { lead: '更新问答规则后，普通题多通过一条，常见歧义题却开始错误作答。总数相同会掩盖它。', terms: [
      ['固定样本', '预先确定的问题、资料版本、目标结果和回答记录，供不同版本重复比较。'],
      ['回归', '旧版通过的输入在新版中失败。通过检查旧编号与新编号对应识别。'],
      ['误答', '在不具备可靠证据时仍给出具体结论，或为可答问题给出错误事实。'],
    ] },
    objectives: ['按样本 ID 比较状态变化。', '同时报告总体、分组通过和可定位的失败路径。'],
    sections: [
      { heading: '先固定资料版本和判卷顺序', paragraphs: [
        '给样本一份稳定的目录。每行记录编号、问题、资料版本、参考证据以及规则要求作答还是拒答。输入一样后，按固定顺序判卷，例如先看格式，然后看检索是否找到必需资料，再核查回答引用和结论。若输出无法解析，最早可确认的问题是格式。保留此原因可以避免把一次失败同时归入所有几类。',
        '用开发组调整策略，以额外的保留组观察是否适用于旧版本没遇到的边界。新出现的事故可以冻结成回归用例，但需要另外保留独立测试。每次发布注明资料版本。资料本身发生变化时，先确认旧答案的适用范围，不能直接把两次结果的差异都归给问答逻辑。',
        '对影响范围较大的判卷事项，可以预先约定发布门槛，例如本次语料中不能新增无依据作答。即使总通过数上升，一条该拒答却提供具体值的回归也应单独复查。先定规则能减少只挑有利指标汇报的倾向。',
      ] },
      worked('用样本编号找出哪些通过变失败', [
        '两个版本可能按不同顺序返回列表。用 Map 按样本编号存储旧版的结果，再用新列表中的编号找旧状态。从 true 变为 false 是回归，反向是修复。示例假设两个版本都给出所有样本；真实报告要另列未参与评估的用例。把新版数组的顺序调换，修复和回归的样本身份应该一致。',
        '通过数不变时也要报告具体偏差。例如泛问题答复更好、需要拒答的题却开始乱答，可以先拉出错误编号与对应资料，再定位是候选还是决策门槛变化。编号旁边的失败类别让读者不用遍历全库就能回到对应输入。',
      ], `const previous = new Map([['Q1',true],['Q2',false],['Q3',true]]);
const current = [{id:'Q2',pass:true},{id:'Q3',pass:false},{id:'Q1',pass:true}];
for (const row of current) {
  const earlier = previous.get(row.id);
  if (earlier && !row.pass) console.log(row.id, '回归');
  if (!earlier && row.pass) console.log(row.id, '修复');
}`, 'Q2 修复\nQ3 回归'),
      worked('把正常答复和合理拒答并排列出', [
        '两条可答题均答对，两条应拒答题只有一条正确处理，总体为 3/4，分组是可答 2/2、应拒答 1/2。还可以单列误答统计：超时无回答与无证据仍给出具体答案，都未通过，但后者更需要追查。试把最后一题改成通过，核对应该增加哪组的分子，其他数据应相同。',
        '如果组的数量不同，按样本算的总体通过率对大组更敏感。不要把几个百分比简单平均后称为总体通过率，除非明确规定每个组权重相同。一个可读报告可以写“整体 8/10；应拒答 0/2”，保留实际分母也能防止将两个样本的结果误当成大样本结论。',
      ], `const rows = [{group:'可答',pass:true},{group:'可答',pass:true},
  {group:'应拒答',pass:true},{group:'应拒答',pass:false}];
for (const group of ['可答','应拒答']) {
  const selected = rows.filter(row => row.group === group);
  const passed = selected.filter(row => row.pass).length;
  console.log(group, passed + '/' + selected.length);
}`, '可答 2/2\n应拒答 1/2'),
    ],
    pitfalls: [
      ['按数组行号配对旧版与新版。', '结果重排时会比较不同问题。', '用稳定样本 ID 配对并单列缺失。'],
      ['仅公布总体通过率。', '正常样本较多时会掩盖应拒答失败。', '保留分组结果和每条回归的原因。'],
    ],
    questions: [
      ['比较两个版本应按什么配对？', ['显示位置', '样本稳定编号', '输出时间', '都是 true'], 1, '编号可以跨顺序找到同一输入。'],
      ['整体 8/10、应拒答组 0/2，如何报告？', ['仅 80%', '仅 0%', '整体 8/10、应拒答 0/2', '合并成 8/12'], 2, '总体和分组揭示不同范围。'],
      ['未见样本已写进提示，怎样恢复独立验证？', ['补一条未参与调整的固定样本', '把样本改名即可', '继续调到这一题通过', '只看总通过数'], 0, '参与调整的样本适合回归，新样本用于独立验证。'],
      ['一条原先通过的题在新版失败，应？', ['记作修复', '只删除旧结果', '忽略单个失败', '记录回归编号和原因'], 3, '这样可以定位改动影响。'],
    ],
    practice: {
      prompt: '汇总新版通过数，列出回归和修复编号。新增样本仍加入分母，本次不归入变化。',
      checkpoints: ['按编号配对，顺序改变没有关系。', '重复验证修复、回归、新增和空批次。'],
      hints: ['做一个旧版编号到结果的 Map。', '扫描新版收集修复和回归，最后对编号排序。'],
      solution: '先用新版算通过分子与分母，再按 ID 查旧版状态，分开记录变化方向。',
    },
    exercise: jsProgram('汇总固定问答回归', 'compare(before, after)', '  return "待实现";', `  const earlier = new Map(before);
  const regressions = [];
  const fixes = [];
  let passed = 0;
  for (const [id, ok] of after) {
    if (ok) passed += 1;
    if (!earlier.has(id)) continue;
    if (earlier.get(id) && !ok) regressions.push(id);
    if (!earlier.get(id) && ok) fixes.push(id);
  }
  return '通过 ' + passed + '/' + after.length + ' 回归 ' + (regressions.sort().join(',') || '无') + ' 修复 ' + (fixes.sort().join(',') || '无');`, `const before = [['Q1',true],['Q2',false],['Q3',true]];
console.log(compare(before,[['Q2',true],['Q3',false],['Q1',true]]));
console.log(compare(before,[['Q6',false],['Q1',true]]));
console.log(compare(before,[]));`, [['同总分但有变化', '通过 2/3 回归 Q3 修复 Q2'], ['新增样本', '通过 1/2 回归 无 修复 无'], ['空批次', '通过 0/0 回归 无 修复 无']]),
  }),
]

const project: AdvancedTrack['project'] = {
  title: '校园知识库问答回归台',
  summary: '在固定离线资料及答复样本上完成检索、证据核对和拒答判定，按场景报告回归。',
  requirements: [
    '对所有资料按唯一查询词精确匹配标签，过滤零分，按分数降序和原文顺序截取 Top-K。按参考编号计算召回。',
    '没有候选或完整排名的前两位同分时期待拒答。若参考证据没有完整进入前 K，优先报告检索漏项。参考证据专供评分。',
    '答复样本先检查 JSON 格式。作答时逐条核对来源编号、原句、范围、规则、数值和单位，并覆盖全部用例要求的事实。拒答不可附具体结论。',
    '报告每条候选、召回和首个失败类别，再输出整体及分组通过数。按稳定编号比较旧版与新版，列出回归和修复。',
  ],
  examples: [
    { label: '足够证据', input: '查本科生借阅规则，查询词为「借阅、借期」，K=3。', expected: 'R1 与 R2 命中，召回 2/2。借期 30 天及续借 1 次均有原文支持，判为通过。' },
    { label: '候选截断', input: '同一问题改为 K=1。', expected: '只有 R1，召回 1/2，报告检索漏项。' },
    { label: '并列和无候选', input: '查地点但校区不明，或查库中没有的停车。', expected: '并列和空候选均应拒答，仍填具体答案判为不当作答。' },
    { label: '来源无法支持结论', input: '引用真实的借期原文，把 30 天写成 30 小时。', expected: '判为证据不符。' },
    { label: '无法解析', input: '回答文本为 {bad。', expected: '先记格式错误。' },
  ],
  exercises: [
    jsProgram('离线检索与判卷', 'evaluate(corpus, sample)', `  // 返回「候选 召回分数 分类」，如 R1,R2 2/2 通过。
  // 先从完整资料库检索，再解析答复、查找漏项、判断拒答和证据。
  return '待实现';`, `  const keywords = [...new Set(sample.keywords)];
  const ranked = corpus.map(doc => ({
    ...doc, score: keywords.filter(word => doc.tags.includes(word)).length,
  })).filter(doc => doc.score > 0).sort((a, b) => b.score - a.score);
  const candidates = ranked.slice(0, sample.k);
  const ids = candidates.map(doc => doc.id);
  const hits = sample.gold.filter(id => ids.includes(id)).length;
  const recall = sample.gold.length ? hits + '/' + sample.gold.length : '不适用';
  const report = reason => (ids.join(',') || '空候选') + ' ' + recall + ' ' + reason;
  let answer;
  try { answer = JSON.parse(sample.answer); } catch { return report('格式错误'); }
  if (!answer || !['answer','abstain'].includes(answer.status) || !Array.isArray(answer.claims)) return report('格式错误');
  if (hits < sample.gold.length) return report('检索漏项');
  const ambiguous = ranked.length > 1 && ranked[0].score === ranked[1].score;
  if (candidates.length === 0 || ambiguous) {
    return report(answer.status === 'abstain' && answer.claims.length === 0 ? '通过' : '不当作答');
  }
  if (answer.status !== 'answer') return report('过度拒答');
  const fields = ['scope','rule','value','unit','quote'];
  const supported = new Set();
  for (const claim of answer.claims) {
    if (!claim || typeof claim !== 'object') return report('格式错误');
    const source = candidates.find(doc => doc.id === claim.ref);
    if (!source || !sample.gold.includes(source.id) || supported.has(source.id) || !fields.every(field => claim[field] === source[field])) {
      return report('证据不符');
    }
    supported.add(source.id);
  }
  return report(supported.size === sample.gold.length ? '通过' : '证据不全');`, `const corpus = [
  {id:'R1',tags:['借阅','借期'],scope:'本科生',rule:'借期',value:30,unit:'天',quote:'本科生借期30天。'},
  {id:'R2',tags:['借阅'],scope:'本科生',rule:'续借',value:1,unit:'次',quote:'本科生可续借1次。'},
  {id:'R3',tags:['地点'],scope:'东馆',rule:'楼层',value:1,unit:'层',quote:'东馆在1层。'},
  {id:'R4',tags:['地点'],scope:'西馆',rule:'楼层',value:2,unit:'层',quote:'西馆在2层。'},
];
const [first, second] = corpus;
const reply = { status:'answer', claims:[{ ...first, ref:'R1' }, { ...second, ref:'R2' }] };
const ok = { group:'可答', keywords:['借阅','借期'], gold:['R1','R2'], k:3, answer:JSON.stringify(reply) };
const missing = { group:'应拒答', keywords:['停车'], gold:[], k:3, answer:'{"status":"abstain","claims":[]}' };
const tied = { ...missing, keywords:['地点'], gold:['R3','R4'] };
const cases = [{ ...ok, id:'Q1' }, { ...ok, id:'Q2', k:1 },
  { ...ok, id:'Q3', answer:JSON.stringify({ ...reply, claims:[{ ...reply.claims[0], unit:'小时' },reply.claims[1]] }) },
  { ...missing, id:'Q4' }, { ...tied, id:'Q5' }, { ...tied, id:'Q6', answer:ok.answer }, { ...ok, id:'Q7', answer:'{bad' },
];
const baseline = new Map([['Q1',true],['Q2',false],['Q3',true],['Q4',true],['Q5',false],['Q6',false],['Q7',false]]);
const results = cases.map(sample => {
  const result = evaluate(corpus,sample);
  return { id: sample.id, group: sample.group, result, passed: result.endsWith(' 通过') };
});
for (const row of results) console.log(row.result);
for (const group of ['全部','可答','应拒答']) {
  const rows = results.filter(row => group === '全部' || row.group === group);
  console.log(group, rows.filter(row => row.passed).length + '/' + rows.length);
}
const regressions = results.filter(row => baseline.get(row.id) && !row.passed);
const fixes = results.filter(row => baseline.has(row.id) && !baseline.get(row.id) && row.passed);
console.log('回归',regressions.map(row => row.id).join(',') || '无','修复',fixes.map(row => row.id).join(',') || '无');`, [
      ['正常作答', 'R1,R2 2/2 通过'], ['只取首位', 'R1 1/2 检索漏项'], ['单位写错', 'R1,R2 2/2 证据不符'],
      ['无结果正确拒答', '空候选 不适用 通过'], ['并列正确拒答', 'R3,R4 2/2 通过'], ['并列错误作答', 'R3,R4 2/2 不当作答'],
      ['输出格式错误', 'R1,R2 2/2 格式错误'], ['总体', '全部 3/7'], ['可答分组', '可答 1/4'], ['拒答分组', '应拒答 2/3'],
      ['版本差异', '回归 Q3 修复 Q5'],
    ]),
  ],
  explanation: '候选由查询词和资料标签计算，参考编号仅用于评估。固定样本先验证检索，再检查拒答或逐条核对引文与结论。总体比例相同时，按编号比较仍能找到退步的单位核查和改善的歧义处理。',
}

export const advancedAI: AdvancedTrack = { direction: 'ai', lessons, project }
