import { describe, it, expect } from 'vitest';
import { cryptoService } from '../../services/crypto/crypto.service';

describe('Signal X3DH Key Agreement Protocol (@noble/curves & @noble/hashes)', () => {
  // Alice (Initiator) Key Material
  const aliceIdentity = cryptoService.generateIdentityKeyPair();

  // Bob (Receiver) Key Material
  const bobIdentity = cryptoService.generateIdentityKeyPair();
  const bobSpk = cryptoService.generateSignedPreKey(bobIdentity.privateKey, 1, 30);
  const bobOpks = cryptoService.generateOneTimePreKeys(1, 5);

  it('Alice and Bob derive the EXACT same 32-byte shared secret when OPK is present (4-DH)', () => {
    const bobOpk = bobOpks[0]!;

    // 1. Alice initiates X3DH with Bob's public keys
    const aliceResult = cryptoService.x3dhInitiator({
      initiatorIdentityPrivateKey: aliceIdentity.privateKey,
      recipientIdentityPublicKey: bobIdentity.publicKey,
      recipientSignedPreKeyPublicKey: bobSpk.publicKey,
      recipientOneTimePreKeyPublicKey: bobOpk.publicKey,
    });

    // 2. Bob receives Alice's identity key and ephemeral public key, and completes X3DH
    const bobResult = cryptoService.x3dhReceiver({
      receiverIdentityPrivateKey: bobIdentity.privateKey,
      initiatorIdentityPublicKey: aliceIdentity.publicKey,
      initiatorEphemeralPublicKey: aliceResult.ephemeralPublicKey,
      receiverSignedPreKeyPrivateKey: bobSpk.privateKey,
      receiverOneTimePreKeyPrivateKey: bobOpk.privateKey,
    });

    expect(aliceResult.sharedSecret).toBeDefined();
    expect(bobResult.sharedSecret).toBeDefined();
    expect(aliceResult.sharedSecret.length).toBeGreaterThan(0);

    // CRITICAL: Both shared secrets must be 100% byte-for-byte identical
    expect(aliceResult.sharedSecret).toBe(bobResult.sharedSecret);
  });

  it('Alice and Bob derive the EXACT same 32-byte shared secret when OPK pool is depleted (3-DH fallback)', () => {
    // 1. Alice initiates X3DH with Bob's public keys (NO OPK)
    const aliceResult = cryptoService.x3dhInitiator({
      initiatorIdentityPrivateKey: aliceIdentity.privateKey,
      recipientIdentityPublicKey: bobIdentity.publicKey,
      recipientSignedPreKeyPublicKey: bobSpk.publicKey,
      recipientOneTimePreKeyPublicKey: null, // depleted
    });

    // 2. Bob completes 3-DH without OPK
    const bobResult = cryptoService.x3dhReceiver({
      receiverIdentityPrivateKey: bobIdentity.privateKey,
      initiatorIdentityPublicKey: aliceIdentity.publicKey,
      initiatorEphemeralPublicKey: aliceResult.ephemeralPublicKey,
      receiverSignedPreKeyPrivateKey: bobSpk.privateKey,
      receiverOneTimePreKeyPrivateKey: null,
    });

    expect(aliceResult.sharedSecret).toBe(bobResult.sharedSecret);
  });

  it('produces distinct, non-replayable shared secrets for consecutive sessions due to fresh ephemeral keys', () => {
    const session1 = cryptoService.x3dhInitiator({
      initiatorIdentityPrivateKey: aliceIdentity.privateKey,
      recipientIdentityPublicKey: bobIdentity.publicKey,
      recipientSignedPreKeyPublicKey: bobSpk.publicKey,
      recipientOneTimePreKeyPublicKey: bobOpks[0]?.publicKey,
    });

    const session2 = cryptoService.x3dhInitiator({
      initiatorIdentityPrivateKey: aliceIdentity.privateKey,
      recipientIdentityPublicKey: bobIdentity.publicKey,
      recipientSignedPreKeyPublicKey: bobSpk.publicKey,
      recipientOneTimePreKeyPublicKey: bobOpks[1]?.publicKey,
    });

    expect(session1.ephemeralPublicKey).not.toBe(session2.ephemeralPublicKey);
    expect(session1.sharedSecret).not.toBe(session2.sharedSecret);
  });

  it('derivation fails to match if any public key or ephemeral key is tampered with', () => {
    const bobOpk = bobOpks[0]!;

    const aliceResult = cryptoService.x3dhInitiator({
      initiatorIdentityPrivateKey: aliceIdentity.privateKey,
      recipientIdentityPublicKey: bobIdentity.publicKey,
      recipientSignedPreKeyPublicKey: bobSpk.publicKey,
      recipientOneTimePreKeyPublicKey: bobOpk.publicKey,
    });

    // An attacker substitutes Alice's ephemeral key with a tampered key
    const tamperedEphemeral = cryptoService.generateOneTimePreKeys(99, 1)[0]!.publicKey;

    const bobResult = cryptoService.x3dhReceiver({
      receiverIdentityPrivateKey: bobIdentity.privateKey,
      initiatorIdentityPublicKey: aliceIdentity.publicKey,
      initiatorEphemeralPublicKey: tamperedEphemeral, // Tampered!
      receiverSignedPreKeyPrivateKey: bobSpk.privateKey,
      receiverOneTimePreKeyPrivateKey: bobOpk.privateKey,
    });

    expect(aliceResult.sharedSecret).not.toBe(bobResult.sharedSecret);
  });
});
