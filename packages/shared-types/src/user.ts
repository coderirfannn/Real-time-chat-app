import type { ID, Timestamps } from './common.js';

export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export interface IUser extends Timestamps {
  id: ID;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  status: UserStatus;
  lastSeenAt?: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface UserProfile {
  id: ID;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  status: UserStatus;
  lastSeenAt?: string;
}
