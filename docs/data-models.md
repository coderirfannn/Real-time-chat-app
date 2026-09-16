# ChatLock — Database Domain Models & Schema Architecture

This document provides the complete specification of the MongoDB data models, Mongoose schemas, subdocument structures, compound indexes, TTL eviction rules, and relational integrity constraints in **ChatLock**.

---

## 1. Domain Entities & ER Diagram

```
+-------------------+            1:N            +-------------------+
|       User        | <------------------------ |      Session      |
|  (role, status)   |                           |  (tokenHash, TTL) |
+-------------------+                           +-------------------+
   |        |        \
   | 1:N    | 1:N     +-------- 1:N -----------> +-------------------+
   |        |                                   |     DeviceKey     |
   |        v                                   | (IK, SPK, OPKs)   |
   |   +-------------------+                    +-------------------+
   |   |   Conversation    |                              ^
   |   | (directKey, msgs) |                              |
   |   +-------------------+                              |
   |        |                                             |
   |        | 1:N                                         |
   v        v                                             |
+-------------------+            1:N            +-------------------+
|      Message      | <------------------------ |  MessageReceipt   |
| (E2EE/plain, rxn) |                           | (sent, deliv, read)|
+-------------------+                           +-------------------+
   |
   +-------- 1:N -----------> +-------------------+
   |                          |      Report       |
   |                          | (target, status)  |
   |                          +-------------------+
   |
   +-------- 1:N -----------> +-------------------+
                              |     AuditLog      |
                              | (admin, action)   |
                              +-------------------+
```

---

## 2. Complete Schema Specifications

### 2.1 User Model (`users` collection)
Stores user account credentials, public profile, role-based authorization, and presence state.

```typescript
interface IUser {
  _id: Types.ObjectId;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string; // select: false
  avatarUrl?: string;
  bio?: string;
  role: 'USER' | 'ADMIN';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeenAt: Date;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ email: 1 }` (Unique)
- `{ username: 1 }` (Unique)
- `{ role: 1, accountStatus: 1 }` (Compound index for admin verification)
- `{ status: 1 }` (Single field)

---

### 2.2 Session Model (`sessions` collection)
Stores active login sessions and SHA-256 hashed refresh tokens for RFC 6819 rotation.

```typescript
interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string; // SHA-256 hash of plaintext refresh token
  deviceId: string;
  expiresAt: Date; // MongoDB TTL index
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ tokenHash: 1 }` (Unique)
- `{ userId: 1 }` (Lookup active user sessions)
- `{ userId: 1, deviceId: 1 }` (Target session per device)
- `{ expiresAt: 1 }` with `expireAfterSeconds: 0` (Automatic TTL document cleanup)

---

### 2.3 Conversation Model (`conversations` collection)
Represents 1-to-1 direct chats, group conversations, and broadcast channels.

```typescript
interface IConversation {
  _id: Types.ObjectId;
  type: 'direct' | 'group' | 'channel';
  title?: string;
  avatarUrl?: string;
  creatorId?: Types.ObjectId;
  participants: Types.ObjectId[];
  admins?: Types.ObjectId[];
  lastMessageId?: Types.ObjectId;
  lastMessage?: {
    content: string;
    senderId: Types.ObjectId;
    createdAt: Date;
  };
  lastMessageAt: Date;
  directKey?: string; // Sorted "userA:userB" for 1-to-1 deduplication
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ participants: 1, lastMessageAt: -1 }` (High-performance user inbox sorting)
- `{ directKey: 1 }` (Unique, Sparse: strictly guarantees 1 conversation per user pair)

---

### 2.4 Message Model (`messages` collection)
Independent message records supporting both End-to-End Encrypted (E2EE) ciphertext payloads and legacy plaintext bodies, attachments, and emoji reactions.

```typescript
interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderDeviceId?: string;
  clientMessageId: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
  content: string; // Plaintext or ciphertext fallback
  encryptionState: 'LEGACY_PLAINTEXT' | 'E2EE';
  e2eePayload?: {
    ciphertext: string;
    nonce: string;
    ratchetKey: string;
    pn: number;
    n: number;
    initHeader?: {
      version: number;
      initiatorUserId: string;
      initiatorDeviceId: string;
      initiatorEphemeralKey: string;
      recipientDeviceId: string;
      signedPreKeyId: number;
      oneTimePreKeyId?: number;
    };
  };
  attachments?: Array<{
    id: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    fileName?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    durationMs?: number;
  }>;
  reactions?: Array<{
    emoji: string;
    users: Types.ObjectId[];
    count: number;
  }>;
  replyToMessageId?: Types.ObjectId;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ conversationId: 1, createdAt: -1 }` (Cursor-paginated chat history retrieval)
- `{ senderId: 1, clientMessageId: 1 }` (Unique compound: client idempotency deduplication)

---

### 2.5 MessageReceipt Model (`messageReceipts` collection)
Tracks delivery and read state per participant per message.

```typescript
interface IMessageReceipt {
  _id: Types.ObjectId;
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  status: 'sent' | 'delivered' | 'read';
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ messageId: 1, userId: 1 }` (Unique compound: exactly 1 receipt status per user per message)
- `{ conversationId: 1, userId: 1, status: 1 }` (Fast unread count calculation)

---

### 2.6 Device & Push Token Model (`devices` collection)
Maintains registered hardware devices and APNs / FCM push notification tokens.

```typescript
interface IDevice {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string; // Persistent UUID (SecureStore / KeyStore)
  pushToken?: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  lastActiveAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ userId: 1, deviceId: 1 }` (Unique compound)
- `{ pushToken: 1 }` (Sparse index for push token lookup)
- `{ userId: 1, isActive: 1 }` (Active device broadcast target)

---

### 2.7 DeviceKey Model (`deviceKeys` collection)
Stores public cryptographic material for the Signal Protocol (X3DH) implementation. Private keys are NEVER stored here.

```typescript
interface IDeviceKey {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string;
  identityKey: string; // Public Ed25519 hex
  signedPreKey: {
    keyId: number;
    publicKey: string; // Public X25519 hex
    signature: string; // Ed25519 signature hex
    createdAt: Date;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    publicKey: string; // Public X25519 hex
    consumed: boolean; // Set atomically when claimed
    consumedAt?: Date;
  }>;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ userId: 1, deviceId: 1 }` (Unique compound)
- `{ userId: 1, status: 1 }` (Lookup active cryptographic devices)
- `{ 'oneTimePreKeys.consumed': 1 }` (Fast unconsumed OPK retrieval)

---

### 2.8 Abuse Report Model (`reports` collection)
Captures user moderation reports with zero inspection of encrypted message contents.

```typescript
interface IReport {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  targetType: 'USER' | 'MESSAGE' | 'CONVERSATION';
  targetId: string;
  reason: 'HARASSMENT' | 'SPAM' | 'HATE_SPEECH' | 'INAPPROPRIATE_CONTENT' | 'IMPERSONATION' | 'OTHER';
  description?: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  actionTaken?: 'NONE' | 'WARNED' | 'SUSPENDED' | 'BANNED';
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes**:
- `{ reporterId: 1, targetType: 1, targetId: 1, status: 1 }` (Compound: prevents duplicate active reports)
- `{ status: 1, createdAt: -1 }` (Admin moderation queue sorting)

---

### 2.9 AuditLog Model (`auditLogs` collection)
Provides an immutable, tamper-evident audit trail of all administrative and moderation actions.

```typescript
interface IAuditLog {
  _id: Types.ObjectId;
  adminUserId: Types.ObjectId;
  adminUsername: string;
  action: 'USER_SUSPENDED' | 'USER_UNSUSPENDED' | 'USER_BANNED' | 'USER_UNBANNED' | 'USER_WARNED' | 'REPORT_RESOLVED' | 'REPORT_DISMISSED';
  targetType: 'USER' | 'REPORT' | 'CONVERSATION' | 'SYSTEM';
  targetId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
```
**Indexes**:
- `{ adminUserId: 1, createdAt: -1 }`
- `{ action: 1, createdAt: -1 }`
- `{ targetId: 1, createdAt: -1 }`
