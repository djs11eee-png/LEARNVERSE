import { useEffect, useRef, useState } from 'react'
import type { PetAnimationState, PetMood } from './contracts'
import { VESPER_AVATAR_URL, VESPER_CLIPS, VESPER_HEIGHT, VESPER_WIDTH, moodToAnimationState, vesperPool } from './vesperAssets'

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
}
`

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUv;

uniform sampler2D uPrevTex;
uniform sampler2D uCurrTex;
uniform float uPrevStacked;
uniform float uCurrStacked;
uniform float uMix;
uniform vec2 uPrevShift;
uniform vec2 uCurrShift;
uniform float uPrevScale;
uniform float uCurrScale;
uniform float uShimmer;

vec4 sampleSource(sampler2D tex, float isStacked, vec2 uv, vec2 shift, float scale) {
  vec2 centered = (uv - vec2(0.5)) / scale + vec2(0.5) + shift;
  if (centered.x < 0.0 || centered.x > 1.0 || centered.y < 0.0 || centered.y > 1.0) {
    return vec4(0.0);
  }
  if (isStacked > 0.5) {
    float cy = clamp(centered.y, 0.0025, 0.9975);
    vec3 rgb = texture2D(tex, vec2(centered.x, cy * 0.5)).rgb;
    float rawA = texture2D(tex, vec2(centered.x, 0.5 + cy * 0.5)).r;
    // Smooth low-alpha noise floor eliminates hard threshold edge blinking on faint compression pixels
    float a = rawA * smoothstep(0.016, 0.058, rawA);
    if (a < 0.004) return vec4(0.0);
    rgb = min(rgb, vec3(a));
    return vec4(rgb, a);
  } else {
    vec4 p = texture2D(tex, centered);
    if (p.a < 0.008) return vec4(0.0);
    return vec4(p.rgb * p.a, p.a);
  }
}

void main() {
  vec4 prevCol = sampleSource(uPrevTex, uPrevStacked, vUv, uPrevShift, uPrevScale);
  vec4 currCol = sampleSource(uCurrTex, uCurrStacked, vUv, uCurrShift, uCurrScale);
  vec4 blended = mix(prevCol, currCol, uMix);

  if (uShimmer > 0.001 && blended.a > 0.04) {
    vec3 veil = vec3(0.76, 0.86, 1.0) * (uShimmer * 0.12 * blended.a);
    blended.rgb = min(blended.rgb + veil, vec3(blended.a));
  }

  gl_FragColor = blended;
}
`

const TRANSITION_MS = 420

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function isSeatedPose(state: PetAnimationState): boolean {
  return state === 'thinking' || state === 'success'
}

interface TexSlotCache {
  state: PetAnimationState | null
  kind: 'none' | 'poster' | 'video'
  lastFrameToken: number
}

interface GlState {
  gl: WebGLRenderingContext
  program: WebGLProgram
  prevTex: WebGLTexture
  currTex: WebGLTexture
  loc: {
    uPrevTex: WebGLUniformLocation | null
    uCurrTex: WebGLUniformLocation | null
    uPrevStacked: WebGLUniformLocation | null
    uCurrStacked: WebGLUniformLocation | null
    uMix: WebGLUniformLocation | null
    uPrevShift: WebGLUniformLocation | null
    uCurrShift: WebGLUniformLocation | null
    uPrevScale: WebGLUniformLocation | null
    uCurrScale: WebGLUniformLocation | null
    uShimmer: WebGLUniformLocation | null
  }
}

function initWebGL(canvas: HTMLCanvasElement): GlState | null {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    // Keep the last rendered frame intact across compositor swaps and main-thread pauses so blank frames can never flash!
    preserveDrawingBuffer: true,
  })
  if (!gl) return null

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vs || !fs) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const makeTex = () => {
    const tex = gl.createTexture()
    if (!tex) return null
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    return tex
  }

  const prevTex = makeTex()
  const currTex = makeTex()
  if (!prevTex || !currTex) return null

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.disable(gl.BLEND)
  gl.clearColor(0, 0, 0, 0)

  return {
    gl,
    program,
    prevTex,
    currTex,
    loc: {
      uPrevTex: gl.getUniformLocation(program, 'uPrevTex'),
      uCurrTex: gl.getUniformLocation(program, 'uCurrTex'),
      uPrevStacked: gl.getUniformLocation(program, 'uPrevStacked'),
      uCurrStacked: gl.getUniformLocation(program, 'uCurrStacked'),
      uMix: gl.getUniformLocation(program, 'uMix'),
      uPrevShift: gl.getUniformLocation(program, 'uPrevShift'),
      uCurrShift: gl.getUniformLocation(program, 'uCurrShift'),
      uPrevScale: gl.getUniformLocation(program, 'uPrevScale'),
      uCurrScale: gl.getUniformLocation(program, 'uCurrScale'),
      uShimmer: gl.getUniformLocation(program, 'uShimmer'),
    },
  }
}

export interface VesperStageProps {
  mood: PetMood
  active?: boolean
  className?: string
}

export function VesperStage({ mood, active = true, className }: VesperStageProps) {
  const animState = moodToAnimationState(mood)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const underlayRef = useRef<HTMLImageElement>(null)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [fallbackPoster, setFallbackPoster] = useState(false)

  const transitionRef = useRef<{
    prev: PetAnimationState
    curr: PetAnimationState
    startAt: number
    poseChanged: boolean
  }>({
    prev: animState,
    curr: animState,
    startAt: 0,
    poseChanged: false,
  })

  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const cur = transitionRef.current
    if (cur.curr !== animState) {
      transitionRef.current = {
        prev: cur.curr,
        curr: animState,
        startAt: performance.now(),
        poseChanged: isSeatedPose(cur.curr) !== isSeatedPose(animState),
      }
    }
  }, [animState])

  // Keep WebGL context persistent across `active` toggles (opening/closing drawer never tears down textures or flashes poster!)
  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    vesperPool.ensureInitialized()

    const ctx = initWebGL(canvas)
    if (!ctx) {
      setFallbackPoster(true)
      return
    }
    setFallbackPoster(false)

    const { gl, program, prevTex, currTex, loc } = ctx
    let rafId = 0
    let disposed = false
    let pageHidden = document.hidden
    let hidUnderlay = false
    let hasPaintedOnce = false

    // Persistent GPU texture slot caches:
    // Upload ONLY when requestVideoFrameCallback increments `presentedFrame` (true 24fps decoded frames, zero mid-seek tears!)
    const prevCache: TexSlotCache = { state: null, kind: 'none', lastFrameToken: -1 }
    const currCache: TexSlotCache = { state: null, kind: 'none', lastFrameToken: -1 }

    const syncTexture = (
      state: PetAnimationState,
      texture: WebGLTexture,
      unit: number,
      cache: TexSlotCache,
    ): { stacked: number; ready: boolean; dirty: boolean } => {
      const entry = vesperPool.getEntry(state)
      gl.activeTexture(unit)
      gl.bindTexture(gl.TEXTURE_2D, texture)

      const stateChanged = cache.state !== state
      if (stateChanged) {
        cache.state = state
        cache.kind = 'none'
        cache.lastFrameToken = -1
      }
      if (!entry) {
        return { stacked: cache.kind === 'video' ? 1 : 0, ready: cache.kind !== 'none', dirty: false }
      }

      const v = entry.video
      // Upload fresh decoded video frame ONLY when not mid-seek and a new video frame has actually been presented
      if (entry.videoReady && !v.seeking && v.readyState >= 2 && v.videoWidth > 0) {
        const frameToken = entry.hasRvfc ? entry.presentedFrame : Math.floor(v.currentTime * 24)
        if (cache.kind !== 'video' || frameToken !== cache.lastFrameToken) {
          try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v)
            cache.kind = 'video'
            cache.lastFrameToken = frameToken
            return { stacked: 1, ready: true, dirty: true }
          } catch {
            // Keep previously uploaded GPU texture intact (never flash!)
          }
        }
        if (cache.kind === 'video') {
          return { stacked: 1, ready: true, dirty: stateChanged }
        }
      }

      // Hold the last valid uploaded video texture across brief loop-wrap seeks!
      if (cache.kind === 'video') {
        return { stacked: 1, ready: true, dirty: false }
      }

      // First-paint fallback before video decodes its very first frame: upload transparent WebP poster once.
      // Never upload poster mid-seek when videoReady is already true (wait 1 tick for seek to land so frame never snaps!).
      if (cache.kind === 'none' && !entry.videoReady && entry.posterReady && entry.poster.naturalWidth > 0) {
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.poster)
          cache.kind = 'poster'
          return { stacked: 0, ready: true, dirty: true }
        } catch {
          return { stacked: 0, ready: false, dirty: false }
        }
      }

      return { stacked: 0, ready: cache.kind === 'poster', dirty: false }
    }

    const renderFrame = (now: number) => {
      if (disposed) return
      if (!pageHidden && activeRef.current) {
        const tr = transitionRef.current
        const rawT = tr.startAt > 0 ? Math.min(1, (now - tr.startAt) / TRANSITION_MS) : 1
        const inTransition = rawT < 1
        const mixT = easeInOutCubic(rawT)

        let prevShiftY = 0
        let currShiftY = 0
        let prevScale = 1
        let currScale = 1
        let shimmer = 0

        if (tr.poseChanged && inTransition) {
          const toSeated = isSeatedPose(tr.curr)
          const dir = toSeated ? 1 : -1
          prevShiftY = dir * 0.026 * mixT
          currShiftY = -dir * 0.03 * (1 - mixT)
          prevScale = 1 + (toSeated ? -0.022 : 0.018) * mixT
          currScale = 1 + (toSeated ? 0.022 : -0.018) * (1 - mixT)
          shimmer = Math.sin(rawT * Math.PI)
        }

        const currUp = syncTexture(tr.curr, currTex, gl.TEXTURE1, currCache)
        const prevUp = inTransition
          ? syncTexture(tr.prev, prevTex, gl.TEXTURE0, prevCache)
          : { stacked: currUp.stacked, ready: currUp.ready, dirty: false }

        // If target video is still mid-seek on a state change, keep displaying previous texture cleanly instead of flashing blank/poster
        const effectiveMix = !currUp.ready && prevUp.ready ? 0 : (inTransition ? mixT : 1)
        const shouldDraw = (currUp.ready || prevUp.ready) && (!hasPaintedOnce || inTransition || currUp.dirty || prevUp.dirty)
        if (shouldDraw) {
          gl.viewport(0, 0, canvas.width, canvas.height)
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.useProgram(program)
          gl.uniform1i(loc.uPrevTex, (inTransition || !currUp.ready) ? 0 : 1)
          gl.uniform1i(loc.uCurrTex, currUp.ready ? 1 : 0)
          gl.uniform1f(loc.uPrevStacked, prevUp.stacked)
          gl.uniform1f(loc.uCurrStacked, currUp.ready ? currUp.stacked : prevUp.stacked)
          gl.uniform1f(loc.uMix, effectiveMix)
          gl.uniform2f(loc.uPrevShift, 0, prevShiftY)
          gl.uniform2f(loc.uCurrShift, 0, currShiftY)
          gl.uniform1f(loc.uPrevScale, prevScale)
          gl.uniform1f(loc.uCurrScale, currScale)
          gl.uniform1f(loc.uShimmer, shimmer)

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          hasPaintedOnce = true

          if (!hidUnderlay && underlayRef.current) {
            underlayRef.current.style.display = 'none'
            hidUnderlay = true
          }
        }
      }
      rafId = window.requestAnimationFrame(renderFrame)
    }

    const onVisibility = () => {
      pageHidden = document.hidden
    }
    document.addEventListener('visibilitychange', onVisibility)
    rafId = window.requestAnimationFrame(renderFrame)

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteTexture(prevTex)
      gl.deleteTexture(currTex)
      gl.deleteProgram(program)
    }
  }, [reducedMotion])

  const posterSrc = VESPER_CLIPS[animState].poster

  return (
    <div
      className={className ? `lvo-vesper-stage ${className}` : 'lvo-vesper-stage'}
      data-state={animState}
      data-mood={mood}
      aria-hidden="true"
    >
      {reducedMotion || fallbackPoster ? (
        <img
          className="lvo-vesper-poster"
          src={posterSrc}
          alt=""
          width={VESPER_WIDTH}
          height={VESPER_HEIGHT}
          draggable={false}
        />
      ) : (
        <>
          <img
            ref={underlayRef}
            className="lvo-vesper-poster lvo-vesper-underlay"
            src={posterSrc}
            alt=""
            width={VESPER_WIDTH}
            height={VESPER_HEIGHT}
            draggable={false}
          />
          <canvas
            ref={canvasRef}
            className="lvo-vesper-canvas"
            width={VESPER_WIDTH}
            height={VESPER_HEIGHT}
          />
        </>
      )}
    </div>
  )
}

export function VesperAvatar({ mood = 'idle', className }: { mood?: PetMood; className?: string }) {
  return (
    <span className={className ? `lvo-vesper-avatar ${className}` : 'lvo-vesper-avatar'} data-mood={mood} aria-hidden="true">
      <img src={VESPER_AVATAR_URL} alt="" width={256} height={256} draggable={false} />
    </span>
  )
}
