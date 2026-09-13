import { Types } from 'mongoose';
import type { SendMessageInput } from '@chatlock/validation';
import type { IMessage, MessageReaction } from '@chatlock/shared-types';
import { messageRepository, type MessageRepository } from '../repositories/message.repository.js';
import {
  conversationRepository,
  type ConversationRepository,
} from '../repositories/conversation.repository.js';
import {
  messageReceiptRepository,
  type MessageReceiptRepository,
} from '../repositories/message-receipt.repository.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const messageLogger = logger.child('MessageService');

export interface SendMessageResult {
  message: IMessage;
  isDuplicate: boolean;
  participantIds: string[];
}

export class MessageService {
  constructor(
    private readonly messageRepo: MessageRepository = messageRepository,
    private readonly conversationRepo: ConversationRepository = conversationRepository,
    private readonly receiptRepo: MessageReceiptRepository = messageReceiptRepository,
  ) {}

  /**
   * Validates, checks idempotency, and persists a message.
   * Updates conversation metadata and initializes receipts.
   */
  public async sendMessage(
    senderId: string,
    payload: SendMessageInput,
  ): Promise<SendMessageResult> {
    const cleanSenderId = senderId.trim();
    const cleanConvId = payload.conversationId.trim();
    const clientMessageId = payload.clientMessageId.trim();

    // 1. Validate ID formats
    if (!Types.ObjectId.isValid(cleanSenderId)) {
      throw new BadRequestError('Invalid sender ID format');
    }
    if (!Types.ObjectId.isValid(cleanConvId)) {
      throw new BadRequestError('Invalid conversation ID format');
    }

    // 2. Validate conversation membership
    const isParticipant = await this.conversationRepo.isParticipant(cleanConvId, cleanSenderId);
    if (!isParticipant) {
      throw new ForbiddenError('You are not authorized to send messages in this conversation');
    }

    // 3. Fetch participants and check idempotency in parallel
    const [existingMessage, conv] = await Promise.all([
      this.messageRepo.findByClientMessageId(cleanSenderId, clientMessageId),
      typeof this.conversationRepo.findById === 'function'
        ? Promise.resolve(this.conversationRepo.findById(cleanConvId)).catch(() => null)
        : Promise.resolve(null),
    ]);

    // 3. Extract participant IDs for recipient notifications and receipt tracking
    let participantIds: string[] = [cleanSenderId];
    if (conv && Array.isArray(conv.participants) && conv.participants.length > 0) {
      participantIds = conv.participants.map(
        (p: unknown) =>
          (p as { _id?: Types.ObjectId; id?: string })?._id?.toString() ||
          (p as { id?: string })?.id ||
          (p as Types.ObjectId).toString(),
      );
    } else if (typeof this.conversationRepo.findById === 'function') {
      try {
        const fetchedConv = await this.conversationRepo.findById(cleanConvId);
        if (fetchedConv && Array.isArray(fetchedConv.participants) && fetchedConv.participants.length > 0) {
          participantIds = fetchedConv.participants.map(
            (p: unknown) =>
              (p as { _id?: Types.ObjectId; id?: string })?._id?.toString() ||
              (p as { id?: string })?.id ||
              (p as Types.ObjectId).toString(),
          );
        }
      } catch {
        participantIds = [cleanSenderId];
      }
    }

    // 4. Idempotency check: prevent duplicate insertion
    if (existingMessage) {
      messageLogger.info(
        'Duplicate message detected via clientMessageId; reusing existing record',
        {
          senderId: cleanSenderId,
          clientMessageId,
          messageId: existingMessage._id.toString(),
        },
      );

      return {
        message: existingMessage.toJSON() as unknown as IMessage,
        isDuplicate: true,
        participantIds,
      };
    }

    // 5. Persist new message
    const messageDoc = await this.messageRepo.createMessage({
      conversationId: cleanConvId,
      senderId: cleanSenderId,
      clientMessageId,
      type:
        payload.type || (payload.attachments && payload.attachments.length > 0 ? 'image' : 'text'),
      content: payload.content || '',
      attachments: payload.attachments,
      replyToMessageId: payload.replyToMessageId,
    });

    // 6. Update conversation last message & initialize receipts concurrently
    const recipientIds = participantIds.filter((id) => id !== cleanSenderId);
    const postSendTasks: Promise<unknown>[] = [
      this.conversationRepo.updateLastMessage(
        cleanConvId,
        messageDoc._id.toString(),
        messageDoc.createdAt,
      ),
    ];

    if (
      this.receiptRepo &&
      typeof this.receiptRepo.upsertReceipt === 'function' &&
      recipientIds.length > 0
    ) {
      for (const recipientId of recipientIds) {
        postSendTasks.push(
          this.receiptRepo.upsertReceipt({
            messageId: messageDoc._id.toString(),
            conversationId: cleanConvId,
            userId: recipientId,
            status: 'sent',
          }),
        );
      }
    }

    // Await post-send metadata tasks in parallel
    await Promise.all(postSendTasks).catch(() => {});

    messageLogger.debug('Message created, receipts initialized, and conversation updated', {
      messageId: messageDoc._id.toString(),
      conversationId: cleanConvId,
      senderId: cleanSenderId,
      clientMessageId,
      recipientCount: recipientIds.length,
    });

    return {
      message: messageDoc.toJSON() as unknown as IMessage,
      isDuplicate: false,
      participantIds,
    };
  }

  /**
   * Toggles emoji reaction on a message and returns updated reactions and participant IDs.
   */
  public async toggleReaction(
    userId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<{
    message: IMessage;
    action: 'added' | 'removed';
    reactions: MessageReaction[];
    participantIds: string[];
  }> {
    const cleanUserId = userId.trim();
    const cleanConvId = conversationId.trim();
    const cleanMsgId = messageId.trim();

    if (!Types.ObjectId.isValid(cleanUserId)) {
      throw new BadRequestError('Invalid user ID format');
    }
    if (!Types.ObjectId.isValid(cleanConvId)) {
      throw new BadRequestError('Invalid conversation ID format');
    }
    if (!Types.ObjectId.isValid(cleanMsgId)) {
      throw new BadRequestError('Invalid message ID format');
    }

    const isParticipant = await this.conversationRepo.isParticipant(cleanConvId, cleanUserId);
    if (!isParticipant) {
      throw new ForbiddenError('You are not authorized to react to messages in this conversation');
    }

    const result = await this.messageRepo.toggleReaction(cleanMsgId, cleanUserId, emoji);
    if (!result) {
      throw new NotFoundError('Message not found');
    }

    let participantIds: string[] = [cleanUserId];
    try {
      if (typeof this.conversationRepo.findById === 'function') {
        const conv = await this.conversationRepo.findById(cleanConvId);
        if (conv && Array.isArray(conv.participants) && conv.participants.length > 0) {
          participantIds = conv.participants.map(
            (p: unknown) =>
              (p as { _id?: Types.ObjectId; id?: string })?._id?.toString() ||
              (p as { id?: string })?.id ||
              (p as Types.ObjectId).toString(),
          );
        }
      }
    } catch {
      participantIds = [cleanUserId];
    }

    return {
      message: result.message.toJSON() as unknown as IMessage,
      action: result.action,
      reactions: (result.message.reactions || []) as MessageReaction[],
      participantIds,
    };
  }
}

export const messageService = new MessageService();
