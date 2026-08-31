import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresenceService, PRESENCE_KEY_PREFIX } from '../../services/presence.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import * as redisModule from '../../redis/client.js';

describe('PresenceService Unit Tests', () => {
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
      find: vi.fn().mockResolvedValue([]),
    } as unknown as UserRepository;

    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      pipeline: vi.fn().mockReturnValue({
        get: vi.fn(),
        exec: vi.fn().mockResolvedValue([[null, 'online']]),
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
  it('1. CONNECT: sets ephemeral presence in Redis with TTL and updates MongoDB status to online', async () => {
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
  // 2. HEARTBEAT / TTL REFRESH
  // ====================================================
  it('2. HEARTBEAT: refreshes Redis TTL without writing to MongoDB', async () => {
    const success = await presenceService.heartbeat('user_alice');

    expect(success).toBe(true);

    // Refreshed in Redis with 60s TTL
    expect(mockRedis.set).toHaveBeenCalledWith(
      `${PRESENCE_KEY_PREFIX}user_alice`,
      'online',
      'EX',
      60,
    );

    // CRITICAL REQUIREMENT: Zero MongoDB queries/writes during heartbeat
    expect(mockUserRepo.updateStatus).not.toHaveBeenCalled();
    expect(mockUserRepo.updateLastSeen).not.toHaveBeenCalled();
  });

  // ====================================================
  // 3. DISCONNECT / SET OFFLINE
  // ====================================================
  it('3. DISCONNECT: deletes Redis key and updates durable lastSeenAt and offline status in MongoDB', async () => {
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
  // 4. USER PRESENCE LOOKUP
  // ====================================================
  it('4. PRESENCE LOOKUP: returns online from Redis, falls back to MongoDB when offline', async () => {
    // Redis hit
    mockRedis.get.mockResolvedValueOnce('online');
    const onlinePresence = await presenceService.getUserPresence('user_alice');
    expect(onlinePresence).toEqual({ status: 'online' });
    expect(mockUserRepo.findById).not.toHaveBeenCalled();

    // Redis miss -> fallback to MongoDB
    mockRedis.get.mockResolvedValueOnce(null);
    const offlinePresence = await presenceService.getUserPresence('user_bob');
    expect(offlinePresence.status).toBe('offline');
    expect(offlinePresence.lastSeenAt).toEqual(new Date('2026-08-31T00:00:00Z'));
    expect(mockUserRepo.findById).toHaveBeenCalledWith('user_bob');
  });

  // ====================================================
  // 5. MULTI-USER PRESENCE LOOKUP
  // ====================================================
  it('5. MULTI-USER: retrieves batch presence using Redis pipeline', async () => {
    const presenceMap = await presenceService.getUsersPresence(['user_1', 'user_2']);
    expect(presenceMap).toBeDefined();
    expect(mockRedis.pipeline).toHaveBeenCalled();
  });
});
