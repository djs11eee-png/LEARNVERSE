import { advancedCourseCatalog, computerSystemsCatalog, courseCatalog, courseProgression, intermediateCourseCatalog } from './courseCatalog';
import type { LearningDirection } from './courseCatalog';
import { computerScienceRoute, majorRoutes } from './majorRoutes';

export interface LearningRoute {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
  milestoneCourseIds?: string[];
}

export interface KnowledgeDomain {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  prerequisites: string;
  routeId: string;
  courseIds: string[];
  resourceIds: string[];
}

const js = courseCatalog.javascript.id;
const py = courseCatalog.python.id;
const levels = (direction: LearningDirection) => courseProgression(direction).map(({ id }) => id);
const learningPaths = {
  programming: levels('python'),
  ai: [py, ...levels('ai')],
  algorithms: [js, ...levels('computerScience'), ...levels('algorithms')],
  computerScience: computerScienceRoute.courseIds,
  iot: [courseCatalog.c.id, intermediateCourseCatalog.c.id, computerSystemsCatalog.architecture.id, computerSystemsCatalog.iotProtocols.id],
  robotics: [js, ...levels('ros')],
  web: [
    js, courseCatalog.web.id,
    intermediateCourseCatalog.javascript.id, intermediateCourseCatalog.web.id,
    advancedCourseCatalog.javascript.id, advancedCourseCatalog.web.id,
    ...levels('backend'),
  ],
  software: [js, ...levels('computerScience'), ...levels('java'), ...levels('backend')],
  tools: levels('javascript'),
};

export const routes: LearningRoute[] = [
  {
    id: 'programming-foundations',
    title: '从 Python 开始编程',
    description: '用 Python 编写第一个学习清单，再练习整理记录，做出自己的数据处理程序。',
    courseIds: learningPaths.programming,
  },
  {
    id: 'ai-foundations',
    title: '语言模型入门',
    description: '以 Python 为编程主轴，从分词和任务描述起步，逐步练习检索、引用、拒答和回归评测。',
    courseIds: learningPaths.ai,
  },
  {
    id: 'algorithmic-thinking',
    title: '算法入门',
    description: '先学数组、循环和函数，再从查找、排序走到递归、前缀和与图上的最短路径。',
    courseIds: learningPaths.algorithms,
  },
  {
    id: 'computer-science',
    title: '计算机科学入门',
    description: computerScienceRoute.description,
    courseIds: learningPaths.computerScience,
    milestoneCourseIds: computerScienceRoute.milestoneCourseIds,
  },
  {
    id: 'iot-embedded',
    title: '物联网与嵌入式起步',
    description: '沿 C 语言、位运算传感帧解包、寄存器 I/O 走到物联网主题路由、心跳超时与边缘网关背压。',
    courseIds: learningPaths.iot,
  },
  {
    id: 'robotics',
    title: '机器人与具身智能',
    description: '保留原汁原味的 3 门 ROS 2 虚拟观测站课程，从节点、话题、服务和动作走到联调、重试、背压与故障回放。',
    courseIds: learningPaths.robotics,
  },
  {
    id: 'web-development',
    title: 'Web 开发起步',
    description: '用 HTML、CSS 和 JavaScript 组织页面，练习异步状态、键盘操作和可重试的后端接口。',
    courseIds: learningPaths.web,
  },
  {
    id: 'software-engineering',
    title: '软件开发实践起步',
    description: '练习组织对象、定义接口和验证结果，再用可替换依赖、事务及故障回放检验服务。',
    courseIds: learningPaths.software,
  },
  {
    id: 'technical-toolkit',
    title: '代码编辑与调试',
    description: '从运行短程序和查看报错开始，再练习分组排序、异步任务与可重复的状态测试。',
    courseIds: learningPaths.tools,
  },
];

export function getLearningRoute(id: string | null): LearningRoute | undefined {
  return majorRoutes.find(route => route.id === id) ?? routes.find(route => route.id === id);
}

export function routeMapPath(route: LearningRoute) {
  const domain = domains.find(item => item.routeId === route.id);
  return `/explore/${domain?.id ?? route.id}`;
}

export const domains: KnowledgeDomain[] = [
  {
    id: 'programming',
    title: '编程基础',
    shortTitle: '编程',
    description: '用代码表达想法，从控制流和函数学起，再理解内存与数据表示。',
    prerequisites: '准备一台电脑和浏览器即可。初学者可以从 Python 开始。',
    routeId: 'programming-foundations',
    courseIds: learningPaths.programming,
    resourceIds: ['python-tutorial-cn', 'exercism', 'cs50'],
  },
  {
    id: 'ai',
    title: '人工智能',
    shortTitle: 'AI 与大模型',
    description: '以 Python 为起点，了解语言模型如何处理文本，练习给出清楚的任务、证据引用与结果核验。',
    prerequisites: '零基础可直接从 Python 起步；进阶检索与评测模拟器在浏览器直接运行，具备任意语言循环和函数基础即可读懂。',
    routeId: 'ai-foundations',
    courseIds: learningPaths.ai,
    resourceIds: ['huggingface-llm', 'roadmap', 'ossu'],
  },
  {
    id: 'algorithms',
    title: '算法与数据结构',
    shortTitle: '算法',
    description: '比较不同的查找、排序和数据组织方式，分析它们的时间和空间开销。',
    prerequisites: '可以先用纸笔理解算法。做站内编程题前，建议掌握 JavaScript 数组、循环和函数。',
    routeId: 'algorithmic-thinking',
    courseIds: learningPaths.algorithms,
    resourceIds: ['hello-algo', 'oi-wiki', 'ossu', 'exercism'],
  },
  {
    id: 'computer-science',
    title: '计算机科学',
    shortTitle: '计算机科学',
    description: '学习计算原理和问题求解，了解现代软件的基础知识。',
    prerequisites: '概念可以直接阅读。编程题用 JavaScript，C 代码在本机实验室运行。',
    routeId: 'computer-science',
    courseIds: learningPaths.computerScience,
    resourceIds: ['ossu', 'roadmap'],
  },
  {
    id: 'iot',
    title: '物联网与嵌入式',
    shortTitle: '物联网',
    description: '从 C 语言位运算与传感帧解包到寄存器 I/O，再用浏览器模拟器验证传感通信协议与网关背压。',
    prerequisites: '零基础从 C 语言编程起步开始；组成原理与传感通信协议模拟器直接在浏览器运行，无需额外开发板。',
    routeId: 'iot-embedded',
    courseIds: learningPaths.iot,
    resourceIds: ['cs50-c', 'roadmap'],
  },
  {
    id: 'robotics',
    title: '机器人与具身智能',
    shortTitle: '机器人与具身智能',
    description: '兴趣与拓展路线：完整保留 3 门 ROS 2 课程，了解机器人节点如何通过话题、服务、动作与可靠性回放协同工作。',
    prerequisites: '站内使用浏览器模拟器运行虚拟观测站，无需安装 ROS 2。有基本数组与函数概念即可上手。',
    routeId: 'robotics',
    courseIds: learningPaths.robotics,
    resourceIds: ['ros2', 'roadmap'],
  },
  {
    id: 'web-development',
    title: 'Web 开发',
    shortTitle: 'Web 开发',
    description: '用 HTML、CSS 和 JavaScript 编写网页，再学习服务端开发。',
    prerequisites: '准备浏览器。动手接入页面事件前，先学 JavaScript 的基本条件、函数和对象。',
    routeId: 'web-development',
    courseIds: learningPaths.web,
    resourceIds: ['mdn-javascript-cn', 'vue-cn', 'roadmap', 'freecodecamp'],
  },
  {
    id: 'software-engineering',
    title: '软件工程',
    shortTitle: '软件工程',
    description: '实践如何组织程序和服务、用版本控制协作，并在项目中落实开发规范。',
    prerequisites: '建议掌握编程基础，并至少做过一个小项目。',
    routeId: 'software-engineering',
    courseIds: learningPaths.software,
    resourceIds: ['ossu', 'roadmap'],
  },
  {
    id: 'tools',
    title: '技术与工具',
    shortTitle: '开发工具',
    description: '搭建开发环境，学习编写代码、管理版本和交付软件所用的工具。',
    prerequisites: '需要一台能安装代码编辑器和版本控制工具的电脑。',
    routeId: 'technical-toolkit',
    courseIds: learningPaths.tools,
    resourceIds: ['roadmap', 'exercism'],
  },
];
