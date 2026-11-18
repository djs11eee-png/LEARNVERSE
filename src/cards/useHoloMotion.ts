import { useCallback, useEffect, useRef, useState } from 'react'

type Light = { x: number; y: number; gain: number; turn: number }
const restingLight: Light = { x: .46, y: .36, gain: 0, turn: 0 }
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function useHoloMotion() {
  const stage = useRef<HTMLDivElement>(null)
  const aim = useRef({ ...restingLight })
  const live = useRef({ ...restingLight })
  const raf = useRef(0)
  const lastTime = useRef(0)
  const facingBack = useRef(false)
  const reduced = useRef(false)
  const [back, setBack] = useState(false)
  const [sensor, setSensor] = useState(false)
  const [sensorMessage, setSensorMessage] = useState('')
  const wake = useCallback(function animate() {
    if (raf.current || !stage.current) return
    raf.current = requestAnimationFrame(now => {
      raf.current = 0
      if (!stage.current) return
      const frame = live.current
      const target = aim.current
      const seconds = Math.min(.04, (now - lastTime.current) / 1000)
      lastTime.current = now
      let pending = false
      for (const key of Object.keys(target) as (keyof Light)[]) {
        const diff = target[key] - frame[key]
        if (Math.abs(diff) > (key === 'turn' ? .09 : .001)) {
          frame[key] += diff * (reduced.current ? 1 : 1 - Math.exp(-seconds * (key === 'turn' ? 16 : 10)))
          pending = true
        } else frame[key] = target[key]
      }
      const css = stage.current.style
      css.setProperty('--h-shift-x', `${(frame.x - .5) * 32}%`)
      css.setProperty('--h-shift-y', `${(frame.y - .5) * 32}%`)
      css.setProperty('--h-gain', String(frame.gain))
      css.setProperty('--h-rx', `${reduced.current ? 0 : (.5 - frame.y) * 19 * frame.gain}deg`)
      css.setProperty('--h-ry', `${reduced.current ? 0 : (frame.x - .5) * 24 * frame.gain}deg`)
      css.setProperty('--h-turn', `${frame.turn}deg`)
      const nextBack = Math.cos(frame.turn * Math.PI / 180) < 0
      if (nextBack !== facingBack.current) { facingBack.current = nextBack; setBack(nextBack) }
      if (pending) animate()
    })
  }, [])

  const light = useCallback((x: number, y: number, gain = 1) => {
    Object.assign(aim.current, { x: clamp(x, 0, 1), y: clamp(y, 0, 1), gain })
    wake()
  }, [wake])

  const turn = (degrees: number, immediate = false) => {
    aim.current.turn = degrees
    if (immediate) live.current.turn = degrees
    wake()
  }

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
      light(.5 + (event.gamma - baseline.gamma) / 55, .5 + (event.beta - baseline.beta) / 60)
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

  return { stage, aim, light, turn, back, reduced, sensor, toggleSensor, sensorMessage }
}

/** Keep one noise source live during a gesture. New movement briefly opens its gain envelope. */
export function createFoilSound() {
  try {
    const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio) return
    const ctx = new Audio()
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
      const release = () => { if (ctx.state !== 'closed') void ctx.close().catch(() => {}) }
      const watchdog = window.setTimeout(release, 950)
      source.onended = () => { window.clearTimeout(watchdog); release() }
      source.stop(ctx.currentTime + (finish ? .25 : .012))
    }
    return { pulse, stop }
  } catch { /* Sound is optional on devices without Web Audio. */ }
}
