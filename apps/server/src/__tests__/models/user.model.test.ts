import { describe, it, expect } from 'vitest';
import { UserModel } from '../../models/user.model.js';

describe('User Model Schema & Validation', () => {
  it('validates a correct user document', () => {
    const user = new UserModel({
      email: 'Test.User@Example.Com',
      username: 'Test_User1',
      displayName: 'Test User',
      passwordHash: 'hashed_password_string_123',
    });

    const error = user.validateSync();
    expect(error).toBeUndefined();
    expect(user.email).toBe('test.user@example.com');
    expect(user.username).toBe('test_user1');
    expect(user.status).toBe('offline');
  });

  it('fails validation when required fields are missing', () => {
    const user = new UserModel({});
    const error = user.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors['email']).toBeDefined();
    expect(error?.errors['username']).toBeDefined();
    expect(error?.errors['displayName']).toBeDefined();
    expect(error?.errors['passwordHash']).toBeDefined();
  });

  it('fails validation on invalid username characters', () => {
    const user = new UserModel({
      email: 'user@example.com',
      username: 'invalid user with spaces!',
      displayName: 'User',
      passwordHash: 'hash123',
    });

    const error = user.validateSync();
    expect(error?.errors['username']).toBeDefined();
  });

  it('strips passwordHash on toJSON transformation', () => {
    const user = new UserModel({
      email: 'safe@example.com',
      username: 'safe_user',
      displayName: 'Safe User',
      passwordHash: 'super_secret_hash_not_exposed',
    });

    const json = user.toJSON();
    expect(json['passwordHash']).toBeUndefined();
    expect(json['__v']).toBeUndefined();
    expect(json['id']).toBeDefined();
  });
});
