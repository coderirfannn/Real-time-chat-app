import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { requestIdMiddleware, REQUEST_ID_HEADER } from '../middleware/request-id.middleware.js';
import { notFoundMiddleware } from '../middleware/not-found.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { errorHandler } from '../middleware/error.middleware.js';

describe('Server Middlewares', () => {
  describe('Request ID Middleware', () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test/id', (req: Request, res: Response) => {
      res.json({ id: req.id });
    });

    it('generates a new UUID when no x-request-id is passed', async () => {
      const res = await request(app).get('/test/id');
      expect(res.status).toBe(200);
      expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
      expect(res.body.id).toBe(res.headers[REQUEST_ID_HEADER]);
    });

    it('propagates incoming x-request-id when provided', async () => {
      const customId = 'custom-trace-id-12345';
      const res = await request(app).get('/test/id').set(REQUEST_ID_HEADER, customId);
      expect(res.status).toBe(200);
      expect(res.headers[REQUEST_ID_HEADER]).toBe(customId);
      expect(res.body.id).toBe(customId);
    });
  });

  describe('Validation Middleware', () => {
    const app = express();
    app.use(express.json());

    const bodySchema = z.object({
      name: z.string().min(2),
      age: z.number().positive(),
    });

    app.post('/test/validate', validate({ body: bodySchema }), (req: Request, res: Response) => {
      res.json({ data: req.body });
    });

    app.use(errorHandler);

    it('passes valid request body to controller', async () => {
      const res = await request(app).post('/test/validate').send({ name: 'Alice', age: 25 });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ name: 'Alice', age: 25 });
    });

    it('rejects invalid request body with 422 and validation details', async () => {
      const res = await request(app).post('/test/validate').send({ name: 'A', age: -5 });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details.length).toBeGreaterThan(0);
    });
  });

  describe('404 Not Found Middleware', () => {
    const app = express();
    app.use(notFoundMiddleware);
    app.use(errorHandler);

    it('intercepts unknown routes and returns 404', async () => {
      const res = await request(app).get('/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });
});
