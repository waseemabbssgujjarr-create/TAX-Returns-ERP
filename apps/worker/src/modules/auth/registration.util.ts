import { createHash, randomBytes } from 'node:crypto'

const SLUG_PATTERN = /^[a-z0-9-]{2,60}$/

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function slugifyFirmName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const cleaned = base.length >= 2 ? base : 'firm'
  return SLUG_PATTERN.test(cleaned) ? cleaned : 'firm'
}

export function buildVerificationTokenRaw(firmId: string): string {
  return `${firmId}.${randomBytes(32).toString('hex')}`
}

export function hashVerificationToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function parseVerificationTokenRaw(raw: string): { firmId: string } | null {
  const dot = raw.indexOf('.')
  if (dot <= 0) {
    return null
  }
  const firmId = raw.slice(0, dot)
  const secretHex = raw.slice(dot + 1)
  if (secretHex.length !== 64 || !/^[a-f0-9]+$/.test(secretHex)) {
    return null
  }
  if (!firmId.length) {
    return null
  }
  return { firmId }
}

export async function ensureUniqueSlug(
  exists: (slug: string) => Promise<boolean>,
  preferred: string,
): Promise<string> {
  let candidate = preferred
  let attempt = 0
  while (await exists(candidate)) {
    attempt += 1
    const suffix = attempt < 10 ? String(attempt) : randomBytes(2).toString('hex')
    candidate = `${preferred.slice(0, Math.max(2, 60 - suffix.length - 1))}-${suffix}`
  }
  return candidate
}
