# Officeil Poyo?

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-lightgrey)](#license)

> Track monthly office visits — mark **office** or **WFH**, plan leave, add holidays, hit visit goals, sync to your own MongoDB account, and get Monday / holiday-eve emails. Built-in games for a quick break.

**Repo:** [accidentalgenius09/officeil-poyo](https://github.com/accidentalgenius09/officeil-poyo)

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
  - [Email digests (Brevo)](#email-digests-brevo)
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
| **Calendar** | Click a day to open the day panel: set **office / WFH / clear**, optional work note; previous unmarked working day auto-fills as **WFH**; holiday cells animate a countdown (flag / rocket / paper tear) |
| **Work status** | Short daily note (**Save note only**) or **Groq** write-up only (**Elaborate & save**), stored with that day in MongoDB |
| **Goals** | Monthly target, remaining working days, WFH count |
| **Upcoming** | Strip under summary cards: next holiday with countdown (rocket when 2–7 days out; tear-off when eve/today — same icons animate on that day in the calendar grid), next leave (or current leave), and current-month goal safety |
| **Pace & streak** | Consecutive office-day streak with a living flame (grows with streak; break shows a toast with **Undo**), plus a pace note: on pace / on the edge / cannot hit goal / goal met |
| **Presets** | Every working day · 3×/week · 2×/week · classic 12 |
| **Goal rewards** | Monthly goals, logger & office streaks, hybrid/week badges, early bird, clutch, overachiever, comeback, no-gap, quarter/half-year/perfect year, century club, planner, holiday curator, clean calendar, New Year starter, month of Sundays, night owl, weekend warrior |
| **Finance** | Money FAB → `/finance`: **Overview** (add/edit txn, optional recurring expense, month pie chart + CSV export), Income/Expenses lists, **Setup** (add/edit salaries, EMIs, investments/SIPs, recurring expenses, custom categories); recurring posts sync to Mongo |
| **Leave** | Full-day or half-day (AM/PM); full leave locks the day |
| **Holidays** | Named holidays, yearly recurrence, one-click **India** pack |
| **Export** | CSV for current month (day-by-day) or full year (month + office days) |
| **Sync** | Per-user Atlas documents + local cache fallback while signed in |
| **Theme** | Light / dark celestial toggle (saved; follows system on first visit) |
| **Brand mark** | Calendar header typewriter cycles **Officeil Poyo?** → **Went to office?** → **Still on pace?** → **WFH today?** |
| **Toasts** | Auth, sync, validation, badge unlocks, and reminders via [react-hot-toast](https://react-hot-toast.com/) (top-right; deduped so each alert shows once) |
| **Reminders** | Once per calendar day: **unmarked today** or **on the edge**. **Mondays** get a week check-in toast + themed Brevo email at 8:00 India time. **The evening before a holiday** (6:00 India time) you also get a themed email naming tomorrow’s holiday(s). Optional browser/OS notifications. Toggle emails under **Settings → Account** (**Email Monday check-in**, **Email holiday reminder**) |
| **Games** | Sudoku · Memory Match · 2048 |
| **Analytics** | GA4 visitors + custom in-app events (no profile PII) |

---

## Tech stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Express API (`api/index.js`) + Groq (work-status elaboration) + Brevo (Monday digest + holiday-eve email)
- **Database:** MongoDB Atlas
- **UI:** [Phosphor Icons](https://phosphoricons.com/), [react-hot-toast](https://react-hot-toast.com/)
- **Analytics:** Google Analytics 4 (`G-TE6H7QC05N`)
- **Hosting:** Vercel (static app + serverless API + Monday digest + holiday-eve crons)

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

Edit `.env` with your Atlas URI, a strong `AUTH_SECRET`, and (for work-status elaboration) `GROQ_API_KEY`. For Monday / holiday-eve emails, also set `CRON_SECRET`, `BREVO_API_KEY`, `DIGEST_FROM`, and optionally `APP_URL` (see [Environment variables](#environment-variables)).

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
| `GROQ_API_KEY` | For work status | Groq API key used server-side to elaborate daily notes (`POST /api/work-status/elaborate`) |
| `GROQ_MODEL` | No | Groq chat model (default `openai/gpt-oss-20b`) |
| `CRON_SECRET` | For digest mail | Random string Vercel sends as `Authorization: Bearer …` on cron runs. Also required to trigger jobs yourself |
| `BREVO_API_KEY` | For digest mail | [Brevo](https://www.brevo.com) API key (`SMTP & API` → API keys). Turn off **Authorized IPs → Blocking for API** (or allow your machine / Vercel IPs) so sends are not blocked |
| `DIGEST_FROM` | For digest mail | Verified Brevo sender, for example `Officeil Poyo <you@gmail.com>` (verify under Brevo → Senders; a custom domain is optional) |
| `APP_URL` | No | Live app URL for the **Open Officeil Poyo** button in digest emails. Defaults to `https://officeil-poyo.vercel.app`, or the Vercel production URL when deployed |
| `DIGEST_TIMEZONE` | No | Calendar timezone for digests (default `Asia/Kolkata`). Cron schedules are fixed in UTC (see table below) |

Example `.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/office-visit-calendar?retryWrites=true&w=majority
MONGODB_DB=office-visit-calendar
PORT=3001
AUTH_SECRET=change-me-to-a-long-random-string
GROQ_API_KEY=YOUR_GROQ_API_KEY
CRON_SECRET=change-me-to-another-long-random-string
BREVO_API_KEY=xkeysib-your_brevo_api_key
DIGEST_FROM=Officeil Poyo <you@gmail.com>
APP_URL=https://officeil-poyo.vercel.app
```

### Email digests (Brevo)

1. Create a free [Brevo](https://www.brevo.com) account  
2. **Senders** — add and verify the address used in `DIGEST_FROM` (Gmail works as a single sender; no custom domain required)  
3. **SMTP & API → API keys** — generate a key → `BREVO_API_KEY`  
4. **Security → Authorized IPs** — **Deactivate for API** (recommended for local + Vercel), or allow each outbound IP  
5. Set `CRON_SECRET`, `DIGEST_FROM`, and optional `APP_URL`  
6. On Vercel, add the same vars and deploy so the crons in `vercel.json` are registered  

Emails use the app light theme (sage background, brand green, gold accents) with an **Open Officeil Poyo** button.

| Cron | Schedule (UTC) | India time | Endpoint |
| --- | --- | --- | --- |
| Monday week check-in | `30 2 * * 1` | Monday 08:00 | `/api/cron/weekly-digest` |
| Holiday eve | `30 12 * * *` | Daily 18:00 | `/api/cron/holiday-eve` |

**Test locally**

```bash
# Monday digest (even if today is not Monday)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3001/api/cron/weekly-digest?force=1"

# Holiday eve — treats asOf as “today”, so tomorrow must be a holiday on your calendar
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3001/api/cron/holiday-eve?force=1&asOf=2026-09-18"
```

Without `?force=1`, the Monday job no-ops unless it is Monday in `DIGEST_TIMEZONE`. The holiday-eve job no-ops when tomorrow is not a holiday (or the mail was already sent for that holiday date).

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
   - `GROQ_API_KEY` (for work-status elaboration)
   - `CRON_SECRET`, `BREVO_API_KEY`, `DIGEST_FROM`, and optional `APP_URL` (Monday + holiday-eve emails; verify the FROM address under Brevo → Senders; deactivate API IP blocking or allow outbound IPs)
3. In Atlas → Network Access, allow `0.0.0.0/0`
4. Deploy (or push to `main`). Crons in `vercel.json`: Monday digest (`30 2 * * 1`) and holiday-eve (`30 12 * * *`, 18:00 India time). Accounts can turn each email off in Settings.

API examples: `/api/attendance`, `/api/auth/login`, `/api/auth/register`, `/api/cron/weekly-digest`, `/api/cron/holiday-eve`.

---

## Usage

1. **Register / sign in** — email + password; use the eye icon to show or hide the password  
2. **Theme** — celestial toggle (top-right); preference is remembered. The calendar brand mark typewrites and cycles **Officeil Poyo?** / **Went to office?** / **Still on pace?** / **WFH today?**  
3. **Settings** (gear, bottom-right) — profile, policy presets, leave, holidays, CSV export, **Email Monday check-in**, **Email holiday reminder**, **Enable browser notifications**, sign out  
4. **Calendar** — click a day to open the day panel: set **Office / WFH / Clear**, optionally write a short work note. **Elaborate & save** calls Groq and stores **only** the elaborated summary (not the short draft). **Save note only** stores your raw note. Days with a saved note or summary show a small dot. Holiday cells animate by stage (soft flag glow 8+ days, rocket launch this week, paper tear on eve/today). If the previous working day (skipping weekends, holidays, and full leave) was left unmarked, it is auto-marked **WFH**. Breaking an office streak shows a toast with **Undo**  
5. **Summary cards** — **Office days** (count + WFH + this week), **Goal progress** (left to goal / met), and **Pace & streak** (flame + consecutive office streak + pace note)  
6. **Upcoming** — under the cards: next holiday with countdown (rocket / tear-off as the day nears), next leave (or current leave), and whether this month’s goal is safe after N more office days (uses today’s month even if you browse another month)  
7. **Reminders** — after load, if today is an unmarked working day or you are on the edge of your monthly goal, you get a toast once that day. On Monday you also get a week check-in toast once that week. With notifications enabled, those alerts can appear as browser/OS notifications. When Brevo is configured: Monday 8:00 India time week-check email; **6:00 India time the day before any holiday** on your calendar (holiday name + date). Toggle under **Settings → Account**  
8. **Rewards** (trophy icon) — monthly goals, update streaks (7/30/60/100 days), perfect year; history with dates; unlock toasts appear once per badge  
9. **Finance** (money icon, above rewards) — `/finance` with **Overview** (add/edit transactions, optional recurring expense, month-selectable pie chart + **Export CSV** for that month; transaction lists show 10 at a time with **See more**; a simple scroll-to-top control appears after you scroll to All transactions), **Income** / **Expenses** lists, and **Setup** (add/edit salaries with allowances, EMIs, investment SIPs, recurring expenses, custom categories).  
10. **Games** (controller icon) — Sudoku, Memory Match, or 2048 (Gold/Aurora from this year’s monthly badges)  

Hit monthly goals for badges. Log attendance daily for logger streaks (7→100). Build office streaks (5/10/20). Hit **all 12 months** for perfect year — plus hybrid, week, planning, and milestone badges. Console themes use **this year’s monthly goal badges** and reset each year.

Errors, reminders, and badge unlocks show as toasts in the **top-right**.

Data saves to your user document in MongoDB automatically (attendance, settings, and finance). Pending saves flush when you leave a page so finance is not stuck only in local cache. The API also refuses to overwrite existing finance with an empty payload. If the DB is unreachable, changes stay in local cache until sync works again. Sync never replaces local finance with an empty remote copy (so older API saves that omitted finance cannot wipe SIPs/salaries still on the device).

Sudoku progress, theme preference, reminder “already shown” flags (daily toasts, Monday digest once per week), and notification permission prompt state live in the browser (`localStorage`). Holiday-eve / Monday email “already sent” markers live on the user document in MongoDB.

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
    common/
      AppLoader.tsx      # Shared themed loader (session + section loads)
    CalendarGrid.tsx     # Month grid (office / WFH / leave / holiday tear-crack / note dot)
    HolidayTearCrack.tsx # Holiday countdown overlays (flag / rocket / paper tear)
    DayStatusPanel.tsx   # Day status + work note / Groq elaborate
    SummaryCards.tsx     # Office days, goal progress, pace & streak flame
    UpcomingStrip.tsx    # Next holiday countdown / leave / goal safety under cards
    BrandTypewriter.tsx  # Animated calendar brand mark (type / backspace cycle)
    SettingsPanel.tsx    # Profile, presets, leave, holidays, CSV, email toggles, notifications, sign out
    RewardsPanel.tsx     # Trophy FAB + badge history modal
    FinanceFab.tsx       # Money FAB → /finance
    ThemeToggle.tsx      # Light / dark celestial switch
    finance/
      FinancePage.tsx    # Financial segments (overview / income / expenses)
    games/               # Game console, Sudoku, Memory Match, 2048
  lib/
    api.ts               # Auth session + attendance + work-status API client
    attendance.ts        # Calendar math, stats, DayRecord helpers, normalize/cache
    finance.ts           # Finance transactions + month summaries
    holidays.ts          # India holiday pack import
    exportCsv.ts         # Month / year CSV download (includes work note/summary)
    presets.ts           # Policy preset definitions
    rewards.ts           # Goal badges + game console themes
    reminders.ts         # Daily unmarked / on-edge toasts, Monday digest, browser notifications
    upcoming.ts          # Next holiday urgency / leave / goal-safety strip helpers
    analytics.ts         # GA4 custom events
    sudoku.ts            # Sudoku helpers
  App.tsx                # Calendar app (requires sign-in)
  main.tsx               # Router + react-hot-toast Toaster (top-right)
api/
  index.js               # Express + MongoDB + auth + Groq elaborate + cron routes
  weeklyDigest.js        # Monday digest + holiday-eve themed Brevo emails
vercel.json              # Rewrites + Monday digest + holiday-eve crons
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
| `goal_reward_earned` | Monthly office goal met or achievement badge unlocked |
| `open_rewards` / `close_rewards` | Rewards panel |
| `open_finance` / `close_finance` | Navigate to / from finance module |
| `finance_segment` | Overview / Income / Expenses tab |
| `finance_add_transaction` | Income or expense added |
| `finance_edit_transaction` | Existing transaction updated |
| `finance_export_month` | Finance month CSV downloaded |
| `finance_add_recurring_expense` | Recurring expense rule created from Overview |
| `finance_delete_transaction` | Transaction removed |
| `finance_save_salary` | Salary settings saved |
| `finance_add_allowance` | Salary allowance added |
| `finance_add_emi` | Recurring EMI added |
| `finance_add_investment` | Recurring investment / SIP added |
| `finance_add_category` / `finance_remove_category` | Custom income/expense category |
| `finance_recurring_applied` | Auto salary/EMI/investment entries posted on load |
| `add_leave` / `remove_leave` | Leave entries |
| `add_holiday` / `remove_holiday` | Holiday entries |
| `import_holidays` | India holiday pack imported |
| `export_csv` | Month or year CSV download |
| `elaborate_work_status` | User asked Groq to elaborate a daily note |
| `save_work_status` | Daily note / summary saved into attendance |
| `reminder_shown` | Daily unmarked / on-edge toast, or Monday week check-in (once per kind per day, digest once per week) |
| `reminder_browser` | Same reminder also sent as a browser notification |
| `toggle_weekly_digest_email` | Monday digest email turned on or off |
| `toggle_holiday_eve_email` | Holiday-eve reminder email turned on or off |
| `enable_notifications` | User tapped Enable browser notifications (includes resulting permission) |
| `open_games` / `close_games` | Game console |
| `play_game` | Sudoku, Memory, or 2048 started |
| `game_complete` | Puzzle / match / 2048 win |
| `new_game` | Play again / new board |

---

## License

Copyright © Surjith K. All Rights Reserved.

(Year in the app footer updates automatically.)
