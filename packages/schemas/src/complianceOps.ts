import { z } from 'zod'

import { PaginationQuerySchema, PaisaStringSchema, TaxYearSchema, UuidSchema } from './common'

export const NoticeStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

export const ListNoticesQuerySchema = PaginationQuerySchema.extend({
  clientId: UuidSchema.optional(),
  status: NoticeStatusSchema.optional(),
})

export type ListNoticesQuery = z.infer<typeof ListNoticesQuerySchema>

export const CreateNoticeBodySchema = z.object({
  clientId: UuidSchema,
  taxYearFileId: UuidSchema.optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  deadline: z.string().datetime().optional(),
  assigneeId: UuidSchema.optional(),
  documentIds: z.array(UuidSchema).default([]),
})

export type CreateNoticeBody = z.infer<typeof CreateNoticeBodySchema>

export const UpdateNoticeBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    assigneeId: UuidSchema.nullable().optional(),
    status: NoticeStatusSchema.optional(),
    documentIds: z.array(UuidSchema).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })

export type UpdateNoticeBody = z.infer<typeof UpdateNoticeBodySchema>

export const NoticeSummarySchema = z.object({
  id: UuidSchema,
  clientId: UuidSchema,
  taxYearFileId: UuidSchema.nullable(),
  title: z.string(),
  status: NoticeStatusSchema,
  deadline: z.string().datetime().nullable(),
  assigneeId: UuidSchema.nullable(),
  createdAt: z.string().datetime(),
})

export const ComplianceEventKindSchema = z.enum(['DEADLINE', 'REMINDER', 'INFO_REQUEST', 'FILING'])

export const ListComplianceEventsQuerySchema = PaginationQuerySchema.extend({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export type ListComplianceEventsQuery = z.infer<typeof ListComplianceEventsQuerySchema>

export const CreateComplianceEventBodySchema = z.object({
  clientId: UuidSchema.optional(),
  taxYearFileId: UuidSchema.optional(),
  kind: ComplianceEventKindSchema,
  title: z.string().min(1).max(200),
  eventAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateComplianceEventBody = z.infer<typeof CreateComplianceEventBodySchema>

export const ComplianceEventSchema = z.object({
  id: UuidSchema,
  clientId: UuidSchema.nullable(),
  taxYearFileId: UuidSchema.nullable(),
  kind: ComplianceEventKindSchema,
  title: z.string(),
  eventAt: z.string().datetime(),
  reminderSentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

// ── Late-filing penalty calculator (F3 — s.182 / s.182A, versioned per rules pack) ──

export const PenaltyFilingKindSchema = z.enum(['INCOME_TAX_RETURN', 'ATL_SURCHARGE'])

export const PenaltyClientTypeSchema = z.enum(['INDIVIDUAL', 'AOP', 'COMPANY'])

export const PenaltyEstimateBodySchema = z.object({
  taxYear: TaxYearSchema,
  filingKind: PenaltyFilingKindSchema,
  clientType: PenaltyClientTypeSchema,
  /** Tax payable on which the daily/percentage penalty is calculated, in paisa */
  taxPayablePaisa: PaisaStringSchema,
  daysLate: z.number().int().nonnegative(),
})

export type PenaltyEstimateBody = z.infer<typeof PenaltyEstimateBodySchema>

export const PenaltyEstimateResultSchema = z.object({
  /** false when the rules pack for taxYear is DRAFT/unavailable — never fabricate a figure */
  available: z.boolean(),
  rulesVersion: z.string().nullable(),
  penaltyPaisa: z.string().regex(/^\d+$/).nullable(),
  minimumAppliedPaisa: z.string().regex(/^\d+$/).nullable(),
  cappedAtMaxPaisa: z.boolean(),
  reductionPercentApplied: z.number().nullable(),
  explanationKeys: z.array(z.string()),
  blockedReason: z.string().nullable(),
})

export type PenaltyEstimateResult = z.infer<typeof PenaltyEstimateResultSchema>
