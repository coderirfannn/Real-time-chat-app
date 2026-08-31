import type { Request, Response } from 'express';
import type { ApiResponse, UserProfile } from '@chatlock/shared-types';
import type { UserSearchQueryInput, UpdateProfileInput } from '@chatlock/validation';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import { authService, type AuthService } from '../services/auth.service.js';
import { presenceService, type PresenceService } from '../services/presence.service.js';
import { UnauthorizedError, NotFoundError } from '../errors/app-error.js';

export class UserController {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly auth: AuthService = authService,
    private readonly presence: PresenceService = presenceService,
  ) {}

  public getMe = async (req: Request, res: Response<ApiResponse<UserProfile>>): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await this.auth.getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user,
      timestamp: new Date().toISOString(),
    });
  };

  public updateMe = async (
    req: Request<unknown, unknown, UpdateProfileInput>,
    res: Response<ApiResponse<UserProfile>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const updated = await this.auth.updateProfile(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
      timestamp: new Date().toISOString(),
    });
  };

  public searchUsers = async (
    req: Request<unknown, unknown, unknown, UserSearchQueryInput>,
    res: Response<ApiResponse<UserProfile[]>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { q, limit } = req.query;
    const users = await this.userRepo.searchUsers(q || '', req.user.id, limit ? Number(limit) : 20);

    const userIds = users.map((u) => u.id);
    const presenceMap = await this.presence.getUsersPresence(userIds);

    const formatted: UserProfile[] = users.map((u) => {
      const livePresence = presenceMap[u.id];
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        status: livePresence?.status || u.status || 'offline',
        lastSeenAt: livePresence?.lastSeenAt
          ? livePresence.lastSeenAt.toISOString()
          : u.lastSeenAt
            ? u.lastSeenAt.toISOString()
            : undefined,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: formatted,
      timestamp: new Date().toISOString(),
    });
  };

  public getUserById = async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse<UserProfile>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const targetUser = await this.userRepo.findById(req.params.id);
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    const livePresence = await this.presence.getUserPresence(targetUser.id);

    const profile: UserProfile = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: targetUser.avatarUrl,
      bio: targetUser.bio,
      status: livePresence.status || targetUser.status || 'offline',
      lastSeenAt: livePresence.lastSeenAt
        ? livePresence.lastSeenAt.toISOString()
        : targetUser.lastSeenAt
          ? targetUser.lastSeenAt.toISOString()
          : undefined,
    };

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: profile,
      timestamp: new Date().toISOString(),
    });
  };
}

export const userController = new UserController();
