import type {
  AppData,
  CalendarSettings,
  DayStatus,
  HolidayEntry,
  LeaveEntry,
  MonthAttendance,
  MonthStats,
  UserProfile,
} from '../types'

const STORAGE_KEY = 'office-visit-app-data'
const LEGACY_STORAGE_KEY = 'office-visit-attendance'
const DEFAULT_OFFICE_GOAL = 12

export function emptyProfile(): UserProfile {
  return {
    name: '',
    email: '',
    role: '',
    goDaily: false,
    officeDaysGoal: DEFAULT_OFFICE_GOAL,
  }
}

export function emptySettings(): CalendarSettings {
  return { profile: emptyProfile(), leaves: [], holidays: [] }
}

export function emptyAppData(): AppData {
  return { attendance: {}, settings: emptySettings() }
}

export function toDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function emptyMonth(year: number, month: number): MonthAttendance {
  return { year, month, days: {} }
}

export function parseDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function eachDateKeyInRange(start: string, end: string): string[] {
  const startDate = parseDateKey(start)
  const endDate = parseDateKey(end)
  if (!startDate || !endDate || startDate > endDate) return []

  const keys: string[] = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    keys.push(
      toDateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Date keys blocked by leave or holiday (not expected office days). */
export function blockedDateKeys(settings: CalendarSettings): Set<string> {
  const blocked = new Set<string>()
  for (const holiday of settings.holidays) {
    blocked.add(holiday.date)
  }
  for (const leave of settings.leaves) {
    for (const key of eachDateKeyInRange(leave.start, leave.end)) {
      blocked.add(key)
    }
  }
  return blocked
}

export function holidayNameByDate(
  settings: CalendarSettings,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const holiday of settings.holidays) {
    map.set(holiday.date, holiday.name)
  }
  return map
}

export function leaveNoteByDate(settings: CalendarSettings): Map<string, string> {
  const map = new Map<string, string>()
  for (const leave of settings.leaves) {
    for (const key of eachDateKeyInRange(leave.start, leave.end)) {
      map.set(key, leave.note || 'Leave')
    }
  }
  return map
}

function isMonthAttendance(value: unknown): value is MonthAttendance {
  if (!value || typeof value !== 'object') return false
  const record = value as MonthAttendance
  return (
    typeof record.year === 'number' &&
    typeof record.month === 'number' &&
    record.days !== null &&
    typeof record.days === 'object'
  )
}

function looksLikeLegacyAttendance(
  value: unknown,
): value is Record<string, MonthAttendance> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return true
  if ('attendance' in (value as object) || 'settings' in (value as object)) {
    return false
  }
  return entries.every(
    ([key, month]) => /^\d{4}-\d{2}$/.test(key) && isMonthAttendance(month),
  )
}

function normalizeLeave(raw: unknown): LeaveEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Partial<LeaveEntry>
  if (typeof entry.start !== 'string' || typeof entry.end !== 'string') return null
  if (!parseDateKey(entry.start) || !parseDateKey(entry.end)) return null
  const start = entry.start <= entry.end ? entry.start : entry.end
  const end = entry.start <= entry.end ? entry.end : entry.start
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : newId(),
    start,
    end,
    note: typeof entry.note === 'string' ? entry.note : '',
  }
}

function normalizeHoliday(raw: unknown): HolidayEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Partial<HolidayEntry>
  if (typeof entry.date !== 'string' || !parseDateKey(entry.date)) return null
  if (typeof entry.name !== 'string' || !entry.name.trim()) return null
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : newId(),
    date: entry.date,
    name: entry.name.trim(),
  }
}

function normalizeProfile(raw: unknown): UserProfile {
  const defaults = emptyProfile()
  if (!raw || typeof raw !== 'object') return defaults
  const source = raw as Partial<UserProfile>
  const goal =
    typeof source.officeDaysGoal === 'number' &&
    Number.isFinite(source.officeDaysGoal)
      ? Math.min(31, Math.max(1, Math.round(source.officeDaysGoal)))
      : defaults.officeDaysGoal

  return {
    name: typeof source.name === 'string' ? source.name.trim() : '',
    email: typeof source.email === 'string' ? source.email.trim() : '',
    role: typeof source.role === 'string' ? source.role.trim() : '',
    goDaily: Boolean(source.goDaily),
    officeDaysGoal: goal,
  }
}

export function normalizeSettings(raw: unknown): CalendarSettings {
  if (!raw || typeof raw !== 'object') return emptySettings()
  const source = raw as Partial<CalendarSettings>
  const leaves = Array.isArray(source.leaves)
    ? source.leaves.map(normalizeLeave).filter((v): v is LeaveEntry => v !== null)
    : []
  const holidays = Array.isArray(source.holidays)
    ? source.holidays
        .map(normalizeHoliday)
        .filter((v): v is HolidayEntry => v !== null)
    : []
  return {
    profile: normalizeProfile(source.profile),
    leaves,
    holidays,
  }
}

export function normalizeAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return emptyAppData()

  const record = raw as Record<string, unknown>
  if (looksLikeLegacyAttendance(record)) {
    return { attendance: record, settings: emptySettings() }
  }

  const attendance =
    record.attendance && typeof record.attendance === 'object'
      ? (record.attendance as Record<string, MonthAttendance>)
      : {}
  return {
    attendance,
    settings: normalizeSettings(record.settings),
  }
}

/** Local cache only — MongoDB is the source of truth via the API. */
export function loadCachedAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeAppData(JSON.parse(raw))

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const migrated = normalizeAppData(JSON.parse(legacy))
      cacheAppData(migrated)
      return migrated
    }
    return emptyAppData()
  } catch {
    return emptyAppData()
  }
}

export function cacheAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function monthStorageKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function getMonthAttendance(
  all: Record<string, MonthAttendance>,
  year: number,
  month: number,
): MonthAttendance {
  const key = monthStorageKey(year, month)
  return all[key] ?? emptyMonth(year, month)
}

/** Unmarked and explicit WFH both mean not in office. */
export function isInOffice(status: DayStatus | undefined): boolean {
  return status === 'office'
}

export function cycleStatus(current: DayStatus): DayStatus {
  return current === 'office' ? null : 'office'
}

export function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

/** Weekdays from today through month end, excluding leave and holidays. */
export function countWorkingDaysRemaining(
  year: number,
  month: number,
  settings: CalendarSettings = emptySettings(),
  today: Date = startOfToday(),
): number {
  const total = daysInMonth(year, month)
  const viewEnd = new Date(year, month, total)
  if (viewEnd.getTime() < today.getTime()) return 0

  const sameMonth =
    today.getFullYear() === year && today.getMonth() === month
  const startDay = sameMonth ? today.getDate() : 1
  const blocked = blockedDateKeys(settings)

  let count = 0
  for (let day = startDay; day <= total; day++) {
    const date = new Date(year, month, day)
    if (!isWeekday(date)) continue
    if (blocked.has(toDateKey(year, month, day))) continue
    count += 1
  }
  return count
}

/** All weekdays in the month, excluding leave and holidays. */
export function countWorkingDaysInMonth(
  year: number,
  month: number,
  settings: CalendarSettings = emptySettings(),
): number {
  const total = daysInMonth(year, month)
  const blocked = blockedDateKeys(settings)
  let count = 0
  for (let day = 1; day <= total; day++) {
    const date = new Date(year, month, day)
    if (!isWeekday(date)) continue
    if (blocked.has(toDateKey(year, month, day))) continue
    count += 1
  }
  return count
}

/** Monthly office-day target from profile (or every working day if goDaily). */
export function resolveOfficeGoal(
  year: number,
  month: number,
  settings: CalendarSettings = emptySettings(),
): number {
  if (settings.profile.goDaily) {
    return Math.max(1, countWorkingDaysInMonth(year, month, settings))
  }
  return settings.profile.officeDaysGoal || DEFAULT_OFFICE_GOAL
}

export function computeStats(
  attendance: MonthAttendance,
  settings: CalendarSettings = emptySettings(),
  today: Date = startOfToday(),
): MonthStats {
  const { year, month, days } = attendance
  const totalDaysInMonth = daysInMonth(year, month)
  const goal = resolveOfficeGoal(year, month, settings)

  let daysInOffice = 0
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const key = toDateKey(year, month, day)
    if (isInOffice(days[key])) daysInOffice += 1
  }

  const daysLeftToGoal = Math.max(0, goal - daysInOffice)

  return {
    daysInOffice,
    totalDaysInMonth,
    daysLeftToGoal,
    workingDaysRemaining: countWorkingDaysRemaining(year, month, settings, today),
  }
}

export { DEFAULT_OFFICE_GOAL }
