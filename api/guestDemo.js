/**
 * Seeded AppData for Live Demo guests — rich enough that calendar,
 * upcoming, streak flame, rewards, and finance all show content.
 */

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function isWeekday(year, month, day) {
  const dow = new Date(year, month, day).getDay()
  return dow !== 0 && dow !== 6
}

function addDays(year, month, day, delta) {
  const d = new Date(year, month, day)
  d.setDate(d.getDate() + delta)
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    key: toDateKey(d.getFullYear(), d.getMonth(), d.getDate()),
  }
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

/** Build demo holidays relative to today for countdown stages. */
function buildDemoHolidays(today) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()
  const holidays = []

  // Today → paper-tear stage on the calendar
  holidays.push({
    id: newId('hol'),
    date: toDateKey(y, m, d),
    name: 'Demo Day off',
    recurring: false,
  })

  // ~5 days out → rocket stage
  const near = addDays(y, m, d, 5)
  holidays.push({
    id: newId('hol'),
    date: near.key,
    name: 'Team offsite (demo)',
    recurring: false,
  })

  // Tomorrow → also upcoming (eve was today; keep a near holiday)
  const eve = addDays(y, m, d, 1)
  holidays.push({
    id: newId('hol'),
    date: eve.key,
    name: 'Demo holiday eve',
    recurring: false,
  })

  return holidays
}

function buildMonthAttendance(year, month, today) {
  const total = daysInMonth(year, month)
  const days = {}
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : total

  // Consecutive office days ending yesterday for flame (≥5)
  let officeRun = 0
  for (let day = todayDay - 1; day >= 1 && officeRun < 6; day--) {
    if (!isWeekday(year, month, day)) continue
    const key = toDateKey(year, month, day)
    days[key] = {
      status: 'office',
      note: officeRun === 0 ? 'Demo office day' : undefined,
    }
    officeRun += 1
  }

  // Earlier mix of WFH / office
  for (let day = 1; day < todayDay - 8; day++) {
    if (!isWeekday(year, month, day)) continue
    const key = toDateKey(year, month, day)
    if (days[key]) continue
    days[key] = day % 3 === 0 ? 'wfh' : 'office'
  }

  // Today unmarked so reminders/toast features can still fire
  return { year, month, days }
}

export function buildGuestDemoData() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthKey = `${year}-${pad(month + 1)}`
  const todayKey = toDateKey(year, month, today.getDate())
  const leaveStart = addDays(year, month, today.getDate(), 12)

  const attendance = {
    [monthKey]: buildMonthAttendance(year, month, today),
  }

  const rewards = [
    {
      id: newId('rw'),
      kind: 'month_goal',
      key: monthKey,
      earnedAt: isoDaysAgo(20),
    },
    {
      id: newId('rw'),
      kind: 'first_office',
      key: 'first_office',
      earnedAt: isoDaysAgo(25),
    },
    {
      id: newId('rw'),
      kind: 'office_streak_5',
      key: 'office_streak_5',
      earnedAt: isoDaysAgo(1),
    },
    {
      id: newId('rw'),
      kind: 'holiday_curator',
      key: 'holiday_curator',
      earnedAt: isoDaysAgo(10),
    },
    {
      id: newId('rw'),
      kind: 'planner',
      key: 'planner',
      earnedAt: isoDaysAgo(15),
    },
  ]

  // Extra month_goal badges this year unlock gold console theme (3+)
  for (let i = 1; i <= 3; i++) {
    const past = new Date(year, month - i, 1)
    if (past.getFullYear() !== year) continue
    rewards.push({
      id: newId('rw'),
      kind: 'month_goal',
      key: `${past.getFullYear()}-${pad(past.getMonth() + 1)}`,
      earnedAt: isoDaysAgo(30 * i),
    })
  }

  return {
    attendance,
    settings: {
      profile: {
        name: 'Demo Guest',
        email: '',
        role: 'Product · Demo',
        goDaily: false,
        officeDaysGoal: 12,
        weeklyDigestEmail: true,
        holidayEveEmail: true,
      },
      leaves: [
        {
          id: newId('leave'),
          start: leaveStart.key,
          end: leaveStart.key,
          note: 'Personal (demo)',
          portion: 'full',
        },
      ],
      holidays: buildDemoHolidays(today),
      rewards,
      activity: {
        lastActiveDate: todayKey,
        streak: 12,
        behindMonths: [],
      },
    },
    finance: {
      currency: 'INR',
      transactions: [
        {
          id: newId('txn'),
          kind: 'income',
          amount: 85000,
          category: 'Salary',
          note: 'Demo salary credit',
          date: toDateKey(year, month, Math.min(1, daysInMonth(year, month))),
          createdAt: isoDaysAgo(5),
        },
        {
          id: newId('txn'),
          kind: 'expense',
          amount: 4200,
          category: 'Food',
          note: 'Team lunch (demo)',
          date: toDateKey(year, month, Math.max(1, today.getDate() - 2)),
          createdAt: isoDaysAgo(2),
        },
        {
          id: newId('txn'),
          kind: 'expense',
          amount: 18500,
          category: 'EMI',
          note: 'Home loan EMI (demo)',
          date: toDateKey(year, month, Math.min(5, daysInMonth(year, month))),
          createdAt: isoDaysAgo(8),
        },
      ],
      salaries: [
        {
          id: newId('sal'),
          name: 'Primary salary',
          enabled: true,
          fixedAmount: 85000,
          payday: 1,
          allowances: [{ id: newId('all'), label: 'HRA', amount: 12000 }],
        },
      ],
      emis: [
        {
          id: newId('emi'),
          name: 'Home loan',
          enabled: true,
          amount: 18500,
          dayOfMonth: 5,
        },
      ],
      investments: [
        {
          id: newId('inv'),
          name: 'Nifty SIP',
          enabled: true,
          amount: 5000,
          frequency: 'monthly',
          day: 7,
        },
      ],
      recurringExpenses: [
        {
          id: newId('rec'),
          name: 'Internet',
          enabled: true,
          amount: 999,
          category: 'Utilities',
          frequency: 'monthly',
          day: 10,
        },
      ],
      customCategories: { income: [], expense: [] },
    },
  }
}
