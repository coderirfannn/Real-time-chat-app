import { describe, it, expect } from 'vitest';
import { reconcileChatMessages } from '../../utils/message-reconciler';
import type { IMessage } from '@chatlock/shared-types';
import type { LocalMessage } from '../../types/chat.types';

describe('Antigravity Task 10 — Message Synchronization & Reconciliation E2E Scenarios', () => {
  const createMockMessage = (
    id: string,
    clientMessageId: string,
    content: string,
    createdAt: string,
  ): IMessage => ({
    id,
    conversationId: 'conv_123',
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

  // ==========================================
  // 1. PAGINATION
  // ==========================================
  it('1. PAGINATION: correctly stitches initial page and older cursor pages in chronological order', () => {
    // Initial page (latest messages 3 & 4)
    const initialPage = [
      createMockMessage('msg_4', 'c_4', 'Latest message', '2026-08-31T01:30:00Z'),
      createMockMessage('msg_3', 'c_3', 'Recent message', '2026-08-31T01:20:00Z'),
    ];

    // Older page fetched via scroll upward with cursor=msg_3 (older messages 1 & 2)
    const olderPage = [
      createMockMessage('msg_2', 'c_2', 'Older message', '2026-08-31T01:10:00Z'),
      createMockMessage('msg_1', 'c_1', 'Oldest message', '2026-08-31T01:00:00Z'),
    ];

    const result = reconcileChatMessages({
      historyPages: [{ messages: initialPage }, { messages: olderPage }],
    });

    expect(result).toHaveLength(4);
    // In ascending chronological order (oldest to newest)
    expect(result[0]?.id).toBe('msg_1');
    expect(result[1]?.id).toBe('msg_2');
    expect(result[2]?.id).toBe('msg_3');
    expect(result[3]?.id).toBe('msg_4');
  });

  // ==========================================
  // 2. DUPLICATE EVENT
  // ==========================================
  it('2. DUPLICATE EVENT: rejects duplicate real-time socket events with identical serverMessageId & clientMessageId', () => {
    const socketMsg1: LocalMessage = {
      id: 'srv_dupe_01',
      clientMessageId: 'c_dupe_01',
      conversationId: 'conv_123',
      senderId: 'user_bob',
      type: 'text',
      content: 'Duplicate event test',
      status: 'delivered',
      createdAt: '2026-08-31T01:05:00Z',
      updatedAt: '2026-08-31T01:05:00Z',
      isEdited: false,
      isDeleted: false,
    };

    // Duplicate socket message received again due to network retries
    const socketMsg2: LocalMessage = {
      ...socketMsg1,
      content: 'Duplicate event test (retry update)',
    };

    const result = reconcileChatMessages({
      socketMessages: [socketMsg1, socketMsg2],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('srv_dupe_01');
    expect(result[0]?.clientMessageId).toBe('c_dupe_01');
    expect(result[0]?.content).toBe('Duplicate event test (retry update)');
  });

  // ==========================================
  // 3. LATE EVENT
  // ==========================================
  it('3. LATE EVENT: seamlessly merges a late socket event arriving for a message already in REST cache', () => {
    const restMsg = createMockMessage(
      'srv_msg_10',
      'c_msg_10',
      'Message already in REST cache',
      '2026-08-31T01:10:00Z',
    );

    // Late socket event arrives with populated sender info or updated delivery state
    const lateSocketMsg: LocalMessage = {
      ...restMsg,
      status: 'delivered',
      sender: {
        id: 'user_bob',
        username: 'bob',
        displayName: 'Bob The Builder',
        status: 'online',
      },
    };

    const result = reconcileChatMessages({
      historyPages: [{ messages: [restMsg] }],
      socketMessages: [lateSocketMsg],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('srv_msg_10');
    expect(result[0]?.sender?.displayName).toBe('Bob The Builder');
  });

  // ==========================================
  // 4. REFRESH
  // ==========================================
  it('4. REFRESH: pull-to-refresh replaces older snapshot while preserving pending optimistic messages', () => {
    // 1. Pending optimistic message that has not yet reached server
    const pendingMsg: LocalMessage = {
      clientMessageId: 'c_pending_99',
      conversationId: 'conv_123',
      senderId: 'user_alice',
      type: 'text',
      content: 'I am sending right now',
      status: 'sending',
      createdAt: '2026-08-31T01:25:00Z',
      updatedAt: '2026-08-31T01:25:00Z',
      isEdited: false,
      isDeleted: false,
    };

    // 2. Refreshed REST history returns new server messages
    const refreshedServerMessages = [
      createMockMessage('srv_new_1', 'c_new_1', 'New message from peer', '2026-08-31T01:20:00Z'),
      createMockMessage('srv_new_2', 'c_new_2', 'Another new message', '2026-08-31T01:22:00Z'),
    ];

    const result = reconcileChatMessages({
      historyPages: [{ messages: refreshedServerMessages }],
      optimisticMessages: [pendingMsg],
    });

    expect(result).toHaveLength(3);
    // Both server messages and local sending message are preserved
    expect(result.map((m) => m.clientMessageId)).toEqual(['c_new_1', 'c_new_2', 'c_pending_99']);
    expect(result[2]?.status).toBe('sending');
  });

  // ==========================================
  // 5. SOCKET + API RACE CONDITION
  // ==========================================
  it('5. SOCKET + API RACE: handles race where socket broadcast arrives before ACK, followed by background REST query', () => {
    const clientMessageId = 'c_race_777';

    // Step A: Client sends message -> Optimistic entry created
    const optInitial: LocalMessage = {
      clientMessageId,
      conversationId: 'conv_123',
      senderId: 'user_alice',
      type: 'text',
      content: 'Racing message',
      status: 'sending',
      createdAt: '2026-08-31T01:30:00Z',
      updatedAt: '2026-08-31T01:30:00Z',
      isEdited: false,
      isDeleted: false,
    };

    const stateA = reconcileChatMessages({
      optimisticMessages: [optInitial],
    });
    expect(stateA).toHaveLength(1);
    expect(stateA[0]?.status).toBe('sending');

    // Step B: Socket broadcast (message:new) arrives from server before sender's ACK
    const socketBroadcast: LocalMessage = {
      id: 'srv_race_777',
      clientMessageId,
      conversationId: 'conv_123',
      senderId: 'user_alice',
      type: 'text',
      content: 'Racing message',
      status: 'delivered',
      createdAt: '2026-08-31T01:30:00Z',
      updatedAt: '2026-08-31T01:30:00Z',
      isEdited: false,
      isDeleted: false,
    };

    const stateB = reconcileChatMessages({
      socketMessages: [socketBroadcast],
      optimisticMessages: [optInitial],
    });
    expect(stateB).toHaveLength(1);
    expect(stateB[0]?.id).toBe('srv_race_777');
    expect(stateB[0]?.clientMessageId).toBe(clientMessageId);

    // Step C: ACK arrives and sender updates optimistic state to 'sent'
    const optAcked: LocalMessage = {
      ...optInitial,
      id: 'srv_race_777',
      status: 'sent',
    };

    const stateC = reconcileChatMessages({
      socketMessages: [socketBroadcast],
      optimisticMessages: [optAcked],
    });
    expect(stateC).toHaveLength(1);
    expect(stateC[0]?.id).toBe('srv_race_777');

    // Step D: Background REST query completes with the persisted record
    const restRecord = createMockMessage(
      'srv_race_777',
      clientMessageId,
      'Racing message',
      '2026-08-31T01:30:00Z',
    );

    const stateD = reconcileChatMessages({
      historyPages: [{ messages: [restRecord] }],
      socketMessages: [socketBroadcast],
      optimisticMessages: [optAcked],
    });

    expect(stateD).toHaveLength(1);
    expect(stateD[0]?.id).toBe('srv_race_777');
    expect(stateD[0]?.clientMessageId).toBe(clientMessageId);
  });
});
