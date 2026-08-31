import { getRedisClient, isRedisReady } from '../redis/client.js';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import type { UserStatus, PresenceUpdatePayload } from '@chatlock/shared-types';
import { logger } from '../utils/logger.js';

const presenceLogger = logger.child('PresenceService');

export const PRESENCE_KEY_PREFIX = 'presence:';
export const DEFAULT_PRESENCE_TTL_SECONDS = 60;

export class PresenceService {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly ttlSeconds: number = DEFAULT_PRESENCE_TTL_SECONDS,
  ) {}

  private getPresenceKey(userId: string): string {
    return `${PRESENCE_KEY_PREFIX}${userId.trim()}`;
  }

  /**
   * Sets a user's presence to online in Redis (ephemeral) and MongoDB (durable).
   */
  public async setOnline(userId: string): Promise<PresenceUpdatePayload> {
    const cleanUserId = userId.trim();
    const key = this.getPresenceKey(cleanUserId);

    try {
      if (isRedisReady()) {
        const redis = getRedisClient();
        await redis.set(key, 'online', 'EX', this.ttlSeconds);
      }
    } catch (err) {
      presenceLogger.warn('Failed to set presence in Redis', { userId: cleanUserId, error: err });
    }

    try {
      await this.userRepo.updateStatus(cleanUserId, 'online');
    } catch (err) {
      presenceLogger.error('Failed to update online status in MongoDB', {
        userId: cleanUserId,
        error: err,
      });
    }

    presenceLogger.debug('User marked online', { userId: cleanUserId });

    return {
      userId: cleanUserId,
      status: 'online',
    };
  }

  /**
   * Refreshes presence TTL in Redis for active user heartbeat.
   * NOTE: Does NOT write to MongoDB on heartbeats to protect DB throughput.
   */
  public async heartbeat(userId: string): Promise<boolean> {
    const cleanUserId = userId.trim();
    const key = this.getPresenceKey(cleanUserId);

    try {
      if (isRedisReady()) {
        const redis = getRedisClient();
        // Set with TTL in case it expired, or renew
        const result = await redis.set(key, 'online', 'EX', this.ttlSeconds);
        return result === 'OK';
      }
    } catch (err) {
      presenceLogger.warn('Heartbeat failed in Redis', { userId: cleanUserId, error: err });
    }

    return false;
  }

  /**
   * Sets a user's presence to offline in Redis and updates lastSeenAt in MongoDB.
   */
  public async setOffline(userId: string): Promise<PresenceUpdatePayload> {
    const cleanUserId = userId.trim();
    const key = this.getPresenceKey(cleanUserId);
    const now = new Date();

    try {
      if (isRedisReady()) {
        const redis = getRedisClient();
        await redis.del(key);
      }
    } catch (err) {
      presenceLogger.warn('Failed to delete presence key from Redis', {
        userId: cleanUserId,
        error: err,
      });
    }

    try {
      await this.userRepo.updateStatus(cleanUserId, 'offline');
      await this.userRepo.updateLastSeen(cleanUserId);
    } catch (err) {
      presenceLogger.error('Failed to update offline status and lastSeenAt in MongoDB', {
        userId: cleanUserId,
        error: err,
      });
    }

    presenceLogger.debug('User marked offline', { userId: cleanUserId, lastSeenAt: now });

    return {
      userId: cleanUserId,
      status: 'offline',
      lastSeenAt: now.toISOString(),
    };
  }

  /**
   * Retrieves single user presence state (checking Redis first, falling back to MongoDB).
   */
  public async getUserPresence(userId: string): Promise<{ status: UserStatus; lastSeenAt?: Date }> {
    const cleanUserId = userId.trim();
    const key = this.getPresenceKey(cleanUserId);

    try {
      if (isRedisReady()) {
        const redis = getRedisClient();
        const redisVal = await redis.get(key);
        if (redisVal === 'online') {
          return { status: 'online' };
        }
      }
    } catch (err) {
      presenceLogger.warn('Error reading presence from Redis', { userId: cleanUserId, error: err });
    }

    // Fallback to MongoDB
    const user = await this.userRepo.findById(cleanUserId);
    if (!user) {
      return { status: 'offline' };
    }

    return {
      status: user.status || 'offline',
      lastSeenAt: user.lastSeenAt,
    };
  }

  /**
   * Multi-user presence lookup with pipeline Redis reads.
   */
  public async getUsersPresence(
    userIds: string[],
  ): Promise<Record<string, { status: UserStatus; lastSeenAt?: Date }>> {
    const result: Record<string, { status: UserStatus; lastSeenAt?: Date }> = {};
    if (userIds.length === 0) return result;

    const cleanIds = userIds.map((id) => id.trim());

    try {
      if (isRedisReady()) {
        const redis = getRedisClient();
        const pipeline = redis.pipeline();
        cleanIds.forEach((id) => pipeline.get(this.getPresenceKey(id)));
        const results = await pipeline.exec();

        if (results) {
          cleanIds.forEach((id, idx) => {
            const row = results[idx];
            if (row && !row[0] && row[1] === 'online') {
              result[id] = { status: 'online' };
            }
          });
        }
      }
    } catch (err) {
      presenceLogger.warn('Error reading multi-presence from Redis', { error: err });
    }

    // For any missing user IDs, fetch from MongoDB
    const missingIds = cleanIds.filter((id) => !result[id]);
    if (missingIds.length > 0) {
      const users = await this.userRepo.find({ _id: { $in: missingIds } });
      users.forEach((u) => {
        result[u.id] = {
          status: u.status || 'offline',
          lastSeenAt: u.lastSeenAt,
        };
      });
    }

    return result;
  }
}

export const presenceService = new PresenceService();
