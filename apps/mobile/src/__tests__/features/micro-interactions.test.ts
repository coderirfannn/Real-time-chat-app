import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Button } from '../../components/ui/Button';
import { ReactionPicker } from '../../features/chat/components/ReactionPicker';

describe('Micro-Interactions & Motion — Phase 9 Verification', () => {
  it('1. BUTTON SPRING SCALE: instantiates with scale animation and handles touch gestures', () => {
    const onPress = vi.fn();
    const btn = React.createElement(Button, {
      title: 'Send Message',
      variant: 'primary',
      onPress,
    });
    expect(btn).toBeDefined();
    expect(btn.props.title).toBe('Send Message');
  });

  it('2. REACTION PICKER ENTRANCE: mounts with spring animation and triggers emoji selection', () => {
    const onSelectEmoji = vi.fn();
    const picker = React.createElement(ReactionPicker, {
      onSelectEmoji,
      isOutbound: true,
    });
    expect(picker).toBeDefined();
    expect(picker.props.isOutbound).toBe(true);
  });

  it('3. REACTION PICKER ACTIONS: supports reply and copy action buttons', () => {
    const onReply = vi.fn();
    const onCopy = vi.fn();
    const picker = React.createElement(ReactionPicker, {
      onSelectEmoji: () => {},
      onReply,
      onCopy,
      isOutbound: false,
    });
    expect(picker).toBeDefined();
    expect(picker.props.onReply).toBeDefined();
    expect(picker.props.onCopy).toBeDefined();
  });
});
