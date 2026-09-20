import { useEffect, useId, useState } from 'react'
import { Copy, Check, X } from '@phosphor-icons/react'
import { toast } from 'react-hot-toast'

const UPI_ID = 'surjith2000@yescred'

type TipJarModalProps = {
  open: boolean
  onClose: () => void
}

export function TipJarModal({ open, onClose }: TipJarModalProps) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  if (!open) return null

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      toast.success('UPI id copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy UPI id')
    }
  }

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
          alt="UPI QR code — scan with any UPI app"
          width={512}
          height={512}
          decoding="async"
        />
        <p className="tip-jar-upi">
          or UPI id:{' '}
          <button
            type="button"
            className="tip-jar-upi-copy"
            onClick={() => void copyUpi()}
            title="Copy UPI id"
          >
            {UPI_ID}
            {copied ? (
              <Check size={14} weight="bold" aria-hidden />
            ) : (
              <Copy size={14} weight="bold" aria-hidden />
            )}
          </button>
        </p>
      </div>
    </div>
  )
}
