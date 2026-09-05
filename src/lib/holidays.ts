import type { HolidayEntry } from '../types'
import { newId, toDateKey } from './attendance'

/** Fixed national holidays commonly observed in India (MM-DD). */
export const INDIA_HOLIDAY_PACK: { month: number; day: number; name: string }[] =
  [
    { month: 0, day: 26, name: 'Republic Day' },
    { month: 7, day: 15, name: 'Independence Day' },
    { month: 9, day: 2, name: 'Gandhi Jayanti' },
    { month: 11, day: 25, name: 'Christmas' },
  ]

export function importIndiaHolidays(
  year: number,
  existing: HolidayEntry[],
): HolidayEntry[] {
  const byKey = new Map(
    existing.map((h) => [`${h.date.slice(5)}:${h.name.toLowerCase()}`, h]),
  )
  const next = [...existing]

  for (const item of INDIA_HOLIDAY_PACK) {
    const date = toDateKey(year, item.month, item.day)
    const key = `${date.slice(5)}:${item.name.toLowerCase()}`
    if (byKey.has(key)) continue
    const entry: HolidayEntry = {
      id: newId(),
      date,
      name: item.name,
      recurring: true,
    }
    next.push(entry)
    byKey.set(key, entry)
  }

  return next.sort((a, b) => a.date.localeCompare(b.date))
}
