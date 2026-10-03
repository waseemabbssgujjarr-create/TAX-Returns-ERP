import { AsyncLocalStorage } from 'node:async_hooks'

import type { Prisma } from '@prisma/client'

export interface RlsIdentity {
  firmId: string
  userId: string
  sessionType: 'staff' | 'portal'
  clientId?: string
}

/** Identity established by JwtAuthGuard + RlsTransactionInterceptor */
export const rlsIdentityStorage = new AsyncLocalStorage<RlsIdentity>()

/** Active Prisma transaction client for nested withRlsContext (IC-1) */
export const rlsTransactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>()
