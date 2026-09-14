import type { ID } from './common.js';
import type { UserProfile, UserRole } from './user.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface JwtPayload {
  sub: ID;
  email: string;
  username: string;
  role?: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}
