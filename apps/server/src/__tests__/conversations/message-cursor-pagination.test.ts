import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import express, { type Express } from 'express';
import { conversationService } from '../../services/conversation.service.js';
import conversationRoutes from '../../routes/conversation.routes.js';
import { errorHandler } from '../../middleware/error.middleware.js';
import { signAccessToken } from '../../utils/token.js';
import { ForbiddenError } from '../../errors/app-error.js';
import { ErrorCode } from '../../errors/error-codes.js';

describe('Message Cursor Pagination Route Integration Tests', () => {
  let app: Express;
  const userAId = new Types.ObjectId().toString();
  const userCId = new Types.ObjectId().toString();
  const convId = new Types.ObjectId().toString();

  let userAToken: string;
  let userCToken: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/conversations', conversationRoutes);
    app.use(errorHandler);

    userAToken = signAccessToken({
      sub: userAId,
      username: 'alice',
      email: 'alice@example.com',
    }).token;

    userCToken = signAccessToken({
      sub: userCId,
      username: 'charlie',
      email: 'charlie@example.com',
    }).token;

    vi.restoreAllMocks();
  });

  it('GET /api/v1/conversations/:id/messages returns cursor paginated messages on initial load', async () => {
    const msgId1 = new Types.ObjectId().toString();
    const msgId2 = new Types.ObjectId().toString();

    vi.spyOn(conversationService, 'getConversationMessages').mockResolvedValue({
      messages: [
        { id: msgId1, content: 'Recent message', createdAt: new Date().toISOString() },
        { id: msgId2, content: 'Older message', createdAt: new Date().toISOString() },
      ],
      nextCursor: msgId2,
      prevCursor: msgId1,
      hasMore: true,
      limit: 50,
    });

    const res = await request(app)
      .get(`/api/v1/conversations/${convId}/messages?limit=50`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.messages.length).toBe(2);
    expect(res.body.data.nextCursor).toBe(msgId2);
    expect(res.body.data.hasMore).toBe(true);
    expect(res.body.data.limit).toBe(50);
  });

  it('GET /api/v1/conversations/:id/messages passes cursor parameter for upward historical scrolling', async () => {
    const cursor = new Types.ObjectId().toString();
    const msgId3 = new Types.ObjectId().toString();

    const spy = vi.spyOn(conversationService, 'getConversationMessages').mockResolvedValue({
      messages: [{ id: msgId3, content: 'Even older message' }],
      nextCursor: null,
      prevCursor: msgId3,
      hasMore: false,
      limit: 30,
    });

    const res = await request(app)
      .get(`/api/v1/conversations/${convId}/messages?cursor=${cursor}&limit=30&direction=before`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(convId, userAId, {
      cursor,
      limit: 30,
      direction: 'before',
    });
    expect(res.body.data.hasMore).toBe(false);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it('GET /api/v1/conversations/:id/messages returns 403 FORBIDDEN when caller is not a participant', async () => {
    vi.spyOn(conversationService, 'getConversationMessages').mockRejectedValue(
      new ForbiddenError('You do not have permission to access messages in this conversation'),
    );

    const res = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${userCToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(ErrorCode.FORBIDDEN);
  });

  it('GET /api/v1/conversations/:id/messages returns 422 VALIDATION_ERROR on malformed cursor', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${convId}/messages?cursor=invalid-cursor-format`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
