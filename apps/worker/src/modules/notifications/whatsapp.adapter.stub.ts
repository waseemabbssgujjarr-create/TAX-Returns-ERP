import { Injectable } from '@nestjs/common'

import { NotImplementedError, type NotificationProvider } from './notification.provider'

@Injectable()
export class WhatsAppAdapterStub implements NotificationProvider {
  sendEmail(): Promise<void> {
    return Promise.reject(new NotImplementedError('WhatsAppAdapter.sendEmail'))
  }

  sendSms(): Promise<void> {
    return Promise.reject(new NotImplementedError('WhatsAppAdapter.sendSms'))
  }
}
