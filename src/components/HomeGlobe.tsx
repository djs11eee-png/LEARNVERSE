import { useEffect, useRef } from 'react'
import { createGlobeShader } from './homeGlobeShader'

const initialLongitude = 78
const radians = Math.PI / 180
const wrap = (degrees: number) => ((degrees % 360) + 360) % 360

/** Inverse orthographic projection. Geometry and lighting stay fixed during a turn. */
function softwareRenderer(canvas: HTMLCanvasElement, atlas: HTMLImageElement, size: number) {
  const textureCanvas = document.createElement('canvas')
  textureCanvas.width = atlas.naturalWidth
  textureCanvas.height = atlas.naturalHeight
  const textureContext = textureCanvas.getContext('2d', { willReadFrequently: true })
  const context = canvas.getContext('2d')
  if (!textureContext || !context) return
  textureContext.drawImage(atlas, 0, 0)
  const textureWidth = textureCanvas.width
  const textureHeight = textureCanvas.height
  const texture = textureContext.getImageData(0, 0, textureWidth, textureHeight).data
  canvas.width = canvas.height = size
  const frame = context.createImageData(size, size)
  const count = size * size
  const longitude = new Uint16Array(count)
  const row = new Uint32Array(count)
  const light = new Float32Array(count)
  const rim = new Float32Array(count)
  const tiltSin = Math.sin(.15), tiltCos = Math.cos(.15)
  const latSin = Math.sin(24 * radians), latCos = Math.cos(24 * radians)
  for (let i = 0; i < count; i++) {
    const x = ((i % size) + .5) * 2 / size - 1
    const y = (Math.floor(i / size) + .5) * 2 / size - 1
    const radius = Math.hypot(x, y)
    if (radius >= 1) continue
    const z = Math.sqrt(Math.max(0, 1 - radius * radius))
    const ex = x * tiltCos - y * tiltSin
    const ey = -x * tiltSin - y * tiltCos
    const lat = Math.asin(Math.max(-1, Math.min(1, ey * latCos + z * latSin)))
    const lon = Math.atan2(ex, z * latCos - ey * latSin)
    longitude[i] = Math.min(textureWidth - 1, (.5 + lon / (2 * Math.PI)) * textureWidth)
    row[i] = Math.min(textureHeight - 1, Math.floor((.5 - lat / Math.PI) * textureHeight)) * textureWidth
    light[i] = .047 + .97 * Math.max(0, -.79 * x - .47 * y + .35 * z) ** .79
    rim[i] = (1 - z) ** 4.7 * (.10 + .90 * Math.max(0, -.82 * x - .49 * y))
    frame.data[i * 4 + 3] = Math.min(255, ((1 - radius) * size * .5 + .5) * 255)
  }
  return (angle: number) => {
    const shift = Math.round(wrap(angle) * textureWidth / 360)
    for (let i = 0; i < count; i++) {
      if (!light[i]) continue
      const x = longitude[i] + shift
      const src = (row[i] + (x >= textureWidth ? x - textureWidth : x)) * 4
      const offset = i * 4
      frame.data[offset] = texture[src] * light[i] + rim[i] * 121
      frame.data[offset + 1] = texture[src + 1] * light[i] + rim[i] * 177
      frame.data[offset + 2] = texture[src + 2] * light[i] + rim[i] * 207
    }
    context.putImageData(frame, 0, 0)
  }
}

export function HomeGlobe() {
  const host = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const button = element
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let angle = initialLongitude
    let velocity = 0
    let pointer: number | null = null
    let lastX = 0, startX = 0, lastInput = 0
    let dragging = false
    let suppressClick = false
    let frame = 0, lastFrame = 0, paintedAngle = initialLongitude
    let visible = true, disposed = false
    let atlas: HTMLImageElement | undefined
    let view: HTMLCanvasElement | undefined
    let shader: ReturnType<typeof createGlobeShader>
    let draw: ((degrees: number) => void) | undefined

    function paint(time: number) {
      frame = 0
      if (!visible || document.hidden) return
      if (!shader && time - lastFrame < 32 && !motion.matches) { schedule(); return }
      const dt = Math.min(48, time - lastFrame)
      lastFrame = time
      if (pointer === null && velocity) {
        angle = wrap(angle + velocity * dt)
        velocity *= Math.exp(-dt / 300)
        if (Math.abs(velocity) < .003) velocity = 0
      }
      if (draw && paintedAngle !== angle) {
        draw(angle)
        paintedAngle = angle
        if (view) view.style.opacity = '1'
      }
      if (velocity && pointer === null) schedule()
    }
    function schedule() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(paint)
    }
    function releaseSurface() {
      view?.removeEventListener('webglcontextlost', fallback)
      view?.remove()
      shader?.dispose()
      shader = undefined
      draw = undefined
    }
    function fallback() {
      releaseSurface()
      if (!atlas || disposed) return
      view = document.createElement('canvas')
      view.setAttribute('aria-hidden', 'true')
      draw = softwareRenderer(view, atlas, Math.min(240, Math.round(button.clientWidth)))
      if (!draw) return
      button.append(view)
      paintedAngle = NaN
      schedule()
    }
    function prepare() {
      if (atlas) return
      atlas = new Image()
      atlas.onload = () => {
        if (disposed || !atlas) return
        const size = Math.round(Math.min(850, Math.max(180, button.clientWidth * Math.min(devicePixelRatio, 1.5))))
        view = document.createElement('canvas')
        view.setAttribute('aria-hidden', 'true')
        shader = createGlobeShader(view, atlas, size)
        if (!shader) { fallback(); return }
        draw = shader.draw
        view.addEventListener('webglcontextlost', fallback)
        button.append(view)
        schedule()
      }
      atlas.onerror = () => { atlas = undefined }
      atlas.src = '/art/earth-atlas.webp'
    }
    function down(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return
      prepare()
      pointer = event.pointerId
      startX = lastX = event.clientX
      lastInput = event.timeStamp
      dragging = suppressClick = false
      velocity = 0
      button.setPointerCapture(event.pointerId)
    }
    function move(event: PointerEvent) {
      if (event.pointerId !== pointer) return
      if (!dragging && Math.abs(event.clientX - startX) < 3) return
      dragging = true
      button.dataset.dragging = ''
      const delta = (lastX - event.clientX) * 166 / Math.max(1, button.clientWidth)
      const sample = delta / Math.max(8, event.timeStamp - lastInput)
      velocity = motion.matches ? 0 : Math.max(-.55, Math.min(.55, velocity * .3 + sample * .7))
      angle = wrap(angle + delta)
      lastX = event.clientX
      lastInput = event.timeStamp
      schedule()
    }
    function up(event: PointerEvent) {
      if (event.pointerId !== pointer) return
      pointer = null
      suppressClick = dragging
      dragging = false
      delete button.dataset.dragging
      if (event.type !== 'pointerup' || event.timeStamp - lastInput > 80 || motion.matches) velocity = 0
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId)
      schedule()
    }
    function step(degrees: number) {
      prepare()
      velocity = 0
      angle = wrap(angle + degrees)
      schedule()
    }
    function key(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home') {
        event.preventDefault()
        step(event.key === 'Home' ? initialLongitude - angle : event.key === 'ArrowRight' ? 15 : -15)
      }
    }
    function click(event: MouseEvent) {
      if (!suppressClick || event.detail === 0) step(15)
      suppressClick = false
    }
    function stop() {
      velocity = 0
      cancelAnimationFrame(frame)
      frame = 0
      if (visible && !document.hidden && paintedAngle !== angle) schedule()
    }
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; stop() })
    visibility.observe(button)
    button.addEventListener('pointerdown', down)
    button.addEventListener('pointermove', move, { passive: true })
    button.addEventListener('pointerup', up)
    button.addEventListener('pointercancel', up)
    button.addEventListener('lostpointercapture', up)
    button.addEventListener('click', click)
    button.addEventListener('keydown', key)
    motion.addEventListener('change', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      releaseSurface()
      visibility.disconnect()
      motion.removeEventListener('change', stop)
      document.removeEventListener('visibilitychange', stop)
      button.removeEventListener('pointerdown', down)
      button.removeEventListener('pointermove', move)
      button.removeEventListener('pointerup', up)
      button.removeEventListener('pointercancel', up)
      button.removeEventListener('lostpointercapture', up)
      button.removeEventListener('click', click)
      button.removeEventListener('keydown', key)
    }
  }, [])
  return <button type="button" className="earth-globe" ref={host}
    aria-label="旋转地球" aria-describedby="earth-instructions" title="拖动地球旋转，或使用左右方向键">
    <span id="earth-instructions" className="earth-instructions">左右拖动或按方向键旋转地球，按 Home 键复位。</span>
  </button>
}
