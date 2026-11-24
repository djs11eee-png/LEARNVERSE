import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type DrawableCanvas = HTMLCanvasElement & { requestPaint(): void }
type DrawableContext = CanvasRenderingContext2D & {
  drawElementImage(element: Element, x: number, y: number, width: number, height: number): void
}

function supportsDrawableCanvas() {
  return typeof HTMLCanvasElement !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined' &&
    'content' in HTMLCanvasElement.prototype && 'requestPaint' in HTMLCanvasElement.prototype &&
    'drawElementImage' in CanvasRenderingContext2D.prototype
}

/** The same DOM tree supplies layout, focus and links in both renderers. */
export default function StarMapSurface({ width, height, children }: {
  width: number
  height: number
  children: ReactNode
}) {
  const canvasRef = useRef<DrawableCanvas>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const [native, setNative] = useState(supportsDrawableCanvas)
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const scene = sceneRef.current
    if (!native || !canvas || !scene) return
    const context = canvas.getContext('2d') as DrawableContext | null
    if (!context) {
      setNative(false)
      return
    }
    function paint() {
      if (!canvas || !scene || !context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      try {
        context.drawElementImage(scene, 0, 0, canvas.width, canvas.height)
      } catch {
        setNative(false)
      }
    }
    function resize() {
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.requestPaint()
    }
    canvas.addEventListener('paint', paint)
    canvas.addEventListener('contextlost', onLost)
    function onLost() { setNative(false) }
    window.addEventListener('resize', resize)
    resize()
    return () => {
      canvas.removeEventListener('paint', paint)
      canvas.removeEventListener('contextlost', onLost)
      window.removeEventListener('resize', resize)
    }
  }, [native, width, height])

  const scene = <div className="psm-scene" ref={sceneRef} {...(native ? { drawable: '' } : {})}
    style={{ width, height }}>{children}</div>
  return native
    ? <canvas className="psm-canvas" ref={canvasRef} {...{ content: 'drawable' }} style={{ width, height }}>{scene}</canvas>
    : scene
}
