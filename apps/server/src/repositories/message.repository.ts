import { Types } from 'mongoose';
import { BaseRepository, type PaginationOptions, type PaginatedResult } from './base.repository.js';
import { MessageModel, type IMessageDoc } from '../models/message.model.js';
import type { MessageType, MessageAttachment, CursorPaginatedResult } from '@chatlock/shared-types';

const SENDER_FIELDS = '_id username displayName avatarUrl status';

export class MessageRepository extends BaseRepository<IMessageDoc> {
  constructor() {
    super(MessageModel);
  }

  public async findByClientMessageId(
    senderId: string | Types.ObjectId,
    clientMessageId: string,
  ): Promise<IMessageDoc | null> {
    return this.model
      .findOne({
        senderId: new Types.ObjectId(senderId),
        clientMessageId: clientMessageId.trim(),
      })
      .populate('senderId', SENDER_FIELDS)
      .exec();
  }

  public async findPopulatedById(messageId: string | Types.ObjectId): Promise<IMessageDoc | null> {
    if (!Types.ObjectId.isValid(messageId)) {
      return null;
    }

    return this.model.findById(messageId).populate('senderId', SENDER_FIELDS).exec();
  }

  public async createMessage(data: {
    conversationId: string | Types.ObjectId;
    senderId: string | Types.ObjectId;
    clientMessageId: string;
    type?: MessageType;
    content: string;
    attachments?: MessageAttachment[];
    replyToMessageId?: string | Types.ObjectId;
  }): Promise<IMessageDoc> {
    const created = await this.create({
      conversationId: new Types.ObjectId(data.conversationId),
      senderId: new Types.ObjectId(data.senderId),
      clientMessageId: data.clientMessageId.trim(),
      type: data.type || 'text',
      content: data.content.trim(),
      attachments: data.attachments,
      replyToMessageId: data.replyToMessageId
        ? new Types.ObjectId(data.replyToMessageId)
        : undefined,
    });

    return (await this.findPopulatedById(created._id.toString())) || created;
  }

  public async findConversationHistory(
    conversationId: string | Types.ObjectId,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<IMessageDoc>> {
    const convObj = new Types.ObjectId(conversationId);
    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, Math.min(100, pagination.limit));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model
        .find({ conversationId: convObj })
        .populate('senderId', SENDER_FIELDS)
        .sort(pagination.sort || { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.count({ conversationId: convObj }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      docs,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  public async findMessagesByCursor(
    conversationId: string | Types.ObjectId,
    options: {
      cursor?: string;
      limit?: number;
      direction?: 'before' | 'after';
    } = {},
  ): Promise<CursorPaginatedResult<IMessageDoc>> {
    const convObj = new Types.ObjectId(conversationId);
    const limit = Math.max(1, Math.min(100, options.limit || 50));
    const direction = options.direction || 'before';

    const query: Record<string, unknown> = {
      conversationId: convObj,
    };

    if (options.cursor && Types.ObjectId.isValid(options.cursor)) {
      const cursorObj = new Types.ObjectId(options.cursor);
      if (direction === 'before') {
        query._id = { $lt: cursorObj };
      } else {
        query._id = { $gt: cursorObj };
      }
    }

    const sortOrder = direction === 'before' ? -1 : 1;

    const docs = await this.model
      .find(query)
      .populate('senderId', SENDER_FIELDS)
      .sort({ _id: sortOrder })
      .limit(limit + 1)
      .exec();

    const hasMore = docs.length > limit;
    const paginatedDocs = hasMore ? docs.slice(0, limit) : docs;

    const lastDoc = paginatedDocs.length > 0 ? paginatedDocs[paginatedDocs.length - 1] : undefined;
    const firstDoc = paginatedDocs.length > 0 ? paginatedDocs[0] : undefined;

    const nextCursor = lastDoc ? lastDoc._id.toString() : null;
    const prevCursor = firstDoc ? firstDoc._id.toString() : null;

    return {
      messages: paginatedDocs,
      nextCursor: hasMore ? nextCursor : null,
      prevCursor,
      hasMore,
      limit,
    };
  }

  public async softDelete(messageId: string | Types.ObjectId): Promise<IMessageDoc | null> {
    return this.updateById(messageId.toString(), {
      deletedAt: new Date(),
      content: 'This message was deleted',
    });
  }

  public async editContent(
    messageId: string | Types.ObjectId,
    newContent: string,
  ): Promise<IMessageDoc | null> {
    return this.updateById(messageId.toString(), {
      content: newContent.trim(),
      editedAt: new Date(),
    });
  }
}

export const messageRepository = new MessageRepository();
