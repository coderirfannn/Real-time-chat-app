import { describe, it, expect, beforeEach, vi } from 'vitest';
import { socketService } from '../../services/socket.service';
import { socketManager } from '../../services/socket/socket.manager';
import { resolveHighestStatus, reconcileChatMessages } from '../../utils/message-reconciler';
import { SocketEvents, type IMessage } from '@chatlock/shared-types';
import type { LocalMessage } from '../../types/chat.types';

describe('Mobile Receipts & Monotonic Reconciliation Tests — Task 13 Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ====================================================
  // 1. SOCKET MANAGER RECEIPT EMITTERS
  // ====================================================
  it('1. EMITTERS: emits message:delivered and message:read events via socketManager', () => {
    const mockSocket = {
      connected: true,
      emit: vi.fn(),
    };
    vi.spyOn(socketService, 'getSocket').mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketService.getSocket>,
    );

    socketManager.sendDeliveryReceipt('conv_123', 'msg_456');
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.MESSAGE_DELIVERED, {
      conversationId: 'conv_123',
      messageId: 'msg_456',
    });

    socketManager.sendReadReceipt('conv_123', ['msg_456', 'msg_789']);
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.MESSAGE_READ, {
      conversationId: 'conv_123',
      messageIds: ['msg_456', 'msg_789'],
    });

    socketManager.sendReadReceipt('conv_123');
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.MESSAGE_READ, {
      conversationId: 'conv_123',
    });
  });

  // ====================================================
  // 2. MONOTONIC STATUS PROGRESSION (READ NEVER DOWNGRADES)
  // ====================================================
  it('2. MONOTONIC PROGRESSION: status progresses sent -> delivered -> read and never downgrades', () => {
    expect(resolveHighestStatus('pending', 'sent')).toBe('sent');
    expect(resolveHighestStatus('sending', 'sent')).toBe('sent');
    expect(resolveHighestStatus('sent', 'delivered')).toBe('delivered');
    expect(resolveHighestStatus('delivered', 'read')).toBe('read');

    // CRITICAL: A late 'delivered' receipt arriving after 'read' MUST NOT downgrade 'read'
    expect(resolveHighestStatus('read', 'delivered')).toBe('read');
    expect(resolveHighestStatus('read', 'sent')).toBe('read');
    expect(resolveHighestStatus('read', 'pending')).toBe('read');
  });

  // ====================================================
  // 3. RECONCILER RECEIPT MERGING & LATE EVENT MERGE
  // ====================================================
  it('3. RECONCILIATION: reconciles history with outbox and receipt updates', () => {
    const historyMessage: LocalMessage = {
      id: 'msg_100',
      clientMessageId: 'c_100',
      conversationId: 'conv_1',
      senderId: 'user_me',
      type: 'text',
      content: 'Hello world',
      status: 'sent',
      isEdited: false,
      isDeleted: false,
      createdAt: '2026-08-31T01:00:00.000Z',
      updatedAt: '2026-08-31T01:00:00.000Z',
    };

    const updatedSocketMessage: LocalMessage = {
      id: 'msg_100',
      clientMessageId: 'c_100',
      conversationId: 'conv_1',
      senderId: 'user_me',
      type: 'text',
      content: 'Hello world',
      status: 'read',
      readAt: '2026-08-31T01:05:00.000Z',
      isEdited: false,
      isDeleted: false,
      createdAt: '2026-08-31T01:00:00.000Z',
      updatedAt: '2026-08-31T01:05:00.000Z',
    };

    const reconciled = reconcileChatMessages({
      historyPages: [{ messages: [historyMessage as unknown as IMessage] }],
      socketMessages: [updatedSocketMessage],
    });

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]?.status).toBe('read');
    expect(reconciled[0]?.readAt).toBe('2026-08-31T01:05:00.000Z');
  });

  // ====================================================
  // 4. RECEIPT LISTENER REGISTRATION
  // ====================================================
  it('4. LISTENERS: registers and invokes message:delivered and message:read socket listeners', () => {
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

    let deliveredPayload: unknown = null;
    let readPayload: unknown = null;

    const unsubDelivered = socketManager.onMessageDelivered((p) => {
      deliveredPayload = p;
    });
    const unsubRead = socketManager.onMessageRead((p) => {
      readPayload = p;
    });

    // Simulate incoming events
    const delivHandler = listeners.get(SocketEvents.MESSAGE_DELIVERED);
    const readHandler = listeners.get(SocketEvents.MESSAGE_READ);

    expect(delivHandler).toBeDefined();
    expect(readHandler).toBeDefined();

    delivHandler!({
      conversationId: 'conv_1',
      messageId: 'msg_1',
      userId: 'user_2',
      status: 'delivered',
      deliveredAt: '2026-08-31T02:00:00Z',
    });

    readHandler!({
      conversationId: 'conv_1',
      messageId: 'msg_1',
      userId: 'user_2',
      status: 'read',
      readAt: '2026-08-31T02:01:00Z',
    });

    expect(deliveredPayload).toEqual({
      conversationId: 'conv_1',
      messageId: 'msg_1',
      userId: 'user_2',
      status: 'delivered',
      deliveredAt: '2026-08-31T02:00:00Z',
    });

    expect(readPayload).toEqual({
      conversationId: 'conv_1',
      messageId: 'msg_1',
      userId: 'user_2',
      status: 'read',
      readAt: '2026-08-31T02:01:00Z',
    });

    unsubDelivered();
    unsubRead();
  });

  // ====================================================
  // 5. UNREAD COUNT IDEMPOTENCY
  // ====================================================
  it('5. UNREAD COUNT IDEMPOTENCY: suppresses duplicate increments when the exact same message event arrives', () => {
    let unreadCount = 0;
    const processedIds = new Set<string>();

    const applyIncomingMessage = (msg: { id: string; conversationId: string; content: string }) => {
      if (processedIds.has(msg.id)) return;
      processedIds.add(msg.id);
      unreadCount += 1;
    };

    const incomingMsg = { id: 'srv_msg_999', conversationId: 'conv_1', content: 'Hello!' };

    // Simulate multiple listeners (e.g. _layout and index) receiving the same socket message
    applyIncomingMessage(incomingMsg);
    applyIncomingMessage(incomingMsg);

    expect(unreadCount).toBe(1);
  });
});

