import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import { CoreModule } from '@/core/core.module';
import { DatabaseModule } from '@/database/database.module';
import { FilesWorkerConsumerModule } from '@/modules/files/files-worker.module';
import { FILE_QUEUE } from '@/modules/files/files.types';
import type { RedisConfig } from '@/redis/config/redis.config';
import { RedisModule } from '@/redis/redis.module';
import { CAPABILITY_WORKER_IMPORTS } from '@/apps/capability-worker-imports';

import {
  loadFileWorkerConfiguration,
  type FileWorkerConfiguration,
} from '@/config/file-worker.environment';

@Module({
  imports: [
    ...CAPABILITY_WORKER_IMPORTS,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [loadFileWorkerConfiguration],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<FileWorkerConfiguration, true>) =>
        createLoggerOptions(config.getOrThrow('logging.level', { infer: true })),
    }),
    CoreModule,
    DatabaseModule,
    RedisModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<FileWorkerConfiguration, true>) => {
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
    BullModule.registerQueue({ name: FILE_QUEUE }),
    FilesWorkerConsumerModule,
  ],
})
export class FileWorkerModule {}
