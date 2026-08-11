import { MAX_CURSOR_LENGTH } from './pagination.constants';
import type { CursorValue } from './pagination.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CursorPayload {
  v: 1;
  s: string;
  i: string;
}

export function encodeCursor(value: CursorValue): string {
  const payload: CursorPayload = { v: 1, s: value.sortValue, i: value.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorValue {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) {
    throw new Error('Invalid pagination cursor');
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('v' in parsed) ||
      parsed.v !== 1 ||
      !('s' in parsed) ||
      typeof parsed.s !== 'string' ||
      parsed.s.length === 0 ||
      !('i' in parsed) ||
      typeof parsed.i !== 'string' ||
      !UUID_PATTERN.test(parsed.i)
    ) {
      throw new Error('Invalid pagination cursor');
    }
    return { sortValue: parsed.s, id: parsed.i };
  } catch {
    throw new Error('Invalid pagination cursor');
  }
}
