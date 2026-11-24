import { useCallback, useEffect, useRef, useState } from 'react'

type Light = { x: number; y: number; gain: number; turn: number }
type Key = keyof Light
const restingLight: Light = { x: .46, y: .36, gain: 0, turn: 0 }
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Spring constants per channel. The light follows the pointer tightly, the
 * flip is slightly under-damped so a turned card settles with one soft bounce
 * the way a stiff piece of card stock does.
 */
const springs: Record<Key, { k: number; zeta: number; rest: number }> = {
  x: { k: 210, zeta: .86, rest: .0006 },
  y: { k: 210, zeta: .86, rest: .0006 },
  gain: { k: 120, zeta: 1, rest: .002 },
  turn: { k: 118, zeta: .6, rest: .05 },
}
const dragSpring = { k: 900, zeta: 1 }

export function useHoloMotion() {
  const stage = useRef<HTMLDivElement>(null)
  const aim = useRef({ ...restingLight })
  const live = useRef({ ...restingLight })
  const speed = useRef<Light>({ x: 0, y: 0, gain: 0, turn: 0 })
  const dragging = useRef(false)
  const raf = useRef(0)
  const lastTime = useRef(0)
  const facingBack = useRef(false)
  const reduced = useRef(false)
  const [back, setBack] = useState(false)
  const [sensor, setSensor] = useState(false)
  const [sensorMessage, setSensorMessage] = useState('')

  const paint = useCallback((frame: Light) => {
    const element = stage.current
    if (!element) return
    const css = element.style
    const still = reduced.current
    const dx = frame.x - .5
    const dy = frame.y - .5
    const gain = frame.gain
    const radians = frame.turn * Math.PI / 180
    // Lift peaks when the card is edge-on so a flip arcs towards the viewer.
    const lift = still ? 0 : Math.abs(Math.sin(radians))
    css.setProperty('--h-shift-x', `${dx * 32}%`)
    css.setProperty('--h-shift-y', `${dy * 32}%`)
    css.setProperty('--h-px', `${frame.x * 100}%`)
    css.setProperty('--h-py', `${frame.y * 100}%`)
    css.setProperty('--h-bg-x', `${50 + dx * 52}%`)
    css.setProperty('--h-bg-y', `${50 + dy * 64}%`)
    css.setProperty('--h-dist', String(Math.min(1, Math.hypot(dx, dy) * 2)))
    css.setProperty('--h-gain', String(gain))
    css.setProperty('--h-lift', String(lift))
    css.setProperty('--h-rx', `${still ? 0 : -dy * 22 * gain}deg`)
    css.setProperty('--h-ry', `${still ? 0 : dx * 26 * gain}deg`)
    css.setProperty('--h-sx', `${still ? 0 : -dx * 26 * gain}px`)
    css.setProperty('--h-sy', `${still ? 0 : 10 - dy * 18 * gain}px`)
    css.setProperty('--h-turn', `${frame.turn}deg`)
    element.dispatchEvent(new CustomEvent('plate-light', { detail: frame }))
    const nextBack = Math.cos(radians) < 0
    if (nextBack !== facingBack.current) { facingBack.current = nextBack; setBack(nextBack) }
  }, [])

  const wake = useCallback(function animate() {
    if (raf.current || !stage.current) return
    lastTime.current = performance.now()
    const step = (now: number) => {
      raf.current = 0
      if (!stage.current) return
      const frame = live.current
      const target = aim.current
      const velocity = speed.current
      const seconds = Math.min(1 / 30, Math.max(0, (now - lastTime.current) / 1000))
      lastTime.current = now
      let pending = false
      for (const key of Object.keys(target) as Key[]) {
        if (reduced.current) { frame[key] = target[key]; velocity[key] = 0; continue }
        const spring = key === 'turn' && dragging.current ? { ...springs.turn, ...dragSpring } : springs[key]
        // Semi-implicit Euler in fixed sub-steps stays stable on 30 Hz and 144 Hz screens alike.
        const steps = Math.max(1, Math.ceil(seconds / (1 / 240)))
        const h = seconds / steps
        const damping = 2 * spring.zeta * Math.sqrt(spring.k)
        for (let i = 0; i < steps; i++) {
          velocity[key] += (spring.k * (target[key] - frame[key]) - damping * velocity[key]) * h
          frame[key] += velocity[key] * h
        }
        if (Math.abs(target[key] - frame[key]) < spring.rest && Math.abs(velocity[key]) < spring.rest * 8) {
          frame[key] = target[key]
          velocity[key] = 0
        } else pending = true
      }
      paint(frame)
      if (pending) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }, [paint])

  const light = useCallback((x: number, y: number, gain = 1) => {
    Object.assign(aim.current, { x: clamp(x, 0, 1), y: clamp(y, 0, 1), gain })
    wake()
  }, [wake])

  const turn = useCallback((degrees: number, immediate = false) => {
    aim.current.turn = degrees
    if (immediate) { live.current.turn = degrees; speed.current.turn = 0 }
    wake()
  }, [wake])

  /** Follow the finger tightly while held; on release the flip spring takes over again. */
  const grab = useCallback((held: boolean) => { dragging.current = held }, [])

  /** Angular velocity in degrees per second, used to project a flick. */
  const spin = () => speed.current.turn

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => { reduced.current = media.matches }
    sync()
    media.addEventListener('change', sync)
    return () => {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      media.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    if (!sensor) return
    let baseline: { beta: number; gamma: number } | undefined
    const orientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return
      if (!baseline) baseline = { beta: event.beta, gamma: event.gamma }
      // Let the resting hand position drift slowly so a phone held at a new angle re-centres.
      baseline.beta += (event.beta - baseline.beta) * .004
      baseline.gamma += (event.gamma - baseline.gamma) * .004
      light(.5 + (event.gamma - baseline.gamma) / 50, .5 + (event.beta - baseline.beta) / 56)
    }
    window.addEventListener('deviceorientation', orientation)
    return () => window.removeEventListener('deviceorientation', orientation)
  }, [sensor, light])

  async function toggleSensor() {
    setSensorMessage('')
    if (sensor) { setSensor(false); light(.46, .36, 0); return }
    try {
      const permission = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }
      if (permission?.requestPermission && await permission.requestPermission() !== 'granted') {
        setSensorMessage('未获得体感权限，可以拖动卡片。')
        return
      }
      setSensor(true)
    } catch { setSensorMessage('体感暂时不可用，可以拖动卡片。') }
  }

  return { stage, aim, light, turn, grab, spin, back, reduced, sensor, toggleSensor, sensorMessage }
}

/** Keep one noise source live during a gesture. New movement briefly opens its gain envelope. */
export function createFoilSound(shared?: AudioContext) {
  try {
    const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio) return
    const ctx = shared ?? new Audio()
    const duration = .4
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * (.23 + .77 * Math.abs(Math.sin(t * (80 + 410 * t))))
    }
    const source = ctx.createBufferSource()
    const high = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    high.type = 'highpass'
    high.frequency.value = 2700
    source.buffer = buffer
    source.loop = true
    source.connect(high).connect(gain).connect(ctx.destination)
    gain.gain.value = .0001
    source.start()
    void ctx.resume().catch(() => {})
    let stopped = false
    const pulse = (progress: number, movement: number, finish = false) => {
      if (stopped) return
      const t = ctx.currentTime
      high.frequency.setTargetAtTime(2200 + 3000 * progress, t, .012)
      source.playbackRate.setTargetAtTime(.8 + .55 * progress, t, .012)
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(Math.max(.0001, gain.gain.value), t)
      gain.gain.exponentialRampToValueAtTime(finish ? .115 : .036 + Math.min(.05, movement * .55), t + .006)
      gain.gain.exponentialRampToValueAtTime(.0001, t + (finish ? .23 : .072))
    }
    const stop = (finish = false) => {
      if (stopped) return
      if (finish) pulse(1, 1, true)
      stopped = true
      const release = () => {
        source.disconnect()
        high.disconnect()
        gain.disconnect()
        if (!shared && ctx.state !== 'closed') void ctx.close().catch(() => {})
      }
      const watchdog = window.setTimeout(release, 950)
      source.onended = () => { window.clearTimeout(watchdog); release() }
      source.stop(ctx.currentTime + (finish ? .25 : .012))
    }
    return { pulse, stop }
  } catch { /* Sound is optional on devices without Web Audio. */ }
}
