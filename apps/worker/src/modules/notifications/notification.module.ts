import { Module } from '@nestjs/common'

import { NOTIFICATION_PROVIDER } from './notification.provider'
import { SmtpEmailAdapter } from './smtp-email.adapter'

@Module({
  providers: [
    SmtpEmailAdapter,
    {
      provide: NOTIFICATION_PROVIDER,
      useExisting: SmtpEmailAdapter,
    },
  ],
  exports: [NOTIFICATION_PROVIDER, SmtpEmailAdapter],
})
export class NotificationModule {}
