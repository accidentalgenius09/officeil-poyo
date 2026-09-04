type MonthHeaderProps = {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function MonthHeader({ label, onPrev, onNext, onToday }: MonthHeaderProps) {
  return (
    <div className="month-header">
      <button type="button" className="nav-btn" onClick={onPrev} aria-label="Previous month">
        ‹
      </button>
      <div className="month-center">
        <h2 className="month-label">{label}</h2>
        <button type="button" className="today-btn" onClick={onToday}>
          Today
        </button>
      </div>
      <button type="button" className="nav-btn" onClick={onNext} aria-label="Next month">
        ›
      </button>
    </div>
  )
}
