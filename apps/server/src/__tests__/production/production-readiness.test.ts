import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { parseAndValidateServerEnv } from '@chatlock/config';
import { parseAndValidateMobileEnv } from '@chatlock/config/mobile';
import { healthController } from '../../controllers/health.controller.js';
import { errorHandler } from '../../middleware/error.middleware.js';

describe('Production Readiness & Deployment Safety Verification Tests', () => {
  describe('1. Server Environment Configuration & Validation', () => {
    it('parses comma-separated production CORS origins into an origin array', () => {
      const config = parseAndValidateServerEnv({
        NODE_ENV: 'production',
        PORT: '10000',
        MONGODB_URI: 'mongodb://atlas.example.com/chatlock',
        REDIS_URL: 'rediss://default:secret@redis.example.com:6379/0',
        JWT_ACCESS_SECRET: 'production_jwt_access_secret_very_long_32chars!',
        JWT_REFRESH_SECRET: 'production_jwt_refresh_secret_very_long_32chars!',
        CORS_ORIGIN: 'https://chatlock.com,https://chatlock.vercel.app',
        SOCKET_CORS_ORIGIN: 'https://chatlock.com,https://chatlock.vercel.app',
      });

      expect(config.app.isProduction).toBe(true);
      expect(config.app.port).toBe(10000);
      expect(config.app.corsOrigins).toEqual([
        'https://chatlock.com',
        'https://chatlock.vercel.app',
      ]);
      expect(config.socket.corsOrigins).toEqual([
        'https://chatlock.com',
        'https://chatlock.vercel.app',
      ]);
    });

    it('rejects short JWT secrets in production environment', () => {
      expect(() =>
        parseAndValidateServerEnv({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'short',
        }),
      ).toThrow('[Config Error]');
    });
  });

  describe('2. Client Secret Isolation & Filter', () => {
    it('detects and warns on backend secret keys in mobile environment source', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mobile = parseAndValidateMobileEnv({
        EXPO_PUBLIC_API_URL: 'https://api.chatlock.com/api/v1',
        EXPO_PUBLIC_SOCKET_URL: 'https://api.chatlock.com',
        EXPO_PUBLIC_APP_ENV: 'production',
        MONGODB_URI: 'mongodb://atlas.example.com',
        CLOUDINARY_API_SECRET: 'super_secret_cloudinary_key',
      });

      expect(mobile.isProduction).toBe(true);
      expect(mobile.apiUrl).toBe('https://api.chatlock.com/api/v1');
      expect(mobile.socketUrl).toBe('https://api.chatlock.com');
      // Verify warning triggered
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('CLOUDINARY_API_SECRET'));
      warnSpy.mockRestore();
    });
  });

  describe('3. Production Error Handler Sanitization (Zero Stack Trace Leak)', () => {
    it('suppresses internal error details and hides stack traces in production', async () => {
      const app = express();

      app.get('/test-error', () => {
        throw new Error('Sensitive database connection string leaked in error');
      });

      app.use(errorHandler);

      const response = await request(app).get('/test-error');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // Verify no stack trace in response body
      expect(response.body.stack).toBeUndefined();
      expect(response.body.details).toBeUndefined();
    });
  });

  describe('4. Health & Liveness Endpoints for Render Orchestrator', () => {
    it('provides liveness endpoint returning 200 with uptime', async () => {
      const app = express();
      app.get('/health/live', healthController.getLiveness);

      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(typeof res.body.data.uptime).toBe('number');
    });
  });
});
