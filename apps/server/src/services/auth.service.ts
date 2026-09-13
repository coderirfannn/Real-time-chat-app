import { Types } from 'mongoose';
import { loadServerConfig } from '@chatlock/config';
import type { RegisterInput, LoginInput, ChangePasswordInput } from '@chatlock/validation';
import type { AuthResponse, UserProfile } from '@chatlock/shared-types';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import { sessionRepository, type SessionRepository } from '../repositories/session.repository.js';
import { deviceRepository, type DeviceRepository } from '../repositories/device.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  calculateFutureDate,
} from '../utils/token.js';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  RateLimitExceededError,
} from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const authLogger = logger.child('AuthService');

// Precomputed dummy hash for constant-time comparison on nonexistent users (timing attack mitigation)
const DUMMY_HASH = '$2b$12$e8Y/3W7fJ8qG1Fj1uRzYmO9kR9lP5xO1hG7tK9vL3mQ1aB3cE5g2y';

// Sliding window lockout tracking for repeated failed attempts
interface FailedAttemptRecord {
  count: number;
  lockedUntil?: number;
}
const failedAttemptsMap = new Map<string, FailedAttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly sessionRepo: SessionRepository = sessionRepository,
    private readonly deviceRepo: DeviceRepository = deviceRepository,
  ) {}

  /**
   * Registers a new user identity, hashes their password, and creates an active session.
   */
  public async register(input: RegisterInput): Promise<AuthResponse> {
    const config = loadServerConfig();
    const cleanEmail = input.email.toLowerCase().trim();
    const cleanUsername = input.username.toLowerCase().trim();

    // 1. Check for duplicate email
    const existingEmail = await this.userRepo.findByEmail(cleanEmail);
    if (existingEmail) {
      throw new ConflictError('An account with this email address already exists');
    }

    // 2. Check for duplicate username
    const existingUsername = await this.userRepo.findByUsername(cleanUsername);
    if (existingUsername) {
      throw new ConflictError('Username is already taken');
    }

    // 3. Hash password
    const passwordHash = await hashPassword(input.password);

    // 4. Create user record
    const user = await this.userRepo.create({
      email: cleanEmail,
      username: cleanUsername,
      displayName: input.displayName.trim(),
      passwordHash,
      status: 'online',
      lastSeenAt: new Date(),
    });

    const userId = user._id.toString();
    const deviceId = input.deviceId || 'default-device';

    // 5. Register device if provided
    if (input.deviceId && input.platform && input.appVersion) {
      await this.deviceRepo.upsertDevice({
        userId,
        deviceId: input.deviceId,
        platform: input.platform,
        appVersion: input.appVersion,
      });
    }

    // 6. Generate refresh token & session
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const refreshExpiresAt = calculateFutureDate(config.jwt.refreshExpiresIn);

    await this.sessionRepo.createSession({
      userId,
      tokenHash,
      deviceId,
      expiresAt: refreshExpiresAt,
    });

    // 7. Sign access token
    const { token: accessToken, expiresInSeconds } = signAccessToken({
      sub: userId,
      email: user.email,
      username: user.username,
    });

    authLogger.info('User registered successfully', { userId, username: cleanUsername });

    return {
      user: user.toJSON() as unknown as UserProfile,
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      },
    };
  }

  /**
   * Authenticates user credentials with timing-safe comparison and provisions an active session.
   */
  public async login(input: LoginInput): Promise<AuthResponse> {
    const config = loadServerConfig();
    const identifier = input.identifier.toLowerCase().trim();

    // Check if identifier is currently locked out
    const attemptRecord = failedAttemptsMap.get(identifier);
    if (attemptRecord && attemptRecord.lockedUntil && attemptRecord.lockedUntil > Date.now()) {
      const minutesRemaining = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 60000);
      throw new RateLimitExceededError(
        `Account temporarily locked due to consecutive failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
      );
    }

    const recordFailedAttempt = () => {
      const current = failedAttemptsMap.get(identifier) || { count: 0 };
      const nextCount = current.count + 1;
      if (nextCount >= MAX_FAILED_ATTEMPTS) {
        failedAttemptsMap.set(identifier, {
          count: nextCount,
          lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
        });
        authLogger.warn('Account temporarily locked after max failed attempts', {
          identifier,
          maxAttempts: MAX_FAILED_ATTEMPTS,
        });
      } else {
        failedAttemptsMap.set(identifier, { count: nextCount });
      }
    };

    // 1. Find user with passwordHash
    const user = await this.userRepo.findByIdentifierWithPassword(identifier);
    if (!user) {
      // Perform constant-time dummy verification to eliminate timing oracle vulnerabilities
      await verifyPassword(input.password, DUMMY_HASH);
      recordFailedAttempt();
      throw new UnauthorizedError('Invalid email/username or password');
    }

    // 2. Verify password
    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      recordFailedAttempt();
      throw new UnauthorizedError('Invalid email/username or password');
    }

    // Successful login clears failed attempt tracking
    failedAttemptsMap.delete(identifier);

    const userId = user._id.toString();
    const deviceId = input.deviceId || 'default-device';

    // 3. Register device if provided
    if (input.deviceId && input.platform && input.appVersion) {
      await this.deviceRepo.upsertDevice({
        userId,
        deviceId: input.deviceId,
        platform: input.platform,
        appVersion: input.appVersion,
      });
    }

    // 4. Update online status
    await this.userRepo.updateStatus(userId, 'online');

    // 5. Generate refresh token & session
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const refreshExpiresAt = calculateFutureDate(config.jwt.refreshExpiresIn);

    await this.sessionRepo.createSession({
      userId,
      tokenHash,
      deviceId,
      expiresAt: refreshExpiresAt,
    });

    // 6. Sign access token
    const { token: accessToken, expiresInSeconds } = signAccessToken({
      sub: userId,
      email: user.email,
      username: user.username,
    });

    authLogger.info('User logged in successfully', { userId, deviceId });

    return {
      user: user.toJSON() as unknown as UserProfile,
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      },
    };
  }

  /**
   * Rotates a refresh token with strict reuse detection:
   * If a revoked/stale token is presented, all active sessions for that user account
   * are immediately revoked to protect against token theft.
   */
  public async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const config = loadServerConfig();
    const tokenHash = hashToken(refreshToken);

    // 1. Locate active session by token hash
    const session = await this.sessionRepo.findByTokenHash(tokenHash);
    if (!session) {
      // Check if this token belonged to an already revoked session (Token Reuse Detection)
      const staleSession = await this.sessionRepo.findAnyByTokenHash(tokenHash);
      if (staleSession) {
        const victimUserId = staleSession.userId.toString();
        authLogger.warn(
          'Security Alert: Refresh token reuse detected! Revoking all sessions for user',
          {
            userId: victimUserId,
            tokenHash,
          },
        );

        // Revoke all active sessions for this victim account immediately
        await this.sessionRepo.revokeAllUserSessions(victimUserId);

        throw new UnauthorizedError(
          'Security alert: Token reuse detected. All active sessions have been revoked for your safety. Please log in again.',
        );
      }

      throw new UnauthorizedError('Invalid, expired, or revoked refresh token');
    }

    // 2. Locate user
    const user = await this.userRepo.findById(session.userId.toString());
    if (!user) {
      throw new UnauthorizedError('User account associated with this session no longer exists');
    }

    const userId = user._id.toString();

    // 3. Rotate session: revoke old session
    await this.sessionRepo.revokeSession(tokenHash);

    // 4. Create new rotated session
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const refreshExpiresAt = calculateFutureDate(config.jwt.refreshExpiresIn);

    await this.sessionRepo.createSession({
      userId,
      tokenHash: newTokenHash,
      deviceId: session.deviceId,
      expiresAt: refreshExpiresAt,
    });

    // 5. Sign new access token
    const { token: accessToken, expiresInSeconds } = signAccessToken({
      sub: userId,
      email: user.email,
      username: user.username,
    });

    authLogger.debug('Session rotated successfully', { userId, deviceId: session.deviceId });

    return {
      user: user.toJSON() as unknown as UserProfile,
      tokens: {
        accessToken,
        refreshToken: newRawRefreshToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      },
    };
  }

  /**
   * Logs out a specific session by revoking its refresh token hash.
   */
  public async logout(refreshToken?: string, userId?: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await this.sessionRepo.revokeSession(tokenHash);
    } else if (userId) {
      await this.sessionRepo.revokeAllUserSessions(userId);
    }
    return { success: true };
  }

  /**
   * Revokes all active sessions for a user across all devices.
   */
  public async logoutAll(userId: string): Promise<{ revokedSessionsCount: number }> {
    const count = await this.sessionRepo.revokeAllUserSessions(userId);
    await this.userRepo.updateStatus(userId, 'offline');
    authLogger.info('All sessions revoked for user', { userId, revokedSessionsCount: count });
    return { revokedSessionsCount: count };
  }

  /**
   * Retrieves current authenticated user profile.
   */
  public async getCurrentUser(userId: string): Promise<UserProfile> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user.toJSON() as unknown as UserProfile;
  }

  /**
   * Updates user profile (displayName, avatarUrl, bio).
   */
  public async updateProfile(
    userId: string,
    data: { displayName?: string; avatarUrl?: string | null; bio?: string },
  ): Promise<UserProfile> {
    const cleanUserId = userId.trim();
    if (!Types.ObjectId.isValid(cleanUserId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const updates: Record<string, unknown> = {};
    if (data.displayName !== undefined) {
      const cleanName = data.displayName.trim();
      if (!cleanName) {
        throw new BadRequestError('Display name cannot be empty');
      }
      updates['displayName'] = cleanName;
    }
    if (data.avatarUrl !== undefined) {
      updates['avatarUrl'] = data.avatarUrl ? data.avatarUrl.trim() : null;
    }
    if (data.bio !== undefined) {
      updates['bio'] = data.bio ? data.bio.trim() : '';
    }

    const updated = await this.userRepo.updateById(cleanUserId, updates);
    if (!updated) {
      throw new NotFoundError('User not found');
    }

    authLogger.info('User profile updated', { userId: cleanUserId });
    return updated.toJSON() as unknown as UserProfile;
  }

  /**
   * Changes an authenticated user's password and revokes all active sessions for security.
   */
  public async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const cleanUserId = userId.trim();
    if (!Types.ObjectId.isValid(cleanUserId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const user = await this.userRepo.findByIdWithPassword(cleanUserId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isCurrentValid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const isSamePassword = await verifyPassword(input.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestError('New password cannot be the same as the current password');
    }

    const newPasswordHash = await hashPassword(input.newPassword);
    await this.userRepo.updateById(cleanUserId, { passwordHash: newPasswordHash });

    // Revoke all existing sessions across all devices
    await this.sessionRepo.revokeAllUserSessions(cleanUserId);

    authLogger.info('User changed password successfully and revoked all sessions', {
      userId: cleanUserId,
    });
  }
}

export const authService = new AuthService();
