const DAYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

type AppLoaderProps = {
  label?: string
  compact?: boolean
}

export function AppLoader({
  label = 'Gathering your days…',
  compact = false,
}: AppLoaderProps) {
  return (
    <div
      className={`app-loader${compact ? ' is-compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loader-page" aria-hidden>
        <span className="app-loader-binding">
          <i />
          <i />
        </span>
        <span className="app-loader-rule" />
        <span className="app-loader-days">
          {DAYS.map((day) => (
            <i key={day} style={{ animationDelay: `${day * 0.11}s` }} />
          ))}
        </span>
      </div>
      <p className="app-loader-label">{label}</p>
    </div>
  )
}
