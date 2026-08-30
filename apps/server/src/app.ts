import express, { type Express, type Request, type Response } from 'express';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { loggingMiddleware } from './middleware/logging.middleware.js';
import { createSecurityMiddlewares } from './middleware/security.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { createApiRouter } from './routes/index.js';
import { config } from './config/index.js';
import type { ApiResponse } from '@chatlock/shared-types';

export function createApp(): Express {
  const app = express();

  // 1. Request ID attribution
  app.use(requestIdMiddleware);

  // 2. HTTP access logging
  app.use(loggingMiddleware);

  // 3. Security, CORS, and body parsing
  const securityMiddlewares = createSecurityMiddlewares();
  for (const middleware of securityMiddlewares) {
    app.use(middleware);
  }

  // 4. Root information endpoint
  app.get(
    '/',
    (
      _req: Request,
      res: Response<ApiResponse<{ name: string; version: string; docs: string }>>,
    ) => {
      res.status(200).json({
        success: true,
        message: `${config.app.appName} API is active`,
        data: {
          name: config.app.appName,
          version: '0.1.0',
          docs: `${config.app.apiPrefix}/docs`,
        },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // 5. API Routes (/health, /api/v1/*)
  app.use(createApiRouter());

  // 6. 404 Route Handler
  app.use(notFoundMiddleware);

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
