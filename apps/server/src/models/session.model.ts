import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ISessionDoc extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  deviceId: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISessionDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      trim: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      trim: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: { expires: 0 }, // TTL index for automatic MongoDB expiration
    },
    revokedAt: {
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

sessionSchema.index({ userId: 1, deviceId: 1 });

export const SessionModel: Model<ISessionDoc> =
  (mongoose.models['Session'] as Model<ISessionDoc>) ||
  mongoose.model<ISessionDoc>('Session', sessionSchema);
