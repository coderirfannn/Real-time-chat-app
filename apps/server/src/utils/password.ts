import bcrypt from 'bcryptjs';
import { loadServerConfig } from '@chatlock/config';

/**
 * Hashes a plaintext password using bcrypt with salt rounds configured in the environment.
 */
export async function hashPassword(password: string): Promise<string> {
  const config = loadServerConfig();
  const saltRounds = config.security.bcryptSaltRounds || 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compares a plaintext password against a stored bcrypt hash in constant time.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}
