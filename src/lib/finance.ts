import type {
  AppData,
  FinanceAllowance,
  FinanceCustomCategories,
  FinanceData,
  FinanceEmi,
  FinanceInvestment,
  FinanceInvestmentFrequency,
  FinanceRecurringExpense,
  FinanceSalary,
  FinanceTransaction,
  FinanceTxnKind,
} from '../types'

export const FINANCE_CATEGORIES = {
  income: ['Salary', 'Freelance', 'Refund', 'Other income'],
  expense: [
    'EMI',
    'Investment',
    'Food',
    'Transport',
    'Rent',
    'Utilities',
    'Shopping',
    'Health',
    'Entertainment',
    'Other expense',
  ],
} as const

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function newFinanceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `fin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyCustomCategories(): FinanceCustomCategories {
  return { income: [], expense: [] }
}

export function createSalary(input: {
  name: string
  fixedAmount: number
  payday: number
  enabled?: boolean
  allowances?: FinanceAllowance[]
}): FinanceSalary {
  return {
    id: newFinanceId(),
    name: input.name.trim().slice(0, 60) || 'Salary',
    enabled: input.enabled !== false,
    fixedAmount: Math.round(Math.max(0, Number(input.fixedAmount) || 0) * 100) / 100,
    payday: Math.min(31, Math.max(1, Math.floor(Number(input.payday) || 1))),
    allowances: input.allowances ?? [],
  }
}

export function emptyFinance(): FinanceData {
  return {
    currency: 'INR',
    transactions: [],
    salaries: [],
    emis: [],
    investments: [],
    recurringExpenses: [],
    customCategories: emptyCustomCategories(),
  }
}

function clampDay(year: number, month: number, day: number): number {
  const last = new Date(year, month + 1, 0).getDate()
  return Math.min(Math.max(1, day), last)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function monthPrefix(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`
}

export function dateForDayInMonth(
  year: number,
  month: number,
  dayOfMonth: number,
): string {
  const day = clampDay(year, month, dayOfMonth)
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function normalizeAllowance(raw: unknown): FinanceAllowance | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<FinanceAllowance>
  const amount = Number(source.amount)
  if (!Number.isFinite(amount) || amount < 0) return null
  const label =
    typeof source.label === 'string' && source.label.trim()
      ? source.label.trim().slice(0, 40)
      : 'Allowance'
  return {
    id: typeof source.id === 'string' && source.id ? source.id : newFinanceId(),
    label,
    amount: Math.round(amount * 100) / 100,
  }
}

function normalizeSalary(raw: unknown): FinanceSalary | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<FinanceSalary> & { id?: string }
  const fixedAmount = Number(source.fixedAmount)
  const payday = Number(source.payday)
  const allowances = Array.isArray(source.allowances)
    ? source.allowances
        .map(normalizeAllowance)
        .filter((v): v is FinanceAllowance => v !== null)
    : []
  const name =
    typeof source.name === 'string' && source.name.trim()
      ? source.name.trim().slice(0, 60)
      : 'Salary'
  return {
    id: typeof source.id === 'string' && source.id ? source.id : newFinanceId(),
    name,
    enabled: source.enabled !== false,
    fixedAmount:
      Number.isFinite(fixedAmount) && fixedAmount >= 0
        ? Math.round(fixedAmount * 100) / 100
        : 0,
    payday:
      Number.isFinite(payday) && payday >= 1 && payday <= 31
        ? Math.floor(payday)
        : 1,
    allowances,
  }
}

function normalizeSalaries(raw: unknown, legacySalary?: unknown): FinanceSalary[] {
  if (Array.isArray(raw)) {
    return raw
      .map(normalizeSalary)
      .filter((v): v is FinanceSalary => v !== null)
  }
  // Migrate legacy single `salary` object → one-item array
  if (legacySalary && typeof legacySalary === 'object') {
    const one = normalizeSalary(legacySalary)
    return one ? [one] : []
  }
  return []
}

function normalizeInvestment(raw: unknown): FinanceInvestment | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<FinanceInvestment>
  const amount = Number(source.amount)
  const day = Number(source.day)
  const frequency: FinanceInvestmentFrequency | null =
    source.frequency === 'weekly' || source.frequency === 'monthly'
      ? source.frequency
      : null
  if (!frequency || !Number.isFinite(amount) || amount <= 0) return null
  if (frequency === 'monthly') {
    if (!Number.isFinite(day) || day < 1 || day > 31) return null
  } else if (!Number.isFinite(day) || day < 0 || day > 6) {
    return null
  }
  const name =
    typeof source.name === 'string' && source.name.trim()
      ? source.name.trim().slice(0, 60)
      : 'Investment'
  return {
    id: typeof source.id === 'string' && source.id ? source.id : newFinanceId(),
    name,
    amount: Math.round(amount * 100) / 100,
    frequency,
    day: Math.floor(day),
    enabled: source.enabled !== false,
  }
}

function normalizeRecurringExpense(raw: unknown): FinanceRecurringExpense | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<FinanceRecurringExpense>
  const amount = Number(source.amount)
  const day = Number(source.day)
  const frequency: FinanceInvestmentFrequency | null =
    source.frequency === 'weekly' || source.frequency === 'monthly'
      ? source.frequency
      : null
  if (!frequency || !Number.isFinite(amount) || amount <= 0) return null
  if (frequency === 'monthly') {
    if (!Number.isFinite(day) || day < 1 || day > 31) return null
  } else if (!Number.isFinite(day) || day < 0 || day > 6) {
    return null
  }
  const name =
    typeof source.name === 'string' && source.name.trim()
      ? source.name.trim().slice(0, 60)
      : 'Recurring expense'
  const category =
    typeof source.category === 'string' && source.category.trim()
      ? source.category.trim().slice(0, 40)
      : 'Other expense'
  return {
    id: typeof source.id === 'string' && source.id ? source.id : newFinanceId(),
    name,
    amount: Math.round(amount * 100) / 100,
    category,
    frequency,
    day: Math.floor(day),
    enabled: source.enabled !== false,
  }
}

function normalizeEmi(raw: unknown): FinanceEmi | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<FinanceEmi>
  const amount = Number(source.amount)
  const dayOfMonth = Number(source.dayOfMonth)
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    return null
  }
  const name =
    typeof source.name === 'string' && source.name.trim()
      ? source.name.trim().slice(0, 60)
      : 'EMI'
  const startMonth =
    typeof source.startMonth === 'string' &&
    /^\d{4}-\d{2}$/.test(source.startMonth)
      ? source.startMonth
      : undefined
  const endMonth =
    typeof source.endMonth === 'string' && /^\d{4}-\d{2}$/.test(source.endMonth)
      ? source.endMonth
      : undefined
  return {
    id: typeof source.id === 'string' && source.id ? source.id : newFinanceId(),
    name,
    amount: Math.round(amount * 100) / 100,
    dayOfMonth: Math.floor(dayOfMonth),
    enabled: source.enabled !== false,
    ...(startMonth ? { startMonth } : {}),
    ...(endMonth ? { endMonth } : {}),
  }
}

function normalizeCategoryList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const name = item.trim().slice(0, 40)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function normalizeCustomCategories(raw: unknown): FinanceCustomCategories {
  if (!raw || typeof raw !== 'object') return emptyCustomCategories()
  const source = raw as Partial<FinanceCustomCategories>
  return {
    income: normalizeCategoryList(source.income),
    expense: normalizeCategoryList(source.expense),
  }
}

export function normalizeFinance(raw: unknown): FinanceData {
  if (!raw || typeof raw !== 'object') return emptyFinance()
  const source = raw as Partial<FinanceData>
  const currency =
    typeof source.currency === 'string' && source.currency.trim()
      ? source.currency.trim().slice(0, 8)
      : 'INR'
  const transactions = Array.isArray(source.transactions)
    ? source.transactions
        .map(normalizeTransaction)
        .filter((v): v is FinanceTransaction => v !== null)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
        )
    : []
  const emis = Array.isArray(source.emis)
    ? source.emis
        .map(normalizeEmi)
        .filter((v): v is FinanceEmi => v !== null)
    : []
  const investments = Array.isArray(source.investments)
    ? source.investments
        .map(normalizeInvestment)
        .filter((v): v is FinanceInvestment => v !== null)
    : []
  const recurringExpenses = Array.isArray(source.recurringExpenses)
    ? source.recurringExpenses
        .map(normalizeRecurringExpense)
        .filter((v): v is FinanceRecurringExpense => v !== null)
    : []
  return {
    currency,
    transactions,
    salaries: normalizeSalaries(
      source.salaries,
      (source as { salary?: unknown }).salary,
    ),
    emis,
    investments,
    recurringExpenses,
    customCategories: normalizeCustomCategories(source.customCategories),
  }
}

function normalizeTransaction(raw: unknown): FinanceTransaction | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<FinanceTransaction>
  const kind = source.kind === 'income' || source.kind === 'expense' ? source.kind : null
  const amount = Number(source.amount)
  if (!kind || !Number.isFinite(amount) || amount <= 0) return null
  const date =
    typeof source.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.date)
      ? source.date
      : null
  if (!date) return null
  const sourceKey =
    typeof source.sourceKey === 'string' && source.sourceKey.trim()
      ? source.sourceKey.trim().slice(0, 80)
      : undefined
  return {
    id: typeof source.id === 'string' && source.id ? source.id : newFinanceId(),
    kind,
    amount: Math.round(amount * 100) / 100,
    category:
      typeof source.category === 'string' && source.category.trim()
        ? source.category.trim().slice(0, 40)
        : kind === 'income'
          ? 'Other income'
          : 'Other expense',
    note: typeof source.note === 'string' ? source.note.trim().slice(0, 200) : '',
    date,
    createdAt:
      typeof source.createdAt === 'string' && source.createdAt
        ? source.createdAt
        : new Date().toISOString(),
    ...(sourceKey ? { sourceKey } : {}),
  }
}

export function getFinance(data: AppData): FinanceData {
  return normalizeFinance(data.finance)
}

export function withFinance(data: AppData, finance: FinanceData): AppData {
  return { ...data, finance: normalizeFinance(finance) }
}

/** True when there is nothing user-entered under finance. */
export function isFinanceEmpty(finance: FinanceData): boolean {
  const f = normalizeFinance(finance)
  return (
    f.transactions.length === 0 &&
    f.salaries.length === 0 &&
    f.emis.length === 0 &&
    f.investments.length === 0 &&
    f.recurringExpenses.length === 0 &&
    f.customCategories.income.length === 0 &&
    f.customCategories.expense.length === 0
  )
}

/**
 * Keep local finance when remote has none (e.g. older API dropped finance on save).
 * Prevents a sync from wiping salaries / transactions still in local cache.
 */
export function preferLocalFinanceIfRemoteEmpty(
  remote: AppData,
  local: AppData,
): { data: AppData; restoredFinance: boolean } {
  const remoteFinance = getFinance(remote)
  const localFinance = getFinance(local)
  if (isFinanceEmpty(remoteFinance) && !isFinanceEmpty(localFinance)) {
    return {
      data: withFinance(remote, localFinance),
      restoredFinance: true,
    }
  }
  return { data: remote, restoredFinance: false }
}

export function todayInputValue(today: Date = new Date()): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function createTransaction(input: {
  kind: FinanceTxnKind
  amount: number
  category: string
  note?: string
  date: string
  sourceKey?: string
}): FinanceTransaction {
  return {
    id: newFinanceId(),
    kind: input.kind,
    amount: Math.round(Number(input.amount) * 100) / 100,
    category:
      input.category.trim() ||
      (input.kind === 'income' ? 'Other income' : 'Other expense'),
    note: (input.note ?? '').trim().slice(0, 200),
    date: input.date,
    createdAt: new Date().toISOString(),
    ...(input.sourceKey ? { sourceKey: input.sourceKey } : {}),
  }
}

export function createAllowance(label: string, amount: number): FinanceAllowance {
  return {
    id: newFinanceId(),
    label: label.trim().slice(0, 40) || 'Allowance',
    amount: Math.round(Number(amount) * 100) / 100,
  }
}

export function createEmi(input: {
  name: string
  amount: number
  dayOfMonth: number
  startMonth?: string
  endMonth?: string
}): FinanceEmi {
  return {
    id: newFinanceId(),
    name: input.name.trim().slice(0, 60) || 'EMI',
    amount: Math.round(Number(input.amount) * 100) / 100,
    dayOfMonth: Math.min(31, Math.max(1, Math.floor(input.dayOfMonth))),
    enabled: true,
    ...(input.startMonth ? { startMonth: input.startMonth } : {}),
    ...(input.endMonth ? { endMonth: input.endMonth } : {}),
  }
}

export function createInvestment(input: {
  name: string
  amount: number
  frequency: FinanceInvestmentFrequency
  day: number
}): FinanceInvestment {
  const frequency = input.frequency === 'weekly' ? 'weekly' : 'monthly'
  const dayRaw = Math.floor(Number(input.day))
  const day =
    frequency === 'weekly'
      ? Math.min(6, Math.max(0, dayRaw))
      : Math.min(31, Math.max(1, dayRaw))
  return {
    id: newFinanceId(),
    name: input.name.trim().slice(0, 60) || 'Mutual Fund',
    amount: Math.round(Number(input.amount) * 100) / 100,
    frequency,
    day,
    enabled: true,
  }
}

export function createRecurringExpense(input: {
  name: string
  amount: number
  category: string
  frequency: FinanceInvestmentFrequency
  day: number
}): FinanceRecurringExpense {
  const frequency = input.frequency === 'weekly' ? 'weekly' : 'monthly'
  const dayRaw = Math.floor(Number(input.day))
  const day =
    frequency === 'weekly'
      ? Math.min(6, Math.max(0, dayRaw))
      : Math.min(31, Math.max(1, dayRaw))
  return {
    id: newFinanceId(),
    name: input.name.trim().slice(0, 60) || input.category.trim().slice(0, 60) || 'Recurring',
    amount: Math.round(Number(input.amount) * 100) / 100,
    category: input.category.trim().slice(0, 40) || 'Other expense',
    frequency,
    day,
    enabled: true,
  }
}

export function investmentScheduleLabel(inv: {
  frequency: FinanceInvestmentFrequency
  day: number
}): string {
  if (inv.frequency === 'weekly') {
    return `every ${WEEKDAY_LABELS[inv.day] ?? 'week'}`
  }
  return `day ${inv.day} each month`
}

export function salaryTotal(salary: FinanceSalary): number {
  const allowances = salary.allowances.reduce((sum, a) => sum + a.amount, 0)
  return Math.round((salary.fixedAmount + allowances) * 100) / 100
}

export function salaryBreakdownNote(salary: FinanceSalary): string {
  const parts = [`${salary.name}: fixed ${salary.fixedAmount}`]
  for (const a of salary.allowances) {
    if (a.amount > 0) parts.push(`${a.label} ${a.amount}`)
  }
  return parts.join(' + ')
}

function hasSourceKey(
  transactions: FinanceTransaction[],
  sourceKey: string,
): boolean {
  return transactions.some((t) => t.sourceKey === sourceKey)
}

function iterMonthsBack(today: Date, monthsBack: number): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = []
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1)
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() })
  }
  return out.reverse()
}

/** Occurrence dates for a weekday on or before today, going weeksBack. */
function iterWeeklyDates(
  weekday: number,
  today: Date,
  weeksBack: number,
): string[] {
  const out: string[] = []
  const cursor = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  while (cursor.getDay() !== weekday) {
    cursor.setDate(cursor.getDate() - 1)
  }
  for (let i = 0; i <= weeksBack; i++) {
    const d = new Date(cursor)
    d.setDate(cursor.getDate() - i * 7)
    out.push(todayInputValue(d))
  }
  return out.reverse()
}

/**
 * Post due salary / EMI / investment entries through today (lookback months).
 * Idempotent via sourceKey on each generated transaction.
 */
export function applyRecurringFinance(
  finance: FinanceData,
  today: Date = new Date(),
  monthsBack = 3,
): { finance: FinanceData; added: number } {
  const todayKey = todayInputValue(today)
  let transactions = [...finance.transactions]
  let added = 0
  const months = iterMonthsBack(today, monthsBack)
  const weeksBack = monthsBack * 5

  for (const salary of finance.salaries) {
    const total = salaryTotal(salary)
    if (!salary.enabled || total <= 0) continue
    for (const { year, month } of months) {
      const date = dateForDayInMonth(year, month, salary.payday)
      if (date > todayKey) continue
      const sourceKey = `recurring:salary:${salary.id}:${monthPrefix(year, month)}`
      if (hasSourceKey(transactions, sourceKey)) continue
      // Also skip legacy single-salary keys if migrating
      const legacyKey = `recurring:salary:${monthPrefix(year, month)}`
      if (
        finance.salaries.length === 1 &&
        hasSourceKey(transactions, legacyKey)
      ) {
        continue
      }
      transactions = [
        createTransaction({
          kind: 'income',
          amount: total,
          category: 'Salary',
          note: salaryBreakdownNote(salary),
          date,
          sourceKey,
        }),
        ...transactions,
      ]
      added += 1
    }
  }

  for (const emi of finance.emis) {
    if (!emi.enabled || emi.amount <= 0) continue
    for (const { year, month } of months) {
      const prefix = monthPrefix(year, month)
      if (emi.startMonth && prefix < emi.startMonth) continue
      if (emi.endMonth && prefix > emi.endMonth) continue
      const date = dateForDayInMonth(year, month, emi.dayOfMonth)
      if (date > todayKey) continue
      const sourceKey = `recurring:emi:${emi.id}:${prefix}`
      if (hasSourceKey(transactions, sourceKey)) continue
      transactions = [
        createTransaction({
          kind: 'expense',
          amount: emi.amount,
          category: 'EMI',
          note: emi.name,
          date,
          sourceKey,
        }),
        ...transactions,
      ]
      added += 1
    }
  }

  for (const inv of finance.investments) {
    if (!inv.enabled || inv.amount <= 0) continue
    if (inv.frequency === 'monthly') {
      for (const { year, month } of months) {
        const date = dateForDayInMonth(year, month, inv.day)
        if (date > todayKey) continue
        const sourceKey = `recurring:investment:${inv.id}:${monthPrefix(year, month)}`
        if (hasSourceKey(transactions, sourceKey)) continue
        transactions = [
          createTransaction({
            kind: 'expense',
            amount: inv.amount,
            category: 'Investment',
            note: `${inv.name} (monthly SIP)`,
            date,
            sourceKey,
          }),
          ...transactions,
        ]
        added += 1
      }
    } else {
      for (const date of iterWeeklyDates(inv.day, today, weeksBack)) {
        if (date > todayKey) continue
        const sourceKey = `recurring:investment:${inv.id}:${date}`
        if (hasSourceKey(transactions, sourceKey)) continue
        transactions = [
          createTransaction({
            kind: 'expense',
            amount: inv.amount,
            category: 'Investment',
            note: `${inv.name} (weekly SIP)`,
            date,
            sourceKey,
          }),
          ...transactions,
        ]
        added += 1
      }
    }
  }

  for (const item of finance.recurringExpenses) {
    if (!item.enabled || item.amount <= 0) continue
    const note =
      item.frequency === 'weekly'
        ? `${item.name} (weekly)`
        : `${item.name} (monthly)`
    if (item.frequency === 'monthly') {
      for (const { year, month } of months) {
        const date = dateForDayInMonth(year, month, item.day)
        if (date > todayKey) continue
        const sourceKey = `recurring:expense:${item.id}:${monthPrefix(year, month)}`
        if (hasSourceKey(transactions, sourceKey)) continue
        transactions = [
          createTransaction({
            kind: 'expense',
            amount: item.amount,
            category: item.category,
            note,
            date,
            sourceKey,
          }),
          ...transactions,
        ]
        added += 1
      }
    } else {
      for (const date of iterWeeklyDates(item.day, today, weeksBack)) {
        if (date > todayKey) continue
        const sourceKey = `recurring:expense:${item.id}:${date}`
        if (hasSourceKey(transactions, sourceKey)) continue
        transactions = [
          createTransaction({
            kind: 'expense',
            amount: item.amount,
            category: item.category,
            note,
            date,
            sourceKey,
          }),
          ...transactions,
        ]
        added += 1
      }
    }
  }

  if (added === 0) return { finance, added: 0 }

  return {
    finance: normalizeFinance({ ...finance, transactions }),
    added,
  }
}

export function categoriesForKind(
  finance: FinanceData,
  kind: FinanceTxnKind,
): string[] {
  const defaults = FINANCE_CATEGORIES[kind] as readonly string[]
  const custom = finance.customCategories[kind]
  const seen = new Set(defaults.map((c) => c.toLowerCase()))
  const merged = [...defaults]
  for (const name of custom) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(name)
  }
  return merged
}

export function addCustomCategory(
  finance: FinanceData,
  kind: FinanceTxnKind,
  name: string,
): { finance: FinanceData; added: string | null; error?: string } {
  const trimmed = name.trim().slice(0, 40)
  if (!trimmed) {
    return { finance, added: null, error: 'Enter a category name' }
  }
  const existing = categoriesForKind(finance, kind)
  if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    return { finance, added: null, error: 'Category already exists' }
  }
  return {
    finance: {
      ...finance,
      customCategories: {
        ...finance.customCategories,
        [kind]: [...finance.customCategories[kind], trimmed],
      },
    },
    added: trimmed,
  }
}

export function removeCustomCategory(
  finance: FinanceData,
  kind: FinanceTxnKind,
  name: string,
): FinanceData {
  return {
    ...finance,
    customCategories: {
      ...finance.customCategories,
      [kind]: finance.customCategories[kind].filter(
        (c) => c.toLowerCase() !== name.toLowerCase(),
      ),
    },
  }
}

export function filterBySegment(
  transactions: FinanceTransaction[],
  segment: 'overview' | 'income' | 'expense',
): FinanceTransaction[] {
  if (segment === 'overview') return transactions
  return transactions.filter((t) => t.kind === segment)
}

export function summarizeMonth(
  transactions: FinanceTransaction[],
  year: number,
  month: number,
): { income: number; expense: number; balance: number; count: number } {
  const prefix = monthPrefix(year, month)
  let income = 0
  let expense = 0
  let count = 0
  for (const txn of transactions) {
    if (!txn.date.startsWith(prefix)) continue
    count += 1
    if (txn.kind === 'income') income += txn.amount
    else expense += txn.amount
  }
  return {
    income,
    expense,
    balance: income - expense,
    count,
  }
}

export type FinancePieSlice = {
  key: string
  label: string
  amount: number
  ratio: number
}

/** Expense totals by category for a month (largest first). */
export function summarizeExpenseCategories(
  transactions: FinanceTransaction[],
  year: number,
  month: number,
): FinancePieSlice[] {
  const prefix = monthPrefix(year, month)
  const byCategory = new Map<string, number>()
  let total = 0
  for (const txn of transactions) {
    if (txn.kind !== 'expense' || !txn.date.startsWith(prefix)) continue
    const key = txn.category || 'Other expense'
    byCategory.set(key, (byCategory.get(key) ?? 0) + txn.amount)
    total += txn.amount
  }
  if (total <= 0) return []
  return [...byCategory.entries()]
    .map(([label, amount]) => ({
      key: label,
      label,
      amount: Math.round(amount * 100) / 100,
      ratio: amount / total,
    }))
    .sort((a, b) => b.amount - a.amount)
}

/** Two-slice income vs expense for a month. */
export function summarizeIncomeExpenseSlices(
  transactions: FinanceTransaction[],
  year: number,
  month: number,
): FinancePieSlice[] {
  const summary = summarizeMonth(transactions, year, month)
  const total = summary.income + summary.expense
  if (total <= 0) return []
  const slices: FinancePieSlice[] = []
  if (summary.income > 0) {
    slices.push({
      key: 'income',
      label: 'Income',
      amount: summary.income,
      ratio: summary.income / total,
    })
  }
  if (summary.expense > 0) {
    slices.push({
      key: 'expense',
      label: 'Expenses',
      amount: summary.expense,
      ratio: summary.expense / total,
    })
  }
  return slices
}

export function formatMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export { newFinanceId }
