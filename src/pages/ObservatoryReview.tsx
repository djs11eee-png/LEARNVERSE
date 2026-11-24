import { ArrowUpRight, Cloud, LibraryBig, MessageCircle, Orbit, TrendingUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { CodeWorkbench } from '../components/CodeWorkbench'
import type { CodeWorkbenchIssue } from '../components/CodeWorkbench'
import { AssistantDrawer } from '../components/observatory/AssistantDrawer'
import { AssistantPet, moodText } from '../components/observatory/AssistantPet'
import { GuestGate } from '../components/observatory/GuestGate'
import { ASSISTANT_NAME } from '../components/observatory/contracts'
import type { ErrorContext, GateReason, PetMood } from '../components/observatory/contracts'
import { demoAssistant, demoAuth, demoStarter } from '../components/observatory/reviewFixtures'
import { useVesperState } from '../components/observatory/useVesperState'
import '../styles/observatory-tokens.css'
import '../components/observatory/observatory.css'

type Action = { reason: GateReason; opener: HTMLElement; context?: ErrorContext }
type Panel = { kind: 'auth' | 'assistant'; action: Action }

function makeContext({ code, diagnostic, language }: CodeWorkbenchIssue): ErrorContext {
  const lines = code.split(/\r\n?|\n/)
  const anchor = Math.min(diagnostic.line ?? 1, lines.length) - 1
  const start = Math.max(0, anchor - 4)
  const end = Math.min(lines.length, anchor + 5)
  const excerpt = lines.slice(start, end).join('\n')
  const source = excerpt.slice(0, 2400).replace(/[\uD800-\uDBFF]$/, '')
  return {
    message: diagnostic.message.slice(0, 1000), line: diagnostic.line, column: diagnostic.column,
    ...(source && { reference: { id: crypto.randomUUID(), language, source, start_line: start + 1, truncated: start > 0 || end < lines.length || source.length < excerpt.length } }),
  }
}

export default function ObservatoryReview() {
  const [panel, setPanel] = useState<Panel>()
  const [authenticated, setAuthenticated] = useState(false)
  const [cloudNote, setCloudNote] = useState('')
  const vesper = useVesperState('idle')
  const workbench = useRef<HTMLElement>(null)

  function continueAction(action: Action) {
    if (action.reason === 'assistant') setPanel({ kind: 'assistant', action })
    else {
      setPanel(undefined)
      setCloudNote(action.reason === 'sync_cards' ? '卡册同步已触发（演示）' : '进度同步已触发（演示）')
    }
  }

  function request(action: Action) {
    if (action.context) vesper.triggerAlert()
    if (authenticated) continueAction(action)
    else setPanel({ kind: 'auth', action })
  }

  const drawerOpen = panel?.kind === 'assistant'

  return (
    <div className="lv-observatory lvo-review">
      <header className="lvo-review-header">
        <div>
          <p className="lvo-kicker"><Orbit size={17} aria-hidden /> LEARNVERSE / UI REVIEW</p>
          <h1>观测站联络台</h1>
          <p>以游客身份运行示例。同步学习记录或联系 {ASSISTANT_NAME} 时，再登录。</p>
        </div>
        <span className="lvo-review-state"><span aria-hidden />{authenticated ? '已登录 · 演示' : '当前以游客身份浏览'}</span>
      </header>
      <div className="lvo-review-grid">
        <section className="lvo-bay" ref={workbench} aria-labelledby="lvo-review-workbench">
          <header className="lvo-bay-header">
            <div>
              <h2 id="lvo-review-workbench">信号实验台</h2>
              <p>运行示例，在报错区把出错的片段带给 {ASSISTANT_NAME}。</p>
            </div>
            <span className="lvo-bay-icon"><MessageCircle size={20} strokeWidth={1.5} aria-hidden /></span>
          </header>
          <CodeWorkbench
            language="javascript"
            starter={demoStarter}
            title="信号循环"
            draftKey="observatory-ui-review-v1"
            onAskAboutError={(issue, opener) => request({ reason: 'assistant', opener, context: makeContext(issue) })}
          />
        </section>
        <aside className="lvo-controls" aria-label="样板操作">
          <section className="lvo-cloud" aria-labelledby="lvo-cloud-title">
            <div className="lvo-cloud-art" aria-hidden="true"><Orbit size={106} strokeWidth={0.42} /><Cloud size={30} strokeWidth={1.45} /></div>
            <h2 id="lvo-cloud-title">云端同步</h2>
            <p>两个入口共用访客登录。请用任意测试账号和密码体验。</p>
            <button className="lvo-action" type="button" onClick={event => request({ reason: 'sync_cards', opener: event.currentTarget })}>
              <LibraryBig size={17} aria-hidden />同步卡册<ArrowUpRight size={15} aria-hidden />
            </button>
            <button className="lvo-action" type="button" onClick={event => request({ reason: 'sync_progress', opener: event.currentTarget })}>
              <TrendingUp size={17} aria-hidden />同步进度<ArrowUpRight size={15} aria-hidden />
            </button>
            <p className="lvo-cloud-note" role="status">{cloudNote}</p>
            {authenticated && (
              <button className="lvo-text" type="button" onClick={() => { setAuthenticated(false); setCloudNote('') }}>
                恢复游客身份
              </button>
            )}
          </section>
          <section className="lvo-pet-settings" aria-labelledby="lvo-pet-title">
            <h2 id="lvo-pet-title">{ASSISTANT_NAME} 状态与动画</h2>
            <p>思考态视线朝向右上方胶囊；完成态单次播放后自动回归待机，期间可随时打断切回思考。</p>
            <div role="group" aria-label="预览桌宠状态">
              {(Object.keys(moodText) as PetMood[]).map(value => (
                <button
                  key={value}
                  className="lvo-text"
                  type="button"
                  aria-pressed={vesper.mood === value}
                  onClick={() => vesper.setMood(value)}
                >
                  {moodText[value]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lvo-text lvo-open-inline"
              onClick={event => request({ reason: 'assistant', opener: event.currentTarget })}
            >
              <MessageCircle size={17} aria-hidden /> 和 {ASSISTANT_NAME} 对话
            </button>
          </section>
        </aside>
      </div>

      <AssistantPet
        mood={vesper.mood}
        editorRegion={workbench}
        drawerOpen={drawerOpen}
        onOpen={opener => request({ reason: 'assistant', opener })}
      />

      {panel?.kind === 'auth' && (
        <GuestGate
          reason={panel.action.reason}
          adapter={demoAuth}
          opener={panel.action.opener}
          onDismiss={() => setPanel(undefined)}
          onAuthenticated={() => {
            setAuthenticated(true)
            continueAction(panel.action)
          }}
        />
      )}

      {panel?.kind === 'assistant' && (
        <AssistantDrawer
          context={panel.action.context}
          opener={panel.action.opener}
          transport={demoAssistant}
          mood={vesper.mood}
          onDismiss={() => {
            setPanel(undefined)
            if (vesper.mood === 'thinking') vesper.returnToIdle()
          }}
          onMoodChange={vesper.setMood}
        />
      )}
    </div>
  )
}
