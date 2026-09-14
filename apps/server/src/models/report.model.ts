import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type {
  ReportStatus,
  ReportTargetType,
  ReportReason,
  ModerationAction,
} from '@chatlock/shared-types';

export interface IReportDoc extends Document {
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: string;
  conversationId?: Types.ObjectId;
  messageId?: Types.ObjectId;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  resolutionAction?: ModerationAction;
  resolutionNotes?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReportDoc>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter ID is required'],
      index: true,
    },
    reportedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reported user ID is required'],
      index: true,
    },
    targetType: {
      type: String,
      enum: ['USER', 'MESSAGE', 'CONVERSATION'],
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      required: [true, 'Target ID is required'],
      trim: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      index: true,
    },
    reason: {
      type: String,
      enum: [
        'SPAM',
        'HARASSMENT',
        'HATE_SPEECH',
        'INAPPROPRIATE_CONTENT',
        'IMPERSONATION',
        'OTHER',
      ],
      required: [true, 'Reason is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'OPEN',
        'UNDER_REVIEW',
        'DISMISSED',
        'WARNED',
        'SUSPENDED',
        'BANNED',
        'PENDING',
        'RESOLVED',
      ],
      default: 'OPEN',
      index: true,
    },
    resolutionAction: {
      type: String,
      enum: ['DISMISS', 'WARN', 'SUSPEND', 'BAN'],
    },
    resolutionNotes: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
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
        if (
          ret['reporterId'] &&
          typeof ret['reporterId'] === 'object' &&
          '_id' in (ret['reporterId'] as Record<string, unknown>)
        ) {
          const rep = ret['reporterId'] as Record<string, unknown>;
          ret['reporter'] = {
            id: rep['_id']?.toString() || rep['id'],
            username: rep['username'],
            name: rep['name'],
            avatarUrl: rep['avatarUrl'],
          };
          ret['reporterId'] = rep['_id']?.toString() || rep['id'];
        } else if (ret['reporterId']) {
          ret['reporterId'] = ret['reporterId'].toString();
        }

        if (
          ret['reportedUserId'] &&
          typeof ret['reportedUserId'] === 'object' &&
          '_id' in (ret['reportedUserId'] as Record<string, unknown>)
        ) {
          const repUser = ret['reportedUserId'] as Record<string, unknown>;
          ret['reportedUser'] = {
            id: repUser['_id']?.toString() || repUser['id'],
            username: repUser['username'],
            name: repUser['name'],
            avatarUrl: repUser['avatarUrl'],
            accountStatus: repUser['accountStatus'],
          };
          ret['reportedUserId'] = repUser['_id']?.toString() || repUser['id'];
        } else if (ret['reportedUserId']) {
          ret['reportedUserId'] = ret['reportedUserId'].toString();
        }

        if (
          ret['resolvedBy'] &&
          typeof ret['resolvedBy'] === 'object' &&
          '_id' in (ret['resolvedBy'] as Record<string, unknown>)
        ) {
          const admin = ret['resolvedBy'] as Record<string, unknown>;
          ret['resolvedByAdmin'] = {
            id: admin['_id']?.toString() || admin['id'],
            username: admin['username'],
            name: admin['name'],
          };
          ret['resolvedBy'] = admin['_id']?.toString() || admin['id'];
        } else if (ret['resolvedBy']) {
          ret['resolvedBy'] = ret['resolvedBy'].toString();
        }

        if (ret['conversationId']) {
          ret['conversationId'] = ret['conversationId'].toString();
        }
        if (ret['messageId']) {
          ret['messageId'] = ret['messageId'].toString();
        }
        return ret;
      },
    },
  },
);

reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedUserId: 1, createdAt: -1 });

export const ReportModel: Model<IReportDoc> =
  (mongoose.models['Report'] as Model<IReportDoc>) ||
  mongoose.model<IReportDoc>('Report', reportSchema);
