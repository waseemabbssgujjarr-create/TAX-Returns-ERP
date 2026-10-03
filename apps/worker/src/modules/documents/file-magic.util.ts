const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const

export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIMES)[number]

type MagicRule = {
  mime: AllowedDocumentMime
  match: (buf: Buffer) => boolean
}

const MAGIC_RULES: MagicRule[] = [
  {
    mime: 'application/pdf',
    match: (buf) => buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF',
  },
  {
    mime: 'image/jpeg',
    match: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mime: 'image/png',
    match: (buf) =>
      buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    match: (buf) =>
      buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04,
  },
]

function looksLikeCsv(buf: Buffer): boolean {
  if (buf.length === 0) return false
  const sample = buf.subarray(0, Math.min(buf.length, 4096))
  for (const byte of sample) {
    if (byte === 0) return false
  }
  return true
}

export function detectMimeFromMagic(buffer: Buffer): AllowedDocumentMime | null {
  for (const rule of MAGIC_RULES) {
    if (rule.match(buffer)) {
      return rule.mime
    }
  }
  if (looksLikeCsv(buffer)) {
    return 'text/csv'
  }
  return null
}

export function validateUploadFile(
  buffer: Buffer,
  declaredMime: string,
  sizeBytes: number,
): { ok: true; mime: AllowedDocumentMime } | { ok: false; reason: string } {
  if (sizeBytes > MAX_DOCUMENT_BYTES) {
    return { ok: false, reason: 'File exceeds the 25 MB limit' }
  }
  if (sizeBytes === 0) {
    return { ok: false, reason: 'File is empty' }
  }

  const detected = detectMimeFromMagic(buffer)
  if (!detected) {
    return { ok: false, reason: 'Unsupported or unrecognized file type' }
  }

  if (!ALLOWED_DOCUMENT_MIMES.includes(detected)) {
    return { ok: false, reason: 'Unsupported file type' }
  }

  if (declaredMime !== detected) {
    return { ok: false, reason: 'File content does not match declared type' }
  }

  return { ok: true, mime: detected }
}

export { MAX_DOCUMENT_BYTES }
