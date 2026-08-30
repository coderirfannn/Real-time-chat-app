# ChatLock Architecture & System Design

This document details the architectural blueprint, data flow, communication model, and security isolation mechanisms for the **ChatLock** real-time messaging platform.

---

## 1. System Overview

```
                      +-----------------------------+
                      | React Native / Expo Client  |
                      |   (iOS, Android, Web)       |
                      +--------------+--------------+
                                     |
                         HTTPS / WSS |
                                     v
                 +-----------------------------------+
                 |      API Gateway / Load Balancer  |
                 +-----------------+-----------------+
                                   |
                +------------------+------------------+
                |                                     |
                v                                     v
+-------------------------------+   +-------------------------------+
|     Express HTTP Services     |   |      Socket.IO Real-Time      |
|  - Auth & User Management     |   |  - Bidirectional Events       |
|  - Conversation & Message REST|   |  - Typing & Presence Broadcast|
|  - Media Upload Handlers      |   |  - Read Receipts              |
+---------------+---------------+   +---------------+---------------+
                |                                   |
                |          +-------------+          |
                +--------> | Redis 7.2   | <--------+
                |          | - Pub/Sub   |          |
                |          | - Cache     |          |
                |          | - Sessions  |          |
                |          +-------------+          |
                |                                   |
                +--------> +-------------+ <--------+
                           | MongoDB 7.0 |
                           | - Users     |
                           | - Messages  |
                           | - Rooms     |
                           +-------------+
```

---

## 2. Package Dependency Graph

```
apps/server  --------> packages/config ------> packages/shared-types
   |                         ^
   +--> packages/validation -+
   |          |
   |          v
   +--> packages/shared-types

apps/mobile  --------> packages/config ------> packages/shared-types
   |                         ^
   +--> packages/validation -+
   |          |
   |          v
   +--> packages/shared-types
```

- **`packages/shared-types`**: Leaf package containing pure TypeScript types, interfaces, and enums. Has zero runtime dependencies.
- **`packages/validation`**: Contains Zod schemas that validate request payloads and data models, with static types inferred directly.
- **`packages/config`**: Provides centralized, typed environment validation for server (all 13 categories) and mobile client (`EXPO_PUBLIC_*`).
- **`apps/server`**: Express server consuming `@chatlock/config`, `@chatlock/shared-types`, and `@chatlock/validation`.
- **`apps/mobile`**: React Native Expo client consuming `@chatlock/config`, `@chatlock/shared-types`, and `@chatlock/validation`.

---

## 3. Communication Patterns

### 3.1 Synchronous REST API

Used for operations requiring transactional request/response flows:

- User registration and login
- Profile management
- Initial conversation bootstrap & history pagination
- Media upload and metadata retrieval

### 3.2 Bidirectional WebSockets (Socket.IO)

Used for low-latency, event-driven interactions:

- Real-time message delivery
- Live typing indicators (`typing_start`, `typing_stop`)
- User presence and online/offline status updates
- Message delivery receipts (`pending` -> `sent` -> `delivered` -> `read`)

### 3.3 Redis Pub/Sub Adapter for Horizontal Scaling

When scaling to multiple server instances, Socket.IO nodes communicate through Redis Pub/Sub channels to broadcast events seamlessly across server cluster nodes.

---

## 4. Security & Isolation Architecture

1. **Client/Server Secret Boundary**: Mobile applications only bundle configuration with the `EXPO_PUBLIC_` prefix. Sensitive backend secrets (database credentials, private keys, API secrets) are validated exclusively in the server environment.
2. **Strict Schema Validation**: Inbound HTTP requests and Socket.IO payloads are validated against Zod schemas before reaching business logic handlers.
3. **Defense in Depth**:
   - Helmet HTTP security headers
   - Configurable CORS policy
   - Rate limiting per IP/user
   - Non-root Docker execution user
