import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { userRepository } from '../../repositories/user.repository.js';
import { presenceService } from '../../services/presence.service.js';
import { signAccessToken } from '../../utils/token.js';
import type { IUserDoc } from '../../models/user.model.js';

describe('User API Routes (/api/v1/users) Unit & Integration Tests', () => {
  const app = createApp();

  const { token: callerToken } = signAccessToken({
    sub: '507f1f77bcf86cd799439011',
    email: 'alice@example.com',
    username: 'alice_user',
  });

  const mockUsers: Partial<IUserDoc>[] = [
    {
      id: '507f1f77bcf86cd799439022',
      email: 'bob@example.com',
      username: 'bob_contact',
      displayName: 'Bob Contact',
      status: 'online',
    },
    {
      id: '507f1f77bcf86cd799439033',
      email: 'charlie@example.com',
      username: 'charlie_smith',
      displayName: 'Charlie Smith',
      status: 'offline',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/users/search', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const response = await request(app).get('/api/v1/users/search?q=bob');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('searches users and returns decorated presence', async () => {
      vi.spyOn(userRepository, 'searchUsers').mockResolvedValue(mockUsers as IUserDoc[]);
      vi.spyOn(presenceService, 'getUsersPresence').mockResolvedValue({
        '507f1f77bcf86cd799439022': { status: 'online' },
        '507f1f77bcf86cd799439033': { status: 'offline' },
      });

      const response = await request(app)
        .get('/api/v1/users/search?q=bob')
        .set('Authorization', `Bearer ${callerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]?.username).toBe('bob_contact');
      expect(response.body.data[0]?.status).toBe('online');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('returns user profile when user exists', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockUsers[0] as IUserDoc);
      vi.spyOn(presenceService, 'getUserPresence').mockResolvedValue({ status: 'online' });

      const response = await request(app)
        .get('/api/v1/users/507f1f77bcf86cd799439022')
        .set('Authorization', `Bearer ${callerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('bob_contact');
      expect(response.body.data.status).toBe('online');
    });

    it('returns 404 Not Found when user does not exist', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/users/507f1f77bcf86cd799439099')
        .set('Authorization', `Bearer ${callerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
