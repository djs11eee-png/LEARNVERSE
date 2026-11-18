interface TraceFrame {
  values: number[];
  active: number[];
  confirmed: number[];
  range?: number[];
  message: string;
}

export function traceBubbleSort(input: readonly number[]): TraceFrame[] {
  const values = [...input];
  const frames: TraceFrame[] = [
    { values: [...values], active: [], confirmed: [], message: '从左往右依次比较相邻的两个数。' },
  ];

  for (let end = values.length - 1; end > 0; end--) {
    const confirmed = values.map((_, index) => index).slice(end + 1);
    let swapped = false;
    for (let index = 0; index < end; index++) {
      const active = [index, index + 1];
      const left = values[index];
      const right = values[index + 1];
      frames.push({
        values: [...values],
        active,
        confirmed,
        message: `比较 ${left} 和 ${right}。${left <= right ? '顺序正确，无需交换。' : '较大的数应该在右边。'}`,
      });
      if (left > right) {
        values[index] = right;
        values[index + 1] = left;
        swapped = true;
        frames.push({ values: [...values], active, confirmed, message: `交换 ${left} 和 ${right} 的位置。` });
      }
    }
    if (!swapped) break;
  }

  frames.push({
    values,
    active: [],
    confirmed: values.map((_, index) => index),
    message: '排序完成。所有数已按升序排列。',
  });
  return frames;
}

export function traceBinarySearch(input: readonly number[], target: number): TraceFrame[] {
  const values = [...input];
  const indexes = values.map((_, index) => index);
  const frames: TraceFrame[] = [
    { values, active: [], confirmed: [], range: indexes, message: `在升序数组中查找 ${target}。` },
  ];

  let left = 0;
  let right = values.length - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const value = values[middle];
    const range = indexes.slice(left, right + 1);
    if (value === target) {
      frames.push({ values, active: [middle], confirmed: [middle], range: [middle], message: `找到了 ${target}，下标为 ${middle}。` });
      return frames;
    }
    frames.push({
      values,
      active: [middle],
      confirmed: [],
      range,
      message: value < target ? `${value} 小于目标值，在右半部分继续查找。` : `${value} 大于目标值，在左半部分继续查找。`,
    });
    if (value < target) left = middle + 1;
    else right = middle - 1;
  }

  frames.push({ values, active: [], confirmed: [], range: [], message: `数组中没有找到 ${target}。` });
  return frames;
}

export const algorithms = {
  bubble: {
    title: '冒泡排序',
    filename: 'bubble-sort.js',
    complexity: '最坏情况 O(n²)',
    sample: [62, 24, 80, 45, 68, 36, 91],
    code: [
      'function bubbleSort(input) {',
      '  const values = [...input];',
      '  for (let end = values.length - 1; end > 0; end--) {',
      '    let swapped = false;',
      '    for (let i = 0; i < end; i++) {',
      '      if (values[i] > values[i + 1]) {',
      '        [values[i], values[i + 1]] = [values[i + 1], values[i]];',
      '        swapped = true;',
      '      }',
      '    }',
      '    if (!swapped) break;',
      '  }',
      '  return values;',
      '}',
    ].join('\n'),
  },
  binary: {
    title: '二分查找',
    filename: 'binary-search.js',
    complexity: '最坏情况 O(log n)',
    sample: [18, 30, 42, 56, 68, 79, 94],
    code: [
      'function binarySearch(values, target) {',
      '  let left = 0;',
      '  let right = values.length - 1;',
      '  while (left <= right) {',
      '    const middle = Math.floor((left + right) / 2);',
      '    if (values[middle] === target) return middle;',
      '    if (values[middle] < target) {',
      '      left = middle + 1;',
      '    } else {',
      '      right = middle - 1;',
      '    }',
      '  }',
      '  return -1;',
      '}',
    ].join('\n'),
  },
};

export const questions = [
  {
    prompt: '使用这里的二分查找前，数组需要满足什么条件？',
    options: ['所有数都必须为正数', '数据必须按升序排列', '数组元素的数量必须是奇数'],
    answer: 1,
    explanation: '数组按升序排列时，比较中间值和目标值，就能判断该去左半部分还是右半部分继续查找。',
  },
  {
    prompt: '用冒泡排序按升序排列一组互不相同的数时，哪种输入需要交换最多次？',
    options: ['已按升序排列的数组', '顺序随机的数组', '按降序排列的数组'],
    answer: 2,
    explanation: '原数组按降序排列时，每对元素的相对顺序都要反转，因此需要最多次相邻交换。',
  },
  {
    prompt: '二分查找当前还有 64 个候选值。比较一次后，最多还剩多少个？',
    options: ['32', '63', '16'],
    answer: 0,
    explanation: '比较中间值后，下一步最多只需在一半的候选值中继续查找。',
  },
];

export const projects = [
  {
    title: '整理遥测数据',
    topic: '数组与排序',
    description: '编写一个函数，将传感器读数从小到大排列后返回。',
    checks: [
      '输入 [41, 8, 41, 12]，应返回 [8, 12, 41, 41]。',
      '保留重复的读数，且不修改原数组。',
      '输入为空时返回空数组。试一试，对比升序输入和降序输入各需要交换多少次。',
    ],
  },
  {
    title: '查找星表记录',
    topic: '查找与时间复杂度',
    description: '在按编号排序的星表中查找指定恒星的下标，并记录比较次数。',
    checks: [
      '在 [12, 18, 24, 30, 36] 中查找 30，应返回下标 3。',
      '如果编号不存在或星表为空，返回 -1。',
      '用包含 64 条记录的星表，对比二分查找和逐条扫描的比较次数。',
    ],
  },
];
