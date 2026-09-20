type DemoBannerProps = {
  onSignIn: () => void
}

export function DemoBanner({ onSignIn }: DemoBannerProps) {
  return (
    <div className="demo-banner" role="status">
      <p className="demo-banner-copy">
        You’re in a <strong>live demo</strong>. Data is erased when you leave.
        Want to keep using Officeil Poyo?{' '}
        <button type="button" className="demo-banner-link" onClick={onSignIn}>
          Sign in here
        </button>
      </p>
    </div>
  )
}
