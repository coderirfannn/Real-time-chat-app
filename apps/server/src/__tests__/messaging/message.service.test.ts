import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { MessageService } from '../../services/message.service.js';
import type { MessageRepository } from '../../repositories/message.repository.js';
import type { ConversationRepository } from '../../repositories/conversation.repository.js';
import type { MessageReceiptRepository } from '../../repositories/message-receipt.repository.js';
import type { IConversationDoc } from '../../models/conversation.model.js';
import type { IMessageDoc } from '../../models/message.model.js';
import { BadRequestError, ForbiddenError } from '../../errors/app-error.js';

describe('MessageService Unit Tests', () => {
  let mockMessageRepo: Partial<MessageRepository>;
  let mockConvRepo: Partial<ConversationRepository>;
  let mockReceiptRepo: { upsertReceipt: ReturnType<typeof vi.fn> };
  let service: MessageService;

  const senderId = new Types.ObjectId().toString();
  const convId = new Types.ObjectId().toString();
  const msgId = new Types.ObjectId().toString();
  const clientMessageId = 'client-uuid-98765';

  const mockMessageDoc = {
    _id: new Types.ObjectId(msgId),
    conversationId: new Types.ObjectId(convId),
    senderId: new Types.ObjectId(senderId),
    clientMessageId,
    content: 'Hello, World!',
    type: 'text',
    reactions: [],
    createdAt: new Date(),
    toJSON: () => ({
      id: msgId,
      conversationId: convId,
      senderId,
      clientMessageId,
      content: 'Hello, World!',
      type: 'text',
      reactions: [],
      createdAt: new Date().toISOString(),
    }),
  };

  beforeEach(() => {
    mockMessageRepo = {
      findByClientMessageId: vi.fn(),
      createMessage: vi.fn(),
      toggleReaction: vi.fn(),
    };
    mockConvRepo = {
      isParticipant: vi.fn(),
      updateLastMessage: vi.fn(),
      findById: vi.fn(),
    };
    mockReceiptRepo = {
      upsertReceipt: vi.fn().mockResolvedValue(null),
    };
    service = new MessageService(
      mockMessageRepo as MessageRepository,
      mockConvRepo as ConversationRepository,
      mockReceiptRepo as unknown as MessageReceiptRepository,
    );
  });

  describe('sendMessage', () => {
    it('creates a new message and updates conversation last message', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);
      vi.mocked(mockMessageRepo.findByClientMessageId!).mockResolvedValue(null);
      vi.mocked(mockMessageRepo.createMessage!).mockResolvedValue(
        mockMessageDoc as unknown as IMessageDoc,
      );
      vi.mocked(mockConvRepo.updateLastMessage!).mockResolvedValue(null);

      const result = await service.sendMessage(senderId, {
        conversationId: convId,
        clientMessageId,
        content: 'Hello, World!',
        type: 'text',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.message.id).toBe(msgId);
      expect(result.message.content).toBe('Hello, World!');
      expect(mockMessageRepo.createMessage).toHaveBeenCalledWith({
        conversationId: convId,
        senderId,
        clientMessageId,
        type: 'text',
        content: 'Hello, World!',
        attachments: undefined,
        replyToMessageId: undefined,
        encryptionState: 'LEGACY_PLAINTEXT',
        senderDeviceId: undefined,
        e2eePayload: undefined,
      });
      expect(mockConvRepo.updateLastMessage).toHaveBeenCalledWith(
        convId,
        msgId,
        mockMessageDoc.createdAt,
      );
    });

    it('returns existing message on duplicate clientMessageId submission (idempotency)', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);
      vi.mocked(mockMessageRepo.findByClientMessageId!).mockResolvedValue(
        mockMessageDoc as unknown as IMessageDoc,
      );

      const result = await service.sendMessage(senderId, {
        conversationId: convId,
        clientMessageId,
        content: 'Hello, World!',
        type: 'text',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.message.id).toBe(msgId);
      expect(mockMessageRepo.createMessage).not.toHaveBeenCalled();
      expect(mockConvRepo.updateLastMessage).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when sender is not a participant in the conversation', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(false);

      await expect(
        service.sendMessage(senderId, {
          conversationId: convId,
          clientMessageId,
          content: 'Unauthorized message',
          type: 'text',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('initializes sent receipts for all recipients in the conversation', async () => {
      const recipientId = new Types.ObjectId().toString();
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);
      vi.mocked(mockConvRepo.findById!).mockResolvedValue({
        _id: new Types.ObjectId(convId),
        participants: [new Types.ObjectId(senderId), new Types.ObjectId(recipientId)],
      } as unknown as IConversationDoc);
      vi.mocked(mockMessageRepo.findByClientMessageId!).mockResolvedValue(null);
      vi.mocked(mockMessageRepo.createMessage!).mockResolvedValue(
        mockMessageDoc as unknown as IMessageDoc,
      );
      vi.mocked(mockConvRepo.updateLastMessage!).mockResolvedValue(null);

      const result = await service.sendMessage(senderId, {
        conversationId: convId,
        clientMessageId,
        content: 'Hello, World!',
        type: 'text',
      });

      expect(result.participantIds).toContain(recipientId);
      expect(result.participantIds).toContain(senderId);
      expect(mockReceiptRepo.upsertReceipt).toHaveBeenCalledWith({
        messageId: msgId,
        conversationId: convId,
        userId: recipientId,
        status: 'sent',
      });
    });

    it('throws BadRequestError on malformed senderId or conversationId', async () => {
      await expect(
        service.sendMessage('invalid_id', {
          conversationId: convId,
          clientMessageId,
          content: 'Test',
          type: 'text',
        }),
      ).rejects.toThrow(BadRequestError);

      await expect(
        service.sendMessage(senderId, {
          conversationId: 'invalid_conv_id',
          clientMessageId,
          content: 'Test',
          type: 'text',
        }),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('toggleReaction', () => {
    it('successfully toggles reaction on a message for a participant', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);
      vi.mocked(mockConvRepo.findById!).mockResolvedValue({
        _id: new Types.ObjectId(convId),
        participants: [new Types.ObjectId(senderId)],
      } as unknown as IConversationDoc);

      const updatedDoc = {
        ...mockMessageDoc,
        reactions: [{ emoji: '❤️', userId: senderId, createdAt: new Date().toISOString() }],
        toJSON: () => ({
          ...mockMessageDoc.toJSON(),
          reactions: [{ emoji: '❤️', userId: senderId, createdAt: new Date().toISOString() }],
        }),
      };

      vi.mocked(mockMessageRepo.toggleReaction!).mockResolvedValue({
        message: updatedDoc as unknown as IMessageDoc,
        action: 'added',
      });

      const res = await service.toggleReaction(senderId, convId, msgId, '❤️');

      expect(res.action).toBe('added');
      expect(res.reactions).toHaveLength(1);
      expect(res.reactions[0]!.emoji).toBe('❤️');
      expect(mockMessageRepo.toggleReaction).toHaveBeenCalledWith(msgId, senderId, '❤️');
    });

    it('throws ForbiddenError when non-participant attempts to react', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(false);

      await expect(service.toggleReaction(senderId, convId, msgId, '❤️')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });
});
