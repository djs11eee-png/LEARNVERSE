import { ChevronsLeft, PartyPopper, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, RefObject } from 'react'
import { ASSISTANT_NAME } from './contracts'
import type { PetMood } from './contracts'
import { VesperAvatar, VesperStage } from './VesperStage'

export const moodText: Record<PetMood, string> = {
  idle: '待机',
  thinking: '思考中',
  success: '已完成',
  alert: '有报错',
  celebrating: '欢呼中',
}

const CELEBRATE_PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * 360 + (i % 3) * 7
  const dist = 54 + (i % 4) * 26
  const size = 5 + (i % 3) * 3
  const delay = (i % 6) * 110
  const tone = i % 2 === 0 ? 'cyan' : 'gold'
  const star = i % 3 === 0
  return { i, angle, dist, size, delay, tone, star }
})

const AMBIENT_LINES = [
  '星图已校准，遇到报错随时点我。',
  '运行出错？点「一键带错」我带你排查。',
  '别急着重写，我们缩成最小片段定位。',
  '写代码像观星，先找第一颗偏轨的符号。',
  '随时点我，展开观测站答疑台。',
]

const THINKING_STEPS = [
  '正在解析问题与代码上下文…',
  '推理报错路径与语法边界…',
  '整理分步启发式排查提示…',
]

const MOBILE_DOCK_MQ = '(max-width: 940px), (pointer: coarse)'

type Point = { x: number; y: number }

export function AssistantPortrait({ mood = 'idle' }: { mood?: PetMood }) {
  return <VesperAvatar mood={mood} />
}

export interface AssistantPetProps {
  mood: PetMood
  editorRegion?: RefObject<HTMLElement | null>
  /** Route or context key to re-bind mobile editor avoidance after client-side navigation */
  observeKey?: string
  /** Pause offscreen rAF rendering when the modal drawer is covering the page */
  drawerOpen?: boolean
  /** Optional override for upper-right status subline during thinking/success/alert */
  statusHint?: string
  /** Celebration bubble copy displayed during `celebrating` state */
  celebrateMessage?: string
  /** Optional custom proactive ambient speech lines (e.g. Home Seoul Guardian mode) */
  ambientLines?: string[]
  /** Optional custom aria-label for the main clickable mascot trigger */
  actionLabel?: string
  onOpen: (trigger: HTMLElement) => void
}

export function AssistantPet({
  mood,
  editorRegion,
  observeKey,
  drawerOpen = false,
  statusHint,
  celebrateMessage,
  ambientLines = AMBIENT_LINES,
  actionLabel,
  onOpen,
}: AssistantPetProps) {
  const dock = useRef<HTMLDivElement>(null)
  const desktopButton = useRef<HTMLButtonElement>(null)
  const restoreButton = useRef<HTMLButtonElement>(null)
  const wantsFocus = useRef(false)
  const drag = useRef<{ pointer: number; start: Point; origin: Point; moved: boolean } | null>(null)
  const suppressClickUntil = useRef(0)

  const [position, setPosition] = useState<Point>()
  const [dragging, setDragging] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileAvoid, setMobileAvoid] = useState(false)
  const [gazeFlipLeft, setGazeFlipLeft] = useState(false)
  const [isMobileDock, setIsMobileDock] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_DOCK_MQ).matches,
  )

  // Proactive ambient speech bubble (dsh-pet style)
  const [ambientIndex, setAmbientIndex] = useState(0)
  const [ambientVisible, setAmbientVisible] = useState(false)
  const [ambientSilenced, setAmbientSilenced] = useState(false)
  const [thinkingStep, setThinkingStep] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_DOCK_MQ)
    const onChange = () => setIsMobileDock(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Cycle thinking telemetry caption smoothly while in thinking state
  useEffect(() => {
    if (mood !== 'thinking') {
      setThinkingStep(0)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => {
      setThinkingStep(prev => (prev + 1) % THINKING_STEPS.length)
    }, 1800)
    return () => window.clearInterval(timer)
  }, [mood])

  // Gentle proactive speech bubbles during idle state (respecting user dismiss & reduced motion)
  useEffect(() => {
    if (mood !== 'idle' || collapsed || drawerOpen || ambientSilenced) {
      setAmbientVisible(false)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setAmbientVisible(false)
      return
    }

    let hideTimer: number | undefined
    let cycleTimer: number | undefined
    const showOnce = (advance: boolean) => {
      if (advance) setAmbientIndex(i => (i + 1) % Math.max(1, ambientLines.length))
      setAmbientVisible(true)
      hideTimer = window.setTimeout(() => {
        setAmbientVisible(false)
        cycleTimer = window.setTimeout(() => showOnce(true), 18_000)
      }, 7_500)
    }

    const introTimer = window.setTimeout(() => showOnce(false), 1_600)
    return () => {
      window.clearTimeout(introTimer)
      if (hideTimer !== undefined) window.clearTimeout(hideTimer)
      if (cycleTimer !== undefined) window.clearTimeout(cycleTimer)
    }
  }, [mood, collapsed, drawerOpen, ambientSilenced, ambientLines.length])

  // Mobile collision avoidance for editor, focused inputs, and soft keyboard
  useEffect(() => {
    let intersects = false
    let observer: IntersectionObserver | undefined
    let mutObserver: MutationObserver | undefined
    let trackedEditors: Element[] = []
    let scanFrame = 0
    const viewport = window.visualViewport
    function update() {
      const focused = document.activeElement
      const editing = focused instanceof HTMLElement && (focused.matches('textarea, input:not([type="button"])') || focused.isContentEditable)
      const keyboard = viewport && viewport.height < innerHeight * 0.78
      setMobileAvoid(intersects || editing || Boolean(keyboard))
    }
    function observeDockArea(force = false) {
      const nextEditors = Array.from(editorRegion?.current?.querySelectorAll('.code-workbench-editor') ?? [])
      if (
        !force
        && observer
        && nextEditors.length === trackedEditors.length
        && nextEditors.every((el, idx) => el === trackedEditors[idx])
      ) {
        return
      }
      trackedEditors = nextEditors
      observer?.disconnect()
      observer = undefined
      if (nextEditors.length === 0) {
        intersects = false
        update()
        return
      }
      const intersectingSet = new Set<Element>()
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersectingSet.add(entry.target)
          else intersectingSet.delete(entry.target)
        }
        intersects = intersectingSet.size > 0
        update()
      }, {
        rootMargin: `-${Math.max(0, innerHeight - 112)}px 0px 0px 0px`,
      })
      nextEditors.forEach(el => observer!.observe(el))
    }
    function scheduleScan() {
      if (scanFrame) return
      scanFrame = window.requestAnimationFrame(() => {
        scanFrame = 0
        observeDockArea(false)
      })
    }
    function onResize() {
      observeDockArea(true)
    }
    observeDockArea(true)
    if (editorRegion?.current) {
      mutObserver = new MutationObserver(scheduleScan)
      mutObserver.observe(editorRegion.current, { childList: true, subtree: true })
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', updateSoon)
    viewport?.addEventListener('resize', update)
    function updateSoon() { queueMicrotask(update) }
    return () => {
      if (scanFrame) window.cancelAnimationFrame(scanFrame)
      observer?.disconnect()
      mutObserver?.disconnect()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', updateSoon)
      viewport?.removeEventListener('resize', update)
    }
  }, [editorRegion, observeKey])

  function clamp({ x, y }: Point): Point {
    const w = dock.current?.offsetWidth ?? 232
    const h = dock.current?.offsetHeight ?? 214
    const clampedX = Math.max(8, Math.min(x, innerWidth - w - 8))
    const clampedY = Math.max(16, Math.min(y, innerHeight - h - 8))
    setGazeFlipLeft(clampedX + w > innerWidth - 210)
    return { x: clampedX, y: clampedY }
  }

  useEffect(() => {
    const resize = () => setPosition(current => current && clamp(current))
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (wantsFocus.current) (collapsed ? restoreButton.current : desktopButton.current)?.focus()
    wantsFocus.current = false
  }, [collapsed])

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.pointerType === 'touch' || !dock.current) return
    const box = dock.current.getBoundingClientRect()
    drag.current = {
      pointer: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: box.left, y: box.top },
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (!active || active.pointer !== event.pointerId) return
    const dx = event.clientX - active.start.x
    const dy = event.clientY - active.start.y
    if (!active.moved && Math.hypot(dx, dy) < 6) return
    active.moved = true
    setDragging(true)
    setPosition(clamp({ x: active.origin.x + dx, y: active.origin.y + dy }))
  }

  function endDrag() {
    if (drag.current?.moved) suppressClickUntil.current = performance.now() + 360
    drag.current = null
    setDragging(false)
  }

  function handleActivate(trigger: HTMLElement) {
    if (performance.now() < suppressClickUntil.current) return
    onOpen(trigger)
  }

  const bubbleKind: 'celebrating' | 'thinking' | 'success' | 'alert' | 'ambient' | null =
    mood === 'celebrating' ? 'celebrating'
      : mood === 'thinking' ? 'thinking'
        : mood === 'success' ? 'success'
          : mood === 'alert' ? 'alert'
            : ambientVisible ? 'ambient'
              : null

  const bubbleTitle =
    bubbleKind === 'celebrating' ? `${ASSISTANT_NAME} · 创世星火接入`
      : bubbleKind === 'thinking' ? `${ASSISTANT_NAME} 推理中`
        : bubbleKind === 'success' ? '答疑完成'
          : bubbleKind === 'alert' ? '发现代码报错'
            : ASSISTANT_NAME

  const bubbleBody =
    bubbleKind === 'celebrating'
      ? (celebrateMessage || '检测到创世守护者接入！首尔服务器散热风扇已全速运转，专属全息卡已存入收藏馆啦~')
      : bubbleKind === 'thinking' ? (statusHint || THINKING_STEPS[thinkingStep])
        : bubbleKind === 'success' ? (statusHint || '思路已整理好，点我查看或继续追问')
          : bubbleKind === 'alert' ? (statusHint || '检测到一处运行报错，点我一起排查')
            : ambientLines[ambientIndex % Math.max(1, ambientLines.length)]

  const stageActive = !isMobileDock && !drawerOpen && !collapsed
  const isCelebrating = mood === 'celebrating'

  return (
    <div className="lvo-docks" data-mobile-avoid={mobileAvoid} data-drawer-open={drawerOpen}>
      {collapsed ? (
        <button
          ref={restoreButton}
          type="button"
          className="lvo-restore"
          aria-label={`恢复 ${ASSISTANT_NAME} 桌宠`}
          title={`恢复 ${ASSISTANT_NAME}`}
          onClick={() => {
            wantsFocus.current = true
            setCollapsed(false)
          }}
        >
          <VesperAvatar mood={mood} className="lvo-restore-avatar" />
          <span className="lvo-restore-dot" data-mood={mood} aria-hidden />
        </button>
      ) : (
        <div
          ref={dock}
          className="lvo-dock"
          data-mood={mood}
          data-dragging={dragging}
          data-positioned={Boolean(position)}
          data-gaze-flip={gazeFlipLeft}
          style={position && { left: position.x, top: position.y }}
          onMouseEnter={() => {
            if (mood === 'idle' && !ambientSilenced) setAmbientVisible(true)
          }}
        >
          {/* Upper-right gaze anchor carrier (aligned to Vesper's thinking eyeline) */}
          <div className="lvo-gaze" data-visible={Boolean(bubbleKind)} data-kind={bubbleKind ?? 'hidden'} aria-live="polite">
            <span className="lvo-gaze-tether" aria-hidden="true">
              <i />
              <i />
            </span>
            {bubbleKind && (
              <div className="lvo-gaze-card" data-kind={bubbleKind}>
                <button
                  type="button"
                  className="lvo-gaze-body"
                  onClick={event => handleActivate(event.currentTarget)}
                >
                  <span className="lvo-gaze-head">
                    {bubbleKind === 'celebrating' && <PartyPopper size={13} aria-hidden="true" />}
                    {bubbleKind === 'thinking' && (
                      <span className="lvo-gaze-pulse" aria-hidden="true"><i /><i /><i /></span>
                    )}
                    {bubbleKind === 'success' && <Sparkles size={13} aria-hidden="true" />}
                    {bubbleKind === 'alert' && <TriangleAlert size={13} aria-hidden="true" />}
                    <strong>{bubbleTitle}</strong>
                  </span>
                  <span className="lvo-gaze-copy">{bubbleBody}</span>
                </button>
                {bubbleKind === 'ambient' && (
                  <button
                    type="button"
                    className="lvo-gaze-close"
                    aria-label="暂时收起主动提示"
                    title="暂时收起提示"
                    onClick={event => {
                      event.stopPropagation()
                      setAmbientVisible(false)
                      setAmbientSilenced(true)
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cyber-Cyan & Molten-Gold Holographic Starlight Particle Burst during `celebrating` */}
          {isCelebrating && (
            <div className="lvo-celebrate-burst" aria-hidden="true">
              <span className="lvo-celebrate-ring" />
              {CELEBRATE_PARTICLES.map(p => (
                <i
                  key={p.i}
                  data-tone={p.tone}
                  data-star={p.star}
                  style={{
                    '--a': `${p.angle}deg`,
                    '--d': `${p.dist}px`,
                    '--s': `${p.size}px`,
                    '--delay': `${p.delay}ms`,
                  } as CSSProperties}
                />
              ))}
            </div>
          )}

          {/* Transparent video stage (pointer-events: none so starbursts never block underlying UI) */}
          {!isMobileDock && <VesperStage mood={mood} active={stageActive} className="lvo-dock-stage" />}

          {/* Fold button anchored neatly to the lower-left of Vesper */}
          <button
            className="lvo-fold lvo-icon"
            type="button"
            title={`收起 ${ASSISTANT_NAME}`}
            aria-label="折叠桌宠"
            onClick={() => {
              wantsFocus.current = true
              setCollapsed(true)
            }}
          >
            <ChevronsLeft size={16} aria-hidden />
          </button>

          {/* Tight body-centered hit target: click to chat, drag to reposition */}
          <button
            ref={desktopButton}
            type="button"
            className="lvo-pet"
            aria-label={actionLabel || `打开 ${ASSISTANT_NAME} 桌宠对话`}
            title="点击互动 · 拖动调整位置"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onClick={event => handleActivate(event.currentTarget)}
          >
            <span className="lvo-pet-hitbox" aria-hidden="true" />
            <span className="lvo-pet-label">
              <span data-mood={mood} />
              <strong>{ASSISTANT_NAME}</strong>
              <span>{moodText[mood]}</span>
            </span>
          </button>
        </div>
      )}

      {/* Mobile compact bottom-left live companion (yields cleanly to editor & keyboard) */}
      <div className="lvo-mobile-dock" data-mood={mood}>
        {isCelebrating && (
          <div className="lvo-celebrate-burst is-mobile" aria-hidden="true">
            <span className="lvo-celebrate-ring" />
            {CELEBRATE_PARTICLES.slice(0, 12).map(p => (
              <i
                key={p.i}
                data-tone={p.tone}
                data-star={p.star}
                style={{
                  '--a': `${p.angle}deg`,
                  '--d': `${Math.round(p.dist * 0.62)}px`,
                  '--s': `${p.size}px`,
                  '--delay': `${p.delay}ms`,
                } as CSSProperties}
              />
            ))}
          </div>
        )}
        {bubbleKind && (
          <button
            type="button"
            className="lvo-mobile-pill"
            data-kind={bubbleKind}
            onClick={event => onOpen(event.currentTarget)}
          >
            {bubbleKind === 'celebrating' && <PartyPopper size={12} aria-hidden="true" />}
            {bubbleKind === 'thinking' && <span className="lvo-gaze-pulse" aria-hidden="true"><i /><i /><i /></span>}
            {bubbleKind === 'success' && <Sparkles size={12} aria-hidden="true" />}
            {bubbleKind === 'alert' && <TriangleAlert size={12} aria-hidden="true" />}
            <span>{bubbleKind === 'celebrating' ? bubbleBody : bubbleKind === 'ambient' ? `${ASSISTANT_NAME} 在线` : bubbleTitle}</span>
          </button>
        )}
        <button
          type="button"
          className="lvo-bubble"
          aria-label={actionLabel || `打开 ${ASSISTANT_NAME} 小助手`}
          onClick={event => onOpen(event.currentTarget)}
        >
          {isMobileDock && <VesperStage mood={mood} active={!drawerOpen && !mobileAvoid} className="lvo-mobile-stage" />}
          <span className="lvo-bubble-tag" data-mood={mood}>
            <i />
            {ASSISTANT_NAME}
          </span>
        </button>
      </div>
    </div>
  )
}
