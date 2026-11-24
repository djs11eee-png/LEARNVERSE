import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Layers3, RotateCcw, ScanLine, Smartphone, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { HoloPrint } from './HoloPrint'
import { clamp, createFoilSound, useHoloMotion } from './useHoloMotion'
import { packSounds } from './packSounds'
import type { Galaxy, HoloCard } from './types'
import { finishNames, slotNames } from './types'
import './holo-booster.css'
import './foil-sequence.css'
import { PackSpread } from './PackSpread'
import './pack-spread.css'
import './foil-finishes.css'

type Props = {
  cards: HoloCard[]
  mode: 'pack' | 'inspect'
  sourceLabel?: string
  onOpen: () => void
  onReplay?: () => void
  onClose: () => void
  notes: Record<string, string>
  onNote: (id: string, value: string) => void
}
const seriesNames: Record<Galaxy, string> = {
  python: 'PYTHON',
  c: 'C LANGUAGE',
  algorithms: 'ALGORITHMS',
  web: 'WEB & JS',
  backend: 'JAVA & BACKEND',
  systems: 'CS & SYSTEMS',
  robotics: 'IOT & ROS 2',
}
const Plate = memo(HoloPrint)
type Phase = 'sealed' | 'opening' | 'cards'
type Gesture = { id: number; x: number; y: number; width: number; angle: number; turning?: boolean }
const audioPreference = 'learnverse.pack-sound.v1'
/** The first tenth of the seam resists like a perforation, then the foil gives way. */
const notchAt = .1
const tearOpensAt = .62
const tearProgress = (raw: number) => raw < notchAt ? raw * .5 : notchAt * .5 + (raw - notchAt) * ((1 - notchAt * .5) / (1 - notchAt))
// Matches the pack-deal keyframes: cards land at 79 % of a 1.48 s flight that starts at .98 s.
const dealLanding = (order: number) => .98 + order * .085 + 1.48 * .79
const buzz = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern) } catch { /* Optional haptics. */ } }

function packSerial(cards: HoloCard[]) {
  let hash = 7
  for (const char of cards.map(card => card.id).join('/')) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return 'DC-' + hash.toString(36).padStart(6, '0').toUpperCase()
}

/** Foil that sits under the ink: visible in the card frame, hidden behind the opaque art window. */
function FrameFoil() {
  return <span className="holo-frame-foil" aria-hidden="true"/>
}

/** Light that sits on top of the varnish: prismatic shine, glitter and the pointer glare. */
function FoilLayers() {
  return <span className="holo-fx" aria-hidden="true"><i className="holo-shine"/><i className="holo-sparkle"/><i className="holo-glare"/></span>
}

function CardFaces({ card, back, note, onNote, choice, choose, preview = false, paperOnly }: {
  card: HoloCard; back: boolean; note: string; onNote: (v: string) => void
  choice: number | undefined; choose: (v: number) => void; preview?: boolean; paperOnly?: boolean
}) {
  const quiz = card.quiz
  const prism = card.finish === 'rainbow'
  const titleId = useId()
  const noteId = useId()
  return <div className={`holo-card holo-finish-${card.finish}`} data-galaxy={card.galaxy} aria-label={card.title}>
    <article className={'holo-face ' + (preview ? 'holo-preview-front' : 'holo-front')} inert={back || preview} aria-hidden={back || preview} aria-labelledby={titleId}>
      <div className="holo-frame">
        <FrameFoil/>
        <header className="holo-card-top"><span>LEARNVERSE</span><span>{card.number}</span></header>
        <div className="holo-card-name"><p>{slotNames[card.slot - 1]} · {card.subtitle}</p><h3 id={titleId}>{card.title}</h3></div>
        <div className="holo-art"><Plate galaxy={card.galaxy} slot={card.slot} cardNumber={card.number} gold={card.finish === 'gold'}
          paperOnly={paperOnly || prism} prism={prism}/></div>
        <div className="holo-copy" tabIndex={0} aria-label="卡片内容">
          {card.body !== quiz?.question && <p>{card.body}</p>}
          {card.code && <pre><code>{card.code}</code></pre>}
          {quiz && !preview && <fieldset className="holo-quiz"><legend>{quiz.question}</legend>
            {quiz.options.map((option, i) => <button key={i} type="button" aria-pressed={choice === i} data-state={choice === i ? (i === quiz.answer ? 'correct' : 'wrong') : undefined} onClick={() => choose(i)}>
              <span>{String.fromCharCode(65 + i)}</span>{option}{choice === i && i === quiz.answer && <Check size={14}/>}
            </button>)}
            {choice !== undefined && <p className="holo-answer" role="status">{choice === quiz.answer ? '正确。' : '再试一次。'}{quiz.explanation}</p>}
          </fieldset>}
        </div>
        <footer className="holo-card-foot"><span>{seriesNames[card.galaxy]}</span><span><Sparkles size={11}/>{finishNames[card.finish]}</span></footer>
      </div>
      <FoilLayers/>
    </article>
    {!preview && <article className="holo-face holo-back" inert={!back} aria-hidden={!back} aria-label={`${card.title}的背面`}>
      <div className="holo-frame">
        <FrameFoil/>
        <header className="holo-card-top"><span>LEARNVERSE</span><span>{card.number}</span></header>
        <div className="holo-back-title"><ScanLine size={25} strokeWidth={1.2}/><p>{card.title}</p><h3>知识速查</h3></div>
        <div className="holo-back-scroll" tabIndex={0} aria-label="知识速查和笔记">
          <p>{card.back}</p>
          <label htmlFor={noteId}>个人笔记</label><textarea id={noteId} value={note} maxLength={600} placeholder="写下自己的理解…" onChange={e => onNote(e.target.value)}/>
        </div>
        <footer className="holo-card-foot"><span>{seriesNames[card.galaxy]}</span><span>FIELD NOTES</span></footer>
      </div>
      <FoilLayers/>
    </article>}
  </div>
}

export function HoloBoosterPack({ cards, mode, sourceLabel, onOpen, onClose, onReplay, notes, onNote }: Props) {
  const isBooster = mode === 'pack'
  const [picked, setPicked] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>(mode === 'inspect' ? 'cards' : 'sealed')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(audioPreference) !== 'off' } catch { return true }
  })
  const chimes = useRef<AudioContext | null>(null)
  const dealtGold = useRef(new Set<string>())
  const [goldArrival, setGoldArrival] = useState(false)
  const opened = useRef(false)
  const tear = useRef<Gesture | null>(null)
  const sound = useRef<ReturnType<typeof createFoilSound>>(undefined)
  const progress = useRef(0)
  const notched = useRef(false)
  const sequence = useRef<HTMLDivElement>(null)
  const recoil = useRef(0)
  const drag = useRef<Gesture | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const returnButton = useRef<HTMLButtonElement>(null)
  const focusAfterRender = useRef<number | 'return' | null>(null)
  const timers = useRef<number[]>([])
  const motion = useHoloMotion()
  const pack = phase !== 'cards'
  // Put the guaranteed gold on the lower left without changing the stored slot order.
  const spreadCards = isBooster && !onReplay && cards.length === 5
    ? [cards[0], cards[1], cards[2], cards[4], cards[3]]
    : cards
  const active = picked === null ? cards[0] : spreadCards[picked]
  // Deal the gold card last so the spread ends on its arrival.
  const dealOrder = (() => {
    const gold = spreadCards.findIndex(card => card.finish === 'gold')
    let next = 0
    return spreadCards.map((_, i) => i === gold ? spreadCards.length - 1 : next++)
  })()
  const heading = useId()

  useEffect(() => {
    if (!isBooster || !soundOn) return
    // Prepare the silent device between frames while the pack is sealed.
    // Playback is resumed by the opening gesture.
    const timer = window.setTimeout(() => {
      try { chimes.current ??= new AudioContext() } catch { /* Optional audio. */ }
    }, 80)
    return () => clearTimeout(timer)
  }, [isBooster, soundOn])

  useLayoutEffect(() => {
    const element = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element?.showModal()
    const object = element?.querySelector('.holo-object')?.getBoundingClientRect()
    if (object && element) {
      element.style.setProperty('--vault-center-x', (object.left + object.width / 2) + 'px')
      element.style.setProperty('--vault-center-y', (object.top + object.height / 2) + 'px')
    }
    closeButton.current?.focus({ preventScroll: true })
    return () => {
      timers.current.forEach(window.clearTimeout)
      cancelAnimationFrame(recoil.current)
      sound.current?.stop()
      if (chimes.current && chimes.current.state !== 'closed') void chimes.current.close().catch(() => {})
      chimes.current = null
      element?.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  useLayoutEffect(() => {
    const target = focusAfterRender.current
    if (phase !== 'cards' || target === null) return
    focusAfterRender.current = null
    const button = target === 'return' ? returnButton.current
      : dialog.current?.querySelector<HTMLButtonElement>(`[data-pack-pick="${target}"]`)
    button?.focus({ preventScroll: true })
  }, [phase, picked])

  function primeChimes() {
    if (!soundOn) return
    try {
      chimes.current ??= new AudioContext()
      if (chimes.current.state === 'suspended') void chimes.current.resume().catch(() => {})
    } catch { /* Visual feedback works without audio. */ }
  }
  function goldTone() {
    const ctx = chimes.current
    if (!soundOn || ctx?.state !== 'running') return
    for (const [pitch, delay, volume] of [[784, 0, .032], [1175, .07, .018], [1568, .14, .012]]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + delay
      osc.frequency.value = pitch
      gain.gain.setValueAtTime(.0001, start)
      gain.gain.exponentialRampToValueAtTime(volume, start + .014)
      gain.gain.exponentialRampToValueAtTime(.0001, start + .46)
      osc.connect(gain).connect(ctx.destination)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
      osc.start(start)
      osc.stop(start + .47)
    }
  }
  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    if (!next) {
      sound.current?.stop()
      sound.current = undefined
      if (chimes.current?.state === 'running') void chimes.current.suspend().catch(() => {})
    }
    try { localStorage.setItem(audioPreference, next ? 'on' : 'off') } catch { /* Session preference remains active. */ }
  }

  function setRip(amount: number) {
    progress.current = amount
    const element = sequence.current
    if (!element) return
    element.toggleAttribute('data-lit', amount > .001)
    element.style.setProperty('--bloom', String(amount ** .82))
    element.style.setProperty('--rip', String(amount))
    element.style.setProperty('--rip-left', amount * 100 + '%')
  }
  function openPack() {
    if (opened.current || phase !== 'sealed' || !cards.length) return
    opened.current = true
    cancelAnimationFrame(recoil.current)
    tear.current = null
    if (!motion.reduced.current) {
      const from = progress.current
      const start = performance.now()
      const duration = 480 * (1 - from)
      const finishTear = (now: number) => {
        const t = Math.min(1, (now - start) / Math.max(1, duration))
        setRip(from + (1 - from) * (1 - (1 - t) ** 1.5))
        if (t < 1) recoil.current = requestAnimationFrame(finishTear)
      }
      recoil.current = requestAnimationFrame(finishTear)
      timers.current.push(window.setTimeout(() => sequence.current?.removeAttribute('data-lit'), 1490))
    } else setRip(1)
    setPhase('opening')
    motion.light(.46, .36, 0)
    const effect = sound.current ?? (soundOn ? createFoilSound(chimes.current ?? undefined) : undefined)
    effect?.stop(true)
    sound.current = undefined
    onOpen()
    timers.current.push(window.setTimeout(() => {
      focusAfterRender.current = 0
      setPhase('cards')
    }, motion.reduced.current ? 0 : 2850))
  }
  function pickCard(slot: number) {
    const card = spreadCards[slot]
    if (!card || slot === picked || phase !== 'cards') return
    endCard()
    focusAfterRender.current = 'return'
    setPicked(slot)
    motion.turn(0, true)
    const firstGold = !onReplay && card.finish === 'gold' && !dealtGold.current.has(card.id)
    setGoldArrival(firstGold)
    if (firstGold) {
      dealtGold.current.add(card.id)
      primeChimes()
      goldTone()
      if (!motion.reduced.current) try { navigator.vibrate?.([22, 36, 58]) } catch { /* Optional haptics. */ }
    }
  }
  function returnToSpread() {
    if (picked === null) return
    focusAfterRender.current = picked
    setPicked(null)
    endCard()
    motion.turn(0, true)
  }
  function flip() {
    motion.turn((Math.round(motion.aim.current.turn / 180) + 1) * 180)
  }
  function rotateCard(step: number) {
    motion.turn(motion.aim.current.turn + 45 * step)
  }
  function pointAt(e: ReactPointerEvent<HTMLElement>) {
    const bounds = e.currentTarget.getBoundingClientRect()
    motion.light((e.clientX - bounds.left) / bounds.width, (e.clientY - bounds.top) / bounds.height)
  }
  function startTear(e: ReactPointerEvent<HTMLButtonElement>) {
    if (phase !== 'sealed' || !e.isPrimary || e.button !== 0) return
    const width = e.currentTarget.getBoundingClientRect().width
    cancelAnimationFrame(recoil.current)
    setRip(0)
    e.currentTarget.setPointerCapture(e.pointerId)
    sound.current?.stop()
    sound.current = soundOn ? createFoilSound(chimes.current ?? undefined) : undefined
    tear.current = { id: e.pointerId, x: e.clientX, y: e.clientY, width, angle: 0 }
  }
  function moveTear(e: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = tear.current
    if (!gesture || gesture.id !== e.pointerId) return
    const amount = clamp((e.clientX - gesture.x) / gesture.width, 0, 1)
    const distance = amount - progress.current
    if (distance > .001) sound.current?.pulse(amount, distance)
    setRip(amount)
    if (amount >= .65) openPack()
  }
  function cancelTear() {
    if (!tear.current) return
    tear.current = null
    if (!opened.current) {
      const peak = progress.current
      const start = performance.now()
      const settle = (now: number) => {
        const t = Math.min(1, (now - start) / 240)
        setRip(peak * (1 - t) ** 3)
        if (t < 1) recoil.current = requestAnimationFrame(settle)
      }
      if (motion.reduced.current) setRip(0)
      else recoil.current = requestAnimationFrame(settle)
      sound.current?.stop()
      sound.current = undefined
    }
  }
  function startCard(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest('button, textarea, input, label, pre')) return
    const bounds = e.currentTarget.getBoundingClientRect()
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, width: bounds.width, angle: motion.aim.current.turn }
    // Keep native vertical scrolling in long card text until a horizontal drag starts.
  }
  function moveCard(e: ReactPointerEvent<HTMLDivElement>) {
    const gesture = drag.current
    if (!gesture || gesture.id !== e.pointerId) { if (e.pointerType !== 'touch') pointAt(e); return }
    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId)
      motion.turn(gesture.angle + dx / gesture.width * 360)
    }
    pointAt(e)
  }
  function endCard() {
    drag.current = null
    motion.light(.46, .36, 0)
  }
  function faces(card: HoloCard, preview = false) {
    return <CardFaces card={card} back={!preview && motion.back} preview={preview} paperOnly={isBooster}
      note={notes[card.id] ?? ''} onNote={value => onNote(card.id, value)}
      choice={answers[card.id]} choose={value => setAnswers(previous => ({ ...previous, [card.id]: value }))}/>
  }
  const supportedSensor = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && window.matchMedia('(pointer: coarse)').matches
  return <dialog className="holo-dialog" ref={dialog} aria-labelledby={heading} onCancel={e => { e.preventDefault(); if (picked !== null) returnToSpread(); else onClose() }} onKeyDown={e => {
    if ((e.target as HTMLElement).matches('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return
    if (phase === 'cards') {
      if (isBooster && picked === null) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const step = e.key === 'ArrowRight' ? 1 : -1
        if (picked === null) rotateCard(step)
        else pickCard(picked + step)
      }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); flip() }
    }
  }}>
    <div className="holo-room" ref={motion.stage} data-booster={isBooster || undefined} data-inspect={mode === 'inspect' || undefined}>
      <header className="holo-topbar">
        <div className="holo-room-title"><span className="holo-room-mark"><Layers3 size={21} strokeWidth={1.35}/></span><div><small className={pack && sourceLabel ? 'holo-source' : undefined}>{pack && sourceLabel ? '补给来源 · ' + sourceLabel : 'LEARNVERSE / COLLECTION'}</small><h2 id={heading}>{mode === 'inspect' ? '卡片检视台' : '知识补给包'}</h2></div></div>
        <div className="holo-top-actions">
          <button type="button" className="holo-icon" onClick={toggleSound} aria-label="卡包音效" aria-pressed={soundOn} title={soundOn ? '关闭卡包音效' : '开启卡包音效'}>{soundOn ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
          {supportedSensor && <button type="button" className="holo-icon" onClick={motion.toggleSensor} aria-label="体感倾斜" aria-pressed={motion.sensor} title="体感倾斜"><Smartphone size={18}/></button>}
          <button type="button" className="holo-icon" ref={closeButton} onClick={onClose} aria-label="关闭" title="关闭（Esc）"><X size={21}/></button>
        </div>
      </header>
      {motion.sensorMessage && <p className="holo-sensor-status" role="status">{motion.sensorMessage}</p>}
      {active ? <>
        <div className={`holo-stage ${pack ? 'is-pack' : 'is-card'}`} data-phase={phase}>
          <span className="holo-orbit-floor" aria-hidden="true"/>
          {isBooster && <PackSpread cards={spreadCards} ready={!pack} picked={picked} goldArrival={goldArrival} faces={faces}
            onPick={pickCard} onReturn={returnToSpread} onPointerDown={startCard} onPointerMove={moveCard} onPointerUp={endCard}/>}
          {(!isBooster || pack) && <div className="holo-object">
            {pack ? <div ref={sequence} className={`holo-sequence ${phase === 'opening' ? 'is-opening' : ''}`}>
              {phase === 'opening' && <span className="capsule-break-light" aria-hidden="true"/>}
              <div className="holo-packet" onPointerMove={e => { if (phase === 'sealed' && !tear.current) pointAt(e) }} onPointerLeave={() => { if (!tear.current && !motion.sensor) motion.light(.46, .36, 0) }}>
                <div className="pack-seam-light" aria-hidden="true">
                  <span className="pack-wave"><img src="/art/seam-spectrum.webp" alt="" decoding="async"/></span>
                </div>
                <div className="holo-bag-body">
                  <div className="holo-pack-print"><div className="holo-pack-brand"><Layers3 size={19} strokeWidth={1.7}/> LEARNVERSE</div>
                    <div className="holo-pack-series"><span/> NO. {packSerial(cards)} <span/></div>
                    <Plate galaxy={active.galaxy} slot={1} cardNumber={active.number} pack paperOnly/>
                    <div className="holo-pack-title"><strong>DATA CAPSULE</strong><span>知识补给包</span></div>
                    <div className="holo-pack-code"><i aria-hidden="true"/><span>{cards.every(c => c.galaxy === active.galaxy) ? seriesNames[active.galaxy] : 'MULTI-SERIES'}<br/>{String(cards.length).padStart(2, '0')} CARDS / PACK</span></div>
                  </div>
                  <div className="holo-wrinkle"/><div className="holo-bag-shine"/>
                  <div className="capsule-tension-lines" aria-hidden="true"/><div className="holo-bottom-crimp"/>
                </div>
                <button type="button" className="holo-tear" aria-label="向右拖动封口，或按回车撕开卡包" disabled={phase !== 'sealed'}
                  onPointerDown={startTear} onPointerMove={moveTear} onPointerUp={cancelTear} onPointerCancel={cancelTear} onLostPointerCapture={cancelTear} onClick={e => { if (e.detail === 0) openPack() }}>
                  <span className="holo-tear-strip"><span>TEAR HERE</span><span>→ → →</span></span>
                  <span className="holo-tear-strip pack-lifted-seal" aria-hidden="true"><span>TEAR HERE</span><span>→ → →</span></span>
                  <span className="holo-tear-edge"/>
                </button>
              </div>
            </div> :
              <div className="capsule-hand">
              <div key={active.id} className="holo-card-holder" data-gold={active.finish === 'gold' || undefined}
                onPointerDown={startCard} onPointerMove={moveCard} onPointerUp={endCard} onPointerCancel={endCard}
                onPointerLeave={() => { if (!drag.current && !motion.sensor) motion.light(.46, .36, 0) }}>
                {faces(active)}
              </div></div>}
          </div>}
        </div>
        <div className="holo-dock">
          {pack ? <><p className="holo-instruction" aria-live="polite">{phase === 'opening' ? '正在展开卡片…' : '从封口左端向右撕开'}</p>
            <button type="button" className="holo-open-btn" disabled={phase === 'opening'} onClick={openPack}>撕开卡包 <ArrowRight size={16}/></button></> : isBooster ?
            <><p className="holo-instruction" aria-live="polite">{picked === null ? '点一张卡，单独放大查看' : active.title}</p>
              {picked === null ? (onReplay && <button type="button" className="holo-flip" onClick={onReplay}><RotateCcw size={15}/>再拆一次</button>) :
                <div className="holo-controls">
                  <button type="button" className="holo-flip" ref={returnButton} onClick={returnToSpread}><ArrowLeft size={15}/>放回原位</button>
                  <button type="button" className="holo-flip" onClick={flip}><RotateCcw size={15}/>{motion.back ? '翻回正面' : '查看背面'}</button>
                </div>}</> :
            <><p className="holo-instruction">左右拖动，360° 检视卡片</p>
              <div className="holo-controls"><button type="button" className="holo-icon" aria-label="向左旋转" onClick={() => rotateCard(-1)}><ArrowLeft size={19}/></button>
                <span className="holo-count" aria-live="polite">{active.number}</span>
                <button type="button" className="holo-flip" onClick={flip}><RotateCcw size={15}/>{motion.back ? '翻回正面' : '查看背面'}</button>
                <button type="button" className="holo-icon" aria-label="向右旋转" onClick={() => rotateCard(1)}><ArrowRight size={19}/></button>
              </div></>}
        </div>
      </> : <p className="holo-empty">这里还没有可检视的卡片。</p>}
    </div>
  </dialog>
}
export default HoloBoosterPack
