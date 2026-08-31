import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReceiptService } from '../../services/receipt.service.js';
import type { MessageReceiptRepository } from '../../repositories/message-receipt.repository.js';
import type { ConversationRepository } from '../../repositories/conversation.repository.js';
import { ForbiddenError, BadRequestError } from '../../errors/app-error.js';

describe('ReceiptService Unit & Integration Tests — Task 13 Verification', () => {
  let receiptService: ReceiptService;
  let mockReceiptRepo: MessageReceiptRepository;
  let mockConvRepo: ConversationRepository;

  const validUserId = '6a955a298f74016374325510';
  const validConvId = '6a955a298f74016374325511';
  const validMsgId1 = '6a955a298f74016374325512';
  const validMsgId2 = '6a955a298f74016374325513';

  beforeEach(() => {
    mockReceiptRepo = {
      upsertReceipt: vi.fn().mockResolvedValue({
        status: 'delivered',
        deliveredAt: new Date(),
      }),
      batchUpsertReceipts: vi.fn().mockResolvedValue([]),
      markConversationAsRead: vi.fn().mockResolvedValue(2),
      getUnreadCount: vi.fn().mockResolvedValue(0),
    } as unknown as MessageReceiptRepository;

    mockConvRepo = {
      isParticipant: vi.fn().mockResolvedValue(true),
    } as unknown as ConversationRepository;

    receiptService = new ReceiptService(mockReceiptRepo, mockConvRepo);
  });

  // ====================================================
  // 1. RECIPIENT ONLINE: DELIVERY RECEIPT PROCESSING
  // ====================================================
  it('1. RECIPIENT ONLINE: processes message delivery receipt when participant acknowledges receipt', async () => {
    const res = await receiptService.processDeliveryReceipt(validUserId, {
      conversationId: validConvId,
      messageId: validMsgId1,
    });

    expect(res.conversationId).toBe(validConvId);
    expect(res.messageId).toBe(validMsgId1);
    expect(res.status).toBe('delivered');
    expect(res.deliveredAt).toBeDefined();

    expect(mockConvRepo.isParticipant).toHaveBeenCalledWith(validConvId, validUserId);
    expect(mockReceiptRepo.batchUpsertReceipts).toHaveBeenCalledWith({
      messageIds: [validMsgId1],
      conversationId: validConvId,
      userId: validUserId,
      status: 'delivered',
    });
  });

  // ====================================================
  // 2. READ RECEIPT PROCESSING & BATCH READ
  // ====================================================
  it('2. READ RECEIPT: processes read receipt for multiple messages', async () => {
    const res = await receiptService.processReadReceipt(validUserId, {
      conversationId: validConvId,
      messageIds: [validMsgId1, validMsgId2],
    });

    expect(res.conversationId).toBe(validConvId);
    expect(res.messageIds).toEqual([validMsgId1, validMsgId2]);
    expect(res.status).toBe('read');
    expect(res.readAt).toBeDefined();

    expect(mockReceiptRepo.batchUpsertReceipts).toHaveBeenCalledWith({
      messageIds: [validMsgId1, validMsgId2],
      conversationId: validConvId,
      userId: validUserId,
      status: 'read',
    });
  });

  // ====================================================
  // 3. CONVERSATION-LEVEL READ (ALL MESSAGES)
  // ====================================================
  it('3. CONVERSATION READ: marks entire conversation as read when no message ID specified', async () => {
    const res = await receiptService.processReadReceipt(validUserId, {
      conversationId: validConvId,
    });

    expect(res.conversationId).toBe(validConvId);
    expect(res.status).toBe('read');
    expect(mockReceiptRepo.markConversationAsRead).toHaveBeenCalledWith(validConvId, validUserId);
  });

  // ====================================================
  // 4. PARTICIPANT AUTHORIZATION ENFORCEMENT
  // ====================================================
  it('4. NON-PARTICIPANT: rejects receipt submission if user is not in conversation', async () => {
    vi.spyOn(mockConvRepo, 'isParticipant').mockResolvedValue(false);

    await expect(
      receiptService.processDeliveryReceipt(validUserId, {
        conversationId: validConvId,
        messageId: validMsgId1,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // ====================================================
  // 5. VALIDATION: INVALID OBJECT IDS
  // ====================================================
  it('5. INVALID ID: rejects malformed IDs', async () => {
    await expect(
      receiptService.processDeliveryReceipt('invalid-user-id', {
        conversationId: validConvId,
        messageId: validMsgId1,
      }),
    ).rejects.toThrow(BadRequestError);

    await expect(
      receiptService.processReadReceipt(validUserId, {
        conversationId: 'invalid-conv-id',
      }),
    ).rejects.toThrow(BadRequestError);
  });
});
