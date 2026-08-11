import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { validateEnvironment } from '@/config/environment';

import { createDatabaseOptions } from './database-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => createDatabaseOptions(validateEnvironment(process.env)),
    }),
  ],
})
export class DatabaseModule {}
