import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { QUEUE_NAMES } from '../../queues/queue-names'

import { ReminderSchedulerService } from './reminder-scheduler.service'

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.REMINDER }),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATION }),
  ],
  providers: [ReminderSchedulerService],
})
export class ReminderSchedulerModule {}
