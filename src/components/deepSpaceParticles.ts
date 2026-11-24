import { advanceFragment, fragment, infallingRock, singularity, tau } from './deepSpacePhysics'
import type { Fragment, SpaceView } from './deepSpacePhysics'
import type { StarPoint } from './useStarCamera'

function noise(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

export type Observation = 'ready' | 'released' | 'captured' | 'passed'
type Spark = StarPoint & { vx: number; vy: number; age: number; maxAge: number }

export class DeepSpaceMatter {
  private rocks: Fragment[] = []
  private sparks: Spark[] = []
  private echoes: { path: StarPoint[]; born: number }[] = []
  private serial = 7
  private nextCrossing = .75
  private nextEncounter = 1.6
  private pending: Fragment | null = null
  private idleAt = Infinity
  time = 0
  flare = 0
  constructor(private readonly report: (value: Observation) => void) {}

  private random() { return noise(++this.serial) }

  release(origin?: StarPoint, charge = 0) {
    let rock: Fragment
    if (origin && Math.hypot(origin.x-singularity.x, origin.y-singularity.y) > singularity.radius * 1.4) {
      const dx = origin.x-singularity.x, dy = origin.y-singularity.y
      const distance = Math.hypot(dx, dy), speed = Math.max(75, distance * .62)
      rock = fragment(origin.x, origin.y, (-dx*speed-dy*32)/distance, (-dy*speed+dx*32)/distance, 3.6, true)
    } else {
      rock = infallingRock(-2.9 + this.random()*.9, true, 220, charge)
    }
    this.pending = rock
    this.idleAt = Infinity
    this.rocks.push(rock)
    if (this.rocks.length > 24) this.rocks.shift()
    this.report('released')
    return rock
  }

  private debris(x: number, y: number) {
    this.flare = 1
    for (let i = 0; i < 15; i++) {
      const a = Math.atan2(y-singularity.y, x-singularity.x) + (this.random()-.5)*.3
      const speed = 22 + this.random()*65
      this.sparks.push({ x, y, vx: -Math.sin(a)*speed, vy: Math.cos(a)*speed*.5,
        age: 0, maxAge: .25+this.random()*.65 })
    }
  }

  step(dt: number, v: SpaceView) {
    this.time += dt
    this.flare = Math.max(0, this.flare - dt*1.5)
    if (this.time > this.nextCrossing) {
      this.nextCrossing = this.time + 2.3 + this.random()*3.7
      const side = this.random() > .28 ? 1 : -1
      const speed = (260 + this.random()*290) / v.zoom
      const start = fragment(v.x - side * v.width*.56/v.zoom, v.y + (this.random()-.48)*v.height*.92/v.zoom,
        speed * side, (.12 + this.random()*.35) * speed * (this.random()>.5 ? -1 : 1), 1.4 + this.random()*.6)
      start.life = Math.min(11, v.width/(speed*v.zoom)+1.8)
      this.rocks.push(start)
    }
    if (this.time > this.nextEncounter) {
      this.nextEncounter = this.time + 3.1 + this.random()*3.8
      const rock = infallingRock(this.random()*tau, false, 220 + this.random()*100)
      rock.warm = true
      // A fast grazing traveller has enough angular momentum to escape.
      if (this.random() > .53) { rock.vx -= (rock.y-singularity.y)*.65; rock.vy += (rock.x-singularity.x)*.65 }
      this.rocks.push(rock)
    }
    for (let i = this.rocks.length-1; i >= 0; i--) {
      const rock = this.rocks[i], outcome = advanceFragment(rock, dt)
      if (outcome === 'flying') {
        const dx = rock.x-singularity.x, dy = rock.y-singularity.y
        if (this.pending === rock && rock.age > .6 && dx*rock.vx+dy*rock.vy > 0 && Math.hypot(dx,dy)>220) {
          this.report('passed'); this.pending = null; this.idleAt = this.time + 2.6
        }
        continue
      }
      if (outcome === 'captured') {
        this.debris(rock.x, rock.y)
        this.echoes.push({path: [...rock.trail, {x: rock.x, y: rock.y}], born: this.time})
      }
      if (this.pending === rock) {
        this.report(outcome === 'captured' ? 'captured' : 'passed')
        this.pending = null
        this.idleAt = this.time + 2.6
      }
      this.rocks.splice(i, 1)
    }
    if (this.time > this.idleAt) { this.idleAt = Infinity; this.report('ready') }
    this.echoes = this.echoes.filter(trace => this.time-trace.born < .72)
    this.sparks = this.sparks.filter(p => {
      p.x += p.vx*dt; p.y += p.vy*dt; p.age += dt
      return p.age < p.maxAge
    })
  }

  stillOrbit(rock: Fragment) {
    // Show a complete sampled trajectory without autoplay for reduced motion.
    let result: ReturnType<typeof advanceFragment> = 'flying'
    const samples: StarPoint[] = []
    while (result === 'flying') {
      samples.push({ x: rock.x, y: rock.y })
      result = advanceFragment(rock, 1/30)
    }
    rock.trail = samples
    rock.vx = rock.vy = 0
    this.report(result === 'captured' ? 'captured' : 'passed')
    this.pending = null
    this.rocks = [rock]
  }

  draw(ctx: CanvasRenderingContext2D, v: SpaceView, obscured: (x: number, y: number) => number) {
    const z = v.zoom, hx = (singularity.x-v.x)*z + v.width/2, hy = (singularity.y-v.y)*z + v.height/2
    const radius = singularity.radius * z

    // Whisper-subtle observatory celestial coordinate arcs echoing the Home 3D observatory.
    ctx.save()
    ctx.translate(v.width/2 - v.x*z, v.height/2 - v.y*z)
    ctx.scale(z, z)
    const cx = 2110, cy = 1480
    ctx.strokeStyle = 'rgba(174, 196, 204, 0.055)'
    ctx.lineWidth = Math.max(.85 / z, .7)
    for (const ring of [460, 880, 1340, 1820]) {
      ctx.beginPath()
      ctx.arc(cx, cy, ring, 0, tau)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(213, 237, 185, 0.045)'
    ctx.beginPath()
    ctx.moveTo(cx - 1960, cy); ctx.lineTo(cx + 1960, cy)
    ctx.moveTo(cx, cy - 1320); ctx.lineTo(cx, cy + 1320)
    ctx.stroke()
    ctx.restore()

    // Three independently projected star catalogues. Only tiles crossing the viewport are visited.
    for (let layer = 0; layer < 3; layer++) {
      const depth = [.085,.24,.52][layer]
      const scale = .72 + Math.sqrt(z) * .29
      const cell = (layer === 2 ? 163 : layer === 1 ? 86 : 55) * scale
      const left = v.x*depth*scale-v.width/2, top = v.y*depth*scale-v.height/2
      const firstX = Math.floor(left/cell)-1, firstY = Math.floor(top/cell)-1
      for (let row = firstY; row <= Math.ceil((top+v.height)/cell); row++) {
        for (let col = firstX; col <= Math.ceil((left+v.width)/cell); col++) {
          const key = Math.imul(col,7919) ^ Math.imul(row,42181) ^ (layer+1)*731
          let x = (col+noise(key))*cell-left, y = (row+noise(key+3))*cell-top
          if (x < -5 || y < -5 || x > v.width+5 || y > v.height+5) continue
          const dx = x-hx, dy = y-hy, r = Math.hypot(dx,dy)
          const prox = r < radius*5
          if (prox && r > .1) {
            const apparent = .5*(r+Math.sqrt(r*r+4*radius*radius*Math.exp(-r/(2*radius))))
            x = hx + dx*apparent/r; y = hy + dy*apparent/r
          }
          const seed = noise(key+8)
          ctx.globalAlpha = (.26+.59*seed)*(.81+.19*Math.sin(this.time*(.35+seed)+seed*92)) *
            (prox ? 1-obscured(x,y) : 1)
          if (ctx.globalAlpha < .04) continue
          const s = (.4+layer*.22+seed*.35)*scale
          ctx.fillStyle = seed>.90 ? '#f6d5ac' : seed<.23 ? '#93c7fa' : '#d8e9f4'
          if (r < radius*1.4 && r > .1) {
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = s
            const a = Math.atan2(dy,dx), spread = Math.min(.22, (radius/r)*.027)
            ctx.beginPath(); ctx.arc(hx,hy,Math.hypot(x-hx,y-hy),a-spread,a+spread); ctx.stroke()
          } else {
            ctx.fillRect(x,y,s,s)
            if (layer === 2 && seed > .69) {
              ctx.globalAlpha *= .35
              ctx.fillRect(x-2*s,y+s*.28,5*s,s*.45); ctx.fillRect(x+s*.28,y-2*s,s*.45,5*s)
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.save()
    ctx.translate(v.width/2-v.x*z,v.height/2-v.y*z)
    ctx.scale(z,z)
    for (const echo of this.echoes) {
      const decay = (this.time-echo.born)/.72, cut = Math.floor(decay*(echo.path.length-1))
      ctx.strokeStyle = 'rgba(255,158,85,'+(.52*(1-decay)**2)+')'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(echo.path[cut].x,echo.path[cut].y)
      for (let i = cut+1; i < echo.path.length; i++) ctx.lineTo(echo.path[i].x,echo.path[i].y)
      ctx.stroke()
    }
    for (const rock of this.rocks) {
      if (Math.abs(rock.x-v.x)*z > v.width*.5+300 || Math.abs(rock.y-v.y)*z > v.height*.5+220) continue
      const tail = rock.trail[0], hot = Math.hypot(rock.x-singularity.x,rock.y-singularity.y) < 130
      const ink = hot || rock.warm ? '255,195,128' : '160,218,255'
      const gradient = ctx.createLinearGradient(tail.x,tail.y,rock.x+.001,rock.y)
      gradient.addColorStop(0,'rgba('+ink+',0)')
      gradient.addColorStop(.68,'rgba('+ink+',.19)')
      gradient.addColorStop(1,'rgba('+ink+',.95)')
      ctx.strokeStyle = gradient; ctx.lineWidth = Math.max(.7/z,rock.size*.7); ctx.lineCap='round'
      ctx.beginPath(); ctx.moveTo(tail.x,tail.y)
      for (const sample of rock.trail) ctx.lineTo(sample.x,sample.y)
      ctx.lineTo(rock.x,rock.y); ctx.stroke()
      ctx.save(); ctx.translate(rock.x,rock.y); ctx.rotate(Math.atan2(rock.vy,rock.vx))
      const size = Math.max(.9/z,rock.size)
      const strain = Math.max(0,1-(Math.hypot(rock.x-singularity.x,rock.y-singularity.y)-singularity.radius)/85)
      ctx.scale(1+strain*1.5,1-strain*.34)
      ctx.fillStyle = 'rgba('+ink+',.18)'
      ctx.beginPath(); ctx.ellipse(0,0,size*3,size*1.7,0,0,tau); ctx.fill()
      ctx.fillStyle = rock.warm ? '#ffdfad' : '#dcf6ff'
      ctx.beginPath(); ctx.ellipse(0,0,size*1.35,size*.68,0,0,tau); ctx.fill()
      if (strain > .12) {
        ctx.globalAlpha = strain*.80
        for (let i = 1; i <= 4; i++) {
          ctx.fillRect(-size*(1+i*.84),Math.sin(i*4.4+rock.age*5)*strain*size, size*.39,size*.22)
        }
      }
      ctx.restore()
    }
    // Tidal dust sweeps around the near side of the disk and disappears behind its shadow.
    for (let i = 0; i < 48; i++) {
      const n = noise(i+283), orbit = 66 + n*122
      const a = i*2.39996 + this.time*(.26+.31*(1-n))
      const dx = Math.cos(a)*orbit, dy = Math.sin(a)*orbit*(.09+noise(i+925)*.14)
      const x = singularity.x+dx, y = singularity.y+dy-dx*.105
      if (Math.sin(a) < 0 && Math.hypot(dx,dy) < singularity.radius*1.16) continue
      ctx.globalAlpha = .18 + .56*n
      ctx.fillStyle = n > .7 ? '#ffe2b5' : '#d69d77'
      ctx.fillRect(x,y,Math.max(.65/z,n*1.8),Math.max(.55/z,n*1.2))
    }
    for (const p of this.sparks) {
      ctx.globalAlpha = 1-p.age/p.maxAge; ctx.fillStyle = '#ffd6a2'
      ctx.fillRect(p.x,p.y,1.5,1)
    }
    ctx.restore(); ctx.globalAlpha = 1
  }
}
