# 添加章节知识卡

在本目录放入 UTF-8 编码的 `.json` 数组，重新构建后会并入图鉴。例如给「变量与数据」增加一张代码阅读卡，文件内容可以写成

```json
[
  {
    "id": "python-values-notebooks",
    "number": "PY-031",
    "galaxy": "python",
    "courseId": "lv-python-foundations",
    "lessonId": "values",
    "slot": 3,
    "finish": "cosmos",
    "title": "两本手账",
    "subtitle": "读取变量",
    "body": "每本手账 8 元，看看程序会怎样算总价。",
    "code": "price = 8\nprint(price * 2)",
    "quiz": {
      "question": "屏幕会显示哪个数？",
      "options": ["8", "16", "82"],
      "answer": 1,
      "explanation": "price 取出整数 8，乘以 2 得到 16。"
    },
    "back": "price = 8 给价格起了名字。\nprint(price * 2) 先算乘法，再显示结果。"
  }
]
```

`id` 和展示编号 `number` 在全馆唯一。发布后保留这两个值，以便识别学生已收集的卡片和笔记。章节链接取自已有课程的 `courseId` 和 `lessonId`。C 语言星系使用 `galaxy: "c"` 和课程 `lv-c-foundations`。算法与 AI 使用 `"algorithms"`。

槽位 1、2 是概念卡，3 是预测题，4 是找错题，5 是金色速查卡。第 3、4 槽必须提供 `quiz`，`answer` 从 0 开始。第 5 槽使用 `gold`，其他槽位可用 `standard`、`reverse`、`cosmos`、`crosshatch`、`rainbow`。题干、选项、解析和示例均以纯文本显示。
