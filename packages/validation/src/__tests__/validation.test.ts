import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, sendMessageSchema } from '../index.js';

describe('Validation Schemas', () => {
  it('validates correct registration payload', () => {
    const valid = {
      email: 'user@example.com',
      username: 'john_doe',
      displayName: 'John Doe',
      password: 'SecurePassword123',
    };
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email in registration', () => {
    const invalid = {
      email: 'not-an-email',
      username: 'john_doe',
      displayName: 'John Doe',
      password: 'SecurePassword123',
    };
    const result = registerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates message payload', () => {
    const message = {
      conversationId: '507f1f77bcf86cd799439011',
      content: 'Hello World',
      type: 'text' as const,
    };
    const result = sendMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('validates login payload', () => {
    const login = {
      identifier: 'john_doe',
      password: 'mypassword',
    };
    const result = loginSchema.safeParse(login);
    expect(result.success).toBe(true);
  });
});
