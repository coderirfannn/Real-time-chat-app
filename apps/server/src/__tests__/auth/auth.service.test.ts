import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { AuthService } from '../../services/auth.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import type { SessionRepository } from '../../repositories/session.repository.js';
import type { DeviceRepository } from '../../repositories/device.repository.js';
import type { IUserDoc } from '../../models/user.model.js';
import type { ISessionDoc } from '../../models/session.model.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../errors/app-error.js';
import { hashPassword } from '../../utils/password.js';

describe('AuthService Business Logic', () => {
  let mockUserRepo: Partial<UserRepository>;
  let mockSessionRepo: Partial<SessionRepository>;
  let mockDeviceRepo: Partial<DeviceRepository>;
  let authService: AuthService;

  const sampleUserId = new Types.ObjectId();
  const sampleUserDoc = {
    _id: sampleUserId,
    email: 'alice@example.com',
    username: 'alice_w',
    displayName: 'Alice Walker',
    passwordHash: '',
    status: 'online',
    toJSON: () => ({
      id: sampleUserId.toString(),
      email: 'alice@example.com',
      username: 'alice_w',
      displayName: 'Alice Walker',
      status: 'online',
    }),
  };

  beforeEach(async () => {
    sampleUserDoc.passwordHash = await hashPassword('SecureP@ssword123');

    mockUserRepo = {
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      findByIdentifierWithPassword: vi.fn(),
      findById: vi.fn(),
      create: vi.fn().mockResolvedValue(sampleUserDoc as unknown as IUserDoc),
      updateStatus: vi.fn().mockResolvedValue(sampleUserDoc as unknown as IUserDoc),
    };

    mockSessionRepo = {
      createSession: vi.fn().mockResolvedValue({} as unknown as ISessionDoc),
      findByTokenHash: vi.fn(),
      findAnyByTokenHash: vi.fn().mockResolvedValue(null),
      revokeSession: vi.fn().mockResolvedValue({} as unknown as ISessionDoc),
      revokeAllUserSessions: vi.fn().mockResolvedValue(2),
    };

    mockDeviceRepo = {
      upsertDevice: vi.fn().mockResolvedValue(null),
    };

    authService = new AuthService(
      mockUserRepo as UserRepository,
      mockSessionRepo as SessionRepository,
      mockDeviceRepo as DeviceRepository,
    );
  });

  describe('register', () => {
    it('successfully registers a new user and issues tokens', async () => {
      vi.mocked(mockUserRepo.findByEmail!).mockResolvedValue(null);
      vi.mocked(mockUserRepo.findByUsername!).mockResolvedValue(null);

      const result = await authService.register({
        email: 'Alice@Example.Com',
        username: 'alice_w',
        displayName: 'Alice Walker',
        password: 'SecureP@ssword123',
        deviceId: 'device-iphone-15',
        platform: 'ios',
        appVersion: '1.0.0',
      });

      expect(result.user.email).toBe('alice@example.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.tokens.tokenType).toBe('Bearer');
      expect(mockSessionRepo.createSession).toHaveBeenCalled();
      expect(mockDeviceRepo.upsertDevice).toHaveBeenCalled();
    });

    it('throws ConflictError when email is already registered', async () => {
      vi.mocked(mockUserRepo.findByEmail!).mockResolvedValue(sampleUserDoc as unknown as IUserDoc);

      await expect(
        authService.register({
          email: 'alice@example.com',
          username: 'new_username',
          displayName: 'Alice',
          password: 'SecureP@ssword123',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when username is already taken', async () => {
      vi.mocked(mockUserRepo.findByEmail!).mockResolvedValue(null);
      vi.mocked(mockUserRepo.findByUsername!).mockResolvedValue(
        sampleUserDoc as unknown as IUserDoc,
      );

      await expect(
        authService.register({
          email: 'unique@example.com',
          username: 'alice_w',
          displayName: 'Alice',
          password: 'SecureP@ssword123',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('successfully logs in with valid credentials', async () => {
      vi.mocked(mockUserRepo.findByIdentifierWithPassword!).mockResolvedValue(
        sampleUserDoc as unknown as IUserDoc,
      );

      const result = await authService.login({
        identifier: 'alice_w',
        password: 'SecureP@ssword123',
      });

      expect(result.user.username).toBe('alice_w');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockSessionRepo.createSession).toHaveBeenCalled();
    });

    it('throws UnauthorizedError when identifier is not found', async () => {
      vi.mocked(mockUserRepo.findByIdentifierWithPassword!).mockResolvedValue(null);

      await expect(
        authService.login({
          identifier: 'non_existent_user',
          password: 'Password123',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when password is wrong', async () => {
      vi.mocked(mockUserRepo.findByIdentifierWithPassword!).mockResolvedValue(
        sampleUserDoc as unknown as IUserDoc,
      );

      await expect(
        authService.login({
          identifier: 'alice_w',
          password: 'IncorrectPassword999',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshToken (Token Rotation)', () => {
    it('rotates refresh token and returns new access + refresh pair', async () => {
      const activeSession = {
        userId: sampleUserId,
        deviceId: 'device-001',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      vi.mocked(mockSessionRepo.findByTokenHash!).mockResolvedValue(
        activeSession as unknown as ISessionDoc,
      );
      vi.mocked(mockUserRepo.findById!).mockResolvedValue(sampleUserDoc as unknown as IUserDoc);

      const result = await authService.refreshToken('old_raw_refresh_token_string');

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      // Verifies token rotation: old session revoked and new session created
      expect(mockSessionRepo.revokeSession).toHaveBeenCalled();
      expect(mockSessionRepo.createSession).toHaveBeenCalled();
    });

    it('throws UnauthorizedError when refresh token does not exist or is revoked', async () => {
      vi.mocked(mockSessionRepo.findByTokenHash!).mockResolvedValue(null);

      await expect(authService.refreshToken('invalid_or_revoked_token')).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe('logout & logoutAll', () => {
    it('revokes session on single logout', async () => {
      const result = await authService.logout('raw_token_to_logout');
      expect(result.success).toBe(true);
      expect(mockSessionRepo.revokeSession).toHaveBeenCalled();
    });

    it('revokes all sessions on logoutAll', async () => {
      const result = await authService.logoutAll(sampleUserId.toString());
      expect(result.revokedSessionsCount).toBe(2);
      expect(mockSessionRepo.revokeAllUserSessions).toHaveBeenCalledWith(sampleUserId.toString());
    });
  });

  describe('getCurrentUser', () => {
    it('returns public profile of authenticated user', async () => {
      vi.mocked(mockUserRepo.findById!).mockResolvedValue(sampleUserDoc as unknown as IUserDoc);

      const profile = await authService.getCurrentUser(sampleUserId.toString());
      expect(profile.id).toBe(sampleUserId.toString());
      expect(profile.email).toBe('alice@example.com');
    });

    it('throws NotFoundError if user no longer exists', async () => {
      vi.mocked(mockUserRepo.findById!).mockResolvedValue(null);

      await expect(authService.getCurrentUser('507f1f77bcf86cd799439099')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
