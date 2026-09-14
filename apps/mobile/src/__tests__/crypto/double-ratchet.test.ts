import { describe, it, expect, beforeEach } from 'vitest';
import {
  DoubleRatchetService,
  E2EEDecryptionError,
  MAX_SKIP,
  MAX_SKIPPED_KEYS,
} from '../../services/crypto/double-ratchet.service';
import { CryptoService, bytesToBase64, base64ToBytes } from '../../services/crypto/crypto.service';
import { x25519 } from '@noble/curves/ed25519.js';
import type { RatchetState, DoubleRatchetHeader } from '@chatlock/shared-types';

describe('DoubleRatchetService — Unit & Cryptographic Security Tests', () => {
  let doubleRatchet: DoubleRatchetService;
  let crypto: CryptoService;

  beforeEach(() => {
    doubleRatchet = new DoubleRatchetService();
    crypto = new CryptoService();
  });

  function setupAliceAndBob(): {
    aliceState: RatchetState;
    bobState: RatchetState;
  } {
    // 1. Generate identity and pre-keys
    const aliceId = crypto.generateIdentityKeyPair();
    const bobId = crypto.generateIdentityKeyPair();
    const bobSpk = crypto.generateSignedPreKey(bobId.privateKey, 1);
    const bobOpk = crypto.generateOneTimePreKeys(1, 1)[0]!;

    // 2. Perform X3DH key agreement
    const x3dhInit = crypto.x3dhInitiator({
      initiatorIdentityPrivateKey: aliceId.privateKey,
      recipientIdentityPublicKey: bobId.publicKey,
      recipientSignedPreKeyPublicKey: bobSpk.publicKey,
      recipientOneTimePreKeyPublicKey: bobOpk.publicKey,
    });

    const x3dhRecv = crypto.x3dhReceiver({
      receiverIdentityPrivateKey: bobId.privateKey,
      initiatorIdentityPublicKey: aliceId.publicKey,
      initiatorEphemeralPublicKey: x3dhInit.ephemeralPublicKey,
      receiverSignedPreKeyPrivateKey: bobSpk.privateKey,
      receiverOneTimePreKeyPrivateKey: bobOpk.privateKey,
    });

    expect(x3dhInit.sharedSecret).toBe(x3dhRecv.sharedSecret);

    // 3. Initialize Double Ratchet states
    const aliceState = doubleRatchet.initRatchetAsInitiator(
      x3dhInit.sharedSecret,
      bobSpk.publicKey,
    );
    const bobState = doubleRatchet.initRatchetAsReceiver(
      x3dhRecv.sharedSecret,
      bobSpk.privateKey,
      bobSpk.publicKey,
    );

    return { aliceState, bobState };
  }

  describe('KDF & Cryptographic Primitives', () => {
    it('1. KDF_RK produces distinct 32-byte root and chain keys', () => {
      const rk = new Uint8Array(32).fill(1);
      const dhOut = new Uint8Array(32).fill(2);
      const { rootKey, chainKey } = doubleRatchet.kdfRK(rk, dhOut);

      expect(rootKey.length).toBe(32);
      expect(chainKey.length).toBe(32);
      expect(bytesToBase64(rootKey)).not.toBe(bytesToBase64(chainKey));
      expect(bytesToBase64(rootKey)).not.toBe(bytesToBase64(rk));
    });

    it('2. KDF_CK advances chain key and provides forward secrecy', () => {
      const ck = new Uint8Array(32).fill(7);
      const step1 = doubleRatchet.kdfCK(ck);
      const step2 = doubleRatchet.kdfCK(step1.chainKey);

      expect(step1.messageKey.length).toBe(32);
      expect(step1.chainKey.length).toBe(32);
      // Each message key is unique
      expect(bytesToBase64(step1.messageKey)).not.toBe(bytesToBase64(step2.messageKey));
      // Chain key changes on each step
      expect(bytesToBase64(step1.chainKey)).not.toBe(bytesToBase64(step2.chainKey));
    });

    it('3. Encrypts and decrypts payload using ChaCha20-Poly1305 with authenticated header', () => {
      const mk = new Uint8Array(32).fill(9);
      const header: DoubleRatchetHeader = {
        ratchetKey: bytesToBase64(new Uint8Array(32).fill(3)),
        pn: 0,
        n: 0,
      };
      const plaintext = 'Secret message from Alice to Bob';

      const ciphertext = doubleRatchet.encryptPayload(mk, header, plaintext);
      expect(ciphertext).toBeDefined();
      expect(ciphertext).not.toContain(plaintext);

      const decrypted = doubleRatchet.decryptPayload(mk, header, ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('4. Rejects tampered ciphertext with E2EEDecryptionError (invalid tag)', () => {
      const mk = new Uint8Array(32).fill(9);
      const header: DoubleRatchetHeader = {
        ratchetKey: bytesToBase64(new Uint8Array(32).fill(3)),
        pn: 0,
        n: 0,
      };
      const ciphertext = doubleRatchet.encryptPayload(mk, header, 'Original message');

      // Tamper ciphertext bits
      const bytes = base64ToBytes(ciphertext);
      const firstByte = bytes[0];
      if (firstByte !== undefined) {
        bytes[0] = firstByte ^ 0xff;
      }
      const tamperedCiphertext = bytesToBase64(bytes);

      expect(() => {
        doubleRatchet.decryptPayload(mk, header, tamperedCiphertext);
      }).toThrow(E2EEDecryptionError);
    });

    it('5. Rejects tampered header AAD with E2EEDecryptionError', () => {
      const mk = new Uint8Array(32).fill(9);
      const header: DoubleRatchetHeader = {
        ratchetKey: bytesToBase64(new Uint8Array(32).fill(3)),
        pn: 0,
        n: 0,
      };
      const ciphertext = doubleRatchet.encryptPayload(mk, header, 'Authentic message');

      // Tampered counter in header
      const tamperedHeader: DoubleRatchetHeader = {
        ...header,
        n: 1, // Changed from 0 to 1
      };

      expect(() => {
        doubleRatchet.decryptPayload(mk, tamperedHeader, ciphertext);
      }).toThrow(E2EEDecryptionError);
    });
  });

  describe('Ratchet State Transitions & Exchanges', () => {
    it('6. Direct Ping-Pong Exchange (Alice -> Bob -> Alice -> Bob)', () => {
      const { aliceState, bobState } = setupAliceAndBob();

      // Alice -> Bob (Message 1)
      const msg1 = doubleRatchet.ratchetEncrypt(aliceState, 'Hello Bob!');
      expect(msg1.header.n).toBe(0);
      expect(aliceState.ns).toBe(1);

      const dec1 = doubleRatchet.ratchetDecrypt(bobState, msg1.header, msg1.ciphertext);
      expect(dec1.plaintext).toBe('Hello Bob!');
      expect(bobState.nr).toBe(1);

      // Bob -> Alice (Message 2)
      const msg2 = doubleRatchet.ratchetEncrypt(bobState, 'Hi Alice, received your message.');
      expect(msg2.header.n).toBe(0);

      const dec2 = doubleRatchet.ratchetDecrypt(aliceState, msg2.header, msg2.ciphertext);
      expect(dec2.plaintext).toBe('Hi Alice, received your message.');

      // Alice -> Bob (Message 3)
      const msg3 = doubleRatchet.ratchetEncrypt(aliceState, 'How is the weather today?');
      const dec3 = doubleRatchet.ratchetDecrypt(bobState, msg3.header, msg3.ciphertext);
      expect(dec3.plaintext).toBe('How is the weather today?');

      // Bob -> Alice (Message 4)
      const msg4 = doubleRatchet.ratchetEncrypt(bobState, 'Sunny and warm!');
      const dec4 = doubleRatchet.ratchetDecrypt(aliceState, msg4.header, msg4.ciphertext);
      expect(dec4.plaintext).toBe('Sunny and warm!');
    });

    it('7. Burst Messaging (Multiple consecutive messages before reply)', () => {
      const { aliceState, bobState } = setupAliceAndBob();

      // Alice sends 5 consecutive messages
      const m0 = doubleRatchet.ratchetEncrypt(aliceState, 'Burst 0');
      const m1 = doubleRatchet.ratchetEncrypt(aliceState, 'Burst 1');
      const m2 = doubleRatchet.ratchetEncrypt(aliceState, 'Burst 2');
      const m3 = doubleRatchet.ratchetEncrypt(aliceState, 'Burst 3');
      const m4 = doubleRatchet.ratchetEncrypt(aliceState, 'Burst 4');

      expect(m0.header.n).toBe(0);
      expect(m1.header.n).toBe(1);
      expect(m2.header.n).toBe(2);
      expect(m3.header.n).toBe(3);
      expect(m4.header.n).toBe(4);
      expect(aliceState.ns).toBe(5);

      // Bob decrypts all 5 in order
      expect(doubleRatchet.ratchetDecrypt(bobState, m0.header, m0.ciphertext).plaintext).toBe(
        'Burst 0',
      );
      expect(doubleRatchet.ratchetDecrypt(bobState, m1.header, m1.ciphertext).plaintext).toBe(
        'Burst 1',
      );
      expect(doubleRatchet.ratchetDecrypt(bobState, m2.header, m2.ciphertext).plaintext).toBe(
        'Burst 2',
      );
      expect(doubleRatchet.ratchetDecrypt(bobState, m3.header, m3.ciphertext).plaintext).toBe(
        'Burst 3',
      );
      expect(doubleRatchet.ratchetDecrypt(bobState, m4.header, m4.ciphertext).plaintext).toBe(
        'Burst 4',
      );
      expect(bobState.nr).toBe(5);

      // Bob replies with 3 messages
      const b0 = doubleRatchet.ratchetEncrypt(bobState, 'Reply 0');
      const b1 = doubleRatchet.ratchetEncrypt(bobState, 'Reply 1');
      const b2 = doubleRatchet.ratchetEncrypt(bobState, 'Reply 2');

      expect(doubleRatchet.ratchetDecrypt(aliceState, b0.header, b0.ciphertext).plaintext).toBe(
        'Reply 0',
      );
      expect(doubleRatchet.ratchetDecrypt(aliceState, b1.header, b1.ciphertext).plaintext).toBe(
        'Reply 1',
      );
      expect(doubleRatchet.ratchetDecrypt(aliceState, b2.header, b2.ciphertext).plaintext).toBe(
        'Reply 2',
      );
    });

    it('8. Out-of-Order Delivery (Messages arrive in disordered sequence)', () => {
      const { aliceState, bobState } = setupAliceAndBob();

      // Alice sends 4 messages: m0, m1, m2, m3
      const m0 = doubleRatchet.ratchetEncrypt(aliceState, 'Message 0');
      const m1 = doubleRatchet.ratchetEncrypt(aliceState, 'Message 1');
      const m2 = doubleRatchet.ratchetEncrypt(aliceState, 'Message 2');
      const m3 = doubleRatchet.ratchetEncrypt(aliceState, 'Message 3');

      // Bob receives them out-of-order: m3 arrives first!
      const dec3 = doubleRatchet.ratchetDecrypt(bobState, m3.header, m3.ciphertext);
      expect(dec3.plaintext).toBe('Message 3');
      // Skipped keys for m0, m1, m2 must be stored in bobState.skippedKeys
      expect(bobState.skippedKeys.length).toBe(3);

      // Bob receives m1 next
      const dec1 = doubleRatchet.ratchetDecrypt(bobState, m1.header, m1.ciphertext);
      expect(dec1.plaintext).toBe('Message 1');
      expect(bobState.skippedKeys.length).toBe(2);

      // Bob receives m0 next
      const dec0 = doubleRatchet.ratchetDecrypt(bobState, m0.header, m0.ciphertext);
      expect(dec0.plaintext).toBe('Message 0');
      expect(bobState.skippedKeys.length).toBe(1);

      // Bob receives m2 last
      const dec2 = doubleRatchet.ratchetDecrypt(bobState, m2.header, m2.ciphertext);
      expect(dec2.plaintext).toBe('Message 2');
      expect(bobState.skippedKeys.length).toBe(0);
    });

    it('9. Lost / Dropped Message (m1 dropped, m0 and m2 decrypt cleanly)', () => {
      const { aliceState, bobState } = setupAliceAndBob();

      const m0 = doubleRatchet.ratchetEncrypt(aliceState, 'Packet 0');
      doubleRatchet.ratchetEncrypt(aliceState, 'Packet 1 (Lost)');
      const m2 = doubleRatchet.ratchetEncrypt(aliceState, 'Packet 2');

      // Bob receives m0
      expect(doubleRatchet.ratchetDecrypt(bobState, m0.header, m0.ciphertext).plaintext).toBe(
        'Packet 0',
      );

      // Packet 1 is lost over the network and never arrives. Bob receives m2:
      expect(doubleRatchet.ratchetDecrypt(bobState, m2.header, m2.ciphertext).plaintext).toBe(
        'Packet 2',
      );

      // Bob's skipped keys still holds the key for dropped packet 1
      expect(bobState.skippedKeys.length).toBe(1);
      expect(bobState.skippedKeys[0]?.n).toBe(1);

      // Bob replies cleanly
      const b0 = doubleRatchet.ratchetEncrypt(bobState, 'Bob got packet 0 and 2');
      expect(doubleRatchet.ratchetDecrypt(aliceState, b0.header, b0.ciphertext).plaintext).toBe(
        'Bob got packet 0 and 2',
      );
    });

    it('10. Anti-Replay: Replaying an already-decrypted message throws E2EEDecryptionError', () => {
      const { aliceState, bobState } = setupAliceAndBob();

      const m0 = doubleRatchet.ratchetEncrypt(aliceState, 'Replay Test Message');
      const m1 = doubleRatchet.ratchetEncrypt(aliceState, 'Second Message');

      // Bob decrypts both
      doubleRatchet.ratchetDecrypt(bobState, m0.header, m0.ciphertext);
      doubleRatchet.ratchetDecrypt(bobState, m1.header, m1.ciphertext);

      // Attacker replays m0
      expect(() => {
        doubleRatchet.ratchetDecrypt(bobState, m0.header, m0.ciphertext);
      }).toThrow(E2EEDecryptionError);
    });

    it('11. Anti-Replay: Replaying a skipped message after its key was consumed throws', () => {
      const { aliceState, bobState } = setupAliceAndBob();

      doubleRatchet.ratchetEncrypt(aliceState, 'First');
      const m1 = doubleRatchet.ratchetEncrypt(aliceState, 'Second (Delayed)');
      const m2 = doubleRatchet.ratchetEncrypt(aliceState, 'Third');

      // Bob receives m2 first (m0 and m1 skipped)
      doubleRatchet.ratchetDecrypt(bobState, m2.header, m2.ciphertext);

      // Delayed m1 arrives and decrypts
      doubleRatchet.ratchetDecrypt(bobState, m1.header, m1.ciphertext);

      // Attacker tries to replay m1
      expect(() => {
        doubleRatchet.ratchetDecrypt(bobState, m1.header, m1.ciphertext);
      }).toThrow(E2EEDecryptionError);
    });

    it('12. DoS Defense: Rejects message with skip gap exceeding MAX_SKIP', () => {
      const { bobState } = setupAliceAndBob();

      // Forge a header claiming n = MAX_SKIP + 10
      const forgedHeader: DoubleRatchetHeader = {
        ratchetKey: bytesToBase64(x25519.getPublicKey(x25519.utils.randomSecretKey())),
        pn: 0,
        n: MAX_SKIP + 10,
      };

      expect(() => {
        doubleRatchet.ratchetDecrypt(bobState, forgedHeader, 'fakeCiphertext');
      }).toThrow(/exceeds limit/);
    });

    it('13. Bounded Skipped Keys: Prunes excess keys when exceeding MAX_SKIPPED_KEYS', () => {
      const { aliceState, bobState } = setupAliceAndBob();

      // Pre-fill bobState with 1000 dummy skipped keys
      for (let i = 0; i < MAX_SKIPPED_KEYS; i++) {
        bobState.skippedKeys.push({
          ratchetKey: 'dummy',
          n: i,
          messageKey: bytesToBase64(new Uint8Array(32)),
          createdAt: new Date().toISOString(),
        });
      }

      // Alice sends a message that causes 5 new skipped keys
      for (let i = 0; i < 5; i++) {
        doubleRatchet.ratchetEncrypt(aliceState, String(i));
      }
      const m5 = doubleRatchet.ratchetEncrypt(aliceState, '5');

      // Bob receives m5 directly, skipping 0..4
      doubleRatchet.ratchetDecrypt(bobState, m5.header, m5.ciphertext);

      // Total skipped keys must be capped at MAX_SKIPPED_KEYS
      expect(bobState.skippedKeys.length).toBeLessThanOrEqual(MAX_SKIPPED_KEYS);
    });
  });
});
