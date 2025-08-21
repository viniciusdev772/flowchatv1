# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is FlowChat API - a sophisticated WhatsApp multi-session API built with Node.js, Express, and Baileys library. It provides:
- Multi-session WhatsApp bot management with QR code authentication
- Group management functionality with comprehensive operations
- Media handling, file uploads, and Base64 encoding for webhooks
- Webhook system supporting up to 3 webhooks per session with priorities
- MongoDB integration with graceful development fallback
- React 19 frontend with Apple Liquid Glass design and Framer Motion
- Integrated AI Assistant with streaming chat interface and OpenAI integration

## Architecture

### Backend Architecture
The project follows a class-based Express.js architecture with singleton patterns:

- **main.js** - Server entry point with class-based Express setup
- **src/app.js** - Core Baileys WhatsApp logic with global session management
- **src/api/groups.js** - WhatsApp group operations API handler
- **src/config/** - Database connection with fallback and Swagger configuration
- **src/middleware/** - Layered security: CSRF, API token auth, security headers
- **src/controllers/authController.js** - Authentication business logic
- **src/routes/** - Route aggregation with management API structure

### Frontend Architecture
React 19 + Vite with performance-conscious design:

- **frontend/src/App.jsx** - Main app with React Router and Apple-inspired UI
- **frontend/src/pages/** - Login, Dashboard, and AI Assistant pages
- **frontend/src/components/WebhookManager.jsx** - Webhook configuration component
- **frontend/src/components/AIStreamingChat.jsx** - Streaming AI chat interface with tool execution and message collector integration
- **frontend/src/components/MarkdownRenderer.jsx** - Rich markdown rendering for AI responses
- **frontend/src/components/MessageCollectorManager.jsx** - Group message collection management interface
- **frontend/src/components/AISummaryPanel.jsx** - AI-powered message summarization with multiple tones
- **Styling**: Tailwind CSS with custom Apple Liquid Glass theme
- **Animation**: Framer Motion with device performance detection

## Development Commands

```bash
# Backend development with hot reload
npm run dev

# Frontend development 
npm run frontend

# Run both backend + frontend simultaneously
npm run dev:full

# Production start
npm start

# Frontend build
npm run frontend:build

# Frontend preview (after build)
npm run frontend:preview

# Install frontend dependencies
npm run install:frontend

# Frontend development commands
cd frontend && npm run dev               # Frontend dev server only
cd frontend && npm run build             # Build frontend for production
cd frontend && npm run preview           # Preview built frontend
cd frontend && npm run lint              # Lint frontend code

# Docker commands (if using containers)
docker-compose up -d                    # Start all services
docker-compose --profile nginx up -d    # Include Nginx proxy
docker-compose logs -f                  # View logs
docker-compose down                     # Stop services

# Syntax validation
node -c src/app.js                      # Check app.js syntax
node -c main.js                         # Check main entry point

# Test scraping functionality (development utility)
node test-scraping.js                   # Test web scraping and ZIP generation tools
```

## Key Technical Details

### Session Management
- In-memory sessions stored in `sessions` Map
- WhatsApp auth persistence in `auth_sessions/` directory
- Global `whatsappSessions` object accessible across all modules
- Automatic reconnection handling and QR code authentication

### Database Integration
- MongoDB with graceful development fallback (continues without DB)
- Connect-mongo session store with connection pooling
- Database connection management in src/config/database.js
- Development mode operates fully without database dependency

### Security Architecture
- Dual authentication: user sessions + API tokens ("baileys_" prefix)
- CSRF protection with token validation (src/middleware/csrf.js)
- Helmet security headers with CORS credential support
- Layered middleware chain: security → auth → CSRF

### Media & File Handling
- File uploads to `uploads/` directory with Multer processing
- Media downloads cached in `downloads/` directory
- Base64 encoding pipeline for webhook media transmission
- Automatic cleanup and file management

### Webhook System & Message Processing
- Priority-based webhook ordering (up to 3 per session)
- Real-time event broadcasting with connection.update events
- Webhook data persistence in memory Maps and MongoDB
- Performance mode detection for optimal delivery
- **Message Organization**: Webhooks deliver structured data distinguishing between group and private messages
- **Quoted Message Support**: Full extraction and download of quoted media content
- **Auto-download**: All media automatically downloaded and provided as direct URLs
- **Event Types**: `messages.upsert`, `connection.update`, and other Baileys events

## Environment Requirements

Required environment variables:
- `MONGODB_URI` - MongoDB connection string
- `DB_NAME` - Database name
- `SESSION_SECRET` - Session secret key
- `COOKIE_SECRET` - Cookie signing secret
- `CORS_ORIGIN` - Frontend URL (default: http://localhost:5173)
- `PORT` - Server port (default: 3000)
- `AUTO_MARK_READ` - Controls automatic read receipts (default: true, set to 'false' to disable)

## API Structure

- **Management API**: `/api/management/*` - User authentication, tokens, sessions
- **Baileys API**: `/api/baileys/*` - WhatsApp operations (messages, media, QR codes)
- **Groups API**: `/api/baileys/groups/*` - Group management with comprehensive operations
- **Message Collector API**: `/api/message-collector/*` - Automated group message collection
- **AI Summary API**: `/api/ai-summary/*` - AI-powered message summarization and analysis
- **AI Agents API**: `/api/ai-agents/*` - AI agent management with web search capabilities
- **Documentation**: `/api-docs` - Swagger UI with complete API reference
- **Health Check**: `/api/management/health` - Server status endpoint

## Development Environment

### Port Configuration
- **Backend**: Port 3000 (configurable via PORT env var)
- **Frontend**: Port 5173 (Vite development server)
- **CORS**: Configured for http://localhost:5173 by default

### Testing & Quality
- **No formal test suite** - Only placeholder test script in package.json
- **Frontend linting**: ESLint configuration for code quality (`npm run lint` in frontend/)
- **Manual testing utilities**: test-scraping.js for testing web scraping functionality
- **Webhook testing**: Built-in test endpoints for webhook validation
- Development-focused error handling with Pino logging
- Comprehensive API documentation via Swagger

## Recent Optimizations & Features

### Enhanced Webhook System with Quoted Message Support
Recent improvements to the webhook system include comprehensive quoted message handling:

1. **Quoted Message Downloads**: Automatic media download for quoted messages (images, videos, audio, documents, stickers)
2. **Download URL Generation**: Full download URLs for quoted media with MongoDB persistence
3. **Boolean Indicator**: Added `hasQuotedMessage` field for easy webhook processing
4. **Comprehensive Media Support**: All media types in quoted messages now include download metadata
5. **Async Processing**: Improved performance with proper async/await handling

### Media Download Enhancements
- **Direct Download URLs**: Public access to media without authentication requirements
- **Quoted Media Processing**: Full media extraction and storage for quoted content
- **File Type Detection**: Improved extension detection for voice messages and other audio formats
- **MongoDB Persistence**: All download metadata stored persistently with 7-day expiration
- **Automatic Cleanup**: Scheduled cleanup of expired downloads every 6 hours

### Profile API Performance Enhancement
The `/api/management/auth/profile` endpoint has been optimized for faster response times:

1. **User Caching**: Implemented 5-minute in-memory cache for authenticated users
2. **Database Query Optimization**: Reduced projection fields, excluding unnecessary data
3. **Middleware Optimization**: Removed redundant rate limiting for profile endpoint
4. **Controller Simplification**: Eliminated unnecessary try-catch for simple operations
5. **Cache Management**: Added cache invalidation on profile updates

### Performance Improvements
- **~60-80% reduction** in database queries for authenticated requests
- **~40-50% faster** profile endpoint response times
- **Memory efficient** caching with automatic cleanup
- **Graceful degradation** maintains functionality if caching fails

### AI Assistant Integration
The frontend now includes a comprehensive AI Assistant feature:

1. **Streaming Chat Interface**: Real-time message streaming with tool execution visualization
2. **OpenAI Integration**: Configurable API key support with custom model selection
3. **Tool Execution**: Visual feedback for AI tool usage and execution status
4. **Markdown Rendering**: Rich text rendering with syntax highlighting for code blocks
5. **Auto-scroll Management**: Intelligent scrolling behavior during streaming responses
6. **Performance Detection**: Adaptive UI based on device performance capabilities
7. **FlowChat API Integration**: AI can interact with WhatsApp sessions, groups, and webhooks

### Message Collector & AI Summarization System
Advanced group message monitoring and intelligent analysis:

1. **Automated Message Collection**: Schedule collection tasks to monitor group messages during specified hours
2. **Smart Filtering**: Captures all text messages including spam for comprehensive analysis  
3. **Time-based Collection**: Configure start/end hours with timezone support for precise monitoring
4. **Real-time Monitoring**: Server-side collection runs continuously during configured periods
5. **AI-Powered Summarization**: Multiple summary tones (Professional, Casual, Analytical, Brief)
6. **Streaming Summaries**: Real-time summary generation with progress feedback
7. **Sentiment Analysis**: Advanced emotion and theme detection in group conversations
8. **Export Capabilities**: Download summaries in markdown format for external use
9. **Batch Processing**: Intelligent handling of large message volumes (thousands per day)
10. **Custom Prompts**: User-defined AI instructions for specialized analysis

## Important Architectural Patterns

### Global State Management
- **Session Storage**: `global.whatsappSessions` object accessible across modules
- **In-Memory Maps**: Sessions and webhooks data stored in memory
- **Singleton Database**: Single database connection shared across application

### Authentication Flow
- **Dual Authentication**: User sessions for frontend + API tokens for external access
- **API Token Format**: Must be prefixed with "baileys_" for validation
- **Session Persistence**: MongoDB session store with connect-mongo integration

### Error Handling & Logging
- **Graceful Degradation**: Application continues without MongoDB in development
- **Comprehensive Logging**: Pino logger with detailed request/response tracking
- **Development Fallbacks**: Memory stores when database unavailable

### Critical Implementation Details
- **Core Logic Location**: The main business logic resides in `src/app.js`
- **Message Processing**: `extractMessageData()` function handles all message types and webhook delivery
- **Media Processing**: `downloadMediaToFile()` and `extractQuotedMessage()` handle media downloads
- **Global Sessions**: `global.whatsappSessions` Map stores all active WhatsApp connections
- **Download System**: Unique download IDs with 7-day expiration stored in MongoDB
- **File Extensions**: Smart detection based on mimetype and message type (PTT detection)
- **AI Agent Persistence**: OpenAI API keys are now saved in MongoDB and restored on server restart
- **Agent Health Monitoring**: System tracks agent health including API key status, activity, and auto-reply settings

## Code Maintenance Guidelines
- NEVER create files unless absolutely necessary for the goal
- ALWAYS prefer editing existing files over creating new ones  
- NEVER proactively create documentation files unless explicitly requested
- Follow existing code patterns and conventions
- Test API endpoints with Swagger documentation at `/api-docs`
- Verify environment variables before deployment
- Monitor session management in logs

## Development & Debugging

### Key Functions to Understand
- **`extractMessageData()`**: Core message processing with webhook delivery
- **`extractQuotedMessage()`**: Quoted message handling with media downloads  
- **`downloadMediaToFile()`**: Media download and URL generation
- **`saveDownloadMetadata()`**: MongoDB persistence for download metadata
- **`enrichWebhookMessage()`**: Message enhancement for webhook delivery

### Common Debug Patterns
- Check `global.whatsappSessions` for active connections
- Monitor `downloads/` directory for media files
- Verify MongoDB collections: `downloads`, `sessions`, `users`
- Watch webhook delivery logs with session and priority information
- Check QR code generation in `auth_sessions/` directory

### Important Async Patterns
- All message processing functions are async
- Webhook delivery happens asynchronously after message processing
- Media downloads run in parallel with message processing
- Database operations have fallback mechanisms for development mode

### Key Development Utilities
- **test-scraping.js**: Standalone utility for testing web scraping, search, and ZIP generation features
- **Frontend Hot Reload**: Vite development server with instant updates
- **Database Graceful Fallback**: Continues operation without MongoDB in development mode
- **Class-based Server Architecture**: Server class in main.js with proper lifecycle management