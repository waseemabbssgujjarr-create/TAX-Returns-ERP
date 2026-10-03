import { Injectable, Logger } from '@nestjs/common'

import { PrismaDbNull } from '../../database/prisma-json'
import { PrismaRlsClient } from '../../database/prisma-rls.client'

import type { AuditEntry } from './audit-entry.types'

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prismaRls: PrismaRlsClient) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prismaRls.withRlsContext(async (tx) => {
        await tx.auditLog.create({
          data: {
            firmId: entry.firmId,
            userId: entry.userId ?? null,
            action: entry.action,
            resourceType: entry.resourceType ?? null,
            resourceId: entry.resourceId ?? null,
            ipAddress: entry.ipAddress ?? null,
            userAgent: entry.userAgent ?? null,
            before: PrismaDbNull,
            after: entry.payload as object,
          },
        })
      })
    } catch (err) {
      this.logger.error(
        `Audit log insert failed for action ${entry.action}`,
        err instanceof Error ? err.stack : String(err),
      )
    }
  }
}
