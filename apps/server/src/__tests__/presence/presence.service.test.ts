import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresenceService, PRESENCE_KEY_PREFIX } from '../../services/presence.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import * as redisModule from '../../redis/client.js';

describe('PresenceService Unit Tests — Task 12 Verification', () => {
  let presenceService: PresenceService;
  let mockUserRepo: UserRepository;
  let mockRedis: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    pipeline: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockUserRepo = {
      updateStatus: vi.fn().mockResolvedValue({ id: 'user_1', status: 'online' }),
      updateLastSeen: vi.fn().mockResolvedValue({ id: 'user_1', lastSeenAt: new Date() }),
      findById: vi.fn().mockResolvedValue({
        id: 'user_1',
        status: 'offline',
        lastSeenAt: new Date('2026-08-31T00:00:00Z'),
      }),
      find: vi
        .fn()
        .mockResolvedValue([
          { id: 'user_2', status: 'offline', lastSeenAt: new Date('2026-08-31T00:00:00Z') },
        ]),
    } as unknown as UserRepository;

    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      pipeline: vi.fn().mockReturnValue({
        get: vi.fn(),
        exec: vi.fn().mockResolvedValue([
          [null, 'online'],
          [null, null],
        ]),
      }),
    };

    vi.spyOn(redisModule, 'isRedisReady').mockReturnValue(true);
    vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(
      mockRedis as unknown as ReturnType<typeof redisModule.getRedisClient>,
    );

    presenceService = new PresenceService(mockUserRepo, 60);
  });

  // ====================================================
  // 1. CONNECT / SET ONLINE
  // ====================================================
  it('1. CONNECT: sets ephemeral presence in Redis with 60s TTL and sets MongoDB status to online', async () => {
    const result = await presenceService.setOnline('user_alice');

    expect(result).toEqual({
      userId: 'user_alice',
      status: 'online',
    });

    // Redis ephemeral key set with 60s TTL
    expect(mockRedis.set).toHaveBeenCalledWith(
      `${PRESENCE_KEY_PREFIX}user_alice`,
      'online',
      'EX',
      60,
    );

    // MongoDB durable status updated
    expect(mockUserRepo.updateStatus).toHaveBeenCalledWith('user_alice', 'online');
  });

  // ====================================================
  // 2. DISCONNECT / SET OFFLINE
  // ====================================================
  it('2. DISCONNECT: deletes Redis key and records durable lastSeenAt and offline status in MongoDB', async () => {
    const result = await presenceService.setOffline('user_alice');

    expect(result.userId).toBe('user_alice');
    expect(result.status).toBe('offline');
    expect(result.lastSeenAt).toBeDefined();

    // Redis key deleted
    expect(mockRedis.del).toHaveBeenCalledWith(`${PRESENCE_KEY_PREFIX}user_alice`);

    // MongoDB updated with offline status & lastSeenAt
    expect(mockUserRepo.updateStatus).toHaveBeenCalledWith('user_alice', 'offline');
    expect(mockUserRepo.updateLastSeen).toHaveBeenCalledWith('user_alice');
  });

  // ====================================================
  // 3. HEARTBEAT / TTL RENEWAL (ZERO MONGODB WRITES)
  // ====================================================
  it('3. HEARTBEAT: refreshes Redis TTL in memory without writing to MongoDB', async () => {
    const success = await presenceService.heartbeat('user_alice');

    expect(success).toBe(true);

    // Refreshed in Redis with 60s TTL
    expect(mockRedis.set).toHaveBeenCalledWith(
      `${PRESENCE_KEY_PREFIX}user_alice`,
      'online',
      'EX',
      60,
    );

    // CRITICAL MANDATE: Zero MongoDB writes during heartbeat
    expect(mockUserRepo.updateStatus).not.toHaveBeenCalled();
    expect(mockUserRepo.updateLastSeen).not.toHaveBeenCalled();
  });

  // ====================================================
  // 4. TIMEOUT / STALE PRESENCE FALLBACK
  // ====================================================
  it('4. TIMEOUT: when Redis TTL expires, presence lookup falls back to durable MongoDB lastSeenAt', async () => {
    // Redis key has expired (returns null)
    mockRedis.get.mockResolvedValueOnce(null);

    const presence = await presenceService.getUserPresence('user_bob');

    expect(presence.status).toBe('offline');
    expect(presence.lastSeenAt).toEqual(new Date('2026-08-31T00:00:00Z'));
    expect(mockUserRepo.findById).toHaveBeenCalledWith('user_bob');
  });

  // ====================================================
  // 5. MULTIPLE USERS BATCH LOOKUP
  // ====================================================
  it('5. MULTIPLE USERS: retrieves batch presence for multiple users using Redis pipeline', async () => {
    const presenceMap = await presenceService.getUsersPresence(['user_1', 'user_2']);

    expect(presenceMap).toBeDefined();
    expect(mockRedis.pipeline).toHaveBeenCalled();
    expect(presenceMap['user_1']?.status).toBe('online');
    expect(presenceMap['user_2']?.status).toBe('offline');
  });
});
