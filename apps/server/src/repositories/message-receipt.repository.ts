import { Types } from 'mongoose';
import { BaseRepository } from './base.repository.js';
import { MessageReceiptModel, type IMessageReceiptDoc } from '../models/message-receipt.model.js';
import type { ReceiptStatus } from '@chatlock/shared-types';

export class MessageReceiptRepository extends BaseRepository<IMessageReceiptDoc> {
  constructor() {
    super(MessageReceiptModel);
  }

  /**
   * Upserts a message receipt ensuring monotonic state progression:
   * 'sent' -> 'delivered' -> 'read'.
   * Never downgrades a 'read' receipt back to 'delivered'.
   */
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

    // Prevent downgrade from 'read' to 'delivered'
    if (data.status === 'delivered') {
      const existing = await this.model.findOne({ messageId: msgObj, userId: userObj }).exec();
      if (existing) {
        if (existing.status === 'read') {
          if (!existing.deliveredAt) {
            existing.deliveredAt = now;
            await existing.save();
          }
          return existing;
        }
      }
    }

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

  /**
   * Batch upserts receipts for multiple messages in a conversation.
   */
  public async batchUpsertReceipts(data: {
    messageIds: Array<string | Types.ObjectId>;
    conversationId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    status: ReceiptStatus;
  }): Promise<IMessageReceiptDoc[]> {
    const results: IMessageReceiptDoc[] = [];
    for (const msgId of data.messageIds) {
      const doc = await this.upsertReceipt({
        messageId: msgId,
        conversationId: data.conversationId,
        userId: data.userId,
        status: data.status,
      });
      if (doc) results.push(doc);
    }
    return results;
  }

  /**
   * Retrieves all receipts for a given message.
   */
  public async findReceiptsForMessage(
    messageId: string | Types.ObjectId,
  ): Promise<IMessageReceiptDoc[]> {
    return this.find({ messageId: new Types.ObjectId(messageId) });
  }

  /**
   * Retrieves receipts for multiple message IDs.
   */
  public async getReceiptsForMessages(
    messageIds: Array<string | Types.ObjectId>,
  ): Promise<IMessageReceiptDoc[]> {
    if (messageIds.length === 0) return [];
    const objectIds = messageIds.map((id) => new Types.ObjectId(id));
    return this.model.find({ messageId: { $in: objectIds } }).exec();
  }

  /**
   * Counts unread messages for a user in a conversation.
   */
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

  /**
   * Marks all messages in a conversation as read for a given user.
   */
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
