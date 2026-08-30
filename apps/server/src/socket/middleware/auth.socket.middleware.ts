import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@chatlock/shared-types';
import { verifyAccessToken } from '../../utils/token.js';
import { logger } from '../../utils/logger.js';

const socketLogger = logger.child('SocketAuth');

export type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Socket.IO authentication middleware.
 * Verifies JWT token from handshake auth or headers before allowing connection.
 */
export async function socketAuthMiddleware(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const rawToken =
      (socket.handshake.auth?.token as string | undefined) ||
      extractBearerToken(socket.handshake.headers?.authorization);

    if (!rawToken) {
      socketLogger.warn('Socket connection rejected: Missing authentication token', {
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      return next(new Error('Authentication token is required'));
    }

    const payload = verifyAccessToken(rawToken);

    if (!payload.sub || !payload.email || !payload.username) {
      socketLogger.warn('Socket connection rejected: Malformed token claims', {
        socketId: socket.id,
      });
      return next(new Error('Invalid token claims'));
    }

    const deviceId = socket.handshake.auth?.deviceId as string | undefined;

    // Attach verified identity to socket data
    socket.data.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      deviceId,
    };
    socket.data.authenticatedAt = Date.now();

    socketLogger.debug('Socket authenticated successfully', {
      socketId: socket.id,
      userId: payload.sub,
      username: payload.username,
    });

    next();
  } catch (error) {
    const err = error as Error;
    socketLogger.warn('Socket authentication failed', {
      socketId: socket.id,
      message: err.message,
    });
    next(new Error('Invalid or expired authentication token'));
  }
}

function extractBearerToken(header?: string): string | undefined {
  if (!header || !header.startsWith('Bearer ')) {
    return undefined;
  }
  return header.substring(7).trim();
}
