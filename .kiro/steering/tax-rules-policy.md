---
inclusion: always
---

# TaxDesk PK — Tax Rules Policy

> This policy governs how tax rules are stored, loaded, used, and updated. Violating these rules introduces legal and
> correctness risk.

## The Golden Rule

**Never hard-code rates, slabs, thresholds, percentages, dates, section numbers, or any other tax value directly in
application code.**

All such values live exclusively in `/packages/rules/<taxYear>/`. Application code loads them at runtime.

## Rule File Structure

```
packages/rules/
├── schema.ts               # Zod schema that every rule file must satisfy
├── loader.ts               # loadRules(taxYear): RulesBundle — validates on load
├── 2024/
│   ├── index.json          # Master manifest for TY2024
│   ├── income-tax.json     # Slabs, rates, heads of income
│   ├── withholding.json    # Section-wise withholding rates (filer / non-filer)
│   ├── deductions.json     # Eligible deductions, limits, conditions
│   ├── credits.json        # Tax credits, eligibility, limits
│   ├── deadlines.json      # Filing, advance tax, and payment deadlines
│   └── golden-cases.json   # ≥ 25 verified test cases for this tax year
└── 2025/
    └── ...                 # Same structure
```

## Required Metadata on Every Rule Entry

```jsonc
{
  "id": "income_tax_slab_01",
  "effectiveFrom": "2024-07-01",
  "effectiveTo": "2025-06-30",
  "sourceReference": "Finance Act 2024, Second Schedule, Part I",
  "reviewedBy": "CA Reviewer Name",
  "reviewedOn": "2024-08-15",
  "version": "1.0.0",
  // ... actual rule data
}
```

## Computation Engine Contract

- The engine is a **pure function**: `compute(inputs: TaxInputs, rules: RulesBundle): ComputationResult`.
- It has **no side effects**: no DB calls, no HTTP, no logging, no randomness.
- It returns an `explanationTree` alongside every result — a structured breakdown of how every figure was derived, with
  references to the specific rule IDs used.
- It must be callable identically in the browser (live preview) and on the server (authoritative result).
- If a required rule is missing or fails validation, the engine must **throw a typed error** — never fall back to a
  guess or default.

## Missing Rules Behaviour

- If `loadRules(taxYear)` cannot find or validate the rule bundle, the UI **must show** "Tax rules for [Tax Year] are not
  yet available" and block computation.
- Never show a computed figure derived from incomplete rules.
- Never silently use a prior year's rules as a proxy.

## Golden Test Cases

- Every tax year must ship with **at least 25 golden test cases** in `golden-cases.json`.
- Each case has: inputs, expected output per line item, expected total tax, source notes, verified-by field.
- These cases must be reviewed and signed off by a qualified tax professional before release.
- The CI pipeline runs golden tests on every commit touching `packages/rules/` or `packages/tax-engine/`.
- A release is blocked if any golden test fails.

## Tax Optimization / Advisor

- The Optimization Advisor may only suggest options that are **registered in the rules library** with:
  - Eligibility conditions
  - Documentary evidence requirements
  - Applicable limits
  - Risk level
  - Source reference
- It must never suggest or imply: concealing income, backdating transactions, using fake documents, misclassifying
  income, or any other form of tax evasion.
- Every suggestion card must display: the rule reference, eligibility conditions, required evidence, and a disclaimer.

## Money Precision

- All tax amounts are computed and stored as **integer paisa** (PKR × 100).
- Use `bigint` or a decimal library — never `number` or floating-point arithmetic on tax figures.
- Rounding rules must be stated explicitly per computation step in the rule file (e.g., "round down to nearest rupee",
  "round to nearest paisa").
- Display formatting (`Rs 1,250,000`) is a presentation-layer concern only.

## Rule Versioning & Updates

- Rule changes require a **version bump** (`version` field in the rule entry).
- Breaking changes (slab structure, new fields) require a new tax year directory.
- Each computation result **snapshots the rules version** used, so old results remain reproducible.
- The rules library viewer in Settings must show version history, source references, and review sign-off status.

## Annual Update Process

1. Finance Act is passed → tax professional reviews and updates rule files.
2. Rule files updated with new `version`, `sourceReference`, `reviewedBy`, `reviewedOn`.
3. Golden test cases updated or added for the new year.
4. CI runs all tests; golden cases pass.
5. A qualified reviewer signs off before the update ships to production.
6. Clients are notified of updated rules.

## Disclaimer Requirement

Every page that shows a computed tax figure must include a visible disclaimer:

> "Figures are estimates based on the information entered and the rules library. They require review by a qualified tax
> professional before reliance or filing."
