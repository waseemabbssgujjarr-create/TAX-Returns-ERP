import { z } from 'zod'

import { UuidSchema } from './common'
import { ReturnPrepReviewStatusSchema } from './returnPrep'
import { TaxYearStatusSchema } from './taxYears'

export const AnalyticsUpcomingDeadlineSchema = z.object({
  kind: z.enum(['compliance_event', 'tax_year_due', 'notice']),
  title: z.string(),
  dueAt: z.string().datetime(),
  clientId: UuidSchema.nullable(),
  resourceId: UuidSchema,
})

export type AnalyticsUpcomingDeadline = z.infer<typeof AnalyticsUpcomingDeadlineSchema>

export const AnalyticsStaffWorkloadSchema = z.object({
  userId: UuidSchema.nullable(),
  name: z.string(),
  openTaxYears: z.number().int().nonnegative(),
  openNotices: z.number().int().nonnegative(),
})

export type AnalyticsStaffWorkload = z.infer<typeof AnalyticsStaffWorkloadSchema>

export const AnalyticsOverviewSchema = z.object({
  activeClients: z.number().int().nonnegative(),
  taxYearByStatus: z.record(TaxYearStatusSchema, z.number().int().nonnegative()),
  returnPrepByStatus: z.record(ReturnPrepReviewStatusSchema, z.number().int().nonnegative()),
  pendingDocuments: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  upcomingDeadlinesCount: z.number().int().nonnegative(),
  upcomingDeadlines: z.array(AnalyticsUpcomingDeadlineSchema),
  openNotices: z.number().int().nonnegative(),
  invoices: z.object({
    totalOutstandingPaisa: z.string(),
    totalCollectedPaisa: z.string(),
    countByStatus: z.record(z.string(), z.number().int().nonnegative()),
  }),
  staffWorkload: z.array(AnalyticsStaffWorkloadSchema),
})

export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>
