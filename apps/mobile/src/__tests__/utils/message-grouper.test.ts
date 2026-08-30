import { describe, it, expect } from 'vitest';
import { buildInvertedChatFeed } from '../../utils/message-grouper';
import type { LocalMessage, ChatMessageItem } from '../../types/chat.types';

describe('Message Grouper Unit Tests', () => {
  const currentUserId = 'user-current';
  const peerUserId = 'user-peer';

  it('returns empty array when no messages are provided', () => {
    expect(buildInvertedChatFeed([], currentUserId)).toEqual([]);
  });

  it('inserts date separators and inverts order for inverted FlatList', () => {
    const messages: LocalMessage[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: peerUserId,
        clientMessageId: 'c1',
        type: 'text',
        content: 'Good morning',
        status: 'delivered',
        createdAt: '2026-08-29T08:00:00.000Z',
        updatedAt: '2026-08-29T08:00:00.000Z',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderId: currentUserId,
        clientMessageId: 'c2',
        type: 'text',
        content: 'Hello!',
        status: 'sent',
        createdAt: '2026-08-30T09:00:00.000Z',
        updatedAt: '2026-08-30T09:00:00.000Z',
      },
    ];

    const feed = buildInvertedChatFeed(messages, currentUserId);

    expect(feed.length).toBe(4);

    const firstItem = feed[0];
    expect(firstItem?.itemType).toBe('message');
    if (firstItem && firstItem.itemType === 'message') {
      expect(firstItem.message.content).toBe('Hello!');
      expect(firstItem.isOutbound).toBe(true);
    }

    const secondItem = feed[1];
    expect(secondItem?.itemType).toBe('date_separator');

    const thirdItem = feed[2];
    expect(thirdItem?.itemType).toBe('message');
    if (thirdItem && thirdItem.itemType === 'message') {
      expect(thirdItem.message.content).toBe('Good morning');
      expect(thirdItem.isOutbound).toBe(false);
    }

    const fourthItem = feed[3];
    expect(fourthItem?.itemType).toBe('date_separator');
  });

  it('correctly marks consecutive messages from the same sender within threshold', () => {
    const messages: LocalMessage[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: peerUserId,
        clientMessageId: 'c1',
        type: 'text',
        content: 'First bubble',
        status: 'delivered',
        createdAt: '2026-08-30T08:00:00.000Z',
        updatedAt: '2026-08-30T08:00:00.000Z',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderId: peerUserId,
        clientMessageId: 'c2',
        type: 'text',
        content: 'Second bubble right away',
        status: 'delivered',
        createdAt: '2026-08-30T08:01:00.000Z',
        updatedAt: '2026-08-30T08:01:00.000Z',
      },
    ];

    const feed = buildInvertedChatFeed(messages, currentUserId);

    // Filter to messages only
    const msgItems = feed.filter((item): item is ChatMessageItem => item.itemType === 'message');
    expect(msgItems.length).toBe(2);

    const firstMsg = msgItems[0];
    const secondMsg = msgItems[1];

    expect(firstMsg?.isConsecutive).toBe(true);
    expect(secondMsg?.isConsecutive).toBe(false);
  });
});
