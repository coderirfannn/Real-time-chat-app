import { describe, it, expect, beforeEach } from 'vitest';
import { socketManager } from '../../services/socket/socket.manager.js';
import { useSocketStore } from '../../store/socket.store.js';

describe('SocketManager Unit Tests', () => {
  beforeEach(() => {
    useSocketStore.setState({
      connectionState: 'disconnected',
      activeRooms: [],
      lastError: null,
    });
  });

  it('updates store state when connecting and disconnecting', () => {
    expect(useSocketStore.getState().connectionState).toBe('disconnected');

    socketManager.connect('test-token');
    expect(useSocketStore.getState().connectionState).toBe('connecting');

    socketManager.disconnect();
    expect(useSocketStore.getState().connectionState).toBe('disconnected');
    expect(useSocketStore.getState().activeRooms).toEqual([]);
  });

  it('tracks room additions and removals in store', () => {
    useSocketStore.getState().addActiveRoom('conversation:conv-1');
    useSocketStore.getState().addActiveRoom('conversation:conv-2');

    expect(useSocketStore.getState().activeRooms).toEqual([
      'conversation:conv-1',
      'conversation:conv-2',
    ]);

    useSocketStore.getState().removeActiveRoom('conversation:conv-1');
    expect(useSocketStore.getState().activeRooms).toEqual(['conversation:conv-2']);
  });
});
