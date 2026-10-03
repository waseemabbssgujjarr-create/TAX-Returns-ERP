import { describe, expect, it } from 'vitest'

import { validateWhtRow } from './wht-row-validator.util'

const TAX_YEAR = 2025

function baseRow() {
  return {
    registrationNo: '1234567', // valid 7-digit NTN
    payeeName: 'Acme Traders',
    transactionDate: new Date('2025-01-15T00:00:00.000Z'),
    whtCode: '149',
    taxYear: TAX_YEAR,
  }
}

describe('validateWhtRow', () => {
  it('reproduces all four IRIS invalid-status categories on known-bad rows', () => {
    expect(validateWhtRow({ ...baseRow(), registrationNo: '12345' })).toBe(
      'INVALID_REGISTRATION_NO',
    )
    expect(validateWhtRow({ ...baseRow(), whtCode: 'XYZ!!' })).toBe('INVALID_CODE')
    expect(validateWhtRow({ ...baseRow(), payeeName: '' })).toBe('INVALID_NAME')
    expect(
      validateWhtRow({ ...baseRow(), transactionDate: new Date('2024-01-15T00:00:00.000Z') }),
    ).toBe('INVALID_TRANSACTION_DATE')
  })

  it('accepts a 13-digit CNIC as a valid registration number for unregistered payees', () => {
    expect(validateWhtRow({ ...baseRow(), registrationNo: '3520112345671' })).toBe('VALID')
  })

  it('marks a fully correct row as VALID', () => {
    expect(validateWhtRow(baseRow())).toBe('VALID')
  })

  it('checks registration number before other fields (IRIS precedence)', () => {
    expect(
      validateWhtRow({
        ...baseRow(),
        registrationNo: 'bad',
        whtCode: 'also-bad',
        payeeName: '',
      }),
    ).toBe('INVALID_REGISTRATION_NO')
  })

  it('rejects a transaction date outside the tax year window (1 Jul – 30 Jun)', () => {
    expect(
      validateWhtRow({ ...baseRow(), transactionDate: new Date('2025-07-01T00:00:00.000Z') }),
    ).toBe('INVALID_TRANSACTION_DATE')
    expect(
      validateWhtRow({ ...baseRow(), transactionDate: new Date('2024-06-30T23:59:59.000Z') }),
    ).toBe('INVALID_TRANSACTION_DATE')
  })

  it('treats a missing transaction date as invalid', () => {
    expect(validateWhtRow({ ...baseRow(), transactionDate: null })).toBe(
      'INVALID_TRANSACTION_DATE',
    )
  })
})
