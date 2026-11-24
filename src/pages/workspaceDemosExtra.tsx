import { ArrowRight, Cpu, Pause, Play, Radio, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

export function BinaryCarryDemo() {
  const [bitsA, setBitsA] = useState([1, 0, 1, 1]) // MSB -> LSB (11)
  const [bitsB, setBitsB] = useState([0, 1, 1, 1]) // MSB -> LSB (7)
  const [step, setStep] = useState(4) // 0..4, how many low bits computed

  const carries = [0, 0, 0, 0, 0] // index 0 = carry into LSB, index 4 = overflow out
  const sumBits = [0, 0, 0, 0] // index 0 = LSB, index 3 = MSB
  for (let bit = 0; bit < 4; bit++) {
    const a = bitsA[3 - bit]
    const b = bitsB[3 - bit]
    const total = a + b + carries[bit]
    sumBits[bit] = total & 1
    carries[bit + 1] = total >> 1
  }

  const valA = parseInt(bitsA.join(''), 2)
  const valB = parseInt(bitsB.join(''), 2)
  const rawSum = valA + valB
  const low4 = rawSum & 0xf
  const overflow = carries[4] === 1

  function toggleBit(which: 'A' | 'B', index: number) {
    const setter = which === 'A' ? setBitsA : setBitsB
    setter((prev) => prev.map((v, i) => (i === index ? (v ? 0 : 1) : v)))
    setStep(4)
  }

  const activeBitFromLsb = step > 0 ? step - 1 : -1
  const statusText = step === 0
    ? '点击「推进一位」从最低位（2⁰）开始逐位相加，或直接点击任意 0/1 翻转位值。'
    : step < 4
      ? `正在计算第 ${activeBitFromLsb} 位（权值 ${1 << activeBitFromLsb}）：${bitsA[3 - activeBitFromLsb]} + ${bitsB[3 - activeBitFromLsb]} + 低位进位 ${carries[activeBitFromLsb]} = ${bitsA[3 - activeBitFromLsb] + bitsB[3 - activeBitFromLsb] + carries[activeBitFromLsb]} → 本位写 ${sumBits[activeBitFromLsb]}，向高位进位 ${carries[activeBitFromLsb + 1]}。`
      : `A(${valA}) + B(${valB}) = 数学和 ${rawSum}；4 位寄存器只保留低 4 位 = ${low4}（${sumBits.slice().reverse().join('')}₂）${overflow ? '，最高位进位 CF=1（发生 4 位回绕溢出！）' : '，CF=0（无溢出）。'}`

  return (
    <>
      <p>点击上方 4 位二进制开关修改加数 A 和 B，再用「逐位进位」观察每一位的进位如何从右向左传递，以及超过 15 时 4 位寄存器为何回绕。</p>
      <div className="workspace-demo-controls">
        <button type="button" className="workspace-button" onClick={() => setStep(0)}>从头逐位算</button>
        <button type="button" className="workspace-button workspace-primary" disabled={step >= 4} onClick={() => setStep((s) => Math.min(4, s + 1))}>
          推进一位 <ArrowRight size={15} aria-hidden="true" />
        </button>
        <button type="button" className="workspace-button" onClick={() => { setBitsA([1, 0, 1, 1]); setBitsB([0, 1, 1, 1]); setStep(4) }}>
          <RotateCcw size={15} aria-hidden="true" /> 重置示例
        </button>
      </div>
      <div className="wd-binary-grid" aria-label="四位二进制加法与进位演示">
        <div className="wd-bit-row wd-bit-weights">
          <span className="wd-row-label">位权</span>
          {[8, 4, 2, 1].map((w, i) => <span key={w} className="wd-weight-cell">2<sup>{3 - i}</sup>={w}</span>)}
          <span className="wd-row-dec">十进制</span>
        </div>
        <div className="wd-bit-row">
          <span className="wd-row-label">进位 C</span>
          {[3, 2, 1, 0].map((lsbIdx) => {
            const shown = step > lsbIdx
            return (
              <span key={lsbIdx} className="wd-carry-cell" data-active={shown && carries[lsbIdx] === 1 || undefined}>
                {shown ? carries[lsbIdx] : '·'}
              </span>
            )
          })}
          <span className="wd-row-dec" data-warn={step >= 4 && overflow || undefined}>
            {step >= 4 ? (overflow ? '溢出 CF=1' : 'CF=0') : '计算中'}
          </span>
        </div>
        <div className="wd-bit-row">
          <span className="wd-row-label">加数 A</span>
          {bitsA.map((bit, i) => (
            <button key={i} type="button" className="wd-bit-btn" data-on={bit === 1 || undefined}
              aria-label={`切换加数 A 的第 ${3 - i} 位，当前 ${bit}`} onClick={() => toggleBit('A', i)}>
              {bit}
            </button>
          ))}
          <span className="wd-row-dec">{valA}</span>
        </div>
        <div className="wd-bit-row">
          <span className="wd-row-label">加数 B</span>
          {bitsB.map((bit, i) => (
            <button key={i} type="button" className="wd-bit-btn" data-on={bit === 1 || undefined}
              aria-label={`切换加数 B 的第 ${3 - i} 位，当前 ${bit}`} onClick={() => toggleBit('B', i)}>
              {bit}
            </button>
          ))}
          <span className="wd-row-dec">{valB}</span>
        </div>
        <div className="wd-bit-row wd-bit-sum">
          <span className="wd-row-label">低 4 位和</span>
          {[3, 2, 1, 0].map((lsbIdx) => {
            const computed = step > lsbIdx
            const focus = step - 1 === lsbIdx
            return (
              <span key={lsbIdx} className="wd-sum-cell" data-focus={focus || undefined} data-computed={computed || undefined}>
                {computed ? sumBits[lsbIdx] : '?'}
              </span>
            )
          })}
          <span className="wd-row-dec">{step >= 4 ? low4 : '…'}</span>
        </div>
      </div>
      <output className="workspace-demo-output">{statusText}</output>
    </>
  )
}

export function BitmaskFrameDemo() {
  const [frame, setFrame] = useState(0x31a3)

  function toggleBit(bit: number) {
    setFrame((prev) => prev ^ (1 << bit))
  }

  const nodeId = (frame >>> 12) & 0xf
  const temp = (frame >>> 4) & 0xff
  const alarm = frame & 1
  const lowBat = (frame >>> 1) & 1
  const hex = '0x' + frame.toString(16).toUpperCase().padStart(4, '0')

  function renderByte(startBit: number, label: string) {
    const bits = Array.from({ length: 8 }, (_, offset) => startBit - offset)
    return (
      <div className="wd-byte-group">
        <span className="wd-byte-title">{label}</span>
        <div className="wd-byte-cells">
          {bits.map((bit) => {
            const on = ((frame >>> bit) & 1) === 1
            const zone = bit >= 12 ? 'node' : bit >= 4 ? 'temp' : 'flag'
            return (
              <button
                key={bit}
                type="button"
                className="wd-frame-bit"
                data-zone={zone}
                data-on={on || undefined}
                aria-label={`切换第 ${bit} 位，当前 ${on ? 1 : 0}`}
                onClick={() => toggleBit(bit)}
              >
                <small>{bit}</small>
                <strong>{on ? 1 : 0}</strong>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <p>点击任意一位 0/1 开关，实时观察 16 位传感帧如何通过「右移 <code>&gt;&gt;</code> + 按位与 <code>&amp;</code> 掩码」拆出节点号、温度与状态标志。</p>
      <div className="workspace-demo-controls">
        <button type="button" className="workspace-button" onClick={() => setFrame(0x31a3)}>示例帧 0x31A3</button>
        <button type="button" className="workspace-button" onClick={() => setFrame(0x2190)}>正常帧 0x2190</button>
        <button type="button" className="workspace-button" onClick={() => setFrame(0xf281)}>高温告警 0xF281</button>
      </div>
      <div className="wd-frame-legend">
        <span data-zone="node">高 4 位 [15..12] 节点号</span>
        <span data-zone="temp">中 8 位 [11..4] 温度</span>
        <span data-zone="flag">低 4 位 [3..0] 标志位</span>
      </div>
      <div className="wd-frame-bytes">
        {renderByte(15, '高字节 [15..8]')}
        {renderByte(7, '低字节 [7..0]')}
      </div>
      <div className="wd-expr-grid">
        <div><span>完整帧</span><code>{hex} ({frame})</code></div>
        <div><span>节点号</span><code>(frame &gt;&gt; 12) &amp; 0xF = {nodeId}</code></div>
        <div><span>温度 °C</span><code>(frame &gt;&gt; 4) &amp; 0xFF = {temp}</code></div>
        <div><span>告警 / 低电</span><code>alarm={alarm} · low_bat={lowBat}</code></div>
      </div>
      <output className="workspace-demo-output">
        解包结果：node={nodeId} temp={temp}°C alarm={alarm ? 'ON' : 'OFF'} low_bat={lowBat ? 'ON' : 'OFF'}
      </output>
    </>
  )
}

interface PointerFrame {
  title: string
  code: string
  note: string
  cells: { addr: string; name: string; scope: string; value: string; pointsTo?: string; changed?: boolean }[]
}

const pointerModes: Record<'value' | 'pointer' | 'realloc', { label: string; steps: PointerFrame[] }> = {
  value: {
    label: '值传递（改不动原值）',
    steps: [
      {
        title: '1. main 定义 score = 60',
        code: 'int score = 60;',
        note: 'score 住在内存地址 0x1040，里头装着数值 60。',
        cells: [{ addr: '0x1040', name: 'score', scope: 'main', value: '60', changed: true }],
      },
      {
        title: '2. 调用 add_ten(score)',
        code: 'void add_ten(int x) { /* 收到 60 的副本 */ }',
        note: '函数形参 x 开在另一块地址 0x1048，只把 60 抄了一份进去。',
        cells: [
          { addr: '0x1040', name: 'score', scope: 'main', value: '60' },
          { addr: '0x1048', name: 'x (副本)', scope: 'add_ten', value: '60', changed: true },
        ],
      },
      {
        title: '3. 函数内执行 x = x + 10',
        code: 'x = x + 10; // 只改了 0x1048',
        note: '0x1048 变成 70，但 main 的 0x1040 纹丝不动！函数返回后 x 销毁，score 仍是 60。',
        cells: [
          { addr: '0x1040', name: 'score', scope: 'main', value: '60' },
          { addr: '0x1048', name: 'x (副本)', scope: 'add_ten', value: '70', changed: true },
        ],
      },
    ],
  },
  pointer: {
    label: '指针传递（按地址修改）',
    steps: [
      {
        title: '1. main 定义 score = 60',
        code: 'int score = 60;',
        note: 'score 住在地址 0x1040，数值 60。',
        cells: [{ addr: '0x1040', name: 'score', scope: 'main', value: '60', changed: true }],
      },
      {
        title: '2. 传入地址 &score',
        code: 'add_ten(&score); // 形参 int *p 拿到 0x1040',
        note: '指针变量 p 住在 0x1048，但格子里存的不是 60，而是门牌号 0x1040。',
        cells: [
          { addr: '0x1040', name: 'score', scope: 'main', value: '60' },
          { addr: '0x1048', name: 'p (int *)', scope: 'add_ten', value: '0x1040', pointsTo: '→ 指向 0x1040', changed: true },
        ],
      },
      {
        title: '3. 解引用修改 *p = *p + 10',
        code: '*p = *p + 10; // 沿地址改写 0x1040',
        note: '解引用 *p 直接按门牌号找到 0x1040 并把 60 改成 70。返回后 main 里的 score 真正变成 70！',
        cells: [
          { addr: '0x1040', name: 'score', scope: 'main', value: '70', changed: true },
          { addr: '0x1048', name: 'p (int *)', scope: 'add_ten', value: '0x1040', pointsTo: '→ 指向 0x1040' },
        ],
      },
    ],
  },
  realloc: {
    label: '安全 realloc（临时指针）',
    steps: [
      {
        title: '1. 已有堆块 buf 指向 0x4000',
        code: 'int *buf = malloc(4 * sizeof(int));',
        note: 'buf 握着旧内存地址 0x4000，千万不能在扩容失败时直接覆盖它。',
        cells: [
          { addr: '栈 0x1060', name: 'buf', scope: 'main', value: '0x4000', pointsTo: '→ 堆块 [10,20,30,40]' },
        ],
      },
      {
        title: '2. 用临时指针 tmp 接住 realloc',
        code: 'int *tmp = realloc(buf, 8 * sizeof(int)); // 假设失败返回 NULL',
        note: '若系统内存不足，tmp 变成 NULL，但 buf 依然保存着 0x4000，原数据没有泄漏！',
        cells: [
          { addr: '栈 0x1060', name: 'buf', scope: 'main', value: '0x4000', pointsTo: '→ 原数据完好' },
          { addr: '栈 0x1068', name: 'tmp', scope: 'main', value: 'NULL', pointsTo: '扩容失败！', changed: true },
        ],
      },
      {
        title: '3. 判空后再交接或安全释放',
        code: 'if (tmp == NULL) { free(buf); return; } buf = tmp;',
        note: '只有在 tmp != NULL 时才把 buf 指向新地址；失败时仍可用 buf 调用 free(buf) 干净收尾。',
        cells: [
          { addr: '栈 0x1060', name: 'buf', scope: 'main', value: '已安全 free', changed: true },
          { addr: '栈 0x1068', name: 'tmp', scope: 'main', value: 'NULL' },
        ],
      },
    ],
  },
}

export function CPointerDemo() {
  const [mode, setMode] = useState<'value' | 'pointer' | 'realloc'>('pointer')
  const [step, setStep] = useState(0)
  const steps = pointerModes[mode].steps
  const current = steps[step]

  return (
    <>
      <p>切换对比「值传递」「指针传递」与「安全 realloc」，单步观察每个变量住在哪个地址、格子里装的是数值还是门牌号。</p>
      <div className="workspace-demo-controls" role="group" aria-label="指针场景切换">
        {(['value', 'pointer', 'realloc'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`workspace-button${mode === key ? ' workspace-primary' : ''}`}
            onClick={() => { setMode(key); setStep(0) }}
          >
            {pointerModes[key].label}
          </button>
        ))}
      </div>
      <div className="wd-code-pill"><code>{current.code}</code></div>
      <div className="wd-memory-grid" aria-label="内存盒子视图">
        {current.cells.map((cell) => (
          <div key={cell.addr + cell.name} className="wd-mem-cell" data-changed={cell.changed || undefined}>
            <div className="wd-mem-head">
              <span>{cell.addr}</span>
              <small>{cell.scope}</small>
            </div>
            <div className="wd-mem-name">{cell.name}</div>
            <div className="wd-mem-val">{cell.value}</div>
            {cell.pointsTo && <div className="wd-mem-ptr">{cell.pointsTo}</div>}
          </div>
        ))}
      </div>
      <div className="workspace-demo-controls">
        <button type="button" className="workspace-button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>上一步</button>
        <button type="button" className="workspace-button workspace-primary" disabled={step === steps.length - 1} onClick={() => setStep((s) => s + 1)}>
          下一步 ({step + 1}/{steps.length}) <ArrowRight size={15} aria-hidden="true" />
        </button>
        <button type="button" className="workspace-button" disabled={step === 0} onClick={() => setStep(0)}>
          <RotateCcw size={15} aria-hidden="true" /> 重置
        </button>
      </div>
      <output className="workspace-demo-output"><strong>{current.title}：</strong>{current.note}</output>
    </>
  )
}

interface SortItem {
  id: string
  value: number
  label: string
}

interface SortStep {
  items: SortItem[]
  pair: [number, number] | null
  swapped: boolean
  confirmedFrom: number
  compares: number
  swaps: number
  note: string
}

function buildBubbleSteps(initial: SortItem[]): SortStep[] {
  const arr = initial.map((item) => ({ ...item }))
  const steps: SortStep[] = [{
    items: arr.map((x) => ({ ...x })),
    pair: null,
    swapped: false,
    confirmedFrom: arr.length,
    compares: 0,
    swaps: 0,
    note: '准备开始：每趟把相邻较大的数往右“冒泡”，相等元素（如 3甲 与 3乙）不交换以保持稳定。',
  }]
  let compares = 0
  let swaps = 0
  for (let end = arr.length - 1; end > 0; end--) {
    let moved = false
    for (let i = 0; i < end; i++) {
      compares++
      const left = arr[i]
      const right = arr[i + 1]
      if (left.value > right.value) {
        arr[i] = right
        arr[i + 1] = left
        swaps++
        moved = true
        steps.push({
          items: arr.map((x) => ({ ...x })),
          pair: [i, i + 1],
          swapped: true,
          confirmedFrom: end + 1,
          compares,
          swaps,
          note: `比较 ${left.label} > ${right.label}，发生交换！`,
        })
      } else {
        steps.push({
          items: arr.map((x) => ({ ...x })),
          pair: [i, i + 1],
          swapped: false,
          confirmedFrom: end + 1,
          compares,
          swaps,
          note: left.value === right.value
            ? `比较 ${left.label} == ${right.label}，相等不交换（保持稳定性）。`
            : `比较 ${left.label} <= ${right.label}，顺序正确不交换。`,
        })
      }
    }
    if (!moved) break
  }
  steps.push({
    items: arr.map((x) => ({ ...x })),
    pair: null,
    swapped: false,
    confirmedFrom: 0,
    compares,
    swaps,
    note: `排序完成！共比较 ${compares} 次、交换 ${swaps} 次。`,
  })
  return steps
}

const sortPresets: Record<'stable' | 'nearly' | 'reverse', { label: string; items: SortItem[] }> = {
  stable: {
    label: '含重复项（看稳定性）',
    items: [
      { id: 'a', value: 3, label: '3甲' },
      { id: 'b', value: 1, label: '1' },
      { id: 'c', value: 3, label: '3乙' },
      { id: 'd', value: 2, label: '2' },
    ],
  },
  nearly: {
    label: '近乎有序（提前结束）',
    items: [
      { id: '1', value: 1, label: '1' },
      { id: '2', value: 3, label: '3' },
      { id: '3', value: 2, label: '2' },
      { id: '4', value: 4, label: '4' },
      { id: '5', value: 5, label: '5' },
    ],
  },
  reverse: {
    label: '逆序（最坏情况）',
    items: [
      { id: '5', value: 5, label: '5' },
      { id: '4', value: 4, label: '4' },
      { id: '3', value: 3, label: '3' },
      { id: '2', value: 2, label: '2' },
      { id: '1', value: 1, label: '1' },
    ],
  },
}

export function BubbleSortDemo() {
  const [preset, setPreset] = useState<'stable' | 'nearly' | 'reverse'>('stable')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const frames = buildBubbleSteps(sortPresets[preset].items)
  const frame = frames[Math.min(step, frames.length - 1)]
  const maxVal = Math.max(...sortPresets[preset].items.map((x) => x.value))

  useEffect(() => {
    if (!playing) return
    if (step >= frames.length - 1) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(() => setStep((s) => Math.min(frames.length - 1, s + 1)), 700)
    return () => window.clearTimeout(timer)
  }, [playing, step, frames.length])

  function choosePreset(next: 'stable' | 'nearly' | 'reverse') {
    setPlaying(false)
    setPreset(next)
    setStep(0)
  }

  return (
    <>
      <p>单步或自动播放冒泡排序：观察相邻比较、右侧逐步定型的有序区，以及为什么 <code>3甲</code> 始终留在 <code>3乙</code> 前面。</p>
      <div className="workspace-demo-controls">
        {(['stable', 'nearly', 'reverse'] as const).map((key) => (
          <button key={key} type="button" className={`workspace-button${preset === key ? ' workspace-primary' : ''}`}
            onClick={() => choosePreset(key)}>
            {sortPresets[key].label}
          </button>
        ))}
      </div>
      <div className="wd-bars" aria-label="冒泡排序柱状图">
        {frame.items.map((item, index) => {
          const active = frame.pair?.includes(index) ?? false
          const confirmed = index >= frame.confirmedFrom
          return (
            <div key={item.id} className="wd-bar-col" data-state={active ? (frame.swapped ? 'swap' : 'compare') : confirmed ? 'done' : 'idle'}>
              <div className="wd-bar" style={{ height: `${Math.round((item.value / maxVal) * 88 + 26)}px` }}>
                <span>{item.label}</span>
              </div>
              <small>[{index}]</small>
            </div>
          )
        })}
      </div>
      <div className="workspace-demo-controls">
        <button type="button" className="workspace-button" onClick={() => setPlaying((p) => !p)} disabled={step >= frames.length - 1}>
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {playing ? '暂停' : '自动播放'}
        </button>
        <button type="button" className="workspace-button workspace-primary" disabled={step >= frames.length - 1}
          onClick={() => { setPlaying(false); setStep((s) => Math.min(frames.length - 1, s + 1)) }}>
          推进一步 ({step}/{frames.length - 1}) <ArrowRight size={15} aria-hidden="true" />
        </button>
        <button type="button" className="workspace-button" disabled={step === 0 && !playing}
          onClick={() => { setPlaying(false); setStep(0) }}>
          <RotateCcw size={15} aria-hidden="true" /> 重置
        </button>
      </div>
      <output className="workspace-demo-output">
        比较 {frame.compares} 次 · 交换 {frame.swaps} 次 — {frame.note}
      </output>
    </>
  )
}

export function StackQueueDemo() {
  const [tab, setTab] = useState<'stack' | 'queue'>('stack')
  const [stack, setStack] = useState<string[]>(['A1', 'B2'])
  const [ring, setRing] = useState<(string | null)[]>(['T1', 'T2', null])
  const [head, setHead] = useState(0)
  const [tail, setTail] = useState(2)
  const [count, setCount] = useState(2)
  const [seq, setSeq] = useState(3)
  const [note, setNote] = useState('栈遵循后进先出（LIFO），环形队列遵循先进先出（FIFO）且下标自动回绕。')

  function pushStack() {
    if (stack.length >= 4) {
      setNote('栈已满（上限 4），拒绝压栈！')
      return
    }
    const item = `S${seq}`
    setSeq((n) => n + 1)
    setStack((prev) => [...prev, item])
    setNote(`压栈 push(${item})：新元素放到栈顶 top=${stack.length}。`)
  }

  function popStack() {
    if (!stack.length) {
      setNote('栈已空，无法弹栈（underflow）。')
      return
    }
    const topItem = stack[stack.length - 1]
    setStack((prev) => prev.slice(0, -1))
    setNote(`弹栈 pop() → 取出最后进入的 ${topItem}。`)
  }

  function enqueue() {
    if (count >= 3) {
      setNote('容量为 3 的环形队列已满，新任务被拒绝（防止覆盖未处理项）。')
      return
    }
    const item = `T${seq}`
    setSeq((n) => n + 1)
    setRing((prev) => prev.map((v, i) => (i === tail ? item : v)))
    const nextTail = (tail + 1) % 3
    setTail(nextTail)
    setCount((c) => c + 1)
    setNote(`入队 enqueue(${item})：写入槽位 [${tail}]，尾指针 tail 回绕到 (${tail}+1)%3 = ${nextTail}。`)
  }

  function dequeue() {
    if (count === 0) {
      setNote('队列已空，无可出队任务。')
      return
    }
    const front = ring[head]
    setRing((prev) => prev.map((v, i) => (i === head ? null : v)))
    const nextHead = (head + 1) % 3
    setHead(nextHead)
    setCount((c) => c - 1)
    setNote(`出队 dequeue() → 取出最早进入的 ${front}（槽位 [${head}]），头指针 head 移到 ${nextHead}。`)
  }

  return (
    <>
      <p>分别亲手操作「栈（后进先出）」和「容量 3 环形队列（先进先出 + 指针回绕）」，体会出队后为何不必搬移整个数组。</p>
      <div className="workspace-demo-controls" role="group" aria-label="切换栈与队列">
        <button type="button" className={`workspace-button${tab === 'stack' ? ' workspace-primary' : ''}`} onClick={() => setTab('stack')}>
          栈（LIFO）
        </button>
        <button type="button" className={`workspace-button${tab === 'queue' ? ' workspace-primary' : ''}`} onClick={() => setTab('queue')}>
          环形队列（FIFO · 容量 3）
        </button>
      </div>
      {tab === 'stack' ? (
        <>
          <div className="workspace-demo-controls">
            <button type="button" className="workspace-button workspace-primary" onClick={pushStack}>压栈 Push</button>
            <button type="button" className="workspace-button" onClick={popStack}>弹栈 Pop</button>
            <button type="button" className="workspace-button" onClick={() => { setStack(['A1', 'B2']); setNote('已重置栈。') }}>
              <RotateCcw size={15} aria-hidden="true" /> 重置
            </button>
          </div>
          <div className="wd-stack-lane" aria-label="栈内存视图">
            {stack.length === 0 ? <span className="wd-empty-slot">空栈（top = -1）</span> : stack.map((item, idx) => (
              <div key={item + idx} className="wd-slot" data-top={idx === stack.length - 1 || undefined}>
                <small>[{idx}]{idx === stack.length - 1 ? ' ← top' : ''}</small>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="workspace-demo-controls">
            <button type="button" className="workspace-button workspace-primary" onClick={enqueue}>入队 Enqueue</button>
            <button type="button" className="workspace-button" onClick={dequeue}>出队 Dequeue</button>
            <button type="button" className="workspace-button" onClick={() => { setRing(['T1', 'T2', null]); setHead(0); setTail(2); setCount(2); setNote('已重置环形队列。') }}>
              <RotateCcw size={15} aria-hidden="true" /> 重置
            </button>
          </div>
          <div className="wd-ring-grid" aria-label="环形队列槽位视图">
            {ring.map((item, idx) => (
              <div key={idx} className="wd-slot" data-filled={item !== null || undefined}>
                <small>
                  槽位 [{idx}]
                  {idx === head ? ' · head' : ''}
                  {idx === tail ? ' · tail' : ''}
                </small>
                <strong>{item ?? '空'}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      <output className="workspace-demo-output">{note}</output>
    </>
  )
}

interface CacheTrack {
  slots: string[]
  hits: number
  misses: number
  evictions: number
  lastAction: string
}

function stepCache(track: CacheTrack, key: string, capacity: number, policy: 'fifo' | 'lru'): CacheTrack {
  const index = track.slots.indexOf(key)
  if (index >= 0) {
    if (policy === 'lru') {
      const next = [...track.slots.slice(0, index), ...track.slots.slice(index + 1), key]
      return { slots: next, hits: track.hits + 1, misses: track.misses, evictions: track.evictions, lastAction: `命中 ${key} → 刷新到队尾（最新）` }
    }
    return { ...track, hits: track.hits + 1, lastAction: `命中 ${key}（FIFO 不改变进入顺序）` }
  }
  const next = [...track.slots]
  let evicted = ''
  if (next.length >= capacity) evicted = next.shift() ?? ''
  next.push(key)
  return {
    slots: next,
    hits: track.hits,
    misses: track.misses + 1,
    evictions: track.evictions + (evicted ? 1 : 0),
    lastAction: evicted ? `未命中 ${key} → 淘汰队头 ${evicted}` : `未命中 ${key} → 写入空槽`,
  }
}

export function LruCacheDemo() {
  const [capacity, setCapacity] = useState(2)
  const [history, setHistory] = useState<string[]>([])
  const [fifo, setFifo] = useState<CacheTrack>({ slots: [], hits: 0, misses: 0, evictions: 0, lastAction: '等待访问…' })
  const [lru, setLru] = useState<CacheTrack>({ slots: [], hits: 0, misses: 0, evictions: 0, lastAction: '等待访问…' })

  function resetAll(nextCap = capacity) {
    setCapacity(nextCap)
    setHistory([])
    setFifo({ slots: [], hits: 0, misses: 0, evictions: 0, lastAction: '等待访问…' })
    setLru({ slots: [], hits: 0, misses: 0, evictions: 0, lastAction: '等待访问…' })
  }

  function access(key: string) {
    setHistory((prev) => [...prev, key].slice(-12))
    setFifo((prev) => stepCache(prev, key, capacity, 'fifo'))
    setLru((prev) => stepCache(prev, key, capacity, 'lru'))
  }

  function runTrace(seq: string[]) {
    let f: CacheTrack = { slots: [], hits: 0, misses: 0, evictions: 0, lastAction: '' }
    let l: CacheTrack = { slots: [], hits: 0, misses: 0, evictions: 0, lastAction: '' }
    for (const key of seq) {
      f = stepCache(f, key, capacity, 'fifo')
      l = stepCache(l, key, capacity, 'lru')
    }
    setHistory(seq)
    setFifo(f)
    setLru(l)
  }

  return (
    <>
      <p>依次点击下方访问键（试试 <code>A → B → A → C → A</code>），同时对比 FIFO（只看进入先后）与 LRU（命中即刷新到队尾）的命中率差异。</p>
      <div className="workspace-demo-controls">
        {['A', 'B', 'C', 'D'].map((key) => (
          <button key={key} type="button" className="workspace-button workspace-primary" onClick={() => access(key)}>访问 {key}</button>
        ))}
        <button type="button" className="workspace-button" onClick={() => runTrace(['A', 'B', 'A', 'C', 'A'])}>经典序列 A B A C A</button>
        <button type="button" className="workspace-button" onClick={() => resetAll(capacity === 2 ? 3 : 2)}>
          容量：{capacity} 槽（点击切换）
        </button>
        <button type="button" className="workspace-button" onClick={() => resetAll(capacity)}>
          <RotateCcw size={15} aria-hidden="true" /> 清空
        </button>
      </div>
      <div className="wd-cache-compare">
        <div className="wd-cache-card">
          <h3>FIFO 队列（队头最早进入）</h3>
          <div className="wd-cache-slots">
            {Array.from({ length: capacity }, (_, i) => (
              <span key={i} className="wd-slot" data-filled={Boolean(fifo.slots[i]) || undefined}>
                <small>{i === 0 ? '队头(先淘汰)' : i === capacity - 1 ? '队尾' : `槽 ${i}`}</small>
                <strong>{fifo.slots[i] ?? '空'}</strong>
              </span>
            ))}
          </div>
          <p className="wd-cache-meta">命中 {fifo.hits} · 未命中 {fifo.misses} · 淘汰 {fifo.evictions}</p>
          <small>{fifo.lastAction}</small>
        </div>
        <div className="wd-cache-card">
          <h3>LRU 队列（队头最久未用）</h3>
          <div className="wd-cache-slots">
            {Array.from({ length: capacity }, (_, i) => (
              <span key={i} className="wd-slot" data-filled={Boolean(lru.slots[i]) || undefined}>
                <small>{i === 0 ? '最久未用' : i === capacity - 1 ? '刚刚用过' : `槽 ${i}`}</small>
                <strong>{lru.slots[i] ?? '空'}</strong>
              </span>
            ))}
          </div>
          <p className="wd-cache-meta">命中 {lru.hits} · 未命中 {lru.misses} · 淘汰 {lru.evictions}</p>
          <small>{lru.lastAction}</small>
        </div>
      </div>
      <output className="workspace-demo-output">
        最近访问轨迹：{history.length ? history.join(' → ') : '（尚未访问）'}
      </output>
    </>
  )
}

interface CpuInstruction {
  op: 'LOAD' | 'ADD' | 'STORE' | 'HALT'
  arg?: number
  text: string
}

const cpuPrograms: Record<'normal' | 'fault', { label: string; mem: number[]; code: CpuInstruction[] }> = {
  normal: {
    label: '正常累加与回绕（11 + 7）',
    mem: [11, 0, 3, 0],
    code: [
      { op: 'LOAD', arg: 0, text: 'LOAD [0]' },
      { op: 'ADD', arg: 7, text: 'ADD 7' },
      { op: 'STORE', arg: 1, text: 'STORE [1]' },
      { op: 'HALT', text: 'HALT' },
    ],
  },
  fault: {
    label: '非法地址故障拦截',
    mem: [5, 0, 0, 0],
    code: [
      { op: 'LOAD', arg: 0, text: 'LOAD [0]' },
      { op: 'LOAD', arg: 5, text: 'LOAD [5] ← 越界' },
      { op: 'HALT', text: 'HALT' },
    ],
  },
}

export function CpuCycleDemo() {
  const [progKey, setProgKey] = useState<'normal' | 'fault'>('normal')
  const [pc, setPc] = useState(0)
  const [acc, setAcc] = useState(0)
  const [carry, setCarry] = useState(0)
  const [phase, setPhase] = useState<'待机' | '取指' | '译码' | '执行' | '停机' | '地址故障'>('待机')
  const [ir, setIr] = useState('—')
  const [mem, setMem] = useState<number[]>([...cpuPrograms.normal.mem])
  const [note, setNote] = useState('点击「推进一步」依次经历 取指 → 译码 → 执行，观察 PC、IR、ACC 和 4 位指示灯的变化。')

  const program = cpuPrograms[progKey]

  function loadProgram(key: 'normal' | 'fault') {
    setProgKey(key)
    setPc(0)
    setAcc(0)
    setCarry(0)
    setPhase('待机')
    setIr('—')
    setMem([...cpuPrograms[key].mem])
    setNote('已复位微机状态，准备从 PC=0 开始取指。')
  }

  function stepCpu() {
    if (phase === '停机' || phase === '地址故障') return
    const inst = program.code[pc]
    if (!inst) {
      setPhase('停机')
      setNote('程序到达末尾，自动停机。')
      return
    }
    if (phase === '待机' || phase === '执行') {
      setPhase('取指')
      setIr(inst.text)
      setNote(`取指（Fetch）：按 PC=${pc} 从指令区读入「${inst.text}」放入指令寄存器 IR。`)
      return
    }
    if (phase === '取指') {
      setPhase('译码')
      setNote(`译码（Decode）：控制单元识别操作码 ${inst.op}${inst.arg !== undefined ? `，操作数 ${inst.arg}` : ''}。`)
      return
    }
    // phase === '译码' -> 执行
    if (inst.op === 'HALT') {
      setPhase('停机')
      setNote(`执行 HALT：CPU 正常停机，最终 ACC=${acc}（${acc.toString(2).padStart(4, '0')}₂），CF=${carry}。`)
      return
    }
    if (inst.op === 'LOAD') {
      const addr = inst.arg ?? 0
      if (addr < 0 || addr >= mem.length) {
        setPhase('地址故障')
        setNote(`执行失败：地址 [${addr}] 超出 0..${mem.length - 1}，触发地址故障保护并立即停机！`)
        return
      }
      const val = mem[addr] & 0xf
      setAcc(val)
      setPc((p) => p + 1)
      setPhase('执行')
      setNote(`执行 LOAD [${addr}]：把内存格 [${addr}] 的值 ${val} 装入 ACC，PC 推进到 ${pc + 1}。`)
      return
    }
    if (inst.op === 'ADD') {
      const sum = acc + (inst.arg ?? 0)
      setAcc(sum & 0xf)
      setCarry(sum >= 16 ? 1 : 0)
      setPc((p) => p + 1)
      setPhase('执行')
      setNote(`执行 ADD ${inst.arg}：${acc} + ${inst.arg} = ${sum} → 4 位 ACC 保留 ${sum & 0xf}，进位标志 CF=${sum >= 16 ? 1 : 0}，PC 推进到 ${pc + 1}。`)
      return
    }
    if (inst.op === 'STORE') {
      const addr = inst.arg ?? 0
      setMem((prev) => prev.map((v, i) => (i === addr ? acc : v)))
      setPc((p) => p + 1)
      setPhase('执行')
      setNote(`执行 STORE [${addr}]：把 ACC=${acc} 写回内存格 [${addr}]，PC 推进到 ${pc + 1}。`)
    }
  }

  const accBits = acc.toString(2).padStart(4, '0').split('')

  return (
    <>
      <p>单步驱动 4 位教学微机的「取指 → 译码 → 执行」循环，直观看见指令计数器 <code>PC</code>、累加器 <code>ACC</code> 与硬件越界拦截。</p>
      <div className="workspace-demo-controls">
        {(['normal', 'fault'] as const).map((key) => (
          <button key={key} type="button" className={`workspace-button${progKey === key ? ' workspace-primary' : ''}`}
            onClick={() => loadProgram(key)}>
            {cpuPrograms[key].label}
          </button>
        ))}
        <button type="button" className="workspace-button workspace-primary" disabled={phase === '停机' || phase === '地址故障'} onClick={stepCpu}>
          <Cpu size={15} aria-hidden="true" /> 推进一步（当前：{phase}）
        </button>
        <button type="button" className="workspace-button" onClick={() => loadProgram(progKey)}>
          <RotateCcw size={15} aria-hidden="true" /> 复位
        </button>
      </div>
      <div className="wd-cpu-grid">
        <div className="wd-cpu-box"><span>PC</span><strong>{pc}</strong></div>
        <div className="wd-cpu-box"><span>IR</span><strong>{ir}</strong></div>
        <div className="wd-cpu-box"><span>ACC</span><strong>{acc}</strong></div>
        <div className="wd-cpu-box"><span>CF 进位</span><strong>{carry}</strong></div>
        <div className="wd-cpu-box wd-cpu-leds">
          <span>4 位输出灯</span>
          <div>{accBits.map((b, i) => <i key={i} data-on={b === '1' || undefined}>{b}</i>)}</div>
        </div>
      </div>
      <div className="wd-cpu-mem" aria-label="微机四格内存">
        {mem.map((val, idx) => <span key={idx}>内存[{idx}] = <strong>{val}</strong></span>)}
      </div>
      <output className="workspace-demo-output">{note}</output>
    </>
  )
}

export function IotGatewayDemo() {
  const [clock, setClock] = useState(0)
  const [lastBeat, setLastBeat] = useState<number | null>(0)
  const [beatSeq, setBeatSeq] = useState(1)
  const [queue, setQueue] = useState<string[]>([])
  const [dropped, setDropped] = useState(0)
  const [alarms, setAlarms] = useState<string[]>([])
  const [tempVal, setTempVal] = useState(24)
  const [note, setNote] = useState('节点当前在线（超时阈值 6s，网关常规队列容量 2）。试试连续上报温度触发背压，或推进时钟触发心跳离线。')

  const offline = lastBeat === null || clock - lastBeat >= 6

  function sendBeat() {
    const nextSeq = beatSeq + 1
    setBeatSeq(nextSeq)
    setLastBeat(clock)
    setNote(`收到心跳 seq=${nextSeq}（t=${clock}s）：节点状态保持在线。`)
  }

  function advanceClock() {
    const next = clock + 2
    setClock(next)
    const isOff = lastBeat === null || next - lastBeat >= 6
    setNote(`时钟推进到 t=${next}s（距上次心跳 ${lastBeat === null ? '∞' : next - lastBeat}s）：${isOff ? '已达 6s 阈值，网关判定节点离线！' : '仍在超时窗口内，节点在线。'}`)
  }

  function sendReading() {
    const label = `${tempVal}°C`
    setTempVal((v) => (v >= 32 ? 22 : v + 2))
    if (queue.length >= 2) {
      const oldest = queue[0]
      setQueue((prev) => [...prev.slice(1), label])
      setDropped((d) => d + 1)
      setNote(`常规队列已满（容量 2）触发丢旧保新背压：丢弃最旧读数 ${oldest}，写入最新 ${label}。`)
    } else {
      setQueue((prev) => [...prev, label])
      setNote(`常规遥测 ${label} 已入队，等待下游上传。`)
    }
  }

  function sendAlarm() {
    const msgId = 'ALM-01'
    if (alarms.includes(msgId)) {
      setNote(`收到重传告警 ${msgId}（QoS 1 至少一次）：已命中去重表，忽略重复执行，避免重复误报！`)
      return
    }
    setAlarms((prev) => [...prev, msgId])
    setNote(`收到首次高温告警 ${msgId}：绕过常规队列直接优先登记（不受常规背压丢弃影响）。`)
  }

  function flushOne() {
    if (!queue.length) {
      setNote('常规队列当前为空，没有待上传读数。')
      return
    }
    const sent = queue[0]
    setQueue((prev) => prev.slice(1))
    setNote(`下游网络恢复：已成功上传最早缓存的读数 ${sent}。`)
  }

  function reset() {
    setClock(0); setLastBeat(0); setBeatSeq(1); setQueue([]); setDropped(0); setAlarms([]); setTempVal(24)
    setNote('已重置边缘网关模拟器。')
  }

  return (
    <>
      <p>亲手演练物联网边缘网关的三大可靠性机制：心跳超时判离线、容量 2 有界背压（丢旧保新）与 QoS 1 告警去重。</p>
      <div className="workspace-demo-controls">
        <button type="button" className="workspace-button workspace-primary" onClick={sendBeat}><Radio size={15} aria-hidden="true" /> 发送心跳</button>
        <button type="button" className="workspace-button" onClick={advanceClock}>推进时钟 +2s</button>
        <button type="button" className="workspace-button" onClick={sendReading}>上报温度 ({tempVal}°C)</button>
        <button type="button" className="workspace-button" onClick={sendAlarm}>发告警 ALM-01（可重发）</button>
        <button type="button" className="workspace-button" onClick={flushOne}>上传 1 条</button>
        <button type="button" className="workspace-button" onClick={reset}><RotateCcw size={15} aria-hidden="true" /> 重置</button>
      </div>
      <div className="wd-cpu-grid">
        <div className="wd-cpu-box"><span>当前时钟</span><strong>t = {clock}s</strong></div>
        <div className="wd-cpu-box" data-warn={offline || undefined}><span>节点状态</span><strong>{offline ? '离线告警' : '在线正常'}</strong></div>
        <div className="wd-cpu-box"><span>常规队列 ({queue.length}/2)</span><strong>{queue.length ? queue.join(' , ') : '空'}</strong></div>
        <div className="wd-cpu-box"><span>背压丢弃</span><strong>{dropped} 条</strong></div>
        <div className="wd-cpu-box"><span>已去重告警</span><strong>{alarms.length} 次</strong></div>
      </div>
      <output className="workspace-demo-output">{note}</output>
    </>
  )
}
