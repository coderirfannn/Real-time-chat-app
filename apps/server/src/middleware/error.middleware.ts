import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { ApiError } from '@chatlock/shared-types';

const errorLogger = logger.child('ErrorHandler');

export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiError & { requestId?: string }>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const timestamp = new Date().toISOString();
  const requestId = req.id;

  // 1. Handle Known AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      errorLogger.error(`[${err.errorCode}] ${err.message}`, {
        requestId,
        path: req.originalUrl,
        statusCode: err.statusCode,
        stack: err.stack,
        details: err.details,
      });
    } else {
      errorLogger.warn(`[${err.errorCode}] ${err.message}`, {
        requestId,
        path: req.originalUrl,
        statusCode: err.statusCode,
        details: err.details,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      error: err.errorCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      requestId,
      timestamp,
    });
    return;
  }

  // 2. Handle Zod validation errors
  if (err instanceof ZodError) {
    const formatted = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));

    errorLogger.warn(`[VALIDATION_ERROR] Request schema validation failed`, {
      requestId,
      path: req.originalUrl,
      details: formatted,
    });

    res.status(422).json({
      success: false,
      statusCode: 422,
      error: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed for request parameters',
      details: formatted,
      requestId,
      timestamp,
    });
    return;
  }

  // 3. Handle JSON Body parser syntax errors
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    errorLogger.warn(`[BAD_REQUEST] Invalid JSON syntax in request body`, {
      requestId,
      path: req.originalUrl,
    });

    res.status(400).json({
      success: false,
      statusCode: 400,
      error: ErrorCode.BAD_REQUEST,
      message: 'Malformed JSON payload in request body',
      requestId,
      timestamp,
    });
    return;
  }

  // 4. Handle Uncaught / Unknown Internal Server Errors
  errorLogger.error(`[UNHANDLED_ERROR] ${err.message}`, {
    requestId,
    path: req.originalUrl,
    name: err.name,
    stack: err.stack,
  });

  const responseMessage = config.app.isProduction
    ? 'An unexpected error occurred. Please try again later.'
    : err.message || 'Internal Server Error';

  res.status(500).json({
    success: false,
    statusCode: 500,
    error: ErrorCode.INTERNAL_SERVER_ERROR,
    message: responseMessage,
    requestId,
    timestamp,
  });
}
