import { z } from 'zod'

import { UuidSchema } from './common'

export const ExportArtifactTypeSchema = z.enum([
  'TAX_SUMMARY_PDF',
  'RETURN_WORKSHEET',
  'WEALTH_STATEMENT',
  'AUDIT_LOG_CSV',
])

export const ExportArtifactStatusSchema = z.enum(['PENDING', 'READY', 'FAILED'])

export const CreateExportBodySchema = z.object({
  exportType: ExportArtifactTypeSchema,
  taxYearFileId: UuidSchema,
  locale: z.enum(['en', 'ur']).default('en'),
})

export type CreateExportBody = z.infer<typeof CreateExportBodySchema>

export const ExportArtifactSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  clientId: UuidSchema.nullable(),
  taxYearFileId: UuidSchema.nullable(),
  exportType: ExportArtifactTypeSchema,
  status: ExportArtifactStatusSchema,
  mimeType: z.string().nullable(),
  locale: z.enum(['en', 'ur']),
  rulesVersion: z.string().nullable(),
  rulesState: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
})

export const SignedExportDownloadSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  artifact: ExportArtifactSchema,
})
