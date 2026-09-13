import { logger } from '../utils/logger.js';

const pushLogger = logger.child('PushNotificationService');

export interface PushNotificationMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

export interface PushSendResult {
  sentCount: number;
  failedCount: number;
  tickets?: unknown[];
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_CHUNK_SIZE = 100;

export class PushNotificationService {
  private static instance: PushNotificationService | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Validates if string matches Expo push token pattern (ExponentPushToken[...] or ExpoPushToken[...])
   */
  public isExpoPushToken(token: unknown): boolean {
    return (
      typeof token === 'string' &&
      (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
    );
  }

  /**
   * Dispatches push notifications to an array of recipient push tokens in chunks of 100.
   * Execution is non-blocking to prevent adding latency to the real-time messaging pipeline.
   */
  public async sendPushNotifications(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      sound?: string;
      channelId?: string;
    },
  ): Promise<PushSendResult> {
    const validTokens = Array.from(new Set(tokens.filter((t) => this.isExpoPushToken(t))));

    if (validTokens.length === 0) {
      return { sentCount: 0, failedCount: 0 };
    }

    const messages: PushNotificationMessage[] = validTokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: payload.sound || 'default',
      channelId: payload.channelId || 'chat_messages',
      priority: 'high',
      data: payload.data,
    }));

    let totalSent = 0;
    let totalFailed = 0;

    // Process in batches of 100 (Expo API limit)
    for (let i = 0; i < messages.length; i += MAX_CHUNK_SIZE) {
      const chunk = messages.slice(i, i + MAX_CHUNK_SIZE);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          pushLogger.warn('Expo push endpoint responded with non-200 status', {
            status: response.status,
            error: errText,
          });
          totalFailed += chunk.length;
          continue;
        }

        const resData = (await response.json()) as { data?: Array<{ status: string; message?: string }> };
        const tickets = Array.isArray(resData?.data) ? resData.data : [];

        const okCount = tickets.filter((t) => t.status === 'ok').length;
        const errCount = tickets.length - okCount;

        totalSent += okCount;
        totalFailed += errCount;

        pushLogger.debug('Push notification batch delivered to Expo gateway', {
          batchSize: chunk.length,
          delivered: okCount,
          errors: errCount,
        });
      } catch (err) {
        pushLogger.warn('Failed to send push notification chunk to Expo API', {
          error: (err as Error).message,
        });
        totalFailed += chunk.length;
      }
    }

    return { sentCount: totalSent, failedCount: totalFailed };
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
