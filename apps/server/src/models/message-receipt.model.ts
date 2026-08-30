import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { ReceiptStatus } from '@chatlock/shared-types';

export interface IMessageReceiptDoc extends Document {
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ReceiptStatus;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageReceiptSchema = new Schema<IMessageReceiptDoc>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: [true, 'Message ID is required'],
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      required: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret['__v'];
        if (ret['_id']) {
          ret['id'] = ret['_id'].toString();
          delete ret['_id'];
        }
        return ret;
      },
    },
  },
);

// Indexes
messageReceiptSchema.index({ messageId: 1, userId: 1 }, { unique: true });
messageReceiptSchema.index({ conversationId: 1, userId: 1, status: 1 });

export const MessageReceiptModel: Model<IMessageReceiptDoc> =
  (mongoose.models['MessageReceipt'] as Model<IMessageReceiptDoc>) ||
  mongoose.model<IMessageReceiptDoc>('MessageReceipt', messageReceiptSchema);
