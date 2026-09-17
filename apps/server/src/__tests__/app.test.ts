import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { ErrorCode } from '../errors/error-codes.js';

describe('Server Application Integration', () => {
  const app = createApp();

  it('GET / responds with API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBeDefined();
    expect(res.body.data.version).toBe('0.1.0');
  });

  it('GET /health responds with 200 OK and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
    expect(res.body.data.environment).toBeDefined();
  });

  it('GET /api/v1/health responds with 200 OK', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
  });

  it('GET /api/v1/docs responds with 200 OK and structured documentation', async () => {
    const res = await request(app).get('/api/v1/docs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.namespaces).toBeInstanceOf(Array);
    expect(res.body.data.socketEvents).toBeDefined();
  });

  it('GET /non-existent-route responds with 404 and stable error code', async () => {
    const res = await request(app).get('/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(ErrorCode.NOT_FOUND);
  });
});
