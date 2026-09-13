import { z } from 'zod';
import { idSchema } from './common.js';
import { messageAttachmentSchema } from './media.js';

export const createDirectConversationSchema = z
  .object({
    recipientId: idSchema.optional(),
    participantId: idSchema.optional(),
    participantIds: z.array(idSchema).optional(),
    type: z.enum(['direct', 'group', 'channel']).default('direct'),
    title: z.string().max(100).optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.recipientId ||
        data.participantId ||
        (data.participantIds && data.participantIds.length > 0),
      ),
    {
      message: 'Target recipientId or participantId is required',
      path: ['recipientId'],
    },
  );

export const createConversationSchema = z.object({
  type: z.enum(['direct', 'group', 'channel']).default('direct'),
  participantIds: z.array(idSchema).min(1, 'At least one participant is required'),
  title: z.string().max(100).optional(),
});

export const conversationPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  cursor: z.string().optional(),
});

export const conversationIdParamsSchema = z.object({
  id: idSchema,
});

export const sendMessageSchema = z
  .object({
    conversationId: idSchema,
    clientMessageId: z.string().min(1, 'clientMessageId is required').max(100),
    content: z.string().max(5000, 'Message is too long').default(''),
    type: z.enum(['text', 'image', 'file', 'audio', 'video', 'system']).default('text'),
    attachments: z.array(messageAttachmentSchema).max(10).optional(),
    replyToMessageId: idSchema
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform((val) => val || undefined),
    tempId: z.string().optional(),
  })
  .refine(
    (data) =>
      data.content.trim().length > 0 || (Boolean(data.attachments) && data.attachments!.length > 0),
    {
      message: 'Message content or at least one attachment is required',
      path: ['content'],
    },
  );

export const messageCursorPaginationSchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  direction: z.enum(['before', 'after']).default('before'),
});

export const typingEventSchema = z.object({
  conversationId: idSchema,
});

export const messageDeliveredSchema = z
  .object({
    conversationId: idSchema,
    messageId: idSchema.optional(),
    messageIds: z.array(idSchema).optional(),
  })
  .refine((data) => Boolean(data.messageId || (data.messageIds && data.messageIds.length > 0)), {
    message: 'messageId or messageIds array is required',
    path: ['messageId'],
  });

export const messageReadSchema = z.object({
  conversationId: idSchema,
  messageId: idSchema.optional(),
  messageIds: z.array(idSchema).optional(),
});

export const messageReactionSchema = z.object({
  conversationId: idSchema,
  messageId: idSchema,
  emoji: z.string().min(1, 'Emoji is required').max(10, 'Emoji is too long'),
});

export type CreateDirectConversationInput = z.infer<typeof createDirectConversationSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ConversationPaginationInput = z.infer<typeof conversationPaginationSchema>;
export type ConversationIdParamsInput = z.infer<typeof conversationIdParamsSchema>;
export type MessageCursorPaginationInput = z.infer<typeof messageCursorPaginationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type TypingEventInput = z.infer<typeof typingEventSchema>;
export type MessageDeliveredInput = z.infer<typeof messageDeliveredSchema>;
export type MessageReadInput = z.infer<typeof messageReadSchema>;
export type MessageReactionInput = z.infer<typeof messageReactionSchema>;
