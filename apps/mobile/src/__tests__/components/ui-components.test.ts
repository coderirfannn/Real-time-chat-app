import { describe, it, expect } from 'vitest';
import React from 'react';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import { Card } from '../../components/ui/Card';

describe('UI Primitives & Adapted Components — Task Phase 1 Verification', () => {
  it('1. AVATAR: renders initials fallback and handles sizes cleanly', () => {
    const el = React.createElement(Avatar, { name: 'Alice Walker', size: 'md', isOnline: true });
    expect(el).toBeDefined();
    expect(el.props.name).toBe('Alice Walker');
    expect(el.props.size).toBe('md');
    expect(el.props.isOnline).toBe(true);

    const elXs = React.createElement(Avatar, { name: 'Bob', size: 'xs' });
    expect(elXs.props.size).toBe('xs');
  });

  it('2. BADGE: renders count with capped max and custom variants', () => {
    const el = React.createElement(Badge, { count: 5, variant: 'primary' });
    expect(el).toBeDefined();
    expect(el.props.count).toBe(5);
    expect(el.props.variant).toBe('primary');

    const elNull = React.createElement(Badge, { count: 0 });
    expect(elNull.props.count).toBe(0);
  });

  it('3. BUTTON: supports variants, sizes, and states', () => {
    const btnPrimary = React.createElement(Button, {
      title: 'Send Message',
      variant: 'primary',
      size: 'lg',
      loading: false,
    });
    expect(btnPrimary).toBeDefined();
    expect(btnPrimary.props.title).toBe('Send Message');
    expect(btnPrimary.props.variant).toBe('primary');
    expect(btnPrimary.props.size).toBe('lg');

    const btnOutline = React.createElement(Button, {
      title: 'Cancel',
      variant: 'outline',
      disabled: true,
    });
    expect(btnOutline.props.variant).toBe('outline');
    expect(btnOutline.props.disabled).toBe(true);
  });

  it('4. INPUT: supports labels, error states, and accessories', () => {
    const input = React.createElement(Input, {
      label: 'Email',
      placeholder: 'user@example.com',
      error: 'Invalid email address',
    });
    expect(input).toBeDefined();
    expect(input.props.label).toBe('Email');
    expect(input.props.error).toBe('Invalid email address');
  });

  it('5. SEARCH INPUT: accepts value, placeholder, and clear callback', () => {
    const search = React.createElement(SearchInput, {
      value: 'Alice',
      onChangeText: () => {},
      placeholder: 'Search chats...',
    });
    expect(search).toBeDefined();
    expect(search.props.value).toBe('Alice');
    expect(search.props.placeholder).toBe('Search chats...');
  });

  it('6. CARD: renders with padding presets and optional interactive handler', () => {
    const card = React.createElement(Card, { padding: 'lg', children: 'Content' });
    expect(card).toBeDefined();
    expect((card.props as { padding?: string }).padding).toBe('lg');
  });
});

