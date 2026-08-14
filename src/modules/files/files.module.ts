import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { AppConfiguration } from '@/config/configuration.types';
import type { RedisConfig } from '@/redis/config/redis.config';

import { FileEntity } from './entities/file.entity';
import { FilesController } from './files.controller';
import { FilesMigrationService } from './files-migration.service';
import { FilesRepository } from './files.repository';
import { FilesService } from './files.service';
import { FILE_QUEUE } from './files.types';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { StorageProviderFactory } from './providers/storage-provider.factory';
import { RedisTusLocker } from './redis-tus-locker';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
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
    BullModule.registerQueue({ name: FILE_QUEUE }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    FilesMigrationService,
    FilesRepository,
    LocalStorageProvider,
    S3StorageProvider,
    StorageProviderFactory,
    RedisTusLocker,
  ],
  exports: [FilesService, FilesMigrationService],
})
export class FilesModule {}
