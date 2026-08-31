import { Types } from 'mongoose';
import {
  messageReceiptRepository,
  type MessageReceiptRepository,
} from '../repositories/message-receipt.repository.js';
import {
  conversationRepository,
  type ConversationRepository,
} from '../repositories/conversation.repository.js';
import type { MessageDeliveredInput, MessageReadInput } from '@chatlock/validation';
import type { ReceiptUpdatePayload } from '@chatlock/shared-types';
import { BadRequestError, ForbiddenError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const receiptLogger = logger.child('ReceiptService');

export class ReceiptService {
  constructor(
    private readonly receiptRepo: MessageReceiptRepository = messageReceiptRepository,
    private readonly conversationRepo: ConversationRepository = conversationRepository,
  ) {}

  /**
   * Processes and persists delivery receipt(s) for a user in a conversation.
   */
  public async processDeliveryReceipt(
    userId: string,
    input: MessageDeliveredInput,
  ): Promise<ReceiptUpdatePayload> {
    const cleanUserId = userId.trim();
    const cleanConvId = input.conversationId.trim();

    if (!Types.ObjectId.isValid(cleanUserId)) {
      throw new BadRequestError('Invalid user ID format');
    }
    if (!Types.ObjectId.isValid(cleanConvId)) {
      throw new BadRequestError('Invalid conversation ID format');
    }

    // 1. Authorize participant
    const isParticipant = await this.conversationRepo.isParticipant(cleanConvId, cleanUserId);
    if (!isParticipant) {
      throw new ForbiddenError('You are not authorized in this conversation');
    }

    const messageIds: string[] = [];
    if (input.messageId) {
      messageIds.push(input.messageId.trim());
    }
    if (Array.isArray(input.messageIds)) {
      input.messageIds.forEach((id) => {
        const clean = id.trim();
        if (clean && !messageIds.includes(clean)) {
          messageIds.push(clean);
        }
      });
    }

    if (messageIds.length === 0) {
      throw new BadRequestError('At least one messageId is required for delivery receipt');
    }

    const now = new Date();
    await this.receiptRepo.batchUpsertReceipts({
      messageIds,
      conversationId: cleanConvId,
      userId: cleanUserId,
      status: 'delivered',
    });

    receiptLogger.debug('Processed message delivery receipt', {
      userId: cleanUserId,
      conversationId: cleanConvId,
      messageIdsCount: messageIds.length,
    });

    return {
      conversationId: cleanConvId,
      messageId: messageIds.length === 1 ? messageIds[0] : undefined,
      messageIds: messageIds.length > 1 ? messageIds : undefined,
      userId: cleanUserId,
      status: 'delivered',
      deliveredAt: now.toISOString(),
      timestamp: now.toISOString(),
    };
  }

  /**
   * Processes and persists read receipt(s) for a user in a conversation.
   */
  public async processReadReceipt(
    userId: string,
    input: MessageReadInput,
  ): Promise<ReceiptUpdatePayload> {
    const cleanUserId = userId.trim();
    const cleanConvId = input.conversationId.trim();

    if (!Types.ObjectId.isValid(cleanUserId)) {
      throw new BadRequestError('Invalid user ID format');
    }
    if (!Types.ObjectId.isValid(cleanConvId)) {
      throw new BadRequestError('Invalid conversation ID format');
    }

    // 1. Authorize participant
    const isParticipant = await this.conversationRepo.isParticipant(cleanConvId, cleanUserId);
    if (!isParticipant) {
      throw new ForbiddenError('You are not authorized in this conversation');
    }

    const messageIds: string[] = [];
    if (input.messageId) {
      messageIds.push(input.messageId.trim());
    }
    if (Array.isArray(input.messageIds)) {
      input.messageIds.forEach((id) => {
        const clean = id.trim();
        if (clean && !messageIds.includes(clean)) {
          messageIds.push(clean);
        }
      });
    }

    const now = new Date();

    if (messageIds.length > 0) {
      await this.receiptRepo.batchUpsertReceipts({
        messageIds,
        conversationId: cleanConvId,
        userId: cleanUserId,
        status: 'read',
      });
    } else {
      // Mark all unread incoming messages in conversation as read
      await this.receiptRepo.markConversationAsRead(cleanConvId, cleanUserId);
    }

    receiptLogger.debug('Processed message read receipt', {
      userId: cleanUserId,
      conversationId: cleanConvId,
      messageIdsCount: messageIds.length,
    });

    return {
      conversationId: cleanConvId,
      messageId: messageIds.length === 1 ? messageIds[0] : undefined,
      messageIds: messageIds.length > 1 ? messageIds : undefined,
      userId: cleanUserId,
      status: 'read',
      readAt: now.toISOString(),
      deliveredAt: now.toISOString(),
      timestamp: now.toISOString(),
    };
  }

  /**
   * Gets unread message count for a user in a conversation.
   */
  public async getUnreadCount(userId: string, conversationId: string): Promise<number> {
    return this.receiptRepo.getUnreadCount(conversationId, userId);
  }
}

export const receiptService = new ReceiptService();
