import { useEffect, useId } from 'react'
import {
  Trophy,
  Fire,
  Crown,
  CalendarCheck,
  House,
  Buildings,
  Moon,
  Target,
  Sparkle,
  Medal,
} from '@phosphor-icons/react'
import type { ActivityStreak, GoalReward, RewardKind } from '../types'
import {
  formatRewardEarnedAt,
  gameRewardThemeLabel,
  groupMonthRewardsByYear,
  monthGoalRewardsForYear,
  nextStreakMilestone,
  resolveGameRewardTheme,
  rewardKind,
  rewardSubtitle,
  rewardTitle,
  specialRewards,
} from '../lib/rewards'

type RewardsFabProps = {
  open: boolean
  onToggle: () => void
  yearBadgeCount: number
}

export function RewardsFab({ open, onToggle, yearBadgeCount }: RewardsFabProps) {
  return (
    <button
      type="button"
      className={`rewards-fab${open ? ' open' : ''}${yearBadgeCount > 0 ? ' has-badges' : ''}`}
      onClick={onToggle}
      aria-label={open ? 'Close rewards' : 'Open rewards'}
      aria-expanded={open}
    >
      <Trophy size={22} weight="fill" aria-hidden />
      {yearBadgeCount > 0 && (
        <span className="rewards-fab-count" aria-hidden>
          {yearBadgeCount > 9 ? '9+' : yearBadgeCount}
        </span>
      )}
    </button>
  )
}

function BadgeIcon({ kind }: { kind: RewardKind }) {
  if (kind === 'perfect_year' || kind === 'quarter_champion' || kind === 'half_year_hero') {
    return <Crown size={18} weight="fill" aria-hidden />
  }
  if (kind.startsWith('streak_') || kind.startsWith('office_streak_')) {
    return <Fire size={18} weight="fill" aria-hidden />
  }
  if (kind === 'wfh_week' || kind === 'hybrid_balancer') {
    return <House size={18} weight="fill" aria-hidden />
  }
  if (kind === 'office_week' || kind === 'first_office' || kind === 'century_club') {
    return <Buildings size={18} weight="fill" aria-hidden />
  }
  if (kind === 'night_owl') return <Moon size={18} weight="fill" aria-hidden />
  if (
    kind === 'early_bird' ||
    kind === 'clutch_finisher' ||
    kind === 'overachiever' ||
    kind === 'comeback'
  ) {
    return <Target size={18} weight="fill" aria-hidden />
  }
  if (kind === 'month_of_sundays' || kind === 'new_year_starter') {
    return <Sparkle size={18} weight="fill" aria-hidden />
  }
  if (kind === 'planner' || kind === 'holiday_curator' || kind === 'clean_calendar' || kind === 'no_gap_month') {
    return <Medal size={18} weight="fill" aria-hidden />
  }
  return <CalendarCheck size={18} weight="fill" aria-hidden />
}

type RewardsPanelProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  rewards: GoalReward[]
  activity: ActivityStreak
  currentYear: number
}

export function RewardsPanel({
  open,
  onToggle,
  onClose,
  rewards,
  activity,
  currentYear,
}: RewardsPanelProps) {
  const titleId = useId()
  const yearMonthGoals = monthGoalRewardsForYear(rewards, currentYear)
  const theme = resolveGameRewardTheme(yearMonthGoals.length)
  const specials = specialRewards(rewards)
  const monthlyGroups = groupMonthRewardsByYear(rewards)
  const nextMilestone = nextStreakMilestone(activity.streak)
  const perfectProgress = yearMonthGoals.length

  useEffect(() => {
    if (!open) return

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <RewardsFab
        open={open}
        onToggle={onToggle}
        yearBadgeCount={
          yearMonthGoals.length +
          specials.filter((r) => new Date(r.earnedAt).getFullYear() === currentYear)
            .length
        }
      />

      {open && (
        <div className="rewards-root">
          <button
            type="button"
            className="rewards-backdrop"
            aria-label="Close rewards"
            onClick={onClose}
          />
          <aside
            className="rewards-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="games-header">
              <h2 id={titleId}>Rewards</h2>
              <button type="button" className="settings-close" onClick={onClose}>
                Close
              </button>
            </header>

            <p className="rewards-panel-intro">
              Earn badges for goals, streaks, hybrid habits, and planning.
              Console themes still use this year’s monthly goal badges.
            </p>

            <div className="rewards-progress-grid">
              <div className="rewards-progress-card">
                <p className="card-label">Update streak</p>
                <p className="rewards-progress-value">
                  <Fire size={18} weight="fill" aria-hidden />
                  {activity.streak} day{activity.streak === 1 ? '' : 's'}
                </p>
                <p className="card-note">
                  {nextMilestone
                    ? `${nextMilestone - activity.streak} more to ${nextMilestone}-day badge`
                    : 'All logger streak badges unlocked'}
                </p>
              </div>
              <div className="rewards-progress-card">
                <p className="card-label">{currentYear} goals</p>
                <p className="rewards-progress-value">
                  <Trophy size={18} weight="fill" aria-hidden />
                  {perfectProgress} / 12
                </p>
                <p className="card-note">
                  {perfectProgress >= 12
                    ? 'Perfect year badge earned'
                    : `${12 - perfectProgress} month${12 - perfectProgress === 1 ? '' : 's'} left · ${gameRewardThemeLabel(theme)}`}
                </p>
              </div>
            </div>

            {specials.length > 0 && (
              <section className="rewards-year-block">
                <h3>
                  Special badges
                  <span>
                    {specials.length} badge{specials.length === 1 ? '' : 's'}
                  </span>
                </h3>
                <ul className="rewards-detail-list">
                  {specials.map((reward) => (
                    <li key={reward.id}>
                      <div className="rewards-detail-main">
                        <BadgeIcon kind={rewardKind(reward)} />
                        <div>
                          <strong>{rewardTitle(reward)}</strong>
                          <p>{rewardSubtitle(reward)}</p>
                          <p>Achieved {formatRewardEarnedAt(reward.earnedAt)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {monthlyGroups.length === 0 && specials.length === 0 ? (
              <p className="rewards-empty">
                No badges yet. Mark attendance, hit goals, plan leave ahead, and
                keep logging daily to unlock rewards.
              </p>
            ) : (
              <div className="rewards-years">
                {monthlyGroups.map(({ year, rewards: yearList }) => (
                  <section key={year} className="rewards-year-block">
                    <h3>
                      {year} monthly goals
                      {year === currentYear ? ' · this year' : ''}
                      <span>{yearList.length} / 12</span>
                    </h3>
                    <ul className="rewards-detail-list">
                      {yearList.map((reward) => (
                        <li key={reward.id}>
                          <div className="rewards-detail-main">
                            <BadgeIcon kind={rewardKind(reward)} />
                            <div>
                              <strong>{rewardTitle(reward)}</strong>
                              <p>{rewardSubtitle(reward)}</p>
                              <p>Achieved {formatRewardEarnedAt(reward.earnedAt)}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
