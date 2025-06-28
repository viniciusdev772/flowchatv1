# Code Patterns - FlowChat WhatsApp API

## Key Function Locations & Patterns

### Core Message Processing (src/app.js)
**Key Functions:**
- `extractMessageData()` - Main message processing with webhook delivery
- `extractQuotedMessage()` - Quoted message handling with media downloads  
- `downloadMediaToFile()` - Media download and URL generation
- `saveDownloadMetadata()` - MongoDB persistence for download metadata
- `enrichWebhookMessage()` - Message enhancement for webhook delivery

**Pattern Example:**
```javascript
// Message processing pipeline
const messageData = await extractMessageData(message, sessionId);
if (message.message?.quotedMessage) {
    messageData.quotedMessage = await extractQuotedMessage(message, sessionId);
}
await deliverToWebhooks(sessionId, messageData);
```

### Session Management Pattern
**Global Access:**
```javascript
// Global sessions accessible across modules
global.whatsappSessions = new Map();

// Access pattern in any module
const session = global.whatsappSessions.get(sessionId);
if (!session) {
    throw new Error('Session not found');
}
```

### Authentication Patterns
**Dual Authentication System:**
```javascript
// 1. Session-based (Frontend)
app.use(session({
    store: new MongoStore({ mongoUrl: process.env.MONGODB_URI }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// 2. Token-based (API)
const validateApiToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token?.startsWith('baileys_')) {
        return res.status(401).json({ error: 'Invalid token format' });
    }
    // Validate token...
};
```

### Error Handling Patterns
**Graceful Degradation:**
```javascript
// Database operation with fallback
try {
    await mongoOperation();
} catch (error) {
    console.warn('MongoDB operation failed, using memory fallback');
    // Continue with in-memory operation
}
```

### Media Processing Pattern
**Async Media Pipeline:**
```javascript
const downloadMediaToFile = async (message, sessionId) => {
    try {
        const buffer = await downloadMediaMessage(message, 'buffer');
        const fileId = generateUniqueId();
        const fileName = `${fileId}_${originalName}`;
        
        await fs.writeFile(`downloads/${fileName}`, buffer);
        await saveDownloadMetadata(fileId, fileName, sessionId);
        
        return `${baseUrl}/api/baileys/downloads/${fileId}`;
    } catch (error) {
        console.error('Media download failed:', error);
        return null;
    }
};
```

## Architectural Patterns

### Middleware Chain Pattern
**Security Layer Stack:**
```javascript
// Order matters - security first
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // CORS handling
app.use(csrfProtection); // CSRF validation
app.use(authenticateUser); // User authentication
app.use(routes); // Application routes
```

### Repository Pattern Implementation
**Data Access Abstraction:**
```javascript
class SessionRepository {
    async save(sessionId, data) {
        try {
            // MongoDB operation
            await this.db.collection('sessions').updateOne(
                { sessionId },
                { $set: data },
                { upsert: true }
            );
        } catch (error) {
            // Fallback to memory
            this.memoryStore.set(sessionId, data);
        }
    }
}
```

### Observer Pattern for Events
**Webhook Delivery System:**
```javascript
// Event registration
const eventHandlers = new Map();

// Register webhook
const registerWebhook = (sessionId, webhook) => {
    if (!eventHandlers.has(sessionId)) {
        eventHandlers.set(sessionId, []);
    }
    eventHandlers.get(sessionId).push(webhook);
};

// Event notification
const notifyWebhooks = async (sessionId, eventData) => {
    const webhooks = eventHandlers.get(sessionId) || [];
    for (const webhook of webhooks.sort(by('priority'))) {
        await deliverWebhook(webhook, eventData);
    }
};
```

### Factory Pattern for Sessions
**Dynamic Session Creation:**
```javascript
const createWhatsAppSession = async (sessionId, options = {}) => {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_sessions/${sessionId}`);
    
    const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        ...options
    });
    
    socket.ev.on('messages.upsert', async (messageUpdate) => {
        await handleMessageUpdate(messageUpdate, sessionId);
    });
    
    global.whatsappSessions.set(sessionId, socket);
    return socket;
};
```

## Common Code Patterns

### Error Boundaries
**Try-Catch with Fallbacks:**
```javascript
const robustOperation = async (operation, fallback) => {
    try {
        return await operation();
    } catch (error) {
        console.error('Operation failed:', error);
        return fallback ? await fallback() : null;
    }
};
```

### Async Queue Processing
**Message Queue Pattern:**
```javascript
const messageQueue = [];
const processQueue = async () => {
    while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        try {
            await processMessage(message);
        } catch (error) {
            console.error('Message processing failed:', error);
            // Consider retry logic or dead letter queue
        }
    }
};
```

### Configuration Management
**Environment-Based Config:**
```javascript
const config = {
    port: process.env.PORT || 3000,
    mongoUri: process.env.MONGODB_URI,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    sessionSecret: process.env.SESSION_SECRET,
    // Fallback values for development
    development: {
        logLevel: 'debug',
        enableFallbacks: true
    }
};
```

### Logging Patterns
**Structured Logging with Pino:**
```javascript
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard'
        }
    }
});

// Usage pattern
logger.info({ sessionId, messageId }, 'Message processed successfully');
logger.error({ error: error.message, stack: error.stack }, 'Operation failed');
```

### Validation Patterns
**Express Validator Usage:**
```javascript
const validateMessage = [
    body('to').isMobilePhone().withMessage('Invalid phone number'),
    body('message').isLength({ min: 1 }).withMessage('Message cannot be empty'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];
```

### Caching Patterns
**In-Memory Cache with TTL:**
```javascript
const cache = new Map();
const cacheWithTTL = (key, value, ttl = 300000) => { // 5 minutes
    cache.set(key, {
        value,
        expires: Date.now() + ttl
    });
    
    setTimeout(() => cache.delete(key), ttl);
};

const getCached = (key) => {
    const item = cache.get(key);
    if (!item || Date.now() > item.expires) {
        cache.delete(key);
        return null;
    }
    return item.value;
};
```

## Performance Patterns

### Database Query Optimization
**Projection and Indexing:**
```javascript
// Optimized query with projection
const users = await db.collection('users').find(
    { active: true },
    { projection: { password: 0, internalNotes: 0 } }
).toArray();

// Compound index for common queries
await db.collection('sessions').createIndex({ 
    sessionId: 1, 
    lastActivity: -1 
});
```

### Memory Management
**Cleanup Patterns:**
```javascript
const cleanupExpiredSessions = () => {
    const now = Date.now();
    for (const [sessionId, session] of global.whatsappSessions) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            session.end?.();
            global.whatsappSessions.delete(sessionId);
        }
    }
};

// Periodic cleanup
setInterval(cleanupExpiredSessions, 300000); // 5 minutes
```

### Resource Pooling
**Connection Pool Pattern:**
```javascript
const { MongoClient } = require('mongodb');

class DatabaseConnection {
    static instance = null;
    
    static async getInstance() {
        if (!this.instance) {
            this.instance = await MongoClient.connect(process.env.MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000
            });
        }
        return this.instance;
    }
}
```

## Testing Patterns (Recommended)
**Unit Test Structure:**
```javascript
describe('Message Processing', () => {
    beforeEach(() => {
        // Setup test environment
        global.whatsappSessions = new Map();
    });
    
    it('should extract message data correctly', async () => {
        const mockMessage = createMockMessage();
        const result = await extractMessageData(mockMessage, 'test-session');
        
        expect(result).toHaveProperty('messageId');
        expect(result).toHaveProperty('from');
        expect(result).toHaveProperty('body');
    });
    
    afterEach(() => {
        // Cleanup
        global.whatsappSessions.clear();
    });
});
```