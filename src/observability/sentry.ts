import * as Sentry from '@sentry/nestjs';
import type { Event } from '@sentry/nestjs';

import { loadSentryConfiguration } from '@/config/sentry.config';

const SAFE_HEADERS = new Set(['x-request-id', 'x-correlation-id', 'user-agent']);

export function sanitizeSentryEvent<TEvent extends Event>(event: TEvent): TEvent {
  const headers = event.request?.headers;
  const requestId = readHeader(headers, 'x-request-id');
  const correlationId = readHeader(headers, 'x-correlation-id');
  if (requestId) event.tags = { ...event.tags, requestId };
  if (correlationId) event.tags = { ...event.tags, correlationId };
  if (event.request) {
    if (event.request.url) {
      const sanitizedUrl = event.request.url.split(/[?#]/u, 1)[0];
      if (sanitizedUrl) event.request.url = sanitizedUrl;
    }
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(headers).filter(([name]) => SAFE_HEADERS.has(name.toLowerCase())),
      );
    }
  }
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }
  return event;
}

export function initializeSentry(): void {
  const config = loadSentryConfiguration();
  Sentry.init({
    enabled: config.enabled,
    dsn: config.dsn || undefined,
    environment: config.environment,
    release: config.release || undefined,
    tracesSampleRate: config.tracesSampleRate,
    debug: config.debug,
    sendDefaultPii: false,
    beforeSend: (event) => sanitizeSentryEvent(event),
    beforeSendTransaction: (event) => sanitizeSentryEvent(event),
  });
}

export async function captureStartupFailure(processName: string, error: unknown): Promise<void> {
  Sentry.captureException(error, { tags: { process: processName, phase: 'startup' } });
  await Sentry.flush(2_000);
}

function readHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const entry = Object.entries(headers).find(([header]) => header.toLowerCase() === name);
  return entry?.[1];
}
