import { describe, it, expect, beforeEach, vi } from 'vitest';
import { userApi } from '../../services/api/user.api';
import { authApi } from '../../services/api/auth.api';
import { apiClient } from '../../services/api/client';

describe('Settings & Profile Flow Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. GET ME: retrieves authenticated user profile', async () => {
    const mockUser = {
      id: 'user_123',
      username: 'alice',
      displayName: 'Alice Liddell',
      email: 'alice@chatlock.dev',
      status: 'online',
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockUser as never);

    const user = await userApi.getMe();
    expect(user.displayName).toBe('Alice Liddell');
    expect(apiClient.get).toHaveBeenCalledWith('/users/me');
  });

  it('2. UPDATE PROFILE: patches user display name', async () => {
    const updatedUser = {
      id: 'user_123',
      username: 'alice',
      displayName: 'Alice Wonderland',
      email: 'alice@chatlock.dev',
      status: 'online',
    };

    vi.spyOn(apiClient, 'patch').mockResolvedValue(updatedUser as never);

    const res = await userApi.updateProfile({ displayName: 'Alice Wonderland' });
    expect(res.displayName).toBe('Alice Wonderland');
    expect(apiClient.patch).toHaveBeenCalledWith('/users/me', {
      displayName: 'Alice Wonderland',
    });
  });

  it('3. SEARCH USERS: queries users and returns array of UserProfile', async () => {
    const mockUsers = [
      { id: 'user_1', username: 'bob', displayName: 'Bob', status: 'online' },
      { id: 'user_2', username: 'charlie', displayName: 'Charlie', status: 'offline' },
    ];

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockUsers as never);

    const users = await userApi.searchUsers('bo');
    expect(users).toHaveLength(2);
    expect(users[0]?.username).toBe('bob');
    expect(apiClient.get).toHaveBeenCalledWith('/users/search', {
      params: { q: 'bo', limit: 20 },
    });
  });

  it('4. LOGOUT ALL: calls auth logout-all endpoint', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      message: 'All device sessions revoked successfully',
    } as never);

    const res = await authApi.logoutAll();
    expect(res.message).toBe('All device sessions revoked successfully');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout-all');
  });
});
