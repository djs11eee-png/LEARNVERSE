import { ArrowRight, Radio, RotateCcw, TestTube2 } from 'lucide-react'
import { useState } from 'react'
import { ThemeSelect } from '../components/ThemeSelect'
import { algorithms, traceBinarySearch } from '../data/lab'
import type { WorkspaceLesson } from '../data/workspaceCourses'
import {
  BinaryCarryDemo,
  BitmaskFrameDemo,
  BubbleSortDemo,
  CPointerDemo,
  CpuCycleDemo,
  IotGatewayDemo,
  LruCacheDemo,
  StackQueueDemo,
} from './workspaceDemosExtra'

export function WorkspaceDemo({ demo }: { demo: NonNullable<WorkspaceLesson['demo']> }) {
  return (
    <section className="workspace-demo" aria-labelledby="workspace-demo-title">
      <h2 id="workspace-demo-title"><TestTube2 size={18} aria-hidden="true" /> 动手试一试</h2>
      {demo === 'range' && <RangeDemo />}
      {demo === 'search' && <SearchDemo />}
      {demo === 'publish-subscribe' && <TopicDemo />}
      {demo === 'binary-carry' && <BinaryCarryDemo />}
      {demo === 'bitmask-frame' && <BitmaskFrameDemo />}
      {demo === 'c-pointer' && <CPointerDemo />}
      {demo === 'bubble-sort' && <BubbleSortDemo />}
      {demo === 'stack-queue' && <StackQueueDemo />}
      {demo === 'lru-cache' && <LruCacheDemo />}
      {demo === 'cpu-cycle' && <CpuCycleDemo />}
      {demo === 'iot-gateway' && <IotGatewayDemo />}
    </section>
  )
}

function RangeDemo() {
  const [start, setStart] = useState('0')
  const [stop, setStop] = useState('10')
  const [step, setStep] = useState('3')
  const numbers = [start, stop, step].map(Number)
  const [first, end, interval] = numbers
  const valid = [start, stop, step].every((value) => /^[+-]?\d+$/.test(value)) &&
    numbers.every((value) => Number.isSafeInteger(value) && Math.abs(value) <= 100)

  const count = interval === 0 ? 0 : Math.max(0, Math.ceil((end - first) / interval))
  const values = valid ? Array.from({ length: Math.min(count, 16) }, (_, index) => first + index * interval) : []
  let result = `[${values.join(', ')}${count > 16 ? ', …' : ''}]`
  if (!valid) result = '请输入 −100 到 100 之间的整数。'
  else if (interval === 0) result = '步长不能为 0。'
  else if (count > 16) result += ` · 共 ${count} 项，展示前 16 项`

  return (
    <>
      <p>改一改起点、终点和步长。试试把三项设为 5、0、−2，观察终点是否出现。</p>
      <div className="workspace-demo-controls">
        <label>起点<input type="number" min={-100} max={100} value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>终点<input type="number" min={-100} max={100} value={stop} onChange={(event) => setStop(event.target.value)} /></label>
        <label>步长<input type="number" min={-100} max={100} value={step} onChange={(event) => setStep(event.target.value)} /></label>
      </div>
      <output className="workspace-demo-output">{result}</output>
    </>
  )
}

function SearchDemo() {
  const values = algorithms.binary.sample
  const [target, setTarget] = useState(79)
  const [step, setStep] = useState(0)
  const frames = traceBinarySearch(values, target)
  const frame = frames[step]
  const lastStep = frames.length - 1
  const leftPtr = frame.range?.length ? frame.range[0] : -1
  const rightPtr = frame.range?.length ? frame.range[frame.range.length - 1] : -1
  const midPtr = frame.active[0] ?? -1

  return (
    <>
      <p>选一个目标值，每次推进一步，观察左边界 <code>L</code>、中点 <code>M</code> 与右边界 <code>R</code> 如何把候选区每次折半。</p>
      <div className="workspace-demo-controls">
        <ThemeSelect label="目标值" value={String(target)} onChange={(value) => { setTarget(Number(value)); setStep(0) }} options={
          [...values, 99].map((value) => ({ value: String(value), label: String(value) }))
        } />
        <button type="button" className="workspace-button workspace-primary" onClick={() => setStep(step + 1)} disabled={step === lastStep}>推进一步 <ArrowRight size={16} aria-hidden="true" /></button>
        <button type="button" className="workspace-button" onClick={() => setStep(0)} disabled={step === 0}><RotateCcw size={15} aria-hidden="true" /> 重置</button>
      </div>
      <ol className="workspace-demo-values workspace-demo-values--ptrs" aria-label="正在查找的数组">
        {values.map((value, index) => {
          const tags = [
            index === leftPtr ? 'L' : '',
            index === midPtr ? 'M' : '',
            index === rightPtr ? 'R' : '',
          ].filter(Boolean).join('/')
          return (
            <li key={value} data-search-state={frame.active.includes(index) ? 'active' : frame.range?.includes(index) ? 'candidate' : 'discarded'}>
              <span className="wd-ptr-tag" aria-hidden="true">{tags || '\u00a0'}</span>
              <strong>{value}</strong>
              <small>[{index}]</small>
              <span className="workspace-sr-only">（{frame.active.includes(index) ? '正在比较' : frame.range?.includes(index) ? '候选' : '已排除'}）</span>
            </li>
          )
        })}
      </ol>
      <output className="workspace-demo-output">{frame.message}</output>
    </>
  )
}

function TopicDemo() {
  const [panel, setPanel] = useState(true)
  const [logger, setLogger] = useState(true)
  const [messages, setMessages] = useState(0)
  const [result, setResult] = useState('等待读数。')

  function publish() {
    const sequence = messages + 1
    const reading = (21 + (sequence % 9) / 10).toFixed(1)
    const receivers = [panel ? '面板节点' : '', logger ? '记录节点' : ''].filter(Boolean)
    setMessages(sequence)
    setResult(receivers.length
      ? `读数 ${sequence}：${reading} °C，${receivers.join('、')}收到消息。`
      : `读数 ${sequence}：${reading} °C，目前没有订阅者。`)
  }

  return (
    <>
      <p>选择订阅温度话题的节点，再发布一条新读数。更改订阅后再发一条，比较两次接收结果。</p>
      <div className="workspace-demo-controls">
        <label className="workspace-demo-toggle"><input type="checkbox" checked={panel} onChange={(event) => setPanel(event.target.checked)} /> 面板节点</label>
        <label className="workspace-demo-toggle"><input type="checkbox" checked={logger} onChange={(event) => setLogger(event.target.checked)} /> 记录节点</label>
        <button type="button" className="workspace-button" onClick={publish}><Radio size={16} aria-hidden="true" /> 发布读数</button>
      </div>
      <output className="workspace-demo-output">{result}</output>
    </>
  )
}
