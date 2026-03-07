# WorkNext Frontend API Handoff

This document is the current contract handoff for frontend iteration and beautification work.

It covers:

- implemented product capabilities
- remaining Phase 1 gaps
- HTTP API contracts already available
- recommended API contracts for not-yet-implemented features
- realtime socket events
- current frontend integration notes

## 1. Runtime Summary

- API base URL: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/docs`
- Web app: `http://localhost:3000`
- Storage mode: local file-backed JSON store
- Uploaded file base URL: `http://localhost:3001/uploads/...`
- Auth model: bearer access token plus HTTP-only refresh cookie

## 2. Implemented Features

### Auth and Session

- register
- login
- refresh access token by cookie
- logout current session
- get current user

### Workspaces and Membership

- list my workspaces
- create workspace
- invite member by email
- revoke pending invitation
- accept invitation by token
- list members
- update member role
- remove member
- leave workspace for non-owner accounts

### Channels

- list workspace channels
- create public channels
- create private channels
- list channel members
- add private channel member
- remove private channel member
- unread counts per channel

### Messaging

- list messages with cursor pagination
- send message
- edit own message
- soft delete own message
- mark channel as read
- attachment references on messages

### Files and Attachments

- upload local file into workspace scope
- validate file size and mime type
- link uploaded attachment ids when sending a message
- serve uploaded assets from `/uploads`

### Notifications

- mention parsing on message create and update
- in-app mention notifications
- list notifications
- mark one notification as read
- mark all notifications as read

### Realtime

- socket authentication with access token
- workspace room join
- channel room join
- message created broadcast
- message updated broadcast
- message deleted broadcast
- typing events
- presence heartbeat events

## 3. Remaining Phase 1 Gaps

These are still not implemented and should be treated as open work.

### Product and Domain Gaps

- optimistic UI updates are still limited
- notification badge summary endpoint is not exposed separately

### Realtime and Infra Gaps

- Redis Socket.IO adapter is not implemented
- multi-instance delivery guarantees are not implemented
- delivery acknowledgement and reconciliation are not implemented

### Engineering Gaps

- centralized exception filter is not added yet
- rate limiting and helmet hardening are not added yet
- unit, integration, and E2E coverage are still limited
- PostgreSQL and Redis production runtime path is not the active local path
- storage abstraction for S3-compatible providers is not implemented yet

## 4. Shared Response Shapes

### AuthUser

```json
{
  "id": "user_id",
  "email": "tester@worknext.local",
  "displayName": "Tester"
}
```

### WorkspaceSummary

```json
{
  "id": "workspace_id",
  "name": "Product",
  "slug": "product",
  "role": "OWNER",
  "createdAt": "2025-03-06T10:00:00.000Z",
  "updatedAt": "2025-03-06T10:00:00.000Z"
}
```

### ChannelSummary

```json
{
  "id": "channel_id",
  "workspaceId": "workspace_id",
  "name": "general",
  "description": "Default team channel",
  "type": "PUBLIC",
  "createdAt": "2025-03-06T10:00:00.000Z",
  "updatedAt": "2025-03-06T10:00:00.000Z",
  "unreadCount": 2,
  "memberCount": 5,
  "isMember": true
}
```

### ChannelMemberSummary

```json
{
  "userId": "user_id",
  "email": "tester@worknext.local",
  "displayName": "Tester",
  "joinedAt": "2025-03-06T10:00:00.000Z",
  "isCurrentUser": false
}
```

### FileAttachmentSummary

```json
{
  "id": "attachment_id",
  "workspaceId": "workspace_id",
  "messageId": "message_id",
  "originalName": "roadmap.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 24567,
  "url": "/uploads/attachment_id.pdf",
  "createdAt": "2025-03-06T10:00:00.000Z"
}
```

### MessageSummary

```json
{
  "id": "message_id",
  "workspaceId": "workspace_id",
  "channelId": "channel_id",
  "content": "Hello @tester",
  "createdAt": "2025-03-06T10:00:00.000Z",
  "updatedAt": "2025-03-06T10:00:00.000Z",
  "deletedAt": null,
  "isDeleted": false,
  "isOwnMessage": true,
  "attachments": [
    {
      "id": "attachment_id",
      "workspaceId": "workspace_id",
      "messageId": "message_id",
      "originalName": "roadmap.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 24567,
      "url": "/uploads/attachment_id.pdf",
      "createdAt": "2025-03-06T10:00:00.000Z"
    }
  ],
  "sender": {
    "id": "user_id",
    "displayName": "Tester"
  }
}
```

### NotificationSummary

```json
{
  "id": "notification_id",
  "workspaceId": "workspace_id",
  "userId": "user_id",
  "type": "MENTION",
  "title": "Alice mentioned you",
  "body": "hello @tester please review",
  "channelId": "channel_id",
  "messageId": "message_id",
  "readAt": null,
  "createdAt": "2025-03-06T10:00:00.000Z"
}
```

## 5. Implemented HTTP APIs

All protected endpoints require:

- `Authorization: Bearer <accessToken>`
- valid workspace membership for workspace-scoped resources

### 5.1 Health

`GET /health`

Response:

```json
{
  "status": "ok",
  "service": "worknext-api",
  "timestamp": "2025-03-06T10:00:00.000Z",
  "mode": "local",
  "storagePath": "/home/reny/worknext/apps/api/.data/worknext.json",
  "checks": {
    "storage": "up"
  },
  "metrics": {
    "users": 2,
    "workspaces": 1,
    "channels": 1,
    "messages": 12
  }
}
```

### 5.2 Auth

`POST /auth/register`

Request:

```json
{
  "email": "tester@worknext.local",
  "password": "Worknext123!",
  "displayName": "Tester"
}
```

Response:

```json
{
  "accessToken": "jwt_access_token",
  "user": {
    "id": "user_id",
    "email": "tester@worknext.local",
    "displayName": "Tester"
  }
}
```

`POST /auth/login`

Request:

```json
{
  "email": "tester@worknext.local",
  "password": "Worknext123!"
}
```

Response matches `POST /auth/register`.

`POST /auth/refresh`

- no JSON body required
- requires refresh cookie

Response matches `POST /auth/register`.

`POST /auth/logout`

Response:

```json
{
  "success": true
}
```

`GET /auth/me`

Response:

```json
{
  "id": "user_id",
  "email": "tester@worknext.local",
  "displayName": "Tester"
}
```

### 5.3 Workspaces

`GET /workspaces`

Response: `WorkspaceSummary[]`

`POST /workspaces`

Request:

```json
{
  "name": "Product"
}
```

Response: `WorkspaceSummary`

### 5.4 Workspace Members

`GET /workspaces/:workspaceId/members`

Response:

```json
[
  {
    "userId": "user_id",
    "email": "tester@worknext.local",
    "displayName": "Tester",
    "role": "OWNER",
    "joinedAt": "2025-03-06T10:00:00.000Z",
    "isCurrentUser": true
  }
]
```

`PATCH /workspaces/:workspaceId/members/:memberUserId`

Request:

```json
{
  "role": "ADMIN"
}
```

Response: updated member summary.

`DELETE /workspaces/:workspaceId/members/:memberUserId`

Response:

```json
{
  "success": true
}
```

`POST /workspaces/:workspaceId/leave`

Response:

```json
{
  "success": true
}
```

### 5.5 Invitations

`GET /workspaces/:workspaceId/invitations`

Response: `WorkspaceInvitationSummary[]`

`POST /workspaces/:workspaceId/invitations`

Request:

```json
{
  "email": "collab.member@worknext.local",
  "role": "MEMBER"
}
```

Response:

```json
{
  "id": "invitation_id",
  "workspaceId": "workspace_id",
  "email": "collab.member@worknext.local",
  "role": "MEMBER",
  "token": "invitation_token",
  "createdAt": "2025-03-06T10:00:00.000Z",
  "expiresAt": "2025-03-13T10:00:00.000Z",
  "acceptedAt": null,
  "invitedBy": {
    "id": "user_id",
    "displayName": "Tester",
    "email": "tester@worknext.local"
  }
}
```

`POST /workspaces/invitations/accept`

Request:

```json
{
  "token": "invitation_token"
}
```

Response: `WorkspaceSummary`

`DELETE /workspaces/:workspaceId/invitations/:invitationId`

Response:

```json
{
  "success": true
}
```

### 5.6 Channels

`GET /workspaces/:workspaceId/channels`

Response: `ChannelSummary[]`

`POST /workspaces/:workspaceId/channels`

Request:

```json
{
  "name": "engineering",
  "description": "Daily delivery coordination",
  "type": "PUBLIC"
}
```

Response: `ChannelSummary`

`GET /workspaces/:workspaceId/channels/:channelId/members`

Response: `ChannelMemberSummary[]`

For public channels, this returns workspace members.

For private channels, this returns explicit channel members.

`POST /workspaces/:workspaceId/channels/:channelId/members`

Request:

```json
{
  "userId": "user_id"
}
```

Response: `ChannelMemberSummary`

`DELETE /workspaces/:workspaceId/channels/:channelId/members/:memberUserId`

Response:

```json
{
  "success": true
}
```

### 5.7 Files

`GET /workspaces/:workspaceId/files`

Response: `FileAttachmentSummary[]`

`POST /workspaces/:workspaceId/files`

- multipart form data
- field name: `file`
- size limit: 10 MB

Response: `FileAttachmentSummary`

Allowed mime families:

- `image/*`
- `text/*`
- `application/pdf`

### 5.8 Messages

`GET /workspaces/:workspaceId/channels/:channelId/messages?limit=20&cursor=<messageId>`

Response:

```json
{
  "items": [
    {
      "id": "message_id",
      "workspaceId": "workspace_id",
      "channelId": "channel_id",
      "content": "Hello",
      "createdAt": "2025-03-06T10:00:00.000Z",
      "updatedAt": "2025-03-06T10:00:00.000Z",
      "deletedAt": null,
      "isDeleted": false,
      "isOwnMessage": true,
      "attachments": [],
      "sender": {
        "id": "user_id",
        "displayName": "Tester"
      }
    }
  ],
  "nextCursor": null
}
```

`POST /workspaces/:workspaceId/channels/:channelId/messages`

Request:

```json
{
  "content": "Please review @tester",
  "attachmentIds": ["attachment_id"]
}
```

Response: `MessageSummary`

`PATCH /workspaces/:workspaceId/channels/:channelId/messages/:messageId`

Request:

```json
{
  "content": "Updated message text"
}
```

Response: updated `MessageSummary`

`DELETE /workspaces/:workspaceId/channels/:channelId/messages/:messageId`

Response: updated soft-deleted `MessageSummary`

`POST /workspaces/:workspaceId/channels/:channelId/messages/read`

Response:

```json
{
  "success": true
}
```

### 5.9 Notifications

`GET /notifications`

Optional query:

- `workspaceId`

Response: `NotificationSummary[]`

`PATCH /notifications/:notificationId/read`

Response:

```json
{
  "success": true
}
```

`POST /notifications/read-all`

Optional query:

- `workspaceId`

Response:

```json
{
  "success": true
}
```

## 6. Implemented Realtime Events

Socket namespace:

- `/realtime`

Socket auth:

- `auth.token = <accessToken>`

### Client -> Server

`workspace:join`

```json
{
  "workspaceId": "workspace_id"
}
```

`channel:join`

```json
{
  "workspaceId": "workspace_id",
  "channelId": "channel_id"
}
```

`typing:start`

```json
{
  "workspaceId": "workspace_id",
  "channelId": "channel_id"
}
```

`presence:heartbeat`

```json
{
  "workspaceId": "workspace_id"
}
```

### Server -> Client

`message:created`

- payload: `MessageSummary`

`message:updated`

- payload: `MessageSummary`

`message:deleted`

- payload: `MessageSummary`

`typing:update`

```json
{
  "workspaceId": "workspace_id",
  "channelId": "channel_id",
  "userId": "user_id",
  "displayName": "Tester",
  "isTyping": true,
  "emittedAt": "2025-03-06T10:00:00.000Z"
}
```

`presence:update`

```json
{
  "workspaceId": "workspace_id",
  "userId": "user_id",
  "displayName": "Tester",
  "status": "online",
  "lastSeenAt": "2025-03-06T10:00:00.000Z"
}
```

## 7. Recommended APIs For Remaining Work

These are not implemented yet, but frontend should be designed to accommodate them.

### 7.1 Notification Summary Endpoint

Recommended endpoint:

`GET /notifications/summary`

Response:

```json
{
  "totalUnread": 4,
  "byWorkspace": [
    {
      "workspaceId": "workspace_id",
      "unread": 4
    }
  ]
}
```

### 7.2 Storage Abstraction and Cloud Uploads

Recommended future endpoint shape if direct-to-cloud upload is added:

`POST /workspaces/:workspaceId/files/presign`

```json
{
  "fileName": "roadmap.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 24567
}
```

Response:

```json
{
  "uploadUrl": "https://...",
  "attachment": {
    "id": "attachment_id",
    "workspaceId": "workspace_id",
    "messageId": null,
    "originalName": "roadmap.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 24567,
    "url": "https://cdn.example.com/roadmap.pdf",
    "createdAt": "2025-03-06T10:00:00.000Z"
  }
}
```

## 8. Current Frontend Notes For Gemini

The current frontend is intentionally functional-first and lives mostly in a single screen.

Current behavior:

- auth is register/login on one landing screen
- workspace rail, channel rail, and conversation view are on one page
- members, invitations, and notifications live as top info cards
- message composer supports text plus attachments
- uploaded attachments are shown as pills before send
- sent message attachments render as links

What Gemini can safely improve without breaking behavior:

- split the shell into multiple components
- replace the visual design completely
- add better empty states, skeletons, and optimistic feedback
- improve mobile hierarchy and responsive layout
- add richer attachment preview cards
- add a dedicated notifications drawer or inbox

What Gemini should not change unless backend changes too:

- auth token plus refresh-cookie model
- workspace-scoped routing assumptions
- message pagination cursor semantics
- attachment upload shape using multipart field `file`
- notification read endpoints and message mention semantics

## 9. Current Test Accounts

- `tester@worknext.local` / `Worknext123!`
- `collab.member@worknext.local` / `Worknext123!`