import type { ID, Timestamps } from './common.js';

export type ReceiptStatus = 'sent' | 'delivered' | 'read';

export interface IMessageReceipt extends Timestamps {
  id: ID;
  messageId: ID;
  conversationId: ID;
  userId: ID;
  status: ReceiptStatus;
  deliveredAt?: string;
  readAt?: string;
}
