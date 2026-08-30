import type { Request, Response } from 'express';
import type { ApiResponse, AuthResponse, UserProfile } from '@chatlock/shared-types';
import type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  LogoutInput,
} from '@chatlock/validation';
import { authService, type AuthService } from '../services/auth.service.js';
import { UnauthorizedError } from '../errors/app-error.js';

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  public register = async (
    req: Request<unknown, unknown, RegisterInput>,
    res: Response<ApiResponse<AuthResponse>>,
  ): Promise<void> => {
    const result = await this.service.register(req.body);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public login = async (
    req: Request<unknown, unknown, LoginInput>,
    res: Response<ApiResponse<AuthResponse>>,
  ): Promise<void> => {
    const result = await this.service.login(req.body);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public refreshToken = async (
    req: Request<unknown, unknown, RefreshTokenInput>,
    res: Response<ApiResponse<AuthResponse>>,
  ): Promise<void> => {
    const result = await this.service.refreshToken(req.body.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Token rotated successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public logout = async (
    req: Request<unknown, unknown, LogoutInput>,
    res: Response<ApiResponse<{ success: boolean }>>,
  ): Promise<void> => {
    const result = await this.service.logout(req.body.refreshToken, req.user?.id);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public logoutAll = async (
    req: Request,
    res: Response<ApiResponse<{ revokedSessionsCount: number }>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await this.service.logoutAll(req.user.id);

    res.status(200).json({
      success: true,
      message: 'All device sessions revoked successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public getMe = async (req: Request, res: Response<ApiResponse<UserProfile>>): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await this.service.getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user,
      timestamp: new Date().toISOString(),
    });
  };
}

export const authController = new AuthController();
