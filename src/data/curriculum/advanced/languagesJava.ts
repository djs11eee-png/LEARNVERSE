import type { AdvancedTrack, CourseProject } from '../types'
import { check, demo, exercise, lesson, step } from './languagesAuthoring'

const javaLessons = [
  lesson({
    id: 'generic-types',
    title: '用泛型写可复用的类型安全容器',
    summary: '让库管理学生和书籍等不同类型，将键和值的类型检查交给编译器。',
    primer: { lead: '同一套登记规则可以拿来存图书或练习单，但查到的值应保留原来的身份。模板上的类型位置就是这个约定。', terms: [['类型参数', '在类、接口或方法声明中代表调用者选定的类型。'], ['类型实参', '使用泛型时具体填入的类型，如 String。'], ['类型界限', '规定实际类型至少具备哪些方法或关系。']] },
    objectives: ['区分类级类型参数与方法级类型参数', '用 Map<K,V> 实现可复用关系', '按类型检查和缺失路径验证服务'],
    sections: [
      demo('java', '用同一个 Box 放不同类型', [
        '在 class Box<T> 中，T 是每个实例建立时选定的类型。字段和返回方法都使用 T，因此 new Box<String> 得到的是专门存文本的盒子。左边已经写明类型时，构造右侧可用 <> 让编译器推导。编译器拒绝把字符串塞进 Box<Integer>，你不必运行到读取时才发现错误。',
        '类的定义可以用 T 声明多个成员。调用者的 get() 返回具体的 String 或 Integer，无须先接收 Object 再强制转换。运行下方例子，尝试把数字 12 换成 13，第二行预期 26。整数作为泛型实参时用包装类型 Integer。',
      ], `public class Main {
    static class Box<T> {
        private final T value;
        Box(T value) { this.value = value; }
        T get() { return value; }
    }

    public static void main(String[] args) {
        Box<String> book = new Box<>("Atlas");
        Box<Integer> count = new Box<>(12);
        System.out.println(book.get());
        System.out.println(count.get() * 2);
    }
}`, 'Atlas\n24'),
      step('用多个参数表示键和值的关系',
        '当一个结构同时管理键和值，用 Catalog<K,V> 分别表示它们。字段声明 Map<K,V>，构造 LinkedHashMap<> 作为实现。put 接收 K 和 V，get 接收 K、交回 V。两条约定一起保护关系，例如不能把书的库存数字传给根据 String 找书名的方法。',
        'Java 不让 List<Integer> 直接赋给 List<Number>。假如这样做，调用方可以把小数加到原本只允许 Integer 的清单里。当前课程用精确的类型参数即可。若方法对每一项只读而允许多个子类型，可另用通配符声明它需要什么，但本项目不会要求你写通配符。',
        '声明静态方法时，它没有某个实例提供类级 T。若需要在方法上复用某些类型，写成 static <T> T first(List<T> items)。位置在返回类型之前。若必须调用 T 特有的方法，则用 extends 加界限，让编译器知道允许调用什么。'),
      demo('java', '动手让泛型方法处理两类数组', [
        'firstOr 只读取数组首项，无需了解类型。因此课程使用独立方法参数 <T>，调用提供数组和同类型的备用值。空数组交回备用值，正常数组交回首项。String[] 和 Integer[] 对应两次独立类型选择。',
        '先运行，再把 names 的两项都移掉，预期第一行变成 unknown。练习类型检查时，可将调用写成 String first = firstOr(names, "unknown")。此时把备用值改为 99，编译器会拒绝把结果保证为 String。项目把缺失记录表示为 null，再转成业务提示。',
      ], `public class Main {
    static <T> T firstOr(T[] values, T fallback) {
        if (values.length == 0) return fallback;
        return values[0];
    }

    public static void main(String[] args) {
        String[] names = {"Ada", "Mei"};
        Integer[] inventory = {};
        System.out.println(firstOr(names, "unknown"));
        System.out.println(firstOr(inventory, 0));
    }
}`, 'Ada\n0'),
    ],
    pitfalls: [
      { mistake: '用原始类型 Map 保存任意对象。', why: '键值契约变弱，可能延迟到执行时才发现类型错误。', fix: '把调用方和字段声明都写成明确的 Map<K,V>。' },
      { mistake: '只用名字判断书籍记录唯一。', why: '合法的不同版本可以同名。', fix: '让稳定的书籍编号作为键。' },
    ],
    practice: { prompt: '完成泛型 Catalog 的 save 和 find。新增或更新同一个键，并让不存在的键返回 null。', checkpoints: ['两条同名书按不同编号并存。', '更新编号 b1 不影响 b2，缺失编号返回 null。'], hints: ['查找关系通常用一个 Map 字段。', '模板已经提供 LinkedHashMap<K,V>，save 用 put，find 用 get。'], solution: '保留键和值的泛型类型，在 save 写入键值、在 find 直接按同类型键查询。' },
    questions: [
      check('ja1-parameter', 'Box<Integer> 的 get 返回哪种类型？', ['Object', 'String', 'Integer', '值的运行时转换错误'], 2, '使用时指定了 T 为 Integer。'),
      check('ja1-fields', 'Catalog<String,Integer> 的键和值分别是什么？', ['String 和 Integer', 'Integer 和 String', 'String 和 String', '任意对象'], 0, '两个类型实参按声明顺序绑定。'),
      check('ja1-static', '在静态泛型方法中，<T> 通常放哪里？', ['参数列表之后', '返回类型之前', '类声明的最后一行', '方法名内'], 1, '在方法头中先声明该方法自己的类型参数。'),
      check('ja1-primitive', '泛型列表存整数应声明成什么？', ['List<int>', 'List<true>', 'List<Integer[]>', 'List<Integer>'], 3, 'Java 泛型类型实参需要引用类型，使用 Integer。'),
    ],
    exercise: exercise('java', `import java.util.LinkedHashMap;
import java.util.Map;

public class Main {
    static class Catalog<K, V> {
        private final Map<K, V> rows = new LinkedHashMap<>();

        void save(K key, V value) { /* 写入 */ }
        V find(K key) { return null; }
    }

    public static void main(String[] args) {
        Catalog<String, String> books = new Catalog<>();
        books.save("b1", "Atlas");
        books.save("b2", "Atlas");
        System.out.println(books.find("b1") + "/" + books.find("b2"));
        books.save("b1", "World Atlas");
        System.out.println(books.find("b1") + "/" + books.find("b2"));
        System.out.println(books.find("missing"));
    }
}`, 'void save(K key, V value) { /* 写入 */ }\n        V find(K key) { return null; }',
      'void save(K key, V value) { rows.put(key, value); }\n        V find(K key) { return rows.get(key); }',
      'Atlas/Atlas\nWorld Atlas/Atlas\nnull', ['同名不同编号', '更新指定编号', '缺失编号']),
  }),
  lesson({
    id: 'interface-substitution',
    title: '按接口调用，并在测试中替换实现',
    summary: '用同一服务接口连接内存和替身实现，让调用者专注于行为。',
    primer: { lead: '借阅柜台需要查「某个编号是否存在」。它可以查纸表，也可以查电脑，柜台只关心结果的约定。', terms: [['接口', '列出调用方可以依赖的方法签名和行为。'], ['实现', '通过 implements 提供接口方法。'], ['替身', '测试中可替换具体依赖的简单实现。']] },
    objectives: ['使用 interface 和 implements 声明合同', '通过构造方法传入依赖', '分辨接口替换与状态共享'],
    sections: [
      demo('java', '让登记服务只依赖查询合同', [
        '下面 Search 提供一个方法 lookup。接口的方法约定按照书号交回标题，未找到则交回 null。实现 FixedShelf 时用 implements 声明合同，并标记 @Override，使编译器能发现误写的参数列表。公开实现写 public，因为接口方法对调用者公开。',
        'Desk 的字段类型是 Search，构造时可接收任何该接口的实现。处理查询时它发出同一调用，不去猜实际类是哪一种。把输入改成 b2 时，FixedShelf 找不到记录，预期显示 missing。合同约束使错误在配置和实现阶段都更容易定位。',
      ], `public class Main {
    interface Search {
        String lookup(String id);
    }

    static class FixedShelf implements Search {
        @Override
        public String lookup(String id) {
            return "b1".equals(id) ? "Atlas" : null;
        }
    }

    static class Desk {
        private final Search search;
        Desk(Search search) { this.search = search; }
        String show(String id) {
            String title = search.lookup(id);
            return title == null ? "missing" : title;
        }
    }

    public static void main(String[] args) {
        Desk desk = new Desk(new FixedShelf());
        System.out.println(desk.show("b1"));
        System.out.println(desk.show("missing"));
    }
}`, 'Atlas\nmissing'),
      step('拆分服务决定与外部资料来源',
        '如果服务内部直接 new 一份仓库，每次测试都被绑到同一个实现。用构造器接收接口之后，由入口在创建服务时装配依赖。正常运行提供内存仓库，测试提供固定返回值的替身。业务类本身无需知道哪里读书籍数据。',
        '替身也应遵守接口契约。若查不到约定返回 null，替身也要明确交回 null。测试不能为了通过而假装一个非法结果有效。可以给两个测试各自新建仓库，避免上一个测试写入的内容影响下一个。',
        'Java 的类可以实现多个接口，但这里仅需要单个查找合同。用一个行为明确的依赖比同时注入所有配置更好测试。下一章会使用同样的方法处理当前时刻，避免依赖设备真实时钟来验证到期边界。',
        '可用同一编号做一对照。给一份有 b1 的仓库和一份空仓库分别创建 Desk，查询代码完全一致，却应显示不同结果。若把地图写成 static 字段，两份服务可能意外读同一张表。测试这种对照也在保护私有字段不会跨实例共享。'),
      demo('java', '动手给同一个谓词换资料来源', [
        '下面 contains 不关心书名是什么，只问仓库有没有编号。PresentShelf 给出一条合法记录，EmptyShelf 对任何编号都找不到。试着把第二次调用改为 new PresentShelf() 并查询 b1，预期第二行变成 true。',
        '在章末练习中，正式实现从泛型 Map 查找。服务和测试仍通过接口类型拿依赖。用空架、正常架、查询不存在的编号分别检查避免走错支线。',
      ], `public class Main {
    interface Lookup {
        String get(String id);
    }

    static class PresentShelf implements Lookup {
        public String get(String id) { return "b1".equals(id) ? "Atlas" : null; }
    }
    static class EmptyShelf implements Lookup {
        public String get(String id) { return null; }
    }

    static boolean contains(Lookup shelf, String id) {
        return shelf.get(id) != null;
    }

    public static void main(String[] args) {
        System.out.println(contains(new PresentShelf(), "b1"));
        System.out.println(contains(new EmptyShelf(), "b1"));
    }
}`, 'true\nfalse'),
    ],
    pitfalls: [
      { mistake: '服务直接创建唯一一种实现。', why: '测试很难用另一种输入来源驱动边界。', fix: '让构造器接收接口。' },
      { mistake: '把具体仓库强制转型来调用内部帮助方法。', why: '替换实现后该假设可能不成立。', fix: '只使用已声明的方法和契约。' },
    ],
    practice: { prompt: '完成 Desk.open，按给定合同向传入的 Repository 查询图书并返回提示。', checkpoints: ['正式仓库有 b1 时输出 Atlas。', '同一个编号在空仓库，以及未知编号均输出 not found。'], hints: ['构造器已经传入 repository，不必在 open 里创建新容器。', '先看 get 返回值，再区分 null 和已找到的字符串。'], solution: '直接调用接口的 get。空值走缺失分支，普通结果作为标题返回。' },
    questions: [
      check('ja2-interface', '输入依赖类型写接口的直接好处是什么？', ['字符串会排序', '可以替换为另一种符合合同的实现', '自动保存数据', '字段一定不可变'], 1, '调用方通过共同接口使用不同实现。'),
      check('ja2-override', '@Override 有什么作用？', ['把 public 改为 private', '运行时修改名字', '要求编译器确认正在实现或重写方法', '自动编写方法体'], 2, '有签名不一致时能提前发现。'),
      check('ja2-contract', '仓库约定缺失返回 null，测试替身也应怎样？', ['对缺失返回 null', '永远返回假标题', '删除方法', '自动随机选择返回值'], 0, '替身应遵守生产接口的行为合同。'),
      check('ja2-dependency', '在哪一处给 Desk 安装测试专用仓库？', ['lookup 结束后', '修改接口名字', '给 Desk 增加打印语句', '创建 Desk 时传给构造函数'], 3, '装配依赖是创建服务时的步骤。'),
    ],
    exercise: exercise('java', `import java.util.Map;

public class Main {
    interface Repository<K, V> {
        V get(K id);
    }

    static class MemoryShelf implements Repository<String, String> {
        private final Map<String, String> books;
        MemoryShelf(Map<String, String> books) { this.books = books; }
        public String get(String id) { return books.get(id); }
    }

    static class EmptyShelf implements Repository<String, String> {
        public String get(String id) { return null; }
    }

    static class Desk {
        private final Repository<String, String> repository;
        Desk(Repository<String, String> repository) { this.repository = repository; }
        String open(String id) {
            /* 补全查询 */
            return "TODO";
        }
    }

    public static void main(String[] args) {
        Desk desk = new Desk(new MemoryShelf(Map.of("b1", "Atlas")));
        System.out.println(desk.open("b1"));
        System.out.println(desk.open("missing"));
        System.out.println(new Desk(new EmptyShelf()).open("b1"));
    }
}`, '/* 补全查询 */\n            return "TODO";', `String title = repository.get(id);
            return title == null ? "not found" : title;`,
      'Atlas\nnot found\nnot found', ['查到图书', '未知编号', '替换为空仓库']),
  }),


  lesson({
    id: 'ordering-and-clock',
    title: '定义稳定顺序并注入可控时钟',
    summary: '用比较器排序截止时间，用固定时钟练习预约边界。',
    primer: { lead: '预约单既要按到期日摆放，也要知道此刻是哪一刻。前者有比较规则，后者可从给定时钟获得。', terms: [['Comparator<T>', '告诉排序怎样比较两条 T 类型记录。'], ['稳定排序', '当比较结果为 0 时保留原来的顺序。'], ['Clock', '本课定义的分钟时钟接口，测试可显式设置返回值。']] },
    objectives: ['用比较器表达一个主键与并列规则', '用注入的时钟判断预约期限', '检查期限边界和加法上限'],
    sections: [
      demo('java', '让同截止时刻保持登记顺序', [
        '用 Comparator.comparingLong 传入提取键的函数。写成 booking -> booking.ending，可以读成「拿到一条 booking，返回它的 ending」。这是一条简短函数，Java 会从 sort 的列表元素类型理解参数类型。比较器出现通常需要 import java.util.Comparator。',
        'List.sort 属于稳定排序。示例先登记 Z，再登记 A，两条截止相同，排序后仍是 Z,A。B 的时刻较早所以在两条之前。把 A 的结束时间改成 4，手算它应移到最前。如果业务希望同刻按房间编号，则可加 thenComparing 明确另一个键；本题保留先提交的顺序。',
      ], `import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class Main {
    static class Slot {
        final String id;
        final long ending;
        Slot(String id, long ending) { this.id = id; this.ending = ending; }
    }

    public static void main(String[] args) {
        List<Slot> slots = new ArrayList<>(List.of(new Slot("Z", 9), new Slot("A", 9), new Slot("B", 6)));
        slots.sort(Comparator.comparingLong(slot -> slot.ending));
        for (Slot slot : slots) System.out.println(slot.id);
    }
}`, 'B\nZ\nA'),
      step('用时钟接口表达区间的左右边界',
        '把预约区间定义为 [开始, 截止)。创建在第 100 分钟、有效 30 分钟，截止保存 130，当前时间只在小于 130 时有效。129 可以，130 已到期。不要用 <=，否则会错误多保留一分钟。测试中选择 129、130 和 131 正好可以覆盖边界两侧。',
        '业务不要直接调用系统时刻。用 interface Clock { long now(); } 作为构造依赖。生产环境可以提供真实实现，当前项目以 ManualClock 保存整数分钟。测试随时设置它的 now 值，不等待系统时间，设定相同输入就能得到相同结果。',
        '加法前检查当前时间不小于零且不大于 Long.MAX_VALUE - 持续时长。若直接计算接近 Long.MAX_VALUE 的和，结果可能变成负数。边界校验通过了再计算截止时间。一次业务操作读时钟一次，整个操作就共享同一个 now。'),
      demo('java', '动手将假时钟拨到过期边界', [
        '下面的 ManualClock 实现 Clock，设置 time 后 now 返回指定值。hasTime 依赖这个合同检查剩余有效性。同一个截止，在 129 时为 true，刚好 130 时为 false。将第二次时钟设为 131，输出保持 false。',
        '到综合题先分别写有效与到期输出，再补 now 为空间上限时的处理。排序和时钟解决不同问题。按时间显示有序不意味着所有记录仍有效，查询时要先按当前时钟筛选再排序。',
      ], `public class Main {
    interface Clock { long now(); }

    static class ManualClock implements Clock {
        long time;
        public long now() { return time; }
    }

    static boolean hasTime(Clock clock, long ending) {
        return clock.now() < ending;
    }

    public static void main(String[] args) {
        ManualClock clock = new ManualClock();
        clock.time = 129;
        System.out.println(hasTime(clock, 130));
        clock.time = 130;
        System.out.println(hasTime(clock, 130));
    }
}`, 'true\nfalse'),
    ],
    pitfalls: [
      { mistake: '相同截止时间再按姓名排序。', why: '如果约定按登记先后，额外键会改变用户看到的顺序。', fix: '只比较截止时间并使用稳定排序。' },
      { mistake: '比较器用两条 long 时刻直接相减再转为 int。', why: '相减或收窄可能产生错误大小关系。', fix: '使用 comparingLong 或 Long.compare。' },
    ],
    practice: { prompt: '完成 ending，合法时钟加上给定时长，返回预约截止。最后两组测试应分别拒绝无效时钟与溢出。', checkpoints: ['100+30 为 130，0+30 为 30。', '负时刻和 Long.MAX_VALUE 均返回 -1。'], hints: ['先定义合法时钟取值范围。', '用 Long.MAX_VALUE - duration 作加法之前的上界。'], solution: '先读一次 Clock，通过非负与可加检查后相加。-1 只作错误状态，不与合法时间重合。' },
    questions: [
      check('ja3-stable', '两条同截止记录先登记 Z 后登记 A，稳定按截止排序后的顺序？', ['A Z', 'Z A', '自动按名字', '不能排序'], 1, '比较相等的记录保持相对顺序。'),
      check('ja3-clock', '有效区间右端不包含，在截止时刻 130 效果是？', ['仍占用一整天', '到期，无效', '取决于名字', '系统随机'], 1, '条件为 now < 130。'),
      check('ja3-why', '测试提前设置时间的优势是什么？', ['只需真实等一分钟', '自动跳过校验', '不用创建对象', '可按精确时刻反复验证'], 3, '假时钟可重复重放边界，无需真实等待。'),
      check('ja3-over', '固定加 30 之前，时钟应不超过哪里？', ['Long.MAX_VALUE - 30', 'Long.MAX_VALUE + 30', 'Long.MIN_VALUE - 30', '不需要上界'], 0, '先减出安全上限可以避免执行溢出加法。'),
    ],
    exercise: exercise('java', `public class Main {
    interface Clock { long now(); }
    static class ManualClock implements Clock {
        long minute;
        public long now() { return minute; }
    }

    static long ending(Clock clock, long duration) {
        /* 计算安全的截止时刻 */
        return -1;
    }

    public static void main(String[] args) {
        ManualClock clock = new ManualClock();
        for (long minute : new long[]{100, 0, -1, Long.MAX_VALUE}) {
            clock.minute = minute;
            System.out.println(ending(clock, 30));
        }
    }
}`, '/* 计算安全的截止时刻 */\n        return -1;', `long now = clock.now();
        if (duration <= 0 || now < 0 || now > Long.MAX_VALUE - duration) return -1;
        return now + duration;`, '130\n30\n-1\n-1', ['普通截止时刻', '从零开始', '负时刻', '加法超界']),
  }),
  lesson({
    id: 'service-tests',
    title: '为预约服务测试时间、顺序与拒绝路径',
    summary: '用可替换仓库和固定时钟验证预约失败之后状态仍一致。',
    primer: { lead: '预约一次成功，只说明走通了一条路。还要确认占用中的书不会被换人，到期时恰好重新开放。', terms: [['布置', '为一个用例设置图书、时钟和已有预约。'], ['执行', '调用真实服务入口，提交一条请求或查询。'], ['核对', '检查返回值以及可公开读取的状态。']] },
    objectives: ['构建互相独立的用例', '分别验证占用、到期和拒绝后状态', '保持请求结果可重复'],
    sections: [
      demo('java', '先执行操作，再调用断言帮助函数', [
        '不依赖外部测试库也能记录期望。下面 check 接收实际和值，若不一致抛 AssertionError。帮测试定位的标签可以包含刚才操作的名字。把断言和实际操作分开，错误出现时容易看清哪一步出了问题。',
        '小例先给空房间登记 Mei，然后试 Gao。处理成功后再检查相冲突的请求。将 check 的 expected 从 Mei 临时换成 Gao，程序会指出 owner changed。这个检查验证了数据，弥补只观察 busy 返回值的不足。',
      ], `public class Main {
    static class Slot {
        String owner;
        String reserve(String person) {
            if (owner != null) return "busy";
            owner = person;
            return "ok";
        }
    }

    static void check(String label, String actual, String expected) {
        if (!expected.equals(actual)) throw new AssertionError(label + ": " + actual);
    }

    public static void main(String[] args) {
        Slot slot = new Slot();
        String first = slot.reserve("Mei");
        check("first reservation", first, "ok");
        String second = slot.reserve("Gao");
        check("duplicate reservation", second, "busy");
        check("owner changed", slot.owner, "Mei");
        System.out.println("checks passed");
    }
}`, 'checks passed'),
      step('通过公开入口验证状态，与消息同时验收',
        '面向预约服务时，先建立内存书库和假时钟，再建立一份新的服务。正常请求之后核对查询显示某位用户预约成功。冲突之后除核对 busy，还要重新读取已预约人员和截止。未来若增加内部字段，行为不变，测试无需猜测具体存储形式。',
        '到期边界可用一次预约和三个时刻完成。先在 100 建预约，时钟移到 129 读取仍有效，再到 130 查为空，最后尝试发一条新的预约请求。把记录放在公开状态和时钟共同决定的场景里，比仅检查某个 if 分支更接近真实使用。',
        '失效记录可以延迟到下一条合法请求时替换，纯查询无需写入。任一无效请求不应改变活动预约或列表顺序。用不同用例重新布置依赖，能避免前一个测试留下的状态影响后续断言。使用同一服务对象的情况应该由用例明确描述。',
        '假设仓库同名两本书先登记 b2、再登记 b1，截止都为 130。只比活动数量抓不住按编号错误重排，只比第一条状态也抓不住后面的变化。应断言完整公开列表及顺序，并在失败请求之后复查同一列表。'),
      demo('java', '动手检查预约可以在截止时重开', [
        '这个精简版按 now >= expires 放开预约。两次占用测试共享同一个 Hold 来观察它的生命周期。按时间 100、129、130 顺序处理，预期 ok、busy、ok。',
        '把 129 改成 130，第二次预约会成功，第三次同一时刻就应 busy。试着先手算，留意就算数字未增加，第二次成功也改变了截止。章末题要自己写这一小段状态提交；最终项目还会注入仓库和时钟。',
      ], `public class Main {
    static class Hold {
        long expires = 0;
        String reserve(long now) {
            if (now < expires) return "busy";
            expires = now + 30;
            return "ok";
        }
    }

    public static void main(String[] args) {
        Hold hold = new Hold();
        System.out.println(hold.reserve(100));
        System.out.println(hold.reserve(129));
        System.out.println(hold.reserve(130));
    }
}`, 'ok\nbusy\nok'),
    ],
    pitfalls: [
      { mistake: '只检查冲突请求是否返回 busy。', why: '错误实现仍可能改掉原预约人。', fix: '失败后再查预约人、时刻与顺序。' },
      { mistake: '多个不相关的测试共享一份可变仓库。', why: '失败可能由上一个用例泄漏的状态造成。', fix: '每个独立用例重新建立依赖。' },
    ],
    practice: { prompt: '补全 Hold.reserve：拒绝空白人名和未到期的冲突，允许刚到期时预约。测试驱动会打印每步后的状态。', checkpoints: ['100 时 Mei 成功，到 129 Gao 冲突且状态保持。', '130 的空白申请被拒绝，同一时刻 Gao 合法申请成功。'], hints: ['先校验人名，再查看当前时刻是否尚未到期。', '失败分支直接返回，统一在成功路径更新 owner 和 expires。'], solution: '先处理无效参数和有效占用，之后为合法用户写入姓名与固定 30 分钟截止。' },
    questions: [
      check('ja4-usecase', '怎样最直接证明抢占失败不改变预约？', ['只记录运行时间', '再从公开查询读取原人的预约', '清空仓库', '再次创建同名用户'], 1, '核对同一服务的公开状态才能区分正确拒绝和偷偷改数据。'),
      check('ja4-arrange', '什么时候用新建服务对象？', ['不同用例需要互不影响时', '同一个预约生命周期每一步都重建', '需要看已存在预约时', '从不重建'], 0, '重新布置隔离彼此无关的场景。'),
      check('ja4-time', '想找出右端是否被错误算成有效，最关键的测试时刻是？', ['初次登记之前', '很久以后', '恰好截止', '任一随机时刻'], 2, '截止附近能区别 < 和 <=。'),
      check('ja4-clean', '无效请求之后通常应核对什么？', ['消息长度', 'JDK 路径', '源码行数', '返回值与已有预约状态和顺序'], 3, '状态校验与业务返回值同样重要。'),
    ],
    exercise: exercise('java', `public class Main {
    static class Hold {
        String owner;
        long expires;

        String reserve(String person, long now) {
            /* 实现校验和提交 */
            return "TODO";
        }

        String snapshot() { return owner + "," + expires; }
    }

    static void show(Hold hold, String person, long now) {
        String status = hold.reserve(person, now);
        System.out.println(status + " " + hold.snapshot());
    }

    public static void main(String[] args) {
        Hold hold = new Hold();
        show(hold, "Mei", 100);
        show(hold, "Gao", 129);
        show(hold, " ", 130);
        show(hold, "Gao", 130);
    }
}`, '/* 实现校验和提交 */\n            return "TODO";', `if (person == null || person.isBlank()) return "invalid";
            if (owner != null && now < expires) return "busy";
            owner = person.strip();
            expires = now + 30;
            return "ok";`, 'ok Mei,130\nbusy Mei,130\ninvalid Mei,130\nok Gao,160',
      ['初次预约', '占用尚未结束', '失败不改变状态', '边界可重新预约']),
  }),
]

const library = exercise('java', `import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;

public class Main {
    interface Clock { long now(); }
    interface Repository<K, V> { V get(K id); }

    static class ManualClock implements Clock {
        long minute;
        public long now() { return minute; }
    }

    static class Shelf implements Repository<String, String> {
        private final Map<String, String> titles = Map.of("b1", "Atlas", "b2", "Atlas");
        public String get(String id) { return titles.get(id); }
    }

    static class Hold {
        final String id;
        final String person;
        final long expires;
        Hold(String id, String person, long expires) {
            this.id = id;
            this.person = person;
            this.expires = expires;
        }
        String summary() { return id + ":" + person + "@" + expires; }
    }

    static class Library {
        private static final long DURATION = 30;
        private final Repository<String, String> books;
        private final Clock clock;
        private final Map<String, Hold> holds = new LinkedHashMap<>();

        Library(Repository<String, String> books, Clock clock) {
            this.books = books;
            this.clock = clock;
        }

        String reserve(String book, String person) { return "TODO"; }
        String active() { return "[]"; }
    }

    static void show(Library library, String title, String result) {
        System.out.println(title + " " + result + " " + library.active());
    }

    public static void main(String[] args) {
        ManualClock clock = new ManualClock();
        Library library = new Library(new Shelf(), clock);
        clock.minute = 100;
        show(library, "start", library.reserve("b2", " Mei "));
        show(library, "same-end", library.reserve("b1", "Gao"));
        show(library, "busy", library.reserve("b2", "Ada"));
        show(library, "invalid", library.reserve("b1", " "));
        show(library, "missing", library.reserve("b9", "Mei"));
        clock.minute = 129;
        System.out.println("before " + library.active());
        clock.minute = 130;
        System.out.println("expired " + library.active());
        show(library, "retry", library.reserve("b2", "Ada"));
        clock.minute = Long.MAX_VALUE;
        String overflow = library.reserve("b1", "Gao");
        clock.minute = 130;
        show(library, "overflow", overflow);
    }
}`, 'String reserve(String book, String person) { return "TODO"; }\n        String active() { return "[]"; }', `String reserve(String book, String person) {
            if (book == null || book.isBlank() || person == null || person.isBlank()) return "invalid";
            if (books.get(book) == null) return "not found";
            long now = clock.now();
            if (now < 0 || now > Long.MAX_VALUE - DURATION) return "bad clock";
            Hold current = holds.get(book);
            if (current != null && now < current.expires) return "busy";
            holds.remove(book);
            holds.put(book, new Hold(book, person.strip(), now + DURATION));
            return "ok";
        }

        String active() {
            long now = clock.now();
            ArrayList<Hold> ordered = new ArrayList<>();
            for (Hold hold : holds.values()) {
                if (now < hold.expires) ordered.add(hold);
            }
            ordered.sort(Comparator.comparingLong(hold -> hold.expires));
            ArrayList<String> lines = new ArrayList<>();
            for (Hold hold : ordered) lines.add(hold.summary());
            return lines.toString();
        }`, [
  'start ok [b2:Mei@130]',
  'same-end ok [b2:Mei@130, b1:Gao@130]',
  'busy busy [b2:Mei@130, b1:Gao@130]',
  'invalid invalid [b2:Mei@130, b1:Gao@130]',
  'missing not found [b2:Mei@130, b1:Gao@130]',
  'before [b2:Mei@130, b1:Gao@130]',
  'expired []',
  'retry ok [b2:Ada@160]',
  'overflow bad clock [b2:Ada@160]',
].join('\n'), ['首次预约', '同截止的稳定顺序', '冲突不修改', '无效姓名', '无此图书', '截止之前', '恰到截止', '过期后重约', '拒绝溢出'])

const project: CourseProject = {
  title: '图书预约服务',
  summary: '按编号预约图书，以可控时钟验证到期、稳定展示和失败后状态。',
  requirements: [
    '每个已知编号在任一时刻最多有一份有效预约，预约持续 30 分钟。拒绝空白姓名与编号、未知编号、已被占用和非法时钟，失败保持原数据。',
    'Clock 和 Repository<K,V> 已提供，通过它们读时钟并查图书。标题相同的图书仍按独立编号处理。姓名保存前去除两端空白。',
    'active 过滤已过期预约，按截止时间升序显示，同截止时按本次预约提交顺序。旧预约过期后可以替换，重约按一次新提交处理。',
    '使用模板自带时钟和输出驱动。保留各用例的顺序与快照规则，不等待真实时间。',
  ],
  examples: [
    { label: '同书名不同编号', input: '100 分钟先预约 b2 给 Mei，再预约 b1 给 Gao', expected: '[b2:Mei@130, b1:Gao@130]' },
    { label: '重复预约、未知书号或空白姓名', input: '预约尚未到期，此时对 b2 再预约，或传 b9、空白姓名', expected: '分别 busy、not found、invalid，状态仍为原两条' },
    { label: '精确到期边界', input: '在 129 与 130 分钟查询，再于 130 给 Ada 重约 b2', expected: '129 仍为两条，130 为空，重约后得到 [b2:Ada@160]' },
    { label: '时钟加法超界', input: '当前位置已经是 Long.MAX_VALUE 时创建预约', expected: 'bad clock，回到 130 时原有可用记录仍相同' },
  ],
  exercises: [{ ...library, title: '实现预约与活动预约查询', downloadName: 'Main.java' }],
  explanation: '预约操作在所有检查通过后落位，过期的旧条目只在合法替换时移除并重新登记。查询只读取并筛选有效预约，稳定比较保留同刻下原始登记次序。',
}

export const advancedJava: AdvancedTrack = { direction: 'java', lessons: javaLessons, project }

