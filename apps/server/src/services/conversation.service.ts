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
import type { PaginatedResult } from '../repositories/base.repository.js';
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
   * Retrieves paginated messages for a conversation, enforcing participant access.
   */
  public async getConversationMessages(
    conversationId: string,
    currentUserId: string,
    pagination: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResult<Record<string, unknown>>> {
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

    const result = await this.messageRepo.findConversationHistory(cleanConvId, {
      page: pagination.page || 1,
      limit: pagination.limit || 50,
    });

    return {
      docs: result.docs.map((doc) => doc.toJSON()),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    };
  }
}

export const conversationService = new ConversationService();
