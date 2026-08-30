import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseAndValidateServerEnv,
  parseAndValidateMobileEnv,
  resetServerConfigCache,
} from '../index.js';

describe('Config Package', () => {
  beforeEach(() => {
    resetServerConfigCache();
  });

  describe('Server Config Validation', () => {
    it('parses valid environment with default values', () => {
      const config = parseAndValidateServerEnv({});
      expect(config.app.env).toBe('development');
      expect(config.app.port).toBe(5000);
      expect(config.mongo.uri).toBe('mongodb://localhost:27017/chatlock');
      expect(config.redis.host).toBe('localhost');
      expect(config.jwt.accessExpiresIn).toBe('15m');
      expect(config.features.messageReactions).toBe(true);
    });

    it('parses custom environment values accurately', () => {
      const customEnv = {
        NODE_ENV: 'production',
        PORT: '8080',
        MONGODB_URI: 'mongodb://cluster0.example.com/production_db',
        MONGODB_DB_NAME: 'production_db',
        REDIS_HOST: 'redis.internal',
        REDIS_PORT: '6380',
        REDIS_PASSWORD: 'secretpassword',
        JWT_ACCESS_SECRET: 'production_jwt_access_secret_very_long_and_safe_123',
        JWT_REFRESH_SECRET: 'production_jwt_refresh_secret_very_long_and_safe_123',
        ENABLE_VOICE_CALLS: 'true',
        ENABLE_END_TO_END_ENCRYPTION: 'true',
        ENABLE_MESSAGE_REACTIONS: 'false',
        CORS_ORIGIN: 'https://chatlock.app,https://admin.chatlock.app',
      };

      const config = parseAndValidateServerEnv(customEnv);
      expect(config.app.isProduction).toBe(true);
      expect(config.app.port).toBe(8080);
      expect(config.mongo.uri).toBe('mongodb://cluster0.example.com/production_db');
      expect(config.redis.port).toBe(6380);
      expect(config.redis.password).toBe('secretpassword');
      expect(config.app.corsOrigins).toEqual([
        'https://chatlock.app',
        'https://admin.chatlock.app',
      ]);
      expect(config.features.voiceCalls).toBe(true);
      expect(config.features.endToEndEncryption).toBe(true);
      expect(config.features.messageReactions).toBe(false);
    });

    it('throws when invalid port is given', () => {
      expect(() =>
        parseAndValidateServerEnv({
          PORT: '-10',
        }),
      ).toThrow();
    });
  });

  describe('Mobile Config Validation', () => {
    it('parses valid mobile public environment', () => {
      const mobileConfig = parseAndValidateMobileEnv({
        EXPO_PUBLIC_API_URL: 'https://api.chatlock.app/api/v1',
        EXPO_PUBLIC_SOCKET_URL: 'https://api.chatlock.app',
        EXPO_PUBLIC_APP_ENV: 'staging',
      });

      expect(mobileConfig.apiUrl).toBe('https://api.chatlock.app/api/v1');
      expect(mobileConfig.socketUrl).toBe('https://api.chatlock.app');
      expect(mobileConfig.isStaging).toBe(true);
      expect(mobileConfig.isProduction).toBe(false);
    });

    it('rejects invalid URLs', () => {
      expect(() =>
        parseAndValidateMobileEnv({
          EXPO_PUBLIC_API_URL: 'not-a-valid-url',
        }),
      ).toThrow();
    });
  });
});
