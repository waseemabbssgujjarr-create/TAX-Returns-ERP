import { z } from 'zod'

import { IsoDateSchema, PaginationQuerySchema, UuidSchema } from './common'

export const UserRoleSchema = z.enum(['OWNER', 'MANAGER', 'ASSOCIATE', 'REVIEWER', 'CLIENT'])

export const AdminUserSummarySchema = z.object({
  id: UuidSchema,
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  isActive: z.boolean(),
  totpEnabled: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  lastActivityAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>

export const AdminUsersListSchema = z.object({
  items: z.array(AdminUserSummarySchema),
})

export const PatchUserRoleBodySchema = z.object({
  role: z.enum(['OWNER', 'MANAGER', 'ASSOCIATE', 'REVIEWER']),
})

export type PatchUserRoleBody = z.infer<typeof PatchUserRoleBodySchema>

export const AdminSessionSummarySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  userEmail: z.string().email(),
  userName: z.string(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
})

export type AdminSessionSummary = z.infer<typeof AdminSessionSummarySchema>

export const AdminSessionsListSchema = z.object({
  items: z.array(AdminSessionSummarySchema),
})

export const RevokeSessionBodySchema = z.object({
  reason: z.string().max(200).optional(),
})

export type RevokeSessionBody = z.infer<typeof RevokeSessionBodySchema>

export const ListAuditLogsQuerySchema = PaginationQuerySchema.extend({
  userId: UuidSchema.optional(),
  action: z.string().max(120).optional(),
  resourceType: z.string().max(80).optional(),
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
})

export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>

export const AuditLogEntrySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema.nullable(),
  userName: z.string().nullable(),
  action: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
  after: z.record(z.unknown()).nullable(),
})

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>

export const PaginatedAuditLogsSchema = z.object({
  items: z.array(AuditLogEntrySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const FirmSettingsSchema = z.object({
  idleTimeoutMinutes: z.number().int().min(0).max(480),
})

export type FirmSettings = z.infer<typeof FirmSettingsSchema>

export const PatchFirmSettingsBodySchema = z.object({
  idleTimeoutMinutes: z.number().int().min(0).max(480),
})

export type PatchFirmSettingsBody = z.infer<typeof PatchFirmSettingsBodySchema>
