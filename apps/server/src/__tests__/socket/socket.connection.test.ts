import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionManager } from '../../socket/connection.js';

describe('ConnectionManager Unit Tests', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  it('registers a new socket connection for a user', () => {
    const res = manager.register('user-1', 'socket-abc');

    expect(res.userId).toBe('user-1');
    expect(res.socketId).toBe('socket-abc');
    expect(res.isFirstConnection).toBe(true);
    expect(res.activeSocketsCount).toBe(1);
    expect(manager.isUserOnline('user-1')).toBe(true);
  });

  it('tracks multiple concurrent socket connections for the same user', () => {
    manager.register('user-1', 'socket-1');
    const res2 = manager.register('user-1', 'socket-2');

    expect(res2.isFirstConnection).toBe(false);
    expect(res2.activeSocketsCount).toBe(2);
    expect(manager.getUserSocketIds('user-1')).toEqual(['socket-1', 'socket-2']);
    expect(manager.getOnlineUserCount()).toBe(1);
  });

  it('handles disconnect and marks user offline only after last socket disconnects', () => {
    manager.register('user-1', 'socket-1');
    manager.register('user-1', 'socket-2');

    const unreg1 = manager.unregister('socket-1');
    expect(unreg1.isLastConnection).toBe(false);
    expect(unreg1.remainingSocketsCount).toBe(1);
    expect(manager.isUserOnline('user-1')).toBe(true);

    const unreg2 = manager.unregister('socket-2');
    expect(unreg2.isLastConnection).toBe(true);
    expect(unreg2.remainingSocketsCount).toBe(0);
    expect(manager.isUserOnline('user-1')).toBe(false);
  });

  it('handles unregistering an unknown socket gracefully', () => {
    const unreg = manager.unregister('unknown-socket');
    expect(unreg.userId).toBeNull();
    expect(unreg.isLastConnection).toBe(false);
    expect(unreg.remainingSocketsCount).toBe(0);
  });

  it('retrieves user ID by socket ID', () => {
    manager.register('user-1', 'socket-123');
    expect(manager.getUserIdBySocketId('socket-123')).toBe('user-1');
    expect(manager.getUserIdBySocketId('non-existent')).toBeNull();
  });

  it('lists all online user IDs', () => {
    manager.register('user-1', 'socket-1');
    manager.register('user-2', 'socket-2');

    expect(manager.getOnlineUserIds()).toEqual(['user-1', 'user-2']);
  });
});
