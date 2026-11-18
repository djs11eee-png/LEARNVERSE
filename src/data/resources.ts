export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export const categoryLabels: Record<string, string> = {
  'AI & LLM': '人工智能与大语言模型',
  Algorithms: '算法',
  'Backend Development': '后端开发',
  'C Language': 'C 语言',
  'Computer Science': '计算机科学',
  'Data Structures': '数据结构',
  'Frontend Development': '前端开发',
  Java: 'Java',
  JavaScript: 'JavaScript',
  Programming: '编程',
  Python: 'Python',
  'ROS2 & Robotics': 'ROS 2 与机器人',
  'Technology & Tools': '技术与工具',
}

export const difficultyLabels: Record<Difficulty, string> = {
  Beginner: '入门',
  Intermediate: '进阶',
  Advanced: '高级',
}

export const languageLabels: Record<string, string> = {
  English: '英文',
  'Chinese (Simplified)': '简体中文',
}

export interface Resource {
  id: string
  title: string
  description: string
  category: string
  difficulty: Difficulty
  language: string
  source: string
  sourceUrl: string
  githubUrl?: string
  license: string
  redistributionStatus: string
  tags: string[]
  updatedAt: string
  audience: string
  author: string
}

const checkedAt = '2026-11-17'
type ResourceEntry = Omit<Resource, 'updatedAt' | 'language'>

const harvard = {
  source: 'Harvard CS50',
  githubUrl: 'https://github.com/cs50',
  license: 'CC BY-NC-SA 4.0',
  redistributionStatus: '仅限非商业用途，须署名并以相同方式共享。',
  author: 'David J. Malan 与 Harvard CS50 教学团队',
}

const odin = {
  source: 'The Odin Project',
  githubUrl: 'https://github.com/TheOdinProject/curriculum',
  license: 'CC BY-NC-SA 4.0',
  redistributionStatus: '仅限非商业用途，须署名并以相同方式共享。',
  author: 'Erik Trautman 与 The Odin Project 贡献者',
}

const englishEntries: ResourceEntry[] = [
  {
    id: 'cs50',
    title: 'CS50’s Introduction to Computer Science',
    description: '从计算思维和问题求解入手，在 C、Python、SQL 和网页编程的习题中打下计算机科学基础。',
    category: 'Computer Science',
    difficulty: 'Beginner',
    sourceUrl: 'https://cs50.harvard.edu/x/',
    tags: ['C', 'Python', 'SQL', 'Problem solving', '计算思维', '编程入门'],
    audience: '希望系统学习计算机科学的编程初学者。',
    ...harvard,
  },
  {
    id: 'exercism-python',
    title: 'Exercism Python Track',
    description: '用短练习和自动反馈熟悉 Python 的常用写法，也可以申请社区导师指导。',
    category: 'Python',
    difficulty: 'Beginner',
    source: 'Exercism',
    sourceUrl: 'https://exercism.org/tracks/python',
    githubUrl: 'https://github.com/exercism/python',
    license: '轨道仓库采用 MIT 许可证，部分引用材料适用各自的许可证。',
    redistributionStatus: '须遵守对应文件的授权条款。',
    tags: ['Python', 'Exercises', 'Mentoring', '练习题', '导师指导'],
    audience: '想一边学教程、一边练习 Python 的开发者。',
    author: 'Exercism Python 轨道维护者与贡献者',
  },
  {
    id: 'odin-foundations',
    title: 'The Odin Project · Foundations',
    description: '用浏览器小项目练习 Git、HTML、CSS 和 JavaScript，建立前端开发基础。',
    category: 'Frontend Development',
    difficulty: 'Beginner',
    sourceUrl: 'https://www.theodinproject.com/paths/foundations/courses/foundations',
    tags: ['HTML', 'CSS', 'JavaScript', 'Git', '前端基础', '项目实战'],
    audience: '希望通过动手做项目学习前端的初学者。',
    ...odin,
  },
  {
    id: 'huggingface-llm',
    title: 'Hugging Face LLM Course',
    description: '了解 Transformer 如何处理语言，动手使用预训练模型，并学习微调所需的工具。',
    category: 'AI & LLM',
    difficulty: 'Intermediate',
    source: 'Hugging Face Learn',
    sourceUrl: 'https://huggingface.co/learn/llm-course/chapter1/1',
    githubUrl: 'https://github.com/huggingface/course',
    license: '课程仓库采用 Apache-2.0。',
    redistributionStatus: '课程仓库、模型和数据集分别适用各自的授权条款。',
    tags: ['Transformers', 'NLP', 'Fine-tuning', 'Python', '大模型', '自然语言处理', '模型微调'],
    audience: '掌握 Python 并了解深度学习基础的学习者。',
    author: 'Hugging Face 课程团队与贡献者',
  },
  {
    id: 'ossu',
    title: 'OSSU Computer Science',
    description: '按建议顺序学习编程、数学、计算机系统和进阶课程，适合规划长期自学。',
    category: 'Computer Science',
    difficulty: 'Advanced',
    source: 'Open Source Society University',
    sourceUrl: 'https://cs.ossu.dev/',
    githubUrl: 'https://github.com/ossu/computer-science',
    license: '课程目录仓库采用 MIT 许可证。',
    redistributionStatus: '目录适用 MIT 条款。各门课程由其发布方单独授权。',
    tags: ['Curriculum', 'Systems', 'Mathematics', '课程路线', '数学', '计算机系统'],
    audience: '希望自行安排计算机科学学习计划的人。',
    author: 'Eric Douglas 与 Open Source Society University 贡献者',
  },
  {
    id: 'exercism',
    title: 'Exercism Language Tracks',
    description: '选择一门编程语言，通过专项习题和社区反馈熟悉它的语法与使用习惯。',
    category: 'Programming',
    difficulty: 'Beginner',
    source: 'Exercism',
    sourceUrl: 'https://exercism.org/tracks',
    githubUrl: 'https://github.com/exercism',
    license: '各语言轨道及仓库采用各自的许可证。',
    redistributionStatus: '须核查特定语言轨道及文件的条款。',
    tags: ['Exercises', 'Programming languages', 'Mentoring', '练习题', '编程语言'],
    audience: '想通过练习掌握一门新语言的开发者。',
    author: 'Exercism 维护者及各语言轨道贡献者',
  },
  {
    id: '30-days-python',
    title: '30 Days of Python',
    description: '跟随视频和配套代码学习 Python 基础，并完成几个小项目。',
    category: 'Python',
    difficulty: 'Beginner',
    source: 'Coding for Entrepreneurs',
    sourceUrl: 'https://www.codingforentrepreneurs.com/courses/30-days-python-38',
    githubUrl: 'https://github.com/codingforentrepreneurs/30-Days-of-Python',
    license: '配套代码仓库采用 MIT 许可证。',
    redistributionStatus: '仓库文件适用 MIT 条款。视频适用单独授权。',
    tags: ['Python', 'Video', 'Projects', '视频教程', '项目实战'],
    audience: '喜欢跟着系列视频动手练习的 Python 初学者。',
    author: 'Justin Mitchel / Coding for Entrepreneurs',
  },
  {
    id: 'freecodecamp',
    title: 'freeCodeCamp · Responsive Web Design',
    description: '在浏览器里练习语义化 HTML、无障碍表单、Flexbox 和 CSS Grid。',
    category: 'Frontend Development',
    difficulty: 'Beginner',
    source: 'freeCodeCamp',
    sourceUrl: 'https://www.freecodecamp.org/learn/responsive-web-design-v9',
    githubUrl: 'https://github.com/freeCodeCamp/freeCodeCamp',
    license: '软件采用 BSD-3-Clause，课程材料另有版权声明。',
    redistributionStatus: '课程材料须按对应版本单独核查授权。',
    tags: ['HTML', 'CSS', 'Accessibility', 'Responsive design', '响应式网页', '无障碍'],
    audience: '想在浏览器里做交互练习的前端初学者。',
    author: 'freeCodeCamp.org 与贡献者',
  },
  {
    id: 'roadmap',
    title: 'roadmap.sh Developer Roadmaps',
    description: '按职业方向或技能查看路线图，梳理技术主题之间的关系，安排下一步学习。',
    category: 'Technology & Tools',
    difficulty: 'Beginner',
    source: 'roadmap.sh',
    sourceUrl: 'https://roadmap.sh/',
    githubUrl: 'https://github.com/nilbuild/developer-roadmap',
    license: '项目自订的个人使用条款。',
    redistributionStatus: '可分享原站链接，转载内容须取得同意。',
    tags: ['Roadmaps', 'Career planning', 'Developer tools', '路线图', '职业规划', '开发工具'],
    audience: '正在规划技术方向或补齐技能的人。',
    author: 'Kamran Ahmed 与 roadmap.sh 贡献者',
  },
  {
    id: 'cs50-c',
    title: 'CS50x · C',
    description: '编写和编译 C 程序，从变量、条件判断、循环和函数开始练习。',
    category: 'C Language',
    difficulty: 'Beginner',
    sourceUrl: 'https://cs50.harvard.edu/x/weeks/1/',
    tags: ['C', 'Compilers', 'Control flow', '编译器', '控制流'],
    audience: '准备编写第一个 C 程序的初学者。',
    ...harvard,
  },
  {
    id: 'mdn-javascript',
    title: 'MDN JavaScript Guide',
    description: '用 Mozilla 社区维护的指南学习 JavaScript 语法，深入了解函数、对象、Promise 和模块。',
    category: 'JavaScript',
    difficulty: 'Beginner',
    source: 'MDN Web Docs',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
    githubUrl: 'https://github.com/mdn/content',
    license: '正文通常采用 CC BY-SA 2.5 或后续版本。代码示例另有规则。',
    redistributionStatus: '正文须署名并以相同方式共享，示例须遵守相应条款。',
    tags: ['JavaScript', 'Async', 'Modules', '异步编程', '模块'],
    audience: '希望系统理解 JavaScript 语言的 Web 开发学习者。',
    author: 'Mozilla 贡献者',
  },
  {
    id: 'dev-java',
    title: 'Dev.java · Java Tutorials',
    description: '从 Java 语言基础入手，逐步学习集合、流和开发工具。',
    category: 'Java',
    difficulty: 'Beginner',
    source: 'Dev.java',
    sourceUrl: 'https://dev.java/learn/',
    license: '适用 Oracle 站点条款及相应页面的版权声明。',
    redistributionStatus: '转载须取得授权或查验页面的具体许可。',
    tags: ['Java', 'OOP', 'Collections', '面向对象', '集合', '标准库'],
    audience: '学习 Java 入门知识或复习标准库的人。',
    author: 'Oracle 与 Dev.java 贡献者',
  },
  {
    id: 'odin-node',
    title: 'The Odin Project · NodeJS',
    description: '用 Node.js 和 Express 构建 Web 应用，连接数据库并编写服务端测试。',
    category: 'Backend Development',
    difficulty: 'Intermediate',
    sourceUrl: 'https://www.theodinproject.com/paths/full-stack-javascript/courses/nodejs',
    tags: ['Node.js', 'Express', 'PostgreSQL', 'Testing', '数据库', '服务端测试'],
    audience: '具备 JavaScript 基础、准备开发服务端应用的人。',
    ...odin,
  },
  {
    id: 'cs50-data-structures',
    title: 'CS50x · Data Structures',
    description: '结合指针理解链表、树和哈希表，比较它们在时间和空间上的取舍。',
    category: 'Data Structures',
    difficulty: 'Intermediate',
    sourceUrl: 'https://cs50.harvard.edu/x/weeks/5/',
    tags: ['C', 'Linked lists', 'Hash tables', 'Trees', '链表', '哈希表', '树'],
    audience: '了解 C 语言指针和内存概念的学习者。',
    ...harvard,
  },
  {
    id: 'cs50-algorithms',
    title: 'CS50x · Algorithms',
    description: '比较常见的查找与排序算法，用渐近记号描述运行时间如何随输入规模增长。',
    category: 'Algorithms',
    difficulty: 'Intermediate',
    sourceUrl: 'https://cs50.harvard.edu/x/weeks/3/',
    tags: ['Searching', 'Sorting', 'Complexity', '查找算法', '排序算法', '复杂度'],
    audience: '能读懂基础 C 程序并使用数组的学习者。',
    ...harvard,
  },
  {
    id: 'ros2',
    title: 'ROS 2 Jazzy Tutorials',
    description: '学习 ROS 2 节点如何通过话题和服务通信，创建并运行自己的软件包。',
    category: 'ROS2 & Robotics',
    difficulty: 'Intermediate',
    source: 'ROS 2 Documentation',
    sourceUrl: 'https://docs.ros.org/en/jazzy/Tutorials.html',
    githubUrl: 'https://github.com/ros2/ros2_documentation',
    license: '文档采用 CC BY 4.0。',
    redistributionStatus: '复用文档须署名。关联代码须按相应仓库的条款处理。',
    tags: ['ROS 2', 'Robotics', 'Nodes', 'Messaging', '机器人', '节点通信'],
    audience: '掌握终端操作和 Python 或 C++ 基础的开发者。',
    author: 'Open Robotics 与 ROS 2 文档贡献者',
  },
]

const chineseEntries: ResourceEntry[] = [
  {
    id: 'python-tutorial-cn',
    title: 'Python 官方教程 · 简体中文',
    description: '从交互式解释器开始，逐步学习控制流、数据结构、模块、异常处理和类。',
    category: 'Python',
    difficulty: 'Beginner',
    source: 'Python 官方文档',
    sourceUrl: 'https://docs.python.org/zh-cn/3/tutorial/',
    githubUrl: 'https://github.com/python/python-docs-zh-cn',
    license: '文档采用 PSF License Version 2，Python 3.8.6 起的代码示例另有 Zero-Clause BSD 双许可。',
    redistributionStatus: '须按文档或代码样例对应的许可证保留声明。',
    tags: ['Python', 'Python 3', 'Standard library', '中文教程', '解释器', '标准库', '异常处理'],
    audience: '会一点编程、想系统学习 Python 语言的人。',
    author: 'Python Software Foundation 与简体中文翻译团队',
  },
  {
    id: 'mdn-javascript-cn',
    title: 'MDN JavaScript 指南 · 简体中文',
    description: '跟随 MDN 中文指南学习 JavaScript 语法、函数、对象、Promise 和模块，并查阅相应专题。',
    category: 'JavaScript',
    difficulty: 'Beginner',
    source: 'MDN Web Docs',
    sourceUrl: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide',
    githubUrl: 'https://github.com/mdn/translated-content',
    license: '正文通常采用 CC BY-SA 2.5 或后续版本。代码示例另有规则。',
    redistributionStatus: '正文须署名并以相同方式共享，示例须遵守相应条款。',
    tags: ['JavaScript', 'Promise', 'Async', 'Modules', '中文教程', '异步编程', '模块'],
    audience: '准备从 HTML、CSS 进入 JavaScript 的 Web 开发学习者。',
    author: 'Mozilla 贡献者与 MDN 中文社区',
  },
  {
    id: 'hello-algo',
    title: 'Hello 算法',
    description: '通过图解和多语言代码理解数组、链表、哈希表、树、排序和图算法。',
    category: 'Data Structures',
    difficulty: 'Beginner',
    source: 'Hello 算法',
    sourceUrl: 'https://www.hello-algo.com/',
    githubUrl: 'https://github.com/krahets/hello-algo',
    license: '仓库内正文、代码和媒体采用 CC BY-NC-SA 4.0。',
    redistributionStatus: '仅限非商业用途，须署名并以相同方式共享。',
    tags: ['Algorithms', 'Data structures', 'Sorting', '数据结构与算法', '链表', '排序', '图解'],
    audience: '已经掌握一门编程语言、想入门数据结构和算法的人。',
    author: 'krahets 与 Hello 算法贡献者',
  },
  {
    id: 'oi-wiki',
    title: 'OI Wiki',
    description: '按主题查阅竞赛算法，从动态规划、图论和数论，到常用数据结构与搜索。',
    category: 'Algorithms',
    difficulty: 'Intermediate',
    source: 'OI Wiki',
    sourceUrl: 'https://oi-wiki.org/',
    githubUrl: 'https://github.com/OI-wiki/OI-wiki',
    license: '正文通常采用 CC BY-SA 4.0，并有项目附加声明。代码及另行标注材料须单独核查。',
    redistributionStatus: '按项目版权声明核查对应条目、代码和例外。',
    tags: ['OI', 'ICPC', 'Algorithms', 'Dynamic programming', '算法竞赛', '动态规划', '图论', '数论'],
    audience: '了解编程和基础算法，准备系统练习或参加竞赛的人。',
    author: 'OI Wiki 贡献者',
  },
  {
    id: 'vue-cn',
    title: 'Vue 3 官方指南 · 简体中文',
    description: '用 Vue 构建交互式界面，了解模板、响应式状态、组件和组合式 API。',
    category: 'Frontend Development',
    difficulty: 'Intermediate',
    source: 'Vue.js 官方中文文档',
    sourceUrl: 'https://cn.vuejs.org/guide/introduction.html',
    githubUrl: 'https://github.com/vuejs-translations/docs-zh-cn',
    license: '官方中文文档采用 CC BY-NC-SA 4.0。',
    redistributionStatus: '文档仅限非商业使用，须署名并以相同方式共享。',
    tags: ['Vue', 'Vue 3', 'Components', 'Composition API', '前端框架', '响应式状态', '组件'],
    audience: '有 HTML、CSS 和 JavaScript 基础，想入门前端框架的人。',
    author: 'Vue.js 文档团队与简体中文翻译贡献者',
  },
]

export const resources: Resource[] = [
  ...chineseEntries.map((entry) => ({ ...entry, language: 'Chinese (Simplified)', updatedAt: checkedAt })),
  ...englishEntries.map((entry) => ({ ...entry, language: 'English', updatedAt: checkedAt })),
]

export function resourceSearchText(resource: Resource): string {
  const { id, title, description, category, difficulty, language, source, author, audience, tags } = resource
  const categoryLabel = categoryLabels[category] ?? category
  return [
    id, title, description, category, categoryLabel, categoryLabel.replace(/\s+/g, ''), difficulty, difficultyLabels[difficulty],
    language, languageLabels[language], source, author, audience, ...tags,
  ].join(' ').normalize('NFKC').toLowerCase()
}

const referenceIds = new Set(['ossu', 'exercism', 'roadmap', 'oi-wiki'])

export const courses = resources.filter(({ id }) => !referenceIds.has(id))
