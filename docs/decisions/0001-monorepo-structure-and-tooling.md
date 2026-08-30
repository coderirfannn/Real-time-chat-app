# ADR 0001: Monorepo Structure & Tooling with pnpm Workspaces

## Status

Accepted

## Context

ChatLock comprises multiple applications (Mobile React Native/Expo app, Backend Express/Socket.IO server) and shared logic (types, validation schemas, environment configuration). A monorepo ensures shared code is versioned synchronously and eliminates duplicate schema definitions.

## Decision

We adopt **pnpm workspaces** with TypeScript composite project references.

- `apps/` contains deployable products (`mobile`, `server`).
- `packages/` contains shared libraries (`shared-types`, `validation`, `config`).
- TypeScript strict mode enabled across all packages.
- ESLint and Prettier configured at workspace root with project-level extensions.

## Consequences

### Positive

- Single source of truth for contracts between client and server.
- Fast, deduplicated dependency installation with pnpm content-addressable store.
- Independent package building and linting with granular caching.

### Negative

- Requires pnpm-aware tooling and workspace-aware build scripts.
