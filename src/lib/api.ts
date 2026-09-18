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
    return parsed
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
  try {
    const body = await res.json()
    if (body?.error) return String(body.error)
  } catch {
    /* ignore */
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

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = await res.json()
  return data.user as AuthUser
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
