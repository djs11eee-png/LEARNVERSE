import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { Ref } from 'react'
import { discWidth, singularity, tau } from './deepSpacePhysics'
import type { SpaceView } from './deepSpacePhysics'
import { lightSources, makeLightPass, skyFrame } from './deepSpaceLight'
import { DeepSpaceMatter } from './deepSpaceParticles'
import type { Observation } from './deepSpaceParticles'
import type { StarPoint } from './useStarCamera'

export type SpaceControls = { release(origin?: StarPoint, charge?: number): void }

function loadImage(src: string) {
  const image = new Image()
  image.src = src
  return image.decode().then(() => image)
}

/** Cache the background and refract it in concentric annuli on devices without WebGL. */
function paintFallback(layer: HTMLCanvasElement, v: SpaceView, sky: HTMLImageElement, disk: HTMLImageElement) {
  layer.width = Math.ceil(v.width); layer.height = Math.ceil(v.height)
  const ctx = layer.getContext('2d')!
  const f = skyFrame(v)
  // Solid obsidian observatory base guarantees an opaque fallback canvas.
  ctx.fillStyle = '#060b10'
  ctx.fillRect(0, 0, layer.width, layer.height)
  ctx.save()
  ctx.globalAlpha = .86
  ctx.drawImage(sky, f.x, f.y, f.width, f.height)
  ctx.restore()
  const wash = ctx.createRadialGradient(v.width * .5, v.height * .48, 0, v.width * .5, v.height * .48, Math.max(v.width, v.height) * .72)
  wash.addColorStop(0, 'rgba(18, 36, 46, .28)')
  wash.addColorStop(.62, 'rgba(9, 15, 23, .36)')
  wash.addColorStop(1, 'rgba(7, 11, 17, .74)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, layer.width, layer.height)
  const x = (singularity.x-v.x)*v.zoom+v.width/2, y = (singularity.y-v.y)*v.zoom+v.height/2
  const width = discWidth*v.zoom
  if (x+width < 0 || y+width < 0 || x-width > v.width || y-width > v.height) return
  for (let i = 23; i >= 4; i--) {
    const outer = (i+1)*width/32, inner = i*width/32, r = (i+.5)/32
    const scale = 1/Math.max(.22,1-.017*Math.exp(-r*1.65)/(r*r))
    ctx.save(); ctx.beginPath()
    ctx.arc(x,y,outer+.6,0,tau); ctx.moveTo(x+inner,y); ctx.arc(x,y,inner,0,tau,true)
    ctx.clip('evenodd')
    ctx.globalAlpha = .86
    ctx.drawImage(sky,x+(f.x-x)*scale,y+(f.y-y)*scale,f.width*scale,f.height*scale)
    ctx.restore()
  }
  ctx.save()
  ctx.globalAlpha = .88
  ctx.drawImage(disk,x-width*.496,y-width*2/3*.518,width,width*2/3)
  ctx.restore()
}

export default function DeepSpace({ view, controls, onObservation }: {
  view: SpaceView; controls: Ref<SpaceControls>; onObservation: (status: Observation) => void
}) {
  const light = useRef<HTMLCanvasElement>(null), foreground = useRef<HTMLCanvasElement>(null)
  const latest = useRef(view), repaint = useRef<() => void>(() => {})
  const launch = useRef<(point?: StarPoint, charge?: number) => void>(() => {})
  useImperativeHandle(controls, () => ({ release: (point,charge) => launch.current(point,charge) }), [])
  useLayoutEffect(() => { latest.current = view; repaint.current() }, [view])
  useEffect(() => {
    const gpu = light.current!, canvas = foreground.current!
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const matter = new DeepSpaceMatter(onObservation)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cache = document.createElement('canvas')
    let sky: HTMLImageElement | undefined, disk: HTMLImageElement | undefined
    let alpha: Uint8ClampedArray | undefined, pass: ReturnType<typeof makeLightPass> = null
    let lastView: SpaceView | undefined, inView = true, disposed = false, previous = 0, frame = 0
    function draw(now: number, force = false) {
      cancelAnimationFrame(frame); frame = 0
      if (disposed || !inView || document.hidden || !ctx) return
      const v = latest.current
      if (!v.width || !v.height) return
      if (!force && previous && now-previous < 32) { frame = requestAnimationFrame(t => draw(t)); return }
      const dt = previous ? Math.min(.10, Math.max(0,(now-previous)/1000)) : 0
      previous = now
      const dpr = Math.min(devicePixelRatio || 1, 1.5, 1900/Math.max(v.width,v.height))
      const width = Math.ceil(v.width*dpr), height = Math.ceil(v.height*dpr)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = gpu.width = width; canvas.height = gpu.height = height
      }
      if (!motion.matches) matter.step(dt,v)
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,v.width,v.height)
      if (pass) pass.draw(v,matter.time,matter.flare)
      else if (sky && disk) {
        if (lastView !== v) paintFallback(cache,v,sky,disk)
        ctx.drawImage(cache,0,0,v.width,v.height)
      }
      lastView = v
      const hx = (singularity.x-v.x)*v.zoom+v.width/2, hy = (singularity.y-v.y)*v.zoom+v.height/2
      matter.draw(ctx,v,(x,y) => {
        const u = Math.floor(((x-hx)/(discWidth*v.zoom)+.496)*192)
        const w = Math.floor(((y-hy)/(discWidth*v.zoom)*1.5+.518)*128)
        if (!alpha || u<0 || u>=192 || w<0 || w>=128) return 0
        return alpha[(w*192+u)*4+3]/255
      })
      if (!motion.matches) frame = requestAnimationFrame(t => draw(t))
    }
    function wake() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(t => draw(t,true))
    }
    launch.current = (point,charge) => {
      const rock = matter.release(point,charge)
      if (motion.matches) matter.stillOrbit(rock)
      wake()
    }
    repaint.current = wake
    function useRenderer() {
      if (!sky || !disk || disposed) return
      pass = makeLightPass(gpu,sky,disk)
      gpu.hidden = !pass
      lastView = undefined; wake()
    }
    function lost(event: Event) {
      event.preventDefault()
      pass?.dispose(); pass = null; gpu.hidden = true; lastView = undefined; wake()
    }
    gpu.hidden = true
    void Promise.all([loadImage(lightSources.sky),loadImage(lightSources.disk)]).then(([s,d]) => {
      if (disposed) return
      sky = s; disk = d
      const mask = document.createElement('canvas')
      mask.width = 192; mask.height = 128
      const m = mask.getContext('2d')!
      m.drawImage(d,0,0,192,128); alpha = m.getImageData(0,0,192,128).data
      useRenderer()
    }).catch(() => { if (!disposed) wake() })
    function visibility() { previous = 0; wake() }
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility() })
    observer.observe(canvas)
    motion.addEventListener('change',visibility)
    document.addEventListener('visibilitychange',visibility)
    gpu.addEventListener('webglcontextlost',lost)
    gpu.addEventListener('webglcontextrestored',useRenderer)
    wake()
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect()
      motion.removeEventListener('change',visibility)
      document.removeEventListener('visibilitychange',visibility)
      gpu.removeEventListener('webglcontextlost',lost)
      gpu.removeEventListener('webglcontextrestored',useRenderer)
      pass?.dispose(); launch.current = () => {}; repaint.current = () => {}
    }
  }, [onObservation])
  return <div className="deep-space" aria-hidden="true">
    <canvas ref={light} className="deep-space-light" /><canvas ref={foreground} className="deep-space-matter" />
  </div>
}
