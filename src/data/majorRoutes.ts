import { courseCatalog as intro, intermediateCourseCatalog as next, advancedCourseCatalog as advanced, computerSystemsCatalog as systems } from './courseCatalog'

export interface MajorRoute {
  id: string
  title: string
  english: string
  group: string
  color: string
  description: string
  courseIds: string[]
  milestoneCourseIds?: string[]
  topics: string[]
}

// Each route links to the shared catalog. Topics describe future specialisms
// separately, so progress always counts courses that can actually be taken.
function major(
  code: string, title: string, english: string, group: string, color: string,
  description: string, courses: { id: string }[], topics: string[],
): MajorRoute {
  return { id: `major-${code}`, title, english, group, color, description,
    courseIds: courses.map(course => course.id), topics }
}

const computerScienceCore = [
  intro.javascript, intro.computerScience, next.computerScience,
  intro.algorithms, next.algorithms, advanced.algorithms, intro.c, next.c, advanced.c,
]

export const computerScienceRoute: MajorRoute = {
  ...major('080901', '计算机科学与技术', 'Computer Science and Technology', '计算与软件', '#b6ebae',
    '从第一段程序走到数据表示、算法与指令执行，再用模拟器检查操作系统如何调度任务、隔离内存和恢复数据。',
    [...computerScienceCore, systems.architecture, advanced.computerScience, systems.operatingSystems], []),
  // Foundation + intermediate milestone includes all non-Advanced courses on 080901, including Computer Architecture.
  milestoneCourseIds: [...computerScienceCore, systems.architecture]
    .filter(course => course.difficulty !== 'Advanced')
    .map(course => course.id),
}

export const majorRoutes: MajorRoute[] = [
  computerScienceRoute,
  major('080902', '软件工程', 'Software Engineering', '计算与软件', '#86dcba',
    '用 Java 组织程序，再为后端服务编写接口、测试和恢复逻辑。', [
      intro.java, next.java, advanced.java, intro.javascript, intro.backend, next.backend, advanced.backend,
    ], ['需求分析与建模', '团队协作与软件交付']),
  major('080903', '网络工程', 'Network Engineering', '网络与安全', '#73cbdc',
    '从浏览器发出的请求开始，观察消息如何抵达服务并在失败后重试。', [
      intro.javascript, intro.backend, intro.ros, next.ros,
    ], ['TCP/IP 与路由实验', '网络配置与运维']),
  major('080904', '信息安全', 'Information Security', '网络与安全', '#9abdf7',
    '学习输入校验、数据约束和内存边界，为保护应用中的信息打基础。', [
      intro.javascript, intro.backend, next.backend, intro.c, next.c, advanced.c,
    ], ['身份认证与授权', '安全设计与审计']),
  major('080905', '物联网工程', 'Internet of Things Engineering', '智能与工程', '#eed590',
    '从 C 语言与位运算传感帧解包起步，理解寄存器与内存映射 I/O，再在浏览器模拟传感协议的 QoS、心跳与背压。', [
      intro.c, next.c, systems.architecture, systems.iotProtocols,
    ], ['单片机外设与中断实验（需硬件板卡）']),
  major('080906', '数字媒体技术', 'Digital Media Technology', '媒体与空间', '#e7a6bd',
    '从网页中的内容、样式和交互开始，把一个想法做成可操作的界面。', [
      intro.javascript, intro.web, next.javascript, next.web, advanced.web,
    ], ['计算机图形学', '音视频处理']),
  major('080907', '智能科学与技术', 'Intelligence Science and Technology', '智能与工程', '#b8a7f2',
    '以 Python 数据处理与流水线为主轴，结合大语言模型原理、检索引用与可靠性评估建立智能系统基础。', [
      intro.python, intro.ai, intro.pythonPractice, next.ai, advanced.python, advanced.ai,
    ], ['机器学习数学与模型训练', '计算机视觉实验']),
  major('080908', '空间信息与数字技术', 'Spatial Information and Digital Technology', '媒体与空间', '#dea78d',
    '用 Python 整理观测数据，再学习查找与路径计算。', [
      intro.python, intro.pythonPractice, intro.javascript, intro.algorithms, next.algorithms, advanced.algorithms,
    ], ['地理信息系统（GIS）', '空间数据分析']),
  major('080909', '电子与计算机工程', 'Electronics and Computer Engineering', '智能与工程', '#c2c779',
    '从二进制与 C 语言起步，经结构体、位运算传感帧与计算机组成原理，走到动态内存与有限资源管理。', [
      intro.computerScience, intro.c, next.c, systems.architecture, advanced.c,
    ], ['数字逻辑电路', '软硬件协同与板级实验']),
  major('080910', '数据科学与大数据技术', 'Data Science and Big Data Technology', '数据与服务', '#8aced9',
    '以 Python 为主轴串联 SQLite 多表查询、事务一致性与可重跑数据处理流水线，无需先学 JavaScript。', [
      intro.python, intro.backend, intro.pythonPractice, next.backend, advanced.python,
    ], ['概率统计分析', '分布式大数据处理']),
  major('080911', '网络空间安全', 'Cyberspace Security', '网络与安全', '#90a7f1',
    '从 Web 服务的数据流出发，理解服务如何验证输入、保持一致并从故障中恢复。', [
      intro.javascript, intro.web, intro.backend, next.backend, advanced.backend,
    ], ['网络攻防与防护', '安全监测与事件响应']),
  major('080912', '新媒体技术', 'New Media Technology', '媒体与空间', '#eca8aa',
    '让内容在网页上响应读者的操作，再用数据整理和筛选信息。', [
      intro.javascript, intro.web, next.javascript, next.web,
    ], ['交互叙事设计', '媒体数据分析']),
  major('080913', '电影制作', 'Film Production', '媒体与空间', '#e6ae85',
    '从 Python 文件与数据处理起步，为管理数字素材建立编程基础。', [
      intro.python, intro.pythonPractice, advanced.python,
    ], ['数字影像与声音工程', '剪辑与后期流程']),
  major('080914', '保密技术', 'Confidentiality Technology', '网络与安全', '#a7aff0',
    '追踪一条信息从输入到保存的过程，练习校验记录和管理程序资源。', [
      intro.c, next.c, intro.javascript, intro.backend, next.backend,
    ], ['信息分级保护', '访问控制与安全审计']),
  major('080915', '服务科学与工程', 'Service Science and Engineering', '数据与服务', '#98d4c8',
    '从一次服务请求出发，让业务流程在数据变化和重复提交时仍能正确执行。', [
      intro.java, next.java, intro.javascript, intro.backend, next.backend, advanced.backend,
    ], ['服务系统建模', '业务流程编排设计']),
  major('080916', '虚拟现实技术', 'Virtual Reality Technology', '媒体与空间', '#d8a6e4',
    '先让对象响应用户操作，学习管理交互状态，为实时场景打基础。', [
      intro.javascript, intro.web, next.javascript, next.web, advanced.javascript,
    ], ['三维图形与实时渲染', '空间交互技术']),
  major('080917', '区块链工程', 'Blockchain Engineering', '数据与服务', '#96c3ec',
    '从数据结构和交易记录入手，理解并发时怎样保持记录一致。', [
      intro.javascript, intro.algorithms, intro.backend, next.backend, advanced.backend,
    ], ['分布式共识协议', '智能合约与账本安全']),
  major('080918', '密码科学与技术', 'Cryptographic Science and Technology', '网络与安全', '#9bade1',
    '先练习数据表示、算法和成本分析，再进入密码学所需的数学基础。', [
      intro.javascript, intro.computerScience, intro.algorithms, next.algorithms,
    ], ['离散数学与初等数论', '现代密码学实现']),
  major('080919', '工业软件', 'Industrial Software', '智能与工程', '#d5c697',
    '从设备通信和程序可靠性起步，结合 ROS 2 观测站与 C 结构化工程检查消息与故障恢复。', [
      intro.javascript, intro.ros, next.ros, advanced.ros, intro.c, next.c,
    ], ['工业建模与离散仿真', '工程软件架构设计']),
]
