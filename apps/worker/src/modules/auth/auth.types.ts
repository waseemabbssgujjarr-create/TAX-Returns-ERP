import type { UserRole } from '@prisma/client'
import type { Request } from 'express'

export type SessionState = 'partial' | 'full'
export type SessionType = 'staff' | 'portal'

export interface JwtPayload {
  sub: string
  iat: number
  exp: number
  jti: string
  firmId: string
  role: UserRole
  sessionState: SessionState
  sessionType: SessionType
  clientId?: string
}

export interface AuthenticatedUser {
  userId: string
  firmId: string
  role: UserRole
  sessionState: SessionState
  sessionType: SessionType
  clientId?: string
  jti: string
}

export interface RequestMeta {
  ipAddress?: string
  userAgent?: string
}

/** Omit undefined optional fields for exactOptionalPropertyTypes. */
export function requestMeta(req: Pick<Request, 'ip' | 'headers'>): RequestMeta {
  const meta: RequestMeta = {}
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    meta.ipAddress = req.ip
  }
  const userAgent = req.headers['user-agent']
  if (typeof userAgent === 'string') {
    meta.userAgent = userAgent
  }
  return meta
}

export const REFRESH_COOKIE_NAME = 'refresh_token'
