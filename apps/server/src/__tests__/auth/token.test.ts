import { describe, it, expect } from 'vitest';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  parseDurationToSeconds,
  calculateFutureDate,
} from '../../utils/token.js';
import { UnauthorizedError } from '../../errors/app-error.js';

describe('Token Security Utility', () => {
  it('generates high-entropy random refresh tokens', () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();

    expect(token1).toBeDefined();
    expect(token1.length).toBe(80); // 40 bytes hex = 80 chars
    expect(token1).not.toBe(token2);
  });

  it('generates deterministic SHA-256 hashes for tokens', () => {
    const raw = 'my_raw_refresh_token_123';
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('signs and verifies valid JWT access tokens', () => {
    const payload = {
      sub: '507f1f77bcf86cd799439011',
      email: 'alex@example.com',
      username: 'alex_dev',
    };

    const { token, expiresInSeconds } = signAccessToken(payload);
    expect(token).toBeDefined();
    expect(expiresInSeconds).toBeGreaterThan(0);

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.username).toBe(payload.username);
  });

  it('throws UnauthorizedError when verifying tampered tokens', () => {
    const { token } = signAccessToken({
      sub: 'user123',
      email: 'user@example.com',
      username: 'user',
    });

    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(() => verifyAccessToken(tampered)).toThrow(UnauthorizedError);
  });

  it('parses duration strings correctly', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('24h')).toBe(86400);
    expect(parseDurationToSeconds('7d')).toBe(604800);
  });

  it('calculates future dates based on durations', () => {
    const now = Date.now();
    const future = calculateFutureDate('1h');

    const diff = future.getTime() - now;
    expect(diff).toBeGreaterThanOrEqual(3590 * 1000);
    expect(diff).toBeLessThanOrEqual(3610 * 1000);
  });
});
