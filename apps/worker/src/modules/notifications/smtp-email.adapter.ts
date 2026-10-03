import { Injectable, Logger } from '@nestjs/common'
import nodemailer from 'nodemailer'
import type Transporter from 'nodemailer/lib/mailer'

import type { NotificationProvider } from './notification.provider'

@Injectable()
export class SmtpEmailAdapter implements NotificationProvider {
  private readonly logger = new Logger(SmtpEmailAdapter.name)
  private readonly transporter: Transporter
  private readonly from: string

  constructor() {
    const host = process.env['SMTP_HOST'] ?? 'localhost'
    const port = parseInt(process.env['SMTP_PORT'] ?? '1025', 10)
    const user = process.env['SMTP_USER']
    const pass = process.env['SMTP_PASS']
    this.from = process.env['EMAIL_FROM'] ?? 'noreply@taxdesk.pk'

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    })
  }

  async sendEmail(to: string, subject: string, body: string, html?: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text: body,
      html: html ?? body,
    })
  }

  sendSms(_to: string, _body: string): Promise<void> {
    void _to
    void _body
    this.logger.warn('SMS not implemented — use WhatsApp adapter in Phase 2')
    return Promise.reject(new Error('SMS not implemented'))
  }
}
