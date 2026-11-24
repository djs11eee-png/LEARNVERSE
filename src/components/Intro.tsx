import { ArrowRight, Orbit } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { brand } from '../brand'
import './intro.css'

const reducedMotion = '(prefers-reduced-motion: reduce)'

export function Intro({ exit, onReveal, onFinish }: {
  exit: 'fading' | 'skipping' | null
  onReveal: (skipped: boolean) => void
  onFinish: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const completed = useRef(false)

  const complete = useCallback(() => {
    if (completed.current) return
    completed.current = true
    dialog.current?.close()
    document.getElementById('main-content')?.focus({ preventScroll: true })
    onFinish()
  }, [onFinish])

  const startExit = useCallback((skipped = false) => {
    if (!dialog.current?.open || completed.current) return
    onReveal(skipped)
    if (window.matchMedia(reducedMotion).matches) complete()
  }, [complete, onReveal])

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    element.toggleAttribute('data-scrollbar', window.innerWidth > document.documentElement.clientWidth)
    element.showModal()
    const motion = window.matchMedia(reducedMotion)
    const timeout = window.setTimeout(() => startExit(), motion.matches ? 600 : 1800)
    const onMotionChange = () => { if (motion.matches) startExit() }
    motion.addEventListener('change', onMotionChange)
    return () => {
      window.clearTimeout(timeout)
      motion.removeEventListener('change', onMotionChange)
      element.close()
    }
  }, [startExit])

  return (
    <dialog className="intro-dialog" ref={dialog} data-exit={exit ?? undefined} aria-label="Learnverse 开场动画"
      onCancel={(event) => { event.preventDefault(); startExit(true) }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'intro-out') complete()
      }}>
      <div className="intro-nebula" aria-hidden="true" />
      <div className="intro-stars" aria-hidden="true" />
      <div className="intro-art" aria-hidden="true" />
      <div className="intro-orbits" aria-hidden="true"><i /><i /><i /><b /><b /><b /></div>
      <div className="intro-copy" lang="en">
        <Orbit strokeWidth={1.25} aria-hidden="true" />
        <strong>{brand.wordmark}</strong>
        <p>{brand.introLine}</p>
      </div>
      <button className="button intro-skip" type="button" onClick={() => startExit(true)} autoFocus>跳过开场 <ArrowRight size={16} /></button>
    </dialog>
  )
}
