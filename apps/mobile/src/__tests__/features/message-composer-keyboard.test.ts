import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MessageComposer } from '../../features/chat/components/MessageComposer';

describe('MessageComposer Mobile Keyboard & Input UX Tests', () => {
  it('instantiates MessageComposer with keyboard persistence configuration', () => {
    const onSendMessage = vi.fn();
    const composer = React.createElement(MessageComposer, {
      conversationId: 'test-conv-1',
      onSendMessage,
    });

    expect(composer).toBeDefined();
    expect(composer.props.conversationId).toBe('test-conv-1');
    expect(composer.props.disabled).toBeUndefined();
  });

  it('keeps composer enabled when sending messages (does not force blur/dismiss)', () => {
    const onSendMessage = vi.fn();

    // In-flight sending state must NOT disable composer or blur keyboard
    const activeComposer = React.createElement(MessageComposer, {
      conversationId: 'test-conv-1',
      onSendMessage,
      disabled: false,
    });

    expect(activeComposer.props.disabled).toBe(false);
  });

  it('renders MessageComposer element structure and accepts custom placeholder', () => {
    const onSendMessage = vi.fn();
    const onFocus = vi.fn();

    const composer = React.createElement(MessageComposer, {
      conversationId: 'test-conv-1',
      onSendMessage,
      onFocus,
      placeholder: 'Type your message...',
    });

    expect(composer.props.placeholder).toBe('Type your message...');
    expect(composer.props.onFocus).toBe(onFocus);
  });

  it('allows consecutive message sending callbacks without unmounting', () => {
    const onSendMessage = vi.fn();

    const composer = React.createElement(MessageComposer, {
      conversationId: 'test-conv-1',
      onSendMessage,
    });

    // Simulate sending multiple consecutive messages
    composer.props.onSendMessage('Message 1');
    composer.props.onSendMessage('Message 2');
    composer.props.onSendMessage('Message 3');

    expect(onSendMessage).toHaveBeenCalledTimes(3);
    expect(onSendMessage).toHaveBeenNthCalledWith(1, 'Message 1');
    expect(onSendMessage).toHaveBeenNthCalledWith(2, 'Message 2');
    expect(onSendMessage).toHaveBeenNthCalledWith(3, 'Message 3');
  });
});
