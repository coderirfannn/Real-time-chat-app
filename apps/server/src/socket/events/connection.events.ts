import { connectionManager } from '../connection.js';
import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';
import { logger } from '../../utils/logger.js';

const connectionEventsLogger = logger.child('ConnectionEvents');

/**
 * Registers connection lifecycle listeners (disconnect, disconnecting).
 */
export function registerConnectionEvents(socket: AuthenticatedSocket): void {
  socket.on('disconnecting', (reason) => {
    connectionEventsLogger.debug('Socket disconnecting', {
      socketId: socket.id,
      userId: socket.data.user?.id,
      rooms: Array.from(socket.rooms),
      reason,
    });
  });

  socket.on('disconnect', (reason) => {
    const unregResult = connectionManager.unregister(socket.id);

    connectionEventsLogger.info('Socket disconnected', {
      socketId: socket.id,
      userId: unregResult.userId ?? undefined,
      reason,
      isLastConnection: unregResult.isLastConnection,
      remainingSockets: unregResult.remainingSocketsCount,
    });
  });
}
