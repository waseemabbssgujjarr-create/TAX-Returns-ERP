import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'

import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'
import { PAYMENT_PROVIDER, StubPaymentProvider } from './payment.provider'

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [BillingController],
  providers: [BillingService, { provide: PAYMENT_PROVIDER, useClass: StubPaymentProvider }],
  exports: [BillingService, PAYMENT_PROVIDER],
})
export class BillingModule {}
