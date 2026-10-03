import { z } from 'zod'

import { UuidSchema } from './common'
import { DataProvenanceSchema, TaxYearSectionKeySchema } from './taxYears'

export const ReturnPrepReviewStatusSchema = z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED'])

export const ReturnPrepRulesStateSchema = z.enum(['AVAILABLE', 'DRAFT', 'UNAVAILABLE', 'UNKNOWN'])

/** Field readiness for return preparation — distinct from raw data provenance. */
export const ReturnPrepFieldStateSchema = z.enum([
  'entered',
  'extracted',
  'verified',
  'calculated',
  'missing',
  'needs_review',
])

export const ReturnPrepWarningSchema = z.object({
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
})

export const ReturnPrepValidationIssueSchema = z.object({
  code: z.string().min(1).max(64),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string().min(1).max(500),
  path: z.string().max(128).optional(),
})

export const ReturnPrepValidationSchema = z.object({
  status: z.enum(['incomplete', 'blocked', 'ready_for_review', 'approved_gate_ok']),
  canSubmitForReview: z.boolean(),
  canApprove: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  issues: z.array(ReturnPrepValidationIssueSchema),
})

export const ReturnPrepFieldSchema = z.object({
  path: z.string().min(1).max(128),
  sectionKey: TaxYearSectionKeySchema.optional(),
  label: z.string().min(1).max(120),
  state: ReturnPrepFieldStateSchema,
  provenance: DataProvenanceSchema.optional(),
  complete: z.boolean().optional(),
})

export const ReturnPrepMissingItemSchema = z.object({
  path: z.string().min(1).max(128),
  label: z.string().min(1).max(120),
  reason: z.string().min(1).max(240),
})

export const ReturnPrepSectionSummarySchema = z.object({
  present: z.boolean(),
  complete: z.boolean().optional(),
  provenance: DataProvenanceSchema.optional(),
  fieldState: ReturnPrepFieldStateSchema.optional(),
})

/** Versioned structured draft assembled from workspace data — not an IRIS/FBR filing payload. */
export const ReturnPrepDraftV1Schema = z.object({
  schemaVersion: z.literal(1),
  taxYear: z.number().int().min(2000).max(2100),
  clientId: UuidSchema,
  assembledAt: z.string().datetime(),
  rulesVersion: z.string().nullable(),
  rulesState: ReturnPrepRulesStateSchema,
  filingDisclaimer: z.literal('NOT_IRIS_FBR_SUBMISSION'),
  sections: z.record(TaxYearSectionKeySchema, ReturnPrepSectionSummarySchema),
  sectionCompleteness: z.object({
    complete: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  }),
  fields: z.array(ReturnPrepFieldSchema).default([]),
  missing: z.array(ReturnPrepMissingItemSchema).default([]),
  validation: ReturnPrepValidationSchema,
  wealth: z
    .object({
      present: z.boolean(),
      status: z.string().nullable(),
      reviewStatus: z.string().nullable(),
      discrepancyPaisa: z.string().nullable(),
    })
    .nullable(),
  withholding: z.object({
    entryCount: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative(),
    unmatchedCount: z.number().int().nonnegative(),
    totalTaxDeductedPaisa: z.string(),
  }),
  computation: z
    .object({
      snapshotId: UuidSchema.nullable(),
      status: z.string().nullable(),
      rulesVersion: z.string().nullable(),
      taxPayablePaisa: z.string().nullable(),
    })
    .nullable(),
  documents: z.object({
    count: z.number().int().nonnegative(),
  }),
  warnings: z.array(ReturnPrepWarningSchema),
  notes: z.string().max(4000).optional(),
  checklist: z.object({
    sectionsComplete: z.boolean(),
    wealthReviewed: z.boolean(),
    withholdingReconciled: z.boolean(),
    computationOk: z.boolean(),
    humanReviewRequired: z.literal(true),
  }),
})

export type ReturnPrepDraftV1 = z.infer<typeof ReturnPrepDraftV1Schema>
export type ReturnPrepFieldState = z.infer<typeof ReturnPrepFieldStateSchema>
export type ReturnPrepValidation = z.infer<typeof ReturnPrepValidationSchema>

/** Staff may only upsert notes / demote-safe draft content — never force APPROVED. */
export const UpsertReturnPreparationBodySchema = z.object({
  notes: z.string().max(4000).optional(),
  structuredJson: z.union([ReturnPrepDraftV1Schema, z.record(z.unknown())]).optional(),
})

export type UpsertReturnPreparationBody = z.infer<typeof UpsertReturnPreparationBodySchema>

export const ApproveReturnPrepBodySchema = z.object({
  comment: z.string().max(2000).optional(),
})

export type ApproveReturnPrepBody = z.infer<typeof ApproveReturnPrepBodySchema>

export const DemoteReturnPrepBodySchema = z.object({
  targetStatus: z.enum(['DRAFT', 'IN_REVIEW']),
  comment: z.string().max(2000).optional(),
})

export type DemoteReturnPrepBody = z.infer<typeof DemoteReturnPrepBodySchema>

export const ReturnPreparationSchema = z.object({
  id: UuidSchema,
  taxYearFileId: UuidSchema,
  structuredJson: z.record(z.unknown()),
  reviewStatus: ReturnPrepReviewStatusSchema,
  assignedReviewerId: UuidSchema.nullable(),
  submittedAt: z.string().datetime().nullable(),
  submittedById: UuidSchema.nullable(),
  approvedAt: z.string().datetime().nullable(),
  approvedById: UuidSchema.nullable(),
  approvalComment: z.string().nullable(),
  disclaimerKey: z.literal('taxPlanning.disclaimer'),
  updatedAt: z.string().datetime(),
})

export type ReturnPreparationDto = z.infer<typeof ReturnPreparationSchema>

export const ReturnPrepActivityItemSchema = z.object({
  id: UuidSchema,
  action: z.string(),
  userId: UuidSchema.nullable(),
  createdAt: z.string().datetime(),
  payload: z.record(z.unknown()).nullable(),
})

export type ReturnPrepActivityItem = z.infer<typeof ReturnPrepActivityItemSchema>
