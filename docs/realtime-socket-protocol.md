# ChatLock — Real-Time WebSocket & Socket.IO Protocol Specification

This document details the Socket.IO real-time event protocol, handshake authentication, room subscription model, dual-room broadcasting, delivery receipts, ephemeral typing indicators, and presence synchronization for **ChatLock**.

---

## 1. Socket Gateway Architecture

The real-time layer operates over Socket.IO 4.8 with WebSocket transport prioritized. In a distributed multi-instance deployment, state and events are coordinated across nodes via `@socket.io/redis-adapter`.

```
[ Mobile / Web Client ] <====== WSS (Socket.IO 4.8) ======> [ Socket Gateway ]
                                                                   |
                 +-------------------------------------------------+-------------------------------------------------+
                 |                                                 |                                                 |
                 v                                                 v                                                 v
      [ Authentication Handshake ]                       [ Room Subscriptions ]                           [ Duplex Event Handlers ]
     - Bearer JWT token verification                    - `conversation:{id}`                            - `message:send`
     - Account active status check                      - `user:{userId}`                                - `message:reaction`
     - Sockets keyed in ConnectionManager               - Strict authorization checks                    - `message:delivered` / `read`
                                                                                                         - `typing:start` / `stop`
                                                                                                         - `presence:heartbeat`
```

---

## 2. Handshake Authentication & Connection Lifecycle

### 2.1 Handshake Flow
1. **Client Connection**: Client initiates connection passing JWT token in `auth.token` or `headers.authorization`.
2. **Signature Verification**: Middleware (`apps/server/src/socket/middleware/auth.socket.middleware.ts`) verifies the JWT signature and expiration.
3. **Account Status Check**: Checks user account status. If `SUSPENDED` or `BANNED`, the socket connection is rejected immediately.
4. **Context Injection**: Attaches `socket.data.user = { id, email, username, role }`.
5. **Connection Registry**: Registers socket ID in `ConnectionManager` (handles multi-tab and multi-device connections).
6. **Automatic User Room**: Automatically joins `user:${userId}` room for direct system notifications and push events.

---

## 3. Room Management & Dual-Room Broadcasting

ChatLock employs a **Dual-Room Broadcasting Model** to ensure real-time responsiveness across both active chat screens and backgrounded conversation lists:

```
                                      [ message:send Payload ]
                                                 |
                                                 v
                          +----------------------------------------------+
                          |        Socket.IO Server Dispatcher           |
                          +----------------------+-----------------------+
                                                 |
                        +------------------------+------------------------+
                        |                                                 |
                        v                                                 v
           [ Room: `conversation:{id}` ]                      [ Rooms: `user:{participantId}` ]
           - For users inside active chat screen              - For backgrounded/inactive participants
           - Triggers live message append                     - Updates inbox snippets & unread badges
           - Triggers 0ms bubble render                       - Delivers push notifications if socket idle
```

### Room Security
Clients can only join `conversation:{id}` if the authenticated `socket.data.user.id` is a verified participant of that conversation. Unauthorized join attempts are rejected with `FORBIDDEN`.

---

## 4. Socket.IO Event Specification

### 4.1 Client-to-Server Events

| Event Name | Payload Contract | Description |
| :--- | :--- | :--- |
| `room:join` | `{ conversationId: string }` | Joins a conversation room after membership verification. |
| `room:leave` | `{ conversationId: string }` | Leaves a conversation room. |
| `message:send` | `{ conversationId, clientMessageId, content, type, attachments?, encryptionState?, e2eePayload? }` | Sends a message (E2EE ciphertext or plaintext). Server persists, sends ACK callback, and broadcasts. |
| `message:reaction` | `{ messageId: string, emoji: string }` | Toggles an emoji reaction atomically. |
| `message:delivered` | `{ messageId: string, conversationId: string }` | Signals that a message was received by client. |
| `message:read` | `{ messageId: string, conversationId: string }` | Signals that a message was viewed by user. |
| `typing:start` | `{ conversationId: string }` | Signals that the user started typing. |
| `typing:stop` | `{ conversationId: string }` | Signals that the user stopped typing. |
| `presence:heartbeat` | `{}` | 25s client loop refreshing Redis presence TTL. |

---

### 4.2 Server-to-Client Events

| Event Name | Payload Contract | Description |
| :--- | :--- | :--- |
| `message:new` | `IMessage` (Full message object with `e2eePayload` & receipts) | Emitted to `conversation:*` and `user:*` when a new message is saved. |
| `message:sent` | `{ clientMessageId, serverMessageId, createdAt }` | ACK emitted back to sender to confirm persistence. |
| `message:reaction` | `{ messageId, reactions: Array<{ emoji, users, count }> }` | Emitted when a reaction is added or removed. |
| `message:delivered` | `{ messageId, userId, deliveredAt }` | Emitted when recipient receives a message. |
| `message:read` | `{ messageId, userId, readAt }` | Emitted when recipient views a message. |
| `typing:update` | `{ conversationId, userId, username, isTyping }` | Emitted to conversation room when typing state changes. |
| `presence:update` | `{ userId, status: 'online' \| 'offline', lastSeenAt }` | Broadcasts user presence changes. |
| `user:warning` | `{ reason: string, issuedAt: string }` | Emitted directly to user socket when admin issues a warning. |
| `account:evicted` | `{ reason: string }` | Emitted before terminating socket when account is suspended or banned. |

---

## 5. Monotonic Delivery & Read Receipts Lifecycle

Receipts strictly follow a unidirectional state progression:

$$\text{pending} \longrightarrow \text{sent} \longrightarrow \text{delivered} \longrightarrow \text{read}$$

1. **`pending`**: Message created locally in client memory (`0ms optimistic`).
2. **`sent` (Single checkmark ✓)**: Server has persisted message in MongoDB and initialized `MessageReceipt` record.
3. **`delivered` (Double grey checkmarks ✓✓)**: Recipient client received packet via socket and emitted `message:delivered`.
4. **`read` (Double cyan checkmarks ✓✓)**: Recipient client displayed message on active screen and emitted `message:read`.

```
[ Sender ]                    [ Server ]                    [ Recipient ]
    |                              |                              |
    |--- 1. message:send --------->|                              |
    |<-- 2. message:sent (✓) ------|                              |
    |                              |--- 3. message:new ---------->|
    |                              |<-- 4. message:delivered -----|
    |<-- 5. message:delivered(✓✓)--|                              |
    |                              |   [ User opens chat screen ] |
    |                              |<-- 6. message:read ----------|
    |<-- 7. message:read (✓✓ blue)-|                              |
```

---

## 6. Ephemeral Presence & Typing Engine

### 6.1 Presence Tracking (Zero Database Writes on Heartbeat)
- **Redis TTL Keys**: Active users refresh `presence:{userId}` in Redis every 25s with a 60s TTL.
- **Durable Persistence on Disconnect**: Only upon complete socket disconnection does the server perform a durable MongoDB write to update `lastSeenAt` and `status: 'offline'`, minimizing database write IOPS.

### 6.2 Typing Debounce & Expiration
- **Composer Debounce**: Mobile/Web client debounces keystrokes with a 3000ms idle threshold before emitting `typing:stop`.
- **Auto-Expiration Guard**: The server automatically expires typing indicators after 4000ms if a `typing:stop` packet is lost in transit due to network drops.

---

## 7. Socket Rate Limiting & Abuse Defense

To prevent denial-of-service (DoS) and message spamming, Socket.IO handlers are wrapped with a sliding-window rate limiter (`apps/server/src/socket/middleware/rate-limit.socket.middleware.ts`):
- **Limit**: Max **40 operations per second** per connected socket.
- **Penalty**: Exceeding the threshold returns an error callback and temporarily throttles event processing without dropping the connection.
