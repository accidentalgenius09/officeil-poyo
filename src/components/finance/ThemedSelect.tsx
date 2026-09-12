import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { CaretDown } from '@phosphor-icons/react'

export type ThemedSelectOption = {
  value: string
  label: string
}

type ThemedSelectProps = {
  value: string
  options: ThemedSelectOption[]
  onChange: (value: string) => void
  'aria-label'?: string
  disabled?: boolean
}

export function ThemedSelect({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
}: ThemedSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected =
    options.find((o) => o.value === value) ?? options[0] ?? null

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div
      className={`themed-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="themed-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selected?.label ?? 'Select'}</span>
        <CaretDown size={16} weight="bold" aria-hidden className="themed-select-caret" />
      </button>
      {open && (
        <ul
          id={listId}
          className="themed-select-menu"
          role="listbox"
          aria-activedescendant={
            selected ? `${listId}-${selected.value}` : undefined
          }
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  id={`${listId}-${option.value}`}
                  role="option"
                  aria-selected={active}
                  className={`themed-select-option${active ? ' is-active' : ''}`}
                  onClick={() => choose(option.value)}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
