import type {
  ActivityStreak,
  AppData,
  CalendarSettings,
  DayRecord,
  DayStatus,
  DayValue,
  GoalReward,
  HolidayEntry,
  LeaveEntry,
  LeavePortion,
  MonthAttendance,
  MonthStats,
  RewardKind,
  UserProfile,
} from '../types'
import { emptyFinance, normalizeFinance } from './finance'

const STORAGE_KEY = 'office-visit-app-data'
const LEGACY_STORAGE_KEY = 'office-visit-attendance'
const DEFAULT_OFFICE_GOAL = 12

export type LeaveCoverage = {
  note: string
  portion: LeavePortion
}

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
  return {
    profile: emptyProfile(),
    leaves: [],
    holidays: [],
    rewards: [],
    activity: { lastActiveDate: null, streak: 0, behindMonths: [] },
  }
}

export function emptyAppData(): AppData {
  return { attendance: {}, settings: emptySettings(), finance: emptyFinance() }
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

function holidayKeyForYear(holiday: HolidayEntry, year: number): string {
  if (!holiday.recurring) return holiday.date
  const md = holiday.date.slice(5)
  return `${year}-${md}`
}

/** Date keys blocked by full leave or holiday (not expected office days). */
export function blockedDateKeys(
  settings: CalendarSettings,
  year?: number,
  month?: number,
): Set<string> {
  const blocked = new Set<string>()

  for (const holiday of settings.holidays) {
    if (year !== undefined) {
      blocked.add(holidayKeyForYear(holiday, year))
      if (holiday.recurring && month !== undefined) {
        // also ensure current view year is covered
        blocked.add(holidayKeyForYear(holiday, year))
      }
    } else if (holiday.recurring) {
      const nowYear = startOfToday().getFullYear()
      for (let y = nowYear - 1; y <= nowYear + 2; y++) {
        blocked.add(holidayKeyForYear(holiday, y))
      }
    } else {
      blocked.add(holiday.date)
    }
  }

  for (const leave of settings.leaves) {
    if (leave.portion !== 'full') continue
    for (const key of eachDateKeyInRange(leave.start, leave.end)) {
      blocked.add(key)
    }
  }
  return blocked
}

export function holidayNameByDate(
  settings: CalendarSettings,
  year?: number,
  month?: number,
): Map<string, string> {
  const map = new Map<string, string>()
  const years =
    year !== undefined
      ? [year]
      : [
          startOfToday().getFullYear() - 1,
          startOfToday().getFullYear(),
          startOfToday().getFullYear() + 1,
          startOfToday().getFullYear() + 2,
        ]

  for (const holiday of settings.holidays) {
    if (holiday.recurring) {
      for (const y of years) {
        const key = holidayKeyForYear(holiday, y)
        if (month !== undefined) {
          const parsed = parseDateKey(key)
          if (!parsed || parsed.getMonth() !== month) continue
        }
        map.set(key, holiday.name)
      }
    } else {
      if (year !== undefined || month !== undefined) {
        const parsed = parseDateKey(holiday.date)
        if (!parsed) continue
        if (year !== undefined && parsed.getFullYear() !== year) continue
        if (month !== undefined && parsed.getMonth() !== month) continue
      }
      map.set(holiday.date, holiday.name)
    }
  }
  return map
}

export function leaveCoverageByDate(
  settings: CalendarSettings,
): Map<string, LeaveCoverage> {
  const map = new Map<string, LeaveCoverage>()
  for (const leave of settings.leaves) {
    for (const key of eachDateKeyInRange(leave.start, leave.end)) {
      const existing = map.get(key)
      // Full leave wins over half-day if both somehow overlap
      if (existing?.portion === 'full') continue
      map.set(key, {
        note: leave.note || 'Leave',
        portion: leave.portion ?? 'full',
      })
    }
  }
  return map
}

/** @deprecated Prefer leaveCoverageByDate for portion-aware UI. */
export function leaveNoteByDate(settings: CalendarSettings): Map<string, string> {
  const map = new Map<string, string>()
  for (const [key, coverage] of leaveCoverageByDate(settings)) {
    const tag =
      coverage.portion === 'full'
        ? coverage.note
        : `${coverage.note} (${coverage.portion.toUpperCase()})`
    map.set(key, tag)
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

function normalizePortion(raw: unknown): LeavePortion {
  if (raw === 'am' || raw === 'pm' || raw === 'full') return raw
  return 'full'
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
    portion: normalizePortion(entry.portion),
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
    recurring: Boolean(entry.recurring),
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

const REWARD_KINDS: RewardKind[] = [
  'month_goal',
  'perfect_year',
  'streak_7',
  'streak_30',
  'streak_60',
  'streak_100',
  'first_office',
  'hybrid_balancer',
  'wfh_week',
  'office_week',
  'weekend_warrior',
  'early_bird',
  'clutch_finisher',
  'overachiever',
  'comeback',
  'office_streak_5',
  'office_streak_10',
  'office_streak_20',
  'no_gap_month',
  'quarter_champion',
  'half_year_hero',
  'century_club',
  'planner',
  'holiday_curator',
  'clean_calendar',
  'new_year_starter',
  'month_of_sundays',
  'night_owl',
]

function normalizeReward(raw: unknown): GoalReward | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Partial<GoalReward> & { monthKey?: string }
  const kind: RewardKind =
    entry.kind && REWARD_KINDS.includes(entry.kind) ? entry.kind : 'month_goal'

  let key =
    typeof entry.key === 'string' && entry.key
      ? entry.key
      : typeof entry.monthKey === 'string'
        ? entry.monthKey
        : ''

  if (kind === 'month_goal') {
    if (!/^\d{4}-\d{2}$/.test(key)) return null
  } else if (kind === 'perfect_year' || kind === 'half_year_hero' || kind === 'new_year_starter') {
    if (!/^\d{4}$/.test(key) && key !== kind) {
      if (kind === 'perfect_year' || kind === 'half_year_hero') {
        if (!/^\d{4}$/.test(key)) return null
      }
    }
  } else if (!key) {
    key = kind
  }

  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : newId(),
    kind,
    key: key || kind,
    monthKey: kind === 'month_goal' ? key : undefined,
    earnedAt:
      typeof entry.earnedAt === 'string' && entry.earnedAt
        ? entry.earnedAt
        : new Date().toISOString(),
  }
}

function normalizeActivity(raw: unknown): ActivityStreak {
  if (!raw || typeof raw !== 'object') {
    return { lastActiveDate: null, streak: 0, behindMonths: [] }
  }
  const source = raw as Partial<ActivityStreak>
  const lastActiveDate =
    typeof source.lastActiveDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(source.lastActiveDate)
      ? source.lastActiveDate
      : null
  const streak =
    typeof source.streak === 'number' && Number.isFinite(source.streak)
      ? Math.max(0, Math.round(source.streak))
      : 0
  const behindMonths = Array.isArray(source.behindMonths)
    ? source.behindMonths.filter(
        (v): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v),
      )
    : []
  return { lastActiveDate, streak, behindMonths }
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
  const rewards = Array.isArray(source.rewards)
    ? source.rewards
        .map(normalizeReward)
        .filter((v): v is GoalReward => v !== null)
        .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
    : []
  return {
    profile: normalizeProfile(source.profile),
    leaves,
    holidays,
    rewards,
    activity: normalizeActivity(source.activity),
  }
}

export function normalizeAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return emptyAppData()

  const record = raw as Record<string, unknown>
  if (looksLikeLegacyAttendance(record)) {
    return {
      attendance: record,
      settings: emptySettings(),
      finance: emptyFinance(),
    }
  }

  const attendance =
    record.attendance && typeof record.attendance === 'object'
      ? (record.attendance as Record<string, MonthAttendance>)
      : {}
  return {
    attendance,
    settings: normalizeSettings(record.settings),
    finance: normalizeFinance(record.finance),
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

export function isDayRecord(value: unknown): value is DayRecord {
  return Boolean(value && typeof value === 'object' && 'status' in (value as object))
}

/** Resolve attendance status from a legacy string or DayRecord. */
export function getDayStatus(
  days: Record<string, DayValue>,
  key: string,
): DayStatus {
  const value = days[key]
  if (value == null) return null
  if (value === 'office' || value === 'wfh') return value
  if (isDayRecord(value)) {
    return value.status === 'office' || value.status === 'wfh' ? value.status : null
  }
  return null
}

export function getDayRecord(
  days: Record<string, DayValue>,
  key: string,
): DayRecord {
  const value = days[key]
  if (value == null) return { status: null }
  if (value === 'office' || value === 'wfh') return { status: value }
  if (isDayRecord(value)) {
    const status =
      value.status === 'office' || value.status === 'wfh' ? value.status : null
    const note = typeof value.note === 'string' ? value.note.trim() : ''
    const summary =
      typeof value.summary === 'string' ? value.summary.trim() : ''
    return {
      status,
      ...(note ? { note } : {}),
      ...(summary ? { summary } : {}),
    }
  }
  return { status: null }
}

export function hasWorkStatus(
  days: Record<string, DayValue>,
  key: string,
): boolean {
  const record = getDayRecord(days, key)
  return Boolean(record.note || record.summary)
}

/** Compact storage: plain status when no note/summary; omit when empty. */
export function dayValueFromRecord(
  record: DayRecord,
): DayValue | undefined {
  const status =
    record.status === 'office' || record.status === 'wfh' ? record.status : null
  const note = record.note?.trim() || undefined
  const summary = record.summary?.trim() || undefined
  if (!status && !note && !summary) return undefined
  if (status && !note && !summary) return status
  return {
    status,
    ...(note ? { note } : {}),
    ...(summary ? { summary } : {}),
  }
}

/** Unmarked does not count; only explicit office status. */
export function isInOffice(status: DayStatus | undefined): boolean {
  return status === 'office'
}

/** Cycle: unmarked → office → WFH → unmarked */
export function cycleStatus(current: DayStatus): DayStatus {
  if (current === null) return 'office'
  if (current === 'office') return 'wfh'
  return null
}

export function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

/** Weekday that is not a holiday or full-day leave. */
export function isWorkingDay(
  date: Date,
  settings: CalendarSettings = emptySettings(),
): boolean {
  if (!isWeekday(date)) return false
  const key = toDateKey(date.getFullYear(), date.getMonth(), date.getDate())
  const holidays = holidayNameByDate(
    settings,
    date.getFullYear(),
    date.getMonth(),
  )
  if (holidays.has(key)) return false
  const leave = leaveCoverageByDate(settings).get(key)
  if (leave?.portion === 'full') return false
  return true
}

/**
 * Most recent working day strictly before `from`
 * (skips Sat/Sun, holidays, and full leave).
 */
export function findPreviousWorkingDay(
  settings: CalendarSettings = emptySettings(),
  from: Date = startOfToday(),
): Date | null {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  cursor.setDate(cursor.getDate() - 1)

  for (let i = 0; i < 31; i++) {
    if (isWorkingDay(cursor, settings)) {
      return new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
      )
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return null
}

/**
 * If the previous working day is unmarked, set it to WFH.
 * Returns updated app data, or null when nothing changed.
 */
export function autoMarkPreviousWorkingDayWfh(
  data: AppData,
  today: Date = startOfToday(),
): AppData | null {
  const prev = findPreviousWorkingDay(data.settings, today)
  if (!prev) return null

  const y = prev.getFullYear()
  const m = prev.getMonth()
  const d = prev.getDate()
  const dateKey = toDateKey(y, m, d)
  const monthKey = monthStorageKey(y, m)
  const monthAtt = getMonthAttendance(data.attendance, y, m)
  const current = getDayStatus(monthAtt.days, dateKey)

  if (current === 'office' || current === 'wfh') return null

  return {
    ...data,
    attendance: {
      ...data.attendance,
      [monthKey]: {
        year: y,
        month: m,
        days: {
          ...monthAtt.days,
          [dateKey]: 'wfh',
        },
      },
    },
  }
}

/** Weekdays from today through month end, excluding full leave and holidays. */
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
  const blocked = blockedDateKeys(settings, year, month)

  let count = 0
  for (let day = startDay; day <= total; day++) {
    const date = new Date(year, month, day)
    if (!isWeekday(date)) continue
    if (blocked.has(toDateKey(year, month, day))) continue
    count += 1
  }
  return count
}

/** All weekdays in the month, excluding full leave and holidays. */
export function countWorkingDaysInMonth(
  year: number,
  month: number,
  settings: CalendarSettings = emptySettings(),
): number {
  const total = daysInMonth(year, month)
  const blocked = blockedDateKeys(settings, year, month)
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

function startOfWeekSunday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay())
  return d
}

/** Office days in the calendar week (Sun–Sat) that contains `today`. */
export function countWeekOfficeDays(
  attendanceMap: Record<string, MonthAttendance>,
  today: Date = startOfToday(),
): number {
  const start = startOfWeekSunday(today)
  let count = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const monthAtt = getMonthAttendance(
      attendanceMap,
      d.getFullYear(),
      d.getMonth(),
    )
    const key = toDateKey(d.getFullYear(), d.getMonth(), d.getDate())
    if (isInOffice(getDayStatus(monthAtt.days, key))) count += 1
  }
  return count
}

/**
 * Consecutive office days ending on the most recent day that is today or earlier.
 * Skips weekends/full-leave/holidays without breaking the streak; unmarked/WFH breaks it.
 */
export function computeOfficeStreak(
  attendanceMap: Record<string, MonthAttendance>,
  settings: CalendarSettings = emptySettings(),
  today: Date = startOfToday(),
): number {
  let streak = 0
  const cursor = new Date(today)

  for (let i = 0; i < 366; i++) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const day = cursor.getDate()
    const key = toDateKey(y, m, day)
    const holidays = holidayNameByDate(settings, y, m)
    const leaves = leaveCoverageByDate(settings)
    const leave = leaves.get(key)

    if (!isWeekday(cursor) || holidays.has(key) || leave?.portion === 'full') {
      cursor.setDate(cursor.getDate() - 1)
      continue
    }

    const monthAtt = getMonthAttendance(attendanceMap, y, m)
    if (isInOffice(getDayStatus(monthAtt.days, key))) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    break
  }

  return streak
}

function buildPaceNote(
  daysLeftToGoal: number,
  workingDaysRemaining: number,
  canHitGoal: boolean,
  viewingPast: boolean,
): string {
  if (viewingPast) {
    return daysLeftToGoal === 0 ? 'Goal met for this month' : 'Month ended'
  }
  if (daysLeftToGoal === 0) return 'Goal reached — nice work'
  if (!canHitGoal) {
    return `Cannot hit goal — need ${daysLeftToGoal} more with ${workingDaysRemaining} working day${workingDaysRemaining === 1 ? '' : 's'} left`
  }
  if (daysLeftToGoal === workingDaysRemaining) {
    return `On the edge — office every remaining working day`
  }
  return `On pace — ${workingDaysRemaining - daysLeftToGoal} buffer day${workingDaysRemaining - daysLeftToGoal === 1 ? '' : 's'}`
}

export function computeStats(
  attendance: MonthAttendance,
  settings: CalendarSettings = emptySettings(),
  today: Date = startOfToday(),
  allAttendance: Record<string, MonthAttendance> = {},
): MonthStats {
  const { year, month, days } = attendance
  const totalDaysInMonth = daysInMonth(year, month)
  const goal = resolveOfficeGoal(year, month, settings)

  let daysInOffice = 0
  let daysWfh = 0
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const key = toDateKey(year, month, day)
    const status = getDayStatus(days, key)
    if (status === 'office') daysInOffice += 1
    else if (status === 'wfh') daysWfh += 1
  }

  const daysLeftToGoal = Math.max(0, goal - daysInOffice)
  const workingDaysRemaining = countWorkingDaysRemaining(
    year,
    month,
    settings,
    today,
  )
  const monthEnd = new Date(year, month, totalDaysInMonth)
  const viewingPast = monthEnd.getTime() < today.getTime()
  const canHitGoal = viewingPast
    ? daysLeftToGoal === 0
    : daysLeftToGoal <= workingDaysRemaining

  const mapForInsights =
    Object.keys(allAttendance).length > 0
      ? allAttendance
      : { [monthStorageKey(year, month)]: attendance }

  return {
    daysInOffice,
    daysWfh,
    totalDaysInMonth,
    daysLeftToGoal,
    workingDaysRemaining,
    canHitGoal,
    paceNote: buildPaceNote(
      daysLeftToGoal,
      workingDaysRemaining,
      canHitGoal,
      viewingPast,
    ),
    weekOfficeDays: countWeekOfficeDays(mapForInsights, today),
    officeStreak: computeOfficeStreak(mapForInsights, settings, today),
  }
}

export { DEFAULT_OFFICE_GOAL }
