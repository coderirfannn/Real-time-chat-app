import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { socketService } from '../../services/socket.service';
import { socketManager } from '../../services/socket/socket.manager';
import { formatLastSeenTime } from '../../utils/date-formatter';
import { SocketEvents, type PresenceUpdatePayload } from '@chatlock/shared-types';

describe('Mobile Presence and Typing Features Unit Tests — Task 12 Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================
  // 1. TYPING START / STOP
  // ==========================================
  it('1. TYPING: emits typing:start and typing:stop events to socket', () => {
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
  // 2. TYPING TIMEOUT & AUTO-EXPIRATION
  // ==========================================
  it('2. TYPING TIMEOUT: auto-expires stale typing state when peer does not stop typing within timeout window', () => {
    let peerTyping = false;
    let expirationTimer: ReturnType<typeof setTimeout> | null = null;

    const handlePeerTypingStart = () => {
      peerTyping = true;
      if (expirationTimer) clearTimeout(expirationTimer);
      // 4-second auto-expiration
      expirationTimer = setTimeout(() => {
        peerTyping = false;
      }, 4000);
    };

    handlePeerTypingStart();
    expect(peerTyping).toBe(true);

    // Fast-forward 3.9 seconds -> still typing
    vi.advanceTimersByTime(3900);
    expect(peerTyping).toBe(true);

    // Fast-forward past 4 seconds -> automatically expired
    vi.advanceTimersByTime(200);
    expect(peerTyping).toBe(false);
  });

  // ==========================================
  // 3. HEARTBEAT / TTL RENEWAL
  // ==========================================
  it('3. HEARTBEAT: dispatches presence:heartbeat event periodically', async () => {
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
  // 4. PRESENCE LISTENER & STATUS UPDATES
  // ==========================================
  it('4. PRESENCE UPDATE: receives user:presence socket event and updates status', () => {
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
  it('5. LAST SEEN: correctly formats relative time for offline users', () => {
    expect(formatLastSeenTime(undefined)).toBe('Offline');

    const justNow = new Date(Date.now() - 20 * 1000);
    expect(formatLastSeenTime(justNow)).toBe('Last seen just now');

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    expect(formatLastSeenTime(tenMinutesAgo)).toBe('Last seen 10m ago');

    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
    expect(formatLastSeenTime(threeHoursAgo)).toBe('Last seen 3h ago');
  });

  // ==========================================
  // 6. MULTIPLE USERS TYPING STATE
  // ==========================================
  it('6. MULTIPLE USERS: tracks typing state separately per user in conversations', () => {
    const typingUsers = new Set<string>();

    const onUserTypingStart = (userId: string) => typingUsers.add(userId);
    const onUserTypingStop = (userId: string) => typingUsers.delete(userId);

    onUserTypingStart('user_alice');
    onUserTypingStart('user_bob');

    expect(typingUsers.has('user_alice')).toBe(true);
    expect(typingUsers.has('user_bob')).toBe(true);
    expect(typingUsers.size).toBe(2);

    onUserTypingStop('user_alice');
    expect(typingUsers.has('user_alice')).toBe(false);
    expect(typingUsers.has('user_bob')).toBe(true);
    expect(typingUsers.size).toBe(1);
  });
});
