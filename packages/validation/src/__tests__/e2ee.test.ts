import { describe, it, expect } from 'vitest';
import {
  registerKeyBundleSchema,
  replenishPreKeysSchema,
  rotateSignedPreKeySchema,
  getBase64ByteLength,
  base64PublicKeySchema,
  base64SignatureSchema,
} from '../e2ee.js';

describe('E2EE Validation Schemas', () => {
  // 32-byte key in Base64 (44 chars)
  const valid32ByteKey = Buffer.alloc(32, 7).toString('base64');
  // 64-byte signature in Base64 (88 chars)
  const valid64ByteSig = Buffer.alloc(64, 9).toString('base64');

  describe('getBase64ByteLength & Base64 Schemas', () => {
    it('accurately calculates raw byte length of Base64 strings', () => {
      expect(getBase64ByteLength(valid32ByteKey)).toBe(32);
      expect(getBase64ByteLength(valid64ByteSig)).toBe(64);
      expect(getBase64ByteLength('invalid-base64-not-multiple-of-4')).toBe(-1);
      expect(getBase64ByteLength('')).toBe(-1);
    });

    it('validates 32-byte public keys and rejects incorrect lengths', () => {
      expect(base64PublicKeySchema.safeParse(valid32ByteKey).success).toBe(true);
      // 16-byte key
      const shortKey = Buffer.alloc(16).toString('base64');
      expect(base64PublicKeySchema.safeParse(shortKey).success).toBe(false);
      // 33-byte key
      const longKey = Buffer.alloc(33).toString('base64');
      expect(base64PublicKeySchema.safeParse(longKey).success).toBe(false);
    });

    it('validates 64-byte signatures and rejects incorrect lengths', () => {
      expect(base64SignatureSchema.safeParse(valid64ByteSig).success).toBe(true);
      expect(base64SignatureSchema.safeParse(valid32ByteKey).success).toBe(false);
    });
  });

  describe('registerKeyBundleSchema', () => {
    it('accepts valid device key registration payload', () => {
      const validPayload = {
        deviceId: 'device_test_123',
        identityKey: valid32ByteKey,
        signedPreKey: {
          keyId: 1,
          publicKey: valid32ByteKey,
          signature: valid64ByteSig,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
        oneTimePreKeys: [
          { keyId: 1, publicKey: valid32ByteKey },
          { keyId: 2, publicKey: valid32ByteKey },
        ],
        keyVersion: 1,
      };

      const result = registerKeyBundleSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects payload with empty oneTimePreKeys array', () => {
      const payload = {
        deviceId: 'device_test_123',
        identityKey: valid32ByteKey,
        signedPreKey: {
          keyId: 1,
          publicKey: valid32ByteKey,
          signature: valid64ByteSig,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
        oneTimePreKeys: [],
      };

      const result = registerKeyBundleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects payload with invalid deviceId or keyId', () => {
      const payload = {
        deviceId: '',
        identityKey: valid32ByteKey,
        signedPreKey: {
          keyId: -1,
          publicKey: valid32ByteKey,
          signature: valid64ByteSig,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
        oneTimePreKeys: [{ keyId: 1, publicKey: valid32ByteKey }],
      };

      const result = registerKeyBundleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('replenishPreKeysSchema & rotateSignedPreKeySchema', () => {
    it('validates pre-key replenishment payload', () => {
      const result = replenishPreKeysSchema.safeParse({
        deviceId: 'device_123',
        oneTimePreKeys: [{ keyId: 10, publicKey: valid32ByteKey }],
      });
      expect(result.success).toBe(true);
    });

    it('validates signed pre-key rotation payload', () => {
      const result = rotateSignedPreKeySchema.safeParse({
        deviceId: 'device_123',
        signedPreKey: {
          keyId: 2,
          publicKey: valid32ByteKey,
          signature: valid64ByteSig,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
