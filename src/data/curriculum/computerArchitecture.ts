import { check, demo, exercise, lesson, step } from './advanced/languagesAuthoring'
import type { CourseProject } from './types'

const fill = '  // 在这里完成计算。'

const words = lesson({
  id: 'fixed-width',
  title: '寄存器、加法与进位',
  demo: 'binary-carry',
  summary: '追踪一笔放不进四位寄存器的加法，分别报告留下的低四位和进位。',
  primer: {
    lead: '计步器只有四盏二进制灯。亮到 1111 后再加一步，四盏灯会归零。多出来的一位可以由另一盏灯记录。',
    terms: [
      ['寄存器', '处理器内部保存少量数据的存储位置。这里的寄存器固定为四位。'],
      ['算术逻辑单元（ALU）', '处理器里执行加法等运算的部分。'],
      ['进位', '无符号加法的结果多出的一位。这里用 0 或 1 表示。'],
    ],
  },
  objectives: ['把四位无符号加法写为低位与进位两个结果。', '用最大值、恰好跨界和普通值检查规则。'],
  sections: [
    step('四位能放多少种状态',
      '从右往左，四位的权重依次是 1、2、4、8。0000 代表 0，1111 是 8 + 4 + 2 + 1，代表 15。每位有两种状态，四位合起来有 2 × 2 × 2 × 2 = 16 种。',
      '这一章只处理无符号数。两个输入都是 0 到 15 的整数，和最大为 30，因此额外一位就能记下进位。',
      '从最右一列开始手算 1111 + 0001。第一列 1 + 1 等于二进制的 10，本列写 0，向左传 1。其余三列各收到这个进位，又各自写 0 并传 1。最左边传出去的 1 和留下的 0000 合起来是 10000。'),
    demo('javascript', '把和拆成低四位和进位', [
      '例子把两个四位寄存器的读数写在调用处。对非负整数，total % 16 得到除以 16 的余数，正好是低四位的值。total >= 16 时进位是 1，否则是 0。',
      '先算 15 + 1 和 15 + 0，再按运行核对。把第一组输入改为 15 和 2，低四位应是 1，进位仍为 1。',
    ], `function add(a, b) {
  const total = a + b;
  const low = total % 16;
  let carry = 0;
  if (total >= 16) carry = 1;
  console.log(low, carry);
}

add(15, 1);
add(15, 0);`, '0 1\n15 0'),
    demo('javascript', '把读数恢复成四盏灯', [
      'toString(2) 把数字变成二进制文本。padStart(4, "0") 在左侧补零，直到有四个字符。只有先把值限制在 0 到 15，结果才保证恰好四位。',
      '显示和计算是两件事。下段例子在算完以后才转成文本。第二个输入改成 7 时，9 + 7 = 16，灯应显示 0000。',
    ], `const total = 9 + 3;
const low = total % 16;
const lights = low.toString(2).padStart(4, "0");
console.log(lights);`, '1100'),
  ],
  wrapUp: step('从加法器走到指令',
    '用「完整结果 = 进位 × 16 + 低四位」核对练习。例如 15 + 15 = 1 × 16 + 14，低四位灯串为 1110。',
    '在下一章，ADD 指令会使用同样的四位加法规则。那台机器只更新低四位，方便你专心追踪一列指令如何执行。'),
  pitfalls: [
    { mistake: '把 16 当成可存的最大值。', why: '16 的写法 10000 需要五位。', fix: '先用 15 + 0 和 15 + 1 对照临界点。' },
    { mistake: '把格式化的灯串继续拿来加。', why: 'JavaScript 的字符串加法会拼接字符。', fix: '保留数值到运算结束，最后再转成灯串。' },
  ],
  practice: {
    prompt: '完成 status(a, b)，每次返回一行灯串和进位，中间留一个空格。给出的输入已限定为四位无符号整数。',
    checkpoints: ['7 + 2 应得到 1001 0。', '15 + 1 应得到 0000 1。', '15 + 15 应得到 1110 1。'],
    hints: ['先算完整的和，再用 16 拆低位和进位。', '先把低位转成四字灯串，再拼上空格和进位。'],
    solution: '输出分成两列，左列只依赖余数，右列只依赖和是否达到 16。',
  },
  questions: [
    check('capacity', '四位无符号寄存器有多少种状态？', ['4', '8', '15', '16'], 3, '从 0000 到 1111 共 16 种，最大值是 15。'),
    check('sum', '14 + 3 留在寄存器里的是几？', ['0', '1', '3', '17'], 1, '17 除以 16 的余数是 1，另有进位 1。'),
    check('carry', '哪一笔加法刚好产生进位且低位为零？', ['8 + 7', '8 + 8', '9 + 8', '0 + 0'], 1, '8 + 8 正好等于 16。'),
    check('display', '低位的数值为 2，四盏灯应该如何显示？', ['10', '0010', '0100', '1000'], 1, '2 的二进制写法是 10，往左补零保持权重。'),
  ],
  exercise: exercise('javascript', `function status(a, b) {
${fill}
}

console.log(status(7, 2));
console.log(status(15, 1));
console.log(status(15, 15));`, fill, `  const total = a + b;
  const lights = (total % 16).toString(2).padStart(4, "0");
  let carry = 0;
  if (total >= 16) carry = 1;
  return lights + " " + carry;`, '1001 0\n0000 1\n1110 1', ['普通加法', '恰好跨界', '最大输入']),
})

const instructions = lesson({
  id: 'instruction-cycle',
  title: '取指、译码与执行',
  demo: 'cpu-cycle',
  summary: '用程序计数器和累加器逐条执行任务，找出停机后还有哪些指令未执行。',
  primer: {
    lead: '把程序想成一列编号指令。机器必须记住从哪一条读起，并知道执行后往哪一条走。',
    terms: [
      ['程序计数器（PC）', '记录将要取出的指令位置。本课的位置从 0 开始。'],
      ['操作码和操作数', '操作码表示做什么，操作数给出这次操作用到的值或地址。'],
      ['累加器（ACC）', '本课微型机器里保存当前计算结果的四位寄存器。'],
    ],
  },
  objectives: ['从一条带操作数的指令读出动作和值。', '记录每步的 PC 和累加器，遇 HALT 结束。'],
  sections: [
    step('约定这台机器会什么',
      '真实处理器常把指令编码成字节。本课将它解码后的样子写成数组，例如 ["SET", 5] 把 5 放进 ACC，["ADD", 3] 把 3 加到 ACC。结果仍按四位规则留下余数。["HALT"] 表示停机，没有操作数。',
      'CPU 是中央处理器。用 PC 找到一条指令叫取指，读取该指令第 0 项、确定该做什么叫译码，更新 ACC 等状态就是执行。正常执行完后将 PC 加 1，本课没有跳转。',
      '遇到 HALT，机器按程序的要求停机。读到无法译码的 MUL 会报告故障。两种情况都不会执行下一条，报告的 PC 都指向当前指令。'),
    demo('javascript', '顺序推进两条指令', [
      'program 是指令清单，instruction 是其中的一条。循环中先记下当前位置，再执行操作，最后记录本步的结果。ADD 读取的是执行 SET 之后的 ACC。',
      '把 SET 的操作数改为 14，第二步加 3 会得到 1。',
    ], `const program = [["SET", 5], ["ADD", 3]];
let acc = 0;
for (let pc = 0; pc < program.length; pc++) {
  const instruction = program[pc];
  const op = instruction[0];
  const value = instruction[1];
  if (op === "SET") acc = value;
  if (op === "ADD") acc = (acc + value) % 16;
  console.log(pc + ":" + acc);
}`, '0:5\n1:8'),
    demo('javascript', '在未知指令处停止并报告位置', [
      '硬件或模拟器要能区分主动停止和无法译码。这里的检查器只追踪可读指令，遇到 HALT 或未知操作码时用 break 结束循环。程序开头故意写了未知的 MUL。',
      '把 MUL 改成 ADD，应该看到 0:ADD，再看到 1:停机。',
    ], `const program = [["MUL", 3], ["HALT"]];
for (let pc = 0; pc < program.length; pc++) {
  const op = program[pc][0];
  if (op === "HALT") {
    console.log(pc + ":停机");
    break;
  }
  if (op !== "SET" && op !== "ADD") {
    console.log(pc + ":未知指令");
    break;
  }
  console.log(pc + ":" + op);
}`, '0:未知指令'),
  ],
  wrapUp: step('用执行表检查停机',
    '在纸上给每一条指令记下 PC、执行前 ACC 和执行后 ACC。对 SET 7 → HALT → ADD 2，第一行的 ACC 从 0 变 7，第二行仍为 7，第三行没有执行。',
    '下一章让指令的操作数表示一个地址。保留这张执行表，再加一列记录数据读写的位置。'),
  pitfalls: [
    { mistake: '运行后用加过 1 的 PC 报错。', why: '故障位置会指到下一条。', fix: '在执行发生的位置生成记录。' },
    { mistake: '停机后仍写一笔运行结果。', why: 'HALT 后的指令对本次运行没有效果。', fix: '发现 HALT 立即返回含当前 PC 的报告。' },
  ],
  practice: {
    prompt: '编写 run(program)，ACC 从 0 开始。给出的 SET 和 ADD 操作数都在 0 到 15。返回「停机位置:累加器」，无效操作码返回「位置:未知指令」，跑完整列仍未停机则返回「未停机:累加器」。',
    checkpoints: ['SET 7、HALT、ADD 2 应返回 1:7。', 'ADD 3 后遇到 MUL 应返回 1:未知指令。', '只有 ADD 5 时应返回 未停机:5。'],
    hints: ['先在每轮检查操作码，再修改 ACC。', '循环内用 return 交回终止结果，循环后专门报告缺少停机。'],
    solution: '循环中分别处理停机、设值、相加与无法译码。把自然跑到清单末尾视为独立结果。',
  },
  questions: [
    check('pc', 'PC 为 2 时取哪条指令？', ['第一条', '第二条', '第三条', 'ACC 指定的那条'], 2, '位置从 0 开始，2 是第三条。'),
    check('operand', '["SET", 6] 中，操作数是哪个？', ['SET', '6', 'PC', 'ACC'], 1, 'SET 指定动作，6 给出动作需要的值。'),
    check('halt', 'SET 3、HALT、ADD 4 的最终 ACC 是多少？', ['0', '3', '4', '7'], 1, 'HALT 在 ADD 之前，ACC 仍为 3。'),
    check('bad-op', 'PC=0 遇到未知操作码，诊断应记哪个位置？', ['0', '1', '清单末尾', 'ACC 的值'], 0, 'PC=0 指向当前无法译码的指令。'),
  ],
  exercise: exercise('javascript', `function run(program) {
${fill}
}

console.log(run([["SET", 7], ["HALT"], ["ADD", 2]]));
console.log(run([["ADD", 3], ["MUL", 2], ["HALT"]]));
console.log(run([["ADD", 5]]));`, fill, `  let acc = 0;
  for (let pc = 0; pc < program.length; pc++) {
    const op = program[pc][0];
    const value = program[pc][1];
    if (op === "HALT") return pc + ":" + acc;
    if (op === "SET") acc = value;
    else if (op === "ADD") acc = (acc + value) % 16;
    else return pc + ":未知指令";
  }
  return "未停机:" + acc;`, '1:7\n1:未知指令\n未停机:5', ['主动停机', '未知指令', '缺少停机']),
})

const bus = lesson({
  id: 'memory-and-io',
  title: '内存地址与输入输出',
  summary: '沿着一条写入指令找出数据去向，区分普通存储、设备端口和未映射地址。',
  primer: {
    lead: '处理器发出一次写入，要同时说清楚往哪儿写、写入什么。机器内部按地址把请求送到内存或设备。',
    terms: [
      ['地址', '存储单元或设备端口的位置编号，和放在该处的值是两个概念。'],
      ['总线', '部件间传递地址、数据和读写信号的通路。'],
      ['内存映射 I/O', '用一段地址访问设备。本课对地址 15 的写入会在显示器追加一个值。'],
    ],
  },
  objectives: ['跟踪读写请求的地址与值。', '保持非法访问无副作用，并解释显示端口为何与内存分开。'],
  sections: [
    step('先画一张地址地图',
      '课堂机器的主存只有八个四位单元，地址从 0 到 7。地址 15 单独对应显示器，只允许写。8 到 14 没有连接部件，16 也超出地址范围。本课用数组表示内存，用数组记录显示历史。',
      '存储动作 STORE 会把 ACC 的值送到指定地址，而 LOAD 会从指定内存地址把值读回 ACC。无法访问的地址必须返回错误，内存和显示历史保持原样。'),
    demo('javascript', '在同一个地址写入再取回', [
      '先检查 address 是否为整数并且落在数组范围内，最后才写值。Number.isInteger 判断整数。&& 表示三个条件都要满足，memory.length 是数组的长度。',
      '内存初始全是 0。写入地址 7 后应在第八格看见 11，写入地址 8 的尝试应失败。输出中的 memory[7] 是直接观察模拟器里的那一格，结课项目会用 LOAD 模拟机器自己的读取动作。',
    ], `const memory = [0, 0, 0, 0, 0, 0, 0, 0];
function store(address, value) {
  if (Number.isInteger(address) && address >= 0 && address < memory.length) {
    memory[address] = value;
    return true;
  }
  return false;
}
console.log(store(7, 11), memory[7]);
console.log(store(8, 9), memory.length);`, 'true 11\nfalse 8'),
    demo('javascript', '给显示器追加一个值', [
      '先分派地址 15，再考虑内存写入。push 把值追加到数组末尾。这里先单独练显示器的分支，对任何其他地址都返回 false；实作再补完整的地址地图。',
      '对端口写两次，显示历史按顺序保留两个值。中间写入地址 14 没有改变历史。',
    ], `const display = [];
function writeDisplay(address, value) {
  if (address !== 15) return false;
  display.push(value);
  return true;
}
writeDisplay(15, 4);
console.log(writeDisplay(14, 9));
writeDisplay(15, 2);
console.log(display.join(","));`, 'false\n4,2'),
  ],
  wrapUp: step('先看地址，再核对副作用',
    '写入 7、15、8 时，可以依次预期「改主存」「追加显示」「两处都不动」。编程练习会打印状态和数据，核对时两列都要看。',
    '结课项目把取指、四位加法、主存读写和显示串在一起。用上一章的执行表追踪程序，先确认最后一次成功的写入，再定位故障。'),
  pitfalls: [
    { mistake: '对任意地址直接执行 memory[address] = value。', why: 'JavaScript 数组可能增长，掩盖模拟硬件本应拒绝的访问。', fix: '写入前核对整数和可用范围。' },
    { mistake: '用数组的第 15 格模拟显示器。', why: '显示端口的写入属于设备动作，主存只有八格。', fix: '把设备历史独立保存。' },
  ],
  practice: {
    prompt: '补全 write。写入 0 到 7 后返回 RAM，写入 15 时追加到显示历史并返回 DISPLAY，其他地址返回 FAULT。传入的 value 已限定在 0 到 15。',
    checkpoints: ['写 7 后 memory[7] 变为 12，长度仍为 8。', '写 15 会显示 6，随后写 8 和 2.5 都不改变内存或显示。'],
    hints: ['用地址与 15 严格比较，提前处理显示端口。', '写内存前检查地址是整数、至少为 0 且小于数组长度。'],
    solution: '每个成功分支只改动一个目的地。拒绝分支只返回诊断。',
  },
  questions: [
    check('last-address', '八格内存的最后一个地址是几？', ['6', '7', '8', '15'], 1, '地址从 0 数到 7，共八格。'),
    check('device', '往地址 15 写两次后，应在哪里找到这两次写入？', ['内存第 15 格', '同一个程序编号', '显示历史', '进位寄存器'], 2, '地址 15 的写入是显示动作，依次追加到历史。'),
    check('invalid', '写地址 8 失败后，内存长度应是多少？', ['7', '8', '9', '16'], 1, '失败访问无副作用，长度仍为八格。'),
    check('value-address', 'STORE 3 执行时 ACC 是 9，这条指令做了什么？', ['向地址 9 写 3', '向地址 3 写 9', '把 PC 改为 9', '把 9 显示出来'], 1, 'STORE 的操作数给出地址，写入值来自 ACC。'),
  ],
  exercise: exercise('javascript', `const memory = Array(8).fill(0);
const display = [];
function write(address, value) {
${fill}
}

console.log(write(7, 12), memory[7]);
console.log(write(15, 6), display.join(","));
console.log(write(8, 5), write(2.5, 4), memory.length, display.join(","));`, fill, `  if (address === 15) {
    display.push(value);
    return "DISPLAY";
  }
  if (Number.isInteger(address) && address >= 0 && address < memory.length) {
    memory[address] = value;
    return "RAM";
  }
  return "FAULT";`, 'RAM 12\nDISPLAY 6\nFAULT FAULT 8 6', ['最后一格', '设备端口', '非法地址']),
})

const cpu = exercise('javascript', `function simulate(program, memory) {
  // 每个用例给一份新主存。用 mem 保存工作副本。
  const mem = memory.slice();
  const display = [];
  let acc = 0;
  function isMemory(address) {
    return Number.isInteger(address) && address >= 0 && address < mem.length;
  }
  function report(status, pc) {
    return status + " PC=" + pc + " ACC=" + acc +
      " RAM[1]=" + mem[1] + " DISPLAY=" + display.join(",");
  }
${fill}
}

console.log(simulate([["LOAD", 0], ["ADD", 5], ["STORE", 1], ["HALT"]], [4, 0, 0, 0, 0, 0, 0, 0]));
console.log(simulate([["LOAD", 0], ["ADD", 3], ["STORE", 15], ["HALT"]], [14, 0, 0, 0, 0, 0, 0, 0]));
console.log(simulate([["LOAD", 0], ["STORE", 8], ["STORE", 1], ["HALT"]], [7, 3, 0, 0, 0, 0, 0, 0]));
const emptyMemory = [0, 0, 0, 0, 0, 0, 0, 0];
console.log(simulate([["ADD", 2]], emptyMemory));
console.log(simulate([["ADD"], ["HALT"]], emptyMemory));
console.log(simulate([["MUL", 3], ["HALT"]], emptyMemory));
console.log(simulate([["LOAD", 0], ["STORE", 15], ["LOAD", 15]], [4, 0, 0, 0, 0, 0, 0, 0]));`, fill, `  for (let pc = 0; pc < program.length; pc++) {
    const op = program[pc][0];
    const operand = program[pc][1];
    switch (op) {
      case "LOAD":
        if (!isMemory(operand)) return report("地址故障", pc);
        acc = mem[operand];
        break;
      case "ADD":
        if (!Number.isInteger(operand) || operand < 0 || operand > 15) return report("操作数故障", pc);
        acc = (acc + operand) % 16;
        break;
      case "STORE":
        if (operand === 15) display.push(acc);
        else if (isMemory(operand)) mem[operand] = acc;
        else return report("地址故障", pc);
        break;
      case "HALT":
        return report("停机", pc);
      default:
        return report("未知指令", pc);
    }
  }
  return report("未停机", program.length);`, [
  '停机 PC=3 ACC=9 RAM[1]=9 DISPLAY=',
  '停机 PC=3 ACC=1 RAM[1]=0 DISPLAY=1',
  '地址故障 PC=1 ACC=7 RAM[1]=3 DISPLAY=',
  '未停机 PC=1 ACC=2 RAM[1]=0 DISPLAY=',
  '操作数故障 PC=0 ACC=0 RAM[1]=0 DISPLAY=',
  '未知指令 PC=0 ACC=0 RAM[1]=0 DISPLAY=',
  '地址故障 PC=2 ACC=4 RAM[1]=0 DISPLAY=4',
].join('\n'), ['加载和写回', '跨界并显示', '无效地址', '程序跑尽', '缺少操作数', '未知指令', '读取只写端口'])

const project: CourseProject = {
  title: '结课项目 · 微型计算机的诊断台',
  summary: '你正在调试一台用四位读数驱动显示器的机器。运行程序并交付一份日志，让同伴读出最后一次有效状态和停机原因。',
  requirements: [
    '输入是一列已拆成数组的指令与长度为 8 的主存镜像；每格主存初值都在 0 到 15。地址与操作数都在每条指令的第 1 项，缺少操作数时读到 undefined。',
    '实现 LOAD、ADD、STORE 和 HALT。LOAD 只读主存，ADD 接受 0 到 15 的整数，STORE 写主存或显示端口，HALT 在当前 PC 结束。项目没有 SET 指令，初值由 LOAD 获得。',
    '验证通过后再改变本步的状态。故障应报告当前 PC，且不能再执行后续指令。用已有的 report 返回停机、地址故障、操作数故障、未知指令或未停机。清单跑尽时用其长度作为下一 PC。可以像第二章一样用 if 和 else if 逐个判断操作码。',
    '用例输入都放在起始代码末尾。改动一组输入后可以自行比对日志，例如连续两次写入地址 15 应保留两次显示结果，再尝试读取它应该报告地址故障。',
  ],
  examples: [
    { label: '加载和写回', input: '内存 0 号格为 4。LOAD 0 → ADD 5 → STORE 1 → HALT。', expected: '停机 PC=3，ACC=9，内存 1 号格为 9，显示为空。' },
    { label: '跨界并显示', input: '内存 0 号格为 14。LOAD 0 → ADD 3 → STORE 15 → HALT。', expected: '停机 PC=3，ACC=1，内存 1 号格为 0，显示 1。' },
    { label: '无效地址', input: '内存前两格为 7、3。LOAD 0 → STORE 8 → STORE 1 → HALT。', expected: '地址故障 PC=1，ACC=7，内存 1 号格保留 3，显示为空。' },
    { label: '程序跑尽', input: '内存全为 0，只有 ADD 2。', expected: '未停机 PC=1，ACC=2，显示为空。' },
    { label: '缺少操作数', input: 'ADD 未提供操作数，下一条才是 HALT。', expected: '操作数故障 PC=0，ACC=0，显示为空。' },
    { label: '未知指令', input: '第一条是机器没有实现的 MUL 3。', expected: '未知指令 PC=0，ACC=0，显示为空。' },
    { label: '读取只写端口', input: '内存 0 号格为 4。LOAD 0 → STORE 15 → LOAD 15。', expected: '地址故障 PC=2，ACC=4，先前显示的 4 仍在。' },
  ],
  exercises: [cpu],
  explanation: '每条指令先按操作码分派，再检查操作数是否合法。参考代码的 switch 用 case 匹配操作码，break 结束当前分支，default 处理未知的动作。通过检查后才更新 ACC 或写入。用数组的 slice() 建立内存副本，互不影响的用例可以反复运行。诊断只记录内存 1 号格和显示历史，便于对照本项目的测试。',
}

export const architecture = { lessons: [words, instructions, bus], project }
