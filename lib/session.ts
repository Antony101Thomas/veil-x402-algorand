export const SESSION_KEY = 'veil-session'

export type SessionRole = 'agent' | 'admin'

export type Session = {
  handle: string
  role: SessionRole
}

const COOKIE_MAX_AGE = 86400

function parseSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Session>
    if (
      typeof parsed.handle !== 'string' ||
      (parsed.role !== 'agent' && parsed.role !== 'admin')
    ) {
      return null
    }
    return { handle: parsed.handle, role: parsed.role }
  } catch {
    return null
  }
}

function readCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_KEY}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Single demo session: Http cookie, shared by login, landing, agent, and admin. */
export function readSession(): Session | null {
  return parseSession(readCookie())
}

export function writeSession(session: Session): void {
  if (typeof document === 'undefined') return
  document.cookie = `${SESSION_KEY}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Strict`
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore quota / private-mode failures
  }
}

export function clearSession(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${SESSION_KEY}=; path=/; max-age=0`
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function dashboardPath(role: SessionRole): '/admin' | '/agent' {
  return role === 'admin' ? '/admin' : '/agent'
}
