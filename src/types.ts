export type DayStatus = 'office' | 'wfh' | null

export type LeavePortion = 'full' | 'am' | 'pm'

export type MonthAttendance = {
  year: number
  month: number // 0–11
  days: Record<string, DayStatus>
}

export type LeaveEntry = {
  id: string
  start: string // YYYY-MM-DD
  end: string
  note: string
  /** Full day locks the cell; AM/PM leave still allows office/WFH marking. */
  portion: LeavePortion
}

export type HolidayEntry = {
  id: string
  date: string // YYYY-MM-DD (MM-DD reused each year when recurring)
  name: string
  recurring?: boolean
}

export type UserProfile = {
  name: string
  email: string
  role: string
  /** When true, monthly goal is every working day (weekdays minus leave/holidays). */
  goDaily: boolean
  /** Required office days per month when goDaily is false. */
  officeDaysGoal: number
}

export type CalendarSettings = {
  profile: UserProfile
  leaves: LeaveEntry[]
  holidays: HolidayEntry[]
}

export type AppData = {
  attendance: Record<string, MonthAttendance>
  settings: CalendarSettings
}

export type MonthStats = {
  daysInOffice: number
  daysWfh: number
  totalDaysInMonth: number
  daysLeftToGoal: number
  workingDaysRemaining: number
  canHitGoal: boolean
  paceNote: string
  weekOfficeDays: number
  officeStreak: number
}

export type AuthUser = {
  id: string
  email: string
  name: string
}
