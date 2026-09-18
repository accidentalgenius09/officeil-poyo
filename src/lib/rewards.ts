import type {
  ActivityStreak,
  AppData,
  CalendarSettings,
  GoalReward,
  MonthAttendance,
  RewardKind,
} from '../types'
import {
  blockedDateKeys,
  computeOfficeStreak,
  countWorkingDaysInMonth,
  daysInMonth,
  getDayStatus,
  getMonthAttendance,
  isWeekday,
  isWorkingDay,
  monthStorageKey,
  resolveOfficeGoal,
  startOfToday,
  toDateKey,
} from './attendance'

export type GameRewardTheme = 'default' | 'gold' | 'aurora'

const CELEBRATED_KEY = 'office-visit-goal-celebrated'

export const STREAK_MILESTONES: {
  days: number
  kind: RewardKind
  title: string
}[] = [
  { days: 7, kind: 'streak_7', title: '7-day logger' },
  { days: 30, kind: 'streak_30', title: '30-day logger' },
  { days: 60, kind: 'streak_60', title: '60-day logger' },
  { days: 100, kind: 'streak_100', title: '100-day logger' },
]

export const OFFICE_STREAK_MILESTONES: {
  days: number
  kind: RewardKind
  title: string
}[] = [
  { days: 5, kind: 'office_streak_5', title: 'Office streak 5' },
  { days: 10, kind: 'office_streak_10', title: 'Office streak 10' },
  { days: 20, kind: 'office_streak_20', title: 'Office streak 20' },
]

export const ALL_REWARD_KINDS: RewardKind[] = [
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

const BADGE_META: Record<
  RewardKind,
  { title: string; subtitle: string }
> = {
  month_goal: { title: 'Monthly goal', subtitle: 'Hit monthly office goal' },
  perfect_year: {
    title: 'Perfect year',
    subtitle: 'Hit the goal every month this year',
  },
  streak_7: {
    title: '7-day logger',
    subtitle: 'Updated the calendar 7 days in a row',
  },
  streak_30: {
    title: '30-day logger',
    subtitle: 'Updated the calendar 30 days in a row',
  },
  streak_60: {
    title: '60-day logger',
    subtitle: 'Updated the calendar 60 days in a row',
  },
  streak_100: {
    title: '100-day logger',
    subtitle: 'Updated the calendar 100 days in a row',
  },
  first_office: {
    title: 'First office day',
    subtitle: 'Marked your first day in office',
  },
  hybrid_balancer: {
    title: 'Hybrid balancer',
    subtitle: 'At least 4 office and 4 WFH days in one month',
  },
  wfh_week: {
    title: 'WFH week',
    subtitle: '5 WFH days in a single calendar week',
  },
  office_week: {
    title: 'Office week',
    subtitle: '5 office days in a single calendar week',
  },
  weekend_warrior: {
    title: 'Weekend warrior',
    subtitle: 'Marked attendance on a Saturday or Sunday',
  },
  early_bird: {
    title: 'Early bird',
    subtitle: 'Hit the monthly goal on or before the 15th',
  },
  clutch_finisher: {
    title: 'Clutch finisher',
    subtitle: 'Hit the goal on the last working day of the month',
  },
  overachiever: {
    title: 'Overachiever',
    subtitle: 'Finished a month at least 3 office days over goal',
  },
  comeback: {
    title: 'Comeback',
    subtitle: 'Hit the goal after pace said it was impossible',
  },
  office_streak_5: {
    title: 'Office streak 5',
    subtitle: '5 consecutive office working days',
  },
  office_streak_10: {
    title: 'Office streak 10',
    subtitle: '10 consecutive office working days',
  },
  office_streak_20: {
    title: 'Office streak 20',
    subtitle: '20 consecutive office working days',
  },
  no_gap_month: {
    title: 'No-gap month',
    subtitle: 'Every working day marked office or WFH',
  },
  quarter_champion: {
    title: 'Quarter champion',
    subtitle: 'Hit the goal in all 3 months of a quarter',
  },
  half_year_hero: {
    title: 'Half-year hero',
    subtitle: 'Hit the goal in 6 months of one year',
  },
  century_club: {
    title: 'Century club',
    subtitle: '100 office days all-time',
  },
  planner: {
    title: 'Planner',
    subtitle: 'Added leave at least 7 days in advance',
  },
  holiday_curator: {
    title: 'Holiday curator',
    subtitle: 'Added 5 or more holidays',
  },
  clean_calendar: {
    title: 'Clean calendar',
    subtitle: 'No-gap month with leave or holidays planned',
  },
  new_year_starter: {
    title: 'New Year starter',
    subtitle: 'Marked attendance on the first working day of the year',
  },
  month_of_sundays: {
    title: 'Month of Sundays',
    subtitle: 'Hit the goal in a month with 5 Sundays',
  },
  night_owl: {
    title: 'Night owl',
    subtitle: 'Updated attendance after 9 PM',
  },
}

export function emptyActivity(): ActivityStreak {
  return { lastActiveDate: null, streak: 0, behindMonths: [] }
}

export function emptyRewards(): GoalReward[] {
  return []
}

export function rewardKind(reward: GoalReward): RewardKind {
  return reward.kind ?? 'month_goal'
}

export function rewardKey(reward: GoalReward): string {
  return reward.key || reward.monthKey || ''
}

export function rewardYearFromKey(key: string): number | null {
  const yearOnly = /^(\d{4})$/.exec(key)
  if (yearOnly) return Number(yearOnly[1])
  const monthKey = /^(\d{4})-\d{2}$/.exec(key)
  if (monthKey) return Number(monthKey[1])
  const dateKey = /^(\d{4})-\d{2}-\d{2}$/.exec(key)
  if (dateKey) return Number(dateKey[1])
  const quarter = /^(\d{4})-Q[1-4]$/.exec(key)
  if (quarter) return Number(quarter[1])
  return null
}

export function monthGoalRewardsForYear(
  rewards: GoalReward[],
  year: number,
): GoalReward[] {
  return rewards.filter(
    (r) =>
      rewardKind(r) === 'month_goal' &&
      rewardYearFromKey(rewardKey(r)) === year,
  )
}

export function rewardsForYear(
  rewards: GoalReward[],
  year: number,
): GoalReward[] {
  return monthGoalRewardsForYear(rewards, year)
}

export function hasReward(
  rewards: GoalReward[],
  kind: RewardKind,
  key: string,
): boolean {
  return rewards.some((r) => rewardKind(r) === kind && rewardKey(r) === key)
}

function sortRewards(rewards: GoalReward[]): GoalReward[] {
  return [...rewards].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
}

function makeBadge(kind: RewardKind, key: string): GoalReward {
  return {
    id: `${kind}:${key}`,
    kind,
    key,
    monthKey: kind === 'month_goal' ? key : undefined,
    earnedAt: new Date().toISOString(),
  }
}

function tryAdd(
  rewards: GoalReward[],
  added: GoalReward[],
  kind: RewardKind,
  key: string,
): GoalReward[] {
  if (hasReward(rewards, kind, key)) return rewards
  const badge = makeBadge(kind, key)
  added.push(badge)
  return [...rewards, badge]
}

export function withMonthReward(
  rewards: GoalReward[],
  year: number,
  month: number,
): { rewards: GoalReward[]; added: GoalReward | null } {
  const key = monthStorageKey(year, month)
  if (hasReward(rewards, 'month_goal', key)) {
    return { rewards, added: null }
  }
  const added = makeBadge('month_goal', key)
  return { rewards: sortRewards([...rewards, added]), added }
}

export function withPerfectYearReward(
  rewards: GoalReward[],
  year: number,
): { rewards: GoalReward[]; added: GoalReward | null } {
  const yearKey = String(year)
  if (hasReward(rewards, 'perfect_year', yearKey)) {
    return { rewards, added: null }
  }
  if (monthGoalRewardsForYear(rewards, year).length < 12) {
    return { rewards, added: null }
  }
  const added = makeBadge('perfect_year', yearKey)
  return { rewards: sortRewards([...rewards, added]), added }
}

export function recordDailyActivity(
  activity: ActivityStreak,
  today: Date = startOfToday(),
): { activity: ActivityStreak; streak: number; changed: boolean } {
  const todayKey = toDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const behindMonths = Array.isArray(activity.behindMonths)
    ? activity.behindMonths
    : []

  if (activity.lastActiveDate === todayKey) {
    return {
      activity: { ...activity, behindMonths },
      streak: activity.streak,
      changed: false,
    }
  }

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = toDateKey(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
  )

  const nextStreak =
    activity.lastActiveDate === yesterdayKey
      ? Math.max(1, activity.streak) + 1
      : 1

  return {
    activity: {
      lastActiveDate: todayKey,
      streak: nextStreak,
      behindMonths,
    },
    streak: nextStreak,
    changed: true,
  }
}

export function markMonthBehind(
  activity: ActivityStreak,
  year: number,
  month: number,
): ActivityStreak {
  const key = monthStorageKey(year, month)
  const behindMonths = Array.isArray(activity.behindMonths)
    ? activity.behindMonths
    : []
  if (behindMonths.includes(key)) return activity
  return { ...activity, behindMonths: [...behindMonths, key] }
}

export function withStreakRewards(
  rewards: GoalReward[],
  streak: number,
  _unlockedOn: string,
): { rewards: GoalReward[]; added: GoalReward[] } {
  const added: GoalReward[] = []
  let next = rewards
  for (const milestone of STREAK_MILESTONES) {
    if (streak < milestone.days) continue
    next = tryAdd(next, added, milestone.kind, milestone.kind)
  }
  return { rewards: sortRewards(next), added }
}

function countSundaysInMonth(year: number, month: number): number {
  const total = daysInMonth(year, month)
  let count = 0
  for (let day = 1; day <= total; day++) {
    if (new Date(year, month, day).getDay() === 0) count += 1
  }
  return count
}

function lastWorkingDayOfMonth(
  year: number,
  month: number,
  settings: CalendarSettings,
): Date | null {
  const total = daysInMonth(year, month)
  for (let day = total; day >= 1; day--) {
    const date = new Date(year, month, day)
    if (isWorkingDay(date, settings)) return date
  }
  return null
}

function startOfWeekSunday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay())
  return d
}

function weekKey(date: Date): string {
  const start = startOfWeekSunday(date)
  return toDateKey(start.getFullYear(), start.getMonth(), start.getDate())
}

function countStatusInWeek(
  attendance: Record<string, MonthAttendance>,
  weekStart: Date,
  status: 'office' | 'wfh',
): number {
  let count = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const att = getMonthAttendance(
      attendance,
      d.getFullYear(),
      d.getMonth(),
    )
    const key = toDateKey(d.getFullYear(), d.getMonth(), d.getDate())
    if (getDayStatus(att.days, key) === status) count += 1
  }
  return count
}

function countOfficeAllTime(
  attendance: Record<string, MonthAttendance>,
): number {
  let count = 0
  for (const month of Object.values(attendance)) {
    for (const key of Object.keys(month.days)) {
      if (getDayStatus(month.days, key) === 'office') count += 1
    }
  }
  return count
}

function monthHasNoGaps(
  year: number,
  month: number,
  data: AppData,
): boolean {
  const total = daysInMonth(year, month)
  const att = getMonthAttendance(data.attendance, year, month)
  for (let day = 1; day <= total; day++) {
    const date = new Date(year, month, day)
    if (!isWorkingDay(date, data.settings)) continue
    const key = toDateKey(year, month, day)
    const status = getDayStatus(att.days, key)
    if (status !== 'office' && status !== 'wfh') return false
  }
  return true
}

function monthHasLeaveOrHoliday(
  year: number,
  month: number,
  settings: CalendarSettings,
): boolean {
  const prefix = monthStorageKey(year, month)
  for (const holiday of settings.holidays) {
    if (holiday.recurring) {
      const md = holiday.date.slice(5)
      if (`${year}-${md}`.startsWith(prefix)) return true
    } else if (holiday.date.startsWith(prefix)) {
      return true
    }
  }
  for (const leave of settings.leaves) {
    if (leave.start.slice(0, 7) <= prefix && leave.end.slice(0, 7) >= prefix) {
      return true
    }
  }
  return false
}

function firstWorkingDayOfYear(
  year: number,
  settings: CalendarSettings,
): Date | null {
  for (let month = 0; month < 12; month++) {
    const total = daysInMonth(year, month)
    for (let day = 1; day <= total; day++) {
      const date = new Date(year, month, day)
      if (isWorkingDay(date, settings)) return date
    }
  }
  return null
}

function quarterKey(year: number, month: number): string {
  const q = Math.floor(month / 3) + 1
  return `${year}-Q${q}`
}

function monthsInQuarter(year: number, quarter: number): string[] {
  const start = (quarter - 1) * 3
  return [0, 1, 2].map((i) => monthStorageKey(year, start + i))
}

export type AchievementContext = {
  today?: Date
  /** Local hour 0–23 when the user just updated (for night owl). */
  localHour?: number
  /** Year/month currently being edited. */
  focusYear?: number
  focusMonth?: number
}

/**
 * Evaluate all achievement badges against current app data.
 * Returns updated rewards list and newly earned badges.
 */
export function evaluateAchievementBadges(
  data: AppData,
  context: AchievementContext = {},
): { rewards: GoalReward[]; added: GoalReward[]; activity: ActivityStreak } {
  const today = context.today ?? startOfToday()
  const added: GoalReward[] = []
  let rewards = [...(data.settings.rewards ?? [])]
  let activity = {
    ...(data.settings.activity ?? emptyActivity()),
    behindMonths: data.settings.activity?.behindMonths ?? [],
  }

  const focusYear = context.focusYear ?? today.getFullYear()
  const focusMonth = context.focusMonth ?? today.getMonth()
  const focusKey = monthStorageKey(focusYear, focusMonth)
  const focusAtt = getMonthAttendance(
    data.attendance,
    focusYear,
    focusMonth,
  )
  const goal = resolveOfficeGoal(focusYear, focusMonth, data.settings)

  let office = 0
  let wfh = 0
  for (const key of Object.keys(focusAtt.days)) {
    const status = getDayStatus(focusAtt.days, key)
    if (status === 'office') office += 1
    if (status === 'wfh') wfh += 1
  }

  // Track behind pace for comeback
  const daysLeft = Math.max(0, goal - office)
  const remaining = (() => {
    const total = daysInMonth(focusYear, focusMonth)
    const blocked = blockedDateKeys(
      data.settings,
      focusYear,
      focusMonth,
    )
    const sameMonth =
      today.getFullYear() === focusYear && today.getMonth() === focusMonth
    const startDay = sameMonth ? today.getDate() : 1
    let count = 0
    for (let day = startDay; day <= total; day++) {
      const date = new Date(focusYear, focusMonth, day)
      if (!isWeekday(date)) continue
      if (blocked.has(toDateKey(focusYear, focusMonth, day))) continue
      count += 1
    }
    return count
  })()
  const canHit = daysLeft <= remaining
  if (!canHit && daysLeft > 0) {
    activity = markMonthBehind(activity, focusYear, focusMonth)
  }

  // first_office
  if (countOfficeAllTime(data.attendance) >= 1) {
    rewards = tryAdd(rewards, added, 'first_office', 'first_office')
  }

  // century_club
  if (countOfficeAllTime(data.attendance) >= 100) {
    rewards = tryAdd(rewards, added, 'century_club', 'century_club')
  }

  // hybrid_balancer
  if (office >= 4 && wfh >= 4) {
    rewards = tryAdd(rewards, added, 'hybrid_balancer', focusKey)
  }

  // weekend_warrior
  for (const [dateKey, status] of Object.entries(focusAtt.days)) {
    if (status !== 'office' && status !== 'wfh') continue
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
    if (!match) continue
    const dow = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    ).getDay()
    if (dow === 0 || dow === 6) {
      rewards = tryAdd(rewards, added, 'weekend_warrior', 'weekend_warrior')
      break
    }
  }

  // week badges around today and focus date
  for (const anchor of [today, new Date(focusYear, focusMonth, Math.min(28, today.getDate()))]) {
    const start = startOfWeekSunday(anchor)
    const wk = weekKey(anchor)
    if (countStatusInWeek(data.attendance, start, 'wfh') >= 5) {
      rewards = tryAdd(rewards, added, 'wfh_week', wk)
    }
    if (countStatusInWeek(data.attendance, start, 'office') >= 5) {
      rewards = tryAdd(rewards, added, 'office_week', wk)
    }
  }

  // office streaks
  const officeStreak = computeOfficeStreak(
    data.attendance,
    data.settings,
    today,
  )
  for (const milestone of OFFICE_STREAK_MILESTONES) {
    if (officeStreak >= milestone.days) {
      rewards = tryAdd(rewards, added, milestone.kind, milestone.kind)
    }
  }

  // night owl
  if (
    typeof context.localHour === 'number' &&
    context.localHour >= 21
  ) {
    rewards = tryAdd(rewards, added, 'night_owl', 'night_owl')
  }

  // new year starter
  const firstWork = firstWorkingDayOfYear(today.getFullYear(), data.settings)
  if (firstWork) {
    const firstKey = toDateKey(
      firstWork.getFullYear(),
      firstWork.getMonth(),
      firstWork.getDate(),
    )
    const firstAtt = getMonthAttendance(
      data.attendance,
      firstWork.getFullYear(),
      firstWork.getMonth(),
    )
    const status = getDayStatus(firstAtt.days, firstKey)
    if (status === 'office' || status === 'wfh') {
      rewards = tryAdd(
        rewards,
        added,
        'new_year_starter',
        String(today.getFullYear()),
      )
    }
  }

  // planner
  const todayKey = toDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  for (const leave of data.settings.leaves) {
    const start = leave.start
    if (start >= todayKey) {
      const startDate = new Date(
        Number(start.slice(0, 4)),
        Number(start.slice(5, 7)) - 1,
        Number(start.slice(8, 10)),
      )
      const diffMs = startDate.getTime() - today.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays >= 7) {
        rewards = tryAdd(rewards, added, 'planner', 'planner')
        break
      }
    }
  }

  // holiday curator
  if (data.settings.holidays.length >= 5) {
    rewards = tryAdd(rewards, added, 'holiday_curator', 'holiday_curator')
  }

  // Month-complete badges (goal / gaps) — evaluate focus month and current month
  const monthsToCheck = new Set([focusKey])
  monthsToCheck.add(
    monthStorageKey(today.getFullYear(), today.getMonth()),
  )

  for (const monthKey of monthsToCheck) {
    const y = Number(monthKey.slice(0, 4))
    const m = Number(monthKey.slice(5, 7)) - 1
    const att = getMonthAttendance(data.attendance, y, m)
    let monthOffice = 0
    for (const key of Object.keys(att.days)) {
      if (getDayStatus(att.days, key) === 'office') monthOffice += 1
    }
    const monthGoal = resolveOfficeGoal(y, m, data.settings)
    const goalMet = monthOffice >= monthGoal && monthGoal > 0

    if (goalMet) {
      const inMonth =
        today.getFullYear() === y && today.getMonth() === m

      if (inMonth && today.getDate() <= 15) {
        rewards = tryAdd(rewards, added, 'early_bird', monthKey)
      }

      const lastWork = lastWorkingDayOfMonth(y, m, data.settings)
      if (
        lastWork &&
        inMonth &&
        today.getFullYear() === lastWork.getFullYear() &&
        today.getMonth() === lastWork.getMonth() &&
        today.getDate() === lastWork.getDate()
      ) {
        rewards = tryAdd(rewards, added, 'clutch_finisher', monthKey)
      }

      if (monthOffice >= monthGoal + 3) {
        rewards = tryAdd(rewards, added, 'overachiever', monthKey)
      }

      if (activity.behindMonths.includes(monthKey)) {
        rewards = tryAdd(rewards, added, 'comeback', monthKey)
      }

      if (countSundaysInMonth(y, m) >= 5) {
        rewards = tryAdd(rewards, added, 'month_of_sundays', monthKey)
      }
    }

    if (monthHasNoGaps(y, m, data)) {
      rewards = tryAdd(rewards, added, 'no_gap_month', monthKey)
      if (monthHasLeaveOrHoliday(y, m, data.settings)) {
        rewards = tryAdd(rewards, added, 'clean_calendar', monthKey)
      }
    }
  }

  // half-year hero & quarter champion from month goals
  for (const year of [
    today.getFullYear(),
    focusYear,
    today.getFullYear() - 1,
  ]) {
    const goals = monthGoalRewardsForYear(rewards, year)
    if (goals.length >= 6) {
      rewards = tryAdd(rewards, added, 'half_year_hero', String(year))
    }
    for (let q = 1; q <= 4; q++) {
      const needed = monthsInQuarter(year, q)
      const hit = needed.every((mk) =>
        hasReward(rewards, 'month_goal', mk),
      )
      if (hit) {
        rewards = tryAdd(
          rewards,
          added,
          'quarter_champion',
          quarterKey(year, (q - 1) * 3),
        )
      }
    }
  }

  // Also include month goals already present for quarter check after withMonthReward
  void countWorkingDaysInMonth

  return {
    rewards: sortRewards(rewards),
    added,
    activity,
  }
}

export function resolveGameRewardTheme(
  monthGoalCount: number,
): GameRewardTheme {
  if (monthGoalCount >= 3) return 'aurora'
  if (monthGoalCount >= 1) return 'gold'
  return 'default'
}

export function gameRewardThemeLabel(theme: GameRewardTheme): string {
  if (theme === 'aurora') return 'Aurora console'
  if (theme === 'gold') return 'Gold console'
  return 'Standard console'
}

function loadCelebrated(): Set<string> {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

const celebratedThisPageLoad = new Set<string>()

function celebrationKeys(badge: Pick<GoalReward, 'id' | 'kind' | 'key'>): string[] {
  const kindKey = `${badge.kind}:${badge.key}`
  return badge.id === kindKey ? [kindKey] : [kindKey, badge.id]
}

export function wasGoalCelebrated(idOrBadge: string | Pick<GoalReward, 'id' | 'kind' | 'key'>): boolean {
  const keys =
    typeof idOrBadge === 'string' ? [idOrBadge] : celebrationKeys(idOrBadge)
  if (keys.some((k) => celebratedThisPageLoad.has(k))) return true
  const stored = loadCelebrated()
  return keys.some((k) => stored.has(k))
}

export function markGoalCelebrated(idOrBadge: string | Pick<GoalReward, 'id' | 'kind' | 'key'>): void {
  const keys =
    typeof idOrBadge === 'string' ? [idOrBadge] : celebrationKeys(idOrBadge)
  const set = loadCelebrated()
  for (const k of keys) {
    celebratedThisPageLoad.add(k)
    set.add(k)
  }
  localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...set]))
}

/** Claim a one-time celebration toast; false if already shown (Strict Mode safe). */
export function claimGoalCelebration(
  badge: Pick<GoalReward, 'id' | 'kind' | 'key'>,
): boolean {
  if (wasGoalCelebrated(badge)) return false
  markGoalCelebrated(badge)
  return true
}

export function rewardToastId(badge: Pick<GoalReward, 'kind' | 'key'>): string {
  return `badge-${badge.kind}-${badge.key}`
}

export function rewardTitle(reward: GoalReward): string {
  const kind = rewardKind(reward)
  const key = rewardKey(reward)
  if (kind === 'month_goal') {
    const match = /^(\d{4})-(\d{2})$/.exec(key)
    if (!match) return BADGE_META.month_goal.title
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    return new Date(year, month, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  }
  if (kind === 'perfect_year') return `Perfect year ${key}`
  if (kind === 'quarter_champion') return `Quarter champion ${key}`
  if (kind === 'half_year_hero') return `Half-year hero ${key}`
  if (kind === 'new_year_starter') return `New Year starter ${key}`
  return BADGE_META[kind]?.title ?? kind
}

export function rewardSubtitle(reward: GoalReward): string {
  const kind = rewardKind(reward)
  return BADGE_META[kind]?.subtitle ?? 'Special badge'
}

export function formatRewardEarnedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function specialRewards(rewards: GoalReward[]): GoalReward[] {
  return sortRewards(rewards.filter((r) => rewardKind(r) !== 'month_goal'))
}

export function groupMonthRewardsByYear(
  rewards: GoalReward[],
): { year: number; rewards: GoalReward[] }[] {
  const map = new Map<number, GoalReward[]>()
  for (const reward of rewards) {
    if (rewardKind(reward) !== 'month_goal') continue
    const year = rewardYearFromKey(rewardKey(reward))
    if (year === null) continue
    const list = map.get(year) ?? []
    list.push(reward)
    map.set(year, list)
  }

  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({
      year,
      rewards: [...list].sort((a, b) =>
        rewardKey(b).localeCompare(rewardKey(a)),
      ),
    }))
}

export function groupRewardsByYear(rewards: GoalReward[]) {
  return groupMonthRewardsByYear(rewards)
}

export function rewardMonthLabel(monthKey: string): string {
  return rewardTitle({
    id: '',
    kind: 'month_goal',
    key: monthKey,
    monthKey,
    earnedAt: '',
  })
}

export function rewardsFromSettings(settings: CalendarSettings): GoalReward[] {
  return settings.rewards ?? []
}

export function nextStreakMilestone(streak: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (streak < m.days) return m.days
  }
  return null
}

export function celebrateNewBadges(added: GoalReward[]): void {
  for (const badge of added) {
    claimGoalCelebration(badge)
  }
}
