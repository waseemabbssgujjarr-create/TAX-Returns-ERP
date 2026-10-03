export interface WithholdingCreditTarget {
  id: string
  amountPaisa: bigint
}

export interface WithholdingEntryRow {
  id: string
  amountPaisa: bigint
}

/** Greedy match withholding entries to credit amounts (exact paisa). */
export function matchWithholdingToCredits(
  entries: WithholdingEntryRow[],
  credits: WithholdingCreditTarget[],
): { entryId: string; matched: boolean }[] {
  const remaining = new Map(credits.map((c) => [c.id, c.amountPaisa]))

  return entries.map((entry) => {
    for (const [creditId, amount] of remaining) {
      if (amount === entry.amountPaisa) {
        remaining.delete(creditId)
        return { entryId: entry.id, matched: true }
      }
    }
    return { entryId: entry.id, matched: false }
  })
}
