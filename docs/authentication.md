# ChatLock — Production Authentication Architecture

This document details the production-grade authentication and session management architecture implemented for the **ChatLock** platform.

---

## 1. Authentication Flow Overview

```
Client                                     Server                                      MongoDB
  |                                          |                                            |
  |--- 1. POST /api/v1/auth/register ------->|                                            |
  |    (email, username, password)           |--- 2. Hash password (bcrypt) ------------>|
  |                                          |--- 3. Generate raw refresh token --------->|
  |                                          |--- 4. Store SHA-256(refresh_token) ------->| [Session]
  |<-- 5. Return JWT Access + Refresh -------|                                            |
  |                                          |                                            |
  |--- 6. GET /api/v1/auth/me -------------->|                                            |
  |    (Authorization: Bearer <JWT>)         |--- 7. Verify JWT Signature --------------->|
  |<-- 8. Return 200 OK + UserProfile -------|                                            |
  |                                          |                                            |
  |--- 9. POST /api/v1/auth/refresh -------->|                                            |
  |    (refreshToken)                        |--- 10. Verify & Revoke Old Session ------->| [Session]
  |                                          |--- 11. Create New Rotated Session ------->| [Session]
  |<-- 12. Return New Token Pair ------------|                                            |
```

---

## 2. Cryptographic Security Standards

### 2.1 Password Hashing

- **Algorithm**: `bcrypt` (`bcryptjs`)
- **Salt Rounds**: Configurable via `BCRYPT_SALT_ROUNDS` (Default: `12`)
- **Storage**: Stored in `users.passwordHash` with Mongoose `select: false` to ensure password hashes are never returned in queries or serialization.

### 2.2 JWT Access Tokens

- **Algorithm**: `HS256`
- **Secret Key**: `JWT_ACCESS_SECRET` (strictly isolated from client bundles)
- **Lifespan**: Short-lived (Default: `15m`)
- **Payload Schema**:
  ```json
  {
    "sub": "<user_object_id>",
    "email": "user@example.com",
    "username": "user_handle",
    "iat": 1740000000,
    "exp": 1740000900
  }
  ```

### 2.3 Refresh Token Rotation & Session Management

- **High-Entropy Tokens**: Refresh tokens are 40-byte cryptographically secure random hexadecimal strings (`crypto.randomBytes(40).toString('hex')`).
- **One-Way Token Hashing**: Raw refresh tokens are never persisted in plaintext. The database only stores `SHA-256(rawRefreshToken)`.
- **Strict Token Rotation**: Every call to `POST /api/v1/auth/refresh` immediately revokes the current session and provisions a brand-new session with a new refresh token. Replaying an old refresh token is rejected with `401 Unauthorized`.
- **TTL Eviction**: The `sessions` collection features a MongoDB TTL index on `expiresAt` with `expireAfterSeconds: 0` for zero-overhead background cleanup.

---

## 3. Authorization Middleware

### `requireAuth`

Enforces strict Bearer JWT token verification. Rejects missing, expired, or tampered tokens with `401 UNAUTHORIZED`. Attaches the cryptographically verified user context to `req.user`.

```typescript
import { requireAuth } from '../middleware/auth.middleware.js';

router.get('/protected-route', requireAuth, (req, res) => {
  const currentUserId = req.user.id;
  // Guaranteed verified identity
});
```

### `optionalAuth`

Non-blocking token inspection. If a valid Bearer token is provided, `req.user` is populated; otherwise, execution proceeds as anonymous without error.

---

## 4. Rate Limiting & Protection

- **Authentication Endpoints**: Protected by `authRateLimiter` allowing a maximum of 20 requests per 15-minute window per IP. Exceeding the threshold returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After` headers.

---

## 5. API Endpoints Reference

| Method | Path                      | Auth                  | Description                                                                         |
| ------ | ------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `POST` | `/api/v1/auth/register`   | Public (Rate Limited) | Creates a new user account, active session, and returns access + refresh tokens     |
| `POST` | `/api/v1/auth/login`      | Public (Rate Limited) | Authenticates credentials by email or username, creates session, and returns tokens |
| `POST` | `/api/v1/auth/refresh`    | Public                | Rotates refresh token: revokes previous session and returns new token pair          |
| `POST` | `/api/v1/auth/logout`     | Optional              | Revokes the session associated with the provided refresh token                      |
| `POST` | `/api/v1/auth/logout-all` | Bearer JWT            | Revokes all active sessions across all devices for the authenticated user           |
| `GET`  | `/api/v1/auth/me`         | Bearer JWT            | Retrieves the public profile of the authenticated user                              |
