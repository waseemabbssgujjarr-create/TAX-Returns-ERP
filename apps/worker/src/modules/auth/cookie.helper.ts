import type { Response } from 'express'

import { REFRESH_COOKIE_NAME } from './auth.types'

const COOKIE_MAX_AGE_SEC = 604800

/** Soft session presence for Next middleware (Path=/). Not a secret — refresh stays Path=/auth. */
export const SESSION_PRESENCE_COOKIE = 'td_session'

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/auth',
    maxAge: COOKIE_MAX_AGE_SEC * 1000,
  })
  res.cookie(SESSION_PRESENCE_COOKIE, '1', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC * 1000,
  })
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/auth',
  })
  res.clearCookie(SESSION_PRESENCE_COOKIE, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
  })
}
