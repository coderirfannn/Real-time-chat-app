import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IAuditLogDoc extends Document {
  adminUserId: Types.ObjectId;
  adminUsername: string;
  action: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLogDoc>(
  {
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin user ID is required'],
      index: true,
    },
    adminUsername: {
      type: String,
      required: [true, 'Admin username is required'],
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      index: true,
    },
    targetId: {
      type: String,
      trim: true,
      index: true,
    },
    targetType: {
      type: String,
      trim: true,
      default: 'USER',
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    requestId: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
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
        if (ret['adminUserId']) {
          ret['adminUserId'] = ret['adminUserId'].toString();
        }
        return ret;
      },
    },
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminUserId: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLogModel: Model<IAuditLogDoc> =
  (mongoose.models['AuditLog'] as Model<IAuditLogDoc>) ||
  mongoose.model<IAuditLogDoc>('AuditLog', auditLogSchema);
