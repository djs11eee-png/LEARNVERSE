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

export const courseSummaries = Object.values(courseCatalog)
export type { CourseSummary }

