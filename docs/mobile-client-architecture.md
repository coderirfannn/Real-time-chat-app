# ChatLock — Mobile & Web Client Architecture

This document details the client-side architecture of **ChatLock**, built with React Native 0.86, Expo SDK 57, and Expo Router for iOS, Android, and Web platforms.

---

## 1. Directory Structure & Screen Routing

ChatLock uses **Expo Router** file-based routing with strict separation between public auth routes, standard messaging routes, and the web-only admin control center:

```text
apps/mobile/app/
├── (auth)/                    # Public Authentication Group
│   ├── _layout.tsx            # Auth stack navigator configuration
│   ├── login.tsx              # Email/username login with biometrics
│   └── register.tsx           # User account registration
│
├── (main)/                    # Protected User Messaging Group
│   ├── _layout.tsx            # AppShell, bottom tabs & navigation rail
│   ├── index.tsx              # Conversation list, search, floating new chat
│   ├── chat/
│   │   └── [id].tsx           # Active chat interface & message list
│   └── settings.tsx           # Profile, biometrics, notifications, logout
│
├── admin/                     # Web-Only Administrative Control Center
│   ├── _layout.tsx            # Admin layout (redirects native apps to /(main))
│   ├── dashboard.tsx          # Real-time metrics pulse & system health
│   ├── users/
│   │   ├── index.tsx          # Paginated user management directory
│   │   └── [id].tsx           # Detailed user inspection & moderation
│   ├── reports.tsx            # Abuse moderation queue & resolution drawer
│   ├── groups.tsx             # Group chat moderation
│   ├── media.tsx              # Media asset inventory
│   ├── audit-logs.tsx         # Tamper-evident audit trail viewer
│   └── settings.tsx           # Platform runtime configuration
│
├── download.tsx               # Public download portal (APK, Play Store, Web)
├── index.tsx                  # Root redirection guard
└── _layout.tsx                # Root layout, theme provider, TanStack Query client
```

---

## 2. State Management Architecture

```
                                  +---------------------------------------+
                                  |         TanStack Query v5             |
                                  | - Server State & Async Cache          |
                                  | - Conversations query & pagination    |
                                  | - Message feed cache & reconciliation |
                                  | - Admin metrics & user lists          |
                                  +-------------------+-------------------+
                                                      |
                    +---------------------------------+---------------------------------+
                    |                                 |                                 |
                    v                                 v                                 v
+---------------------------------------+ +-----------------------------------+ +-----------------------------------+
|              authStore                | |         notificationStore         | |            socketStore            |
| (Zustand 5)                           | | (Zustand 5)                       | | (Zustand 5)                       |
| - User profile & JWT tokens           | | - Unread badge counts             | | - Connection status (connected,   |
| - Session hydration & logout          | | - In-app banner notifications     | |   connecting, disconnected)       |
| - Persistent hardware device UUID     | | - OS launcher badge count sync    | | - Real-time ping latency          |
+---------------------------------------+ +-----------------------------------+ +-----------------------------------+
```

---

## 3. 0ms Optimistic Messaging Pipeline

ChatLock achieves zero perceptible latency on send via an instant optimistic pipeline:

```
[ User Presses Send ]
        |
        +---> 1. Inject message immediately into local React Query cache (status: 'sending') [0ms Delay]
        |
        +---> 2. Encrypt plaintext payload into Double Ratchet ciphertext locally
        |
        +---> 3. Enqueue ciphertext into persistent encrypted Outbox Queue
        |
        +---> 4. Dispatch `message:send` via Socket.IO in non-blocking background task
        |
        +---> 5. On server ACK (`message:sent`), mutate status: 'sent' (✓)
```

---

## 4. Offline Outbox & Network Resilience Engine

The Outbox Subsystem (`apps/mobile/src/services/outbox`) provides guaranteed message delivery across transient network drops:

1. **Persistent Encrypted Storage**: Outbox queue (`chatlock_persistent_outbox_v1`) is serialized to device storage. Messages survive app termination and device reboots.
2. **Exponential Backoff with Jitter**: When connection drops, retries follow $T_{wait} = \min(30000, 1000 \times 2^{attempt}) \pm \text{jitter}$.
3. **Idempotency Guarantee**: Every message has a unique client-generated UUID (`clientMessageId`). If a message was persisted on the server during a dropped TCP ACK, the server acknowledges it idempotently on retry without duplicating the message.
4. **Lifecycle Reconnection**: When the app transitions from background to foreground, `useAppLifecycle` automatically triggers `outboxSyncManager.drainQueue()`.

---

## 5. Media Resolution & In-App Lightbox

### 5.1 Dynamic Media URL Resolution
When images or media uploaded from `localhost` or local web clients are viewed on physical mobile devices over a local network, `resolveMediaUrl(rawUrl)` in `apps/mobile/src/utils/media-url.ts` dynamically rewrites the origin to match the active mobile API host (`mobileConfig.apiUrl`).

### 5.2 In-App Media Lightbox Modal
`MediaPreviewModal.tsx` provides an in-app viewer with:
- Pinch-to-zoom and pan gestures
- Full-screen high-contrast dark overlay
- Loading spinner and error retry fallback
- Prevents users from having to navigate outside to an external web browser.

---

## 6. Biometric Security & App Lock

Powered by `expo-local-authentication`:
1. **Hardware Authentication**: Supports Apple FaceID, TouchID, Android Biometric Prompt, and Device PIN fallback.
2. **Configurable Timeout Thresholds**: Immediate, 1 minute, 5 minutes, 15 minutes.
3. **AppLockModal**: High-security modal overlay rendered in the root layout that locks the interface upon returning from the background if the threshold has elapsed.

---

## 7. Cross-Platform SVG Icon Engine

To prevent Metro bundler conflicts between native `react-native-svg` and web DOM:
- **`Icon.tsx`**: Renders native SVG components on iOS and Android.
- **`Icon.web.tsx`**: Renders zero-dependency, semantic HTML `<svg>` elements on Web.
- Guarantees 0 bundler crashes across mobile, tablet, and web browsers.
