import { ErrorCode } from './error-codes.js';

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly details?: ErrorDetails | Array<unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: ErrorDetails | Array<unknown>,
    isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: ErrorDetails | Array<unknown>) {
    super(message, 400, ErrorCode.BAD_REQUEST, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: ErrorDetails | Array<unknown>) {
    super(message, 422, ErrorCode.VALIDATION_ERROR, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', details?: ErrorDetails | Array<unknown>) {
    super(message, 401, ErrorCode.UNAUTHORIZED, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: ErrorDetails | Array<unknown>) {
    super(message, 403, ErrorCode.FORBIDDEN, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: ErrorDetails | Array<unknown>) {
    super(message, 404, ErrorCode.NOT_FOUND, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: ErrorDetails | Array<unknown>) {
    super(message, 409, ErrorCode.CONFLICT, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large', details?: ErrorDetails | Array<unknown>) {
    super(message, 413, ErrorCode.PAYLOAD_TOO_LARGE, details);
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message = 'Rate limit exceeded', details?: ErrorDetails | Array<unknown>) {
    super(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details?: ErrorDetails | Array<unknown>) {
    super(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, details, false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', details?: ErrorDetails | Array<unknown>) {
    super(message, 503, ErrorCode.SERVICE_UNAVAILABLE, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details?: ErrorDetails | Array<unknown>) {
    super(message, 500, ErrorCode.DATABASE_ERROR, details);
  }
}

export class RedisError extends AppError {
  constructor(message = 'Redis operation failed', details?: ErrorDetails | Array<unknown>) {
    super(message, 500, ErrorCode.REDIS_ERROR, details);
  }
}
