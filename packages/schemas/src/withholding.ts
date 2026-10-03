import { z } from 'zod'

import { emptyStringToUndefined, PaisaStringSchema, UuidSchema } from './common'

export const WithholdingSourceSchema = z.enum([
  'SALARY',
  'BANK',
  'UTILITIES',
  'VEHICLE',
  'PROPERTY',
  'CASH',
  'OTHER',
])

export const WithholdingReviewStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
])

/**
 * Mirrors the four IRIS WHT-statement row statuses (IRIS 2.0 Data-tab validation)
 * plus NOT_CHECKED for rows that have not been validated yet. See
 * `wht-row-validator.util.ts` in the worker for the pure validation logic.
 */
export const WithholdingValidationStatusSchema = z.enum([
  'NOT_CHECKED',
  'VALID',
  'INVALID_REGISTRATION_NO',
  'INVALID_CODE',
  'INVALID_NAME',
  'INVALID_TRANSACTION_DATE',
])

export type WithholdingValidationStatus = z.infer<typeof WithholdingValidationStatusSchema>

const optionalTrimmed = (max: number) =>
  z.preprocess(emptyStringToUndefined, z.string().max(max).optional())

export const CreateWithholdingEntryBodySchema = z.object({
  source: WithholdingSourceSchema,
  amountPaisa: PaisaStringSchema,
  taxDeductedPaisa: PaisaStringSchema.optional(),
  certificateRef: z.string().max(200).optional(),
  documentId: UuidSchema.optional(),
  reviewStatus: WithholdingReviewStatusSchema.optional(),
  /** Registration No. (NTN 7-digit or CNIC 13-digit) or Identification No. if unregistered */
  registrationNo: optionalTrimmed(50),
  payeeName: optionalTrimmed(200),
  transactionDate: z.string().datetime().optional(),
  /** WHT section/code, e.g. "149", "236C" — format-checked, not matched against a hard-coded code master */
  whtCode: optionalTrimmed(20),
  exemptionCode: optionalTrimmed(50),
  /** CPR (Computerized Payment Receipt) number — required before a WHT statement can be marked submit-ready */
  cprReference: optionalTrimmed(100),
})

export type CreateWithholdingEntryBody = z.infer<typeof CreateWithholdingEntryBodySchema>

export const UpdateWithholdingEntryBodySchema = z
  .object({
    source: WithholdingSourceSchema.optional(),
    amountPaisa: PaisaStringSchema.optional(),
    taxDeductedPaisa: PaisaStringSchema.optional(),
    certificateRef: z.string().max(200).nullable().optional(),
    documentId: UuidSchema.nullable().optional(),
    matched: z.boolean().optional(),
    reviewStatus: WithholdingReviewStatusSchema.optional(),
    registrationNo: z.string().max(50).nullable().optional(),
    payeeName: z.string().max(200).nullable().optional(),
    transactionDate: z.string().datetime().nullable().optional(),
    whtCode: z.string().max(20).nullable().optional(),
    exemptionCode: z.string().max(50).nullable().optional(),
    cprReference: z.string().max(100).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type UpdateWithholdingEntryBody = z.infer<typeof UpdateWithholdingEntryBodySchema>

export const WithholdingEntrySchema = z.object({
  id: UuidSchema,
  taxYearFileId: UuidSchema,
  source: WithholdingSourceSchema,
  amountPaisa: PaisaStringSchema,
  taxDeductedPaisa: PaisaStringSchema,
  certificateRef: z.string().nullable(),
  documentId: UuidSchema.nullable(),
  matched: z.boolean(),
  reviewStatus: WithholdingReviewStatusSchema,
  registrationNo: z.string().nullable(),
  payeeName: z.string().nullable(),
  transactionDate: z.string().datetime().nullable(),
  whtCode: z.string().nullable(),
  exemptionCode: z.string().nullable(),
  cprReference: z.string().nullable(),
  validationStatus: WithholdingValidationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const WithholdingReconcileResultSchema = z.object({
  entries: z.array(WithholdingEntrySchema),
  unmatchedCount: z.number().int().nonnegative(),
})

/** CPR-before-submit + all-rows-valid gate for a WHT statement (F2 "IRIS gates mirrored"). */
export const WithholdingChecklistSchema = z.object({
  readyToSubmit: z.boolean(),
  totalEntries: z.number().int().nonnegative(),
  invalidEntries: z.number().int().nonnegative(),
  missingCprEntries: z.number().int().nonnegative(),
  blockingReasons: z.array(z.string()),
})

export type WithholdingChecklist = z.infer<typeof WithholdingChecklistSchema>
