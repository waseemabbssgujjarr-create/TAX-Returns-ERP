import { describe, expect, it } from 'vitest'

import { isResendEnabled } from '@/components/auth/PortalLoginForm'

describe('PortalLoginForm resend countdown', () => {
  it('keeps resend disabled until countdown reaches zero', () => {
    expect(isResendEnabled(60)).toBe(false)
    expect(isResendEnabled(1)).toBe(false)
    expect(isResendEnabled(0)).toBe(true)
  })
})
