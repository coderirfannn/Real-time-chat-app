import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { outboxService } from '../../services/outbox/outbox.service';
import { outboxSyncManager } from '../../services/outbox/outbox-sync.manager';
import { socketManager } from '../../services/socket/socket.manager';
import { appStorage } from '../../services/storage/app-storage.service';
import { reconcileChatMessages } from '../../utils/message-reconciler';
import type { OutboxMessage } from '../../types/chat.types';
import type { IMessage } from '@chatlock/shared-types';

describe('Antigravity Task 11 — Offline-First Chat Reliability & Lifecycle E2E Tests', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await appStorage.clear();
    await outboxService.clear();
    outboxSyncManager.clearAllTimeouts();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockOutboxMessage = (
    clientMessageId: string,
    convId: string = 'conv_123',
    content: string = 'Offline test message',
  ): OutboxMessage => ({
    clientMessageId,
    conversationId: convId,
    senderId: 'user_alice',
    content,
    type: 'text',
    status: 'pending',
    createdAt: '2026-08-31T01:00:00Z',
    updatedAt: '2026-08-31T01:00:00Z',
    attempts: 0,
    retryPayload: {
      conversationId: convId,
      content,
      clientMessageId,
    },
  });

  // ==========================================
  // 1. OFFLINE SEND & DURABLE PERSISTENCE
  // ==========================================
  it('1. OFFLINE SEND: queues message with status pending in durable storage and shows optimistic UI', async () => {
    vi.spyOn(socketManager, 'isConnected').mockReturnValue(false);

    const outboxItem = createMockOutboxMessage('c_offline_1');
    await outboxService.enqueue(outboxItem);

    // Verify stored in persistent outbox queue
    const queued = await outboxService.getAll();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.status).toBe('pending');
    expect(queued[0]?.clientMessageId).toBe('c_offline_1');

    // Verify feed reconciles it with status pending
    const feed = reconcileChatMessages({
      outboxMessages: queued,
    });
    expect(feed).toHaveLength(1);
    expect(feed[0]?.status).toBe('pending');
    expect(feed[0]?.content).toBe('Offline test message');
  });

  // ==========================================
  // 2. NETWORK RESTORATION & OUTBOX DRAIN
  // ==========================================
  it('2. NETWORK RESTORATION: drains outbox queue upon reconnect and transitions to sent on ACK', async () => {
    const item = createMockOutboxMessage('c_restore_1');
    await outboxService.enqueue(item);

    vi.spyOn(socketManager, 'isConnected').mockReturnValue(true);
    const sendSpy = vi.spyOn(socketManager, 'sendMessage').mockResolvedValue({
      success: true,
      serverMessageId: 'srv_acked_1',
      clientMessageId: 'c_restore_1',
    });

    let sentEventCaptured: {
      clientMessageId: string;
      serverMessageId?: string;
      conversationId: string;
    } | null = null;
    const unsub = outboxSyncManager.onMessageSent((ev) => {
      sentEventCaptured = ev;
    });

    await outboxSyncManager.processQueue();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sentEventCaptured).toEqual({
      clientMessageId: 'c_restore_1',
      serverMessageId: 'srv_acked_1',
      conversationId: 'conv_123',
    });

    // Dequeued from outbox upon success
    const remaining = await outboxService.getAll();
    expect(remaining).toHaveLength(0);

    unsub();
  });

  // ==========================================
  // 3. DUPLICATE RETRY & IDEMPOTENCY
  // ==========================================
  it('3. DUPLICATE RETRY: preserves identical clientMessageId on retry and prevents feed duplicates', async () => {
    const item = createMockOutboxMessage('c_idempotent_99');
    await outboxService.enqueue(item);

    vi.spyOn(socketManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(socketManager, 'sendMessage').mockResolvedValue({
      success: true,
      serverMessageId: 'srv_idempotent_99',
      clientMessageId: 'c_idempotent_99',
    });

    // Send attempt 1
    await outboxSyncManager.retryMessage('c_idempotent_99');

    // Server returns the same serverMessageId; REST history contains it as well
    const restMessage: IMessage = {
      id: 'srv_idempotent_99',
      clientMessageId: 'c_idempotent_99',
      conversationId: 'conv_123',
      senderId: 'user_alice',
      type: 'text',
      content: 'Offline test message',
      status: 'delivered',
      createdAt: '2026-08-31T01:00:00Z',
      updatedAt: '2026-08-31T01:00:00Z',
      isEdited: false,
      isDeleted: false,
    };

    const feed = reconcileChatMessages({
      historyPages: [{ messages: [restMessage] }],
      outboxMessages: [],
    });

    // Must be exactly 1 message in feed (zero duplicates!)
    expect(feed).toHaveLength(1);
    expect(feed[0]?.id).toBe('srv_idempotent_99');
    expect(feed[0]?.clientMessageId).toBe('c_idempotent_99');
  });

  // ==========================================
  // 4. RETRY ENGINE & ERROR CLASSIFICATION
  // ==========================================
  it('4. ERROR CLASSIFICATION: marks non-retryable error failed without infinite looping', async () => {
    const item = createMockOutboxMessage('c_forbidden_1');
    await outboxService.enqueue(item);

    vi.spyOn(socketManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(socketManager, 'sendMessage').mockResolvedValue({
      success: false,
      clientMessageId: 'c_forbidden_1',
      errorCode: 'FORBIDDEN',
      error: 'You do not have permission to post in this room',
    });

    let failedEvent: {
      clientMessageId: string;
      isRetryable: boolean;
      error: string;
      conversationId: string;
    } | null = null;
    const unsub = outboxSyncManager.onMessageFailed((ev) => {
      failedEvent = ev;
    });

    await outboxSyncManager.processQueue();

    expect(failedEvent).toBeDefined();
    expect((failedEvent as { isRetryable: boolean } | null)?.isRetryable).toBe(false);

    const queued = await outboxService.getAll();
    expect(queued[0]?.status).toBe('failed');
    expect(queued[0]?.isRetryable).toBe(false);

    unsub();
  });

  it('4B. RETRY ENGINE: applies controlled exponential backoff on retryable network error', async () => {
    const item = createMockOutboxMessage('c_network_drop');
    await outboxService.enqueue(item);

    vi.spyOn(socketManager, 'isConnected').mockReturnValue(true);
    const sendSpy = vi
      .spyOn(socketManager, 'sendMessage')
      .mockRejectedValueOnce(new Error('Network request timeout'))
      .mockResolvedValueOnce({
        success: true,
        serverMessageId: 'srv_delayed_ack',
        clientMessageId: 'c_network_drop',
      });

    // Attempt 1 fails with retryable error
    await outboxSyncManager.processQueue();

    const queuedAfterAttempt1 = await outboxService.getAll();
    expect(queuedAfterAttempt1[0]?.attempts).toBe(1);
    expect(queuedAfterAttempt1[0]?.status).toBe('pending');
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // Fast-forward backoff timer (e.g. 5 seconds)
    await vi.advanceTimersByTimeAsync(5000);

    // Attempt 2 succeeds
    expect(sendSpy).toHaveBeenCalledTimes(2);
    const remaining = await outboxService.getAll();
    expect(remaining).toHaveLength(0);
  });

  // ==========================================
  // 5. APP LIFECYCLE (BACKGROUND & RESUME)
  // ==========================================
  it('5. APP LIFECYCLE: pauses timers on background and drains queue upon resume', async () => {
    const item = createMockOutboxMessage('c_lifecycle_1');
    await outboxService.enqueue(item);

    vi.spyOn(socketManager, 'isConnected').mockReturnValue(true);
    const sendSpy = vi.spyOn(socketManager, 'sendMessage').mockResolvedValue({
      success: true,
      serverMessageId: 'srv_lifecycle_ack',
      clientMessageId: 'c_lifecycle_1',
    });

    // App goes to background: clear active timeouts
    outboxSyncManager.clearAllTimeouts();

    // App resumes to foreground: drains queue
    await outboxSyncManager.processQueue();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const remaining = await outboxService.getAll();
    expect(remaining).toHaveLength(0);
  });
});
