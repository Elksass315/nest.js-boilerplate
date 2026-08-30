import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';

import { ERROR_REPORTER } from '@/core/error-reporting/error-reporter';
import { FeatureFlagsModule } from '@/modules/feature-flags';
import { FilesModule } from '@/modules/files';
import { InvitationsModule } from '@/modules/invitations';
import { UserAvatarsModule } from '@/modules/user-avatars';
import { SentryErrorReporter } from '@/observability/sentry';

export const CAPABILITY_API_IMPORTS: (Type<unknown> | DynamicModule)[] = [
  SentryModule.forRoot(),
  FilesModule,
  UserAvatarsModule,
  FeatureFlagsModule,
  InvitationsModule,
];

export const CAPABILITY_API_PROVIDERS: Provider[] = [
  { provide: ERROR_REPORTER, useClass: SentryErrorReporter },
];
