import { Global, Module } from '@nestjs/common'
import { MailService } from './mail.service'

// Global so any feature can inject MailService.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
