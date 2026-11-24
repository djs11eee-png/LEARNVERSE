import type { LessonSection } from '../workspaceCourses'

type Workshop = Record<string, { prepare: LessonSection[]; guided: LessonSection }>

function cExample(heading: string, paragraphs: string[], code: string, expectedOutput: string): LessonSection {
  return { heading, paragraphs, code, codeLanguage: 'C', run: { language: 'c', expectedOutput } }
}

function javaExample(heading: string, paragraphs: string[], code: string, expectedOutput: string): LessonSection {
  return { heading, paragraphs, code, codeLanguage: 'Java', run: { language: 'java', expectedOutput } }
}

function jsExample(heading: string, paragraphs: string[], code: string, expectedOutput: string): LessonSection {
  return { heading, paragraphs, code, codeLanguage: 'JavaScript', run: { language: 'javascript', expectedOutput } }
}

const cWorkshops = {
  structures: {
    prepare: [
      cExample('先读一条样本，再修改一个字段', [
        '已有的 int 只能保存一个整数。对同一个样本，我们常需要同时保留编号和读数。typedef struct { … } Sample; 把花括号内的成员组成一种新类型，并给这个类型起名 Sample。花括号里每个成员仍需要自己的类型和分号。',
        '构造样本时，{7, 18} 依次交给 id 和 reading。row.reading = 21 只修改 reading。逐行读下面的代码时，可在纸上给 row 画一格，再把格内分成 id 和 reading 两栏。运行后观察编号是否变了。',
        '若用两条数组分别保存 id 和 reading，就要靠位置把它们对起来。把两项放在同一结构体中后，交换或复制时可以把整条记录当作一项。只换字段会造成记录错配。',
      ], String.raw`#include <stdio.h>

typedef struct {
    int id;
    int reading;
} Sample;

int main(void) {
    Sample row = {7, 18};
    printf("%d %d\n", row.id, row.reading);
    row.reading = 21;
    printf("%d %d\n", row.id, row.reading);
}`, '7 18\n7 21'),
    ],
    guided: cExample('动手筛出达到门槛的样本', [
      '先只输出满足条件的编号。用 rows[i] 取当前记录，用 rows[i].reading 比较读数，再用同一个 i 读取 id。模板中的主函数已经给出三条记录，先运行，确认输出 9 和 12。',
      '把门槛从 20 改为 24，再运行，手算应只看到编号 12。把条件临时改成 >，结果会立即少掉它，这正是边界测试的作用。',
      '恢复 >= 后，把打印改为计数。先在循环外令 count = 0，命中时 count++，循环结束再输出一行。进入下面正式练习时，把这段计数放到 count_warm，并用 length 控制处理范围。',
    ], String.raw`#include <stdio.h>
typedef struct { int id; int reading; } Sample;

int main(void) {
    const Sample rows[] = {{7, 19}, {9, 20}, {12, 24}};
    const int limit = 20;
    for (size_t i = 0; i < sizeof rows / sizeof rows[0]; i++) {
        if (rows[i].reading >= limit) printf("%d\n", rows[i].id);
    }
}`, '9\n12'),
  },
  capacity: {
    prepare: [
      cExample('沿着地址找到调用者的长度', [
        '看 main 中的 size_t length = 1。length 本身是一个数字，而 &length 取得这个数字所在位置的地址。bump 的形参 size_t *length 表示它接收的是指向 size_t 数值的地址。',
        '进入 bump 后，*length 取出地址处的数字。写入 *length 会修改 main 原来的变量。(*length)++ 先借括号取得这个数，再加一。如果误写 length++，递增的是函数里的指针副本。若写成 *length++，也是先移动指针，因为后缀 ++ 优先。',
        '把 main 里的初值 1 改为 2 后，预期第二行是 3。再想一遍有哪一步会修改调用方变量，确认是 bump 中的解引用递增。',
      ], String.raw`#include <stddef.h>
#include <stdio.h>

static void bump(size_t *length) {
    (*length)++;
}

int main(void) {
    size_t length = 1;
    printf("%zu\n", length);
    bump(&length);
    printf("%zu\n", length);
}`, '1\n2'),
    ],
    guided: cExample('动手追踪下一格和已满分支', [
      '下面先观察单次尝试。数组只有两个格子，赋值前看已有长度能否作为新下标。成功执行两件事，在下一格写值，再更新实际占用数。数组名提供首元素位置给函数，length 形参存放调用者长度的地址，两者分别影响数据与计数。',
      '已有 4 和 7 两项时，输入 9 应给出 ok=0，长度依旧是 2，第二项还是 7。把 main 中的 length 改为 1，会把 9 写进下标 1，显示 ok=1 length=2 last=9。',
      '再回看两个分支。满时没有任何赋值。成功时用旧长度作为下标，写完才自增。正式练习会连续追加三条，测试每次状态以及满后的已有数据。',
    ], String.raw`#include <stddef.h>
#include <stdio.h>

static int append(int data[], size_t capacity, size_t *length, int value) {
    if (*length >= capacity) return 0;
    data[*length] = value;
    (*length)++;
    return 1;
}

int main(void) {
    int rows[2] = {4, 7};
    size_t length = 2;
    int ok = append(rows, 2, &length, 9);
    printf("ok=%d length=%zu last=%d\n", ok, length, rows[1]);
}`, 'ok=0 length=2 last=7'),
  },
  'text-files': {
    prepare: [
      cExample('分别观察转换结果和停止位置', [
        '先把文件放一边，用一段已知文本试 strtol。它返回 long，同时需要一处位置写回停止地址。声明 char *end 是准备一个会存字符地址的变量。传 &end 后，库才可以给这个指针变量赋值。这和传 &length 让 append 更新长度是同一种想法。',
        '读到 25x 时，value 是 25，*end 是字符 x。读到 x25 时，end 等于起点，表示一个数字都没消耗。读完整个合法字符串时，*end 是终止字符 \\0。例子把终止字符显示成 E，方便核对。',
        'errno 是标准库用于报告部分错误的变量。每次调用前先把它清零，返回后判断 errno == ERANGE，避免把先前错误误认为本次溢出。long 的字节数可能因平台而不同，用很长的十进制文本做溢出测试。',
      ], String.raw`#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

static void inspect(const char *text) {
    char *end;
    errno = 0;
    long value = strtol(text, &end, 10);
    if (end == text) printf("no digits\n");
    else if (errno == ERANGE) printf("overflow\n");
    else if (*end == '\0') printf("%ld stop=E\n", value);
    else printf("%ld stop=%c\n", value, *end);
}

int main(void) {
    inspect("25x");
    inspect("x25");
    inspect("0");
    inspect("999999999999999999999999999999999999");
}`, '25 stop=x\nno digits\n0 stop=E\noverflow'),
    ],
    guided: cExample('先验证一个整数，再写入读数', [
      '沿着下面三个提前返回条件读一遍。第一种失败是无数字或溢出，第二种是超出允许读数，第三种是尾部多出未知字符。只有三关都过才给 *output 赋值。',
      '先运行，核对坏文本 18x 不会覆盖旧值 7，正常的 0 会保存。用带换行的 101 替换第一个实参，第一行仍应为 ok=0 value=7。再改成带换行的 100，第一行应为 ok=1 value=100。',
      '综合题的 main 已经提供 tmpfile、rewind 和 fgets，可先专心完成解析函数。之后做双字段台账时，第一处停止位置就是两个字段的交界，从分隔空格处继续读取第二个数字。',
    ], String.raw`#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

static int parse_reading(const char *text, int *output) {
    char *end;
    errno = 0;
    long value = strtol(text, &end, 10);
    if (end == text || errno == ERANGE) return 0;
    if (value < 0 || value > 100) return 0;
    if (*end != '\0' && !(*end == '\n' && end[1] == '\0')) return 0;
    *output = (int) value;
    return 1;
}

int main(void) {
    int reading = 7;
    int ok = parse_reading("18x", &reading);
    printf("ok=%d value=%d\n", ok, reading);
    ok = parse_reading("0\n", &reading);
    printf("ok=%d value=%d\n", ok, reading);
} `, 'ok=0 value=7\nok=1 value=0'),
  },
  'bitwise-and-frames': {
    prepare: [
      cExample('从 scanf 衔接 fgets：为什么先读整行再解析', [
        '国内高校大一 C 语言课堂通常先教 scanf("%d", &n) 读取键盘输入。但 scanf 读完整数后会把后面的换行符留在缓冲区里，且遇到字母 "20x" 时只会停在 x 前面，如果不检查返回值就会把脏数据留在流里影响下一次读取。',
        '工程上最平滑的衔接做法是：依然按你熟悉的思路先用 fgets 读出整行，再结合 sscanf 的返回值检查字段个数（或用上一章的 strtol 严格检查尾随字符）。下面用内存里的字符串演示 sscanf 如何通过返回值 2 区分完整行与缺字段行。',
        '把第二行 "7" 改成 "7 25" 再运行，会看到两行都返回 2 并输出解析结果。记住规则：任何 scanf / sscanf 都要先核对返回值是否等于期望的字段数。',
      ], String.raw`#include <stdio.h>

static void parse_line(const char *line) {
    int id = 0, temp = 0;
    int matched = sscanf(line, "%d %d", &id, &temp);
    if (matched == 2) printf("ok id=%d temp=%d\n", id, temp);
    else printf("bad matched=%d\n", matched);
}

int main(void) {
    parse_line("3 25\n");
    parse_line("7\n");
    return 0;
}`, 'ok id=3 temp=25\nbad matched=1'),
    ],
    guided: cExample('动手用移位与掩码拆解 16 位传感帧', [
      '单片机与传感器常把多个小字段压进一个 uint16_t（16 位无符号整数）里发送：高 4 位存设备号，中间 8 位存摄氏温度，低 4 位存状态标志（最低位 bit0=1 表示高温告警，bit1=1 表示低电量）。',
      '提取任意一段都遵循两步口诀：“先右移到最右侧，再按位与掩码截断高位”。例如 0x3191 写成二进制是 0011 00011001 0001：右移 12 位与 0xFU 得设备 3；右移 4 位与 0xFFU 得温度 25；直接与 0x1U 得告警位 1。',
      '试着把主函数里的 0x3191 改成 0x3193（低 4 位变成 0011），预测 low_bat 会从 0 变成 1，再运行核对。',
    ], String.raw`#include <stdint.h>
#include <stdio.h>

int main(void) {
    uint16_t frame = 0x3191U;
    unsigned node = (frame >> 12) & 0xFU;
    unsigned temp = (frame >> 4) & 0xFFU;
    unsigned alarm = frame & 0x1U;
    unsigned low_bat = (frame >> 1) & 0x1U;
    printf("N%u %uC alarm=%u low=%u\n", node, temp, alarm, low_bat);
    return 0;
}`, 'N3 25C alarm=1 low=0'),
  },
  decomposition: {
    prepare: [
      cExample('用返回值和输出参数交接数据', [
        '可以用返回值表示成功或失败，用输出参数保存成功取到的读数。这样 0 仍可以是合法的读数，失败则始终由状态解释。',
        'read_value 负责执行范围检查与求值。show_value 负责打印。主函数提供两个输入，先运行确认错误与合法 0 不会混在一起。把校验器换成上一章的文本解析函数，show_value 仍可用一个状态值决定显示哪个分支。',
        '当每个步骤只接收它真正需要的数据时，出错可以缩小至一个环节。读到了脏记录，先查校验。统计不对但记录与顺序正确，先核对统计函数收到的有效长度。',
      ], String.raw`#include <stdio.h>

static int read_value(int candidate, int *reading) {
    if (candidate < 0 || candidate > 100) return 0;
    *reading = candidate;
    return 1;
}

static void show_value(int candidate) {
    int reading = 0;
    if (read_value(candidate, &reading)) printf("reading=%d\n", reading);
    else printf("invalid\n");
}

int main(void) {
    show_value(-1);
    show_value(0);
}`, 'invalid\nreading=0'),
      cExample('把单字段解析扩展为两个字段', [
        '第一轮 strtol 把开始位置交给 middle，第二轮从 middle 继续读。只有 middle 指向约定的分隔符，才能开始第二轮。第二轮再用 end 检查有没有读到数字，并确认剩余字符符合要求。',
        '示例这里先用单个空格和字符串结尾验证过程。7 18 有两个合法字段，7 缺读数，9 20! 有多余字符。正式项目再为每个字段加值域规则，并接受制表符和文件行尾。',
        '先跑三个输入，再把最后一个输入里的感叹号删掉。第三行应变成 9:20。动手拆开格式校验与写入，只有完整记录通过两轮验证后才会写到结构体中。',
      ], String.raw`#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

static void show(const char *line) {
    char *middle;
    errno = 0;
    long id = strtol(line, &middle, 10);
    if (middle == line || errno == ERANGE || *middle != ' ') {
        puts("bad row");
        return;
    }
    char *end;
    errno = 0;
    long reading = strtol(middle, &end, 10);
    if (end == middle || errno == ERANGE || *end != '\0') {
        puts("bad row");
        return;
    }
    printf("%ld:%ld\n", id, reading);
}

int main(void) {
    show("7 18");
    show("7 ");
    show("9 20!");
}`, '7:18\nbad row\nbad row'),
    ],
    guided: cExample('动手验证一次失败不改变状态', [
      '看主函数保存的 before 和 value。尝试更新失败后分别断言返回状态和原值。有效时则断言结果与新值。这样即使失败分支错误写入了值，测试也能发现。assert 默认在条件为假时终止程序并报告位置。',
      '先运行，再把 invalid 入参从 -1 改成 101，仍应打印 OK。临时把 set 内部的写入挪到范围检查之前，第二个断言应该失败。恢复后可以再运行。',
      '正式练习给了同一个数组的三个长度。参照下例先分别手算，再检查完整前缀、部分前缀和空区间。有错误时先看出错的输入，再判断该查循环、初值还是调用者传入的长度。',
    ], String.raw`#include <assert.h>
#include <stdio.h>

static int set(int *value, int candidate) {
    if (candidate < 0 || candidate > 100) return 0;
    *value = candidate;
    return 1;
}

int main(void) {
    int value = 7;
    int before = value;
    int invalid = set(&value, -1);
    assert(invalid == 0);
    assert(value == before);
    int accepted = set(&value, 0);
    assert(accepted == 1);
    assert(value == 0);
    puts("OK");
}`, 'OK'),
  },
} satisfies Workshop


const javaWorkshops = {
  'array-list': {
    prepare: [
      javaExample('先认识尖括号、元素类型和空表', [
        '从 String[] 转到 ArrayList<String> 时，元素仍按顺序排列。尖括号里的 String 限定清单只能接收字符串，get 取回时也会得到 String。Java 会在编译时发现 add(42) 放错类型。new ArrayList<>() 右侧不再重复写 String，因为左侧已经说明了要创建哪类列表。',
        '列表初始为空，这时 size() 为 0，直接调用 get(0) 会越界。先 add，再判断 size()。get 读取但不删除，size 也不会变化。按下标操作要验证 0 ≤ index < size()。for (String item : items) 则逐项取值，适合输出或累计。',
        '下面依次追加相机和麦克风。试着在最后插入第三次 add("light")，需要先挪到打印之前，才会影响该行的长度。手算第三行从 2 变为 3，第一项仍是 cam。',
      ], `import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        ArrayList<String> items = new ArrayList<>();
        System.out.println(items.size());
        items.add("cam");
        items.add("mic");
        System.out.println(items.get(0));
        System.out.println(items.size());
    }
}`, '0\ncam\n2'),
    ],
    guided: javaExample('动手区分按位置删除和按值删除', [
      'ArrayList 中的类型参数必须是可作为对象的类型，所以整数列表写 ArrayList<Integer>，而不是 ArrayList<int>。把数字常量交给 add 时，Java 会替你包装为 Integer。删除时，remove(1) 会匹配接受 int 下标的方法，remove(Integer.valueOf(1)) 才会匹配接受对象的方法。',
      'List.of(4, 7, 4) 提供一份固定初始值，再用 ArrayList 构造器复制这些元素，列表就能增删。两份列表开始都为 [4, 7, 4]。第一份在下标 1 删除 7，变成 [4, 4]；第二份按值删第一个 4，变成 [7, 4]。把按值目标改为 99，列表仍是 [4, 7, 4]。',
      '在综合题里要按字符串编号删第一条，调用 remove(id) 就已经指定按值删除。保留它给你的布尔结果，额外测试空列表与重复编号。',
    ], `import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        ArrayList<Integer> byPosition = new ArrayList<>(List.of(4, 7, 4));
        ArrayList<Integer> byValue = new ArrayList<>(byPosition);
        byPosition.remove(1);
        byValue.remove(Integer.valueOf(4));
        System.out.println(byPosition);
        System.out.println(byValue);
    }
}`, '[4, 4]\n[7, 4]'),
  },
  map: {
    prepare: [
      javaExample('把设备编号和显示名分成键和值', [
        'Map 的两个类型位置依次写键和值。Map<String, String> 表示两边都是字符串，Map<String, Integer> 表示用设备名或编号查到次数。左侧 Map 是类型接口，右侧 new LinkedHashMap<>() 选择一种实现，支持按首次插入顺序遍历。',
        '调用 put(键, 值) 相当于替某个编号挂信息。两台同名设备可用两个编号并存。再次 put 同一个键，只有该键对应的旧值被替换。把存放顺序与查找方式分开想，可避免把键当列表下标。',
        '下面先把 cam-1 和 cam-2 都登记为 Camera，再把 cam-1 的名称换成 Wide。查已存在的编号可用 get；查不确定的编号先用 containsKey，或在确认无 null 值后使用 getOrDefault。',
      ], `import java.util.Map;
import java.util.LinkedHashMap;

public class Main {
    public static void main(String[] args) {
        Map<String, String> names = new LinkedHashMap<>();
        names.put("cam-1", "Camera");
        names.put("cam-2", "Camera");
        names.put("cam-1", "Wide");
        System.out.println(names.get("cam-1"));
        System.out.println(names.get("cam-2"));
        System.out.println(names.containsKey("cam-3"));
    }
}`, 'Wide\nCamera\nfalse'),
    ],
    guided: javaExample('动手累计次数并逐行展示键值', [
      '先读旧次数，第一次找不到时用 0，然后把新次数写回原键。例子中的 mic 首次为 1，再次为 2。用 entrySet 得到键值条目集合。for 循环中的 Map.Entry<String, Integer> 声明每项类型，用 getKey 与 getValue 分别取键和值。',
      '先运行，再把输入改成 cam、mic、cam。手算输出先为 cam=2，后为 mic=1。再用一个空数组，Map 不会新增条目，显示循环无需打印。',
      '综合题返回整个 Map。把下面更新次数的循环留在统计方法里，由给定主函数决定怎样显示。顺序交给 LinkedHashMap 管理，避免额外排序。',
    ], `import java.util.LinkedHashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        String[] records = {"mic", "cam", "mic"};
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String id : records) {
            int next = counts.getOrDefault(id, 0) + 1;
            counts.put(id, next);
        }
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            System.out.println(entry.getKey() + "=" + entry.getValue());
        }
    }
}`, 'mic=2\ncam=1'),
  },
  exceptions: {
    prepare: [
      javaExample('从主动抛出到调用者捕获', [
        '方法遇到一个不符合约定的参数，可执行 throw new IllegalArgumentException("bad quantity")。new 创建异常对象，字符串说明原因，throw 会停止当前路径，不执行它后面的语句。调用者可在 try 中调用这个方法，用匹配的 catch 接过异常对象。',
        '下面给 0 时从 check 直接走到 catch，打印通过 getMessage 得到的信息。给 2 时会从 check 正常返回，try 块继续打印 accepted。将两个输入的顺序交换，预期输出的两行也对应换位。',
        '不需要在底层方法里直接打印提示。方法只负责报告错误，由调用者决定是重试、打印或在界面上提示。使用窄的 catch 类型，能让意料之外的问题继续显现。',
      ], `public class Main {
    static void check(int quantity) {
        if (quantity < 1) throw new IllegalArgumentException("bad quantity");
    }

    public static void main(String[] args) {
        for (int quantity : new int[]{0, 2}) {
            try {
                check(quantity);
                System.out.println("accepted " + quantity);
            } catch (IllegalArgumentException error) {
                System.out.println(error.getMessage());
            }
        }
    }
}`, 'bad quantity\naccepted 2'),
    ],
    guided: javaExample('动手观察失败时赋值没有完成', [
      '注意调用者执行 available = use(available, quantity)。右侧函数先计算完，左侧才收到结果。如果右侧抛出异常，整个赋值没有完成，已有库存仍是原值。若方法内先改共享字段，这个保证就不成立，所以检查必须先做。',
      '库存从 3 开始，尝试领 4 失败后输出 denied，库存仍为 3，第二次领 1 得到 2。把第二个申请改为 3，先手算再运行，最终库存为 0。',
      '综合题将两种错误分开。小于 1 属于参数不合法，超过已有库存属于当前状态不允许。先按这个顺序布置两个判断，最后才返回剩余库存。',
    ], `public class Main {
    static int use(int stock, int quantity) {
        if (quantity > stock) throw new IllegalStateException("denied");
        return stock - quantity;
    }

    public static void main(String[] args) {
        int available = 3;
        for (int quantity : new int[]{4, 1}) {
            try {
                available = use(available, quantity);
                System.out.println("left " + available);
            } catch (IllegalStateException error) {
                System.out.println(error.getMessage() + " " + available);
            }
        }
    }
}`, 'denied 3\nleft 2'),
  },
  'model-service': {
    prepare: [
      javaExample('让对象拥有自己的字段，服务按编号寻找', [
        '设备模型保存设备的固定编号和可变化的借用人。final String id 初始化后不能换成其他编号，String borrower 则可以随着借还变化。把类写作 Main 里面的 static class 是为了在站内单文件运行，使用 new Equipment("cam-1") 仍像使用其他普通类一样。',
        '服务的 Map 用编号找到 Equipment 对象。Map 中保存的是对象引用，取出的 item 和 Map 里的对象相同。改变 item.borrower 后，重新从 Map 查到的也会看到新值。private 修饰 Map 表示外部入口不直接改表，改动通过服务方法。',
        '读下面输出，第一次只取对象并查看，第二次给取出的对象赋值后再次查看。这个例子展示引用变化，正式操作还要在赋值前检查是否允许借出。',
      ], `import java.util.Map;
import java.util.LinkedHashMap;

public class Main {
    static class Equipment {
        final String id;
        String borrower;
        Equipment(String id) { this.id = id; }
    }

    public static void main(String[] args) {
        Map<String, Equipment> items = new LinkedHashMap<>();
        Equipment camera = new Equipment("cam-1");
        items.put(camera.id, camera);
        Equipment found = items.get("cam-1");
        System.out.println(found.borrower);
        found.borrower = "Mei";
        System.out.println(items.get("cam-1").borrower);
    }
}`, 'null\nMei'),
    ],
    guided: javaExample('动手检查校验先于状态修改', [
      '服务借用方法先按编号找到模型，随后判断对象是否已借出。可以用两个早退出形成一条清楚的成功路径。Map.of 让示例直接得到一个键为 cam 的固定索引，已有 Equipment 对象的借用人仍可变化。本例暂时用布尔值解释成功和失败，下一题会把失败改为有原因的异常。',
      '先运行，给 Mei 借相机成功，Gao 再借结果是 false，原借用人仍为 Mei。把第二次请求的编号改为 missing，预期仍是 false 与 Mei。可以用这份输入检查是否遗漏判空。',
      '项目里测试驱动使用了变量 request 和 () -> 的写法，把借用操作交给给定函数代为执行。这部分已经写好，只需要补全借还方法。保留驱动打印的状态和历史，用它观察两次失败之后数据是否保持。',
    ], `import java.util.Map;

public class Main {
    static class Equipment {
        String borrower;
    }

    static boolean tryBorrow(Map<String, Equipment> items, String id, String person) {
        Equipment item = items.get(id);
        if (item == null) return false;
        if (item.borrower != null) return false;
        item.borrower = person;
        return true;
    }

    public static void main(String[] args) {
        Equipment camera = new Equipment();
        Map<String, Equipment> items = Map.of("cam", camera);
        System.out.println(tryBorrow(items, "cam", "Mei"));
        System.out.println(tryBorrow(items, "cam", "Gao"));
        System.out.println(camera.borrower);
    }
}`, 'true\nfalse\nMei'),
  },
} satisfies Workshop


const algorithmWorkshops = {
  recursion: {
    prepare: [
      jsExample('先用计数循环理解左闭右开', [
        'JavaScript 数组下标从 0 开始，length 是元素数，也是数组末尾之后的第一个边界。区间 [left, right) 的意思是下标从 left 开始，到 right 之前停止。用它遍历数组片段时，起点为 left，判断条件写 i < right，不会读取边界 right。',
        'for (let i = left; i < right; i++) 括号内有三个部分，依次为设置初值、每轮前的继续条件、每轮后的更新。下面遍历下标 1、2，将 5 与 7 相加。把右边界改为 2，就只读 5。若两端同为 2，循环体一次也不进入，结果仍是 0。',
        '先习惯用这段代码核对一个区间究竟包含哪些项。之后拆成左右两半时，检查两个区间合起来是否仍让每个下标恰好被访问一次。',
      ], `function sumLoop(values, left, right) {
  let total = 0;
  for (let i = left; i < right; i++) {
    total += values[i];
  }
  return total;
}
console.log(sumLoop([4, 5, 7], 1, 3));
console.log(sumLoop([4, 5, 7], 2, 2));`, '12\n0'),
    ],
    guided: jsExample('动手记录递归进入的每一个区间', [
      '同一个函数可以在自己的函数体里调用自己。每次调用都会有自己的 left、right 和 middle。下面在每次进入区间时先输出两个端点。主调用暂时等着左侧返回，再计算右侧，最后得到两个小结果的和。',
      '先运行。首行 0,3 随后拆成 0,1 与 1,3。0,1 含一项，直接交回答案。1,3 又拆成 1,2 与 2,3。把末尾的右边界改成 2，预期依次看到 0,2、0,1、1,2，最后总和 6。',
      '正式练习中无需打印追踪。遇到卡顿先拿掉大数组，只保留长度 0 和 1，检查是否直接返回。若同一个区间不断出现，说明某次调用没有变成更小的问题。',
    ], `function sumRange(values, left, right) {
  console.log(left + "," + right);
  if (left === right) return 0;
  if (right - left === 1) return values[left];

  const middle = Math.floor((left + right) / 2);
  const leftSum = sumRange(values, left, middle);
  const rightSum = sumRange(values, middle, right);
  return leftSum + rightSum;
}
console.log(sumRange([4, 2, 7], 0, 3));`, '0,3\n0,1\n1,3\n1,2\n2,3\n13'),
  },
  'merge-sort': {
    prepare: [
      jsExample('先用切片拆分，再用字段比较', [
        '数组的 slice(start, end) 会新建一份浅拷贝，读取从 start 开始到 end 之前的项，原数组的顺序不会被改变。省略 end 表示一直取到结尾。这里的浅拷贝会共享里面每条记录，所以归并时只要复制记录到结果数组，不必改动任何记录的字段。',
        '一个记录用花括号写成对象。id 是身份，key 是排序时要比较的字段。取 left[0].id 需要先从数组取一条记录，再读取该条记录的字段。使用不同 id 的相等记录，才能观察排序是否稳定。接下来的双指针写法中 left[i++] 读取当前 i 对应的元素，然后再增加 i。',
        '试着改 middle 为 1，预期左边只剩 A，右边为 B、C、D。按题目倒回 middle 为 2 后，左、右各两项。这个拆分不会排序，排序发生在递归返回后。',
      ], `const rows = [
  { id: "A", key: 3 }, { id: "B", key: 1 },
  { id: "C", key: 3 }, { id: "D", key: 2 },
];
const middle = 2;
const left = rows.slice(0, middle);
const right = rows.slice(middle);
console.log(left[0].id + "," + left.length);
console.log(right[0].id + "," + right.length);
console.log(rows[1].key);`, 'A,2\nC,2\n1'),
    ],
    guided: jsExample('动手手算并追踪一次双指针合并', [
      '试着画两个队首 i 和 j。每次比较 left[i].key 与 right[j].key，只将选中半段的下标自增。while 会在每轮重新判断边界，只要任意一段用完就退出。此时再沿未完成的那半段追加剩余记录。',
      '下面两半已经排好，比较的先后为 1 与 2、3 与 2、3 与 3，结果 B,D,A,C。把比较运算从 <= 换成 <，同键的 C 会抢到 A 前面，输出变为 B,D,C,A。恢复 <= 可让测试通过。',
      '进入正式练习时，sort 已经负责拆段和两次递归。只需实现 merge。给单侧空数组试一次，可以核对你是否漏掉了复制剩余项的循环。',
    ], `function merge(left, right) {
  const result = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i].key <= right[j].key) {
      result.push(left[i].id);
      i++;
    } else {
      result.push(right[j].id);
      j++;
    }
  }
  while (i < left.length) result.push(left[i++].id);
  while (j < right.length) result.push(right[j++].id);
  return result.join(",");
}
console.log(merge([{ id: "B", key: 1 }, { id: "A", key: 3 }],
                  [{ id: "D", key: 2 }, { id: "C", key: 3 }]));`, 'B,D,A,C'),
  },
  'prefix-sums': {
    prepare: [
      jsExample('先逐项写出前缀数组的下标', [
        '计算前 i 项总量时，以 0 作为最短前缀。prefix[i + 1] 由 prefix[i] 与 values[i] 相加。这个加法里两个 i 的意思不同，一个数的是已经累计多少项，一个是下一个要读取的位置。画两行下标标记有助于看清它们的关系。',
        '对 [4, 0, 6]，依次得到 0、4、4、10，第二项为 0，所以两个累计结果相同。push 将新累计值追加到数组最后；这个过程中不需要知道数组的最终长度就能逐步构造。',
        '试着把头部读数从 4 改为 3，手算整表应变为 0,3,3,9。若 values 为空，for 循环一次也不运行，prefix 仍保留唯一的 0。',
      ], `const values = [4, 0, 6];
const prefix = [0];
for (let i = 0; i < values.length; i++) {
  const next = prefix[i] + values[i];
  prefix.push(next);
}
console.log(prefix.join(","));`, '0,4,4,10'),
    ],
    guided: jsExample('动手比对直接扫描和前缀差', [
      '为了核对前缀计算，可以先用普通循环算同一区间。下例先检查 0 ≤ left ≤ right ≤ 元素数。通过之后，扫描以 i < right 控制停止，从 prefix[right] 减 prefix[left]。两种实现独立，读数不对时比较它们有助于定位边界错误。',
      '先运行，结果 6 6 表示两种方法一致。把范围改成 [0, 3)，预期 10 10。再执行 [1, 1)，应得到 0 0。把两端互换为 [3, 1)，预期打印 invalid range。',
      '正式练习把构建函数交给你，下方的主程序负责给它送入同一个数组上的不同端点。留意区间允许右端等于 values.length，这对应前缀表的最后一项。',
    ], `function show(values, prefix, left, right) {
  if (!Number.isInteger(left) || !Number.isInteger(right) ||
      left < 0 || left > right || right > values.length) {
    console.log("invalid range");
    return;
  }
  let sum = 0;
  for (let i = left; i < right; i++) sum += values[i];
  console.log(sum + " " + (prefix[right] - prefix[left]));
}
show([4, 0, 6], [0, 4, 4, 10], 1, 3);`, '6 6'),
  },
  'operation-counts': {
    prepare: [
      jsExample('在真正发生操作的地方计数', [
        '实现计数前，先写一句精确定义。本例把一次 number >= target 比较记一次，循环的长度判断和计数器自己的更新均不计入。计数器就写在这条比较之前，程序走到这里时递增一次。',
        '同一个查找会因输入变化而做不同次数的比较。列表 [2, 4, 7, 9] 从头查找第一项至少为 6 的数字，先比 2，再比 4，第三次才命中 7。break 会退出循环，后面的 9 不再计入。',
        '先跑现成示例。把 target 改成 10，应显示 value=none comparisons=4。将它改成 2，应在第一次比较后就停止。见到输出不对时，用打印 i 的方式核对实际比较了哪些项。',
      ], `const values = [2, 4, 7, 9];
const target = 6;
let comparisons = 0;
let found = "none";
for (let i = 0; i < values.length; i++) {
  comparisons++;
  if (values[i] >= target) {
    found = values[i];
    break;
  }
}
console.log("value=" + found + " comparisons=" + comparisons);`, 'value=7 comparisons=3'),
    ],
    guided: jsExample('动手追踪一次查询，分别记三本账', [
      '这里保留构建加法、扫描加法、查询减法三项。构建对每个原值只做一次加法，扫描只在指定区间内加，查询前缀仅做一次减法。先读主程序，再看计数器各自在哪个循环里递增。',
      '运行原例，合计是 7，费用分别为构建 4、扫描 2、查询 1。把 right 改成 4，再运行，合计变成 11，扫描次数增加至 3，另外两个计数不变。',
      '下一步在同一份前缀表上加入若干次查询，构建只执行一次。每次先检查两种方法算出的值是否一致，再把每次扫描与减法的次数分别累加。这样就能比较查询数量变化后哪部分成本变化。',
    ], `const values = [2, 3, 4, 4];
const prefix = [0];
let buildAdds = 0;
for (const value of values) {
  prefix.push(prefix[prefix.length - 1] + value);
  buildAdds++;
}
const left = 1;
const right = 3;
let scan = 0;
let scanAdds = 0;
for (let i = left; i < right; i++) {
  scan += values[i];
  scanAdds++;
}
const indexed = prefix[right] - prefix[left];
const querySubtracts = 1;
console.log(scan + " " + indexed);
console.log(buildAdds + "," + scanAdds + "," + querySubtracts);`, '7 7\n4,2,1'),
  },
} satisfies Workshop

export const languageWorkshops: Workshop = { ...cWorkshops, ...javaWorkshops, ...algorithmWorkshops }

