export type DayStatus = 'office' | 'wfh' | null

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
}

export type HolidayEntry = {
  id: string
  date: string // YYYY-MM-DD
  name: string
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
  totalDaysInMonth: number
  daysLeftToGoal: number
  workingDaysRemaining: number
}
