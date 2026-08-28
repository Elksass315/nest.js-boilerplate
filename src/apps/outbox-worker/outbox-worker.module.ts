import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import type { AppConfiguration } from '@/config/configuration.types';
import { loadApiConfiguration } from '@/config/environment';
import { DatabaseModule } from '@/database/database.module';
import { OutboxModule } from '@/core/outbox/outbox.module';
import { OutboxWorkerService } from '@/core/outbox/outbox-worker.service';
import { OUTBOX_FILE_QUEUE, OUTBOX_MAIL_QUEUE, OUTBOX_QUEUE } from '@/core/outbox/outbox.types';
import type { RedisConfig } from '@/redis/config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [loadApiConfiguration] }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) =>
        createLoggerOptions(config.getOrThrow('logging.level', { infer: true })),
    }),
    DatabaseModule,
    OutboxModule,
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
    BullModule.registerQueue({ name: OUTBOX_QUEUE }),
    BullModule.registerQueue({ name: OUTBOX_MAIL_QUEUE }),
    BullModule.registerQueue({ name: OUTBOX_FILE_QUEUE }),
  ],
  providers: [OutboxWorkerService],
})
export class OutboxWorkerModule {}
