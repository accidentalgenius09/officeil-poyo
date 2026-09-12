import { useNavigate } from 'react-router-dom'
import { CurrencyCircleDollar } from '@phosphor-icons/react'
import { trackEvent } from '../lib/analytics'

export function FinanceFab() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className="finance-fab"
      aria-label="Open financial management"
      title="Finance"
      onClick={() => {
        trackEvent('open_finance')
        navigate('/finance')
      }}
    >
      <CurrencyCircleDollar size={24} weight="fill" aria-hidden />
    </button>
  )
}
