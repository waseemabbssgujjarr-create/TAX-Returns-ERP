import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { AuditModule } from '../audit/audit.module'
import { TaxYearsModule } from '../tax-years/tax-years.module'

import { TaxPlanningController } from './tax-planning.controller'
import { TaxPlanningService } from './tax-planning.service'

@Module({
  imports: [DatabaseModule, AuditModule, TaxYearsModule],
  controllers: [TaxPlanningController],
  providers: [TaxPlanningService],
})
export class TaxPlanningModule {}
