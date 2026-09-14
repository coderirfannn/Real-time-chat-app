import { Types } from 'mongoose';
import { BaseRepository, type PaginatedResult } from './base.repository.js';
import { UserModel, type IUserDoc } from '../models/user.model.js';
import type { UserStatus, UserRole, AccountStatus } from '@chatlock/shared-types';

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
      filter['_id'] = Types.ObjectId.isValid(excludeUserId)
        ? { $ne: new Types.ObjectId(excludeUserId) }
        : { $ne: excludeUserId };
    }

    if (clean) {
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
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

  public async findPaginatedUsers(options: {
    page: number;
    limit: number;
    query?: string;
    role?: UserRole;
    accountStatus?: AccountStatus;
  }): Promise<PaginatedResult<IUserDoc>> {
    const filter: Record<string, unknown> = {};

    if (options.role) {
      filter['role'] = options.role;
    }
    if (options.accountStatus) {
      filter['accountStatus'] = options.accountStatus;
    }
    if (options.query && options.query.trim()) {
      const clean = options.query.trim();
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter['$or'] = [{ username: regex }, { displayName: regex }, { email: regex }];
    }

    return this.paginate(filter, {
      page: options.page,
      limit: options.limit,
      sort: { createdAt: -1 },
    });
  }

  public async updateAccountStatus(
    userId: string,
    accountStatus: AccountStatus,
  ): Promise<IUserDoc | null> {
    return this.updateById(userId, { accountStatus });
  }

  public async updateRole(userId: string, role: UserRole): Promise<IUserDoc | null> {
    return this.updateById(userId, { role });
  }
}

export const userRepository = new UserRepository();
