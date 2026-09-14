import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import type { DoubleRatchetHeader, RatchetState, SkippedMessageKey } from '@chatlock/shared-types';

import { bytesToBase64, base64ToBytes } from './crypto.service';

/** Maximum number of messages that can be skipped in a single ratchet step (DoS protection) */
export const MAX_SKIP = 2000;

/** Maximum number of skipped message keys retained in memory/storage */
export const MAX_SKIPPED_KEYS = 1000;

/** Time-to-live for skipped message keys (14 days) */
export const SKIPPED_KEY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const ROOT_KDF_INFO = new TextEncoder().encode('ChatLock-DoubleRatchet-Root-v1');
const NONCE_KDF_INFO = new TextEncoder().encode('ChatLock-DoubleRatchet-Nonce-v1');
const CHAIN_KDF_MK_CONSTANT = new Uint8Array([0x01]);
const CHAIN_KDF_CK_CONSTANT = new Uint8Array([0x02]);

export class E2EEDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'E2EEDecryptionError';
  }
}

export function zeroize(bytes: Uint8Array): void {
  bytes.fill(0);
}

export class DoubleRatchetService {
  /**
   * Root KDF: Takes Root Key (RK) and DH output, derives a 64-byte output
   * split into a new Root Key (32 bytes) and a new Chain Key (32 bytes).
   */
  public kdfRK(rk: Uint8Array, dhOut: Uint8Array): { rootKey: Uint8Array; chainKey: Uint8Array } {
    const derived = hkdf(sha256, dhOut, rk, ROOT_KDF_INFO, 64);
    const rootKey = derived.slice(0, 32);
    const chainKey = derived.slice(32, 64);
    zeroize(derived);
    return { rootKey, chainKey };
  }

  /**
   * Chain KDF: Takes Chain Key (CK), derives Message Key (MK) and advances CK.
   * Forward secrecy: Past message keys cannot be derived from advanced chain keys.
   */
  public kdfCK(ck: Uint8Array): { chainKey: Uint8Array; messageKey: Uint8Array } {
    const messageKey = hmac(sha256, ck, CHAIN_KDF_MK_CONSTANT);
    const chainKey = hmac(sha256, ck, CHAIN_KDF_CK_CONSTANT);
    return { chainKey, messageKey };
  }

  /**
   * Derives a deterministic 12-byte nonce for ChaCha20-Poly1305 from Message Key and counter.
   */
  private deriveNonce(messageKey: Uint8Array, n: number): Uint8Array {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, n, false); // big-endian
    return hkdf(sha256, messageKey, counterBytes, NONCE_KDF_INFO, 12);
  }

  /**
   * Canonical Associated Authenticated Data (AAD) for header integrity verification.
   * Defeats tampering with ratchetKey, pn, or message counter n.
   */
  private buildAAD(header: DoubleRatchetHeader): Uint8Array {
    return new TextEncoder().encode(`${header.ratchetKey}:${header.pn}:${header.n}`);
  }

  /**
   * Encrypts plaintext using ChaCha20-Poly1305 AEAD with header authenticated as AAD.
   */
  public encryptPayload(
    messageKey: Uint8Array,
    header: DoubleRatchetHeader,
    plaintext: string,
  ): string {
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const nonce = this.deriveNonce(messageKey, header.n);
    const aad = this.buildAAD(header);

    const cipher = chacha20poly1305(messageKey, nonce, aad);
    const ciphertextBytes = cipher.encrypt(plaintextBytes);

    zeroize(nonce);
    return bytesToBase64(ciphertextBytes);
  }

  /**
   * Decrypts ciphertext using ChaCha20-Poly1305 AEAD and verifies header AAD.
   * Throws E2EEDecryptionError if tampered with or tag verification fails.
   */
  public decryptPayload(
    messageKey: Uint8Array,
    header: DoubleRatchetHeader,
    ciphertextBase64: string,
  ): string {
    try {
      const ciphertextBytes = base64ToBytes(ciphertextBase64);
      const nonce = this.deriveNonce(messageKey, header.n);
      const aad = this.buildAAD(header);

      const cipher = chacha20poly1305(messageKey, nonce, aad);
      const decryptedBytes = cipher.decrypt(ciphertextBytes);

      zeroize(nonce);
      return new TextDecoder().decode(decryptedBytes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new E2EEDecryptionError(`E2EE Decryption Failed: ${message}`);
    }
  }

  /**
   * Initializes Double Ratchet state for the Initiator (Alice) following X3DH.
   */
  public initRatchetAsInitiator(
    sharedSecretBase64: string,
    recipientSignedPreKeyPublicKeyBase64: string,
  ): RatchetState {
    const skBytes = base64ToBytes(sharedSecretBase64);
    const bobSpkPubBytes = base64ToBytes(recipientSignedPreKeyPublicKeyBase64);

    // Generate Alice's initial DH ratchet key pair
    const dhsPriv = x25519.utils.randomSecretKey();
    const dhsPub = x25519.getPublicKey(dhsPriv);

    // Initial DH ratchet output with Bob's SPK
    const dhOut = x25519.getSharedSecret(dhsPriv, bobSpkPubBytes);
    const { rootKey, chainKey } = this.kdfRK(skBytes, dhOut);

    zeroize(dhOut);
    zeroize(skBytes);

    return {
      dhsPrivateKey: bytesToBase64(dhsPriv),
      dhsPublicKey: bytesToBase64(dhsPub),
      dhrPublicKey: recipientSignedPreKeyPublicKeyBase64,
      rootKey: bytesToBase64(rootKey),
      sendingChainKey: bytesToBase64(chainKey),
      receivingChainKey: null,
      ns: 0,
      nr: 0,
      pn: 0,
      skippedKeys: [],
    };
  }

  /**
   * Initializes Double Ratchet state for the Receiver (Bob) following X3DH.
   */
  public initRatchetAsReceiver(
    sharedSecretBase64: string,
    receiverSignedPreKeyPrivateKeyBase64: string,
    receiverSignedPreKeyPublicKeyBase64: string,
  ): RatchetState {
    return {
      dhsPrivateKey: receiverSignedPreKeyPrivateKeyBase64,
      dhsPublicKey: receiverSignedPreKeyPublicKeyBase64,
      dhrPublicKey: null, // Initialized upon receipt of first message from initiator
      rootKey: sharedSecretBase64,
      sendingChainKey: null,
      receivingChainKey: null,
      ns: 0,
      nr: 0,
      pn: 0,
      skippedKeys: [],
    };
  }

  /**
   * Encrypts a plaintext message and advances the sending chain.
   * State is modified in-place and returned.
   */
  public ratchetEncrypt(
    state: RatchetState,
    plaintext: string,
  ): {
    header: DoubleRatchetHeader;
    ciphertext: string;
    updatedState: RatchetState;
  } {
    if (!state.sendingChainKey) {
      throw new Error('Ratchet Error: Sending chain key is not initialized');
    }

    const currentCkBytes = base64ToBytes(state.sendingChainKey);
    const { chainKey: nextCk, messageKey: mk } = this.kdfCK(currentCkBytes);
    zeroize(currentCkBytes);

    const header: DoubleRatchetHeader = {
      ratchetKey: state.dhsPublicKey,
      pn: state.pn,
      n: state.ns,
    };

    const ciphertext = this.encryptPayload(mk, header, plaintext);
    zeroize(mk);

    state.sendingChainKey = bytesToBase64(nextCk);
    zeroize(nextCk);
    state.ns += 1;

    return { header, ciphertext, updatedState: state };
  }

  /**
   * Decrypts an incoming message, performing DH ratchet step or advancing receiving chain as needed.
   * Handles out-of-order delivery, skipped message keys, and rejects replays.
   * State is modified in-place and returned.
   */
  public ratchetDecrypt(
    state: RatchetState,
    header: DoubleRatchetHeader,
    ciphertext: string,
  ): {
    plaintext: string;
    updatedState: RatchetState;
  } {
    // 1. Check if key is already in skipped keys table (delayed/out-of-order message)
    const skippedIndex = state.skippedKeys.findIndex(
      (k) => k.ratchetKey === header.ratchetKey && k.n === header.n,
    );

    if (skippedIndex !== -1) {
      const skippedItem = state.skippedKeys[skippedIndex];
      if (!skippedItem) {
        throw new E2EEDecryptionError('Skipped message key reference missing');
      }
      const mkBytes = base64ToBytes(skippedItem.messageKey);

      // Single-use guarantee: Delete key immediately to prevent replay
      state.skippedKeys.splice(skippedIndex, 1);

      const plaintext = this.decryptPayload(mkBytes, header, ciphertext);
      zeroize(mkBytes);
      return { plaintext, updatedState: state };
    }

    // 2. Reject replayed messages in the current chain
    if (state.dhrPublicKey === header.ratchetKey && header.n < state.nr) {
      throw new E2EEDecryptionError(
        `E2EE Replay Rejected: Message counter (${header.n}) is older than current counter (${state.nr})`,
      );
    }

    // 3. If peer ratchet key differs, advance previous receiving chain and execute DH Ratchet
    if (state.dhrPublicKey !== header.ratchetKey) {
      if (state.dhrPublicKey !== null) {
        // Skip messages in previous receiving chain up to header.pn
        this.skipMessageKeys(state, header.pn);
      }

      this.dhRatchetStep(state, header);
    }

    // 4. Skip any missing messages in current receiving chain up to header.n
    this.skipMessageKeys(state, header.n);

    // 5. Derive message key for header.n and advance receiving chain
    if (!state.receivingChainKey) {
      throw new E2EEDecryptionError('Ratchet Error: Receiving chain key is null');
    }

    const currentCkBytes = base64ToBytes(state.receivingChainKey);
    const { chainKey: nextCk, messageKey: mk } = this.kdfCK(currentCkBytes);
    zeroize(currentCkBytes);

    state.receivingChainKey = bytesToBase64(nextCk);
    zeroize(nextCk);
    state.nr += 1;

    // 6. Decrypt payload
    const plaintext = this.decryptPayload(mk, header, ciphertext);
    zeroize(mk);

    return { plaintext, updatedState: state };
  }

  /**
   * Executes a Diffie-Hellman ratchet step when the remote ratchet public key changes.
   */
  private dhRatchetStep(state: RatchetState, header: DoubleRatchetHeader): void {
    const peerRatchetPubBytes = base64ToBytes(header.ratchetKey);
    const localDhsPrivBytes = base64ToBytes(state.dhsPrivateKey);
    const currentRkBytes = base64ToBytes(state.rootKey);

    state.pn = state.ns;
    state.ns = 0;
    state.nr = 0;
    state.dhrPublicKey = header.ratchetKey;

    // 1. Derive new receiving chain key from (local DHs, peer's new DHr)
    const dhRecv = x25519.getSharedSecret(localDhsPrivBytes, peerRatchetPubBytes);
    const { rootKey: intermediateRk, chainKey: recvCk } = this.kdfRK(currentRkBytes, dhRecv);
    zeroize(dhRecv);
    zeroize(currentRkBytes);
    zeroize(localDhsPrivBytes);

    state.receivingChainKey = bytesToBase64(recvCk);
    zeroize(recvCk);

    // 2. Generate fresh local DHs ratchet key pair for future sending
    const nextDhsPriv = x25519.utils.randomSecretKey();
    const nextDhsPub = x25519.getPublicKey(nextDhsPriv);

    state.dhsPrivateKey = bytesToBase64(nextDhsPriv);
    state.dhsPublicKey = bytesToBase64(nextDhsPub);

    // 3. Derive new sending chain key from (new local DHs, peer's new DHr)
    const dhSend = x25519.getSharedSecret(nextDhsPriv, peerRatchetPubBytes);
    const { rootKey: nextRk, chainKey: sendCk } = this.kdfRK(intermediateRk, dhSend);
    zeroize(dhSend);
    zeroize(intermediateRk);

    state.rootKey = bytesToBase64(nextRk);
    state.sendingChainKey = bytesToBase64(sendCk);
    zeroize(nextRk);
    zeroize(sendCk);
  }

  /**
   * Advances the receiving chain key and stores skipped message keys until `untilIndex`.
   */
  private skipMessageKeys(state: RatchetState, untilIndex: number): void {
    if (state.nr + MAX_SKIP < untilIndex) {
      throw new E2EEDecryptionError(
        `E2EE DoS Defense: Skipped messages gap (${untilIndex - state.nr}) exceeds limit (${MAX_SKIP})`,
      );
    }

    if (!state.receivingChainKey || !state.dhrPublicKey) {
      return;
    }

    while (state.nr < untilIndex) {
      const ckBytes = base64ToBytes(state.receivingChainKey);
      const { chainKey: nextCk, messageKey: mk } = this.kdfCK(ckBytes);
      zeroize(ckBytes);

      state.receivingChainKey = bytesToBase64(nextCk);
      zeroize(nextCk);

      const skippedKey: SkippedMessageKey = {
        ratchetKey: state.dhrPublicKey,
        n: state.nr,
        messageKey: bytesToBase64(mk),
        createdAt: new Date().toISOString(),
      };
      zeroize(mk);

      state.skippedKeys.push(skippedKey);
      state.nr += 1;
    }

    this.pruneSkippedKeys(state);
  }

  /**
   * Prunes expired skipped keys and limits total skipped key count to prevent memory exhaustion.
   */
  private pruneSkippedKeys(state: RatchetState): void {
    const now = Date.now();

    // 1. Remove expired skipped keys
    state.skippedKeys = state.skippedKeys.filter((item) => {
      const age = now - new Date(item.createdAt).getTime();
      return age < SKIPPED_KEY_TTL_MS;
    });

    // 2. Bound count to MAX_SKIPPED_KEYS, discarding oldest
    if (state.skippedKeys.length > MAX_SKIPPED_KEYS) {
      const excess = state.skippedKeys.length - MAX_SKIPPED_KEYS;
      state.skippedKeys.splice(0, excess);
    }
  }
}

export const doubleRatchetService = new DoubleRatchetService();
