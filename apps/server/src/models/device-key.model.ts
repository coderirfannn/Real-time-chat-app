import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { DeviceE2EEStatus } from '@chatlock/shared-types';

export interface ISignedPreKeySubdoc {
  keyId: number;
  publicKey: string; // Base64 32-byte X25519 public key
  signature: string; // Base64 64-byte Ed25519 signature
  createdAt: Date;
  expiresAt: Date;
  rotatedAt?: Date;
}

export interface IOneTimePreKeySubdoc {
  keyId: number;
  publicKey: string; // Base64 32-byte X25519 public key
  consumed: boolean;
  consumedAt?: Date;
  consumedByUserId?: Types.ObjectId;
}

export interface IDeviceKeyBundleDoc extends Document {
  userId: Types.ObjectId;
  deviceId: string;
  identityKey: string; // Base64 32-byte Ed25519 public key
  signedPreKey: ISignedPreKeySubdoc;
  signedPreKeyHistory: ISignedPreKeySubdoc[];
  oneTimePreKeys: IOneTimePreKeySubdoc[];
  keyVersion: number;
  status: DeviceE2EEStatus;
  revokedAt?: Date;
  lastRotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const signedPreKeySchema = new Schema<ISignedPreKeySubdoc>(
  {
    keyId: { type: Number, required: true },
    publicKey: { type: String, required: true, trim: true },
    signature: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    rotatedAt: { type: Date },
  },
  { _id: false },
);

const oneTimePreKeySchema = new Schema<IOneTimePreKeySubdoc>(
  {
    keyId: { type: Number, required: true },
    publicKey: { type: String, required: true, trim: true },
    consumed: { type: Boolean, default: false },
    consumedAt: { type: Date },
    consumedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const deviceKeyBundleSchema = new Schema<IDeviceKeyBundleDoc>(
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
    identityKey: {
      type: String,
      required: [true, 'Identity public key is required'],
      trim: true,
    },
    signedPreKey: {
      type: signedPreKeySchema,
      required: [true, 'Signed pre-key is required'],
    },
    signedPreKeyHistory: {
      type: [signedPreKeySchema],
      default: [],
    },
    oneTimePreKeys: {
      type: [oneTimePreKeySchema],
      default: [],
    },
    keyVersion: {
      type: Number,
      default: 1,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },
    revokedAt: {
      type: Date,
    },
    lastRotatedAt: {
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
        return ret;
      },
    },
  },
);

// Indexes
deviceKeyBundleSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
deviceKeyBundleSchema.index({ userId: 1, status: 1 });
deviceKeyBundleSchema.index({ 'oneTimePreKeys.consumed': 1 });

export const DeviceKeyBundleModel: Model<IDeviceKeyBundleDoc> =
  (mongoose.models['DeviceKeyBundle'] as Model<IDeviceKeyBundleDoc>) ||
  mongoose.model<IDeviceKeyBundleDoc>('DeviceKeyBundle', deviceKeyBundleSchema);
