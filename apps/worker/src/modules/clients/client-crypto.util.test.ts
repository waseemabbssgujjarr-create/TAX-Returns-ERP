import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildCnicMasked,
  buildNtnMasked,
  clientIdLookupHmac,
  cnicDigits,
} from './client-crypto.util'

describe('client-crypto.util', () => {
  beforeEach(() => {
    process.env['CLIENT_LOOKUP_HMAC_SECRET'] = 'test-hmac-secret'
  })

  it('validates CNIC digit extraction', () => {
    expect(cnicDigits('35202-1234567-1')).toBe('3520212345671')
  })

  it('masks CNIC per security standard', () => {
    expect(buildCnicMasked('35202-1234567-1')).toBe('35202-*******-1')
  })

  it('masks NTN showing last four', () => {
    expect(buildNtnMasked('1234567')).toBe('***4567')
  })

  it('produces deterministic firm-scoped lookup HMAC', () => {
    const firmId = '11111111-1111-1111-1111-111111111111'
    const a = clientIdLookupHmac(firmId, 'cnic', '3520212345671')
    const b = clientIdLookupHmac(firmId, 'cnic', '3520212345671')
    const c = clientIdLookupHmac(firmId, 'cnic', '3520212345672')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
