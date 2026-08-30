import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { UserStatus } from '@chatlock/shared-types';

export interface IUserDoc extends Document {
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  avatarUrl?: string;
  bio?: string;
  status: UserStatus;
  lastSeenAt: Date;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDoc>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain alphanumeric characters and underscores',
      ],
      index: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: undefined,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away', 'busy'],
      default: 'offline',
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret['passwordHash'];
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

export const UserModel: Model<IUserDoc> =
  (mongoose.models['User'] as Model<IUserDoc>) || mongoose.model<IUserDoc>('User', userSchema);
