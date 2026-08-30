# ChatLock — Real-Time Messaging Platform

ChatLock is a modern, high-concurrency, production-ready real-time messaging platform built as a TypeScript monorepo with React Native (Expo), Node.js (Express), MongoDB, Redis, and Socket.IO.

---

## Repository Structure

```text
├── apps/
│   ├── mobile/             # React Native + Expo client application
│   └── server/             # Node.js + Express backend service
│
├── packages/
│   ├── shared-types/       # Canonical TypeScript interfaces and API contracts
│   ├── validation/         # Reusable Zod schemas for input validation
│   └── config/             # Centralized environment configuration and validation
│
├── docs/
│   ├── architecture.md     # In-depth architectural blueprint
│   ├── deployment.md       # Production and staging deployment guide
│   └── decisions/          # Architecture Decision Records (ADRs)
│
├── infrastructure/
│   └── docker/             # Development docker-compose (MongoDB, Redis)
│
├── scripts/                # Utility scripts for maintenance and build
├── .github/workflows/      # Automated CI workflow
├── BRAIN.md                # Master architectural blueprint & roadmap
├── package.json            # Root workspace scripts & tooling
└── pnpm-workspace.yaml     # pnpm workspace definition
```

---

## Prerequisites

- **Node.js**: `v20.0.0` or later
- **pnpm**: `v9.0.0` or later (pnpm 11 recommended)
- **Docker & Docker Compose**: for running local MongoDB & Redis instances
- **Expo Go** / Android Studio / Xcode (optional for mobile device preview)

---

## Quickstart Guide

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd "ChatLock - Real time system"

pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Review `.env` to customize ports or credentials if needed.

### 3. Start Local Infrastructure (MongoDB & Redis)

```bash
pnpm docker:up
```

Verify services:

- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

### 4. Build Shared Packages & Run Server

```bash
# Build all packages
pnpm build

# Start server in watch mode
pnpm --filter="@chatlock/server" dev
```

The server will be accessible at: `http://localhost:5000`  
Health check endpoint: `http://localhost:5000/health`

### 5. Start Mobile Client

```bash
pnpm --filter="@chatlock/mobile" start
```

Press `w` for Web preview, `a` for Android, or `i` for iOS simulator.

---

## Available Monorepo Scripts

| Command             | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `pnpm build`        | Compiles all packages and apps with TypeScript composite builds |
| `pnpm typecheck`    | Validates TypeScript strict mode across all workspaces          |
| `pnpm lint`         | Runs ESLint on all code files                                   |
| `pnpm lint:fix`     | Automatically fixes linting errors                              |
| `pnpm test`         | Runs unit and integration test suites via Vitest                |
| `pnpm format`       | Formats all code, JSON, and Markdown files using Prettier       |
| `pnpm format:check` | Verifies code formatting compliance                             |
| `pnpm docker:up`    | Starts local MongoDB & Redis Docker containers                  |
| `pnpm docker:down`  | Stops local Docker containers                                   |
| `pnpm docker:logs`  | Streams logs from Docker containers                             |
| `pnpm clean`        | Removes all `dist`, `build`, and cache directories              |

---

## Environment Strategy

- Environment variables are validated at startup through `@chatlock/config` using Zod schemas.
- `process.env` is never accessed randomly across backend services; code imports typed configurations from `@chatlock/config`.
- 13 distinct configuration categories are isolated: Application, MongoDB, Redis, JWT, Socket.IO, Rate Limiting, Storage, Push Notifications, Observability, Security, Logging, Jobs, and Feature Flags.
- Mobile client configuration only exposes `EXPO_PUBLIC_*` variables. Private server keys (MongoDB passwords, JWT secrets, S3 secrets) are strictly prevented from bundling into mobile clients.

---

## Architecture Direction

For complete architectural details, see:

- [`BRAIN.md`](./BRAIN.md) — Master platform roadmap and specifications.
- [`docs/architecture.md`](./docs/architecture.md) — Deep dive into system architecture and data flows.
- [`docs/deployment.md`](./docs/deployment.md) — Containerization and scaling runbook.
- [`docs/decisions/`](./docs/decisions/) — Architecture Decision Records.
