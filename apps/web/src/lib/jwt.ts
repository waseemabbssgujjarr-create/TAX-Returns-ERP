import type { StaffRole } from '@/lib/api/auth'

export type SessionState = 'partial' | 'full'
export type SessionType = 'staff' | 'portal'

export interface ClientJwtPayload {
  sub: string
  iat: number
  exp: number
  jti: string
  firmId: string
  role: StaffRole
  sessionState: SessionState
  sessionType: SessionType
  clientId?: string
}

/** Decode JWT payload without verification (client-side hints only; worker validates). */
export function decodeJwtPayload(token: string): ClientJwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const segment = parts[1]
  if (!segment) return null

  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const json = atob(padded)
    const parsed = JSON.parse(json) as ClientJwtPayload
    if (!parsed.sub || !parsed.sessionState) return null
    return parsed
  } catch {
    return null
  }
}
