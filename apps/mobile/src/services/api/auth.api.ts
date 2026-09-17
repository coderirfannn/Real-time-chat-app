import { apiClient } from './client';
import type {
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  ChangePasswordInput,
} from '@chatlock/validation';
import type { AuthResponse, UserProfile } from '@chatlock/shared-types';

export class AuthApi {
  public async login(input: LoginInput): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', input, { skipAuth: true });
  }

  public async register(input: RegisterInput): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', input, { skipAuth: true });
  }

  public async refresh(input: RefreshTokenInput): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/refresh', input, { skipAuth: true });
  }

  public async getMe(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/auth/me');
  }

  public async changePassword(input: ChangePasswordInput): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>('/auth/change-password', input);
  }

  public async logout(refreshToken: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>('/auth/logout', { refreshToken });
  }

  public async logoutAll(): Promise<{ revokedSessionsCount: number }> {
    return apiClient.post<{ revokedSessionsCount: number }>('/auth/logout-all');
  }
}

export const authApi = new AuthApi();
