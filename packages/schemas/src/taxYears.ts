import { z } from 'zod'

import { PaginationQuerySchema, TaxYearSchema, UuidSchema } from './common'
import { IrisFilingStatusSchema } from './filing'

export const TaxYearStatusSchema = z.enum([
  'INTAKE',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'APPROVED',
  'FILED',
  'CLOSED',
])

export const TaxYearSectionKeySchema = z.enum([
  'income',
  'salary',
  'business',
  'property',
  'otherSources',
  'deductions',
  'credits',
  'withholding',
  'assets',
  'liabilities',
  'expenses',
  'taxPayments',
])

export type TaxYearSectionKey = z.infer<typeof TaxYearSectionKeySchema>

export const DataProvenanceSchema = z.enum([
  'editable',
  'extracted',
  'verified',
  'calculated',
  'draft_rules',
])

export type DataProvenance = z.infer<typeof DataProvenanceSchema>

/** Section payload with optional provenance + note metadata */
export const TaxYearSectionPayloadSchema = z
  .object({
    provenance: DataProvenanceSchema.optional(),
    note: z.string().max(2000).optional(),
    complete: z.boolean().optional(),
    fields: z.record(z.unknown()).optional(),
  })
  .passthrough()

/** Extensible section payloads — validated per section key in the service layer */
export const TaxYearSectionsSchema = z
  .object({
    income: TaxYearSectionPayloadSchema.optional(),
    salary: TaxYearSectionPayloadSchema.optional(),
    business: TaxYearSectionPayloadSchema.optional(),
    property: TaxYearSectionPayloadSchema.optional(),
    otherSources: TaxYearSectionPayloadSchema.optional(),
    deductions: TaxYearSectionPayloadSchema.optional(),
    credits: TaxYearSectionPayloadSchema.optional(),
    withholding: TaxYearSectionPayloadSchema.optional(),
    assets: TaxYearSectionPayloadSchema.optional(),
    liabilities: TaxYearSectionPayloadSchema.optional(),
    expenses: TaxYearSectionPayloadSchema.optional(),
    taxPayments: TaxYearSectionPayloadSchema.optional(),
  })
  .default({})

export const ListTaxYearsQuerySchema = PaginationQuerySchema

export type ListTaxYearsQuery = z.infer<typeof ListTaxYearsQuerySchema>

export const CreateTaxYearBodySchema = z.object({
  taxYear: TaxYearSchema,
  dueDate: z.string().datetime().optional(),
  assigneeId: UuidSchema.optional(),
})

export type CreateTaxYearBody = z.infer<typeof CreateTaxYearBodySchema>

export const UpdateTaxYearBodySchema = z
  .object({
    status: TaxYearStatusSchema.optional(),
    dueDate: z.string().datetime().nullable().optional(),
    assigneeId: UuidSchema.nullable().optional(),
    sections: TaxYearSectionsSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

export type UpdateTaxYearBody = z.infer<typeof UpdateTaxYearBodySchema>

export const TaxYearSummarySchema = z.object({
  id: UuidSchema,
  clientId: UuidSchema,
  taxYear: TaxYearSchema,
  status: TaxYearStatusSchema,
  assigneeId: UuidSchema.nullable(),
  dueDate: z.string().datetime().nullable(),
  rulesVersion: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const TaxYearDetailSchema = TaxYearSummarySchema.extend({
  sections: TaxYearSectionsSchema,
})

export type TaxYearDetail = z.infer<typeof TaxYearDetailSchema>

export const PaginatedTaxYearsSchema = z.object({
  items: z.array(TaxYearSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

/** Firm-wide "Returns" list row — practice-level view across all clients (F4). */
export const TaxYearFirmSummarySchema = TaxYearSummarySchema.extend({
  clientName: z.string(),
  overdue: z.boolean(),
  /** Null = filing never prepared yet (distinct from IrisFilingStatus's own DRAFT state). */
  filingStatus: IrisFilingStatusSchema.nullable(),
})

export const PaginatedFirmTaxYearsSchema = z.object({
  items: z.array(TaxYearFirmSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export type TaxYearFirmSummary = z.infer<typeof TaxYearFirmSummarySchema>

export const ComputationWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
})

export const ComputationValidationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

export type ComputationBreakdownNode = {
  labelKey: string
  valuePaisa: string
  ruleIds: string[]
  note?: string | undefined
  children?: ComputationBreakdownNode[] | undefined
}

export const ComputationBreakdownNodeSchema: z.ZodType<ComputationBreakdownNode> = z.lazy(() =>
  z.object({
    labelKey: z.string(),
    valuePaisa: z.string().regex(/^\d+$/),
    ruleIds: z.array(z.string()),
    note: z.string().optional(),
    children: z.array(ComputationBreakdownNodeSchema).optional(),
  }),
)

export const ComputationSnapshotSchema = z.object({
  id: UuidSchema,
  taxYearFileId: UuidSchema,
  status: z.enum(['SUCCESS', 'VALIDATION_FAILED', 'RULES_UNAVAILABLE', 'ENGINE_ERROR']),
  rulesVersion: z.string().nullable(),
  taxPayablePaisa: z.string().regex(/^\d+$/).nullable(),
  netTaxPaisa: z.string().regex(/^\d+$/).nullable(),
  taxableIncomePaisa: z.string().regex(/^\d+$/).nullable(),
  warnings: z.array(ComputationWarningSchema),
  validationErrors: z.array(ComputationValidationErrorSchema),
  breakdown: z.array(ComputationBreakdownNodeSchema),
  createdAt: z.string().datetime(),
})

export type ComputationSnapshot = z.infer<typeof ComputationSnapshotSchema>
