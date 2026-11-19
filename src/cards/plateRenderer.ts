type NativeMode = 'modern' | 'legacy' | null
type PaintCanvas = HTMLCanvasElement & { requestPaint?: () => void }
type TextureContext = WebGL2RenderingContext & {
  texElementSubImage2D?: (target: number, level: number, x: number, y: number, source: HTMLElement, size: { width: number; height: number }) => void
  texElementImage2D?: (...args: (number | HTMLElement)[]) => void
}

let activeRasterizers = 0

export function nativePlateTextures(): NativeMode {
  if (typeof WebGL2RenderingContext === 'undefined' || !('requestPaint' in HTMLCanvasElement.prototype)) return null
  if ('texElementSubImage2D' in WebGL2RenderingContext.prototype) return 'modern'
  return 'texElementImage2D' in WebGL2RenderingContext.prototype ? 'legacy' : null
}

// The print is a real local HTML plate. Bright engraved strokes diffract the
// travelling light, while the dark ground keeps its ink density.
const vertex = `#version 300 es
out vec2 uv;
void main() {
  vec2 point = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv = vec2(point.x, 1.0 - point.y);
  gl_Position = vec4(point * 2.0 - 1.0, 0.0, 1.0);
}`
const fragment = `#version 300 es
precision highp float;
uniform sampler2D plate;
uniform vec3 lamp;
uniform float gold;
in vec2 uv;
out vec4 color;
void main() {
  vec3 ink = texture(plate, uv).rgb;
  float ridge = dot(ink, vec3(.24,.62,.14));
  vec2 pos = uv - lamp.xy;
  float angle = pos.x + .42 * pos.y;
  float reflection = exp(-17.0 * angle * angle);
  vec3 spectrum = .51 + .49 * cos(6.283 * (angle * 1.35 + vec3(.04,.34,.68)));
  spectrum = mix(spectrum, vec3(1.0,.73,.29),gold);
  float engraved = smoothstep(.12,.88,ridge);
  float groove = .82 + .18 * cos((uv.x * .83 + uv.y * .51) * 530.0);
  color = vec4(ink + groove * reflection * engraved * (.16 + .44 * lamp.z) * spectrum, 1.0);
}`

function foilProgram(gl: TextureContext) {
  const program = gl.createProgram()
  if (!program) return null
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type)
    if (!shader) { gl.deleteProgram(program); return null }
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program
  gl.deleteProgram(program)
  return null
}

export function mountPlateRenderer(surface: HTMLElement, native: NativeMode) {
  const canvas = surface.querySelector('canvas') as PaintCanvas
  const visiblePaper = surface.firstElementChild as HTMLElement
  const media = matchMedia('(prefers-reduced-motion: reduce), (max-width: 600px) and (pointer: coarse)')
  let stop: (() => void) | undefined

  function start() {
    stop?.()
    stop = undefined
    if (media.matches) return
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false }) as TextureContext | null
    if (!gl || gl.isContextLost()) return
    const program = foilProgram(gl)
    if (!program) return
    const texture = gl.createTexture()
    if (!texture) { gl.deleteProgram(program); return }
    gl.useProgram(program)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1f(gl.getUniformLocation(program, 'gold'), surface.closest('.holo-finish-gold') ? 1 : 0)
    const lamp = gl.getUniformLocation(program, 'lamp')
    const stage = surface.closest('.holo-room')
    let light = { x: .46, y: .36, gain: 0 }
    let alive = true
    let uploaded = false
    let busy = false
    let queued = false
    let allocatedWidth = 0
    let allocatedHeight = 0
    let releaseRaster: (() => void) | undefined

    function draw() {
      if (!uploaded || !alive || !gl) return
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform3f(lamp, light.x, light.y, light.gain)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    function setLight(event: Event) {
      light = (event as CustomEvent<typeof light>).detail
      draw()
    }
    function resize() {
      const ratio = Math.min(devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.round(surface.clientWidth * ratio))
      const height = Math.max(1, Math.round(surface.clientHeight * ratio))
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
    }
    function paintNative() {
      if (!alive || !gl) return
      const paper = canvas.firstElementChild as HTMLElement
      if (!paper || !paper.offsetWidth || !paper.offsetHeight) return
      try {
        resize()
        if (gl.texElementSubImage2D) {
          const { width, height } = canvas
          if (width !== allocatedWidth || height !== allocatedHeight) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
            allocatedWidth = width
            allocatedHeight = height
          }
          gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, paper, { width, height })
        } else if (gl.texElementImage2D?.length === 3) {
          gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, paper)
        } else {
          gl.texElementImage2D!(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paper)
        }
        if (gl.getError() !== gl.NO_ERROR) return
        uploaded = true
        draw()
        surface.dataset.renderer = 'native'
      } catch { /* Some implementations deliver a paint before the first drawable record. */ }
    }
    async function paintCompatible() {
      if (busy) { queued = true; return }
      if (!alive || !gl || !visiblePaper.offsetWidth) return
      busy = true
      try {
        const { getHtmlRenderer } = await import('three-html-render/polyfill')
        if (!alive) return
        // Use the package's scoped rasterizer so other canvases and DOM
        // event handling on the learning page keep their native behaviour.
        const rasterizer = getHtmlRenderer()
        if (!releaseRaster) {
          activeRasterizers++
          releaseRaster = () => { if (--activeRasterizers === 0) rasterizer.cleanup() }
        }
        const snapshot = await rasterizer.update(visiblePaper)
        if (!alive) return
        resize()
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot)
        if (gl.getError() !== gl.NO_ERROR) return
        uploaded = true
        draw()
        surface.dataset.renderer = 'compatible'
      } catch {
        delete surface.dataset.renderer
      } finally {
        busy = false
        if (queued && alive) { queued = false; void paintCompatible() }
      }
    }
    function refresh() {
      if (native) canvas.requestPaint?.()
      else void paintCompatible()
    }
    const resizer = new ResizeObserver(refresh)
    resizer.observe(surface)
    const observer = new MutationObserver(refresh)
    if (!native) observer.observe(visiblePaper, { childList: true, subtree: true, attributes: true, characterData: true })
    if (native) canvas.addEventListener('paint', paintNative)
    stage?.addEventListener('plate-light', setLight)
    refresh()
    stop = () => {
      alive = false
      delete surface.dataset.renderer
      resizer.disconnect()
      observer.disconnect()
      releaseRaster?.()
      stage?.removeEventListener('plate-light', setLight)
      canvas.removeEventListener('paint', paintNative)
      gl.deleteTexture(texture)
      gl.deleteProgram(program)
    }
  }
  function lost(event: Event) {
    event.preventDefault()
    stop?.()
    stop = undefined
  }
  canvas.addEventListener('webglcontextlost', lost)
  canvas.addEventListener('webglcontextrestored', start)
  media.addEventListener('change', start)
  start()
  return () => {
    stop?.()
    media.removeEventListener('change', start)
    canvas.removeEventListener('webglcontextlost', lost)
    canvas.removeEventListener('webglcontextrestored', start)
    // StrictMode can unmount and reattach the same node in a single turn.
    queueMicrotask(() => {
      if (!canvas.isConnected && stop) canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
    })
  }
}
