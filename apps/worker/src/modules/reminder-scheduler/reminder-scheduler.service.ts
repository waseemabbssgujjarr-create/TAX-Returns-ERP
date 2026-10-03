import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import type { Queue } from 'bullmq'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { PrismaService } from '../../database/prisma.service'
import { QUEUE_NAMES } from '../../queues/queue-names'
import { PRE_AUTH_USER_ID, withStaffBootstrapContext } from '../auth/rls-bootstrap.util'

const REMINDER_WINDOWS_DAYS = [14, 7, 3, 1] as const

/**
 * Runs scheduled jobs to generate and dispatch deadline reminders.
 * Queries compliance_events — never hard-codes statutory tax dates here.
 */
@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaRls: PrismaRlsClient,
    @InjectQueue(QUEUE_NAMES.REMINDER)
    private readonly reminderQueue: Queue,
  ) {}

  @Cron('0 2 * * *', { timeZone: 'Asia/Karachi' })
  async checkUpcomingDeadlines(): Promise<void> {
    this.logger.log('Checking upcoming compliance event deadlines...')

    const firms = await this.prisma.firmDirectory.findMany({
      where: { isActive: true },
      select: { firmId: true },
    })

    const now = new Date()
    const end = new Date(now)
    end.setUTCDate(end.getUTCDate() + Math.max(...REMINDER_WINDOWS_DAYS))

    for (const { firmId } of firms) {
      await withStaffBootstrapContext(firmId, PRE_AUTH_USER_ID, async () => {
        await this.prismaRls.withRlsContext(async (tx) => {
          const dueEvents = await tx.complianceEvent.findMany({
            where: {
              firmId,
              eventAt: { gte: now, lte: end },
              reminderSentAt: null,
            },
            orderBy: { eventAt: 'asc' },
            take: 200,
          })

          for (const event of dueEvents) {
            const daysUntil = Math.ceil(
              (event.eventAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            )
            if (
              !REMINDER_WINDOWS_DAYS.includes(daysUntil as (typeof REMINDER_WINDOWS_DAYS)[number])
            ) {
              continue
            }

            await this.reminderQueue.add(
              'compliance-deadline',
              {
                firmId,
                complianceEventId: event.id,
                daysUntil,
              },
              { jobId: `${event.id}:T-${daysUntil}` },
            )

            await tx.complianceEvent.update({
              where: { id: event.id },
              data: { reminderSentAt: now },
            })
          }
        })
      })
    }

    this.logger.log('Compliance reminder scan complete')
  }
}
