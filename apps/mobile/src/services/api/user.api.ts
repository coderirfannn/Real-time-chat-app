import { apiClient } from './client';
import type { ApiResponse, UserProfile } from '@chatlock/shared-types';

export class UserApi {
  /**
   * Searches for users by query string.
   */
  public async searchUsers(query: string = '', limit: number = 20): Promise<UserProfile[]> {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.append('q', query.trim());
    }
    params.append('limit', String(limit));

    const response = await apiClient.get<ApiResponse<UserProfile[]>>(
      `/users/search?${params.toString()}`,
    );

    return response.data || [];
  }

  /**
   * Retrieves a single user public profile.
   */
  public async getUserById(userId: string): Promise<UserProfile> {
    const response = await apiClient.get<ApiResponse<UserProfile>>(`/users/${userId}`);
    return response.data;
  }
}

export const userApi = new UserApi();
