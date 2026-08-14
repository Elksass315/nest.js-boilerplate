import { Module } from '@nestjs/common';

import { MailModule } from './mail.module';
import { MailProcessor } from './mail.processor';
import { MailWorkerLifecycle } from './mail-worker.lifecycle';
import { SmtpProvider } from './smtp.provider';

@Module({
  imports: [MailModule],
  providers: [SmtpProvider, MailProcessor, MailWorkerLifecycle],
})
export class MailWorkerConsumerModule {}
