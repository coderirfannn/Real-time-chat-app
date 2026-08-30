import { logger } from '../utils/logger.js';

const connectionLogger = logger.child('ConnectionManager');

export interface RegistrationResult {
  userId: string;
  socketId: string;
  isFirstConnection: boolean;
  activeSocketsCount: number;
}

export interface UnregistrationResult {
  userId: string | null;
  socketId: string;
  isLastConnection: boolean;
  remainingSocketsCount: number;
}

export class ConnectionManager {
  // Mapping: userId -> Set of socket IDs
  private readonly userSockets = new Map<string, Set<string>>();

  // Mapping: socketId -> userId
  private readonly socketUsers = new Map<string, string>();

  /**
   * Registers a socket connection for a user.
   */
  public register(userId: string, socketId: string): RegistrationResult {
    const cleanUserId = userId.trim();
    const cleanSocketId = socketId.trim();

    let sockets = this.userSockets.get(cleanUserId);
    const isFirstConnection = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set<string>();
      this.userSockets.set(cleanUserId, sockets);
    }

    sockets.add(cleanSocketId);
    this.socketUsers.set(cleanSocketId, cleanUserId);

    connectionLogger.debug('Socket registered', {
      userId: cleanUserId,
      socketId: cleanSocketId,
      activeSockets: sockets.size,
    });

    return {
      userId: cleanUserId,
      socketId: cleanSocketId,
      isFirstConnection,
      activeSocketsCount: sockets.size,
    };
  }

  /**
   * Unregisters a socket on disconnect.
   */
  public unregister(socketId: string): UnregistrationResult {
    const cleanSocketId = socketId.trim();
    const userId = this.socketUsers.get(cleanSocketId) || null;

    if (!userId) {
      return {
        userId: null,
        socketId: cleanSocketId,
        isLastConnection: false,
        remainingSocketsCount: 0,
      };
    }

    this.socketUsers.delete(cleanSocketId);
    const sockets = this.userSockets.get(userId);

    let isLastConnection = false;
    let remainingSocketsCount = 0;

    if (sockets) {
      sockets.delete(cleanSocketId);
      remainingSocketsCount = sockets.size;

      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        isLastConnection = true;
      }
    }

    connectionLogger.debug('Socket unregistered', {
      userId,
      socketId: cleanSocketId,
      remainingSockets: remainingSocketsCount,
      isLastConnection,
    });

    return {
      userId,
      socketId: cleanSocketId,
      isLastConnection,
      remainingSocketsCount,
    };
  }

  /**
   * Checks if a user has at least one active connection.
   */
  public isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId.trim());
    return Boolean(sockets && sockets.size > 0);
  }

  /**
   * Returns all active socket IDs for a given user.
   */
  public getUserSocketIds(userId: string): string[] {
    const sockets = this.userSockets.get(userId.trim());
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Returns the user ID associated with a socket ID.
   */
  public getUserIdBySocketId(socketId: string): string | null {
    return this.socketUsers.get(socketId.trim()) || null;
  }

  /**
   * Returns the count of all distinct online users.
   */
  public getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  /**
   * Returns a list of all currently online user IDs.
   */
  public getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Clears all connection mappings (used during shutdown or test resets).
   */
  public clear(): void {
    this.userSockets.clear();
    this.socketUsers.clear();
  }
}

export const connectionManager = new ConnectionManager();
