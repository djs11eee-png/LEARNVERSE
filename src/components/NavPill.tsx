import { useLayoutEffect, useRef } from 'react'

let sound: AudioContext | undefined
export function clickNav() {
  try {
    sound ??= new AudioContext()
    if (sound.state === 'suspended') void sound.resume().catch(() => {})
    const tone = sound.createOscillator()
    const envelope = sound.createGain()
    const now = sound.currentTime
    tone.type = 'triangle'
    tone.frequency.setValueAtTime(820, now)
    tone.frequency.exponentialRampToValueAtTime(260, now + 0.022)
    envelope.gain.setValueAtTime(0.021, now)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
    tone.connect(envelope).connect(sound.destination)
    tone.onended = () => { tone.disconnect(); envelope.disconnect() }
    tone.start(now)
    tone.stop(now + 0.04)
  } catch { /* Silent navigation is available on devices without Web Audio. */ }
}

export function NavPill({ path, open }: { path: string; open: boolean }) {
  const element = useRef<HTMLSpanElement>(null)
  const motion = useRef<{ x: number; speed: number; width: number; stretch: number } | null>(null)
  useLayoutEffect(() => {
    const pill = element.current!
    const nav = pill.parentElement!
    const active = nav.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!active) { pill.style.opacity = '0'; return }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    function measure() {
      cancelAnimationFrame(frame)
      if (!active || !nav.offsetWidth) return
      const target = active.offsetLeft
      const width = active.offsetWidth
      const current = motion.current ?? { x: target, speed: 0, width, stretch: 0 }
      motion.current = current
      pill.style.width = width + 'px'
      pill.style.height = active.offsetHeight + 'px'
      pill.style.top = active.offsetTop + 'px'
      pill.style.opacity = '1'
      let last = performance.now()
      function draw(now: number) {
        const dt = Math.min(0.032, Math.max(0, (now - last) / 1000))
        last = now
        // Two short integration steps keep the spring steady on slower screens.
        for (let step = 0; step < 2; step++) {
          current.speed += ((target - current.x) * 380 - current.speed * 30) * dt / 2
          current.x += current.speed * dt / 2
          current.stretch += ((width - current.width) * 380 - current.stretch * 30) * dt / 2
          current.width += current.stretch * dt / 2
        }
        const resting = reduced.matches || (Math.abs(target - current.x) + Math.abs(width - current.width) < .1 && Math.abs(current.speed) + Math.abs(current.stretch) < 1)
        if (resting) { current.x = target; current.speed = 0; current.width = width; current.stretch = 0 }
        pill.style.transform = 'translate3d(' + current.x + 'px,0,0) scaleX(' + current.width / width + ')'
        if (!resting) frame = requestAnimationFrame(draw)
      }
      draw(last)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    for (const item of nav.querySelectorAll('a')) observer.observe(item)
    reduced.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      reduced.removeEventListener('change', measure)
      cancelAnimationFrame(frame)
    }
  }, [path, open])
  return <span aria-hidden="true" className="nav-pill" ref={element} />
}
