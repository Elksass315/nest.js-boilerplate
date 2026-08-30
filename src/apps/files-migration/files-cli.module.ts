import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import {
  loadFileWorkerConfiguration,
  type FileWorkerConfiguration,
} from '@/config/file-worker.environment';
import { DatabaseModule } from '@/database/database.module';
import { FilesModule } from '@/modules/files';

@Module({
  imports: [
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
    DatabaseModule,
    FilesModule,
  ],
})
export class FilesCliModule {}
