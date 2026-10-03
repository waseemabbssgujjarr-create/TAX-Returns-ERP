import { describe, expect, it } from 'vitest'

import { detectMimeFromMagic, validateUploadFile } from './file-magic.util'

describe('file-magic.util', () => {
  it('detects PDF magic bytes', () => {
    const buf = Buffer.from('%PDF-1.4\n')
    expect(detectMimeFromMagic(buf)).toBe('application/pdf')
  })

  it('rejects extension-only PDF claim', () => {
    const buf = Buffer.from('not a pdf file')
    const result = validateUploadFile(buf, 'application/pdf', buf.length)
    expect(result.ok).toBe(false)
  })

  it('accepts matching PNG', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const result = validateUploadFile(buf, 'image/png', buf.length)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mime).toBe('image/png')
    }
  })
})
