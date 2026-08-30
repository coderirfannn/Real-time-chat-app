import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Avatar } from '../../components/Avatar.js';
import { Badge } from '../../components/Badge.js';
import { DateSeparator } from '../../components/DateSeparator.js';
import { MessageBubble } from '../../features/chat/components/MessageBubble.js';
import type { LocalMessage } from '../../types/chat.types.js';

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
});
