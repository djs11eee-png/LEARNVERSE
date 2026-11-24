import { useLayoutEffect, useState } from 'react'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'

export function useStationDialog(
  dialog: RefObject<HTMLDialogElement | null>,
  heading: RefObject<HTMLElement | null>,
  opener: HTMLElement | null,
) {
  useLayoutEffect(() => {
    const node = dialog.current
    if (!node) return
    node.showModal()
    heading.current?.focus({ preventScroll: true })
    return () => {
      node.close()
      queueMicrotask(() => {
        if (document.querySelector('dialog[open]')) return
        const target = opener?.getClientRects().length ? opener : document.getElementById('main-content')
        target?.focus({ preventScroll: true })
      })
    }
  }, [dialog, heading, opener])
}

export function containTab(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return
  const candidates = event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]',
  )
  const items = Array.from(candidates).filter(item => item.tabIndex >= 0 && item.getClientRects().length)
  const first = items[0]
  const last = items.at(-1)
  const index = items.findIndex(item => item === document.activeElement)
  if (event.shiftKey ? index <= 0 : index < 0 || index === items.length - 1) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus()
  }
}

export function useVisibleViewport() {
  const [style, setStyle] = useState<CSSProperties>()
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    function update() {
      if (!viewport) return
      setStyle({
        '--lvo-visible-height': `${viewport.height}px`,
        '--lvo-visible-bottom': `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`,
      } as CSSProperties)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
  return style
}
