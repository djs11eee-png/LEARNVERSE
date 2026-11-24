import { ArrowUp, Maximize2, Minimize2, Sparkles, Square, TriangleAlert, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { AssistantMarkdown, CodeReferenceCard, DiagnosisCard } from './AssistantCards'
import { moodText } from './AssistantPet'
import { ASSISTANT_NAME } from './contracts'
import type { AssistantTransport, CodeReference, Diagnosis, ErrorContext, PetMood } from './contracts'
import { containTab, useStationDialog, useVisibleViewport } from './dialog'
import { VesperAvatar, VesperStage } from './VesperStage'

interface Turn {
  question: string
  requestId: string
  context?: ErrorContext
  text: string
  references: CodeReference[]
  diagnoses: Diagnosis[]
  error?: string
  stopped?: boolean
}

interface AssistantDrawerProps {
  context?: ErrorContext
  opener: HTMLElement | null
  transport: AssistantTransport
  mood: PetMood
  footerNote?: string
  onDismiss: () => void
  onMoodChange: (mood: PetMood) => void
}

const STREAM_TELEMETRY = [
  '正在读取代码与上下文…',
  '定位报错行与语法结构…',
  '生成启发式排查指引…',
]

const MOBILE_DRAWER_MQ = '(max-width: 860px), (pointer: coarse) and (max-width: 940px)'

export function AssistantDrawer({ context, opener, transport, mood, footerNote, onDismiss, onMoodChange }: AssistantDrawerProps) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const pinned = useRef(true)
  const job = useRef<AbortController | null>(null)
  const conversationId = useRef<string>(undefined)

  const [full, setFull] = useState(false)
  const [question, setQuestion] = useState(context ? '帮我理解这个报错，给我一个排查提示。' : '')
  const [attachment, setAttachment] = useState(context)
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [telemetryStep, setTelemetryStep] = useState(0)
  const [isMobileDrawer, setIsMobileDrawer] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_DRAWER_MQ).matches,
  )
  const viewport = useVisibleViewport()
  useStationDialog(dialog, heading, opener)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_DRAWER_MQ)
    const onChange = () => setIsMobileDrawer(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => () => job.current?.abort(), [])

  useLayoutEffect(() => {
    if (turns.length && pinned.current && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight
    }
  }, [turns, busy])

  useEffect(() => {
    if (mood !== 'thinking') {
      setTelemetryStep(0)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => {
      setTelemetryStep(step => (step + 1) % STREAM_TELEMETRY.length)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [mood])

  function patchLast(update: (turn: Turn) => Turn) {
    setTurns(current => current.map((turn, index) => index === current.length - 1 ? update(turn) : turn))
  }

  async function submitQuestion(rawText: string) {
    const text = rawText.trim()
    if (!text) return

    // High-priority interrupt: abort any prior stream OR immediately interrupt ongoing `success` celebration -> `thinking`
    if (job.current) {
      job.current.abort()
      job.current = null
    }

    const controller = new AbortController()
    const requestId = crypto.randomUUID()
    job.current = controller
    pinned.current = true
    setBusy(true)
    onMoodChange('thinking')
    setAnnouncement(`${ASSISTANT_NAME} 正在思考。`)
    setTurns(current => [...current, { requestId, question: text, context: attachment, text: '', references: [], diagnoses: [] }])
    setQuestion('')
    setAttachment(undefined)

    let seq = 0
    let terminal = false
    let failed = false
    let hasDiagnosis = false
    try {
      for await (const event of transport({ v: 1, request_id: requestId, conversation_id: conversationId.current, question: text, context: attachment }, controller.signal)) {
        if (controller.signal.aborted) return
        if (event.v !== 1 || event.request_id !== requestId || event.seq !== ++seq
          || ((seq === 1) !== (event.type === 'response.started'))) throw new Error('事件序列不完整')
        switch (event.type) {
          case 'response.started':
            conversationId.current = event.conversation_id
            break
          case 'text.delta':
            patchLast(turn => ({ ...turn, text: turn.text + event.delta }))
            break
          case 'code.reference':
            patchLast(turn => ({ ...turn, references: [...turn.references, event.reference] }))
            break
          case 'diagnostic.card':
            hasDiagnosis = true
            patchLast(turn => ({ ...turn, diagnoses: [...turn.diagnoses, event.diagnosis] }))
            break
          case 'response.done':
            terminal = true
            setAnnouncement(hasDiagnosis ? `${ASSISTANT_NAME} 已回复，报错诊断可查看。` : `${ASSISTANT_NAME} 已回复。`)
            break
          case 'response.error':
            terminal = true
            failed = true
            patchLast(turn => ({ ...turn, error: event.error.message }))
            setAnnouncement('回复失败。')
            break
        }
        if (terminal) break
      }
      if (!terminal && !controller.signal.aborted) throw new Error('流提前结束')
    } catch {
      if (!controller.signal.aborted) {
        failed = true
        patchLast(turn => ({ ...turn, error: '回复连接中断，可以重新提问。' }))
        setAnnouncement('回复连接中断。')
      }
    } finally {
      if (job.current === controller && !controller.signal.aborted) {
        job.current = null
        setBusy(false)
        // Successful completion triggers one-shot `success` celebration (auto-returns to idle, interruptible anytime)
        onMoodChange(failed ? 'alert' : 'success')
      }
    }
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    void submitQuestion(question)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      if (!busy && question.trim()) {
        event.preventDefault()
        void submitQuestion(question)
      }
    }
  }

  function stop() {
    job.current?.abort()
    job.current = null
    patchLast(turn => ({ ...turn, stopped: true }))
    setBusy(false)
    onMoodChange('idle')
    setAnnouncement('已停止回复。')
    composer.current?.focus()
  }

  const showGazeCapsule = mood === 'thinking' || mood === 'success' || mood === 'alert'
  const capsuleLabel =
    mood === 'thinking' ? STREAM_TELEMETRY[telemetryStep]
      : mood === 'success' ? '答疑已送达，可随时追问'
        : mood === 'alert' ? '附上报错后发送，我帮你定位'
          : ''

  return (
    <dialog
      className="lvo-dialog lvo-drawer"
      data-full={full}
      data-mood={mood}
      ref={dialog}
      style={viewport}
      aria-labelledby={`${id}-title`}
      onKeyDown={containTab}
      onClick={event => {
        if (event.target === event.currentTarget) onDismiss()
      }}
      onCancel={event => {
        event.preventDefault()
        onDismiss()
      }}
    >
      {/* Desktop bottom-left live Vesper companion gazing UP-RIGHT straight into the AI reply cards */}
      <aside className="lvo-drawer-companion" aria-hidden="true" data-mood={mood}>
        <div className="lvo-companion-gaze" data-visible={showGazeCapsule} data-mood={mood}>
          <span className="lvo-gaze-tether"><i /><i /></span>
          {showGazeCapsule && (
            <div className="lvo-companion-capsule" data-mood={mood}>
              {mood === 'thinking' && <span className="lvo-gaze-pulse"><i /><i /><i /></span>}
              {mood === 'success' && <Sparkles size={13} />}
              {mood === 'alert' && <TriangleAlert size={13} />}
              <div>
                <strong>
                  {mood === 'thinking' ? `${ASSISTANT_NAME} 思考中`
                    : mood === 'success' ? '解析完成'
                      : '待排查报错'}
                </strong>
                <span>{capsuleLabel}</span>
              </div>
            </div>
          )}
        </div>
        {!isMobileDrawer && <VesperStage mood={mood} active className="lvo-companion-stage" />}
      </aside>

      {/* Main chat drawer glass sheet */}
      <div className="lvo-drawer-sheet">
        <header className="lvo-drawer-header">
          <span className="lvo-drawer-avatar"><VesperAvatar mood={mood} /></span>
          <div className="lvo-drawer-name">
            <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>和 {ASSISTANT_NAME} 对话</h2>
            <span className="lvo-pet-label">
              <span data-mood={mood} />
              <span>{moodText[mood]}</span>
              {mood === 'thinking' && <em className="lvo-header-telemetry">· {STREAM_TELEMETRY[telemetryStep]}</em>}
            </span>
          </div>
          <button
            type="button"
            className="lvo-icon lvo-resize"
            aria-label={full ? '缩为半屏' : '展开至全屏'}
            onClick={() => setFull(value => !value)}
          >
            {full ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
          </button>
          <button type="button" className="lvo-icon" aria-label="关闭助手抽屉" onClick={onDismiss}>
            <X size={20} aria-hidden />
          </button>
        </header>

        <span className="lvo-sr-only" role="status">{announcement}</span>

        <div
          className="lvo-thread"
          ref={scroller}
          onScroll={event => {
            const pane = event.currentTarget
            pinned.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 96
          }}
        >
          {!turns.length && !attachment && (
            <div className="lvo-empty">
              <VesperAvatar mood={mood} className="lvo-empty-avatar" />
              <p>遇到难懂的代码，或者刚好卡在一个报错上？</p>
              <div className="lvo-empty-chips">
                <button
                  type="button"
                  className="lvo-text"
                  onClick={() => {
                    setQuestion('我应该怎样读懂一个程序报错？')
                    composer.current?.focus()
                  }}
                >
                  我应该怎样读懂一个程序报错？
                </button>
                <button
                  type="button"
                  className="lvo-text"
                  onClick={() => {
                    void submitQuestion('帮我总结一套快速定位语法错误的三步法。')
                  }}
                >
                  快速定位语法错误三步法
                </button>
              </div>
            </div>
          )}

          {turns.map((turn, index) => {
            const isLatest = index === turns.length - 1
            return (
              <article key={turn.requestId} className="lvo-turn" aria-label={`第 ${index + 1} 轮对话`}>
                <div className="lvo-question">
                  <p>{turn.question}</p>
                  {turn.context && <small>已附上报错{turn.context.reference && '和代码片段'}</small>}
                </div>
                <div className="lvo-reply" data-streaming={busy && isLatest}>
                  <div className="lvo-reply-head">
                    <span className="lvo-reply-name">{ASSISTANT_NAME}</span>
                    {busy && isLatest && (
                      <span className="lvo-reply-thinking-chip">
                        <span className="lvo-gaze-pulse" aria-hidden="true"><i /><i /><i /></span>
                        推理生成中
                      </span>
                    )}
                    {!busy && isLatest && mood === 'success' && !turn.error && !turn.stopped && (
                      <span className="lvo-reply-done-chip">
                        <Sparkles size={12} aria-hidden="true" />
                        已完成
                      </span>
                    )}
                  </div>
                  {turn.text && <AssistantMarkdown text={turn.text} />}
                  {busy && isLatest && <span className="lvo-cursor" aria-hidden />}
                  {turn.references.map(reference => <CodeReferenceCard key={reference.id} reference={reference} />)}
                  {turn.diagnoses.map(diagnosis => <DiagnosisCard key={diagnosis.id} diagnosis={diagnosis} />)}
                  {turn.stopped && <p className="lvo-card-note">已停止回复。</p>}
                  {turn.error && <p className="lvo-error"><TriangleAlert size={16} aria-hidden />{turn.error}</p>}
                </div>
              </article>
            )
          })}

          {attachment && (
            <div className="lvo-attachments">
              <div className="lvo-attachment-error">
                <TriangleAlert size={17} aria-hidden />
                <div>
                  <strong>即将附上的报错</strong>
                  <p>{attachment.message}</p>
                </div>
                <button
                  className="lvo-text"
                  type="button"
                  aria-label="移除报错和代码"
                  onClick={() => {
                    setAttachment(undefined)
                    composer.current?.focus()
                  }}
                >
                  移除
                </button>
              </div>
              {attachment.reference && (
                <CodeReferenceCard
                  reference={attachment.reference}
                  onRemove={() => {
                    setAttachment({ ...attachment, reference: undefined })
                    composer.current?.focus()
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Mobile compact bottom-left Vesper gaze companion strip (collapses smoothly when keyboard opens) */}
        <div className="lvo-mobile-drawer-pet" aria-hidden="true" data-mood={mood}>
          {isMobileDrawer && <VesperStage mood={mood} active className="lvo-mobile-drawer-stage" />}
          <div className="lvo-mobile-drawer-gaze" data-mood={mood}>
            <span className="lvo-mobile-gaze-tag">
              {mood === 'thinking' && <span className="lvo-gaze-pulse"><i /><i /><i /></span>}
              {mood === 'success' && <Sparkles size={12} />}
              {mood === 'alert' && <TriangleAlert size={12} />}
              <strong>{mood === 'thinking' ? `${ASSISTANT_NAME} 思考中` : mood === 'success' ? '答疑完成' : mood === 'alert' ? '发现报错' : `${ASSISTANT_NAME} 伴学中`}</strong>
            </span>
            <span className="lvo-mobile-gaze-sub">
              {mood === 'thinking' ? STREAM_TELEMETRY[telemetryStep]
                : mood === 'success' ? '庆祝动画期间可随时输入下一问直接打断'
                  : mood === 'alert' ? '发送后为你定位根因'
                    : '输入问题或带入代码报错'}
            </span>
          </div>
        </div>

        <form className="lvo-compose" onSubmit={send}>
          <div className="lvo-compose-row">
            <label htmlFor={`${id}-question`} className="lvo-sr-only">给 {ASSISTANT_NAME} 的问题</label>
            <textarea
              ref={composer}
              id={`${id}-question`}
              value={question}
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={2}
              maxLength={2000}
              placeholder={mood === 'success' ? `随时继续追问 ${ASSISTANT_NAME}（立即切回思考）…` : `问 ${ASSISTANT_NAME} 一个问题…`}
            />
            <button
              className="lvo-primary"
              type={busy ? 'button' : 'submit'}
              onClick={busy ? stop : undefined}
              disabled={!busy && !question.trim()}
              aria-label={busy ? '停止回复' : `发送给 ${ASSISTANT_NAME}`}
            >
              {busy ? <Square size={16} aria-hidden /> : <ArrowUp size={20} aria-hidden />}
            </button>
          </div>
          <p>{attachment ? '发送时会附上上方保留的内容。' : (footerNote ?? 'Enter 发送，Shift + Enter 换行 · 当前为样板模拟流式答疑。')}</p>
        </form>
      </div>
    </dialog>
  )
}
