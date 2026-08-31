import { mobileConfig } from '../../config/env';
import { secureStorage } from '../storage/secure-storage.service';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  skipAuth?: boolean;
  isRetry?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string = 'UNKNOWN_ERROR',
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor(
    baseUrl: string = mobileConfig?.apiUrl || 'http://localhost:5000/api/v1',
    defaultTimeout: number = 15000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeout = defaultTimeout;
  }

  public async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public async post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public async put<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public async patch<T>(
    endpoint: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  public async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      params,
      body,
      timeout = this.defaultTimeout,
      skipAuth = false,
      isRetry = false,
      headers: customHeaders = {},
      ...restOptions
    } = options;

    const url = this.buildUrl(endpoint, params);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Request-ID': this.generateRequestId(),
      ...(customHeaders as Record<string, string>),
    };

    if (!skipAuth) {
      const accessToken = await secureStorage.getItem('access_token');
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...restOptions,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized with token refresh mutex
      if (response.status === 401 && !skipAuth && !isRetry && !endpoint.includes('/auth/')) {
        const newAccessToken = await this.handleTokenRefresh();
        if (newAccessToken) {
          return this.request<T>(endpoint, {
            ...options,
            isRetry: true,
          });
        }
      }

      const responseText = await response.text();
      let responseData: ApiResponse<T> | null = null;

      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Non-JSON response
        }
      }

      if (!response.ok) {
        const rawBody = responseData as Record<string, unknown> | null;
        const errorCode =
          (typeof rawBody?.error === 'string'
            ? rawBody.error
            : (rawBody?.error as Record<string, unknown>)?.code) || `HTTP_${response.status}`;

        let errorMessage =
          (typeof rawBody?.message === 'string' ? rawBody.message : undefined) ||
          (typeof rawBody?.error === 'object' && rawBody?.error !== null
            ? (rawBody.error as Record<string, unknown>).message
            : undefined) ||
          response.statusText ||
          'Request failed';

        const details = rawBody?.details || (rawBody?.error as Record<string, unknown>)?.details;

        if (Array.isArray(details) && details.length > 0) {
          const detailMessages = details
            .map((d) => (typeof d === 'object' && d !== null ? (d.message as string) : String(d)))
            .filter(Boolean);
          if (detailMessages.length > 0) {
            errorMessage = detailMessages.join(', ');
          }
        }

        throw new ApiError(errorMessage as string, response.status, errorCode as string, details);
      }

      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        return responseData.data as T;
      }

      return (responseData as unknown as T) ?? ({} as T);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${timeout}ms`, 408, 'REQUEST_TIMEOUT');
      }

      throw new ApiError(err.message || 'Network request failed', 0, 'NETWORK_ERROR');
    }
  }

  private async handleTokenRefresh(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.refreshSubscribers.push((token) => resolve(token));
      });
    }

    this.isRefreshing = true;

    try {
      const refreshToken = await secureStorage.getItem('refresh_token');
      if (!refreshToken) {
        this.notifyRefreshSubscribers(null);
        return null;
      }

      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await secureStorage.removeItem('access_token');
        await secureStorage.removeItem('refresh_token');
        this.notifyRefreshSubscribers(null);
        return null;
      }

      const resText = await res.text();
      let data: {
        data?: { tokens?: { accessToken?: string; refreshToken?: string } };
        tokens?: { accessToken?: string; refreshToken?: string };
      } | null = null;
      try {
        data = JSON.parse(resText);
      } catch {
        // invalid json
      }
      const tokens = data?.data?.tokens || data?.tokens;

      if (tokens?.accessToken && tokens?.refreshToken) {
        await secureStorage.setItem('access_token', tokens.accessToken);
        await secureStorage.setItem('refresh_token', tokens.refreshToken);
        this.notifyRefreshSubscribers(tokens.accessToken);
        return tokens.accessToken;
      }

      this.notifyRefreshSubscribers(null);
      return null;
    } catch {
      this.notifyRefreshSubscribers(null);
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  private notifyRefreshSubscribers(token: string | null): void {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let fullUrl = `${this.baseUrl}${cleanEndpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    return fullUrl;
  }

  private generateRequestId(): string {
    return 'req_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }
}

export const apiClient = new ApiClient();
