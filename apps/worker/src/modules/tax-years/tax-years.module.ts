import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { IrisModule } from '../../integrations/iris/iris.module'
import { AuditModule } from '../audit/audit.module'

import { ComputationService } from './computation.service'
import { IrisFilingService } from './iris-filing.service'
import { ReturnPreparationService } from './return-preparation.service'
import { TaxYearsController } from './tax-years.controller'
import { TaxYearsService } from './tax-years.service'
import { WealthStatementService } from './wealth-statement.service'
import { WithholdingService } from './withholding.service'

@Module({
  imports: [DatabaseModule, AuditModule, IrisModule],
  controllers: [TaxYearsController],
  providers: [
    TaxYearsService,
    ComputationService,
    WealthStatementService,
    WithholdingService,
    ReturnPreparationService,
    IrisFilingService,
  ],
  exports: [TaxYearsService, ComputationService],
})
export class TaxYearsModule {}
