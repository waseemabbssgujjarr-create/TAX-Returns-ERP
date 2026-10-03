import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'

import { PortalController } from './portal.controller'
import { PortalService } from './portal.service'

@Module({
  imports: [DatabaseModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
