import { Types } from 'mongoose';
import { BaseRepository } from './base.repository.js';
import { MessageReceiptModel, type IMessageReceiptDoc } from '../models/message-receipt.model.js';
import type { ReceiptStatus } from '@chatlock/shared-types';

export class MessageReceiptRepository extends BaseRepository<IMessageReceiptDoc> {
  constructor() {
    super(MessageReceiptModel);
  }

  public async upsertReceipt(data: {
    messageId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    status: ReceiptStatus;
  }): Promise<IMessageReceiptDoc | null> {
    const msgObj = new Types.ObjectId(data.messageId);
    const userObj = new Types.ObjectId(data.userId);
    const convObj = new Types.ObjectId(data.conversationId);
    const now = new Date();

    const updateFields: Record<string, unknown> = {
      status: data.status,
      conversationId: convObj,
    };

    if (data.status === 'delivered') {
      updateFields['deliveredAt'] = now;
    } else if (data.status === 'read') {
      updateFields['readAt'] = now;
      updateFields['deliveredAt'] = now;
    }

    return this.model
      .findOneAndUpdate(
        { messageId: msgObj, userId: userObj },
        {
          $set: updateFields,
          $setOnInsert: { messageId: msgObj, userId: userObj },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  public async findReceiptsForMessage(
    messageId: string | Types.ObjectId,
  ): Promise<IMessageReceiptDoc[]> {
    return this.find({ messageId: new Types.ObjectId(messageId) });
  }

  public async getUnreadCount(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<number> {
    return this.count({
      conversationId: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
      status: { $ne: 'read' },
    });
  }

  public async markConversationAsRead(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<number> {
    const result = await this.model
      .updateMany(
        {
          conversationId: new Types.ObjectId(conversationId),
          userId: new Types.ObjectId(userId),
          status: { $ne: 'read' },
        },
        {
          status: 'read',
          readAt: new Date(),
        },
      )
      .exec();

    return result.modifiedCount;
  }
}

export const messageReceiptRepository = new MessageReceiptRepository();
