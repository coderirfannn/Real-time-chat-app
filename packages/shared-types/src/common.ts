export type ID = string;

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor?: string;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'before' | 'after';
}

export interface CursorPaginatedResult<T> {
  messages: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
