import { buildCursorPage, buildOffsetPage } from './pagination.builder';
import { decodeCursor, encodeCursor } from './cursor-codec';

describe('pagination contracts', () => {
  it('builds complete offset metadata', () => {
    expect(buildOffsetPage(['a'], 21, 2, 10)).toEqual({
      items: ['a'],
      meta: {
        page: 2,
        limit: 10,
        totalItems: 21,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
  });

  it('round-trips a stable cursor', () => {
    const value = {
      sortValue: '2026-08-12T12:00:00.000Z',
      id: '01234567-89ab-4cde-8f01-23456789abcd',
    };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeCursor('not-json')).toThrow('Invalid pagination cursor');
  });

  it('builds cursor metadata without totals', () => {
    expect(buildCursorPage(['a'], 20, 'next')).toEqual({
      items: ['a'],
      limit: 20,
      nextCursor: 'next',
      hasNextPage: true,
    });
  });

  it('represents an empty offset page without phantom navigation', () => {
    expect(buildOffsetPage([], 0, 1, 20).meta).toEqual(
      expect.objectContaining({
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      }),
    );
  });

  it('represents the end of a cursor traversal', () => {
    expect(buildCursorPage([], 20, null)).toEqual({
      items: [],
      limit: 20,
      nextCursor: null,
      hasNextPage: false,
    });
  });
});
