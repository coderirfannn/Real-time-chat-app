import { appStorage } from '../storage/app-storage.service';
import type { OutboxMessage, DeliveryStatus } from '../../types/chat.types';

const OUTBOX_STORAGE_KEY = 'chatlock_persistent_outbox_v1';

export class OutboxService {
  private static instance: OutboxService | null = null;
  private queue: OutboxMessage[] = [];
  private isLoaded = false;
  private listeners: Set<(messages: OutboxMessage[]) => void> = new Set();

  private constructor() {}

  public static getInstance(): OutboxService {
    if (!OutboxService.instance) {
      OutboxService.instance = new OutboxService();
    }
    return OutboxService.instance;
  }

  /**
   * Initializes outbox queue from durable storage.
   */
  public async load(): Promise<OutboxMessage[]> {
    try {
      const raw = await appStorage.getItem(OUTBOX_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
        }
      }
    } catch {
      this.queue = [];
    }
    this.isLoaded = true;
    this.notify();
    return [...this.queue];
  }

  private async persist(): Promise<void> {
    try {
      await appStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Memory fallback continues
    }
    this.notify();
  }

  private notify(): void {
    const snapshot = [...this.queue];
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // Safe listener execution
      }
    });
  }

  /**
   * Subscribes to outbox queue updates.
   */
  public subscribe(listener: (messages: OutboxMessage[]) => void): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener([...this.queue]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Enqueues an offline message into durable storage.
   */
  public async enqueue(message: OutboxMessage): Promise<void> {
    if (!this.isLoaded) {
      await this.load();
    }

    const index = this.queue.findIndex((m) => m.clientMessageId === message.clientMessageId);

    if (index >= 0) {
      this.queue[index] = { ...this.queue[index], ...message };
    } else {
      this.queue.push(message);
    }

    await this.persist();
  }

  /**
   * Dequeues an acknowledged message from storage.
   */
  public async dequeue(clientMessageId: string): Promise<OutboxMessage | null> {
    if (!this.isLoaded) {
      await this.load();
    }

    const index = this.queue.findIndex((m) => m.clientMessageId === clientMessageId);
    if (index === -1) return null;

    const [removed] = this.queue.splice(index, 1);
    await this.persist();
    return removed ?? null;
  }

  /**
   * Retrieves all queued messages ordered by creation time.
   */
  public async getAll(): Promise<OutboxMessage[]> {
    if (!this.isLoaded) {
      await this.load();
    }
    return [...this.queue].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  /**
   * Retrieves all pending messages for a specific conversation.
   */
  public async getConversationPending(conversationId: string): Promise<OutboxMessage[]> {
    if (!this.isLoaded) {
      await this.load();
    }
    return this.queue
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Increments attempt count and logs last error on retry attempt.
   */
  public async updateAttempt(
    clientMessageId: string,
    error?: string,
    isRetryable: boolean = true,
  ): Promise<OutboxMessage | null> {
    if (!this.isLoaded) {
      await this.load();
    }

    const item = this.queue.find((m) => m.clientMessageId === clientMessageId);
    if (!item) return null;

    item.attempts += 1;
    item.lastAttemptAt = new Date().toISOString();
    item.lastError = error;
    item.isRetryable = isRetryable;
    item.updatedAt = new Date().toISOString();

    if (!isRetryable) {
      item.status = 'failed';
    }

    await this.persist();
    return { ...item };
  }

  /**
   * Updates the delivery status of a queued message.
   */
  public async markStatus(
    clientMessageId: string,
    status: DeliveryStatus,
  ): Promise<OutboxMessage | null> {
    if (!this.isLoaded) {
      await this.load();
    }

    const item = this.queue.find((m) => m.clientMessageId === clientMessageId);
    if (!item) return null;

    item.status = status;
    item.updatedAt = new Date().toISOString();
    await this.persist();
    return { ...item };
  }

  /**
   * Clears all items in the outbox.
   */
  public async clear(): Promise<void> {
    this.queue = [];
    await this.persist();
  }
}

export const outboxService = OutboxService.getInstance();
