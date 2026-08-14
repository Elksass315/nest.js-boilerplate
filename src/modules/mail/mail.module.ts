import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { AppConfiguration } from '@/config/configuration.types';
import type { RedisConfig } from '@/redis/config/redis.config';

import { MailService } from './mail.service';
import { MailDeliveryEntity } from './entities/mail-delivery.entity';
import { MailRepository } from './mail.repository';
import { MAIL_QUEUE } from './mail.types';
import { TemplateRendererService } from './template-renderer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MailDeliveryEntity]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) => {
        const redis = config.getOrThrow<RedisConfig>('redis');
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password.length > 0 ? redis.password : undefined,
            db: redis.db,
            connectTimeout: redis.connectTimeoutMs,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }),
  ],
  providers: [MailService, MailRepository, TemplateRendererService],
  exports: [MailService, MailRepository, TemplateRendererService],
})
export class MailModule {}
