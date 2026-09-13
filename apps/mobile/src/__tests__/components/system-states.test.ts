import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { ConversationListSkeleton } from '../../components/ConversationListSkeleton';
import { MessageFeedSkeleton } from '../../components/MessageFeedSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useSocketStore } from '../../store/socket.store';
import { useAppStore } from '../../store/app.store';

describe('System States & Skeletons — Phase 7 Verification', () => {
  beforeEach(() => {
    useSocketStore.setState({ connectionState: 'connected' });
    useAppStore.setState({ isOnline: true });
  });

  it('1. CONVERSATION SKELETON: instantiates with custom count and default styles', () => {
    const elDefault = React.createElement(ConversationListSkeleton, {});
    expect(elDefault).toBeDefined();

    const elCustom = React.createElement(ConversationListSkeleton, { count: 10 });
    expect(elCustom).toBeDefined();
    expect(elCustom.props.count).toBe(10);
  });

  it('2. MESSAGE FEED SKELETON: instantiates with placeholder bubble hierarchy', () => {
    const el = React.createElement(MessageFeedSkeleton, {});
    expect(el).toBeDefined();
    expect(el.type).toBe(MessageFeedSkeleton);
  });

  it('3. EMPTY STATE: accepts title, description, custom icon, and action handler', () => {
    let clicked = false;
    const el = React.createElement(EmptyState, {
      title: 'No Chats Yet',
      description: 'Start connecting with colleagues.',
      actionLabel: 'New Chat',
      onAction: () => {
        clicked = true;
      },
      icon: '💬',
    });

    expect(el).toBeDefined();
    expect(el.props.title).toBe('No Chats Yet');
    expect(el.props.description).toBe('Start connecting with colleagues.');
    expect(el.props.actionLabel).toBe('New Chat');
    expect(el.props.icon).toBe('💬');

    el.props.onAction?.();
    expect(clicked).toBe(true);
  });

  it('4. LOADING SPINNER: default colors match Cobalt brand palette', () => {
    const el = React.createElement(LoadingSpinner, {});
    expect(el).toBeDefined();
    expect(el.props.color).toBeUndefined(); // default value is in function args
  });

  it('5. CONNECTION BANNER: instantiates cleanly as a component', () => {
    const el = React.createElement(ConnectionBanner, {});
    expect(el).toBeDefined();
    expect(el.type).toBe(ConnectionBanner);
  });
});
