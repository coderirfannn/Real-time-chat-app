import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authApi } from '../../services/api/auth.api';
import { userApi } from '../../services/api/user.api';
import { conversationApi } from '../../services/api/conversation.api';
import { useAuthStore } from '../../store/auth.store';
import { secureStorage } from '../../services/storage/secure-storage.service';
import type { AuthResponse, UserProfile, IConversation } from '@chatlock/shared-types';

describe('Mobile Auth Flow & User Search Integration Tests', () => {
  beforeEach(async () => {
    await secureStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    vi.restoreAllMocks();
  });

  const mockAuthResponse: AuthResponse = {
    user: {
      id: 'user_123',
      email: 'test@example.com',
      username: 'testuser',
      displayName: 'Test User',
      status: 'online',
    },
    tokens: {
      accessToken: 'mock_access_token_xyz',
      refreshToken: 'mock_refresh_token_abc',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  };

  it('1. LOGIN FLOW: persists session tokens and updates auth store state', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(mockAuthResponse);

    const res = await authApi.login({
      identifier: 'testuser',
      password: 'Password123',
    });

    await useAuthStore.getState().setSession(res);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('mock_access_token_xyz');
    expect(useAuthStore.getState().user?.displayName).toBe('Test User');

    const storedToken = await secureStorage.getItem('access_token');
    expect(storedToken).toBe('mock_access_token_xyz');
  });

  it('2. REGISTER FLOW: registers user and hydrates auth state', async () => {
    vi.spyOn(authApi, 'register').mockResolvedValue(mockAuthResponse);

    const res = await authApi.register({
      displayName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123',
    });

    await useAuthStore.getState().setSession(res);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.username).toBe('testuser');
  });

  it('3. USER SEARCH & DIRECT CHAT: searches contacts and creates direct chat', async () => {
    const mockUsers: UserProfile[] = [
      {
        id: 'user_bob',
        username: 'bob_smith',
        displayName: 'Bob Smith',
        status: 'online',
      },
    ];

    const mockConversation: IConversation = {
      id: 'conv_bob_direct',
      type: 'direct',
      participants: ['user_123', 'user_bob'],
      unreadCount: 0,
      createdAt: '2026-08-31T00:00:00Z',
      updatedAt: '2026-08-31T00:00:00Z',
    };

    vi.spyOn(userApi, 'searchUsers').mockResolvedValue(mockUsers);
    vi.spyOn(conversationApi, 'createDirectConversation').mockResolvedValue(mockConversation);

    const searchResults = await userApi.searchUsers('bob');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.username).toBe('bob_smith');

    const newChat = await conversationApi.createDirectConversation(searchResults[0]!.id);
    expect(newChat.id).toBe('conv_bob_direct');
  });

  it('4. LOGOUT FLOW: clears storage and resets auth state', async () => {
    await useAuthStore.getState().setSession(mockAuthResponse);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    vi.spyOn(authApi, 'logout').mockResolvedValue({ message: 'Logged out successfully' });
    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();

    const storedToken = await secureStorage.getItem('access_token');
    expect(storedToken).toBeNull();
  });

  it('5. VALIDATION ERROR HANDLING: ApiClient formats 422 validation detail messages', async () => {
    const errorBody = {
      success: false,
      statusCode: 422,
      error: 'VALIDATION_ERROR',
      message: 'Validation failed for request parameters',
      details: [
        {
          path: 'password',
          message: 'Password must contain at least one lowercase letter',
          code: 'invalid_string',
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: async () => JSON.stringify(errorBody),
    } as Response);

    await expect(
      authApi.register({
        displayName: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        password: 'PASSWORD123',
      }),
    ).rejects.toThrow('Password must contain at least one lowercase letter');
  });
});
