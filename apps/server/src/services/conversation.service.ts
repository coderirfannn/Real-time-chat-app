import { Types } from 'mongoose';
import {
  conversationRepository,
  type ConversationRepository,
  type ConversationListOptions,
  type PaginatedConversations,
} from '../repositories/conversation.repository.js';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import {
  messageReceiptRepository,
  type MessageReceiptRepository,
} from '../repositories/message-receipt.repository.js';
import { messageRepository, type MessageRepository } from '../repositories/message.repository.js';
import type { IConversationDoc } from '../models/conversation.model.js';
import type { CursorPaginatedResult } from '@chatlock/shared-types';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/app-error.js';

export interface ConversationDetailResponse {
  conversation: Record<string, unknown>;
  unreadCount: number;
  isNew?: boolean;
}

export class ConversationService {
  constructor(
    private readonly conversationRepo: ConversationRepository = conversationRepository,
    private readonly userRepo: UserRepository = userRepository,
    private readonly receiptRepo: MessageReceiptRepository = messageReceiptRepository,
    private readonly messageRepo: MessageRepository = messageRepository,
  ) {}

  /**
   * Retrieves an existing direct conversation or creates a new one between two users.
   */
  public async getOrCreateDirectConversation(
    currentUserId: string,
    recipientId: string,
  ): Promise<ConversationDetailResponse> {
    const cleanCurrentId = currentUserId.trim();
    const cleanRecipientId = recipientId.trim();

    // 1. Prevent self-conversation
    if (cleanCurrentId === cleanRecipientId) {
      throw new BadRequestError('Cannot start a direct conversation with yourself');
    }

    // 2. Validate ObjectId format
    if (!Types.ObjectId.isValid(cleanRecipientId)) {
      throw new BadRequestError('Invalid recipient ID format');
    }

    // 3. Ensure recipient exists in the system
    const targetUser = await this.userRepo.findById(cleanRecipientId);
    if (!targetUser) {
      throw new NotFoundError('Recipient user not found');
    }

    // 4. Check for existing direct conversation
    const existing = await this.conversationRepo.findDirectConversation(
      cleanCurrentId,
      cleanRecipientId,
    );

    if (existing) {
      const unreadCount = await this.receiptRepo.getUnreadCount(
        existing._id.toString(),
        cleanCurrentId,
      );

      return {
        conversation: existing.toJSON(),
        unreadCount,
        isNew: false,
      };
    }

    // 5. Create new direct conversation
    const created = await this.conversationRepo.createDirectConversation(
      cleanCurrentId,
      cleanRecipientId,
    );

    return {
      conversation: created.toJSON(),
      unreadCount: 0,
      isNew: true,
    };
  }

  /**
   * Retrieves paginated conversations for a user with unread counts attached.
   */
  public async getUserConversations(
    currentUserId: string,
    options: ConversationListOptions = {},
  ): Promise<PaginatedConversations<Record<string, unknown>>> {
    const paginated = await this.conversationRepo.findUserConversationsWithDetails(
      currentUserId,
      options,
    );

    const docsWithUnread = await Promise.all(
      paginated.docs.map(async (item: IConversationDoc) => {
        const unreadCount = await this.receiptRepo.getUnreadCount(
          item._id.toString(),
          currentUserId,
        );
        const json = item.toJSON();
        json['unreadCount'] = unreadCount;
        return json;
      }),
    );

    return {
      docs: docsWithUnread,
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      totalPages: paginated.totalPages,
      hasNextPage: paginated.hasNextPage,
      hasPrevPage: paginated.hasPrevPage,
      nextCursor: paginated.nextCursor,
    };
  }

  /**
   * Retrieves a single conversation by ID, enforcing strict participant-only access.
   */
  public async getConversationById(
    conversationId: string,
    currentUserId: string,
  ): Promise<ConversationDetailResponse> {
    const cleanConvId = conversationId.trim();

    // 1. Validate ID format
    if (!Types.ObjectId.isValid(cleanConvId)) {
      throw new BadRequestError('Invalid conversation ID format');
    }

    // 2. Fetch populated conversation
    const conv = await this.conversationRepo.findPopulatedById(cleanConvId);
    if (!conv) {
      throw new NotFoundError('Conversation not found');
    }

    // 3. Strict authorization: verify caller is an active participant
    const isParticipant = conv.participants.some((participant) => {
      const p = participant as unknown as { _id?: Types.ObjectId; id?: string };
      const pId = p._id ? p._id.toString() : p.id ? p.id : participant.toString();
      return pId === currentUserId;
    });

    if (!isParticipant) {
      throw new ForbiddenError('You do not have permission to access this conversation');
    }

    // 4. Calculate unread messages for the caller
    const unreadCount = await this.receiptRepo.getUnreadCount(cleanConvId, currentUserId);

    return {
      conversation: conv.toJSON(),
      unreadCount,
    };
  }

  /**
   * Retrieves cursor-paginated messages for a conversation, enforcing participant access.
   */
  public async getConversationMessages(
    conversationId: string,
    currentUserId: string,
    options: {
      cursor?: string;
      limit?: number;
      direction?: 'before' | 'after';
      page?: number;
    } = {},
  ): Promise<CursorPaginatedResult<Record<string, unknown>>> {
    const cleanConvId = conversationId.trim();

    if (!Types.ObjectId.isValid(cleanConvId)) {
      throw new BadRequestError('Invalid conversation ID format');
    }

    const isParticipant = await this.conversationRepo.isParticipant(cleanConvId, currentUserId);
    if (!isParticipant) {
      throw new ForbiddenError(
        'You do not have permission to access messages in this conversation',
      );
    }

    const result = await this.messageRepo.findMessagesByCursor(cleanConvId, {
      cursor: options.cursor,
      limit: options.limit || 50,
      direction: options.direction || 'before',
    });

    const messageIds = result.messages.map((doc) => doc._id.toString());
    const receipts = await this.receiptRepo.getReceiptsForMessages(messageIds);

    const receiptMap = new Map<
      string,
      Array<{ status: string; deliveredAt?: Date | null; readAt?: Date | null }>
    >();
    receipts.forEach((r) => {
      const msgIdStr = r.messageId.toString();
      if (!receiptMap.has(msgIdStr)) receiptMap.set(msgIdStr, []);
      receiptMap.get(msgIdStr)!.push(r);
    });

    const decoratedMessages = result.messages.map((doc) => {
      const json = doc.toJSON() as Record<string, unknown>;
      const msgReceipts = receiptMap.get(doc._id.toString()) || [];

      let deliveryStatus = 'sent';
      let deliveredAt: string | undefined = undefined;
      let readAt: string | undefined = undefined;

      if (msgReceipts.some((r) => r.status === 'read')) {
        deliveryStatus = 'read';
        const readR = msgReceipts.find((r) => r.status === 'read' && r.readAt);
        readAt = readR?.readAt?.toISOString();
        deliveredAt = readR?.deliveredAt?.toISOString();
      } else if (msgReceipts.some((r) => r.status === 'delivered')) {
        deliveryStatus = 'delivered';
        const delivR = msgReceipts.find((r) => r.status === 'delivered' && r.deliveredAt);
        deliveredAt = delivR?.deliveredAt?.toISOString();
      }

      json['status'] = deliveryStatus;
      json['deliveredAt'] = deliveredAt;
      json['readAt'] = readAt;

      return json;
    });

    return {
      messages: decoratedMessages,
      nextCursor: result.nextCursor,
      prevCursor: result.prevCursor,
      hasMore: result.hasMore,
      limit: result.limit,
    };
  }

  /**
   * Marks all messages in a conversation as read for the calling participant.
   */
  public async markConversationAsRead(
    conversationId: string,
    currentUserId: string,
  ): Promise<number> {
    const cleanConvId = conversationId.trim();
    if (!Types.ObjectId.isValid(cleanConvId)) {
      throw new BadRequestError('Invalid conversation ID format');
    }

    const isParticipant = await this.conversationRepo.isParticipant(cleanConvId, currentUserId);
    if (!isParticipant) {
      throw new ForbiddenError('You do not have permission to access this conversation');
    }

    return this.receiptRepo.markConversationAsRead(cleanConvId, currentUserId);
  }
}

export const conversationService = new ConversationService();
