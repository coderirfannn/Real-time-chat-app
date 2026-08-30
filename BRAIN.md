# BRAIN.md — ChatLock Platform Architecture & System Design

**Project**: ChatLock — Production-Grade Real-Time Messaging Platform  
**Version**: 0.8.0 (Task 08 — React Native Application Architecture)  
**Status**: Mobile Application Architecture Established

---

## 1. System Vision & Architecture Overview

ChatLock is a secure, high-concurrency, real-time messaging platform built for cross-platform mobile and web clients with an Express + Socket.IO backend, MongoDB persistence, and Redis-backed state synchronization and caching.

### Key Architectural Pillars

1. **Strict Monorepo Separation**: Clear boundary between client apps, server backends, and shared logic (`shared-types`, `validation`, `config`).
2. **Layered Backend Decoupling**: Unidirectional request flow (`controller -> service -> repository -> database`) preventing route pollution.
3. **Type Safety & Schema Integrity**: End-to-end TypeScript strict mode, Zod runtime validation, and shared contract types.
4. **Secret Isolation**: Guaranteed separation preventing backend credentials or private tokens from leaking into client bundles.
5. **Resilient Real-Time Event Pipeline**: Horizontal scaling with Redis Streams/Pub-Sub adapters for multi-node Socket.IO deployments.
6. **Defense in Depth**: Zero-trust token rotation, rate limiting, helmet security headers, request ID correlation, and structured logging.

---

## 2. Monorepo Structure

```text
ChatLock/
├── apps/
│   ├── mobile/             # React Native + Expo client application
│   └── server/             # Node.js + Express + Socket.IO backend service
│       ├── controllers/    # HTTP request/response handlers
│       ├── services/       # Domain business logic
│       ├── repositories/   # Decoupled persistence access layer
│       ├── database/       # MongoDB connection lifecycle management
│       ├── redis/          # Redis connection lifecycle management
│       ├── middleware/     # Security, Request ID, logging, validation, errors
│       ├── errors/         # Stable error codes and AppError hierarchy
│       └── utils/          # Structured logger, async handler
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

| Layer                 | Technology                    | Purpose                                                |
| --------------------- | ----------------------------- | ------------------------------------------------------ |
| **Monorepo Manager**  | pnpm 11+ Workspaces           | Dependency isolation, workspace linking, fast caching  |
| **Language**          | TypeScript 5.7+               | Strict static typing across all apps and packages      |
| **Backend Engine**    | Node.js 20+ / Express 4.21+   | REST API gateway, layered routing, structured logging  |
| **Real-Time Gateway** | Socket.IO 4+ (Planned)        | Low-latency duplex bidirectional messaging             |
| **Database**          | MongoDB 7.0 + Mongoose 8+     | Primary document persistence & connection lifecycle    |
| **Cache & Pub/Sub**   | Redis 7.2 + ioredis 5+        | Session store, state cache, pub/sub, health checks     |
| **Mobile Client**     | React Native 0.76+ / Expo 52+ | iOS & Android cross-platform client                    |
| **Schema Validation** | Zod 3.24+                     | Runtime validation for envs, payloads, and API schemas |
| **Testing**           | Vitest 3+ & Supertest         | Fast unit and integration testing                      |

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

## 5. Development Roadmap

- [x] **Task 01 — Project Foundation**: Monorepo workspace, TypeScript strict mode, ESLint/Prettier, centralized Zod environment validation, shared packages, server skeleton, Expo mobile skeleton, Docker (MongoDB/Redis), CI workflow, and architecture documentation.
- [x] **Task 02 — Backend Core**: Layered Express architecture (`controller -> service -> repository -> database`), request IDs, structured logging, centralized error handling with stable error codes, `/health`, `/health/live`, `/health/ready` endpoints, MongoDB & Redis connection lifecycle management, and graceful shutdown.
- [x] **Task 03 — Database Domain Model**: MongoDB domain models (`User`, `Session`, `Conversation`, `Message`, `MessageReceipt`, `Device`), TTL indexing, direct conversation deduplication (`directKey`), message idempotency indexes, and decoupled repository layer.
- [x] **Task 04 — Production Authentication**: Bcrypt password hashing, JWT access tokens, revocable rotating refresh sessions (SHA-256 token hashes in MongoDB), `requireAuth`/`optionalAuth` authorization middleware, rate limiting, and `/api/v1/auth/*` endpoints.
- [x] **Task 05 — Conversation System**: Direct conversation management (`GET /api/v1/conversations`, `POST /api/v1/conversations`, `GET /api/v1/conversations/:id`), strict participant-only authorization, duplicate chat prevention (`directKey`), unread metadata, and cursor/page pagination.
- [x] **Task 06 — Socket.IO Infrastructure**: Cross-service real-time foundation, JWT handshake authentication, `ConnectionManager` tracking duplicate/concurrent sockets, `RoomManager` enforcing strict conversation authorization (`conversation:{conversationId}`), typed event contracts, mobile `SocketService`, and graceful disconnect/reconnect handling.
- [x] **Task 07 — Reliable Real-Time Messaging**: Real-time text messaging pipeline (`message:send`, `message:sent`, `message:new`), client message ID deduplication (`clientMessageId`), idempotency verification, zero-trust sender derivation, ACK callbacks, and room broadcasting.
- [x] **Task 08 — React Native Application Architecture**: Mobile client layered architecture (`Expo Router`, `Zustand` for client state, `TanStack Query` for server state, centralized `ApiClient` with transparent 401 token refresh mutex, `SecureStorageService` keychain abstraction, and centralized `SocketManager` singleton).
- [ ] **Task 09 — Mobile Client UI & Chat Screens**: Authentication UI flows (login/register), conversation list with unread badges, real-time chat screen with optimistic updates, typing indicators, and delivery receipts.
- [ ] **Task 10 — Media & Push Notifications**: Secure file/media uploads, background job queues, push notification delivery (FCM/APNs).
- [ ] **Task 11 — Security & Production Readiness**: End-to-end encryption prep, rate limiting, production Docker images, observability (Sentry/Prometheus).
