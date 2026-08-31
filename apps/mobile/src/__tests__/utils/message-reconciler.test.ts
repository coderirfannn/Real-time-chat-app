import { describe, it, expect } from 'vitest';
import { reconcileChatMessages } from '../../utils/message-reconciler';
import type { IMessage } from '@chatlock/shared-types';
import type { LocalMessage } from '../../types/chat.types';

describe('Message Reconciler Unit Tests & Race Condition Verification', () => {
  const createMockMessage = (
    id: string,
    clientMessageId: string,
    content: string,
    createdAt: string,
  ): IMessage => ({
    id,
    conversationId: 'conv_1',
    senderId: 'user_bob',
    clientMessageId,
    type: 'text',
    content,
    status: 'delivered',
    createdAt,
    updatedAt: createdAt,
    isEdited: false,
    isDeleted: false,
  });

  it('deduplicates messages present in both REST history pages and Socket.IO events', () => {
    const msg1 = createMockMessage('srv_1', 'client_1', 'Hello from REST', '2026-08-31T01:00:00Z');
    const msg2 = createMockMessage('srv_2', 'client_2', 'Second message', '2026-08-31T01:01:00Z');

    // Duplicate socket event with same server ID and clientMessageId
    const socketMsg: LocalMessage = {
      ...msg1,
      status: 'delivered',
    };

    const reconciled = reconcileChatMessages({
      historyPages: [{ messages: [msg1, msg2] }],
      socketMessages: [socketMsg],
    });

    expect(reconciled.length).toBe(2);
    expect(reconciled[0]?.id).toBe('srv_1');
    expect(reconciled[1]?.id).toBe('srv_2');
  });

  it('handles duplicate real-time socket events without duplicating in feed', () => {
    const socketMsg1: LocalMessage = {
      id: 'srv_100',
      clientMessageId: 'c_abc_123',
      conversationId: 'conv_1',
      senderId: 'user_bob',
      type: 'text',
      content: 'Realtime text',
      status: 'delivered',
      createdAt: '2026-08-31T01:05:00Z',
      updatedAt: '2026-08-31T01:05:00Z',
      isEdited: false,
      isDeleted: false,
    };

    // Simulated duplicate broadcast from network retry
    const socketMsg2: LocalMessage = {
      ...socketMsg1,
      content: 'Realtime text (updated)',
    };

    const reconciled = reconcileChatMessages({
      historyPages: [],
      socketMessages: [socketMsg1, socketMsg2],
    });

    expect(reconciled.length).toBe(1);
    expect(reconciled[0]?.content).toBe('Realtime text (updated)');
    expect(reconciled[0]?.id).toBe('srv_100');
  });

  it('handles race condition: Socket event arrives BEFORE REST query finishes', () => {
    const socketMsg: LocalMessage = {
      id: 'srv_early',
      clientMessageId: 'c_early_999',
      conversationId: 'conv_1',
      senderId: 'user_bob',
      type: 'text',
      content: 'I arrived before REST history!',
      status: 'delivered',
      createdAt: '2026-08-31T01:10:00Z',
      updatedAt: '2026-08-31T01:10:00Z',
      isEdited: false,
      isDeleted: false,
    };

    // REST history eventually resolves containing the same message + older history
    const olderMsg = createMockMessage(
      'srv_old',
      'c_old_001',
      'Older history message',
      '2026-08-31T01:00:00Z',
    );
    const restMsg = createMockMessage(
      'srv_early',
      'c_early_999',
      'I arrived before REST history!',
      '2026-08-31T01:10:00Z',
    );

    const reconciled = reconcileChatMessages({
      historyPages: [{ messages: [olderMsg, restMsg] }],
      socketMessages: [socketMsg],
    });

    expect(reconciled.length).toBe(2);
    expect(reconciled[0]?.id).toBe('srv_old');
    expect(reconciled[1]?.id).toBe('srv_early');
  });

  it('handles optimistic message lifecycle: sending -> ACK with server ID -> REST replacement', () => {
    const clientMessageId = 'c_optimistic_123';

    // 1. Initial optimistic sending state
    const optSending: LocalMessage = {
      clientMessageId,
      conversationId: 'conv_1',
      senderId: 'user_alice',
      type: 'text',
      content: 'Optimistic message',
      status: 'sending',
      createdAt: '2026-08-31T01:15:00Z',
      updatedAt: '2026-08-31T01:15:00Z',
      isEdited: false,
      isDeleted: false,
    };

    const step1 = reconcileChatMessages({
      optimisticMessages: [optSending],
    });
    expect(step1.length).toBe(1);
    expect(step1[0]?.status).toBe('sending');

    // 2. ACK received: serverMessageId attached, status changed to 'sent'
    const optSent: LocalMessage = {
      ...optSending,
      id: 'srv_acknowledged_456',
      status: 'sent',
    };

    const step2 = reconcileChatMessages({
      optimisticMessages: [optSent],
    });
    expect(step2.length).toBe(1);
    expect(step2[0]?.id).toBe('srv_acknowledged_456');
    expect(step2[0]?.status).toBe('sent');

    // 3. REST history refetched: includes the persisted record
    const restPersisted = createMockMessage(
      'srv_acknowledged_456',
      clientMessageId,
      'Optimistic message',
      '2026-08-31T01:15:00Z',
    );

    const step3 = reconcileChatMessages({
      historyPages: [{ messages: [restPersisted] }],
      optimisticMessages: [optSent],
    });

    expect(step3.length).toBe(1);
    expect(step3[0]?.id).toBe('srv_acknowledged_456');
    expect(step3[0]?.clientMessageId).toBe(clientMessageId);
  });

  it('stitches multiple cursor pagination pages and sorts chronologically', () => {
    const page1Newest = [
      createMockMessage('msg_3', 'c_3', 'Latest message', '2026-08-31T01:30:00Z'),
      createMockMessage('msg_2', 'c_2', 'Middle message', '2026-08-31T01:20:00Z'),
    ];

    const page2Older = [
      createMockMessage('msg_1', 'c_1', 'Oldest message', '2026-08-31T01:10:00Z'),
    ];

    const reconciled = reconcileChatMessages({
      historyPages: [{ messages: page1Newest }, { messages: page2Older }],
    });

    expect(reconciled.length).toBe(3);
    // Verified ascending order for virtualized inverted FlatList
    expect(reconciled[0]?.id).toBe('msg_1');
    expect(reconciled[1]?.id).toBe('msg_2');
    expect(reconciled[2]?.id).toBe('msg_3');
  });
});
