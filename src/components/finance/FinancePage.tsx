import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'react-hot-toast'
import type {
  AppData,
  AuthUser,
  FinanceInvestmentFrequency,
  FinanceTxnKind,
} from '../../types'
import {
  cacheAppData,
  loadCachedAppData,
  monthLabel,
} from '../../lib/attendance'
import {
  clearSession,
  fetchAppData,
  fetchMe,
  getStoredToken,
  getStoredUser,
  persistAppData,
} from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import { createDebouncedAppPersister } from '../../lib/persistQueue'
import { AuthScreen } from '../AuthScreen'
import { ThemeToggle } from '../ThemeToggle'
import { FinancePieChart } from './FinancePieChart'
import { ThemedSelect } from './ThemedSelect'
import { ThemedDatePicker } from '../ThemedDatePicker'
import {
  addCustomCategory,
  applyRecurringFinance,
  categoriesForKind,
  createAllowance,
  createEmi,
  createInvestment,
  createRecurringExpense,
  createSalary,
  createTransaction,
  filterBySegment,
  formatMoney,
  getFinance,
  investmentScheduleLabel,
  monthPrefix,
  preferLocalFinanceIfRemoteEmpty,
  removeCustomCategory,
  salaryTotal,
  summarizeExpenseCategories,
  summarizeIncomeExpenseSlices,
  summarizeMonth,
  todayInputValue,
  WEEKDAY_LABELS,
  withFinance,
} from '../../lib/finance'

type Segment = 'overview' | 'income' | 'expense' | 'setup'

export function FinancePage() {
  const titleId = useId()
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [authChecking, setAuthChecking] = useState(() =>
    Boolean(getStoredToken()),
  )
  const [appData, setAppData] = useState<AppData>(() => loadCachedAppData())
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [segment, setSegment] = useState<Segment>('overview')
  const [kind, setKind] = useState<FinanceTxnKind>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('EMI')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayInputValue)
  const [recurringExpense, setRecurringExpense] = useState(false)
  const [txnFrequency, setTxnFrequency] =
    useState<FinanceInvestmentFrequency>('monthly')
  const [salaryName, setSalaryName] = useState('')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [salaryDay, setSalaryDay] = useState('1')
  const [addSalaryWithAllowance, setAddSalaryWithAllowance] = useState(false)
  const [newAllowanceLabel, setNewAllowanceLabel] = useState('')
  const [newAllowanceAmount, setNewAllowanceAmount] = useState('')
  const [allowanceOpenIds, setAllowanceOpenIds] = useState<
    Record<string, boolean>
  >({})
  const [allowanceDrafts, setAllowanceDrafts] = useState<
    Record<string, { label: string; amount: string }>
  >({})
  const [emiName, setEmiName] = useState('')
  const [emiAmount, setEmiAmount] = useState('')
  const [emiDay, setEmiDay] = useState('5')
  const [invName, setInvName] = useState('')
  const [invAmount, setInvAmount] = useState('')
  const [invFrequency, setInvFrequency] =
    useState<FinanceInvestmentFrequency>('monthly')
  const [invDay, setInvDay] = useState('1')
  const [invWeekday, setInvWeekday] = useState('1')
  const [customCategoryName, setCustomCategoryName] = useState('')
  const [customCategoryKind, setCustomCategoryKind] =
    useState<FinanceTxnKind>('expense')
  const [chartMonthKey, setChartMonthKey] = useState(() =>
    monthPrefix(new Date().getFullYear(), new Date().getMonth()),
  )
  const skipNextSave = useRef(true)
  const persister = useRef(
    createDebouncedAppPersister(400, {
      onError: () => {
        toast.error('Could not save finance data')
      },
    }),
  )

  const finance = getFinance(appData)
  const viewYear = new Date().getFullYear()
  const viewMonth = new Date().getMonth()
  const chartMonthOptions = useMemo(() => {
    const keys = new Set<string>()
    const now = new Date()
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.add(monthPrefix(d.getFullYear(), d.getMonth()))
    }
    for (const txn of finance.transactions) {
      if (/^\d{4}-\d{2}/.test(txn.date)) {
        keys.add(txn.date.slice(0, 7))
      }
    }
    return [...keys]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [y, m] = key.split('-').map(Number)
        return {
          value: key,
          label: monthLabel(y, m - 1),
        }
      })
  }, [finance.transactions])

  useEffect(() => {
    if (
      chartMonthOptions.length > 0 &&
      !chartMonthOptions.some((o) => o.value === chartMonthKey)
    ) {
      setChartMonthKey(chartMonthOptions[0].value)
    }
  }, [chartMonthOptions, chartMonthKey])

  const chartYear = Number(chartMonthKey.slice(0, 4))
  const chartMonth = Number(chartMonthKey.slice(5, 7)) - 1

  const summary = useMemo(
    () => summarizeMonth(finance.transactions, viewYear, viewMonth),
    [finance.transactions, viewYear, viewMonth],
  )
  const expenseSlices = useMemo(
    () =>
      Number.isFinite(chartYear) && Number.isFinite(chartMonth)
        ? summarizeExpenseCategories(
            finance.transactions,
            chartYear,
            chartMonth,
          )
        : [],
    [finance.transactions, chartYear, chartMonth],
  )
  const flowSlices = useMemo(
    () =>
      Number.isFinite(chartYear) && Number.isFinite(chartMonth)
        ? summarizeIncomeExpenseSlices(
            finance.transactions,
            chartYear,
            chartMonth,
          )
        : [],
    [finance.transactions, chartYear, chartMonth],
  )
  const chartMonthName =
    Number.isFinite(chartYear) && Number.isFinite(chartMonth)
      ? monthLabel(chartYear, chartMonth)
      : 'Selected month'
  const overviewPie =
    expenseSlices.length > 0
      ? {
          title: `Expenses · ${chartMonthName}`,
          slices: expenseSlices,
          emptyLabel: `No expenses in ${chartMonthName}.`,
        }
      : {
          title: `Cash flow · ${chartMonthName}`,
          slices: flowSlices,
          emptyLabel: `No transactions in ${chartMonthName}.`,
        }
  const visible = useMemo(() => {
    if (segment === 'setup') return []
    return filterBySegment(
      finance.transactions,
      segment === 'overview' ? 'overview' : segment,
    )
  }, [finance.transactions, segment])
  useEffect(() => {
    let cancelled = false
    const token = getStoredToken()
    if (!token) {
      setAuthChecking(false)
      setUser(null)
      return
    }
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) {
          clearSession()
          setUser(null)
        }
      } finally {
        if (!cancelled) setAuthChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadState('loading')
    ;(async () => {
      try {
        const remote = await fetchAppData()
        if (cancelled) return
        skipNextSave.current = true
        const local = loadCachedAppData()
        const { data: merged, restoredFinance } =
          preferLocalFinanceIfRemoteEmpty(remote, local)
        const applied = applyRecurringFinance(getFinance(merged))
        const next = withFinance(merged, applied.finance)
        setAppData(next)
        cacheAppData(next)
        setLoadState('ready')
        if (restoredFinance) {
          await persistAppData(next)
          if (!cancelled) {
            toast.success('Restored finance data from this device to MongoDB')
          }
        }
        if (applied.added > 0) {
          trackEvent('finance_recurring_applied', { count: applied.added })
          toast.success(
            `Posted ${applied.added} recurring entr${applied.added === 1 ? 'y' : 'ies'}`,
          )
        }
      } catch {
        if (cancelled) return
        setLoadState('error')
        toast.error('Could not load finance data')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user || loadState !== 'ready') return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    cacheAppData(appData)
    persister.current.schedule(appData)
  }, [appData, user, loadState])

  useEffect(() => {
    const queue = persister.current
    return () => {
      void queue.flush().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const cats = categoriesForKind(finance, kind)
    setCategory((prev) => (cats.includes(prev) ? prev : cats[0]))
  }, [kind, finance.customCategories.income, finance.customCategories.expense])

  function updateFinance(
    updater: (current: ReturnType<typeof getFinance>) => ReturnType<typeof getFinance>,
  ) {
    setAppData((prev) => withFinance(prev, updater(getFinance(prev))))
  }

  function handleAddCustomCategory(event: FormEvent) {
    event.preventDefault()
    let addedName: string | null = null
    let error: string | undefined
    updateFinance((current) => {
      const result = addCustomCategory(
        current,
        customCategoryKind,
        customCategoryName,
      )
      addedName = result.added
      error = result.error
      return result.finance
    })
    if (error) {
      toast.error(error)
      return
    }
    if (addedName) {
      trackEvent('finance_add_category', { kind: customCategoryKind })
      if (kind === customCategoryKind) setCategory(addedName)
      setCustomCategoryName('')
      toast.success(`Category “${addedName}” added`)
    }
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!date) {
      toast.error('Choose a date')
      return
    }

    const makeRecurring = kind === 'expense' && recurringExpense
    if (makeRecurring) {
      const parsed = new Date(`${date}T12:00:00`)
      if (Number.isNaN(parsed.getTime())) {
        toast.error('Choose a valid date')
        return
      }
      const scheduleDay =
        txnFrequency === 'monthly' ? parsed.getDate() : parsed.getDay()
      const ruleName = note.trim() || category
      updateFinance((current) => {
        const rule = createRecurringExpense({
          name: ruleName,
          amount: value,
          category,
          frequency: txnFrequency,
          day: scheduleDay,
        })
        const next = {
          ...current,
          recurringExpenses: [...current.recurringExpenses, rule],
        }
        return applyRecurringFinance(next).finance
      })
      trackEvent('finance_add_transaction', { kind, recurring: true })
      trackEvent('finance_add_recurring_expense')
      setAmount('')
      setNote('')
      setRecurringExpense(false)
      setTxnFrequency('monthly')
      toast.success(
        txnFrequency === 'weekly'
          ? 'Recurring weekly expense saved'
          : 'Recurring monthly expense saved',
      )
      return
    }

    const txn = createTransaction({
      kind,
      amount: value,
      category,
      note,
      date,
    })
    updateFinance((current) => ({
      ...current,
      transactions: [txn, ...current.transactions],
    }))
    trackEvent('finance_add_transaction', { kind })
    setAmount('')
    setNote('')
    toast.success(kind === 'income' ? 'Income added' : 'Expense added')
  }

  function handleDelete(id: string) {
    updateFinance((current) => ({
      ...current,
      transactions: current.transactions.filter((t) => t.id !== id),
    }))
    trackEvent('finance_delete_transaction')
    toast.success('Removed')
  }

  function addSalary(event: FormEvent) {
    event.preventDefault()
    const value = Number(salaryAmount)
    const day = Number(salaryDay)
    if (!salaryName.trim()) {
      toast.error('Salary needs a name')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid salary amount')
      return
    }
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      toast.error('Salary day must be 1–31')
      return
    }

    let allowances: ReturnType<typeof createAllowance>[] = []
    if (addSalaryWithAllowance) {
      const allowanceValue = Number(newAllowanceAmount)
      if (!newAllowanceLabel.trim()) {
        toast.error('Allowance needs a name')
        return
      }
      if (!Number.isFinite(allowanceValue) || allowanceValue <= 0) {
        toast.error('Enter a valid allowance amount')
        return
      }
      allowances = [createAllowance(newAllowanceLabel, allowanceValue)]
    }

    updateFinance((current) => {
      const next = {
        ...current,
        salaries: [
          ...current.salaries,
          createSalary({
            name: salaryName,
            fixedAmount: value,
            payday: day,
            allowances,
          }),
        ],
      }
      return applyRecurringFinance(next).finance
    })
    setSalaryName('')
    setSalaryAmount('')
    setSalaryDay('1')
    setAddSalaryWithAllowance(false)
    setNewAllowanceLabel('')
    setNewAllowanceAmount('')
    trackEvent('finance_save_salary')
    if (allowances.length > 0) trackEvent('finance_add_allowance')
    toast.success('Salary added — paydays post automatically')
  }

  function addAllowanceToSalary(salaryId: string, event: FormEvent) {
    event.preventDefault()
    const draft = allowanceDrafts[salaryId] ?? { label: '', amount: '' }
    const value = Number(draft.amount)
    if (!draft.label.trim()) {
      toast.error('Allowance needs a name')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid allowance amount')
      return
    }
    updateFinance((current) => {
      const next = {
        ...current,
        salaries: current.salaries.map((s) =>
          s.id === salaryId
            ? {
                ...s,
                allowances: [
                  ...s.allowances,
                  createAllowance(draft.label, value),
                ],
              }
            : s,
        ),
      }
      return applyRecurringFinance(next).finance
    })
    setAllowanceDrafts((prev) => ({
      ...prev,
      [salaryId]: { label: '', amount: '' },
    }))
    trackEvent('finance_add_allowance')
    toast.success('Allowance added')
  }

  function addEmi(event: FormEvent) {
    event.preventDefault()
    const value = Number(emiAmount)
    const day = Number(emiDay)
    if (!emiName.trim()) {
      toast.error('EMI needs a name')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid EMI amount')
      return
    }
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      toast.error('EMI day must be 1–31')
      return
    }
    const startMonth = monthPrefix(viewYear, viewMonth)
    updateFinance((current) => {
      const next = {
        ...current,
        emis: [
          ...current.emis,
          createEmi({
            name: emiName,
            amount: value,
            dayOfMonth: day,
            startMonth,
          }),
        ],
      }
      return applyRecurringFinance(next).finance
    })
    setEmiName('')
    setEmiAmount('')
    setEmiDay('5')
    trackEvent('finance_add_emi')
    toast.success('EMI added — due dates post automatically')
  }

  function addInvestment(event: FormEvent) {
    event.preventDefault()
    const value = Number(invAmount)
    const day =
      invFrequency === 'weekly' ? Number(invWeekday) : Number(invDay)
    if (!invName.trim()) {
      toast.error('Investment needs a name')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid investment amount')
      return
    }
    if (invFrequency === 'monthly') {
      if (!Number.isFinite(day) || day < 1 || day > 31) {
        toast.error('Investment day must be 1–31')
        return
      }
    } else if (!Number.isFinite(day) || day < 0 || day > 6) {
      toast.error('Choose a weekday')
      return
    }
    updateFinance((current) => {
      const next = {
        ...current,
        investments: [
          ...current.investments,
          createInvestment({
            name: invName,
            amount: value,
            frequency: invFrequency,
            day,
          }),
        ],
      }
      return applyRecurringFinance(next).finance
    })
    setInvName('')
    setInvAmount('')
    setInvFrequency('monthly')
    setInvDay('1')
    setInvWeekday('1')
    trackEvent('finance_add_investment')
    toast.success('Investment SIP added — posts automatically')
  }

  if (authChecking) {
    return (
      <div className="auth-screen">
        <div className="app-bg" aria-hidden="true" />
        <p className="auth-loading">Checking session…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <ThemeToggle />
        <AuthScreen
          onAuthenticated={(next) => {
            skipNextSave.current = true
            setUser(next)
          }}
        />
      </>
    )
  }

  const categories = categoriesForKind(finance, kind)
  const customForKind = finance.customCategories[customCategoryKind]

  return (
    <div className="app finance-app">
      <div className="app-bg" aria-hidden="true" />
      <ThemeToggle />
      <main className="shell finance-shell">
        <header className="finance-header">
          <Link
            to="/"
            className="finance-back"
            onClick={() => trackEvent('close_finance')}
          >
            <ArrowLeft size={18} weight="bold" aria-hidden />
            Calendar
          </Link>
          <div>
            <h1 id={titleId} className="brand-mark">
              Finance
            </h1>
            <p className="brand-sub">
              Salary, EMIs, SIPs, and day-to-day income &amp; expenses
            </p>
          </div>
          {loadState === 'loading' && (
            <p className="sync-status">Loading…</p>
          )}
        </header>

        <div className="finance-segments" role="tablist" aria-label="Finance segments">
          {(
            [
              ['overview', 'Overview'],
              ['income', 'Income'],
              ['expense', 'Expenses'],
              ['setup', 'Setup'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={segment === id}
              className={`finance-segment${segment === id ? ' active' : ''}`}
              onClick={() => {
                setSegment(id)
                if (id === 'income' || id === 'expense') setKind(id)
                trackEvent('finance_segment', { segment: id })
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {segment !== 'setup' && (
          <section className="finance-summary" aria-label="This month">
            <article className="finance-stat">
              <p className="card-label">Income</p>
              <p className="finance-stat-value income">
                {formatMoney(summary.income, finance.currency)}
              </p>
            </article>
            <article className="finance-stat">
              <p className="card-label">Expenses</p>
              <p className="finance-stat-value expense">
                {formatMoney(summary.expense, finance.currency)}
              </p>
            </article>
            <article className="finance-stat">
              <p className="card-label">Balance</p>
              <p
                className={`finance-stat-value${summary.balance < 0 ? ' expense' : ' income'}`}
              >
                {formatMoney(summary.balance, finance.currency)}
              </p>
            </article>
          </section>
        )}

        {segment === 'overview' && (
          <FinancePieChart
            title={overviewPie.title}
            slices={overviewPie.slices}
            currency={finance.currency}
            emptyLabel={overviewPie.emptyLabel}
            monthValue={chartMonthKey}
            monthOptions={chartMonthOptions}
            onMonthChange={setChartMonthKey}
          />
        )}

        {segment === 'setup' && (
          <>
            <section className="finance-form finance-recurring">
              <h2 className="finance-section-title">Salaries (recurring)</h2>
              <p className="settings-help">
                Add one or more salaries with different paydays. Check “Add
                allowance” to include HRA, bonus, etc. Each posts as income
                automatically on its day each month.
              </p>
              <form className="finance-inline-form" onSubmit={addSalary}>
                <div className="finance-form-row">
                  <label>
                    Name
                    <input
                      type="text"
                      value={salaryName}
                      onChange={(e) => setSalaryName(e.target.value)}
                      placeholder="Primary job, side gig, …"
                      maxLength={60}
                    />
                  </label>
                  <label>
                    Fixed amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={salaryAmount}
                      onChange={(e) => setSalaryAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>
                <label>
                  Salary day (1–31)
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={salaryDay}
                    onChange={(e) => setSalaryDay(e.target.value)}
                  />
                </label>
                <label className="finance-check">
                  <input
                    type="checkbox"
                    checked={addSalaryWithAllowance}
                    onChange={(e) =>
                      setAddSalaryWithAllowance(e.target.checked)
                    }
                  />
                  Add allowance
                </label>
                {addSalaryWithAllowance && (
                  <div className="finance-allowance-form finance-allowance-form--inline">
                    <input
                      type="text"
                      value={newAllowanceLabel}
                      onChange={(e) => setNewAllowanceLabel(e.target.value)}
                      placeholder="Allowance name (HRA, bonus, …)"
                      maxLength={40}
                      aria-label="Allowance name"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newAllowanceAmount}
                      onChange={(e) => setNewAllowanceAmount(e.target.value)}
                      placeholder="Amount"
                      aria-label="Allowance amount"
                    />
                  </div>
                )}
                <button type="submit" className="settings-submit">
                  Add salary
                </button>
              </form>
              {finance.salaries.length === 0 ? (
                <p className="settings-help">No salaries yet.</p>
              ) : (
                <ul className="finance-mini-list">
                  {finance.salaries.map((salary) => {
                    const draft = allowanceDrafts[salary.id] ?? {
                      label: '',
                      amount: '',
                    }
                    const allowanceOpen = Boolean(allowanceOpenIds[salary.id])
                    return (
                      <li key={salary.id} className="finance-salary-item">
                        <div className="finance-salary-head">
                          <label className="finance-check finance-emi-row">
                            <input
                              type="checkbox"
                              checked={salary.enabled}
                              onChange={(e) =>
                                updateFinance((current) => {
                                  const next = {
                                    ...current,
                                    salaries: current.salaries.map((x) =>
                                      x.id === salary.id
                                        ? {
                                            ...x,
                                            enabled: e.target.checked,
                                          }
                                        : x,
                                    ),
                                  }
                                  return applyRecurringFinance(next).finance
                                })
                              }
                            />
                            <span>
                              {salary.name} · day {salary.payday} ·{' '}
                              {formatMoney(
                                salaryTotal(salary),
                                finance.currency,
                              )}
                            </span>
                          </label>
                          <button
                            type="button"
                            className="finance-delete"
                            aria-label={`Remove ${salary.name}`}
                            onClick={() =>
                              updateFinance((current) => ({
                                ...current,
                                salaries: current.salaries.filter(
                                  (x) => x.id !== salary.id,
                                ),
                              }))
                            }
                          >
                            <Trash size={16} weight="bold" aria-hidden />
                          </button>
                        </div>

                        {salary.allowances.length > 0 && (
                          <ul className="finance-allowance-list">
                            {salary.allowances.map((a) => (
                              <li key={a.id}>
                                <span>
                                  {a.label} ·{' '}
                                  {formatMoney(a.amount, finance.currency)}
                                </span>
                                <button
                                  type="button"
                                  className="finance-delete"
                                  aria-label={`Remove ${a.label}`}
                                  onClick={() =>
                                    updateFinance((current) => {
                                      const next = {
                                        ...current,
                                        salaries: current.salaries.map(
                                          (sal) =>
                                            sal.id === salary.id
                                              ? {
                                                  ...sal,
                                                  allowances:
                                                    sal.allowances.filter(
                                                      (x) => x.id !== a.id,
                                                    ),
                                                }
                                              : sal,
                                        ),
                                      }
                                      return applyRecurringFinance(next)
                                        .finance
                                    })
                                  }
                                >
                                  <Trash size={16} weight="bold" aria-hidden />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <label className="finance-check">
                          <input
                            type="checkbox"
                            checked={allowanceOpen}
                            onChange={(e) =>
                              setAllowanceOpenIds((prev) => ({
                                ...prev,
                                [salary.id]: e.target.checked,
                              }))
                            }
                          />
                          Add allowance
                        </label>
                        {allowanceOpen && (
                          <form
                            className="finance-allowance-form"
                            onSubmit={(e) =>
                              addAllowanceToSalary(salary.id, e)
                            }
                          >
                            <input
                              type="text"
                              value={draft.label}
                              onChange={(e) =>
                                setAllowanceDrafts((prev) => ({
                                  ...prev,
                                  [salary.id]: {
                                    ...draft,
                                    label: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Allowance name"
                              maxLength={40}
                              aria-label={`Allowance name for ${salary.name}`}
                            />
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={draft.amount}
                              onChange={(e) =>
                                setAllowanceDrafts((prev) => ({
                                  ...prev,
                                  [salary.id]: {
                                    ...draft,
                                    amount: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Amount"
                              aria-label={`Allowance amount for ${salary.name}`}
                            />
                            <button
                              type="submit"
                              className="settings-submit day-status-secondary"
                            >
                              <Plus size={16} weight="bold" aria-hidden /> Add
                            </button>
                          </form>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="finance-form finance-recurring">
              <h2 className="finance-section-title">Recurring EMIs</h2>
              <p className="settings-help">
                EMIs post as expenses on the chosen day each month so you don’t
                add them manually.
              </p>
              <form className="finance-inline-form" onSubmit={addEmi}>
                <div className="finance-form-row">
                  <label>
                    Name
                    <input
                      type="text"
                      value={emiName}
                      onChange={(e) => setEmiName(e.target.value)}
                      placeholder="Home loan, car, …"
                      maxLength={60}
                    />
                  </label>
                  <label>
                    Amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={emiAmount}
                      onChange={(e) => setEmiAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>
                <label>
                  Due day (1–31)
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={emiDay}
                    onChange={(e) => setEmiDay(e.target.value)}
                  />
                </label>
                <button type="submit" className="settings-submit">
                  Add EMI
                </button>
              </form>
              {finance.emis.length === 0 ? (
                <p className="settings-help">No EMIs yet.</p>
              ) : (
                <ul className="finance-mini-list">
                  {finance.emis.map((emi) => (
                    <li key={emi.id}>
                      <label className="finance-check finance-emi-row">
                        <input
                          type="checkbox"
                          checked={emi.enabled}
                          onChange={(e) =>
                            updateFinance((current) => ({
                              ...current,
                              emis: current.emis.map((x) =>
                                x.id === emi.id
                                  ? { ...x, enabled: e.target.checked }
                                  : x,
                              ),
                            }))
                          }
                        />
                        <span>
                          {emi.name} · day {emi.dayOfMonth} ·{' '}
                          {formatMoney(emi.amount, finance.currency)}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="finance-delete"
                        aria-label={`Remove ${emi.name}`}
                        onClick={() =>
                          updateFinance((current) => ({
                            ...current,
                            emis: current.emis.filter((x) => x.id !== emi.id),
                          }))
                        }
                      >
                        <Trash size={16} weight="bold" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="finance-form finance-recurring">
              <h2 className="finance-section-title">
                Recurring investments
              </h2>
              <p className="settings-help">
                SIPs and mutual funds post as Investment expenses on the
                chosen weekly weekday or monthly day.
              </p>
              <form className="finance-inline-form" onSubmit={addInvestment}>
                <div className="finance-form-row">
                  <label>
                    Name
                    <input
                      type="text"
                      value={invName}
                      onChange={(e) => setInvName(e.target.value)}
                      placeholder="Mutual fund, gold ETF, …"
                      maxLength={60}
                    />
                  </label>
                  <label>
                    Amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={invAmount}
                      onChange={(e) => setInvAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>
                <div className="finance-form-row">
                  <label>
                    Frequency
                    <ThemedSelect
                      aria-label="Investment frequency"
                      value={invFrequency}
                      onChange={(next) =>
                        setInvFrequency(next as FinanceInvestmentFrequency)
                      }
                      options={[
                        { value: 'monthly', label: 'Monthly' },
                        { value: 'weekly', label: 'Weekly' },
                      ]}
                    />
                  </label>
                  {invFrequency === 'monthly' ? (
                    <label>
                      Day of month (1–31)
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={invDay}
                        onChange={(e) => setInvDay(e.target.value)}
                      />
                    </label>
                  ) : (
                    <label>
                      Weekday
                      <ThemedSelect
                        aria-label="Investment weekday"
                        value={invWeekday}
                        onChange={setInvWeekday}
                        options={WEEKDAY_LABELS.map((label, index) => ({
                          value: String(index),
                          label,
                        }))}
                      />
                    </label>
                  )}
                </div>
                <button type="submit" className="settings-submit">
                  Add investment
                </button>
              </form>
              {finance.investments.length === 0 ? (
                <p className="settings-help">No recurring investments yet.</p>
              ) : (
                <ul className="finance-mini-list">
                  {finance.investments.map((inv) => (
                    <li key={inv.id}>
                      <label className="finance-check finance-emi-row">
                        <input
                          type="checkbox"
                          checked={inv.enabled}
                          onChange={(e) =>
                            updateFinance((current) => {
                              const next = {
                                ...current,
                                investments: current.investments.map((x) =>
                                  x.id === inv.id
                                    ? { ...x, enabled: e.target.checked }
                                    : x,
                                ),
                              }
                              return applyRecurringFinance(next).finance
                            })
                          }
                        />
                        <span>
                          {inv.name} · {investmentScheduleLabel(inv)} ·{' '}
                          {formatMoney(inv.amount, finance.currency)}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="finance-delete"
                        aria-label={`Remove ${inv.name}`}
                        onClick={() =>
                          updateFinance((current) => ({
                            ...current,
                            investments: current.investments.filter(
                              (x) => x.id !== inv.id,
                            ),
                          }))
                        }
                      >
                        <Trash size={16} weight="bold" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="finance-form finance-recurring">
              <h2 className="finance-section-title">Recurring expenses</h2>
              <p className="settings-help">
                Created from Overview when “Recurring expense” is checked.
                Toggle or remove them here.
              </p>
              {finance.recurringExpenses.length === 0 ? (
                <p className="settings-help">No recurring expenses yet.</p>
              ) : (
                <ul className="finance-mini-list">
                  {finance.recurringExpenses.map((item) => (
                    <li key={item.id}>
                      <label className="finance-check finance-emi-row">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) =>
                            updateFinance((current) => {
                              const next = {
                                ...current,
                                recurringExpenses:
                                  current.recurringExpenses.map((x) =>
                                    x.id === item.id
                                      ? { ...x, enabled: e.target.checked }
                                      : x,
                                  ),
                              }
                              return applyRecurringFinance(next).finance
                            })
                          }
                        />
                        <span>
                          {item.name} · {item.category} ·{' '}
                          {investmentScheduleLabel(item)} ·{' '}
                          {formatMoney(item.amount, finance.currency)}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="finance-delete"
                        aria-label={`Remove ${item.name}`}
                        onClick={() =>
                          updateFinance((current) => ({
                            ...current,
                            recurringExpenses:
                              current.recurringExpenses.filter(
                                (x) => x.id !== item.id,
                              ),
                          }))
                        }
                      >
                        <Trash size={16} weight="bold" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="finance-form finance-recurring">
              <h2 className="finance-section-title">Custom categories</h2>
              <p className="settings-help">
                Add your own income or expense categories. They appear in the
                Overview transaction dropdown.
              </p>
              <form
                className="finance-inline-form"
                onSubmit={handleAddCustomCategory}
              >
                <div className="finance-form-row">
                  <label>
                    For
                    <ThemedSelect
                      aria-label="Category kind"
                      value={customCategoryKind}
                      onChange={(next) =>
                        setCustomCategoryKind(next as FinanceTxnKind)
                      }
                      options={[
                        { value: 'expense', label: 'Expenses' },
                        { value: 'income', label: 'Income' },
                      ]}
                    />
                  </label>
                  <label>
                    New category
                    <input
                      type="text"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="e.g. Subscriptions"
                      maxLength={40}
                    />
                  </label>
                </div>
                <button type="submit" className="settings-submit">
                  <Plus size={16} weight="bold" aria-hidden /> Add category
                </button>
              </form>
              {customForKind.length === 0 ? (
                <p className="settings-help">
                  No custom {customCategoryKind} categories yet.
                </p>
              ) : (
                <ul className="finance-mini-list">
                  {customForKind.map((name) => (
                    <li key={name}>
                      <span>{name}</span>
                      <button
                        type="button"
                        className="finance-delete"
                        aria-label={`Remove category ${name}`}
                        onClick={() => {
                          updateFinance((current) =>
                            removeCustomCategory(
                              current,
                              customCategoryKind,
                              name,
                            ),
                          )
                          trackEvent('finance_remove_category', {
                            kind: customCategoryKind,
                          })
                          toast.success('Category removed')
                        }}
                      >
                        <Trash size={16} weight="bold" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {segment === 'overview' && (
          <form className="finance-form" onSubmit={handleAdd}>
            <h2 className="finance-section-title">Add transaction</h2>
            <div className="finance-form-row">
              <label>
                Type
                <ThemedSelect
                  aria-label="Transaction type"
                  value={kind}
                  onChange={(next) => {
                    const nextKind = next as FinanceTxnKind
                    setKind(nextKind)
                    if (nextKind !== 'expense') setRecurringExpense(false)
                  }}
                  options={[
                    { value: 'expense', label: 'Expense' },
                    { value: 'income', label: 'Income' },
                  ]}
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
            </div>
            <div className="finance-form-row">
              <label>
                Category
                <ThemedSelect
                  aria-label="Transaction category"
                  value={category}
                  onChange={setCategory}
                  options={categories.map((c) => ({ value: c, label: c }))}
                />
              </label>
              <label>
                Date
                <ThemedDatePicker
                  aria-label="Transaction date"
                  value={date}
                  onChange={setDate}
                  required
                />
              </label>
            </div>
            <label className="finance-note">
              Note
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
                maxLength={200}
              />
            </label>
            {kind === 'expense' && (
              <>
                <label className="finance-check">
                  <input
                    type="checkbox"
                    checked={recurringExpense}
                    onChange={(e) => setRecurringExpense(e.target.checked)}
                  />
                  Recurring expense
                </label>
                {recurringExpense && (
                  <>
                    <label>
                      Frequency
                      <ThemedSelect
                        aria-label="Recurring expense frequency"
                        value={txnFrequency}
                        onChange={(next) =>
                          setTxnFrequency(next as FinanceInvestmentFrequency)
                        }
                        options={[
                          { value: 'monthly', label: 'Monthly' },
                          { value: 'weekly', label: 'Weekly' },
                        ]}
                      />
                    </label>
                    <p className="settings-help">
                      Repeats on the same{' '}
                      {txnFrequency === 'weekly'
                        ? 'weekday'
                        : 'day of month'}{' '}
                      as the date above.
                    </p>
                  </>
                )}
              </>
            )}
            <button type="submit" className="settings-submit">
              Add{' '}
              {kind === 'income'
                ? 'income'
                : recurringExpense
                  ? 'recurring expense'
                  : 'expense'}
            </button>
          </form>
        )}

        {segment !== 'setup' && (
          <section className="finance-list" aria-labelledby={titleId}>
            <h2 className="finance-section-title">
              {segment === 'overview'
                ? 'All transactions'
                : segment === 'income'
                  ? 'Income'
                  : 'Expenses'}
            </h2>
            {visible.length === 0 ? (
              <p className="settings-help">
                No transactions in this segment yet.
              </p>
            ) : (
              <ul>
                {visible.map((txn) => (
                  <li key={txn.id} className={`finance-item ${txn.kind}`}>
                    <div>
                      <strong>{txn.category}</strong>
                      <span>
                        {txn.date}
                        {txn.note ? ` · ${txn.note}` : ''}
                        {txn.sourceKey ? ' · auto' : ''}
                      </span>
                    </div>
                    <div className="finance-item-actions">
                      <span className="finance-amount">
                        {txn.kind === 'income' ? '+' : '−'}
                        {formatMoney(txn.amount, finance.currency)}
                      </span>
                      <button
                        type="button"
                        className="finance-delete"
                        aria-label="Delete transaction"
                        onClick={() => handleDelete(txn.id)}
                      >
                        <Trash size={16} weight="bold" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
