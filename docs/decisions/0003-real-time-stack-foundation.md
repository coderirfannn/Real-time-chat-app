# ADR 0003: Real-Time Communication Stack Foundation

## Status

Accepted

## Context

A real-time messaging application requires bidirectional low-latency messaging, room-based multicasting, horizontal scalability, and cross-platform mobile client support.

## Decision

We select **Socket.IO** coupled with **Redis Pub/Sub adapter**:

- Socket.IO provides automatic reconnection, connection fallback, room abstraction, and TypeScript type-safe event maps.
- Redis acts as the message bus across horizontally scaled server instances.
- Typed event contracts are shared via `@chatlock/shared-types`.

## Consequences

### Positive

- Cross-platform support for React Native and web clients.
- Multi-server scale-out capability without complex orchestration.
- Strongly typed client-to-server and server-to-client contracts.

### Negative

- Requires Redis instance availability in both development and production.
