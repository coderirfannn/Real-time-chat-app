import { z } from 'zod';

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().default(''),
  role: z.enum(['USER', 'ADMIN']).optional(),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
});

export const adminStatusUpdateSchema = z.object({
  reason: z.string().max(500).trim().optional(),
});

export const adminAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.string().trim().optional(),
  adminId: z.string().trim().optional(),
  targetId: z.string().trim().optional(),
});

export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type AdminStatusUpdateInput = z.infer<typeof adminStatusUpdateSchema>;
export type AdminAuditLogQueryInput = z.infer<typeof adminAuditLogQuerySchema>;
