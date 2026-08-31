import helmet from 'helmet';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { sanitizeMiddleware } from './sanitize.middleware.js';
import { config } from '../config/index.js';

export function createSecurityMiddlewares(): RequestHandler[] {
  const middlewares: RequestHandler[] = [];

  if (config.security.helmetEnabled) {
    middlewares.push(
      helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
  }

  const corsOrigins = config.app.corsOrigins;
  middlewares.push(
    cors({
      origin: corsOrigins.includes('*') ? '*' : corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id'],
      exposedHeaders: ['x-request-id'],
      maxAge: 86400,
    }),
  );

  middlewares.push(express.json({ limit: '10mb' }));
  middlewares.push(express.urlencoded({ extended: true, limit: '10mb' }));
  middlewares.push(sanitizeMiddleware);

  return middlewares;
}
