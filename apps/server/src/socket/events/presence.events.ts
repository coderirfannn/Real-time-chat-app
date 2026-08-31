import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../index.js';
import { presenceService } from '../../services/presence.service.js';
import { SocketEvents, type PresenceUpdatePayload } from '@chatlock/shared-types';
import { logger } from '../../utils/logger.js';

const presenceEventsLogger = logger.child('PresenceEvents');

/**
 * Broadcasts a user's presence update event across the socket server.
 */
export function broadcastUserPresence(io: TypedSocketServer, payload: PresenceUpdatePayload): void {
  io.emit(SocketEvents.USER_PRESENCE, payload);
  io.emit(SocketEvents.PRESENCE_UPDATE, payload);
  io.emit(SocketEvents.USER_STATUS_CHANGE, payload);
}

/**
 * Registers presence heartbeat and status listeners on a socket connection.
 */
export function registerPresenceEvents(socket: AuthenticatedSocket, _io: TypedSocketServer): void {
  const userId = socket.data.user.id;

  socket.on(
    SocketEvents.PRESENCE_HEARTBEAT,
    async (callback?: (res: { success: boolean }) => void) => {
      try {
        const renewed = await presenceService.heartbeat(userId);
        if (typeof callback === 'function') {
          callback({ success: renewed });
        }
      } catch (err) {
        presenceEventsLogger.warn('Error processing presence heartbeat', {
          userId,
          socketId: socket.id,
          error: err,
        });
        if (typeof callback === 'function') {
          callback({ success: false });
        }
      }
    },
  );
}
