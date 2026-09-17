# ChatLock — Documentation Index & System Overview

Welcome to the **ChatLock** technical documentation hub. ChatLock is a high-concurrency, privacy-first, production-grade real-time messaging platform built with a decoupled monorepo architecture, Signal-compliant End-to-End Encryption (E2EE), WebSocket duplex streaming, offline-first message synchronization, and a dedicated Web-Only Administrative Control Center.

---

## 📚 Documentation Navigation

| Document | Description |
| :--- | :--- |
| [**System Architecture**](./architecture.md) | High-level topology, monorepo structure, layered backend design, multi-node cluster scaling, and zero-trust security boundaries. |
| [**Authentication & RBAC**](./authentication.md) | JWT access tokens, SHA-256 refresh token rotation (RFC 6819), session revocation, Role-Based Access Control (`USER` / `ADMIN`), and account state machines. |
| [**E2EE Cryptographic Architecture**](./e2ee-cryptography.md) | Signal Protocol implementation: X3DH key agreement, Double Ratchet, ChaCha20-Poly1305 AEAD, secure hardware key stores, and zero-plaintext server relay. |
| [**Real-Time Socket.IO Protocol**](./realtime-socket-protocol.md) | WebSocket gateway specification, typed event contracts, dual-room broadcasting, ephemeral presence, typing debouncing, and monotonic receipts. |
| [**Database Domain Models & Schemas**](./data-models.md) | Complete MongoDB / Mongoose schema specifications, subdocument definitions, compound indexes, TTL eviction, and consistency rules. |
| [**REST API Reference**](./rest-api-reference.md) | Complete REST API endpoint reference across Auth, Users, Conversations, Messages, Media, E2EE, Devices, Reports, and Admin namespaces. |
| [**Mobile & Web Client Architecture**](./mobile-client-architecture.md) | React Native / Expo Router client design, Zustand state management, 0ms optimistic UI pipeline, offline outbox synchronization, and biometrics. |
| [**Web Admin Control Center**](./admin-control-center.md) | Web-only management portal, live system metrics, user moderation actions (suspend/ban), abuse report resolution, and tamper-evident audit logging. |
| [**Push Notifications & OS Badges**](./push-notifications-and-badges.md) | Expo push notifications, hardware device UUID persistence, privacy-preserving notification payloads, and native OS launcher icon badge synchronization. |
| [**Media & Cloud Storage Engine**](./media-and-storage.md) | Cloudinary cloud integration, signed upload authorization, binary magic byte inspection, CDN caching, and in-app media lightbox. |
| [**Deployment & Infrastructure**](./deployment.md) | Render backend web service, Vercel SPA web hosting, EAS standalone Android APK builds, Docker Compose, and CI/CD quality gates. |
| [**System Audit & Roadmap Report**](./system-audit-and-gap-analysis.md) | In-depth breakdown of fully implemented features, pending architectural enhancements, technical debt analysis, and future roadmap phases. |

---

## 🏗️ Core Technology Stack

```
ChatLock Platform Ecosystem
├── Monorepo & Tooling:  pnpm Workspaces 11.24+ | TypeScript 5.7+ Strict Mode | Node.js 22+
├── Backend REST & WS:   Express 4.21+ | Socket.IO 4.8+ | @socket.io/redis-adapter
├── Persistence & Cache: MongoDB Atlas (Mongoose 8+) | Redis 7.2 (ioredis 5+)
├── Cross-Platform App:  React Native 0.86+ | Expo SDK 57+ | Expo Router (iOS, Android, Web)
├── State & Data Sync:   Zustand 5+ | TanStack Query 5+ | Persistent Encrypted Outbox
├── Cryptography:        @noble/curves (Ed25519 / X25519) | @noble/ciphers (ChaCha20-Poly1305) | @noble/hashes (HKDF / SHA-256)
├── Cloud Assets:        Cloudinary v2 SDK | Secure HMAC Upload Signatures
├── Security:            Bcrypt | Helmet | Rate-Limiter-Flexible | Zod Runtime Validation
└── Quality & CI/CD:     Vitest 3+ (531+ automated tests) | GitHub Actions | ESLint | Prettier
```

---

## 🚀 Quick Reference Commands

```bash
# Install all dependencies across monorepo
pnpm install

# Build all internal packages (shared-types, validation, config)
pnpm build

# Start local backend development server (Port 5000)
pnpm --filter @chatlock/server dev

# Start mobile & web development server (Port 8081)
pnpm --filter @chatlock/mobile dev

# Run automated test suites (531+ tests)
pnpm test

# Run strict typecheck across all packages
pnpm typecheck

# Provision an administrator account via CLI
pnpm --filter @chatlock/server admin:promote <email|username>
```
