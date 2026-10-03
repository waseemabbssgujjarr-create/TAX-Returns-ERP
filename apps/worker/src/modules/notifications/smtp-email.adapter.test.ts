import { describe, expect, it, vi } from 'vitest'

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: '1' }),
    }),
  },
}))

import { SmtpEmailAdapter } from './smtp-email.adapter'
import { otpEmail } from './templates/otp.template'

describe('SmtpEmailAdapter', () => {
  it('OTP template omits contact from subject', () => {
    const template = otpEmail('123456')
    expect(template.subject).not.toMatch(/@/)
    expect(template.text).toContain('123456')
  })

  it('sendEmail delivers OTP in body only via transport', async () => {
    const adapter = new SmtpEmailAdapter()
    const template = otpEmail('654321')
    await expect(
      adapter.sendEmail('user@example.com', template.subject, template.text, template.html),
    ).resolves.toBeUndefined()
  })
})
