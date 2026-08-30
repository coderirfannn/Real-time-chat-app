import { z } from 'zod';

export const idSchema = z.string().min(1, 'ID cannot be empty');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
