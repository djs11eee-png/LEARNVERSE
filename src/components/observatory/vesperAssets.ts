import type { PetAnimationState, PetMood } from './contracts'

export const VESPER_WIDTH = 480
export const VESPER_HEIGHT = 360

export interface VesperClipConfig {
  state: PetAnimationState
  mp4: string
  webm: string
  poster: string
  loop: boolean
  /** Fallback duration in ms (used for reduced-motion / timer safety net) */
  durationMs: number
}

export const VESPER_CLIPS: Record<PetAnimationState, VesperClipConfig> = {
  idle: {
    state: 'idle',
    webm: '/mascot/vesper-idle.webm',
    mp4: '/mascot/vesper-idle.mp4',
    poster: '/mascot/vesper-idle-poster.webp',
    loop: true,
    durationMs: 5170,
  },
  thinking: {
    state: 'thinking',
    webm: '/mascot/vesper-thinking.webm',
    mp4: '/mascot/vesper-thinking.mp4',
    poster: '/mascot/vesper-thinking-poster.webp',
    loop: true,
    durationMs: 5330,
  },
  success: {
    state: 'success',
    webm: '/mascot/vesper-success.webm',
    mp4: '/mascot/vesper-success.mp4',
    poster: '/mascot/vesper-success-poster.webp',
    loop: false,
    durationMs: 5830,
  },
}

export const VESPER_AVATAR_URL = '/mascot/vesper-avatar.webp'

export function moodToAnimationState(mood: PetMood): PetAnimationState {
  if (mood === 'thinking') return 'thinking'
  if (mood === 'success') return 'success'
  return 'idle'
}

export interface VesperVideoEntry {
  state: PetAnimationState
  video: HTMLVideoElement
  poster: HTMLImageElement
  videoRequested: boolean
  videoReady: boolean
  posterReady: boolean
  failed: boolean
  /** Monotonic counter incremented ONLY when the browser presents a newly decoded video frame */
  presentedFrame: number
  /** True when the browser supports requestVideoFrameCallback */
  hasRvfc: boolean
}

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: DOMHighResTimeStamp, meta: { presentedFrames?: number; mediaTime?: number }) => void) => number
}

type Listener = () => void

class VesperMediaPool {
  private entries: Record<PetAnimationState, VesperVideoEntry> | null = null
  private hostEl: HTMLDivElement | null = null
  private listeners = new Set<Listener>()
  private endedListeners = new Set<() => void>()
  private unlockBound = false
  private secondaryScheduled = false

  private isReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private ensureHostElement(): HTMLDivElement | null {
    if (typeof document === 'undefined' || !document.body) return null
    if (this.hostEl && this.hostEl.isConnected) return this.hostEl
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.dataset.vesperMediaPool = '1'
    Object.assign(host.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0px',
      width: '2px',
      height: '2px',
      opacity: '0.001',
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: '-1',
      contain: 'strict',
    })
    document.body.appendChild(host)
    this.hostEl = host
    return host
  }

  private bindFrameCallback(entry: VesperVideoEntry) {
    const vid = entry.video as VideoWithRvfc
    if (typeof vid.requestVideoFrameCallback !== 'function') return
    entry.hasRvfc = true
    const onFrame = () => {
      if (entry.video.readyState >= 2 && entry.video.videoWidth > 0) {
        entry.videoReady = true
        entry.presentedFrame += 1
      }
      vid.requestVideoFrameCallback?.(onFrame)
    }
    vid.requestVideoFrameCallback(onFrame)
  }

  private ensureVideoLoaded(entry: VesperVideoEntry) {
    if (entry.videoRequested) return
    entry.videoRequested = true
    entry.video.preload = 'auto'
    try {
      entry.video.load()
    } catch {
      // Ignore browser preload restrictions
    }
  }

  private scheduleSecondaryWarmup() {
    if (this.secondaryScheduled || typeof window === 'undefined' || this.isReducedMotion()) return
    this.secondaryScheduled = true
    const runIdle = (fn: () => void, delayMs: number) => {
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }
      window.setTimeout(() => {
        if (typeof win.requestIdleCallback === 'function') {
          win.requestIdleCallback(fn, { timeout: 2500 })
        } else {
          fn()
        }
      }, delayMs)
    }

    runIdle(() => {
      if (!this.entries || this.isReducedMotion()) return
      const thinking = this.entries.thinking
      this.ensureVideoLoaded(thinking)
      const warmSuccess = () => {
        runIdle(() => {
          if (!this.entries || this.isReducedMotion()) return
          this.ensureVideoLoaded(this.entries.success)
        }, 800)
      }
      if (thinking.videoReady) {
        warmSuccess()
      } else {
        thinking.video.addEventListener('loadeddata', warmSuccess, { once: true })
        thinking.video.addEventListener('error', warmSuccess, { once: true })
      }
    }, 1800)
  }

  ensureInitialized(): Record<PetAnimationState, VesperVideoEntry> | null {
    if (typeof document === 'undefined') return null
    if (this.entries) return this.entries

    const host = this.ensureHostElement()
    const created = {} as Record<PetAnimationState, VesperVideoEntry>

    for (const state of ['idle', 'thinking', 'success'] as PetAnimationState[]) {
      const cfg = VESPER_CLIPS[state]
      const video = document.createElement('video')
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.loop = cfg.loop
      video.autoplay = false
      video.controls = false
      video.preload = 'none'
      video.crossOrigin = 'anonymous'
      video.disablePictureInPicture = true
      video.setAttribute('muted', '')
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')
      video.setAttribute('x5-playsinline', 'true')
      video.setAttribute('x5-video-player-type', 'h5')
      video.setAttribute('disablepictureinpicture', '')
      video.setAttribute('disableremoteplayback', '')

      // Prefer zero-B-frame single-GOP H.264 MP4 first everywhere for hardware zero-copy decode & zero loop-wrap stutter;
      // fall back to zero-lag VP9 WebM seamlessly if needed.
      const sources = [
        { src: cfg.mp4, type: 'video/mp4' },
        { src: cfg.webm, type: 'video/webm; codecs="vp9"' },
      ]

      for (const item of sources) {
        const source = document.createElement('source')
        source.src = item.src
        source.type = item.type
        video.appendChild(source)
      }

      if (host) {
        host.appendChild(video)
      }

      const poster = new Image()
      poster.decoding = 'async'
      poster.crossOrigin = 'anonymous'

      const entry: VesperVideoEntry = {
        state,
        video,
        poster,
        videoRequested: false,
        videoReady: false,
        posterReady: false,
        failed: false,
        presentedFrame: 0,
        hasRvfc: false,
      }

      this.bindFrameCallback(entry)

      const markVideoReady = () => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          entry.videoReady = true
          entry.failed = false
          if (!entry.hasRvfc) {
            entry.presentedFrame += 1
          }
          if (state === 'idle') {
            this.scheduleSecondaryWarmup()
          }
          this.notify()
        }
      }

      video.addEventListener('loadeddata', markVideoReady)
      video.addEventListener('canplay', markVideoReady)
      video.addEventListener('playing', markVideoReady)
      video.addEventListener('error', () => {
        entry.failed = true
        if (state === 'idle') {
          this.scheduleSecondaryWarmup()
        }
        this.notify()
      })
      if (state === 'success') {
        video.addEventListener('ended', () => {
          for (const cb of this.endedListeners) cb()
        })
      }

      poster.addEventListener('load', () => {
        entry.posterReady = true
        this.notify()
      })
      poster.src = cfg.poster

      created[state] = entry
    }

    this.entries = created
    if (!this.isReducedMotion()) {
      this.ensureVideoLoaded(created.idle)
    }
    this.bindGestureUnlock()
    return created
  }

  private bindGestureUnlock() {
    if (this.unlockBound || typeof window === 'undefined') return
    this.unlockBound = true
    const unlock = () => {
      if (!this.entries) return
      for (const entry of Object.values(this.entries)) {
        if (entry.video.dataset.vesperActive === '1' && entry.video.paused && !entry.video.ended) {
          void entry.video.play().catch(() => {})
        }
      }
    }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    window.addEventListener('keydown', unlock, { passive: true })
  }

  activate(state: PetAnimationState, { restart = false }: { restart?: boolean } = {}) {
    const pool = this.ensureInitialized()
    if (!pool) return
    const target = pool[state]
    this.ensureVideoLoaded(target)
    target.video.dataset.vesperActive = '1'
    target.video.muted = true
    target.video.defaultMuted = true
    if (restart || state === 'success') {
      try {
        // Avoid triggering a redundant `seeking = true` flash when the clip is already parked at 0s!
        if (target.video.currentTime > 0.04) {
          target.video.currentTime = 0
        }
      } catch {
        // Seeking before metadata will resolve on loadedmetadata
      }
    }
    void target.video.play().catch(() => {})
  }

  pauseInactive(keepStates: ReadonlySet<PetAnimationState>) {
    if (!this.entries) return
    for (const [key, entry] of Object.entries(this.entries) as [PetAnimationState, VesperVideoEntry][]) {
      if (!keepStates.has(key)) {
        entry.video.dataset.vesperActive = '0'
        if (!entry.video.paused) {
          entry.video.pause()
        }
        if (key === 'success') {
          try {
            entry.video.currentTime = 0
          } catch {
            // Ignore seek failure before ready
          }
        }
      }
    }
  }

  getEntry(state: PetAnimationState): VesperVideoEntry | null {
    const pool = this.ensureInitialized()
    return pool ? pool[state] : null
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  onSuccessEnded(listener: () => void): () => void {
    this.endedListeners.add(listener)
    return () => {
      this.endedListeners.delete(listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }
}

export const vesperPool = new VesperMediaPool()
