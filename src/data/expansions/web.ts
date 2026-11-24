import type { CourseExpansions } from '../lessonExpansion'
import { foundationWebWorkshops } from '../curriculum/webWorkshops'

const authoredWebExpansions: CourseExpansions = {
  'lv-javascript-foundations': {
    variables: {
      objectives: ['跟踪赋值前后的变量值', '把数字文本转换并验证为可计算的整数', '判断一个绑定在哪些代码块中可见'],
      sections: [
        {
          heading: '赋值时先算右边',
          paragraphs: [
            '把变量名想成查找当前值的入口。执行 minutes = minutes + 5 时，右边先读取原来的 15，算出 20，再把 20 保存回 minutes。saved 在前一行已经取得数字 15，它不会因为另一个变量重新赋值而改变。这个结论适用于此处复制的数字这样的原始值。',
            '在站内运行下方独立示例。两行输出依次为 15 和 20。调试较长的程序时，可以像这样在赋值前后设置可观察的检查点，找出值第一次偏离预期的位置。',
          ],
          codeLanguage: 'JavaScript',
          code: `let minutes = 15;
const saved = minutes;
minutes = minutes + 5;
console.log(saved);    // 15
console.log(minutes);  // 20`,
        },
        {
          heading: '从输入文本得到数字',
          paragraphs: [
            '表单的输入值通常以字符串进入 JavaScript。用 + 拼接 "12" 和 3 会得到 "123"。先对文本调用 trim 去掉两端空白，再用 Number 转换，才会得到可以相加的数字 12。typeof 能读取值的类型，Number 生成的新值有自己的绑定。',
            '空字符串经过 Number 会变成 0，因此有效性判断里要单独排除空文本。Number("十二") 得到 NaN，Number.isInteger 会拒绝 NaN、无穷大和带小数的数据。下面独立示例的输入通过检验，依次输出 string 和 15。',
          ],
          codeLanguage: 'JavaScript',
          code: `const raw = " 12 ";
const text = raw.trim();
const count = Number(text);
console.log(typeof text);  // string
if (text !== "" && Number.isInteger(count)) {
  console.log(count + 3);   // 15
}`,
        },
        {
          heading: '在块中声明临时变量',
          paragraphs: [
            'if 的花括号构成一个代码块。块内声明的 const 和 let 只在该块及其内层作用域内可见。下面内层 const 建立了自己的 label，执行到块里的输出时读到「预览」，离开块后读到外层的「今日计划」。',
            '运行这个独立示例，观察两行输出的顺序。程序可以有意让两个作用域各用一个同名绑定，但更具体的名字如 previewLabel 通常更好读。如果另一个变量需要在判断结束后继续使用，可以在外层声明，再在块内赋值。',
          ],
          codeLanguage: 'JavaScript',
          code: `const label = "今日计划";
if (true) {
  const label = "预览";
  console.log(label);  // 预览
}
console.log(label);    // 今日计划`,
        },
      ],
      pitfalls: [
        { mistake: '直接用输入文本计算总时长', why: '当输入是字符串时，+ 可能把两个值接成一段文字。', fix: '先修剪空白并检查输入，再把转换后的数字交给计算代码。' },
        { mistake: '在代码块外读取块内声明的变量', why: '外层代码找不到该块内部的绑定，读取时会出现 ReferenceError。', fix: '把使用它的代码移到同一块内，或在两处共享的外层作用域声明。' },
      ],
      practice: {
        prompt: '给已有的 8 张复习卡追加输入框指定的张数。只接收大于 0 的整数文本，输入「 7 」时输出「总计 15 张」，空白或「2.5」时输出「请输入正整数」。',
        checkpoints: ['先保留已有张数，再把本次输入转成单独的数字', '用空白、2.5 和 7 检查两个分支', '用拼接生成带单位的输出，确认先完成数值加法'],
        solution: '先取得清理后的文本和转换结果，再按非空、整数、正数三个条件筛选。有效时在括号中计算 8 + 7，把结果插入显示文本。把 raw 逐次换成空白和小数，可以验证错误分支。',
        codeLanguage: 'JavaScript',
        code: `const baseCount = 8;
const raw = " 7 ";
const text = raw.trim();
const addedCount = Number(text);

if (text !== "" && Number.isInteger(addedCount) && addedCount > 0) {
  console.log("总计 " + (baseCount + addedCount) + " 张");
} else {
  console.log("请输入正整数");
}`,
      },
      questions: [
        { id: 'expanded-numeric-input', prompt: 'Number(" 12 ") + 3 的结果是什么？', choices: ['"123"', '数值 15', 'NaN', '数值 12'], answer: 1, explanation: 'Number 会把带两端空白的数字文本转成数字 12，接下来执行数值加法。' },
        { id: 'expanded-copied-value', prompt: '执行 let x = 4; const saved = x; x = 9; 之后，saved 等于什么？', choices: ['9', 'undefined', '4', '13'], answer: 2, explanation: 'saved 在声明时保存了当时的数字 4，之后的赋值只改变 x。' },
      ],
    },
    conditions: {
      objectives: ['用区间端点检查比较运算符', '用分支顺序处理相互覆盖的条件', '利用短路保护可能缺失的值'],
      sections: [
        {
          heading: '先排除无效，再划分区间',
          paragraphs: [
            '假设卡片星级只接受 0 到 100 的整数，80 分及以上给三星，50 到 79 分给二星，其余有效分数给一星。先处理无效值，再按门槛从高到低排列 else if。每次运行只进第一个成立的分支，所以进入第二个星级判断时，分数必定低于 80。',
            '运行下方独立代码，80 会输出「三星」。把 score 改为 79 会输出「二星」，改为 49 会输出「一星」，改为 101 会输出「超出范围或格式错误」。这组对照覆盖门槛两侧，能发现误用 > 或漏写上界的错误。',
          ],
          codeLanguage: 'JavaScript',
          code: `const score = 80;
if (!Number.isInteger(score) || score < 0 || score > 100) {
  console.log("超出范围或格式错误");
} else if (score >= 80) {
  console.log("三星");
} else if (score >= 50) {
  console.log("二星");
} else {
  console.log("一星");
}`,
        },
        {
          heading: '把规则拆成可以单独检查的条件',
          paragraphs: [
            '区间「从第 2 页开始，到第 6 页为止」需要同时满足 page >= 2 和 page <= 6。把两个条件用 && 连接。若标记的是区间以外，则可以用 page < 2 || page > 6。两者对整数页码而言恰好互补。',
            '创建具名的布尔变量 inRange 和 isReady 后，检查逻辑时可以先输出这两个值。下方独立示例把第 6 页作为上边界，两者都为 true。改成第 7 页时，inRange 和整体结果一起变成 false。',
          ],
          codeLanguage: 'JavaScript',
          code: `const page = 6;
const inRange = page >= 2 && page <= 6;
const isReady = true;
console.log(inRange);             // true
console.log(inRange && isReady);  // true`,
        },
        {
          heading: '通过短路判断保护下一步操作',
          paragraphs: [
            '复习关键词可能缺失，约定用 null 表示。下面先用 typeof 检查关键词是字符串，然后才调用 trim。当左侧条件为 false，&& 的右侧表达式会被跳过。由此可以把适用条件写在前面，把依赖它的检查写在后面。',
            '独立运行示例会输出 false，因为 null 未通过类型检查。换成 "  " 后，类型检查通过，trim 得到空字符串，所以仍输出 false。换成 "  数组  " 才输出 true。三个例子依次覆盖缺失、空白和有内容。',
          ],
          codeLanguage: 'JavaScript',
          code: `const keyword = null;
const canSearch = typeof keyword === "string" && keyword.trim() !== "";
console.log(canSearch);  // false`,
        },
      ],
      pitfalls: [
        { mistake: '把低门槛排在高门槛之前', why: '85 同时满足 >= 50 和 >= 80，先匹配 >= 50 会让高门槛分支失去机会。', fix: '在互斥的星级判断中先检查 80，再检查 50。' },
        { mistake: '把「同时满足上下限」写成 ||', why: '第 7 页虽然高于上界，却满足 page >= 2，使用 || 会错误通过。', fix: '包含区间的两项比较用 &&，并逐一测试临近的区间内外点。' },
        { mistake: '用 if (keyword) 代表关键词有内容', why: '只包含空格的字符串仍会当作真值。', fix: '检查类型后调用 trim，再明确判断结果是否为空。' },
      ],
      practice: {
        prompt: '为每天的复习分钟数生成建议。仅接受 0 到 180 的整数。小于 20 提示「安排一轮复习」，20 到 59 提示「保持节奏」，60 到 180 提示「安排休息」。无效输入提示「检查分钟数」。',
        checkpoints: ['-1、181 和字符串 "20" 都进入无效分支', '19 和 20 的反馈不同', '59 和 60 的反馈不同，180 仍属于有效输入'],
        solution: '先检查整数和两个无效边界，排除后再逐级比较 60 和 20。60 在第一个有效分支即输出「安排休息」，59 继续检查并输出「保持节奏」。无效输入在最前面处理，后面的分支只需要给有效数字分级。',
        codeLanguage: 'JavaScript',
        code: `const minutes = 60;
if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) {
  console.log("检查分钟数");
} else if (minutes >= 60) {
  console.log("安排休息");
} else if (minutes >= 20) {
  console.log("保持节奏");
} else {
  console.log("安排一轮复习");
}`,
      },
      questions: [
        { id: 'expanded-branch-order', prompt: '先检查 points >= 20，再用 else if 检查 points >= 40。points 为 50 时会执行哪个分支？', choices: ['第一个分支', '第二个分支', '两个都执行', '两个都跳过'], answer: 0, explanation: '50 满足第一个条件，执行其分支后跳过后续的 else if。' },
        { id: 'expanded-short-circuit', prompt: 'keyword 为 null 时，typeof keyword === "string" && keyword.trim() !== "" 会怎样？', choices: ['返回 true', '读到空字符串', '调用 trim 并报错', '返回 false，跳过 trim'], answer: 3, explanation: '&& 的左侧为 false 时结果已经确定，右侧表达式不会执行。' },
      ],
    },
    arrays: {
      objectives: ['同时读取元素及其位置', '用累加器追踪统计过程', '区分筛选元素和转换元素'],
      sections: [
        {
          heading: '同时取得索引和值',
          paragraphs: [
            '网页上展示的顺序编号通常从 1 开始，而 JavaScript 数组从 0 开始。用数组的 entries() 得到一组按顺序产生的「索引、值」配对，再用 [index, title] 把这两个位置的值取出来。用户看到的编号是 index + 1。',
            '运行这个独立示例会输出「1. 导入资料」和「2. 提取笔记」。把 chapters 改成空数组会得到零行输出，因为没有配对可遍历。只需要标题时可以直接使用 for (const title of chapters)。',
          ],
          codeLanguage: 'JavaScript',
          code: `const chapters = ["导入资料", "提取笔记"];
for (const [index, title] of chapters.entries()) {
  console.log((index + 1) + ". " + title);
}`,
        },
        {
          heading: '跟踪累加器随遍历变化',
          paragraphs: [
            '总时长在读第一条记录前等于 0。循环内每次只处理当前值，把当前值加到已经得到的部分总和。对 [12, 18, 7]，三个加法依次给出 12、30、37。可以在纸上为每一轮画三列，记录本轮数值、相加前的 total、相加后的 total。',
            '下面的独立示例同时求平均数。仅在数组有元素时做除法，并用 toFixed(1) 把结果显示为一位小数，因此控制台显示「平均 12.3 分钟」。约定空数组输出「暂无记录」。总和与平均值的显示是两个不同的步骤。',
          ],
          codeLanguage: 'JavaScript',
          code: `const minutes = [12, 18, 7];
let total = 0;
for (const value of minutes) {
  total += value;
}
if (minutes.length === 0) {
  console.log("暂无记录");
} else {
  console.log("平均 " + (total / minutes.length).toFixed(1) + " 分钟");
}`,
        },
        {
          heading: '先筛选，再为显示转换',
          paragraphs: [
            'filter 逐项调用一个判断函数，保留判断为真的元素。map 逐项调用一个转换函数，为每个元素生成一个对应的新结果。这两个方法在下面的写法中返回新数组，原数组中的数字保持原值。先做筛选可以让后续转换只处理要显示的数据。',
            '独立运行示例，首先从 [8, 20, 12] 保留 20 和 12，再给两项各自加上单位。最后 join 把这些文本按顺序接成「20 分钟 / 12 分钟」。输入改为 [8] 时，筛选结果是空数组，join 给出空字符串，页面通常需要单独为此提供提示。',
          ],
          codeLanguage: 'JavaScript',
          code: `const minutes = [8, 20, 12];
const selected = minutes.filter(value => value >= 10);
const labels = selected.map(value => value + " 分钟");
console.log(labels.join(" / "));  // 20 分钟 / 12 分钟`,
        },
      ],
      pitfalls: [
        { mistake: '每轮都重新声明 total = 0', why: '前几轮的加和会随着局部变量消失，下一轮又从 0 开始。', fix: '在循环前初始化一次，并在循环体内对同一个绑定累加。' },
        { mistake: '用 map 来丢弃短记录', why: 'map 的结果会保留原有项数，即使某项返回 undefined。', fix: '先用 filter 丢弃不符合条件的元素，再用 map 生成标签。' },
      ],
      practice: {
        prompt: '用 [9, 24, 15, 6] 生成达标复习记录。筛出至少 15 分钟的记录，继续按原顺序编号，计算这些记录的总时长。',
        checkpoints: ['有效记录为 24 和 15，等于 15 的项也被保留', '两行记录为「1. 24 分钟」与「2. 15 分钟」', '接着输出「达标时长 39 分钟」。没有达标记录时只输出「暂无达标记录」'],
        solution: '先获得达标数组，再用 entries 同时取得该数组的新索引和数值。每处理一项就累加并生成一行，全部处理完再输出总和。没有匹配项时直接走空列表分支。',
        codeLanguage: 'JavaScript',
        code: `const minutes = [9, 24, 15, 6];
const selected = minutes.filter(value => value >= 15);
let total = 0;
if (selected.length === 0) {
  console.log("暂无达标记录");
} else {
  for (const [index, value] of selected.entries()) {
    total += value;
    console.log((index + 1) + ". " + value + " 分钟");
  }
  console.log("达标时长 " + total + " 分钟");
}`,
      },
      questions: [
        { id: 'expanded-filter-map', prompt: '执行 [8, 15, 10].filter(n => n >= 10).map(n => n * 2) 会得到什么？', choices: ['[16, 30, 20]', '[15, 10]', '[30, 20]', '[20, 30]'], answer: 2, explanation: 'filter 留下原顺序中的 15 和 10，map 将两项依次乘以 2。' },
        { id: 'expanded-pair', prompt: '遍历 ["甲", "乙"].entries() 时，第二次取出的索引和值是什么？', choices: ['2 和 "乙"', '1 和 "乙"', '1 和 "甲"', '0 和 "乙"'], answer: 1, explanation: '索引从 0 开始，因此第二个值「乙」对应索引 1。' },
      ],
    },
    functions: {
      objectives: ['为函数写出清楚的输入和输出约定', '用提前返回区分有效计算与错误', '将计算结果交给另一个函数展示'],
      sections: [
        {
          heading: '参数按位置传入',
          paragraphs: [
            '定义函数时给每个参数安排一个明确的角色。例如剩余页数等于总页数减已读页数，调用 remainingPages(18, 7) 时，18 传给 total、7 传给 read。两个位置调换后，计算式变成 7 - 18，所以得到 -11。为调用点的两个值命名，有助于核对位置。',
            '这里还给 read 设定默认值 0。下面是可独立运行的代码，输出 11 和 18。第二次调用省略 read 才采用默认的 0。显式传入 null 不会选用默认参数，因此下一节需要声明哪些值才符合约定。',
          ],
          codeLanguage: 'JavaScript',
          code: `function remainingPages(total, read = 0) {
  return total - read;
}
console.log(remainingPages(18, 7));  // 11
console.log(remainingPages(18));     // 18`,
        },
        {
          heading: '明确哪些结果代表成功',
          paragraphs: [
            '如果读了 12 页，总数也正好是 12，剩余 0 是合法结果。若填写的已读数超过总数，可以在结果中单独标记失败。下面的函数约定总页数和已读数都为整数，范围满足 0 ≤ read ≤ total，再用 ok 字段标识结果是否有效。',
            '独立运行示例，(12, 12) 经校验通过，生成 { ok: true, pages: 0 }。(12, 13) 被第一个 return 提前结束，生成 { ok: false, message: "页数超出范围" }。读取者根据 ok 字段选择下一步，页面也能显示具体原因。',
          ],
          codeLanguage: 'JavaScript',
          code: `function calculateRemaining(total, read) {
  if (!Number.isInteger(total) || !Number.isInteger(read) || read < 0 || read > total) {
    return { ok: false, message: "页数超出范围" };
  }
  return { ok: true, pages: total - read };
}
console.log(calculateRemaining(12, 12));
console.log(calculateRemaining(12, 13));`,
        },
        {
          heading: '让调用者决定怎样使用结果',
          paragraphs: [
            '计算函数可以用同一份输入得到同一份输出，也可以在其他程序中复用。把显示工作交给调用者，才能让一个页面用结果更新文案，另一个页面用同一结果判断是否完成。函数中的 console.log 只负责输出，所以要用 return 把值送回去。',
            '运行这段独立示例，程序先计算每套四题、做完三套的题目数 12。之后 labelFor 使用结果返回显示文案，最外层 console.log 输出「已做 12 题」。浏览器事件处理函数也可以担任调用者，读取控件输入，再用结果更新页面文字。',
          ],
          codeLanguage: 'JavaScript',
          code: `function solvedQuestions(sets, perSet) {
  return sets * perSet;
}
function labelFor(count) {
  return "已做 " + count + " 题";
}
const solved = solvedQuestions(3, 4);
console.log(labelFor(solved));  // 已做 12 题`,
        },
      ],
      pitfalls: [
        { mistake: '只在函数内部打印计算出的值', why: '调用者接到的是 undefined，后续无法用该值进行计算。', fix: '用 return 返回值，再由调用者打印或更新页面。' },
        { mistake: '依靠 if (result.pages) 判断计算是否成功', why: '已经全部读完时剩余 0 页，0 在条件中也会被当成假值。', fix: '约定一个单独的成功标记来区分有效结果和错误。' },
      ],
      practice: {
        prompt: '写一个 roundsNeeded 函数。输入待复习题数 questions 和每轮题数 perRound，输出至少需要几轮。题数可以为 0，每轮题数必须为正整数。用独立函数把计算结果转成提示。',
        checkpoints: ['(13, 5) 需要 3 轮，(10, 5) 需要 2 轮', '(0, 5) 成功返回 0 轮，(13, 0) 返回明确错误', '计算函数只返回结果，显示函数才生成文字'],
        solution: '校验两项的类型和范围，先拦截零除数。有效时用 Math.ceil 将题数与每轮题数的商向上取整，因此 13 / 5 的最后三题也有一轮。显示函数通过 ok 判断应该输出轮数还是错误提示。',
        codeLanguage: 'JavaScript',
        code: `function roundsNeeded(questions, perRound) {
  if (!Number.isInteger(questions) || !Number.isInteger(perRound) || questions < 0 || perRound <= 0) {
    return { ok: false, message: "检查题数和每轮安排" };
  }
  return { ok: true, rounds: Math.ceil(questions / perRound) };
}

function roundLabel(result) {
  if (!result.ok) return result.message;
  return "需要 " + result.rounds + " 轮";
}

console.log(roundLabel(roundsNeeded(13, 5)));  // 需要 3 轮
console.log(roundLabel(roundsNeeded(0, 5)));   // 需要 0 轮
console.log(roundLabel(roundsNeeded(13, 0)));  // 检查题数和每轮安排`,
      },
      questions: [
        { id: 'expanded-default-value', prompt: '按示例的定义，remainingPages(18) 的结果是什么？', choices: ['undefined', '0', '18', 'NaN'], answer: 2, explanation: 'read 被省略时使用默认值 0，因而得到 18 − 0。' },
        { id: 'expanded-return-result', prompt: '函数 f 只执行 console.log(5)，随后到达末尾。const count = f() 中 count 是什么？', choices: ['5', 'undefined', '字符串 "5"', 'null'], answer: 1, explanation: '控制台可以看到 5。函数运行到末尾且没有显式返回值，给调用处的值是 undefined。' },
      ],
    },
  },
  'lv-web-foundations': {
    'html-structure': {
      objectives: ['按内容关系安排标题和区块', '选择表达步骤或并列项目的列表', '区分文档元数据和页面正文'],
      sections: [
        {
          heading: '先画出文档大纲',
          paragraphs: [
            '编写一份读书会说明时，可以先列出标题大纲。页面主题「读书会安排」用 h1，同级的「本周议程」和「参考资料」用 h2。若议程中有自己的小主题「交流环节」，就把它写成该区块中的 h3。有人通过标题导航时，大纲能帮助他们快速定位。',
            '把下面的正文片段放进一个 HTML 文件的 body。页面会先出现总标题，然后按顺序显示两个章节。在浏览器的元素检查器中展开 main，可以看到它包含两个 section，h3 位于第一个 section 内。每个 section 围绕一个主题组织内容。',
          ],
          codeLanguage: 'HTML · body 内片段',
          code: `<main>
  <h1>读书会安排</h1>
  <section>
    <h2>本周议程</h2>
    <h3>交流环节</h3>
    <p>每人分享一条阅读笔记。</p>
  </section>
  <section>
    <h2>参考资料</h2>
    <p>可带电子书或纸质书。</p>
  </section>
</main>`,
        },
        {
          heading: '为步骤和并列项目选择列表',
          paragraphs: [
            '会前准备有先后关系，例如先阅读再记录疑问，适合用有序列表 ol。携带便签或笔记本等并列项目适合用无序列表 ul。每一项都用独立的 li，浏览器便能提供默认编号或项目符号，也能识别列表包含几个项目。',
            '把下面的片段放在第一个 section 里。默认样式会在「阅读活动材料」前显示 1，在「记录一条疑问」前显示 2。交换两个 li，编号会随列表位置重新排列。列表变长时也可以直接在相应位置添加一个 li。',
          ],
          codeLanguage: 'HTML · section 内片段',
          code: `<ol>
  <li>阅读活动材料</li>
  <li>记录一条疑问</li>
</ol>`,
        },
        {
          heading: '把标签页标题和页面标题分别写清',
          paragraphs: [
            'head 中的 title 主要出现在浏览器标签页等位置。body 里的 h1 出现在正文中。为每个 HTML 文件选择能说明主题的 title，用户打开多个标签页时就能分辨它们。html 上的 lang 用来声明默认语言，辅助技术可据此选择朗读语言。',
            '下方是完整文件。用 UTF-8 保存后打开，标签页文字为「活动中心 · 读书会」，页面主要标题为「读书会安排」。用字符集声明告诉浏览器如何解释文件字节，并让文件实际采用同一编码。若两者不一致，汉字可能显示成乱码。',
          ],
          codeLanguage: 'HTML · 完整页面',
          code: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>活动中心 · 读书会</title>
  </head>
  <body>
    <main><h1>读书会安排</h1></main>
  </body>
</html>`,
        },
      ],
      pitfalls: [
        { mistake: '因为默认字号较小，把顶层小节标题写成 h4', why: '标题数字进入了过深的层级，按标题浏览时难以理解它属于哪个上级小节。', fix: '用 h2 表达直属于 h1 的小节，用 CSS 调整字号。' },
        { mistake: '用多个换行和手打数字模拟步骤', why: '插入步骤后要自己更新编号，页面结构也缺少列表语义。', fix: '用 ol 包裹各个 li，让浏览器计算顺序。' },
        { mistake: '在 head 中写希望用户在正文看到的说明', why: 'head 主要保存文档的元数据，浏览器对其中的普通正文标记可能自动修复结构。', fix: '把说明写进 body 里的段落，把标签页标题放在 head 的 title 中。' },
      ],
      practice: {
        prompt: '写一个「线下复习角」活动页，标签页显示「活动中心 · 线下复习角」。正文有一个主要标题和两节内容，第一节列出「签到、领取资料」，第二节列出可带的「便签、铅笔」。',
        checkpoints: ['标签页和正文分别显示指定标题', '两个小节都使用 h2，分别叫「参加步骤」和「建议携带」', '第一节默认显示编号 1、2，第二节默认显示项目符号'],
        solution: '在 head 放编码声明和页面标题。在 main 中把两节排在同级，两个列表分别用 ol 和 ul，列表项统一用 li。把下方保存为 UTF-8 的 .html 文件即可打开核对结果。',
        codeLanguage: 'HTML · 完整页面',
        code: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>活动中心 · 线下复习角</title>
  </head>
  <body>
    <main>
      <h1>线下复习角</h1>
      <section>
        <h2>参加步骤</h2>
        <ol><li>签到</li><li>领取资料</li></ol>
      </section>
      <section>
        <h2>建议携带</h2>
        <ul><li>便签</li><li>铅笔</li></ul>
      </section>
    </main>
  </body>
</html>`,
      },
      questions: [
        { id: 'expanded-headings', prompt: '页面 h1 下有两个并列小节，两个小节通常应该用哪组标题元素？', choices: ['h1 与 h3', '两个 h2', 'h2 与 h3', '两个 title'], answer: 1, explanation: '两个小节属于同一层级，并且直接处于 h1 之下，因此各用一个 h2。' },
        { id: 'expanded-ordered-list', prompt: '为「签到、领取资料、讨论」这三个有先后关系的步骤选什么结构？', choices: ['ul 包围三个 p', 'h1 包围三个 span', '用 ol 包围三个 li', '用三个 title'], answer: 2, explanation: 'ol 表示按顺序排列的列表，三个 li 分别承载三个步骤。' },
      ],
    },
    'css-style': {
      objectives: ['根据选择器优先级找出生效的声明', '根据盒模型计算元素可见宽度', '利用 Flexbox 为窄屏保留换行空间'],
      sections: [
        {
          heading: '遇到冲突时检查生效规则',
          paragraphs: [
            '活动卡片的说明段同时匹配 p 和 .hint。这里两条规则写在同一个样式表里，都是普通声明。类选择器的优先级高于元素选择器，因此文字用蓝色。这两条规则优先级若相同，后出现的声明才会覆盖先出现的声明。',
            '把下方完整示例保存为 HTML 文件并打开。在开发者工具的元素样式面板选择段落，可以看到 p 的 color 被划掉。p 规则已经在 .hint 后面，段落依然是蓝色。去掉段落的类名，段落只匹配 p，此时变为灰色。',
          ],
          codeLanguage: 'HTML · 完整页面',
          code: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>领取资料</title>
    <style>
      .hint { color: #174a9e; }
      p { color: #545b65; }
    </style>
  </head>
  <body><p class="hint">资料在签到处领取。</p></body>
</html>`,
        },
        {
          heading: '用宽度、内边距和边框算一遍',
          paragraphs: [
            '默认的 content-box 将 width 用于内容区。width 为 200px、左右各 12px 内边距、左右各 2px 边框，边框外沿间的总宽度是 200 + 24 + 4 = 228px。margin 位于边框外，额外占用布局空间。',
            '下面的样式片段应用到一个 div.card 时，总宽度还是 200px，因为 border-box 把内边距和边框算进 width。内容区还剩 172px。可用浏览器开发者工具的盒模型图核对这个减法，再临时禁用 box-sizing 观察总宽度的变化。',
          ],
          codeLanguage: 'CSS · 样式片段',
          code: `.card {
  box-sizing: border-box;
  width: 200px;
  padding: 12px;
  border: 2px solid #8b949e;
}`,
        },
        {
          heading: '让卡片在空间不足时换行',
          paragraphs: [
            '在父元素上设置 display: flex 后，它的直接子元素成为弹性项目。flex-wrap: wrap 允许项目换行，gap 规定项目之间的间距。下面给卡片设置起始宽度 160px，空间充足时均分多余宽度，空间有限时允许缩小。',
            '打开下方的完整 HTML 示例，缩小窗口或在开发者工具中收窄预览。容器的内容宽度不小于 332px 时能放下 160 + 12 + 160，卡片就在同一行。容器内容宽度为 300px 时，两张卡片换到两行。缩放时关注的是容器可用宽度，浏览器默认的 body 外边距也会占空间。',
          ],
          codeLanguage: 'HTML · 完整页面',
          code: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>复习卡片</title>
    <style>
      .cards { display: flex; flex-wrap: wrap; gap: 12px; }
      .cards > div { flex: 1 1 160px; background: #e9f1ff; }
    </style>
  </head>
  <body>
    <div class="cards"><div>读一页文档</div><div>写一道练习</div></div>
  </body>
</html>`,
        },
      ],
      pitfalls: [
        { mistake: '只挪动规则位置，期望弱选择器覆盖强选择器', why: '对于示例中的常规声明，优先级高的选择器先胜出。', fix: '用开发者工具查看匹配规则，再调整类名、选择器或原规则。' },
        { mistake: '卡片并排超宽时只缩小文字', why: '固定宽度、内边距和边框仍会占用容器空间。', fix: '检查盒模型，明确宽度计算方式，再让父容器允许卡片换行。' },
      ],
      practice: {
        prompt: '设计两张「阅读」「练习」卡片。卡片有 10px 内边距和 1px 边框，起始宽度 140px，左右卡片间有 12px 间隔。在 340px 的卡片容器内并排，在 270px 容器内换行。',
        checkpoints: ['容器用 flex-wrap 允许项目换行', '140px 包含内边距和边框', '容器内容宽度改为 270px 时第二张卡片落到下一行'],
        solution: '把容器设成弹性布局，把灵活分配的起始尺寸设为 140px。border-box 让这个尺寸含有内边距和边框，两卡并排至少需要 140 + 12 + 140 = 292px。下面的文件用 max-width 为窄窗口保留响应能力，把 width 改为 270px 可以直接检查换行。',
        codeLanguage: 'HTML · 完整页面',
        code: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>学习任务</title>
    <style>
      .tasks { display: flex; flex-wrap: wrap; gap: 12px; width: 340px; max-width: 100%; }
      .task { box-sizing: border-box; flex: 1 1 140px; padding: 10px; border: 1px solid #8b949e; }
    </style>
  </head>
  <body>
    <div class="tasks"><div class="task">阅读</div><div class="task">练习</div></div>
  </body>
</html>`,
      },
      questions: [
        { id: 'expanded-box-width', prompt: '使用 border-box，width 为 160px，左右内边距各 10px，左右边框各 2px，内容宽度是多少？', choices: ['160px', '184px', '136px', '140px'], answer: 2, explanation: '160px 已经包含两侧内边距和边框，减去 20px 和 4px 得到 136px。' },
        { id: 'expanded-specificity', prompt: '段落同时匹配 .notice 和 p，两个规则位于同一个样式表，用普通声明设置不同的 color。哪个选择器的优先级更高？', choices: ['出现在前面的选择器', 'p', '两者相同', '.notice'], answer: 3, explanation: '类选择器的优先级高于元素选择器。' },
      ],
    },
    'links-and-forms': {
      objectives: ['用文档片段链接定位页面区域', '说明 id、name 和 value 在表单中的分工', '预测浏览器会拦截哪些无效提交'],
      sections: [
        {
          heading: '使用片段地址链接到同页标题',
          paragraphs: [
            '在长页面开头放一个「查看提交说明」链接，让使用者直接跳到后面的主题。href="#submit-guide" 指向当前文档中 id 为 submit-guide 的元素，地址末尾会带上这段片段标识。每个 id 应在文档中保持唯一，供链接、标签和脚本准确定位。',
            '把下方片段放进 HTML 的 body，可在段落之间补几行文字让页面具有可滚动空间。用 Tab 将焦点移动到链接，再按 Enter，浏览器会导航到目标位置。修改链接中的最后一个字母即可观察目标匹配失败时的差异。',
          ],
          codeLanguage: 'HTML · body 内片段',
          code: `<a href="#submit-guide">查看提交说明</a>
<h2 id="submit-guide">提交说明</h2>
<p>填写复习主题后再提交。</p>`,
        },
        {
          heading: '找出进入表单数据的字段名和值',
          paragraphs: [
            '同一个文本框可以有 id="topic-entry" 和 name="topic"。前者用于与 label 建立联系，后者是数据以键值对提交时使用的键。文本框里的实际文字是值。默认 GET 表单把参加提交的字段编码到目标地址的查询部分。',
            '把下面片段放进 HTML 的 body，填写 arrays 并提交。默认提交到当前页面，地址末尾出现 ?topic=arrays。这里没有服务器逻辑，因此只观察提交的地址。删除 name 后再试，地址里将没有 topic，因为控件缺少提交用的字段名。',
          ],
          codeLanguage: 'HTML · body 内片段',
          code: `<form method="get">
  <label for="topic-entry">复习主题</label>
  <input id="topic-entry" name="topic" required>
  <button type="submit">查看筛选</button>
</form>`,
        },
        {
          heading: '让浏览器检查必填字段和数字范围',
          paragraphs: [
            '分钟数字段用 type="number"，再用 min、max、step 表达闭区间和整数间隔。required 表示用户提交时必须提供值。浏览器会在常规提交前检查这些约束，并把焦点移到阻止提交的控件上，提示填写或调整。',
            '对下面的片段分别尝试空白、0、15.5 和 15。前三次会被浏览器拦住，最后一次允许提交，地址中出现 ?minutes=15。这里的约束帮助当前用户纠正输入。服务端接到数据后仍需要按自己的约定校验。',
          ],
          codeLanguage: 'HTML · body 内片段',
          code: `<form method="get">
  <label for="minutes-entry">预计分钟数</label>
  <input id="minutes-entry" name="minutes" type="number" min="1" max="180" step="1" required>
  <button type="submit">提交</button>
</form>`,
        },
      ],
      pitfalls: [
        { mistake: '给输入框写了 id，却忘了 name', why: '标签仍能聚焦输入框，但提交数据中没有代表该输入的键。', fix: '按接口约定填写 name，并查看提交地址或表单数据。' },
        { mistake: '在表单中给普通操作按钮省略 type', why: '普通表单内的按钮默认会提交表单。', fix: '提交按钮用 type="submit"，独立的界面操作按钮用 type="button"。' },
        { mistake: '只用 placeholder 说明字段用途', why: '提示文字会在输入后消失，用户可能无法确认当前在填什么。', fix: '使用与输入控件配对的可见 label，必要时额外提供格式提示。' },
      ],
      practice: {
        prompt: '写一份「查看复习计划」表单，使用 GET 把主题和分钟数变成查询参数。主题为必填文本，分钟数为 1 到 90 的必填整数。表单上方有一个指向填写规则的跳转链接。',
        checkpoints: ['单击「分钟数」标签时，焦点进入数字框', '以 arrays 和 25 提交，地址出现 ?topic=arrays&minutes=25', '分钟数为 91 或留空时拦截提交，链接可以在同页定位规则'],
        solution: '用两个 id 关联可见标签，分别以 topic 和 minutes 为提交键。表单校验由 required 和数字约束表达。规则标题用唯一 id，链接的 href 用相同标识加 #。把片段放进正文，可离线检查这些行为。',
        codeLanguage: 'HTML · body 内片段',
        code: `<a href="#review-rules">查看填写规则</a>
<form method="get">
  <p><label for="topic-id">主题</label> <input id="topic-id" name="topic" required></p>
  <p><label for="minutes-id">分钟数</label>
    <input id="minutes-id" name="minutes" type="number" min="1" max="90" step="1" required></p>
  <button type="submit">查看复习计划</button>
</form>
<h2 id="review-rules">填写规则</h2>
<p>请填写主题和 1 到 90 之间的整数分钟。</p>`,
      },
      questions: [
        { id: 'expanded-form-key', prompt: '输入框 id="study-name"、name="topic"，用户输入 html。GET 提交时这个字段用哪个键值对？', choices: ['study-name=html', 'html=topic', 'topic=html', 'study-name=topic'], answer: 2, explanation: 'name 指定提交键，输入内容是值，id 仍用于把控件与标签或脚本关联。' },
        { id: 'expanded-number-step', prompt: '数字框设为 required、min="1"、max="90"、step="1"。下面哪一项能通过浏览器检验？', choices: ['空白', '0', '1.5', '90'], answer: 3, explanation: '90 在允许的闭区间内且满足整数间隔。空白缺少必填值，0 超出下限，1.5 不满足步长。' },
      ],
    },
    'browser-interaction': {
      objectives: ['判断选择器在哪个时机能找到元素', '把事件、状态和页面更新分开', '用键盘和鼠标验证同一项交互'],
      sections: [
        {
          heading: '确认元素已经存在并且选择器匹配',
          paragraphs: [
            'HTML 文档自上而下解析。普通内联脚本执行到某一行时，后续的元素可能尚未被解析。把脚本放到目标元素之后，可以在这里直接选择它。querySelector 返回第一个匹配元素，如果当前文档没有匹配项，它返回 null。',
            '把下方片段单独放在 body 内，打开控制台会看到 true 和 null。把脚本移到段落前，第一行会变为 false。脚本位置正确时仍没找到元素，可以检查井号是否遗漏、id 拼写是否准确，以及元素实际在哪个文档中。',
          ],
          codeLanguage: 'HTML · body 内片段',
          code: `<p id="tip">先选择一项练习。</p>
<script>
  console.log(document.querySelector("#tip") !== null);  // true
  console.log(document.querySelector("#unknown"));       // null
</script>`,
        },
        {
          heading: '保存状态，再由状态生成显示',
          paragraphs: [
            '计数器的状态是已经完成的题数。把它保存在数值变量 completed 中，点击按钮时只修改这份值，render 再根据新值更新提示。这样无需把「已完成 2 题」重新拆成数字，换一种显示语言也不影响计数。',
            '下面的片段首次显示「已完成 0 题」，两次点击后显示「已完成 2 题」。函数传给 addEventListener 时使用回调，浏览器会在相应事件发生时调用它。button 自带键盘激活方式，用 Tab 聚焦后按 Enter 也应增加计数。重新加载页面恢复为 0。',
          ],
          codeLanguage: 'HTML · body 内片段',
          code: `<button id="add" type="button">完成一题</button>
<p id="count" role="status"></p>
<script>
  const add = document.querySelector("#add");
  const count = document.querySelector("#count");
  let completed = 0;
  function render() {
    count.textContent = "已完成 " + completed + " 题";
  }
  add.addEventListener("click", () => {
    completed += 1;
    render();
  });
  render();
</script>`,
        },
        {
          heading: '从事件对象读取当前控件的值',
          paragraphs: [
            'change 事件适合在复选框的选中状态变化时更新页面。监听函数有一个参数 event，其中 currentTarget 指此刻接收这个监听器的控件。复选框的 checked 属性为布尔值，因此可以根据它选择界面反馈。',
            '下方片段打开后，勾选复选框应显示「已确认」，取消勾选显示「待确认」。点击关联标签或用键盘的空格键切换，结果也应一致。把提示更新放在监听器里，用户的每次有效变化都会触发一次重新显示。',
          ],
          codeLanguage: 'HTML · body 内片段',
          code: `<label><input id="confirm" type="checkbox"> 已阅读规则</label>
<p id="feedback" role="status">待确认</p>
<script>
  const confirmBox = document.querySelector("#confirm");
  const feedback = document.querySelector("#feedback");
  confirmBox.addEventListener("change", event => {
    feedback.textContent = event.currentTarget.checked ? "已确认" : "待确认";
  });
</script>`,
        },
      ],
      pitfalls: [
        { mistake: '把 render() 当作事件监听器传入', why: '括号会立即调用 render，浏览器得到的是它的返回值。', fix: '直接传入 render，或用回调在事件发生后处理状态并调用 render。' },
        { mistake: '读取复选框的 value 判断是否勾选', why: 'value 代表控件提交值，例如默认值 "on"，勾选状态存放在 checked 中。', fix: '在 change 监听器里用 checked 更新状态。' },
      ],
      practice: {
        prompt: '制作一个只需本地打开的复习进度条目。点击「完成一题」增加 1，最多计 3 题。达到上限后按钮禁用。点击「重置」把进度恢复为 0。',
        checkpoints: ['初始显示「已完成 0 / 3 题」', '连按三次显示「已完成 3 / 3 题」，完成按钮禁用', '重置后回到 0，完成按钮重新可用，Tab 和 Enter 可操作按钮'],
        solution: '两个操作共用一个 render 函数。完成操作修改已完成题数，重置操作恢复初始值。render 根据计数同时更新文字和按钮的 disabled 属性，避免重置时漏掉恢复按钮。插入正文后可以用鼠标和键盘分别操作。',
        codeLanguage: 'HTML · body 内片段',
        code: `<button id="finish" type="button">完成一题</button>
<button id="reset" type="button">重置</button>
<p id="progress" role="status"></p>
<script>
  const finish = document.querySelector("#finish");
  const reset = document.querySelector("#reset");
  const progress = document.querySelector("#progress");
  const total = 3;
  let completed = 0;

  function render() {
    progress.textContent = "已完成 " + completed + " / " + total + " 题";
    finish.disabled = completed >= total;
  }

  finish.addEventListener("click", () => {
    if (completed < total) completed += 1;
    render();
  });
  reset.addEventListener("click", () => {
    completed = 0;
    render();
  });
  render();
</script>`,
      },
      questions: [
        { id: 'expanded-callback-timing', prompt: '注册监听器时，button.addEventListener("click", render) 的 render 会在何时调用？', choices: ['读取 HTML 文件名时', '注册的当下立刻调用', '按钮收到点击事件时', '声明 render 时'], answer: 2, explanation: '这里传递的是函数本身，浏览器在对应事件发生后调用它。' },
        { id: 'expanded-disabled-reset', prompt: '计数达到 3 后按钮已禁用，重置把计数设为 0 后还需要什么？', choices: ['重新加载页面', '调用 render，用计数重算 disabled', '创建另一个计数变量', '把 disabled 属性设为 true'], answer: 1, explanation: 'render 依据 completed >= total 得到 false，从而重新启用按钮并更新提示。' },
      ],
    },
  },
  'lv-backend-foundations': {
    http: {
      objectives: ['分开读取路径、查询参数和请求头', '区分列表为空和指定资源缺失', '根据响应状态选择适当的客户端处理'],
      sections: [
        {
          heading: '把请求目标拆成路径和查询参数',
          paragraphs: [
            '假设课程目录接受 GET /api/courses?topic=web&limit=2。/api/courses 表示课程集合，问号后面的 topic 和 limit 分别表达筛选条件与数量限制。参数名及其含义由接口约定。服务器读到的查询参数通常是文本，需要先验证再当作数字使用。',
            '下面是可在浏览器控制台或 Node.js 中独立运行的 URL 解析示例，不会发出请求。三行依次得到 /api/courses、web 和 true。最后一行验证查询参数 limit 的原始值为字符串 "2"。若没有提供 topic，searchParams.get("topic") 会返回 null。',
          ],
          codeLanguage: 'JavaScript',
          code: `const url = new URL("https://learnverse.example/api/courses?topic=web&limit=2");
console.log(url.pathname);                          // /api/courses
console.log(url.searchParams.get("topic"));           // web
console.log(url.searchParams.get("limit") === "2");  // true`,
        },
        {
          heading: '从请求头和响应头读取格式',
          paragraphs: [
            '客户端用 Accept 表达希望得到的响应格式，例如 application/json。服务器用响应头 Content-Type 说明实际返回的正文格式。对应的请求也可以有 Content-Type，例如提交 JSON 时用它说明发送内容的格式。头部和正文之间用空行分隔。',
            '下面是简化的响应报文。先从状态行读到 200，再从响应头读到正文格式，最后把空行之后的文字解析成 JSON。这个响应的 items 是空数组，表示集合查询成功且没有满足筛选条件的课程。若请求的是一个不存在的具体编号，接口可以返回 404。',
          ],
          codeLanguage: 'HTTP · 响应示意',
          code: `HTTP/1.1 200 OK
Content-Type: application/json

{"items":[]}`,
        },
        {
          heading: '先看一次等待 JSON 正文的最小程序',
          paragraphs: [
            'Response 把响应的状态、头部、正文收在同一个对象里。直接读取 response.status 可以得到数字。response.json() 则会先读取正文，再将 JSON 文本转换成对象，因此先交回一个 Promise。它代表将来会拿到值，也可能因为正文格式错误而失败。',
            '在函数前写 async，函数里就可以用 await 等待 Promise 完成后继续使用结果。等待期间，浏览器仍能处理其他事情。下面在内存中构造一条 200 响应，无需访问网络。第一行打印状态，第二行打印已经转换好的课程标题。把 JSON 里的标题换成别的词，观察第二行如何变化。',
          ],
          codeLanguage: 'JavaScript · 独立运行',
          run: { language: 'javascript', expectedOutput: '200\n网页基础' },
          code: `async function showResponse() {
  const response = new Response('{"title":"网页基础"}', { status: 200 });
  console.log(response.status);
  const course = await response.json();
  console.log(course.title);
}
showResponse();`,
        },
        {
          heading: '读状态再决定如何消费正文',
          paragraphs: [
            '客户端需要处理三类情况。HTTP 成功响应可以按接口约定解析内容。404 等 HTTP 错误说明已经收到服务器响应，可以依据故障类型给出反馈。连接断开等网络问题则可能根本没有响应可读。读取一个 JSON 接口时，可先检查状态，再解析成功或错误正文。',
            '下方使用浏览器内置的 Response 在内存模拟 404，不发送网络请求。response.ok 只在状态码为 200 到 299 时为真。这里会输出「课程不存在」。把模拟响应替换成 200 并提供含 title 的 JSON，即可进入正文解析分支。',
          ],
          codeLanguage: 'JavaScript · 浏览器或 Node.js',
          run: { language: 'javascript', expectedOutput: '课程不存在' },
          code: `async function displayCourse(response) {
  if (response.status === 404) return "课程不存在";
  if (!response.ok) return "暂时无法读取课程";
  const course = await response.json();
  return course.title;
}

const response = new Response('{"message":"课程不存在"}', {
  status: 404,
  headers: { "Content-Type": "application/json" },
});
displayCourse(response).then(console.log);  // 课程不存在`,
        },
      ],
      pitfalls: [
        { mistake: '把 limit 参数当成路径的一部分', why: '路由通常根据路径选择处理函数，筛选条件还需要从查询参数单独读取。', fix: '使用服务端框架或 URL 对象提供的路径和参数接口。' },
        { mistake: '看到响应已经返回就进入成功分支', why: '服务器可能返回 404 或 500 等状态。浏览器 fetch 收到这些 HTTP 状态仍可得到 Response。', fix: '根据状态或 response.ok 分支，再决定该解析哪种正文或显示哪类消息。' },
        { mistake: '用 404 表示空的筛选结果', why: '集合路径存在且请求成功，只是本次没有匹配项。', fix: '集合查询返回 200 和空数组。具体资源缺失时，根据接口约定返回 404。' },
      ],
      practice: {
        prompt: '写一个内存查询函数模拟 GET 课程目录。固定目录中有一门 html 和一门 js，都属于 web。访问 /api/courses?topic=web 时返回两条，查询 topic=other 时返回空列表。访问具体课程 html 或 unknown 时分别返回 200 与 404。',
        checkpoints: ['先解析 pathname 和 topic，再决定查列表还是详情', '筛选结果为空仍显示 200 和 items: []', '查询不存在的编号返回 404 和可读消息'],
        solution: '用 URL 解析给定的目标地址，在集合路径中按 topic 得到 items。详情路径则通过 find 取出匹配项。这个独立示例只模拟请求目标、状态与正文，不需要启动服务。四次输出依次是两条课程、空列表、html 详情和 404 提示。',
        codeLanguage: 'JavaScript',
        code: `const courses = [
  { id: "html", topic: "web", title: "HTML 结构" },
  { id: "js", topic: "web", title: "JavaScript 起步" },
];
function readCourses(target) {
  const url = new URL(target, "https://learnverse.example");
  if (url.pathname === "/api/courses") {
    const topic = url.searchParams.get("topic");
    const items = topic === null ? courses : courses.filter(course => course.topic === topic);
    return { status: 200, body: { items } };
  }

  const course = courses.find(item => "/api/courses/" + item.id === url.pathname);
  if (course) return { status: 200, body: course };
  return { status: 404, body: { message: "没有找到课程" } };
}

console.log(readCourses("/api/courses?topic=web"));
console.log(readCourses("/api/courses?topic=other"));
console.log(readCourses("/api/courses/html"));
console.log(readCourses("/api/courses/unknown"));`,
      },
      questions: [
        { id: 'expanded-http-empty-list', prompt: 'GET /api/courses?topic=other 成功执行，目录中没有匹配项。按本章约定应返回什么？', choices: ['200 和空列表', '404 和空列表', '201 和一条新课程', '500 和所有课程'], answer: 0, explanation: '资源集合存在，筛选操作正常完成，因此用 200 和空列表表达这个结果。' },
        { id: 'expanded-http-content-type', prompt: '客户端应从哪里确认响应正文实际声明为 JSON？', choices: ['请求路径', '响应头 Content-Type', 'URL 的 limit', '请求头 Accept'], answer: 1, explanation: '响应的 Content-Type 描述服务器发送内容的格式。Accept 表达客户端的偏好。' },
      ],
    },
    validation: {
      objectives: ['逐层校验 JSON 语法、数据形状与业务规则', '把清理后的数据交给写入逻辑', '为调用者返回可以精准定位的错误'],
      sections: [
        {
          heading: '对照原始文字和解析出来的值',
          paragraphs: [
            '收到的 JSON 正文是文本。JSON.parse 把文本转换成可读取的值。解析结果是对象时，可以用 data.minutes 取得 minutes 字段，再问它是数字、字符串还是缺少。JSON 中 25 无引号表示数字，"25" 有引号表示字符串。两者都能成功解析，但接口可以约定只接受数字。',
            '先运行两条示例，观察 typeof 的不同。再试加一条 {"minutes":null} 体会缺值与数字的区别。检查 null 时直接比较 data.minutes === null。下一节会示范如何用 try 和 catch，把连 JSON 格式都不合法的正文变成调用者能理解的错误码。',
          ],
          codeLanguage: 'JavaScript · 独立运行',
          run: { language: 'javascript', expectedOutput: '25 number\n25 string' },
          code: `for (const raw of ['{"minutes":25}', '{"minutes":"25"}']) {
  const data = JSON.parse(raw);
  console.log(data.minutes, typeof data.minutes);
}`,
        },
        {
          heading: '解析完成后还要检查形状',
          paragraphs: [
            '请求正文先以文本到达应用。JSON.parse 会把合法文本变成 JavaScript 值。花括号缺失会造成解析错误。null、数组或数字却也可能是合法 JSON，所以解析成功后还需确认顶层形状符合接口约定。访问字段前执行形状检查，可以把这些错误转换成明确的反馈。',
            '独立运行下方代码，"{" 因为缺少结束符得到 invalid_json，"[]" 因为是数组得到 expected_object，而含有 courseId 的对象得到 parsed。parsed 只表示解析和形状通过，后面仍要检查必需字段和字段值。',
          ],
          codeLanguage: 'JavaScript',
          code: `function bodyShape(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return "invalid_json";
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "expected_object";
  }
  return "parsed";
}
console.log(bodyShape("{"));                       // invalid_json
console.log(bodyShape("[]"));                      // expected_object
console.log(bodyShape('{"courseId":"web"}'));      // parsed`,
        },
        {
          heading: '分清类型、规范化和业务规则',
          paragraphs: [
            'courseId 的类型应是字符串，确认类型后才可以使用 trim。这个接口允许忽略两端空白，所以 " web " 规范化为 "web"。接下来检查它是否对应已知课程。类型正确的 "unknown" 仍不符合规则，因为学习记录必须指向一个存在的课程。',
            '下方示例的三行依次打印 invalid_type、web、unknown_course。检查类型时保留原来的 JSON 类型约定，例如 minutes 仍坚持接收数字，字符串 "25" 应收到纠错反馈。校验后的写入逻辑只取通过规则的 courseId 和 minutes，附带的未知字段不进入记录。',
          ],
          codeLanguage: 'JavaScript',
          code: `const knownCourses = new Set(["web", "python"]);
function checkCourseId(value) {
  if (typeof value !== "string") return { code: "invalid_type" };
  const courseId = value.trim();
  if (!knownCourses.has(courseId)) return { code: "unknown_course" };
  return { courseId };
}
console.log(checkCourseId(7).code);                // invalid_type
console.log(checkCourseId(" web ").courseId);      // web
console.log(checkCourseId("unknown").code);         // unknown_course`,
        },
        {
          heading: '让错误字段、机器代码和提示各有用途',
          paragraphs: [
            '当 minutes 为 0，客户端需要知道是哪一个控件出错，以及如何更正。可以约定 field 放字段名，code 放稳定的机器代码，message 放用户可读的文字。这样网页能定位输入框，自动化测试能据 code 判断原因，提示文案也能按界面需要修改。',
            '下面是 400 响应的 JSON 正文示意。field 指向 minutes，code 是 out_of_range，message 说明闭区间。对于无法解析的正文，还没有对应输入字段，可设置 field 为 null。成功写入时返回 201，并让正文携带可用于定位记录的 id。',
          ],
          codeLanguage: 'JSON · 400 响应正文',
          code: `{
  "field": "minutes",
  "code": "out_of_range",
  "message": "请输入 1 到 1440 之间的整数分钟"
}`,
        },
      ],
      pitfalls: [
        { mistake: '在检查顶层对象前访问 body.courseId', why: '合法 JSON 的 null 值没有可访问的字段，会触发运行时错误。', fix: '先处理语法错误，再排除 null、数组和原始值，然后进入逐字段校验。' },
        { mistake: '先生成并保存记录，再检查值', why: '客户端收到错误时，存储里已经多出无效记录。', fix: '先完成所有校验和规范化，再只用已验证的字段保存。' },
      ],
      practice: {
        prompt: '用 JavaScript 模拟创建学习记录。允许课程 web 和 python，忽略课程标识两端的空白，minutes 要求为 1 到 1440 的整数。错误响应应指出字段和机器代码。',
        checkpoints: ['输入 null 返回 400 和 expected_object', '分钟数是 "25" 时返回 invalid_type，不写入记录', '输入 {"courseId":" web ","minutes":25} 返回 201，内存只新增 {id:"s1",courseId:"web",minutes:25}'],
        solution: '从解析到写入依次检查格式、形状、课程字段和分钟数。每处失败都提前返回。最后只保存通过检查的三个字段。示例按顺序打印两次错误、一次创建成功和一条存储记录，整个过程无需搭建服务。',
        codeLanguage: 'JavaScript',
        code: `const sessions = [];
const courses = new Set(["web", "python"]);
function invalid(field, code, message) {
  return { status: 400, body: { field, code, message } };
}

function createSession(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return invalid(null, "invalid_json", "请提供合法的 JSON");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return invalid(null, "expected_object", "请提供一个 JSON 对象");
  }
  if (typeof body.courseId !== "string") {
    return invalid("courseId", "invalid_type", "课程标识应为文本");
  }
  const courseId = body.courseId.trim();
  if (!courses.has(courseId)) {
    return invalid("courseId", "unknown_course", "请选择已有课程");
  }
  const minutes = body.minutes;
  if (!Number.isInteger(minutes)) {
    return invalid("minutes", "invalid_type", "分钟数应为整数");
  }
  if (minutes < 1 || minutes > 1440) {
    return invalid("minutes", "out_of_range", "请输入 1 到 1440 之间的分钟数");
  }

  const id = "s" + (sessions.length + 1);
  sessions.push({ id, courseId, minutes });
  return { status: 201, body: { id } };
}

console.log(createSession("null"));
console.log(createSession('{"courseId":"web","minutes":"25"}'));
console.log(createSession('{"courseId":" web ","minutes":25}'));
console.log(sessions);`,
      },
      questions: [
        { id: 'expanded-json-shape', prompt: '接口要求正文是 JSON 对象。收到原始文本 [] 后，解析与形状检查各有什么结果？', choices: ['解析失败', '解析成功，形状不符', '两项都通过', '解析后等于 null'], answer: 1, explanation: '[] 是合法 JSON，解析得到数组。接口要求顶层为对象形状并明确排除数组。' },
        { id: 'expanded-valid-type-unknown', prompt: 'courseId 是 "unknown"，其类型为字符串，但目录中没有这个课程。应该在哪一层拒绝？', choices: ['HTTP 传输', 'JSON 语法', '字符串类型检查', '课程是否存在的规则'], answer: 3, explanation: '字符串类型检查可以通过，随后应核对该标识是否对应已有课程。' },
      ],
    },
    data: {
      objectives: ['用主键和外键表示课程与学习记录的关系', '在查询中绑定参数并检查排序', '按课程统计总时长并保留没有记录的课程'],
      sections: [
        {
          heading: '先对一张小表写查询',
          paragraphs: [
            '这张学习记录表有三行，每行一条记录。SELECT 写要看的列，FROM 选用哪一张表，WHERE 只让满足条件的行留下。ORDER BY 指定最后怎么排列。此处希望保留至少 20 分钟的记录，按分钟数从大到小列出，时长相同时按编号排列。',
            '先跑一次得到 s2 和 s3，再把 20 改为 30，观察 s3 被排除而恰好 30 的 s2 留下。把 DESC 改为 ASC 可以调换不同分钟数的显示顺序。建表和准备数据也放在代码里，工作台每次运行会开启一份新的 SQLite 数据库。',
          ],
          codeLanguage: 'SQLite · 独立运行',
          run: { language: 'sql', expectedOutput: 'id\tminutes\ns2\t30\ns3\t25' },
          code: `CREATE TABLE study(id TEXT PRIMARY KEY, minutes INTEGER NOT NULL);
INSERT INTO study VALUES ('s1', 12), ('s2', 30), ('s3', 25);
SELECT id, minutes FROM study
WHERE minutes >= 20
ORDER BY minutes DESC, id;`,
        },
        {
          heading: '新增一行后再查它的编号',
          paragraphs: [
            'INSERT INTO 指定要写入的表及列，VALUES 提供对应的值。下面在旧表中新增一条 s2，再按精确的编号读取来确认。SQL 文本用单引号包住，整数直接写。id 是主键，同一个编号只应属于一行。换一个新编号尝试新增后，还要修改查询的编号才能看到刚加的记录。',
            '试着添加一条记录 s3，再修改 SELECT 只读 s3。先写下预期输出，再运行观察。后面把课程名称放在另一张表时，记录表只保存关联编号，查询会使用刚学过的查询语句与连接规则取出更完整的信息。',
          ],
          codeLanguage: 'SQLite · 独立运行',
          run: { language: 'sql', expectedOutput: 'id\tminutes\ns2\t25' },
          code: `CREATE TABLE study(id TEXT PRIMARY KEY, minutes INTEGER NOT NULL);
INSERT INTO study(id, minutes) VALUES ('s1', 12);
INSERT INTO study(id, minutes) VALUES ('s2', 25);
SELECT id, minutes FROM study WHERE id = 's2';`,
        },
        {
          heading: '把课程资料和学习事实分到两张表',
          paragraphs: [
            '一门课程可以对应多条学习记录。课程表保存每门课的唯一 ID 和标题，记录表保存每次学习的 ID、所属课程 ID 和分钟数。这样每门课的标题只保存在一个地方。若「网页设计」改名，修改课程表的一行就能让新查询读到新的标题。',
            '下方是一组可在空白 SQLite 内存数据库运行的建表与插入语句。courses.id 与 sessions.id 各自标识表中的一行。启用外键检查后，sessions.course_id 必须指向已存在的课程 ID，本例中是 web 或 js。js 没有学习记录，课程行仍可单独保存。',
          ],
          codeLanguage: 'SQLite · 初始化示例数据',
          code: `PRAGMA foreign_keys = ON;
CREATE TABLE courses (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id),
  minutes INTEGER NOT NULL
);
INSERT INTO courses VALUES ('web', '网页设计'), ('js', 'JavaScript 起步');
INSERT INTO sessions VALUES ('s1', 'web', 12), ('s2', 'web', 25);`,
        },
        {
          heading: '把查询参数和 SQL 语句分开传递',
          paragraphs: [
            '筛选课程时，WHERE course_id = :course_id 把具体课程 ID 留给参数。应用创建查询后，通过数据库驱动传入值，例如 web。驱动绑定的是数据值，查询文本保持固定。按 id 排序可以明确结果的顺序，避免页面依赖数据库的自然返回顺序。',
            '可以在同一个 SQLite 命令行会话中接着运行示例。以点开头的两行是 SQLite 命令行指令，接下来的三行是 SQL。参数设为 web 时，依次得到 s1、12 和 s2、25 两行。将参数设为 js 再执行相同查询，结果为零行。',
          ],
          codeLanguage: 'SQLite · 接续初始化示例',
          code: `.parameter init
.parameter set :course_id web
SELECT id, minutes
FROM sessions WHERE course_id = :course_id
ORDER BY id;`,
        },
        {
          heading: '用左连接统计所有课程',
          paragraphs: [
            '要列出每门课的总时长，从 courses 出发，用 LEFT JOIN 连接学习记录。课程没有匹配项时仍会产生结果，只是 s.minutes 为 NULL。再按课程 ID 和标题分组，SUM 汇总各组的分钟数。若某组没有分钟数，SUM 结果是 NULL，可以用 COALESCE 转成 0。',
            '在前面的表上运行查询。网页设计有两条记录，12 + 25 得到 37。JavaScript 起步没有匹配记录，得到 0。ORDER BY 将行按课程 ID 排序，因此 js 行出现在 web 行之前。把连接换成普通 JOIN 可观察无记录课程从结果中消失。',
          ],
          codeLanguage: 'SQLite · 接续初始化示例',
          code: `SELECT c.id, c.title, COALESCE(SUM(s.minutes), 0) AS total_minutes
FROM courses AS c
LEFT JOIN sessions AS s ON s.course_id = c.id
GROUP BY c.id, c.title
ORDER BY c.id;`,
        },
      ],
      pitfalls: [
        { mistake: '把可修改的课程标题复制到每条学习记录', why: '改名后容易只更新一部分，导致同一课程出现不同标题。', fix: '在课程表保留标题，记录表存课程 ID，需要显示时再关联查询。' },
        { mistake: '把用户输入拼接成 SQL 文本', why: '输入内容里的字符可能改变 SQL 的解读方式，普通带引号文本也容易造成语法错误。', fix: '使用固定语句和数据库驱动的参数绑定功能传值。' },
        { mistake: '用 COUNT(*) 计数左连接中的学习记录', why: '没有匹配记录的课程也会产生一行，COUNT(*) 会把这行算进去。', fix: '用 COUNT(s.id) 计数匹配的非空记录 ID。' },
      ],
      practice: {
        prompt: '为上面的两门课程生成统计表，列出课程 ID、标题、学习次数和总分钟数。没有记录的课程也保留。可用纸笔模拟连接与汇总，或运行用同一组数据写成的独立 SQL。',
        checkpoints: ['web 的次数为 2，总分钟数为 37', 'js 的次数和总分钟数都为 0', '让 web 排在 js 前，并说明 COUNT(s.id) 在无记录时为什么得到 0'],
        solution: '按课程 ID 连接后，用 COUNT(s.id) 统计非空记录 ID，合计时间仍用 COALESCE 包裹 SUM。示例用 WITH 声明本次查询临时可用的数据，因此可以独立执行。排序按总分钟数降序，同分课程依 ID 排序。',
        codeLanguage: 'SQLite · 独立查询',
        code: `WITH
  courses(id, title) AS (VALUES ('web', '网页设计'), ('js', 'JavaScript 起步')),
  sessions(id, course_id, minutes) AS (VALUES ('s1', 'web', 12), ('s2', 'web', 25))
SELECT c.id, c.title,
       COUNT(s.id) AS session_count,
       COALESCE(SUM(s.minutes), 0) AS total_minutes
FROM courses AS c
LEFT JOIN sessions AS s ON s.course_id = c.id
GROUP BY c.id, c.title
ORDER BY total_minutes DESC, c.id;`,
      },
      questions: [
        { id: 'expanded-count-non-null', prompt: '左连接后，js 的唯一结果行中 s.id 为 NULL。COUNT(s.id) 等于多少？', choices: ['0', '1', 'NULL', '2'], answer: 0, explanation: 'COUNT(列) 统计非 NULL 的值，这一组没有非空的记录 ID。' },
        { id: 'expanded-decouple-title', prompt: '在本节的两表设计中，只需要修改课程展示标题，应该更新什么？', choices: ['每条学习记录的 id', '每条学习记录的 minutes', '课程表中对应的一行 title', '把 course_id 改为新标题'], answer: 2, explanation: '课程标题由课程表管理，学习记录通过稳定的课程 ID 关联标题。' },
      ],
    },
    testing: {
      objectives: ['用准备、执行、验证组织每个用例', '使用独立的初始数据检查写入前后的状态', '同时验证响应契约以及与存储的连接'],
      sections: [
        {
          heading: '让断言明确表达一次预期',
          paragraphs: [
            '测试的准备阶段提供输入和初始数据，执行阶段调用被测逻辑，验证阶段用断言比较实际和预期。好读的失败信息会指明哪个输入、预期什么、实际是什么。浏览器控制台可以用一个简单的检查函数验证示例，无需安装测试框架。',
            '下方单独运行后输出「三个用例通过」。把 Number.isInteger(minutes) 临时去掉，再运行会在字符串 "25" 的用例报错。比较运算可以把 "25" 转成数字参与范围判断，单独校验它能发现漏掉类型约定的问题。',
          ],
          codeLanguage: 'JavaScript',
          code: `function validMinutes(minutes) {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440;
}
for (const [input, expected] of [[25, true], ["25", false], [1441, false]]) {
  const actual = validMinutes(input);
  if (actual !== expected) {
    throw new Error("输入 " + JSON.stringify(input) + "，预期 " + expected + "，实际 " + actual);
  }
}
console.log("三个用例通过");`,
        },
        {
          heading: '让用例从可预测的存储状态开始',
          paragraphs: [
            '建立测试数据时，显式准备这次场景需要的记录。若用同一个数组跑很多个用例，某次创建留下的行会影响后续断言，交换顺序可能得到不同结果。这里让 makeRepository 在每次调用时返回一个新的存储实例。',
            '下面独立示例先创建两个存储，再只给其中一个新增记录，输出 1 和 0。真实数据库的测试也需要相同的独立性，例如为每个用例重新准备数据。验证不应依赖其他用例已成功执行了一次写入。',
            'add 和 count 都访问 makeRepository 内的 rows。外层函数结束后，返回的两个方法仍记得自己那次调用里创建的数组。这种让函数保留外部变量作用域的写法叫闭包。再调用一次 makeRepository，会新建另一个数组。试试再为 first 添加一行，first 的数量会变为 2，second 仍是 0。',
          ],
          codeLanguage: 'JavaScript',
          run: { language: 'javascript', expectedOutput: '1\n0' },
          code: `function makeRepository() {
  const rows = [];
  return {
    add(row) { rows.push(row); },
    count() { return rows.length; },
  };
}
const first = makeRepository();
const second = makeRepository();
first.add({ id: "s1", minutes: 25 });
console.log(first.count());   // 1
console.log(second.count());  // 0`,
        },
        {
          heading: '检查从创建到读取的整条路径',
          paragraphs: [
            '当响应说创建成功，调用者通常接着按新 ID 读取内容，测试可以模拟这样的步骤。先提交学习记录，确认返回 201 和一个 ID，再拿同一 ID 查询，检查读到的分钟数与提交一致。从写入结果回读能发现状态码正确但记录没有保存的错误。',
            '下面是两次请求与断言的阅读用示意，路径为课堂约定。检查失败输入时也要比较操作前后的数据，已有记录的内容和数量都应符合预期。单独验证分钟数函数能较快找出判断错误，覆盖创建和读取的测试还能检查路由、响应字段和存储之间的配合。',
          ],
          codeLanguage: 'HTTP · 测试流程示意',
          code: `准备：存储中没有学习记录
提交：POST /api/study-sessions，正文为 {"courseId":"web","minutes":25}
验证：状态为 201，响应正文有 id，例如 s1
读取：GET /api/study-sessions/s1
验证：状态为 200，正文 id 为 s1、courseId 为 web、minutes 为 25`,
        },
      ],
      pitfalls: [
        { mistake: '在测试里只检查响应对象存在', why: '有响应不代表处理成功，错误响应也可能是完整对象。', fix: '断言精确的状态码、必要字段，以及该场景要求的存储结果。' },
        { mistake: '让创建用例和读取用例使用隐含的执行顺序', why: '单独执行读取用例时，预期的记录可能不存在。', fix: '在同一条流程内创建再读取，或为独立读取用例事先准备数据。' },
      ],
      practice: {
        prompt: '对一个接收 minutes 的内存处理函数写表驱动测试。允许 1 到 1440 的整数，每项开头准备一条 10 分钟的旧记录。有效值返回 201 并追加一条记录，无效值返回 400 且已有存储保留原状。',
        checkpoints: ['覆盖 0、1、1440、1441 和字符串 "25"', '检查响应状态和错误字段，还要检查记录数与旧记录内容', '跑完五个场景打印「五个用例通过」，单个用例失败时能看出是哪项输入'],
        solution: '所有用例按同样的步骤组织，表中每行记录输入和期望状态。根据期望状态检查是否应该新增，再检查新记录或错误字段。把函数中的 minutes > 1440 改成 >= 1440 重跑，恰好位于上边界的用例会失败。',
        codeLanguage: 'JavaScript',
        code: `function createSession(minutes, rows) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return { status: 400, body: { field: "minutes" } };
  }
  const record = { id: "s" + (rows.length + 1), minutes };
  rows.push(record);
  return { status: 201, body: { id: record.id } };
}

const cases = [[0, 400], [1, 201], [1440, 201], [1441, 400], ["25", 400]];
for (const [input, expectedStatus] of cases) {
  const rows = [{ id: "s1", minutes: 10 }];
  const result = createSession(input, rows);
  function check(condition, detail) {
    if (!condition) throw new Error(JSON.stringify(input) + "：" + detail);
  }
  check(result.status === expectedStatus, "响应状态不符");
  check(rows[0]?.id === "s1" && rows[0]?.minutes === 10, "旧记录被修改");
  if (expectedStatus === 201) {
    check(rows.length === 2, "未追加恰好一条记录");
    check(result.body.id === rows[1].id && rows[1].minutes === input, "新记录与响应不符");
  } else {
    check(rows.length === 1, "失败请求仍写入了记录");
    check(result.body.field === "minutes", "错误字段不符");
  }
}
console.log("五个用例通过");`,
      },
      questions: [
        { id: 'expanded-fresh-fixture', prompt: '一个创建用例应独立验证「旧记录保留」。哪种准备方式最合适？', choices: ['使用上个用例碰巧留下的数据', '查询真实用户的数据', '在本用例开始时创建该条旧记录', '跳过数据准备'], answer: 2, explanation: '显式准备本用例的存储数据，可以独立重跑并核对旧记录。' },
        { id: 'expanded-read-after-write', prompt: '创建接口返回 201 和 id，随后按 id 查询却得到 404。哪类测试最直接覆盖这个问题？', choices: ['只检查分钟数类型', '检查响应是否为 JSON', '只运行页面样式检查', '在同一场景中先创建，再用返回的 id 读取'], answer: 3, explanation: '相连的请求可以验证创建生成的标识、实际写入和读取接口是否一致。' },
      ],
    },
  },
}

export const webExpansions: CourseExpansions = Object.fromEntries(
  Object.entries(authoredWebExpansions).map(([courseId, course]) => {
    const workshops = foundationWebWorkshops[courseId]
    if (!workshops) return [courseId, course]

    const lessons = Object.entries(course).map(([lessonId, lesson]) => {
      const sections = lesson.sections.map((section) => {
        if (courseId === 'lv-javascript-foundations' && section.codeLanguage === 'JavaScript' && section.code) {
          return { ...section, run: { language: 'javascript' as const } }
        }
        return section
      })
      return [lessonId, { ...lesson, sections: [...sections, ...(workshops[lessonId] ?? [])] }]
    })
    return [courseId, Object.fromEntries(lessons)]
  }),
)
