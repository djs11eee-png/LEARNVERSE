import type { ChapterExercise } from '../../code/exercises'
import type { LessonQuestion, LessonSection } from '../workspaceCourses'
import type { CurriculumLesson, CurriculumTrack, CourseProject } from './types'
import { languageWorkshops } from './languageWorkshops'

type PracticeCode = ChapterExercise & { solution: string; expectedOutput: string }

function sample(heading: string, paragraphs: string[], code?: string, codeLanguage?: 'C' | 'Java' | 'JavaScript'): LessonSection {
  const language = codeLanguage === 'C' ? 'c' : codeLanguage === 'Java' ? 'java' : 'javascript'
  return { heading, paragraphs, code, codeLanguage, run: code && codeLanguage ? { language } : undefined }
}

function check(id: string, prompt: string, choices: string[], answer: number, explanation: string): LessonQuestion {
  return { id, prompt, choices, answer, explanation }
}

function exercise(
  language: PracticeCode['language'],
  template: string,
  implementation: string,
  expectedOutput: string,
  placeholder = '/* 在这里补全 */',
): PracticeCode {
  return { language, starter: template, solution: template.replace(placeholder, () => implementation), expectedOutput }
}

type LessonDescription = Omit<CurriculumLesson, 'expansion' | 'exercise'> & {
  objectives: string[]
  sections: LessonSection[]
  pitfalls: CurriculumLesson['expansion']['pitfalls']
  prompt: string
  checkpoints: string[]
  hints: string[]
  explanation: string
  questions: LessonQuestion[]
}

function lesson(description: LessonDescription, code: PracticeCode): CurriculumLesson {
  const { objectives, sections, pitfalls, prompt, checkpoints, hints, explanation, questions, ...identity } = description
  const workshop = languageWorkshops[identity.id]
  return {
    ...identity,
    expansion: {
      objectives,
      sections: [...workshop.prepare, ...sections, workshop.guided],
      pitfalls,
      practice: { prompt, checkpoints, hints, solution: explanation },
      questions,
    },
    exercise: code,
  }
}

const cLessons = [
  lesson({
    id: 'structures',
    title: '用结构体表示一条样本',
    summary: '用结构体把样本编号和读数放在一起，再用结构体数组保存多条记录。',
    primer: { lead: '给同一个样本贴上编号和读数，两张标签应随同一个盒子移动。结构体可以把这些值放在一起。', terms: [['struct', '声明一种由多个成员组成的类型。'], ['成员', '结构体中可以单独读写的字段，如 id 和 value。']] },
    objectives: ['声明结构体并初始化成员', '通过点号读取成员', '遍历结构体数组并按字段筛选'],
    sections: [
      sample('把编号和读数放在一起', ['单独保存两个数组时，两边必须始终使用相同的下标。声明 Sample 后，每项都是一条完整记录，可以把编号和测量值一起交给函数。', '下面用花括号按声明顺序初始化样本，再打印两个成员。用点号取值的对象是 sample，点号右边是要读的成员。'], String.raw`#include <stdio.h>
typedef struct { int id; int value; } Sample;
int main(void) {
    Sample sample = {7, 23};
    printf("%d: %d\n", sample.id, sample.value);
}`, 'C'),
      sample('每个数组元素都是一条记录', ['Sample rows[] 可以保存多条样本。rows[i].value 先用下标选中一条，再读取读数。若要找最大读数对应的样本，可以保存记录的下标，再从同一条记录取编号。', '空数组的逻辑长度是 0 时，直接走空分支。不能使用 rows[0] 作为初始最大值，因为约定中没有可读的第一条记录。']),
      sample('把整条记录交给小函数', ['先用 int is_warm(Sample row, int limit) 为判断命名，再让遍历负责数命中次数。函数收到的是结构体的副本。', '判断 row.value >= limit 表示包含边界。例如 20 与门槛 20 正好相等，应计入。把这条记录放入测试，能区分 > 和 >=。']),
    ],
    pitfalls: [
      { mistake: '用编号当作数组下标。', why: '编号由业务决定，例如编号 90 可能出现在下标 0。', fix: '按下标遍历，用成员 id 比较编号。' },
      { mistake: '交换两项时只交换 value。', why: '编号与读数会配错。', fix: '交换整个 Sample，保留字段对应关系。' },
    ],
    prompt: '补全遍历，统计读数达到 limit 的样本数。保留主函数中的普通、边界和空数据检查。',
    checkpoints: ['19、20、24 中达到 20 的有两条。', '门槛为 24 时仍命中一条，长度 0 时命中 0 条。'],
    hints: [
      '先准备一个从 0 开始的 size_t 计数器，用 i 从 0 遍历到 length - 1。长度为 0 时循环自然执行 0 次。',
      '每轮通过 rows[i].value 读出当前样本的读数，用 >= 比较门槛 limit（注意包含等于门槛的边界情况）。',
    ],
    explanation: '每次先通过下标选样本，再比较该样本的 value。长度为 0 时循环体执行零次。',
    questions: [
      check('c-struct-field', '要读取第三条样本的编号，应该用哪个表达式？', ['rows[3].id', 'rows[2].id', 'rows.id[2]', 'rows[2].value'], 1, '数组下标从 0 开始，编号是 id 字段。'),
      check('c-struct-copy', '把 Sample row 作为值传入函数，然后只在函数中修改 row.value，会怎样？', ['调用方样本改成新值', '数组长度加一', '调用方样本保持原值', '调用方编号变为 0'], 2, '值传递给函数的是结构体副本。'),
      check('c-struct-id', '编号 90 的样本位于数组第一项。读取它的读数应该使用什么？', ['rows[90].value', 'rows[1].value', 'rows[0].id', 'rows[0].value'], 3, '第一项下标为 0，读数存于 value。'),
      check('c-struct-limit', '读数恰好是 20，规则是至少 20。哪个判断会计入？', ['value >= 20', 'value > 20', 'value < 20', 'value != 20'], 0, '至少包含 20 本身，所以使用 >=。'),
    ],
  }, exercise('c', String.raw`#include <stdio.h>
#include <stddef.h>
typedef struct { int id; int value; } Sample;

size_t count_warm(const Sample rows[], size_t length, int limit) {
    /* 在这里补全 */
    return 0;
}

int main(void) {
    const Sample rows[] = {{7, 19}, {9, 20}, {12, 24}};
    printf("%zu\n", count_warm(rows, 3, 20));
    printf("%zu\n", count_warm(rows, 3, 24));
    printf("%zu\n", count_warm(rows, 0, 20));
}`, String.raw`size_t count = 0;
    for (size_t i = 0; i < length; i++) {
        if (rows[i].value >= limit) count++;
    }
    return count;`, '2\n1\n0', '/* 在这里补全 */\n    return 0;')),
  lesson({
    id: 'capacity',
    title: '区分有效长度和数组容量',
    summary: '给固定容量的样本簿追加记录，按顺序核对容量、写入与长度更新。',
    primer: { lead: '抽屉有三个槽位，只放一张卡片时，占了一个槽位，另两个还能用。', terms: [['容量', '已经预留的元素槽位数。'], ['逻辑长度', '当前已经写入、可以读取的元素数。']] },
    objectives: ['维护 0 ≤ length ≤ capacity', '满时拒绝追加并保留已有记录', '用测试确认追加成功后长度增加一次'],
    sections: [
      sample('在下标 length 处写入下一项', ['假定上限为 3，当前一条数据占下标 0。这时 length 是 1，下标 1 是下一格。计数器只在写入成功后增加。', '长度达到容量后，length 等于 3，再用它访问 data[3] 就会越界。先判断 length >= capacity，成功路径才可以索引。']),
      sample('把长度和数据的更新放在同一条路径', ['调试两项共用的数据时，先核对状态，再核对槽位和长度。下面用一个函数把二者更新放在一起。函数收到数组的首项地址和长度的地址，修改数据与计数都会由调用者看到。'], String.raw`#include <stdio.h>
#include <stddef.h>

static void write_next(int data[], size_t *length, int value) {
    data[*length] = value;
    (*length)++;
}

int main(void) {
    int data[3] = {5};
    size_t length = 1;
    if (length < 3) write_next(data, &length, 9);
    printf("%zu: %d %d\n", length, data[0], data[1]);
}`, 'C'),
      sample('用满容量的输入查找状态错误', ['向容量为 2 的数组追加 8、9、10。前两次成功，第三次返回 0。检查数组仍是 8 和 9，以及长度仍为 2。', '再测容量 0 且长度 0 的调用。传入一块真实缓冲区和逻辑容量 0，可以确认只是拒绝记录，不依赖零长度数组扩展。']),
    ],
    pitfalls: [
      { mistake: '先修改 length 再检查是否已满。', why: '失败的操作会把计数和内容弄得不一致。', fix: '先拒绝满容量，成功写入后才更新长度。' },
      { mistake: '遍历到 capacity。', why: '还有槽位未写入时，读到的元素不属于有效记录。', fix: '统计只遍历 [0, length)。' },
    ],
    prompt: '完成 append，让三个连续操作演示从空到满，再到满时拒绝。0 表示拒绝，1 表示写入。',
    checkpoints: ['容量 2 时成功标志依次为 1、1、0。', '最后两项为 8、9，长度为 2。'],
    hints: [
      '先判断 *length < capacity。只有在还有空槽位时，才把 value 写进 data[*length]。',
      '写完数据后再用 (*length)++ 更新调用方的长度（不要漏掉括号），最后返回 1；已满时直接保持原样返回 0。',
    ],
    explanation: '先比较有效长度和容量，在下一空位写入，再增加长度。调用方得到返回状态和更新后的长度。',
    questions: [
      check('c-capacity-next', '容量 4、长度 2 时，下一项应写入哪个下标？', ['0', '1', '2', '4'], 2, '已有下标 0 和 1，下一项下标等于长度。'),
      check('c-capacity-full', '容量与长度都为 2。拒绝追加后长度应为多少？', ['0', '1', '2', '3'], 2, '失败不改变有效长度。'),
      check('c-capacity-pointer', 'size_t *length 指向调用方计数，哪个写法增加该计数？', ['length++', '(*length)++', 'sizeof length', 'length = NULL'], 1, '先解引用取得计数对象，再递增。'),
      check('c-capacity-read', '从容量为 10、长度为 3 的数组统计时，最后允许读取的下标是？', ['2', '3', '9', '10'], 0, '三个有效下标为 0、1、2。'),
    ],
  }, exercise('c', String.raw`#include <stdio.h>
#include <stddef.h>

int append(int data[], size_t capacity, size_t *length, int value) {
    /* 在这里补全 */
    return 0;
}

int main(void) {
    int data[2] = {0};
    size_t length = 0;
    for (int value = 8; value <= 10; value++) {
        printf("%d\n", append(data, 2, &length, value));
    }
    printf("%zu: %d %d\n", length, data[0], data[1]);
}`, String.raw`if (*length < capacity) {
        data[*length] = value;
        (*length)++;
        return 1;
    }`, '1\n1\n0\n2: 8 9')),
  lesson({
    id: 'text-files',
    title: '从文本文件读取有效记录',
    summary: '逐行读取短文本，检查字段数与取值，并报告可跳过的坏行。',
    primer: { lead: '读取纸面台账时，先拿到一整行，再辨认其中的编号和读数。', terms: [['FILE *', 'C 标准库用于操作已打开流的指针。'], ['fgets', '把一行或缓冲区能装下的那部分读入字符数组。'], ['strtol', '把开头的十进制文本转成长整数，同时标出转换停在哪里。']] },
    objectives: ['用 fgets 获取一条记录并检查读取结果', '用 strtol 识别缺字段及尾随字符', '坏行不写入，后续好行仍继续读取'],
    sections: [
      sample('先读取，再判断读到了什么', ['真实文本可用 fopen 打开。站内这道练习的固定文本通过 tmpfile 构造同样的 FILE 流。先写入文本，再 rewind 回开头。从头一行一行读取时，fgets 返回有效指针才处理缓冲区。', '练习中的记录行都短于缓冲区，且结尾带换行。实际读取任意文本时，要识别超长行并丢弃剩余部分，不能把下一段当成一条新记录。'], String.raw`#include <stdio.h>
int main(void) {
    FILE *source = tmpfile();
    if (!source) return 1;
    fputs("18\n", source);
    rewind(source);
    char line[64];
    if (fgets(line, sizeof line, source)) printf("%s", line);
    return fclose(source) == 0 ? 0 : 1;
}`, 'C'),
      sample('验证转出的值和未消耗的文本', ['调用 strtol(line, &end, 10) 后，end == line 表示一个数字也没读到。读到 "25x" 时得到 25，但 end 指到 x。要定义清楚允许的尾缀，例如本练习只允许一个换行随后结束。', '转换前可令 errno = 0，随后检查 ERANGE，并在收窄成 int 之前核对项目允许的最小和最大读数。这样很长的数字或超出业务范围的普通数字都会被拒绝。']),
      sample('保留输入行号用于排查', ['行号每读到一行便加一，包括空行和坏行。例子中第一行是 18，第二行无数字，第三行是 23，统计结果应保留两个读数，报错仍指向第 2 行。', '读取循环结束后，ferror 可区分读取失败和正常读完。fclose 在离开前归还流资源。']),
    ],
    pitfalls: [
      { mistake: '用 atoi 将整行变成整数。', why: '例如无效文本和合法的 0 可能无法区分，尾随字符也难检查。', fix: '使用能给出结束指针和错误状态的 strtol。' },
      { mistake: '读取失败后仍处理上一轮缓冲区。', why: '容易把最后一条记录重复统计。', fix: '每次处理前先判断 fgets 的返回值。' },
    ],
    prompt: '补全 parse_reading，读取内置三行文本。只接受 0 到 100 的整数，接受结束换行，并拒绝尾随文字。',
    checkpoints: ['第 1 行 18 和第 3 行 23 均输出读数。', '第二行 20x 标为坏行，仍继续读第三行。'],
    hints: [
      '调用 strtol(line, &end, 10) 前先把 errno 清零，再检查 errno != ERANGE、end != line，以及 value 落在 0 到 100。',
      '行尾校验要允许两种合法结尾：*end == \'\\0\'，或者 *end == \'\\n\' 且 end[1] == \'\\0\'。全部通过后才写 *reading = (int)value 并返回 1。',
    ],
    explanation: '转换后先验证是否消耗了数字，再检查是否到达允许的行尾和读数范围。验证通过才写入输出参数。',
    questions: [
      check('c-file-rewind', '为什么写完 tmpfile 后调用 rewind？', ['让流从开头开始读', '删除临时文件内容', '让读数变成整数', '给行尾补分号'], 0, '写入完成时位置在末尾，rewind 将位置移回开头。'),
      check('c-file-tail', 'strtol 读 “20x” 停在何处？', ['20 之前', 'x', '该行第一个空格', '下一行第一个字符'], 1, '开头合法整数到 20 为止，剩余文本从 x 开始。'),
      check('c-file-eof', '循环中如何确认本轮可以处理缓冲区？', ['确认文件名够短', '检查上一轮有输出', '确认 fgets 返回非空指针', '只检查 line[0]'], 2, '返回非空说明本轮成功读到了字符。'),
      check('c-file-cast', '把 long 收窄为 int 前应做什么？', ['关掉所有编译警告', '转换成字符串再续读', '先累计后校验', '检查溢出和允许值域'], 3, '在收窄前检查可保留原始的错误和范围信息。'),
    ],
  }, exercise('c', String.raw`#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

int parse_reading(const char *line, int *reading) {
    /* 在这里补全 */
    return 0;
}

int main(void) {
    FILE *source = tmpfile();
    if (!source) return 1;
    fputs("18\n20x\n23\n", source);
    rewind(source);
    char line[64];
    int number = 0;
    while (fgets(line, sizeof line, source)) {
        int reading = 0;
        number++;
        if (parse_reading(line, &reading)) printf("%d\n", reading);
        else printf("bad line %d\n", number);
    }
    int failed = ferror(source);
    return fclose(source) != 0 || failed;
}`, String.raw`char *end;
    errno = 0;
    long value = strtol(line, &end, 10);
    if (errno != ERANGE && end != line && value >= 0 && value <= 100 &&
        (*end == '\0' || (*end == '\n' && end[1] == '\0'))) {
        *reading = (int)value;
        return 1;
    }`, '18\nbad line 2\n23')),
  lesson({
    id: 'bitwise-and-frames',
    title: '位运算、传感帧解包与 scanf 衔接',
    demo: 'bitmask-frame',
    summary: '把大一课堂常见的 scanf 习惯平滑衔接到安全行解析，并用移位与位掩码拆解 16 位传感器数据帧。',
    primer: {
      lead: '传感器发来的不是带空格的长文本，而是紧挨在一起的 16 个二进制位。位运算就像一把精准的游标卡尺，把设备号、温度和状态标志各自切出来。',
      terms: [
        ['位掩码（Bitmask）', '用按位与（&）保留需要读取的位、把其余位清零的固定十六进制数，例如 0xFU 保留低 4 位，0xFFU 保留低 8 位。'],
        ['移位运算（>> / <<）', '把二进制位整体右移或左移指定位数。对无符号整数 uint16_t 右移会在左侧补 0，不会受符号位干扰。'],
        ['scanf 换行残留', 'scanf("%d", &x) 读完数字后把后面的换行符留在输入流里，若紧接着用 fgets 可能会先读到空行。先用 fgets 读整行再用 sscanf/strtol 解析最稳妥。'],
      ],
    },
    objectives: [
      '说明 scanf 返回值检查与 fgets + sscanf/strtol 衔接的理由。',
      '用 uint16_t 移位和掩码拆解 16 位传感帧，并用按位或/按位与读写标志位。',
    ],
    sections: [
      sample('先看清 scanf 与 fgets 的衔接点', [
        '很多高校 C 语言入门课先用 scanf("%d %d", &id, &temp) 读键盘数据。scanf 的返回值代表“实际成功匹配并赋值的字段个数”：读取失败或少填一项时，它不会抛异常，而是悄悄返回 0 或 1，同时把没读走的非法字符和换行符留在缓冲区里。',
        '如果后面还要混用 fgets 读整行，scanf 留下的换行符会让下一次 fgets 立刻拿到一个空行。把输入统一改成“先 fgets 读整行，再用 sscanf 检查返回值或用 strtol 检查尾随字符”，既兼容课堂习惯，又彻底消除了换行残留与死循环隐患。',
      ]),
      sample('用无符号位运算精准切开 16 位传感帧', [
        '嵌入式设备常把多份小字段塞进一个 uint16_t（固定 16 位无符号整数，需包含 <stdint.h>）：高 4 位是设备编号 node（0～15），中间 8 位是温度 temp（0～255），低 4 位是状态标志 flags（其中第 0 位 1U << 0 是告警位，第 1 位 1U << 1 是低电量位）。',
        '切取某段字段时，先右移把它对齐到最低位，再用全 1 掩码按位与：node = (frame >> 12) & 0xFU，temp = (frame >> 4) & 0xFFU。反过来把三个字段重新打包成 16 位帧时，把各段先掩码再左移，用按位或（|）拼合。位运算始终使用无符号类型，避免带符号整数左移或右移踩进未定义行为。',
      ], String.raw`#include <stdint.h>
#include <stdio.h>

static uint16_t pack_frame(unsigned node, unsigned temp, unsigned flags) {
    return (uint16_t)(((node & 0xFU) << 12) | ((temp & 0xFFU) << 4) | (flags & 0xFU));
}

int main(void) {
    uint16_t raw = pack_frame(3U, 25U, 0x1U);
    printf("0x%04X\n", raw);
    return 0;
}`, 'C'),
      sample('单独置位、清零与检测某一个标志位', [
        '在传感器与硬件寄存器编程中，经常只改一个标志位而不动其他位：把第 k 位置 1 写成 flags |= (1U << k)；把第 k 位清 0 写成 flags &= ~(1U << k)；判断第 k 位是否为 1 写成 (flags & (1U << k)) != 0。',
        '注意运算符优先级：== 和 != 的优先级高于按位与 &！如果错写成 flags & 1 == 1，编译器会先算 1 == 1。写位判断时始终给 (flags & mask) 加上圆括号。',
      ]),
    ],
    pitfalls: [
      { mistake: '把按位与 & 写成逻辑与 &&，或忘记给 (flags & 1U) 加括号。', why: '&& 只关心非零与否，会把 0x02 && 0x01 误算成 1；漏括号又会受 == 高优先级干扰。', fix: '位掩码判断一律写 (flags & mask) != 0。' },
      { mistake: '用带符号 int 直接移位解包硬件帧，且未检查 sscanf 返回值。', why: '带符号数最高位为 1 时右移可能符号扩展，导致高位全是 1；不查 sscanf 返回值会使用未初始化的旧变量。', fix: '硬件帧使用 uint16_t / unsigned，解析文本始终核对 sscanf 返回值。' },
    ],
    prompt: '补全 unpack_frame，把 16 位传感帧解包到 SensorFrame 结构体（node、temp、alarm、low_bat），再用它解包三组测试帧。',
    checkpoints: ['0x3191 解出 node=3 temp=25 alarm=1 low=0。', '0xF002 解出 node=15 temp=0 alarm=0 low=1，0x0000 全为 0。'],
    hints: [
      '先把 frame 分别右移 12 位与 0xFU 得到 node，右移 4 位与 0xFFU 得到 temp。记住写入结构体指针成员用箭头 ->。',
      'alarm 取 frame & 0x1U（最低位），low_bat 取 (frame >> 1) & 0x1U（次低位）。写完 4 个字段后在 main 里核对三组边界帧。',
    ],
    explanation: '先用移位把目标字段对齐到最低位，再用对应位宽的十六进制掩码清掉无关高位，最后依次写入 out 指向的 SensorFrame 字段。',
    questions: [
      check('c-bit-mask', '对 uint16_t frame = 0x3191U，表达式 (frame >> 4) & 0xFFU 的结果是？', ['0x319', '0x19（十进制 25）', '0x91', '0x03'], 1, '右移 4 位后得到 0x0319，与 0xFFU 按位与只保留低 8 位 0x19，即 25。'),
      check('c-bit-prio', '判断无符号变量 flags 的第 1 位（从 0 计）是否为 1，哪种写法正确且清晰？', ['flags && 2', '(flags & (1U << 1)) != 0', 'flags & 1U == 2', '(flags | 2U) == 0'], 1, '按位与提取第 1 位并用括号包住，再与 0 比较。'),
      check('c-bit-clear', '想只把 flags 的第 0 位清零、保留其它位不变，应该用？', ['flags |= 1U', 'flags &= ~1U', 'flags ^= 1U', 'flags = 0U'], 1, '~1U 把第 0 位变为 0、其余位为 1，按位与后恰好只清掉第 0 位。'),
      check('c-scanf-bridge', '为什么推荐先用 fgets 读整行再交给 sscanf 或 strtol，而不是连续裸用 scanf 与 fgets？', ['fgets 不能读数字', 'scanf 会在缓冲区留下换行符和未消耗的脏字符，容易让后续读取错位', 'sscanf 不需要检查返回值', 'scanf 只能读一位数'], 1, '整行读取把每行边界隔离开，检查 sscanf 返回值或 strtol 结束指针能准确发现残缺与尾随错误。'),
    ],
  }, exercise('c', String.raw`#include <stdint.h>
#include <stdio.h>

typedef struct {
    unsigned node;
    unsigned temp;
    unsigned alarm;
    unsigned low_bat;
} SensorFrame;

static void unpack_frame(uint16_t frame, SensorFrame *out) {
    /* 在这里补全 */
    (void) frame;
    *out = (SensorFrame){0, 0, 0, 0};
}

int main(void) {
    const uint16_t frames[] = {0x3191U, 0xF002U, 0x0000U};
    for (size_t i = 0; i < sizeof frames / sizeof frames[0]; i++) {
        SensorFrame f;
        unpack_frame(frames[i], &f);
        printf("N%u %uC alarm=%u low=%u\n", f.node, f.temp, f.alarm, f.low_bat);
    }
    return 0;
}`, String.raw`out->node = (frame >> 12) & 0xFU;
    out->temp = (frame >> 4) & 0xFFU;
    out->alarm = frame & 0x1U;
    out->low_bat = (frame >> 1) & 0x1U;`, 'N3 25C alarm=1 low=0\nN15 0C alarm=0 low=1\nN0 0C alarm=0 low=0', '/* 在这里补全 */\n    (void) frame;\n    *out = (SensorFrame){0, 0, 0, 0};')),
  lesson({
    id: 'decomposition',
    title: '拆分验证、写入与统计并用断言检查',
    summary: '为台账程序定义函数责任，用正常、失败和空数据覆盖行为。',
    primer: { lead: '一个人检查样本条目，一个人入库，一个人做日报。交接规则写清楚后，可以单独练每一步。', terms: [['函数边界', '约定函数接收的输入、结果和允许修改的状态。'], ['assert', '在调试中检查程序内部应该成立的条件。']] },
    objectives: ['拆开读取、校验、写入和统计', '为失败结果保留已有状态', '用断言覆盖空输入、边界和失败后的状态'],
    sections: [
      sample('让每个函数负责一段变化', ['解析函数把文本变成候选记录。只有通过业务验证的候选才能进入追加函数。统计只读有效记录，因此可以直接用数组测试，无需每次打开文件。', '项目中可让读取函数返回坏行数、让追加函数的调用者解释拒绝原因。报告层就能把有效样本数、坏行数和容量溢出分开打印。']),
      sample('为断言写下预期状态', ['assert 用 <assert.h>，当表达式为假时指出触发处。可先保存原长度，再调用追加并单独断言返回值和当前长度。下面例子成功时只打印 OK。'], String.raw`#include <assert.h>
#include <stdio.h>
int main(void) {
    int data[2] = {4, 7};
    int total = data[0] + data[1];
    assert(total == 11);
    puts("OK");
}`, 'C'),
      sample('输入错误交给普通分支', ['坏行、容量满都是运行中可能发生的状况，应返回明确状态并继续。断言适合表达内部假设，例如有效长度永远不超过容量。', 'C 可用 NDEBUG 关闭断言。因此写入、读取和计数必须在断言之外执行，再把取得的结果放入断言。']),
    ],
    pitfalls: [
      { mistake: '在 assert 中调用并写入记录。', why: '关闭断言后该调用不会发生。', fix: '先调用并保存返回值，再用 assert 验证。' },
      { mistake: '只检查拒绝返回值。', why: '返回失败的函数仍可能误写数据。', fix: '同时检查失败前后的长度和已有值。' },
    ],
    prompt: '补全统计，只读取前 length 项，用主程序中的三个断言检查完整、部分和空数据。',
    checkpoints: ['完整输入得到 60，前两条得到 37。', '长度为 0 得到 0，三组通过后打印 OK。'],
    hints: [
      'total 已经初始化为 0。用 size_t i 从 0 遍历到 i < length，把每个 rows[i] 累加到 total。',
      '当 length 为 0 时循环体不会执行，函数直接返回 0；不要把数组硬编码成 3 项，也不要把计算放进 assert。',
    ],
    explanation: 'sum_readings 只按有效长度读取。主程序先计算结果，再验证整组、前缀与空组分别得到约定的值。',
    questions: [
      check('c-assert-state', '测试拒绝追加时，除了返回值最需要检查什么？', ['已有内容和长度', 'main 名字大小写', '文件系统剩余容量', '头文件排列顺序'], 0, '拒绝追加的契约包括保留已有记录。'),
      check('c-assert-release', '启用 NDEBUG 后，assert(add(...) == 1) 中的 add 可能怎样？', ['自动重试一次', '不执行', '变为异步调用', '只执行半次'], 1, '关闭断言时它的表达式可被省略。'),
      check('c-assert-unexpected', '正常存在的坏行应怎样处理？', ['立即通过 assert 终止', '忽略所有后续行', '标记坏行并继续读取', '用随机数替换该行'], 2, '业务输入错误属于约定路径，应返回状态。'),
      check('c-assert-separation', '统计单元需要哪些输入才能便于独立验证？', ['文件名、错误行和当前光标', '错误字符串', '控制台文本', '有效记录数组和长度'], 3, '提前准备数组就能直接给统计函数送入可控数据。'),
    ],
  }, exercise('c', String.raw`#include <assert.h>
#include <stddef.h>
#include <stdio.h>

int sum_readings(const int rows[], size_t length) {
    int total = 0;
    /* 在这里补全 */
    return total;
}

int main(void) {
    const int rows[] = {18, 19, 23};
    int all = sum_readings(rows, 3);
    int first_two = sum_readings(rows, 2);
    int empty = sum_readings(rows, 0);
    assert(all == 60);
    assert(first_two == 37);
    assert(empty == 0);
    puts("OK");
}`, 'for (size_t i = 0; i < length; i++) total += rows[i];', 'OK')),
]


const readingReport = exercise('c', String.raw`#include <stddef.h>
#include <stdio.h>

static void show_readings(const int readings[], size_t length, int threshold) {
    /* 在这里补全 */
}

int main(void) {
    const int readings[] = {18, 20, 23};
    const int zero[] = {0};
    show_readings(readings, 3, 20);
    show_readings(readings, 3, 24);
    show_readings(readings, 0, 20);
    show_readings(zero, 1, 0);
}`, String.raw`if (length == 0) {
        printf("count=0 average=n/a\n");
        return;
    }
    size_t at_or_above = 0;
    double total = 0;
    for (size_t i = 0; i < length; i++) {
        total += readings[i];
        if (readings[i] >= threshold) at_or_above++;
    }
    printf("count=%zu average=%.1f\n", at_or_above, total / (double) length);`,
'count=2 average=20.3\ncount=0 average=20.3\ncount=0 average=n/a\ncount=1 average=0.0')

const cFoundationProject: CourseProject = {
  title: '实验读数验收程序',
  summary: '给定一组固定读数，报告达到门槛的次数，以及全部有效读数的平均值。',
  requirements: [
    '由主程序提供数组、有效长度和门槛，统计函数只读取有效范围。',
    '读数等于门槛时计入。平均数使用所有有效读数，保留一位小数。',
    '有效长度为 0 时输出计数 0 和 average=n/a。非空时即使没有任何读数达标，也要计算平均值。',
  ],
  examples: [
    { label: '等于门槛也达标', input: '{18, 20, 23}，长度 3，门槛 20', expected: 'count=2 average=20.3' },
    { label: '全部低于门槛', input: '{18, 20, 23}，长度 3，门槛 24', expected: 'count=0 average=20.3' },
    { label: '同一数组的空范围', input: '{18, 20, 23}，长度 0，门槛 20', expected: 'count=0 average=n/a' },
    { label: '有记录且平均值为 0', input: '{0}，长度 1，门槛 0', expected: 'count=1 average=0.0' },
  ],
  exercises: [{ ...readingReport, title: '完成 C 统计函数', downloadName: 'readings-report.c' }],
  explanation: '先处理空范围，避免除以零。遍历时累加全部数值，并按门槛另计次数。用浮点除法得到平均值，用 %.1f 控制显示位数。',
}

const sampleLedger = exercise('c', String.raw`#include <assert.h>
#include <errno.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct { int id; int reading; } Sample;
typedef struct { size_t count; size_t bad; size_t full; } LoadResult;
enum { MAX_SAMPLE_LINE_BYTES = 255 };

/* 读取整行。返回 0 表示结束，-1 表示坏行，1 表示可以解析。 */
static int read_sample_line(FILE *source, char line[MAX_SAMPLE_LINE_BYTES + 2]) {
    size_t length = 0;
    int invalid = 0;
    int byte;
    while ((byte = fgetc(source)) != EOF && byte != '\n') {
        /* 多留一个位置，允许长度正好达上限的行使用 CRLF。 */
        if (byte == '\0' || length == MAX_SAMPLE_LINE_BYTES + 1) {
            invalid = 1;
        } else {
            line[length++] = (char) byte;
        }
    }
    if (byte == EOF && length == 0 && !invalid) return 0;
    if (byte == '\n' && length > 0 && line[length - 1] == '\r') length--;
    line[length] = '\0';
    return invalid || length > MAX_SAMPLE_LINE_BYTES ? -1 : 1;
}

/* 在这里补全 */

static int run_case(const char *text, size_t capacity, LoadResult expected) {
    Sample rows[3];
    assert(capacity <= sizeof rows / sizeof rows[0]);
    FILE *source = tmpfile();
    if (!source) return 0;
    if (fputs(text, source) == EOF) {
        fclose(source);
        return 0;
    }
    rewind(source);
    LoadResult result = load(source, rows, capacity);
    int io_failed = ferror(source);
    int close_status = fclose(source);
    if (io_failed || close_status != 0) return 0;
    assert(result.count == expected.count);
    assert(result.bad == expected.bad);
    assert(result.full == expected.full);
    for (size_t i = 0; i < result.count; i++) {
        printf("%d:%d ", rows[i].id, rows[i].reading);
    }
    printf("| count=%zu bad=%zu full=%zu", result.count, result.bad, result.full);
    if (result.count == 0) puts(" average=n/a");
    else printf(" average=%.1f\n", average(rows, result.count));
    return 1;
}

int main(void) {
    if (!run_case("7 18\n9 20\n12 23\n", 3, (LoadResult){3, 0, 0})) return 1;
    if (!run_case("", 3, (LoadResult){0, 0, 0})) return 1;
    if (!run_case("7 18\n8 101\noops\n9 20\n12 23!\n13 24\n",
                  2, (LoadResult){2, 3, 1})) return 1;
    if (!run_case("1 0\n9999 100", 3, (LoadResult){2, 0, 0})) return 1;
}`, String.raw`static int parse_sample(const char *line, Sample *sample) {
    char *after_id;
    errno = 0;
    long id = strtol(line, &after_id, 10);
    if (errno == ERANGE || id < 1 || id > 9999 ||
        (*after_id != ' ' && *after_id != '\t')) return 0;
    char *after_reading;
    errno = 0;
    long reading = strtol(after_id, &after_reading, 10);
    if (errno == ERANGE || after_reading == after_id || reading < 0 || reading > 100) return 0;
    while (*after_reading == ' ' || *after_reading == '\t' || *after_reading == '\r') {
        after_reading++;
    }
    if (*after_reading != '\0' && *after_reading != '\n') return 0;
    *sample = (Sample){(int) id, (int) reading};
    return 1;
}

static int append_sample(Sample rows[], size_t capacity, size_t *length, Sample sample) {
    if (*length >= capacity) return 0;
    rows[*length] = sample;
    (*length)++;
    return 1;
}

static LoadResult load(FILE *source, Sample rows[], size_t capacity) {
    char line[MAX_SAMPLE_LINE_BYTES + 2];
    LoadResult result = {0, 0, 0};
    int line_status;
    while ((line_status = read_sample_line(source, line)) != 0) {
        Sample sample;
        if (line_status < 0 || !parse_sample(line, &sample)) result.bad++;
        else if (!append_sample(rows, capacity, &result.count, sample)) result.full++;
    }
    return result;
}

static double average(const Sample rows[], size_t count) {
    assert(count > 0);
    double total = 0;
    for (size_t i = 0; i < count; i++) total += rows[i].reading;
    return total / (double) count;
}`, '7:18 9:20 12:23 | count=3 bad=0 full=0 average=20.3\n| count=0 bad=0 full=0 average=n/a\n7:18 9:20 | count=2 bad=3 full=1 average=19.0\n1:0 9999:100 | count=2 bad=0 full=0 average=50.0')

const cAdvancedProject: CourseProject = {
  title: '实验样品台账',
  summary: '从文本录入样本，保留写入顺序，统计坏行与未能入库的有效行。',
  requirements: [
    '每行包含编号和读数两个十进制整数，用空格或制表符分隔。编号范围 1 到 9999，读数范围 0 到 100。空行、缺字段、越界或多余字段计为坏行。',
    '每行最多 255 字节，不计 LF 或 CRLF。末行可以没有换行。含 NUL 字节或超限的行只计一条坏行，后面的行仍继续读取。',
    '用结构体数组保存有效样本，达到容量后仍继续读取。坏行和容量已满导致的有效行分别计数。',
    '依次完成解析、追加、加载计数和平均值，并保留主程序中的断言。模板已用 tmpfile 创建和打开内置文本，读取循环也已写好。',
    '输出入库顺序、有效数量、坏行数、满容量拒绝数和一位小数平均。有效数量为 0 时显示 average=n/a。',
  ],
  examples: [
    { label: '三条有效数据', input: '容量 3\n7 18\n9 20\n12 23', expected: '7:18 9:20 12:23 | count=3 bad=0 full=0 average=20.3' },
    { label: '空文件', input: '容量 3，空文本', expected: '| count=0 bad=0 full=0 average=n/a' },
    { label: '坏行与超容量', input: '容量 2\n7 18\n8 101\noops\n9 20\n12 23!\n13 24', expected: '7:18 9:20 | count=2 bad=3 full=1 average=19.0' },
    { label: '两端边界与无尾换行', input: '容量 3\n1 0\n9999 100', expected: '1:0 9999:100 | count=2 bad=0 full=0 average=50.0' },
  ],
  exercises: [{
    ...sampleLedger,
    title: '加载并统计文本样本',
    checkpoints: [
      '先补 parse_sample。像文本文件章一样先检查 strtol 的结束指针，再用第一个结束指针作为第二次转换的起点。',
      '再补 append_sample。满时保留数据和长度，依次验证 2 条入库、1 条合法但未入库的样例。',
      '在已给的读取循环里分别计数坏行与容量已满，最后补 average。空台账由主程序处理，不调用平均值函数。',
    ],
    starter: sampleLedger.starter.replace('/* 在这里补全 */', String.raw`static int parse_sample(const char *line, Sample *sample) {
    /* TODO 分别读取两项。两个字段都合法时才写 *sample。 */
    return 0;
}

static int append_sample(Sample rows[], size_t capacity, size_t *length, Sample sample) {
    /* TODO 容量足够才写入，并增加有效长度。 */
    return 0;
}

static LoadResult load(FILE *source, Sample rows[], size_t capacity) {
    char line[MAX_SAMPLE_LINE_BYTES + 2];
    LoadResult result = {0, 0, 0};
    int line_status;
    while ((line_status = read_sample_line(source, line)) != 0) {
        /* 行过长或含 NUL 字节时，读取函数已跳到下一行。 */
        if (line_status < 0) {
            result.bad++;
            continue;
        }
        /* TODO 调用 parse_sample 和 append_sample，分类更新 result。 */
    }
    return result;
}

static double average(const Sample rows[], size_t count) {
    /* TODO 遍历有效样本并计算平均值。 */
    return 0;
}`),
    downloadName: 'sample-ledger.c',
  }],
  explanation: '读取函数每次消耗一整行，通过返回值区分文件结束、坏行与可解析的行。解析成功后才尝试追加，格式错误不会占用容量，有效但写不下的记录可以另计。统计函数只遍历已写入的样本。内置文本先写入临时文件，再把位置移回开头交给加载函数。',
}


const javaLessons = [
  lesson({
    id: 'array-list',
    title: '用 ArrayList 保存可增长清单',
    summary: '追加和取回清单中的设备编号，安全地删除一项预约。',
    primer: { lead: '普通数组像印好格数的表格，ArrayList 像能附加新行的登记簿。', terms: [['ArrayList<T>', '可增长的有序列表，T 写明元素类型。'], ['size()', '返回实际已有元素数。'], ['remove', '按位置或按指定元素删除列表中的一项。']] },
    objectives: ['创建带元素类型的 ArrayList', '用 add、get、size 操作列表', '理解删除后下标移动并保留剩余顺序'],
    sections: [
      sample('先写清列表保存什么', ['创建 ArrayList<String> 表示每项都应是字符串。add 将一项追加到末尾，get(0) 获得第一项，size() 告诉我们有几项。对空表仍可以追加。'], `import java.util.ArrayList;
public class Main {
    public static void main(String[] args) {
        ArrayList<String> shelf = new ArrayList<>();
        shelf.add("cam-1");
        shelf.add("mic-2");
        System.out.println(shelf.get(0) + " / " + shelf.size());
    }
}`, 'Java'),
      sample('删除后，后面的下标会前移', ['下标 0 删除后，原下标 1 的元素移动到 0。若按标题删一条，可以使用 remove("cam-1")，返回值表示是否找到并删除。找不到时队列顺序和数量都保持原样。']),
      sample('区分按数字下标与删除数字对象', ['对于 ArrayList<Integer>，remove(1) 会删除下标 1，而 remove(Integer.valueOf(1)) 删除第一个值等于 1 的对象。先想清手上的数字是位置还是设备编号。', '遍历中需要删多项时，可以先建立新的保留列表。这样不会因为删除导致下标移动而跳过元素。']),
    ],
    pitfalls: [
      { mistake: '用 list.length 读取 ArrayList 长度。', why: 'length 是数组的属性。', fix: '对 ArrayList 调用 size()。' },
      { mistake: '把 get(size()) 当最后一项。', why: '下标从 0 开始，size() 已超出范围。', fix: '先确认非空，再使用 size() - 1。' },
    ],
    prompt: '补全 removeFirst。删掉编号第一次出现的位置，返回是否找到。验证有重复项、没有命中和空列表。',
    checkpoints: ['[cam, mic, cam] 删除 cam 后留下 [mic, cam]。', '再次尝试删除缺失编号以及从空列表删除都会返回 false。'],
    hints: [
      'ArrayList<String> 的 remove(Object) 会从左往右找到第一个与 id 相等的元素并删掉，同时返回是否命中。',
      '直接返回 items.remove(id) 就能同时满足删除首次出现、保留后续重复项顺序，以及找不到或空表时返回 false。',
    ],
    explanation: 'String 参数会选择按对象删除的 remove 方法，返回结果已经表明是否命中。后续原有列表元素保持原顺序。',
    questions: [
      check('java-list-size', 'ArrayList 有 3 个元素，最后一个合法下标是什么？', ['0', '2', '3', '4'], 1, '元素的下标从 0 到 size() - 1。'),
      check('java-list-shift', '[A, B, C] 删除下标 0 后，get(0) 读到什么？', ['A', 'C', 'B', 'null'], 2, 'B 向前移动到下标 0。'),
      check('java-list-remove-int', '从 ArrayList<Integer> 删除值等于 1 的一项，哪个写法明确？', ['list.remove(Integer.valueOf(1))', 'list.remove(1)', 'list.get(1)', 'list.clear()'], 0, 'Integer 对象参数选择按对象删除的版本。'),
      check('java-list-absent', '按字符串删除一个不存在的编号，返回什么？', ['true', '被删项的下标', '空字符串', 'false'], 3, '按对象删除返回是否匹配到一项。'),
    ],
  }, exercise('java', `import java.util.ArrayList;
import java.util.List;
public class Main {
    static boolean removeFirst(ArrayList<String> items, String id) {
        /* 在这里补全 */
        return false;
    }

    public static void main(String[] args) {
        ArrayList<String> queue = new ArrayList<>(List.of("cam", "mic", "cam"));
        boolean removed = removeFirst(queue, "cam");
        System.out.println(removed + " " + queue);
        System.out.println(removeFirst(queue, "light") + " " + queue);
        System.out.println(removeFirst(new ArrayList<>(), "cam"));
    }
}`, 'return items.remove(id);', 'true [mic, cam]\nfalse [mic, cam]\nfalse', '/* 在这里补全 */\n        return false;')),
  lesson({
    id: 'map',
    title: '用 Map 按设备编号查找与计数',
    summary: '给每个设备分配唯一编号，并按顺序输出各型号的计数。',
    primer: { lead: '用借用证号查找记录，比对着长名单逐行寻找更直接。', terms: [['Map<K, V>', '用键 K 找到对应的值 V。'], ['put', '写入键值，同名键会替换旧值。'], ['LinkedHashMap', '保留键第一次插入顺序的一种 Map 实现。']] },
    objectives: ['根据编号选择 Map 的键', '用 getOrDefault 完成累计', '按首次出现顺序遍历计数结果'],
    sections: [
      sample('一个键对应一个当前值', ['设备编号是唯一标识，显示名可能重复，因此两个名叫无线麦的设备需要用两个不同 ID 存放。使用 put 写入同编号时旧值会覆写。', '如果题目规定登记不能覆盖现有设备，先用 containsKey 检查。仅用 get == null 时，需要事先约定从不存 null。']),
      sample('陌生的键从零开始计数', ['getOrDefault 会为缺失键交回默认值，但不会创建记录。要计数时写回读取值加 1。这里先插入 mic，再插入 cam，随后更新 mic。'], `import java.util.Map;
import java.util.LinkedHashMap;
public class Main {
    public static void main(String[] args) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String id : new String[]{"mic", "cam", "mic"}) {
            counts.put(id, counts.getOrDefault(id, 0) + 1);
        }
        System.out.println(counts);
    }
}`, 'Java'),
      sample('为报告选定可预测的顺序', ['若规定按首次出现顺序显示，LinkedHashMap 会保持 mic、cam。同一个键更新时也保持原位置。可用 entrySet() 同时获得键和值。', '若要求按次数大小排序，需要把条目另外排列。这里把顺序声明为首次出现，工作台可以检查具体输出。']),
    ],
    pitfalls: [
      { mistake: '用显示名充当唯一编号。', why: '支持同名设备时会覆盖另一条记录。', fix: '按设备编号存记录，把显示名作为记录字段。' },
      { mistake: '直接计算 get(id) + 1。', why: '第一次遇到的键没有现存计数。', fix: 'getOrDefault(id, 0) 后加一并用 put 写回。' },
    ],
    prompt: '完成 count，把同编号的借用记录合计，顺序按第一次出现排列。',
    checkpoints: ['cam、mic、cam 应得到 {cam=2, mic=1}。', '空输入得到 {}；两个 light 累计成 2。'],
    hints: [
      '模板已建好 LinkedHashMap<String, Integer> result，它会自动保持键第一次插入的顺序。',
      '用增强 for 遍历 records 里的每个 id，先用 result.getOrDefault(id, 0) 读出旧次数，加 1 后再 put 写回 result。',
    ],
    explanation: '向 LinkedHashMap 写入每个编号的旧次数加 1。更新值时原来插入的位置保持不变。',
    questions: [
      check('java-map-key', '两台同名设备要分别查找，什么适合做键？', ['显示名', '标签颜色', '唯一设备编号', '借用次数'], 2, '唯一编号可以区分名称相同的两台设备。'),
      check('java-map-default', 'getOrDefault 对缺失键返回 0 后，Map 会多一项吗？', ['一定会', '只有 Map 已有元素才会', '由键类型决定', '不会'], 3, '读取默认值不会写入新条目。'),
      check('java-map-order', '依次 put A、B、再更新 A，LinkedHashMap 的顺序是什么？', ['A、B', 'B、A', '只有 A', '只有 B'], 0, '更新已有键不改变第一次插入顺序。'),
      check('java-map-pair', '遍历时需要同时取键和值，可用什么方法？', ['values()', 'entrySet()', 'getClass()', 'isEmpty()'], 1, 'entrySet() 提供键值条目。'),
    ],
  }, exercise('java', `import java.util.Map;
import java.util.LinkedHashMap;
public class Main {
    static Map<String, Integer> count(String[] records) {
        Map<String, Integer> result = new LinkedHashMap<>();
        /* 在这里补全 */
        return result;
    }

    public static void main(String[] args) {
        System.out.println(count(new String[]{"cam", "mic", "cam"}));
        System.out.println(count(new String[]{}));
        System.out.println(count(new String[]{"light", "light"}));
    }
}`, `for (String id : records) {
            result.put(id, result.getOrDefault(id, 0) + 1);
        }`, '{cam=2, mic=1}\n{}\n{light=2}')),
  lesson({
    id: 'exceptions',
    title: '用异常报告无效请求',
    summary: '区分格式错误和状态冲突，把可预期的异常变成可理解的提示。',
    primer: { lead: '有人填错设备编号时，先退回申请并说明原因，再处理下一张。', terms: [['throw', '主动发出一个异常，结束当前执行路径。'], ['catch', '处理匹配类型的异常。'], ['校验', '开始修改数据前检查输入和状态是否允许。']] },
    objectives: ['捕获明确的转换异常', '用参数异常和状态异常描述不同失败', '保证失败时状态不变并继续处理下一项'],
    sections: [
      sample('转换、范围与状态各有原因', ['Integer.parseInt("7x") 会抛 NumberFormatException。字符串 "0" 能转换成功，但如果业务规定至少 1，校验阶段仍需拒绝。库存为 0 则表示当前状态无法借用。', '使用有意义的错误信息，让调用者能辨认要改输入还是要换设备。']),
      sample('在能恢复的地方捕获', ['逐条读数量时，单条转换失败可以在本轮显示提示，下一轮照常开始。把 try 放到循环内部就能局部恢复。'], `public class Main {
    public static void main(String[] args) {
        for (String text : new String[]{"4", "no", "7"}) {
            try {
                System.out.println(Integer.parseInt(text));
            } catch (NumberFormatException error) {
                System.out.println("invalid number");
            }
        }
    }
}`, 'Java'),
      sample('校验通过之后再改变状态', ['借出数量的计算应先确认数量为正，再确认库存足够。任何一项失败直接抛出对应异常。两项都通过才减少可用库存。', '如果先减库存后校验，调用者虽得到一个错误，账面却已经变了。失败用例在核对提示后还要再核对余额。']),
    ],
    pitfalls: [
      { mistake: 'catch 任何异常并输出成功。', why: '调用者无法看出失败，真实程序错误也会被掩盖。', fix: '捕获当前操作可恢复的异常并给出实际结果。' },
      { mistake: '对库存先写入再校验。', why: '异常不会自动恢复刚改过的字段。', fix: '先检查数量和库存，再计算写入。' },
    ],
    prompt: '完成 borrow，让数量小于 1 的请求抛参数异常，库存不足的请求抛状态异常，成功时返回剩余量。',
    checkpoints: ['库存 3 借 2 后剩余 1。', '再试借 0 和借 2，得到两个不同错误，并两次打印剩余 1。'],
    hints: [
      '先判断参数本身是否合法：quantity < 1 时抛出 new IllegalArgumentException("bad quantity")。',
      '再判断当前库存状态：quantity > stock 时抛出 new IllegalStateException("unavailable")；两关都过才会执行最后的 return stock - quantity。',
    ],
    explanation: '数量无效与库存不足应在线性检查中提前退出。只有成功时调用方才将 borrow 的结果赋给库存。',
    questions: [
      check('java-ex-format', 'parseInt("7x") 对应哪个异常？', ['ArithmeticException', 'NumberFormatException', 'IndexOutOfBoundsException', 'IllegalStateException'], 1, '带尾随字母的文本无法按十进制整数解析。'),
      check('java-ex-state', '数量有效但库存不足，哪种错误更合适？', ['IllegalArgumentException', 'NumberFormatException', 'IllegalStateException', '没有错误'], 2, '该请求的参数有效，但当前库存状态无法执行。'),
      check('java-ex-loop', '希望坏的一条失败后继续下一条，try 通常放在哪里？', ['循环每轮中', '程序结束之后', '全部运行的循环外且无重试', '构造函数声明前'], 0, '处理器结束后，本轮可以结束并进入下一轮。'),
      check('java-ex-mutation', '字段扣减后再抛异常，字段会怎样？', ['恢复旧值', '恢复为 0', '恢复为 null', '保留已经扣减的值'], 3, '普通异常处理不会自动回滚已经执行的赋值。'),
    ],
  }, exercise('java', `public class Main {
    static int borrow(int stock, int quantity) {
        /* 在这里补全 */
        return stock - quantity;
    }

    public static void main(String[] args) {
        int stock = 3;
        for (int quantity : new int[]{2, 0, 2}) {
            try {
                stock = borrow(stock, quantity);
                System.out.println("ok " + stock);
            } catch (IllegalArgumentException | IllegalStateException error) {
                System.out.println(error.getMessage() + " " + stock);
            }
        }
    }
}`, `if (quantity < 1) throw new IllegalArgumentException("bad quantity");
        if (quantity > stock) throw new IllegalStateException("unavailable");`, 'ok 1\nbad quantity 1\nunavailable 1')),
  lesson({
    id: 'model-service',
    title: '划分设备记录与借用服务的职责',
    summary: '让设备对象保存状态，借用服务处理查询、资格检查与修改。',
    primer: { lead: '设备登记卡记载它是谁、当前谁借走了。借用台根据编号找到卡片并执行登记规则。', terms: [['模型', '表示一条业务记录及其状态的类型。'], ['服务', '负责查找记录和执行一个完整业务操作的对象。'], ['封装', '约束哪些代码可以读取或改变对象内部字段。']] },
    objectives: ['用模型保存编号和借用人', '让服务集中处理查找与检查', '通过公开查询验证失败前后借用人一致'],
    sections: [
      sample('分别表示记录和操作流程', ['设备的编号、名称和当前借用人属于设备对象。按编号查找设备、协调可借规则属于服务。这样添加新的入口时可以复用同一个借用规则。', '项目中的设备对象用 null 表示暂未借出。借用人须为非空白字符串，因此不会与空闲状态混淆。']),
      sample('用专用方法表达一次借用', ['先找出设备。若不存在就立即报告未知设备。若找到后发现它已经借给 A，则此次给 B 的请求失败，原借用人 A 保持。主程序负责把结果显示成文本。'], `public class Main {
    static class Equipment {
        final String id;
        String borrower;
        Equipment(String id) { this.id = id; }
        String status() { return borrower == null ? "available" : borrower; }
    }
    public static void main(String[] args) {
        Equipment camera = new Equipment("cam");
        System.out.println(camera.id + "=" + camera.status());
    }
}`, 'Java'),
      sample('用状态查询验证失败路径', ['准备已借状态，重复借出后查询借用人。失败原因被打印只能说明错误分支到达，查询还能证明记录未改变。', '向外返回借用人字符串即可供显示和测试，无需把整个 Map 交出去，调用方也就无法直接改动登记簿。']),
    ],
    pitfalls: [
      { mistake: '主程序绕开服务直接改字段。', why: '资格检查无法得到复用，测试也会绕过真实流程。', fix: '入口调用借用和归还方法，再用公开查询读取状态。' },
      { mistake: '借用失败时清空借用人。', why: '会丢失已有借用关系。', fix: '检查完成后只在成功路径写字段。' },
    ],
    prompt: '补全 Service.borrow。相机先借给 Mei，再尝试借给 Gao，失败后借用人仍是 Mei。',
    checkpoints: ['查询输出 cam=Mei。', '第二次借用打印 already borrowed，接着仍输出 cam=Mei。'],
    hints: [
      '先通过 stock.get(id) 取出 Equipment 对象；如果为 null 或 borrower 为空/纯空白，抛出 IllegalArgumentException。',
      '接着检查 equipment.borrower != null，已借出时抛出 new IllegalStateException("already borrowed")，绝不修改旧借用人；空闲时才写入 borrower。',
    ],
    explanation: '服务从 Map 找到设备，检查是否已借出，再更新设备的 borrower。所有分支共享同一个查询方法显示结果。',
    questions: [
      check('java-service-owner', '在哪个对象最适合保存一台设备当前的借用人？', ['输出日志', '设备模型', '创建 Main 的命令', '设备 ID 字符串自身'], 1, '借用人是该设备的当前状态。'),
      check('java-service-lookup', '根据 ID 找设备并协调借用检查属于什么职责？', ['打印格式化', '编译器', '借用服务', '字符串修剪工具'], 2, '服务负责连接查找、校验与状态变更。'),
      check('java-service-read', '验证重复借用失败后原借用人未变，应该怎么做？', ['失败后查询借用人', '只检查错误文本', '重建设备再核对', '直接清除原记录'], 0, '使用公开查询能看出实际记录是否正确保留。'),
      check('java-service-copy', '只需展示当前借用人时，公开接口应返回什么？', ['可修改的设备表', '全部服务字段', '任意设备的新对象', '该设备的借用人文本'], 3, '显示端只需读该值，不需要获得可修改的内部 Map。'),
    ],
  }, exercise('java', `import java.util.Map;
public class Main {
    static class Equipment {
        String borrower;
    }

    static class Service {
        final Map<String, Equipment> stock = Map.of("cam", new Equipment());

        void borrow(String id, String borrower) {
            /* 在这里补全 */
        }

        String status(String id) {
            Equipment equipment = stock.get(id);
            return id + "=" + equipment.borrower;
        }
    }

    public static void main(String[] args) {
        Service service = new Service();
        service.borrow("cam", "Mei");
        System.out.println(service.status("cam"));
        try {
            service.borrow("cam", "Gao");
        } catch (IllegalStateException error) {
            System.out.println(error.getMessage());
        }
        System.out.println(service.status("cam"));
    }
}`, `Equipment equipment = stock.get(id);
            if (equipment == null) throw new IllegalArgumentException("unknown device");
            if (borrower == null || borrower.isBlank()) throw new IllegalArgumentException("bad borrower");
            if (equipment.borrower != null) throw new IllegalStateException("already borrowed");
            equipment.borrower = borrower;`, 'cam=Mei\nalready borrowed\ncam=Mei')),
]


const roomBookingReport = exercise('java', `public class Main {
    static class RoomBooking {
        private final String room;
        private final int people;

        RoomBooking(String room, int people) {
            if (room == null || room.isBlank()) throw new IllegalArgumentException("invalid room");
            if (people < 1 || people > 12) throw new IllegalArgumentException("invalid people");
            this.room = room.strip();
            this.people = people;
        }

        String summary() { return room + " " + people; }
        int people() { return people; }
    }

    static void summarize(RoomBooking[] bookings) {
        /* 在这里补全 */
    }

    static void checkInvalid(String room, int people) {
        try {
            System.out.println(new RoomBooking(room, people).summary());
        } catch (IllegalArgumentException error) {
            System.out.println(error.getMessage());
        }
    }

    public static void main(String[] args) {
        summarize(new RoomBooking[]{new RoomBooking(" A2 ", 4), new RoomBooking("B1", 7)});
        summarize(new RoomBooking[]{});
        checkInvalid("  ", 7);
        checkInvalid(null, 4);
        checkInvalid("A2", 0);
        checkInvalid("A2", 13);
        summarize(new RoomBooking[]{new RoomBooking("A2", 1), new RoomBooking("B1", 12)});
    }
}`, `int total = 0;
        for (RoomBooking booking : bookings) {
            System.out.println(booking.summary());
            total += booking.people();
        }
        System.out.println("bookings=" + bookings.length + " people=" + total);`,
'A2 4\nB1 7\nbookings=2 people=11\nbookings=0 people=0\ninvalid room\ninvalid room\ninvalid people\ninvalid people\nA2 1\nB1 12\nbookings=2 people=13')

const javaFoundationProject: CourseProject = {
  title: '自习室预约统计',
  summary: '用 RoomBooking 对象表示预约，展示每笔预约并汇总总人数。',
  requirements: [
    '复用模板中的 RoomBooking 类。遍历预约数组，通过 summary() 逐笔显示房间名和人数，并用 people() 累加人数。',
    '类的构造方法去掉房间名两侧的空白，拒绝空白或缺失的房间名。单笔可预约 1 到 12 人，包含两端。保留模板中对这些规则的检查。',
    '最后显示预约笔数和总人数。空数组显示 bookings=0 people=0。',
  ],
  examples: [
    { label: '两笔预约', input: '房间名为 " A2 " 预约 4 人，B1 预约 7 人', expected: 'A2 4\nB1 7\nbookings=2 people=11' },
    { label: '无预约', input: '空数组', expected: 'bookings=0 people=0' },
    { label: '无效房间名', input: '仅空格的房间名或 null', expected: 'invalid room' },
    { label: '单笔人数越界', input: 'A2 分别预约 0 人和 13 人', expected: 'invalid people' },
    { label: '单笔边界均合法', input: 'A2 预约 1 人，B1 预约 12 人', expected: 'A2 1\nB1 12\nbookings=2 people=13' },
  ],
  exercises: [{ ...roomBookingReport, title: '补全预约统计方法', downloadName: 'Main.java' }],
  explanation: '每个 RoomBooking 在构造时校验并保存房间名和人数。汇总方法逐笔调用摘要，并把人数加到局部累计值。空数组的循环执行零次，累计人数仍为 0。',
}

const equipmentLedger = exercise('java', `import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

public class Main {
    private static class Equipment {
        final String id;
        final String name;
        String borrower;

        Equipment(String id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    private static class LendingService {
        private final Map<String, Equipment> equipment = new LinkedHashMap<>();
        private final ArrayList<String> history = new ArrayList<>();

        LendingService(Equipment[] initial) {
            for (Equipment item : initial) equipment.put(item.id, item);
        }

        /* 在这里补全 */

        String snapshot() {
            ArrayList<String> entries = new ArrayList<>();
            for (Equipment item : equipment.values()) {
                entries.add(item.id + "(" + item.name + ")=" +
                    (item.borrower == null ? "available" : item.borrower));
            }
            return entries + " history=" + history;
        }
    }

    private static void attempt(LendingService service, Runnable request) {
        try {
            request.run();
            System.out.println("ok " + service.snapshot());
        } catch (IllegalArgumentException | IllegalStateException error) {
            System.out.println(error.getMessage() + " " + service.snapshot());
        }
    }

    public static void main(String[] args) {
        LendingService service = new LendingService(new Equipment[]{
            new Equipment("cam-1", "Camera"), new Equipment("cam-2", "Camera")
        });
        attempt(service, () -> service.borrow("cam-1", "Mei"));
        attempt(service, () -> service.borrow("cam-1", "Gao"));
        attempt(service, () -> service.borrow("cam-2", " "));
        attempt(service, () -> service.borrow("mic-3", "Mei"));
        attempt(service, () -> service.giveBack("cam-2", "Gao"));
        attempt(service, () -> service.giveBack("cam-1", "Gao"));
        attempt(service, () -> service.giveBack("cam-1", "Mei"));
    }
}`, `private Equipment find(String id) {
            Equipment item = equipment.get(id);
            if (item == null) throw new IllegalArgumentException("unknown device");
            return item;
        }

        void borrow(String id, String borrower) {
            if (borrower == null || borrower.isBlank()) throw new IllegalArgumentException("bad borrower");
            Equipment item = find(id);
            if (item.borrower != null) throw new IllegalStateException("already borrowed");
            item.borrower = borrower;
            history.add("borrow:" + id + ":" + borrower);
        }

        void giveBack(String id, String borrower) {
            if (borrower == null || borrower.isBlank()) throw new IllegalArgumentException("bad borrower");
            Equipment item = find(id);
            if (item.borrower == null) throw new IllegalStateException("not borrowed");
            if (!item.borrower.equals(borrower)) throw new IllegalStateException("wrong borrower");
            item.borrower = null;
            history.add("return:" + id + ":" + borrower);
        }`, [
  'ok [cam-1(Camera)=Mei, cam-2(Camera)=available] history=[borrow:cam-1:Mei]',
  'already borrowed [cam-1(Camera)=Mei, cam-2(Camera)=available] history=[borrow:cam-1:Mei]',
  'bad borrower [cam-1(Camera)=Mei, cam-2(Camera)=available] history=[borrow:cam-1:Mei]',
  'unknown device [cam-1(Camera)=Mei, cam-2(Camera)=available] history=[borrow:cam-1:Mei]',
  'not borrowed [cam-1(Camera)=Mei, cam-2(Camera)=available] history=[borrow:cam-1:Mei]',
  'wrong borrower [cam-1(Camera)=Mei, cam-2(Camera)=available] history=[borrow:cam-1:Mei]',
  'ok [cam-1(Camera)=available, cam-2(Camera)=available] history=[borrow:cam-1:Mei, return:cam-1:Mei]',
].join('\n'))

const javaAdvancedProject: CourseProject = {
  title: '社团器材借还登记',
  summary: '按设备编号借出和归还同名器材，并用历史记录核对每次成功的变化。',
  requirements: [
    '每个编号对应一件器材，库存只可能为 0 或 1。Equipment 模型保存编号、显示名和借用人。服务通过 Map 按编号查找，ArrayList 按发生顺序保存成功操作。',
    '借出时拒绝空白借用人、未知设备和库存不足的设备。器材已经借出时库存为 0。归还时确认设备当前借出且借用人相同。',
    '用明确的参数或状态异常报告失败原因。每次失败后两台设备的状态与历史都保持原样。',
    '只需实现 borrow 和 giveBack。保留预置的 attempt 函数与 main 测试调用，其中的 Runnable 和 () -> 负责交给测试驱动执行。每次操作后会输出设备和历史的快照。',
  ],
  examples: [
    { label: '同名设备按编号借出', input: '借 cam-1 给 Mei，两台设备均名为 Camera', expected: 'cam-1=Mei，cam-2=available，追加 borrow:cam-1:Mei' },
    { label: '空闲设备被归还', input: 'Gao 归还从未借出的 cam-2', expected: 'not borrowed，状态及历史保持原样' },
    { label: '库存不足及归还人不符', input: 'cam-1 借给 Mei 后，Gao 请求借出或归还 cam-1', expected: '库存不足时为 already borrowed，归还人不符时为 wrong borrower。原借用人仍为 Mei，历史不追加。' },
    { label: '输入无效或找不到设备', input: '向空白借用人借 cam-2，或查找不存在的 mic-3', expected: 'bad borrower 或 unknown device，状态及历史保持原样' },
    { label: '有效归还', input: 'Mei 归还自己借用的 cam-1', expected: 'cam-1=available，追加 return:cam-1:Mei' },
  ],
  exercises: [{
    ...equipmentLedger,
    title: '实现借出和归还服务',
    checkpoints: [
      '先实现借出并核对正常借用、未知编号、空白借用人和库存不足。',
      '再实现归还并核对两种拒绝场景，拒绝时设备和操作历史应与此前一致。',
      '模板的 attempt 和 main 是已完成的测试驱动，保留其 Runnable 回调与调用。',
    ],
    starter: equipmentLedger.starter.replace('/* 在这里补全 */', `void borrow(String id, String borrower) {
            // TODO 根据借用规则校验并保存状态。
        }

        void giveBack(String id, String borrower) {
            // TODO 确认当前借用人，再归还并记入历史。
        }`),
    downloadName: 'Main.java',
  }],
  explanation: '模型描述单台器材，借还服务完成查找、规则检查和写入。两台同名设备用独立的编号和模型，借还互不影响。历史只在状态成功改变后追加，快照可以同时验证失败不会改动任何一项。',
}


const algorithmLessons = [
  lesson({
    id: 'recursion',
    title: '给递归设计终止条件和更小问题',
    summary: '用半开区间拆分数组，沿递归调用求每段总和。',
    primer: { lead: '统计一长排座位时，可以请两个人各负责一半，再把答案合起来。分到只剩一项，就直接数。', terms: [['终止条件', '无需继续调用也能直接给出结果的输入。'], ['子问题', '形式相同、规模更小的问题。'], ['半开区间', '左端包含，右端不包含，例如 [0, 3) 含下标 0、1、2。']] },
    objectives: ['区分终止分支与递归分支', '证明每个递归分支都会缩小', '追踪子问题返回值如何合并'],
    sections: [
      sample('先写最小输入的答案', ['空区间的总和为 0。只有一项时直接交回数组值。若少了单项分支，就可能把 [0, 1) 拆成 [0, 0) 和 [0, 1)，右边原样递归。', '加法的合并规则解释了为什么空区间的返回值应为 0。若改成求乘积，空区间对应的单位值应改为 1。']),
      sample('通过中点把范围划为两段', ['假设区间 [0, 5)，中点向下取整为 2，左段 [0, 2) 含 2 项，右段 [2, 5) 含 3 项。中间项只归右段，两个范围没有缺口。', '长度至少为 2 时，中点严格在两端之间，因此每个子问题都更短。写出区间变化可以找出无法停止的调用。']),
      sample('沿返回路径合并答案', ['示例对三项求和。左段返回 4，右段先从单项得到 0 和 7 再返回 7，最外层收到两半后返回 11。'], `function sum(items, left, right) {
  if (right === left) return 0;
  if (right - left === 1) return items[left];
  const middle = Math.floor((left + right) / 2);
  return sum(items, left, middle) + sum(items, middle, right);
}
console.log(sum([4, 0, 7], 0, 3));`, 'JavaScript'),
    ],
    pitfalls: [
      { mistake: '只有空区间终止条件。', why: '一项区间再拆时可能出现相同范围。', fix: '同时处理长度为 1，证明较长时两边都变小。' },
      { mistake: '右半边从 middle + 1 开始。', why: '左半边已排除 middle，跳过它会漏掉数据。', fix: '半开拆分使用 [left, middle) 和 [middle, right)。' },
    ],
    prompt: '完成 sumRange，用递归求半开区间内的和，不改变输入数组。',
    checkpoints: ['[2, 0, 3, 4] 的完整范围为 9，[1, 3) 为 3。', '空范围返回 0，单项 [2, 3) 返回 3。'],
    hints: [
      '先写齐两个终止条件：right <= left 返回 0（模板最后已有 return 0），right - left === 1 时直接返回 values[left]。',
      '当长度大于 1 时，取 middle = Math.floor((left + right) / 2)，递归求左半段 [left, middle) 与右半段 [middle, right) 并相加返回。',
    ],
    explanation: '短区间直接得出答案；更长时从中点拆成两个不重叠子区间，并相加子结果。',
    questions: [
      check('algo-rec-empty', '空半开区间的加法结果是？', ['1', '数组首项', '0', '最后一项'], 2, '从零开始累加，空区间没有任何待加项。'),
      check('algo-rec-split', '[0, 5) 以 2 拆分，哪两个区间覆盖且不重叠？', ['[0, 2) 与 [3, 5)', '[0, 3) 与 [2, 5)', '[0, 1) 与 [1, 2)', '[0, 2) 与 [2, 5)'], 3, '左侧不含 2，右侧从 2 开始。'),
      check('algo-rec-shrink', '长度 1 却仍用取整中点拆分，风险是什么？', ['某一半保持原尺寸', '中点一定在范围之外', '每次调用自动减少一半', '数组自动被排序'], 0, '一半可以为空，而另一半与原范围完全相同。'),
      check('algo-rec-result', '左右分别返回 4、7，加法递归的父调用返回？', ['4', '11', '7', '3'], 1, '父调用把两个不重叠子区间的结果相加。'),
    ],
  }, exercise('javascript', `function sumRange(values, left, right) {
  /* 在这里补全 */
  return 0;
}
const values = [2, 0, 3, 4];
console.log(sumRange(values, 0, 4));
console.log(sumRange(values, 1, 3));
console.log(sumRange(values, 0, 0));
console.log(sumRange(values, 2, 3));`, `if (right - left === 1) return values[left];
  if (right - left > 1) {
    const middle = Math.floor((left + right) / 2);
    return sumRange(values, left, middle) + sumRange(values, middle, right);
  }`, '9\n3\n0\n3')),
  lesson({
    id: 'merge-sort',
    title: '递归排序并稳定地合并',
    summary: '用两个下标合并有序半段，沿用左侧优先保留相同键的先后。',
    primer: { lead: '两列卡片都已从小到大排好。每次比较两列最前的卡，取较小的一张，就能排成一列。', terms: [['归并', '将两组已排序数据合成一组。'], ['稳定', '键相同的记录在排序后保留原先后。']] },
    objectives: ['用两指针合并有序区间', '相同键优先选左段以保持稳定', '把分割、递归排序和归并连接起来'],
    sections: [
      sample('从两个有序半段取最前项', ['左段和右段各维护一个指针。比较两个当前键，将较小者放入结果，再前移对应的指针。某一段耗尽时，另一段的剩余项可以直接追加。', '指针指向各段第一条尚未输出的记录。只要两段有序，剩余项中最小的一定是这两个指针之一。']),
      sample('相同键时先放左段', ['左段来自原数组较早的位置。遇到相同键时先取左段，键相同的记录即使被拆到两边仍保留先后。使用只检查数字的测试，无法区分两个同值记录是否互换。'], `const left = [{ id: "A", key: 2 }];
const right = [{ id: "B", key: 2 }];
const merged = [];
let i = 0;
let j = 0;
while (i < left.length && j < right.length) {
  if (left[i].key <= right[j].key) merged.push(left[i++]);
  else merged.push(right[j++]);
}
while (i < left.length) merged.push(left[i++]);
while (j < right.length) merged.push(right[j++]);
console.log(merged.map(row => row.id).join(","));`, 'JavaScript'),
      sample('从递归的最短段开始排', ['空数组或单项天然有序。将长数组分成左右两段，递归排序完两段，再归并。最外层返回完整有序结果。', '每层归并扫描该层的记录，平衡二分只有约 log₂ n 层，比较次数属于 O(n log n)。下面的练习使输入保留原样，用新数组构造阶段结果。']),
    ],
    pitfalls: [
      { mistake: '相同键优先选右段。', why: '跨段的同键记录可能颠倒。', fix: '比较用 left.key <= right.key 优先左段，并用 ID 验证。' },
      { mistake: '合并循环结束就直接返回。', why: '通常有一段还留有未复制的记录。', fix: '再用两个循环追加剩余项。' },
    ],
    prompt: '完成 merge，和提供的 sort 组成稳定归并排序。输出标识顺序，以方便验同键顺序。',
    checkpoints: ['输入 A:3、B:1、C:3、D:2 得到 B,D,A,C。', '三个同键 ID 顺序不变，空输入返回空列表。'],
    hints: [
      '准备两个下标 a = 0 和 b = 0，只要两段都还没走完就比较 left[a].key 与 right[b].key。为了保持稳定性，相等时优先把左段放进 result（用 <=）。',
      '主循环结束时一定至少有一段走完了，但另一段可能还剩元素。再补两个独立 while 循环，把 left 或 right 剩下的项依次 push 到 result。',
    ],
    explanation: '比较两段未输出的第一项。较小者入结果，相等取左。某段耗尽后，将另一段剩余项继续追加。',
    questions: [
      check('algo-merge-order', '升序左右段都不空时，要先比较什么？', ['两段长度', '两个尚未输出的首项键', '原始数据最后一项', '两段最大项'], 1, '每段有序，其最前项是该段剩余项里的最小项。'),
      check('algo-merge-equal', '键相同而要保持稳定时，跨两段应先取哪边？', ['右边', '任取一边', '左边', '都丢弃'], 2, '左段记录在原输入中早于右段。'),
      check('algo-merge-remainder', '左段耗尽、右段还留三项，接下来怎样？', ['按右段原有顺序追加三项', '丢掉三项', '先反转右段', '递归重排右段'], 0, '右段在开始归并前已排好，余项无需额外比较。'),
      check('algo-merge-test', '要查出两个同键项是否颠倒，应该验证什么？', ['只验证条数', '只验证最后的键', '只验证键的和', '比较同键项各自的标识顺序'], 3, '记录的标识能揭示数值相同但位置发生的变化。'),
    ],
  }, exercise('javascript', `function merge(left, right) {
  const result = [];
  /* 在这里补全 */
  return result;
}
function sort(rows) {
  if (rows.length < 2) return rows.slice();
  const middle = Math.floor(rows.length / 2);
  return merge(sort(rows.slice(0, middle)), sort(rows.slice(middle)));
}
function show(data) {
  const rows = data.map(([id, key]) => ({ id, key }));
  console.log(JSON.stringify(sort(rows).map(row => row.id)));
}
show([["A", 3], ["B", 1], ["C", 3], ["D", 2]]);
show([["A", 5], ["B", 5], ["C", 5]]);
show([]);`, `let a = 0;
  let b = 0;
  while (a < left.length && b < right.length) {
    if (left[a].key <= right[b].key) result.push(left[a++]);
    else result.push(right[b++]);
  }
  while (a < left.length) result.push(left[a++]);
  while (b < right.length) result.push(right[b++]);`, '["B","D","A","C"]\n["A","B","C"]\n[]')),
  lesson({
    id: 'prefix-sums',
    title: '用前缀和回答区间总量',
    summary: '为有序读数准备前缀和，用两个端点的差值求任意区间。',
    primer: { lead: '电表上周一的累计数减去上周五的累计数，就得到这段期间用过的电量。', terms: [['前缀和', 'prefix[i] 是前 i 项的总和。'], ['端点', '用数组下标指定半开区间 [left, right) 的两边。']] },
    objectives: ['建立长度为 n + 1 的前缀表', '用 prefix[right] - prefix[left] 求区间和', '区分空区间与非法区间'],
    sections: [
      sample('前零项的总和放在下标 0', ['给 [3, 0, 5, 2] 建前缀表，先放 0，再依次加每一项，结果为 [0, 3, 3, 8, 10]。原数组有四项，表有五项。', 'prefix[3] 表示已经计入前三项，恰好对应边界 3。离开原数组末尾的边界 4 仍是前缀表中的合法下标。']),
      sample('相减得到两端之间的记录', ['[1, 3) 对应原数据 0、5。前三项的总和为 8，第一项总和为 3，两者相减得到 5。同点 [2, 2) 相减得到 0。'], `const values = [3, 0, 5, 2];
const prefix = [0];
for (const value of values) {
  prefix.push(prefix[prefix.length - 1] + value);
}
console.log(prefix[3] - prefix[1]);
console.log(prefix[2] - prefix[2]);`, 'JavaScript'),
      sample('在读取表之前核对边界', ['合法下标满足 0 ≤ left ≤ right ≤ n，并且两边都是整数。反向区间应报错，不能把前缀差为负当成有效结果。', '若原始数据发生修改，预先计算的后续前缀可能过期。练习中先固定一份数据，然后在同一份表上作多次查询。']),
    ],
    pitfalls: [
      { mistake: '从第一项数值开始建立 prefix。', why: '[0, r) 会漏掉开头或被迫用特殊分支。', fix: '从空前缀 0 开始。' },
      { mistake: '区间越界时依靠得出 NaN 来报告。', why: '无法区分错误边界和其他计算问题，也可能输出误解。', fix: '先检查整数、左右顺序和有效边界。' },
    ],
    prompt: '完成 build 和 total，返回半开区间的合计。非法边界返回 invalid range。',
    checkpoints: ['[1, 3) 得到 5，[0, 4) 得到 10。', '[2, 2) 和空表的 [0, 0) 得到 0，反向区间被拒绝。'],
    hints: [
      'prefix 已经放好了代表前 0 项和的哨兵 0。每读一个 value，就把“prefix 当前最后一项 + value”追加进去。',
      '构建完成后，长度为 n 的 values 会产生长度为 n + 1 的 prefix；total 已帮你校验好边界，直接用 prefix[right] - prefix[left] 就能回答所有合法区间。',
    ],
    explanation: '从零开始累计得到每一个边界的前缀和。查询先校验输入边界，再相减。',
    questions: [
      check('algo-prefix-size', '有 4 个元素的数组需要多长的前缀表？', ['3', '4', '5', '8'], 2, '还包括前零项的总和，因此有 n + 1 项。'),
      check('algo-prefix-range', '[1, 3) 的前缀差如何写？', ['prefix[1] - prefix[3]', 'prefix[3] + prefix[1]', 'prefix[2] - prefix[0]', 'prefix[3] - prefix[1]'], 3, '取到右边界，再扣除左边界以前的元素。'),
      check('algo-prefix-empty', '[2, 2) 在边界合法时得到什么？', ['0', '越界错误', 'values[2]', '所有项的和'], 0, '两个相同前缀相减得到零，表示没有元素。'),
      check('algo-prefix-change', '若已建表的原始数值后来发生改变，需要做什么？', ['继续使用旧表', '重新计算受影响的前缀', '把查询左右互换', '只减去结果最后一位'], 1, '修改会影响该位置之后的前缀累计。'),
    ],
  }, exercise('javascript', `function build(values) {
  const prefix = [0];
  /* 在这里补全 */
  return prefix;
}
function total(prefix, left, right) {
  if (!Number.isInteger(left) || !Number.isInteger(right) ||
      left < 0 || right < left || right >= prefix.length) return "invalid range";
  return prefix[right] - prefix[left];
}
const prefix = build([3, 0, 5, 2]);
console.log(total(prefix, 1, 3));
console.log(total(prefix, 0, 4));
console.log(total(prefix, 2, 2));
console.log(total(prefix, 3, 1));
console.log(total(build([]), 0, 0));`, 'for (const value of values) prefix.push(prefix[prefix.length - 1] + value);', '5\n10\n0\ninvalid range\n0')),
  lesson({
    id: 'operation-counts',
    title: '数清预处理和查询的操作次数',
    summary: '用同一份固定输入对照逐次扫描和提前累计，将构建与查询的成本分开记录。',
    primer: { lead: '每来一张区间查询单就重数一次，和先做一张累计表再查多次，耗费的账要分别算。', terms: [['基本操作', '为了比较算法，事先约定只计数某一种操作。'], ['预处理', '第一次查询前建立可供重复使用的数据。']] },
    objectives: ['选择可重复计数的基本操作', '对同一批查询分开记录构建和查询成本', '同时比较两种方法的实际结果'],
    sections: [
      sample('写明计什么和何时加一', ['本练习把一次加法或减法记为一次。直接扫描每读到一项便向合计加一次，空区间无需加法。前缀表构建对每项加一次，查询时相减一次。', '这个单位用来比较两种算法做了多少累计运算，不能直接推出精确运行时间。若要比较时间索引，项目会另计键比较次数。']),
      sample('用同一批查询做核对', ['数组四项，连续查询 [0, 4)、[1, 3)、[2, 2)。扫描分别做 4、2、0 次加法。做前缀表有 4 次加法，随后共减 3 次。数据和查询相同才可解释差异。'], `const ranges = [[0, 4], [1, 3], [2, 2]];
let scan = 0;
for (const [left, right] of ranges) scan += right - left;
console.log(scan);
console.log(4 + ranges.length);`, 'JavaScript'),
      sample('分阶段解释何时值得预处理', ['这三个查询下，扫描 6 次、前缀表加查询共 7 次。若反复查询较长区间，一次准备的 4 次成本能由多次查询共同承担。', '用表报告构建与查询两列。若只显示查询次数，读者可能忽略首次构建。若两种算法得出不同结果，先核对区间定义和实现。']),
    ],
    pitfalls: [
      { mistake: '扫描计范围内元素，前缀法计整条语句。', why: '不同单位的数字无法直接比较。', fix: '预先固定一次加法或减法作为一次。' },
      { mistake: '只显示最快的一条查询。', why: '预处理是否能抵消成本取决于实际使用次数和查询长度。', fix: '给出整批数据和阶段成本，并同步校验结果。' },
    ],
    prompt: '完成两种区间计算并维护计数器。比较三条查询，再检查单条短查询和空数据。',
    checkpoints: ['同一批的区间和为 10、5、0，扫描共 6 次、构建 4 次、查询 3 次。', '对空数组查询 [0, 0) 结果为 0，扫描和构建没有加法。'],
    hints: [
      '先遍历 values 构建 prefix：每追加一项就把 buildAdds 加 1。空数组时循环不执行，buildAdds 保持 0。',
      '再遍历 ranges 里的每对 [left, right]：直接扫描从 left 到 right - 1 累加并递增 scanAdds，同时用 prefix[right] - prefix[left] 得到前缀法结果并把 querySubtracts 加 1。',
    ],
    explanation: '用相同数组和查询分别得到两套答案，输出相同才可比较。列出扫描加法、前缀构建加法和查询减法。',
    questions: [
      check('algo-cost-unit', '比较两种算法前，首先确定什么？', ['变量名字符数', '终端窗口尺寸', '比较的基本操作', '编辑器主题'], 2, '统一计数单位后结果才可比较。'),
      check('algo-cost-first', '4 项数据准备前缀表需要几次累计加法？', ['0', '1', '3', '4'], 3, '对每个元素从上个前缀加一次。'),
      check('algo-cost-scan', '直接扫描 [2, 2) 做几次累计加法？', ['0', '1', '2', '取决于数组最后一项'], 0, '半开空区间不进入扫描循环。'),
      check('algo-cost-workload', '什么时候预处理更可能划算？', ['只有一条极短查询时', '同一数据上的长区间反复查询时', '数据结构始终为空时', '只比较代码行数时'], 1, '前缀表只建一次，长查询缩成每次一次相减。'),
    ],
  }, exercise('javascript', `function compare(values, ranges) {
  let scanAdds = 0;
  let buildAdds = 0;
  let querySubtracts = 0;
  const scan = [];
  const prefix = [0];
  const indexed = [];
  /* 在这里补全 */
  console.log(JSON.stringify(scan) + " / " + JSON.stringify(indexed));
  console.log(scanAdds + "," + buildAdds + "," + querySubtracts);
}
compare([3, 0, 5, 2], [[0, 4], [1, 3], [2, 2]]);
compare([3, 0, 5, 2], [[0, 1]]);
compare([], [[0, 0]]);`, `for (const value of values) {
    prefix.push(prefix[prefix.length - 1] + value);
    buildAdds++;
  }
  for (const [left, right] of ranges) {
    let total = 0;
    for (let i = left; i < right; i++) {
      total += values[i];
      scanAdds++;
    }
    scan.push(total);
    indexed.push(prefix[right] - prefix[left]);
    querySubtracts++;
  }`, '[10,5,0] / [10,5,0]\n6,4,3\n[3] / [3]\n1,4,1\n[0] / [0]\n0,0,1')),
]


const attendanceDesk = exercise('javascript', `/* 在这里补全 */

const pending = [
  { id: "Q1", target: 4, rows: [
    { id: "A", number: 4 }, { id: "B", number: 4 },
    { id: "C", number: 4 }, { id: "D", number: 1 }, { id: "E", number: 5 },
  ] },
  { id: "Q2", target: 2, rows: [{ id: "F", number: 3 }, { id: "G", number: 1 }] },
  { id: "Q3", target: 1, rows: [] },
  { id: "Q4", target: -1, rows: [{ id: "H", number: 1 }] },
];
for (const line of processJobs(pending)) console.log(line);`, `function stableBubble(rows) {
  const ordered = rows.slice();
  for (let end = ordered.length - 1; end > 0; end--) {
    let moved = false;
    for (let i = 0; i < end; i++) {
      if (ordered[i].number > ordered[i + 1].number) {
        const previous = ordered[i];
        ordered[i] = ordered[i + 1];
        ordered[i + 1] = previous;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return ordered;
}

function firstExact(rows, target) {
  let left = 0;
  let right = rows.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (rows[middle].number < target) left = middle + 1;
    else right = middle;
  }
  return left < rows.length && rows[left].number === target ? left : -1;
}

function processJobs(jobs) {
  const queue = [];
  for (const job of jobs) queue.push(job);
  const report = [];
  while (queue.length > 0) {
    const job = queue.shift();
    if (!Number.isInteger(job.target) || job.target < 0) {
      report.push(job.id + " invalid target");
      continue;
    }
    const ordered = stableBubble(job.rows);
    const orderedIds = ordered.map(row => row.id).join(",");
    report.push(job.id + " [" + orderedIds + "] first=" + firstExact(ordered, job.target));
  }
  return report;
}`, 'Q1 [D,A,B,C,E] first=1\nQ2 [G,F] first=-1\nQ3 [] first=-1\nQ4 invalid target')

const algorithmFoundationProject: CourseProject = {
  title: '活动签到处理台',
  summary: '按请求到达次序处理名单，稳定排序后定位指定签到号的首条记录。',
  requirements: [
    '按进入顺序将请求入队，每次从队首取一项。处理结果按请求顺序输出。',
    '对该请求的名单按签到号升序做稳定冒泡排序。数值相同保留原有记录的标识顺序。',
    '排序后使用二分定位第一个等于目标的位置。输出从 0 开始的下标，缺失和空名单为 -1。目标须为非负整数。',
  ],
  examples: [
    { label: '重复值需查最左', input: 'Q1，签到号 4A、4B、4C、1D、5E，查 4', expected: 'Q1 [D,A,B,C,E] first=1' },
    { label: '不存在的目标', input: 'Q2，签到号 3F、1G，查 2', expected: 'Q2 [G,F] first=-1' },
    { label: '空名单', input: 'Q3，空名单，查 1', expected: 'Q3 [] first=-1' },
    { label: '目标越界', input: 'Q4，签到号 1H，查 -1', expected: 'Q4 invalid target' },
  ],
  exercises: [{
    ...attendanceDesk,
    title: '实现队列、稳定排序与精确查找',
    starter: attendanceDesk.starter.replace('/* 在这里补全 */', `function stableBubble(rows) {
  // TODO 用严格大于判断是否交换，并保留输入。
  return rows.slice();
}

function firstExact(rows, target) {
  // TODO 求目标左边界，再核对相等。
  return -1;
}

function processJobs(jobs) {
  // TODO 建队列并处理每份名单。
  return [];
}`),
    downloadName: 'attendance-desk.js',
  }],
  explanation: '队列决定处理哪份名单，冒泡只改变该份名单的副本。第一组单次检查中间下标会命中 B，继续向左才找到 A；保留标识顺序还可以看到同号记录有没有被调换。',
}

const visitorIndex = exercise('javascript', `function timeKey(time) {
  if (!Array.isArray(time) || time.length !== 3) return null;
  const [day, hour, minute] = time;
  if (!Number.isSafeInteger(day) || day < 1 ||
      !Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const key = (day - 1) * 1440 + hour * 60 + minute;
  return Number.isSafeInteger(key) ? key : null;
}

/* 在这里补全 */

function show(records, ranges) {
  const index = prepare(records);
  const ids = index.ordered.map(row => row.id).join(",");
  console.log("ordered=" + ids + " rejected=" + index.rejected +
    " merge=" + index.mergeComparisons + " prefix=" + index.prefixAdds);
  for (const [start, end] of ranges) {
    const result = report(index, start, end);
    if (typeof result === "string") console.log(result);
    else console.log(result.total + " scan=" + result.scanTotal +
      " search=" + result.searchComparisons + " scanComparisons=" + result.scanComparisons);
  }
}

show(
  [
    { id: "B", time: [2, 8, 0], count: 5 },
    { id: "A", time: [1, 23, 45], count: 4 },
    { id: "C", time: [1, 8, 0], count: 8 },
    { id: "D", time: [2, 8, 0], count: 2 },
    { id: "E", time: [2, 9, 0], count: 3 },
    { id: "X", time: [2, 25, 0], count: 99 },
  ],
  [
    [[1, 23, 45], [2, 9, 0]],
    [[2, 8, 0], [2, 9, 0]],
    [[2, 8, 0], [2, 8, 0]],
    [[2, 9, 0], [2, 8, 0]],
    [[2, 9, 60], [3, 9, 0]],
  ]
);
show([], [[[4, 9, 0], [5, 9, 0]]]);`, `function mergeSort(rows, counts) {
  if (rows.length < 2) return rows.slice();
  const mid = Math.floor(rows.length / 2);
  const left = mergeSort(rows.slice(0, mid), counts);
  const right = mergeSort(rows.slice(mid), counts);
  const ordered = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    counts.mergeComparisons++;
    if (left[i].key <= right[j].key) ordered.push(left[i++]);
    else ordered.push(right[j++]);
  }
  while (i < left.length) ordered.push(left[i++]);
  while (j < right.length) ordered.push(right[j++]);
  return ordered;
}

function prepare(records) {
  const valid = [];
  let rejected = 0;
  for (const row of records) {
    const key = timeKey(row?.time);
    if (key === null || !Number.isInteger(row.count) || row.count < 0 || row.count > 1000000) {
      rejected++;
      continue;
    }
    valid.push({ id: row.id, key, count: row.count });
  }
  const counts = { mergeComparisons: 0 };
  const ordered = mergeSort(valid, counts);
  const prefix = [0];
  let prefixAdds = 0;
  for (const row of ordered) {
    prefix.push(prefix[prefix.length - 1] + row.count);
    prefixAdds++;
  }
  return { valid, ordered, prefix, rejected, ...counts, prefixAdds };
}

function lowerBound(rows, target, counts) {
  let left = 0;
  let right = rows.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    counts.searchComparisons++;
    if (rows[mid].key < target) left = mid + 1;
    else right = mid;
  }
  return left;
}

function report(index, start, end) {
  const left = timeKey(start);
  const right = timeKey(end);
  if (left === null || right === null) return "invalid time";
  if (left > right) return "invalid range";
  const counts = { searchComparisons: 0, scanComparisons: 0 };
  if (left === right) return { total: 0, scanTotal: 0, ...counts };

  const first = lowerBound(index.ordered, left, counts);
  const last = lowerBound(index.ordered, right, counts);
  const total = index.prefix[last] - index.prefix[first];
  let scanTotal = 0;
  for (const row of index.valid) {
    counts.scanComparisons++;
    if (row.key < left) continue;
    counts.scanComparisons++;
    if (row.key < right) scanTotal += row.count;
  }
  return { total, scanTotal, ...counts };
}`, [
  'ordered=C,A,B,D,E rejected=1 merge=6 prefix=5',
  '11 scan=11 search=6 scanComparisons=9',
  '7 scan=7 search=5 scanComparisons=8',
  '0 scan=0 search=0 scanComparisons=0',
  'invalid range',
  'invalid time',
  'ordered= rejected=0 merge=0 prefix=0',
  '0 scan=0 search=0 scanComparisons=0',
].join('\n'))

const algorithmAdvancedProject: CourseProject = {
  title: '校园人流统计',
  summary: '对跨日的访客记录建时间索引，用区间查询核对人次和操作次数。',
  requirements: [
    '记录使用第几天、小时和分钟，天数从 1 开始，小时 0 到 23，分钟 0 到 59。模板提供时间键转换，统一使用同一时间尺度。人次必须是 0 到 1000000 的整数，坏记录计入 rejected。',
    '用递归归并排序整理所有有效记录。同一分钟按原有登记顺序排列，再按排序结果建立前缀和。',
    '用起止时刻各做一次左边界二分，请求左闭右开。起止相同或没有记录为 0，反向区间和无效时刻分别报告错误。',
    '保留直接扫描作为校验。按实际发生的时间键比较记录归并、二分和扫描三种次数，另记录构建前缀的加法次数。同点和非法区间无需搜索。',
  ],
  examples: [
    { label: '跨天且排除右端', input: '从第 1 天 23:45 到第 2 天 09:00', expected: '11 人次；归并顺序 C,A,B,D,E，二分共 6 次，扫描共 9 次比较' },
    { label: '相同时刻的两条记录', input: '从第 2 天 08:00 到第 2 天 09:00', expected: 'B 和 D 共 7 人次，原登记顺序 B 在 D 前；二分 5 次，扫描 8 次比较' },
    { label: '同点与无记录', input: '第 2 天 08:00 到同一时刻；或在空记录上查第 4 天至第 5 天', expected: '都为 0，二分和扫描无需比较' },
    { label: '非法请求与坏记录', input: '起点晚于终点、分钟 60，或收到小时 25 的记录', expected: '分别为 invalid range、invalid time；坏记录单独计数，不计入查询' },
  ],
  exercises: [{
    ...visitorIndex,
    title: '实现时间索引和区间查询',
    starter: visitorIndex.starter.replace('/* 在这里补全 */', `function prepare(records) {
  // TODO 校验记录、归并排序、建立前缀表并累计构建成本。
  return { valid: [], ordered: [], prefix: [0], rejected: 0, mergeComparisons: 0, prefixAdds: 0 };
}

function report(index, start, end) {
  // TODO 比较扫描和两次左边界二分，返回结果和查询成本。
  return { total: 0, scanTotal: 0, searchComparisons: 0, scanComparisons: 0 };
}`),
    downloadName: 'visitor-index.js',
  }],
  explanation: '把日期和时刻换成连续分钟后，间隔跨天也可用同一个比较规则。两个左边界找到开始与结束，前缀差计算开始边界到结束边界以前的合计。用直接扫描校验总量，再比较准备索引和重复查询各做了多少工作。',
}

export const languageTracks: CurriculumTrack[] = [
  { direction: 'c', foundationProject: cFoundationProject, advanced: { lessons: cLessons, project: cAdvancedProject } },
  { direction: 'java', foundationProject: javaFoundationProject, advanced: { lessons: javaLessons, project: javaAdvancedProject } },
  { direction: 'algorithms', foundationProject: algorithmFoundationProject, advanced: { lessons: algorithmLessons, project: algorithmAdvancedProject } },
]

