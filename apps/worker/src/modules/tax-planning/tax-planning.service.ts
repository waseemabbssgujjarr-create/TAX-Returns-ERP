import { randomUUID } from 'node:crypto'

import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import { TaxComputationStatus } from '@prisma/client'
import { loadRules } from '@taxdesk/rules'
import type { CreateTaxPlanScenarioBody } from '@taxdesk/schemas'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../auth/auth.types'
import { ComputationService } from '../tax-years/computation.service'
import { resolveTaxYearFileForStaff } from '../tax-years/tax-year-access.util'

import { validateTaxPlanAssumptions } from './tax-planning-guardrails'

const PLANNING_WARNING = {
  code: 'NOT_LEGAL_ADVICE',
  message:
    'Scenario output is illustrative only — not legal or tax advice. Verify with a qualified professional before acting.',
}

@Injectable()
export class TaxPlanningService {
  constructor(
    private readonly prismaRls: PrismaRlsClient,
    private readonly computation: ComputationService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, taxYearFileId: string) {
    await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    return this.prismaRls.withRlsContext(async (tx) => {
      const rows = await tx.taxPlanScenario.findMany({
        where: { taxYearFileId },
        orderBy: { createdAt: 'desc' },
      })
      return { items: rows.map((r) => this.toDto(r)) }
    })
  }

  async create(user: AuthenticatedUser, taxYearFileId: string, body: CreateTaxPlanScenarioBody) {
    const guard = validateTaxPlanAssumptions(body.assumptions)
    if (!guard.ok) {
      throw new UnprocessableEntityException({
        title: guard.message,
        code: guard.code,
      })
    }

    const file = await resolveTaxYearFileForStaff(this.prismaRls, user, taxYearFileId)
    const rules = loadRules(file.taxYear)
    const computeResult = await this.computation.computeForTaxYearFile(user, taxYearFileId)

    const warnings = [PLANNING_WARNING]
    if (computeResult.status !== TaxComputationStatus.SUCCESS) {
      warnings.push({
        code: 'COMPUTE_NOT_SUCCESS',
        message: 'Baseline computation did not succeed; scenario comparison may be incomplete.',
      })
    }

    const created = await this.prismaRls.withRlsContext(async (tx) =>
      tx.taxPlanScenario.create({
        data: {
          id: randomUUID(),
          taxYearFileId,
          firmId: file.firmId,
          name: body.name,
          assumptions: body.assumptions,
          warnings,
          rulesVersion: rules.version,
          outcomeJson: {
            baselineStatus: computeResult.status,
            taxPayablePaisa: computeResult.taxPayablePaisa,
            netTaxPaisa: computeResult.netTaxPaisa,
          },
          createdById: user.userId,
        },
      }),
    )

    await this.audit.log({
      firmId: user.firmId,
      userId: user.userId,
      action: 'tax_plan_scenario.create',
      resourceType: 'tax_plan_scenario',
      resourceId: created.id,
      payload: { taxYearFileId, rulesVersion: rules.version },
    })

    return this.toDto(created)
  }

  private toDto(row: {
    id: string
    taxYearFileId: string
    name: string
    assumptions: unknown
    warnings: unknown
    rulesVersion: string | null
    outcomeJson: unknown
    createdAt: Date
  }) {
    return {
      id: row.id,
      taxYearFileId: row.taxYearFileId,
      name: row.name,
      assumptions: Array.isArray(row.assumptions) ? row.assumptions : [],
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
      rulesVersion: row.rulesVersion,
      outcomeJson:
        row.outcomeJson && typeof row.outcomeJson === 'object'
          ? (row.outcomeJson as Record<string, unknown>)
          : null,
      disclaimerKey: 'taxPlanning.disclaimer' as const,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
