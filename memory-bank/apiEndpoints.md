# API Endpoints - FlowChat WhatsApp API

## Authentication Endpoints
### User Authentication
- `POST /api/management/auth/login` - User login with credentials
- `POST /api/management/auth/logout` - User logout and session cleanup
- `GET /api/management/auth/profile` - Get current user profile (cached 5 min)
- `GET /api/management/auth/verify` - Verify current session status

### API Token Management
- `POST /api/management/tokens/create` - Create new API token (prefix: "baileys_")
- `GET /api/management/tokens/list` - List user's API tokens
- `DELETE /api/management/tokens/:tokenId` - Delete specific API token

## WhatsApp Session Management
### Session Operations
- `POST /api/baileys/sessions/start` - Start new WhatsApp session
- `GET /api/baileys/sessions/qr/:sessionId` - Get QR code for authentication
- `GET /api/baileys/sessions/status/:sessionId` - Get session connection status
- `DELETE /api/baileys/sessions/:sessionId` - Stop and remove session
- `GET /api/baileys/sessions/list` - List all active sessions

### Connection Management
- `POST /api/baileys/sessions/:sessionId/connect` - Force reconnection
- `POST /api/baileys/sessions/:sessionId/disconnect` - Graceful disconnect
- `GET /api/baileys/sessions/:sessionId/info` - Get session information

## Message Operations
### Send Messages
- `POST /api/baileys/sessions/:sessionId/send-message` - Send text message
- `POST /api/baileys/sessions/:sessionId/send-media` - Send media message
- `POST /api/baileys/sessions/:sessionId/send-location` - Send location
- `POST /api/baileys/sessions/:sessionId/send-contact` - Send contact card

### Message Management
- `GET /api/baileys/sessions/:sessionId/messages` - Get message history
- `DELETE /api/baileys/sessions/:sessionId/messages/:messageId` - Delete message
- `POST /api/baileys/sessions/:sessionId/react` - React to message

## Group Management (src/api/groups.js)
### Group Operations
- `GET /api/baileys/groups/:sessionId/list` - List all groups
- `POST /api/baileys/groups/:sessionId/create` - Create new group
- `PUT /api/baileys/groups/:sessionId/:groupId/info` - Update group info
- `DELETE /api/baileys/groups/:sessionId/:groupId` - Leave group

### Group Member Management
- `POST /api/baileys/groups/:sessionId/:groupId/add-participants` - Add members
- `POST /api/baileys/groups/:sessionId/:groupId/remove-participants` - Remove members
- `POST /api/baileys/groups/:sessionId/:groupId/promote` - Promote to admin
- `POST /api/baileys/groups/:sessionId/:groupId/demote` - Demote from admin

### Group Settings
- `PUT /api/baileys/groups/:sessionId/:groupId/settings` - Update group settings
- `PUT /api/baileys/groups/:sessionId/:groupId/description` - Update description
- `POST /api/baileys/groups/:sessionId/:groupId/invite-link` - Generate invite link

## Webhook Management
### Webhook Configuration
- `POST /api/baileys/sessions/:sessionId/webhooks` - Add webhook (max 3)
- `GET /api/baileys/sessions/:sessionId/webhooks` - List session webhooks
- `PUT /api/baileys/sessions/:sessionId/webhooks/:webhookId` - Update webhook
- `DELETE /api/baileys/sessions/:sessionId/webhooks/:webhookId` - Remove webhook

### Webhook Testing
- `POST /api/baileys/sessions/:sessionId/webhooks/:webhookId/test` - Test webhook
- `GET /api/baileys/sessions/:sessionId/webhooks/logs` - Get delivery logs

## Media Handling
### File Operations
- `POST /api/baileys/sessions/:sessionId/upload` - Upload media file
- `GET /api/baileys/downloads/:downloadId` - Download media file
- `GET /api/baileys/sessions/:sessionId/media/:messageId` - Get message media

### Media Processing
- `POST /api/baileys/sessions/:sessionId/process-media` - Process uploaded media
- `GET /api/baileys/media/info/:fileId` - Get media information

## System Endpoints
### Health & Status
- `GET /api/management/health` - Server health check
- `GET /api/management/status` - System status and statistics
- `GET /api/management/version` - API version information

### Documentation
- `GET /api-docs` - Swagger UI documentation
- `GET /api-docs.json` - OpenAPI specification

## Authentication Methods

### 1. Session Authentication (Frontend)
- Cookie-based sessions with MongoDB storage
- CSRF token protection required
- Used by React frontend application

### 2. API Token Authentication (External)
- Bearer token in Authorization header
- Token must have "baileys_" prefix
- Used for external API integrations

### Example Headers
```javascript
// Session-based (Frontend)
{
  "Cookie": "session_id=abc123...",
  "X-CSRF-Token": "csrf_token_here"
}

// Token-based (API)
{
  "Authorization": "Bearer baileys_your_token_here"
}
```

## Response Formats
### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

## Rate Limiting
- Global rate limiting applied to all endpoints
- Different limits for authenticated vs unauthenticated requests
- WebSocket connections for real-time updates

## WebSocket Events
- `connection.update` - Session connection status changes
- `messages.upsert` - New messages received
- `webhook.delivery` - Webhook delivery status
- `session.status` - Session status updates