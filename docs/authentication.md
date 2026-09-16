# ChatLock — Authentication, Session Lifecycle & RBAC Architecture

This document details the authentication subsystem, session management, OAuth2 RFC 6819 token rotation, Role-Based Access Control (RBAC), and account status enforcement for **ChatLock**.

---

## 1. End-to-End Authentication Lifecycle

```
[ Client ]                                     [ Express Server ]                                 [ MongoDB Atlas ]
    |                                                  |                                                  |
    |---- 1. POST /api/v1/auth/register -------------->|                                                  |
    |     (email, username, displayName, password)     |---- 2. Hash password (bcrypt 12 rounds) -------->|
    |                                                  |---- 3. Create User record (role: USER) --------->|
    |                                                  |---- 4. Generate high-entropy Refresh Token ------>|
    |                                                  |---- 5. Save SHA-256(refreshToken) in Session --->| [sessions]
    |<--- 6. Return JWT Access Token + Refresh Token --|                                                  |
    |                                                  |                                                  |
    |---- 7. Authenticated Request with Bearer JWT --->|                                                  |
    |     (Authorization: Bearer <accessToken>)        |---- 8. Verify JWT signature & expiration --------|
    |                                                  |---- 9. req.user = decodedToken ----------------->|
    |<--- 10. Process Request & Return 200 OK ---------|                                                  |
    |                                                  |                                                  |
    |---- 11. POST /api/v1/auth/refresh -------------->|                                                  |
    |     (refreshToken)                               |---- 12. Hash incoming token & lookup Session --->|
    |                                                  |         [IF NOT FOUND / PREVIOUSLY REVOKED]:     |
    |                                                  |         -> TRIGGER TOKEN THEFT REVOCATION!       |
    |                                                  |         -> Revoke ALL sessions for userId        |
    |                                                  |         -> Return 401 UNAUTHORIZED               |
    |                                                  |         [IF FOUND & ACTIVE]:                     |
    |                                                  |         -> Mark old session revoked              |
    |                                                  |         -> Create new session with new token     |
    |<--- 13. Return Rotated Access + Refresh Token ---|                                                  |
```

---

## 2. Token Security Specifications

### 2.1 Access Tokens (JWT)
- **Signature Algorithm**: HMAC SHA-256 (`HS256`)
- **Secret Key**: `JWT_ACCESS_SECRET` (Strictly backend-isolated)
- **Lifespan**: 15 minutes (`JWT_ACCESS_EXPIRES_IN=15m`)
- **Payload Schema**:
  ```typescript
  interface JwtAccessPayload {
    sub: string;       // MongoDB User ObjectId
    email: string;     // User email address
    username: string;  // User handle
    role: 'USER' | 'ADMIN';
    iat: number;       // Issued-at UNIX timestamp
    exp: number;       // Expiration UNIX timestamp
  }
  ```

### 2.2 Refresh Tokens (Rotating SHA-256)
- **Entropy Generation**: `crypto.randomBytes(40).toString('hex')` (80-character high-entropy hex string)
- **Persistence Guarantee**: Plaintext refresh tokens are **NEVER** stored in the database. Only `crypto.createHash('sha256').update(rawToken).digest('hex')` is persisted in the `sessions` collection.
- **Lifespan**: 30 days (`JWT_REFRESH_EXPIRES_IN=30d`), automatically purged via MongoDB TTL index on `expiresAt`.

### 2.3 Token Reuse Detection & Family Revocation (RFC 6819)
If an attacker intercepts an old refresh token and attempts to exchange it after the legitimate client has already rotated it:
1. The server detects that the submitted token has already been marked as `revokedAt != null` or does not exist.
2. The server classifies the event as an **active session hijacking attempt**.
3. The server immediately executes `SessionRepository.revokeAllForUser(userId)`, invalidating all active refresh sessions across every device the user owns.
4. The server returns `401 Unauthorized` with error code `TOKEN_REUSED_REVOCATION`.

---

## 3. Role-Based Access Control (RBAC)

ChatLock enforces server-side Role-Based Access Control anchored directly in the database.

### 3.1 User Roles
- **`USER`**: Standard messaging user. Access to direct messaging, conversations, media uploads, profile editing, and user reporting.
- **`ADMIN`**: Platform administrator. Inherits all `USER` capabilities, plus exclusive access to `/api/v1/admin/*` endpoints and the Web Control Center.

### 3.2 Account Status State Machine

```
              +---------------------------+
              |          ACTIVE           | <=================+
              +---------------------------+                   |
                |                       |                     |
     suspendUser()                    banUser()          unsuspendUser() / unbanUser()
                |                       |                     |
                v                       v                     |
       +-----------------+     +-----------------+            |
       |    SUSPENDED    |     |     BANNED      |            |
       +-----------------+     +-----------------+            |
                |                       |                     |
                +-----------------------+---------------------+
```

| Account Status | Login / Refresh | Socket Connection | REST API Access | Admin Control Center |
| :--- | :--- | :--- | :--- | :--- |
| **`ACTIVE`** | Allowed (200 OK) | Connected | Full access | Allowed (if `role: ADMIN`) |
| **`SUSPENDED`** | Blocked (`403 FORBIDDEN`) | Terminated & Evicted | Blocked (`403 FORBIDDEN`) | Blocked |
| **`BANNED`** | Blocked (`403 FORBIDDEN`) | Terminated & Evicted | Blocked (`403 FORBIDDEN`) | Blocked |

### 3.3 Authorization Middleware

#### `requireAuth`
Extracts and cryptographically verifies the Bearer JWT token from the `Authorization` header. Checks expiration and attaches `req.user` (`{ id, email, username, role }`).

#### `requireAdmin`
Chained after `requireAuth`. Executes a live database check against `UserModel` to guarantee:
1. The user exists.
2. The user's `role` is strictly `'ADMIN'`.
3. The user's `accountStatus` is strictly `'ACTIVE'`.
If any check fails, immediately responds with `403 FORBIDDEN` (`ADMIN_PRIVILEGES_REQUIRED`).

```typescript
// Example: Securing Admin Endpoints
router.get('/admin/dashboard', requireAuth, requireAdmin, adminController.getDashboardMetrics);
```

---

## 4. Client-Side Session Hydration & Interceptors

The mobile and web clients utilize a centralized `ApiClient` (`apps/mobile/src/services/api/api-client.ts`) configured with transparent token refresh mutex locking:

1. **Automatic Header Injection**: Attaches `Authorization: Bearer <accessToken>` to every outbound HTTP request.
2. **Transparent 401 Interception**: When an API request returns `401 UNAUTHORIZED`, the client pauses outbound requests and queues pending calls.
3. **Mutex-Locked Token Exchange**: A single refresh request is dispatched to `/api/v1/auth/refresh`. Upon receiving the new token pair, the `authStore` is updated in `SecureStore` / `localStorage`, and all queued requests are re-executed with the fresh token.
4. **Clean Logout on Failure**: If the refresh token is expired or revoked, the client cleans up all stored tokens, disconnects the socket, and transitions navigation to `/(auth)/login`.

---

## 5. Admin Provisioning Tooling

ChatLock provides two safe mechanisms for provisioning administrator accounts:

### CLI Provisioning Command
Run the admin promotion script directly in the server environment:
```bash
pnpm --filter @chatlock/server admin:promote admin@chatlock.com
```

### Automated Bootstrap Configuration
Set the `ADMIN_BOOTSTRAP_EMAIL` environment variable in the server `.env`. On startup, if a user with this email exists, the server automatically promotes them to `role: 'ADMIN'`.
