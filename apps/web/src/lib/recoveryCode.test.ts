import { describe, expect, it } from 'vitest'

import { normalizeRecoveryCodeInput } from '@/lib/recoveryCode'

describe('normalizeRecoveryCodeInput', () => {
  it('uppercases hex input', () => {
    expect(normalizeRecoveryCodeInput('ab12cd34ef')).toBe('AB12CD34EF')
  })

  it('strips non-hex characters', () => {
    expect(normalizeRecoveryCodeInput('ab-12 xx')).toBe('AB12')
  })
})
