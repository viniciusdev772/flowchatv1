# System Patterns - FlowChat WhatsApp API

## System Architecture
### Backend Architecture
- **Class-based Express.js** with singleton patterns
- **main.js**: Server entry point with class-based Express setup
- **src/app.js**: Core Baileys WhatsApp logic (2000+ lines) with global session management
- **src/api/groups.js**: WhatsApp group operations API handler
- **src/config/**: Database connection with fallback and Swagger configuration
- **src/middleware/**: Layered security (CSRF, API token auth, security headers)
- **src/routes/**: Route aggregation with management API structure

### Frontend Architecture
- **React 19 + Vite** with performance-conscious design
- **Apple Liquid Glass UI** with Tailwind CSS custom theme
- **Framer Motion** animations with device performance detection
- **Component-based structure** with reusable webhook management

## Key Technical Decisions
- **Global Session Management**: `global.whatsappSessions` Map for cross-module access
- **Graceful Database Fallback**: Continues without MongoDB in development
- **Priority-based Webhooks**: Up to 3 webhooks per session with ordering
- **Dual Authentication**: User sessions + API tokens ("baileys_" prefix)
- **Media Auto-download**: All media automatically cached with 7-day expiration
- **In-memory Caching**: 5-minute user cache for performance optimization

## Design Patterns in Use
### Singleton Pattern
- **Database Connection**: Single shared connection across application
- **Global Sessions**: `whatsappSessions` object accessible everywhere
- **Logger Instance**: Shared Pino logger configuration

### Observer Pattern
- **Webhook System**: Event-driven notifications for message events
- **Connection Updates**: Real-time broadcasting of connection status
- **Message Processing**: Async event handling with `messages.upsert`

### Factory Pattern
- **Session Creation**: Dynamic WhatsApp session instantiation
- **Middleware Stack**: Configurable security middleware chain
- **API Response**: Standardized response formatting

### Strategy Pattern
- **Authentication**: Multiple auth strategies (session + token)
- **Media Processing**: Different handlers for various media types
- **Database Operations**: Fallback strategies for development mode

### Repository Pattern
- **Data Access**: Abstracted database operations with fallbacks
- **Session Storage**: Unified interface for memory + MongoDB storage
- **Media Storage**: Centralized file system operations
