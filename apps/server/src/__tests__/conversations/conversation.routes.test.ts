import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../../app.js';
import { conversationService } from '../../services/conversation.service.js';
import { signAccessToken } from '../../utils/token.js';
import { ErrorCode } from '../../errors/error-codes.js';
import { ForbiddenError, NotFoundError } from '../../errors/app-error.js';

describe('Conversation API Routes (/api/v1/conversations)', () => {
  const app = createApp();

  const userAId = new Types.ObjectId().toString();
  const userBId = new Types.ObjectId().toString();
  const convId = new Types.ObjectId().toString();

  const userAToken = signAccessToken({
    sub: userAId,
    email: 'userA@example.com',
    username: 'userA',
  }).token;

  const mockConvDetail = {
    conversation: {
      id: convId,
      type: 'direct',
      participants: [{ id: userAId }, { id: userBId }],
      lastMessageAt: new Date().toISOString(),
    },
    unreadCount: 0,
    isNew: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/conversations', () => {
    it('returns 401 UNAUTHORIZED when called without Bearer token', async () => {
      const res = await request(app).get('/api/v1/conversations');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns 200 and paginated conversation list when authenticated', async () => {
      vi.spyOn(conversationService, 'getUserConversations').mockResolvedValue({
        docs: [mockConvDetail.conversation],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
      });

      const res = await request(app)
        .get('/api/v1/conversations?page=1&limit=20')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.docs.length).toBe(1);
      expect(res.body.data.total).toBe(1);
    });
  });

  describe('POST /api/v1/conversations', () => {
    it('returns 401 UNAUTHORIZED when called without Bearer token', async () => {
      const res = await request(app).post('/api/v1/conversations').send({ recipientId: userBId });

      expect(res.status).toBe(401);
    });

    it('returns 201 when new direct conversation is created', async () => {
      vi.spyOn(conversationService, 'getOrCreateDirectConversation').mockResolvedValue({
        ...mockConvDetail,
        isNew: true,
      });

      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: userBId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isNew).toBe(true);
    });

    it('returns 200 when existing direct conversation is retrieved (deduplication)', async () => {
      vi.spyOn(conversationService, 'getOrCreateDirectConversation').mockResolvedValue({
        ...mockConvDetail,
        isNew: false,
      });

      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: userBId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isNew).toBe(false);
    });

    it('returns 422 VALIDATION_ERROR when recipient is missing', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('GET /api/v1/conversations/:id', () => {
    it('returns 401 UNAUTHORIZED when called without Bearer token', async () => {
      const res = await request(app).get(`/api/v1/conversations/${convId}`);
      expect(res.status).toBe(401);
    });

    it('returns 200 and conversation details when caller is a participant', async () => {
      vi.spyOn(conversationService, 'getConversationById').mockResolvedValue(mockConvDetail);

      const res = await request(app)
        .get(`/api/v1/conversations/${convId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversation.id).toBe(convId);
    });

    it('returns 403 FORBIDDEN when user attempts to access another user conversation (forged ID)', async () => {
      vi.spyOn(conversationService, 'getConversationById').mockRejectedValue(
        new ForbiddenError('You do not have permission to access this conversation'),
      );

      const res = await request(app)
        .get(`/api/v1/conversations/${convId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(ErrorCode.FORBIDDEN);
    });

    it('returns 404 NOT_FOUND when conversation does not exist', async () => {
      vi.spyOn(conversationService, 'getConversationById').mockRejectedValue(
        new NotFoundError('Conversation not found'),
      );

      const res = await request(app)
        .get(`/api/v1/conversations/${convId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe(ErrorCode.NOT_FOUND);
    });

    it('returns 422 VALIDATION_ERROR on malformed conversation ID format', async () => {
      const res = await request(app)
        .get('/api/v1/conversations/not-a-valid-object-id')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });
});
