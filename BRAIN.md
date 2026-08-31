# BRAIN.md — ChatLock Platform Architecture & System Design

**Project**: ChatLock — Production-Grade Real-Time Messaging Platform  
**Version**: 0.14.0 (Task 13 — Delivery and Read Receipts Completed)  
**Status**: Production-Grade End-to-End Real-Time Receipts Subsystem Established

---

## 1. System Vision & Architecture Overview

ChatLock is a secure, high-concurrency, real-time messaging platform built for cross-platform mobile and web clients with an Express + Socket.IO backend, MongoDB persistence, and Redis-backed state synchronization and caching.

### Key Architectural Pillars

1. **Strict Monorepo Separation**: Clear boundary between client apps, server backends, and shared logic (`shared-types`, `validation`, `config`).
2. **Layered Backend Decoupling**: Unidirectional request flow (`controller -> service -> repository -> database`) preventing route pollution.
3. **Type Safety & Schema Integrity**: End-to-end TypeScript strict mode, Zod runtime validation, and shared contract types.
4. **Secret Isolation**: Guaranteed separation preventing backend credentials or private tokens from leaking into client bundles (`EXPO_PUBLIC_` filtering).
5. **Resilient Real-Time Event Pipeline**: Horizontal scaling with Redis Streams/Pub-Sub adapters for multi-node Socket.IO deployments.
6. **Offline-First Reliability**: Persistent outbox storage, exponential backoff retries with jitter, idempotency deduplication (`clientMessageId`), and lifecycle foreground reconciliation.
7. **Ephemeral Presence & Typing**: Zero database write heartbeats via Redis 60s TTL keys, durable `lastSeenAt` MongoDB persistence on disconnect, and ephemeral room-scoped typing indicators with auto-expiration.
8. **Monotonic Delivery & Read Receipts**: Strict unidirectional progression ($\text{sent} \to \text{delivered} \to \text{read}$), durable persistence in MongoDB `MessageReceipt`, multi-device synchronization, and duplicate-safe idempotent updates.
9. **Defense in Depth**: Zero-trust token rotation, rate limiting, helmet security headers, request ID correlation, and structured logging.

---

## 2. Monorepo Structure

```text
ChatLock/
├── apps/
│   ├── mobile/             # React Native (Expo SDK 54) cross-platform client
│   │   ├── app/            # Expo Router file-based routing ((auth), (main), chat/[id])
│   │   ├── src/
│   │   │   ├── components/ # Reusable UI components (Avatar, Badge, Banner, EmptyState)
│   │   │   ├── features/   # Domain features (chat, message list, bubble, composer)
│   │   │   ├── services/   # ApiClient, SocketManager, OutboxService, RetryEngine
│   │   │   ├── store/      # Zustand auth & client state stores
│   │   │   └── utils/      # Message reconciler, grouper, date formatters
│   │   └── __tests__/      # Vitest test suites (auth, chat, offline, presence, receipts)
│   │
│   └── server/             # Node.js + Express + Socket.IO backend service
│       ├── controllers/    # HTTP request/response handlers (Auth, Conv, User, Health)
│       ├── services/       # Domain business logic (Auth, Conversation, Message, Presence, Receipt)
│       ├── repositories/   # Decoupled persistence access layer (User, Conv, Message, MessageReceipt)
│       ├── database/       # MongoDB connection lifecycle management
│       ├── redis/          # Redis connection lifecycle management
│       ├── socket/         # Socket.IO gateway, connection, room, messaging, typing, presence, receipts
│       ├── middleware/     # Security, Request ID, logging, validation, error handlers
│       ├── errors/         # Stable error codes and AppError hierarchy
│       └── utils/          # Structured logger, JWT tokens, async handler
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
├── .github/workflows/      # Automated CI/CD pipelines
├── BRAIN.md                # System design & roadmap single source of truth
└── README.md               # Quickstart and developer documentation
```

---

## 3. Technology Stack

| Layer                 | Technology                        | Purpose                                                |
| --------------------- | --------------------------------- | ------------------------------------------------------ |
| **Monorepo Manager**  | pnpm 11+ Workspaces               | Dependency isolation, workspace linking, fast caching  |
| **Language**          | TypeScript 5.7+                   | Strict static typing across all apps and packages      |
| **Backend Engine**    | Node.js 20+ / Express 4.21+       | REST API gateway, layered routing, structured logging  |
| **Real-Time Gateway** | Socket.IO 4.8+                    | Low-latency duplex bidirectional messaging             |
| **Database**          | MongoDB 7.0 + Mongoose 8+         | Primary document persistence & connection lifecycle    |
| **Cache & Ephemeral** | Redis 7.2 + ioredis 5+            | Session store, presence TTL keys, health checks        |
| **Mobile Client**     | React Native 0.76+ / Expo SDK 54+ | iOS & Android cross-platform client with Expo Router   |
| **State Management**  | Zustand 5+ & TanStack Query 5+    | Client UI state and asynchronous server state caching  |
| **Schema Validation** | Zod 3.24+                         | Runtime validation for envs, payloads, and API schemas |
| **Testing**           | Vitest 3+ & Supertest             | Fast unit, socket, and end-to-end integration testing  |

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
- [ ] **Task 14 — Media & File Attachments**: Secure multi-part uploads, thumbnail generation, S3/local storage abstraction, progress tracking, and media message bubbles.
- [ ] **Task 15 — Push Notifications**: FCM & APNs integration, background delivery tokens in `Device` collection, notification badges, and offline payload delivery.
- [ ] **Task 16 — Security & End-to-End Encryption (E2EE)**: Pre-key bundles, Signal Protocol / Double Ratchet session management, encrypted payloads, and cryptographic audit.
- [ ] **Task 17 — Production Observability & Hardening**: Sentry crash reporting, Prometheus metrics, rate limiting calibration, Docker production images, and load testing.
