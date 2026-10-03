import { describe, expect, it } from 'vitest'

import { formatPKR, formatPKRLakhCrore, parsePKR } from './format'

describe('formatPKR', () => {
  it('formats zero', () => {
    expect(formatPKR(0n)).toBe('Rs 0')
  })

  it('formats a round rupee amount', () => {
    expect(formatPKR(125000000n)).toBe('Rs 1,250,000')
  })

  it('formats with paisa when requested', () => {
    expect(formatPKR(125000050n, { showPaisa: true })).toBe('Rs 1,250,000.50')
  })

  it('does not show paisa when zero', () => {
    expect(formatPKR(125000000n, { showPaisa: true })).toBe('Rs 1,250,000')
  })
})

describe('formatPKRLakhCrore', () => {
  it('formats a crore amount with South Asian grouping', () => {
    expect(formatPKRLakhCrore(1000000000n)).toBe('Rs 1,00,00,000')
  })

  it('formats a lakh amount', () => {
    expect(formatPKRLakhCrore(10000000n)).toBe('Rs 1,00,000')
  })

  it('formats below 1000', () => {
    expect(formatPKRLakhCrore(50000n)).toBe('Rs 500')
  })
})

describe('parsePKR', () => {
  it('parses a formatted string back to paisa', () => {
    expect(parsePKR('Rs 1,250,000')).toBe(125000000n)
  })

  it('parses a plain number string', () => {
    expect(parsePKR('1250000')).toBe(125000000n)
  })

  it('parses a decimal amount', () => {
    expect(parsePKR('1250000.50')).toBe(125000050n)
  })

  it('returns null for invalid input', () => {
    expect(parsePKR('not-a-number')).toBeNull()
  })

  it('round-trips: parsePKR(formatPKR(x, { showPaisa: true })) === x', () => {
    // formatPKR without showPaisa truncates to whole rupees (display-only).
    const amount = 987654321n
    const formatted = formatPKR(amount, { showPaisa: true })
    const parsed = parsePKR(formatted)
    expect(parsed).toBe(amount)
  })

  it('round-trips whole-rupee amounts without showPaisa', () => {
    const amount = 987654300n
    expect(parsePKR(formatPKR(amount))).toBe(amount)
  })
})
