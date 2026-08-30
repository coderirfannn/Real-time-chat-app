import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { RateLimitExceededError } from '../errors/app-error.js';
import { loadServerConfig } from '@chatlock/config';

/**
 * Strict rate limiter for sensitive authentication endpoints (login, register).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // max 20 requests per window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new RateLimitExceededError(
        'Too many authentication attempts. Please try again in 15 minutes.',
        {
          retryAfterSeconds: 900,
        },
      ),
    );
  },
  skip: () => {
    // Skip rate limiting during testing
    return process.env['NODE_ENV'] === 'test';
  },
});

/**
 * General API rate limiter.
 */
export function createGeneralRateLimiter() {
  const config = loadServerConfig();
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(
        new RateLimitExceededError('API rate limit exceeded. Please throttle your requests.', {
          retryAfterSeconds: Math.ceil(config.rateLimit.windowMs / 1000),
        }),
      );
    },
    skip: () => {
      return process.env['NODE_ENV'] === 'test';
    },
  });
}
