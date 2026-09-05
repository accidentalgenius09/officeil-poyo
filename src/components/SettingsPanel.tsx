import { useEffect, useId, useState, type FormEvent } from 'react'
import { GearSix } from '@phosphor-icons/react'
import type { CalendarSettings, HolidayEntry, LeaveEntry, UserProfile } from '../types'
import { newId } from '../lib/attendance'
import { trackEvent } from '../lib/analytics'

type SettingsPanelProps = {
  open: boolean
  settings: CalendarSettings
  onClose: () => void
  onChange: (next: CalendarSettings) => void
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

export function SettingsPanel({
  open,
  settings,
  onClose,
  onChange,
}: SettingsPanelProps) {
  const titleId = useId()
  const dailyToggleId = useId()
  const [leaveStart, setLeaveStart] = useState(todayInputValue)
  const [leaveEnd, setLeaveEnd] = useState(todayInputValue)
  const [leaveNote, setLeaveNote] = useState('')
  const [holidayDate, setHolidayDate] = useState(todayInputValue)
  const [holidayName, setHolidayName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
      setFormError('Choose leave dates.')
      return
    }

    const entry: LeaveEntry = {
      id: newId(),
      start,
      end,
      note: leaveNote.trim(),
    }
    onChange({
      ...settings,
      leaves: [...settings.leaves, entry].sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
    })
    trackEvent('add_leave')
    setLeaveNote('')
    setFormError(null)
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
      setFormError('Holiday needs a name and date.')
      return
    }

    const entry: HolidayEntry = {
      id: newId(),
      date: holidayDate,
      name,
    }
    onChange({
      ...settings,
      holidays: [...settings.holidays, entry].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    })
    trackEvent('add_holiday')
    setHolidayName('')
    setFormError(null)
  }

  function removeHoliday(id: string) {
    onChange({
      ...settings,
      holidays: settings.holidays.filter((entry) => entry.id !== id),
    })
    trackEvent('remove_holiday')
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

        {formError && <p className="settings-error">{formError}</p>}

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
        </section>

        <section className="settings-section">
          <h3>Mark leave</h3>
          <p className="settings-help">
            Plan leave in advance. Those days are excluded from working days.
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
                  {entry.note && <span>{entry.note}</span>}
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
            Add holidays so they don’t count as working days.
          </p>
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
                  <span>{entry.name}</span>
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
