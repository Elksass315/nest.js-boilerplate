import type { CursorPage, OffsetPage } from './pagination.types';

export function buildOffsetPage<T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number,
): OffsetPage<T> {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  return {
    items,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  };
}

export function buildCursorPage<T>(
  items: T[],
  limit: number,
  nextCursor: string | null,
): CursorPage<T> {
  return { items, limit, nextCursor, hasNextPage: nextCursor !== null };
}
