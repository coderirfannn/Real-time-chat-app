import { outboxService, type OutboxService } from './outbox.service';
import { socketManager, type SocketManager } from '../socket/socket.manager';
import {
  isRetryableError,
  calculateBackoffDelay,
  hasExceededMaxRetries,
} from '../retry/retry-engine';
import type { OutboxMessage } from '../../types/chat.types';
import type { MessageAckResponse } from '@chatlock/shared-types';

export interface OutboxSentEvent {
  clientMessageId: string;
  serverMessageId?: string;
  conversationId: string;
}

export interface OutboxFailedEvent {
  clientMessageId: string;
  conversationId: string;
  error: string;
  isRetryable: boolean;
}

export class OutboxSyncManager {
  private static instance: OutboxSyncManager | null = null;
  private isProcessing = false;
  private retryTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private sentListeners: Set<(event: OutboxSentEvent) => void> = new Set();
  private failedListeners: Set<(event: OutboxFailedEvent) => void> = new Set();

  private constructor(
    private readonly outbox: OutboxService = outboxService,
    private readonly socketMgr: SocketManager = socketManager,
  ) {}

  public static getInstance(): OutboxSyncManager {
    if (!OutboxSyncManager.instance) {
      OutboxSyncManager.instance = new OutboxSyncManager();
    }
    return OutboxSyncManager.instance;
  }

  public onMessageSent(listener: (event: OutboxSentEvent) => void): () => void {
    this.sentListeners.add(listener);
    return () => this.sentListeners.delete(listener);
  }

  public onMessageFailed(listener: (event: OutboxFailedEvent) => void): () => void {
    this.failedListeners.add(listener);
    return () => this.failedListeners.delete(listener);
  }

  private notifySent(event: OutboxSentEvent): void {
    this.sentListeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        void err;
      }
    });
  }

  private notifyFailed(event: OutboxFailedEvent): void {
    this.failedListeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        void err;
      }
    });
  }

  /**
   * Sequentially drains the pending outbox queue.
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!this.socketMgr.isConnected()) return;

    this.isProcessing = true;

    try {
      const messages = await this.outbox.getAll();
      const pendingMessages = messages.filter(
        (m) => m.status === 'pending' || m.status === 'sending',
      );

      for (const message of pendingMessages) {
        // Stop draining if socket dropped mid-process
        if (!this.socketMgr.isConnected()) {
          break;
        }

        await this.sendMessageWithBackoff(message);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Sends a single outbox message and handles ACK, error classification, and retry scheduling.
   */
  public async sendMessageWithBackoff(message: OutboxMessage): Promise<boolean> {
    const { clientMessageId, conversationId, retryPayload, attempts } = message;

    // Check max attempts
    if (hasExceededMaxRetries(attempts)) {
      await this.outbox.markStatus(clientMessageId, 'failed');
      this.notifyFailed({
        clientMessageId,
        conversationId,
        error: 'Max retry attempts exceeded',
        isRetryable: false,
      });
      return false;
    }

    // Set status to sending
    await this.outbox.markStatus(clientMessageId, 'sending');

    try {
      const ack: MessageAckResponse = await this.socketMgr.sendMessage({
        conversationId: retryPayload.conversationId,
        clientMessageId: retryPayload.clientMessageId,
        content: retryPayload.content,
        type: message.type || 'text',
        attachments: message.attachments,
      });

      if (ack.success) {
        // Successfully acknowledged: remove from persistent outbox queue
        await this.outbox.dequeue(clientMessageId);
        this.clearRetryTimeout(clientMessageId);

        this.notifySent({
          clientMessageId,
          serverMessageId: ack.serverMessageId,
          conversationId,
        });

        return true;
      }

      // Handle server negative ACK
      const isRetryable = isRetryableError({
        errorCode: ack.errorCode,
        message: ack.error,
      });

      await this.handleFailedAttempt(message, ack.error || 'Server rejected message', isRetryable);
      return false;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isRetryable = isRetryableError(err);

      await this.handleFailedAttempt(message, errorMsg, isRetryable);
      return false;
    }
  }

  private async handleFailedAttempt(
    message: OutboxMessage,
    errorMsg: string,
    isRetryable: boolean,
  ): Promise<void> {
    const { clientMessageId, conversationId, attempts } = message;
    const newAttemptCount = attempts + 1;

    await this.outbox.updateAttempt(clientMessageId, errorMsg, isRetryable);

    if (!isRetryable || hasExceededMaxRetries(newAttemptCount)) {
      await this.outbox.markStatus(clientMessageId, 'failed');
      this.notifyFailed({
        clientMessageId,
        conversationId,
        error: errorMsg,
        isRetryable: false,
      });
      return;
    }

    // Schedule exponential backoff retry if network/socket is alive
    await this.outbox.markStatus(clientMessageId, 'pending');

    const delay = calculateBackoffDelay(newAttemptCount);
    this.scheduleRetry(clientMessageId, delay);
  }

  private scheduleRetry(clientMessageId: string, delayMs: number): void {
    this.clearRetryTimeout(clientMessageId);

    const timer = setTimeout(async () => {
      this.retryTimeouts.delete(clientMessageId);
      const all = await this.outbox.getAll();
      const target = all.find((m) => m.clientMessageId === clientMessageId);
      if (target && target.status === 'pending' && this.socketMgr.isConnected()) {
        await this.sendMessageWithBackoff(target);
      }
    }, delayMs);

    this.retryTimeouts.set(clientMessageId, timer);
  }

  private clearRetryTimeout(clientMessageId: string): void {
    const existing = this.retryTimeouts.get(clientMessageId);
    if (existing) {
      clearTimeout(existing);
      this.retryTimeouts.delete(clientMessageId);
    }
  }

  /**
   * Manually retries a failed or pending message immediately (e.g. user tapped Retry).
   */
  public async retryMessage(clientMessageId: string): Promise<boolean> {
    this.clearRetryTimeout(clientMessageId);

    const all = await this.outbox.getAll();
    const target = all.find((m) => m.clientMessageId === clientMessageId);
    if (!target) return false;

    // Reset attempt status
    target.status = 'pending';
    target.attempts = 0;
    await this.outbox.enqueue(target);

    return this.sendMessageWithBackoff(target);
  }

  public clearAllTimeouts(): void {
    this.retryTimeouts.forEach((timer) => clearTimeout(timer));
    this.retryTimeouts.clear();
  }
}

export const outboxSyncManager = OutboxSyncManager.getInstance();
