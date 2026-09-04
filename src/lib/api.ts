import type { AppData } from '../types'
import { emptyAppData, normalizeAppData } from './attendance'

const API_BASE = '/api'

export async function fetchAppData(): Promise<AppData> {
  const res = await fetch(`${API_BASE}/attendance`)
  if (!res.ok) {
    throw new Error(`Failed to load attendance (${res.status})`)
  }
  const data = await res.json()
  return normalizeAppData(data)
}

export async function persistAppData(data: AppData): Promise<void> {
  const res = await fetch(`${API_BASE}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error(`Failed to save attendance (${res.status})`)
  }
}

export { emptyAppData }
