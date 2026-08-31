import { Types } from 'mongoose';
import type { SendMessageInput } from '@chatlock/validation';
import type { IMessage } from '@chatlock/shared-types';
import { messageRepository, type MessageRepository } from '../repositories/message.repository.js';
import {
  conversationRepository,
  type ConversationRepository,
} from '../repositories/conversation.repository.js';
import { BadRequestError, ForbiddenError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const messageLogger = logger.child('MessageService');

export interface SendMessageResult {
  message: IMessage;
  isDuplicate: boolean;
}

export class MessageService {
  constructor(
    private readonly messageRepo: MessageRepository = messageRepository,
    private readonly conversationRepo: ConversationRepository = conversationRepository,
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

    // 3. Idempotency check: prevent duplicate insertion
    const existingMessage = await this.messageRepo.findByClientMessageId(
      cleanSenderId,
      clientMessageId,
    );

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
      };
    }

    // 4. Persist new message
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

    // 5. Update conversation last message timestamp & reference
    await this.conversationRepo.updateLastMessage(
      cleanConvId,
      messageDoc._id.toString(),
      messageDoc.createdAt,
    );

    messageLogger.debug('Message created and conversation updated', {
      messageId: messageDoc._id.toString(),
      conversationId: cleanConvId,
      senderId: cleanSenderId,
      clientMessageId,
    });

    return {
      message: messageDoc.toJSON() as unknown as IMessage,
      isDuplicate: false,
    };
  }
}

export const messageService = new MessageService();
