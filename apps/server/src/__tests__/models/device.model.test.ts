import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { DeviceModel } from '../../models/device.model.js';

describe('Device Model Schema & Validation', () => {
  const userId = new Types.ObjectId();

  it('validates a correct device document', () => {
    const device = new DeviceModel({
      userId,
      deviceId: 'device-uuid-9876',
      platform: 'ios',
      appVersion: '1.0.0',
      pushToken: 'fcm_token_sample_string_123',
    });

    const error = device.validateSync();
    expect(error).toBeUndefined();
    expect(device.platform).toBe('ios');
    expect(device.isActive).toBe(true);
  });

  it('fails validation on invalid platform', () => {
    const device = new DeviceModel({
      userId,
      deviceId: 'device-uuid-9876',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      platform: 'windows_phone' as any,
      appVersion: '1.0.0',
    });

    const error = device.validateSync();
    expect(error?.errors['platform']).toBeDefined();
  });
});
