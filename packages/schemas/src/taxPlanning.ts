import { z } from 'zod'

import { UuidSchema } from './common'

export const TaxPlanAssumptionSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().max(2000),
})

export const CreateTaxPlanScenarioBodySchema = z.object({
  name: z.string().min(1).max(120),
  assumptions: z.array(TaxPlanAssumptionSchema).default([]),
})

export type CreateTaxPlanScenarioBody = z.infer<typeof CreateTaxPlanScenarioBodySchema>

export const TaxPlanScenarioSchema = z.object({
  id: UuidSchema,
  taxYearFileId: UuidSchema,
  name: z.string(),
  assumptions: z.array(TaxPlanAssumptionSchema),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
  rulesVersion: z.string().nullable(),
  outcomeJson: z.record(z.unknown()).nullable(),
  disclaimerKey: z.literal('taxPlanning.disclaimer'),
  createdAt: z.string().datetime(),
})

export const TaxPlanRejectionSchema = z.object({
  code: z.literal('TAX_PLAN_UNLAWFUL'),
  message: z.string(),
})
