import { describe, it, expect } from 'vitest';
import {
  formatMessageTime,
  formatConversationTime,
  formatDateSeparator,
} from '../../utils/date-formatter';

describe('Date Formatter Utilities Unit Tests', () => {
  it('formats message timestamp correctly', () => {
    const d = new Date('2026-08-30T10:45:00.000Z');
    const result = formatMessageTime(d);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty string for invalid date', () => {
    expect(formatMessageTime('invalid-date')).toBe('');
    expect(formatConversationTime(undefined)).toBe('');
    expect(formatDateSeparator('invalid-date')).toBe('');
  });

  it('formats conversation timestamp for today as time', () => {
    const today = new Date();
    const result = formatConversationTime(today);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats conversation timestamp for yesterday as "Yesterday"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatConversationTime(yesterday)).toBe('Yesterday');
  });

  it('formats date separator as "Today" for current day', () => {
    const today = new Date();
    expect(formatDateSeparator(today)).toBe('Today');
  });

  it('formats date separator as "Yesterday" for prior day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateSeparator(yesterday)).toBe('Yesterday');
  });
});
