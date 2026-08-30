import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { ConversationType } from '@chatlock/shared-types';

export interface IConversationDoc extends Document {
  type: ConversationType;
  title?: string;
  avatarUrl?: string;
  creatorId?: Types.ObjectId;
  participants: Types.ObjectId[];
  admins?: Types.ObjectId[];
  lastMessageId?: Types.ObjectId;
  lastMessageAt: Date;
  directKey?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationModel extends Model<IConversationDoc> {
  generateDirectKey(userAId: string | Types.ObjectId, userBId: string | Types.ObjectId): string;
}

const conversationSchema = new Schema<IConversationDoc, IConversationModel>(
  {
    type: {
      type: String,
      enum: ['direct', 'group', 'channel'],
      default: 'direct',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
      default: undefined,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: undefined,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: undefined,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    directKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
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
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Helper to compute deterministic direct key for deduplication
conversationSchema.statics.generateDirectKey = function (
  userAId: string | Types.ObjectId,
  userBId: string | Types.ObjectId,
): string {
  const strA = userAId.toString();
  const strB = userBId.toString();
  return strA < strB ? `${strA}:${strB}` : `${strB}:${strA}`;
};

export const ConversationModel: IConversationModel =
  (mongoose.models['Conversation'] as IConversationModel) ||
  mongoose.model<IConversationDoc, IConversationModel>('Conversation', conversationSchema);
