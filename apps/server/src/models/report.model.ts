import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IReportDoc extends Document {
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  targetType: 'USER' | 'MESSAGE' | 'CONVERSATION';
  targetId: string;
  reason: string;
  details?: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  resolutionNotes?: string;
  resolvedBy?: Types.ObjectId;
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
      default: 'USER',
      required: true,
    },
    targetId: {
      type: String,
      required: [true, 'Target ID is required'],
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
    },
    details: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED', 'DISMISSED'],
      default: 'PENDING',
      index: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
        if (ret['reporterId']) {
          ret['reporterId'] = ret['reporterId'].toString();
        }
        if (ret['reportedUserId']) {
          ret['reportedUserId'] = ret['reportedUserId'].toString();
        }
        if (ret['resolvedBy']) {
          ret['resolvedBy'] = ret['resolvedBy'].toString();
        }
        return ret;
      },
    },
  },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedUserId: 1, createdAt: -1 });

export const ReportModel: Model<IReportDoc> =
  (mongoose.models['Report'] as Model<IReportDoc>) ||
  mongoose.model<IReportDoc>('Report', reportSchema);
