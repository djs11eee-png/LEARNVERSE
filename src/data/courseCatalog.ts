import type { Difficulty } from './resources'

interface CourseSummary {
  id: string
  title: string
  description: string
  category: string
  difficulty: Difficulty
  language: 'Chinese (Simplified)'
}

function summary(
  id: string,
  title: string,
  category: string,
  description: string,
  difficulty: Difficulty = 'Beginner',
): CourseSummary {
  return { id, title, category, description, difficulty, language: 'Chinese (Simplified)' }
}

// Keep the catalog lightweight so the homepage doesn't load lesson text.
export const courseCatalog = {
  python: summary('lv-python-foundations', 'Python 编程起步', 'Python', '从变量、条件和循环开始，用函数组织一个简单的学习计划。'),
  javascript: summary('lv-javascript-foundations', 'JavaScript 编程起步', 'JavaScript', '学习变量、条件、数组与函数，用代码处理网页交互中的数据。'),
  computerScience: summary('lv-computer-science', '计算机科学基础', 'Computer Science', '理解数据如何表示，尝试查找和组织数据，并用测试检查程序行为。'),
  c: summary('lv-c-foundations', 'C 语言编程起步', 'C Language', '阅读一个 C 程序，练习整数、控制流、函数与数组。'),
  algorithms: summary('lv-algorithms-foundations', '算法与数据结构入门', 'Algorithms', '从数组开始，练习查找、排序、栈和队列。'),
  web: summary('lv-web-foundations', 'Web 前端基础', 'Frontend Development', '用 HTML 组织内容，用 CSS 设置样式，再用 JavaScript 添加交互。'),
  pythonPractice: summary('lv-python-practice', 'Python 官方教程 · 进阶练习', 'Python', '根据 Python 官方教程改编的六章站内课程。用学习清单练习遍历、容器、函数、模块与异常处理，适合完成 Python 起步课后继续学习。', 'Intermediate'),
  java: summary('lv-java-foundations', 'Java 编程起步', 'Java', '从一个学习时长统计程序起步，练习类型、循环、方法和对象。'),
  backend: summary('lv-backend-foundations', '后端开发基础', 'Backend Development', '从一条课程查询请求入手，理解 HTTP、数据校验、存储与测试。'),
  ai: summary('lv-ai-foundations', '大语言模型入门', 'AI & LLM', '从文本如何变成 token 学起，用小例子理解文本生成、任务说明与结果核验。'),
  ros: summary('lv-ros2-foundations', 'ROS 2 通信基础', 'ROS2 & Robotics', '以虚拟环境观测站为例，理解节点、话题、服务与动作。阅读与练习无需安装 ROS 2。'),
}

export type CourseDirection = keyof typeof courseCatalog
export type LearningDirection = Exclude<CourseDirection, 'pythonPractice'>

export const intermediateCourseCatalog = {
  javascript: summary('lv-javascript-data', 'JavaScript 数据处理实战', 'JavaScript', '从对象记录出发，把筛选、分组与排序组合成可测试的数据处理流程。', 'Intermediate'),
  computerScience: summary('lv-computer-science-cost', '计算机科学进阶：数据与查找成本', 'Computer Science', '约定数据如何表示，建立有序索引，比较一次查找和反复查询的成本。', 'Intermediate'),
  c: summary('lv-c-records', 'C 语言进阶：结构体、文件与位运算', 'C Language', '用结构体、定长数组和文件流管理记录，掌握位运算传感帧解包与 scanf 安全衔接。', 'Intermediate'),
  algorithms: summary('lv-algorithms-efficiency', '算法进阶：把重复工作变少', 'Algorithms', '从递归到归并排序与前缀和，用操作次数比较不同解法的成本。', 'Intermediate'),
  web: summary('lv-web-interaction', '原生 Web 交互进阶', 'Frontend Development', '用表单和数据驱动界面，让任务可以编辑、筛选并通过键盘操作。', 'Intermediate'),
  java: summary('lv-java-collections', 'Java 进阶：集合与程序分工', 'Java', '用集合、异常和分工明确的类组织一个可验证的借还登记程序。', 'Intermediate'),
  backend: summary('lv-backend-consistency', '后端进阶：数据一致性与接口测试', 'Backend Development', '从接口约定出发，用多表查询和事务保持预约数据一致。', 'Intermediate'),
  ai: summary('lv-ai-grounded-qa', '大模型进阶：带资料的问答与评估', 'AI & LLM', '练习拆分资料、关键词检索和证据引用，再用固定样本诊断错误。', 'Intermediate'),
  ros: summary('lv-ros2-integration', 'ROS 2 进阶：通信联调与故障排查', 'ROS2 & Robotics', '用确定的事件回放检查连接、超时和动作状态，定位观测站故障。', 'Intermediate'),
} satisfies Record<Exclude<LearningDirection, 'python'>, CourseSummary>

export const advancedCourseCatalog = {
  python: summary('lv-python-pipeline', 'Python 高级：可维护的数据处理流水线', 'Python', '用迭代器、类型化记录和可重跑的测试处理逐行输入，输出报告和错误清单。', 'Advanced'),
  javascript: summary('lv-javascript-async-state', 'JavaScript 高级：异步任务与可预测状态', 'JavaScript', '跟踪异步任务的结果与失败，约束并发数，并用可控制的时间线排查旧响应。', 'Advanced'),
  computerScience: summary('lv-computer-science-cache', '计算机科学高级：缓存局部性与成本模型', 'Computer Science', '通过访问序列比较缓存策略，计算命中和失效带来的成本。', 'Advanced'),
  c: summary('lv-c-memory', 'C 语言高级：动态内存与资源管理', 'C Language', '明确内存所有权与容量边界，安全增长记录缓冲区，并用失败用例检查资源回收。', 'Advanced'),
  algorithms: summary('lv-algorithms-graph', '算法高级：图搜索与最短路径', 'Algorithms', '用邻接表、广度优先搜索和优先队列求路径，用边界用例与小图核对结果。', 'Advanced'),
  web: summary('lv-web-accessible-state', 'Web 前端高级：状态管理与可访问交互', 'Frontend Development', '把界面状态、焦点与异步反馈写成可测试规则，用键盘核对完整操作流程。', 'Advanced'),
  java: summary('lv-java-tested-design', 'Java 高级：泛型、接口与可测试设计', 'Java', '用泛型表达类型契约，通过接口和可控依赖验证服务在失败路径中的行为。', 'Advanced'),
  backend: summary('lv-backend-reliability', '后端高级：幂等、并发与故障恢复', 'Backend Development', '用唯一约束、事务与事件回放验证重复请求、并发修改和中断恢复。', 'Advanced'),
  ai: summary('lv-ai-retrieval-evaluation', '大模型高级：检索质量与可靠性评测', 'AI & LLM', '量化检索、引用与拒答表现，用固定样本比较版本和定位退步。', 'Advanced'),
  ros: summary('lv-ros2-reliability', 'ROS 2 高级：观测、恢复与可靠性验证', 'ROS2 & Robotics', '使用合成事件测量读数延迟、队列积压与重试，验证故障之后的恢复。', 'Advanced'),
} satisfies Record<LearningDirection, CourseSummary>

export const computerSystemsCatalog = {
  architecture: summary('lv-computer-architecture', '计算机组成原理', 'Computer Science', '用浏览器模拟寄存器、指令执行和内存读写，拼出一台可诊断的微型计算机。', 'Intermediate'),
  operatingSystems: summary('lv-operating-systems', '操作系统：调度、内存与恢复', 'Computer Science', '用事件回放验证进程调度、地址隔离和文件提交，交付一个可从中断中恢复的作业模拟器。', 'Advanced'),
  iotProtocols: summary('lv-iot-protocols', '物联网传感通信协议', 'IoT & Embedded', '从 16 位传感帧解码出发，验证主题路由、QoS 兼容、设备心跳超时与边缘网关背压。', 'Advanced'),
}

export function courseProgression(direction: LearningDirection) {
  const intermediate = direction === 'python' ? courseCatalog.pythonPractice : intermediateCourseCatalog[direction]
  return [courseCatalog[direction], intermediate, advancedCourseCatalog[direction]] as const
}

const progressions = (Object.keys(advancedCourseCatalog) as LearningDirection[]).map(courseProgression)

const additionalPrerequisites: Partial<Record<string, CourseSummary[]>> = {
  [computerSystemsCatalog.architecture.id]: [courseCatalog.javascript, courseCatalog.computerScience],
  [computerSystemsCatalog.operatingSystems.id]: [computerSystemsCatalog.architecture],
  [computerSystemsCatalog.iotProtocols.id]: [intermediateCourseCatalog.c, computerSystemsCatalog.architecture],
}

export function getRelatedCourses(courseId: string) {
  const prerequisites = additionalPrerequisites[courseId]
  if (prerequisites) return [
    ...prerequisites.map(course => ({ course, label: '先修课程' })),
    ...(courseId === computerSystemsCatalog.architecture.id
      ? [
          { course: advancedCourseCatalog.computerScience, label: '下一站' },
          { course: computerSystemsCatalog.operatingSystems, label: '航线终点' },
          { course: computerSystemsCatalog.iotProtocols, label: '物联网延伸' },
        ]
      : []),
  ]
  for (const [foundation, intermediate, advanced] of progressions) {
    if (courseId === foundation.id) return [{ course: intermediate, label: '继续进阶' }]
    if (courseId === intermediate.id) return [
      { course: foundation, label: '先修课程' },
      { course: advanced, label: '继续学习高级课' },
    ]
    if (courseId === advanced.id) return [{ course: intermediate, label: '先修课程' }]
  }
  return []
}

export const courseSummaries = [
  ...Object.values(courseCatalog),
  ...Object.values(intermediateCourseCatalog),
  ...Object.values(advancedCourseCatalog),
  ...Object.values(computerSystemsCatalog),
]
export type { CourseSummary }

