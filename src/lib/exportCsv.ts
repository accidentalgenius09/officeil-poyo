import type { AppData, DayStatus } from '../types'
import {
  daysInMonth,
  getMonthAttendance,
  holidayNameByDate,
  isInOffice,
  leaveCoverageByDate,
  monthLabel,
  monthStorageKey,
  toDateKey,
} from './attendance'

function statusLabel(status: DayStatus | undefined): string {
  if (status === 'office') return 'Office'
  if (status === 'wfh') return 'WFH'
  return 'Unmarked'
}

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Day-by-day CSV for one month. */
export function exportMonthCsv(
  data: AppData,
  year: number,
  month: number,
): void {
  const attendance = getMonthAttendance(data.attendance, year, month)
  const holidays = holidayNameByDate(data.settings, year, month)
  const leaves = leaveCoverageByDate(data.settings)
  const total = daysInMonth(year, month)

  const rows = [
    ['Date', 'Weekday', 'Status', 'Office', 'Note'].join(','),
  ]

  for (let day = 1; day <= total; day++) {
    const dateKey = toDateKey(year, month, day)
    const date = new Date(year, month, day)
    const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
    const status = attendance.days[dateKey]
    const holiday = holidays.get(dateKey)
    const leave = leaves.get(dateKey)
    const note = holiday
      ? `Holiday: ${holiday}`
      : leave
        ? `Leave (${leave.portion.toUpperCase()})${leave.note ? `: ${leave.note}` : ''}`
        : ''

    rows.push(
      [
        dateKey,
        weekday,
        escapeCsv(statusLabel(status)),
        isInOffice(status) ? '1' : '0',
        escapeCsv(note),
      ].join(','),
    )
  }

  const label = monthStorageKey(year, month)
  downloadBlob(`office-visits-${label}.csv`, rows.join('\n'))
}

/** One row per month: month name + office day count for a year. */
export function exportYearCsv(data: AppData, year: number): void {
  const rows = [['Month', 'Office days'].join(',')]

  for (let month = 0; month < 12; month++) {
    const attendance = getMonthAttendance(data.attendance, year, month)
    const total = daysInMonth(year, month)
    let office = 0
    for (let day = 1; day <= total; day++) {
      const key = toDateKey(year, month, day)
      if (isInOffice(attendance.days[key])) office += 1
    }
    rows.push(
      [escapeCsv(monthLabel(year, month)), String(office)].join(','),
    )
  }

  downloadBlob(`office-visits-${year}.csv`, rows.join('\n'))
}
