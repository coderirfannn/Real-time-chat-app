import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type {
  KeyPair,
  OneTimePreKeyPair,
  SignedPreKeyPair,
  X3DHInitiatorParams,
  X3DHInitiatorResult,
  X3DHReceiverParams,
  X3DHReceiverResult,
} from './crypto.types';

const X3DH_SALT = new Uint8Array(32);
const X3DH_INFO = new TextEncoder().encode('ChatLock-X3DH-v1');

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const arr of arrays) {
    totalLen += arr.length;
  }
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class CryptoService {
  /**
   * Generates a long-term Ed25519 identity key pair.
   * Private key MUST remain local on device.
   */
  public generateIdentityKeyPair(): KeyPair {
    const privKeyBytes = ed25519.utils.randomSecretKey();
    const pubKeyBytes = ed25519.getPublicKey(privKeyBytes);

    return {
      privateKey: bytesToBase64(privKeyBytes),
      publicKey: bytesToBase64(pubKeyBytes),
    };
  }

  /**
   * Generates an X25519 signed pre-key and signs its public key using the device Ed25519 identity private key.
   */
  public generateSignedPreKey(
    identityPrivateKeyBase64: string,
    keyId: number,
    validityDays = 30,
  ): SignedPreKeyPair {
    const idPrivKeyBytes = base64ToBytes(identityPrivateKeyBase64);

    // 1. Generate X25519 pre-key pair
    const spkPrivBytes = x25519.utils.randomSecretKey();
    const spkPubBytes = x25519.getPublicKey(spkPrivBytes);

    // 2. Sign X25519 public key using Ed25519 identity private key
    const signatureBytes = ed25519.sign(spkPubBytes, idPrivKeyBytes);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    return {
      keyId,
      publicKey: bytesToBase64(spkPubBytes),
      privateKey: bytesToBase64(spkPrivBytes),
      signature: bytesToBase64(signatureBytes),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Generates a batch of X25519 one-time pre-keys.
   */
  public generateOneTimePreKeys(startKeyId: number, count = 50): OneTimePreKeyPair[] {
    const keys: OneTimePreKeyPair[] = [];

    for (let i = 0; i < count; i++) {
      const keyId = startKeyId + i;
      const privBytes = x25519.utils.randomSecretKey();
      const pubBytes = x25519.getPublicKey(privBytes);

      keys.push({
        keyId,
        publicKey: bytesToBase64(pubBytes),
        privateKey: bytesToBase64(privBytes),
      });
    }

    return keys;
  }

  /**
   * Verifies an Ed25519 signature over a signed pre-key public key.
   */
  public verifySignedPreKeySignature(
    identityPublicKeyBase64: string,
    signedPreKeyPublicKeyBase64: string,
    signatureBase64: string,
  ): boolean {
    try {
      const idPubBytes = base64ToBytes(identityPublicKeyBase64);
      const spkPubBytes = base64ToBytes(signedPreKeyPublicKeyBase64);
      const sigBytes = base64ToBytes(signatureBase64);

      if (idPubBytes.length !== 32 || spkPubBytes.length !== 32 || sigBytes.length !== 64) {
        return false;
      }

      return ed25519.verify(sigBytes, spkPubBytes, idPubBytes);
    } catch {
      return false;
    }
  }

  /**
   * Signal X3DH Protocol: Initiator (Alice) establishes initial shared secret.
   */
  public x3dhInitiator(params: X3DHInitiatorParams): X3DHInitiatorResult {
    const idPrivBytes = base64ToBytes(params.initiatorIdentityPrivateKey);
    const bobIdPubBytes = base64ToBytes(params.recipientIdentityPublicKey);
    const bobSpkPubBytes = base64ToBytes(params.recipientSignedPreKeyPublicKey);

    // 1. Convert Alice's Ed25519 secret key to X25519 Montgomery secret key
    const aliceIdMontgomerySecret = ed25519.utils.toMontgomerySecret(idPrivBytes);

    // 2. Convert Bob's Ed25519 public key to X25519 Montgomery public key
    const bobIdMontgomeryPub = ed25519.utils.toMontgomery(bobIdPubBytes);

    // 3. Generate fresh ephemeral X25519 keypair EK_A
    const ekPriv = x25519.utils.randomSecretKey();
    const ekPub = x25519.getPublicKey(ekPriv);

    // 4. Compute Diffie-Hellman agreements
    const dh1 = x25519.getSharedSecret(aliceIdMontgomerySecret, bobSpkPubBytes);
    const dh2 = x25519.getSharedSecret(ekPriv, bobIdMontgomeryPub);
    const dh3 = x25519.getSharedSecret(ekPriv, bobSpkPubBytes);

    let ikm: Uint8Array;
    if (params.recipientOneTimePreKeyPublicKey) {
      const bobOpkPubBytes = base64ToBytes(params.recipientOneTimePreKeyPublicKey);
      const dh4 = x25519.getSharedSecret(ekPriv, bobOpkPubBytes);
      ikm = concatBytes(dh1, dh2, dh3, dh4);
    } else {
      ikm = concatBytes(dh1, dh2, dh3);
    }

    // 5. Derive master shared secret via HKDF-SHA-256
    const masterSharedSecret = hkdf(sha256, ikm, X3DH_SALT, X3DH_INFO, 32);

    return {
      sharedSecret: bytesToBase64(masterSharedSecret),
      ephemeralPublicKey: bytesToBase64(ekPub),
    };
  }

  /**
   * Signal X3DH Protocol: Receiver (Bob) establishes initial shared secret.
   */
  public x3dhReceiver(params: X3DHReceiverParams): X3DHReceiverResult {
    const bobIdPrivBytes = base64ToBytes(params.receiverIdentityPrivateKey);
    const aliceIdPubBytes = base64ToBytes(params.initiatorIdentityPublicKey);
    const aliceEkPubBytes = base64ToBytes(params.initiatorEphemeralPublicKey);
    const bobSpkPrivBytes = base64ToBytes(params.receiverSignedPreKeyPrivateKey);

    // 1. Convert Bob's Ed25519 secret key to X25519 Montgomery secret key
    const bobIdMontgomerySecret = ed25519.utils.toMontgomerySecret(bobIdPrivBytes);

    // 2. Convert Alice's Ed25519 public key to X25519 Montgomery public key
    const aliceIdMontgomeryPub = ed25519.utils.toMontgomery(aliceIdPubBytes);

    // 3. Compute symmetric Diffie-Hellman agreements
    const dh1 = x25519.getSharedSecret(bobSpkPrivBytes, aliceIdMontgomeryPub);
    const dh2 = x25519.getSharedSecret(bobIdMontgomerySecret, aliceEkPubBytes);
    const dh3 = x25519.getSharedSecret(bobSpkPrivBytes, aliceEkPubBytes);

    let ikm: Uint8Array;
    if (params.receiverOneTimePreKeyPrivateKey) {
      const bobOpkPrivBytes = base64ToBytes(params.receiverOneTimePreKeyPrivateKey);
      const dh4 = x25519.getSharedSecret(bobOpkPrivBytes, aliceEkPubBytes);
      ikm = concatBytes(dh1, dh2, dh3, dh4);
    } else {
      ikm = concatBytes(dh1, dh2, dh3);
    }

    // 4. Derive identical master shared secret via HKDF-SHA-256
    const masterSharedSecret = hkdf(sha256, ikm, X3DH_SALT, X3DH_INFO, 32);

    return {
      sharedSecret: bytesToBase64(masterSharedSecret),
    };
  }
}

export const cryptoService = new CryptoService();
