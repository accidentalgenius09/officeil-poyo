import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, DayStatus } from './types'
import {
  cacheAppData,
  computeStats,
  cycleStatus,
  getMonthAttendance,
  holidayNameByDate,
  leaveNoteByDate,
  loadCachedAppData,
  monthLabel,
  monthStorageKey,
  resolveOfficeGoal,
  toDateKey,
} from './lib/attendance'
import { fetchAppData, persistAppData } from './lib/api'
import { MonthHeader } from './components/MonthHeader'
import { SummaryCards } from './components/SummaryCards'
import { CalendarGrid } from './components/CalendarGrid'
import { SettingsFab, SettingsPanel } from './components/SettingsPanel'
import './App.css'

function App() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [appData, setAppData] = useState<AppData>(() => loadCachedAppData())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saveError, setSaveError] = useState<string | null>(null)
  const skipNextSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const attendance = getMonthAttendance(appData.attendance, year, month)
  const stats = computeStats(attendance, appData.settings)
  const officeGoal = resolveOfficeGoal(year, month, appData.settings)
  const profile = appData.settings.profile
  const leaveDates = useMemo(
    () => leaveNoteByDate(appData.settings),
    [appData.settings],
  )
  const holidayDates = useMemo(
    () => holidayNameByDate(appData.settings),
    [appData.settings],
  )

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const remote = await fetchAppData()
        if (cancelled) return

        const local = loadCachedAppData()
        const remoteEmpty =
          Object.keys(remote.attendance).length === 0 &&
          remote.settings.leaves.length === 0 &&
          remote.settings.holidays.length === 0 &&
          !remote.settings.profile.name &&
          !remote.settings.profile.email
        const localHasData =
          Object.keys(local.attendance).length > 0 ||
          local.settings.leaves.length > 0 ||
          local.settings.holidays.length > 0 ||
          Boolean(local.settings.profile.name || local.settings.profile.email)

        if (remoteEmpty && localHasData) {
          await persistAppData(local)
          if (cancelled) return
          setAppData(local)
        } else {
          setAppData(remote)
          cacheAppData(remote)
        }
        setLoadState('ready')
      } catch {
        if (cancelled) return
        setLoadState('error')
      } finally {
        skipNextSave.current = true
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    cacheAppData(appData)

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persistAppData(appData)
        .then(() => setSaveError(null))
        .catch(() =>
          setSaveError(
            'Could not save to MongoDB. Check Atlas Network Access for your current IP.',
          ),
        )
    }, 400)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [appData])

  function goPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function goToToday() {
    const t = new Date()
    setYear(t.getFullYear())
    setMonth(t.getMonth())
  }

  function setDayStatus(day: number, status: DayStatus) {
    const key = monthStorageKey(year, month)
    const dateKey = toDateKey(year, month, day)

    setAppData((prev) => {
      const current = getMonthAttendance(prev.attendance, year, month)
      const nextDays = { ...current.days }

      if (status === null) {
        delete nextDays[dateKey]
      } else {
        nextDays[dateKey] = status
      }

      return {
        ...prev,
        attendance: {
          ...prev.attendance,
          [key]: {
            year,
            month,
            days: nextDays,
          },
        },
      }
    })
  }

  function handleDayClick(day: number) {
    const dateKey = toDateKey(year, month, day)
    const current = attendance.days[dateKey] ?? null
    setDayStatus(day, cycleStatus(current))
  }

  const brandSub = profile.name
    ? [profile.name, profile.role].filter(Boolean).join(' · ')
    : 'Track your in-office days'

  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true" />
      <main className="shell">
        <header className="brand">
          <h1 className="brand-mark">Officeil Poyo?</h1>
          <p className="brand-sub">{brandSub}</p>
          {loadState === 'loading' && <p className="sync-status">Loading from MongoDB…</p>}
          {loadState === 'error' && (
            <p className="sync-status sync-error">
              Could not reach MongoDB. Showing local cache. If your IP changed, add it in Atlas →
              Network Access.
            </p>
          )}
          {saveError && <p className="sync-status sync-error">{saveError}</p>}
        </header>

        <MonthHeader
          label={monthLabel(year, month)}
          onPrev={goPrevMonth}
          onNext={goNextMonth}
          onToday={goToToday}
        />

        <SummaryCards
          stats={stats}
          goal={officeGoal}
          goDaily={profile.goDaily}
        />

        <CalendarGrid
          year={year}
          month={month}
          days={attendance.days}
          leaveDates={leaveDates}
          holidayDates={holidayDates}
          onDayClick={handleDayClick}
        />

        <footer className="legend" aria-label="Status legend">
          <span className="legend-item">
            <span className="swatch office" /> In office
          </span>
          <span className="legend-item">
            <span className="swatch wfh" /> Not in office
          </span>
          <span className="legend-item">
            <span className="swatch leave" /> Leave
          </span>
          <span className="legend-item">
            <span className="swatch holiday" /> Holiday
          </span>
          <p className="hint">
            Click a day to toggle office. Use settings to mark leave or holidays.
          </p>
        </footer>
      </main>

      <SettingsFab
        open={settingsOpen}
        onToggle={() => setSettingsOpen((open) => !open)}
      />
      <SettingsPanel
        open={settingsOpen}
        settings={appData.settings}
        onClose={() => setSettingsOpen(false)}
        onChange={(settings) => setAppData((prev) => ({ ...prev, settings }))}
      />
    </div>
  )
}

export default App
