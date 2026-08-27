import { QueryFailedError } from 'typeorm';

const SAFE_DATABASE_CODES = new Set(['23503', '23505', '23514']);

export interface SafeErrorProjection {
  errorType: string;
  databaseCode?: string;
  databaseConstraint?: string;
}

export function projectSafeError(error: unknown): SafeErrorProjection {
  if (!(error instanceof Error)) return { errorType: 'UnknownError' };
  const projection: SafeErrorProjection = { errorType: error.name || 'Error' };
  if (!(error instanceof QueryFailedError)) return projection;

  const driver = error.driverError as unknown;
  if (typeof driver !== 'object' || driver === null) return projection;
  const code = 'code' in driver && typeof driver.code === 'string' ? driver.code : undefined;
  if (code && SAFE_DATABASE_CODES.has(code)) projection.databaseCode = code;
  const constraint =
    'constraint' in driver && typeof driver.constraint === 'string' ? driver.constraint : undefined;
  if (constraint && /^[a-zA-Z0-9_.-]{1,128}$/.test(constraint)) {
    projection.databaseConstraint = constraint;
  }
  return projection;
}
