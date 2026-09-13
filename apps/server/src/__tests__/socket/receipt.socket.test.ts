import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerReceiptEvents } from '../../socket/events/receipt.events.js';
import { roomManager } from '../../socket/rooms.js';
import { conversationRepository } from '../../repositories/conversation.repository.js';
import { SocketEvents, type ReceiptUpdatePayload } from '@chatlock/shared-types';
import type { AuthenticatedSocket } from '../../socket/middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../../socket/index.js';
import type { ReceiptService } from '../../services/receipt.service.js';
import type { IConversationDoc } from '../../models/conversation.model.js';

describe('Real-Time Receipts Socket.IO Tests — Task 13 Verification', () => {
  let mockSocket: {
    id: string;
    data: { user: { id: string; username: string } };
    listeners: Map<string, (payload: unknown, callback?: (res: unknown) => void) => void>;
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };
  let mockIo: {
    to: ReturnType<typeof vi.fn>;
  };
  let mockToRoom: {
    to: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };
  let mockReceiptService: ReceiptService;

  const validUserId = '6a955a298f74016374325510';
  const validConvId = '6a955a298f74016374325511';
  const validMsgId = '6a955a298f74016374325512';

  beforeEach(() => {
    vi.restoreAllMocks();

    mockToRoom = {
      to: vi.fn(),
      emit: vi.fn(),
    };
    mockToRoom.to.mockReturnValue(mockToRoom);

    mockIo = {
      to: vi.fn().mockReturnValue(mockToRoom),
    };

    vi.spyOn(conversationRepository, 'findById').mockResolvedValue({
      _id: validConvId,
      participants: [validUserId, '6a955a298f74016374325513'],
    } as unknown as IConversationDoc);

    const listeners = new Map<
      string,
      (payload: unknown, callback?: (res: unknown) => void) => void
    >();
    mockSocket = {
      id: 'socket_bob_dev1',
      data: { user: { id: validUserId, username: 'bob' } },
      listeners,
      on: vi.fn(
        (event: string, handler: (payload: unknown, callback?: (res: unknown) => void) => void) => {
          listeners.set(event, handler);
        },
      ),
      emit: vi.fn(),
    };

    mockReceiptService = {
      processDeliveryReceipt: vi.fn().mockResolvedValue({
        conversationId: validConvId,
        messageId: validMsgId,
        userId: validUserId,
        status: 'delivered',
        deliveredAt: '2026-08-31T01:00:00.000Z',
        timestamp: '2026-08-31T01:00:00.000Z',
      } as ReceiptUpdatePayload),
      processReadReceipt: vi.fn().mockResolvedValue({
        conversationId: validConvId,
        messageId: validMsgId,
        userId: validUserId,
        status: 'read',
        readAt: '2026-08-31T01:01:00.000Z',
        deliveredAt: '2026-08-31T01:00:00.000Z',
        timestamp: '2026-08-31T01:01:00.000Z',
      } as ReceiptUpdatePayload),
      getUnreadCount: vi.fn().mockResolvedValue(0),
    } as unknown as ReceiptService;
  });

  // ====================================================
  // 1. RECIPIENT ONLINE: DELIVERY BROADCAST
  // ====================================================
  it('1. MESSAGE DELIVERED: processes and broadcasts message:delivered event to room', async () => {
    registerReceiptEvents(
      mockSocket as unknown as AuthenticatedSocket,
      mockIo as unknown as TypedSocketServer,
      mockReceiptService,
    );

    const deliveredHandler = mockSocket.listeners.get(SocketEvents.MESSAGE_DELIVERED);
    expect(deliveredHandler).toBeDefined();

    const callback = vi.fn();
    await deliveredHandler!(
      {
        conversationId: validConvId,
        messageId: validMsgId,
      },
      callback,
    );

    const expectedRoom = roomManager.getConversationRoom(validConvId);
    expect(mockIo.to).toHaveBeenCalledWith(expectedRoom);
    expect(mockToRoom.emit).toHaveBeenCalledWith(
      SocketEvents.MESSAGE_DELIVERED,
      expect.objectContaining({
        conversationId: validConvId,
        messageId: validMsgId,
        status: 'delivered',
      }),
    );
    expect(callback).toHaveBeenCalledWith({ success: true });
  });

  // ====================================================
  // 2. READ RECEIPT & MULTI-DEVICE BROADCAST
  // ====================================================
  it('2. MESSAGE READ: processes and broadcasts message:read to conversation room for all devices', async () => {
    registerReceiptEvents(
      mockSocket as unknown as AuthenticatedSocket,
      mockIo as unknown as TypedSocketServer,
      mockReceiptService,
    );

    const readHandler = mockSocket.listeners.get(SocketEvents.MESSAGE_READ);
    expect(readHandler).toBeDefined();

    const callback = vi.fn();
    await readHandler!(
      {
        conversationId: validConvId,
        messageId: validMsgId,
      },
      callback,
    );

    const expectedRoom = roomManager.getConversationRoom(validConvId);
    expect(mockIo.to).toHaveBeenCalledWith(expectedRoom);
    expect(mockToRoom.emit).toHaveBeenCalledWith(
      SocketEvents.MESSAGE_READ,
      expect.objectContaining({
        conversationId: validConvId,
        messageId: validMsgId,
        status: 'read',
      }),
    );
    expect(callback).toHaveBeenCalledWith({ success: true });
  });

  // ====================================================
  // 3. DUPLICATE RECEIPT: HANDLES SAFELY
  // ====================================================
  it('3. DUPLICATE RECEIPT: safely processes duplicate receipt events idempotently', async () => {
    registerReceiptEvents(
      mockSocket as unknown as AuthenticatedSocket,
      mockIo as unknown as TypedSocketServer,
      mockReceiptService,
    );

    const readHandler = mockSocket.listeners.get(SocketEvents.MESSAGE_READ);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    await readHandler!({ conversationId: validConvId, messageId: validMsgId }, callback1);
    await readHandler!({ conversationId: validConvId, messageId: validMsgId }, callback2);

    expect(mockReceiptService.processReadReceipt).toHaveBeenCalledTimes(2);
    expect(callback1).toHaveBeenCalledWith({ success: true });
    expect(callback2).toHaveBeenCalledWith({ success: true });
  });

  // ====================================================
  // 4. INVALID PAYLOAD REJECTION
  // ====================================================
  it('4. INVALID PAYLOAD: returns validation error when conversationId is invalid', async () => {
    registerReceiptEvents(
      mockSocket as unknown as AuthenticatedSocket,
      mockIo as unknown as TypedSocketServer,
      mockReceiptService,
    );

    const deliveredHandler = mockSocket.listeners.get(SocketEvents.MESSAGE_DELIVERED);
    const callback = vi.fn();

    await deliveredHandler!(
      {
        conversationId: 'not-valid-id',
        messageId: validMsgId,
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      }),
    );
  });
});
