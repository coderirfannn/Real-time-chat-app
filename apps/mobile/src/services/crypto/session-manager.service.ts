import { cryptoService, type CryptoService } from './crypto.service';
import { doubleRatchetService, type DoubleRatchetService } from './double-ratchet.service';
import { deviceKeyStore, type DeviceKeyStore } from './device-key-store';
import { sessionStore, type SessionStore } from './session-store';
import { e2eeApi, type E2EEApi } from '../api/e2ee.api';
import { NotificationService } from '../notifications/notification.service';
import { x3dhSessionInitHeaderSchema, e2eeEncryptedPayloadSchema } from '@chatlock/validation';
import type {
  E2EESessionState,
  X3DHSessionInitHeader,
  E2EEEncryptedPayload,
} from '@chatlock/shared-types';

export class SessionManagerService {
  constructor(
    private readonly crypto: CryptoService = cryptoService,
    private readonly keyStore: DeviceKeyStore = deviceKeyStore,
    private readonly sessions: SessionStore = sessionStore,
    private readonly api: E2EEApi = e2eeApi,
    private readonly ratchet: DoubleRatchetService = doubleRatchetService,
  ) {}

  /**
   * Checks if a session has exceeded its expiration horizon.
   */
  public isSessionExpired(session: E2EESessionState): boolean {
    const expiryTime = new Date(session.expiresAt).getTime();
    if (isNaN(expiryTime)) return true;
    return Date.now() >= expiryTime;
  }

  /**
   * Initiator Flow: Retrieves or establishes an outbound E2EE session with a peer device.
   */
  public async getOrEstablishOutboundSession(
    peerUserId: string,
    peerDeviceId?: string,
    currentUserId = 'me',
  ): Promise<{ session: E2EESessionState; initHeader: X3DHSessionInitHeader }> {
    // 1. Check for existing active, unexpired session
    const existingSession = await this.sessions.getActiveSession(peerUserId, peerDeviceId);
    if (existingSession && !this.isSessionExpired(existingSession)) {
      // Recreate existing init header metadata
      const initHeader: X3DHSessionInitHeader = {
        initiatorUserId: currentUserId,
        initiatorDeviceId: await NotificationService.getInstance().getDeviceId(),
        initiatorIdentityKey: existingSession.localIdentityKey,
        ephemeralPublicKey: '', // Ephemeral key is not stored once session is established
        spkKeyId: existingSession.spkKeyId,
        opkKeyId: existingSession.opkKeyId,
        sessionVersion: existingSession.sessionVersion,
        timestamp: existingSession.createdAt,
      };

      existingSession.lastActiveAt = new Date().toISOString();
      await this.sessions.saveSession(existingSession);

      return { session: existingSession, initHeader };
    }

    // 2. Fetch peer's public key bundle from zero-trust server directory
    const bundle = await this.api.getPeerBundle(peerUserId, peerDeviceId);

    // 3. Verify device status is ACTIVE
    if (bundle.deviceStatus !== 'ACTIVE') {
      throw new Error(`Cannot establish E2EE session: Recipient device is ${bundle.deviceStatus}`);
    }

    // 4. Verify peer's signed pre-key signature using their identity key
    const isValidSignature = this.crypto.verifySignedPreKeySignature(
      bundle.identityKey,
      bundle.signedPreKey.publicKey,
      bundle.signedPreKey.signature,
    );

    if (!isValidSignature) {
      throw new Error('E2EE Security Alert: Invalid Signed Pre-Key signature from peer');
    }

    // 5. Retrieve local identity key pair
    const localIdentity = await this.keyStore.getIdentityKeyPair();
    if (!localIdentity) {
      throw new Error('Cannot establish E2EE session: Local identity key pair missing');
    }

    const localDeviceId = await NotificationService.getInstance().getDeviceId();

    // 6. Execute Signal X3DH initiator key agreement
    const x3dhResult = this.crypto.x3dhInitiator({
      initiatorIdentityPrivateKey: localIdentity.privateKey,
      recipientIdentityPublicKey: bundle.identityKey,
      recipientSignedPreKeyPublicKey: bundle.signedPreKey.publicKey,
      recipientOneTimePreKeyPublicKey: bundle.oneTimePreKey?.publicKey ?? null,
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days validity

    // 7. Initialize Double Ratchet state for Initiator
    const initialRatchetState = this.ratchet.initRatchetAsInitiator(
      x3dhResult.sharedSecret,
      bundle.signedPreKey.publicKey,
    );

    // 8. Persist session state securely on local device
    const session: E2EESessionState = {
      sessionId: `${peerUserId}:${bundle.deviceId}`,
      peerUserId,
      peerDeviceId: bundle.deviceId,
      peerIdentityKey: bundle.identityKey,
      localIdentityKey: localIdentity.publicKey,
      role: 'initiator',
      sharedSecret: x3dhResult.sharedSecret,
      sessionVersion: bundle.keyVersion,
      status: 'ACTIVE',
      spkKeyId: bundle.signedPreKey.keyId,
      opkKeyId: bundle.oneTimePreKey?.keyId ?? null,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ratchet: initialRatchetState,
    };

    await this.sessions.saveSession(session);

    // 9. Construct X3DH initiation header for peer
    const initHeader: X3DHSessionInitHeader = {
      initiatorUserId: currentUserId,
      initiatorDeviceId: localDeviceId,
      initiatorIdentityKey: localIdentity.publicKey,
      ephemeralPublicKey: x3dhResult.ephemeralPublicKey,
      spkKeyId: bundle.signedPreKey.keyId,
      opkKeyId: bundle.oneTimePreKey?.keyId ?? null,
      sessionVersion: bundle.keyVersion,
      timestamp: now.toISOString(),
    };

    return { session, initHeader };
  }

  /**
   * Receiver Flow: Establishes an inbound E2EE session upon receiving an X3DH initiation header.
   */
  public async establishInboundSession(header: X3DHSessionInitHeader): Promise<E2EESessionState> {
    // 1. Validate header schema
    const validHeader = x3dhSessionInitHeaderSchema.parse(header);

    const sessionId = `${validHeader.initiatorUserId}:${validHeader.initiatorDeviceId}`;

    // 2. Idempotency: Return existing valid session if already established
    const existingSession = await this.sessions.getSession(sessionId);
    if (
      existingSession &&
      existingSession.status === 'ACTIVE' &&
      existingSession.peerIdentityKey === validHeader.initiatorIdentityKey &&
      !this.isSessionExpired(existingSession)
    ) {
      existingSession.lastActiveAt = new Date().toISOString();
      await this.sessions.saveSession(existingSession);
      return existingSession;
    }

    // 3. Retrieve local cryptographic keys
    const localIdentity = await this.keyStore.getIdentityKeyPair();
    if (!localIdentity) {
      throw new Error('Cannot establish inbound session: Local identity key missing');
    }

    const localSpk = await this.keyStore.getSignedPreKey();
    if (!localSpk) {
      throw new Error('Cannot establish inbound session: Local signed pre-key missing');
    }

    let localOpkPrivateKey: string | null = null;
    if (validHeader.opkKeyId !== null) {
      const localOpk = await this.keyStore.getOneTimePreKey(validHeader.opkKeyId);
      if (!localOpk) {
        throw new Error(
          `Cannot establish inbound session: One-Time Pre-Key (${validHeader.opkKeyId}) already consumed or expired`,
        );
      }
      localOpkPrivateKey = localOpk.privateKey;
    }

    // 4. Execute Signal X3DH receiver key agreement
    const x3dhResult = this.crypto.x3dhReceiver({
      receiverIdentityPrivateKey: localIdentity.privateKey,
      initiatorIdentityPublicKey: validHeader.initiatorIdentityKey,
      initiatorEphemeralPublicKey: validHeader.ephemeralPublicKey,
      receiverSignedPreKeyPrivateKey: localSpk.privateKey,
      receiverOneTimePreKeyPrivateKey: localOpkPrivateKey,
    });

    // 5. Consume one-time pre-key permanently to prevent reuse
    if (validHeader.opkKeyId !== null) {
      await this.keyStore.markOneTimePreKeyUsed(validHeader.opkKeyId);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // 6. Initialize Double Ratchet state for Receiver
    const initialRatchetState = this.ratchet.initRatchetAsReceiver(
      x3dhResult.sharedSecret,
      localSpk.privateKey,
      localSpk.publicKey,
    );

    // 7. Create and persist matching inbound session
    const session: E2EESessionState = {
      sessionId,
      peerUserId: validHeader.initiatorUserId,
      peerDeviceId: validHeader.initiatorDeviceId,
      peerIdentityKey: validHeader.initiatorIdentityKey,
      localIdentityKey: localIdentity.publicKey,
      role: 'receiver',
      sharedSecret: x3dhResult.sharedSecret,
      sessionVersion: validHeader.sessionVersion,
      status: 'ACTIVE',
      spkKeyId: validHeader.spkKeyId,
      opkKeyId: validHeader.opkKeyId,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ratchet: initialRatchetState,
    };

    await this.sessions.saveSession(session);

    return session;
  }

  /**
   * Encrypts a plaintext message for a peer device using Double Ratchet.
   */
  public async encryptMessage(
    peerUserId: string,
    peerDeviceId: string | undefined,
    plaintext: string,
    currentUserId = 'me',
  ): Promise<{
    payload: E2EEEncryptedPayload;
    isNewSession: boolean;
    initHeader?: X3DHSessionInitHeader;
  }> {
    let session = await this.sessions.getActiveSession(peerUserId, peerDeviceId);
    let isNewSession = false;
    let initHeader: X3DHSessionInitHeader | undefined;

    if (!session || !session.ratchet || this.isSessionExpired(session)) {
      const result = await this.getOrEstablishOutboundSession(
        peerUserId,
        peerDeviceId,
        currentUserId,
      );
      session = result.session;
      initHeader = result.initHeader;
      isNewSession = true;
    }

    if (!session.ratchet) {
      throw new Error('E2EE State Error: Ratchet state missing for active session');
    }

    // Encrypt payload using Double Ratchet
    const { header, ciphertext, updatedState } = this.ratchet.ratchetEncrypt(
      session.ratchet,
      plaintext,
    );

    // Persist updated ratchet counters and keys
    session.ratchet = updatedState;
    session.lastActiveAt = new Date().toISOString();
    await this.sessions.saveSession(session);

    const payload: E2EEEncryptedPayload = {
      version: 1,
      sessionId: session.sessionId,
      header,
      ciphertext,
      isPreKeyInit: isNewSession,
      initHeader: isNewSession ? initHeader : undefined,
    };

    return { payload, isNewSession, initHeader };
  }

  /**
   * Decrypts an incoming E2EE ciphertext message payload using Double Ratchet.
   */
  public async decryptMessage(
    senderUserId: string,
    senderDeviceId: string,
    payload: E2EEEncryptedPayload,
  ): Promise<string> {
    // 1. Validate payload schema
    const validPayload = e2eeEncryptedPayloadSchema.parse(payload);

    const sessionId = `${senderUserId}:${senderDeviceId}`;
    let session = await this.sessions.getSession(sessionId);

    // 2. If message carries X3DH init header and local session does not exist yet, establish inbound session
    if (
      (!session || session.status !== 'ACTIVE') &&
      validPayload.isPreKeyInit &&
      validPayload.initHeader
    ) {
      const headerToEstablish: X3DHSessionInitHeader = {
        ...validPayload.initHeader,
        initiatorUserId: senderUserId,
        initiatorDeviceId: senderDeviceId,
      };
      session = await this.establishInboundSession(headerToEstablish);
    }

    if (!session || session.status !== 'ACTIVE') {
      throw new Error(`Cannot decrypt message: No active session with ${sessionId}`);
    }

    if (!session.ratchet) {
      throw new Error(`Cannot decrypt message: Ratchet state missing for session ${sessionId}`);
    }

    // 3. Decrypt ciphertext and advance receiving ratchet
    const { plaintext, updatedState } = this.ratchet.ratchetDecrypt(
      session.ratchet,
      validPayload.header,
      validPayload.ciphertext,
    );

    // 4. Persist updated ratchet state (advances nr, prunes/records skipped keys)
    session.ratchet = updatedState;
    session.lastActiveAt = new Date().toISOString();
    await this.sessions.saveSession(session);

    return plaintext;
  }

  /**
   * Rotates an active session with a peer device by invalidating and establishing a fresh session.
   */
  public async rotateSession(
    peerUserId: string,
    peerDeviceId?: string,
  ): Promise<{ session: E2EESessionState; initHeader: X3DHSessionInitHeader }> {
    if (peerDeviceId) {
      await this.invalidateSession(peerUserId, peerDeviceId);
    }
    return this.getOrEstablishOutboundSession(peerUserId, peerDeviceId);
  }

  /**
   * Explicitly invalidates an active session with a peer device.
   */
  public async invalidateSession(peerUserId: string, peerDeviceId: string): Promise<void> {
    const sessionId = `${peerUserId}:${peerDeviceId}`;
    await this.sessions.invalidateSession(sessionId);
  }
}

export const sessionManagerService = new SessionManagerService();
