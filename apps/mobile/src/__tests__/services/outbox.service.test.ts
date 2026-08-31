import { describe, it, expect, beforeEach } from 'vitest';
import { OutboxService } from '../../services/outbox/outbox.service';
import { appStorage } from '../../services/storage/app-storage.service';
import type { OutboxMessage } from '../../types/chat.types';

describe('OutboxService Unit Tests', () => {
  let service: OutboxService;

  beforeEach(async () => {
    await appStorage.clear();
    service = OutboxService.getInstance();
    await service.clear();
  });

  const createMockOutboxItem = (
    clientMessageId: string,
    convId: string = 'conv_1',
  ): OutboxMessage => ({
    clientMessageId,
    conversationId: convId,
    senderId: 'user_1',
    content: `Hello ${clientMessageId}`,
    type: 'text',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: 0,
    retryPayload: {
      conversationId: convId,
      content: `Hello ${clientMessageId}`,
      clientMessageId,
    },
  });

  it('enqueues a message into durable storage and memory cache', async () => {
    const item = createMockOutboxItem('c_101');
    await service.enqueue(item);

    const all = await service.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.clientMessageId).toBe('c_101');
    expect(all[0]?.status).toBe('pending');
  });

  it('dequeues an acknowledged message from storage', async () => {
    const item1 = createMockOutboxItem('c_101');
    const item2 = createMockOutboxItem('c_102');
    await service.enqueue(item1);
    await service.enqueue(item2);

    const removed = await service.dequeue('c_101');
    expect(removed?.clientMessageId).toBe('c_101');

    const remaining = await service.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.clientMessageId).toBe('c_102');
  });

  it('filters pending messages by conversation ID', async () => {
    await service.enqueue(createMockOutboxItem('c_1', 'conv_A'));
    await service.enqueue(createMockOutboxItem('c_2', 'conv_B'));
    await service.enqueue(createMockOutboxItem('c_3', 'conv_A'));

    const convAMessages = await service.getConversationPending('conv_A');
    expect(convAMessages).toHaveLength(2);
    expect(convAMessages.map((m) => m.clientMessageId)).toEqual(['c_1', 'c_3']);
  });

  it('updates retry attempt metadata and flags non-retryable failure', async () => {
    await service.enqueue(createMockOutboxItem('c_101'));

    const updated = await service.updateAttempt('c_101', 'Rate limit exceeded', true);
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBe('Rate limit exceeded');
    expect(updated?.isRetryable).toBe(true);

    const failed = await service.updateAttempt('c_101', 'Forbidden access', false);
    expect(failed?.attempts).toBe(2);
    expect(failed?.status).toBe('failed');
    expect(failed?.isRetryable).toBe(false);
  });

  it('notifies subscribers upon queue mutations', async () => {
    let capturedQueue: OutboxMessage[] = [];
    const unsubscribe = service.subscribe((queue) => {
      capturedQueue = queue;
    });

    await service.enqueue(createMockOutboxItem('c_sub_1'));
    expect(capturedQueue).toHaveLength(1);
    expect(capturedQueue[0]?.clientMessageId).toBe('c_sub_1');

    await service.dequeue('c_sub_1');
    expect(capturedQueue).toHaveLength(0);

    unsubscribe();
  });
});
