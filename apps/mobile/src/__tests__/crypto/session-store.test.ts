import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../../services/crypto/session-store';
import type { E2EESessionState } from '@chatlock/shared-types';

describe('SessionStore Secure Client Storage', () => {
  let store: SessionStore;

  const mockSession: E2EESessionState = {
    sessionId: 'user_bob:dev_bob_1',
    peerUserId: 'user_bob',
    peerDeviceId: 'dev_bob_1',
    peerIdentityKey: 'peer_id_pub_key_32_bytes_base64_encoded==',
    localIdentityKey: 'local_id_pub_key_32_bytes_base64_encode=',
    role: 'initiator',
    sharedSecret: 'shared_secret_32_bytes_base64_encoded==',
    sessionVersion: 1,
    status: 'ACTIVE',
    spkKeyId: 1,
    opkKeyId: 1,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
  };

  beforeEach(async () => {
    store = new SessionStore();
    await store.clearAllSessions();
  });

  it('saves and retrieves an E2EE session state', async () => {
    expect(await store.getSession(mockSession.sessionId)).toBeNull();

    await store.saveSession(mockSession);
    const retrieved = await store.getSession(mockSession.sessionId);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.sessionId).toBe(mockSession.sessionId);
    expect(retrieved?.sharedSecret).toBe(mockSession.sharedSecret);
    expect(retrieved?.status).toBe('ACTIVE');
  });

  it('retrieves active session by peerUserId', async () => {
    await store.saveSession(mockSession);

    const active = await store.getActiveSession('user_bob', 'dev_bob_1');
    expect(active).not.toBeNull();
    expect(active?.peerUserId).toBe('user_bob');

    const activeWithoutDeviceId = await store.getActiveSession('user_bob');
    expect(activeWithoutDeviceId).not.toBeNull();
  });

  it('marks a session as INVALIDATED', async () => {
    await store.saveSession(mockSession);
    await store.invalidateSession(mockSession.sessionId);

    const retrieved = await store.getSession(mockSession.sessionId);
    expect(retrieved?.status).toBe('INVALIDATED');

    // Should no longer return from getActiveSession
    const active = await store.getActiveSession('user_bob', 'dev_bob_1');
    expect(active).toBeNull();
  });

  it('permanently deletes a session', async () => {
    await store.saveSession(mockSession);
    await store.deleteSession(mockSession.sessionId);

    expect(await store.getSession(mockSession.sessionId)).toBeNull();
    expect((await store.getAllSessions()).length).toBe(0);
  });

  it('clears all sessions cleanly', async () => {
    await store.saveSession(mockSession);
    await store.saveSession({
      ...mockSession,
      sessionId: 'user_carol:dev_carol_1',
      peerUserId: 'user_carol',
    });

    expect((await store.getAllSessions()).length).toBe(2);

    await store.clearAllSessions();

    expect((await store.getAllSessions()).length).toBe(0);
  });
});
