import type { AppData } from '../types'
import {
  computeStats,
  getDayStatus,
  getMonthAttendance,
  isWorkingDay,
  monthStorageKey,
  resolveOfficeGoal,
  startOfToday,
  toDateKey,
} from './attendance'
import { trackEvent } from './analytics'

const REMINDER_PREFIX = 'office-visit-reminder'
const PERMISSION_ASKED_KEY = 'office-visit-notif-asked'

/** Survives React Strict Mode remounts (refs do not). */
const claimedThisPageLoad = new Set<string>()

export type ReminderKind = 'unmarked_today' | 'on_edge' | 'weekly_digest'

function todayKey(today: Date = startOfToday()): string {
  return toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
}

/** Local Monday of the week containing `today` (YYYY-MM-DD). */
function weekMondayKey(today: Date = startOfToday()): string {
  const monday = new Date(today)
  const day = monday.getDay()
  const delta = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + delta)
  return toDateKey(monday.getFullYear(), monday.getMonth(), monday.getDate())
}

function isMonday(today: Date): boolean {
  return today.getDay() === 1
}

function reminderStorageKey(kind: ReminderKind, today: Date = startOfToday()): string {
  if (kind === 'unmarked_today') {
    return `${REMINDER_PREFIX}:unmarked:${todayKey(today)}`
  }
  if (kind === 'weekly_digest') {
    return `${REMINDER_PREFIX}:week:${weekMondayKey(today)}`
  }
  const monthKey = monthStorageKey(today.getFullYear(), today.getMonth())
  return `${REMINDER_PREFIX}:edge:${monthKey}:${todayKey(today)}`
}

export function wasReminderShown(
  kind: ReminderKind,
  today: Date = startOfToday(),
): boolean {
  const key = reminderStorageKey(kind, today)
  if (claimedThisPageLoad.has(key)) return true
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function markReminderShown(
  kind: ReminderKind,
  today: Date = startOfToday(),
): void {
  const key = reminderStorageKey(kind, today)
  claimedThisPageLoad.add(key)
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

/** Atomically claim a reminder slot; returns false if already shown/claimed. */
export function claimReminder(
  kind: ReminderKind,
  today: Date = startOfToday(),
): boolean {
  if (wasReminderShown(kind, today)) return false
  markReminderShown(kind, today)
  return true
}

export function isTodayUnmarkedWorkingDay(
  data: AppData,
  today: Date = startOfToday(),
): boolean {
  if (!isWorkingDay(today, data.settings)) return false
  const y = today.getFullYear()
  const m = today.getMonth()
  const key = toDateKey(y, m, today.getDate())
  const status = getDayStatus(
    getMonthAttendance(data.attendance, y, m).days,
    key,
  )
  return status !== 'office' && status !== 'wfh'
}

export function isOnEdgePace(
  data: AppData,
  today: Date = startOfToday(),
): {
  onEdge: boolean
  daysLeft: number
  remaining: number
  goal: number
  canHitGoal: boolean
} {
  const y = today.getFullYear()
  const m = today.getMonth()
  const attendance = getMonthAttendance(data.attendance, y, m)
  const stats = computeStats(attendance, data.settings, today, data.attendance)
  const goal = resolveOfficeGoal(y, m, data.settings)
  const onEdge =
    stats.daysLeftToGoal > 0 &&
    stats.workingDaysRemaining > 0 &&
    stats.daysLeftToGoal === stats.workingDaysRemaining

  return {
    onEdge,
    daysLeft: stats.daysLeftToGoal,
    remaining: stats.workingDaysRemaining,
    goal,
    canHitGoal: stats.canHitGoal,
  }
}

export function buildUnmarkedReminderMessage(): string {
  return "Today isn’t marked yet — tap a day to set office or WFH."
}

export function buildOnEdgeReminderMessage(
  daysLeft: number,
  remaining: number,
): string {
  return `On the edge — need ${daysLeft} more office day${daysLeft === 1 ? '' : 's'} and only ${remaining} working day${remaining === 1 ? '' : 's'} left. Go to office every remaining day.`
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

/** Monday status line: office days still needed and working days left this month. */
export function buildWeeklyDigestMessage(
  daysLeft: number,
  remaining: number,
  canHitGoal: boolean,
): string {
  const working =
    remaining === 0
      ? 'no working days remaining'
      : `${plural(remaining, 'working day')} remaining`

  if (daysLeft === 0) {
    return `This week: goal met — ${working}.`
  }
  const office = `${plural(daysLeft, 'office day')} left`
  if (!canHitGoal) {
    return `This week: ${office}, ${working} — goal is out of reach.`
  }
  if (daysLeft === remaining) {
    return `This week: ${office}, ${working}. Office every remaining day.`
  }
  return `This week: ${office}, ${working}.`
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

/** Ask once per browser profile (unless already decided). */
export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  try {
    const alreadyAsked = localStorage.getItem(PERMISSION_ASKED_KEY) === '1'
    if (alreadyAsked && Notification.permission === 'default') {
      // Still default but we asked before — try again lightly
    }
    localStorage.setItem(PERMISSION_ASKED_KEY, '1')
  } catch {
    /* ignore */
  }

  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag: string,
): boolean {
  if (!notificationsSupported()) return false
  if (Notification.permission !== 'granted') return false

  try {
    const notification = new Notification(title, {
      body,
      tag,
      silent: false,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}

export type ReminderResult = {
  kind: ReminderKind
  message: string
  title: string
  duration?: number
}

/** Collect reminders that should fire today (not already shown). */
export function collectDueReminders(
  data: AppData,
  today: Date = startOfToday(),
): ReminderResult[] {
  const due: ReminderResult[] = []

  if (
    isTodayUnmarkedWorkingDay(data, today) &&
    !wasReminderShown('unmarked_today', today)
  ) {
    due.push({
      kind: 'unmarked_today',
      title: 'Officeil Poyo?',
      message: buildUnmarkedReminderMessage(),
    })
  }

  const edge = isOnEdgePace(data, today)
  if (edge.onEdge && !wasReminderShown('on_edge', today)) {
    due.push({
      kind: 'on_edge',
      title: 'Pace alert',
      message: buildOnEdgeReminderMessage(edge.daysLeft, edge.remaining),
    })
  }

  if (isMonday(today) && !wasReminderShown('weekly_digest', today)) {
    due.push({
      kind: 'weekly_digest',
      title: 'Week check-in',
      message: buildWeeklyDigestMessage(
        edge.daysLeft,
        edge.remaining,
        edge.canHitGoal,
      ),
      duration: 8000,
    })
  }

  return due
}

export function deliverReminders(
  reminders: ReminderResult[],
  options: {
    toast: (message: string, opts?: { duration?: number; id?: string }) => void
    useBrowserNotifications: boolean
    today?: Date
  },
): void {
  const today = options.today ?? startOfToday()

  for (const reminder of reminders) {
    // Claim before toast so Strict Mode / double effects cannot double-fire.
    if (!claimReminder(reminder.kind, today)) continue

    const slot =
      reminder.kind === 'weekly_digest' ? weekMondayKey(today) : todayKey(today)
    const toastId = `reminder-${reminder.kind}-${slot}`
    options.toast(reminder.message, {
      duration: reminder.duration ?? 6000,
      id: toastId,
    })
    trackEvent('reminder_shown', { kind: reminder.kind })

    if (options.useBrowserNotifications) {
      const shown = showBrowserNotification(
        reminder.title,
        reminder.message,
        `officeil-${reminder.kind}-${slot}`,
      )
      if (shown) {
        trackEvent('reminder_browser', { kind: reminder.kind })
      }
    }
  }
}
