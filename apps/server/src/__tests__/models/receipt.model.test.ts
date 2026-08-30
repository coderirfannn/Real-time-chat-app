import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { MessageReceiptModel } from '../../models/message-receipt.model.js';

describe('MessageReceipt Model Schema & Validation', () => {
  const messageId = new Types.ObjectId();
  const conversationId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  it('validates a correct receipt document', () => {
    const receipt = new MessageReceiptModel({
      messageId,
      conversationId,
      userId,
      status: 'delivered',
      deliveredAt: new Date(),
    });

    const error = receipt.validateSync();
    expect(error).toBeUndefined();
    expect(receipt.status).toBe('delivered');
  });

  it('fails validation on invalid status', () => {
    const receipt = new MessageReceiptModel({
      messageId,
      conversationId,
      userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'unknown_status' as any,
    });

    const error = receipt.validateSync();
    expect(error?.errors['status']).toBeDefined();
  });
});
