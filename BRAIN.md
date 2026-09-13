# BRAIN.md — ChatLock Platform Architecture & System Design

**Project**: ChatLock — Production-Grade Real-Time Messaging Platform  
**Version**: 0.20.0 (Figma E-Chat Design System Alignment, Cross-Platform SVG Icon Engine, Biometric App Lock, Push Notifications, & Modernized CI/CD)  
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
18. **Modernized CI/CD & Automated Quality Gates**: GitHub Actions pipeline on Node.js 22 + pnpm 11, topological build ordering, Prettier code style validation, zero ESLint warnings, 0 TypeScript errors, and 346 automated tests passing across 68 test files.

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
7. **Storage**: `STORAGE_DRIVER`, `STORAGE_LOCAL_PATH`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
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
  - Total test count: **346 automated tests passing across 68 test files** (198 server tests + 148 mobile tests).
- [ ] **Task 22 — End-to-End Encryption (E2EE)**: Pre-key bundles, Signal Protocol / Double Ratchet session management, encrypted payload storage, and cryptographic key rotation.
- [ ] **Task 23 — Production Observability & Telemetry**: Sentry crash reporting integration, Prometheus metrics exporter, structured audit logging, and automated load testing.

---

## 6. Verification Status & Test Suite Matrix

```text
==================================================================================
CHATLOCK QUALITY & VERIFICATION MATRIX — 100% PASSING
==================================================================================
TypeScript Monorepo Typecheck:  ✅ 0 errors (all 5 workspace packages)
Prettier Formatting:            ✅ All files compliant
ESLint Strict Linting:          ✅ 0 errors / 0 warnings across all packages
Server Vitest Test Suite:       ✅ 39 / 39 test files passed (198 / 198 tests)
Mobile Vitest Test Suite:       ✅ 29 / 29 test files passed (148 / 148 tests)
Total Automated Tests:          ✅ 68 test files passed (346 / 346 tests)
Metro Web Bundler:              ✅ 200 OK (5.2 MB bundle)
Metro Android Bundler (LAN):    ✅ 200 OK (8.7 MB bundle)
Metro iOS Bundler (LAN):        ✅ 200 OK (7.9 MB bundle)
Expo Go Manifest (LAN):         ✅ 200 OK (text/plain)
Backend Express Server:         ✅ 200 OK (/api/v1/health)
MongoDB Atlas Connection:       ✅ Connected & Healthy
==================================================================================
```
