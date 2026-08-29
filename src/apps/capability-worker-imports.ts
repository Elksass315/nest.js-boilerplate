import type { DynamicModule } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';

export const CAPABILITY_WORKER_IMPORTS: DynamicModule[] = [SentryModule.forRoot()];
