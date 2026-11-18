import { Check, ChevronDown, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import './theme-select.css'

interface ThemeSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  compact?: boolean
}

export function ThemeSelect({ label, value, options, onChange, compact = false }: ThemeSelectProps) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const optionButtons = useRef<(HTMLButtonElement | null)[]>([])
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = options[selectedIndex]

  function showChoices() {
    dialog.current?.showModal()
    setOpen(true)
    optionButtons.current[Math.max(0, selectedIndex)]?.focus()
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const items = optionButtons.current.slice(0, options.length)
    const current = items.findIndex((item) => item === document.activeElement)
    let index: number
    switch (event.key) {
      case 'ArrowDown': index = Math.min(items.length - 1, current + 1); break
      case 'ArrowUp': index = Math.max(0, current - 1); break
      case 'Home': index = 0; break
      case 'End': index = items.length - 1; break
      default: return
    }
    event.preventDefault()
    items[index]?.focus()
  }

  return (
    <div className={`theme-select${compact ? ' theme-select-compact' : ''}`}>
      <span className="theme-select-label" id={`${id}-label`}>{label}</span>
      <button
        ref={trigger}
        className="theme-select-trigger"
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-controls={`${id}-dialog`}
        aria-expanded={open}
        onClick={showChoices}
      >
        <span id={`${id}-value`}>{selected?.label ?? '请选择'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="theme-select-dialog"
        id={`${id}-dialog`}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false)
          trigger.current?.focus({ preventScroll: true })
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close()
        }}
      >
        <div className="theme-select-panel">
          <header className="theme-select-head">
            <h2 id={`${id}-title`}>选择{label}</h2>
            <button type="button" aria-label="关闭选项" onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
          </header>
          <div className="theme-select-options" role="listbox" aria-labelledby={`${id}-title`} onKeyDown={moveFocus}>
            {options.map((option, index) => (
              <button
                className="theme-select-option"
                key={option.value}
                ref={(node) => { optionButtons.current[index] = node }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                tabIndex={focusIndex === index ? 0 : -1}
                onFocus={() => setFocusIndex(index)}
                onClick={() => {
                  dialog.current?.close()
                  onChange(option.value)
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={17} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  )
}

