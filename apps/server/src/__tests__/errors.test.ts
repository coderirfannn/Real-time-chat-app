import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
  DatabaseError,
  RedisError,
} from '../errors/index.js';
import { ErrorCode } from '../errors/error-codes.js';
import { errorHandler } from '../middleware/error.middleware.js';
import { requestIdMiddleware } from '../middleware/request-id.middleware.js';

describe('Error Handling System', () => {
  const createTestApp = () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());

    app.get('/test/base-app-error', () => {
      throw new AppError('Custom app error', 418, ErrorCode.BAD_REQUEST, { custom: 'field' });
    });

    app.get('/test/not-found', () => {
      throw new NotFoundError('Item not found');
    });

    app.get('/test/bad-request', () => {
      throw new BadRequestError('Invalid input provided', { field: 'username' });
    });

    app.get('/test/validation-error', () => {
      throw new ValidationError('Validation failed', [{ path: 'email', message: 'invalid email' }]);
    });

    app.get('/test/unauthorized', () => {
      throw new UnauthorizedError('Token expired');
    });

    app.get('/test/forbidden', () => {
      throw new ForbiddenError('Insufficient permissions');
    });

    app.get('/test/conflict', () => {
      throw new ConflictError('User already exists');
    });

    app.get('/test/service-unavailable', () => {
      throw new ServiceUnavailableError('Database offline');
    });

    app.get('/test/database-error', () => {
      throw new DatabaseError('Failed to execute query');
    });

    app.get('/test/redis-error', () => {
      throw new RedisError('Failed to read key');
    });

    app.get('/test/generic-error', () => {
      throw new Error('Unexpected crash');
    });

    app.post('/test/json-body', (req: Request, res: Response) => {
      res.json({ received: req.body });
    });

    app.use(errorHandler);
    return app;
  };

  const app = createTestApp();

  it('handles base AppError correctly', async () => {
    const res = await request(app).get('/test/base-app-error');
    expect(res.status).toBe(418);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(ErrorCode.BAD_REQUEST);
    expect(res.body.message).toBe('Custom app error');
    expect(res.body.details).toEqual({ custom: 'field' });
  });

  it('handles NotFoundError (404)', async () => {
    const res = await request(app).get('/test/not-found');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(ErrorCode.NOT_FOUND);
    expect(res.body.message).toBe('Item not found');
    expect(res.body.requestId).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('handles BadRequestError (400) with details', async () => {
    const res = await request(app).get('/test/bad-request');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(ErrorCode.BAD_REQUEST);
    expect(res.body.details).toEqual({ field: 'username' });
  });

  it('handles ValidationError (422)', async () => {
    const res = await request(app).get('/test/validation-error');
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.details).toBeInstanceOf(Array);
  });

  it('handles UnauthorizedError (401)', async () => {
    const res = await request(app).get('/test/unauthorized');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('handles ForbiddenError (403)', async () => {
    const res = await request(app).get('/test/forbidden');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(ErrorCode.FORBIDDEN);
  });

  it('handles ConflictError (409)', async () => {
    const res = await request(app).get('/test/conflict');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ErrorCode.CONFLICT);
  });

  it('handles ServiceUnavailableError (503)', async () => {
    const res = await request(app).get('/test/service-unavailable');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('handles DatabaseError (500)', async () => {
    const res = await request(app).get('/test/database-error');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe(ErrorCode.DATABASE_ERROR);
  });

  it('handles RedisError (500)', async () => {
    const res = await request(app).get('/test/redis-error');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe(ErrorCode.REDIS_ERROR);
  });

  it('handles generic unhandled errors (500)', async () => {
    const res = await request(app).get('/test/generic-error');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
  });

  it('handles malformed JSON body errors with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/test/json-body')
      .set('Content-Type', 'application/json')
      .send('{ invalid json payload');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(ErrorCode.BAD_REQUEST);
  });
});
