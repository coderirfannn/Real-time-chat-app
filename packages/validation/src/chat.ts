import { z } from 'zod';
import { idSchema } from './common.js';

export const sendMessageSchema = z.object({
  conversationId: idSchema,
  content: z.string().min(1, 'Message content cannot be empty').max(5000, 'Message is too long'),
  type: z.enum(['text', 'image', 'file', 'audio', 'video']).default('text'),
  replyToMessageId: idSchema.optional(),
  tempId: z.string().optional(),
});

export const createConversationSchema = z.object({
  type: z.enum(['direct', 'group', 'channel']),
  participantIds: z.array(idSchema).min(1, 'At least one participant is required'),
  title: z.string().max(100).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
