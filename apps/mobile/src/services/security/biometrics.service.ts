import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from '../storage/secure-storage.service';
import { Platform } from 'react-native';

const APP_LOCK_ENABLED_KEY = 'chatlock_biometric_lock_enabled';
const APP_LOCK_TIMEOUT_KEY = 'chatlock_biometric_lock_timeout_ms';

// Default grace period before requiring biometric re-authentication (5 minutes)
export const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  biometryType: 'Face ID' | 'Touch ID / Fingerprint' | 'Biometrics' | 'None';
}

export class BiometricsService {
  private static instance: BiometricsService | null = null;

  private constructor() {}

  public static getInstance(): BiometricsService {
    if (!BiometricsService.instance) {
      BiometricsService.instance = new BiometricsService();
    }
    return BiometricsService.instance;
  }

  /**
   * Checks whether the device supports biometric hardware and has enrollments.
   */
  public async getCapabilities(): Promise<BiometricCapability> {
    if (Platform.OS === 'web') {
      return {
        hasHardware: false,
        isEnrolled: false,
        biometryType: 'None',
      };
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometryType: BiometricCapability['biometryType'] = 'Biometrics';
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometryType = 'Face ID';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometryType = 'Touch ID / Fingerprint';
      } else if (!hasHardware || !isEnrolled) {
        biometryType = 'None';
      }

      return {
        hasHardware,
        isEnrolled,
        biometryType,
      };
    } catch {
      return {
        hasHardware: false,
        isEnrolled: false,
        biometryType: 'None',
      };
    }
  }

  /**
   * Checks whether the user enabled App Lock in settings (defaults to false).
   */
  public async isAppLockEnabled(): Promise<boolean> {
    try {
      const val = await secureStorage.getItem(APP_LOCK_ENABLED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Enables or disables App Lock in secure storage.
   */
  public async setAppLockEnabled(enabled: boolean): Promise<void> {
    await secureStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
  }

  /**
   * Gets the configured background timeout threshold in milliseconds.
   */
  public async getAppLockTimeout(): Promise<number> {
    try {
      const val = await secureStorage.getItem(APP_LOCK_TIMEOUT_KEY);
      if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
      return DEFAULT_LOCK_TIMEOUT_MS;
    } catch {
      return DEFAULT_LOCK_TIMEOUT_MS;
    }
  }

  /**
   * Sets the configured background timeout threshold in milliseconds.
   */
  public async setAppLockTimeout(timeoutMs: number): Promise<void> {
    await secureStorage.setItem(APP_LOCK_TIMEOUT_KEY, String(timeoutMs));
  }

  /**
   * Determines if the app should lock on resume based on background duration.
   * Prevents intrusive prompts when returning from system pickers or brief switches.
   */
  public async shouldLockOnResume(lastBackgroundTime: number | null): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    const enabled = await this.isAppLockEnabled();
    if (!enabled) return false;

    if (!lastBackgroundTime) {
      return true;
    }

    const timeout = await this.getAppLockTimeout();
    const elapsed = Date.now() - lastBackgroundTime;

    return elapsed >= timeout;
  }

  /**
   * Prompts the native biometrics or passcode challenge.
   */
  public async authenticate(promptMessage = 'Unlock ChatLock'): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (Platform.OS === 'web') {
      return { success: true };
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || 'Biometric authentication failed',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      return {
        success: false,
        error: message,
      };
    }
  }
}

export const biometricsService = BiometricsService.getInstance();
