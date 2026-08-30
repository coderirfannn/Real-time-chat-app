import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const httpLogger = logger.child('HTTP');

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (config.app.env === 'test' || config.logging.level === 'silent') {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;

    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    if (statusCode >= 500) {
      httpLogger.error(`${req.method} ${req.originalUrl} ${statusCode} - ${durationMs}ms`, logData);
    } else if (statusCode >= 400) {
      httpLogger.warn(`${req.method} ${req.originalUrl} ${statusCode} - ${durationMs}ms`, logData);
    } else {
      httpLogger.info(`${req.method} ${req.originalUrl} ${statusCode} - ${durationMs}ms`, logData);
    }
  });

  next();
}
