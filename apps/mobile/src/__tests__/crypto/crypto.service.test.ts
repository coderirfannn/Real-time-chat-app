import { describe, it, expect } from 'vitest';
import { cryptoService, bytesToBase64, base64ToBytes } from '../../services/crypto/crypto.service';

describe('CryptoService Client Primitives (@noble/curves)', () => {
  describe('Base64 & Byte Utilities', () => {
    it('accurately encodes and decodes byte buffers roundtrip', () => {
      const original = new Uint8Array([1, 2, 3, 254, 255, 0, 42, 128]);
      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);

      expect(decoded).toEqual(original);
    });
  });

  describe('Identity Key Pair Generation', () => {
    it('generates a valid 32-byte Ed25519 identity key pair', () => {
      const keyPair = cryptoService.generateIdentityKeyPair();

      expect(keyPair).toBeDefined();
      expect(typeof keyPair.privateKey).toBe('string');
      expect(typeof keyPair.publicKey).toBe('string');

      const pubBytes = base64ToBytes(keyPair.publicKey);
      const privBytes = base64ToBytes(keyPair.privateKey);

      expect(pubBytes.length).toBe(32);
      expect(privBytes.length).toBe(32);
    });
  });

  describe('Signed Pre-Key Generation & Signature Verification', () => {
    it('generates an X25519 pre-key signed by the Ed25519 identity private key', () => {
      const idKey = cryptoService.generateIdentityKeyPair();
      const signedPreKey = cryptoService.generateSignedPreKey(idKey.privateKey, 1, 30);

      expect(signedPreKey.keyId).toBe(1);
      expect(base64ToBytes(signedPreKey.publicKey).length).toBe(32);
      expect(base64ToBytes(signedPreKey.privateKey).length).toBe(32);
      expect(base64ToBytes(signedPreKey.signature).length).toBe(64);

      // Verify signature is valid for identity public key
      const isValid = cryptoService.verifySignedPreKeySignature(
        idKey.publicKey,
        signedPreKey.publicKey,
        signedPreKey.signature,
      );
      expect(isValid).toBe(true);
    });

    it('rejects signature if signed pre-key was tampered with', () => {
      const idKey = cryptoService.generateIdentityKeyPair();
      const spk1 = cryptoService.generateSignedPreKey(idKey.privateKey, 1, 30);
      const spk2 = cryptoService.generateSignedPreKey(idKey.privateKey, 2, 30);

      // Verify spk1 signature against spk2 public key (tamper attempt)
      const isValid = cryptoService.verifySignedPreKeySignature(
        idKey.publicKey,
        spk2.publicKey,
        spk1.signature,
      );
      expect(isValid).toBe(false);
    });
  });

  describe('One-Time Pre-Key Batch Generation', () => {
    it('generates the specified count of unique X25519 one-time pre-keys', () => {
      const count = 10;
      const opks = cryptoService.generateOneTimePreKeys(1, count);

      expect(opks.length).toBe(count);
      expect(opks[0]?.keyId).toBe(1);
      expect(opks[count - 1]?.keyId).toBe(count);

      // Ensure all public keys in the batch are distinct
      const uniquePubs = new Set(opks.map((k) => k.publicKey));
      expect(uniquePubs.size).toBe(count);

      for (const opk of opks) {
        expect(base64ToBytes(opk.publicKey).length).toBe(32);
        expect(base64ToBytes(opk.privateKey).length).toBe(32);
      }
    });
  });
});
