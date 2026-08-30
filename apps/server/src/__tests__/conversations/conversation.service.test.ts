import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { ConversationService } from '../../services/conversation.service.js';
import type { ConversationRepository } from '../../repositories/conversation.repository.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import type { MessageReceiptRepository } from '../../repositories/message-receipt.repository.js';
import type { IConversationDoc } from '../../models/conversation.model.js';
import type { IUserDoc } from '../../models/user.model.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors/app-error.js';

describe('ConversationService Unit Tests', () => {
  let mockConvRepo: Partial<ConversationRepository>;
  let mockUserRepo: Partial<UserRepository>;
  let mockReceiptRepo: Partial<MessageReceiptRepository>;
  let service: ConversationService;

  const userAId = new Types.ObjectId().toString();
  const userBId = new Types.ObjectId().toString();
  const userCId = new Types.ObjectId().toString();
  const convId = new Types.ObjectId().toString();

  const mockUserB = {
    _id: new Types.ObjectId(userBId),
    username: 'bob_user',
    displayName: 'Bob',
  };

  const mockConversationDoc = {
    _id: new Types.ObjectId(convId),
    type: 'direct',
    participants: [{ _id: new Types.ObjectId(userAId) }, { _id: new Types.ObjectId(userBId) }],
    lastMessageAt: new Date(),
    toJSON: () => ({
      id: convId,
      type: 'direct',
      participants: [{ id: userAId }, { id: userBId }],
    }),
  };

  beforeEach(() => {
    mockConvRepo = {
      findDirectConversation: vi.fn(),
      createDirectConversation: vi.fn(),
      findUserConversationsWithDetails: vi.fn(),
      findPopulatedById: vi.fn(),
      isParticipant: vi.fn(),
    };

    mockUserRepo = {
      findById: vi.fn(),
    };

    mockReceiptRepo = {
      getUnreadCount: vi.fn().mockResolvedValue(0),
    };

    service = new ConversationService(
      mockConvRepo as ConversationRepository,
      mockUserRepo as UserRepository,
      mockReceiptRepo as MessageReceiptRepository,
    );
  });

  describe('getOrCreateDirectConversation', () => {
    it('creates a new direct conversation when none exists', async () => {
      vi.mocked(mockUserRepo.findById!).mockResolvedValue(mockUserB as unknown as IUserDoc);
      vi.mocked(mockConvRepo.findDirectConversation!).mockResolvedValue(null);
      vi.mocked(mockConvRepo.createDirectConversation!).mockResolvedValue(
        mockConversationDoc as unknown as IConversationDoc,
      );

      const result = await service.getOrCreateDirectConversation(userAId, userBId);

      expect(result.isNew).toBe(true);
      expect(result.unreadCount).toBe(0);
      expect(result.conversation['id']).toBe(convId);
      expect(mockConvRepo.createDirectConversation).toHaveBeenCalledWith(userAId, userBId);
    });

    it('returns existing direct conversation when one already exists (deduplication)', async () => {
      vi.mocked(mockUserRepo.findById!).mockResolvedValue(mockUserB as unknown as IUserDoc);
      vi.mocked(mockConvRepo.findDirectConversation!).mockResolvedValue(
        mockConversationDoc as unknown as IConversationDoc,
      );
      vi.mocked(mockReceiptRepo.getUnreadCount!).mockResolvedValue(3);

      const result = await service.getOrCreateDirectConversation(userAId, userBId);

      expect(result.isNew).toBe(false);
      expect(result.unreadCount).toBe(3);
      expect(mockConvRepo.createDirectConversation).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when user attempts to chat with themselves', async () => {
      await expect(service.getOrCreateDirectConversation(userAId, userAId)).rejects.toThrow(
        BadRequestError,
      );
    });

    it('throws BadRequestError on invalid recipient ID format', async () => {
      await expect(
        service.getOrCreateDirectConversation(userAId, 'invalid-id-format'),
      ).rejects.toThrow(BadRequestError);
    });

    it('throws NotFoundError when recipient does not exist', async () => {
      vi.mocked(mockUserRepo.findById!).mockResolvedValue(null);

      await expect(service.getOrCreateDirectConversation(userAId, userBId)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getUserConversations', () => {
    it('returns paginated conversations with unread metadata attached', async () => {
      vi.mocked(mockConvRepo.findUserConversationsWithDetails!).mockResolvedValue({
        docs: [mockConversationDoc as unknown as IConversationDoc],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
      });
      vi.mocked(mockReceiptRepo.getUnreadCount!).mockResolvedValue(5);

      const result = await service.getUserConversations(userAId, { page: 1, limit: 20 });

      expect(result.docs.length).toBe(1);
      expect(result.docs[0]!['unreadCount']).toBe(5);
      expect(result.total).toBe(1);
    });
  });

  describe('getConversationById (Authorization & Security)', () => {
    it('returns conversation details when caller is an active participant', async () => {
      vi.mocked(mockConvRepo.findPopulatedById!).mockResolvedValue(
        mockConversationDoc as unknown as IConversationDoc,
      );
      vi.mocked(mockReceiptRepo.getUnreadCount!).mockResolvedValue(2);

      const result = await service.getConversationById(convId, userAId);

      expect(result.conversation['id']).toBe(convId);
      expect(result.unreadCount).toBe(2);
    });

    it('throws ForbiddenError when caller is NOT a participant in the conversation', async () => {
      vi.mocked(mockConvRepo.findPopulatedById!).mockResolvedValue(
        mockConversationDoc as unknown as IConversationDoc,
      );

      // Caller userC is not in [userA, userB]
      await expect(service.getConversationById(convId, userCId)).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when conversation does not exist', async () => {
      vi.mocked(mockConvRepo.findPopulatedById!).mockResolvedValue(null);

      await expect(
        service.getConversationById(new Types.ObjectId().toString(), userAId),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws BadRequestError on malformed conversation ID format', async () => {
      await expect(service.getConversationById('invalid_conv_id', userAId)).rejects.toThrow(
        BadRequestError,
      );
    });
  });
});
