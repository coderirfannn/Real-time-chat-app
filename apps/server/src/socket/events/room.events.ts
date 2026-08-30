import { SocketEvents } from '@chatlock/shared-types';
import { roomManager } from '../rooms.js';
import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';

/**
 * Registers room joining and leaving event listeners on an authenticated socket.
 */
export function registerRoomEvents(socket: AuthenticatedSocket): void {
  // Join Room
  socket.on(
    SocketEvents.JOIN_ROOM,
    async (
      payload: { conversationId: string } | string,
      callback?: (res: { success: boolean; room?: string; error?: string }) => void,
    ) => {
      const roomOrId =
        typeof payload === 'object' && payload !== null ? payload.conversationId : payload;

      const result = await roomManager.authorizeAndJoinConversation(socket, roomOrId);

      if (callback) {
        callback(result);
      }

      if (!result.success) {
        socket.emit(SocketEvents.ERROR, {
          code: 'ROOM_ACCESS_DENIED',
          message: result.error || 'Failed to join conversation room',
        });
      }
    },
  );

  // Leave Room
  socket.on(
    SocketEvents.LEAVE_ROOM,
    async (
      payload: { conversationId: string } | string,
      callback?: (res: { success: boolean; room?: string; error?: string }) => void,
    ) => {
      const roomOrId =
        typeof payload === 'object' && payload !== null ? payload.conversationId : payload;

      const result = await roomManager.leaveConversation(socket, roomOrId);

      if (callback) {
        callback(result);
      }
    },
  );
}
