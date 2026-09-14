import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyBundleService } from '../../services/crypto/key-bundle.service';
import { CryptoService } from '../../services/crypto/crypto.service';
import { DeviceKeyStore } from '../../services/crypto/device-key-store';
import { E2EEApi } from '../../services/api/e2ee.api';
import { NotificationService } from '../../services/notifications/notification.service';
import type {
  DeviceKeyStatusResponse,
  DeviceKeyUploadPayload,
  PublicDeviceKeyBundle,
} from '@chatlock/shared-types';

describe('KeyBundleService Coordinator', () => {
  let crypto: CryptoService;
  let keyStore: DeviceKeyStore;
  let api: E2EEApi;
  let service: KeyBundleService;

  const mockDeviceId = 'dev_mobile_test_device_uuid_123';

  beforeEach(async () => {
    vi.restoreAllMocks();

    crypto = new CryptoService();
    keyStore = new DeviceKeyStore();
    await keyStore.clearAllKeys();

    api = new E2EEApi();

    vi.spyOn(NotificationService.getInstance(), 'getDeviceId').mockResolvedValue(mockDeviceId);

    service = new KeyBundleService(crypto, keyStore, api);
  });

  it('generates keys, stores them locally, and registers public bundle when no local keys exist', async () => {
    let capturedPayload: DeviceKeyUploadPayload | null = null;

    vi.spyOn(api, 'registerKeyBundle').mockImplementation(async (payload) => {
      capturedPayload = payload;
      return {
        userId: 'user_alice',
        deviceId: payload.deviceId,
        identityKey: payload.identityKey,
        signedPreKey: payload.signedPreKey,
        oneTimePreKey: null,
        keyVersion: 1,
        deviceStatus: 'ACTIVE',
      } as PublicDeviceKeyBundle;
    });

    const result = await service.initializeDeviceKeys();

    expect(result.initialized).toBe(true);
    expect(result.registered).toBe(true);
    expect(result.deviceId).toBe(mockDeviceId);

    // Verify local storage was populated with private and public keys
    const storedIdKey = await keyStore.getIdentityKeyPair();
    const storedSpk = await keyStore.getSignedPreKey();
    const storedOpks = await keyStore.getOneTimePreKeys();

    expect(storedIdKey).not.toBeNull();
    expect(storedSpk).not.toBeNull();
    expect(storedOpks.length).toBe(50);

    // Verify upload payload contains ONLY public material
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload!.deviceId).toBe(mockDeviceId);
    expect(capturedPayload!.identityKey).toBe(storedIdKey!.publicKey);
    expect(capturedPayload!.signedPreKey.publicKey).toBe(storedSpk!.publicKey);
    expect(capturedPayload!.oneTimePreKeys.length).toBe(50);

    // CRITICAL: Ensure private keys NEVER appeared in upload payload
    const serializedPayload = JSON.stringify(capturedPayload);
    expect(serializedPayload).not.toContain('privateKey');
    expect(serializedPayload).not.toContain(storedIdKey!.privateKey);
    expect(serializedPayload).not.toContain(storedSpk!.privateKey);
  });

  it('skips key generation if keys are already present locally and active on server', async () => {
    // Pre-populate keys
    await service.initializeDeviceKeys();

    const registerSpy = vi.spyOn(api, 'registerKeyBundle');
    vi.spyOn(api, 'getMyDeviceStatus').mockResolvedValue({
      deviceId: mockDeviceId,
      hasKeys: true,
      keyVersion: 1,
      identityKey: 'some_key',
      signedPreKeyExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      unconsumedPreKeyCount: 45,
      deviceStatus: 'ACTIVE',
    } as DeviceKeyStatusResponse);

    const result = await service.initializeDeviceKeys();

    expect(result.initialized).toBe(true);
    expect(result.registered).toBe(true);
    // registerKeyBundle should NOT be called again
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('triggers replenishment when server unconsumed pre-key count drops below threshold', async () => {
    // Initial setup
    await service.initializeDeviceKeys();

    vi.spyOn(api, 'getMyDeviceStatus').mockResolvedValue({
      deviceId: mockDeviceId,
      hasKeys: true,
      keyVersion: 1,
      identityKey: 'key',
      signedPreKeyExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      unconsumedPreKeyCount: 5, // Below threshold of 10
      deviceStatus: 'ACTIVE',
    } as DeviceKeyStatusResponse);

    const replenishSpy = vi.spyOn(api, 'replenishPreKeys').mockResolvedValue({
      replenished: 25,
      totalUnconsumed: 30,
    });

    const result = await service.checkAndReplenishPreKeys(10, 25);

    expect(result.replenished).toBe(true);
    expect(result.count).toBe(30);
    expect(replenishSpy).toHaveBeenCalled();
  });

  it('rotates signed pre-key and registers with server', async () => {
    await service.initializeDeviceKeys();

    const rotateSpy = vi.spyOn(api, 'rotateSignedPreKey').mockResolvedValue({ rotated: true });

    const success = await service.rotateSignedPreKey(30);

    expect(success).toBe(true);
    expect(rotateSpy).toHaveBeenCalled();

    const nextSpk = await keyStore.getSignedPreKey();
    expect(nextSpk?.keyId).toBe(2);
  });
});
