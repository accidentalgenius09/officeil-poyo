import type { MonthStats } from '../types'

type SummaryCardsProps = {
  stats: MonthStats
  goal: number
  goDaily: boolean
}

export function SummaryCards({ stats, goal, goDaily }: SummaryCardsProps) {
  const { daysInOffice, totalDaysInMonth, daysLeftToGoal, workingDaysRemaining } = stats
  const progress =
    goal > 0 ? Math.min(100, Math.round((daysInOffice / goal) * 100)) : 0

  return (
    <section className="cards" aria-label="Monthly summary">
      <article className="card">
        <p className="card-label">Office days</p>
        <p className="card-value">
          <span className="card-emphasis">{daysInOffice}</span>
          <span className="card-muted"> / {totalDaysInMonth}</span>
        </p>
        <p className="card-note">Days in office</p>
      </article>

      <article className="card">
        <p className="card-label">Goal progress</p>
        <p className="card-value">
          <span className="card-emphasis">{daysLeftToGoal}</span>
          <span className="card-muted"> left to {goal}</span>
        </p>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="card-note">
          {workingDaysRemaining} working day
          {workingDaysRemaining === 1 ? '' : 's'} remaining
          {goDaily ? ' · daily target' : ''}
        </p>
      </article>
    </section>
  )
}
