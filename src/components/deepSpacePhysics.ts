import type { StarPoint } from './useStarCamera'

export const singularity = { x: 1950, y: 1340, radius: 58 }
const gravity = 1340000
export const discWidth = 460
export const tau = Math.PI * 2
export type SpaceView = { x: number; y: number; zoom: number; width: number; height: number }
export type Fragment = StarPoint & {
  vx: number; vy: number; age: number; life: number; size: number
  trail: StarPoint[]; sampleTime: number; probe: boolean; warm: boolean
}

export function fragment(x: number, y: number, vx: number, vy: number, size: number, probe = false): Fragment {
  return { x, y, vx, vy, size, probe, warm: probe, age: 0, life: 12, sampleTime: 0, trail: [{ x, y }] }
}

export function infallingRock(angle: number, probe = false, distance = 220, charge = 0) {
  const nx = Math.cos(angle), ny = Math.sin(angle)
  const tangent = 39 + Math.max(0, Math.min(1,charge))*124
  return fragment(singularity.x + distance * nx, singularity.y + distance * ny,
    -nx * 52 - ny * tangent, -ny * 52 + nx * tangent, probe ? 3.5 : 2.1, probe)
}

// Softened Newtonian gravity in map units. Integration is independent of display refresh rate.
export function advanceFragment(body: Fragment, elapsed: number): 'flying' | 'captured' | 'expired' {
  let remaining = elapsed
  while (remaining > .000001) {
    const dt = Math.min(1/120, remaining)
    const dx = singularity.x - body.x, dy = singularity.y - body.y
    const squared = dx * dx + dy * dy
    const pull = gravity / Math.pow(squared + 100, 1.5)
    body.vx += dx * pull * dt
    body.vy += dy * pull * dt
    body.x += body.vx * dt
    body.y += body.vy * dt
    body.age += dt
    body.sampleTime += dt
    if (body.sampleTime >= 1/45) {
      body.sampleTime -= 1/45
      body.trail.push({ x: body.x, y: body.y })
      if (body.trail.length > 31) body.trail.shift()
    }
    if (Math.hypot(body.x - singularity.x, body.y - singularity.y) <= singularity.radius) return 'captured'
    remaining -= dt
  }
  return body.age >= body.life ? 'expired' : 'flying'
}
