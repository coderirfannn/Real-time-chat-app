# ChatLock — REST API Specification & Endpoint Reference

This document provides a comprehensive reference for all REST API endpoints implemented in the **ChatLock** backend service.

---

## 1. Global Standards & Envelope Formats

### 1.1 Base URL & Content Negotiation
- **Base URL**: `http://localhost:5000/api/v1` (or production `https://chatlock-server.onrender.com/api/v1`)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>` (for authenticated endpoints)
  - `x-request-id: <uuid>` (automatically injected or passed through)

### 1.2 Standard Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable confirmation message",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextCursor": "65b9e...",
    "prevCursor": null
  }
}
```

### 1.3 Standard Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The provided email address is invalid.",
    "details": [
      { "field": "email", "issue": "Invalid email syntax" }
    ],
    "requestId": "req_8b9f1234..."
  }
}
```

---

## 2. Authentication Namespace (`/api/v1/auth`)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | None (Rate Limited) | Creates a new user account, active session, and returns token pair. |
| `POST` | `/api/v1/auth/login` | None (Rate Limited) | Authenticates credentials by email/username and returns token pair. |
| `POST` | `/api/v1/auth/refresh` | None (Refresh Token) | Rotates refresh token (RFC 6819) and returns new token pair. |
| `POST` | `/api/v1/auth/logout` | Optional | Revokes the current device session associated with refresh token. |
| `POST` | `/api/v1/auth/logout-all` | Bearer JWT | Revokes all active refresh sessions across all devices for current user. |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Returns current authenticated user profile and account status. |

---

## 3. Users Namespace (`/api/v1/users`)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/search` | Bearer JWT | Searches registered users by username, email, or displayName. |
| `GET` | `/api/v1/users/me` | Bearer JWT | Returns the full profile of the authenticated user. |
| `PATCH` | `/api/v1/users/me` | Bearer JWT | Updates displayName, bio, or avatarUrl of current user. |
| `GET` | `/api/v1/users/:id` | Bearer JWT | Retrieves public profile information for a target user ID. |

---

## 4. Conversations Namespace (`/api/v1/conversations`)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/conversations` | Bearer JWT | Retrieves paginated user conversation list with last messages & unread counts. |
| `POST` | `/api/v1/conversations` | Bearer JWT | Creates or retrieves direct chat (using `directKey`) or creates group conversation. |
| `GET` | `/api/v1/conversations/:id` | Bearer JWT | Retrieves details and participant metadata for a specific conversation. |
| `GET` | `/api/v1/conversations/:id/messages` | Bearer JWT | Cursor-paginated message history with `before`, `after`, and `limit` query parameters. |

---

## 5. End-to-End Encryption Namespace (`/api/v1/e2ee`)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/e2ee/keys/register` | Bearer JWT | Registers public Identity Key ($IK$), Signed Pre-Key ($SPK$), and pool of 50 $OPKs$. |
| `GET` | `/api/v1/e2ee/keys/:userId` | Bearer JWT | Fetches peer public key bundle and atomically claims one unconsumed $OPK$. |
| `POST` | `/api/v1/e2ee/prekeys/replenish` | Bearer JWT | Uploads a fresh batch of one-time pre-keys to replenish the pool. |
| `POST` | `/api/v1/e2ee/signed-prekey/rotate` | Bearer JWT | Rotates the signed pre-key ($SPK$) with a fresh signature. |
| `GET` | `/api/v1/e2ee/devices/me` | Bearer JWT | Checks registration status and remaining unconsumed pre-key count for current device. |
| `GET` | `/api/v1/e2ee/users/:userId/devices` | Bearer JWT | Enumerates active cryptographic devices for a user. |
| `PATCH` | `/api/v1/e2ee/devices/:deviceId/revoke` | Bearer JWT | Revokes a cryptographic device identity. |

---

## 6. Devices & Push Notification Namespace (`/api/v1/devices`)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/devices/push-token` | Bearer JWT | Registers or updates persistent hardware device UUID and Expo push token. |
| `POST` | `/api/v1/devices/push-token/deactivate` | Bearer JWT | Deactivates push token for current device upon logout. |

---

## 7. Media & Storage Namespace (`/api/v1/media`)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/media/upload-url` | Bearer JWT | Issues an HMAC-signed upload descriptor with 15-minute expiration. |
| `POST` | `/api/v1/media/upload` | Bearer JWT | Multipart direct streaming upload to server / Cloudinary with magic-byte check. |
| `GET` | `/api/v1/media/file/:key` | Public / Auth | Serves local uploaded file or redirects to secure Cloudinary CDN asset. |

---

## 8. Abuse Reports Namespace (`/api/v1/reports`)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reports` | Bearer JWT (Rate Limited) | Submits a report against a user, message, or conversation. |
| `GET` | `/api/v1/reports/my-reports` | Bearer JWT | Lists past reports submitted by the authenticated user. |

---

## 9. Admin Control Center Namespace (`/api/v1/admin`)
*All endpoints in this namespace strictly require `requireAuth` AND `requireAdmin` middlewares.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | Aggregated live database metrics (total users, active sessions, total messages, pending reports). |
| `GET` | `/api/v1/admin/users` | Searchable, paginated user directory with role and status filters. |
| `GET` | `/api/v1/admin/users/:id` | Detailed user inspection with communication statistics and moderation history. |
| `PATCH` | `/api/v1/admin/users/:id/suspend` | Suspends user account with audit reason; revokes active sessions and evicts sockets. |
| `PATCH` | `/api/v1/admin/users/:id/unsuspend` | Unsuspends user account and restores active status. |
| `PATCH` | `/api/v1/admin/users/:id/ban` | Permanently bans user account with session revocation and socket eviction. |
| `PATCH` | `/api/v1/admin/users/:id/unban` | Unbans user account and restores active status. |
| `GET` | `/api/v1/admin/reports` | Paginated abuse reports moderation queue with status and target filters. |
| `PATCH` | `/api/v1/admin/reports/:id/status` | Transitions report status (`OPEN` -> `UNDER_REVIEW`). |
| `POST` | `/api/v1/admin/reports/:id/resolve` | Resolves report with action (`DISMISS`, `WARN`, `SUSPEND`, `BAN`) and mandatory rationale. |
| `GET` | `/api/v1/admin/groups` | Paginated group chats overview for moderation. |
| `GET` | `/api/v1/admin/media` | Paginated media inventory for storage moderation. |
| `GET` | `/api/v1/admin/audit-logs` | Immutable audit log viewer with action and date filters. |
| `GET` | `/api/v1/admin/settings` | Read-only runtime configuration and telemetry. |
| `GET` | `/api/v1/admin/metrics` | Live JSON telemetry snapshot (HTTP, socket, DB, and system memory metrics). |

---

## 10. Health, Metrics & Diagnostics Namespace (`/api/v1/health`, `/health`, `/metrics`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/metrics` | Standard Prometheus exposition format (v0.0.4) for scraper integration. |
| `GET` | `/api/v1/health` | High-level system uptime and status. |
| `GET` | `/health` | Kubernetes / Docker health check. |
| `GET` | `/health/live` | Liveness probe (verifies process is executing). |
| `GET` | `/health/ready` | Readiness probe (verifies active MongoDB Atlas and Redis connections). |
