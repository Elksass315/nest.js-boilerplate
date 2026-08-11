import path from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nJsonLoader,
  I18nModule,
  type I18nOptionsWithoutResolvers,
} from 'nestjs-i18n';

import type { AppConfiguration } from '@/config/configuration.types';

@Module({
  imports: [
    I18nModule.forRootAsync({
      inject: [ConfigService],
      loader: I18nJsonLoader,
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (config: ConfigService<AppConfiguration, true>): string[] => [
            config.getOrThrow('i18n.headerLanguage', { infer: true }),
          ],
          inject: [ConfigService],
        },
        AcceptLanguageResolver,
      ],
      useFactory: (config: ConfigService<AppConfiguration, true>): I18nOptionsWithoutResolvers => ({
        fallbackLanguage: config.getOrThrow('i18n.fallbackLanguage', { infer: true }),
        loaderOptions: {
          path: path.join(__dirname, '..', '..', 'i18n'),
          watch: config.getOrThrow('app.nodeEnv', { infer: true }) === 'development',
        },
        throwOnMissingKey: false,
      }),
    }),
  ],
  exports: [I18nModule],
})
export class AppI18nModule {}
