import type { IMessage } from '@chatlock/shared-types';
import type { LocalMessage, OutboxMessage, DeliveryStatus } from '../types/chat.types';
import { decryptedCacheService } from '../services/crypto/decrypted-cache.service';

export interface ReconcileOptions {
  historyPages?: Array<{ messages?: IMessage[] } | undefined>;
  socketMessages?: LocalMessage[];
  optimisticMessages?: LocalMessage[];
  outboxMessages?: Array<LocalMessage | OutboxMessage>;
}

const STATUS_RANK: Record<string, number> = {
  failed: -1,
  pending: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  read: 5,
};

/**
 * Resolves the highest delivery status, ensuring monotonic progression
 * and preventing status downgrades (e.g. read cannot become delivered).
 */
export function resolveHighestStatus(
  statusA?: DeliveryStatus,
  statusB?: DeliveryStatus,
): DeliveryStatus {
  if (!statusA && !statusB) return 'sent';
  if (!statusA) return statusB!;
  if (!statusB) return statusA;

  // If one is failed and the other is confirmed sent/delivered/read on server, server wins
  if (statusA === 'failed' && (STATUS_RANK[statusB] ?? 0) >= 3) return statusB;
  if (statusB === 'failed' && (STATUS_RANK[statusA] ?? 0) >= 3) return statusA;
  if (statusA === 'failed' || statusB === 'failed') return 'failed';

  const rankA = STATUS_RANK[statusA] ?? 0;
  const rankB = STATUS_RANK[statusB] ?? 0;

  return rankA >= rankB ? statusA : statusB;
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
      // Merge properties with monotonic receipt status progression
      const mergedStatus = resolveHighestStatus(existing.status, msg.status);

      const cachedPlaintext =
        (msg.clientMessageId && decryptedCacheService.getSync(msg.clientMessageId)) ||
        (msg.id && decryptedCacheService.getSync(msg.id)) ||
        (existing.clientMessageId && decryptedCacheService.getSync(existing.clientMessageId)) ||
        (existing.id && decryptedCacheService.getSync(existing.id));

      const preservedContent =
        cachedPlaintext ||
        ((msg.encryptionState === 'E2EE' || msg.isEncrypted) && existing.content
          ? existing.content
          : msg.content);

      const merged: LocalMessage = {
        ...existing,
        ...msg,
        content: preservedContent,
        isEncrypted: msg.isEncrypted ?? existing.isEncrypted,
        encryptionState: msg.encryptionState ?? existing.encryptionState,
        senderDeviceId: msg.senderDeviceId ?? existing.senderDeviceId,
        e2eePayload: msg.e2eePayload ?? existing.e2eePayload,
        // Preserve populated sender if existing had it
        sender: msg.sender || existing.sender,
        // Preserve retry payload if still needed
        retryPayload: msg.retryPayload || existing.retryPayload,
        // If existing had an established server ID, preserve it
        id: msg.id || existing.id,
        // Monotonic status resolution
        status: mergedStatus,
        deliveredAt: msg.deliveredAt || existing.deliveredAt,
        readAt: msg.readAt || existing.readAt,
      };
      messageMap.set(key, merged);
    }
  };

  // 1. Process all REST history pages
  for (const page of historyPages) {
    if (!page || !Array.isArray(page.messages)) continue;
    for (const rawMsg of page.messages) {
      const cached =
        (rawMsg.clientMessageId && decryptedCacheService.getSync(rawMsg.clientMessageId)) ||
        (rawMsg.id && decryptedCacheService.getSync(rawMsg.id));

      const formatted: LocalMessage = {
        ...rawMsg,
        content: cached || rawMsg.content,
        isEncrypted: rawMsg.encryptionState === 'E2EE',
        clientMessageId: rawMsg.clientMessageId || `srv_${rawMsg.id}`,
        status: (rawMsg.status as DeliveryStatus) || 'sent',
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
