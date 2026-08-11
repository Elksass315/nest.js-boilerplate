export interface OffsetPageMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface OffsetPage<T> {
  items: T[];
  meta: OffsetPageMeta;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
}

export interface CursorValue {
  sortValue: string;
  id: string;
}
