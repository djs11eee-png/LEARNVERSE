import { useEffect, type RefObject } from 'react'

const fineMotion = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const stars = [[49, 20], [12, 58], [68, 46], [62, 73], [36, 62], [73, 11], [50, 50]]
const edges = [[0, 5], [0, 6], [1, 4], [2, 5], [2, 6], [2, 3], [3, 4], [4, 6]]

export function Constellation() {
  return <svg className="map-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <g className="star-lines">{edges.map(([a, b]) =>
      <line key={a + '-' + b} x1={stars[a][0]} y1={stars[a][1]} x2={stars[b][0]} y2={stars[b][1]} />)}</g>
    <g>{stars.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={index === 6 ? 1.55 : 1.3} />)}</g>
  </svg>
}

export function useHeroMotion(ref: RefObject<HTMLElement | null>, introActive: boolean) {
  useEffect(() => {
    const element = ref.current
    if (!element || introActive) return
    const hero = element
    const magnets = Array.from(hero.querySelectorAll<HTMLElement>('.magnet-zone'), zone => ({
      zone, x: 0, y: 0, targetX: 0, targetY: 0,
    }))
    const mode = matchMedia(fineMotion)
    let targetX = 0, targetY = 0, x = 0, y = 0
    let frame = 0, lastFrame = 0
    function tick(time: number) {
      frame = 0
      const blend = 1 - Math.exp(-clamp(time - lastFrame, 8, 32) / 82)
      lastFrame = time
      const ease = (v: number, to: number) => Math.abs(to - v) < .001 ? to : v + (to - v) * blend
      x = ease(x, targetX); y = ease(y, targetY)
      hero.style.setProperty('--look-x', x.toFixed(4))
      hero.style.setProperty('--look-y', y.toFixed(4))
      for (const magnet of magnets) {
        magnet.x = ease(magnet.x, magnet.targetX)
        magnet.y = ease(magnet.y, magnet.targetY)
        magnet.zone.style.setProperty('--magnet-x', magnet.x.toFixed(2) + 'px')
        magnet.zone.style.setProperty('--magnet-y', magnet.y.toFixed(2) + 'px')
      }
      if (x !== targetX || y !== targetY || magnets.some(m => m.x !== m.targetX || m.y !== m.targetY)) schedule()
    }
    function schedule() { if (!frame && !document.hidden) frame = requestAnimationFrame(tick) }
    function move(event: PointerEvent) {
      if (!mode.matches || event.pointerType === 'touch') return
      const rect = hero.getBoundingClientRect()
      targetX = clamp((event.clientX - rect.left) * 2 / rect.width - 1, -1, 1)
      targetY = clamp((event.clientY - rect.top) * 2 / rect.height - 1, -1, 1)
      for (const magnet of magnets) {
        const button = magnet.zone.getBoundingClientRect()
        const dx = event.clientX - (button.left + button.width / 2)
        const dy = event.clientY - (button.top + button.height / 2)
        const outside = Math.hypot(Math.max(0, Math.abs(dx) - button.width / 2), Math.max(0, Math.abs(dy) - button.height / 2))
        const weight = Math.max(0, 1 - outside / 46)
        magnet.targetX = clamp(dx * .18, -9, 9) * weight
        magnet.targetY = clamp(dy * .20, -6, 6) * weight
      }
      schedule()
    }
    function leave() {
      targetX = targetY = 0
      for (const magnet of magnets) magnet.targetX = magnet.targetY = 0
      schedule()
    }
    function reset() {
      cancelAnimationFrame(frame); frame = 0
      targetX = targetY = x = y = 0
      hero.style.removeProperty('--look-x'); hero.style.removeProperty('--look-y')
      for (const magnet of magnets) {
        magnet.x = magnet.y = magnet.targetX = magnet.targetY = 0
        magnet.zone.style.removeProperty('--magnet-x'); magnet.zone.style.removeProperty('--magnet-y')
      }
    }
    const visibility = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) reset() })
    visibility.observe(hero)
    hero.addEventListener('pointermove', move, { passive: true })
    hero.addEventListener('pointerleave', leave)
    mode.addEventListener('change', reset)
    document.addEventListener('visibilitychange', reset)
    return () => {
      reset()
      visibility.disconnect()
      hero.removeEventListener('pointermove', move)
      hero.removeEventListener('pointerleave', leave)
      mode.removeEventListener('change', reset)
      document.removeEventListener('visibilitychange', reset)
    }
  }, [ref, introActive])
}

export function useMissionMotion(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const grid = ref.current
    if (!grid) return
    const mode = matchMedia(fineMotion)
    const map = grid.querySelector<SVGSVGElement>('.map-stars')
    const circles = Array.from(map?.querySelectorAll('circle') ?? [])
    const lines = Array.from(map?.querySelectorAll('line') ?? [])
    const points = stars.map(([x, y]) => ({ x, y }))
    let active: HTMLElement | null = null
    let clientX = 0, clientY = 0, frame = 0
    function tick() {
      frame = 0
      let mapX = -200, mapY = -200
      if (active) {
        const rect = active.getBoundingClientRect()
        const localX = clientX - rect.left, localY = clientY - rect.top
        if (active.classList.contains('map-card') && map) {
          const bounds = map.getBoundingClientRect()
          mapX = (clientX - bounds.left) * 100 / Math.max(1, bounds.width)
          mapY = (clientY - bounds.top) * 100 / Math.max(1, bounds.height)
        }
        active.style.setProperty('--spot-x', localX.toFixed(1) + 'px')
        active.style.setProperty('--spot-y', localY.toFixed(1) + 'px')
        active.style.setProperty('--tilt-x', ((.5 - localY / rect.height) * 3.4).toFixed(2) + 'deg')
        active.style.setProperty('--tilt-y', ((localX / rect.width - .5) * 3.4).toFixed(2) + 'deg')
      }
      let settling = false
      points.forEach((point, index) => {
        const [originX, originY] = stars[index]
        const dx = mapX - originX, dy = mapY - originY
        const weight = Math.max(0, 1 - Math.hypot(dx, dy) / 42) * .48
        const targetX = originX + dx * weight, targetY = originY + dy * weight
        const far = Math.abs(targetX - point.x) + Math.abs(targetY - point.y) > .035
        if (!far && targetX === point.x && targetY === point.y) return
        point.x = far ? point.x + (targetX - point.x) * .24 : targetX
        point.y = far ? point.y + (targetY - point.y) * .24 : targetY
        circles[index].setAttribute('cx', point.x.toFixed(2))
        circles[index].setAttribute('cy', point.y.toFixed(2))
        settling ||= far
      })
      edges.forEach(([a, b], index) => {
        const line = lines[index]
        const from = points[a], to = points[b]
        line.setAttribute('x1', from.x.toFixed(2)); line.setAttribute('y1', from.y.toFixed(2))
        line.setAttribute('x2', to.x.toFixed(2)); line.setAttribute('y2', to.y.toFixed(2))
        const distance = Math.hypot(mapX - (from.x + to.x) / 2, mapY - (from.y + to.y) / 2)
        line.style.opacity = (.11 + .8 * Math.max(0, 1 - distance / 53)).toFixed(2)
      })
      if (settling) schedule()
    }
    function schedule() { if (!frame && !document.hidden) frame = requestAnimationFrame(tick) }
    function clearCard() {
      if (!active) return
      delete active.dataset.tracking
      for (const name of ['--tilt-x', '--tilt-y', '--spot-x', '--spot-y']) active.style.removeProperty(name)
      active = null
    }
    function move(event: PointerEvent) {
      if (!mode.matches || event.pointerType === 'touch') return
      const card = (event.target as Element).closest<HTMLElement>('.mission-card')
      if (card !== active) {
        clearCard()
        active = card
        if (active) active.dataset.tracking = ''
      }
      clientX = event.clientX; clientY = event.clientY
      schedule()
    }
    function leave() { clearCard(); schedule() }
    function reset() {
      clearCard()
      cancelAnimationFrame(frame); frame = 0
      points.forEach((point, index) => { [point.x, point.y] = stars[index] })
      circles.forEach((circle, index) => {
        circle.setAttribute('cx', String(points[index].x)); circle.setAttribute('cy', String(points[index].y))
      })
      lines.forEach((line, index) => {
        const [a, b] = edges[index]
        line.setAttribute('x1', String(points[a].x)); line.setAttribute('y1', String(points[a].y))
        line.setAttribute('x2', String(points[b].x)); line.setAttribute('y2', String(points[b].y))
        line.style.removeProperty('opacity')
      })
    }
    grid.addEventListener('pointermove', move, { passive: true })
    grid.addEventListener('pointerleave', leave)
    document.addEventListener('visibilitychange', reset)
    mode.addEventListener('change', reset)
    return () => {
      reset()
      grid.removeEventListener('pointermove', move)
      grid.removeEventListener('pointerleave', leave)
      document.removeEventListener('visibilitychange', reset)
      mode.removeEventListener('change', reset)
    }
  }, [ref])
}
