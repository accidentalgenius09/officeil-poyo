export type DayStatus = 'office' | 'wfh' | null

/** Per-day attendance, optionally with a short note and AI summary. */
export type DayRecord = {
  status: DayStatus
  note?: string
  summary?: string
}

export type DayValue = DayStatus | DayRecord

export type LeavePortion = 'full' | 'am' | 'pm'

export type MonthAttendance = {
  year: number
  month: number // 0–11
  /** Legacy days store plain status strings; notes use DayRecord. */
  days: Record<string, DayValue>
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

export type RewardKind =
  | 'month_goal'
  | 'perfect_year'
  | 'streak_7'
  | 'streak_30'
  | 'streak_60'
  | 'streak_100'
  | 'first_office'
  | 'hybrid_balancer'
  | 'wfh_week'
  | 'office_week'
  | 'weekend_warrior'
  | 'early_bird'
  | 'clutch_finisher'
  | 'overachiever'
  | 'comeback'
  | 'office_streak_5'
  | 'office_streak_10'
  | 'office_streak_20'
  | 'no_gap_month'
  | 'quarter_champion'
  | 'half_year_hero'
  | 'century_club'
  | 'planner'
  | 'holiday_curator'
  | 'clean_calendar'
  | 'new_year_starter'
  | 'month_of_sundays'
  | 'night_owl'

/** Badge earned for goals, streaks, and achievements. */
export type GoalReward = {
  id: string
  kind: RewardKind
  /**
   * month_goal / monthly badges → YYYY-MM
   * perfect_year / half_year → YYYY
   * quarter_champion → YYYY-Qn
   * once badges → kind string
   * week badges → week-start YYYY-MM-DD
   */
  key: string
  earnedAt: string // ISO
  /** @deprecated legacy month_goal field — mirrored into key */
  monthKey?: string
}

/** Daily logging streak for consecutive days with calendar updates. */
export type ActivityStreak = {
  lastActiveDate: string | null // YYYY-MM-DD
  streak: number
  /** Month keys where pace became impossible (for Comeback badge). */
  behindMonths: string[]
}

export type CalendarSettings = {
  profile: UserProfile
  leaves: LeaveEntry[]
  holidays: HolidayEntry[]
  rewards: GoalReward[]
  activity: ActivityStreak
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
