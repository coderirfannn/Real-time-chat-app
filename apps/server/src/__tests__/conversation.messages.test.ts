import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { conversationService } from '../services/conversation.service.js';
import { signAccessToken } from '../utils/token.js';
import { ForbiddenError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';

describe('GET /api/v1/conversations/:id/messages Integration Tests', () => {
  const app = createApp();

  const mockUserAId = new Types.ObjectId().toString();
  const validConversationId = new Types.ObjectId().toString();
  let userAToken: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    userAToken = signAccessToken({
      sub: mockUserAId,
      email: 'userA@example.com',
      username: 'userA',
    }).token;
  });

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get(`/api/v1/conversations/${validConversationId}/messages`);
    expect(res.status).toBe(401);
  });

  it('rejects access when user is not a participant in the conversation', async () => {
    vi.spyOn(conversationService, 'getConversationMessages').mockRejectedValue(
      new ForbiddenError('You do not have permission to access messages in this conversation'),
    );

    const res = await request(app)
      .get(`/api/v1/conversations/${validConversationId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(ErrorCode.FORBIDDEN);
  });

  it('returns cursor-paginated message history for authorized participant', async () => {
    const mockMessagesResult = {
      messages: [
        {
          _id: new Types.ObjectId().toString(),
          conversationId: validConversationId,
          senderId: { _id: mockUserAId, username: 'userA', displayName: 'User A' },
          content: 'Hello World',
          type: 'text',
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
      limit: 50,
    };

    vi.spyOn(conversationService, 'getConversationMessages').mockResolvedValue(mockMessagesResult);

    const res = await request(app)
      .get(`/api/v1/conversations/${validConversationId}/messages?limit=50`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.messages).toHaveLength(1);
    expect(res.body.data.messages[0].content).toBe('Hello World');
    expect(res.body.data.hasMore).toBe(false);
  });
});
