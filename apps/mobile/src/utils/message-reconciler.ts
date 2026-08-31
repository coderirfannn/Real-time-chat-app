import type { IMessage } from '@chatlock/shared-types';
import type { LocalMessage, OutboxMessage } from '../types/chat.types';

export interface ReconcileOptions {
  historyPages?: Array<{ messages?: IMessage[] } | undefined>;
  socketMessages?: LocalMessage[];
  optimisticMessages?: LocalMessage[];
  outboxMessages?: Array<LocalMessage | OutboxMessage>;
}

/**
 * Reconciles REST historical pages, incoming socket messages, outbox queued messages,
 * and local optimistic messages into a single, deduplicated, chronologically ordered list of LocalMessages.
 */
export function reconcileChatMessages(options: ReconcileOptions): LocalMessage[] {
  const {
    historyPages = [],
    socketMessages = [],
    optimisticMessages = [],
    outboxMessages = [],
  } = options;

  // Primary index maps: by server ID and by clientMessageId
  const messageMap = new Map<string, LocalMessage>();
  const clientToKeyMap = new Map<string, string>();

  const getOrAssignKey = (msg: { id?: string; clientMessageId?: string }): string => {
    if (msg.id && messageMap.has(msg.id)) {
      return msg.id;
    }
    if (msg.clientMessageId && clientToKeyMap.has(msg.clientMessageId)) {
      return clientToKeyMap.get(msg.clientMessageId)!;
    }
    const key = msg.id || msg.clientMessageId || `local_${Math.random().toString(36).substring(2)}`;
    return key;
  };

  const upsertMessage = (msg: LocalMessage) => {
    const key = getOrAssignKey(msg);

    if (msg.clientMessageId) {
      clientToKeyMap.set(msg.clientMessageId, key);
    }
    if (msg.id) {
      clientToKeyMap.set(msg.id, key);
    }

    const existing = messageMap.get(key);
    if (!existing) {
      messageMap.set(key, msg);
    } else {
      // Merge properties intelligently
      const merged: LocalMessage = {
        ...existing,
        ...msg,
        // Preserve populated sender if existing had it
        sender: msg.sender || existing.sender,
        // Preserve retry payload if still needed
        retryPayload: msg.retryPayload || existing.retryPayload,
        // If existing had an established server ID, preserve it
        id: msg.id || existing.id,
        // Status resolution
        status: msg.status || existing.status || 'delivered',
      };
      messageMap.set(key, merged);
    }
  };

  // 1. Process all REST history pages
  for (const page of historyPages) {
    if (!page || !Array.isArray(page.messages)) continue;
    for (const rawMsg of page.messages) {
      const formatted: LocalMessage = {
        ...rawMsg,
        clientMessageId: rawMsg.clientMessageId || `srv_${rawMsg.id}`,
        status: 'delivered',
      };
      upsertMessage(formatted);
    }
  }

  // 2. Process real-time socket events (e.g. message:new)
  for (const socketMsg of socketMessages) {
    upsertMessage(socketMsg);
  }

  // 3. Process persistent outbox messages (pending / sending / failed)
  for (const outboxMsg of outboxMessages) {
    upsertMessage(outboxMsg as LocalMessage);
  }

  // 4. Process local optimistic/sending messages
  for (const optMsg of optimisticMessages) {
    upsertMessage(optMsg);
  }

  // 5. Sort chronologically (ascending: oldest to newest)
  const result = Array.from(messageMap.values());
  result.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const idA = a.id || a.clientMessageId || '';
    const idB = b.id || b.clientMessageId || '';
    return idA.localeCompare(idB);
  });

  return result;
}
