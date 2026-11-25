import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PetAnimationState, PetMood } from './contracts'
import { VESPER_CLIPS, moodToAnimationState, vesperPool } from './vesperAssets'

export interface VesperStateController {
  mood: PetMood
  animationState: PetAnimationState
  /** Increments every time a state is explicitly triggered (allows restarting success cleanly) */
  playNonce: number
  setMood: (next: PetMood) => void
  /** High-priority transition to thinking (immediately interrupts any ongoing success celebration) */
  enterThinking: () => void
  /** Trigger one-shot success celebration that auto-returns to idle when finished */
  triggerSuccess: () => void
  /** Trigger 3s pure-CSS Q-bounce + cyber-cyan/gold particle burst celebration (no external video) */
  triggerCelebrating: (durationMs?: number) => void
  /** Show error alert prompt on upper-right bubble while keeping Vesper in idle stance */
  triggerAlert: () => void
  /** Immediately return to calm idle state */
  returnToIdle: () => void
}

export function useVesperState(initialMood: PetMood = 'idle'): VesperStateController {
  const [mood, setMoodState] = useState<PetMood>(initialMood)
  const [playNonce, setPlayNonce] = useState(0)
  const moodRef = useRef<PetMood>(initialMood)
  const successTimer = useRef<number | null>(null)
  const pauseTimer = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (successTimer.current !== null) {
      window.clearTimeout(successTimer.current)
      successTimer.current = null
    }
    if (pauseTimer.current !== null) {
      window.clearTimeout(pauseTimer.current)
      pauseTimer.current = null
    }
  }, [])

  const applyMood = useCallback((next: PetMood, { forceRestart = false, durationMs }: { forceRestart?: boolean; durationMs?: number } = {}) => {
    clearTimers()
    const prev = moodRef.current
    moodRef.current = next
    setMoodState(next)
    if (forceRestart || next === 'success' || next === 'celebrating' || prev !== next) {
      setPlayNonce(n => n + 1)
    }

    const anim = moodToAnimationState(next)
    const prevAnim = moodToAnimationState(prev)
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    vesperPool.ensureInitialized()
    if (!reduced) {
      // Never seek-restart an already-running idle loop when entering `celebrating` or `alert`!
      const shouldRestart = anim === 'success' || (forceRestart && anim !== prevAnim)
      vesperPool.activate(anim, { restart: shouldRestart })
      const keep = new Set<PetAnimationState>([anim])
      if (prevAnim !== anim) keep.add(prevAnim)
      vesperPool.pauseInactive(keep)
      pauseTimer.current = window.setTimeout(() => {
        vesperPool.pauseInactive(new Set<PetAnimationState>([moodToAnimationState(moodRef.current)]))
      }, 520)
    } else {
      vesperPool.pauseInactive(new Set())
    }

    if (next === 'success') {
      const fallbackMs = reduced ? 2400 : VESPER_CLIPS.success.durationMs + 450
      successTimer.current = window.setTimeout(() => {
        if (moodRef.current === 'success') {
          applyMood('idle')
        }
      }, fallbackMs)
    } else if (next === 'celebrating') {
      const celebrateMs = durationMs ?? 3000
      successTimer.current = window.setTimeout(() => {
        if (moodRef.current === 'celebrating') {
          applyMood('idle')
        }
      }, celebrateMs)
    }
  }, [clearTimers])

  // Initialize media pool on mount & subscribe to success video `ended` event
  useEffect(() => {
    vesperPool.ensureInitialized()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced) {
      const initialAnim = moodToAnimationState(moodRef.current)
      vesperPool.activate(initialAnim, { deferLoad: initialAnim === 'idle' })
    }
    const unsubEnded = vesperPool.onSuccessEnded(() => {
      if (moodRef.current === 'success') {
        applyMood('idle')
      }
    })
    return () => {
      unsubEnded()
      clearTimers()
    }
  }, [applyMood, clearTimers])

  const setMood = useCallback(
    (next: PetMood) => applyMood(next, { forceRestart: next === 'success' || next === 'celebrating' }),
    [applyMood],
  )
  const enterThinking = useCallback(() => applyMood('thinking'), [applyMood])
  const triggerSuccess = useCallback(() => applyMood('success', { forceRestart: true }), [applyMood])
  const triggerCelebrating = useCallback((durationMs = 3000) => applyMood('celebrating', { forceRestart: true, durationMs }), [applyMood])
  const triggerAlert = useCallback(() => applyMood('alert'), [applyMood])
  const returnToIdle = useCallback(() => applyMood('idle'), [applyMood])

  return useMemo(() => ({
    mood,
    animationState: moodToAnimationState(mood),
    playNonce,
    setMood,
    enterThinking,
    triggerSuccess,
    triggerCelebrating,
    triggerAlert,
    returnToIdle,
  }), [
    mood,
    playNonce,
    setMood,
    enterThinking,
    triggerSuccess,
    triggerCelebrating,
    triggerAlert,
    returnToIdle,
  ])
}
