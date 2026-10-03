import { createHmac } from 'node:crypto'

export function cnicDigits(cnic: string): string {
  return cnic.replace(/\D/g, '')
}

export function buildCnicMasked(cnic: string): string {
  const digits = cnicDigits(cnic)
  if (digits.length !== 13) {
    return '*****-*******-*'
  }
  return `${digits.slice(0, 5)}-*******-${digits.slice(-1)}`
}

export function buildNtnMasked(ntn: string): string {
  const digits = ntn.replace(/\D/g, '')
  if (digits.length < 4) {
    return '*******'
  }
  return `***${digits.slice(-4)}`
}

export function clientIdLookupHmac(
  firmId: string,
  kind: 'cnic' | 'ntn',
  normalised: string,
): string {
  const secret = process.env['CLIENT_LOOKUP_HMAC_SECRET'] ?? process.env['OTP_CONTACT_SECRET']
  if (!secret) {
    throw new Error('CLIENT_LOOKUP_HMAC_SECRET or OTP_CONTACT_SECRET is required')
  }
  return createHmac('sha256', secret).update(`${firmId}:${kind}:${normalised}`).digest('hex')
}
