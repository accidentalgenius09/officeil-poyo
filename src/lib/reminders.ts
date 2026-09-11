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

export type ReminderKind = 'unmarked_today' | 'on_edge'

function todayKey(today: Date = startOfToday()): string {
  return toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
}

function reminderStorageKey(kind: ReminderKind, today: Date = startOfToday()): string {
  if (kind === 'unmarked_today') {
    return `${REMINDER_PREFIX}:unmarked:${todayKey(today)}`
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
): { onEdge: boolean; daysLeft: number; remaining: number; goal: number } {
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

    const toastId = `reminder-${reminder.kind}-${todayKey(today)}`
    options.toast(reminder.message, { duration: 6000, id: toastId })
    trackEvent('reminder_shown', { kind: reminder.kind })

    if (options.useBrowserNotifications) {
      const shown = showBrowserNotification(
        reminder.title,
        reminder.message,
        `officeil-${reminder.kind}-${todayKey(today)}`,
      )
      if (shown) {
        trackEvent('reminder_browser', { kind: reminder.kind })
      }
    }
  }
}
