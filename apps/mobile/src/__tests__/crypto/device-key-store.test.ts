import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceKeyStore } from '../../services/crypto/device-key-store';
import type {
  KeyPair,
  OneTimePreKeyPair,
  SignedPreKeyPair,
} from '../../services/crypto/crypto.types';

describe('DeviceKeyStore Client Isolation & Storage', () => {
  let store: DeviceKeyStore;

  const mockIdKey: KeyPair = {
    publicKey: 'mock_id_public_key_32_bytes_base64_encoded==',
    privateKey: 'mock_id_private_key_32_bytes_base64_enc==',
  };

  const mockSpk: SignedPreKeyPair = {
    keyId: 1,
    publicKey: 'mock_spk_public_key_32_bytes_base64_enc==',
    privateKey: 'mock_spk_private_key_32_bytes_base64_enc=',
    signature: 'mock_sig_64_bytes_base64_encoded_signature_for_testing==',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  };

  const mockOpks: OneTimePreKeyPair[] = [
    { keyId: 1, publicKey: 'opk_pub_1', privateKey: 'opk_priv_1' },
    { keyId: 2, publicKey: 'opk_pub_2', privateKey: 'opk_priv_2' },
    { keyId: 3, publicKey: 'opk_pub_3', privateKey: 'opk_priv_3' },
  ];

  beforeEach(async () => {
    store = new DeviceKeyStore();
    await store.clearAllKeys();
  });

  it('persists and retrieves identity key pair', async () => {
    expect(await store.getIdentityKeyPair()).toBeNull();
    await store.saveIdentityKeyPair(mockIdKey);

    const retrieved = await store.getIdentityKeyPair();
    expect(retrieved).toEqual(mockIdKey);
  });

  it('persists and retrieves signed pre-key', async () => {
    expect(await store.getSignedPreKey()).toBeNull();
    await store.saveSignedPreKey(mockSpk);

    const retrieved = await store.getSignedPreKey();
    expect(retrieved).toEqual(mockSpk);
  });

  it('persists, queries, and marks consumed one-time pre-keys', async () => {
    await store.saveOneTimePreKeys(mockOpks);

    const allKeys = await store.getOneTimePreKeys();
    expect(allKeys.length).toBe(3);

    const key2 = await store.getOneTimePreKey(2);
    expect(key2).toEqual(mockOpks[1]);

    // Mark key 2 used (consumed)
    await store.markOneTimePreKeyUsed(2);

    expect(await store.getOneTimePreKey(2)).toBeNull();
    const remaining = await store.getOneTimePreKeys();
    expect(remaining.length).toBe(2);
    expect(remaining.map((k) => k.keyId)).toEqual([1, 3]);
  });

  it('correctly tracks hasKeys status', async () => {
    expect(await store.hasKeys()).toBe(false);

    await store.saveIdentityKeyPair(mockIdKey);
    expect(await store.hasKeys()).toBe(false); // still needs signed pre-key

    await store.saveSignedPreKey(mockSpk);
    expect(await store.hasKeys()).toBe(true);
  });

  it('clears all cryptographic key material cleanly', async () => {
    await store.saveIdentityKeyPair(mockIdKey);
    await store.saveSignedPreKey(mockSpk);
    await store.saveOneTimePreKeys(mockOpks);
    await store.setKeyVersion(2);

    expect(await store.hasKeys()).toBe(true);

    await store.clearAllKeys();

    expect(await store.hasKeys()).toBe(false);
    expect(await store.getIdentityKeyPair()).toBeNull();
    expect(await store.getSignedPreKey()).toBeNull();
    expect((await store.getOneTimePreKeys()).length).toBe(0);
  });
});
