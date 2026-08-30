# ADR 0002: Centralized Environment & Configuration Management

## Status

Accepted

## Context

Scattering `process.env` calls throughout a codebase leads to untracked runtime failures, missing configuration errors in production, and potential leakage of private secrets into frontend bundles.

## Decision

We implement `@chatlock/config` with Zod runtime validation:

1. **Centralized Schemas**: Strict Zod schemas for 13 configuration domains (App, MongoDB, Redis, JWT, Socket.IO, Rate Limiting, Storage, Push Notifications, Observability, Security, Logging, Jobs, Feature Flags).
2. **Fail-Fast Validation**: The server crashes immediately at boot with readable error summaries if mandatory environment variables are missing or misconfigured.
3. **Secret Isolation**: Mobile client configurations only ingest `EXPO_PUBLIC_*` variables; backend secrets are stripped and blocked from client bundles.

## Consequences

### Positive

- Type-safe, validated config singleton across all backend modules.
- Zero chance of missing critical secrets silently in staging or production.
- Prevents database passwords and private keys from leaking into the mobile client.

### Negative

- All new environment variables must be declared in `@chatlock/config`.
