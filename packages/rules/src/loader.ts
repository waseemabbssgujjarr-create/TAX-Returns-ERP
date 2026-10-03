import { readFileSync } from 'fs'
import path from 'path'

import {
  RulesIndexSchema,
  IncomeTaxRulesSchema,
  WithholdingRulesSchema,
  DeductionsRulesSchema,
  CreditsRulesSchema,
  DeadlinesRulesSchema,
  PenaltyRulesSchema,
} from './schema'
import type { RulesBundle } from './types'
import { RulesLoadError } from './types'

const RULES_BASE_DIR = path.join(__dirname, '..', 'data')

/** In-process cache — rules are immutable per tax year */
const cache = new Map<number, RulesBundle>()

/**
 * Loads and validates the rules bundle for a given tax year.
 *
 * Rules:
 * - Validates every file against its Zod schema at load time.
 * - Throws RulesLoadError (never returns partial data) if anything is missing or invalid.
 * - Caches the result in memory — safe because rules never mutate at runtime.
 * - Call clearCache() in tests between test cases.
 *
 * If rules are not available for the requested tax year, the caller must show
 * "Tax rules for [Tax Year] are not available" — never fall back to another year.
 */
export function loadRules(taxYear: number): RulesBundle {
  const cached = cache.get(taxYear)
  if (cached) return cached

  const dir = path.join(RULES_BASE_DIR, String(taxYear))

  // ── Load and validate the index ────────────────────────────────────────────
  const index = loadAndValidate(
    path.join(dir, 'index.json'),
    RulesIndexSchema,
    taxYear,
    'index.json',
  )

  if (index.taxYear !== taxYear) {
    throw new RulesLoadError(
      taxYear,
      `index.json taxYear mismatch: expected ${taxYear}, got ${index.taxYear}`,
    )
  }

  // ── Load and validate each section ────────────────────────────────────────
  const incomeTax = loadAndValidate(
    path.join(dir, index.files.incomeTax),
    IncomeTaxRulesSchema,
    taxYear,
    index.files.incomeTax,
  )

  const withholding = loadAndValidate(
    path.join(dir, index.files.withholding),
    WithholdingRulesSchema,
    taxYear,
    index.files.withholding,
  )

  const deductions = loadAndValidate(
    path.join(dir, index.files.deductions),
    DeductionsRulesSchema,
    taxYear,
    index.files.deductions,
  )

  const credits = loadAndValidate(
    path.join(dir, index.files.credits),
    CreditsRulesSchema,
    taxYear,
    index.files.credits,
  )

  const deadlines = loadAndValidate(
    path.join(dir, index.files.deadlines),
    DeadlinesRulesSchema,
    taxYear,
    index.files.deadlines,
  )

  const penalties = loadAndValidate(
    path.join(dir, index.files.penalties),
    PenaltyRulesSchema,
    taxYear,
    index.files.penalties,
  )

  const bundle: RulesBundle = {
    taxYear,
    version: index.version,
    index,
    incomeTax,
    withholding,
    deductions,
    credits,
    deadlines,
    penalties,
  }

  cache.set(taxYear, bundle)
  return bundle
}

/** Clear the in-memory cache (use in tests) */
export function clearRulesCache(): void {
  cache.clear()
}

// ── Internal ─────────────────────────────────────────────────────────────────

function loadAndValidate<T>(
  filePath: string,
  schema: { parse: (data: unknown) => T },
  taxYear: number,
  fileName: string,
): T {
  let raw: unknown

  try {
    const content = readFileSync(filePath, 'utf-8')
    raw = JSON.parse(content) as unknown
  } catch (e) {
    throw new RulesLoadError(
      taxYear,
      `Cannot read ${fileName}: ${e instanceof Error ? e.message : String(e)}. ` +
        `Tax rules for Tax Year ${taxYear} are not available. ` +
        `Do not fall back to another year.`,
    )
  }

  // Explicit draft/placeholder detection before Zod — clearer than a semver regex failure.
  if (containsDraftMarker(raw)) {
    throw new RulesLoadError(
      taxYear,
      `${fileName} is marked DRAFT/PLACEHOLDER/PENDING and must be replaced with a ` +
        `professionally reviewed rules bundle before production computation. ` +
        `See TY2025_RULE_STATUS in @taxdesk/rules.`,
    )
  }

  try {
    return schema.parse(raw)
  } catch (e) {
    throw new RulesLoadError(
      taxYear,
      `Validation failed for ${fileName}: ${e instanceof Error ? e.message : String(e)}. ` +
        `The rules file must be corrected by a qualified tax professional before use.`,
    )
  }
}

function containsDraftMarker(value: unknown): boolean {
  const text = JSON.stringify(value).toUpperCase()
  return (
    text.includes('DRAFT') ||
    text.includes('PLACEHOLDER') ||
    text.includes('"REVIEWEDBY":"PENDING"') ||
    text.includes('"REVIEWEDBY": "PENDING"')
  )
}
