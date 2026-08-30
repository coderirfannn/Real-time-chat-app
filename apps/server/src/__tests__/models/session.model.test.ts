import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { SessionModel } from '../../models/session.model.js';

describe('Session Model Schema & Validation', () => {
  it('validates a correct session document', () => {
    const session = new SessionModel({
      userId: new Types.ObjectId(),
      tokenHash: 'sha256_hash_token_string_abc',
      deviceId: 'device-mobile-uuid-1234',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const error = session.validateSync();
    expect(error).toBeUndefined();
    expect(session.revokedAt).toBeNull();
  });

  it('fails validation when required fields are missing', () => {
    const session = new SessionModel({});
    const error = session.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors['userId']).toBeDefined();
    expect(error?.errors['tokenHash']).toBeDefined();
    expect(error?.errors['deviceId']).toBeDefined();
    expect(error?.errors['expiresAt']).toBeDefined();
  });

  it('declares TTL index on expiresAt field', () => {
    const indexes = SessionModel.schema.indexes();
    const expiresAtIndex = indexes.find(
      (idx) => idx[0] && typeof idx[0] === 'object' && 'expiresAt' in idx[0],
    );
    expect(expiresAtIndex).toBeDefined();
  });
});
