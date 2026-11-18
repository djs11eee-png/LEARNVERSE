import { ArrowRight, Orbit } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { brand } from '../brand'
import { SpaceField } from './SpaceField'
import './intro.css'

export function Intro({ onFinish }: { onFinish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const complete = useCallback(() => {
    onFinish()
    requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
  }, [onFinish])

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timeout = window.setTimeout(complete, motion.matches ? 1050 : 4900)
    const onMotionChange = () => { if (motion.matches) complete() }
    motion.addEventListener('change', onMotionChange)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(timeout)
      motion.removeEventListener('change', onMotionChange)
      document.body.style.overflow = previousOverflow
      element.close()
    }
  }, [complete])

  return (
    <dialog className="intro-dialog" ref={dialog} aria-label="Learnverse 开场动画" onCancel={(event) => { event.preventDefault(); complete() }}>
      <div className="intro-nebula" aria-hidden="true" />
      <div className="intro-stars" aria-hidden="true" />
      <div className="intro-art" aria-hidden="true" />
      <div className="intro-orbits" aria-hidden="true"><i /><i /><b /><b /><b /></div>
      <SpaceField kind="intro" />
      <div className="intro-copy" lang="en">
        <Orbit strokeWidth={1.25} aria-hidden="true" />
        <strong>{brand.wordmark}</strong>
        <p>{brand.introLine}</p>
      </div>
      <button className="button intro-skip" type="button" onClick={complete} autoFocus>跳过开场 <ArrowRight size={16} /></button>
    </dialog>
  )
}
