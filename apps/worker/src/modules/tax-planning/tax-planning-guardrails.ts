const UNLAWFUL_PATTERNS: RegExp[] = [
  /hide\s+income/i,
  /conceal/i,
  /under[\s-]?report/i,
  /off[\s-]?the[\s-]?books/i,
  /fake\s+expense/i,
  /show\s+less\s+income/i,
  /آمدنی\s*چھپ/i,
  /چھپ[\s-]?انا/i,
  /کم\s*دکھ/i,
]

export type TaxPlanGuardrailResult =
  | { ok: true }
  | { ok: false; code: 'TAX_PLAN_UNLAWFUL'; message: string }

export function validateTaxPlanLawfulText(text: string): TaxPlanGuardrailResult {
  const normalised = text.trim()
  if (!normalised) return { ok: true }

  for (const pattern of UNLAWFUL_PATTERNS) {
    if (pattern.test(normalised)) {
      return {
        ok: false,
        code: 'TAX_PLAN_UNLAWFUL',
        message:
          'This scenario was rejected because it appears to involve concealing or misreporting income. TaxDesk only supports lawful planning comparisons.',
      }
    }
  }

  return { ok: true }
}

export function validateTaxPlanAssumptions(
  assumptions: Array<{ key: string; value: string }>,
): TaxPlanGuardrailResult {
  for (const item of assumptions) {
    const check = validateTaxPlanLawfulText(`${item.key} ${item.value}`)
    if (!check.ok) return check
  }
  return { ok: true }
}
