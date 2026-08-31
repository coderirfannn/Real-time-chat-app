import { BaseRepository } from './base.repository.js';
import { UserModel, type IUserDoc } from '../models/user.model.js';
import type { UserStatus } from '@chatlock/shared-types';

export class UserRepository extends BaseRepository<IUserDoc> {
  constructor() {
    super(UserModel);
  }

  public async findByEmail(email: string): Promise<IUserDoc | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  public async findByUsername(username: string): Promise<IUserDoc | null> {
    return this.findOne({ username: username.toLowerCase().trim() });
  }

  public async findByIdWithPassword(id: string): Promise<IUserDoc | null> {
    return this.model.findById(id).select('+passwordHash').exec();
  }

  public async findByIdentifierWithPassword(identifier: string): Promise<IUserDoc | null> {
    const clean = identifier.toLowerCase().trim();
    return this.model
      .findOne({
        $or: [{ email: clean }, { username: clean }],
      })
      .select('+passwordHash')
      .exec();
  }

  public async searchUsers(
    query: string,
    excludeUserId?: string,
    limit: number = 20,
  ): Promise<IUserDoc[]> {
    const clean = query.trim();
    const filter: Record<string, unknown> = {};

    if (excludeUserId) {
      filter['_id'] = { $ne: excludeUserId };
    }

    if (clean) {
      const regex = new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [{ username: regex }, { displayName: regex }, { email: regex }];
    }

    return this.model.find(filter).limit(Math.min(limit, 50)).sort({ displayName: 1 }).exec();
  }

  public async updateStatus(userId: string, status: UserStatus): Promise<IUserDoc | null> {
    return this.updateById(userId, {
      status,
      lastSeenAt: new Date(),
    });
  }

  public async updateLastSeen(userId: string): Promise<IUserDoc | null> {
    return this.updateById(userId, {
      lastSeenAt: new Date(),
    });
  }
}

export const userRepository = new UserRepository();
