import type { Event } from 'socket.io';
import type { AuthenticatedSocket } from './auth.socket.middleware.js';
import { SocketEvents } from '@chatlock/shared-types';
import { ErrorCode } from '../../errors/error-codes.js';
import { logger } from '../../utils/logger.js';

const rateLimitLogger = logger.child('SocketRateLimiter');

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const socketBuckets = new Map<string, RateLimitBucket>();

const WINDOW_MS = 1000; // 1 second sliding window
const MAX_EVENTS_PER_WINDOW = 40; // max 40 events per second per socket

/**
 * Socket.IO packet middleware that throttles excessive incoming event floods per socket.
 */
export function socketRateLimitMiddleware(
  socket: AuthenticatedSocket,
  packet: Event,
  next: (err?: Error) => void,
): void {
  // Allow connect/disconnect internals
  const eventName = packet[0];
  if (eventName === 'disconnect' || eventName === 'error') {
    return next();
  }

  const now = Date.now();
  const socketId = socket.id;

  let bucket = socketBuckets.get(socketId);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + WINDOW_MS };
    socketBuckets.set(socketId, bucket);
    return next();
  }

  bucket.count += 1;

  if (bucket.count > MAX_EVENTS_PER_WINDOW) {
    rateLimitLogger.warn('Socket event rate limit exceeded', {
      socketId,
      userId: socket.data?.user?.id,
      event: eventName,
      count: bucket.count,
    });

    socket.emit(SocketEvents.ERROR, {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many real-time events sent. Please slow down.',
    });

    // Drop flood packet
    return;
  }

  next();
}

/**
 * Cleans up socket rate limiting bucket on disconnect.
 */
export function clearSocketRateLimit(socketId: string): void {
  socketBuckets.delete(socketId);
}
