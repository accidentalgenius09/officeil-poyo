# Officeil Poyo?

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-lightgrey)](#license)

> Track monthly office visits — mark **office** or **WFH**, plan leave, add holidays, hit visit goals, earn badges, and sync to your own MongoDB account. Built-in games for a quick break.

**Repo:** [accidentalgenius09/officeil-poyo](https://github.com/accidentalgenius09/officeil-poyo)

---

## Table of contents

- [Features](#features)
- [Goal rewards](#goal-rewards)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Deploy on Vercel](#deploy-on-vercel)
- [Usage](#usage)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Google Analytics](#google-analytics)
- [License](#license)

---

## Features

| Area | What you get |
| --- | --- |
| **Auth** | Email / password register & sign-in; per-user MongoDB data; password show/hide (eye icon) |
| **Calendar** | Click a day to cycle **office → WFH → unmarked**; previous unmarked working day auto-fills as **WFH** |
| **Goals** | Monthly target, remaining working days, WFH count |
| **Pace & streak** | “Can I still hit the goal?”, this week’s office days, consecutive streak |
| **Presets** | Every working day · 3×/week · 2×/week · classic 12 |
| **Goal rewards** | Trophy panel with monthly goals, logger/office streaks, hybrid & planning badges, and yearly milestones (see [Goal rewards](#goal-rewards)) |
| **Leave** | Full-day or half-day (AM/PM); full leave locks the day |
| **Holidays** | Named holidays, yearly recurrence, one-click **India** pack |
| **Export** | CSV for current month (day-by-day) or full year (month + office days) |
| **Sync** | Per-user Atlas documents + local cache fallback while signed in |
| **Theme** | Light / dark celestial toggle (saved; follows system on first visit) |
| **Toasts** | Auth, sync, validation, and badge unlocks via [react-hot-toast](https://react-hot-toast.com/) (top-right) |
| **Games** | Sudoku · Memory Match · 2048 (Gold / Aurora themes from this year’s monthly badges) |
| **Analytics** | GA4 visitors + custom in-app events (no profile PII) |

---

## Goal rewards

Open the **trophy** button (above Games / Settings) to see earned badges, update-streak progress, and this year’s monthly goal count (`n / 12`). Unlock toasts appear when a badge is earned.

| Badge | How to earn |
| --- | --- |
| **Monthly goal** | Hit the office-day goal for that month |
| **Perfect year** | Hit the goal in all 12 months of a year |
| **7 / 30 / 60 / 100-day logger** | Update attendance on consecutive calendar days |
| **Office streak 5 / 10 / 20** | Mark consecutive office working days |
| **First office day** | Mark your first day in office |
| **Hybrid balancer** | ≥4 office and ≥4 WFH days in one month |
| **WFH week / Office week** | 5 WFH or 5 office days in one calendar week |
| **Weekend warrior** | Mark attendance on a Saturday or Sunday |
| **Early bird** | Hit the monthly goal on or before the 15th |
| **Clutch finisher** | Hit the goal on the last working day of the month |
| **Overachiever** | Finish a month ≥3 office days over goal |
| **Comeback** | Hit the goal after pace said it was impossible |
| **No-gap month** | Every working day marked office or WFH |
| **Clean calendar** | No-gap month with leave or holidays planned |
| **Quarter champion** | Hit the goal in all 3 months of a quarter |
| **Half-year hero** | Hit the goal in 6 months of one year |
| **Century club** | 100 office days all-time |
| **Planner** | Add leave at least 7 days in advance |
| **Holiday curator** | Add 5 or more holidays |
| **New Year starter** | Mark attendance on the year’s first working day |
| **Month of Sundays** | Hit the goal in a month that has 5 Sundays |
| **Night owl** | Update attendance after 9 PM local time |

**Game console themes** (from this year’s monthly goal badges; reset each year):

- **1** monthly badge → Gold console  
- **3+** monthly badges → Aurora console  

---

## Tech stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Express API (`api/index.js`)
- **Database:** MongoDB Atlas
- **UI:** [Phosphor Icons](https://phosphoricons.com/), [react-hot-toast](https://react-hot-toast.com/)
- **Analytics:** Google Analytics 4 (`G-TE6H7QC05N`)

---

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/accidentalgenius09/officeil-poyo.git
cd officeil-poyo
npm install
```

### 2. Configure env

```bash
cp .env.example .env
```

Edit `.env` with your Atlas URI and a strong `AUTH_SECRET` (see [Environment variables](#environment-variables)).

### 3. Run locally

```bash
npm run dev
```

| Service | URL |
| --- | --- |
| App | http://localhost:5173 |
| API | http://localhost:3001 |

Register an account on first visit, then mark attendance.

> **Legacy data:** The first registered account inherits any old shared `default` MongoDB document so existing data is not lost.
>
> **Tip:** After changing `.env`, restart `npm run dev` so the API reloads auth and MongoDB settings.

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Atlas connection string |
| `MONGODB_DB` | No | Database name (default `office-visit-calendar`) |
| `PORT` | No | API port (default `3001`) |
| `AUTH_SECRET` | Yes (prod) | Long random string used to sign login tokens |

Example `.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/office-visit-calendar?retryWrites=true&w=majority
MONGODB_DB=office-visit-calendar
PORT=3001
AUTH_SECRET=change-me-to-a-long-random-string
```

### MongoDB Atlas checklist

1. Create a free cluster and database user  
2. **Network Access** — allow your current IP (local), or `0.0.0.0/0` for Vercel  
3. Paste the connection string into `MONGODB_URI`

> If your IP changes, update Network Access or the app falls back to local cache.

---

## Deploy on Vercel

1. Import [accidentalgenius09/officeil-poyo](https://github.com/accidentalgenius09/officeil-poyo) in [Vercel](https://vercel.com)
2. Add env vars for **Production** and **Preview**:
   - `MONGODB_URI`
   - `MONGODB_DB` (optional)
   - `AUTH_SECRET` (do not reuse the example value)
3. In Atlas → Network Access, allow `0.0.0.0/0`
4. Deploy (or push to `main`)

API examples: `/api/attendance`, `/api/auth/login`, `/api/auth/register`.

---

## Usage

1. **Register / sign in** — email + password; use the eye icon to show or hide the password  
2. **Theme** — celestial toggle (top-right); preference is remembered  
3. **Settings** (gear, bottom-right) — profile, policy presets, leave, holidays, CSV export, sign out  
4. **Calendar** — click days to cycle **office → WFH → unmarked**. If the previous working day (skipping weekends, holidays, and full leave) was left unmarked, it is auto-marked **WFH**  
5. **Summary cards** — goal progress (shows “Goal met — badge earned” when done), pace warnings, week count, and streak  
6. **Rewards** (trophy icon) — update streak, this year’s monthly goals (`n / 12`), special badges, and monthly history with dates  
7. **Games** (controller icon) — Sudoku, Memory Match, or 2048 (Gold at 1 monthly badge this year, Aurora at 3+)  

Errors show as toasts in the **top-right** (including badge unlocks).

Data saves to your user document in MongoDB automatically (including `rewards` and `activity` streak). If the DB is unreachable, changes stay in local cache until sync works again.

Sudoku progress, theme preference, and which badge toasts were already shown live only in the browser (`localStorage`).

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start API + Vite together |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |

---

## Project structure

```text
src/
  components/
    AuthScreen.tsx       # Sign in / register (+ password show/hide)
    CalendarGrid.tsx     # Month grid (office / WFH / leave / holiday)
    SummaryCards.tsx     # Goal, pace, streak, week insights
    SettingsPanel.tsx    # Profile, presets, leave, holidays, CSV, sign out
    RewardsPanel.tsx     # Trophy FAB + badge history modal
    ThemeToggle.tsx      # Light / dark celestial switch
    games/               # Game console, Sudoku, Memory Match, 2048
  lib/
    api.ts               # Auth session + attendance API client
    attendance.ts        # Calendar math, stats, normalize/cache
    holidays.ts          # India holiday pack import
    exportCsv.ts         # Month / year CSV download
    presets.ts           # Policy preset definitions
    rewards.ts           # Goal badges + game console themes
    analytics.ts         # GA4 custom events
    sudoku.ts            # Sudoku helpers
  App.tsx                # Main app (requires sign-in)
  main.tsx               # React root + react-hot-toast Toaster (top-right)
api/
  index.js               # Express + MongoDB + auth API
```

---

## Google Analytics

The GA4 tag is in `index.html` (measurement ID `G-TE6H7QC05N`).

1. Open the property in [Google Analytics](https://analytics.google.com)
2. Confirm the web data stream uses your production URL
3. After deploy, check **Reports → Realtime**
4. Use **Demographics** for country and **Tech** for device

### Built-in (GA4)

- Page views / sessions / users  
- Country and city (approx.)  
- Device category, browser, OS  

### Custom events

Fired via `src/lib/analytics.ts` (`trackEvent`). **Never** sends profile name or email.

| Event | When |
| --- | --- |
| `login` / `register` / `logout` | Auth actions |
| `toggle_attendance` | Calendar day status changes |
| `auto_mark_wfh` | Previous unmarked working day auto-set to WFH |
| `change_month` | Prev / next / today |
| `toggle_theme` | Light ↔ dark |
| `open_settings` / `close_settings` | Settings panel |
| `toggle_go_daily` | “Go to office daily” switch |
| `set_office_goal` | Office-day goal blurred after edit |
| `apply_policy_preset` | Policy preset applied |
| `goal_reward_earned` | Any badge unlocked (monthly, streak, achievement, etc.) |
| `open_rewards` / `close_rewards` | Rewards panel |
| `add_leave` / `remove_leave` | Leave entries |
| `add_holiday` / `remove_holiday` | Holiday entries |
| `import_holidays` | India holiday pack imported |
| `export_csv` | Month or year CSV download |
| `open_games` / `close_games` | Game console |
| `play_game` | Sudoku, Memory, or 2048 started |
| `game_complete` | Puzzle / match / 2048 win |
| `new_game` | Play again / new board |

---

## License

Copyright © Surjith K. All Rights Reserved.

(Year in the app footer updates automatically.)
