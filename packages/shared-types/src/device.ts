import type { ID, Timestamps } from './common.js';

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface IDevice extends Timestamps {
  id: ID;
  userId: ID;
  deviceId: string;
  pushToken?: string;
  platform: DevicePlatform;
  appVersion: string;
  lastActiveAt: string;
  isActive: boolean;
}
