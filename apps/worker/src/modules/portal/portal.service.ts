import { ForbiddenException, Injectable } from '@nestjs/common'
import { ComplianceEventKind } from '@prisma/client'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuthenticatedUser } from '../auth/auth.types'

@Injectable()
export class PortalService {
  constructor(private readonly prismaRls: PrismaRlsClient) {}

  private assertPortal(user: AuthenticatedUser): string {
    if (user.sessionType !== 'portal' || user.sessionState !== 'full' || !user.clientId) {
      throw new ForbiddenException({ title: 'Portal session required' })
    }
    return user.clientId
  }

  async getHome(user: AuthenticatedUser) {
    const clientId = this.assertPortal(user)

    return this.prismaRls.withRlsContext(async (tx) => {
      const [infoRequests, invoices] = await Promise.all([
        tx.complianceEvent.findMany({
          where: {
            firmId: user.firmId,
            clientId,
            kind: ComplianceEventKind.INFO_REQUEST,
          },
          orderBy: { eventAt: 'asc' },
          take: 20,
        }),
        tx.invoice.findMany({
          where: {
            firmId: user.firmId,
            clientId,
            visibleToClient: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

      const billingVisible = invoices.length > 0

      return {
        clientId,
        infoRequests: infoRequests.map((e) => ({
          id: e.id,
          clientId: e.clientId,
          taxYearFileId: e.taxYearFileId,
          kind: e.kind,
          title: e.title,
          eventAt: e.eventAt.toISOString(),
          reminderSentAt: e.reminderSentAt?.toISOString() ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
        billingVisible,
        invoices: invoices.map((inv) => ({
          id: inv.id,
          clientId: inv.clientId,
          invoiceNumber: inv.invoiceNumber,
          amountPaisa: inv.amountPaisa.toString(),
          balancePaisa: inv.balancePaisa.toString(),
          status: inv.status,
          visibleToClient: inv.visibleToClient,
          dueDate: inv.dueDate?.toISOString() ?? null,
          createdAt: inv.createdAt.toISOString(),
        })),
        actions: {
          canUploadDocuments: true as const,
          canViewBilling: billingVisible,
        },
      }
    })
  }
}
