import { z } from 'zod';

/**
 * Calculates raw byte length of a Base64 string without creating buffer allocations.
 * Returns -1 if the string is not valid Base64.
 */
export function getBase64ByteLength(b64: string): number {
  if (typeof b64 !== 'string' || b64.length === 0) return -1;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return -1;
  if (b64.length % 4 !== 0) return -1;

  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;

  return (b64.length * 3) / 4 - padding;
}

export const base64PublicKeySchema = z
  .string({ required_error: 'Public key is required' })
  .trim()
  .refine((val) => getBase64ByteLength(val) === 32, {
    message: 'Public key must be a valid Base64-encoded 32-byte cryptographic key',
  });

export const base64SignatureSchema = z
  .string({ required_error: 'Signature is required' })
  .trim()
  .refine((val) => getBase64ByteLength(val) === 64, {
    message: 'Signature must be a valid Base64-encoded 64-byte Ed25519 signature',
  });

export const signedPreKeySchema = z.object({
  keyId: z.number().int().positive({ message: 'keyId must be a positive integer' }),
  publicKey: base64PublicKeySchema,
  signature: base64SignatureSchema,
  createdAt: z.string().datetime({ message: 'createdAt must be a valid ISO 8601 date string' }),
  expiresAt: z.string().datetime({ message: 'expiresAt must be a valid ISO 8601 date string' }),
});

export const oneTimePreKeySchema = z.object({
  keyId: z.number().int().positive({ message: 'keyId must be a positive integer' }),
  publicKey: base64PublicKeySchema,
});

export const registerKeyBundleSchema = z.object({
  deviceId: z
    .string({ required_error: 'deviceId is required' })
    .trim()
    .min(1, 'deviceId cannot be empty')
    .max(128, 'deviceId cannot exceed 128 characters'),
  identityKey: base64PublicKeySchema,
  signedPreKey: signedPreKeySchema,
  oneTimePreKeys: z
    .array(oneTimePreKeySchema)
    .min(1, 'At least 1 one-time pre-key must be provided')
    .max(100, 'Cannot upload more than 100 one-time pre-keys in a single batch'),
  keyVersion: z.number().int().positive().optional().default(1),
});

export const replenishPreKeysSchema = z.object({
  deviceId: z
    .string({ required_error: 'deviceId is required' })
    .trim()
    .min(1, 'deviceId cannot be empty')
    .max(128, 'deviceId cannot exceed 128 characters'),
  oneTimePreKeys: z
    .array(oneTimePreKeySchema)
    .min(1, 'At least 1 one-time pre-key must be provided')
    .max(100, 'Cannot replenish more than 100 one-time pre-keys in a single batch'),
});

export const rotateSignedPreKeySchema = z.object({
  deviceId: z
    .string({ required_error: 'deviceId is required' })
    .trim()
    .min(1, 'deviceId cannot be empty')
    .max(128, 'deviceId cannot exceed 128 characters'),
  signedPreKey: signedPreKeySchema,
});

export const x3dhSessionInitHeaderSchema = z.object({
  initiatorUserId: z.string().trim().min(1, 'initiatorUserId is required'),
  initiatorDeviceId: z.string().trim().min(1, 'initiatorDeviceId is required').max(128),
  initiatorIdentityKey: base64PublicKeySchema,
  ephemeralPublicKey: base64PublicKeySchema,
  spkKeyId: z.number().int().positive({ message: 'spkKeyId must be a positive integer' }),
  opkKeyId: z.number().int().positive().nullable(),
  sessionVersion: z.number().int().positive().default(1),
  timestamp: z.string().datetime({ message: 'timestamp must be a valid ISO 8601 date string' }),
});

export const doubleRatchetHeaderSchema = z.object({
  ratchetKey: base64PublicKeySchema,
  pn: z.number().int().nonnegative({ message: 'pn must be a non-negative integer' }),
  n: z.number().int().nonnegative({ message: 'n must be a non-negative integer' }),
});

export const e2eeEncryptedPayloadSchema = z.object({
  version: z.number().int().positive().default(1),
  sessionId: z.string().trim().min(1, 'sessionId is required'),
  header: doubleRatchetHeaderSchema,
  ciphertext: z.string().trim().min(1, 'ciphertext cannot be empty'),
  isPreKeyInit: z.boolean().optional(),
  initHeader: x3dhSessionInitHeaderSchema.optional(),
});

export type RegisterKeyBundleInput = z.infer<typeof registerKeyBundleSchema>;
export type ReplenishPreKeysInput = z.infer<typeof replenishPreKeysSchema>;
export type RotateSignedPreKeyInput = z.infer<typeof rotateSignedPreKeySchema>;
export type X3DHSessionInitHeaderInput = z.infer<typeof x3dhSessionInitHeaderSchema>;
export type DoubleRatchetHeaderInput = z.infer<typeof doubleRatchetHeaderSchema>;
export type E2EEEncryptedPayloadInput = z.infer<typeof e2eeEncryptedPayloadSchema>;
