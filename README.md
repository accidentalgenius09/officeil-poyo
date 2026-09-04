# Officeil Poyo?

Track your monthly office visits — mark days in or out, plan leave, add holidays, set visit goals, and sync everything to MongoDB Atlas. Take a quick break with the built-in game console.

## Features

- **Monthly calendar** — click a day to toggle in office / not in office (unmarked counts as not in office)
- **Goal tracking** — see office days vs your monthly target and remaining working days
- **User profile** — name, email, role/team, and office-day goal
- **Go to office daily?** — when enabled, the goal becomes every working day (leave & holidays excluded)
- **Leave** — mark leave ranges in advance (shown in red; excluded from working days)
- **Holiday calendar** — add named holidays so they don’t count as working days
- **MongoDB sync** — attendance, profile, leave, and holidays persist in Atlas (with local cache fallback)
- **Light / dark mode** — celestial toggle (top-right) switches themes; choice is saved in the browser and follows system preference on first visit
- **Game console** — floating button above settings with quick break games:
  - **Sudoku** — unfinished boards save in the browser; finishing clears the save and starts a new shuffled puzzle
  - **Memory Match** — flip cards to find pairs

## Tech stack

- React 19 + TypeScript + Vite
- Express API
- MongoDB Atlas
- [Phosphor Icons](https://phosphoricons.com/)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure MongoDB

1. Create a free cluster in [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a database user
3. Under **Network Access**, allow your current IP (or `0.0.0.0/0` for local development)
4. Copy `.env.example` to `.env`
5. Paste your Atlas connection string into `MONGODB_URI`

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/office-visit-calendar?retryWrites=true&w=majority
MONGODB_DB=office-visit-calendar
PORT=3001
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

### 4. Deploy on Vercel

1. Import the GitHub repo in [Vercel](https://vercel.com)
2. Add environment variables (Production + Preview):
   - `MONGODB_URI` — your Atlas connection string
   - `MONGODB_DB` — `office-visit-calendar` (optional)
3. In Atlas → **Network Access**, allow `0.0.0.0/0`
4. Deploy (or push to `main`)

API routes are served from `api/index.js` (for example `/api/attendance`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start API + Vite together |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |

## Project structure

```
src/
  components/          # Calendar, summary cards, settings, theme toggle, games
    games/             # Game console, Sudoku, Memory Match
  lib/                 # Attendance logic, API client, Sudoku engine
  App.tsx              # Main app
api/
  index.js             # Express + MongoDB API
```

## Usage

1. Use the **theme toggle** (top-right) to switch light or dark mode — preference is remembered
2. Open **settings** (gear, bottom-right) to fill in your profile and office-day goal (or turn on **Go to office daily**)
3. Add **leave** and **holidays** as needed
4. Click calendar days to mark office attendance
5. Open the **game console** (controller icon, above settings) for Sudoku or Memory Match

Data saves to MongoDB automatically. If the database is unreachable, changes stay in local cache until the connection is restored.

Sudoku progress and theme preference are stored only in the browser (`localStorage`).
