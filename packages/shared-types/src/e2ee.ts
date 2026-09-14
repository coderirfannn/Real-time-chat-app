export type DeviceE2EEStatus = 'ACTIVE' | 'REVOKED';

export interface SignedPreKeyDto {
  keyId: number;
  publicKey: string; // Base64 encoded 32-byte X25519 public key
  signature: string; // Base64 encoded 64-byte Ed25519 signature
  createdAt: string; // ISO 8601 string
  expiresAt: string; // ISO 8601 string
}

export interface OneTimePreKeyDto {
  keyId: number;
  publicKey: string; // Base64 encoded 32-byte X25519 public key
}

export interface DeviceKeyUploadPayload {
  deviceId: string;
  identityKey: string; // Base64 encoded 32-byte Ed25519 public key
  signedPreKey: SignedPreKeyDto;
  oneTimePreKeys: OneTimePreKeyDto[];
  keyVersion?: number;
}

export interface PublicDeviceKeyBundle {
  userId: string;
  deviceId: string;
  identityKey: string; // Base64 encoded 32-byte Ed25519 public key
  signedPreKey: SignedPreKeyDto;
  oneTimePreKey: OneTimePreKeyDto | null; // null if OPK pool depleted
  keyVersion: number;
  deviceStatus: DeviceE2EEStatus;
}

export interface ReplenishPreKeysPayload {
  deviceId: string;
  oneTimePreKeys: OneTimePreKeyDto[];
}

export interface RotateSignedPreKeyPayload {
  deviceId: string;
  signedPreKey: SignedPreKeyDto;
}

export interface DeviceKeyStatusResponse {
  deviceId: string;
  hasKeys: boolean;
  keyVersion: number;
  identityKey: string | null;
  signedPreKeyExpiresAt: string | null;
  unconsumedPreKeyCount: number;
  deviceStatus: DeviceE2EEStatus;
}

export interface UserDeviceSummary {
  deviceId: string;
  platform?: string;
  keyVersion: number;
  status: DeviceE2EEStatus;
  createdAt: string;
  lastRotatedAt?: string;
}

export type SessionRole = 'initiator' | 'receiver';
export type SessionStatus = 'ACTIVE' | 'EXPIRED' | 'INVALIDATED';

export interface E2EESessionState {
  sessionId: string; // `${peerUserId}:${peerDeviceId}`
  peerUserId: string;
  peerDeviceId: string;
  peerIdentityKey: string; // Base64 32-byte Ed25519 public key
  localIdentityKey: string; // Base64 32-byte Ed25519 public key
  role: SessionRole;
  sharedSecret: string; // Base64 32-byte shared secret (NEVER sent to server or logged)
  sessionVersion: number;
  status: SessionStatus;
  spkKeyId: number;
  opkKeyId: number | null;
  createdAt: string; // ISO 8601 string
  lastActiveAt: string; // ISO 8601 string
  expiresAt: string; // ISO 8601 string
  ratchet?: RatchetState;
}

export interface DoubleRatchetHeader {
  ratchetKey: string; // Base64 32-byte X25519 public key of sender's current ratchet
  pn: number; // Previous sending chain message count
  n: number; // Message index in current sending chain
}

export interface SkippedMessageKey {
  ratchetKey: string; // Base64 32-byte X25519 public key
  n: number; // Message counter
  messageKey: string; // Base64 32-byte message key
  createdAt: string; // ISO 8601 string
}

export interface RatchetState {
  dhsPrivateKey: string; // Base64 32-byte X25519 private key
  dhsPublicKey: string; // Base64 32-byte X25519 public key
  dhrPublicKey: string | null; // Base64 32-byte X25519 public key of peer (null until first message received)
  rootKey: string; // Base64 32-byte root key (RK)
  sendingChainKey: string | null; // Base64 32-byte sending chain key (CKs)
  receivingChainKey: string | null; // Base64 32-byte receiving chain key (CKr)
  ns: number; // Sending counter
  nr: number; // Receiving counter
  pn: number; // Previous sending chain message count
  skippedKeys: SkippedMessageKey[];
}

export interface E2EEEncryptedPayload {
  version: number; // Protocol version (1)
  sessionId: string; // `${peerUserId}:${peerDeviceId}`
  header: DoubleRatchetHeader;
  ciphertext: string; // Base64 encoded (ciphertext + Poly1305 authentication tag)
  isPreKeyInit?: boolean;
  initHeader?: X3DHSessionInitHeader;
}

export interface X3DHSessionInitHeader {
  initiatorUserId: string;
  initiatorDeviceId: string;
  initiatorIdentityKey: string; // Base64 32-byte Ed25519 public key
  ephemeralPublicKey: string; // Base64 32-byte X25519 public key
  spkKeyId: number;
  opkKeyId: number | null;
  sessionVersion: number;
  timestamp: string; // ISO 8601 string
}
