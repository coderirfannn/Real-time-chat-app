import { apiClient } from './client';
import type { UserProfile } from '@chatlock/shared-types';

export class UserApi {
  /**
   * Searches for users by query string.
   */
  public async searchUsers(query: string = '', limit: number = 20): Promise<UserProfile[]> {
    const params: Record<string, string | number> = {
      limit,
    };
    if (query.trim()) {
      params['q'] = query.trim();
    }

    const response = await apiClient.get<UserProfile[]>('/users/search', { params });
    return Array.isArray(response) ? response : [];
  }

  /**
   * Retrieves a single user public profile.
   */
  public async getUserById(userId: string): Promise<UserProfile> {
    return apiClient.get<UserProfile>(`/users/${userId}`);
  }

  /**
   * Retrieves current authenticated user profile.
   */
  public async getMe(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/users/me');
  }

  /**
   * Updates current user profile details.
   */
  public async updateProfile(data: {
    displayName?: string;
    avatarUrl?: string | null;
    bio?: string;
  }): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/users/me', data);
  }
}

export const userApi = new UserApi();
