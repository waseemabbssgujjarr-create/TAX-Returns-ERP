import { describe, expect, it } from 'vitest'

import { CreateClientBodySchema } from './clients'
import { CnicSchema, NtnSchema } from './common'

describe('CnicSchema', () => {
  it('normalizes 13 digits without dashes', () => {
    expect(CnicSchema.parse('3520212345671')).toBe('35202-1234567-1')
  })

  it('accepts dashed 13-digit CNIC', () => {
    expect(CnicSchema.parse('35202-1234567-1')).toBe('35202-1234567-1')
  })

  it('rejects 14 digits with a clear message', () => {
    const result = CnicSchema.safeParse('33003125549611')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('CNIC must be 13 digits')
    }
  })
})

describe('CreateClientBodySchema', () => {
  it('accepts CNIC only without NTN', () => {
    const result = CreateClientBodySchema.safeParse({
      displayName: 'Adera Labs',
      type: 'BUSINESS_INDIVIDUAL',
      cnic: '3520212345671',
      filerStatus: 'NON_FILER',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cnic).toBe('35202-1234567-1')
      expect(result.data.ntn).toBeUndefined()
    }
  })

  it('treats empty NTN as absent', () => {
    const result = CreateClientBodySchema.safeParse({
      displayName: 'Test',
      type: 'SALARIED_INDIVIDUAL',
      cnic: '3520212345671',
      ntn: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ntn).toBeUndefined()
    }
  })
})

describe('NtnSchema', () => {
  it('strips non-digits and validates length', () => {
    expect(NtnSchema.parse('123-4567')).toBe('1234567')
  })
})
