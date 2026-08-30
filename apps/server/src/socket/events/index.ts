import { registerRoomEvents } from './room.events.js';
import { registerConnectionEvents } from './connection.events.js';
import { registerMessageEvents } from './message.events.js';
import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../index.js';

/**
 * Attaches all event listeners to an authenticated socket connection.
 */
export function registerSocketEvents(socket: AuthenticatedSocket, io: TypedSocketServer): void {
  // 1. Room management events
  registerRoomEvents(socket);

  // 2. Connection lifecycle events
  registerConnectionEvents(socket);

  // 3. Real-time messaging events
  registerMessageEvents(socket, io);
}

export * from './room.events.js';
export * from './connection.events.js';
export * from './message.events.js';
