import { Flag, Rocket } from '@phosphor-icons/react'
import type { HolidayUrgency } from '../lib/upcoming'

/** Corner mark for calm / near; eve & today use the cell tear instead. */
export function HolidayCountdownMark({ urgency }: { urgency: HolidayUrgency }) {
  if (urgency === 'near') {
    return <Rocket size={12} weight="fill" aria-hidden />
  }
  if (urgency === 'eve' || urgency === 'today') {
    return null
  }
  return <Flag size={11} weight="fill" aria-hidden />
}

/** Soft flag wave + glow for holidays 8+ days out. */
export function HolidayCalmMotion() {
  return (
    <span className="day-holiday-calm" aria-hidden>
      <span className="day-holiday-calm-glow" />
      <span className="day-holiday-calm-flag">
        <Flag size={14} weight="fill" />
      </span>
    </span>
  )
}

/** Rocket lift-off across the cell for holidays 2–7 days out. */
export function HolidayNearMotion() {
  return (
    <span className="day-holiday-near" aria-hidden>
      <span className="day-holiday-near-trail" />
      <span className="day-holiday-near-rocket">
        <Rocket size={15} weight="fill" />
      </span>
      <span className="day-holiday-near-spark day-holiday-near-spark--a" />
      <span className="day-holiday-near-spark day-holiday-near-spark--b" />
    </span>
  )
}

/** Jagged paper tear across a holiday day cell (eve / today). */
export function HolidayTearCrack({
  day,
  intensity = 'eve',
}: {
  day: number
  intensity?: 'eve' | 'today'
}) {
  return (
    <span
      className={`day-holiday-crack day-holiday-crack--${intensity}`}
      aria-hidden
    >
      <span className="day-holiday-crack-sheet">
        <span className="day-holiday-crack-num">{day}</span>
        <svg
          className="day-holiday-crack-edge"
          viewBox="0 0 100 14"
          preserveAspectRatio="none"
        >
          <path
            d="M0 2 L7 10 L14 3 L22 11 L30 2 L38 12 L46 4 L54 11 L62 3 L70 12 L78 2 L86 10 L93 4 L100 9 L100 14 L0 14 Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="day-holiday-crack-shadow" />
      <span className="day-holiday-crack-rift" />
    </span>
  )
}
