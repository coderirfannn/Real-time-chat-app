import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Health Endpoints', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('returns system health overview with 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBeDefined();
      expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.data.services).toBeDefined();
      expect(res.body.data.services.mongodb).toBeDefined();
      expect(res.body.data.services.redis).toBeDefined();
    });
  });

  describe('GET /health/live', () => {
    it('returns 200 OK for liveness check', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /health/ready', () => {
    it('evaluates readiness and returns structured status', async () => {
      const res = await request(app).get('/health/ready');
      // When dependencies are not connected, returns 503; if connected, returns 200
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.ready).toBe(true);
      } else {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('SERVICE_UNAVAILABLE');
      }
    });
  });

  describe('API-prefixed health routes', () => {
    it('GET /api/v1/health responds with 200 OK', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/health/live responds with 200 OK', async () => {
      const res = await request(app).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
