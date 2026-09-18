import { CalendarBlank, Flag, Target } from '@phosphor-icons/react'
import type { AppData } from '../types'
import { buildUpcomingItems } from '../lib/upcoming'

type UpcomingStripProps = {
  appData: AppData
}

function ItemIcon({ kind }: { kind: 'holiday' | 'leave' | 'goal' }) {
  if (kind === 'holiday') return <Flag size={15} weight="fill" aria-hidden />
  if (kind === 'leave') return <CalendarBlank size={15} weight="fill" aria-hidden />
  return <Target size={15} weight="fill" aria-hidden />
}

export function UpcomingStrip({ appData }: UpcomingStripProps) {
  const items = buildUpcomingItems(appData.settings, appData.attendance)
  if (items.length === 0) return null

  return (
    <section className="upcoming-strip" aria-label="Upcoming">
      <p className="upcoming-kicker">Upcoming</p>
      <ul className="upcoming-list">
        {items.map((item) => (
          <li key={item.id} className={`upcoming-item upcoming-${item.kind}`}>
            <span className="upcoming-icon" aria-hidden>
              <ItemIcon kind={item.kind} />
            </span>
            <span className="upcoming-copy">
              <span className="upcoming-label">{item.label}</span>
              <span className="upcoming-detail">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
