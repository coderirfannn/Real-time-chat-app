import { describe, it, expect } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware.js';
import { errorHandler } from '../../middleware/error.middleware.js';
import { signAccessToken } from '../../utils/token.js';
import { ErrorCode } from '../../errors/error-codes.js';

describe('Auth Middleware', () => {
  const createTestApp = () => {
    const app = express();
    app.use(express.json());

    app.get('/protected', requireAuth, (req: Request, res: Response) => {
      res.json({ success: true, user: req.user });
    });

    app.get('/optional', optionalAuth, (req: Request, res: Response) => {
      res.json({ success: true, user: req.user || null });
    });

    app.use(errorHandler);
    return app;
  };

  const app = createTestApp();

  describe('requireAuth', () => {
    it('returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
      const res = await request(app).get('/protected');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns 401 UNAUTHORIZED when header format is not Bearer', async () => {
      const res = await request(app).get('/protected').set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns 401 UNAUTHORIZED when token is invalid or tampered', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.tampered.token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('allows access and attaches req.user when token is valid', async () => {
      const { token } = signAccessToken({
        sub: '507f1f77bcf86cd799439011',
        email: 'dev@chatlock.app',
        username: 'chat_dev',
      });

      const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toEqual({
        id: '507f1f77bcf86cd799439011',
        email: 'dev@chatlock.app',
        username: 'chat_dev',
      });
    });
  });

  describe('optionalAuth', () => {
    it('continues without user when header is missing', async () => {
      const res = await request(app).get('/optional');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it('continues without user when token is invalid', async () => {
      const res = await request(app).get('/optional').set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it('attaches req.user when valid token is provided', async () => {
      const { token } = signAccessToken({
        sub: '507f1f77bcf86cd799439012',
        email: 'user@chatlock.app',
        username: 'regular_user',
      });

      const res = await request(app).get('/optional').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: '507f1f77bcf86cd799439012',
        email: 'user@chatlock.app',
        username: 'regular_user',
      });
    });
  });
});
