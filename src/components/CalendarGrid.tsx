import type { DayStatus, LeavePortion } from '../types'
import { daysInMonth, startOfToday, toDateKey } from '../lib/attendance'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type LeaveInfo = { note: string; portion: LeavePortion }

type CalendarGridProps = {
  year: number
  month: number
  days: Record<string, DayStatus>
  leaveDates: Map<string, LeaveInfo>
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
          const leave = leaveDates.get(dateKey)

          let statusClass = 'unmarked'
          let label = 'unmarked'
          let locked = false

          if (holidayName) {
            statusClass = 'holiday'
            label = `holiday: ${holidayName}`
            locked = true
          } else if (leave?.portion === 'full') {
            statusClass = 'leave'
            label = leave.note ? `leave: ${leave.note}` : 'on leave'
            locked = true
          } else if (status === 'office') {
            statusClass = 'office'
            label = 'in office'
          } else if (status === 'wfh') {
            statusClass = 'wfh'
            label = 'working from home'
          }

          if (leave && leave.portion !== 'full' && !holidayName) {
            statusClass += ` leave-half leave-${leave.portion}`
            label += `, leave ${leave.portion.toUpperCase()}`
          }

          const titleBits = [
            holidayName,
            leave
              ? `${leave.note || 'Leave'} (${leave.portion.toUpperCase()})`
              : null,
            status === 'office'
              ? 'In office'
              : status === 'wfh'
                ? 'WFH'
                : null,
          ].filter(Boolean)

          return (
            <button
              key={dateKey}
              type="button"
              className={`day-cell ${statusClass}${isToday ? ' today' : ''}${locked ? ' locked' : ''}`}
              onClick={() => {
                if (!locked) onDayClick(day)
              }}
              disabled={locked}
              title={titleBits.join(' · ') || undefined}
              aria-label={`${dateKey}, ${label}. ${locked ? 'Managed in settings.' : 'Click to cycle office / WFH / unmarked.'}`}
            >
              <span className="day-num">{day}</span>
              {leave && leave.portion !== 'full' && !holidayName && (
                <span className="day-badge" aria-hidden>
                  {leave.portion.toUpperCase()}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
