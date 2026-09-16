# ChatLock — Complete System Architecture & Engineering Blueprint

This document details the architectural topology, data flow, communication protocols, cross-platform boundaries, and security isolation mechanisms for the **ChatLock** real-time messaging platform.

---

## 1. High-Level System Topology

```
                                  +-------------------------------------------------------------+
                                  |                 Client Application Layer                    |
                                  |  - Mobile (React Native / Expo SDK 57 for iOS & Android)    |
                                  |  - Web Application (Expo Router Web SPA on Vercel)          |
                                  |  - Web-Only Admin Control Center (/admin/* routes)          |
                                  +------------------------------+------------------------------+
                                                                 |
                                       HTTPS (REST / JSON)       |       WSS (Duplex Socket.IO)
                                                                 v
                                  +-------------------------------------------------------------+
                                  |                API Gateway & Reverse Proxy                  |
                                  |  - SSL/TLS Termination | Cloudflare / Render Routing        |
                                  |  - Global Rate Limiting | CORS Policy | Request ID Injection|
                                  +------------------------------+------------------------------+
                                                                 |
                                +--------------------------------+--------------------------------+
                                |                                                                 |
                                v                                                                 v
+---------------------------------------------------------------+ +---------------------------------------------------------------+
|               Express HTTP Application Server                 | |                 Socket.IO Real-Time Gateway                   |
| - Authentication & Token Rotation (RFC 6819)                  | | - JWT Handshake Authentication & Active Account Check         |
| - User Directory & Profile Operations                         | | - Distributed Room Management (`conversation:*`, `user:*`)   |
| - Conversation Bootstrap & Cursor Pagination                  | | - 0ms Message Forwarding & Dual-Room Broadcasts               |
| - E2EE Public Key Registry & OPK Claiming                     | | - Monotonic Receipt Tracking (Sent -> Delivered -> Read)     |
| - Media Upload Signatures & Cloudinary Proxy                  | | - Ephemeral Presence Heartbeats (Redis TTL 60s)               |
| - Abuse Report Intake & Administrative Moderation             | | - Ephemeral Room Typing Indicators with Debounce              |
+-------------------------------+-------------------------------+ +-------------------------------+-------------------------------+
                                |                                                                 |
                                +--------------------------------+--------------------------------+
                                                                 |
                                +--------------------------------+--------------------------------+
                                |                                                                 |
                                v                                                                 v
+---------------------------------------------------------------+ +---------------------------------------------------------------+
|                    Redis 7.2 Cache & Bus                      | |                    MongoDB Atlas 8.0 Cluster                  |
| - `@socket.io/redis-adapter` for Multi-Node Cluster Scaling   | | - Domain Document Persistence (Users, Sessions, Rooms, Msgs) |
| - Ephemeral Presence Heartbeat Keys (`presence:{userId}`)     | | - E2EE Public Key Registry (`deviceKeys`)                     |
| - Real-time Pub/Sub Messaging Bridge Across Worker Nodes      | | - Persistent Delivery Receipts (`messageReceipts`)            |
| - Socket Connection Registry & Session Cache                  | | - Abuse Reports & Tamper-Evident `auditLogs`                 |
+---------------------------------------------------------------+ +---------------------------------------------------------------+
```

---

## 2. Monorepo Package Hierarchy & Dependency Graph

ChatLock utilizes **pnpm Workspaces** to guarantee strict unidirectional dependency flow and prevent circular dependencies between internal packages.

```
                              +---------------------------+
                              |   packages/shared-types   |
                              | (Zero runtime dependency) |
                              +-------------+-------------+
                                     ^             ^
                                     |             |
                                     |      +------+------+
                                     |      |             |
                         +-----------+------+----+        |
                         |  packages/validation  |        |
                         | (Zod schemas & types) |        |
                         +-----------+-----------+        |
                                     ^                    |
                                     |                    |
                         +-----------+-----------+        |
                         |    packages/config    |        |
                         | (Env & Subpath Exports|        |
                         +-----------+-----------+        |
                                     ^                    |
                                     |                    |
                    +----------------+----------------+   |
                    |                                 |   |
     +--------------+---------------+  +--------------+---+-----------+
     |         apps/server          |  |         apps/mobile          |
     | (Node.js 22 + Express 4.21)  |  |  (React Native + Expo Router)|
     +------------------------------+  +------------------------------+
```

### Monorepo Package Breakdown

1. **`@chatlock/shared-types` (`packages/shared-types`)**:
   - Leaf package with zero runtime dependencies.
   - Declares domain entities (`IUser`, `IConversation`, `IMessage`, `IMessageReceipt`, `IDeviceKey`, `IReport`, `IAuditLog`).
   - Declares API response formats (`ApiResponse<T>`, `ApiErrorResponse`, `PaginationMeta`).
   - Declares Socket.IO client/server event signatures and payload contracts.

2. **`@chatlock/validation` (`packages/validation`)**:
   - Contains runtime Zod schemas matching all API requests, socket payloads, and cryptographic bundles.
   - Enforces format constraints (e.g., email syntax, password complexity, alphanumeric usernames, hex-encoded keys).
   - Invariant type inference (`z.infer<typeof schema>`) guaranteeing 100% synchronization between validation rules and TypeScript types.

3. **`@chatlock/config` (`packages/config`)**:
   - Centralized environment variable validation across 13 distinct categories.
   - Subpath export isolation:
     - `@chatlock/config`: Full server environment schema (MongoDB URIs, JWT secrets, Redis credentials, Cloudinary API secrets).
     - `@chatlock/config/mobile`: Isolated client environment schema exposing only `EXPO_PUBLIC_*` safe variables. Prevents private secrets from ever entering mobile/web client bundles.

4. **`@chatlock/server` (`apps/server`)**:
   - Production Express 4.21 backend on Node.js 22.
   - Layered decoupling: `Route -> Controller -> Service -> Repository -> Database`.
   - Socket.IO 4.8 real-time server with Redis adapter for distributed clustering.

5. **`@chatlock/mobile` (`apps/mobile`)**:
   - Universal React Native application supporting iOS, Android, and Web SPA via Expo Router.
   - Implements local cryptographic key storage, Double Ratchet engine, 0ms optimistic UI, offline outbox, and web-only Admin Control Center.

---

## 3. Layered Backend Decoupling Architecture

The server adheres to a strict unidirectional layered architecture:

```
[ HTTP Request / Socket Event ]
              |
              v
[ Middleware Layer ] (Rate Limiting, CORS, Request ID, Body Sanitization, Auth Guard)
              |
              v
[ Controller Layer ] (Extracts parameters, validates payload via Zod, formats HTTP response)
              |
              v
[ Service Layer ] (Business logic orchestration, cryptographic verification, transactions, push triggers)
              |
              v
[ Repository Layer ] (Data access abstractions, atomic MongoDB queries, update operators)
              |
              v
[ Database / Cache ] (MongoDB Atlas & Redis 7.2)
```

### Architectural Rules
- **Controllers** never communicate directly with Mongoose models or databases.
- **Services** are completely decoupled from Express `req` and `res` objects, making them testable in isolation.
- **Repositories** encapsulate all MongoDB queries, Mongoose projection, and indexing rules.
- **Errors** are thrown as typed `AppError` subclasses with stable error codes and HTTP status codes.

---

## 4. Multi-Node Cluster Scaling & High Availability

ChatLock is engineered for horizontal multi-node scaling:

1. **Stateless Web Tier**: All Express instances are stateless. Authentication state is stored in cryptographically signed JWTs and MongoDB session records.
2. **Socket.IO Redis Adapter**: Real-time Socket.IO servers utilize `@socket.io/redis-adapter`. When a message or presence event is emitted on Node A, Redis Pub/Sub distributes the packet to Nodes B and C, broadcasting to relevant connected clients regardless of which server instance holds their TCP connection.
3. **Graceful Fallback**: If Redis temporarily drops, Socket.IO gracefully degrades to single-node in-memory event delivery without crashing the server process.

```
       [ Client A ]                [ Client B ]                [ Client C ]
            |                           |                           |
            v                           v                           v
     [ Server Node 1 ]           [ Server Node 2 ]           [ Server Node 3 ]
            \                           |                           /
             \                          |                          /
              +-----------------> [ Redis Bus ] <-----------------+
                               (Pub/Sub Adapter)
```

---

## 5. Security Architecture & Threat Mitigation

| Threat Vector | Mitigation Strategy Implemented |
| :--- | :--- |
| **NoSQL Injection** | Global recursive operator sanitization stripping `$` and `.` characters from all query params and JSON request bodies (`sanitizeMiddleware`). |
| **Timing Attacks** | Constant-time password comparison (`bcrypt.compare`) and dummy hashing when user lookup fails during login to prevent username enumeration. |
| **Token Hijacking & Theft** | RFC 6819 refresh token rotation with SHA-256 storage. Replay of an old token triggers automatic family revocation, terminating all active sessions for that user. |
| **Socket Flooding / DoS** | Per-socket sliding-window rate limiting in Socket.IO gateway (max 40 operations/second per connection). |
| **Plaintext Eavesdropping** | End-to-End Encryption (Signal X3DH + Double Ratchet + ChaCha20-Poly1305). Zero message plaintext stored on servers. |
| **MIME / File Spoofing** | Binary magic-byte inspection (JPEG, PNG, GIF, WEBP, PDF, ZIP, MP4, MP3, WAV) on uploads before Cloudinary dispatch. |
| **Unauthorized Admin Access** | Multi-layer RBAC (`requireAuth` + `requireAdmin`) verifying real-time database account status and `role: 'ADMIN'`. Client-side route redirection on native mobile runtimes. |
| **Client Bundle Secret Leak** | Strict configuration filtering via `@chatlock/config/mobile` and bundler leak guards rejecting non-`EXPO_PUBLIC_` environment variables. |
