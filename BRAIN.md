# BRAIN.md — ChatLock Platform Architecture & System Design

**Project**: ChatLock — Production-Grade Real-Time Messaging Platform  
**Version**: 0.1.0 (Task 01 — Project Foundation)  
**Status**: Foundation Established

---

## 1. System Vision & Architecture Overview

ChatLock is a secure, high-concurrency, real-time messaging platform built for cross-platform mobile and web clients with an Express + Socket.IO backend, MongoDB persistence, and Redis-backed state synchronization and caching.

### Key Architectural Pillars

1. **Strict Monorepo Separation**: Clear boundary between client apps, server backends, and shared logic (`shared-types`, `validation`, `config`).
2. **Type Safety & Schema Integrity**: End-to-end TypeScript strict mode, Zod runtime validation, and shared contract types.
3. **Secret Isolation**: Guaranteed separation preventing backend credentials or private tokens from leaking into client bundles.
4. **Resilient Real-Time Event Pipeline**: Horizontal scaling with Redis Streams/Pub-Sub adapters for multi-node Socket.IO deployments.
5. **Defense in Depth**: Zero-trust token rotation, rate limiting, helmet security headers, and structured logging.

---

## 2. Monorepo Structure

```text
ChatLock/
├── apps/
│   ├── mobile/             # React Native + Expo client application
│   └── server/             # Node.js + Express + Socket.IO backend service
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
| **Backend Engine**    | Node.js 20+ / Express 4.21+   | REST API gateway and routing                           |
| **Real-Time Gateway** | Socket.IO 4+ (Planned)        | Low-latency duplex bidirectional messaging             |
| **Database**          | MongoDB 7.0 + Mongoose        | Primary document persistence                           |
| **Cache & Pub/Sub**   | Redis 7.2                     | Session store, rate limiting, Socket.IO adapter        |
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

- [x] **Task 01 — Project Foundation** (Current): Monorepo workspace, TypeScript strict mode, ESLint/Prettier, centralized Zod environment validation, shared packages, server skeleton, Expo mobile skeleton, Docker (MongoDB/Redis), CI workflow, and architecture documentation.
- [ ] **Task 02 — Authentication & Identity**: Secure user registration, bcrypt password hashing, JWT access/refresh token rotation, auth middleware.
- [ ] **Task 03 — Data Models & Storage**: Mongoose schemas for User, Conversation, Message, and indexes for optimized query performance.
- [ ] **Task 04 — Real-Time Engine & Socket.IO**: Socket.IO gateway, Redis adapter, room management, typing indicators, delivery/read receipts, presence.
- [ ] **Task 05 — Mobile Client UI & State**: React Native navigation, authentication flows, chat screens, optimistic UI updates, offline cache.
- [ ] **Task 06 — Media & Push Notifications**: Secure file/media uploads, background job queues, push notification delivery (FCM/APNs).
- [ ] **Task 07 — Security & Production Readiness**: End-to-end encryption prep, rate limiting, production Docker images, observability (Sentry/Prometheus).
