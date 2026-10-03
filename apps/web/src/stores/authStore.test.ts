import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/stores/authStore'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearToken()
  })

  it('tracks partial session from token', () => {
    const token = fakeJwt({
      sub: 'user-1',
      iat: 1_700_000_000,
      exp: 1_700_000_900,
      jti: 'j1',
      firmId: 'firm-1',
      role: 'OWNER',
      sessionState: 'partial',
      sessionType: 'staff',
    })

    useAuthStore.getState().setToken(token)
    const state = useAuthStore.getState()
    expect(state.sessionState).toBe('partial')
    expect(state.accessToken).toBe(token)
    expect(state.user).toBeNull()
  })

  it('clears to unauthenticated', () => {
    useAuthStore.getState().setToken(
      fakeJwt({
        sub: 'u',
        iat: 1,
        exp: 9,
        jti: 'j',
        firmId: 'f',
        role: 'OWNER',
        sessionState: 'full',
        sessionType: 'staff',
      }),
    )
    useAuthStore.getState().clearToken()
    expect(useAuthStore.getState().sessionState).toBe('unauthenticated')
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
