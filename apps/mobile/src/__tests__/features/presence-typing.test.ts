import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { socketService } from '../../services/socket.service';
import { socketManager } from '../../services/socket/socket.manager';
import { formatLastSeenTime } from '../../utils/date-formatter';
import { SocketEvents, type PresenceUpdatePayload } from '@chatlock/shared-types';

describe('Mobile Presence and Typing Features Unit Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================
  // 1. TYPING START / STOP EMITTER
  // ==========================================
  it('1. TYPING EMIT: dispatches typing:start and typing:stop when socket is connected', () => {
    const mockSocket = {
      connected: true,
      emit: vi.fn(),
    };
    vi.spyOn(socketService, 'getSocket').mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketService.getSocket>,
    );

    socketManager.startTyping('conv_123');
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.TYPING_START, {
      conversationId: 'conv_123',
    });

    socketManager.stopTyping('conv_123');
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.TYPING_STOP, {
      conversationId: 'conv_123',
    });
  });

  // ==========================================
  // 2. PRESENCE HEARTBEAT EMITTER
  // ==========================================
  it('2. HEARTBEAT: sends presence:heartbeat event over socket', async () => {
    const mockSocket = {
      connected: true,
      emit: vi.fn((_event, callback) => {
        if (typeof callback === 'function') callback({ success: true });
      }),
    };
    vi.spyOn(socketService, 'getSocket').mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketService.getSocket>,
    );

    const res = await socketManager.sendHeartbeat();
    expect(res.success).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.PRESENCE_HEARTBEAT,
      expect.any(Function),
    );
  });

  // ==========================================
  // 3. TYPING AUTO-EXPIRATION & LISTENER
  // ==========================================
  it('3. TYPING LISTENERS: registers and cleans up typing start/stop event listeners', () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const mockSocket = {
      connected: true,
      on: vi.fn((event: string, fn: (payload: unknown) => void) => {
        listeners.set(event, fn);
      }),
      off: vi.fn((event: string) => {
        listeners.delete(event);
      }),
    };
    vi.spyOn(socketService, 'getSocket').mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketService.getSocket>,
    );

    let capturedStart: { conversationId: string; userId: string } | null = null;
    const unsubStart = socketManager.onTypingStart((payload) => {
      capturedStart = payload;
    });

    // Simulate incoming typing start
    const startHandler = listeners.get(SocketEvents.TYPING_START);
    expect(startHandler).toBeDefined();
    startHandler!({ conversationId: 'conv_123', userId: 'user_bob' });

    expect(capturedStart).toEqual({ conversationId: 'conv_123', userId: 'user_bob' });

    unsubStart();
    expect(mockSocket.off).toHaveBeenCalledWith(SocketEvents.TYPING_START, expect.any(Function));
  });

  // ==========================================
  // 4. PRESENCE UPDATE LISTENER
  // ==========================================
  it('4. PRESENCE LISTENER: captures user presence status changes', () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const mockSocket = {
      connected: true,
      on: vi.fn((event: string, fn: (payload: unknown) => void) => {
        listeners.set(event, fn);
      }),
      off: vi.fn((event: string) => {
        listeners.delete(event);
      }),
    };
    vi.spyOn(socketService, 'getSocket').mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketService.getSocket>,
    );

    let capturedPresence: PresenceUpdatePayload | null = null;
    const unsub = socketManager.onPresenceUpdate((payload) => {
      capturedPresence = payload;
    });

    const handler = listeners.get(SocketEvents.USER_PRESENCE);
    expect(handler).toBeDefined();
    handler!({
      userId: 'user_bob',
      status: 'offline',
      lastSeenAt: '2026-08-31T01:00:00Z',
    });

    expect(capturedPresence).toEqual({
      userId: 'user_bob',
      status: 'offline',
      lastSeenAt: '2026-08-31T01:00:00Z',
    });

    unsub();
  });

  // ==========================================
  // 5. LAST SEEN FORMATTING
  // ==========================================
  it('5. LAST SEEN FORMATTER: formats relative and offline timestamps accurately', () => {
    expect(formatLastSeenTime(undefined)).toBe('Offline');

    const justNow = new Date(Date.now() - 30 * 1000); // 30 seconds ago
    expect(formatLastSeenTime(justNow)).toBe('Last seen just now');

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    expect(formatLastSeenTime(fiveMinsAgo)).toBe('Last seen 5m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000); // 2 hours ago
    expect(formatLastSeenTime(twoHoursAgo)).toBe('Last seen 2h ago');
  });
});
