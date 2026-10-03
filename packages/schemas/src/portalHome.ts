import { z } from 'zod'

import { InvoiceSummarySchema } from './billing'
import { UuidSchema } from './common'
import { ComplianceEventSchema } from './complianceOps'

export const PortalHomeSchema = z.object({
  clientId: UuidSchema,
  infoRequests: z.array(ComplianceEventSchema),
  billingVisible: z.boolean(),
  invoices: z.array(InvoiceSummarySchema),
  actions: z.object({
    canUploadDocuments: z.literal(true),
    canViewBilling: z.boolean(),
  }),
})

export type PortalHome = z.infer<typeof PortalHomeSchema>
