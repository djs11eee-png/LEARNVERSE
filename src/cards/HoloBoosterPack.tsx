import { memo, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Layers3, RotateCcw, ScanLine, Smartphone, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { HoloPrint } from './HoloPrint'
import { clamp, createFoilSound, useHoloMotion } from './useHoloMotion'
import type { HoloCard } from './types'
import { finishNames, slotNames } from './types'
import './holo-booster.css'
import './foil-sequence.css'

type Props = {
  cards: HoloCard[]
  mode: 'pack' | 'inspect'
  sourceLabel?: string
  onOpen: () => void
  onClose: () => void
  notes: Record<string, string>
  onNote: (id: string, value: string) => void
}
const seriesNames = { python: 'PYTHON', c: 'C LANGUAGE', algorithms: 'ALGORITHMS' }
const Plate = memo(HoloPrint)
type Phase = 'sealed' | 'opening' | 'cards'
type Gesture = { id: number; x: number; y: number; width: number; angle: number }
const audioPreference = 'learnverse.pack-sound.v1'

// The loose foil doubles back over its still-sealed edge. The inside and top
// surfaces share a curved spine, keeping the fold attached to the tear front.
function curlShape(amount: number) {
  const seam = amount * 300
  const lift = Math.sqrt(amount)
  const tip = seam - 26 * lift
  const bow = seam + 42 * lift
  const top = 5 - 48 * lift
  return {
    lining: `M0 43 Q${seam * .48} 42 ${seam} 40 Q${bow} 17 ${tip} ${top} Q${seam * .64} ${top + 14} 0 43Z`,
    crest: `M${seam} 40 Q${bow} 18 ${tip} ${top} Q${bow + 9} ${top + 13} ${seam + 2} 41Z`,
  }
}

function CardBack({ card }: { card: HoloCard }) {
  return <div className="capsule-card-back" data-finish={card.finish}>
    <span className="capsule-back-ring"/><span className="capsule-back-axis"/><Layers3 size={30} strokeWidth={1.2}/>
    <small>{card.number}</small>
  </div>
}

function packSerial(cards: HoloCard[]) {
  let hash = 7
  for (const char of cards.map(card => card.id).join('/')) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return 'DC-' + hash.toString(36).padStart(6, '0').toUpperCase()
}

function FoilLayers() {
  return <span className="holo-fx" aria-hidden="true"><i className="holo-prism"/><i className="holo-texture"/><i className="holo-specular"/></span>
}

function CardFaces({ card, back, note, onNote, choice, choose }: {
  card: HoloCard; back: boolean; note: string; onNote: (v: string) => void
  choice: number | undefined; choose: (v: number) => void
}) {
  const quiz = card.quiz
  const titleId = useId()
  const noteId = useId()
  return <div className={`holo-card holo-finish-${card.finish}`} data-galaxy={card.galaxy} aria-label={card.title}>
    <article className="holo-face holo-front" inert={back} aria-hidden={back} aria-labelledby={titleId}>
      <div className="holo-frame">
        <header className="holo-card-top"><span>LEARNVERSE</span><span>{card.number}</span></header>
        <div className="holo-card-name"><p>{slotNames[card.slot - 1]} · {card.subtitle}</p><h3 id={titleId}>{card.title}</h3></div>
        <div className="holo-art"><Plate galaxy={card.galaxy} slot={card.slot} cardNumber={card.number}/></div>
        <div className="holo-copy" tabIndex={0} aria-label="卡片内容">
          {card.body !== quiz?.question && <p>{card.body}</p>}
          {card.code && <pre><code>{card.code}</code></pre>}
          {quiz && <fieldset className="holo-quiz"><legend>{quiz.question}</legend>
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
    <article className="holo-face holo-back" inert={!back} aria-hidden={!back} aria-label={`${card.title}的背面`}>
      <div className="holo-frame">
        <header className="holo-card-top"><span>LEARNVERSE</span><span>{card.number}</span></header>
        <div className="holo-back-title"><ScanLine size={25} strokeWidth={1.2}/><p>{card.title}</p><h3>知识速查</h3></div>
        <div className="holo-back-scroll" tabIndex={0} aria-label="知识速查和笔记">
          <p>{card.back}</p>
          <label htmlFor={noteId}>个人笔记</label><textarea id={noteId} value={note} maxLength={600} placeholder="写下自己的理解…" onChange={e => onNote(e.target.value)}/>
        </div>
        <footer className="holo-card-foot"><span>{seriesNames[card.galaxy]}</span><span>FIELD NOTES</span></footer>
      </div>
      <FoilLayers/>
    </article>
  </div>
}

export function HoloBoosterPack({ cards, mode, sourceLabel, onOpen, onClose, notes, onNote }: Props) {
  const [phase, setPhase] = useState<Phase>(mode === 'inspect' ? 'cards' : 'sealed')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [tearing, setTearing] = useState(false)
  const [direction, setDirection] = useState(1)
  const [dealing, setDealing] = useState(false)
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(audioPreference) !== 'off' } catch { return true }
  })
  const chimes = useRef<AudioContext | null>(null)
  const dealtGold = useRef(new Set<string>())
  const [goldArrival, setGoldArrival] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const exiting = useRef(false)
  const opened = useRef(false)
  const tear = useRef<Gesture | null>(null)
  const sound = useRef<ReturnType<typeof createFoilSound>>(undefined)
  const progress = useRef(0)
  const sequence = useRef<HTMLDivElement>(null)
  const curl = useRef<SVGPathElement>(null)
  const crest = useRef<SVGPathElement>(null)
  const recoil = useRef(0)
  const hand = useRef<HTMLDivElement>(null)
  const drag = useRef<Gesture | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const flipButton = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  const motion = useHoloMotion()
  const pack = phase !== 'cards'
  const current = cards[index]
  const active = current ?? cards[0]
  const inspectingOne = mode === 'inspect' && cards.length === 1
  const heading = useId()
  const foilId = useId().replace(/[^a-zA-Z0-9_-]/g, '')

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
      if (chimes.current && chimes.current.state !== 'closed') void chimes.current.close().catch(() => {})
      chimes.current = null
      sound.current?.stop()
      element?.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

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
    sequence.current?.style.setProperty('--rip', String(amount))
    sequence.current?.style.setProperty('--rip-left', amount * 100 + '%')
    const shape = curlShape(amount)
    curl.current?.setAttribute('d', shape.lining)
    crest.current?.setAttribute('d', shape.crest)
  }
  function openPack() {
    if (opened.current || phase !== 'sealed' || !cards.length) return
    opened.current = true
    cancelAnimationFrame(recoil.current)
    primeChimes()
    tear.current = null
    setTearing(false)
    setRip(1)
    setPhase('opening')
    motion.light(.46, .36, 0)
    const effect = sound.current ?? (soundOn ? createFoilSound() : undefined)
    effect?.stop(true)
    sound.current = undefined
    onOpen()
    timers.current.push(window.setTimeout(() => {
      setPhase('cards')
      timers.current.push(window.setTimeout(() => flipButton.current?.focus({ preventScroll: true }), 0))
    }, motion.reduced.current ? 0 : 1770))
  }
  function navigate(next: number) {
    if (exiting.current || next === index || next < 0 || next >= cards.length || phase !== 'cards') return
    drag.current = null
    setDirection(next > index ? 1 : -1)
    primeChimes()
    const arrive = () => {
      const gold = mode === 'pack' && cards[next].finish === 'gold' && !dealtGold.current.has(cards[next].id)
      if (gold) {
        dealtGold.current.add(cards[next].id)
        goldTone()
        if (!motion.reduced.current) try { navigator.vibrate?.([22, 36, 58]) } catch { /* Optional haptics. */ }
      }
      setGoldArrival(gold)
      setLeaving(false)
      exiting.current = false
      setDealing(true)
      setIndex(next)
      motion.turn(0, true)
      motion.light(.46, .36, 0)
    }
    if (mode === 'inspect' || motion.reduced.current) { arrive(); return }
    exiting.current = true
    setLeaving(true)
    timers.current.push(window.setTimeout(arrive, 180))
  }
  function flip() {
    motion.turn((Math.round(motion.aim.current.turn / 180) + 1) * 180)
  }
  function stepCard(step: number, rotate = false) {
    if (inspectingOne || (mode === 'inspect' && rotate)) motion.turn(motion.aim.current.turn + 45 * step)
    else navigate(index + step)
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
    sound.current = soundOn ? createFoilSound() : undefined
    tear.current = { id: e.pointerId, x: e.clientX, y: e.clientY, width, angle: 0 }
    setTearing(true)
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
    setTearing(false)
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
      if (mode === 'inspect') motion.turn(gesture.angle + dx / gesture.width * 360)
      else if (!motion.reduced.current && !exiting.current) {
        const atEdge = dx > 0 ? index === 0 : index === cards.length - 1
        const pull = clamp(dx / gesture.width, -.8, .8) * (atEdge ? .17 : 1)
        hand.current?.style.setProperty('--hand-pull', String(pull))
        hand.current?.setAttribute('data-gripped', '')
      }
    }
    pointAt(e)
  }
  function endCard(e: ReactPointerEvent<HTMLDivElement>) {
    const gesture = drag.current
    drag.current = null
    hand.current?.removeAttribute('data-gripped')
    hand.current?.style.removeProperty('--hand-pull')
    if (!gesture || gesture.id !== e.pointerId) return
    const dx = e.clientX - gesture.x
    const dy = e.clientY - gesture.y
    if (mode === 'pack' && Math.abs(dx) > 38 && Math.abs(dx) > Math.abs(dy) * 1.2) navigate(index + (dx < 0 ? 1 : -1))
    motion.light(.46, .36, 0)
  }
  const supportedSensor = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && window.matchMedia('(pointer: coarse)').matches
  return <dialog className="holo-dialog" ref={dialog} aria-labelledby={heading} onCancel={e => { e.preventDefault(); onClose() }} onKeyDown={e => {
    if ((e.target as HTMLElement).matches('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return
    if (phase === 'cards') {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        stepCard(e.key === 'ArrowRight' ? 1 : -1, e.shiftKey)
      }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); flip() }
    }
  }}>
    <div className="holo-room" ref={motion.stage} data-inspect={mode === 'inspect' || undefined}>
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
          <div className="holo-object">
            {pack ? <div ref={sequence} className={`holo-sequence ${phase === 'opening' ? 'is-opening' : ''}`}>
              {phase === 'opening' && <><span className="capsule-break-light" aria-hidden="true"/><div className="capsule-extraction" aria-hidden="true">{cards.map((c, i) =>
                <div key={c.id} className="capsule-extracted" style={{ '--i': i, '--fan': i - (cards.length - 1) / 2, zIndex:cards.length - i } as CSSProperties}><CardBack card={c}/></div>)}</div></>}
              <div className={`holo-packet ${tearing ? 'is-tearing' : ''}`} onPointerMove={e => { if (phase === 'sealed') pointAt(e) }} onPointerLeave={() => { if (!tear.current && !motion.sensor) motion.light(.46, .36, 0) }}>
                <div className="holo-bag-body">
                  <div className="holo-pack-print"><div className="holo-pack-brand"><Layers3 size={19} strokeWidth={1.7}/> LEARNVERSE</div>
                    <div className="holo-pack-series"><span/> NO. {packSerial(cards)} <span/></div>
                    <Plate galaxy={active.galaxy} slot={1} cardNumber={active.number} pack/>
                    <div className="holo-pack-title"><strong>DATA CAPSULE</strong><span>知识补给包</span></div>
                    <div className="holo-pack-code"><i aria-hidden="true"/><span>{cards.every(c => c.galaxy === active.galaxy) ? seriesNames[active.galaxy] : 'MULTI-SERIES'}<br/>{String(cards.length).padStart(2, '0')} CARDS / PACK</span></div>
                  </div>
                  <div className="holo-wrinkle"/><div className="holo-bag-shine"/>
                  <div className="capsule-tension-lines" aria-hidden="true"/><div className="holo-bottom-crimp"/>
                </div>
                <button type="button" className="holo-tear" aria-label="向右拖动封口，或按回车撕开卡包" disabled={phase !== 'sealed'}
                  onPointerDown={startTear} onPointerMove={moveTear} onPointerUp={cancelTear} onPointerCancel={cancelTear} onLostPointerCapture={cancelTear} onClick={e => { if (e.detail === 0) openPack() }}>
                  <span className="holo-tear-strip"><span>TEAR HERE</span><span>→ → →</span></span>
                  <span className="holo-tear-gap"/><span className="holo-tear-edge"/>
                  <svg className="capsule-curl" viewBox="0 -52 300 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs><linearGradient id={foilId + '-inner'} x1="0.1" x2=".8" y1="1" y2="0">
                      <stop stopColor="#192b3a"/><stop offset=".22" stopColor="#7194a1"/><stop offset=".4" stopColor="#f6ffff"/><stop offset=".48" stopColor="#748d94"/><stop offset=".7" stopColor="#2e4356"/><stop offset="1" stopColor="#d4f0e9"/>
                    </linearGradient><linearGradient id={foilId + '-edge'}><stop stopColor="#566479"/><stop offset=".45" stopColor="#f8fffb"/><stop offset=".69" stopColor="#9be3eb"/><stop offset="1" stopColor="#495b78"/></linearGradient></defs>
                    <path ref={curl} fill={'url(#' + foilId + '-inner)'} stroke="#c0dce58c" strokeWidth=".8"/>
                    <path ref={crest} fill={'url(#' + foilId + '-edge)'}/>
                  </svg>
                  {tearing && <span className="holo-sparks" aria-hidden="true">{Array.from({ length: 7 }, (_, n) => <i key={n} style={{ '--n': n } as CSSProperties}/>)}</span>}
                </button>
              </div>
            </div> :
              <div className="capsule-hand" data-pack={mode === 'pack' || undefined} data-gold={active.finish === 'gold' || undefined}>
              {mode === 'pack' && <div className="capsule-remaining" aria-hidden="true">{cards.slice(index + 1, index + 4).map((c,i) =>
                <div key={c.id} style={{ '--depth':i + 1, zIndex:3 - i } as CSSProperties}><CardBack card={c}/></div>)}</div>}
              {goldArrival && <div className="capsule-gold-corona" aria-hidden="true"><i/><i/><i/>{Array.from({length:12},(_,n) =>
                <span key={n} style={{'--ray':(n * 30 + 8) + 'deg','--lag':((n%3)*38) + 'ms'} as CSSProperties}/>)}</div>}
              <div ref={hand} key={active.id} className={`holo-card-holder ${dealing ? 'is-dealing' : ''} ${leaving ? 'is-leaving' : ''}`} data-gold={active.finish === 'gold' || undefined} style={{ '--direction': direction } as CSSProperties}
                onPointerDown={startCard} onPointerMove={moveCard} onPointerUp={endCard} onPointerCancel={() => { drag.current = null; hand.current?.removeAttribute('data-gripped'); hand.current?.style.removeProperty('--hand-pull'); motion.light(.46, .36, 0) }}
                onPointerLeave={() => { if (!drag.current && !motion.sensor) motion.light(.46, .36, 0) }}>
                <CardFaces card={active} back={motion.back} note={notes[active.id] ?? ''} onNote={value => onNote(active.id, value)} choice={answers[active.id]} choose={v => setAnswers(a => ({ ...a, [active.id]: v }))}/>
              </div></div>}
          </div>
        </div>
        <div className="holo-dock">
          {pack ? <><p className="holo-instruction" aria-live="polite">{phase === 'opening' ? '正在展开卡片…' : '从封口左端向右撕开'}</p>
            <button type="button" className="holo-open-btn" disabled={phase === 'opening'} onClick={openPack}>撕开卡包 <ArrowRight size={16}/></button></> :
            <><p className="holo-instruction">{mode === 'inspect' ? '左右拖动，360° 检视卡片' : '左右滑动切换卡片'}</p>
              <div className="holo-controls"><button type="button" className="holo-icon" aria-label={inspectingOne ? '向左旋转' : '上一张'} disabled={leaving || (!inspectingOne && index === 0)} onClick={() => stepCard(-1)}><ArrowLeft size={19}/></button>
                <span className="holo-count" aria-live="polite">{inspectingOne ? active.number : <>{String(index + 1).padStart(2, '0')} <b>/ {String(cards.length).padStart(2, '0')}</b></>}</span>
                <button type="button" ref={flipButton} className="holo-flip" onClick={flip}><RotateCcw size={15}/>{motion.back ? '翻回正面' : '查看背面'}</button>
                <button type="button" className="holo-icon" aria-label={inspectingOne ? '向右旋转' : '下一张'} disabled={leaving || (!inspectingOne && index >= cards.length - 1)} onClick={() => stepCard(1)}><ArrowRight size={19}/></button>
              </div></>}
        </div>
      </> : <p className="holo-empty">这里还没有可检视的卡片。</p>}
    </div>
  </dialog>
}
export default HoloBoosterPack
