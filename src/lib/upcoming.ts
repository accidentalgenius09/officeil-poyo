import type {
  CalendarSettings,
  LeaveEntry,
  LeavePortion,
  MonthAttendance,
  MonthStats,
} from '../types'
import {
  emptySettings,
  getMonthAttendance,
  holidayNameByDate,
  parseDateKey,
  startOfToday,
  toDateKey,
  computeStats,
} from './attendance'

export type UpcomingItem = {
  id: string
  kind: 'holiday' | 'leave' | 'goal'
  label: string
  detail: string
}

function todayKey(today: Date = startOfToday()): string {
  return toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
}

function formatShortDate(dateKey: string): string {
  const date = parseDateKey(dateKey)
  if (!date) return dateKey
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Whole calendar days from `from` (start of day) to `dateKey`. */
function daysUntil(dateKey: string, from: Date = startOfToday()): number | null {
  const target = parseDateKey(dateKey)
  if (!target) return null
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function portionSuffix(portion: LeavePortion): string {
  if (portion === 'am') return ' · AM'
  if (portion === 'pm') return ' · PM'
  return ''
}

/** Next holiday on or after today (includes today). */
export function findNextHoliday(
  settings: CalendarSettings = emptySettings(),
  today: Date = startOfToday(),
): { name: string; dateKey: string } | null {
  const start = todayKey(today)
  const endYear = today.getFullYear() + 1
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  for (let i = 0; i < 400; i++) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    if (y > endYear) break
    const key = toDateKey(y, m, cursor.getDate())
    if (key < start) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }
    const name = holidayNameByDate(settings, y, m).get(key)
    if (name) return { name, dateKey: key }
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}

/** Next leave that is ongoing or starts on/after today. */
export function findNextLeave(
  settings: CalendarSettings = emptySettings(),
  today: Date = startOfToday(),
): LeaveEntry | null {
  const start = todayKey(today)
  const upcoming = settings.leaves
    .filter((leave) => leave.end >= start)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  return upcoming[0] ?? null
}

/** Pace line for the current month goal. */
export function buildGoalSafetyLine(stats: MonthStats): string | null {
  if (stats.daysLeftToGoal === 0) return 'Goal met for this month'
  if (!stats.canHitGoal) {
    return `Need ${stats.daysLeftToGoal} more with ${stats.workingDaysRemaining} working day${stats.workingDaysRemaining === 1 ? '' : 's'} left`
  }
  if (stats.daysLeftToGoal === stats.workingDaysRemaining) {
    return 'Office every remaining working day'
  }
  return `Goal is safe after ${stats.daysLeftToGoal} more office day${stats.daysLeftToGoal === 1 ? '' : 's'}`
}

export function buildUpcomingItems(
  settings: CalendarSettings,
  attendance: Record<string, MonthAttendance>,
  today: Date = startOfToday(),
): UpcomingItem[] {
  const items: UpcomingItem[] = []

  const holiday = findNextHoliday(settings, today)
  if (holiday) {
    const days = daysUntil(holiday.dateKey, today)
    const label =
      days === 0
        ? 'Holiday today'
        : days === 1
          ? 'Next holiday (in 1 day)'
          : days != null && days > 1
            ? `Next holiday (in ${days} days)`
            : 'Next holiday'
    items.push({
      id: `holiday-${holiday.dateKey}`,
      kind: 'holiday',
      label,
      detail: `${holiday.name} · ${formatShortDate(holiday.dateKey)}`,
    })
  }

  const leave = findNextLeave(settings, today)
  if (leave) {
    const ongoing = leave.start <= todayKey(today)
    const range =
      leave.start === leave.end
        ? formatShortDate(leave.start)
        : `${formatShortDate(leave.start)} → ${formatShortDate(leave.end)}`
    const note = leave.note.trim() || 'Leave'
    items.push({
      id: `leave-${leave.id}`,
      kind: 'leave',
      label: ongoing ? 'On leave' : 'Next leave',
      detail: `${note}${portionSuffix(leave.portion)} · ${range}`,
    })
  }

  const monthAtt = getMonthAttendance(
    attendance,
    today.getFullYear(),
    today.getMonth(),
  )
  const stats = computeStats(monthAtt, settings, today, attendance)
  const goalLine = buildGoalSafetyLine(stats)
  if (goalLine) {
    items.push({
      id: 'goal-safety',
      kind: 'goal',
      label: 'This month',
      detail: goalLine,
    })
  }

  return items
}
