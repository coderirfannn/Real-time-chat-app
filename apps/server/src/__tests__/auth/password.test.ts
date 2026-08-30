import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../utils/password.js';

describe('Password Security Utility', () => {
  it('hashes a plaintext password into a bcrypt string', async () => {
    const plain = 'StrongP@ssw0rd!123';
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
  });

  it('successfully verifies the correct password against hash', async () => {
    const plain = 'ValidPassword123';
    const hash = await hashPassword(plain);

    const isMatch = await verifyPassword(plain, hash);
    expect(isMatch).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const plain = 'CorrectPassword123';
    const wrong = 'WrongPassword456';
    const hash = await hashPassword(plain);

    const isMatch = await verifyPassword(wrong, hash);
    expect(isMatch).toBe(false);
  });

  it('handles empty inputs safely without crashing', async () => {
    expect(await verifyPassword('', '')).toBe(false);
    expect(await verifyPassword('something', '')).toBe(false);
  });
});
