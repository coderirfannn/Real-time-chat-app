import { Types } from 'mongoose';
import { BaseRepository, type PaginationOptions, type PaginatedResult } from './base.repository.js';
import { MessageModel, type IMessageDoc } from '../models/message.model.js';
import type { MessageType, MessageAttachment } from '@chatlock/shared-types';

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
    return this.paginate(
      { conversationId: convObj },
      {
        page: pagination.page,
        limit: pagination.limit,
        sort: { createdAt: -1 },
      },
    );
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
