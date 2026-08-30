# ChatLock — Database Domain Models & Architecture

This document details the MongoDB data models, schema definitions, relationships, and indexing strategies implemented in Mongoose for the **ChatLock** platform.

---

## 1. Domain Entities & Relationships

```
+----------------+          1:N          +------------------+
|      User      | <--------------------+ |     Session      |
+----------------+                       +------------------+
  |            |
  | 1:N        | 1:N
  v            v
+----------------+          1:N          +------------------+
|  Conversation  | <--------------------+ |     Message      |
+----------------+                       +------------------+
                                           |                |
                                           | 1:N            | 1:N
                                           v                v
                                 +------------------+  +------------------+
                                 |  MessageReceipt  |  |      Device      |
                                 +------------------+  +------------------+
```

---

## 2. Schema Specifications

### 2.1 User (`UserModel`)

Represents registered user identities and profile status.

| Field                     | Type      | Attributes                                             | Description                                             |
| ------------------------- | --------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `email`                   | `String`  | Required, Unique, Lowercase, Trim, Indexed             | User login email address                                |
| `username`                | `String`  | Required, Unique, Lowercase, Trim, Indexed             | Public handle (alphanumeric + `_`)                      |
| `displayName`             | `String`  | Required, Trim, Max: 50                                | Display name shown in UI                                |
| `passwordHash`            | `String`  | Required, `select: false`                              | Bcrypt password hash (excluded from queries by default) |
| `avatarUrl`               | `String`  | Optional, Trim                                         | Profile picture CDN URL                                 |
| `bio`                     | `String`  | Optional, Trim, Max: 200                               | User biography                                          |
| `status`                  | `String`  | Enum: `['online', 'offline', 'away', 'busy']`, Indexed | Real-time presence status                               |
| `lastSeenAt`              | `Date`    | Default: `Date.now`                                    | Last activity timestamp                                 |
| `isEmailVerified`         | `Boolean` | Default: `false`                                       | Email verification flag                                 |
| `twoFactorEnabled`        | `Boolean` | Default: `false`                                       | 2FA protection flag                                     |
| `createdAt` / `updatedAt` | `Date`    | Automatic timestamps                                   | Record creation/update timestamps                       |

---

### 2.2 Session (`SessionModel`)

Tracks active authentication sessions and refresh token hashes.

| Field                     | Type       | Attributes                         | Description                             |
| ------------------------- | ---------- | ---------------------------------- | --------------------------------------- |
| `userId`                  | `ObjectId` | Required, Ref: `'User'`, Indexed   | Associated user                         |
| `tokenHash`               | `String`   | Required, Unique, Trim, Indexed    | SHA-256 hash of the refresh token       |
| `deviceId`                | `String`   | Required, Trim, Indexed            | Hardware / client device identifier     |
| `expiresAt`               | `Date`     | Required, TTL Index (`expires: 0`) | Automatic document expiration timestamp |
| `revokedAt`               | `Date`     | Default: `null`                    | Session revocation timestamp            |
| `createdAt` / `updatedAt` | `Date`     | Automatic timestamps               | Creation & rotation timestamps          |

---

### 2.3 Conversation (`ConversationModel`)

Represents 1-to-1 direct chats, group chats, and broadcast channels.

| Field           | Type         | Attributes                                                | Description                                                                 |
| --------------- | ------------ | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `type`          | `String`     | Required, Enum: `['direct', 'group', 'channel']`, Indexed | Conversation modality                                                       |
| `title`         | `String`     | Optional, Trim, Max: 100                                  | Group / channel title                                                       |
| `avatarUrl`     | `String`     | Optional, Trim                                            | Group avatar                                                                |
| `creatorId`     | `ObjectId`   | Optional, Ref: `'User'`                                   | Group creator                                                               |
| `participants`  | `[ObjectId]` | Required, Ref: `'User'`, Indexed                          | Member user IDs                                                             |
| `admins`        | `[ObjectId]` | Optional, Ref: `'User'`                                   | Group administrator user IDs                                                |
| `lastMessageId` | `ObjectId`   | Optional, Ref: `'Message'`                                | Pointer to most recent message                                              |
| `lastMessageAt` | `Date`       | Default: `Date.now`, Indexed (Desc)                       | Timestamp for inbox sorting                                                 |
| `directKey`     | `String`     | Unique, Sparse, Trim, Indexed                             | Deterministic sorted pair (`userA:userB`) preventing duplicate direct chats |
| `isArchived`    | `Boolean`    | Default: `false`                                          | Archive status                                                              |

---

### 2.4 Message (`MessageModel`)

Independent message documents decoupled from conversation objects.

| Field              | Type           | Attributes                                                              | Description                                 |
| ------------------ | -------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| `conversationId`   | `ObjectId`     | Required, Ref: `'Conversation'`, Indexed                                | Target conversation                         |
| `senderId`         | `ObjectId`     | Required, Ref: `'User'`, Indexed                                        | Message author                              |
| `clientMessageId`  | `String`       | Required, Trim, Indexed                                                 | Client UUID for idempotency                 |
| `type`             | `String`       | Required, Enum: `['text', 'image', 'file', 'audio', 'video', 'system']` | Content type                                |
| `content`          | `String`       | Required, Trim, Max: 5000                                               | Message payload text                        |
| `attachments`      | `[Attachment]` | Subdocument array                                                       | Media attachment metadata (URL, mime, size) |
| `replyToMessageId` | `ObjectId`     | Optional, Ref: `'Message'`                                              | Threading / quote reply reference           |
| `editedAt`         | `Date`         | Default: `null`                                                         | Edit timestamp                              |
| `deletedAt`        | `Date`         | Default: `null`                                                         | Soft delete timestamp                       |

---

### 2.5 MessageReceipt (`MessageReceiptModel`)

Tracks delivery and read state per participant per message.

| Field            | Type       | Attributes                                      | Description                     |
| ---------------- | ---------- | ----------------------------------------------- | ------------------------------- |
| `messageId`      | `ObjectId` | Required, Ref: `'Message'`, Indexed             | Target message                  |
| `conversationId` | `ObjectId` | Required, Ref: `'Conversation'`, Indexed        | Associated conversation         |
| `userId`         | `ObjectId` | Required, Ref: `'User'`, Indexed                | Recipient user                  |
| `status`         | `String`   | Required, Enum: `['sent', 'delivered', 'read']` | Delivery stage                  |
| `deliveredAt`    | `Date`     | Default: `null`                                 | Delivery confirmation timestamp |
| `readAt`         | `Date`     | Default: `null`                                 | Read confirmation timestamp     |

---

### 2.6 Device (`DeviceModel`)

Tracks active mobile/web devices and push notification tokens.

| Field          | Type       | Attributes                                  | Description                        |
| -------------- | ---------- | ------------------------------------------- | ---------------------------------- |
| `userId`       | `ObjectId` | Required, Ref: `'User'`, Indexed            | Device owner                       |
| `deviceId`     | `String`   | Required, Trim, Indexed                     | Hardware/instance unique ID        |
| `pushToken`    | `String`   | Optional, Trim, Sparse Indexed              | APNs / FCM push notification token |
| `platform`     | `String`   | Required, Enum: `['ios', 'android', 'web']` | Operating platform                 |
| `appVersion`   | `String`   | Required, Trim                              | Client application version         |
| `lastActiveAt` | `Date`     | Default: `Date.now`                         | Heartbeat timestamp                |
| `isActive`     | `Boolean`  | Default: `true`, Indexed                    | Active device flag                 |

---

## 3. Database Indexes & Justification

| Collection        | Index Fields                                  | Type               | Query Pattern & Justification                                      |
| ----------------- | --------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `users`           | `{ email: 1 }`                                | Unique             | Fast user login lookup by email                                    |
| `users`           | `{ username: 1 }`                             | Unique             | Fast profile lookup and uniqueness check                           |
| `users`           | `{ status: 1 }`                               | Single field       | Filter active online users                                         |
| `sessions`        | `{ tokenHash: 1 }`                            | Unique             | Fast refresh token validation                                      |
| `sessions`        | `{ userId: 1 }`                               | Single field       | Revoke all sessions for a user                                     |
| `sessions`        | `{ expiresAt: 1 }`                            | TTL (`expires: 0`) | Automated eviction of expired sessions                             |
| `sessions`        | `{ userId: 1, deviceId: 1 }`                  | Compound           | Target session per device                                          |
| `conversations`   | `{ participants: 1 }`                         | Multikey           | Find all conversations for a specific user                         |
| `conversations`   | `{ lastMessageAt: -1 }`                       | Single field       | Sort user inbox by most recent activity                            |
| `conversations`   | `{ participants: 1, lastMessageAt: -1 }`      | Compound           | Fast indexed retrieval of user inbox sorted by date                |
| `conversations`   | `{ directKey: 1 }`                            | Unique, Sparse     | Strictly prevents duplicate 1-to-1 conversations between two users |
| `messages`        | `{ conversationId: 1, createdAt: -1 }`        | Compound           | Fast paginated chat history retrieval                              |
| `messages`        | `{ senderId: 1, clientMessageId: 1 }`         | Unique Compound    | Idempotent message deduplication per client dispatch               |
| `messageReceipts` | `{ messageId: 1, userId: 1 }`                 | Unique Compound    | Ensures exactly 1 receipt status per user per message              |
| `messageReceipts` | `{ conversationId: 1, userId: 1, status: 1 }` | Compound           | High-performance unread count computation                          |
| `devices`         | `{ userId: 1, deviceId: 1 }`                  | Unique Compound    | Prevents duplicate device records per user                         |
| `devices`         | `{ pushToken: 1 }`                            | Sparse             | Lookup device by APNs/FCM push token                               |
| `devices`         | `{ userId: 1, isActive: 1 }`                  | Compound           | Target all active devices of a user for push notifications         |
