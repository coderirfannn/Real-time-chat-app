import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocketService } from '../services/socket.service';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'http://localhost:5000/api/v1',
        socketUrl: 'http://localhost:5000',
        appEnv: 'development',
      },
    },
  },
}));

describe('Mobile SocketService Unit Tests', () => {
  let service: SocketService;

  beforeEach(() => {
    service = new SocketService('http://localhost:5000');
  });

  it('initializes socket client with configured options', () => {
    const socket = service.getSocket();
    expect(socket).toBeDefined();
    expect(service.isConnected()).toBe(false);
  });

  it('sets auth token and calls connect', () => {
    const socket = service.connect('mock-jwt-token');
    expect(socket.auth).toEqual({ token: 'mock-jwt-token' });
  });

  it('disconnects and resets authentication', () => {
    service.connect('mock-jwt-token');
    service.disconnect();
    expect(service.isConnected()).toBe(false);
  });

  it('returns failure when joinConversation called while disconnected', async () => {
    const res = await service.joinConversation('507f1f77bcf86cd799439011');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Socket is not connected');
  });

  it('returns failure when leaveConversation called while disconnected', async () => {
    const res = await service.leaveConversation('507f1f77bcf86cd799439011');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Socket is not connected');
  });

  it('returns failure when sendMessage called while disconnected', async () => {
    const res = await service.sendMessage({
      conversationId: '507f1f77bcf86cd799439011',
      clientMessageId: 'cm_mobile_01',
      content: 'Hello mobile',
    });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('SOCKET_DISCONNECTED');
    expect(res.error).toBe('Socket is not connected');
  });

  it('registers and unregisters onNewMessage listeners', () => {
    const listener = vi.fn();
    const unsubscribe = service.onNewMessage(listener);
    expect(unsubscribe).toBeInstanceOf(Function);
    unsubscribe();
  });

  it('registers and unregisters onMessageSent listeners', () => {
    const listener = vi.fn();
    const unsubscribe = service.onMessageSent(listener);
    expect(unsubscribe).toBeInstanceOf(Function);
    unsubscribe();
  });
});
