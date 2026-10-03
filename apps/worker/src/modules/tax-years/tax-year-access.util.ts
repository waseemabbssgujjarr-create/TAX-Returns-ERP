import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuthenticatedUser } from '../auth/auth.types'
import { isFirmWideClientAccess } from '../clients/clients.access'

export function assertStaffSession(user: AuthenticatedUser): void {
  if (user.sessionType !== 'staff' || user.sessionState !== 'full') {
    throw new ForbiddenException({ title: 'Staff session required' })
  }
}

export async function assertClientAccess(
  prismaRls: PrismaRlsClient,
  user: AuthenticatedUser,
  clientId: string,
): Promise<void> {
  if (isFirmWideClientAccess(user.role)) return

  await prismaRls.withRlsContext(async (tx) => {
    const access = await tx.clientAccess.findUnique({
      where: { clientId_userId: { clientId, userId: user.userId } },
    })
    if (!access) {
      throw new ForbiddenException({ title: 'No access to this client' })
    }
  })
}

export async function resolveTaxYearFileForStaff(
  prismaRls: PrismaRlsClient,
  user: AuthenticatedUser,
  taxYearFileId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ id: string; clientId: string; firmId: string; taxYear: number }> {
  assertStaffSession(user)

  const run = async (client: Prisma.TransactionClient) => {
    const file = await client.taxYearFile.findFirst({
      where: {
        id: taxYearFileId,
        client: { firmId: user.firmId, isArchived: false },
      },
      select: {
        id: true,
        clientId: true,
        taxYear: true,
        client: { select: { firmId: true } },
      },
    })
    if (!file) {
      throw new NotFoundException({ title: 'Tax year not found' })
    }
    await assertClientAccess(prismaRls, user, file.clientId)
    return {
      id: file.id,
      clientId: file.clientId,
      firmId: file.client.firmId,
      taxYear: file.taxYear,
    }
  }

  if (tx) return run(tx)
  return prismaRls.withRlsContext(run)
}
