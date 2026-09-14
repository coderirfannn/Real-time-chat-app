import type { ID, Timestamps } from './common.js';

export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export type UserRole = 'USER' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface IUser extends Timestamps {
  id: ID;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  status: UserStatus;
  role: UserRole;
  accountStatus: AccountStatus;
  lastSeenAt?: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface UserProfile {
  id: ID;
  email?: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  status: UserStatus;
  role?: UserRole;
  accountStatus?: AccountStatus;
  lastSeenAt?: string;
}
