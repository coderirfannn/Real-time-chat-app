export interface RetryOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  maxAttempts?: number;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  jitterFactor: 0.25,
  maxAttempts: 5,
};

const NON_RETRYABLE_ERROR_CODES = new Set([
  'FORBIDDEN',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'INVALID_PAYLOAD',
  'CONVERSATION_NOT_FOUND',
  'CONVERSATION_DELETED',
  'USER_BLOCKED',
  'BAD_REQUEST',
]);

const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 422]);

/**
 * Determines whether an error is retryable based on its error code, status, or message.
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return true;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('forbidden') ||
      msg.includes('unauthorized') ||
      msg.includes('validation error') ||
      msg.includes('not a participant') ||
      msg.includes('permission') ||
      msg.includes('invalid objectid')
    ) {
      return false;
    }
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;

    // 1. Check specific error codes
    const code = String(errObj.errorCode || errObj.code || '');
    if (code && NON_RETRYABLE_ERROR_CODES.has(code.toUpperCase())) {
      return false;
    }

    // 2. Check HTTP status codes
    const status = Number(errObj.statusCode || errObj.status);
    if (status && NON_RETRYABLE_STATUS_CODES.has(status)) {
      return false;
    }

    // 3. Check error message patterns
    const msg = String(errObj.message || '').toLowerCase();
    if (
      msg.includes('forbidden') ||
      msg.includes('unauthorized') ||
      msg.includes('validation error') ||
      msg.includes('not a participant') ||
      msg.includes('permission') ||
      msg.includes('invalid objectid')
    ) {
      return false;
    }
  }

  // Network drops, timeouts, socket disconnects, 5xx server errors are all retryable
  return true;
}

/**
 * Calculates controlled exponential backoff delay with jitter.
 * Formula: delay = Math.min(maxDelay, baseDelay * 2^attempt) + jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): number {
  const baseDelay = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelay = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const jitterFactor = options.jitterFactor ?? DEFAULT_RETRY_OPTIONS.jitterFactor;

  // Safe exponential calculation
  const exponent = Math.max(0, Math.min(attempt, 10));
  const exponential = baseDelay * Math.pow(2, exponent);
  const cappedDelay = Math.min(maxDelay, exponential);

  // Add random jitter to prevent thundering herd problem
  const jitterRange = cappedDelay * jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  const finalDelay = Math.max(baseDelay / 2, Math.floor(cappedDelay + jitter));

  return finalDelay;
}

/**
 * Checks if a message has exceeded its maximum retry quota.
 */
export function hasExceededMaxRetries(
  attempts: number,
  maxAttempts: number = DEFAULT_RETRY_OPTIONS.maxAttempts,
): boolean {
  return attempts >= maxAttempts;
}
