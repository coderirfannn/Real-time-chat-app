import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { DevicePlatform } from '@chatlock/shared-types';

export interface IDeviceDoc extends Document {
  userId: Types.ObjectId;
  deviceId: string;
  pushToken?: string;
  platform: DevicePlatform;
  appVersion: string;
  lastActiveAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IDeviceDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      trim: true,
    },
    pushToken: {
      type: String,
      trim: true,
      default: undefined,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: [true, 'Platform is required'],
    },
    appVersion: {
      type: String,
      required: [true, 'App version is required'],
      trim: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ pushToken: 1 }, { sparse: true });
deviceSchema.index({ userId: 1, isActive: 1 });

export const DeviceModel: Model<IDeviceDoc> =
  (mongoose.models['Device'] as Model<IDeviceDoc>) ||
  mongoose.model<IDeviceDoc>('Device', deviceSchema);
