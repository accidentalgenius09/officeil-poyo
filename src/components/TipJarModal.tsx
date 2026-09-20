import { useEffect, useId } from 'react'
import { X } from '@phosphor-icons/react'

type TipJarModalProps = {
  open: boolean
  onClose: () => void
}

export function TipJarModal({ open, onClose }: TipJarModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="tip-jar-root">
      <button
        type="button"
        className="tip-jar-backdrop"
        aria-label="Close tip jar"
        onClick={onClose}
      />
      <div
        className="tip-jar-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tip-jar-header">
          <h2 id={titleId} className="tip-jar-title">
            Buy me a coffee
          </h2>
          <button
            type="button"
            className="tip-jar-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>
        <img
          className="tip-jar-qr"
          src="/upi-qr.png"
          alt="UPI QR code to tip Surjith K"
          width={240}
          height={240}
        />
        <p className="tip-jar-upi">or UPI id: surjith2000@yescred</p>
      </div>
    </div>
  )
}
