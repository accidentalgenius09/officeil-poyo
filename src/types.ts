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

export type FinanceTxnKind = 'income' | 'expense'

export type FinanceTransaction = {
  id: string
  kind: FinanceTxnKind
  amount: number
  category: string
  note: string
  date: string // YYYY-MM-DD
  createdAt: string // ISO
  /** Dedupes auto salary / EMI posts, e.g. recurring:salary:2026-09 */
  sourceKey?: string
}

export type FinanceAllowance = {
  id: string
  label: string
  amount: number
}

export type FinanceSalary = {
  id: string
  /** Label e.g. Primary job, Freelance retainer */
  name: string
  enabled: boolean
  /** Base / fixed salary amount */
  fixedAmount: number
  /** Day of month (1–31); clamped to last day when the month is shorter */
  payday: number
  allowances: FinanceAllowance[]
}

export type FinanceEmi = {
  id: string
  name: string
  amount: number
  /** Day of month (1–31) when EMI is due */
  dayOfMonth: number
  enabled: boolean
  /** Optional YYYY-MM when EMI starts (inclusive) */
  startMonth?: string
  /** Optional YYYY-MM when EMI ends (inclusive) */
  endMonth?: string
}

export type FinanceInvestmentFrequency = 'weekly' | 'monthly'

export type FinanceInvestment = {
  id: string
  /** e.g. Nippon Index Fund, Gold ETF SIP */
  name: string
  amount: number
  frequency: FinanceInvestmentFrequency
  /**
   * Monthly: day of month (1–31).
   * Weekly: weekday (0=Sun … 6=Sat), matching Date.getDay().
   */
  day: number
  enabled: boolean
}

/** General recurring expense (rent, subscriptions, etc.) from Overview */
export type FinanceRecurringExpense = {
  id: string
  name: string
  amount: number
  category: string
  frequency: FinanceInvestmentFrequency
  /** Monthly: day of month 1–31; weekly: weekday 0–6 */
  day: number
  enabled: boolean
}

export type FinanceCustomCategories = {
  income: string[]
  expense: string[]
}

export type FinanceData = {
  currency: string
  transactions: FinanceTransaction[]
  /** One or more salaries, each with its own payday */
  salaries: FinanceSalary[]
  emis: FinanceEmi[]
  /** Recurring SIPs / mutual fund investments */
  investments: FinanceInvestment[]
  /** Recurring expenses created from Overview */
  recurringExpenses: FinanceRecurringExpense[]
  customCategories: FinanceCustomCategories
}

export type AppData = {
  attendance: Record<string, MonthAttendance>
  settings: CalendarSettings
  finance?: FinanceData
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
