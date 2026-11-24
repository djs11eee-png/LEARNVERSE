import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export type StarPoint = { x: number; y: number }
type Camera = StarPoint & { zoom: number }
type Size = { width: number; height: number }
type CameraOptions = Size & { home: StarPoint; homeZoom?: number }
type Finger = { start: StarPoint; current: StarPoint }
const maxZoom = 1.8
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const padding = (length: number) => Math.min(64, length * .15)

function fitZoom(world: Size, view: Size) {
  if (!view.width || !view.height) return .01
  return Math.min(maxZoom,
    (view.width - 2 * padding(view.width)) / Math.max(1, world.width),
    (view.height - 2 * padding(view.height)) / Math.max(1, world.height))
}

function constrain(next: Camera, world: Size, view: Size): Camera {
  const zoom = clamp(next.zoom, fitZoom(world, view), maxZoom)
  function limit(center: number, length: number, viewport: number) {
    const edge = Math.min(length / 2, (viewport / 2 - padding(viewport)) / zoom)
    return clamp(center, edge, length - edge)
  }
  return { x: limit(next.x, world.width, view.width), y: limit(next.y, world.height, view.height), zoom }
}

function middle(a: StarPoint, b: StarPoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Camera coordinates describe the world point at the middle of the viewport. */
export function useStarCamera({ width, height, home, homeZoom = 1 }: CameraOptions) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const initial = { ...home, zoom: homeZoom }
  const [camera, setCamera] = useState<Camera>(initial)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [dragging, setDragging] = useState(false)
  const current = useRef(initial)
  const view = useRef(size)
  const config = useRef({ width, height, home, homeZoom })
  const frame = useRef<number | null>(null)

  const move = useCallback((next: Camera) => {
    const result = constrain(next, config.current, view.current)
    if (result.x === current.current.x && result.y === current.current.y && result.zoom === current.current.zoom) return
    current.current = result
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      setCamera(current.current)
    })
  }, [])

  // The world point under "from" before a pinch must end up under "to".
  const transform = useCallback((from: StarPoint, to: StarPoint, factor: number) => {
    const old = current.current
    const zoom = clamp(old.zoom * factor, fitZoom(config.current, view.current), maxZoom)
    const halfX = view.current.width / 2, halfY = view.current.height / 2
    move({
      x: old.x + (from.x - halfX) / old.zoom - (to.x - halfX) / zoom,
      y: old.y + (from.y - halfY) / old.zoom - (to.y - halfY) / zoom,
      zoom,
    })
  }, [move])

  const zoomBy = useCallback((factor: number) => {
    if (Number.isFinite(factor) && factor > 0) move({ ...current.current, zoom: current.current.zoom * factor })
  }, [move])
  const panTo = useCallback((point: StarPoint, zoom = current.current.zoom) => move({ ...point, zoom }), [move])
  const reset = useCallback(() => panTo(config.current.home, config.current.homeZoom), [panTo])
  const fitAll = useCallback(() => {
    const world = config.current
    panTo({ x: world.width / 2, y: world.height / 2 }, fitZoom(world, view.current))
  }, [panTo])

  useLayoutEffect(() => {
    config.current = { width, height, home: { x: home.x, y: home.y }, homeZoom }
    if (view.current.width) move(current.current)
  }, [width, height, home.x, home.y, homeZoom, move])

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const fingers = new Map<number, Finger>()
    let active = false
    let suppressClickUntil = 0
    const oldTouchAction = element.style.touchAction
    const oldUserSelect = element.style.userSelect
    element.style.touchAction = 'none'
    element.style.userSelect = 'none'

    function measure() {
      if (!element) return
      const previous = view.current
      const size = { width: element.clientWidth, height: element.clientHeight }
      if (!size.width || !size.height) return
      const refit = previous.width > 0 && Math.abs(current.current.zoom - fitZoom(config.current, previous)) < .00001
      view.current = size
      const next = refit ? { x: config.current.width / 2, y: config.current.height / 2, zoom: fitZoom(config.current, size) } : current.current
      current.current = constrain(next, config.current, size)
      setCamera(current.current)
      setSize(size)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    function local(event: PointerEvent | WheelEvent): StarPoint {
      const rect = element!.getBoundingClientRect()
      return { x: event.clientX - rect.left - element!.clientLeft, y: event.clientY - rect.top - element!.clientTop }
    }
    function isControl(target: EventTarget | null) {
      return target instanceof Element && Boolean(target.closest('[data-camera-control],input,select,textarea,[contenteditable="true"]'))
    }
    function begin(event: PointerEvent) {
      if (event.button !== 0 || isControl(event.target)) return
      if (!fingers.size) suppressClickUntil = 0
      const point = local(event)
      fingers.set(event.pointerId, { start: point, current: point })
      if (fingers.size === 2) {
        for (const finger of fingers.values()) finger.start = finger.current
        suppressClickUntil = Infinity
      }
    }
    function motion(event: PointerEvent) {
      const finger = fingers.get(event.pointerId)
      if (!finger) return
      const previous = finger.current
      finger.current = local(event)
      const pair = [...fingers.values()].slice(0, 2)
      if (!pair.includes(finger)) return
      const firstMove = !active
      if (firstMove) {
        const threshold = event.pointerType === 'touch' ? 7 : 4
        if (Math.hypot(finger.current.x - finger.start.x, finger.current.y - finger.start.y) < threshold) return
        active = true
        setDragging(true)
      }
      // Native links retain their original target for every ordinary tap.
      // Capture starts only after the movement threshold has been crossed.
      for (const id of fingers.keys()) {
        if (!element!.hasPointerCapture(id)) element!.setPointerCapture(id)
      }
      event.preventDefault()
      const before = pair.map(point => firstMove ? point.start : point === finger ? previous : point.current)
      if (pair.length === 1) {
        transform(before[0], finger.current, 1)
      } else {
        const [a, b] = pair.map(point => point.current)
        const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y)
        const newDistance = Math.hypot(a.x - b.x, a.y - b.y)
        transform(middle(before[0], before[1]), middle(a, b), oldDistance > 1 && newDistance > 1 ? newDistance / oldDistance : 1)
      }
    }
    function end(event: PointerEvent) {
      if (!fingers.delete(event.pointerId)) return
      if (fingers.size) {
        for (const finger of fingers.values()) finger.start = finger.current
        return
      }
      if (active || suppressClickUntil === Infinity) suppressClickUntil = performance.now() + 600
      active = false
      setDragging(false)
    }
    function cancel() {
      for (const id of fingers.keys()) {
        if (element!.hasPointerCapture(id)) element!.releasePointerCapture(id)
      }
      fingers.clear()
      if (active || suppressClickUntil === Infinity) suppressClickUntil = performance.now() + 600
      active = false
      setDragging(false)
    }
    function click(event: MouseEvent) {
      if (event.detail === 0 || performance.now() > suppressClickUntil) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    function dragStart(event: DragEvent) {
      if (fingers.size) event.preventDefault()
    }
    function wheel(event: WheelEvent) {
      if (isControl(event.target) || !event.deltaY) return
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.current.height : 1
      const amount = clamp(event.deltaY * unit, -260, 260)
      const point = local(event)
      transform(point, point, Math.exp(-amount * .0025))
    }
    function key(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || isControl(event.target)) return
      const { x, y, zoom } = current.current
      const step = (event.shiftKey ? 180 : 72) / zoom
      switch (event.key) {
        case 'ArrowLeft': panTo({ x: x - step, y }); break
        case 'ArrowRight': panTo({ x: x + step, y }); break
        case 'ArrowUp': panTo({ x, y: y - step }); break
        case 'ArrowDown': panTo({ x, y: y + step }); break
        case '+': case '=': zoomBy(1.2); break
        case '-': case '−': zoomBy(1 / 1.2); break
        case 'Home': reset(); break
        default: return
      }
      event.preventDefault()
    }
    element.addEventListener('pointerdown', begin, true)
    window.addEventListener('pointermove', motion, { capture: true, passive: false })
    window.addEventListener('pointerup', end, true)
    window.addEventListener('pointercancel', end, true)
    window.addEventListener('blur', cancel)
    element.addEventListener('click', click, true)
    element.addEventListener('dragstart', dragStart)
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('keydown', key)
    return () => {
      observer.disconnect()
      for (const id of fingers.keys()) {
        if (element.hasPointerCapture(id)) element.releasePointerCapture(id)
      }
      element.style.touchAction = oldTouchAction
      element.style.userSelect = oldUserSelect
      element.removeEventListener('pointerdown', begin, true)
      window.removeEventListener('pointermove', motion, true)
      window.removeEventListener('pointerup', end, true)
      window.removeEventListener('pointercancel', end, true)
      window.removeEventListener('blur', cancel)
      element.removeEventListener('click', click, true)
      element.removeEventListener('dragstart', dragStart)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('keydown', key)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [panTo, reset, transform, zoomBy])

  return { viewportRef, camera, size, zoomBy, panTo, reset, fitAll, dragging }
}

export default useStarCamera
