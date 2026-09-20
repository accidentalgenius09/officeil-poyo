import { CalendarBlank, Flag, Rocket, Target } from '@phosphor-icons/react'
import type { AppData } from '../types'
import {
  buildUpcomingItems,
  type HolidayUrgency,
  type UpcomingItem,
} from '../lib/upcoming'

type UpcomingStripProps = {
  appData: AppData
}

function HolidayIcon({ urgency }: { urgency: HolidayUrgency }) {
  if (urgency === 'near') {
    return <Rocket size={15} weight="fill" aria-hidden />
  }
  if (urgency === 'eve' || urgency === 'today') {
    return (
      <span className="upcoming-tearoff" aria-hidden>
        <CalendarBlank size={15} weight="fill" />
        <span className="upcoming-tearoff-page" />
      </span>
    )
  }
  return <Flag size={15} weight="fill" aria-hidden />
}

function ItemIcon({ item }: { item: UpcomingItem }) {
  if (item.kind === 'holiday') {
    return <HolidayIcon urgency={item.urgency ?? 'calm'} />
  }
  if (item.kind === 'leave') {
    return <CalendarBlank size={15} weight="fill" aria-hidden />
  }
  return <Target size={15} weight="fill" aria-hidden />
}

export function UpcomingStrip({ appData }: UpcomingStripProps) {
  const items = buildUpcomingItems(appData.settings, appData.attendance)
  if (items.length === 0) return null

  return (
    <section className="upcoming-strip" aria-label="Upcoming">
      <p className="upcoming-kicker">Upcoming</p>
      <ul className="upcoming-list">
        {items.map((item) => {
          const urgencyClass =
            item.kind === 'holiday' && item.urgency && item.urgency !== 'calm'
              ? ` upcoming-holiday--${item.urgency}`
              : ''
          return (
            <li
              key={item.id}
              className={`upcoming-item upcoming-${item.kind}${urgencyClass}`}
            >
              <span className="upcoming-icon" aria-hidden>
                <ItemIcon item={item} />
              </span>
              <span className="upcoming-copy">
                <span className="upcoming-label">{item.label}</span>
                <span className="upcoming-detail">{item.detail}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
