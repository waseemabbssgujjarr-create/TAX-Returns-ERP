import { describe, expect, it } from 'vitest'

import { computeWealthReconciliation } from './wealth-reconciliation.util'

describe('computeWealthReconciliation', () => {
  it('marks RECONCILED when closing matches formula', () => {
    const result = computeWealthReconciliation({
      openingWealthPaisa: 1_000_000n,
      incomeTotalPaisa: 500_000n,
      expenseTotalPaisa: 200_000n,
      taxTotalPaisa: 50_000n,
      closingWealthPaisa: 1_250_000n,
    })
    expect(result.expectedClosingPaisa).toBe(1_250_000n)
    expect(result.discrepancyPaisa).toBe(0n)
    expect(result.status).toBe('RECONCILED')
  })

  it('surfaces discrepancy without adjusting closing', () => {
    const result = computeWealthReconciliation({
      openingWealthPaisa: 0n,
      incomeTotalPaisa: 100_00n,
      expenseTotalPaisa: 0n,
      taxTotalPaisa: 10_00n,
      closingWealthPaisa: 95_00n,
    })
    expect(result.discrepancyPaisa).toBe(5_00n)
    expect(result.status).toBe('DISCREPANCY')
  })
})
