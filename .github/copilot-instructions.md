# Copilot Instructions for FlowChat API

This document guides AI coding agents working in this codebase, providing essential patterns and conventions.

## Core Architecture

### Server Architecture (Node.js + Express)

The application follows a multi-layered architecture with clear separation of concerns:

```js
// Server class initialization pattern (main.js)
class Server {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }
}
```

Key components:

- `main.js`: Entry point with Server class orchestrating Express setup
- `src/app.js`: Core WhatsApp functionality using Baileys
- `src/api/`: Route handlers by domain (groups, messages, AI features)
- `src/config/`: Configuration management with fallback strategies
- `src/middleware/`: Layered security (CSRF, API token, headers)
- Global `sessions` Map and `whatsappSessions` for state management

### Frontend Architecture (React + Vite)

The frontend follows modern React patterns and best practices:

- Shadcn UI components in `frontend/src/components/ui/`
- Custom hooks in `frontend/src/hooks/` for API and state management
- Feature-based organization in `frontend/src/pages/`
- Shared React components in `frontend/src/components/`

## Key Patterns

### Session & State Management

````js
// WhatsApp session management pattern
const sessions = new Map(); // In-memory session storage
const { state } = await useMultiFileAuthState(`auth_sessions/${sessionId}`);

// Database persistence with fallback
const db = await database.connect();
if (!db && process.env.NODE_ENV === 'development') {
  console.log('Running without database in development mode');
}

### Security Implementation

Multiple security layers with defense in depth:
```js
// Security middleware chain in main.js
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: function(origin, callback) {
    // Allow configured origins and no-origin requests
    if (!origin) return callback(null, true);
    // Additional origin validation logic
  }
}));
app.use(apiTokenAuth);
````

### WhatsApp Integration

Key integration points with Baileys library:

````js
// Session initialization pattern
const { state, saveCreds } = await useMultiFileAuthState(
  path.resolve(`auth_sessions/${sessionId}`)
);

// Connection handling
sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update;
  if (connection === 'open') {
    // Handle successful connection
  }
});

## Development Workflow

### Environment Setup

1. Create environment configuration:
```bash
cp .env.example .env
````

2. Launch development services:

```bash
# Backend development with hot reload
npm run dev

# Frontend development
npm run frontend

# Full stack development
npm run dev:full
```

### AI Features Integration

The project includes advanced AI capabilities:

1. Message Summarization:

```js
// Configurable summary tones in src/api/aiSummary.js
const SUMMARY_PROMPTS = {
  professional: {
    system: 'You are a professional assistant...',
    tone: 'professional and objective',
  },
  casual: {
    system: 'You are a friendly assistant...',
    tone: 'casual and friendly',
  },
  // Additional tones available
};
```

2. Real-time AI Chat:

- Streaming responses with SSE
- Tool execution via MCP server
- Message collection with configurable filters

### Testing and Quality Assurance

- Unit tests in `__tests__` directories
- Integration tests with Supertest
- E2E testing with Cypress
- Manual testing flows documented in test plans

## Common Patterns and Tasks

### Error Handling

Standard error handling pattern:

```js
try {
  // Operation logic
} catch (error) {
  logger.error(`Operation failed: ${error.message}`);
  res.status(500).json({
    success: false,
    message: error.message,
  });
}
```

### Adding New Features

1. WhatsApp Features:

   - Update Swagger spec in `src/config/swagger.js`
   - Create route handler in `src/api/`
   - Implement security checks
   - Add webhook support if needed

2. Frontend Components:
   - Place new components in `frontend/src/components/`
   - Utilize shadcn/ui base components
   - Implement proper error boundaries
   - Follow existing styling patterns

### AI Integration Guidelines

When working with AI features:

1. Message summarization:

   - Use predefined tones in `SUMMARY_PROMPTS`
   - Handle rate limiting and errors
   - Implement proper streaming

2. Real-time chat:
   - Use SSE for streaming
   - Implement proper error recovery
   - Follow the MCP protocol for tool execution

### Error Handling Pattern

```js
try {
  // Operation logic
} catch (error) {
  logger.error(`Operation failed: ${error.message}`);
  res.status(500).json({
    success: false,
    message: error.message,
  });
}
```

## Project Commands

### Backend

```bash
npm start              # Production start
npm run dev           # Development with hot reload
npm run monitor      # Development with logging
```
