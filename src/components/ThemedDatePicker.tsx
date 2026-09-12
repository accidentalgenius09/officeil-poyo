import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import { monthLabel, toDateKey } from '../lib/attendance'
import { todayInputValue } from '../lib/finance'

type ThemedDatePickerProps = {
  value: string
  onChange: (value: string) => void
  'aria-label'?: string
  required?: boolean
  disabled?: boolean
  allowClear?: boolean
}

type PopoverCoords = {
  top: number
  left: number
  width: number
}

function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null
  }
  return date
}

function formatDisplay(value: string): string {
  const date = parseDateKey(value)
  if (!date) return 'Select date'
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const
const POPOVER_WIDTH = 312
const VIEWPORT_GAP = 10

export function ThemedDatePicker({
  value,
  onChange,
  'aria-label': ariaLabel,
  required = false,
  disabled = false,
  allowClear = false,
}: ThemedDatePickerProps) {
  const labelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<PopoverCoords | null>(null)
  const selected = parseDateKey(value)
  const [viewYear, setViewYear] = useState(
    () => selected?.getFullYear() ?? new Date().getFullYear(),
  )
  const [viewMonth, setViewMonth] = useState(
    () => selected?.getMonth() ?? new Date().getMonth(),
  )

  useEffect(() => {
    if (!open || !selected) return
    setViewYear(selected.getFullYear())
    setViewMonth(selected.getMonth())
  }, [open, value])

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }

    function place() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_GAP * 2)
      let left = rect.left
      if (left + width > window.innerWidth - VIEWPORT_GAP) {
        left = Math.max(VIEWPORT_GAP, rect.right - width)
      }
      left = Math.max(VIEWPORT_GAP, left)

      const popHeight = popoverRef.current?.offsetHeight ?? 320
      let top = rect.bottom + 6
      if (top + popHeight > window.innerHeight - VIEWPORT_GAP) {
        const above = rect.top - popHeight - 6
        if (above >= VIEWPORT_GAP) top = above
        else top = Math.max(VIEWPORT_GAP, window.innerHeight - popHeight - VIEWPORT_GAP)
      }
      setCoords({ top, left, width })
    }

    place()
    // Re-measure after paint once height is known
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, viewYear, viewMonth])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
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

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startPad = (first.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const prevDays = new Date(viewYear, viewMonth, 0).getDate()
    const out: Array<{
      key: string
      day: number
      dateKey: string
      inMonth: boolean
    }> = []

    for (let i = startPad - 1; i >= 0; i--) {
      const day = prevDays - i
      const d = new Date(viewYear, viewMonth - 1, day)
      out.push({
        key: `p-${day}`,
        day,
        dateKey: toDateKey(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth: false,
      })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({
        key: `c-${day}`,
        day,
        dateKey: toDateKey(viewYear, viewMonth, day),
        inMonth: true,
      })
    }
    let next = 1
    while (out.length < 42) {
      const d = new Date(viewYear, viewMonth + 1, next)
      out.push({
        key: `n-${next}`,
        day: next,
        dateKey: toDateKey(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth: false,
      })
      next += 1
    }
    return out
  }, [viewYear, viewMonth])

  const todayKey = todayInputValue()

  function choose(dateKey: string) {
    onChange(dateKey)
    setOpen(false)
  }

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const popover =
    open &&
    createPortal(
      <div
        ref={popoverRef}
        className="themed-date-popover"
        role="dialog"
        aria-label="Choose date"
        style={
          coords
            ? {
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }
            : { visibility: 'hidden', top: 0, left: 0 }
        }
      >
        <div className="themed-date-toolbar">
          <button
            type="button"
            className="themed-date-nav"
            aria-label="Previous month"
            onClick={goPrevMonth}
          >
            <CaretLeft size={16} weight="bold" aria-hidden />
          </button>
          <p className="themed-date-month">{monthLabel(viewYear, viewMonth)}</p>
          <button
            type="button"
            className="themed-date-nav"
            aria-label="Next month"
            onClick={goNextMonth}
          >
            <CaretRight size={16} weight="bold" aria-hidden />
          </button>
        </div>
        <div className="themed-date-weekdays" aria-hidden>
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="themed-date-grid">
          {cells.map((cell) => {
            const selectedDay = cell.dateKey === value
            const isToday = cell.dateKey === todayKey
            return (
              <button
                key={cell.key}
                type="button"
                className={[
                  'themed-date-day',
                  cell.inMonth ? '' : 'is-outside',
                  selectedDay ? 'is-selected' : '',
                  isToday ? 'is-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => choose(cell.dateKey)}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
        <div className="themed-date-footer">
          {allowClear ? (
            <button
              type="button"
              className="themed-date-footer-btn"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="themed-date-footer-btn"
            onClick={() => choose(todayKey)}
          >
            Today
          </button>
        </div>
      </div>,
      document.body,
    )

  return (
    <div
      className={`themed-date${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="themed-date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={ariaLabel ? undefined : labelId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span id={ariaLabel ? undefined : labelId}>{formatDisplay(value)}</span>
        <CalendarBlank size={18} weight="bold" aria-hidden />
      </button>
      {required && (
        <input
          type="text"
          className="themed-date-required"
          value={value}
          required
          tabIndex={-1}
          aria-hidden
          readOnly
          onChange={() => undefined}
        />
      )}
      {popover}
    </div>
  )
}
