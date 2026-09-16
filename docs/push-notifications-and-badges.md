# ChatLock — Push Notifications & Native OS Badge Synchronization

This document details the background push notification infrastructure, device token lifecycle, hardware identification, and native launcher icon badge synchronization in **ChatLock**.

---

## 1. Notification Architecture Overview

```
                                  [ Outbound Message Event ]
                                              |
                                              v
                              +-------------------------------+
                              |    Socket.IO Event Handler    |
                              +---------------+---------------+
                                              |
                                              v
                             [ Check Recipient Socket Status ]
                                              |
                          +-------------------+-------------------+
                          |                                       |
                   [ Socket Online ]                      [ Socket Offline / Idle ]
                          |                                       |
                          v                                       v
             [ Stream Direct Socket Event ]            +-----------------------------------+
                                                       | Push Notification Dispatcher      |
                                                       | (`PushNotificationService`)       |
                                                       +-----------------+-----------------+
                                                                         |
                                                                         v
                                                       +-----------------------------------+
                                                       | Compute User Total Unread Count   |
                                                       | (`MessageReceiptRepository`)      |
                                                       +-----------------+-----------------+
                                                                         |
                                                                         v
                                                       +-----------------------------------+
                                                       | Construct Privacy-Preserved Body  |
                                                       | ("🔒 New encrypted message")      |
                                                       +-----------------+-----------------+
                                                                         |
                                                                         v
                                                       +-----------------------------------+
                                                       | Dispatch to Expo Push Service     |
                                                       | (APNs / FCM Gateway)              |
                                                       +-----------------+-----------------+
                                                                         |
                                                                         v
                                                       +-----------------------------------+
                                                       | Update Recipient OS App Badge     |
                                                       | (`badge: unreadCount`)            |
                                                       +-----------------------------------+
```

---

## 2. Persistent Hardware Device Identification

To avoid multi-user token collision on shared devices:
1. The client invokes `NotificationService.getDeviceId()`.
2. Checks `expo-secure-store` for an existing UUID under `chatlock_device_uuid`.
3. If not found, generates a fresh `crypto.randomUUID()` and saves it permanently to hardware secure storage.
4. All device registrations (`POST /api/v1/devices/push-token`) bind `(userId, deviceId)`.

---

## 3. Token Registration & Deactivation Lifecycle

### 3.1 Registration Triggers
Push tokens are registered and synchronized automatically:
- **Upon Login**: Triggered by `useAuthStore.setSession()`.
- **Upon App Hydration**: Triggered on startup by `useAuthStore.hydrateAuth()`.
- **Upon Foreground Resume**: Triggered when the app transitions from background to active via `useAppLifecycle.handleAppResume()`.

### 3.2 Token Deactivation on Logout
When a user logs out:
1. Client calls `POST /api/v1/devices/push-token/deactivate` with the `deviceId`.
2. The server marks the device as `isActive: false` and clears the `pushToken`.
3. Ensures that subsequent messages to other accounts on that device do not trigger notifications for the logged-out user.

### 3.3 Automated Cleanup of Dead Tokens
When the server sends push notifications through Expo Push API:
- The server inspects the returned delivery tickets.
- If a ticket returns error `DeviceNotRegistered`, the server immediately executes `DeviceRepository.deactivatePushToken(token)`.

---

## 4. Privacy-Preserving Push Payloads

For End-to-End Encrypted (E2EE) messages:
- **Zero Plaintext Leakage**: The push payload body is hardcoded to `'🔒 New encrypted message'`.
- Plaintext message contents are **never** transmitted to Expo Push servers, Apple Push Notification service (APNs), or Google Firebase Cloud Messaging (FCM).
- The payload includes the conversation ID and message ID in custom data fields for deep linking upon notification tap.

---

## 5. Bi-Directional Native OS Launcher Badge Synchronization

ChatLock keeps the app icon badge count in sync with real unread counts:

1. **Server-Side Push Badge**: Every push notification includes a computed `badge` field containing the recipient's total unread messages across all conversations (`getTotalUnreadCountForUser`).
2. **Client-Side Foreground Sync**: In `apps/mobile/app/(main)/_layout.tsx`, the client observes the aggregated unread count across all conversations in `TanStack Query` and updates the app launcher badge in real-time via `Notifications.setBadgeCountAsync(totalUnread)`.
3. **Badge Clear on Read**: When the user opens a conversation and reads all pending messages, `NotificationService.clearBadge()` resets the OS launcher badge count to zero.
