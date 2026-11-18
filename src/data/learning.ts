export interface LearningRoute {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
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

export const routes: LearningRoute[] = [
  {
    id: 'programming-foundations',
    title: '编程入门',
    description: '先用 Python 理解数据、控制流和函数，再通过进阶练习巩固；也可以从 C 或 Java 补充语言基础。',
    courseIds: ['lv-python-foundations', 'lv-python-practice', 'lv-c-foundations', 'lv-java-foundations'],
  },
  {
    id: 'ai-foundations',
    title: '语言模型入门',
    description: '了解文本如何变成 token，练习描述任务并核验生成结果。',
    courseIds: ['lv-ai-foundations', 'lv-python-foundations'],
  },
  {
    id: 'algorithmic-thinking',
    title: '算法入门',
    description: '从计算机科学基础入手，练习查找、排序与算法复杂度。',
    courseIds: ['lv-computer-science', 'lv-algorithms-foundations'],
  },
  {
    id: 'computer-science',
    title: '计算机科学入门',
    description: '从计算思维和数据表示入手，继续学习 C 语言与算法基础。',
    courseIds: ['lv-computer-science', 'lv-c-foundations', 'lv-algorithms-foundations'],
  },
  {
    id: 'robotics',
    title: '机器人通信入门',
    description: '以虚拟观测站学习 ROS 2 的节点、话题、服务和动作。',
    courseIds: ['lv-ros2-foundations', 'lv-python-foundations'],
  },
  {
    id: 'web-development',
    title: 'Web 开发起步',
    description: '了解 HTML 和 CSS，用 JavaScript 处理数据与交互，再学习请求如何到达后端。',
    courseIds: ['lv-web-foundations', 'lv-javascript-foundations', 'lv-backend-foundations'],
  },
  {
    id: 'software-engineering',
    title: '软件开发实践起步',
    description: '从程序与测试出发，学习怎样组织对象、定义接口并验证结果。',
    courseIds: ['lv-computer-science', 'lv-java-foundations', 'lv-backend-foundations'],
  },
  {
    id: 'technical-toolkit',
    title: '开发工具先修',
    description: '先学习 JavaScript 基础，开发工具课程正在准备中。',
    courseIds: ['lv-javascript-foundations'],
  },
];

export const domains: KnowledgeDomain[] = [
  {
    id: 'programming',
    title: '编程基础',
    shortTitle: '编程',
    description: '用代码表达想法，从控制流和函数学起，再理解内存与数据表示。',
    prerequisites: '准备一台电脑和浏览器即可。初学者可以从 Python 开始。',
    routeId: 'programming-foundations',
    courseIds: ['lv-python-foundations', 'lv-python-practice', 'lv-c-foundations', 'lv-java-foundations', 'lv-javascript-foundations'],
    resourceIds: ['python-tutorial-cn', 'exercism', 'cs50'],
  },
  {
    id: 'ai',
    title: '人工智能',
    shortTitle: 'AI 与大模型',
    description: '了解语言模型如何处理文本，练习给出清楚的任务和核验输出。',
    prerequisites: '概念、示例与练习可以在浏览器内完成，熟悉 Python 有助于扩展应用。',
    routeId: 'ai-foundations',
    courseIds: ['lv-ai-foundations', 'lv-python-foundations'],
    resourceIds: ['huggingface-llm', 'roadmap', 'ossu'],
  },
  {
    id: 'algorithms',
    title: '算法与数据结构',
    shortTitle: '算法',
    description: '比较不同的查找、排序和数据组织方式，分析它们的时间和空间开销。',
    prerequisites: '建议掌握基本编程和数组操作，可以先学习计算机科学基础。',
    routeId: 'algorithmic-thinking',
    courseIds: ['lv-computer-science', 'lv-algorithms-foundations'],
    resourceIds: ['hello-algo', 'oi-wiki', 'ossu', 'exercism'],
  },
  {
    id: 'computer-science',
    title: '计算机科学',
    shortTitle: '计算机科学',
    description: '学习计算原理和问题求解，了解现代软件的基础知识。',
    prerequisites: '初学者可以直接开始，准备浏览器即可。',
    routeId: 'computer-science',
    courseIds: ['lv-computer-science', 'lv-c-foundations', 'lv-algorithms-foundations'],
    resourceIds: ['ossu', 'roadmap'],
  },
  {
    id: 'robotics',
    title: '机器人与工程',
    shortTitle: '机器人',
    description: '了解机器人软件如何通过节点、话题、服务和动作交换消息。',
    prerequisites: '站内课程使用虚拟观测站示例，学习通信概念无需安装 ROS 2。',
    routeId: 'robotics',
    courseIds: ['lv-ros2-foundations', 'lv-python-foundations'],
    resourceIds: ['ros2', 'roadmap'],
  },
  {
    id: 'web-development',
    title: 'Web 开发',
    shortTitle: 'Web 开发',
    description: '用 HTML、CSS 和 JavaScript 编写网页，再学习服务端开发。',
    prerequisites: '准备浏览器和代码编辑器，按入门课程的说明搭建环境。',
    routeId: 'web-development',
    courseIds: ['lv-web-foundations', 'lv-javascript-foundations', 'lv-backend-foundations'],
    resourceIds: ['mdn-javascript-cn', 'vue-cn', 'roadmap', 'freecodecamp'],
  },
  {
    id: 'software-engineering',
    title: '软件工程',
    shortTitle: '软件工程',
    description: '实践如何组织程序和服务、用版本控制协作，并在项目中落实开发规范。',
    prerequisites: '建议掌握编程基础，并至少做过一个小项目。',
    routeId: 'software-engineering',
    courseIds: ['lv-computer-science', 'lv-java-foundations', 'lv-backend-foundations'],
    resourceIds: ['ossu', 'roadmap'],
  },
  {
    id: 'tools',
    title: '技术与工具',
    shortTitle: '开发工具',
    description: '搭建开发环境，学习编写代码、管理版本和交付软件所用的工具。',
    prerequisites: '需要一台能安装代码编辑器和版本控制工具的电脑。',
    routeId: 'technical-toolkit',
    courseIds: ['lv-javascript-foundations'],
    resourceIds: ['roadmap', 'exercism'],
  },
];
