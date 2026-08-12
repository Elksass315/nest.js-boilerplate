import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import type { AppConfiguration } from '@/config/configuration.types';
import type { RedisConfig } from '@/redis/config/redis.config';

import { MailService } from './mail.service';
import { MAIL_QUEUE } from './mail.types';
import { TemplateRendererService } from './template-renderer.service';

@Module({
  imports: [
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
  providers: [MailService, TemplateRendererService],
  exports: [MailService, TemplateRendererService],
})
export class MailModule {}
