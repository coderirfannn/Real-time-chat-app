import { Types } from 'mongoose';
import { BaseRepository } from './base.repository.js';
import { SessionModel, type ISessionDoc } from '../models/session.model.js';

export class SessionRepository extends BaseRepository<ISessionDoc> {
  constructor() {
    super(SessionModel);
  }

  public async findByTokenHash(tokenHash: string): Promise<ISessionDoc | null> {
    return this.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
  }

  public async createSession(data: {
    userId: string | Types.ObjectId;
    tokenHash: string;
    deviceId: string;
    expiresAt: Date;
  }): Promise<ISessionDoc> {
    return this.create({
      userId: new Types.ObjectId(data.userId),
      tokenHash: data.tokenHash,
      deviceId: data.deviceId,
      expiresAt: data.expiresAt,
      revokedAt: null,
    });
  }

  public async revokeSession(tokenHash: string): Promise<ISessionDoc | null> {
    return this.updateOne({ tokenHash }, { revokedAt: new Date() });
  }

  public async revokeAllUserSessions(userId: string | Types.ObjectId): Promise<number> {
    const result = await this.model
      .updateMany(
        { userId: new Types.ObjectId(userId), revokedAt: null },
        { revokedAt: new Date() },
      )
      .exec();
    return result.modifiedCount;
  }

  public async findActiveSessionsByUser(userId: string | Types.ObjectId): Promise<ISessionDoc[]> {
    return this.find({
      userId: new Types.ObjectId(userId),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
  }
}

export const sessionRepository = new SessionRepository();
