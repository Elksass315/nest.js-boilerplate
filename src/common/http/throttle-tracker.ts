import { createHash } from 'node:crypto';

export interface ThrottleRequest {
  ip?: string;
  body?: unknown;
}

export function createThrottleTracker(request: ThrottleRequest): string {
  const ip = request.ip && request.ip.length > 0 ? request.ip : 'unknown';
  const body = isRecord(request.body) ? request.body : undefined;
  const identifier = firstString(body, ['email', 'registrationId', 'challengeToken', 'token']);
  if (!identifier) return `ip:${ip}`;
  const digest = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
  return `ip:${ip}:id:${digest}`;
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
