export const scenePalettes = {
  home: { ice: '#7ff6d7', flare: '#8b88ff', phase: .5, incline: -.2 },
  map: { ice: '#7fd8ff', flare: '#7880fa', phase: 2.8, incline: .25 },
  academy: { ice: '#a7caff', flare: '#9d85ff', phase: 1.4, incline: -.35 },
  library: { ice: '#ffd18d', flare: '#de7994', phase: 3.7, incline: .16 },
  lab: { ice: '#9effc6', flare: '#5dceee', phase: 4.9, incline: -.29 },
  universe: { ice: '#eeb8ff', flare: '#7f87f8', phase: 2.1, incline: -.18 },
  lesson: { ice: '#95d9eb', flare: '#759cf0', phase: 1.9, incline: .2 },
}
export type SkyName = keyof typeof scenePalettes
type PaintCanvas = HTMLCanvasElement & { requestPaint?: () => void }
type PaintContext = CanvasRenderingContext2D & { drawElementImage?: (element: Element, x: number, y: number) => void }

const tau = Math.PI * 2
function sample(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

// This is the CSS-painted HTML source. Its gradients and fine rays are
// rasterized once, then projected into folds without reading DOM each frame.
async function snapshotPlate(canvas: PaintCanvas, element: HTMLElement, signal: AbortSignal) {
  const context = canvas.getContext('2d') as PaintContext | null
  if (context?.drawElementImage && canvas.requestPaint) {
    const painted = await new Promise<boolean>((resolve) => {
      const complete = (result: boolean) => {
        clearTimeout(deadline)
        canvas.removeEventListener('paint', paint)
        signal.removeEventListener('abort', abort)
        resolve(result)
      }
      function paint() {
        try { context!.drawElementImage!(element, 0, 0); complete(true) } catch { /* Wait for the browser's first drawable record. */ }
      }
      const abort = () => complete(false)
      const deadline = window.setTimeout(abort, 500)
      canvas.addEventListener('paint', paint)
      signal.addEventListener('abort', abort, { once: true })
      canvas.requestPaint?.()
    })
    if (painted) return { source: canvas, mode: 'native' }
  }
  signal.throwIfAborted()
  // This artwork contains only inline styles and local HTML, so a scoped
  // foreignObject snapshot needs no global API patches or stylesheet fetches.
  const html = new XMLSerializer().serializeToString(element)
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`
  const image = new Image()
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)
  await image.decode()
  signal.throwIfAborted()
  return { source: image, mode: 'compatible' }
}

export function mountAtmosphere(field: HTMLElement, sky: SkyName) {
  const view = field.querySelector<HTMLCanvasElement>('.atmosphere-view')!
  const plate = field.querySelector<PaintCanvas>('.atmosphere-plate')!
  const context = view.getContext('2d', { alpha: true })
  if (!context) return
  const ctx = context
  const controller = new AbortController()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const compact = matchMedia('(max-width: 680px), (pointer: coarse)')
  const palette = scenePalettes[sky]
  const stars = Array.from({ length: 120 }, (_, i) => ({
    x: sample(i + palette.phase), y: sample(120 + i), depth: .2 + .8 * sample(240 + i),
  }))
  let texture: CanvasImageSource | undefined
  let loading = false
  let visible = false
  let width = 1, height = 1, ratio = 1
  let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0
  let frame = 0, timer = 0, elapsed = 0, lastTime = 0, awakeUntil = 0

  function ribbon(layer: number) {
    if (!texture) return
    const segments = compact.matches ? 78 : 156
    const phase = palette.phase + layer * 1.57 + elapsed * .065
    function edgeAt(x: number) {
      const fold = Math.sin(x * 7.45 + phase + .65 * Math.sin(x * 9.2 - phase))
      const ripple = Math.sin(x * 17 - phase * .7) * .026
      return height * (.43 + layer * .19 + palette.incline * (x - .5) + fold * (.14 + .027 * layer) + ripple)
    }
    ctx.globalCompositeOperation = 'screen'
    let edge = edgeAt(0)
    for (let i = 0; i < segments; i++) {
      const x = i / segments
      const nextEdge = edgeAt((i + 1) / segments)
      const depth = .55 + .45 * Math.cos(x * 8.1 + phase)
      const curtain = height * (.18 + depth * .37 + layer * .025)
      const shift = (1.2 + layer) * driftX
      const left = Math.round((x * width + shift) * ratio)
      const right = Math.round(((i + 1) * width / segments + shift) * ratio)
      const step = (right - left) / ratio
      if (step <= 0) { edge = nextEdge; continue }
      ctx.setTransform(ratio, (nextEdge - edge) / step * ratio, 0, ratio, left, (edge + driftY) * ratio)
      ctx.globalAlpha = (.19 + depth * .45) * (layer === 0 ? .74 : 1)
      ctx.drawImage(texture, x * plate.width, 0, plate.width / segments, plate.height,
        0, -curtain * .86, step, curtain)
      edge = nextEdge
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  function orbit(index: number) {
    const cx = width * (.69 + palette.incline * .15) + driftX
    const cy = height * (.56 + .16 * Math.cos(palette.phase)) + driftY
    const rx = width * (.19 + index * .08)
    const ry = Math.max(7, height * (.1 + index * .047))
    const angle = palette.incline * 1.3 - .12
    ctx.strokeStyle = palette.ice + (index === 1 ? '49' : '24')
    ctx.lineWidth = .8
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, angle, .07, tau - .26)
    ctx.stroke()
    const t = palette.phase + index * 2.12 + elapsed * .085
    const x = rx * Math.cos(t), y = ry * Math.sin(t)
    const px = cx + x * Math.cos(angle) - y * Math.sin(angle)
    const py = cy + x * Math.sin(angle) + y * Math.cos(angle)
    const halo = ctx.createRadialGradient(px, py, 0, px, py, 5)
    halo.addColorStop(0, '#f0ffff')
    halo.addColorStop(.28, palette.ice + 'ae')
    halo.addColorStop(1, palette.ice + '00')
    ctx.fillStyle = halo
    ctx.fillRect(px - 5, py - 5, 10, 10)
  }

  function draw() {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    for (const star of stars) {
      const radius = .33 + star.depth * .8
      ctx.globalAlpha = .21 + star.depth * .58
      ctx.fillStyle = star.depth > .8 ? '#efffff' : palette.ice
      ctx.beginPath()
      ctx.arc(width * star.x + driftX * star.depth, height * star.y + driftY * star.depth, radius, 0, tau)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ribbon(0)
    ribbon(1)
    for (let i = 0; i < 3; i++) orbit(i)
  }

  function stop() {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    frame = timer = lastTime = 0
  }
  function tick(time: number) {
    frame = 0
    if (!visible || document.hidden || controller.signal.aborted) return
    const moving = !reduced.matches && !compact.matches
    if (moving && lastTime) elapsed += Math.min(.09, (time - lastTime) / 1000)
    lastTime = time
    driftX += (pointerX - driftX) * .22
    driftY += (pointerY - driftY) * .22
    draw()
    if (moving && time < awakeUntil) {
      timer = window.setTimeout(() => { timer = 0; frame = requestAnimationFrame(tick) }, 42)
    }
  }

  function wake(duration = 0) {
    if (!visible || document.hidden || controller.signal.aborted || !texture) return
    awakeUntil = Math.max(awakeUntil, performance.now() + duration)
    if (!frame && !timer) { lastTime = 0; frame = requestAnimationFrame(tick) }
  }

  async function prepare() {
    if (loading || texture || controller.signal.aborted) return
    loading = true
    try {
      const result = await snapshotPlate(plate, plate.firstElementChild as HTMLElement, controller.signal)
      if (controller.signal.aborted) return
      texture = result.source
      field.dataset.renderer = result.mode
      wake(4800)
    } catch { /* The CSS field remains visible without a drawable texture. */ }
    finally { loading = false }
  }
  function resize() {
    width = Math.max(1, field.clientWidth)
    height = Math.max(1, field.clientHeight)
    ratio = Math.min(compact.matches ? 1 : 1.25, devicePixelRatio, 1600 / width)
    view.width = Math.round(width * ratio)
    view.height = Math.round(height * ratio)
    wake()
  }
  function visibility() {
    if (!visible || document.hidden) { stop(); return }
    void prepare()
    wake(2500)
  }
  function motion() { stop(); pointerX = pointerY = driftX = driftY = 0; resize(); wake() }
  function pointer(event: PointerEvent) {
    if (!visible || reduced.matches || compact.matches || document.hidden) return
    pointerX = (event.clientX / innerWidth - .5) * 10
    pointerY = (event.clientY / innerHeight - .5) * 6
    wake(650)
  }

  const resizer = new ResizeObserver(resize)
  resizer.observe(field)
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    visibility()
  })
  visibilityObserver.observe(field)
  reduced.addEventListener('change', motion)
  compact.addEventListener('change', motion)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pointermove', pointer, { passive: true })
  return () => {
    controller.abort()
    stop()
    resizer.disconnect()
    visibilityObserver.disconnect()
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pointermove', pointer)
    reduced.removeEventListener('change', motion)
    compact.removeEventListener('change', motion)
    delete field.dataset.renderer
  }
}
