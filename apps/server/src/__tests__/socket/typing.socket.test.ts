import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTypingEvents } from '../../socket/events/typing.events.js';
import { conversationRepository } from '../../repositories/conversation.repository.js';
import { roomManager } from '../../socket/rooms.js';
import { SocketEvents } from '@chatlock/shared-types';
import type { AuthenticatedSocket } from '../../socket/middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../../socket/index.js';

describe('Real-Time Typing Socket.IO Unit Tests', () => {
  let mockSocket: {
    id: string;
    data: { user: { id: string; username: string } };
    on: ReturnType<typeof vi.fn>;
    to: ReturnType<typeof vi.fn>;
    listeners: Map<string, (payload: unknown) => void>;
  };
  let mockToRoom: {
    emit: ReturnType<typeof vi.fn>;
  };
  let mockIo: TypedSocketServer;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockToRoom = {
      emit: vi.fn(),
    };

    const listeners = new Map<string, (payload: unknown) => void>();
    mockSocket = {
      id: 'socket_alice',
      data: { user: { id: '6a9555038bfb4ed14a20c83c', username: 'alice' } },
      listeners,
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        listeners.set(event, handler);
      }),
      to: vi.fn().mockReturnValue(mockToRoom),
    };

    mockIo = {} as TypedSocketServer;
  });

  it('1. TYPING START: broadcasts typing:start to room participants when caller is a participant', async () => {
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(true);
    registerTypingEvents(mockSocket as unknown as AuthenticatedSocket, mockIo);

    const typingStartHandler = mockSocket.listeners.get(SocketEvents.TYPING_START);
    expect(typingStartHandler).toBeDefined();

    await typingStartHandler!({ conversationId: '6a9555038bfb4ed14a20c83d' });

    const expectedRoom = roomManager.getConversationRoom('6a9555038bfb4ed14a20c83d');
    expect(mockSocket.to).toHaveBeenCalledWith(expectedRoom);
    expect(mockToRoom.emit).toHaveBeenCalledWith(SocketEvents.TYPING_START, {
      conversationId: '6a9555038bfb4ed14a20c83d',
      userId: '6a9555038bfb4ed14a20c83c',
    });
  });

  it('2. TYPING STOP: broadcasts typing:stop to room participants', async () => {
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(true);
    registerTypingEvents(mockSocket as unknown as AuthenticatedSocket, mockIo);

    const typingStopHandler = mockSocket.listeners.get(SocketEvents.TYPING_STOP);
    expect(typingStopHandler).toBeDefined();

    await typingStopHandler!({ conversationId: '6a9555038bfb4ed14a20c83d' });

    const expectedRoom = roomManager.getConversationRoom('6a9555038bfb4ed14a20c83d');
    expect(mockSocket.to).toHaveBeenCalledWith(expectedRoom);
    expect(mockToRoom.emit).toHaveBeenCalledWith(SocketEvents.TYPING_STOP, {
      conversationId: '6a9555038bfb4ed14a20c83d',
      userId: '6a9555038bfb4ed14a20c83c',
    });
  });

  it('3. NON-PARTICIPANT: rejects typing events from non-participants without broadcasting', async () => {
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(false);
    registerTypingEvents(mockSocket as unknown as AuthenticatedSocket, mockIo);

    const typingStartHandler = mockSocket.listeners.get(SocketEvents.TYPING_START);
    await typingStartHandler!({ conversationId: '6a9555038bfb4ed14a20c83d' });

    expect(mockSocket.to).not.toHaveBeenCalled();
    expect(mockToRoom.emit).not.toHaveBeenCalled();
  });

  it('4. INVALID PAYLOAD: ignores malformed conversation IDs', async () => {
    registerTypingEvents(mockSocket as unknown as AuthenticatedSocket, mockIo);

    const typingStartHandler = mockSocket.listeners.get(SocketEvents.TYPING_START);
    await typingStartHandler!({ conversationId: 'not-a-valid-object-id' });

    expect(mockSocket.to).not.toHaveBeenCalled();
    expect(mockToRoom.emit).not.toHaveBeenCalled();
  });
});
