import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import type { FileWorkerConfiguration } from '@/config/configuration.types';
import { loadFileWorkerConfiguration } from '@/config/environment';
import { CoreModule } from '@/core/core.module';
import { DatabaseModule } from '@/database/database.module';
import { FilesWorkerConsumerModule } from '@/modules/files/files-worker.module';

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
    CoreModule,
    DatabaseModule,
    FilesWorkerConsumerModule,
  ],
})
export class FileWorkerModule {}
