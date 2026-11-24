import type { AdvancedTrack, CourseProject } from '../types'
import { check, demo, exercise, lesson, step } from './languagesAuthoring'

const cLessons = [
  lesson({
    id: 'memory-ownership',
    title: '为样本缓冲区定义所有权和容量上限',
    summary: '识别负责释放的指针、借用范围和安全的字节数计算。',
    primer: { lead: '库房可以把箱子借给统计员数一遍。箱子仍由库房负责归还，统计员也就只需要知道可用到何时。', terms: [['所有权', '负责让这一块分配的内存在合适时间恰好释放一次。'], ['借用', '在约定的时间内使用别人的内存，使用者无权释放。'], ['SIZE_MAX', 'size_t 能表示的最大整数，可用来检查字节数运算。']] },
    objectives: ['绘制内存所有者和借用者', '区分有效计数、容量和字节数', '乘法前验上限'],
    sections: [
      demo('c', '看清统计函数只借用有效元素', [
        '先用自动变量理解约束。records 在 main 内生存，sum 接收首元素地址和 count，函数返回后就不使用该地址。const 限制通过这个指针写入元素；它是读用合同，释放责任仍由创建者决定。在本例里数组随 main 离开作用域结束，根本不调用 free。',
        'capacity 表示当前实际预留的元素数；count 表示已写入的数据数。下例数组有三格，只前两格是有效记录。把 count 改为 1，和应为 18。不要为了演示逻辑容量就读取未初始化的格子。',
      ], String.raw`#include <stdio.h>
#include <stddef.h>

static int sum(const int rows[], size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; i++) total += rows[i];
    return total;
}

int main(void) {
    const int records[3] = {18, 20};
    printf("%d\n", sum(records, 2));
}`, '38'),
      step('先用除法检查乘法，再决定是否申请',
        '申请样本缓冲区时，分配接口的单位是字节，而程序用元素个数工作。元素宽度取 sizeof *rows，可以在成员变化后保持与实际类型一致。若 element_count * element_bytes 大于 SIZE_MAX，size_t 乘积可能绕回小数字。之后再去循环写 element_count 项，就会越过实际申请范围。',
        '安全的判断是先验证宽度非零，再检查 element_count <= SIZE_MAX / element_bytes。通过才做乘法。给记录定义当次上限时要分清表示范围和业务范围。前者防止算错字节数，后者决定是否愿意处理那么多样本。两者可以同时检查，并用不同提示定位失败。',
        '给申请结果留一个拥有者字段，其余指针用作临时遍历。若以后使用 realloc，成功可能移动内存，原来从数组元素取出的地址便不能继续用。可以用索引描述还需读哪项，在扩容成功之后重新取得元素地址。'),
      demo('c', '动手核对最大值、越界和零元素', [
        '下面的函数按宽度计算最大可表达的元素数，在 limit 附近验证。这里取宽度 4，SIZE_MAX / 4 明显小于 SIZE_MAX，所以 limit + 1 本身也可表示。宽度为 1 时不要再构造 limit + 1。',
        '依次预期通过、超限、零元素有效、宽度无效。把宽度改为 8 并重算 limit，结果顺序不变。进入综合练习时加出参数：无效输入返回失败，同时保持调用方的输出值。',
      ], String.raw`#include <stdint.h>
#include <stdio.h>

static int fits(size_t count, size_t width) {
    return width != 0 && count <= SIZE_MAX / width;
}

int main(void) {
    size_t limit = SIZE_MAX / 4;
    printf("%d\n", fits(limit, 4));
    printf("%d\n", fits(limit + 1, 4));
    printf("%d\n", fits(0, 4));
    printf("%d\n", fits(1, 0));
}`, '1\n0\n1\n0'),
    ],
    pitfalls: [
      { mistake: '先相乘再检查是否超过上限。', why: '乘积已经被截断到 size_t 范围内。', fix: '先除后比，合法后才相乘。' },
      { mistake: '统计代码读取到 capacity。', why: '容量尾端可能尚无有效记录。', fix: '传递有效计数并限制到 [0, count)。' },
    ],
    practice: { prompt: '完成 bytes_for。检查 count 与 width，成功后写入输出字节数。拒绝时保持原输出值。', checkpoints: ['三项各四字节得到 12，零项得到 0。', '宽度 0 和超过可表示上限均保持原输出 99。'], hints: ['先想清返回值和输出参数分别表示什么。', '把宽度为零放在除法之前，第二个条件用 SIZE_MAX / width。'], solution: '两个不合格条件都在写字节数之前结束。安全通过的乘积才交给调用者。' },
    questions: [
      check('cd1-owner', '统计器借用只读记录指针，通常由谁释放这块动态内存？', ['统计函数', '拥有该缓冲区的模块', '每个读过的人各释放一次', '数组索引'], 1, '所有者承诺释放一次，借用者只在约定范围使用。'),
      check('cd1-count', 'count=2、capacity=5，哪个下标范围包含有效数据？', ['[0, 5)', '[2, 5)', '[0, 2)', '[0, 3)'], 2, '逻辑有效范围只包含前 count 项。'),
      check('cd1-overflow', 'width 非零时，哪条式子判断乘积可表示？', ['count <= SIZE_MAX / width', 'count * width <= SIZE_MAX', 'count > width', 'count <= SIZE_MAX - width'], 0, '先除后比不会造成乘积溢出。'),
      check('cd1-borrow', '扩容可能移动数组。原元素地址怎样处理？', ['一直沿用旧地址', '新旧地址同时释放', '保存地址免校验', '按索引从新缓冲区重新取地址'], 3, '移动会使原指针失效，索引仍可用于定位同一元素。'),
    ],
    exercise: exercise('c', String.raw`#include <stdint.h>
#include <stdio.h>

static int bytes_for(size_t count, size_t width, size_t *output) {
    /* 完成校验和写入 */
    return 0;
}

static void show(size_t count, size_t width) {
    size_t bytes = 99;
    int ok = bytes_for(count, width, &bytes);
    printf("%d %zu\n", ok, bytes);
}

int main(void) {
    show(3, 4);
    show(0, 4);
    show(1, 0);
    show(SIZE_MAX / 4 + 1, 4);
}`, '/* 完成校验和写入 */\n    return 0;', String.raw`if (width == 0 || count > SIZE_MAX / width) return 0;
    *output = count * width;
    return 1;`, '1 12\n1 0\n0 99\n0 99', ['正常缓冲区', '零项', '宽度不合法', '乘法会超界']),
  }),
  lesson({
    id: 'safe-allocation',
    title: '安全地申请、扩容与释放',
    demo: 'c-pointer',
    summary: '用临时指针接收 realloc，保持失败时的原数组。',
    primer: { lead: '原柜子装满后，先确认新柜子能接收旧物品，再允许把登记上的柜号换过去。', terms: [['malloc', '申请指定字节数，成功得到首地址，失败返回 NULL。'], ['realloc', '为已有申请改变容量，可能把内容搬到别处。'], ['free', '归还动态内存。释放之后原地址不可再次读取或释放。']] },
    objectives: ['在读写之前确认成功申请', '正确提交 realloc 地址', '避免重复释放与零字节扩容语义'],
    sections: [
      demo('c', '从申请一项到释放一项', [
        '下方把 malloc 的结果存入 int *value。sizeof *value 得到指针指向的元素类型宽度，不会实际去读取未初始化的内存。检查 value 不等于 NULL 之后才能写 *value，随后才可打印刚写入的数据。malloc 只申请空间，不保证新内存初始为零。',
        'value 是这一块内存的所有者。使用完调用 free(value)，再把这个变量置为 NULL，后续清理可以安全地再次调用 free(value)。置空只改了一个变量。若你此前把地址复制到别处，别处的副本仍然失效。',
      ], String.raw`#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *value = malloc(sizeof *value);
    if (value == NULL) return 1;
    *value = 18;
    printf("%d\n", *value);
    free(value);
    value = NULL;
    printf("%d\n", value == NULL);
}`, '18\n1'),
      step('一次扩容有准备和提交两个阶段',
        'realloc(old, positive_bytes) 若成功，返回可用的新地址并保留能容纳的旧内容。新地址可能与旧地址相同，也可能不同。若失败返回 NULL，旧地址和旧内容仍归调用方。把结果直接赋给 old 会在失败时覆盖唯一拥有者地址，导致既不能访问也不能释放之前的块。',
        '用新变量 replacement 接住返回值，先检查是否为 NULL，再更新 old 和 capacity。计数依旧是旧计数，扩出来的格子还没有数据。另有一个特别输入 old == NULL，此时分配正常走首次申请的逻辑。长度为零可单独处理为不扩容，释放使用 free，避免依赖各环境的零字节重分配细节。',
        '辅助函数如果要修改调用者的 int *rows，需要接收 &rows。函数的形参写 int **rows，解引用一次取调用者保存的指针。这与上一章给 size_t *output 写结果一样，只是输出变量本身现在也是指针。'),
      demo('c', '动手检查扩容前后都保有原值', [
        '先写两项，再将预留容量增加到四项。成功后再写第三项，先前的两项还在。把参数 4 改为 2 后，只运行到输出预留空间不足的分支，确保这次不写下标 2。不要把申请规模改得非常大去制造失败，后面的课程会提供可控的失败注入。',
        '如果要将这个程序改成可复用函数，把指针和容量的更新都留在检查 replacement 成功之后。失败时调用者继续持有先前的块，最终统一释放。',
      ], String.raw`#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *rows = malloc(2 * sizeof *rows);
    if (!rows) return 1;
    rows[0] = 18;
    rows[1] = 20;
    size_t desired = 4;
    int *replacement = realloc(rows, desired * sizeof *rows);
    if (!replacement) {
        free(rows);
        return 1;
    }
    rows = replacement;
    if (desired > 2) {
        rows[2] = 23;
        printf("%d %d %d\n", rows[0], rows[1], rows[2]);
    } else {
        printf("no room for row 3\n");
    }
    free(rows);
}`, '18 20 23'),
    ],
    pitfalls: [
      { mistake: '写 rows = realloc(rows, bytes)。', why: '失败时唯一所有者地址会被 NULL 覆盖。', fix: '用局部临时指针保存结果，确认成功再提交。' },
      { mistake: '容量刚扩完便读新的最后一项。', why: '新增区域尚未写入。', fix: '只读旧逻辑长度，主动写入新记录后才增加 count。' },
    ],
    practice: { prompt: '补全 grow，处理无须扩大、拒绝溢出和正常申请，并保留已有的两个读数。', checkpoints: ['初次申请 2 项，再扩到 4 项可保留 18 和 20。', '请求 1 不缩小；不可表示的请求保留容量 4。'], hints: ['先消除无需扩大与字节数非法的情况。', 'replacement 成功后才同时写回 *rows 和 *capacity。'], solution: '由临时指针接住 realloc。其结果可用时，写回给定地址及新容量，否则原缓冲区可继续使用。' },
    questions: [
      check('cd2-null', 'malloc 成功前需要先查什么？', ['数组是否含重复项', '是否到终端', '返回指针是否为 NULL', '变量名字长度'], 2, '只有成功返回的地址可访问。'),
      check('cd2-failure', '正字节数 realloc 返回 NULL 后，原申请是什么状态？', ['仍由原指针拥有', '自动释放了', '全都变成零', '容量自动翻倍'], 0, '失败不会移走或释放原块。'),
      check('cd2-new', '成功扩容后，哪些项可以直接按旧记录读？', ['所有新容量项', '旧逻辑计数范围内已填的项', '只有末尾新增项', '必须整块重写才可读'], 1, '旧内容保留，但新增区域还未初始化。'),
      check('cd2-double', '要改变调用者的 int *rows，传 &rows 对应哪个参数？', ['int rows', 'int *rows', 'size_t rows', 'int **rows'], 3, '参数指向变量 rows，rows 本身是 int 指针。'),
    ],
    exercise: exercise('c', String.raw`#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

static int grow(int **rows, size_t *capacity, size_t desired) {
    /* 实现扩容 */
    return 0;
}

int main(void) {
    int *rows = malloc(2 * sizeof *rows);
    if (!rows) return 1;
    size_t capacity = 2;
    rows[0] = 18;
    rows[1] = 20;
    int ok = grow(&rows, &capacity, 4);
    printf("%d %zu %d %d\n", ok, capacity, rows[0], rows[1]);
    ok = grow(&rows, &capacity, 1);
    printf("%d %zu\n", ok, capacity);
    ok = grow(&rows, &capacity, SIZE_MAX);
    printf("%d %zu\n", ok, capacity);
    free(rows);
}`, '/* 实现扩容 */\n    return 0;', String.raw`if (desired <= *capacity) return 1;
    if (desired > SIZE_MAX / sizeof **rows) return 0;
    int *replacement = realloc(*rows, desired * sizeof **rows);
    if (!replacement) return 0;
    *rows = replacement;
    *capacity = desired;
    return 1;`, '1 4 18 20\n1 4\n0 4', ['扩容保留数据', '已足够', '字节数超限']),
  }),


  lesson({
    id: 'resource-invariants',
    title: '维护资源不变量与失败后的原状态',
    summary: '将校验、预留、写入和释放组织成可检查的操作。',
    primer: { lead: '台账只公布已经写完的记录。预留新空间或校验记录时出错，旧台账仍应照常工作。', terms: [['不变量', '每次公开操作结束时都应成立的关系。'], ['提交', '所有可能的准备失败已处理，才把新状态公开给调用者。'], ['清理', '在退出前释放已拥有的资源并恢复空态。']] },
    objectives: ['为动态台账写出三个状态约束', '把失败路径放在逻辑写入之前', '为反复清理和失败后重试做好准备'],
    sections: [
      demo('c', '给空状态规定可读的表示', [
        '把 owner 指针、count 和 capacity 放进同一个结构体。约定 capacity 为零时 owner 为空，owner 不为空时容量为正，count 总在零到 capacity 之间。为避免遗漏字段，初始化时用 {0} 零初始化整个结构体。C 会把指针初始化为空指针，而不是把它当作普通字节串任意处理。',
        '下面先申请两格但只写入一项，再调用 destroy。free(NULL) 无事可做，销毁后将各字段重置为空。先读输出，再将 destroy 重复调用一次；最后打印的状态应保持 0 0 1。这依赖函数同时重置拥有者地址与计数。',
      ], String.raw`#include <stdio.h>
#include <stdlib.h>

typedef struct { int *rows; size_t count; size_t capacity; } Ledger;

static void destroy(Ledger *ledger) {
    free(ledger->rows);
    ledger->rows = NULL;
    ledger->count = 0;
    ledger->capacity = 0;
}

int main(void) {
    Ledger diary = {0};
    diary.rows = malloc(2 * sizeof *diary.rows);
    if (!diary.rows) return 1;
    diary.capacity = 2;
    diary.rows[diary.count++] = 18;
    printf("%zu %zu\n", diary.count, diary.capacity);
    destroy(&diary);
    printf("%zu %zu %d\n", diary.count, diary.capacity, diary.rows == NULL);
}`, '1 2\n0 0 1'),
      step('先完成两项准备，再修改逻辑记录',
        '对追加画出四步。第一步校验样本编号与读数。第二步检查有效数量还能加一，并在必要时预留容量。第三步向空出来的格子写完整样本。第四步增加 count，让新记录进入可读取范围。前两步会失败，后两步只在准备完成时执行。',
        'C 中 ledger->count 等价于 (*ledger).count。箭头是读写指针所指结构体字段的简写。一个条件只做一件检查，从上到下逐步排除失败。如果记录自身无效，就不要尝试申请新容量。即使申请成功也应先完成写入再增加计数，否则下一个函数可能读到尚未填写的格子。',
        '错误码应能区分操作员要改输入、系统无法分配、或者当前阶段没有空位。对失败用例同时观察返回状态、计数、容量和已有记录。需要释放时从单一拥有者集中清理。若函数把记录视为只读借用，它不负责销毁资源。',
        '例如已有 18 和 20，计数与容量都是 2。若先写 rows[count] 再检查容量，已经写到了数组范围之外。若先递增计数再拒绝非法读数，下一次统计就会读到未初始化的新项。申请失败要保留原来的块，合法重试再从同一份旧数据继续。'),
      demo('c', '动手让拒绝路径保留旧值', [
        '这一小例给的是固定容量，便于单独验证提交顺序。把两条已有读数写下，再运行满时追加，观察第二个值没变。在满之前验证读数，因此即使满了，传负数也会明确表示参数不合法。',
        '将 count 的初值改为 1，追加 23 应成功，输出 1 2 23。再用读数 101 检验失败不会增加 count。正式练习会加入满前追加、满后追加和非法值三次操作。',
      ], String.raw`#include <stdio.h>

static int append(int rows[], size_t capacity, size_t *count, int reading) {
    if (reading < 0 || reading > 100) return -1;
    if (*count >= capacity) return 0;
    rows[*count] = reading;
    (*count)++;
    return 1;
}

int main(void) {
    int rows[] = {18, 20};
    size_t count = 2;
    int result = append(rows, 2, &count, 23);
    printf("%d %zu %d\n", result, count, rows[1]);
}`, '0 2 20'),
    ],
    pitfalls: [
      { mistake: '只用 free，结构体中保留旧指针。', why: '再次销毁可能释放同一块内存两次。', fix: '释放后将地址、计数和容量一并恢复。' },
      { mistake: '失败用例只断言返回值。', why: '已有记录也可能被错误写入。', fix: '同时验证记录、容量和计数。' },
    ],
    practice: { prompt: '完成 add：非法读数返回 invalid，容量用完返回 full，其余返回 ok 并写入。', checkpoints: ['第一次追加写入 20。', '随后数据无效和容量用完均保留两条记录。'], hints: ['把返回字符串作为状态，先决定哪些条件不能提交。', '索引用旧 count，写完才增加 count。'], solution: '先用两个提前返回处理校验与容量。只在正常路径修改元素和逻辑计数。' },
    questions: [
      check('cd3-full', '哪一组状态不合法？', ['count=3，capacity=2', 'count=0，capacity=0', 'count=2，capacity=2', 'count=0，capacity=1'], 0, '有效计数不能超出容量。'),
      check('cd3-arrow', 'ledger->count 等价于哪一种读取？', ['(&ledger).count', '*ledger.count', '(*ledger).count', 'ledger[1].count'], 2, '箭头先解引用，再访问字段。'),
      check('cd3-submit', '追加时何时增加 count？', ['收到参数立即加一', '写完新项后', '乘法计算后', '失败时也增加'], 1, '只有写入结束的新项才算有效。'),
      check('cd3-clean', '销毁后应恢复什么？', ['只清容量', '只清计数', '只清指针', '指针、计数和容量'], 3, '三个字段应一致表示一份空台账。'),
    ],
    exercise: exercise('c', String.raw`#include <stdio.h>

typedef struct { int rows[2]; size_t count; } Ledger;

static const char *add(Ledger *ledger, int reading) {
    /* 实现追加 */
    return "TODO";
}

int main(void) {
    Ledger diary = {{18}, 1};
    const int inputs[] = {20, -1, 23};
    for (size_t i = 0; i < 3; i++) {
        const char *status = add(&diary, inputs[i]);
        printf("%s %zu %d %d\n", status, diary.count, diary.rows[0], diary.rows[1]);
    }
}`, '/* 实现追加 */\n    return "TODO";', String.raw`if (reading < 0 || reading > 100) return "invalid";
    if (ledger->count >= 2) return "full";
    ledger->rows[ledger->count] = reading;
    ledger->count++;
    return "ok";`, 'ok 2 18 20\ninvalid 2 18 20\nfull 2 18 20', ['追加', '校验失败', '容量已满']),
  }),
  lesson({
    id: 'allocation-tests',
    title: '用受控失败注入复现实务故障',
    summary: '在不耗尽系统内存的情况下测试失败、复原与重试。',
    primer: { lead: '要验证停电时还能安全关门，可以用一个受控开关模拟停电，避免真的让整栋楼断电。', terms: [['失败注入', '在一个指定调用处由测试主动制造可预期的失败。'], ['确定性测试', '同一初始状态和调用序列给出相同输出。'], ['回归用例', '用固定输入保护已实现的失败恢复行为。']] },
    objectives: ['注入一次分配失败而不碰旧块', '核对前后状态与已有值', '证明失败之后仍可重试'],
    sections: [
      demo('c', '先做一个只失败一次的开关', [
        '模拟失败时不要发起巨大申请。系统什么时候真的拒绝内存，取决于可用内存和分配策略。用 int fail_next 记录下一次是否应该失败，包装函数收到 1 就清掉旗标并返回 NULL。此时不调用 realloc，原内存完全不动。',
        '下面候选地址第一次为空，第二次分配一项成功。试着把 fail_next 初值改为 0，预期两次都成功。每次得到的内存各自由本次调用释放，free(NULL) 无需特殊分支。正式项目的包装函数也只在扩容实际发生时消耗这个开关。',
      ], String.raw`#include <stdio.h>
#include <stdlib.h>

static void *resize_once(void *old, size_t bytes, int *fail_next) {
    if (*fail_next != 0) {
        *fail_next = 0;
        return NULL;
    }
    return realloc(old, bytes);
}

int main(void) {
    int fail_next = 1;
    for (int attempt = 0; attempt < 2; attempt++) {
        int *rows = resize_once(NULL, sizeof *rows, &fail_next);
        printf("%d\n", rows != NULL);
        free(rows);
    }
}`, '0\n1'),
      step('把快照安排在失败操作之前',
        '建立含两条记录且正好已满的台账。记录当前 count、capacity 和原数据值。启动失败注入后调用真正的追加方法，让它走到扩容失败。如果单独调用注入器，虽然能看到 NULL，却无法证明追加函数的状态处理正确。',
        '失败之后先断言结果，再检查计数、容量、旧值。还可以在失败分支验证指针仍指原块，但只有确知这次失败未释放原块之后才访问它。成功重试可能移动地址，因此在成功路径以内容和状态验证，不比较旧地址。',
        'assert 适合验证测试的假设。在关闭断言的构建中，写进 assert 的表达式可能完全不执行。先执行真实操作并保存状态，再断言状态。最后调用同一个释放函数清理资源，实验可在多个用例间独立运行。',
        '沿着同一个请求写三行期望，注入前是原容量 1 和首项 18，注入失败后仍为 1 和 18，重试成功后为 2 和 18。再测容量足够的请求。此时没有实际分配，故障开关应留给下一次真正需要增长的请求。'),
      demo('c', '动手改变失败发生的时机', [
        '把 fail_next 设为 1，第一次合法请求被拒绝，下一次才真正执行。尝试把第一个请求改为 0，输出应变为 invalid、failed、ok。第一个条件先拦住非法值，因此故障开关留给第二次调用。',
        '用图示把「输入本身无效」「实际发生一次分配失败」和「成功重试」画成不同路径。它们分别需要不同反馈。正式练习的 resize_once 和输入序列已经给出，实现逻辑只需负责内存所有权和失败不提交。',
      ], String.raw`#include <stdio.h>

static const char *attempt(int target, int *fail_next) {
    if (target <= 0) return "invalid";
    if (*fail_next) {
        *fail_next = 0;
        return "failed";
    }
    return "ok";
}

int main(void) {
    int fail_next = 1;
    printf("%s\n", attempt(1, &fail_next));
    printf("%s\n", attempt(4, &fail_next));
    printf("%s\n", attempt(4, &fail_next));
}`, 'failed\nok\nok'),
    ],
    pitfalls: [
      { mistake: '尝试分配巨量内存来触发错误。', why: '结果受环境影响，也会干扰测试电脑。', fix: '由可控包装函数模拟分配失败。' },
      { mistake: '把 grow(...) 放进 assert 里执行。', why: '禁用断言时连真实操作都会消失。', fix: '先执行，再断言返回值与状态。' },
    ],
    practice: { prompt: '补全 grow，先走注入失败，核对旧值，再用同样请求成功重试。', checkpoints: ['失败后容量 1，首项是 18。', '重试容量为 2，首项仍然是 18。'], hints: ['resize_once 已实现一轮受控失败，直接用它代替 realloc。', '处理好无须扩大与字节数溢出，成功后再写回两个输出。'], solution: '包装函数只改变故障注入的入口。使用临时指针检查结果，成功时提交并保留原样本。' },
    questions: [
      check('cd4-host', '为何用失败注入检查内存不足？', ['不再编译 C', '可以省掉清理', '用相同输入复现同一故障', '系统自动检查数据正确'], 2, '故障时机与机器剩余内存无关。'),
      check('cd4-assert', '需要让每次构建都实际执行 grow 时，应该怎样写？', ['先执行 grow 并保存结果，再 assert', '只写 assert(grow(...))', '删除 grow', '把 grow 换成 printf'], 0, '关闭断言时不影响前面的独立调用。'),
      check('cd4-retry', '失败后最值得添加哪个检查？', ['文件名相同', '上一条能读取，并可重试申请', '日志颜色相同', '改大系统内存'], 1, '能读取旧数据并可重试证明系统恢复到了可用状态。'),
      check('cd4-flag', '请求容量已经够用而没有调用包装函数，故障开关应如何？', ['总是清掉', '总是变大', '随机改变', '保持当前状态'], 3, '仅实际触发分配尝试时消耗注入。'),
    ],
    exercise: exercise('c', String.raw`#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

static void *resize_once(void *old, size_t bytes, int *fail_next) {
    if (*fail_next) {
        *fail_next = 0;
        return NULL;
    }
    return realloc(old, bytes);
}

static int grow(int **rows, size_t *capacity, size_t desired, int *fail_next) {
    /* 实现提交与失败保留 */
    return 0;
}

int main(void) {
    int *rows = malloc(sizeof *rows);
    if (!rows) return 1;
    rows[0] = 18;
    size_t capacity = 1;
    int fail_next = 1;
    for (int i = 0; i < 2; i++) {
        int ok = grow(&rows, &capacity, 2, &fail_next);
        printf("%d %zu %d\n", ok, capacity, rows[0]);
    }
    free(rows);
}`, '/* 实现提交与失败保留 */\n    return 0;', String.raw`if (desired <= *capacity) return 1;
    if (desired > SIZE_MAX / sizeof **rows) return 0;
    int *next = resize_once(*rows, desired * sizeof **rows, fail_next);
    if (!next) return 0;
    *rows = next;
    *capacity = desired;
    return 1;`, '0 1 18\n1 2 18', ['注入失败', '成功重试']),
  }),
]

const ledger = exercise('c', String.raw`#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct { int id; int reading; } Sample;
typedef struct { Sample *rows; size_t count; size_t capacity; } Ledger;

static void *resize_once(void *old, size_t bytes, int *fail_next) {
    if (*fail_next) {
        *fail_next = 0;
        return NULL;
    }
    return realloc(old, bytes);
}

/* 待实现的三个函数 */
static int reserve(Ledger *ledger, size_t required, int *fail_next) { return 0; }
static const char *append(Ledger *ledger, Sample sample, int *fail_next) { return "TODO"; }
static void destroy(Ledger *ledger) { /* 释放与清零 */ (void) ledger; }

static void show(const char *label, const Ledger *ledger, const char *status) {
    printf("%s %s count=%zu capacity=%zu", label, status, ledger->count, ledger->capacity);
    if (ledger->count == 0) {
        printf(" average=n/a\n");
        return;
    }
    double total = 0;
    printf(" rows=");
    for (size_t i = 0; i < ledger->count; i++) {
        if (i > 0) printf(",");
        printf("%d:%d", ledger->rows[i].id, ledger->rows[i].reading);
        total += ledger->rows[i].reading;
    }
    printf(" average=%.1f\n", total / (double) ledger->count);
}

int main(void) {
    Ledger ledger = {0};
    int fail_next = 0;
    show("empty", &ledger, "ok");
    show("first", &ledger, append(&ledger, (Sample){7, 18}, &fail_next));
    show("second", &ledger, append(&ledger, (Sample){9, 20}, &fail_next));
    fail_next = 1;
    show("invalid", &ledger, append(&ledger, (Sample){0, 23}, &fail_next));
    show("failed", &ledger, append(&ledger, (Sample){12, 23}, &fail_next));
    show("retry", &ledger, append(&ledger, (Sample){12, 23}, &fail_next));
    destroy(&ledger);
    show("closed", &ledger, "ok");
    destroy(&ledger);
}`, [
  '/* 待实现的三个函数 */',
  'static int reserve(Ledger *ledger, size_t required, int *fail_next) { return 0; }',
  'static const char *append(Ledger *ledger, Sample sample, int *fail_next) { return "TODO"; }',
  'static void destroy(Ledger *ledger) { /* 释放与清零 */ (void) ledger; }',
].join('\n'), String.raw`static int reserve(Ledger *ledger, size_t required, int *fail_next) {
    if (required <= ledger->capacity) return 1;
    const size_t limit = SIZE_MAX / sizeof *ledger->rows;
    if (required > limit) return 0;
    size_t next = ledger->capacity;
    if (next == 0) next = limit < 2 ? limit : 2;
    while (next < required) {
        if (next > limit / 2) next = limit;
        else next *= 2;
    }
    Sample *replacement = resize_once(ledger->rows, next * sizeof *ledger->rows, fail_next);
    if (!replacement) return 0;
    ledger->rows = replacement;
    ledger->capacity = next;
    return 1;
}

static const char *append(Ledger *ledger, Sample sample, int *fail_next) {
    if (sample.id < 1 || sample.id > 9999 || sample.reading < 0 || sample.reading > 100) {
        return "bad sample";
    }
    if (ledger->count == SIZE_MAX || !reserve(ledger, ledger->count + 1, fail_next)) return "no memory";
    ledger->rows[ledger->count] = sample;
    ledger->count++;
    return "ok";
}

static void destroy(Ledger *ledger) {
    free(ledger->rows);
    ledger->rows = NULL;
    ledger->count = 0;
    ledger->capacity = 0;
}`, [
  'empty ok count=0 capacity=0 average=n/a',
  'first ok count=1 capacity=2 rows=7:18 average=18.0',
  'second ok count=2 capacity=2 rows=7:18,9:20 average=19.0',
  'invalid bad sample count=2 capacity=2 rows=7:18,9:20 average=19.0',
  'failed no memory count=2 capacity=2 rows=7:18,9:20 average=19.0',
  'retry ok count=3 capacity=4 rows=7:18,9:20,12:23 average=20.3',
  'closed ok count=0 capacity=0 average=n/a',
].join('\n'), ['新建空台账', '首次预留', '容量边界', '无效记录', '注入失败', '重试成功', '释放后空态'])

const project: CourseProject = {
  title: '可增长的样品台账',
  summary: '从空缓冲区开始增长，保证失败后记录可读并且可以重试。',
  requirements: [
    '实现 reserve、append 和 destroy。每条记录需有 1 到 9999 的编号，读数为 0 到 100。样本按输入顺序保存。',
    '新缓冲区优先预留 2 项，之后按需要翻倍。检查乘法与增长上限，realloc 结果先交给临时指针。',
    '输入不合法或预留失败时保留旧记录与容量。非法记录发生在申请之前，不消耗故障开关。',
    '释放后恢复空状态。程序中重试与打印驱动已给，不读用户文件。',
  ],
  examples: [
    { label: '正常记录与扩大', input: '依次追加 (7,18)、(9,20)、(12,23)', expected: '3 条，容量 4，平均值 20.3，保留写入顺序' },
    { label: '空状态与销毁', input: '刚创建，或连续两次销毁', expected: '计数 0，容量 0，平均值 n/a' },
    { label: '参数非法且不消耗故障', input: '台账已满并开启故障开关，提交编号 0', expected: 'bad sample，原有两条不变，后续真实申请才触发故障' },
    { label: '失败后可重试', input: '第二项已写满，注入故障后追加合法第三项两次', expected: '先 no memory 并保留旧两条，再成功达到 3 条、容量 4' },
  ],
  exercises: [{ ...ledger, title: '实现动态样本台账', downloadName: 'sample-ledger-dynamic.c' }],
  explanation: 'reserve 处理表示范围和容量并将分配结果提交。append 只有通过业务校验与预留才发布新记录。每次拒绝之后打印完整快照，可直接观察旧状态是否保留。',
}

export const advancedC: AdvancedTrack = { direction: 'c', lessons: cLessons, project }

