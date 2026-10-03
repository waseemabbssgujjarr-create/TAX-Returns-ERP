import { describe, expect, it } from 'vitest'

import { matchWithholdingToCredits } from './withholding-reconciliation.util'

describe('matchWithholdingToCredits', () => {
  it('matches equal paisa amounts one-to-one', () => {
    const result = matchWithholdingToCredits(
      [
        { id: 'w1', amountPaisa: 1000n },
        { id: 'w2', amountPaisa: 2000n },
      ],
      [
        { id: 'c1', amountPaisa: 2000n },
        { id: 'c2', amountPaisa: 1000n },
      ],
    )
    expect(result.find((r) => r.entryId === 'w1')?.matched).toBe(true)
    expect(result.find((r) => r.entryId === 'w2')?.matched).toBe(true)
  })

  it('leaves unmatched when no credit amount fits', () => {
    const result = matchWithholdingToCredits(
      [{ id: 'w1', amountPaisa: 999n }],
      [{ id: 'c1', amountPaisa: 1000n }],
    )
    expect(result[0]?.matched).toBe(false)
  })
})
