import type { WealthStatementStatus } from '@prisma/client'

export interface WealthReconciliationInput {
  openingWealthPaisa: bigint
  closingWealthPaisa: bigint
  incomeTotalPaisa: bigint
  expenseTotalPaisa: bigint
  taxTotalPaisa: bigint
}

export interface WealthReconciliationResult {
  expectedClosingPaisa: bigint
  discrepancyPaisa: bigint
  status: WealthStatementStatus
}

/** opening + income − expenses − tax = expected closing; never auto-adjusts closing. */
export function computeWealthReconciliation(
  input: WealthReconciliationInput,
): WealthReconciliationResult {
  const expectedClosingPaisa =
    input.openingWealthPaisa +
    input.incomeTotalPaisa -
    input.expenseTotalPaisa -
    input.taxTotalPaisa

  const discrepancyPaisa = input.closingWealthPaisa - expectedClosingPaisa
  const status: WealthStatementStatus = discrepancyPaisa === 0n ? 'RECONCILED' : 'DISCREPANCY'

  return { expectedClosingPaisa, discrepancyPaisa, status }
}
