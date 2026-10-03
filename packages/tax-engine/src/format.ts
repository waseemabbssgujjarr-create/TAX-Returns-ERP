/**
 * Monetary formatting utilities.
 * These are DISPLAY-ONLY — never use for computation.
 * All computation uses BigInt paisa.
 */

/**
 * Formats a paisa BigInt value as a PKR display string.
 * e.g. 125000000n → "Rs 1,250,000"
 */
export function formatPKR(paisa: bigint, options?: { showPaisa?: boolean }): string {
  const rupees = paisa / 100n
  const remaining = paisa % 100n

  const rupeesStr = rupees.toLocaleString('en-PK')

  if (options?.showPaisa && remaining > 0n) {
    return `Rs ${rupeesStr}.${remaining.toString().padStart(2, '0')}`
  }

  return `Rs ${rupeesStr}`
}

/**
 * Formats as lakh/crore grouping (Pakistani convention).
 * e.g. 125000000n (1.25 crore) → "Rs 1,25,00,000"
 */
export function formatPKRLakhCrore(paisa: bigint): string {
  const rupees = paisa / 100n
  const rupeesStr = rupees.toString()

  // Apply South Asian grouping: last 3 digits, then groups of 2
  const len = rupeesStr.length
  if (len <= 3) return `Rs ${rupeesStr}`

  const last3 = rupeesStr.slice(-3)
  const rest = rupeesStr.slice(0, -3)
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')

  return `Rs ${grouped},${last3}`
}

/**
 * Parses a PKR string back to paisa BigInt.
 * Handles: "Rs 1,250,000", "1250000", "1,250,000.50"
 * Returns null if the string cannot be parsed.
 */
export function parsePKR(value: string): bigint | null {
  const cleaned = value.replace(/[Rs\s,]/g, '').trim()
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null

  const rupees = BigInt(match[1] ?? '0')
  const paisa = match[2] ? BigInt(match[2].padEnd(2, '0')) : 0n

  return rupees * 100n + paisa
}
