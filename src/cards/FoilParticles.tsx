import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { Finish } from './types'

export const foilColors: Record<Finish, string> = {
  standard: '#a4d9de', reverse: '#92b8ff', cosmos: '#b1a0ff',
  crosshatch: '#69e6cd', rainbow: '#f39bd1', gold: '#f3c879',
}

export type FoilEmitter = {
  scatter: (x: number, y: number, colors: string[], burst: boolean) => void
}

type Shard = {
  x: number; y: number; vx: number; vy: number; age: number; life: number
  spin: number; angle: number; size: number; color: string; ribbon: boolean
}

/** A transient overlay in dialog coordinates. Nothing is drawn between gestures. */
export function FoilParticles({ ref }: { ref: Ref<FoilEmitter> }) {
  const surface = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Shard[]>([])
  const frame = useRef(0)
  useEffect(() => () => { cancelAnimationFrame(frame.current); particles.current.length = 0 }, [])
  useImperativeHandle(ref, () => ({
    scatter(x, y, colors, burst) {
      const canvas = surface.current
      if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches || !colors.length) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(devicePixelRatio, 1.5)
      const w = Math.round(bounds.width * ratio), h = Math.round(bounds.height * ratio)
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      const batch = burst ? 65 : 4
      const pool = particles.current
      pool.splice(0, Math.max(0, pool.length + batch - 120))
      for (let i = 0; i < batch; i++) {
        const angle = -Math.PI / 2 + (Math.random() - .5) * (burst ? 2.65 : 2.1)
        const speed = burst ? Math.min(670, bounds.width * .75 + 120) * (.5 + Math.random() * .65) : 60 + Math.random() * 115
        pool.push({
          x: x - bounds.left, y: y - bounds.top, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          age: 0, life: burst ? 1.15 + Math.random() * .95 : .18 + Math.random() * .26,
          spin: 4 + Math.random() * 8, angle, size: burst ? 6 + Math.random() * 9 : 2 + Math.random() * 3,
          color: colors[i % colors.length], ribbon: burst,
        })
      }
      if (frame.current) return
      let last = performance.now()
      const paint = (now: number) => {
        const dt = Math.min(.035, (now - last) / 1000)
        last = now
        ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio)
        for (let i = pool.length - 1; i >= 0; i--) {
          const p = pool[i]
          p.age += dt
          if (p.age >= p.life) { pool.splice(i, 1); continue }
          p.x += p.vx * dt; p.y += p.vy * dt
          p.vx *= Math.exp(-.9 * dt); p.vy += (p.ribbon ? 490 : 230) * dt
          const turn = p.angle + p.age * p.spin
          ctx.save()
          ctx.translate(p.x, p.y); ctx.rotate(turn * .65)
          ctx.scale(1, .16 + .84 * Math.abs(Math.cos(turn)))
          ctx.globalAlpha = Math.min(1, 4 * (1 - p.age / p.life))
          ctx.strokeStyle = p.color; ctx.lineWidth = p.ribbon ? 2.5 : 1.2
          ctx.beginPath(); ctx.moveTo(-p.size, 0)
          ctx.quadraticCurveTo(0, Math.sin(turn) * p.size, p.size, 0); ctx.stroke()
          ctx.restore()
        }
        frame.current = pool.length ? requestAnimationFrame(paint) : 0
      }
      frame.current = requestAnimationFrame(paint)
    },
  }), [])
  return <canvas className="foil-particles" ref={surface} aria-hidden="true" />
}
