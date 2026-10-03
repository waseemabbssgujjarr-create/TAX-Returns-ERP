import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { TaxComputationStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { loadRules, RulesLoadError } from '@taxdesk/rules'
import { compute } from '@taxdesk/tax-engine'
import type { TaxInputs, ExplanationNode } from '@taxdesk/tax-engine'

import { PrismaRlsClient } from '../../database/prisma-rls.client'
import type { AuthenticatedUser } from '../auth/auth.types'

const DRAFT_VERSION_MARKERS = ['DRAFT', 'PLACEHOLDER', 'PENDING']

export interface ComputationRunResult {
  snapshotId: string
  status: TaxComputationStatus
  rulesVersion: string | null
  warnings: Array<{ code: string; message: string }>
  validationErrors: Array<{ code: string; message: string }>
  breakdown: Array<{
    labelKey: string
    valuePaisa: string
    ruleIds: string[]
    note?: string
    children?: ComputationRunResult['breakdown']
  }>
  taxPayablePaisa: string | null
  netTaxPaisa: string | null
  taxableIncomePaisa: string | null
}

function isDraftRulesVersion(version: string): boolean {
  const upper = version.toUpperCase()
  return DRAFT_VERSION_MARKERS.some((m) => upper.includes(m))
}

function serializeBreakdown(nodes: ExplanationNode[]): ComputationRunResult['breakdown'] {
  return nodes.map((n) => {
    const node: ComputationRunResult['breakdown'][number] = {
      labelKey: n.labelKey,
      valuePaisa: n.value.toString(),
      ruleIds: n.ruleIds,
    }
    if (n.note) node.note = n.note
    if (n.children) node.children = serializeBreakdown(n.children)
    return node
  })
}

function emptySectionsInput(taxYear: number): TaxInputs {
  return {
    taxYear,
    clientType: 'INDIVIDUAL',
    filerStatus: 'FILER',
    residencyStatus: 'RESIDENT',
    income: [],
    deductions: [],
    credits: [],
    withholding: [],
  }
}

@Injectable()
export class ComputationService {
  constructor(private readonly prismaRls: PrismaRlsClient) {}

  async computeForTaxYearFile(
    user: AuthenticatedUser,
    taxYearFileId: string,
    inputsOverride?: TaxInputs,
  ): Promise<ComputationRunResult> {
    return this.prismaRls.withRlsContext(async (tx) => {
      const file = await tx.taxYearFile.findFirst({
        where: {
          id: taxYearFileId,
          client: { firmId: user.firmId, isArchived: false },
        },
        include: { client: true },
      })

      if (!file) {
        throw new Error('Tax year file not found')
      }

      const warnings: Array<{ code: string; message: string }> = []
      const validationErrors: Array<{ code: string; message: string }> = []

      let rulesVersion: string | null = null
      let status: TaxComputationStatus = TaxComputationStatus.VALIDATION_FAILED
      let resultJson: Prisma.InputJsonValue | undefined
      let breakdown: ComputationRunResult['breakdown'] = []
      let taxPayablePaisa: string | null = null
      let netTaxPaisa: string | null = null
      let taxableIncomePaisa: string | null = null

      try {
        const rules = loadRules(file.taxYear)
        rulesVersion = rules.version

        if (isDraftRulesVersion(rules.version)) {
          validationErrors.push({
            code: 'RULES_DRAFT',
            message: `Tax rules for ${file.taxYear} are marked DRAFT (${rules.version}). Computation is blocked until rules are verified.`,
          })
          status = TaxComputationStatus.RULES_UNAVAILABLE
        } else {
          const inputs = inputsOverride ?? emptySectionsInput(file.taxYear)
          if (inputs.taxYear !== file.taxYear) {
            validationErrors.push({
              code: 'TAX_YEAR_MISMATCH',
              message: 'Inputs tax year does not match the tax year file.',
            })
          } else {
            const outcome = compute(inputs, rules)
            if (outcome.isErr()) {
              validationErrors.push({
                code: outcome.error.code,
                message: outcome.error.message,
              })
              status = TaxComputationStatus.ENGINE_ERROR
            } else {
              const result = outcome.value
              status = TaxComputationStatus.SUCCESS
              taxPayablePaisa = result.taxPayable.toString()
              netTaxPaisa = result.netTax.toString()
              taxableIncomePaisa = result.taxableIncome.toString()
              breakdown = serializeBreakdown(result.explanationTree)

              const slabNote = result.explanationTree.find((n) =>
                n.children?.some((c) => c.labelKey === 'engine.slabs.notImplemented'),
              )
              if (slabNote) {
                warnings.push({
                  code: 'ENGINE_INCOMPLETE',
                  message:
                    'Tax slab computation is not fully implemented — figures may not reflect final liability.',
                })
              }

              resultJson = JSON.parse(
                JSON.stringify(result, (_k, v: unknown) =>
                  typeof v === 'bigint' ? v.toString() : v,
                ),
              ) as Prisma.InputJsonValue
            }
          }
        }
      } catch (err) {
        if (err instanceof RulesLoadError) {
          validationErrors.push({
            code: 'RULES_NOT_AVAILABLE',
            message: err.message,
          })
          status = TaxComputationStatus.RULES_UNAVAILABLE
        } else {
          validationErrors.push({
            code: 'COMPUTATION_ERROR',
            message: err instanceof Error ? err.message : String(err),
          })
          status = TaxComputationStatus.ENGINE_ERROR
        }
      }

      const snapshotId = randomUUID()
      await tx.taxComputationSnapshot.create({
        data: {
          id: snapshotId,
          taxYearFileId: file.id,
          firmId: user.firmId,
          status,
          rulesVersion,
          ...(resultJson !== undefined ? { resultJson } : {}),
          warnings: warnings as Prisma.InputJsonValue,
          validationErrors: validationErrors as Prisma.InputJsonValue,
          createdById: user.userId,
        },
      })

      if (status === TaxComputationStatus.SUCCESS && rulesVersion) {
        await tx.taxYearFile.update({
          where: { id: file.id },
          data: { rulesVersion },
        })
      }

      return {
        snapshotId,
        status,
        rulesVersion,
        warnings,
        validationErrors,
        breakdown,
        taxPayablePaisa,
        netTaxPaisa,
        taxableIncomePaisa,
      }
    })
  }
}
