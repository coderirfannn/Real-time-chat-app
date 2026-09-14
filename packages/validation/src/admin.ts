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

export const createReportSchema = z.object({
  targetType: z.enum(['USER', 'MESSAGE', 'CONVERSATION']),
  targetId: z.string().min(1, 'Target ID is required').trim(),
  reportedUserId: z.string().trim().optional(),
  conversationId: z.string().trim().optional(),
  messageId: z.string().trim().optional(),
  reason: z.enum([
    'SPAM',
    'HARASSMENT',
    'HATE_SPEECH',
    'INAPPROPRIATE_CONTENT',
    'IMPERSONATION',
    'OTHER',
  ]),
  description: z.string().max(1000).trim().optional(),
});

export const resolveReportSchema = z.object({
  action: z.enum(['DISMISS', 'WARN', 'SUSPEND', 'BAN']),
  adminNotes: z.string().max(1000).trim().optional(),
  warningMessage: z.string().max(500).trim().optional(),
});

export const adminReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'DISMISSED', 'WARNED', 'SUSPENDED', 'BANNED']).optional(),
  targetType: z.enum(['USER', 'MESSAGE', 'CONVERSATION']).optional(),
  reason: z
    .enum(['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT', 'IMPERSONATION', 'OTHER'])
    .optional(),
  reporterId: z.string().trim().optional(),
  reportedUserId: z.string().trim().optional(),
});

export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type AdminStatusUpdateInput = z.infer<typeof adminStatusUpdateSchema>;
export type AdminAuditLogQueryInput = z.infer<typeof adminAuditLogQuerySchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type AdminReportQueryInput = z.infer<typeof adminReportQuerySchema>;
