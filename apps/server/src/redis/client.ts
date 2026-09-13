import { Redis, type RedisOptions } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const redisLogger = logger.child('Redis');

export type RedisConnectionState =
  'connecting' | 'ready' | 'error' | 'reconnecting' | 'closed' | 'end';

class RedisConnectionManager {
  private client: Redis | null = null;
  private state: RedisConnectionState = 'closed';

  constructor() {
    // Lazy initialized
  }

  private createClient(): Redis {
    const options: RedisOptions = {
      keyPrefix: config.redis.keyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      autoResubscribe: true,
      retryStrategy: (times: number) => {
        if (times > 3) {
          return null; // Stop retrying to avoid spamming / crashing dev instances without Redis
        }
        const delay = Math.min(times * 200, 1000);
        redisLogger.warn(`Redis connection retry attempt #${times} in ${delay}ms`);
        return delay;
      },
    };

    if (config.redis.tls) {
      options.tls = {};
    }

    const client = config.redis.url
      ? new Redis(config.redis.url, options)
      : new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password || undefined,
          ...options,
        });

    client.on('connect', () => {
      this.state = 'connecting';
      redisLogger.info('Redis client connecting...');
    });

    client.on('ready', () => {
      this.state = 'ready';
      redisLogger.info('Redis client connected and ready', {
        host: config.redis.host,
        port: config.redis.port,
      });
    });

    client.on('error', (err: Error) => {
      this.state = 'error';
      redisLogger.error('Redis client error', err);
    });

    client.on('reconnecting', () => {
      this.state = 'reconnecting';
      redisLogger.warn('Redis client reconnecting...');
    });

    client.on('close', () => {
      this.state = 'closed';
      redisLogger.warn('Redis client connection closed');
    });

    client.on('end', () => {
      this.state = 'end';
      redisLogger.info('Redis client connection ended');
    });

    return client;
  }

  public async connect(): Promise<Redis> {
    if (this.client && this.state === 'ready') {
      return this.client;
    }

    if (!this.client) {
      this.client = this.createClient();
    }

    try {
      this.state = 'connecting';
      await this.client.connect();
      return this.client;
    } catch (error) {
      this.state = 'error';
      redisLogger.error('Failed to establish Redis connection', error as Error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      redisLogger.info('Closing Redis connection...');
      await this.client.quit();
      this.client = null;
      this.state = 'closed';
      redisLogger.info('Redis disconnected cleanly');
    } catch (error) {
      redisLogger.error('Error during Redis client shutdown', error as Error);
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
      this.state = 'closed';
    }
  }

  public getClient(): Redis {
    if (!this.client) {
      this.client = this.createClient();
    }
    return this.client;
  }

  public getStatus(): RedisConnectionState {
    return this.state;
  }

  public isReady(): boolean {
    return this.state === 'ready';
  }

  public createDuplicateClient(): Redis {
    return this.createClient();
  }

  public async ping(): Promise<boolean> {
    if (!this.client || this.state !== 'ready') {
      return false;
    }

    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisManager = new RedisConnectionManager();
export const connectRedis = redisManager.connect.bind(redisManager);
export const disconnectRedis = redisManager.disconnect.bind(redisManager);
export const getRedisClient = redisManager.getClient.bind(redisManager);
export const getRedisStatus = redisManager.getStatus.bind(redisManager);
export const isRedisReady = redisManager.isReady.bind(redisManager);
export const pingRedis = redisManager.ping.bind(redisManager);
