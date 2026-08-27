import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import type { AppConfiguration } from '@/config/configuration.types';
import { loadApiConfiguration } from '@/config/environment';
import { DatabaseModule } from '@/database/database.module';
import { OutboxModule } from '@/core/outbox/outbox.module';
import { OutboxWorkerService } from '@/core/outbox/outbox-worker.service';

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
  ],
  providers: [OutboxWorkerService],
})
export class OutboxWorkerModule {}
