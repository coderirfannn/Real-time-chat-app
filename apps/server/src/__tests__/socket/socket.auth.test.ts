import { describe, it, expect, vi } from 'vitest';
import { socketAuthMiddleware } from '../../socket/middleware/auth.socket.middleware.js';
import { signAccessToken } from '../../utils/token.js';
import type { AuthenticatedSocket } from '../../socket/middleware/auth.socket.middleware.js';

describe('Socket.IO Auth Middleware Unit Tests', () => {
  it('authenticates successfully with valid JWT token in handshake auth', async () => {
    const { token } = signAccessToken({
      sub: '507f1f77bcf86cd799439011',
      email: 'user@example.com',
      username: 'test_user',
    });

    const mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: { token, deviceId: 'device-abc' },
        headers: {},
        address: '127.0.0.1',
      },
      data: {},
    } as unknown as AuthenticatedSocket;

    const next = vi.fn();

    await socketAuthMiddleware(mockSocket, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockSocket.data.user).toEqual({
      id: '507f1f77bcf86cd799439011',
      email: 'user@example.com',
      username: 'test_user',
      deviceId: 'device-abc',
    });
    expect(mockSocket.data.authenticatedAt).toBeDefined();
  });

  it('authenticates successfully with Bearer token in handshake headers', async () => {
    const { token } = signAccessToken({
      sub: '507f1f77bcf86cd799439011',
      email: 'user@example.com',
      username: 'test_user',
    });

    const mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: {},
        headers: { authorization: `Bearer ${token}` },
        address: '127.0.0.1',
      },
      data: {},
    } as unknown as AuthenticatedSocket;

    const next = vi.fn();

    await socketAuthMiddleware(mockSocket, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockSocket.data.user.id).toBe('507f1f77bcf86cd799439011');
  });

  it('rejects connection when no authentication token is provided', async () => {
    const mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: {},
        headers: {},
        address: '127.0.0.1',
      },
      data: {},
    } as unknown as AuthenticatedSocket;

    const next = vi.fn();

    await socketAuthMiddleware(mockSocket, next);

    expect(next).toHaveBeenCalled();
    const firstCall = next.mock.calls[0];
    const err = firstCall ? (firstCall[0] as Error | undefined) : undefined;
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toBe('Authentication token is required');
  });

  it('rejects connection when token is invalid or tampered', async () => {
    const mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: { token: 'tampered.jwt.token' },
        headers: {},
        address: '127.0.0.1',
      },
      data: {},
    } as unknown as AuthenticatedSocket;

    const next = vi.fn();

    await socketAuthMiddleware(mockSocket, next);

    expect(next).toHaveBeenCalled();
    const firstCall = next.mock.calls[0];
    const err = firstCall ? (firstCall[0] as Error | undefined) : undefined;
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toBe('Invalid or expired authentication token');
  });
});
