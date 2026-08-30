import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { MessageType, MessageAttachment } from '@chatlock/shared-types';

export interface IMessageDoc extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  clientMessageId: string;
  type: MessageType;
  content: string;
  attachments?: MessageAttachment[];
  replyToMessageId?: Types.ObjectId;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<MessageAttachment>(
  {
    id: { type: String, required: true },
    url: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    thumbnailUrl: { type: String },
    duration: { type: Number },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessageDoc>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },
    clientMessageId: {
      type: String,
      required: [true, 'Client Message ID is required for idempotency'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'video', 'system'],
      default: 'text',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [5000, 'Message content cannot exceed 5000 characters'],
    },
    attachments: {
      type: [attachmentSchema],
      default: undefined,
    },
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: undefined,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
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
        ret['isEdited'] = Boolean(ret['editedAt']);
        ret['isDeleted'] = Boolean(ret['deletedAt']);
        return ret;
      },
    },
  },
);

// Indexes
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true });
messageSchema.index({ conversationId: 1, clientMessageId: 1 });

export const MessageModel: Model<IMessageDoc> =
  (mongoose.models['Message'] as Model<IMessageDoc>) ||
  mongoose.model<IMessageDoc>('Message', messageSchema);
