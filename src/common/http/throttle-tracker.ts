import { createHash } from 'node:crypto';

export interface ThrottleRequest {
  ip?: string;
  body?: unknown;
}

export function createIpThrottleTracker(request: ThrottleRequest): string {
  const ip = request.ip && request.ip.length > 0 ? request.ip : 'unknown';
  return `ip:${ip}`;
}

export function createIdentifierThrottleTracker(request: ThrottleRequest): string {
  const body = isRecord(request.body) ? request.body : undefined;
  const identifier = firstString(body, ['email', 'registrationId', 'challengeToken', 'token']);
  if (!identifier) return createIpThrottleTracker(request);
  const digest = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
  return `id:${digest}`;
}

function firstString(
  body: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!body) return undefined;
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
