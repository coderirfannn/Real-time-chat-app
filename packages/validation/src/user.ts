import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).trim().optional(),
  bio: z.string().max(200).trim().optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
  status: z.enum(['online', 'offline', 'away', 'busy']).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
