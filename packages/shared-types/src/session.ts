import type { ID, Timestamps } from './common.js';

export interface ISession extends Timestamps {
  id: ID;
  userId: ID;
  tokenHash: string;
  deviceId: string;
  expiresAt: string;
  revokedAt?: string | null;
}
