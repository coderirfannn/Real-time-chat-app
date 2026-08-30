import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http, { type Server as HttpServer } from 'http';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { Types } from 'mongoose';
import { SocketEvents } from '@chatlock/shared-types';
import { createApp } from '../../app.js';
import { initSocketServer, closeSocketIO, connectionManager } from '../../socket/index.js';
import { conversationRepository } from '../../repositories/conversation.repository.js';
import { signAccessToken } from '../../utils/token.js';

describe('Socket.IO Gateway End-to-End Integration Tests', () => {
  let httpServer: HttpServer;
  let serverPort: number;
  let serverUrl: string;

  const userAId = new Types.ObjectId().toString();
  const convId = new Types.ObjectId().toString();

  const userAToken = signAccessToken({
    sub: userAId,
    email: 'userA@example.com',
    username: 'userA',
  }).token;

  beforeAll(async () => {
    const app = createApp();
    httpServer = http.createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        serverUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await closeSocketIO();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    connectionManager.clear();
  });

  it('connects successfully with valid JWT and joins user room', async () => {
    const client: ClientSocket = Client(serverUrl, {
      auth: { token: userAToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        expect(connectionManager.isUserOnline(userAId)).toBe(true);
        client.disconnect();
        resolve();
      });
      client.on('connect_error', (err) => reject(err));
    });
  });

  it('rejects connection without authentication token', async () => {
    const client: ClientSocket = Client(serverUrl, {
      auth: {},
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/Authentication token is required/i);
        client.disconnect();
        resolve();
      });
    });
  });

  it('rejects connection with invalid/tampered token', async () => {
    const client: ClientSocket = Client(serverUrl, {
      auth: { token: 'invalid.tampered.token' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/Invalid or expired authentication token/i);
        client.disconnect();
        resolve();
      });
    });
  });

  it('allows joining authorized conversation room', async () => {
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(true);

    const client: ClientSocket = Client(serverUrl, {
      auth: { token: userAToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.emit(
          SocketEvents.JOIN_ROOM,
          { conversationId: convId },
          (res: { success: boolean; room?: string; error?: string }) => {
            try {
              expect(res.success).toBe(true);
              expect(res.room).toBe(`conversation:${convId}`);
              client.disconnect();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        );
      });
    });
  });

  it('rejects joining unauthorized conversation room and emits ERROR event', async () => {
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(false);

    const client: ClientSocket = Client(serverUrl, {
      auth: { token: userAToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      let callbackReceived = false;
      let errorReceived = false;

      const checkDone = () => {
        if (callbackReceived && errorReceived) {
          client.disconnect();
          resolve();
        }
      };

      client.on('connect', () => {
        client.emit(
          SocketEvents.JOIN_ROOM,
          { conversationId: convId },
          (res: { success: boolean; error?: string }) => {
            expect(res.success).toBe(false);
            expect(res.error).toBe('You are not authorized to join this conversation');
            callbackReceived = true;
            checkDone();
          },
        );
      });

      client.on(SocketEvents.ERROR, (err: { code: string; message: string }) => {
        expect(err.code).toBe('ROOM_ACCESS_DENIED');
        errorReceived = true;
        checkDone();
      });
    });
  });

  it('handles disconnect and unregisters socket from ConnectionManager', async () => {
    const client: ClientSocket = Client(serverUrl, {
      auth: { token: userAToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        expect(connectionManager.isUserOnline(userAId)).toBe(true);

        client.disconnect();

        setTimeout(() => {
          expect(connectionManager.isUserOnline(userAId)).toBe(false);
          resolve();
        }, 50);
      });
    });
  });
});
