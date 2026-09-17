import { Router, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import type { ApiResponse } from '@chatlock/shared-types';

const router: Router = Router();

interface ApiDocsEndpoint {
  method: string;
  path: string;
  authRequired: boolean;
  roleRequired?: string;
  description: string;
}

interface ApiDocsNamespace {
  namespace: string;
  prefix: string;
  description: string;
  endpoints: ApiDocsEndpoint[];
}

interface ApiDocsData {
  appName: string;
  version: string;
  environment: string;
  baseUrl: string;
  apiPrefix: string;
  namespaces: ApiDocsNamespace[];
  socketEvents: {
    clientToServer: Array<{ event: string; description: string }>;
    serverToClient: Array<{ event: string; description: string }>;
  };
}

router.get('/', (_req: Request, res: Response<ApiResponse<ApiDocsData>>) => {
  const docsData: ApiDocsData = {
    appName: config.app.appName,
    version: '0.1.0',
    environment: config.app.env,
    baseUrl: `http://localhost:${config.app.port}`,
    apiPrefix: config.app.apiPrefix,
    namespaces: [
      {
        namespace: 'Authentication',
        prefix: '/auth',
        description: 'User registration, login, token rotation, and session management',
        endpoints: [
          { method: 'POST', path: '/auth/register', authRequired: false, description: 'Register new account' },
          { method: 'POST', path: '/auth/login', authRequired: false, description: 'Authenticate user and issue tokens' },
          { method: 'POST', path: '/auth/refresh', authRequired: false, description: 'Rotate refresh token (RFC 6819)' },
          { method: 'POST', path: '/auth/logout', authRequired: false, description: 'Revoke single session' },
          { method: 'POST', path: '/auth/logout-all', authRequired: true, description: 'Revoke all active sessions' },
          { method: 'POST', path: '/auth/change-password', authRequired: true, description: 'Update user account password' },
          { method: 'GET', path: '/auth/me', authRequired: true, description: 'Retrieve authenticated user profile' },
        ],
      },
      {
        namespace: 'Users',
        prefix: '/users',
        description: 'User profile lookups and directory search',
        endpoints: [
          { method: 'GET', path: '/users/search', authRequired: true, description: 'Search users by query' },
          { method: 'GET', path: '/users/me', authRequired: true, description: 'Get full current user profile' },
          { method: 'PATCH', path: '/users/me', authRequired: true, description: 'Update profile details' },
          { method: 'GET', path: '/users/:id', authRequired: true, description: 'Get public profile by ID' },
        ],
      },
      {
        namespace: 'Conversations',
        prefix: '/conversations',
        description: '1-to-1 direct chats, group chats, and message feeds',
        endpoints: [
          { method: 'GET', path: '/conversations', authRequired: true, description: 'List conversations with unread counts' },
          { method: 'POST', path: '/conversations', authRequired: true, description: 'Create or find direct/group conversation' },
          { method: 'GET', path: '/conversations/:id', authRequired: true, description: 'Get conversation details' },
          { method: 'GET', path: '/conversations/:id/messages', authRequired: true, description: 'Cursor-paginated message history' },
        ],
      },
      {
        namespace: 'End-to-End Encryption',
        prefix: '/e2ee',
        description: 'Signal Protocol public key registry, pre-key claiming, and device management',
        endpoints: [
          { method: 'POST', path: '/e2ee/keys/register', authRequired: true, description: 'Register public identity and pre-keys' },
          { method: 'GET', path: '/e2ee/keys/:userId', authRequired: true, description: 'Fetch peer key bundle and claim OPK' },
          { method: 'POST', path: '/e2ee/prekeys/replenish', authRequired: true, description: 'Replenish batch of one-time pre-keys' },
          { method: 'POST', path: '/e2ee/signed-prekey/rotate', authRequired: true, description: 'Rotate signed pre-key' },
          { method: 'GET', path: '/e2ee/devices/me', authRequired: true, description: 'Check cryptographic device status' },
          { method: 'GET', path: '/e2ee/users/:userId/devices', authRequired: true, description: 'List active devices for user' },
          { method: 'PATCH', path: '/e2ee/devices/:deviceId/revoke', authRequired: true, description: 'Revoke cryptographic device' },
        ],
      },
      {
        namespace: 'Devices & Push',
        prefix: '/devices',
        description: 'Push notification token and hardware UUID binding',
        endpoints: [
          { method: 'POST', path: '/devices/push-token', authRequired: true, description: 'Register Expo push notification token' },
          { method: 'POST', path: '/devices/push-token/deactivate', authRequired: true, description: 'Deactivate push token on logout' },
        ],
      },
      {
        namespace: 'Media & Storage',
        prefix: '/media',
        description: 'Signed media upload authorization, buffer streaming, and inspection',
        endpoints: [
          { method: 'POST', path: '/media/upload-url', authRequired: true, description: 'Generate HMAC-signed upload descriptor' },
          { method: 'POST', path: '/media/upload', authRequired: true, description: 'Stream media upload with magic-byte check' },
          { method: 'GET', path: '/media/file/:key', authRequired: false, description: 'Serve local file or redirect to CDN' },
        ],
      },
      {
        namespace: 'Abuse Reports',
        prefix: '/reports',
        description: 'Privacy-preserving abuse reporting',
        endpoints: [
          { method: 'POST', path: '/reports', authRequired: true, description: 'Submit report against user/message/conversation' },
          { method: 'GET', path: '/reports/my-reports', authRequired: true, description: 'List submitted reports' },
        ],
      },
      {
        namespace: 'Admin Control Center',
        prefix: '/admin',
        description: 'Administrative platform management, metrics, and moderation',
        endpoints: [
          { method: 'GET', path: '/admin/dashboard', authRequired: true, roleRequired: 'ADMIN', description: 'Real-time database metrics' },
          { method: 'GET', path: '/admin/users', authRequired: true, roleRequired: 'ADMIN', description: 'Searchable users directory' },
          { method: 'GET', path: '/admin/users/:id', authRequired: true, roleRequired: 'ADMIN', description: 'Inspect user account details' },
          { method: 'PATCH', path: '/admin/users/:id/suspend', authRequired: true, roleRequired: 'ADMIN', description: 'Suspend user account' },
          { method: 'PATCH', path: '/admin/users/:id/unsuspend', authRequired: true, roleRequired: 'ADMIN', description: 'Unsuspend user account' },
          { method: 'PATCH', path: '/admin/users/:id/ban', authRequired: true, roleRequired: 'ADMIN', description: 'Ban user account' },
          { method: 'PATCH', path: '/admin/users/:id/unban', authRequired: true, roleRequired: 'ADMIN', description: 'Unban user account' },
          { method: 'GET', path: '/admin/reports', authRequired: true, roleRequired: 'ADMIN', description: 'Abuse triage queue' },
          { method: 'GET', path: '/admin/reports/:id', authRequired: true, roleRequired: 'ADMIN', description: 'Get report detail' },
          { method: 'POST', path: '/admin/reports/:id/resolve', authRequired: true, roleRequired: 'ADMIN', description: 'Resolve abuse report' },
          { method: 'GET', path: '/admin/groups', authRequired: true, roleRequired: 'ADMIN', description: 'Group chats overview' },
          { method: 'GET', path: '/admin/media', authRequired: true, roleRequired: 'ADMIN', description: 'Media assets inventory' },
          { method: 'GET', path: '/admin/audit-logs', authRequired: true, roleRequired: 'ADMIN', description: 'Audit trail log viewer' },
          { method: 'GET', path: '/admin/settings', authRequired: true, roleRequired: 'ADMIN', description: 'System configuration' },
          { method: 'GET', path: '/admin/metrics', authRequired: true, roleRequired: 'ADMIN', description: 'Telemetry metrics snapshot' },
        ],
      },
    ],
    socketEvents: {
      clientToServer: [
        { event: 'room:join', description: 'Join conversation room' },
        { event: 'room:leave', description: 'Leave conversation room' },
        { event: 'message:send', description: 'Transmit E2EE ciphertext or plaintext message' },
        { event: 'message:reaction', description: 'Toggle emoji reaction' },
        { event: 'message:delivered', description: 'Acknowledge message delivery' },
        { event: 'message:read', description: 'Acknowledge message read' },
        { event: 'typing:start', description: 'Signal user started typing' },
        { event: 'typing:stop', description: 'Signal user stopped typing' },
        { event: 'presence:heartbeat', description: 'Refresh Redis presence TTL' },
      ],
      serverToClient: [
        { event: 'message:new', description: 'Broadcast new message payload' },
        { event: 'message:sent', description: 'Acknowledge message persistence to sender' },
        { event: 'message:reaction', description: 'Broadcast updated reactions' },
        { event: 'message:delivered', description: 'Broadcast delivery receipt' },
        { event: 'message:read', description: 'Broadcast read receipt' },
        { event: 'typing:update', description: 'Broadcast typing state change' },
        { event: 'presence:update', description: 'Broadcast user online/offline status' },
        { event: 'user:warning', description: 'Deliver warning to user socket' },
        { event: 'account:evicted', description: 'Notify user of account suspension/ban' },
      ],
    },
  };

  res.status(200).json({
    success: true,
    message: `${config.app.appName} REST & Real-Time API Documentation`,
    data: docsData,
    timestamp: new Date().toISOString(),
  });
});

export default router;
