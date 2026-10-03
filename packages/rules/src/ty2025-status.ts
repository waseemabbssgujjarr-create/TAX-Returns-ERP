/**
 * TY2025 rule status — explicit inventory of DRAFT/PLACEHOLDER assets.
 *
 * Production computation MUST fail closed against these until a qualified
 * tax professional reviews and supplies a reviewed semver bundle.
 *
 * Insertion path (no code changes required):
 * 1. Replace files under packages/rules/data/2025/ with reviewed JSON.
 * 2. Set index.version / RuleMeta.version to pure semver (e.g. 1.0.0).
 * 3. Set reviewedBy / reviewedOn / sourceFinanceAct to real citations.
 * 4. Remove DRAFT/PLACEHOLDER/PENDING markers from all fields.
 * 5. Verify golden-cases.json (verified: true) — at least 25 cases.
 * 6. loadRules(2025) Zod validation succeeds; compute() no longer returns RULES_DRAFT.
 */

export const TY2025_RULE_STATUS = {
  taxYear: 2025,
  productionReady: false as const,
  bundleVersionDeclared: '0.1.0-DRAFT',
  draftOrPlaceholderFiles: [
    'packages/rules/data/2025/index.json',
    'packages/rules/data/2025/income-tax.json',
    'packages/rules/data/2025/withholding.json',
    'packages/rules/data/2025/deductions.json',
    'packages/rules/data/2025/credits.json',
    'packages/rules/data/2025/deadlines.json',
    'packages/rules/data/2025/golden-cases.json',
    'packages/rules/data/2025/penalties.json',
  ],
  blockers: [
    'index.version uses non-semver DRAFT suffix (Zod rejects load)',
    'All RuleMeta.reviewedBy values are PENDING',
    'income-tax slabs marked ILLUSTRATIVE / PLACEHOLDER',
    'golden-cases verified=false stubs only',
    'sourceFinanceAct not verified against official FBR notification',
  ],
  engineBehavior:
    'compute() returns TaxEngineError RULES_DRAFT when draft markers present; ' +
    'loadRules(2025) throws RulesLoadError until files pass Zod (pure semver + reviewed metadata).',
} as const
