export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented`)
    this.name = 'NotImplementedError'
  }
}

export interface NotificationProvider {
  sendEmail(to: string, subject: string, body: string, html?: string): Promise<void>
  sendSms(to: string, body: string): Promise<void>
}

export const NOTIFICATION_PROVIDER = 'NotificationProvider'
