import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { authService } from '../../services/auth.service.js';
import { signAccessToken } from '../../utils/token.js';
import { ErrorCode } from '../../errors/error-codes.js';
import type { AuthResponse, UserProfile } from '@chatlock/shared-types';

describe('Auth API Routes (/api/v1/auth)', () => {
  const app = createApp();

  const mockUser: UserProfile = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    username: 'test_user',
    displayName: 'Test User',
    status: 'online',
  };

  const mockTokens = {
    accessToken: 'mock_jwt_access_token_123',
    refreshToken: 'mock_raw_refresh_token_456',
    expiresIn: 900,
    tokenType: 'Bearer' as const,
  };

  const mockAuthResponse: AuthResponse = {
    user: mockUser,
    tokens: mockTokens,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('returns 201 and auth payload on valid registration', async () => {
      vi.spyOn(authService, 'register').mockResolvedValue(mockAuthResponse);

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        username: 'test_user',
        displayName: 'Test User',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('test_user');
      expect(res.body.data.tokens.accessToken).toBe('mock_jwt_access_token_123');
    });

    it('returns 422 VALIDATION_ERROR on malformed email or weak password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'invalid-email',
        username: 'tu',
        displayName: '',
        password: 'weak',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 and auth payload on valid login', async () => {
      vi.spyOn(authService, 'login').mockResolvedValue(mockAuthResponse);

      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'test_user',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('test_user');
    });

    it('returns 422 VALIDATION_ERROR when required fields are missing', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});

      expect(res.status).toBe(422);
      expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates refresh token and returns 200 with new tokens', async () => {
      vi.spyOn(authService, 'refreshToken').mockResolvedValue(mockAuthResponse);

      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: 'existing_raw_refresh_token',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes session and returns 200', async () => {
      vi.spyOn(authService, 'logout').mockResolvedValue({ success: true });

      const res = await request(app).post('/api/v1/auth/logout').send({
        refreshToken: 'token_to_logout',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('returns 401 when called without Bearer token', async () => {
      const res = await request(app).post('/api/v1/auth/logout-all');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('revokes all sessions when called with valid Bearer token', async () => {
      vi.spyOn(authService, 'logoutAll').mockResolvedValue({ revokedSessionsCount: 3 });

      const { token } = signAccessToken({
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        username: 'test_user',
      });

      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revokedSessionsCount).toBe(3);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 when called without Bearer token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns current user profile when called with valid Bearer token', async () => {
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser);

      const { token } = signAccessToken({
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        username: 'test_user',
      });

      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('507f1f77bcf86cd799439011');
      expect(res.body.data.username).toBe('test_user');
    });
  });
});
