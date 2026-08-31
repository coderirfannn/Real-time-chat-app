import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../services/auth.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import type { SessionRepository } from '../../repositories/session.repository.js';
import type { DeviceRepository } from '../../repositories/device.repository.js';
import { UnauthorizedError } from '../../errors/app-error.js';
import { Types } from 'mongoose';

describe('AuthService Token Reuse Detection & Timing Attack Unit Tests', () => {
  let authService: AuthService;
  let mockUserRepo: UserRepository;
  let mockSessionRepo: SessionRepository;
  let mockDeviceRepo: DeviceRepository;

  const validUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockUserRepo = {
      findById: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(validUserId),
        email: 'user@chatlock.dev',
        username: 'secureuser',
        toJSON: () => ({ id: validUserId, email: 'user@chatlock.dev', username: 'secureuser' }),
      }),
      findByIdentifierWithPassword: vi.fn(),
      updateById: vi.fn(),
    } as unknown as UserRepository;

    mockSessionRepo = {
      findByTokenHash: vi.fn(),
      findAnyByTokenHash: vi.fn(),
      revokeAllUserSessions: vi.fn().mockResolvedValue(3),
      revokeSession: vi.fn(),
      createSession: vi.fn(),
    } as unknown as SessionRepository;

    mockDeviceRepo = {} as unknown as DeviceRepository;

    authService = new AuthService(mockUserRepo, mockSessionRepo, mockDeviceRepo);
  });

  it('1. REUSE DETECTION: revokes all user sessions when a revoked refresh token is presented', async () => {
    // 1. Active session lookup returns null
    vi.spyOn(mockSessionRepo, 'findByTokenHash').mockResolvedValue(null);

    // 2. findAnyByTokenHash finds an old revoked session
    vi.spyOn(mockSessionRepo, 'findAnyByTokenHash').mockResolvedValue({
      userId: new Types.ObjectId(validUserId),
      tokenHash: 'reused_hash',
      revokedAt: new Date(Date.now() - 10000),
    } as never);

    await expect(authService.refreshToken('reused-refresh-token')).rejects.toThrow(
      UnauthorizedError,
    );

    // Verify all active sessions were revoked to protect the victim account
    expect(mockSessionRepo.revokeAllUserSessions).toHaveBeenCalledWith(validUserId);
  });

  it('2. UPDATE PROFILE: updates display name cleanly', async () => {
    vi.spyOn(mockUserRepo, 'updateById').mockResolvedValue({
      id: validUserId,
      displayName: 'New Name',
      username: 'secureuser',
      toJSON: () => ({ id: validUserId, displayName: 'New Name', username: 'secureuser' }),
    } as never);

    const res = await authService.updateProfile(validUserId, { displayName: 'New Name' });
    expect(res.displayName).toBe('New Name');
    expect(mockUserRepo.updateById).toHaveBeenCalledWith(validUserId, { displayName: 'New Name' });
  });
});
