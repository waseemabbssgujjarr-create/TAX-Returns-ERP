import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from './prisma.service'
import { rlsIdentityStorage, rlsTransactionStorage } from './rls-context.store'

const INV1_ERROR = 'INV-1 violated: no RLS identity context'

async function applyRlsSessionVariables(
  tx: Prisma.TransactionClient,
  identity: {
    firmId: string
    userId: string
    sessionType: 'staff' | 'portal'
    clientId?: string
  },
): Promise<void> {
  // Transaction-local set_config — parameter-safe (no string interpolation)
  await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${identity.firmId}, true)`
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${identity.userId}, true)`
  await tx.$executeRaw`SELECT set_config('app.session_type', ${identity.sessionType}, true)`
  if (identity.clientId) {
    await tx.$executeRaw`SELECT set_config('app.current_client_id', ${identity.clientId}, true)`
  }
}

/** Singleton — request isolation is via AsyncLocalStorage, not Nest request scope. */
@Injectable()
export class PrismaRlsClient {
  constructor(private readonly prisma: PrismaService) {}

  async withRlsContext<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const identity = rlsIdentityStorage.getStore()
    if (!identity) {
      throw new Error(INV1_ERROR)
    }

    const activeTx = rlsTransactionStorage.getStore()
    if (activeTx) {
      return fn(activeTx)
    }

    return this.prisma.$transaction(async (tx) => {
      await applyRlsSessionVariables(tx, identity)
      return rlsTransactionStorage.run(tx, () => fn(tx))
    })
  }

  /**
   * Pre-authentication firm scope (refresh rotation, OTP).
   * Sets firm_id + auth_flow=refresh_rotation so refresh_tokens RLS allows
   * firm-scoped lookup by token hash without a known userId yet.
   */
  async withPreAuthFirmContext<T>(
    firmId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const activeTx = rlsTransactionStorage.getStore()
    if (activeTx) {
      return fn(activeTx)
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`
      // Enables refresh_tokens RLS path for opaque-token rotation (see migration).
      await tx.$executeRaw`SELECT set_config('app.auth_flow', ${'refresh_rotation'}, true)`
      return rlsTransactionStorage.run(tx, () => fn(tx))
    })
  }
}

export { INV1_ERROR }
