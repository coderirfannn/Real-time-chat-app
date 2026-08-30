import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
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
import { connectionManager } from './connection.js';
import { roomManager } from './rooms.js';
import { registerSocketEvents } from './events/index.js';
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
      origin: config.socket.corsOrigins,
      credentials: true,
    },
    pingTimeout: config.socket.pingTimeout,
    pingInterval: config.socket.pingInterval,
    transports: ['websocket', 'polling'],
  });

  // 1. Register authentication handshake middleware
  io.use(socketAuthMiddleware);

  // 2. Handle connection lifecycle
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.user.id;
    const username = socket.data.user.username;

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

    // Attach room and lifecycle event handlers
    registerSocketEvents(socket);
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

export * from './connection.js';
export * from './rooms.js';
export * from './middleware/auth.socket.middleware.js';
export * from './events/index.js';
