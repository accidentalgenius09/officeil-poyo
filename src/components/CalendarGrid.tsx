import type { DayStatus } from '../types'
import { daysInMonth, startOfToday, toDateKey } from '../lib/attendance'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type CalendarGridProps = {
  year: number
  month: number
  days: Record<string, DayStatus>
  leaveDates: Map<string, string>
  holidayDates: Map<string, string>
  onDayClick: (day: number) => void
}

export function CalendarGrid({
  year,
  month,
  days,
  leaveDates,
  holidayDates,
  onDayClick,
}: CalendarGridProps) {
  const total = daysInMonth(year, month)
  const firstWeekday = new Date(year, month, 1).getDay()
  const today = startOfToday()
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month

  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ]

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return (
    <section className="calendar" aria-label="Attendance calendar">
      <div className="weekday-row">
        {WEEKDAYS.map((d) => (
          <div key={d} className="weekday">
            {d}
          </div>
        ))}
      </div>
      <div className="day-grid">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="day-cell empty" />
          }

          const dateKey = toDateKey(year, month, day)
          const status = days[dateKey] ?? null
          const isToday = isCurrentMonth && day === today.getDate()
          const holidayName = holidayDates.get(dateKey)
          const leaveNote = leaveDates.get(dateKey)

          let statusClass = status === 'office' ? 'office' : 'wfh'
          let label = status === 'office' ? 'in office' : 'not in office'
          let locked = false

          if (holidayName) {
            statusClass = 'holiday'
            label = `holiday: ${holidayName}`
            locked = true
          } else if (leaveNote !== undefined) {
            statusClass = 'leave'
            label = leaveNote ? `leave: ${leaveNote}` : 'on leave'
            locked = true
          }

          return (
            <button
              key={dateKey}
              type="button"
              className={`day-cell ${statusClass}${isToday ? ' today' : ''}${locked ? ' locked' : ''}`}
              onClick={() => {
                if (!locked) onDayClick(day)
              }}
              disabled={locked}
              title={holidayName || leaveNote || undefined}
              aria-label={`${dateKey}, ${label}. ${locked ? 'Managed in settings.' : 'Click to change.'}`}
            >
              <span className="day-num">{day}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
