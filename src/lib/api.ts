import type { AppData, AuthUser } from '../types'
import { emptyAppData, normalizeAppData } from './attendance'

const API_BASE = '/api'
const TOKEN_KEY = 'office-visit-auth-token'
const USER_KEY = 'office-visit-auth-user'

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (!parsed?.id || !parsed?.email) return null
    return {
      ...parsed,
      isGuest: Boolean(parsed.isGuest),
    }
  } catch {
    return null
  }
}

export function storeSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function parseError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '')
  try {
    const body = JSON.parse(raw) as { error?: string; hint?: string }
    if (body?.error) {
      return body.hint ? `${body.error}. ${body.hint}` : String(body.error)
    }
  } catch {
    /* plain text body */
  }

  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (/cannot\s+(get|post|put|patch|delete)\s+/i.test(trimmed)) {
    return 'This feature is not available on the API yet. Restart the local API (or redeploy) and try again.'
  }
  if (trimmed && trimmed.length < 180 && !trimmed.startsWith('<')) {
    return trimmed
  }
  if (res.status === 503) {
    return 'The writing service is not configured right now.'
  }
  if (res.status === 502) {
    return 'Could not reach the writing service.'
  }
  if (res.status === 401) {
    return 'Please sign in again.'
  }
  return `Request failed (${res.status})`
}

function authHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const t = token ?? getStoredToken()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

export async function registerAccount(input: {
  email: string
  password: string
  name?: string
}): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = await res.json()
  storeSession(data.token, data.user)
  return data
}

export async function loginAccount(input: {
  email: string
  password: string
}): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = await res.json()
  storeSession(data.token, data.user)
  return data
}

export async function startGuestDemo(): Promise<{
  token: string
  user: AuthUser
}> {
  const res = await fetch(`${API_BASE}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = await res.json()
  const user: AuthUser = {
    id: String(data.user?.id ?? ''),
    email: String(data.user?.email ?? ''),
    name: String(data.user?.name ?? 'Demo Guest'),
    isGuest: true,
  }
  storeSession(String(data.token), user)
  return { token: String(data.token), user }
}

/** Erase guest account on the server. Safe to call when not a guest. */
export async function endGuestDemo(): Promise<void> {
  const user = getStoredUser()
  const token = getStoredToken()
  if (!user?.isGuest || !token) return
  try {
    await fetch(`${API_BASE}/auth/guest`, {
      method: 'DELETE',
      headers: authHeaders(token),
      keepalive: true,
    })
  } catch {
    /* best-effort erase */
  }
}

/** Best-effort wipe when the tab closes (beacon / keepalive). */
export function beaconEndGuestDemo(): void {
  const user = getStoredUser()
  const token = getStoredToken()
  if (!user?.isGuest || !token) return
  const url = `${API_BASE}/auth/guest`
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // sendBeacon cannot set Authorization; use keepalive fetch instead
    }
    void fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      keepalive: true,
    })
  } catch {
    /* ignore */
  }
}

export async function sendDemoSampleEmail(input: {
  email: string
  kind?: 'weekly' | 'holiday-eve'
  name?: string
}): Promise<void> {
  const res = await fetch(`${API_BASE}/demo/send-sample-email`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      kind: input.kind ?? 'weekly',
      name: input.name,
    }),
  })
  if (!res.ok) {
    if (res.status === 401) clearSession()
    throw new Error(await parseError(res))
  }
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = await res.json()
  const user = data.user as AuthUser
  return { ...user, isGuest: Boolean(user.isGuest) }
}

export async function fetchAppData(): Promise<AppData> {
  const res = await fetch(`${API_BASE}/attendance`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    if (res.status === 401) clearSession()
    throw new Error(await parseError(res))
  }
  const data = await res.json()
  return normalizeAppData(data)
}

export async function persistAppData(data: AppData): Promise<void> {
  const payload = normalizeAppData(data)
  const res = await fetch(`${API_BASE}/attendance`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      attendance: payload.attendance,
      settings: payload.settings,
      finance: payload.finance,
    }),
  })
  if (!res.ok) {
    if (res.status === 401) clearSession()
    throw new Error(await parseError(res))
  }
}

export async function elaborateWorkStatus(input: {
  note: string
}): Promise<{ note: string; summary: string }> {
  const res = await fetch(`${API_BASE}/work-status/elaborate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      note: input.note,
    }),
  })
  if (!res.ok) {
    if (res.status === 401) clearSession()
    throw new Error(await parseError(res))
  }
  const data = await res.json()
  return {
    note: String(data.note ?? input.note),
    summary: String(data.summary ?? ''),
  }
}

export { emptyAppData }
