import { Types, type FilterQuery } from 'mongoose';
import { BaseRepository, type PaginatedResult } from './base.repository.js';
import { ConversationModel, type IConversationDoc } from '../models/conversation.model.js';

export interface ConversationListOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  sort?: Record<string, 1 | -1>;
}

export interface PaginatedConversations<T> extends PaginatedResult<T> {
  nextCursor?: string | null;
}

const PARTICIPANT_FIELDS = '_id username displayName avatarUrl status lastSeenAt';
const LAST_MESSAGE_FIELDS = '_id content type senderId createdAt';

export class ConversationRepository extends BaseRepository<IConversationDoc> {
  constructor() {
    super(ConversationModel);
  }

  public async findDirectConversation(
    userAId: string | Types.ObjectId,
    userBId: string | Types.ObjectId,
  ): Promise<IConversationDoc | null> {
    const directKey = ConversationModel.generateDirectKey(userAId, userBId);
    return this.model
      .findOne({ directKey })
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('lastMessageId', LAST_MESSAGE_FIELDS)
      .exec();
  }

  public async createDirectConversation(
    userAId: string | Types.ObjectId,
    userBId: string | Types.ObjectId,
  ): Promise<IConversationDoc> {
    const objA = new Types.ObjectId(userAId);
    const objB = new Types.ObjectId(userBId);
    const directKey = ConversationModel.generateDirectKey(objA, objB);

    const doc = await this.create({
      type: 'direct',
      participants: [objA, objB],
      directKey,
      lastMessageAt: new Date(),
    });

    return this.findPopulatedById(doc._id.toString()) as Promise<IConversationDoc>;
  }

  public async createGroupConversation(params: {
    creatorId: string | Types.ObjectId;
    participantIds: (string | Types.ObjectId)[];
    title?: string;
    avatarUrl?: string;
  }): Promise<IConversationDoc> {
    const creatorObj = new Types.ObjectId(params.creatorId);
    const participantObjs = Array.from(
      new Set([creatorObj.toString(), ...params.participantIds.map((p) => p.toString())]),
    ).map((id) => new Types.ObjectId(id));

    const doc = await this.create({
      type: 'group',
      creatorId: creatorObj,
      participants: participantObjs,
      admins: [creatorObj],
      title: params.title,
      avatarUrl: params.avatarUrl,
      lastMessageAt: new Date(),
    });

    return this.findPopulatedById(doc._id.toString()) as Promise<IConversationDoc>;
  }

  public async findPopulatedById(
    conversationId: string | Types.ObjectId,
  ): Promise<IConversationDoc | null> {
    if (!Types.ObjectId.isValid(conversationId)) {
      return null;
    }

    return this.model
      .findById(conversationId)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('lastMessageId', LAST_MESSAGE_FIELDS)
      .exec();
  }

  public async isParticipant(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }

    const count = await this.model
      .countDocuments({
        _id: new Types.ObjectId(conversationId),
        participants: new Types.ObjectId(userId),
      })
      .exec();

    return count > 0;
  }

  public async findUserConversationsWithDetails(
    userId: string | Types.ObjectId,
    options: ConversationListOptions = {},
  ): Promise<PaginatedConversations<IConversationDoc>> {
    const userObj = new Types.ObjectId(userId);
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(50, options.limit || 20));

    const filter: FilterQuery<IConversationDoc> = {
      participants: userObj,
      isArchived: false,
    };

    if (options.cursor) {
      const cursorDate = new Date(options.cursor);
      if (!isNaN(cursorDate.getTime())) {
        filter['lastMessageAt'] = { $lt: cursorDate };
      }
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(options.cursor ? 0 : skip)
        .limit(limit)
        .populate('participants', PARTICIPANT_FIELDS)
        .populate('lastMessageId', LAST_MESSAGE_FIELDS)
        .exec(),
      this.model.countDocuments({ participants: userObj, isArchived: false }).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    let nextCursor: string | null = null;
    if (items.length > 0 && items.length === limit) {
      const lastItem = items[items.length - 1];
      if (lastItem?.lastMessageAt) {
        nextCursor = lastItem.lastMessageAt.toISOString();
      }
    }

    return {
      docs: items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextCursor,
    };
  }

  public async updateLastMessage(
    conversationId: string | Types.ObjectId,
    messageId: string | Types.ObjectId,
    lastMessageAt: Date = new Date(),
  ): Promise<IConversationDoc | null> {
    return this.updateById(conversationId.toString(), {
      lastMessageId: new Types.ObjectId(messageId),
      lastMessageAt,
    });
  }
}

export const conversationRepository = new ConversationRepository();
