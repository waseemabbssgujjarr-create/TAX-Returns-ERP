import { describe, expect, it } from 'vitest'

import { validateTaxPlanAssumptions, validateTaxPlanLawfulText } from './tax-planning-guardrails'

describe('tax-planning guardrails', () => {
  it('allows lawful assumptions', () => {
    expect(validateTaxPlanLawfulText('Increase Zakat deduction within limits')).toEqual({
      ok: true,
    })
  })

  it('rejects conceal income patterns', () => {
    const result = validateTaxPlanLawfulText('hide income in cash')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('TAX_PLAN_UNLAWFUL')
    }
  })

  it('checks all assumption fields', () => {
    const result = validateTaxPlanAssumptions([{ key: 'note', value: 'under-report salary' }])
    expect(result.ok).toBe(false)
  })
})
