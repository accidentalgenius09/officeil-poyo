import { useEffect, useId, useState } from 'react'
import type { DayRecord, DayStatus } from '../types'
import { toast } from 'react-hot-toast'

type DayStatusPanelProps = {
  open: boolean
  dateKey: string
  dateLabel: string
  record: DayRecord
  busy?: boolean
  onClose: () => void
  onStatusChange: (status: DayStatus) => void
  onSaveNote: (input: { note: string; summary?: string }) => void
  onElaborateAndSave: (input: {
    note: string
  }) => Promise<{ note: string; summary: string }>
}

export function DayStatusPanel({
  open,
  dateKey,
  dateLabel,
  record,
  busy = false,
  onClose,
  onStatusChange,
  onSaveNote,
  onElaborateAndSave,
}: DayStatusPanelProps) {
  const titleId = useId()
  const [note, setNote] = useState(record.note ?? '')
  const [summary, setSummary] = useState(record.summary ?? '')
  const [elaborating, setElaborating] = useState(false)

  useEffect(() => {
    if (!open) return
    setNote(record.note ?? '')
    setSummary(record.summary ?? '')
  }, [open, dateKey, record.note, record.summary])

  useEffect(() => {
    if (!open) return

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const status = record.status
  const saving = busy || elaborating

  async function handleElaborate() {
    const trimmed = note.trim()
    if (!trimmed) {
      toast.error('Write a short note first')
      return
    }
    setElaborating(true)
    try {
      const result = await onElaborateAndSave({ note: trimmed })
      setNote('')
      setSummary(result.summary)
      toast.success('Elaborated status saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not elaborate note')
    } finally {
      setElaborating(false)
    }
  }

  function handleSaveNoteOnly() {
    onSaveNote({ note: note.trim(), summary: summary.trim() || undefined })
    toast.success('Note saved')
  }

  return (
    <div className="day-status-root">
      <button
        type="button"
        className="settings-backdrop"
        aria-label="Close day status"
        onClick={onClose}
      />
      <aside
        className="day-status-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="settings-header">
          <h2 id={titleId}>{dateLabel}</h2>
          <button type="button" className="settings-close" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="settings-help">
          Set attendance and optionally add a short work update. Elaborate &amp;
          save keeps only the Groq write-up. Save note only stores your short
          text as written.
        </p>

        <div className="day-status-actions" role="group" aria-label="Day status">
          <button
            type="button"
            className={`day-status-chip${status === 'office' ? ' active office' : ''}`}
            disabled={saving}
            onClick={() => onStatusChange('office')}
          >
            Office
          </button>
          <button
            type="button"
            className={`day-status-chip${status === 'wfh' ? ' active wfh' : ''}`}
            disabled={saving}
            onClick={() => onStatusChange('wfh')}
          >
            WFH
          </button>
          <button
            type="button"
            className={`day-status-chip${status === null ? ' active' : ''}`}
            disabled={saving}
            onClick={() => onStatusChange(null)}
          >
            Clear
          </button>
        </div>

        <label className="day-status-field">
          What did you work on?
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Fixed login bug, reviewed PR #42"
            disabled={saving}
          />
        </label>

        {summary ? (
          <div className="day-status-summary">
            <p className="card-label">Elaborated status</p>
            <p className="day-status-summary-body">{summary}</p>
          </div>
        ) : null}

        <div className="day-status-footer">
          <button
            type="button"
            className="settings-submit"
            disabled={saving}
            onClick={() => void handleElaborate()}
          >
            {elaborating ? 'Elaborating…' : 'Elaborate & save'}
          </button>
          <button
            type="button"
            className="settings-submit day-status-secondary"
            disabled={saving}
            onClick={handleSaveNoteOnly}
          >
            Save note only
          </button>
        </div>
      </aside>
    </div>
  )
}
