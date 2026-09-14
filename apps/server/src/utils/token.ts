import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { loadServerConfig } from '@chatlock/config';
import type { JwtPayload } from '@chatlock/shared-types';
import { UnauthorizedError } from '../errors/app-error.js';

/**
 * Generates a high-entropy cryptographically secure random token string for refresh sessions.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Computes the SHA-256 hash of a token for secure database persistence.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Signs a short-lived JWT access token with user payload.
 */
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): {
  token: string;
  expiresInSeconds: number;
} {
  const config = loadServerConfig();
  const secret = config.jwt.accessSecret;
  const expiresIn = config.jwt.accessExpiresIn; // e.g. '15m'

  const token = jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
    },
    secret,
    {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    },
  );

  const expiresInSeconds = parseDurationToSeconds(expiresIn);

  return {
    token,
    expiresInSeconds,
  };
}

/**
 * Verifies and decodes a JWT access token.
 */
export function verifyAccessToken(token: string): JwtPayload {
  const config = loadServerConfig();
  const secret = config.jwt.accessSecret;

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired', { expiredAt: error.expiredAt });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token');
    }
    throw new UnauthorizedError('Authentication verification failed');
  }
}

/**
 * Helper to convert duration string (e.g. '15m', '7d', '24h', '30s') into seconds.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 900; // Default 15 minutes
  }

  const value = parseInt(match[1] || '15', 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 900;
  }
}

/**
 * Calculates a future Date from a duration string (e.g. '7d').
 */
export function calculateFutureDate(duration: string): Date {
  const seconds = parseDurationToSeconds(duration);
  return new Date(Date.now() + seconds * 1000);
}
