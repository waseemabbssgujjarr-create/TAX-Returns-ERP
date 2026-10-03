import { TaxComputationStatus, UserRole } from '@prisma/client'
import { loadRules } from '@taxdesk/rules'
import { compute } from '@taxdesk/tax-engine'
import { ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuthenticatedUser } from '../auth/auth.types'

import { ComputationService } from './computation.service'

vi.mock('@taxdesk/rules', () => ({
  loadRules: vi.fn(),
  RulesLoadError: class RulesLoadError extends Error {
    constructor(
      public taxYear: number,
      message: string,
    ) {
      super(message)
    }
  },
}))

vi.mock('@taxdesk/tax-engine', () => ({
  compute: vi.fn(),
}))

describe('ComputationService', () => {
  let service: ComputationService
  let prismaRls: PrismaRlsClient
  let withRlsContextMock: ReturnType<typeof vi.fn>

  const user: AuthenticatedUser = {
    userId: 'u-1',
    firmId: 'firm-1',
    role: UserRole.OWNER,
    sessionState: 'full',
    sessionType: 'staff',
    jti: 'j',
  }

  beforeEach(() => {
    vi.mocked(loadRules).mockReset()
    vi.mocked(compute).mockReset()

    withRlsContextMock = vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        taxYearFile: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'tyf-1',
            taxYear: 2025,
            client: { firmId: 'firm-1' },
          }),
          update: vi.fn(),
        },
        taxComputationSnapshot: {
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return fn(tx as never)
    })

    prismaRls = {
      withRlsContext: withRlsContextMock,
    } as unknown as PrismaRlsClient

    service = new ComputationService(prismaRls)
  })

  it('blocks DRAFT rules with RULES_UNAVAILABLE', async () => {
    vi.mocked(loadRules).mockReturnValue({
      taxYear: 2025,
      version: '0.1.0-DRAFT',
      index: {},
      incomeTax: {},
      withholding: {},
      deductions: {},
      credits: {},
      deadlines: {},
    } as never)

    const result = await service.computeForTaxYearFile(user, 'tyf-1')

    expect(result.status).toBe(TaxComputationStatus.RULES_UNAVAILABLE)
    expect(result.validationErrors.some((e) => e.code === 'RULES_DRAFT')).toBe(true)
    expect(compute).not.toHaveBeenCalled()
  })

  it('persists SUCCESS snapshot when rules and engine succeed', async () => {
    vi.mocked(loadRules).mockReturnValue({
      taxYear: 2025,
      version: '1.0.0',
      index: {},
      incomeTax: {},
      withholding: {},
      deductions: {},
      credits: {},
      deadlines: {},
    } as never)

    vi.mocked(compute).mockReturnValue(
      ok({
        taxYear: 2025,
        rulesVersion: '1.0.0',
        grossIncome: 0n,
        taxableIncome: 0n,
        grossTax: 0n,
        rebates: 0n,
        taxCredits: 0n,
        netTax: 0n,
        adjustableWithholding: 0n,
        finalWithholding: 0n,
        advanceTaxPaid: 0n,
        taxPayable: 0n,
        minimumTax: 0n,
        explanationTree: [],
        inputsSnapshot: {} as never,
      }),
    )

    const result = await service.computeForTaxYearFile(user, 'tyf-1')

    expect(result.status).toBe(TaxComputationStatus.SUCCESS)
    expect(result.rulesVersion).toBe('1.0.0')
  })
})
