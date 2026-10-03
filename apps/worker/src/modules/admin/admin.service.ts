import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import type {
  AdminUserSummary,
  FirmSettings,
  ListAuditLogsQuery,
  PatchFirmSettingsBody,
  PatchUserRoleBody,
} from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'
import { assertStaffSession } from '../tax-years/tax-year-access.util'

@Injectable()
export class AdminService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly audit: AuditService,
  ) {}

  async listUsers(user: AuthenticatedUser): Promise<{ items: AdminUserSummary[] }> {
    this.assertAdminRead(user)
    return this.prismaRls.withRlsContext(async (tx) => {
      const rows = await tx.user.findMany({
        where: { firmId: user.firmId, role: { not: UserRole.CLIENT } },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          totpEnabled: true,
          lastLoginAt: true,
          lastActivityAt: true,
          createdAt: true,
        },
      })
      return {
        items: rows.map((r) => ({
          ...r,
          lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
          lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      }
    })
  }

  async patchUserRole(
    actor: AuthenticatedUser,
    targetUserId: string,
    body: PatchUserRoleBody,
  ): Promise<AdminUserSummary> {
    this.assertOwnerWrite(actor)
    if (targetUserId === actor.userId && body.role !== UserRole.OWNER) {
      throw new UnprocessableEntityException({
        title: 'Cannot demote your own owner role',
      })
    }

    const updated = await this.prismaRls.withRlsContext(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: targetUserId, firmId: actor.firmId, role: { not: UserRole.CLIENT } },
      })
      if (!existing) {
        throw new NotFoundException({ title: 'User not found' })
      }
      if (existing.role === UserRole.OWNER && body.role !== UserRole.OWNER) {
        const ownerCount = await tx.user.count({
          where: { firmId: actor.firmId, role: UserRole.OWNER, isActive: true },
        })
        if (ownerCount <= 1) {
          throw new UnprocessableEntityException({
            title: 'Firm must retain at least one active owner',
          })
        }
      }
      return tx.user.update({
        where: { id: targetUserId },
        data: { role: body.role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          totpEnabled: true,
          lastLoginAt: true,
          lastActivityAt: true,
          createdAt: true,
        },
      })
    })

    await this.audit.log({
      firmId: actor.firmId,
      userId: actor.userId,
      action: 'admin.user.role_update',
      resourceType: 'user',
      resourceId: targetUserId,
      payload: { targetUserId, role: body.role },
    })

    return {
      ...updated,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      lastActivityAt: updated.lastActivityAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    }
  }

  async listSessions(user: AuthenticatedUser) {
    this.assertAdminRead(user)
    const now = new Date()
    return this.prismaRls.withRlsContext(async (tx) => {
      const rows = await tx.refreshToken.findMany({
        where: { firmId: user.firmId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          userId: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          user: { select: { email: true, name: true } },
        },
      })
      return {
        items: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          userEmail: r.user.email,
          userName: r.user.name,
          userAgent: r.userAgent,
          ipAddress: r.ipAddress,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
          revokedAt: r.revokedAt?.toISOString() ?? null,
          isActive: !r.revokedAt && r.expiresAt > now,
        })),
      }
    })
  }

  async revokeSession(actor: AuthenticatedUser, sessionId: string, reason?: string) {
    this.assertOwnerWrite(actor)
    const now = new Date()
    await this.prismaRls.withRlsContext(async (tx) => {
      const token = await tx.refreshToken.findFirst({
        where: { id: sessionId, firmId: actor.firmId },
      })
      if (!token) {
        throw new NotFoundException({ title: 'Session not found' })
      }
      if (token.revokedAt) {
        return
      }
      await tx.refreshToken.update({
        where: { id: sessionId },
        data: { revokedAt: now },
      })
    })

    await this.audit.log({
      firmId: actor.firmId,
      userId: actor.userId,
      action: 'admin.session.revoke',
      resourceType: 'refresh_token',
      resourceId: sessionId,
      payload: { reason: reason ?? 'owner_revoke' },
    })

    return { revoked: true as const }
  }

  async listAuditLogs(user: AuthenticatedUser, query: ListAuditLogsQuery) {
    this.assertAdminRead(user)
    const where = {
      firmId: user.firmId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' as const } } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    }

    return this.prismaRls.withRlsContext(async (tx) => {
      const [total, rows] = await Promise.all([
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            userId: true,
            action: true,
            resourceType: true,
            resourceId: true,
            ipAddress: true,
            createdAt: true,
            after: true,
            user: { select: { name: true } },
          },
        }),
      ])

      return {
        items: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          userName: r.user?.name ?? null,
          action: r.action,
          resourceType: r.resourceType,
          resourceId: r.resourceId,
          ipAddress: r.ipAddress,
          createdAt: r.createdAt.toISOString(),
          after: (r.after as Record<string, unknown> | null) ?? null,
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      }
    })
  }

  async getFirmSettings(user: AuthenticatedUser): Promise<FirmSettings> {
    this.assertAdminRead(user)
    return this.prismaRls.withRlsContext(async (tx) => {
      const firm = await tx.firm.findUnique({
        where: { id: user.firmId },
        select: { idleTimeoutMinutes: true },
      })
      if (!firm) {
        throw new NotFoundException({ title: 'Firm not found' })
      }
      return { idleTimeoutMinutes: firm.idleTimeoutMinutes }
    })
  }

  async patchFirmSettings(
    actor: AuthenticatedUser,
    body: PatchFirmSettingsBody,
  ): Promise<FirmSettings> {
    this.assertOwnerWrite(actor)
    const updated = await this.prismaRls.withRlsContext(async (tx) =>
      tx.firm.update({
        where: { id: actor.firmId },
        data: { idleTimeoutMinutes: body.idleTimeoutMinutes },
        select: { idleTimeoutMinutes: true },
      }),
    )

    await this.audit.log({
      firmId: actor.firmId,
      userId: actor.userId,
      action: 'admin.firm_settings.update',
      resourceType: 'firm',
      resourceId: actor.firmId,
      payload: body,
    })

    return updated
  }

  private assertAdminRead(user: AuthenticatedUser): void {
    assertStaffSession(user)
    if (user.role !== UserRole.OWNER && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException({ title: 'Admin access required' })
    }
  }

  private assertOwnerWrite(user: AuthenticatedUser): void {
    assertStaffSession(user)
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException({ title: 'Owner access required' })
    }
  }
}
