import type { AppData } from '../types'
import { normalizeAppData } from './attendance'
import { persistAppData } from './api'

type PersistHandlers = {
  onError?: (err: unknown) => void
}

/**
 * Debounced MongoDB persist that flushes pending writes on dispose
 * (e.g. route change), so finance/attendance is not stuck only in localStorage.
 */
export function createDebouncedAppPersister(
  delayMs = 400,
  handlers: PersistHandlers = {},
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: AppData | null = null
  let inFlight: Promise<void> | null = null

  async function write(data: AppData) {
    const payload = normalizeAppData(data)
    try {
      await persistAppData(payload)
    } catch (err) {
      handlers.onError?.(err)
      throw err
    }
  }

  function schedule(data: AppData) {
    pending = data
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const next = pending
      pending = null
      if (!next) return
      inFlight = write(next).finally(() => {
        inFlight = null
      })
    }, delayMs)
  }

  async function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const next = pending
    pending = null
    if (next) {
      await write(next)
      return
    }
    if (inFlight) await inFlight
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    pending = null
  }

  return { schedule, flush, cancel }
}
