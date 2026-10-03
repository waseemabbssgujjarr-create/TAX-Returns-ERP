import type { z } from 'zod'

import { BankStatementExtractionSchema, validateBankStatement } from './bankStatement'
import { SalaryCertificateExtractionSchema, validateSalaryCertificate } from './salaryCertificate'

export type ExtractionDocumentKind = 'SALARY_CERTIFICATE' | 'BANK_STATEMENT' | 'UNKNOWN'

export interface ExtractionSchemaBundle {
  kind: ExtractionDocumentKind
  zodSchema: z.ZodTypeAny
  validate: (
    data: unknown,
  ) => Array<{ field: string; issue: string; severity: 'error' | 'warning' }>
}

const REGISTRY: Record<ExtractionDocumentKind, ExtractionSchemaBundle | null> = {
  SALARY_CERTIFICATE: {
    kind: 'SALARY_CERTIFICATE',
    zodSchema: SalaryCertificateExtractionSchema,
    validate: (data) => validateSalaryCertificate(data as never),
  },
  BANK_STATEMENT: {
    kind: 'BANK_STATEMENT',
    zodSchema: BankStatementExtractionSchema,
    validate: (data) => validateBankStatement(data as never),
  },
  UNKNOWN: null,
}

export function resolveExtractionKind(input: {
  documentType?: string | null
  category?: string | null
}): ExtractionDocumentKind {
  const type = (input.documentType ?? '').toUpperCase()
  const category = (input.category ?? '').toUpperCase()

  if (type.includes('SALARY') || category === 'SALARY_CERTIFICATE') {
    return 'SALARY_CERTIFICATE'
  }
  if (type.includes('BANK') || category === 'BANK_STATEMENT') {
    return 'BANK_STATEMENT'
  }
  return 'UNKNOWN'
}

export function getExtractionSchemaBundle(
  kind: ExtractionDocumentKind,
): ExtractionSchemaBundle | null {
  return REGISTRY[kind] ?? null
}
