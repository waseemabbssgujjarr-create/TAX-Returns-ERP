import { create } from 'zustand'

import type { StaffRole } from '@/lib/api/auth'
import type { ClientJwtPayload, SessionState } from '@/lib/jwt'
import { decodeJwtPayload } from '@/lib/jwt'

/** Access tokens live in memory only — never localStorage/sessionStorage/IndexedDB. */

export interface AuthUser {
  id: string
  name: string
  role: StaffRole
  firmId: string
}

export interface AuthFirm {
  name?: string
  idleTimeoutMinutes: number
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  firm: AuthFirm | null
  sessionState: 'unauthenticated' | SessionState
  tokenIat: number | null
  sessionType: ClientJwtPayload['sessionType'] | null
  clientId: string | null
  setToken: (token: string, extras?: { user?: AuthUser | null; firm?: AuthFirm | null }) => void
  setSessionFromMe: (token: string, me: { user: AuthUser; firm: AuthFirm }) => void
  clearToken: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  firm: null,
  sessionState: 'unauthenticated',
  tokenIat: null,
  sessionType: null,
  clientId: null,

  setToken: (token, extras) => {
    const payload = decodeJwtPayload(token)
    if (!payload) {
      set({
        accessToken: null,
        user: null,
        firm: extras?.firm ?? null,
        sessionState: 'unauthenticated',
        tokenIat: null,
        sessionType: null,
        clientId: null,
      })
      return
    }

    set({
      accessToken: token,
      sessionState: payload.sessionState,
      tokenIat: payload.iat,
      sessionType: payload.sessionType,
      clientId: payload.clientId ?? null,
      user:
        extras?.user ??
        (payload.sessionState === 'full'
          ? {
              id: payload.sub,
              name: '',
              role: payload.role,
              firmId: payload.firmId,
            }
          : null),
      firm: extras?.firm ?? null,
    })
  },

  setSessionFromMe: (token, me) => {
    const payload = decodeJwtPayload(token)
    set({
      accessToken: token,
      sessionState: payload?.sessionState ?? 'full',
      tokenIat: payload?.iat ?? null,
      sessionType: payload?.sessionType ?? 'staff',
      clientId: payload?.clientId ?? null,
      user: me.user,
      firm: me.firm,
    })
  },

  clearToken: () =>
    set({
      accessToken: null,
      user: null,
      firm: null,
      sessionState: 'unauthenticated',
      tokenIat: null,
      sessionType: null,
      clientId: null,
    }),
}))
