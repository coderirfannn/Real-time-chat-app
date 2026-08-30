import type {
  LocalMessage,
  ChatFeedItem,
  ChatMessageItem,
  DateSeparatorItem,
} from '../types/chat.types.js';
import { formatDateSeparator } from './date-formatter.js';

const CONSECUTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getSenderId(msg: LocalMessage): string {
  if (typeof msg.senderId === 'string') return msg.senderId;
  if (msg.senderId && typeof msg.senderId === 'object') {
    const s = msg.senderId as { id?: string; _id?: string };
    return s.id || s._id || '';
  }
  return '';
}

/**
 * Transforms chronological messages into feed items with date separators and consecutive grouping.
 * Returns items in REVERSE chronological order suitable for an inverted FlatList (index 0 = latest message).
 */
export function buildInvertedChatFeed(
  messages: LocalMessage[],
  currentUserId: string,
): ChatFeedItem[] {
  if (!messages || messages.length === 0) return [];

  // Sort chronologically (oldest first)
  const sorted = [...messages].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeA - timeB;
  });

  const forwardItems: ChatFeedItem[] = [];
  let lastDateKey = '';

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (!current) continue;

    const prev = i > 0 && sorted[i - 1] ? (sorted[i - 1] as LocalMessage) : undefined;
    const next =
      i < sorted.length - 1 && sorted[i + 1] ? (sorted[i + 1] as LocalMessage) : undefined;

    const currentDate = new Date(current.createdAt);
    const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;

    // 1. Insert date separator if date changes
    if (dateKey !== lastDateKey) {
      const separator: DateSeparatorItem = {
        itemType: 'date_separator',
        id: `date_${dateKey}`,
        label: formatDateSeparator(currentDate),
        timestamp: current.createdAt,
      };
      forwardItems.push(separator);
      lastDateKey = dateKey;
    }

    // 2. Check consecutive cluster properties
    const currentSender = getSenderId(current);
    const isOutbound = currentSender === currentUserId;

    const isPrevSameSender =
      prev !== undefined &&
      getSenderId(prev) === currentSender &&
      new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime() <
        CONSECUTIVE_THRESHOLD_MS;

    const isNextSameSender =
      next !== undefined &&
      getSenderId(next) === currentSender &&
      new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime() <
        CONSECUTIVE_THRESHOLD_MS;

    const msgItem: ChatMessageItem = {
      itemType: 'message',
      id: current.clientMessageId || current.id || `temp_${i}_${Date.now()}`,
      message: current,
      isOutbound,
      showAvatar: !isOutbound && !isNextSameSender,
      showTime: !isNextSameSender,
      isConsecutive: isPrevSameSender,
    };

    forwardItems.push(msgItem);
  }

  // Invert items so latest message is at index 0 for inverted FlatList
  return forwardItems.reverse();
}
