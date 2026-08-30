import { describe, it, expect } from 'vitest';
import { SocketEvents } from '../socket.js';

describe('Shared Types', () => {
  it('should export SocketEvents correctly', () => {
    expect(SocketEvents.CONNECT).toBe('connect');
    expect(SocketEvents.SEND_MESSAGE).toBe('send_message');
    expect(SocketEvents.RECEIVE_MESSAGE).toBe('receive_message');
  });
});
