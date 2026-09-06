import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData, AuthUser, DayStatus, GoalReward } from "./types";
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
  autoMarkPreviousWorkingDayWfh,
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
import {
  evaluateAchievementBadges,
  markGoalCelebrated,
  monthGoalRewardsForYear,
  recordDailyActivity,
  resolveGameRewardTheme,
  rewardTitle,
  wasGoalCelebrated,
  withMonthReward,
  withPerfectYearReward,
  withStreakRewards,
} from "./lib/rewards";
import { RewardsPanel } from "./components/RewardsPanel";
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
  const [rewardsOpen, setRewardsOpen] = useState(false);
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
  const rewards = appData.settings.rewards ?? [];
  const activity = appData.settings.activity ?? {
    lastActiveDate: null,
    streak: 0,
    behindMonths: [],
  };
  const calendarYear = new Date().getFullYear();
  const yearRewards = monthGoalRewardsForYear(rewards, calendarYear);
  const rewardTheme = resolveGameRewardTheme(yearRewards.length);

  useEffect(() => {
    if (!user || loadState === "loading") return;
    if (stats.daysLeftToGoal > 0 || officeGoal < 1) return;

    const key = monthStorageKey(year, month);
    const monthResult = withMonthReward(
      appData.settings.rewards ?? [],
      year,
      month,
    );
    if (!monthResult.added) return;

    setAppData((prev) => ({
      ...prev,
      settings: { ...prev.settings, rewards: monthResult.rewards },
    }));

    if (!wasGoalCelebrated(monthResult.added.id)) {
      markGoalCelebrated(monthResult.added.id);
      const yearCount = monthGoalRewardsForYear(
        monthResult.rewards,
        calendarYear,
      ).length;
      const theme = resolveGameRewardTheme(yearCount);
      toast.success(
        theme === "aurora"
          ? "Goal met! Badge earned — Aurora console unlocked for this year."
          : yearCount === 1
            ? "Goal met! Badge earned — Gold console unlocked for this year."
            : "Goal met! Monthly badge unlocked.",
      );
      trackEvent("goal_reward_earned", {
        kind: "month_goal",
        month: key,
        badges: yearCount,
        theme,
      });
    }
  }, [
    user,
    loadState,
    stats.daysLeftToGoal,
    officeGoal,
    year,
    month,
    calendarYear,
    appData.settings.rewards,
  ]);

  useEffect(() => {
    if (!user || loadState === "loading") return;

    const yearsToCheck = new Set([calendarYear, year]);
    let working = appData.settings.rewards ?? [];
    const newlyAdded: GoalReward[] = [];

    for (const y of yearsToCheck) {
      const result = withPerfectYearReward(working, y);
      working = result.rewards;
      if (result.added) newlyAdded.push(result.added);
    }

    if (newlyAdded.length === 0) return;

    setAppData((prev) => ({
      ...prev,
      settings: { ...prev.settings, rewards: working },
    }));

    for (const added of newlyAdded) {
      if (wasGoalCelebrated(added.id)) continue;
      markGoalCelebrated(added.id);
      toast.success(
        `Perfect year ${added.key}! You hit the goal every month.`,
      );
      trackEvent("goal_reward_earned", {
        kind: "perfect_year",
        year: added.key,
      });
    }
  }, [user, loadState, calendarYear, year, appData.settings.rewards]);

  // Auto-mark the previous working day as WFH when it was left unmarked.
  useEffect(() => {
    if (!user || loadState === "loading") return;

    setAppData((prev) => {
      const next = autoMarkPreviousWorkingDayWfh(prev);
      if (!next) return prev;
      queueMicrotask(() => {
        trackEvent("auto_mark_wfh", { scope: "previous_working_day" });
      });
      return next;
    });
  }, [user, loadState, appData.settings.leaves, appData.settings.holidays]);

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

  // Evaluate achievement badges when attendance or settings change.
  useEffect(() => {
    if (!user || loadState === "loading") return;

    setAppData((prev) => {
      const result = evaluateAchievementBadges(prev, {
        focusYear: year,
        focusMonth: month,
        localHour: new Date().getHours(),
      });
      if (result.added.length === 0) {
        const behindChanged =
          JSON.stringify(result.activity.behindMonths) !==
          JSON.stringify(prev.settings.activity?.behindMonths ?? []);
        if (!behindChanged) return prev;
        return {
          ...prev,
          settings: { ...prev.settings, activity: result.activity },
        };
      }

      queueMicrotask(() => {
        for (const badge of result.added) {
          if (wasGoalCelebrated(badge.id)) continue;
          markGoalCelebrated(badge.id);
          toast.success(`${rewardTitle(badge)} unlocked!`);
          trackEvent("goal_reward_earned", { kind: badge.kind });
        }
      });

      return {
        ...prev,
        settings: {
          ...prev.settings,
          rewards: result.rewards,
          activity: result.activity,
        },
      };
    });
  }, [
    user,
    loadState,
    year,
    month,
    appData.attendance,
    appData.settings.leaves,
    appData.settings.holidays,
    appData.settings.rewards,
  ]);

  function setDayStatus(day: number, status: DayStatus) {
    const key = monthStorageKey(year, month);
    const dateKey = toDateKey(year, month, day);
    const hour = new Date().getHours();

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

      const latestActivity = recordDailyActivity(
        prev.settings.activity ?? {
          lastActiveDate: null,
          streak: 0,
          behindMonths: [],
        },
      );
      let nextRewards = prev.settings.rewards ?? [];
      if (latestActivity.changed) {
        const streakBadges = withStreakRewards(
          nextRewards,
          latestActivity.streak,
          latestActivity.activity.lastActiveDate ?? dateKey,
        );
        nextRewards = streakBadges.rewards;
        for (const badge of streakBadges.added) {
          if (!wasGoalCelebrated(badge.id)) {
            markGoalCelebrated(badge.id);
            queueMicrotask(() => {
              toast.success(`${rewardTitle(badge)} unlocked!`);
              trackEvent("goal_reward_earned", {
                kind: badge.kind,
                streak: latestActivity.streak,
              });
            });
          }
        }
      }

      const draft: AppData = {
        ...prev,
        attendance: {
          ...prev.attendance,
          [key]: {
            year,
            month,
            days: nextDays,
          },
        },
        settings: {
          ...prev.settings,
          activity: latestActivity.activity,
          rewards: nextRewards,
        },
      };

      const achievements = evaluateAchievementBadges(draft, {
        focusYear: year,
        focusMonth: month,
        localHour: hour,
      });

      for (const badge of achievements.added) {
        if (!wasGoalCelebrated(badge.id)) {
          markGoalCelebrated(badge.id);
          queueMicrotask(() => {
            toast.success(`${rewardTitle(badge)} unlocked!`);
            trackEvent("goal_reward_earned", { kind: badge.kind });
          });
        }
      }

      return {
        ...draft,
        settings: {
          ...draft.settings,
          rewards: achievements.rewards,
          activity: achievements.activity,
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
    setRewardsOpen(false);
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
          Click a day to cycle: office → WFH → unmarked. Unmarked previous
          working days auto-fill as WFH. Open the trophy for badges.
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
          Copyright © {new Date().getFullYear()}{" "}
          <a
            href="https://www.linkedin.com/in/surjithk/"
            target="_blank"
            rel="noopener noreferrer"
            className="copyright-link"
          >
            Surjith K
          </a>
          . All Rights Reserved.
        </p>
      </main>

      <RewardsPanel
        open={rewardsOpen}
        rewards={rewards}
        activity={activity}
        currentYear={calendarYear}
        onToggle={() => {
          setRewardsOpen((open) => {
            const next = !open;
            trackEvent(next ? "open_rewards" : "close_rewards");
            return next;
          });
          setGamesOpen(false);
          setSettingsOpen(false);
        }}
        onClose={() => {
          trackEvent("close_rewards");
          setRewardsOpen(false);
        }}
      />
      <GamesConsole
        open={gamesOpen}
        rewardTheme={rewardTheme}
        rewardCount={yearRewards.length}
        onToggle={() => {
          setGamesOpen((open) => {
            const next = !open;
            trackEvent(next ? "open_games" : "close_games");
            return next;
          });
          setRewardsOpen(false);
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
          setRewardsOpen(false);
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
