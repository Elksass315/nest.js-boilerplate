import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '@/core/outbox/outbox.module';

import { FileEntity } from './entities/file.entity';
import { FilesController } from './files.controller';
import { FilesMigrationService } from './files-migration.service';
import { FilesRepository } from './files.repository';
import { FilesService } from './files.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { StorageProviderFactory } from './providers/storage-provider.factory';
import { RedisTusLocker } from './redis-tus-locker';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity]), OutboxModule],
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
