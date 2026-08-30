import { loadServerConfig } from '@chatlock/config';
import type { RegisterInput, LoginInput } from '@chatlock/validation';
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
import { ConflictError, UnauthorizedError, NotFoundError } from '../errors/app-error.js';

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
   * Authenticates user credentials and provisions an active session.
   */
  public async login(input: LoginInput): Promise<AuthResponse> {
    const config = loadServerConfig();
    const identifier = input.identifier.trim();

    // 1. Find user with passwordHash
    const user = await this.userRepo.findByIdentifierWithPassword(identifier);
    if (!user) {
      throw new UnauthorizedError('Invalid email/username or password');
    }

    // 2. Verify password
    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email/username or password');
    }

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
   * Rotates a refresh token: revokes the old session and generates a fresh token pair.
   */
  public async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const config = loadServerConfig();
    const tokenHash = hashToken(refreshToken);

    // 1. Locate active session by token hash
    const session = await this.sessionRepo.findByTokenHash(tokenHash);
    if (!session) {
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
}

export const authService = new AuthService();
