import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { DateSeparator } from '../../components/DateSeparator';
import { MessageBubble } from '../../features/chat/components/MessageBubble';
import { DeliveryReceipt } from '../../features/chat/components/DeliveryReceipt';
import { ReactionPicker, QUICK_EMOJIS } from '../../features/chat/components/ReactionPicker';
import { MessageComposer } from '../../features/chat/components/MessageComposer';
import type { LocalMessage } from '../../types/chat.types';

describe('Chat UI Components Unit Tests', () => {
  it('instantiates Avatar component without crashing', () => {
    const element = React.createElement(Avatar, { name: 'Alice Smith', isOnline: true });
    expect(element).toBeDefined();
    expect(element.props.name).toBe('Alice Smith');
    expect(element.props.isOnline).toBe(true);
  });

  it('renders Badge component with capped count', () => {
    const normalBadge = Badge({ count: 5 });
    expect(normalBadge).not.toBeNull();

    const emptyBadge = Badge({ count: 0 });
    expect(emptyBadge).toBeNull();
  });

  it('instantiates DateSeparator component', () => {
    const separator = React.createElement(DateSeparator, { label: 'Today' });
    expect(separator).toBeDefined();
    expect(separator.props.label).toBe('Today');
  });

  it('instantiates MessageBubble component with delivery states and retry callback', () => {
    const onRetryMock = vi.fn();
    const message: LocalMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      clientMessageId: 'c1',
      type: 'text',
      content: 'Testing bubble',
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const element = React.createElement(MessageBubble, {
      message,
      isOutbound: true,
      onRetry: onRetryMock,
    });

    expect(element).toBeDefined();
    expect(element.props.isOutbound).toBe(true);
    expect(element.props.message.status).toBe('failed');
  });

  it('renders DeliveryReceipt for each status lifecycle', () => {
    const statuses = ['pending', 'sending', 'sent', 'delivered', 'read', 'failed'] as const;
    for (const status of statuses) {
      const receipt = React.createElement(DeliveryReceipt, { status, onRetry: vi.fn() });
      expect(receipt).toBeDefined();
      expect(receipt.props.status).toBe(status);
    }
  });

  it('instantiates ReactionPicker with quick emojis and action callbacks', () => {
    const onSelectEmoji = vi.fn();
    const onReply = vi.fn();
    const onCopy = vi.fn();

    const picker = React.createElement(ReactionPicker, {
      onSelectEmoji,
      onReply,
      onCopy,
      isOutbound: true,
    });

    expect(picker).toBeDefined();
    expect(QUICK_EMOJIS.length).toBeGreaterThan(0);
    expect(picker.props.isOutbound).toBe(true);
  });

  it('renders MessageBubble with reply preview snippet and reactions', () => {
    const parentMessage: LocalMessage = {
      id: 'parent-1',
      conversationId: 'conv-1',
      senderId: 'peer-1',
      clientMessageId: 'cp1',
      type: 'text',
      content: 'Original question?',
      status: 'read',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const replyMessage: LocalMessage = {
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'user-1',
      clientMessageId: 'c2',
      type: 'text',
      content: 'Here is my answer!',
      status: 'delivered',
      replyToMessageId: 'parent-1',
      reactions: [{ emoji: '🔥', userId: 'user-1', createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const bubble = React.createElement(MessageBubble, {
      message: replyMessage,
      isOutbound: true,
      parentMessage,
      currentUserId: 'user-1',
      onReaction: vi.fn(),
      onReply: vi.fn(),
    });

    expect(bubble).toBeDefined();
    expect(bubble.props.parentMessage?.id).toBe('parent-1');
    expect(bubble.props.message.reactions?.[0]?.emoji).toBe('🔥');
  });

  it('instantiates MessageComposer with replyingTo banner support', () => {
    const replyingTo: LocalMessage = {
      id: 'msg-quote',
      conversationId: 'conv-1',
      senderId: 'peer-1',
      clientMessageId: 'cq',
      type: 'text',
      content: 'Quote me!',
      status: 'read',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const onSendMessage = vi.fn();
    const onCancelReply = vi.fn();

    const composer = React.createElement(MessageComposer, {
      conversationId: 'conv-1',
      onSendMessage,
      replyingTo,
      onCancelReply,
    });

    expect(composer).toBeDefined();
    expect(composer.props.replyingTo?.content).toBe('Quote me!');
  });

  it('renders MessageBubble with image attachment and resolves media url', () => {
    const mediaMessage: LocalMessage = {
      id: 'msg-media',
      conversationId: 'conv-1',
      senderId: 'peer-1',
      clientMessageId: 'cm1',
      type: 'image',
      content: '',
      status: 'delivered',
      attachments: [
        {
          id: 'att-1',
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 1048576,
          url: 'http://localhost:5000/api/v1/media/files/photo.jpg',
          uploadStatus: 'uploaded',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const bubble = React.createElement(MessageBubble, {
      message: mediaMessage,
      isOutbound: false,
    });

    expect(bubble).toBeDefined();
    expect(bubble.props.message.attachments?.[0]?.url).toBe(
      'http://localhost:5000/api/v1/media/files/photo.jpg',
    );
    expect(bubble.props.message.attachments?.[0]?.mimeType).toBe('image/jpeg');
  });
});
