import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '@/core/outbox/outbox.module';

import { MailService } from './mail.service';
import { MailDeliveryEntity } from './entities/mail-delivery.entity';
import { MailRepository } from './mail.repository';
import { TemplateRendererService } from './template-renderer.service';

@Module({
  imports: [TypeOrmModule.forFeature([MailDeliveryEntity]), OutboxModule],
  providers: [MailService, MailRepository, TemplateRendererService],
  exports: [MailService, MailRepository, TemplateRendererService],
})
export class MailModule {}
