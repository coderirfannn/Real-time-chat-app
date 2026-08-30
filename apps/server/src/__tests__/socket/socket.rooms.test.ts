import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { RoomManager } from '../../socket/rooms.js';
import type { ConversationRepository } from '../../repositories/conversation.repository.js';
import type { AuthenticatedSocket } from '../../socket/middleware/auth.socket.middleware.js';

describe('RoomManager Unit Tests', () => {
  let mockConvRepo: Partial<ConversationRepository>;
  let roomManager: RoomManager;

  const validConvId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockConvRepo = {
      isParticipant: vi.fn(),
    };
    roomManager = new RoomManager(mockConvRepo as ConversationRepository);
  });

  describe('parseConversationId', () => {
    it('parses raw 24-character hex ObjectId', () => {
      expect(roomManager.parseConversationId(validConvId)).toBe(validConvId);
    });

    it('parses conversation:{id} prefixed room name', () => {
      expect(roomManager.parseConversationId(`conversation:${validConvId}`)).toBe(validConvId);
    });

    it('returns null on invalid room or non-ObjectId string', () => {
      expect(roomManager.parseConversationId('invalid_id')).toBeNull();
      expect(roomManager.parseConversationId('conversation:invalid_id')).toBeNull();
      expect(roomManager.parseConversationId('')).toBeNull();
    });
  });

  describe('authorizeAndJoinConversation', () => {
    it('allows joining conversation room when caller is a verified participant', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);

      const mockSocket = {
        id: 'socket-1',
        data: { user: { id: userId, email: 'user@example.com', username: 'user1' } },
        join: vi.fn(),
      } as unknown as AuthenticatedSocket;

      const res = await roomManager.authorizeAndJoinConversation(mockSocket, validConvId);

      expect(res.success).toBe(true);
      expect(res.room).toBe(`conversation:${validConvId}`);
      expect(mockSocket.join).toHaveBeenCalledWith(`conversation:${validConvId}`);
      expect(mockConvRepo.isParticipant).toHaveBeenCalledWith(validConvId, userId);
    });

    it('rejects joining conversation room when caller is NOT a participant', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(false);

      const mockSocket = {
        id: 'socket-1',
        data: { user: { id: userId, email: 'user@example.com', username: 'user1' } },
        join: vi.fn(),
      } as unknown as AuthenticatedSocket;

      const res = await roomManager.authorizeAndJoinConversation(mockSocket, validConvId);

      expect(res.success).toBe(false);
      expect(res.error).toBe('You are not authorized to join this conversation');
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('rejects joining room with invalid format', async () => {
      const mockSocket = {
        id: 'socket-1',
        data: { user: { id: userId } },
        join: vi.fn(),
      } as unknown as AuthenticatedSocket;

      const res = await roomManager.authorizeAndJoinConversation(mockSocket, 'malformed-room-name');

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid conversation ID format');
    });
  });

  describe('leaveConversation', () => {
    it('leaves conversation room', async () => {
      const mockSocket = {
        id: 'socket-1',
        data: { user: { id: userId } },
        leave: vi.fn(),
      } as unknown as AuthenticatedSocket;

      const res = await roomManager.leaveConversation(mockSocket, validConvId);

      expect(res.success).toBe(true);
      expect(res.room).toBe(`conversation:${validConvId}`);
      expect(mockSocket.leave).toHaveBeenCalledWith(`conversation:${validConvId}`);
    });
  });
});
