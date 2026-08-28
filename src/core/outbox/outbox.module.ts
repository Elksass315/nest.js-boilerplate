import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfiguration } from '@/config/configuration.types';
import type { RedisConfig } from '@/redis/config/redis.config';

import { OutboxMessageEntity } from './outbox.entity';
import { OutboxRepository } from './outbox.repository';
import { OUTBOX_QUEUE } from './outbox.types';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxMessageEntity]),
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
  ],
  providers: [OutboxRepository],
  exports: [OutboxRepository],
})
export class OutboxModule {}
