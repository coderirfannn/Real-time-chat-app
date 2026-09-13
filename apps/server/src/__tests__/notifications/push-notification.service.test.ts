import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pushNotificationService } from '../../services/push-notification.service.js';
import { DeviceController } from '../../controllers/device.controller.js';
import type { DeviceRepository } from '../../repositories/device.repository.js';
import type { Request, Response } from 'express';

describe('PushNotificationService & DeviceController Unit Tests', () => {
  describe('PushNotificationService', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('identifies valid and invalid Expo push tokens correctly', () => {
      expect(pushNotificationService.isExpoPushToken('ExponentPushToken[xxxxxxxxxxxx]')).toBe(true);
      expect(pushNotificationService.isExpoPushToken('ExpoPushToken[xxxxxxxxxxxx]')).toBe(true);
      expect(pushNotificationService.isExpoPushToken('FCM_RAW_TOKEN_12345')).toBe(false);
      expect(pushNotificationService.isExpoPushToken(null)).toBe(false);
      expect(pushNotificationService.isExpoPushToken(undefined)).toBe(false);
      expect(pushNotificationService.isExpoPushToken(123)).toBe(false);
    });

    it('filters invalid tokens and returns 0 sent when no valid tokens provided', async () => {
      const result = await pushNotificationService.sendPushNotifications(
        ['invalid_token', 'random_string'],
        {
          title: 'Test Title',
          body: 'Test Body',
        },
      );

      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it('dispatches push notifications to Expo Push API successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok', id: 'ticket_123' }],
        }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await pushNotificationService.sendPushNotifications(
        ['ExponentPushToken[sample_token_1]'],
        {
          title: 'Alice',
          body: 'Hello there!',
          data: { conversationId: 'conv_123' },
        },
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs?.[1]?.body as string);
      expect(requestBody[0].to).toBe('ExponentPushToken[sample_token_1]');
      expect(requestBody[0].title).toBe('Alice');
      expect(requestBody[0].body).toBe('Hello there!');
      expect(requestBody[0].channelId).toBe('chat_messages');
      expect(requestBody[0].data.conversationId).toBe('conv_123');
    });

    it('handles Expo Push API network failure gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await pushNotificationService.sendPushNotifications(
        ['ExponentPushToken[sample_token_1]'],
        {
          title: 'Alice',
          body: 'Hello!',
        },
      );

      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });
  });

  describe('DeviceController', () => {
    let mockDeviceRepo: Partial<DeviceRepository>;
    let controller: DeviceController;

    beforeEach(() => {
      mockDeviceRepo = {
        upsertDevice: vi.fn().mockResolvedValue(null),
      };
      controller = new DeviceController(mockDeviceRepo as DeviceRepository);
    });

    it('successfully registers push token for authenticated user', async () => {
      const req = {
        user: { id: 'user_123' },
        body: {
          pushToken: 'ExponentPushToken[valid_token_xyz]',
          platform: 'android',
          deviceId: 'my_android_phone',
        },
      } as unknown as Request<unknown, unknown, { pushToken: string; deviceId?: string; platform?: 'android' }>;

      const statusMock = vi.fn().mockReturnThis();
      const jsonMock = vi.fn();
      const res = {
        status: statusMock,
        json: jsonMock,
      } as unknown as Response;

      await controller.registerPushToken(req, res);

      expect(mockDeviceRepo.upsertDevice).toHaveBeenCalledWith({
        userId: 'user_123',
        deviceId: 'my_android_phone',
        platform: 'android',
        appVersion: '0.1.0',
        pushToken: 'ExponentPushToken[valid_token_xyz]',
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { registered: true },
        }),
      );
    });

    it('throws BadRequestError when pushToken is missing', async () => {
      const req = {
        user: { id: 'user_123' },
        body: {
          pushToken: '',
        },
      } as unknown as Request<unknown, unknown, { pushToken: string }>;

      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

      await expect(controller.registerPushToken(req, res)).rejects.toThrow(
        /pushToken is required/i,
      );
    });
  });
});
