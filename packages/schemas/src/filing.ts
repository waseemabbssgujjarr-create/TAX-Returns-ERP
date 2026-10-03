import { z } from 'zod'

import { UuidSchema } from './common'

/**
 * IRIS submission tracking — distinct from ReturnPrep (internal review).
 * Status is intentionally honest: the stub adapter always lands on
 * PENDING_INTEGRATION, never SUBMITTED/ACCEPTED, until a real IRIS adapter
 * is configured. See docs/adr/001-provider-adapters.md.
 */
export const IrisFilingStatusSchema = z.enum([
  'DRAFT',
  'READY',
  'PENDING_INTEGRATION',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'FAILED',
])

export const IrisFilingChannelSchema = z.enum(['MANUAL_PORTAL', 'API'])

export const FilingChecklistItemSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(160),
  ok: z.boolean(),
  severity: z.enum(['error', 'warning']),
})

export const FilingReadinessSchema = z.object({
  readyToFile: z.boolean(),
  items: z.array(FilingChecklistItemSchema),
})

export type FilingReadiness = z.infer<typeof FilingReadinessSchema>

export const IrisFilingSchema = z.object({
  id: UuidSchema,
  taxYearFileId: UuidSchema,
  status: IrisFilingStatusSchema,
  channel: IrisFilingChannelSchema,
  irisReferenceNo: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().nonnegative(),
  submittedAt: z.string().datetime().nullable(),
  submittedById: UuidSchema.nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  readiness: FilingReadinessSchema,
  updatedAt: z.string().datetime(),
})

export type IrisFilingDto = z.infer<typeof IrisFilingSchema>

export const SubmitIrisFilingBodySchema = z.object({
  irisReferenceNo: z.string().trim().max(64).optional(),
  channel: IrisFilingChannelSchema.optional(),
})

export type SubmitIrisFilingBody = z.infer<typeof SubmitIrisFilingBodySchema>

export const RecordManualIrisReferenceBodySchema = z.object({
  irisReferenceNo: z.string().trim().min(1).max(64),
})

export type RecordManualIrisReferenceBody = z.infer<typeof RecordManualIrisReferenceBodySchema>

export const FilingActivityItemSchema = z.object({
  id: UuidSchema,
  action: z.string(),
  userId: UuidSchema.nullable(),
  createdAt: z.string().datetime(),
  payload: z.record(z.unknown()).nullable(),
})

export type FilingActivityItem = z.infer<typeof FilingActivityItemSchema>
