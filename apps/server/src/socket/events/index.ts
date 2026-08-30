import { registerRoomEvents } from './room.events.js';
import { registerConnectionEvents } from './connection.events.js';
import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';

/**
 * Attaches all event listeners to an authenticated socket connection.
 */
export function registerSocketEvents(socket: AuthenticatedSocket): void {
  // 1. Room management events
  registerRoomEvents(socket);

  // 2. Connection lifecycle events
  registerConnectionEvents(socket);
}

export * from './room.events.js';
export * from './connection.events.js';
