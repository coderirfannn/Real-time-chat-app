import { describe, it, expect } from 'vitest';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { e2eeService } from '../../services/e2ee.service.js';

describe('E2EE Cryptographic Verification & Primitives', () => {
  it('successfully verifies a valid Ed25519 signature over an X25519 public key', () => {
    const idPriv = ed25519.utils.randomSecretKey();
    const idPub = ed25519.getPublicKey(idPriv);

    const spkPriv = x25519.utils.randomSecretKey();
    const spkPub = x25519.getPublicKey(spkPriv);

    const sig = ed25519.sign(spkPub, idPriv);

    const idPubB64 = Buffer.from(idPub).toString('base64');
    const spkPubB64 = Buffer.from(spkPub).toString('base64');
    const sigB64 = Buffer.from(sig).toString('base64');

    const isValid = e2eeService.verifySignedPreKeySignature(idPubB64, spkPubB64, sigB64);
    expect(isValid).toBe(true);
  });

  it('rejects an invalid signature produced by a different private key', () => {
    const idPriv1 = ed25519.utils.randomSecretKey();
    const idPub1 = ed25519.getPublicKey(idPriv1);

    const idPriv2 = ed25519.utils.randomSecretKey();

    const spkPriv = x25519.utils.randomSecretKey();
    const spkPub = x25519.getPublicKey(spkPriv);

    // Signed by idPriv2, but claimed to be idPub1
    const forgedSig = ed25519.sign(spkPub, idPriv2);

    const idPub1B64 = Buffer.from(idPub1).toString('base64');
    const spkPubB64 = Buffer.from(spkPub).toString('base64');
    const forgedSigB64 = Buffer.from(forgedSig).toString('base64');

    const isValid = e2eeService.verifySignedPreKeySignature(idPub1B64, spkPubB64, forgedSigB64);
    expect(isValid).toBe(false);
  });

  it('rejects a signature if the signed pre-key public key was tampered with', () => {
    const idPriv = ed25519.utils.randomSecretKey();
    const idPub = ed25519.getPublicKey(idPriv);

    const spkPriv1 = x25519.utils.randomSecretKey();
    const spkPub1 = x25519.getPublicKey(spkPriv1);

    const sig = ed25519.sign(spkPub1, idPriv);

    const spkPriv2 = x25519.utils.randomSecretKey();
    const spkPub2 = x25519.getPublicKey(spkPriv2); // different key

    const idPubB64 = Buffer.from(idPub).toString('base64');
    const spkPub2B64 = Buffer.from(spkPub2).toString('base64'); // tampered
    const sigB64 = Buffer.from(sig).toString('base64');

    const isValid = e2eeService.verifySignedPreKeySignature(idPubB64, spkPub2B64, sigB64);
    expect(isValid).toBe(false);
  });

  it('rejects malformed Base64 or corrupted byte lengths gracefully without crashing', () => {
    expect(e2eeService.verifySignedPreKeySignature('not-valid', 'not-valid', 'not-valid')).toBe(
      false,
    );
    expect(
      e2eeService.verifySignedPreKeySignature(
        Buffer.alloc(16).toString('base64'),
        Buffer.alloc(32).toString('base64'),
        Buffer.alloc(64).toString('base64'),
      ),
    ).toBe(false);
  });
});
