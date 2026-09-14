# BRAIN.md — ChatLock Platform Architecture & System Design

**Project**: ChatLock — Production-Grade Real-Time Messaging Platform  
**Version**: 0.24.0 (Background Push Notification Engine, Persistent Device UUID, 0ms Optimistic Messaging, Live Launcher Badge Synchronization, & EAS Android Production APK)  
**Status**: Production Industry-Grade Architecture, Fault-Tolerant Real-Time Pipeline, Multi-Node Cluster Ready, and Fully CI/CD Automated

---

## 1. System Vision & Architecture Overview

ChatLock is a secure, high-concurrency, real-time messaging platform built for cross-platform mobile and web clients with an Express + Socket.IO backend, MongoDB persistence, and Redis-backed state synchronization and caching.

### Key Architectural Pillars

1. **Strict Monorepo Separation**: Clear boundary between client apps (`apps/mobile`), server backends (`apps/server`), and shared logic (`packages/shared-types`, `packages/validation`, `packages/config`).
2. **Layered Backend Decoupling**: Unidirectional request flow (`controller -> service -> repository -> database`) preventing route pollution.
3. **Type Safety & Schema Integrity**: End-to-end TypeScript strict mode, Zod runtime validation, and shared contract types across client and server.
4. **Secret Isolation**: Guaranteed separation preventing backend credentials or private tokens from leaking into client bundles (`EXPO_PUBLIC_` filtering).
5. **Horizontal Multi-Node Scaling & Fault Tolerance**: Socket.IO `@socket.io/redis-adapter` for distributed cross-node message and presence broadcasting with zero-crash in-memory fallback during Redis unavailability.
6. **Zero-Trust Security & NoSQL Sanitization**: Global operator stripping (`$` and `.`) on all inputs, constant-time timing-attack mitigation on login, and sliding-window rate limiting on socket duplex events.
7. **Token Reuse Detection & Family Revocation**: OAuth2 RFC 6819 refresh token rotation with automatic theft detection and full user session invalidation.
8. **Offline-First Reliability**: Persistent encrypted outbox storage, exponential backoff retries with jitter, idempotency deduplication (`clientMessageId`), and lifecycle foreground reconciliation.
9. **Ephemeral Presence & Typing**: Zero database write heartbeats via Redis 60s TTL keys, durable `lastSeenAt` MongoDB persistence on disconnect, and ephemeral room-scoped typing indicators with auto-expiration.
10. **Monotonic Delivery & Read Receipts**: Strict unidirectional progression ($\text{sent} \to \text{delivered} \to \text{read}$), durable persistence in MongoDB `MessageReceipt`, multi-device synchronization, and duplicate-safe idempotent updates.
11. **Live Global Sync & Dual-Room Broadcasting**: Dual broadcasting to `conversation:{id}` and `user:{participantId}` rooms with automatic socket deduplication, ensuring inactive/backgrounded users and conversation list screens update immediately with live preview snippets and unread badges.
12. **Persistent Emoji Reactions Subsystem**: Atomic database persistence in `Message.reactions`, bidirectional `message:reaction` Socket.IO events, optimistic client toggle, and live multi-peer sync.
13. **Figma E-Chat Design System Alignment**: Cohesive design language matching the E-Chat Figma UI kit across colors, typography, border treatments, bottom navigation pills, navigation rail, conversation items, chat headers, modal drag handles, and tinted badge containers.
14. **Cross-Platform SVG Icon Engine**: Zero-dependency semantic HTML `<svg>` rendering on web via `Icon.web.tsx` and native `react-native-svg` rendering on mobile via `Icon.tsx`, eliminating cross-platform bundling conflicts and runtime crashes.
15. **Biometric Security & App Lock**: `expo-local-authentication` integration with background timeout auto-lock, device PIN/biometric challenge, and secure session management.
16. **Push Notification Infrastructure**: `expo-notifications` integration, device token registration, notification permissions, foreground banners, and background notification routing.
17. **Dynamic Viewport & Mobile Keyboard Ergonomics**: Clamped visual viewport (`100dvh`, `visualViewport.height`), flexbox shrink optimization (`minHeight: 0`), dynamic multi-line composer auto-expansion (`38px -> 120px`) with native layout animation, and zero duplicate navigation headers across all stack screens.
18. **Modernized CI/CD & Automated Quality Gates**: GitHub Actions pipeline on Node.js 22 + pnpm 11, topological build ordering, Prettier code style validation, zero ESLint warnings, 0 TypeScript errors, and 384 automated tests passing across 75 test files.
19. **Cloudinary Cloud Storage Engine**: Enterprise-grade cloud asset storage with SHA-256 HMAC upload signing, binary magic byte integrity enforcement, high-throughput streaming buffer uploads via Cloudinary v2 SDK, secure CDN media distribution, and automatic cloud asset invalidation/deletion.
20. **Background Push Notification & Native Badge Lifecycle**: Resilient push notification pipeline via Expo Push Service and FCM. Hardware device UUID persistence in `expo-secure-store`, reactive device push token registration upon authentication and app resume, clean token deactivation on logout, automated cleanup of `DeviceNotRegistered` tokens, server-side unread message calculation in push payloads, and bi-directional native OS launcher icon badge synchronization.
21. **0ms Instant Optimistic UI Pipeline**: Immediate local message injection, query cache mutation, and non-blocking background queue synchronization, providing zero perceptible latency on send with parallelized database operations.

---

## 2. Monorepo Structure

```text
ChatLock/
├── apps/
│   ├── mobile/             # React Native (Expo SDK 54+) cross-platform client (iOS, Android, Web)
│   │   ├── app/            # Expo Router file-based routing ((auth), (main), chat/[id], settings)
│   │   ├── src/
│   │   │   ├── components/ # Reusable UI components
│   │   │   │   ├── layout/ # AppShell, AppHeader, BottomTabBar, NavigationRail
│   │   │   │   ├── security/ # AppLockModal (biometric protection)
│   │   │   │   ├── ui/     # Button, Card, Icon (native), Icon.web, IconButton, Input, SearchInput
│   │   │   │   └── ...     # Avatar, Badge, ConnectionBanner, EmptyState, Skeletons
│   │   │   ├── features/   # Domain features (chat, message list, bubble, composer, reactions)
│   │   │   ├── hooks/      # Lifecycle, notification listeners, chat hooks
│   │   │   ├── services/   # ApiClient, SocketManager, OutboxService, Biometrics, Notifications
│   │   │   ├── store/      # Zustand auth, client state, and notification stores
│   │   │   ├── theme/      # Colors, radius, shadows, spacing, typography tokens
│   │   │   └── utils/      # Message reconciler, grouper, date formatters
│   │   └── __tests__/      # Vitest test suites (148 tests across 29 files)
│   │
│   └── server/             # Node.js + Express + Socket.IO backend service
│       ├── controllers/    # HTTP request/response handlers (Auth, Conv, User, Health, Media)
│       ├── services/       # Domain business logic (Auth, Conversation, Message, Presence, Receipt, Media)
│       ├── repositories/   # Persistence layer (User, Conv, Message, MessageReceipt, Session, Device)
│       ├── database/       # MongoDB Atlas connection lifecycle management
│       ├── redis/          # Redis connection lifecycle management & fault tolerance
│       ├── socket/         # Socket.IO gateway, rooms, messaging, typing, presence, receipts, rate limiter
│       ├── middleware/     # Security, Request ID, sanitize, logging, validation, error handlers
│       ├── errors/         # Stable error codes and AppError hierarchy
│       └── utils/          # Structured logger, JWT tokens, async handler, password hashing
│
├── packages/
│   ├── shared-types/       # Canonical TypeScript domain types & API contracts
│   ├── validation/         # Reusable Zod validation schemas
│   └── config/             # Centralized environment parsing & validation
│
├── docs/
│   ├── architecture.md     # In-depth architectural blueprint & data flow
│   ├── deployment.md       # Staging & Production deployment runbooks
│   └── decisions/          # Architecture Decision Records (ADRs)
│
├── infrastructure/
│   └── docker/             # Local development Docker Compose (MongoDB, Redis)
│
├── scripts/                # Build, maintenance, and verification tooling
├── .github/workflows/      # Automated CI/CD pipeline (Node 22, pnpm 11, format, lint, typecheck, test)
├── BRAIN.md                # System design & roadmap single source of truth
└── README.md               # Quickstart and developer documentation
```

---

## 3. Technology Stack

| Layer                 | Technology                        | Purpose                                                |
| --------------------- | --------------------------------- | ------------------------------------------------------ |
| **Monorepo Manager**  | pnpm 11.24+ Workspaces            | Dependency isolation, workspace linking, fast caching  |
| **Language**          | TypeScript 5.7.3                  | Strict static typing across all apps and packages      |
| **Backend Engine**    | Node.js 22+ / Express 4.21+       | REST API gateway, layered routing, structured logging  |
| **Real-Time Gateway** | Socket.IO 4.8+ + Redis Adapter    | Distributed low-latency duplex bidirectional messaging |
| **Database**          | MongoDB Atlas / Mongoose 8+       | Primary document persistence & connection lifecycle    |
| **Cache & Ephemeral** | Redis 7.2 + ioredis 5+            | Session store, presence TTL keys, health checks        |
| **Mobile Client**     | React Native 0.86+ / Expo SDK 57+ | iOS & Android cross-platform client with Expo Router   |
| **State Management**  | Zustand 5+ & TanStack Query 5+    | Client UI state and asynchronous server state caching  |
| **Schema Validation** | Zod 3.24+                         | Runtime validation for envs, payloads, and API schemas |
| **Testing**           | Vitest 3+ & Supertest             | Fast unit, socket, and end-to-end integration testing  |
| **CI / CD**           | GitHub Actions (Ubuntu / Node 22) | Automated quality gates, build ordering, test runner   |

---

## 4. Centralized Environment System

The environment system strictly validates 13 distinct categories in `@chatlock/config`:

1. **Application**: `NODE_ENV`, `PORT`, `API_PREFIX`, `APP_NAME`, `CORS_ORIGIN`
2. **MongoDB**: `MONGODB_URI`, `MONGODB_DB_NAME`, `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE`
3. **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_URL`, `REDIS_KEY_PREFIX`, `REDIS_TLS`
4. **JWT**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
5. **Socket.IO**: `SOCKET_PORT`, `SOCKET_PATH`, `SOCKET_PING_TIMEOUT`, `SOCKET_PING_INTERVAL`, `SOCKET_CORS_ORIGIN`
6. **Rate Limiting**: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`
7. **Storage**: `STORAGE_DRIVER` (`local`, `s3`, `cloudinary`), `STORAGE_LOCAL_PATH`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
8. **Push Notifications**: `FCM_SERVER_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`
9. **Observability**: `SENTRY_DSN`, `ENABLE_TELEMETRY`, `METRICS_PORT`
10. **Security**: `BCRYPT_SALT_ROUNDS`, `SESSION_SECRET`, `HELMET_ENABLED`
11. **Logging**: `LOG_LEVEL`, `LOG_PRETTY`
12. **Jobs**: `BULL_REDIS_URL`, `JOB_CONCURRENCY`
13. **Feature Flags**: `ENABLE_VOICE_CALLS`, `ENABLE_END_TO_END_ENCRYPTION`, `ENABLE_MESSAGE_REACTIONS`

**Client Bundling Rules**: Only variables starting with `EXPO_PUBLIC_` are allowed in the mobile bundle. Backend secret keys (`MONGODB_URI`, `JWT_*`, `REDIS_PASSWORD`, etc.) are actively filtered and blocked from client bundles.

---

## 5. Development Roadmap & Completed Milestones

- [x] **Task 01 — Project Foundation**: Monorepo workspace, TypeScript strict mode, ESLint/Prettier, centralized Zod environment validation, shared packages, server skeleton, Expo mobile skeleton, Docker (MongoDB/Redis), CI workflow, and architecture documentation.
- [x] **Task 02 — Backend Core**: Layered Express architecture (`controller -> service -> repository -> database`), request IDs, structured logging, centralized error handling with stable error codes, `/health`, `/health/live`, `/health/ready` endpoints, MongoDB & Redis connection lifecycle management, and graceful shutdown.
- [x] **Task 03 — Database Domain Model**: MongoDB domain models (`User`, `Session`, `Conversation`, `Message`, `MessageReceipt`, `Device`), TTL indexing, direct conversation deduplication (`directKey`), message idempotency indexes, and decoupled repository layer.
- [x] **Task 04 — Production Authentication**: Bcrypt password hashing, JWT access tokens, revocable rotating refresh sessions (SHA-256 token hashes in MongoDB), `requireAuth`/`optionalAuth` authorization middleware, rate limiting, and `/api/v1/auth/*` endpoints.
- [x] **Task 05 — Conversation System**: Direct conversation management (`GET /api/v1/conversations`, `POST /api/v1/conversations`, `GET /api/v1/conversations/:id`), strict participant-only authorization, duplicate chat prevention (`directKey`), unread metadata, and cursor/page pagination.
- [x] **Task 06 — Socket.IO Infrastructure**: Cross-service real-time foundation, JWT handshake authentication, `ConnectionManager` tracking duplicate/concurrent sockets, `RoomManager` enforcing strict conversation authorization (`conversation:{conversationId}`), typed event contracts, mobile `SocketService`, and graceful disconnect/reconnect handling.
- [x] **Task 07 — Reliable Real-Time Messaging**: Real-time text messaging pipeline (`message:send`, `message:sent`, `message:new`), client message ID deduplication (`clientMessageId`), idempotency verification, zero-trust sender derivation, ACK callbacks, and room broadcasting.
- [x] **Task 08 — React Native Application Architecture**: Mobile client layered architecture (`Expo Router`, `Zustand` for client state, `TanStack Query` for server state, centralized `ApiClient` with transparent 401 token refresh mutex, `SecureStorageService` keychain abstraction, and centralized `SocketManager` singleton).
- [x] **Task 09 — Mobile Client UI & Chat Screens**: Production chat experience (`ConversationList` with live unread badges & snippets, virtualized `MessageList` with date separators & consecutive grouping, `MessageBubble` with delivery status, `MessageComposer` with auto-expanding input, `ConnectionBanner`, and optimistic messaging with single-tap retry).
- [x] **Task 10 — Message Synchronization**: Cursor-paginated message history synchronization (`GET /api/v1/conversations/:id/messages` with `before`/`after` cursors and `limit`), reverse virtualization list prepending, client reconciliation across network and Socket.IO races (`serverMessageId` and `clientMessageId` deduping).
- [x] **Task 11 — Offline-First Reliability**: Resilient message delivery across network drops (`online`, `offline`, `connecting`, `reconnecting`), persistent encrypted local outbox queue (`chatlock_persistent_outbox_v1`), controlled exponential backoff retry engine with jitter & max 5 retry cap, error classification (retryable vs non-retryable), and app lifecycle foreground/background restoration.
- [x] **Task 12 — Presence & Typing Indicators**: Redis ephemeral presence tracking (`presence:{userId}` key with 60s TTL), 25s client heartbeat loop refreshing TTL with zero database write overhead, durable MongoDB `lastSeenAt` & offline status update on connection disconnect, real-time typing indicators (`typing:start`, `typing:stop`) with 3s composer debounce and 4s auto-expiration.
- [x] **Task 13 — Delivery and Read Receipts**: Full monotonic receipt lifecycle ($\text{sent} \to \text{delivered} \to \text{read}$), real-time `message:delivered` and `message:read` Socket.IO events, durable `MessageReceipt` MongoDB persistence, multi-device synchronization, client automatic receipt dispatch on receive/read, and UI status indicator rendering (✓, ✓✓ grey, ✓✓ cyan).
- [x] **Task 14 — Production Hardening & Security Fortification**: Recursive NoSQL injection sanitization, token reuse detection with full session family revocation (RFC 6819), timing attack mitigation on authentication, Socket.IO duplex event rate limiting (max 40 ops/sec per socket), Socket.IO `@socket.io/redis-adapter` for multi-node cluster scaling, live global conversation list sync with unread badges, instant search filter, and User Profile & Security Settings management (`settings.tsx`, `PATCH /api/v1/users/me`, `POST /api/v1/auth/logout-all`).
- [x] **Task 15 — Media & File Attachments**: Enterprise-grade secure media messaging subsystem. Zero binary storage inside MongoDB (only validated metadata persisted), direct signed upload pipeline (`POST /api/v1/media/upload-url` issuing HMAC-signed descriptors with 15-minute expiration), binary magic bytes inspection (JPEG, PNG, GIF, WEBP, PDF, ZIP, MP4, MP3, WAV) preventing MIME spoofing, strict size boundaries (max 25MB), Local and S3 storage providers with path traversal defense, and resilient mobile UX with staging preview ribbon, thumbnail rendering, document descriptors, and non-blocking upload failure isolation.
- [x] **Task 16 — Production Behavior Alignment & Mobile Ergonomics Overhaul**: Alignment with real-world production messaging architectures (WhatsApp, Telegram, Signal):
  - **Persistent Emoji Reactions Pipeline**: Atomic `$pull`/`$push` operations in `MessageRepository.toggleReaction`, Mongoose schema with `reactions: [reactionSchema]`, bidirectional `SocketEvents.MESSAGE_REACTION` events, optimistic client rendering, and live multi-peer sync.
  - **Monotonic Receipt Initialization on Message Send**: Initialized `MessageReceipt` records on send, ensuring recipient unread counts increment monotonically and badges display accurately across all participants.
  - **Dual-Room Real-Time Broadcasting**: Broadcasts `message:new` concurrently to `conversation:{id}` and `user:{participantId}` with socket-level deduplication, ensuring inactive/backgrounded users and conversation list screens update immediately with live preview snippets.
  - **Dynamic Conversation List Sync**: Live updates to both `lastMessage` and `lastMessageId`, with query cache invalidation when a message arrives for an unseen conversation.
  - **Dynamic Viewport Clamping & Soft Keyboard Handling**: Clamped screen with `100dvh` and dynamic `window.visualViewport.height`, resolved flexbox child shrink (`minHeight: 0`), dynamic multi-line composer auto-expansion (`38px -> 120px`) with native layout animations, spring pulse on send, and focus stabilization.
  - **Header Cleanup**: Eliminated duplicate stacked navigation headers across all stack screens (`index`, `settings`, `chat/[id]`).
- [x] **Task 17 — Push Notifications Subsystem**: Mobile notification infrastructure using `expo-notifications`.
  - Permission negotiation and device push token registration (`NotificationService.registerForPushNotificationsAsync`).
  - Device token synchronization with backend `/api/v1/users/device-token`.
  - Notification state store (`NotificationStore`) with unread badge counter management.
  - Foreground notification banners with custom display options and background notification tap navigation.
  - Web platform compatibility shim (`notification.service.web.ts`) providing no-op fallbacks without crashing web builds.
- [x] **Task 18 — Biometric Security & App Lock**: Client-side application protection powered by `expo-local-authentication`.
  - Biometric hardware availability detection (FaceID, TouchID, Fingerprint, Iris, PIN).
  - Background timeout auto-lock with configurable grace periods (immediate, 1 min, 5 min, 15 min).
  - High-security `AppLockModal.tsx` overlay blocking screen interaction until verified.
  - Settings screen controls for enabling/disabling app lock and selecting timeout threshold.
- [x] **Task 19 — Figma E-Chat UI/UX Alignment**: Visual transformation aligning ChatLock with the reference E-Chat UI kit:
  - **Color Tokens**: Added semantic tokens (`navActive: #262A34`, `navActiveTint: rgba(36,107,253,0.12)`, `composerBg: #1F222A`, `inputBg: #1F222A`).
  - **Bottom Navigation**: Replaced active dot with a 56×30 rounded pill indicator behind the icon; increased tab bar height to 56px; applied hairline borders.
  - **Navigation Rail**: Replaced left-edge border stripe with a full rounded-rect pill row (`#262A34`); tightened item spacing to 4px; reduced rail width to 200px for expanded chat pane room.
  - **Conversation List**: Removed high-contrast item dividing lines in favor of pure 12px vertical spacing; tuned typography (name: 15px, snippet: 13px, time: 11px); added safe-area top inset; changed `+` button to secondary styling; added hairline separator below search.
  - **Chat Feed Header**: Converted back and more-vertical buttons from bordered dark circles into clean 44×44 transparent touch targets with 22px icons; tightened bottom padding to 10px; hairline bottom border.
  - **Settings Screen**: Converted ALL_CAPS section labels to Title Case; added dedicated 32px icon column per row (`smartphone`, `bell`, `volume-2`, `shield`, `logout`); humanized security alert dialogues.
  - **Auth Screens**: Enlarged logo badge from 64×64 to 72×72 (radius 22); increased vertical brand rhythm to 32px; refined heading sizes.
  - **Empty States & Modals**: Soft primary-tinted icon circle badge (`rgba(36,107,253,0.10)`, no border); added standard 36×4 rounded drag handle pill to bottom-sheet modals.
- [x] **Task 20 — Cross-Platform Icon System & Metro Dev Server Hardening**:
  - Split icon engine into platform-specific implementations: `Icon.web.tsx` using pure semantic HTML `<svg>` and `Icon.tsx` using native `react-native-svg`.
  - Solved Metro 500 bundler errors (`application/json` MIME type) by eliminating static `react-native-svg` imports from web builds.
  - Added Vitest mock stub for `react-native-svg` to ensure unit test suites run cleanly in Node environments without Babel transform issues.
  - Fixed Metro dev server cache invalidation across local network (LAN) requests on port 8081.
- [x] **Task 21 — CI/CD Pipeline Modernization & Quality Gates**:
  - Upgraded GitHub Actions workflow to Node.js 22 to satisfy pnpm 11's requirement for the native `node:sqlite` module.
  - Restructured pipeline execution order: `pnpm install` -> `pnpm build` -> `format:check` -> `lint` -> `typecheck` -> `test`.
  - Added project path fallbacks in `apps/mobile/tsconfig.json` for resilient source resolution of internal packages.
  - Enforced 100% Prettier compliance and resolved all TypeScript strict lint errors.
  - Total test count: **361 automated tests passing across 71 test files** (206 server tests + 148 mobile tests + 7 validation tests).
- [x] **Task 22 — Cloudinary Cloud Storage Integration**: First-class Cloudinary storage provider (`CloudinaryStorageProvider`) implementing `IStorageProvider`.
  - Added `'cloudinary'` to `STORAGE_DRIVERS` in `@chatlock/config` with runtime Zod schema parsing for `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
  - Integrated official `cloudinary` v2 SDK into `apps/server`.
  - Implemented cryptographic upload descriptor generation (`generateSignedUploadUrl`) with HMAC-SHA256 tokens and 15-minute expiration.
  - Implemented direct binary buffer streaming to Cloudinary via `cloudinary.v2.uploader.upload_stream` with automatic MIME-type magic-byte inspection.
  - Implemented public secure CDN delivery URL construction (`getPublicUrl`) and asset destruction (`deleteFile`).
  - Added transparent backward-compatible cloud redirect in `mediaController.serveLocalFile`.
  - Configured `.env.example` with storage driver schema and environment variable placeholders.
  - Comprehensive unit tests covering signed URLs, signature verification, buffer streaming, and deletion (7 tests in `cloudinary-storage.provider.test.ts`, plus dynamic driver selection in `media.service.test.ts`).
  - **Media Validation Hardening**: Resolved `VALIDATION_ERROR Invalid ObjectId format` during real-time media message dispatch by decoupling `messageAttachmentSchema.id` from MongoDB 24-hex `idSchema` to standard attachment ID strings (`att_<timestamp>_<hash>`), and enabling `replyToMessageId` to gracefully handle empty strings and nulls.
  - Added comprehensive validation tests in `packages/validation/src/__tests__/media-chat.test.ts`.
  - **Dynamic Media URL Resolution & In-App Media Lightbox**:
    - Created `resolveMediaUrl(rawUrl)` in `apps/mobile/src/utils/media-url.ts` to dynamically rewrite `localhost` and `127.0.0.1` URLs (produced by web clients) to the active mobile runtime API origin (`mobileConfig.apiUrl`), allowing images uploaded from web or server storage to render smoothly on mobile devices over LAN.
    - Created `MediaPreviewModal` in `apps/mobile/src/components/ui/MediaPreviewModal.tsx` providing a full-screen, in-app lightbox with zoom support, loading spinners, failure retry state, and dismiss button so users view images in-app without navigating outside to the device browser.
    - Integrated `MediaPreviewModal` and `resolveMediaUrl` into `MessageBubble.tsx` and `Avatar.tsx`.
- [x] **Task 23 — Production Deployment Preparation & Multi-Target Deployment Configuration**:
  - **Metro Monorepo Resolution Hardening**: Reconfigured `apps/mobile/tsconfig.json` path mappings to point to pre-compiled `dist` distributions of internal packages (`@chatlock/shared-types`, `@chatlock/validation`, `@chatlock/config`), resolving ESM relative `.js` import resolution failures in Metro bundler during web static exports.
  - **Zero-Secret Client Bundling & Subpath Export Isolation**: Introduced `@chatlock/config/mobile` subpath export isolating client environment validation from backend server schemas. Excluded `server-env.js`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, and default secret strings from mobile and web client bundles, reducing web bundle size by over 100KB. Added `CLOUDINARY_API_SECRET` to client leak guard (`dangerousKeys`).
  - **Secret Security Sanitization & Git Leak Defense**: Replaced test credentials in `cloudinary-storage.provider.test.ts` with mock strings and sanitized historical mentions. Hardened `.gitignore` with `.env*` wildcard patterns ensuring `.env.production` and `.env.staging` files can never be committed.
  - **Android & Google Play Readiness**: Added `versionCode: 1` and explicit permission boundaries to `apps/mobile/app.config.ts`, alongside config plugins for `expo-local-authentication` and `expo-image-picker`.
  - **Expo Application Services (EAS)**: Created `eas.json` across repository root and `apps/mobile` providing unified build profiles for `development`, `preview` (direct `.apk`), and `production` (Google Play `.aab`).
  - **Render Web Service Blueprint**: Created `render.yaml` Infrastructure-as-Code blueprint for Render Web Service (Node 22, `/health/ready` check, 0.0.0.0 binding, auto-deploy).
  - **Vercel Web App Deployment**: Created `vercel.json` with static SPA export configuration, `/index.html` fallback rewrites for deep linking, and CDN cache headers.
  - **Public Download Interface**: Built `/download` route (`apps/mobile/app/download.tsx`) providing cross-platform access points for Web App launch, Direct Android APK download, and Google Play Store listing.
- [x] **Task 24 — Standalone Android APK & Custom Branding Delivery**:
  - **Android Cold-Boot Layout Navigation Fix**: Addressed React Native Android screen stack crash on cold boot by keeping `<Stack>` permanently mounted in `apps/mobile/app/_layout.tsx` with an absolute `zIndex: 9999` loading overlay.
  - **Declarative Root Redirection**: Added `apps/mobile/app/index.tsx` preventing root navigation race conditions.
  - **Native Module Cleanup**: Eliminated incompatible `expo-av` module for React Native New Architecture compatibility; integrated `expo-system-ui`.
  - **Custom Speech Bubble Padlock Branding**: Programmed `scripts/generate_icons.py` using BFS flood fill to clean faux-transparency checkerboards from source artwork, producing 1024×1024 dark master icon (`icon.png`), transparent adaptive foreground (`adaptive-icon.png`), splash screen, and web favicon (`favicon.png`).
  - **EAS Cloud Build & Compilation**: Automated EAS cloud build workflows for standalone Android APK signing and generation.
- [x] **Task 25 — Background Push Notification Lifecycle, 0ms Optimistic Messaging & Launcher Icon Badge Synchronization**:
  - **Comprehensive System Audit**: Audited complete application stack covering notification handling, background state, unread state, device token registration, and app lifecycle.
  - **Persistent Hardware Device Identification**: Implemented `getDeviceId()` utilizing `expo-secure-store` to generate and persist a permanent unique hardware device UUID (`chatlock_device_uuid`), eliminating multi-user and multi-device database record collisions.
  - **Reactive Auth & Lifecycle Token Registration**: Integrated automatic push token registration with backend on login (`setSession`), session restore (`hydrateAuth`), and foreground resume (`useAppLifecycle.handleAppResume`).
  - **Device Token Deactivation & Ticket Cleanup**: Added `POST /api/v1/devices/push-token/deactivate` invoked cleanly on user logout (`useAuthStore.logout()`), and automated deactivation of `DeviceNotRegistered` tokens via Expo ticket parsing in `PushNotificationService`.
  - **Server-Side Total Unread Calculation**: Implemented `getTotalUnreadCountForUser` in `MessageReceiptRepository` and populated recipient-specific `badge: Math.max(1, unreadCount)` in push payloads.
  - **Bi-Directional Native OS Launcher Badge Synchronization**: Created `syncBadgeCount` and `clearBadge` in `NotificationService`, synchronizing live `totalUnreadCount` in `apps/mobile/app/(main)/_layout.tsx` to `Notifications.setBadgeCountAsync`.
  - **0ms Instant Optimistic Messaging**: Implemented immediate local message injection with status `'sending'` in `useChat.ts`, instant query cache mutation, and non-blocking background queue synchronization alongside concurrent database operations in `message.service.ts`.
  - **Standalone Android APK Release**: Published build `03473ff5-e4e1-4f70-9703-be25aee8ce9a` with live direct download link in `/download` web portal.
- [x] **Task 26 — Web-Only Admin Role & Control Center**:
  - **Strict Architectural Boundary (Web-Only Admin Platform)**:
    - Admin users have **no admin interface inside the mobile application**.
    - The React Native mobile app (`apps/mobile/app/(main)`) is strictly user-only (0 admin routes, 0 admin tabs in `BottomTabBar`, 0 admin items in `NavigationRail`, 0 admin buttons). Even accounts with `role: 'ADMIN'` see only the normal messaging interface on mobile.
    - Native mobile runtimes (`Platform.OS !== 'web'`) navigating to `/admin/*` are immediately redirected to `/(main)` via route guards in `apps/mobile/app/_layout.tsx` and `apps/mobile/app/admin/_layout.tsx`.
    - The Admin Control Center lives exclusively under `/admin/*` on web browsers with a responsive dark-mode UI (desktop, tablet, and mobile browser viewports).
    - Unauthenticated visitors are redirected to `/login`; non-admin authenticated users (`role !== 'ADMIN'`) are blocked with a dedicated 403 Access Denied screen.
  - **Single Source of Truth Server-Side RBAC**:
    - User schema extended with `role: 'USER' | 'ADMIN'` (default: `'USER'`) and `accountStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED'` (default: `'ACTIVE'`), indexed via `{ role: 1, accountStatus: 1 }`.
    - Client-supplied roles and statuses in registration, profile updates, query params, headers, and sockets are strictly ignored.
    - New registration always defaults to `role: 'USER'` and `accountStatus: 'ACTIVE'`.
    - Login and token refresh are immediately blocked for `SUSPENDED` and `BANNED` accounts with HTTP 403 Forbidden.
    - Socket authentication middleware terminates real-time connection if the account status is not `ACTIVE`.
    - Created `requireAdmin` Express middleware that performs live database verification against MongoDB to enforce admin privileges and active account status on all `/api/v1/admin/*` endpoints.
  - **Admin API Namespace (`/api/v1/admin/*`)**:
    - `GET /api/v1/admin/dashboard`: Live database metric aggregation (zero mock data) across users, messages, conversations, sessions, and pending reports.
    - `GET /api/v1/admin/users`: Paginated user list with full-text search (`q`), role filter (`role`), account status filter (`accountStatus`), and pagination metadata.
    - `GET /api/v1/admin/users/:id`: Detailed user profile with aggregated metrics (conversations, messages sent, active devices, report counts) and target-specific moderation history.
    - `PATCH /api/v1/admin/users/:id/suspend`: Account suspension with reason logging, session revocation, and offline status setting.
    - `PATCH /api/v1/admin/users/:id/unsuspend`: Account unsuspension with reason audit logging.
    - `PATCH /api/v1/admin/users/:id/ban`: Permanent account ban with session revocation, socket eviction, and audit log.
    - `PATCH /api/v1/admin/users/:id/unban`: Account unban restoring active status.
    - `GET /api/v1/admin/audit-logs`: Paginated tamper-evident audit trail with action filtering (`USER_SUSPENDED`, `USER_BANNED`, `USER_VIEWED`, etc.) and metadata masking.
    - `GET /api/v1/admin/reports`: Paginated queue for user reports (Task 28 foundation).
    - `GET /api/v1/admin/groups`: Paginated group chat moderation overview (Task 34 foundation).
    - `GET /api/v1/admin/media`: Paginated media attachment inventory (Task 35 foundation).
    - `GET /api/v1/admin/settings`: Safe read-only system telemetry and runtime configuration (secrets, keys, and credentials completely isolated).
  - **Audit Logging & Security Controls**:
    - Created `AuditLog` MongoDB schema and repository capturing `adminUserId`, `adminUsername`, `action`, `targetId`, `targetType`, `ipAddress`, `userAgent`, `requestId`, and `metadata`.
    - Prevents self-moderation (administrators cannot suspend or ban their own accounts).
    - Provided secure CLI provisioning script (`apps/server/src/scripts/provision-admin.ts`) via `pnpm run admin:promote <email|username>` or automated promotion via `ADMIN_BOOTSTRAP_EMAIL` on startup.
  - **Web Control Center UI (`apps/mobile/app/admin`)**:
    - `_layout.tsx`: Responsive layout with desktop sidebar, collapsible mobile menu, active tab pills, 403 error boundaries, and native platform redirection.
    - `dashboard.tsx`: Real-time system pulse, 4 metric overview cards, system health monitor, and live audit feed.
    - `users/index.tsx`: Paginated user directory with search bar, role chips, status filters, and suspend/ban modal dialogs with reason input.
    - `users/[id].tsx`: Deep inspection view displaying profile, communication statistics, account status badges, action controls, and complete moderation history.
    - `reports.tsx`: Reports management queue with status filters (Pending, Resolved, Dismissed).
    - `groups.tsx`: Group conversations moderation table displaying membership counts, admin counts, and activity timestamps.
    - `media.tsx`: Media asset registry displaying MIME types, file sizes, sender IDs, and upload timestamps.
    - `audit-logs.tsx`: Audit logs viewer with action filters, request IDs, IP addresses, and metadata inspection.
    - `settings.tsx`: Platform settings overview displaying environment runtime, rate limits, feature flags, uptime, and security bounds.
- [x] **Task 27-A — End-to-End Encryption (E2EE) Cryptographic Foundation**:
  - **Zero-Trust Server Boundary**: The server stores and distributes ONLY public cryptographic material and NEVER possesses, receives, or logs private keys (`identityKeyPair.privateKey`, `signedPreKey.privateKey`, `oneTimePreKeys[].privateKey`).
  - **Audited Cryptographic Primitives**: Utilizes `@noble/curves` (v2.4+) for pure TypeScript/JS audited Ed25519 (digital signatures) and X25519 (ECDH pre-keys), guaranteeing cross-platform compatibility across Node.js 22, React Native Hermes, and Web without native build friction.
  - **Device Identity & Persistent UUID**: Preserves existing persistent device UUID (`chatlock_device_uuid`) via `NotificationService.getDeviceId()`. Cryptographic identity is tied to `(userId, deviceId)`.
  - **Platform-Appropriate Secure Key Storage**:
    - Mobile (Native): Private keys persisted in native hardware Keychain / KeyStore via `expo-secure-store`, saving each OPK individually to respect Android 2KB Keystore value boundaries.
    - Web (Browser): Private keys stored in an isolated browser `IndexedDB` database (`chatlock_e2ee_keystore`), strictly isolated from `localStorage`, cookies, Redux/Zustand state, or URL parameters.
  - **Signed Pre-Key (SPK) Subsystem**: Client generates X25519 pre-key, signs it with the Ed25519 identity key, and uploads only the public portion with signature and expiration. Server cryptographically verifies the signature before persisting or rotating.
  - **One-Time Pre-Key (OPK) Pool & Atomic Consumption**: Pool of 50 one-time pre-keys uploaded to server. Server executes atomic `findOneAndUpdate` matching `oneTimePreKeys.consumed: false` and setting `consumed: true` with audit timestamps, guaranteeing zero double-spending under concurrent requests. If the pool is exhausted, the server gracefully returns `oneTimePreKey: null` following standard Signal X3DH fallback behavior.
  - **Pre-Key Replenishment & Signed Pre-Key Rotation**: Dedicated authenticated endpoints for batch OPK replenishment and SPK rotation with signature verification against the stored identity key.
  - **Device Lifecycle & Revocation**: Data model supports `ACTIVE` and `REVOKED` states, indexed via `{ userId: 1, deviceId: 1 }` (unique) and `{ userId: 1, status: 1 }`. Revoked devices are excluded from peer bundle lookups.
  - **REST API Endpoints (`/api/v1/e2ee/*`)**:
    - `POST /api/v1/e2ee/keys/register`: Registers device key bundle with signature verification.
    - `GET /api/v1/e2ee/keys/:userId`: Retrieves peer bundle and atomically claims one OPK.
    - `POST /api/v1/e2ee/prekeys/replenish`: Replenishes one-time pre-keys.
    - `POST /api/v1/e2ee/signed-prekey/rotate`: Rotates signed pre-key.
    - `GET /api/v1/e2ee/devices/me`: Returns device key status and unconsumed pre-key count.
    - `GET /api/v1/e2ee/users/:userId/devices`: Enumerates active user devices for future multi-device E2EE fan-out.
    - `PATCH /api/v1/e2ee/devices/:deviceId/revoke`: Revokes device cryptographic identity.
  > **Important Boundary Note**: Task 27-A establishes the E2EE cryptographic foundation. It does NOT yet provide complete end-to-end encrypted messaging (reserved for subsequent Tasks 27-B, 27-C, and 27-D).
- [x] **Task 27-B — End-to-End Encryption: Session Establishment (Signal X3DH Protocol)**:
  - **Zero-Trust Server Boundary**: The server acts strictly as a public key registry and untrusted message relay. The server NEVER possesses, derives, or receives shared secrets ($SK$), session states, ephemeral keys, or private keys.
  - **Audited X3DH Key Agreement Engine**:
    - Pure TypeScript/JS implementation utilizing `@noble/curves/ed25519.js` and `@noble/hashes`.
    - Leverages birational Montgomery conversion (`ed25519.utils.toMontgomerySecret` and `ed25519.utils.toMontgomery`) to convert Ed25519 Identity Keys into Curve25519 form for Diffie-Hellman operations without needing separate DH identity key pairs.
    - Computes 3-DH or 4-DH shared secret components:
      - $DH_1 = \text{ECDH}(IK_A, SPK_B)$
      - $DH_2 = \text{ECDH}(EK_A, IK_B)$
      - $DH_3 = \text{ECDH}(EK_A, SPK_B)$
      - $DH_4 = \text{ECDH}(EK_A, OPK_B)$ (when one-time pre-key is provided; graceful 3-DH fallback when pool depleted)
    - Derives 32-byte master shared secret ($SK$) via HKDF-SHA256 (`salt = 32-byte zero buffer`, `info = 'ChatLock-X3DH-v1'`).
  - **Session State & Versioning Contract (`E2EESessionState`)**:
    - Session tracking schema: `sessionId` (`${peerUserId}:${peerDeviceId}`), `version: 1`, `peerUserId`, `peerDeviceId`, `sharedSecret`, `role` (`'initiator' | 'receiver'`), `status` (`'ACTIVE' | 'EXPIRED' | 'INVALIDATED'`), `establishedAt`, `lastUsedAt`, `expiresAt` (30 days default), `ratchetState` stub (for Tasks 27-C/D).
    - Initial handshake metadata container (`X3DHSessionInitHeader`): `version`, `initiatorUserId`, `initiatorDeviceId`, `initiatorEphemeralKey`, `recipientDeviceId`, `signedPreKeyId`, `oneTimePreKeyId` (optional).
  - **Platform-Appropriate Secure Session Persistence (`SessionStore`)**:
    - Native Mobile (iOS/Android): Hardware Keychain / KeyStore via `expo-secure-store` with namespaced keys (`chatlock_e2ee_session_${sessionId}`).
    - Web (Browser): Isolated browser `IndexedDB` (`chatlock_e2ee_keystore`, object store `crypto_sessions`), completely isolated from `localStorage`, cookies, Redux/Zustand state, or URL parameters.
    - SSR / Unit Test Fallback: Isolated in-memory key-value store for non-browser and Node.js test execution.
  - **High-Level Session Coordination (`SessionManagerService`)**:
    - `getOrEstablishOutboundSession(peerUserId, peerDeviceId)`: Retrieves existing active session or executes X3DH initiation against peer public bundle, verifies peer SPK signature, generates ephemeral key, derives master secret, persists session, and packages handshake header.
    - `establishInboundSession(header)`: Idempotently processes inbound handshake header, validates against Zod schema, retrieves local SPK and OPK private keys from secure store, derives identical master secret, marks OPK consumed locally, and persists session.
    - `invalidateSession(peerUserId, peerDeviceId)` & `isSessionExpired(session)`: Lifecycle controls enabling secure teardown, key rotation, and session invalidation.
  - **Anti-Replay & Tamper Guarantees**:
    - Ephemeral key generation ensures every outbound handshake generates unique session secrets even with identical identity keys.
    - Local OPK consumption tracking prevents re-use of claimed one-time pre-keys.
    - Rejection of invalid/tampered signatures and revoked device bundles.
  > **Important Boundary Note**: Task 27-B implements the foundational X3DH session establishment. Full Double Ratchet symmetric and Diffie-Hellman ratcheting for message transport will be connected in Tasks 27-C and 27-D.
- [x] **Task 27-C — End-to-End Encryption: Double Ratchet Protocol & Out-of-Order Decryption**:
  - **Zero-Trust Server Relay**: The backend acts purely as an untrusted ciphertext forwarder. Message keys ($MK$), chain keys ($CK$), root keys ($RK$), and Diffie-Hellman ratchet private keys NEVER leave the local client device.
  - **Audited Cryptographic Engine (`@noble/ciphers` + `@noble/curves` + `@noble/hashes`)**:
    - **AEAD Message Encryption**: Utilizes `chacha20poly1305` from `@noble/ciphers/chacha.js` with deterministic 12-byte nonces derived via HKDF-SHA256 from $MK$ and message counter $n$.
    - **Header Authentication ($AAD$)**: Authenticates `{ ratchetKey, pn, n }` as Associated Authenticated Data ($AAD$), immediately defeating any packet tampering or counter forgery.
    - **Root KDF (`kdfRK`)**: Derives new 32-byte root key and 32-byte chain key using HKDF-SHA256 ($IKM = \text{ECDH}(DH_1, DH_2)$, $salt = RK$, $info = \text{'ChatLock-DoubleRatchet-Root-v1'}$).
    - **Chain KDF (`kdfCK`)**: Employs HMAC-SHA256 deriving $MK = \text{HMAC}(CK, \text{0x01})$ and advancing $CK_{next} = \text{HMAC}(CK, \text{0x02})$, delivering cryptographic forward secrecy.
  - **Diffie-Hellman Ratchet Steps**:
    - Generates fresh X25519 keypairs upon remote ratchet public key changes, advancing the root ratchet and deriving new sending/receiving chain keys.
    - Automatically supports bidirectional conversational ping-pong, multi-message bursts from a single sender, and multi-turn exchanges.
  - **Out-of-Order & Skipped Message Handling**:
    - Bounded skipped keys table (`RatchetState.skippedKeys`) with `MAX_SKIPPED_KEYS = 1000`, pruning expired keys past 14-day TTL.
    - DoS defense enforcing `MAX_SKIP = 2000` to prevent memory exhaustion from maliciously crafted counter gaps.
    - Single-use deletion: Skipped keys are immediately zeroized and removed from the table upon successful decryption, guaranteeing anti-replay protection.
  - **Anti-Replay Enforcement**:
    - Rejects duplicate messages whose counters are older than current chain progression.
    - Rejects replayed messages whose skipped keys have already been consumed.
  - **Session Lifecycle, Recovery & Rotation**:
    - Added `encryptMessage`, `decryptMessage`, and `rotateSession` to `SessionManagerService`.
    - Seamlessly derives inbound sessions when first pre-key message is received (`isPreKeyInit: true` and `initHeader`).
    - Full persistence of `RatchetState` across native `expo-secure-store` and web `IndexedDB` in `SessionStore`.
  - **Offline Outbox Compatibility**:
    - Extended `OutboxMessage` and `LocalMessage` with `isEncrypted?: boolean` and `e2eePayload?: E2EEEncryptedPayload`.
    - Supports queueing ciphertext offline, persisting to storage, and delivering/decrypting upon network reconnect.
- [x] **Task 27-D — Integrate E2EE Into Existing Messaging (Completed & Fully Verified)**:
  - **Zero-Plaintext Backend Architecture**:
    - Converted private message transport to true end-to-end encrypted ciphertext using Double Ratchet and X3DH session establishment.
    - Extended database model `MessageModel` and repository with `encryptionState: 'LEGACY_PLAINTEXT' | 'E2EE'`, `senderDeviceId`, and `e2eePayload?: E2EEEncryptedPayload`.
    - Server, MongoDB collections, Redis pub/sub, Socket.IO broadcasts, and application logs never receive, process, log, or store plaintext message bodies.
  - **Privacy-Preserving Push Notifications**:
    - Modified Socket.IO message event handlers (`message.events.ts`) so that any message with `encryptionState === 'E2EE'` or `e2eePayload` sets notification body strictly to `'🔒 New encrypted message'`.
    - Guarantees zero plaintext leakage to Apple Push Notification service (APNs), Firebase Cloud Messaging (FCM), or Expo push servers while maintaining accurate unread badge synchronization.
  - **Durable Offline Outbox & Network Reliability**:
    - Client `useChat` and `outboxSyncManager` store only ciphertext in persistent storage (`OutboxMessage.content`), encrypting before enqueue.
    - Network retries and offline queue draining dispatch pre-encrypted ciphertext, preventing redundant key ratcheting.
    - Preserves 0ms optimistic UI by displaying the sender's plaintext locally in memory without round-trip latency.
  - **Single-Use Key Safety & Decrypted Message Cache (`DecryptedCacheService`)**:
    - Built high-performance in-memory and durable cache keyed by `clientMessageId` and `serverMessageId`.
    - Prevents re-ratcheting already-consumed single-use message keys during upward cursor pagination, scroll re-renders, or screen focus.
    - Outbound sender messages are cached locally, ensuring the sender never attempts to decrypt their own ratchet steps.
  - **Graceful Failure Handling & Backward Compatibility**:
    - Distinguishes historical messages with `encryptionState: 'LEGACY_PLAINTEXT'` vs `'E2EE'`.
    - Any decryption error, missing session, or tampered MAC safely degrades to `'🔒 Encrypted message (unable to decrypt)'` with subtle italicized styling in `MessageBubble`, never throwing raw cryptographic exceptions to users.
    - Added lock badge indicator in `MessageBubble` metadata row for all E2EE messages.
- [x] **Task 28 — User Reporting & Abuse Moderation Pipeline**:
  - **Zero-Trust E2EE Protection**: The reporting and moderation pipeline strictly preserves End-to-End Encryption. The server never attempts to decrypt, inspect, store, or log plaintext message content. Reports capture only safe references (`reporterId`, `reportedUserId`, `targetType`, `targetId`, user-selected reason, and optional user description).
  - **Multi-Target Abuse Reporting**: Supports reporting across three distinct target types: `USER`, `MESSAGE`, and `CONVERSATION`, categorized by predefined reason codes (`HARASSMENT`, `SPAM`, `HATE_SPEECH`, `INAPPROPRIATE_CONTENT`, `IMPERSONATION`, `OTHER`).
  - **Complete Report Lifecycle State Machine**: Full report lifecycle with strict state progression: `OPEN` -> `UNDER_REVIEW` -> `DISMISSED` | `WARNED` | `SUSPENDED` | `BANNED`.
  - **Strict Reporter Anonymity**: Complete privacy protection for reporters. In-app warning notifications and push alerts dispatched to reported users explicitly state the moderation reason and policy action without revealing the reporter's identity or conversation context.
  - **Anti-Abuse Controls & Rate Limiting**:
    - Self-reporting prevention (400 Bad Request).
    - Active duplicate report prevention (409 Conflict for duplicate active reports from the same reporter against the same target).
    - Dedicated sliding-window rate limiter on report submission (`reportRateLimiter`: max 10 reports per 15-minute window per user).
  - **Real-Time Moderation Actions & Socket Eviction**:
    - Resolving reports with `SUSPENDED` or `BANNED` immediately revokes all active refresh sessions (`revokeAllUserSessions`) and evicts connected sockets (`evictUserSockets`), emitting an account error packet, terminating connections, and broadcasting offline presence.
    - Resolving reports with `WARNED` dispatches a real-time `user:warning` socket event and sends a background push notification to all registered user devices.
  - **Web-Only Admin Control Center Queue & Resolution Drawer**:
    - Filterable reports queue (`/admin/reports`) supporting status filters (`OPEN`, `UNDER_REVIEW`, `DISMISSED`, `RESOLVED`, `ALL`) and target type filters (`ALL`, `USER`, `MESSAGE`, `CONVERSATION`).
    - Sliding Inspection & Resolution Drawer displaying report details, safe metadata, reported user statistics, and moderation history.
    - Interactive resolution modal supporting `DISMISS`, `WARN`, `SUSPEND`, and `BAN` with mandatory audit rationale.
    - All admin actions strictly audited in tamper-evident `AuditLog` collection.
  - **Mobile User Reporting UX (`ReportModal.tsx`)**:
    - Dark-mode responsive bottom sheet / modal matching Figma E-Chat design language.
    - Seamlessly integrated into conversation options ("Report User") and message context options ("Report Message").
    - Privacy guarantee banner assuring users that reports are confidential and encryption is preserved.
- [ ] **Task 29 — Production Observability & Telemetry**: Sentry crash reporting integration, Prometheus metrics exporter, structured audit logging, and automated load testing.

---

## 6. Verification Status & Test Suite Matrix

```text
==================================================================================
CHATLOCK QUALITY & VERIFICATION MATRIX — 100% PASSING
==================================================================================
TypeScript Monorepo Typecheck:  ✅ 0 errors (all 5 workspace packages)
Prettier Formatting:            ✅ All files compliant (0 warnings)
ESLint Strict Linting:          ✅ 0 errors / 0 warnings across all packages
Server Vitest Test Suite:       ✅ 47 / 47 test files passed (270 / 270 tests)
Mobile Vitest Test Suite:       ✅ 43 / 43 test files passed (234 / 234 tests)
Validation Vitest Test Suite:   ✅ 3 / 3 test files passed (15 / 15 tests)
Shared-Types / Config:          ✅ 2 / 2 test files passed (6 / 6 tests)
Total Automated Tests:          ✅ 95 test files passed (525 / 525 tests)
Expo Web Static Bundler:        ✅ 200 OK (1.8 MB bundle, 1005 modules, 0 errors)
Metro Android Bundler (LAN):    ✅ 200 OK (8.7 MB bundle)
Metro iOS Bundler (LAN):        ✅ 200 OK (7.9 MB bundle)
Expo Go Manifest (LAN):         ✅ 200 OK (text/plain)
Backend Express Server:         ✅ 200 OK (/api/v1/health & /health/ready)
Production Render Backend:      ✅ 200 OK (https://chatlock-server.onrender.com)
Production Vercel Web App:      ✅ 200 OK (https://chatlock-web.vercel.app)
Production Download Portal:     ✅ 200 OK (https://chatlock-web.vercel.app/download)
Admin Control Center:           ✅ Web-Only (/admin/dashboard, guarded by requireAdmin)
Mobile App Separation:          ✅ Zero admin UI in mobile app; native redirects to /(main)
EAS Android APK Build (Preview): ✅ FINISHED (ID: 03473ff5-e4e1-4f70-9703-be25aee8ce9a)
Direct APK Artifact Download:   ✅ https://expo.dev/artifacts/eas/t0ctWlG9G9yhJPHOqn8KBWCQQ9RKyk5jdDJJB_2BmJQ.apk
MongoDB Atlas Connection:       ✅ Connected & Healthy (cluster: secureapp)
==================================================================================
```
