# Officeil Poyo?

Track your monthly office visits — mark days in office or WFH, plan leave, add holidays, set visit goals, and sync everything to your own MongoDB account. Take a quick break with the built-in game console.

## Features

- **Email / password auth** — each account stores its own attendance, profile, leave, and holidays in MongoDB
- **Monthly calendar** — click a day to cycle **office → WFH → unmarked**
- **Goal tracking** — see office days vs your monthly target and remaining working days
- **Pace & streak** — “can I still hit the goal?” message, this week’s office count, and consecutive office-day streak
- **Policy presets** — one-tap targets (every working day, 3×/week, 2×/week, Tue–Thu, classic 12)
- **User profile** — name, email, role/team, and office-day goal
- **Go to office daily?** — when enabled, the goal becomes every working day (leave & holidays excluded)
- **Leave** — full-day or half-day (AM/PM) ranges; full leave locks the day, half leave still allows office/WFH
- **Holiday calendar** — named holidays, optional yearly recurrence, and one-click **India** pack import
- **CSV export** — download the current month day-by-day, or a year summary (month name + office days)
- **MongoDB sync** — per-user data in Atlas (with local cache fallback while signed in)
- **Light / dark mode** — celestial toggle (top-right); choice is saved and follows system preference on first visit
- **Toast alerts** — auth, sync, and settings validation errors via [react-hot-toast](https://react-hot-toast.com/)
- **Game console** — floating button above settings:
  - **Sudoku** — unfinished boards save in the browser
  - **Memory Match** — flip cards to find pairs
  - **2048** — merge tiles with arrows or swipe
- **Google Analytics** — visitor counts, country, device, plus custom events for in-app actions (no profile PII)

## Tech stack

- React 19 + TypeScript + Vite
- Express API
- MongoDB Atlas
- [react-hot-toast](https://react-hot-toast.com/)
- [Phosphor Icons](https://phosphoricons.com/)
- Google Analytics 4 (`gtag.js`, measurement ID `G-8VCWT5HNSF`)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure MongoDB & auth

1. Create a free cluster in [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a database user
3. Under **Network Access**, allow your current IP (or `0.0.0.0/0` for local development)
4. Copy `.env.example` to `.env`
5. Paste your Atlas connection string into `MONGODB_URI`
6. Set a long random `AUTH_SECRET` (used to sign login tokens)

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/office-visit-calendar?retryWrites=true&w=majority
MONGODB_DB=office-visit-calendar
PORT=3001
AUTH_SECRET=change-me-to-a-long-random-string
```

> If your IP changes, update **Network Access** in Atlas or the app will fall back to local cache.
> For Vercel, Atlas must allow **`0.0.0.0/0`** (Vercel IPs are dynamic).

### 3. Run

```bash
npm run dev
```

This starts:

- App: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3001](http://localhost:3001)

Register an account on first visit, then mark attendance as usual.

> The **first** registered account inherits any legacy shared `default` document so existing data is not lost.

### 4. Deploy on Vercel

1. Import the GitHub repo in [Vercel](https://vercel.com)
2. Add environment variables (Production + Preview):
   - `MONGODB_URI` — your Atlas connection string
   - `MONGODB_DB` — `office-visit-calendar` (optional)
   - `AUTH_SECRET` — a long random secret (do not reuse the example value)
3. In Atlas → **Network Access**, allow `0.0.0.0/0`
4. Deploy (or push to `main`)

API routes are served from `api/index.js` (for example `/api/attendance`, `/api/auth/login`).

### 5. Google Analytics

The GA4 tag is already in `index.html`. In [Google Analytics](https://analytics.google.com):

1. Open the property for measurement ID `G-8VCWT5HNSF`
2. Confirm the web data stream uses your production URL
3. After deploy, check **Reports → Realtime** while using the app
4. Use **Reports → User → Demographics** for country and **Reports → Tech** for device

#### Automatic (built into GA4)

- Page views / sessions / users
- Country and city (approx.)
- Device category, browser, OS

#### Custom in-app events

Fired via `src/lib/analytics.ts` (`trackEvent`). Profile name and email are never sent.

| Event | When |
| --- | --- |
| `login` / `register` / `logout` | Auth actions |
| `toggle_attendance` | Calendar day status changes |
| `change_month` | Prev / next / today |
| `toggle_theme` | Light ↔ dark |
| `open_settings` / `close_settings` | Settings panel |
| `toggle_go_daily` | “Go to office daily” switch |
| `set_office_goal` | Office-day goal blurred after edit |
| `apply_policy_preset` | Policy preset applied |
| `add_leave` / `remove_leave` | Leave entries |
| `add_holiday` / `remove_holiday` | Holiday entries |
| `import_holidays` | India holiday pack imported |
| `export_csv` | Month or year CSV download |
| `open_games` / `close_games` | Game console |
| `play_game` | Sudoku, Memory, or 2048 started |
| `game_complete` | Puzzle / match / 2048 win |
| `new_game` | Play again / new board |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start API + Vite together |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |

## Project structure

```
src/
  components/          # Auth, calendar, summary, settings, theme, games
    games/             # Game console, Sudoku, Memory Match, 2048
  lib/                 # Attendance, API/auth, holidays, CSV export, presets, analytics
  App.tsx              # Main app (requires sign-in)
  main.tsx             # React root + react-hot-toast Toaster
api/
  index.js             # Express + MongoDB + auth API
```

## Usage

1. **Register / sign in** with email and password
2. Use the **theme toggle** (top-right) to switch light or dark mode
3. Open **settings** (gear, bottom-right) for profile, policy presets, leave, holidays, CSV export, and sign out
4. Click calendar days to cycle **office → WFH → unmarked**
5. Open the **game console** (controller icon, above settings) for Sudoku, Memory Match, or 2048

Data saves to your user document in MongoDB automatically. If the database is unreachable, changes stay in local cache until the connection is restored.

Sudoku progress and theme preference are stored only in the browser (`localStorage`).

## License

Copyright © Surjith K. All Rights Reserved. (Year in the app footer updates automatically.)
