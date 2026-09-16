import type { Request, Response, NextFunction } from 'express';
import { metricsService } from './metrics.service.js';

/**
 * Express Middleware for recording HTTP latency and status codes in Prometheus metrics.
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startHrTime = process.hrtime.bigint();
  metricsService.incrementActiveHttpRequests();

  res.on('finish', () => {
    metricsService.decrementActiveHttpRequests();
    const endHrTime = process.hrtime.bigint();
    const durationMs = Number(endHrTime - startHrTime) / 1_000_000;

    const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path || req.url;
    metricsService.recordHttpRequest(req.method, path, res.statusCode, durationMs);
  });

  next();
}
