export interface KeyPair {
  publicKey: string; // Base64 32 bytes
  privateKey: string; // Base64 32 bytes (NEVER leaves local device)
}

export interface SignedPreKeyPair {
  keyId: number;
  publicKey: string; // Base64 32 bytes X25519
  privateKey: string; // Base64 32 bytes X25519 (NEVER leaves local device)
  signature: string; // Base64 64 bytes Ed25519
  createdAt: string; // ISO 8601 string
  expiresAt: string; // ISO 8601 string
}

export interface OneTimePreKeyPair {
  keyId: number;
  publicKey: string; // Base64 32 bytes X25519
  privateKey: string; // Base64 32 bytes X25519 (NEVER leaves local device)
}

export interface DeviceCryptographicIdentity {
  deviceId: string;
  identityKeyPair: KeyPair;
  keyVersion: number;
  createdAt: string;
  lastRotatedAt?: string;
}

export interface X3DHInitiatorParams {
  initiatorIdentityPrivateKey: string; // Base64 32-byte Ed25519 private key
  recipientIdentityPublicKey: string; // Base64 32-byte Ed25519 public key
  recipientSignedPreKeyPublicKey: string; // Base64 32-byte X25519 public key
  recipientOneTimePreKeyPublicKey?: string | null; // Base64 32-byte X25519 public key (if available)
}

export interface X3DHInitiatorResult {
  sharedSecret: string; // Base64 32-byte derived master shared secret (SK)
  ephemeralPublicKey: string; // Base64 32-byte X25519 ephemeral public key (EK_A)
}

export interface X3DHReceiverParams {
  receiverIdentityPrivateKey: string; // Base64 32-byte Ed25519 private key
  initiatorIdentityPublicKey: string; // Base64 32-byte Ed25519 public key
  initiatorEphemeralPublicKey: string; // Base64 32-byte X25519 public key (EK_A)
  receiverSignedPreKeyPrivateKey: string; // Base64 32-byte X25519 private key
  receiverOneTimePreKeyPrivateKey?: string | null; // Base64 32-byte X25519 private key (if OPK was used)
}

export interface X3DHReceiverResult {
  sharedSecret: string; // Base64 32-byte derived master shared secret (SK)
}
