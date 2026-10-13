import { describe, expect, it } from 'vitest'

import {
  buildVerificationTokenRaw,
  hashVerificationToken,
  normalizeEmail,
  parseVerificationTokenRaw,
  slugifyFirmName,
} from './registration.util'

describe('registration.util', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('slugifies firm names', () => {
    expect(slugifyFirmName('Demo Tax & Co.')).toBe('demo-tax-co')
  })

  it('round-trips verification token format', () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const raw = buildVerificationTokenRaw(firmId)
    const parsed = parseVerificationTokenRaw(raw)
    expect(parsed?.firmId).toBe(firmId)
    expect(hashVerificationToken(raw)).toHaveLength(64)
  })

  it('rejects malformed verification tokens', () => {
    expect(parseVerificationTokenRaw('bad')).toBeNull()
    expect(parseVerificationTokenRaw(`${'a'.repeat(36)}.abc`)).toBeNull()
  })
})
