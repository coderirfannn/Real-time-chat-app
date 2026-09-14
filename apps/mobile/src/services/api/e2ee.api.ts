import { apiClient } from './client';
import type {
  DeviceKeyStatusResponse,
  DeviceKeyUploadPayload,
  PublicDeviceKeyBundle,
  ReplenishPreKeysPayload,
  RotateSignedPreKeyPayload,
  UserDeviceSummary,
} from '@chatlock/shared-types';

export class E2EEApi {
  /**
   * Registers or updates a device's public cryptographic identity bundle.
   */
  public async registerKeyBundle(payload: DeviceKeyUploadPayload): Promise<PublicDeviceKeyBundle> {
    return apiClient.post<PublicDeviceKeyBundle>('/e2ee/keys/register', payload);
  }

  /**
   * Retrieves a target user's public key bundle and atomically claims one OPK.
   */
  public async getPeerBundle(userId: string, deviceId?: string): Promise<PublicDeviceKeyBundle> {
    const params = deviceId ? { deviceId } : undefined;
    return apiClient.get<PublicDeviceKeyBundle>(`/e2ee/keys/${userId}`, { params });
  }

  /**
   * Replenishes the pool of one-time pre-keys for this device.
   */
  public async replenishPreKeys(
    payload: ReplenishPreKeysPayload,
  ): Promise<{ replenished: number; totalUnconsumed: number }> {
    return apiClient.post<{ replenished: number; totalUnconsumed: number }>(
      '/e2ee/prekeys/replenish',
      payload,
    );
  }

  /**
   * Rotates this device's signed pre-key.
   */
  public async rotateSignedPreKey(
    payload: RotateSignedPreKeyPayload,
  ): Promise<{ rotated: boolean }> {
    return apiClient.post<{ rotated: boolean }>('/e2ee/signed-prekey/rotate', payload);
  }

  /**
   * Retrieves device cryptographic registration status.
   */
  public async getMyDeviceStatus(deviceId: string): Promise<DeviceKeyStatusResponse> {
    return apiClient.get<DeviceKeyStatusResponse>('/e2ee/devices/me', {
      params: { deviceId },
    });
  }

  /**
   * Retrieves all active devices for a user.
   */
  public async getUserDevices(userId: string): Promise<UserDeviceSummary[]> {
    return apiClient.get<UserDeviceSummary[]>(`/e2ee/users/${userId}/devices`);
  }

  /**
   * Revokes a device key bundle.
   */
  public async revokeDevice(deviceId: string): Promise<{ revoked: boolean }> {
    return apiClient.patch<{ revoked: boolean }>(`/e2ee/devices/${deviceId}/revoke`);
  }
}

export const e2eeApi = new E2EEApi();
