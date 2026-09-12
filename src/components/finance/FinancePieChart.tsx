import { useId, useMemo } from 'react'
import type { FinancePieSlice } from '../../lib/finance'
import { formatMoney } from '../../lib/finance'
import { ThemedSelect, type ThemedSelectOption } from './ThemedSelect'

const PIE_COLORS = [
  '#1b4d3e',
  '#b8892d',
  '#3d7ab8',
  '#c45c3c',
  '#4d8f6f',
  '#8a6b2e',
  '#5a6b8a',
  '#2a6a5a',
]

type FinancePieChartProps = {
  title: string
  slices: FinancePieSlice[]
  currency: string
  emptyLabel?: string
  monthValue: string
  monthOptions: ThemedSelectOption[]
  onMonthChange: (value: string) => void
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function slicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle
  if (sweep >= 359.99) {
    const mid = startAngle + 180
    const a = polar(cx, cy, r, startAngle)
    const b = polar(cx, cy, r, mid)
    const c = polar(cx, cy, r, startAngle + 360)
    return [
      `M ${cx} ${cy}`,
      `L ${a.x} ${a.y}`,
      `A ${r} ${r} 0 1 1 ${b.x} ${b.y}`,
      `A ${r} ${r} 0 1 1 ${c.x} ${c.y}`,
      'Z',
    ].join(' ')
  }
  const start = polar(cx, cy, r, startAngle)
  const end = polar(cx, cy, r, endAngle)
  const large = sweep > 180 ? 1 : 0
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

export function FinancePieChart({
  title,
  slices,
  currency,
  emptyLabel = 'No data this month yet.',
  monthValue,
  monthOptions,
  onMonthChange,
}: FinancePieChartProps) {
  const titleId = useId()
  const paths = useMemo(() => {
    let angle = 0
    return slices.map((slice, index) => {
      const sweep = slice.ratio * 360
      const start = angle
      const end = angle + sweep
      angle = end
      return {
        ...slice,
        d: slicePath(50, 50, 40, start, end),
        color: PIE_COLORS[index % PIE_COLORS.length],
      }
    })
  }, [slices])

  return (
    <section className="finance-pie" aria-labelledby={titleId}>
      <div className="finance-pie-header">
        <h2 id={titleId} className="finance-section-title">
          {title}
        </h2>
        <label className="finance-pie-month">
          <span className="finance-pie-month-label">Month</span>
          <ThemedSelect
            aria-label="Chart month"
            value={monthValue}
            onChange={onMonthChange}
            options={monthOptions}
          />
        </label>
      </div>
      {slices.length === 0 ? (
        <p className="settings-help">{emptyLabel}</p>
      ) : (
        <div className="finance-pie-body">
          <svg
            className="finance-pie-svg"
            viewBox="0 0 100 100"
            role="img"
            aria-label={title}
          >
            {paths.map((slice) => (
              <path
                key={slice.key}
                d={slice.d}
                fill={slice.color}
                stroke="var(--surface-solid)"
                strokeWidth="0.8"
              >
                <title>
                  {slice.label}: {formatMoney(slice.amount, currency)}
                </title>
              </path>
            ))}
          </svg>
          <ul className="finance-pie-legend">
            {paths.map((slice) => (
              <li key={slice.key}>
                <span
                  className="finance-pie-swatch"
                  style={{ background: slice.color }}
                  aria-hidden
                />
                <span className="finance-pie-legend-label">{slice.label}</span>
                <span className="finance-pie-legend-value">
                  {formatMoney(slice.amount, currency)}
                  <em>{Math.round(slice.ratio * 100)}%</em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
