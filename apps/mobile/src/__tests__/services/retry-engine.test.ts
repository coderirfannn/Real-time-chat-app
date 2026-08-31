import { describe, it, expect } from 'vitest';
import {
  isRetryableError,
  calculateBackoffDelay,
  hasExceededMaxRetries,
} from '../../services/retry/retry-engine';

describe('RetryEngine Unit Tests & Error Classification', () => {
  describe('isRetryableError', () => {
    it('classifies network, timeout, and socket disconnects as retryable', () => {
      expect(isRetryableError({ errorCode: 'SOCKET_DISCONNECTED' })).toBe(true);
      expect(isRetryableError({ errorCode: 'NETWORK_ERROR' })).toBe(true);
      expect(isRetryableError({ errorCode: 'TIMEOUT' })).toBe(true);
      expect(isRetryableError({ statusCode: 503, message: 'Service Unavailable' })).toBe(true);
      expect(isRetryableError({ statusCode: 500, message: 'Internal Server Error' })).toBe(true);
      expect(isRetryableError(new Error('Network request failed'))).toBe(true);
    });

    it('classifies client authorization and validation errors as NON-retryable', () => {
      expect(isRetryableError({ errorCode: 'FORBIDDEN' })).toBe(false);
      expect(isRetryableError({ errorCode: 'UNAUTHORIZED' })).toBe(false);
      expect(isRetryableError({ errorCode: 'VALIDATION_ERROR' })).toBe(false);
      expect(isRetryableError({ errorCode: 'NOT_FOUND' })).toBe(false);
      expect(isRetryableError({ statusCode: 403 })).toBe(false);
      expect(isRetryableError({ statusCode: 422 })).toBe(false);
      expect(isRetryableError({ statusCode: 400 })).toBe(false);
      expect(
        isRetryableError(
          new Error('You do not have permission to access messages in this conversation'),
        ),
      ).toBe(false);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('scales delay exponentially with attempt count and enforces max delay cap', () => {
      const delay0 = calculateBackoffDelay(0, {
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterFactor: 0,
      });
      const delay1 = calculateBackoffDelay(1, {
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterFactor: 0,
      });
      const delay2 = calculateBackoffDelay(2, {
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterFactor: 0,
      });
      const delay5 = calculateBackoffDelay(5, {
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterFactor: 0,
      });

      expect(delay0).toBe(1000); // 1000 * 2^0
      expect(delay1).toBe(2000); // 1000 * 2^1
      expect(delay2).toBe(4000); // 1000 * 2^2
      expect(delay5).toBe(10000); // capped at maxDelayMs 10000
    });

    it('applies randomized jitter within expected range', () => {
      const delay = calculateBackoffDelay(2, {
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterFactor: 0.2,
      });
      // Base: 4000, Jitter: ±20% => [3200, 4800]
      expect(delay).toBeGreaterThanOrEqual(3200);
      expect(delay).toBeLessThanOrEqual(4800);
    });
  });

  describe('hasExceededMaxRetries', () => {
    it('returns true once attempt count reaches or exceeds max limit', () => {
      expect(hasExceededMaxRetries(0, 5)).toBe(false);
      expect(hasExceededMaxRetries(4, 5)).toBe(false);
      expect(hasExceededMaxRetries(5, 5)).toBe(true);
      expect(hasExceededMaxRetries(6, 5)).toBe(true);
    });
  });
});
