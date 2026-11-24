import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { CoursePlanet } from './professionalAtlas'
import type { StarPoint } from './useStarCamera'

const tau = Math.PI * 2
const extent = 1.84

// View a thin scattering shell edge-on. Optical depth peaks at the limb and
// falls off much more quickly into space than it does over the lit surface.
function illuminatedLimb(color: string) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 384
  const ctx = tile.getContext('2d')!
  const pixels = ctx.createImageData(tile.width, tile.height)
  const tint = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
  for (let y = 0; y < tile.height; y++) {
    for (let x = 0; x < tile.width; x++) {
      const nx = (x + .5 - 192) / 150, ny = (y + .5 - 192) / 150
      const r = Math.hypot(nx, ny)
      const h = r - 1
      const daylight = Math.pow(Math.max(0, (1 + nx / (r || 1)) / 2), 2.8)
      const density = h > 0
        ? .64 * Math.exp(-h * 48) + .16 * Math.exp(-h * 12)
        : .62 * Math.exp(h * 20) + .13 * Math.exp(h * 3)
      const core = Math.exp(-Math.abs(h) * 95) * daylight * .79
      const i = (y * tile.width + x) * 4
      for (let c = 0; c < 3; c++) pixels.data[i + c] = tint[c] + (255 - tint[c]) * core
      pixels.data[i + 3] = 255 * density * (.08 + .92 * daylight)
    }
  }
  ctx.putImageData(pixels, 0, 0)
  return tile
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export default function PlanetEncounter({ planet, x, y, diameter, pointer }: {
  planet: CoursePlanet
  x: number
  y: number
  diameter: number
  pointer: RefObject<StarPoint>
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const shell = illuminatedLimb(planet.atmosphere)
    const pixels = Math.min(1200, Math.ceil(diameter * extent * Math.min(devicePixelRatio || 1, 2)))
    canvas.width = canvas.height = pixels
    const radius = pixels / (2 * extent)
    const tilt = planet.orbitTilt * Math.PI / 180
    const random = seededRandom([...planet.id].reduce((hash, c) => Math.imul(hash, 31) + c.charCodeAt(0), 7))
    const grains = Array.from({ length: Math.min(58, Math.max(22, Math.round(diameter * .32))) }, () => ({
      phase: random() * tau, orbit: 1.13 + random() * .48, speed: .12 + random() * .25,
      depth: .32 + random() * .17, size: .004 + random() ** 3 * .014,
      brightness: .24 + random() * .7, dx: 0, dy: 0, vx: 0, vy: 0,
    }))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let angle = Math.atan2(pointer.current.y, pointer.current.x)
    let previous = 0, time = 0, frame = 0
    function draw(now: number) {
      if (!ctx || !canvas) return
      const dt = Math.min(.05, Math.max(0, (now - (previous || now)) / 1000))
      previous = now
      if (!reduced.matches) time += dt
      const { x: px, y: py } = pointer.current
      const target = Math.hypot(px, py) < .08 ? -2.28 : Math.atan2(py, px)
      const delta = target - angle
      angle += Math.atan2(Math.sin(delta), Math.cos(delta)) * (reduced.matches ? 1 : 1 - Math.exp(-dt * 17))
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, pixels, pixels)
      ctx.translate(pixels / 2, pixels / 2)
      ctx.scale(radius, radius)
      ctx.save()
      ctx.rotate(angle)
      const edge = shell.width / 300
      ctx.drawImage(shell, -edge, -edge, edge * 2, edge * 2)
      // Forward scatter is brightest where the incoming ray grazes the silhouette.
      const bloom = ctx.createRadialGradient(1, 0, 0, 1, 0, .22)
      bloom.addColorStop(0, planet.atmosphere + '82')
      bloom.addColorStop(.24, planet.atmosphere + '39')
      bloom.addColorStop(1, planet.atmosphere + '00')
      ctx.fillStyle = bloom
      ctx.fillRect(.78, -.22, .44, .44)
      ctx.restore()
      ctx.rotate(tilt)
      ctx.lineCap = 'round'
      const mx = px * Math.cos(tilt) + py * Math.sin(tilt)
      const my = py * Math.cos(tilt) - px * Math.sin(tilt)
      for (const p of grains) {
        const phase = p.phase + time * p.speed
        const ax = Math.cos(phase) * p.orbit, ay = Math.sin(phase) * p.orbit * p.depth
        const dx = ax + p.dx - mx, dy = ay + p.dy - my
        const force = Math.max(0, 1 - Math.hypot(dx, dy) / .72) ** 2 * 28
        if (!reduced.matches) {
          p.vx += (dx * force - p.dx * 15 - p.vx * 5) * dt
          p.vy += (dy * force - p.dy * 15 - p.vy * 5) * dt
          p.dx += p.vx * dt
          p.dy += p.vy * dt
        }
        const gx = ax + p.dx, gy = ay + p.dy
        if (Math.sin(phase) < 0 && gx * gx + gy * gy < 1.015) continue
        ctx.globalAlpha = p.brightness * (.84 + .16 * Math.sin(phase + time))
        ctx.strokeStyle = p.size > .012 ? '#fffaec' : planet.atmosphere
        ctx.lineWidth = Math.max(1 / radius, p.size)
        ctx.beginPath()
        ctx.moveTo(gx, gy)
        ctx.lineTo(gx + Math.sin(phase) * p.size * 2.7, gy - Math.cos(phase) * p.size * p.depth * 2.7)
        ctx.stroke()
        if (p.size > .015) {
          const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, p.size * 3.4)
          glint.addColorStop(0, '#fff8e8')
          glint.addColorStop(.2, planet.atmosphere + 'bf')
          glint.addColorStop(1, planet.atmosphere + '00')
          ctx.fillStyle = glint
          ctx.fillRect(gx - p.size*3.4, gy - p.size*3.4, p.size*6.8, p.size*6.8)
        }
      }
      ctx.globalAlpha = 1
      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(draw)
    }
    function restart() {
      cancelAnimationFrame(frame)
      previous = 0
      if (!document.hidden) draw(performance.now())
    }
    function staticLight() { if (reduced.matches) restart() }
    restart()
    window.addEventListener('pointermove', staticLight)
    document.addEventListener('visibilitychange', restart)
    reduced.addEventListener('change', restart)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', staticLight)
      document.removeEventListener('visibilitychange', restart)
      reduced.removeEventListener('change', restart)
    }
  }, [planet, diameter, pointer])
  return <canvas aria-hidden="true" className="planet-encounter" data-planet={planet.id} ref={ref}
    style={{ left: x, top: y, width: diameter * extent, height: diameter * extent }} />
}
