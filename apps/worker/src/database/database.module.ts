import { Module } from '@nestjs/common'

import { PrismaRlsClient } from './prisma-rls.client'
import { PrismaService } from './prisma.service'
import { RlsTransactionInterceptor } from './rls-transaction.interceptor'

@Module({
  providers: [PrismaService, PrismaRlsClient, RlsTransactionInterceptor],
  exports: [PrismaService, PrismaRlsClient, RlsTransactionInterceptor],
})
export class DatabaseModule {}
