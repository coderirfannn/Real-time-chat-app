import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import type { ApiResponse, HealthStatus, ApiError } from '@chatlock/shared-types';
import { config } from './config/index.js';

export function createApp(): Express {
  const app = express();

  // Security Middleware
  if (config.security.helmetEnabled) {
    app.use(helmet());
  }

  // CORS Configuration
  app.use(
    cors({
      origin: config.app.corsOrigins.includes('*') ? '*' : config.app.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  );

  // Request Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request Logging
  if (config.app.env !== 'test') {
    app.use(morgan(config.logging.pretty ? 'dev' : 'combined'));
  }

  // Root endpoint
  app.get(
    '/',
    (
      _req: Request,
      res: Response<ApiResponse<{ name: string; version: string; docs: string }>>,
    ) => {
      res.json({
        success: true,
        message: `${config.app.appName} API is running`,
        data: {
          name: config.app.appName,
          version: '0.1.0',
          docs: `${config.app.apiPrefix}/docs`,
        },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // Health check handler
  const handleHealth = (_req: Request, res: Response<ApiResponse<HealthStatus>>) => {
    res.status(200).json({
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.app.env,
      },
      timestamp: new Date().toISOString(),
    });
  };

  // Base and API-prefixed health routes
  app.get('/health', handleHealth);
  app.get(`${config.app.apiPrefix}/health`, handleHealth);

  // 404 Route Handler
  app.use((req: Request, res: Response<ApiError>) => {
    res.status(404).json({
      success: false,
      statusCode: 404,
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString(),
    });
  });

  // Centralized Error Handler
  app.use((err: Error, _req: Request, res: Response<ApiError>, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[Unhandled Server Error]', err);

    res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'Internal Server Error',
      message: config.app.isProduction ? 'An unexpected error occurred' : err.message,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
