/** Normalise recovery code input to uppercase hex (max 10 chars). */
export function normalizeRecoveryCodeInput(raw: string): string {
  return raw
    .replace(/[^a-fA-F0-9]/g, '')
    .toUpperCase()
    .slice(0, 10)
}
