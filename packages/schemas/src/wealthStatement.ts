import { z } from 'zod'

import { PaisaStringSchema, UuidSchema } from './common'

export const WealthStatementStatusSchema = z.enum(['DRAFT', 'RECONCILED', 'DISCREPANCY'])

export const WealthReviewStatusSchema = z.enum(['NOT_STARTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'])

export const UpsertWealthStatementBodySchema = z.object({
  openingWealthPaisa: PaisaStringSchema,
  closingWealthPaisa: PaisaStringSchema,
  incomeTotalPaisa: PaisaStringSchema,
  expenseTotalPaisa: PaisaStringSchema,
  taxTotalPaisa: PaisaStringSchema,
  explanation: z.string().max(4000).nullable().optional(),
  reviewStatus: WealthReviewStatusSchema.optional(),
})

export type UpsertWealthStatementBody = z.infer<typeof UpsertWealthStatementBodySchema>

export const WealthStatementSchema = z.object({
  id: UuidSchema,
  taxYearFileId: UuidSchema,
  openingWealthPaisa: PaisaStringSchema,
  closingWealthPaisa: PaisaStringSchema,
  incomeTotalPaisa: PaisaStringSchema,
  expenseTotalPaisa: PaisaStringSchema,
  taxTotalPaisa: PaisaStringSchema,
  discrepancyPaisa: PaisaStringSchema,
  expectedClosingPaisa: PaisaStringSchema,
  status: WealthStatementStatusSchema,
  explanation: z.string().nullable(),
  reviewStatus: WealthReviewStatusSchema,
  updatedAt: z.string().datetime(),
})

export type WealthStatementDto = z.infer<typeof WealthStatementSchema>
