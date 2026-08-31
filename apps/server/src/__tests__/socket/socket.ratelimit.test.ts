import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  socketRateLimitMiddleware,
  clearSocketRateLimit,
} from '../../socket/middleware/rate-limit.socket.middleware.js';
import type { AuthenticatedSocket } from '../../socket/middleware/auth.socket.middleware.js';
import { SocketEvents } from '@chatlock/shared-types';
import { ErrorCode } from '../../errors/error-codes.js';

describe('Socket Rate Limiter & Flood Protection Unit Tests', () => {
  const socketId = 'flood_socket_123';
  let mockSocket: {
    id: string;
    data: { user: { id: string } };
    emit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    clearSocketRateLimit(socketId);
    mockSocket = {
      id: socketId,
      data: { user: { id: '6a955a298f74016374325510' } },
      emit: vi.fn(),
    };
  });

  it('1. NORMAL TRAFFIC: passes events below rate threshold', () => {
    const next = vi.fn();
    const packet = ['message:send', { content: 'hello' }] as unknown as [string, ...unknown[]];

    for (let i = 0; i < 20; i++) {
      socketRateLimitMiddleware(mockSocket as unknown as AuthenticatedSocket, packet, next);
    }

    expect(next).toHaveBeenCalledTimes(20);
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('2. FLOOD ATTACK: throttles and drops events exceeding threshold and emits ERROR', () => {
    const next = vi.fn();
    const packet = ['message:send', { content: 'spam' }] as unknown as [string, ...unknown[]];

    // Exceed max 40 events limit
    for (let i = 0; i < 45; i++) {
      socketRateLimitMiddleware(mockSocket as unknown as AuthenticatedSocket, packet, next);
    }

    expect(next).toHaveBeenCalledTimes(40);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.ERROR,
      expect.objectContaining({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
      }),
    );
  });
});
