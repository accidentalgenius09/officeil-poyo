import { useEffect, useId, useState, type FormEvent } from 'react'
import { GearSix } from '@phosphor-icons/react'
import type {
  CalendarSettings,
  HolidayEntry,
  LeaveEntry,
  LeavePortion,
  UserProfile,
} from '../types'
import { newId } from '../lib/attendance'
import { importIndiaHolidays } from '../lib/holidays'
import { POLICY_PRESETS } from '../lib/presets'
import { exportMonthCsv, exportYearCsv } from '../lib/exportCsv'
import type { AppData } from '../types'
import { trackEvent } from '../lib/analytics'
import {
  ensureNotificationPermission,
  getNotificationPermission,
  notificationsSupported,
} from '../lib/reminders'
import { toast } from 'react-hot-toast'

type SettingsPanelProps = {
  open: boolean
  settings: CalendarSettings
  appData: AppData
  viewYear: number
  viewMonth: number
  userEmail?: string
  onClose: () => void
  onChange: (next: CalendarSettings) => void
  onSignOut: () => void
}

function todayInputValue(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function formatRange(start: string, end: string): string {
  if (start === end) return start
  return `${start} → ${end}`
}

function portionLabel(portion: LeavePortion): string {
  if (portion === 'am') return 'AM'
  if (portion === 'pm') return 'PM'
  return 'Full day'
}

function RemindersSettingsBlock() {
  const [permission, setPermission] = useState(() => getNotificationPermission())

  if (!notificationsSupported()) {
    return (
      <p className="settings-help">
        Browser notifications are not supported in this browser. In-app toasts
        still remind you when today is unmarked or you are on the edge of your
        goal.
      </p>
    )
  }

  async function enableNotifications() {
    const next = await ensureNotificationPermission()
    setPermission(next)
    trackEvent('enable_notifications', { permission: next })
    if (next === 'granted') {
      toast.success('Browser notifications enabled')
    } else if (next === 'denied') {
      toast.error('Notifications blocked — allow them in browser settings')
    }
  }

  return (
    <div className="settings-reminders">
      <p className="settings-help">
        Once a day: toast if today is unmarked, or if you need office every
        remaining working day to hit the goal. Enable browser notifications to
        also get OS alerts when the tab is in the background.
      </p>
      {permission === 'granted' ? (
        <p className="settings-help settings-reminders-status">
          Browser notifications are on.
        </p>
      ) : (
        <button
          type="button"
          className="settings-submit"
          onClick={() => void enableNotifications()}
        >
          {permission === 'denied'
            ? 'Notifications blocked'
            : 'Enable browser notifications'}
        </button>
      )}
    </div>
  )
}

export function SettingsPanel({
  open,
  settings,
  appData,
  viewYear,
  viewMonth,
  userEmail,
  onClose,
  onChange,
  onSignOut,
}: SettingsPanelProps) {
  const titleId = useId()
  const dailyToggleId = useId()
  const [leaveStart, setLeaveStart] = useState(todayInputValue)
  const [leaveEnd, setLeaveEnd] = useState(todayInputValue)
  const [leaveNote, setLeaveNote] = useState('')
  const [leavePortion, setLeavePortion] = useState<LeavePortion>('full')
  const [holidayDate, setHolidayDate] = useState(todayInputValue)
  const [holidayName, setHolidayName] = useState('')
  const [holidayRecurring, setHolidayRecurring] = useState(false)
  const [exportYear, setExportYear] = useState(viewYear)

  useEffect(() => {
    if (!open) return
    setExportYear(viewYear)

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, viewYear])

  if (!open) return null

  function updateProfile(patch: Partial<UserProfile>) {
    onChange({
      ...settings,
      profile: { ...settings.profile, ...patch },
    })
  }

  function addLeave(event: FormEvent) {
    event.preventDefault()
    const start = leaveStart <= leaveEnd ? leaveStart : leaveEnd
    const end = leaveStart <= leaveEnd ? leaveEnd : leaveStart
    if (!start || !end) {
      toast.error('Choose leave dates.')
      return
    }

    const entry: LeaveEntry = {
      id: newId(),
      start,
      end,
      note: leaveNote.trim(),
      portion: leavePortion,
    }
    onChange({
      ...settings,
      leaves: [...settings.leaves, entry].sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
    })
    trackEvent('add_leave', { portion: leavePortion })
    setLeaveNote('')
    setLeavePortion('full')
  }

  function removeLeave(id: string) {
    onChange({
      ...settings,
      leaves: settings.leaves.filter((entry) => entry.id !== id),
    })
    trackEvent('remove_leave')
  }

  function addHoliday(event: FormEvent) {
    event.preventDefault()
    const name = holidayName.trim()
    if (!holidayDate || !name) {
      toast.error('Holiday needs a name and date.')
      return
    }

    const entry: HolidayEntry = {
      id: newId(),
      date: holidayDate,
      name,
      recurring: holidayRecurring,
    }
    onChange({
      ...settings,
      holidays: [...settings.holidays, entry].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    })
    trackEvent('add_holiday', { recurring: holidayRecurring })
    setHolidayName('')
    setHolidayRecurring(false)
  }

  function removeHoliday(id: string) {
    onChange({
      ...settings,
      holidays: settings.holidays.filter((entry) => entry.id !== id),
    })
    trackEvent('remove_holiday')
  }

  function applyIndiaPack() {
    const next = importIndiaHolidays(viewYear, settings.holidays)
    onChange({ ...settings, holidays: next })
    trackEvent('import_holidays', { pack: 'india' })
  }

  const { profile } = settings

  return (
    <div className="settings-root">
      <button
        type="button"
        className="settings-backdrop"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="settings-header">
          <h2 id={titleId}>Settings</h2>
          <button type="button" className="settings-close" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="settings-section">
          <h3>Account</h3>
          <p className="settings-help">
            Signed in as {userEmail || profile.email || 'your account'}.
          </p>
          <RemindersSettingsBlock />
          <button
            type="button"
            className="settings-submit settings-danger"
            onClick={() => {
              trackEvent('logout')
              onSignOut()
            }}
          >
            Sign out
          </button>
        </section>

        <section className="settings-section">
          <h3>User profile</h3>
          <p className="settings-help">
            Your details and monthly office visit target.
          </p>

          <div className="settings-form">
            <label className="settings-span">
              Full name
              <input
                type="text"
                value={profile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder="Surjith K"
                maxLength={80}
                autoComplete="name"
              />
            </label>
            <label className="settings-span">
              Email
              <input
                type="email"
                value={profile.email}
                onChange={(e) => updateProfile({ email: e.target.value })}
                placeholder="you@company.com"
                maxLength={120}
                autoComplete="email"
              />
            </label>
            <label className="settings-span">
              Role / team
              <input
                type="text"
                value={profile.role}
                onChange={(e) => updateProfile({ role: e.target.value })}
                placeholder="Engineering"
                maxLength={80}
              />
            </label>
          </div>

          <div className="profile-daily">
            <div>
              <p className="profile-daily-title">Go to office daily?</p>
              <p className="settings-help">
                If yes, your goal is every working day this month. Leave and
                holidays are still excluded.
              </p>
            </div>
            <button
              type="button"
              id={dailyToggleId}
              className={`toggle-btn${profile.goDaily ? ' on' : ''}`}
              role="switch"
              aria-checked={profile.goDaily}
              onClick={() => {
                const next = !profile.goDaily
                updateProfile({ goDaily: next })
                trackEvent('toggle_go_daily', { enabled: next })
              }}
            >
              <span className="toggle-knob" />
              <span className="toggle-label">{profile.goDaily ? 'Yes' : 'No'}</span>
            </button>
          </div>

          {!profile.goDaily && (
            <label className="goal-field">
              Office days required each month
              <input
                type="number"
                min={1}
                max={31}
                value={profile.officeDaysGoal}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (!Number.isFinite(value)) return
                  const goal = Math.min(31, Math.max(1, Math.round(value)))
                  updateProfile({ officeDaysGoal: goal })
                }}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (!Number.isFinite(value)) return
                  trackEvent('set_office_goal', {
                    goal: Math.min(31, Math.max(1, Math.round(value))),
                  })
                }}
              />
            </label>
          )}

          <div className="preset-block">
            <p className="profile-daily-title">Policy presets</p>
            <p className="settings-help">
              Quick targets for common hybrid policies.
            </p>
            <div className="preset-grid">
              {POLICY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    updateProfile(preset.apply(viewYear, viewMonth))
                    trackEvent('apply_policy_preset', { preset: preset.id })
                  }}
                >
                  <span className="preset-title">{preset.label}</span>
                  <span className="preset-blurb">{preset.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Export CSV</h3>
          <p className="settings-help">
            Download the current month day-by-day, or a full year summary
            (month name + office days).
          </p>
          <div className="export-row">
            <button
              type="button"
              className="settings-submit"
              onClick={() => {
                exportMonthCsv(appData, viewYear, viewMonth)
                trackEvent('export_csv', { scope: 'month' })
              }}
            >
              This month
            </button>
            <label className="export-year">
              Year
              <input
                type="number"
                min={2000}
                max={2100}
                value={exportYear}
                onChange={(e) => setExportYear(Number(e.target.value) || viewYear)}
              />
            </label>
            <button
              type="button"
              className="settings-submit"
              onClick={() => {
                exportYearCsv(appData, exportYear)
                trackEvent('export_csv', { scope: 'year', year: exportYear })
              }}
            >
              Year summary
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>Mark leave</h3>
          <p className="settings-help">
            Full-day leave is locked on the calendar. AM/PM leave still lets you
            mark office or WFH for the other half.
          </p>
          <form className="settings-form" onSubmit={addLeave}>
            <label>
              From
              <input
                type="date"
                value={leaveStart}
                onChange={(e) => setLeaveStart(e.target.value)}
                required
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={leaveEnd}
                onChange={(e) => setLeaveEnd(e.target.value)}
                required
              />
            </label>
            <label>
              Portion
              <select
                value={leavePortion}
                onChange={(e) =>
                  setLeavePortion(e.target.value as LeavePortion)
                }
              >
                <option value="full">Full day</option>
                <option value="am">Morning (AM)</option>
                <option value="pm">Afternoon (PM)</option>
              </select>
            </label>
            <label className="settings-span">
              Note (optional)
              <input
                type="text"
                value={leaveNote}
                onChange={(e) => setLeaveNote(e.target.value)}
                placeholder="Family trip"
                maxLength={80}
              />
            </label>
            <button type="submit" className="settings-submit">
              Add leave
            </button>
          </form>

          <ul className="settings-list">
            {settings.leaves.length === 0 && (
              <li className="settings-empty">No leave marked yet.</li>
            )}
            {settings.leaves.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{formatRange(entry.start, entry.end)}</strong>
                  <span>
                    {portionLabel(entry.portion ?? 'full')}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </span>
                </div>
                <button type="button" onClick={() => removeLeave(entry.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="settings-section">
          <h3>Holiday calendar</h3>
          <p className="settings-help">
            Add holidays so they don’t count as working days. Recurring holidays
            repeat every year on the same date.
          </p>
          <button
            type="button"
            className="settings-submit"
            onClick={applyIndiaPack}
          >
            Import India pack ({viewYear})
          </button>
          <form className="settings-form" onSubmit={addHoliday}>
            <label>
              Date
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
              />
            </label>
            <label className="settings-span">
              Name
              <input
                type="text"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="Independence Day"
                maxLength={80}
                required
              />
            </label>
            <label className="settings-check settings-span">
              <input
                type="checkbox"
                checked={holidayRecurring}
                onChange={(e) => setHolidayRecurring(e.target.checked)}
              />
              Repeat every year
            </label>
            <button type="submit" className="settings-submit">
              Add holiday
            </button>
          </form>

          <ul className="settings-list">
            {settings.holidays.length === 0 && (
              <li className="settings-empty">No holidays added yet.</li>
            )}
            {settings.holidays.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.date}</strong>
                  <span>
                    {entry.name}
                    {entry.recurring ? ' · yearly' : ''}
                  </span>
                </div>
                <button type="button" onClick={() => removeHoliday(entry.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  )
}

type SettingsFabProps = {
  open: boolean
  onToggle: () => void
}

export function SettingsFab({ open, onToggle }: SettingsFabProps) {
  return (
    <button
      type="button"
      className={`settings-fab${open ? ' open' : ''}`}
      onClick={onToggle}
      aria-label={open ? 'Close settings' : 'Open settings'}
      aria-expanded={open}
    >
      <GearSix size={22} weight="fill" aria-hidden />
    </button>
  )
}
