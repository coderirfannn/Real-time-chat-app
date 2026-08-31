import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).trim().optional(),
  bio: z.string().max(200).trim().optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
  status: z.enum(['online', 'offline', 'away', 'busy']).optional(),
});

export const userSearchQuerySchema = z.object({
  q: z.string().trim().default(''),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UserSearchQueryInput = z.infer<typeof userSearchQuerySchema>;
