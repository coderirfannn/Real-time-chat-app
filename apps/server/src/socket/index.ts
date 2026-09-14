import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@chatlock/shared-types';
import { config } from '../config/index.js';
import {
  socketAuthMiddleware,
  type AuthenticatedSocket,
} from './middleware/auth.socket.middleware.js';
import {
  socketRateLimitMiddleware,
  clearSocketRateLimit,
} from './middleware/rate-limit.socket.middleware.js';
import { connectionManager } from './connection.js';
import { roomManager } from './rooms.js';
import { registerSocketEvents, broadcastUserPresence } from './events/index.js';
import { presenceService } from '../services/presence.service.js';
import { redisManager } from '../redis/client.js';
import { logger } from '../utils/logger.js';

const socketServerLogger = logger.child('SocketServer');

export type TypedSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let ioInstance: TypedSocketServer | null = null;

/**
 * Initializes and binds the Socket.IO server to the HTTP server instance.
 */
export function initSocketServer(httpServer: HttpServer): TypedSocketServer {
  const io: TypedSocketServer = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: config.socket.corsOrigins.includes('*') ? true : config.socket.corsOrigins,
      credentials: true,
    },
    pingTimeout: config.socket.pingTimeout,
    pingInterval: config.socket.pingInterval,
    transports: ['websocket', 'polling'],
  });

  // 1. Configure Redis Adapter for Horizontal Multi-Node Cluster Scaling
  if (process.env['NODE_ENV'] !== 'test' && redisManager.isReady()) {
    try {
      const pubClient = redisManager.createDuplicateClient();
      const subClient = redisManager.createDuplicateClient();
      pubClient.on('error', (err: Error) => {
        socketServerLogger.warn('Redis pubClient error', { error: err.message });
      });
      subClient.on('error', (err: Error) => {
        socketServerLogger.warn('Redis subClient error', { error: err.message });
      });
      io.adapter(createAdapter(pubClient, subClient));
      socketServerLogger.info('Socket.IO Redis adapter configured for horizontal cluster scaling');
    } catch (err) {
      socketServerLogger.warn('Socket.IO running in standalone in-memory adapter mode', {
        error: (err as Error).message,
      });
    }
  } else {
    socketServerLogger.info('Socket.IO running with built-in in-memory adapter');
  }

  // 2. Register authentication handshake middleware
  io.use(socketAuthMiddleware);

  // 3. Handle connection lifecycle
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.user.id;
    const username = socket.data.user.username;

    // Register rate limiting packet interceptor
    socket.use((packet, next) => {
      socketRateLimitMiddleware(socket, packet, next);
    });

    // Register active socket connection
    const reg = connectionManager.register(userId, socket.id);

    // Auto-join personal user notification room
    const userRoom = roomManager.getUserRoom(userId);
    socket.join(userRoom);

    socketServerLogger.info('User connected via Socket.IO', {
      socketId: socket.id,
      userId,
      username,
      activeSockets: reg.activeSocketsCount,
      isFirstConnection: reg.isFirstConnection,
    });

    // If this is the user's first active connection, set presence online in Redis & MongoDB and broadcast
    if (reg.isFirstConnection) {
      presenceService
        .setOnline(userId)
        .then((payload) => {
          broadcastUserPresence(io, payload);
        })
        .catch((err) => {
          socketServerLogger.warn('Error setting user online on connect', { userId, error: err });
        });
    }

    // Attach room, lifecycle, messaging, and receipt event handlers
    registerSocketEvents(socket, io);

    socket.on('disconnect', () => {
      clearSocketRateLimit(socket.id);
    });
  });

  ioInstance = io;
  socketServerLogger.info('Socket.IO gateway initialized and attached to HTTP server');

  return io;
}

/**
 * Returns the singleton Socket.IO server instance.
 */
export function getSocketIO(): TypedSocketServer {
  if (!ioInstance) {
    throw new Error('Socket.IO server has not been initialized. Call initSocketServer first.');
  }
  return ioInstance;
}

/**
 * Closes the Socket.IO server gracefully during shutdown.
 */
export async function closeSocketIO(): Promise<void> {
  if (ioInstance) {
    socketServerLogger.info('Closing Socket.IO connections...');
    connectionManager.clear();
    await new Promise<void>((resolve) => {
      ioInstance!.close(() => {
        socketServerLogger.info('Socket.IO server closed');
        ioInstance = null;
        resolve();
      });
    });
  }
}

import { deviceRepository } from '../repositories/device.repository.js';
import { pushNotificationService } from '../services/push-notification.service.js';
import { SocketEvents } from '@chatlock/shared-types';

/**
 * Forcefully disconnects all active sockets for a user when suspended or banned,
 * sending an error frame and broadcasting offline presence.
 */
export async function evictUserSockets(userId: string, reason: string): Promise<number> {
  const cleanUserId = userId.trim();
  const socketIds = connectionManager.getUserSocketIds(cleanUserId);

  if (socketIds.length === 0) {
    socketServerLogger.debug('No active sockets to evict for user', { userId: cleanUserId });
    return 0;
  }

  try {
    if (ioInstance) {
      for (const socketId of socketIds) {
        const sock = ioInstance.sockets.sockets.get(socketId);
        if (sock) {
          sock.emit(SocketEvents.ERROR, {
            code: 'ACCOUNT_STATUS_REVOKED',
            message: reason || 'Your account access has been revoked by an administrator.',
          });
          sock.disconnect(true);
        }
      }

      await presenceService
        .setOffline(cleanUserId)
        .then((payload) => {
          if (ioInstance) {
            broadcastUserPresence(ioInstance, payload);
          }
        })
        .catch(() => {});
    }
  } catch (err) {
    socketServerLogger.warn('Error during evictUserSockets', {
      userId: cleanUserId,
      error: (err as Error).message,
    });
  }

  socketServerLogger.info('Evicted user sockets following moderation action', {
    userId: cleanUserId,
    evictedSocketsCount: socketIds.length,
  });

  return socketIds.length;
}

/**
 * Dispatches a moderation warning to a user across real-time socket connection and push notifications.
 * CRITICAL SECURITY / PRIVACY: Reporter identity and message plaintext are NEVER sent.
 */
export async function sendModerationWarning(
  userId: string,
  data: { reason: string; warningMessage?: string },
): Promise<void> {
  const cleanUserId = userId.trim();
  const messageText =
    data.warningMessage?.trim() ||
    `Warning: Your account was reported for violating Community Guidelines regarding ${data.reason}. Further violations will lead to account suspension or ban.`;

  // 1. Socket notification
  try {
    if (ioInstance) {
      const userRoom = roomManager.getUserRoom(cleanUserId);
      ioInstance.to(userRoom).emit(SocketEvents.USER_WARNING, {
        reason: data.reason,
        message: messageText,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    socketServerLogger.warn('Error emitting socket moderation warning', {
      userId: cleanUserId,
      error: (err as Error).message,
    });
  }

  // 2. Offline Push notification
  try {
    const tokens = await deviceRepository.findActiveTokensByUser(cleanUserId);
    if (tokens.length > 0) {
      await pushNotificationService.sendPushNotifications(tokens, {
        title: '⚠️ Moderation Warning',
        body: messageText,
        data: {
          type: 'MODERATION_WARNING',
          reason: data.reason,
        },
      });
    }
  } catch (err) {
    socketServerLogger.warn('Error sending moderation warning push notification', {
      userId: cleanUserId,
      error: (err as Error).message,
    });
  }
}

export * from './connection.js';
export * from './rooms.js';
export * from './middleware/auth.socket.middleware.js';
export * from './middleware/rate-limit.socket.middleware.js';
export * from './events/index.js';
