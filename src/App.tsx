import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData, AuthUser, DayStatus } from "./types";
import {
  cacheAppData,
  computeStats,
  cycleStatus,
  getMonthAttendance,
  holidayNameByDate,
  leaveCoverageByDate,
  loadCachedAppData,
  monthLabel,
  monthStorageKey,
  resolveOfficeGoal,
  toDateKey,
} from "./lib/attendance";
import {
  clearSession,
  fetchAppData,
  fetchMe,
  getStoredToken,
  getStoredUser,
  persistAppData,
} from "./lib/api";
import { trackEvent } from "./lib/analytics";
import { AuthScreen } from "./components/AuthScreen";
import { MonthHeader } from "./components/MonthHeader";
import { SummaryCards } from "./components/SummaryCards";
import { CalendarGrid } from "./components/CalendarGrid";
import { SettingsFab, SettingsPanel } from "./components/SettingsPanel";
import { GamesConsole } from "./components/games/GamesConsole";
import { ThemeToggle } from "./components/ThemeToggle";
import { toast } from 'react-hot-toast'
import "./App.css";

function App() {
  const now = new Date();
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [authChecking, setAuthChecking] = useState(() => Boolean(getStoredToken()));
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [appData, setAppData] = useState<AppData>(() => loadCachedAppData());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadErrorToasted = useRef(false);

  const attendance = getMonthAttendance(appData.attendance, year, month);
  const stats = computeStats(
    attendance,
    appData.settings,
    undefined,
    appData.attendance,
  );
  const officeGoal = resolveOfficeGoal(year, month, appData.settings);
  const profile = appData.settings.profile;
  const leaveDates = useMemo(
    () => leaveCoverageByDate(appData.settings),
    [appData.settings],
  );
  const holidayDates = useMemo(
    () => holidayNameByDate(appData.settings, year, month),
    [appData.settings, year, month],
  );

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      setUser(null);
      return;
    }

    (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
      } catch {
        if (cancelled) return;
        clearSession();
        setUser(null);
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setLoadState("loading");
    skipNextSave.current = true;

    (async () => {
      try {
        const remote = await fetchAppData();
        if (cancelled) return;

        const local = loadCachedAppData();
        const remoteEmpty =
          Object.keys(remote.attendance).length === 0 &&
          remote.settings.leaves.length === 0 &&
          remote.settings.holidays.length === 0 &&
          !remote.settings.profile.name &&
          !remote.settings.profile.email;
        const localHasData =
          Object.keys(local.attendance).length > 0 ||
          local.settings.leaves.length > 0 ||
          local.settings.holidays.length > 0 ||
          Boolean(local.settings.profile.name || local.settings.profile.email);

        if (remoteEmpty && localHasData) {
          await persistAppData(local);
          if (cancelled) return;
          setAppData(local);
        } else {
          setAppData(remote);
          cacheAppData(remote);
        }
        setLoadState("ready");
        loadErrorToasted.current = false;
      } catch {
        if (cancelled) return;
        setLoadState("error");
        if (!loadErrorToasted.current) {
          loadErrorToasted.current = true;
          toast.error(
            "Could not reach MongoDB. Showing local cache. If your IP changed, add it in Atlas → Network Access.",
          );
        }
      } finally {
        skipNextSave.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    cacheAppData(appData);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistAppData(appData)
        .then(() => undefined)
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : "Could not save to MongoDB.";
          if (/sign in|unauthorized|401/i.test(message)) {
            clearSession();
            setUser(null);
            toast.error("Session expired. Please sign in again.");
            return;
          }
          toast.error(
            "Could not save to MongoDB. Check Atlas Network Access for your current IP.",
          );
        });
    }, 400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [appData, user]);

  function goPrevMonth() {
    trackEvent("change_month", { direction: "prev" });
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    trackEvent("change_month", { direction: "next" });
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToToday() {
    trackEvent("change_month", { direction: "today" });
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  }

  function setDayStatus(day: number, status: DayStatus) {
    const key = monthStorageKey(year, month);
    const dateKey = toDateKey(year, month, day);

    trackEvent("toggle_attendance", {
      status: status ?? "unmarked",
      month: monthStorageKey(year, month),
    });

    setAppData((prev) => {
      const current = getMonthAttendance(prev.attendance, year, month);
      const nextDays = { ...current.days };

      if (status === null) {
        delete nextDays[dateKey];
      } else {
        nextDays[dateKey] = status;
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
      };
    });
  }

  function handleDayClick(day: number) {
    const dateKey = toDateKey(year, month, day);
    const current = attendance.days[dateKey] ?? null;
    setDayStatus(day, cycleStatus(current));
  }

  function handleSignOut() {
    clearSession();
    setUser(null);
    setSettingsOpen(false);
    setGamesOpen(false);
  }

  if (authChecking) {
    return (
      <div className="auth-screen">
        <div className="app-bg" aria-hidden="true" />
        <p className="auth-loading">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ThemeToggle />
        <AuthScreen
          onAuthenticated={(next) => {
            skipNextSave.current = true;
            setUser(next);
          }}
        />
      </>
    );
  }

  const brandSub = profile.name
    ? [profile.name, profile.role].filter(Boolean).join(" · ")
    : "Track your in-office days";

  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true" />
      <ThemeToggle />
      <main className="shell">
        <header className="brand">
          <h1 className="brand-mark">Officeil Poyo?</h1>
          <p className="brand-sub">{brandSub}</p>
          {loadState === "loading" && (
            <p className="sync-status">Loading from MongoDB…</p>
          )}
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
        <p className="hint">
          Click a day to cycle: office → WFH → unmarked. Use settings for leave,
          holidays, export, and policy presets.
        </p>
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
            <span className="swatch wfh" /> WFH
          </span>
          <span className="legend-item">
            <span className="swatch unmarked" /> Unmarked
          </span>
          <span className="legend-item">
            <span className="swatch leave" /> Leave
          </span>
          <span className="legend-item">
            <span className="swatch holiday" /> Holiday
          </span>
        </footer>

        <p className="copyright">
          Copyright © {new Date().getFullYear()} Surjith K. All Rights Reserved.
        </p>
      </main>

      <GamesConsole
        open={gamesOpen}
        onToggle={() => {
          setGamesOpen((open) => {
            const next = !open;
            trackEvent(next ? "open_games" : "close_games");
            return next;
          });
          setSettingsOpen(false);
        }}
        onClose={() => {
          trackEvent("close_games");
          setGamesOpen(false);
        }}
      />
      <SettingsFab
        open={settingsOpen}
        onToggle={() => {
          setSettingsOpen((open) => {
            const next = !open;
            trackEvent(next ? "open_settings" : "close_settings");
            return next;
          });
          setGamesOpen(false);
        }}
      />
      <SettingsPanel
        open={settingsOpen}
        settings={appData.settings}
        appData={appData}
        viewYear={year}
        viewMonth={month}
        userEmail={user.email}
        onClose={() => {
          trackEvent("close_settings");
          setSettingsOpen(false);
        }}
        onChange={(settings) => setAppData((prev) => ({ ...prev, settings }))}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

export default App;
