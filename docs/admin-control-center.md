# ChatLock — Web Admin Control Center & Abuse Moderation

This document details the architecture, capabilities, role separation, and security boundaries of the **ChatLock Web Admin Control Center**.

---

## 1. Web-Only Architectural Boundary

ChatLock maintains a strict platform boundary between regular users and platform administrators:

1. **Zero Admin UI on Native Mobile**:
   - The native React Native mobile app (`apps/mobile/app/(main)`) contains **zero admin routes, tabs, or buttons**.
   - Even if a user with `role: 'ADMIN'` logs in on an iOS or Android device, they see only the standard user messaging interface.
   - Any attempt to access `/admin/*` on native mobile runtimes (`Platform.OS !== 'web'`) triggers an immediate automatic redirection back to `/(main)`.
2. **Dedicated Responsive Web Portal**:
   - The Admin Control Center operates exclusively on web browsers under `/admin/*`.
   - Features a responsive desktop sidebar navigation rail, top header with live metrics, and mobile-friendly drawer navigation.
3. **Route & API Guarding**:
   - Web frontend route guards verify `authStore.user?.role === 'ADMIN'`. Non-admin authenticated users are presented with a dedicated **403 Access Denied** boundary.
   - Server-side API endpoints (`/api/v1/admin/*`) enforce `requireAdmin` middleware with real-time MongoDB verification.

---

## 2. Control Center Modules & Screens

```
                                 +-----------------------------------+
                                 |    Web Admin Control Center       |
                                 |         (/admin/*)                |
                                 +-----------------+-----------------+
                                                   |
      +--------------------+-----------------------+-----------------------+--------------------+
      |                    |                       |                       |                    |
      v                    v                       v                       v                    v
[ Dashboard ]        [ Users Directory ]     [ Reports Queue ]       [ Audit Logs ]       [ System Settings ]
- System metrics     - Search & filter       - Abuse triage queue    - Immutable trail    - Runtime telemetry
- Active sessions    - Suspend / Ban modals  - Sliding drawer        - Action filters     - Security bounds
- Database health    - Deep user inspect     - Rationale logging     - IP & actor audit   - Rate limit view
```

### 2.1 Dashboard (`/admin/dashboard`)
Displays real-time aggregated database statistics with zero mock data:
- **Total Registered Users** & 24h new user growth
- **Active User Sessions** & concurrent device connections
- **Total Messages Sent** & daily message volume
- **Pending Abuse Reports Queue** with severity counter
- **Infrastructure Status**: Live MongoDB Atlas ping latency & Redis connection state
- **Recent Audit Activity Feed**

### 2.2 User Directory & Moderation (`/admin/users` & `/admin/users/[id]`)
- **Search & Filtering**: Full-text search across username, email, and display name. Filters by role (`USER` vs `ADMIN`) and account status (`ACTIVE`, `SUSPENDED`, `BANNED`).
- **Detailed Profile Inspection (`/admin/users/[id]`)**: Displays communication statistics, active device count, report counts, and complete moderation history.
- **Account Actions**:
  - **Suspend User**: Temporarily disables account access with a required reason. Automatically revokes all active refresh sessions and evicts connected sockets.
  - **Ban User**: Permanently blocks user identity. Revokes sessions, terminates sockets, and broadcasts offline presence.
  - **Unsuspend / Unban**: Restores account to `ACTIVE` state.
  - **Self-Moderation Prevention**: Administrators cannot suspend or ban their own accounts.

### 2.3 Abuse Reports & Moderation Queue (`/admin/reports`)
- **Privacy-Preserving Triage**: The server never decrypts or inspects E2EE messages. Reports contain safe metadata (`targetType`, `targetId`, user-selected reason, description).
- **Status Filter Tabs**: `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `DISMISSED`, `ALL`.
- **Sliding Resolution Drawer**:
  - Review report details and reported user's prior violation record.
  - Execute resolution action: `DISMISS`, `WARN`, `SUSPEND`, or `BAN`.
  - **Mandatory Audit Rationale**: Admins must enter an explanation before applying moderation actions.
  - **Real-Time Notification**: Warnings dispatch real-time `user:warning` socket events and push alerts to the target user while maintaining complete reporter anonymity.

### 2.4 Tamper-Evident Audit Logs (`/admin/audit-logs`)
Every administrative operation is captured in the immutable `AuditLog` collection:
- `adminUserId` & `adminUsername`
- `action` (`USER_SUSPENDED`, `USER_BANNED`, `USER_WARNED`, `REPORT_RESOLVED`, etc.)
- `targetType` and `targetId`
- `ipAddress`, `userAgent`, and `requestId`
- `reason` and associated metadata

---

## 3. Provisioning Administrators

### Method 1: CLI Provisioning Tool
```bash
pnpm --filter @chatlock/server admin:promote <email|username>
```

### Method 2: Startup Environment Bootstrap
Set `ADMIN_BOOTSTRAP_EMAIL=admin@chatlock.com` in `apps/server/.env`. On startup, the server automatically promotes this account if it exists.
