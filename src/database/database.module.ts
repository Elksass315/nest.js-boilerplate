import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { AppConfiguration } from '@/config/configuration.types';

import { createDatabaseOptions } from './database-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) =>
        createDatabaseOptions(config.getOrThrow('database', { infer: true })),
    }),
  ],
})
export class DatabaseModule {}
