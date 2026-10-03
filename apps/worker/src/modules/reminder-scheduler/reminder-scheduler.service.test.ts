import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { PrismaService } from '../../database/prisma.service'

import { ReminderSchedulerService } from './reminder-scheduler.service'

describe('ReminderSchedulerService', () => {
  let service: ReminderSchedulerService
  let prisma: PrismaService
  let prismaRls: PrismaRlsClient
  let reminderQueue: { add: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    reminderQueue = { add: vi.fn().mockResolvedValue(undefined) }

    prisma = {
      firmDirectory: {
        findMany: vi.fn().mockResolvedValue([{ firmId: 'firm-1' }]),
      },
    } as unknown as PrismaService

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'))
    const eventAt = new Date('2026-10-08T12:00:00.000Z')

    prismaRls = {
      withRlsContext: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          complianceEvent: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'evt-1',
                firmId: 'firm-1',
                eventAt,
                reminderSentAt: null,
              },
            ]),
            update: vi.fn().mockResolvedValue({}),
          },
        }
        return fn(tx as never)
      }),
    } as unknown as PrismaRlsClient

    service = new ReminderSchedulerService(prisma, prismaRls, reminderQueue as never)
  })

  it('enqueues reminders for events in T-7 window', async () => {
    await service.checkUpcomingDeadlines()
    vi.useRealTimers()
    expect(reminderQueue.add).toHaveBeenCalledWith(
      'compliance-deadline',
      expect.objectContaining({ complianceEventId: 'evt-1', daysUntil: 7 }),
      expect.any(Object),
    )
  })
})
