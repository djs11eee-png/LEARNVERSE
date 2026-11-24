import type { CourseExpansions } from '../lessonExpansion'

export const languageExpansions: CourseExpansions = {
  'lv-c-foundations': {
    'first-program': {
      objectives: ['区分源文件、目标文件、可执行程序和运行输出。', '从诊断判断问题出在编译、链接还是运行阶段。', '用格式字符串控制输出并按预期逐行核对。'],
      sections: [
        {
          heading: '从源文件追踪到可执行文件',
          paragraphs: [
            '预处理器先处理 #include 等指令。编译与汇编阶段把处理后的 C 代码转换成目标文件。链接器再组合目标文件与所需库，生成操作系统可以启动的程序。头文件提供声明，例如 printf 接收什么参数，库提供声明所对应的实现。',
            '先用本机实验室运行下方完整程序，核对输出两行。若想观察编译和链接分步产生的文件，可在有 GCC 的终端将它保存为 receipt.c，依次执行 gcc -std=c17 -Wall -Wextra -pedantic -c receipt.c -o receipt.o 与 gcc receipt.o -o receipt.exe，再在 PowerShell 用 .\\receipt.exe 运行。',
          ],
          codeLanguage: 'C · 完整程序 receipt.c',
          run: { language: 'c', expectedOutput: 'Notebook\nCopies: 3', downloadName: 'receipt.c' },
          code: String.raw`#include <stdio.h>

int main(void) {
    printf("Notebook\n");
    printf("Copies: %d\n", 3);
    return 0;
}`,
        },
        {
          heading: '逐项解释格式字符串',
          paragraphs: [
            '程序先输出 Notebook，再换行并输出 Copies: 3。第二条 printf 调用读到 %d 时，消费后续提供的 int 值 3，并把它格式化为十进制文本。格式中的普通字符照写。要在格式字符串里输出一个百分号，需要写成 %%。',
            '输出与退出状态有各自的用途。printf 把数据写到标准输出，return 0 把成功状态交给启动程序的环境。PowerShell 在运行后可以用 $LASTEXITCODE 查看这个状态。成功状态仍需配合预期输出检查，例如这份收据的第二行必须恰好有一个数值。',
          ],
        },
        {
          heading: '按失败阶段排查',
          paragraphs: [
            '如果删掉第一条 printf 后的分号，编译器可能在下一条语句附近报错。诊断中的行号表示发现问题的位置，检查该行同时查看前一行是否缺少结束符。优先修复第一条诊断，再重新编译，以免被后续连带诊断误导。',
            '如果只声明一个自定义函数，调用它却从未提供实现，目标文件可能生成，链接时才出现未定义引用。若编译与链接都成功但屏幕上的内容仍有误，定位产生那一行的调用。改源代码后先重新构建，再核对运行的文件路径，以免观察到上一次生成的结果。',
          ],
        },
        {
          heading: '用注释和布局标明程序结构',
          paragraphs: [
            '在 C17 中，可以用 // 写到该行末尾的注释，也可以用 /* 和 */ 包住一段文字。缩进主要帮助阅读，花括号才决定哪些语句属于同一块。把两条 printf 各放一行，能直接看出有两次输出。调试时在构建后先确认标题，再核对数字，有助于把总问题拆成两次具体检查。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '编辑源文件后直接启动旧程序。', why: '可执行文件保存的是上一次成功构建的结果。', fix: '构建成功后再启动输出路径对应的文件。' },
        { mistake: '用一个 % 输出百分号。', why: 'printf 将格式字符串中的百分号当作转换说明的开头。', fix: '在格式字符串中写 %%，例如 printf("%d%%\\n", 75)。' },
      ],
      practice: {
        prompt: '写一张两行的应用状态卡。第一行输出 Lab report，第二行输出 Progress: 75%。进度数字应由 printf 的整数占位符生成。',
        checkpoints: ['编译时开启 -Wall -Wextra。', '核对两个换行以及第二行末尾唯一的百分号。', '将代码中的 75 改为 0 或 100，重新构建，确认相同行保留百分号。'],
        solution: '第一条调用输出标题。第二条调用中 %d 消费实参 75，%% 直接生成百分号。两条调用各写一次换行，最后以成功状态退出。',
        codeLanguage: 'C · 完整程序 report.c',
        code: String.raw`#include <stdio.h>

int main(void) {
    printf("Lab report\n");
    printf("Progress: %d%%\n", 75);
    return 0;
}`,
      },
      questions: [
        { id: 'c-object-file', prompt: '使用 gcc -c receipt.c -o receipt.o 后，下一步需要做什么才能得到可启动的程序？', choices: ['把 .o 直接改名为 .exe', '链接目标文件', '再次启动源文件', '在代码中多写一条输出'], answer: 1, explanation: '-c 让 GCC 生成目标文件并跳过链接。需要链接阶段生成可执行程序。' },
        { id: 'c-percent-format', prompt: '哪一项恰好输出 30% 后换行？', choices: ['printf("30\\n");', 'printf("%%\\n");', 'printf("%d%%\\n", 30);', 'printf("%d\\n", 30);'], answer: 2, explanation: '%d 根据实参生成 30，%% 生成字面百分号，随后是换行。' },
      ],
    },
    'values-and-operators': {
      objectives: ['按商和余数拆分非负整数，并推导负整数取余的符号。', '在运算前选择整数或浮点类型。', '选择与数据范围匹配的存储类型和 printf 转换说明。'],
      sections: [
        {
          heading: '从秒数推导小时、分钟和秒',
          paragraphs: [
            '把 3 725 秒拆开时，先除以 3 600 得到完整小时数 1，再取余得到还没分配的 125 秒。125 除以 60 得到分钟数 2，再取余得到秒数 5。反算 1 × 3 600 + 2 × 60 + 5 等于原值。整除时余数为 0，因此 3 600 秒拆为 1 小时、0 分钟、0 秒。示例用 %02d 为不足两位的分钟和秒在左侧补零，最终显示 1:02:05。',
            '这里的数据约定为非负整数。若业务支持负数，需要另外定义如何显示。C 中 -7 / 3 是 -2，-7 % 3 是 -1，因为整数商向零截断，且 -2 × 3 + (-1) = -7。做循环编号时如果需要 0 到 2 内的值，可以先求 r = x % 3，再在 r < 0 时加 3。',
          ],
          codeLanguage: 'C · 完整程序 clock_parts.c',
          code: String.raw`#include <stdio.h>

int main(void) {
    int seconds = 3725;
    int rest = seconds % 3600;
    printf("%d:%02d:%02d\n", seconds / 3600, rest / 60, rest % 60);
    return 0;
}`,
        },
        {
          heading: '转换时机决定损失的小数能否保留',
          paragraphs: [
            '平均值需要小数时，让除法本身产生浮点结果。示例中 (double) total / count 先把 7 转为 7.0，再用浮点除法得到 3.5。表达式 (double) (total / count) 先得到整数 3，后续转换只能得到 3.0。两种写法分别打印 3.5 和 3.0。',
            '用 %.1f 控制显示为一位小数。显示的位数属于输出格式。内部计算仍使用 double 值，后续求和时应保留该值。记录数可能为零时，在除法前处理空数据，区分无记录和平均值确实为零。',
          ],
          codeLanguage: 'C · 放在含 <stdio.h> 的 main 内',
          code: String.raw`int total = 7;
int count = 2;
printf("%.1f\n", (double) total / count);
printf("%.1f\n", (double) (total / count));`,
        },
        {
          heading: '确定运算范围，再选择类型',
          paragraphs: [
            '用 <limits.h> 中的 INT_MIN 与 INT_MAX 查询 int 的边界。带符号整数运算超出范围时会产生未定义行为。比如每批 50 000 件、共 50 000 批，乘积是 2 500 000 000。即使目标变量是 long long，如果两个操作数都是 int，乘法仍先以 int 进行。',
            '示例可直接写成 50000LL * 50000，LL 后缀使其中一个操作数是 long long，另一个也按规则转换后参与乘法。输出 long long 时用 %lld。若乘积本来可能超出 long long 的范围，则在相乘前仍需检查范围。',
          ],
        },
        {
          heading: '用括号和单位解释表达式',
          paragraphs: [
            '已知上午 19 分钟、下午 26 分钟，计算两次的平均分钟数时，写 (19 + 26) / 2.0 得到 22.5。省略括号会先计算 26 / 2.0，再加 19，得到 32.0。可以把和存进 total_minutes 再除以 session_count，变量名说明相除的两项是什么。',
            '计算前把两个量统一到同一单位。比如已有 minutes = 2 与 seconds = 30，要计算总秒数，应先算 minutes * 60 再加 seconds。用 0 分 30 秒和 2 分 0 秒分别验证两个输入都参与了结果。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '把小数除法结果声明成 double 就认为已经改变除法。', why: '赋值前，右侧整数除法已经完成。', fix: '先把一个操作数转换成 double，再相除。' },
        { mistake: '把 % 当作百分比运算。', why: '在 C 表达式中，% 计算整除后剩下的量。', fix: '百分比可用 100.0 * part / total，并在分母为 0 时单独处理。' },
        { mistake: '提前用 int 相乘，再赋给大类型。', why: '接收变量的类型只影响赋值，右侧乘积可能先溢出。', fix: '根据数据范围选择操作数类型，例如用 50000LL 参与运算。' },
      ],
      practice: {
        prompt: '每盒可装 12 支铅笔。给定非负整数数量，输出装满的盒数和剩余支数，另输出展示用的平均量「每盒容量的倍数」，保留一位小数。用 29、24 和 0 分别测试。',
        checkpoints: ['29 支为 2 满盒、余 5 支，比值 2.4。', '24 支为 2 满盒、余 0 支，比值 2.0。', '0 支为 0 满盒、余 0 支，比值 0.0。'],
        solution: '除以容量得到完整盒数，对容量取余得到未装进满盒的支数。第三个结果需要真实比值，用 double 参与除法。容量固定为正整数 12。',
        codeLanguage: 'C · 完整程序 pencil_boxes.c',
        code: String.raw`#include <stdio.h>

int main(void) {
    int pencils = 29;
    const int capacity = 12;
    printf("%d %d %.1f\n", pencils / capacity, pencils % capacity,
           (double) pencils / capacity);
    return 0;
}`,
      },
      questions: [
        { id: 'c-negative-remainder', prompt: '在 C17 中，表达式 -10 % 4 的值是多少？', choices: ['2', '-2', '-4', '0'], answer: 1, explanation: '-10 / 4 向零截断得到 -2，因此余数是 -10 - (-2 × 4) = -2。' },
        { id: 'c-cast-timing', prompt: 'total 和 count 分别是 int 值 5 和 2。哪个表达式得到 2.5？', choices: ['(double) (total / count)', 'total / count', '(double) total / count', '(double) (total % count)'], answer: 2, explanation: '先转换一个操作数，除法本身才能使用 double。' },
      ],
    },
    'control-flow': {
      objectives: ['跟踪互斥分支顺序，选取边界和边界两旁的测试值。', '用短路逻辑保护需要前置条件的计算。', '手工跟踪 while、continue 和 break 对状态变量的影响。'],
      sections: [
        {
          heading: '把区间按顺序写成互斥路径',
          paragraphs: [
            '设计候车人数标记时，负数表示输入有误，0 至 9 人显示流畅，10 至 19 人显示繁忙，20 人及以上显示拥挤。写成 people < 0、people < 10、people < 20 和 else。走到第三个判断时，前两个条件均已失败，所以这里的人数已经至少为 10。',
            '用 -1、0、9、10、19、20 走一遍，确认相邻区间既没有空隙，也不会输出两次。若颠倒 people < 10 和 people < 20，人数为 8 会在更宽的分支先被接收。一个相同单位的数量应只对比写明含义的阈值。',
          ],
        },
        {
          heading: '短路逻辑保护后续计算',
          paragraphs: [
            'C 把 0 当作假，非 0 当作真。逻辑 && 先计算左边，只有左边为真才计算右边。因此 slots > 0 && waiting / slots >= 2 可以先确认插槽数为正，再进行整除。若 slots 为 0，整段条件为假，右边的除法没有被求值。',
            '在 slots 等于 3、waiting 等于 7 时，7 / 3 得 2，整个条件成立。交换两个子条件会失去这层保护。逻辑 || 在左边为真时跳过右边，适合表达 count < 0 || count > limit 一类的区间校验。',
          ],
        },
        {
          heading: '用 while 跟踪循环退出时的状态',
          paragraphs: [
            '将下面的完整程序保存为 countdown.c，构建后运行。开始时 remaining 为 8，循环先把它减 1 再判断。遇到 7 时累加，遇到 6 和 4 时由 continue 跳过，遇到 2 时先满足 break 立即退出。真正加入的值依次是 7、5、3，输出 15。',
            '跟踪循环可以为每轮记录进入时的值、更新后的值和是否计入结果。写 while 时，特别检查 continue 路径仍会推动状态到终止条件。本例更新发生在 continue 之前，即使跳过偶数也会继续往下数。用 for 能把更新表达式集中在循环头，适合已知上下界的计数任务。',
          ],
          codeLanguage: 'C · 完整程序 countdown.c',
          code: String.raw`#include <stdio.h>

int main(void) {
    int remaining = 8;
    int total = 0;
    while (remaining > 0) {
        --remaining;
        if (remaining == 2) {
            break;
        }
        if (remaining % 2 == 0) {
            continue;
        }
        total += remaining;
    }
    printf("%d\n", total);
    return 0;
}`,
        },
        {
          heading: '明确选项型分支的落点',
          paragraphs: [
            '若菜单编号只有 1、2 和其它输入，可以用 switch (choice) 把 case 1 与 case 2 各写成一段，分别处理查询和退出，default 负责提示未知选项。每个处理段末尾加 break，使执行结束后直接离开 switch。省略它时，程序会继续执行后面的语句，可能把查询也当成退出。此处 break 离开的是 switch。若还在外层菜单循环内，需要另用循环条件决定是否开始下一轮。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '用 if (level = 2) 检查等级。', why: '赋值表达式会把 level 改为 2，表达式结果非零，分支成立。', fix: '写 if (level == 2)，并开启编译警告检查可疑赋值。' },
        { mistake: '将 while 的递增放在可能执行 continue 的路径后面。', why: '跳过这个更新后，同一个值可能反复触发 continue。', fix: '把更新移到所有路径都能执行的位置，或使用把更新写在循环头的 for。' },
      ],
      practice: {
        prompt: '对 1 到 limit（含 limit）的整数计数，找出能被 3 或 5 整除的数量。15 只能计一次。limit 为 0 时结果为 0。本题 limit 限定为 0 到 100。',
        checkpoints: ['limit 为 5 时，符合的值是 3、5，共 2 个。', 'limit 为 15 时，符合的值是 3、5、6、9、10、12、15，共 7 个。', 'limit 为 0 时，循环体执行 0 次。'],
        solution: '用一个包含两个整除条件的 || 表达式作为分支。每轮只执行一次加一，两个条件同时成立的 15 自然只加一次。循环用 <= 包含上界。',
        codeLanguage: 'C · 完整程序 multiples.c',
        code: String.raw`#include <stdio.h>

int main(void) {
    int limit = 15;
    int count = 0;
    for (int i = 1; i <= limit; ++i) {
        if (i % 3 == 0 || i % 5 == 0) {
            ++count;
        }
    }
    printf("%d\n", count);
    return 0;
}`,
      },
      questions: [
        { id: 'c-guard-division', prompt: '哪个条件把 slots 为 0 的情况挡在除法之外？', choices: ['waiting / slots >= 2 && slots > 0', 'slots == 0 && waiting / slots >= 2', 'slots != 0 || waiting / slots >= 2', 'slots > 0 && waiting / slots >= 2'], answer: 3, explanation: '当 slots 为 0 时，左边为假，&& 跳过右边的除法。' },
        { id: 'c-inclusive-multiples', prompt: '把练习中的 limit 改为 6，程序输出什么？', choices: ['0', '2', '3', '6'], answer: 2, explanation: '范围包含 6，满足条件的数是 3、5 和 6。' },
      ],
    },
    'functions-and-arrays': {
      objectives: ['区分值参数和指针参数，判断函数是否修改调用方对象。', '把数组与有效元素数传给函数。', '区分数组容量、元素数和以空字符结尾的字符串长度。'],
      sections: [
        {
          heading: '按值传参也可以传入一个地址',
          paragraphs: [
            '函数参数接收实参的值。把 int 变量读到参数中后，给参数重新赋值只会更新函数自己的变量。如果传入的是 &score，参数得到 score 的地址。指针参数虽然仍按值传递，函数可经由这个地址访问原变量，*value = 9 会把调用方的 score 改为 9。',
            '声明 int *value 表示 value 指向 int，表达式 *value 表示读取或写入它指向的对象。下面的完整程序先输出计算结果 8，再输出原值 4，最后输出指针写入后的值 9。reset 的参数约定是传入一个有效 int 对象的地址，函数调用期间该对象始终存在。',
          ],
          codeLanguage: 'C · 完整程序 update_value.c',
          run: { language: 'c', expectedOutput: '8\n4\n9', downloadName: 'update_value.c' },
          code: String.raw`#include <stdio.h>

static int doubled(int value) {
    return value * 2;
}

static void reset(int *value) {
    *value = 9;
}

int main(void) {
    int score = 4;
    printf("%d\n", doubled(score));
    printf("%d\n", score);
    reset(&score);
    printf("%d\n", score);
    return 0;
}`,
        },
        {
          heading: '动手把更新后的值交回调用方',
          paragraphs: [
            '要修改调用方的值，先在 main 里取变量地址，再把地址传给带 * 的形参。函数内读取 *score 得到当前值，写入 *score 会更新同一变量。这个小程序把第一次读到的值打印在前，调用 add_point 后再打印一次。',
            '先跑模板，输出两行 4 表示地址已经传入，但还没有通过地址写值。补上一条赋值，让输出变为 4 和 5。完成后把初始值换成 0，再手算第二行应为 1。进阶课会用相同方法更新数组的有效长度。',
          ],
          run: {
            language: 'c',
            expectedOutput: '4\n5',
            starter: String.raw`#include <stdio.h>

static void add_point(int *score) {
    /* 把 *score 增加 1。 */
}

int main(void) {
    int score = 4;
    printf("%d\n", score);
    add_point(&score);
    printf("%d\n", score);
}`,
          },
        },
        {
          heading: '查清函数拿到的是数组还是指针',
          paragraphs: [
            '在定义数组 int readings[] = {18, 20, 23} 的作用域，sizeof readings 计算整个数组的字节数，sizeof readings[0] 计算一个元素的字节数，两者相除得 3。把 readings 作为实参传给函数时，表达式通常转换成指向首元素的指针。形参 const int readings[] 也按指针形参处理。',
            '函数内因此需要调用方显式提供元素数。比如 count_above(readings, 3, 19) 遍历三个元素，20 和 23 满足严格大于 19，结果为 2。函数用 size_t 表示非负长度与下标，用 const 约定按只读方式使用元素。',
          ],
        },
        {
          heading: '字节容量与字符串长度',
          paragraphs: [
            '字符数组可以保存结尾带空字符的字符串。对于 char label[8] = "C17"，前三个字节是 C、1 和 7，紧接的是 \\0，剩余元素也被初始化为零。sizeof label 是 8，包含所有存储空间。包含 <string.h> 后使用 strlen(label) 得到 3，计算范围截至第一个空字符之前。',
            '预留容量时把终止字符计入预算。例如三个可见的 ASCII 字符至少需要四个 char。用 %s 输出前应保证在数组有效范围内存在终止字符。如果数组里存的是一般字节数据，应通过知道的长度逐字节处理。',
          ],
        },
        {
          heading: '动手观察字符串的结束位置',
          paragraphs: [
            '运行下例，容量仍是 8。先显示完整的 C17，再将下标 1 的字符换成终止字符，显示时只剩 C。终止符之后的内容没有被用作字符串的一部分，strlen 从头数到终止符之前便停止。',
            '把下标从 1 改为 2，手算第二行的字符串为 C1、长度为 2、容量仍为 8。再试将下标改为 0，字符串为空而缓冲区依旧存在。进阶课的 fgets 每次把读到的文本放进这种缓冲区。',
          ],
          codeLanguage: 'C',
          code: String.raw`#include <stdio.h>
#include <string.h>

int main(void) {
    char label[8] = "C17";
    printf("%s %zu %zu\n", label, strlen(label), sizeof label);
    label[1] = '\0';
    printf("%s %zu %zu\n", label, strlen(label), sizeof label);
}`,
          run: { language: 'c', expectedOutput: 'C17 3 8\nC 1 8' },
        },
        {
          heading: '给二维数组选择正确的行宽',
          paragraphs: [
            'int grid[2][3] 可理解为含两行的数组，每行都是含三个 int 的数组。用 {{1, 2, 3}, {4, 5, 6}} 初始化后，grid[1][2] 是 6。逐行处理时用外层下标选择行，内层下标选择列。固定列数为 3 的参数可以声明为 int grid[][3]，并单独传入行数，列宽让编译器知道如何走到下一行。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '用 sizeof 数组形参 / sizeof 首元素计算元素数。', why: '函数收到的是指针，sizeof 形参返回指针大小。', fix: '在数组定义处算出实际长度并随数组一起传入。' },
        { mistake: '给三个字母分配三字节数组，再按 %s 输出。', why: '这三个字节放完字母后已无空间留给终止空字符。', fix: '用 char text[] = "map" 让编译器分配含结尾的容量，或明确预留四个字节。' },
      ],
      practice: {
        prompt: '编写只读函数 count_above，统计数组中严格高于阈值的温度次数。允许提供长度 0，此时应无需读取任何元素。',
        checkpoints: ['{18, 20, 23} 与阈值 19 得到 2。', '同一数组和阈值 23 得到 0，恰好相等的元素不计入。', '用同一数组地址配长度 0，返回 0。'],
        solution: '调用方先计算元素数。函数遍历下标 [0, length)，只有读数大于阈值时才加一。空范围自然跳过循环。printf 用 %zu 显示 size_t。',
        codeLanguage: 'C · 完整程序 readings.c',
        code: String.raw`#include <stddef.h>
#include <stdio.h>

static size_t count_above(const int readings[], size_t length, int limit) {
    size_t count = 0;
    for (size_t i = 0; i < length; ++i) {
        if (readings[i] > limit) {
            ++count;
        }
    }
    return count;
}

int main(void) {
    int readings[] = {18, 20, 23};
    size_t length = sizeof readings / sizeof readings[0];
    printf("%zu\n", count_above(readings, length, 19));
    printf("%zu\n", count_above(readings, length, 23));
    printf("%zu\n", count_above(readings, 0, 19));
    return 0;
}`,
      },
      questions: [
        { id: 'c-address-write', prompt: 'int score = 4; 执行 reset(&score) 后，若 reset 的函数体是 *value = 9;，score 的值为多少？', choices: ['4', '9', '0', '由指针大小决定'], answer: 1, explanation: '&score 提供 score 的地址，*value 所表示的对象就是 score。' },
        { id: 'c-string-capacity', prompt: '在 char code[6] = "ab"; 的定义所在作用域，sizeof code 和 strlen(code) 分别是多少？', choices: ['2 和 6', '6 和 6', '6 和 2', '3 和 2'], answer: 2, explanation: '数组容量为 6 个 char。strlen 在字母 b 后的首个空字符前停止，计数为 2。' },
      ],
    },
  },
  'lv-python-foundations': {
    values: {
      objectives: ['用 print 显示文字和数字。', '区分字符串、整数和浮点数，并用变量给值起名字。', '用乘法算出水果的总价，再把结果显示成一行小票。'],
      sections: [
        {
          heading: '用数字计算，用文字标记',
          paragraphs: [
            '一张取货牌上可能写着编号 007。编号要按原样显示，所以用字符串 "007"。如果上午卖出 4 个苹果、下午卖出 3 个，这两个数量需要相加，所以用整数 4 和 3。',
            '符号 + 用在两个数字之间时做加法，用在两个字符串之间时会把它们接在一起。这类能算出一个值的写法叫表达式。print 会先等括号里的表达式得到结果，再把结果显示出来。下面依次显示 007、7 和 43。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `ticket = "007"
print(ticket)
print(4 + 3)
print("4" + "3")`,
        },
        {
          heading: '把算出来的新数量记下来',
          paragraphs: [
            '顾客本来要买 3 个苹果，又加了 2 个。print(quantity + 2) 会显示 5，quantity 暂时仍是 3。想把小票上的数量也改为 5，可以给同一个名字再次赋值。',
            '读 quantity = quantity + 2 时，先用右边原有的 3 算出 5，再把左边的 quantity 改为 5。下面三次显示的数字依次是 5、3、5。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `quantity = 3
print(quantity + 2)
print(quantity)
quantity = quantity + 2
print(quantity)`,
        },
        {
          heading: '用乘法打印一行小票',
          paragraphs: [
            '每根香蕉 2 元，买了 5 根，就用单价乘数量。Python 用星号 * 表示乘法。price * quantity 算出 10，然后用 total（合计）这个名字记住结果。',
            '给 print 的内容也叫参数。一个 print 可以接收多个参数，用英文逗号 , 隔开。默认每两项之间加一个空格。下面把商品名、合计和单位放在同一行，显示「香蕉 10 元」。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `item = "香蕉"
price = 2
quantity = 5
total = price * quantity
print(item, total, "元")`,
        },
      ],
      pitfalls: [
        { mistake: '给单价和数量都加上引号，再用 + 求和。', why: '"4" + "3" 会连接成文字 "43"。', fix: '需要做数字加法时，把数直接写成 4 + 3。' },
        { mistake: '把变量名写成 print("price")，期待显示单价。', why: '有引号时，print 收到的是一段文字，屏幕上会出现 price。', fix: '写 print(price)，让 Python 读取 price 对应的值。' },
      ],
      practice: {
        prompt: '给水果摊写一行小票。苹果每个 4 元，先买 3 个。用 price 和 quantity 算出 total，用一次 print 显示商品名、总价和单位，按检查点修改数量再运行。',
        checkpoints: ['quantity 是 3 时，显示「苹果 12 元」。', 'quantity 改成 5，显示「苹果 20 元」。', 'quantity 改成 0，显示「苹果 0 元」。'],
        solution: '把 price 和 quantity 对应的两个数字相乘，存到 total。print 依次显示 item 对应的「苹果」、total 对应的金额和字符串「元」，并在三项之间加空格。',
        codeLanguage: 'Python · 可直接运行',
        code: `item = "苹果"
price = 4
quantity = 3
total = price * quantity
print(item, total, "元")`,
      },
      questions: [
        { id: 'py-text-addition', prompt: 'print("4" + "3") 会显示什么？', choices: ['7', '43', '12', '4 3'], answer: 1, explanation: '两个值都有引号，+ 会把两个字符串接在一起，print 显示 43。' },
        { id: 'py-calculate-quantity', prompt: '依次执行 quantity = 3、quantity = quantity + 2，再显示 quantity，屏幕上是什么？', choices: ['3', '2', '32', '5'], answer: 3, explanation: '第二行先读取原有的 3，与 2 相加得到 5，再把 quantity 更新为 5。' },
      ],
    },
    decisions: {
      objectives: ['用比较、if 和 else 在两种结果之间做选择。', '用 elif 增加备选条件，用 and 和 or 组合条件。', '用 input 读入文字，再用 int 把整数文字转成可计算的数字。'],
      sections: [
        {
          heading: '有多种情况时，按顺序检查',
          paragraphs: [
            '教室预约还要处理填错人数和无人参加。小于用 <，大于用 >，大于或等于用 >=。判断两边是否相等要写两个等号 ==。一个等号 = 用于给变量赋值。',
            'elif 可以读成「前面的条件都不成立时，再检查这个条件」。它和 if、else 左边对齐。Python 从上往下检查，执行第一条符合条件的分支。如果前面的条件都不成立，才运行 else。',
            '下面人数为 12，显示「可以预约」。分别改成 -1、0、13，会显示「人数填错了」「无需预约」「座位不足」。-1 前面的减号表示这是负数。把 people <= 12 放在开头时，0 也会符合该条件，因此要先处理 0 人的情况。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `people = 12
if people < 0:
    print("人数填错了")
elif people == 0:
    print("无需预约")
elif people <= 12:
    print("可以预约")
else:
    print("座位不足")`,
        },
        {
          heading: '「而且」和「或者」怎么写',
          paragraphs: [
            '「最多 12 人，而且房间空闲」需要两件事都成立，Python 用 and 连接它们。下面 people <= 12 成立，room_free 是 False，所以显示「暂时无法预约」。把 room_free 改为 True，会显示「可以预约」。',
            '「带了纸质预约单，或者出示电子预约码」只要有一样就可以。or 表示至少一个条件成立。Python 从左往右看。and 左边为假时，可以跳过右边。or 左边为真时，也可以跳过右边。这种提前得到结果的规则叫短路。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `people = 8
room_free = False
if people <= 12 and room_free:
    print("可以预约")
else:
    print("暂时无法预约")`,
        },
        {
          heading: '从键盘读入人数，再把文字转成整数',
          paragraphs: [
            'input 是 Python 自带的函数，用来读一行键盘输入。括号里的字符串会先显示为提示，程序等你输完并按回车。即使键入 12，input 交回的也是字符串 "12"。下面用 text 这个名字保存它。',
            '上一章见过整数类型的名字 int。写成 int(text) 时，括号表示调用。这里交给它一段整数形式的文字，它会交回对应的整数，方便拿来和座位数做比较。像 "十二" 或 "12.5" 这样的文字不能转换成整数，Python 会报 ValueError，表示传入的值不符合要求。',
            '用 Python 3 运行这段程序。看到提示后输入 12 并回车，程序接着显示「座位足够」。重新运行并输入 13，程序显示「座位不足」。这个例子约定输入 0 或正整数。',
          ],
          codeLanguage: 'Python · 运行后输入一个非负整数',
          code: `text = input("请输入预约人数：")
people = int(text)
if people <= 12:
    print("座位足够")
else:
    print("座位不足")`,
        },
        {
          heading: '把每条路都要做的事放在外面',
          paragraphs: [
            '无论人数有没有超过容量，最后都想提醒预约人核对日期。把这条共同的 print 放回和 if 一样靠左的位置。下面先显示「座位足够」，然后显示「请核对日期」。把 12 改成 13，第一行变成「座位不足」，第二行照常出现。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `people = 12
if people <= 12:
    print("座位足够")
else:
    print("座位不足")
print("请核对日期")`,
        },
      ],
      pitfalls: [
        { mistake: '写 if people = 0 检查人数。', why: '= 负责给名字赋值，比较相等使用两个等号。', fix: '写 if people == 0:，在下一行缩进写这条路要做的事。' },
        { mistake: '把 input 得到的 "12" 直接和整数 12 比较大小。', why: '前者是字符串，后者是整数，两种值不能直接比较大小。', fix: '确认输入是整数形式的文字后，用 int 转换再比较。' },
      ],
      practice: {
        prompt: '给共享工作室写一个入场提醒。reserved 是预约人数，arrivals 是签到人数，两个值都是非负整数。无人预约时显示「今天不开场」。有预约且签到人数达到预约人数一半时显示「可以开场」。其他情况显示「再等等」。每次只显示一行。',
        checkpoints: ['预约 5、签到 2，显示「再等等」。', '预约 0、签到 0，显示「今天不开场」。', '预约 6、签到 3，显示「可以开场」。'],
        solution: '先用 == 处理无人预约的情况。检查到场人数有没有达到一半，可以把到场人数翻倍，看它是否大于或等于预约人数。比如 2 × 2 得到 4，小于 5，所以还要等。',
        codeLanguage: 'Python · 可直接运行',
        code: `reserved = 5
arrivals = 2
if reserved == 0:
    print("今天不开场")
elif arrivals * 2 >= reserved:
    print("可以开场")
else:
    print("再等等")`,
      },
      questions: [
        { id: 'py-branch-order', prompt: 'people 为 0，先检查 people <= 12，再用 elif 检查 people == 0，会怎样？', choices: ['两条分支都执行', '只进入 people == 0 分支', '只进入 people <= 12 分支', '比较会报错'], answer: 2, explanation: '第一条判断已经成立，整个分支链跳过后续 elif。' },
        { id: 'py-input-type', prompt: '在 input 的提示下键入 12 并按回车，input 交回什么值？', choices: ['整数 12', '字符串 "12"', '浮点数 12.0', '布尔值 True'], answer: 1, explanation: 'input 读进来的是一行文字。对文字调用 int 后，才会得到整数 12。' },
      ],
    },
    collections: {
      objectives: ['用列表保存有顺序的一批值，并通过索引读取其中一项。', '用 for 逐项处理数据，累加数值并筛选记录。', '用切片读取一段列表，区分共用同一列表和复制列表。'],
      sections: [
        {
          heading: '像记流水账一样逐笔累加',
          paragraphs: [
            '要求出上午一共卖了多少苹果，可以从累计数 0 开始。每轮用 total + quantity 得到新的累计数，再用 = 记回 total。三轮之后，total 先后变成 3、8、10。',
            '把 print 靠左放在 for 之后，让它在循环结束时执行一次，显示 10。如果想观察逐笔变化，可以先把 print 放进循环体，运行时就会看到每一步的累计数。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `sales = [3, 5, 2]
total = 0
for quantity in sales:
    total = total + quantity
print(total)`,
        },
        {
          heading: '次数不固定时用 while',
          paragraphs: [
            'for 适合把一份清单逐项读完。while 先检查条件，只要条件成立就继续。例如每批发出 3 张卡片，能发几批要看还剩多少卡。每轮都减去 3，余量不足 3 时退出。如果漏写减法，成立的条件一直成立，循环就停不下来。',
            '试跑 8 张再将剩余量改为 2。第一次应发 2 批，还剩 2 张。第二次条件一开始就不成立，批数应为 0。',
          ],
          codeLanguage: 'Python',
          code: `remaining = 8
batches = 0
while remaining >= 3:
    remaining = remaining - 3
    batches = batches + 1
print(batches, remaining)`,
          run: { language: 'python', expectedOutput: '2 2' },
        },
        {
          heading: '用 append 把符合条件的一项记下来',
          paragraphs: [
            '记账表中有补录失败留下的 0 和负数。要保留大于 0 的记录，可以建一张空列表 valid，再在循环里逐条判断。',
            'append 是列表提供的一项操作，称为方法。先写要改动的列表名，再写英文句点 . 和 append。括号里放要加到列表末尾的那一项。valid.append(quantity) 只向 valid 添加当前数量。',
            '下方 if 向右缩进四个空格，表示每一轮都做一次判断。append 再向右四个空格，表示通过判断才加入清单。结果显示 [3, 5, 2]。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `sales = [3, 0, -2, 5, 2]
valid = []
for quantity in sales:
    if quantity > 0:
        valid.append(quantity)
print(valid)`,
        },
        {
          heading: '用切片查看连续的几项',
          paragraphs: [
            '想只查看第二项和第三项，可以用切片。写法是在列表后的方括号内用冒号 : 分开起点和终点。从起点索引开始取，在终点索引之前停下。sales[1:3] 取索引 1 和 2。',
            '冒号前留空表示从头取，冒号后留空表示取到末尾。下面第一行显示 [5, 2]，第二行显示 [3, 5]，第三行显示 [2, 7]。单独读取不存在的位置会报 IndexError，切片则只取指定范围内实际存在的项。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `sales = [3, 5, 2, 7]
print(sales[1:3])
print(sales[:2])
print(sales[2:])`,
        },
        {
          heading: '区分给清单再起个名字和复制清单',
          paragraphs: [
            '把一本账本叫作「销售记录」也叫作「今日账本」，两个名字仍指向同一本账本。draft = sales 也只为同一列表加了一个名字。之后用 draft 添加一项，从 sales 也能看到。',
            'copy 是列表提供的另一个方法，用来创建新的列表。要在副本中增删本例里的整数，可以写 draft = sales.copy()。下面两行都显示 [3, 5]。把第二行换成调用 copy 的写法，第一条输出变为 [3]，第二条仍是 [3, 5]。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `sales = [3]
draft = sales
draft.append(5)
print(sales)
print(draft)`,
        },
      ],
      pitfalls: [
        { mistake: '要取第一项时写 sales[1]。', why: '列表位置从 0 开始计数，索引 1 是第二项。', fix: '读取第一项用 sales[0]，并确认列表里有数据。' },
        { mistake: '把 total = 0 放在 for 循环里。', why: '每一轮都会先把前面的累计数清零。', fix: '循环开始前给 total 赋初值，让循环体只做累加。' },
      ],
      practice: {
        prompt: '水果摊用 weights 记录每袋水果的重量，单位是千克。把大于 0 的重量按原顺序放入 valid_weights，再算出这些有效重量的总和。先显示新列表，再显示总重量。原列表留着供核对。',
        checkpoints: ['weights 为 [3, 0, -2, 5, 2] 时，第一行显示 [3, 5, 2]，第二行显示 10。', '把 weights 改成 []，第一行显示 []，第二行显示 0。', '筛选完成后，原列表 weights 仍保留所有原始记录。'],
        solution: '循环前准备空列表和累计数 0。每轮只在 weight 大于 0 时执行两件事，把它追加到 valid_weights，再把它加到 total。两次 print 都放在循环外。',
        codeLanguage: 'Python · 可直接运行',
        code: `weights = [3, 0, -2, 5, 2]
valid_weights = []
total = 0
for weight in weights:
    if weight > 0:
        valid_weights.append(weight)
        total = total + weight
print(valid_weights)
print(total)`,
      },
      questions: [
        { id: 'py-slice-stop', prompt: 'sales = [3, 5, 2, 7] 时，sales[1:3] 得到什么？', choices: ['[3, 5]', '[5, 2, 7]', '[5, 2]', '[2, 7]'], answer: 2, explanation: '切片从索引 1 开始，在索引 3 之前停下，因此取到 5 和 2。' },
        { id: 'py-list-alias', prompt: '执行 sales = [3]、draft = sales 和 draft.append(5) 之后，sales 的内容是什么？', choices: ['[3, 5]', '[3]', '[5]', '[]'], answer: 0, explanation: '两个变量名指向同一张列表。通过 draft 添加的 5 也能从 sales 读到。' },
      ],
    },
    functions: {
      objectives: ['用 def 定义函数，再用 return 把计算结果交给调用方。', '用整除和取余计算满袋数与剩余件数。', '用默认值简化常见调用，按参数名字指定特殊值。'],
      sections: [
        {
          heading: '清理短文本，再把值填入句子',
          paragraphs: [
            'strip() 返回去掉首尾空白的新字符串，原字符串保持原样。split() 按空白把一段文本拆成列表，连续空格算一个分隔位置。如果用户可能少填一项，要先检查列表长度，再读取下标。',
            'f-string 是字符串前加 f 的写法。Python 会先求出花括号里的值，再把结果放进句子。跑一次正常输入后，把 raw 改成只有空白，看看分支如何避免读取不存在的第一项。',
          ],
          codeLanguage: 'Python',
          code: `raw = "  苹果  3  "
parts = raw.strip().split()
if len(parts) == 2:
    item = parts[0]
    count = parts[1]
    print(f"{item}有 {count} 个")
else:
    print("请填写商品和数量")`,
          run: { language: 'python', expectedOutput: '苹果有 3 个' },
        },
        {
          heading: '分装水果时分别求满袋数和余量',
          paragraphs: [
            '有 19 个水果，每袋放 6 个。先装满 3 袋，还剩 1 个。Python 用两个斜线 // 做整除，用百分号 % 求余数。对于这些非负整数，19 // 6 得到完整袋数 3，19 % 6 得到装完满袋后剩下的 1。',
            '下面把两个结果分别保存到 full 和 remaining，再依次显示 3、1。普通除法用一个斜线 /，会得到带小数的商。这里需要数清装满了多少整袋，所以使用 //。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `items = 19
capacity = 6
full = items // capacity
remaining = items % capacity
print(full)
print(remaining)`,
        },
        {
          heading: '给常用的参数准备一个默认值',
          paragraphs: [
            '普通袋子能装 6 个水果，有时要换成装 4 个的小袋子。可以在定义的括号里写 capacity=6。这里的 = 设定参数的默认值。调用时如果没有给 capacity 值，就用 6。',
            'full_bags(19, 4) 按位置传值，19 给 items，4 给 capacity。full_bags(capacity=4, items=19) 按名字传值，顺序可以不同。这种写法叫关键字参数，等号左边的名字来自函数定义。下面依次显示 3、4、4。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `def full_bags(items, capacity=6):
    return items // capacity

print(full_bags(19))
print(full_bags(19, 4))
print(full_bags(capacity=4, items=19))`,
        },
        {
          heading: '选几个容易核对的例子',
          paragraphs: [
            '要检查满袋数，先想出预期结果，再调用函数。0 个水果应有 0 个满袋，6 个正好装满 1 袋，7 个只装满 1 袋，19 个按每袋 4 个可以装满 4 袋。',
            'assert 可以读成「要求这个条件成立」，称为断言。把它写在布尔判断前，让 Python 检查结果。条件为假时会报 AssertionError，并指出出错的那一行。下面的检查都通过，因此最后显示「检查通过」。',
          ],
          codeLanguage: 'Python · 可直接运行',
          code: `def full_bags(items, capacity=6):
    return items // capacity

assert full_bags(0) == 0
assert full_bags(6) == 1
assert full_bags(7) == 1
assert full_bags(items=19, capacity=4) == 4
print("检查通过")`,
        },
      ],
      pitfalls: [
        { mistake: '函数只用 print 显示数字，调用方又把它的结果加到小票里。', why: '没有用 return 交回值，调用方会接到 None。', fix: '在负责计算的函数中用 return 交回数字，在需要显示结果的地方调用 print。' },
        { mistake: '用满袋数当作装下全部水果的袋数。', why: '整除只计算装满的袋子，余下的水果还需要一个袋子。', fix: '先用 % 查看余数。还有剩余时，在满袋数上加 1。' },
      ],
      practice: {
        prompt: '水果摊要把水果全部装袋。写函数 packages_needed(items, capacity=6)，返回至少需要的袋数。items 是水果数量，可以为 0。capacity 是每袋容量，必须是正整数。用 print 显示几次调用的结果。',
        checkpoints: ['使用默认容量时，0 个返回 0，6 个返回 1，7 个返回 2。', '用 items=7, capacity=4 调用时，返回 2。', '用 items=7, capacity=3 调用时，返回 3。'],
        solution: '用 // 算出满袋数 full，用 % 算出剩余数量 remaining。还有剩余时，if 分支立即返回 full + 1。没有余量时，程序走到 if 下面，直接返回 full。',
        codeLanguage: 'Python · 可直接运行',
        code: `def packages_needed(items, capacity=6):
    full = items // capacity
    remaining = items % capacity
    if remaining > 0:
        return full + 1
    return full

print(packages_needed(0))
print(packages_needed(6))
print(packages_needed(7))
print(packages_needed(items=7, capacity=4))
print(packages_needed(items=7, capacity=3))`,
      },
      questions: [
        { id: 'py-keyword-mapping', prompt: '按上面的定义，full_bags(capacity=4, items=19) 返回什么？', choices: ['3', '4', '19', '因传参顺序报错'], answer: 1, explanation: '写出参数名后，19 分给 items，4 分给 capacity。19 // 4 得到 4。' },
        { id: 'py-implicit-none', prompt: '调用只在函数体里执行 print 的 show_price(4, 3)，屏幕上出现 12。这次调用交回给调用方的值是什么？', choices: ['12', '"12"', 'None', '0'], answer: 2, explanation: 'print 显示数字 12。函数走到末尾时没有用 return 交回值，因此 Python 交回 None。' },
      ],
    },
  },
  'lv-java-foundations': {
    'types-and-programs': {
      objectives: ['分别编译、运行并检查命令行参数。', '追踪整型运算、宽化和浮点转换发生的时机。', '在读取控制台文本时识别可能的格式错误。'],
      sections: [
        {
          heading: '看见源文件和类文件的分工',
          paragraphs: [
            '将示例保存为 PosterCount.java，并在装有 JDK 的终端进入文件所在目录。执行 javac PosterCount.java 得到 PosterCount.class，再执行 java -cp . PosterCount 12。javac 检查源码与类型并生成类文件，java 启动 JVM，从指定类路径中找到类并执行入口。运行命令里的 PosterCount 是类名。',
            '类名区分大小写。若 public class 的名字拼成 PosterCount，保存为 posterCount.java 可能导致编译失败，应使用同名文件 PosterCount.java。遇到编译诊断，要读出文件和行号。遇到找不到类的提示，先检查终端目录、编译产物和类路径，再回到程序逻辑。',
          ],
          codeLanguage: 'Java · 完整程序 PosterCount.java',
          code: `public class PosterCount {
    public static void main(String[] args) {
        if (args.length != 1) {
            System.out.println("Provide one integer count");
            return;
        }
        try {
            int posters = Integer.parseInt(args[0]);
            System.out.println("Total: " + (posters + 2L));
        } catch (NumberFormatException error) {
            System.out.println("Not an int");
        }
    }
}`,
        },
        {
          heading: '参数文本经过校验才成为整数',
          paragraphs: [
            '运行时类名后面的 12 会作为字符串放入 args[0]。先检查参数数量，确认该下标可用。Integer.parseInt 读取带可选符号的十进制整数文本。输入 12，程序打印 Total: 14。无参数则输出使用提示，输入 twelve 或 2147483648 则进入 catch，打印 Not an int。',
            '格式检查和业务检查应逐层完成。-3 能解析成 int，如果海报数量必须非负，接下来还要检查 posters < 0。此例主要演示参数读取和数值表达式，保留有符号输入方便观察。',
          ],
        },
        {
          heading: '运算过程中的类型提升',
          paragraphs: [
            'int 的最大值是 2147483647。将 args 输入该值时，posters + 2L 用 long 类型做加法，输出 2147483649。如果两个加数都是 int，超出范围会回绕。即使目标变量声明为 long，法则也相同，需要在运算前让至少一个操作数成为 long。',
            '整型与浮点的选择也在运算前完成。用 5 / 2 得到 2，5 / 2.0 得到 2.5。分别适合表示完整的批数和带小数的比例。字符串加号会拼接，因此 "Total: " + posters + 2L 在 posters 为 12 时输出 Total: 122，而示例里的括号先完成加法。',
          ],
        },
        {
          heading: '局部变量需要先被赋值',
          paragraphs: [
            '如果方法里只有 int copies;，紧跟着调用 System.out.println(copies) 会在编译时失败。编译器要求局部变量在读取前已确定赋值。可以声明时初始化，或在每条可能到达读取点的路径上给值。如果数值只在 try 块中解析成功后才有意义，把使用它的语句也留在同一块中。try 内声明的 posters 在右花括号后超出了作用域。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '运行时把编译得到的 PosterCount.class 当作类名。', why: 'java -cp . 后面需要类名，.class 属于文件名。', fix: '编译用 javac PosterCount.java，运行用 java -cp . PosterCount 12。' },
        { mistake: '用 long total = 50000 * 50000 保存大乘积。', why: '右边仍先做 int 乘法，之后才把结果转换为 long。', fix: '用 long total = 50000L * 50000 让乘法使用 long。' },
      ],
      practice: {
        prompt: '写海报分袋程序。海报有 17 张，每袋可装 4 张，输出满袋数、剩余张数和带小数的容量比值。把总张数改为 16 和 0 作验证。',
        checkpoints: ['17 张得到 4 袋、余 1 张、比值 4.25。', '16 张得到 4 袋、余 0 张、比值 4.0。', '0 张得到 0 袋、余 0 张、比值 0.0。'],
        solution: '商和余数由 int 运算得到。计算小数比值时先转换分子，再用 println 输出。每种结果使用不同变量名，便于修改数据后逐一检查。',
        codeLanguage: 'Java · 完整程序 PosterBags.java',
        code: `public class PosterBags {
    public static void main(String[] args) {
        int posters = 17;
        int capacity = 4;
        int fullBags = posters / capacity;
        int loosePosters = posters % capacity;
        double ratio = (double) posters / capacity;
        System.out.println("Full bags: " + fullBags);
        System.out.println("Loose posters: " + loosePosters);
        System.out.println("Ratio: " + ratio);
    }
}`,
      },
      questions: [
        { id: 'java-run-class', prompt: 'javac PosterCount.java 成功后，要通过 .class 运行并传入参数 12，应执行哪条命令？', choices: ['java -cp . PosterCount 12', 'javac PosterCount 12', 'java -cp . PosterCount.class 12', 'java -cp . 12 PosterCount'], answer: 0, explanation: 'java 命令用类名找到入口类，类名后的 12 进入 String[] args。' },
        { id: 'java-concat-precedence', prompt: 'posters 为 12 时，表达式 "Total: " + posters + 2L 产生什么？', choices: ['Total: 14', 'Total: 122', 'Total: 12', '编译失败'], answer: 1, explanation: '+ 从左向右结合。第一个加号先产生 "Total: 12"，第二个加号继续拼接 2。' },
      ],
    },
    'branches-and-loops': {
      objectives: ['按优先级构造多个互斥条件。', '根据是否需要数组下标决定遍历形式。', '用 continue、break 和边界值追踪循环。'],
      sections: [
        {
          heading: '用分支设计有限的状态结果',
          paragraphs: [
            '活动点数规则分三段。小于 0 显示 Invalid，0 至 49 显示 Standard，50 起显示 Priority。只需检查 points < 0 和 points < 50，剩余区间由 else 接住。用 -1、0、49、50 逐条模拟，确认 50 被放在 Priority 中。若把 points < 50 放在最前面，负数会提前匹配。',
            '校验区间时可用组合条件，例如 points >= 0 && points <= 100。&& 只有左侧为 true 才会计算右侧。数组查找可以用 i >= 0 && i < counts.length && counts[i] > 0 先验证下标，再读取对应的值。',
          ],
        },
        {
          heading: '需要下标时使用普通 for 循环',
          paragraphs: [
            '统计总和只需要元素值，增强 for 可以直接读取每项。需要记录出错位置或更新某个指定下标时，普通 for 保留索引更清楚。下面逐个查找第一个负值，用 -1 表示没有位置。初始访问下标 0 得到 6，访问下标 1 得到 0，来到下标 2 得到 -3 并停止。输出 2。',
            '数组长度为 4，对应下标 0 到 3，所以判断使用 i < counts.length。若数组为空，条件在第一轮之前就为假，firstInvalid 保持 -1。在更大的程序里可把 -1 解释为无异常这一约定写进方法说明。',
          ],
          codeLanguage: 'Java · 完整程序 FindInvalid.java',
          code: `public class FindInvalid {
    public static void main(String[] args) {
        int[] counts = {6, 0, -3, -1};
        int firstInvalid = -1;
        for (int i = 0; i < counts.length; i++) {
            if (counts[i] < 0) {
                firstInvalid = i;
                break;
            }
        }
        System.out.println(firstInvalid);
    }
}`,
        },
        {
          heading: '区分跳过本轮与结束整个循环',
          paragraphs: [
            '处理按顺序收到的检测结果时，可约定负数无效、0 表示采样结束。读到负数用 continue 跳过本轮，读到 0 用 break 结束当前循环。给定 {-2, 4, 7, 0, 9}，先略过 -2，再统计 4 和 7，在 0 处停止，9 保留为未处理记录。',
            '要说明循环结束后变量的含义，可以写出每轮保持成立的规则，例如 total 等于已经处理过的有效记录之和，count 等于其数量。若第一项就是结束标记，两个值保持初始的 0。',
          ],
        },
        {
          heading: '嵌套遍历时分别检查每行长度',
          paragraphs: [
            '二维数组可按行遍历，内层再处理当前行。Java 允许每行长度不同，例如 int[][] batches = {{4, 7}, {5}}。增强 for 先取一行 int[]，内层逐项取 int，从 0 开始累加会依次得到 4、11、16。需要下标时，外层用 batches.length，内层用 batches[row].length。测试时加入一行空数组，确认那一行被读到，内层循环执行零次。',
            '要分别输出每行的小计，可以在外层循环的每一轮把 rowTotal 初始化为零，内层循环结束后输出小计。上例恰好输出 11 和 5。总计则需要在外层循环之前初始化。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '用 i <= counts.length 遍历整个数组。', why: 'i 等于数组长度时，已超出最大有效下标。', fix: '从 0 开始并使用 i < counts.length。' },
        { mistake: '在增强 for 中把循环变量赋值，期望修改 int 数组。', why: 'int 循环变量接收当前元素值的副本。', fix: '使用索引直接赋值给 counts[i]。' },
      ],
      practice: {
        prompt: '按顺序处理整数读数。跳过所有负值，遇到 0 结束。只统计结束标记之前的正数数量和总和。',
        checkpoints: ['{-2, 4, 7, 0, 9} 输出 2 和 11。', '{0, 4} 输出 0 和 0。', '{} 输出 0 和 0。'],
        solution: '用增强 for 遍历。对 0 立即 break，对负值 continue，剩余的读数为正，累加总量并增加计数。',
        codeLanguage: 'Java · 完整程序 ValidReadings.java',
        code: `public class ValidReadings {
    public static void main(String[] args) {
        int[] readings = {-2, 4, 7, 0, 9};
        int count = 0;
        long total = 0L;
        for (int reading : readings) {
            if (reading == 0) {
                break;
            }
            if (reading < 0) {
                continue;
            }
            count++;
            total += reading;
        }
        System.out.println(count + " " + total);
    }
}`,
      },
      questions: [
        { id: 'java-short-circuit-index', prompt: 'i 为 -1 时，条件 i >= 0 && i < counts.length && counts[i] > 0 会怎样？', choices: ['读取 counts[-1]', '返回 true', '返回 false，跳过数组读取', '因语法错误编译失败'], answer: 2, explanation: '&& 在左侧为 false 时短路，counts[i] 不会求值。' },
        { id: 'java-stop-sentinel', prompt: '用练习规则处理 {-1, 2, 0, 5}，总和是多少？', choices: ['7', '6', '1', '2'], answer: 3, explanation: '跳过 -1，加入 2，遇到 0 时退出，5 未处理。' },
      ],
    },
    methods: {
      objectives: ['读懂静态方法的调用方式和返回路径。', '理解基本类型参数的按值传递。', '用多组可重复的输入验证方法契约。'],
      sections: [
        {
          heading: '给一个计算入口闭合输入与输出',
          paragraphs: [
            '创建 rackSlots(int items, int perRack) 时，先写清这两个整数的含义与范围。例如 items 非负，perRack 必须大于 0。结果是最少使用多少个架子。把分配规则写进方法后，入口 main 只需决定要计算几次、如何显示结果。',
            '同一个类中，static main 可直接调用另一个 static 方法。方法签名由名称与参数类型等信息确定，返回类型写在声明中供调用方使用。Java 允许同名方法接收不同参数列表，例如 rackSlots(int items) 可以调用 rackSlots(items, 4) 来集中默认容量。只修改返回类型不会形成有效重载。',
          ],
        },
        {
          heading: '给基本类型参数赋值后追踪两个变量',
          paragraphs: [
            '调用 adjust(queued) 时，形参 value 获得 queued 在该时刻的 int 值，两个变量可分别更新。示例给局部变量 value 加 2 并返回 7，queued 依然为 5。main 先打印 next，再打印 queued，输出依次为 7 和 5。',
            '如果业务要求确认后更新队列数量，调用方显式写 queued = adjust(queued)。每次调用产生新的参数和局部变量，局部变量的名字在方法体之外不可用。可通过返回值和调用前后的变量值手工检查这一点。',
          ],
          codeLanguage: 'Java · 完整程序 QueueCount.java',
          code: `public class QueueCount {
    static int adjust(int value) {
        value += 2;
        return value;
    }

    public static void main(String[] args) {
        int queued = 5;
        int next = adjust(queued);
        System.out.println(next);
        System.out.println(queued);
    }
}`,
        },
        {
          heading: '让所有正常路径都有明确的返回值',
          paragraphs: [
            '声明返回 int 的方法，每条能正常结束的路径都要返回整数。若在 if 的一个分支 return，必须检查条件为假时会在哪里继续执行。输入违反约定时可抛出 IllegalArgumentException，该路径直接结束调用，把原因交给调用者。',
            '验证装架计算时，用 0 件确认空装载，用 8 件容量 4 检查恰好装满，再用 9 件检查要增加一个架子。再用容量 0 检查拒绝非法输入。把这些预期和方法一起保留，重构后重新运行，能知道哪个分支发生了变化。',
          ],
        },
        {
          heading: '用小方法组合出完整结果',
          paragraphs: [
            '假设摆放区有两类物品，各自占用单独的架子。先算 rackSlots(9, 4) 得 3，再算 rackSlots(5, 3) 得 2，最后相加得 5。两次计算使用各自的参数，可以独立验证。若第二类没有物品，调用 rackSlots(0, 3) 得 0，组合逻辑不需要再写一次空数据分支。',
          ],
        },
      ],
      pitfalls: [
        { mistake: '在方法里改形参，认为调用方的 int 变量会一起变化。', why: '基本类型传递的是值的副本。', fix: '把新计算结果返回，需要更新的调用方执行赋值。' },
        { mistake: '只通过修改返回类型来添加一个同名方法。', why: 'Java 不以返回类型区分方法重载。', fix: '使用不同的方法名，或让重载的参数列表不同且含义清楚。' },
      ],
      practice: {
        prompt: '实现 rackSlots(int items, int perRack)，对合法输入返回容纳所有物品需要的最少架子数，负件数或非正容量抛出 IllegalArgumentException。',
        checkpoints: ['rackSlots(0, 4)、rackSlots(8, 4)、rackSlots(9, 4) 分别为 0、2、3。', 'rackSlots(9, 0) 与 rackSlots(-1, 4) 都抛出 IllegalArgumentException。', 'rackSlots(Integer.MAX_VALUE, 4) 能得到 536870912。'],
        solution: '先校验参数，再整除得到已装满的数量。如果还有物品，另需一个架子。把整除和余数分步计算，可以在输入很大时避开 items + perRack - 1 的溢出。',
        codeLanguage: 'Java · 完整程序 Racks.java',
        code: `public class Racks {
    static int rackSlots(int items, int perRack) {
        if (items < 0 || perRack <= 0) {
            throw new IllegalArgumentException("Check item count and capacity");
        }
        int full = items / perRack;
        if (items % perRack != 0) {
            return full + 1;
        }
        return full;
    }

    public static void main(String[] args) {
        System.out.println(rackSlots(0, 4));
        System.out.println(rackSlots(8, 4));
        System.out.println(rackSlots(9, 4));
        System.out.println(rackSlots(Integer.MAX_VALUE, 4));
    }
}`,
      },
      questions: [
        { id: 'java-value-copy', prompt: 'int original = 5; 执行 int next = adjust(original); 后，若 adjust 将参数加 2 后返回，original 是多少？', choices: ['7', '2', '5', '0'], answer: 2, explanation: '形参接收 original 的整数值副本。返回的新值保存在 next，original 仍为 5。' },
        { id: 'java-overload-params', prompt: '已经声明 static int rackSlots(int items, int perRack)，哪一个新声明可以形成合法重载？', choices: ['static long rackSlots(int items, int perRack)', 'static int rackSlots(int count, int size)', 'static int rackSlots(int items)', 'static void rackSlots(int items, int perRack)'], answer: 2, explanation: '一个 int 参数和两个 int 参数构成不同的参数列表。返回类型或参数名称的变化都不够。' },
      ],
    },
    objects: {
      objectives: ['区分实例、引用和字段。', '在构造方法中建立并维持数据约束。', '通过公有方法读取对象数据而保持字段封装。'],
      sections: [
        {
          heading: '先给一条记录加两个字段',
          paragraphs: [
            'new Reservation("A2", 4) 创建一条记录，并调用与类同名的构造方法。构造方法没有返回类型。传入同名参数时，用 this.room 指正在创建的对象的字段，用等号右边的 room 指参数。',
            'private 限制外部直接读写字段，final 表示构造完成后字段不能重新赋值。people() 和 summary() 从对象内部读取字段，分别返回可累加的数字与可显示的描述。',
            '下例先建立记录并读取两个结果。把 4 改成 7，第一行应为 A2 7，第二行应为 8。这里先只练保存和读取，下一段再给构造器加检查。',
          ],
          codeLanguage: 'Java',
          code: `public class Main {
    static class Reservation {
        private final String room;
        private final int people;

        Reservation(String room, int people) {
            this.room = room;
            this.people = people;
        }

        String summary() { return room + " " + people; }
        int people() { return people; }
    }

    public static void main(String[] args) {
        Reservation entry = new Reservation("A2", 4);
        System.out.println(entry.summary());
        System.out.println(entry.people() + 1);
    }
}`,
          run: { language: 'java', expectedOutput: 'A2 4\n5' },
        },
        {
          heading: '用构造方法保证记录有效',
          paragraphs: [
            '阅读场次只接受非空标题和非负时长。创建对象前检查这两个条件，可以让读取方法直接相信每条记录都满足约定。示例使用 String.strip 去掉两侧空白，需要 Java 11 或更高版本。先用 title == null 检查是否没有字符串，再执行 strip，避免对空引用调用方法。',
            '用本机实验室运行下方完整示例。输入标题 "  Atlas  " 会被保存为 Atlas，时长 20 保留。主方法先调用 summary() 输出 Atlas 20 min，再用 minutes() 得到可继续计算的整数，输出加 5 后的 25。',
          ],
          codeLanguage: 'Java · 完整程序 ReadingEntry.java',
          run: { language: 'java', expectedOutput: 'Atlas 20 min\n25', downloadName: 'ReadingEntry.java' },
          code: `public class ReadingEntry {
    private final String title;
    private final int minutes;

    public ReadingEntry(String title, int minutes) {
        if (title == null) {
            throw new IllegalArgumentException("Title is required");
        }
        String normalizedTitle = title.strip();
        if (normalizedTitle.isEmpty() || minutes < 0) {
            throw new IllegalArgumentException("Check title and minutes");
        }
        this.title = normalizedTitle;
        this.minutes = minutes;
    }

    public String summary() {
        return title + " " + minutes + " min";
    }

    public int minutes() {
        return minutes;
    }

    public static void main(String[] args) {
        ReadingEntry entry = new ReadingEntry("  Atlas  ", 20);
        System.out.println(entry.summary());
        System.out.println(entry.minutes() + 5);
    }
}`,
        },
        {
          heading: '引用赋值只会传递对象的引用值',
          paragraphs: [
            '设 a = new ReadingEntry("Atlas", 20)，再写 ReadingEntry b = a，a 和 b 引用同一个对象。比较 a == b 得到 true。另写 c = new ReadingEntry("Atlas", 20) 会创建新对象，a == c 得到 false，即使两条 summary 的文本相同。',
            '比较字符串内容时使用 equals，例如 a.summary().equals(c.summary()) 在本例中为 true。用该方式判断的只是展示文本相同。是否属于同一条业务记录应由业务定义，比如通过唯一记录编号识别。',
          ],
        },
        {
          heading: '封装让访问方式保持可预期',
          paragraphs: [
            'private 把字段留在类内部，构造方法负责把规范化的数据保存在字段中，调用方通过集中定义的公有方法读取所需信息。minutes() 返回 int，其他程序可以求和。summary() 返回文本，面向显示。更换显示格式时，数值统计仍可调用 minutes()。',
            '示例字段类型是 String 和 int，两个 final 字段初始化后不会再赋值，字符串内容也不可变。以后若增加一个 final 数组字段，final 仅固定数组引用，其元素仍可改变。如果希望持续保护对象状态，应避免把可修改的内部数组原样交给外部。',
          ],
        },
        {
          heading: '判断数值应该属于实例还是类',
          paragraphs: [
            '阅读时长属于某一次阅读，所以每个 ReadingEntry 实例保存自己的 minutes。预订上限是所有房间共同遵守的规则，可以在预订类中声明 private static final int MAX_PEOPLE = 12，让所有构造方法复用。若将 minutes 声明为可修改的 static 字段，新建第二条记录时会修改共有数据，第一条记录读到的时长也会跟着变。用两条时长不同的记录即可观察这类问题。',
          ],
        },
        {
          heading: '动手加上构造器的第一条检查',
          paragraphs: [
            '当前类可以接收任意整数。运行后会输出 4 和 0，第二行表明不合法的记录也创建了。补上一条人数检查，发现小于 1 或大于 12 时，用 throw new IllegalArgumentException("invalid people") 结束构造。字段赋值只在通过检查后执行。',
            '模板里的主函数已有 try/catch，它将失败时的消息打印出来并继续运行。修正后预期为 4、invalid people。把 0 改为 13，预期仍拒绝。把 0 改成 12，第二行应为 12。只改构造器，测试部分已经写好。',
            '随后完成章末的 RoomBooking，按相同方式先校验名称和人数，再为合法记录提供两个访问方法。',
          ],
          run: {
            language: 'java',
            expectedOutput: '4\ninvalid people',
            starter: `public class Main {
    static class Reservation {
        final int people;

        Reservation(int people) {
            // 在赋值前检查人数是否在 1 到 12 之间。
            this.people = people;
        }
    }

    public static void main(String[] args) {
        for (int count : new int[]{4, 0}) {
            try {
                System.out.println(new Reservation(count).people);
            } catch (IllegalArgumentException problem) {
                System.out.println(problem.getMessage());
            }
        }
    }
}`,
          },
        },
      ],
      pitfalls: [
        { mistake: '写 void ReadingEntry(...)，期望 new 时它自动运行。', why: '带返回类型的声明是普通方法。', fix: '构造方法写成 public ReadingEntry(...)，省去返回类型。' },
        { mistake: '用 == 测试两次 new 创建的记录是否具有相同的字段值。', why: '对象引用的 == 判断两侧是否引用同一个对象。', fix: '按业务比较字段，或为类定义明确的值相等规则。' },
      ],
      practice: {
        prompt: '编写 RoomBooking 类，保存已去掉两侧空白的房间名和预订人数。房间名需存在且非空，人数范围为 1 到 12。创建两条记录，显示各自的房间名和人数，并求人数总计。',
        checkpoints: ['A2 房间 4 人与 B1 房间 7 人时，分别输出 A2 4 和 B1 7，最后输出 11。', '人数 1 与 12 可以成功构造。', '空白房间名、null、0 人与 13 人各自都应被拒绝。'],
        solution: '构造方法先检查字符串，再检查人数区间，然后保存规范化的标题与人数。summary() 用来显示，people() 提供整数给求和表达式。',
        codeLanguage: 'Java · 完整程序 RoomBooking.java',
        code: `public class RoomBooking {
    private final String room;
    private final int people;

    public RoomBooking(String room, int people) {
        if (room == null) {
            throw new IllegalArgumentException("Room is required");
        }
        String normalizedRoom = room.strip();
        if (normalizedRoom.isEmpty()) {
            throw new IllegalArgumentException("Room is required");
        }
        if (people < 1 || people > 12) {
            throw new IllegalArgumentException("People must be between 1 and 12");
        }
        this.room = normalizedRoom;
        this.people = people;
    }

    public String summary() {
        return room + " " + people;
    }

    public int people() {
        return people;
    }

    public static void main(String[] args) {
        RoomBooking first = new RoomBooking(" A2 ", 4);
        RoomBooking second = new RoomBooking("B1", 7);
        System.out.println(first.summary());
        System.out.println(second.summary());
        System.out.println(first.people() + second.people());
    }
}`,
      },
      questions: [
        { id: 'java-same-reference', prompt: 'ReadingEntry b = a; 而 c 由 new 创建，字段值与 a 相同。以下哪项比较为 true？', choices: ['a == c', 'b == c', 'a == b', 'c == null'], answer: 2, explanation: '赋值让 b 与 a 引用同一个对象。c 是另一次构造返回的独立对象。' },
        { id: 'java-constructor-guard', prompt: '调用 new RoomBooking("A2", 13) 会发生什么？', choices: ['把 13 改为 12 再保存', '抛出 IllegalArgumentException', '创建 13 个对象', '把人数变为 0'], answer: 1, explanation: '13 超出 1 到 12 的范围，构造方法在字段赋值前抛出异常。' },
      ],
    },
  },
}
