import { useEffect, useRef } from 'react'

export function SpaceField({ kind }: { kind: 'intro' | 'hero' }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = host.current
    if (!container) return
    const motion = window.matchMedia('(min-width: 800px) and (prefers-reduced-motion: no-preference)')
    let disposed = false
    let revision = 0
    let cleanup: (() => void) | undefined
    let observer: IntersectionObserver | undefined

    function reset() {
      revision += 1
      observer?.disconnect()
      cleanup?.()
      cleanup = undefined
    }

    function watch() {
      reset()
      if (!motion.matches || !container) return
      const observing = revision
      observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return
        observer?.disconnect()
        void import('./spaceScene').then(({ mountSpaceScene }) => {
          if (!disposed && revision === observing && motion.matches) cleanup = mountSpaceScene(container, kind)
        }).catch(() => {
          // The CSS starfield stays visible if rendering is unavailable.
        })
      })
      observer.observe(container)
    }

    watch()
    motion.addEventListener('change', watch)
    return () => {
      disposed = true
      motion.removeEventListener('change', watch)
      reset()
    }
  }, [kind])

  return <div className={`space-field space-field-${kind}`} ref={host} aria-hidden="true" />
}
