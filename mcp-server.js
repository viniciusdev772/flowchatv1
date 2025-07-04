#!/usr/bin/env node

/**
 * FlowChat API MCP Server
 * 
 * Production-ready MCP server implementing all Baileys WhatsApp API endpoints
 * with API token authentication and comprehensive security features.
 * 
 * Based on 2025 best practices:
 * - API Token authentication (baileys_ prefix)
 * - Rate limiting and security headers
 * - Comprehensive error handling
 * - All API routes from Swagger documentation
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

// Environment configuration
const config = {
  apiBaseUrl: process.env.BASE_URL || 'http://localhost:3000',
  timeout: parseInt(process.env.API_TIMEOUT || '30000'),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT || '100'),
};

// Rate limiting implementation
class RateLimiter {
  constructor(limit, windowMs = 60000) {
    this.requests = new Map();
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(identifier) {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.limit) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }
}

// Authentication manager
class AuthManager {
  constructor() {
    this.rateLimiter = new RateLimiter(config.rateLimitPerMinute);
    this.tokenCache = new Map(); // Cache validated tokens for 5 minutes
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Clean cache every 10 minutes
    setInterval(() => {
      this.cleanExpiredCache();
    }, 10 * 60 * 1000);
  }

  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, data] of this.tokenCache.entries()) {
      if ((now - data.timestamp) > this.cacheTimeout) {
        this.tokenCache.delete(token);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.error(`🧹 Cleaned ${cleaned} expired tokens from cache`);
    }
  }

  async validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('baileys_')) {
      return false;
    }
    
    // Check cache first
    const cached = this.tokenCache.get(apiKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.valid;
    }
    
    // Real validation against the API itself
    try {
      console.error(`Validating API key: ${apiKey.substring(0, 15)}...`);
      const response = await axios.get(`${config.apiBaseUrl}/api/baileys/info`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'FlowChat-MCP-Server/1.0.0'
        },
        timeout: 5000
      });
      
      const isValid = response.status === 200 && response.data.success;
      
      // Cache the result
      this.tokenCache.set(apiKey, {
        valid: isValid,
        timestamp: Date.now()
      });
      
      console.error(`API key validation result: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    } catch (error) {
      console.error('API key validation failed:', error.response?.status || error.message);
      
      // Cache invalid result for a shorter time (1 minute)
      this.tokenCache.set(apiKey, {
        valid: false,
        timestamp: Date.now()
      });
      
      return false;
    }
  }

  async authenticate(authorization) {
    if (!authorization) {
      throw new McpError(ErrorCode.InvalidRequest, 'Authorization header required');
    }

    const [scheme, credential] = authorization.split(' ');

    if (scheme === 'Bearer' && credential.startsWith('baileys_')) {
      const isValid = await this.validateApiKey(credential);
      if (!isValid) {
        throw new McpError(ErrorCode.InvalidRequest, 'Invalid API key - authentication failed');
      }
      return credential; // Return the actual token for rate limiting
    }

    throw new McpError(ErrorCode.InvalidRequest, 'Invalid authorization scheme. Use: Bearer baileys_your_key');
  }

  checkRateLimit(identifier) {
    if (!this.rateLimiter.check(identifier)) {
      throw new McpError(ErrorCode.InvalidRequest, 'Rate limit exceeded. Please wait before making more requests.');
    }
  }
}

// HTTP client with authentication
class AuthenticatedHttpClient {
  constructor() {
    this.authManager = new AuthManager();
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FlowChat-MCP-Server/1.0.0',
      },
    });

    // Request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      // Add default API key if no authorization header
      if (!config.headers.Authorization && config.apiKey) {
        config.headers.Authorization = `Bearer ${config.apiKey}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new McpError(ErrorCode.InvalidRequest, 'Authentication failed - check your API key');
        }
        if (error.response?.status === 403) {
          throw new McpError(ErrorCode.InvalidRequest, 'Access forbidden - insufficient permissions');
        }
        if (error.response?.status === 429) {
          throw new McpError(ErrorCode.InvalidRequest, 'Rate limit exceeded by API server');
        }
        if (error.response?.status === 404) {
          throw new McpError(ErrorCode.InvalidRequest, `Endpoint not found: ${error.config?.url}`);
        }
        throw new McpError(
          ErrorCode.InternalError,
          `API request failed: ${error.message}`
        );
      }
    );
  }

  async request(method, path, data, authorization) {
    const userId = await this.authManager.authenticate(authorization);
    this.authManager.checkRateLimit(userId);

    const requestConfig = {
      method: method.toLowerCase(),
      url: path,
      headers: authorization ? { Authorization: authorization } : {},
    };

    if (data) {
      if (method.toUpperCase() === 'GET') {
        requestConfig.params = data;
      } else {
        requestConfig.data = data;
      }
    }

    const response = await this.client.request(requestConfig);
    return response.data;
  }
}

// All available tools based on Swagger documentation
const TOOLS = [
  // Session Management
  {
    name: 'create_session',
    description: 'Create a new WhatsApp session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Unique session identifier' },
        webhookUrl: { type: 'string', description: 'Optional webhook URL' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'get_session_status',
    description: 'Get session connection status and QR code',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'list_sessions',
    description: 'List all active sessions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_session',
    description: 'Delete a session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to delete' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'regenerate_qr',
    description: 'Regenerate QR code for session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'cleanup_orphaned_sessions',
    description: 'Cleanup orphaned sessions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  
  // Message Operations
  {
    name: 'send_message',
    description: 'Send text message',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        jid: { type: 'string', description: 'Recipient JID (phone@s.whatsapp.net or groupId@g.us)' },
        message: { type: 'string', description: 'Message text' },
        replyToId: { type: 'string', description: 'Message ID to reply to' },
      },
      required: ['sessionId', 'jid', 'message'],
    },
  },
  {
    name: 'send_media',
    description: 'Send media message (image, video, audio, document)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        jid: { type: 'string', description: 'Recipient JID' },
        mediaType: { 
          type: 'string', 
          enum: ['image', 'video', 'audio', 'document'],
          description: 'Type of media' 
        },
        mediaUrl: { type: 'string', description: 'URL or base64 of media' },
        caption: { type: 'string', description: 'Media caption' },
        fileName: { type: 'string', description: 'File name for documents' },
      },
      required: ['sessionId', 'jid', 'mediaType', 'mediaUrl'],
    },
  },
  {
    name: 'reply_message',
    description: 'Reply to a specific message',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        jid: { type: 'string', description: 'Chat JID' },
        messageId: { type: 'string', description: 'Message ID to reply to' },
        message: { type: 'string', description: 'Reply text' },
      },
      required: ['sessionId', 'jid', 'messageId', 'message'],
    },
  },
  {
    name: 'mention_all',
    description: 'Mention all participants in a group',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        message: { type: 'string', description: 'Message text' },
      },
      required: ['sessionId', 'groupId', 'message'],
    },
  },
  {
    name: 'smart_reply',
    description: 'Generate AI-powered smart reply',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        jid: { type: 'string', description: 'Chat JID' },
        context: { type: 'string', description: 'Message context for AI' },
        tone: { type: 'string', enum: ['professional', 'casual', 'friendly'], description: 'Reply tone' },
        language: { type: 'string', description: 'Response language (pt, en, es)' },
      },
      required: ['sessionId', 'jid', 'context'],
    },
  },

  // Chat Controls
  {
    name: 'mark_read',
    description: 'Mark messages as read',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        jid: { type: 'string', description: 'Chat JID' },
        messageIds: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Message IDs to mark as read' 
        },
      },
      required: ['sessionId', 'jid', 'messageIds'],
    },
  },
  {
    name: 'typing_indicator',
    description: 'Control typing indicator',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        jid: { type: 'string', description: 'Chat JID' },
        isTyping: { type: 'boolean', description: 'Start (true) or stop (false) typing' },
      },
      required: ['sessionId', 'jid', 'isTyping'],
    },
  },

  // Media Operations
  {
    name: 'download_media',
    description: 'Download media from message',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        messageId: { type: 'string', description: 'Message ID with media' },
        jid: { type: 'string', description: 'Chat JID' },
      },
      required: ['sessionId', 'messageId', 'jid'],
    },
  },
  {
    name: 'list_downloads',
    description: 'List available downloads',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Filter by session ID' },
      },
    },
  },

  // Message History
  {
    name: 'get_messages',
    description: 'Get message history',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        jid: { type: 'string', description: 'Chat JID' },
        limit: { type: 'number', description: 'Number of messages to fetch' },
        before: { type: 'string', description: 'Get messages before this ID' },
      },
      required: ['sessionId', 'jid'],
    },
  },

  // Webhook Management (Legacy)
  {
    name: 'create_legacy_webhook',
    description: 'Create legacy webhook for session (single webhook)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        url: { type: 'string', description: 'Webhook URL' },
        events: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Events to listen for'
        },
      },
      required: ['sessionId', 'url'],
    },
  },
  {
    name: 'get_legacy_webhook',
    description: 'Get legacy webhook configuration',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'delete_legacy_webhook',
    description: 'Delete legacy webhook',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },

  // Advanced Webhook Management
  {
    name: 'create_webhook',
    description: 'Create advanced webhook for session (multiple webhooks with priority)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        url: { type: 'string', description: 'Webhook URL' },
        name: { type: 'string', description: 'Webhook name' },
        priority: { type: 'number', description: 'Webhook priority (1-3)', minimum: 1, maximum: 3 },
        events: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Events to listen for'
        },
      },
      required: ['sessionId', 'url', 'name'],
    },
  },
  {
    name: 'list_webhooks',
    description: 'List all webhooks for session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'get_webhook',
    description: 'Get specific webhook details',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        webhookId: { type: 'string', description: 'Webhook ID' },
      },
      required: ['sessionId', 'webhookId'],
    },
  },
  {
    name: 'update_webhook',
    description: 'Update webhook configuration',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        webhookId: { type: 'string', description: 'Webhook ID' },
        url: { type: 'string', description: 'New webhook URL' },
        name: { type: 'string', description: 'New webhook name' },
        priority: { type: 'number', description: 'New priority' },
        active: { type: 'boolean', description: 'Enable/disable webhook' },
      },
      required: ['sessionId', 'webhookId'],
    },
  },
  {
    name: 'delete_webhook',
    description: 'Delete webhook',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        webhookId: { type: 'string', description: 'Webhook ID' },
      },
      required: ['sessionId', 'webhookId'],
    },
  },
  {
    name: 'toggle_webhook',
    description: 'Toggle webhook active status',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        webhookId: { type: 'string', description: 'Webhook ID' },
      },
      required: ['sessionId', 'webhookId'],
    },
  },
  {
    name: 'test_webhook',
    description: 'Test webhook endpoint',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        webhookId: { type: 'string', description: 'Webhook ID' },
      },
      required: ['sessionId', 'webhookId'],
    },
  },

  // Group Management
  {
    name: 'create_group',
    description: 'Create new WhatsApp group',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        subject: { type: 'string', description: 'Group name' },
        participants: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Participant JIDs (phone@s.whatsapp.net)',
          minItems: 1
        },
      },
      required: ['sessionId', 'subject', 'participants'],
    },
  },
  {
    name: 'get_group_info',
    description: 'Get group information and metadata',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
      },
      required: ['sessionId', 'groupId'],
    },
  },
  {
    name: 'list_groups',
    description: 'List all groups for session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        limit: { type: 'number', description: 'Limit number of groups' },
        search: { type: 'string', description: 'Search group names' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'add_group_participants',
    description: 'Add participants to group',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        participants: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Participant JIDs to add',
          minItems: 1
        },
      },
      required: ['sessionId', 'groupId', 'participants'],
    },
  },
  {
    name: 'remove_group_participants',
    description: 'Remove participants from group',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        participants: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Participant JIDs to remove',
          minItems: 1
        },
      },
      required: ['sessionId', 'groupId', 'participants'],
    },
  },
  {
    name: 'promote_group_admins',
    description: 'Promote participants to group admins',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        participants: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Participant JIDs to promote',
          minItems: 1
        },
      },
      required: ['sessionId', 'groupId', 'participants'],
    },
  },
  {
    name: 'demote_group_admins',
    description: 'Demote group admins to participants',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        participants: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Admin JIDs to demote',
          minItems: 1
        },
      },
      required: ['sessionId', 'groupId', 'participants'],
    },
  },
  {
    name: 'update_group_subject',
    description: 'Update group name/subject',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        subject: { type: 'string', description: 'New group name' },
      },
      required: ['sessionId', 'groupId', 'subject'],
    },
  },
  {
    name: 'update_group_description',
    description: 'Update group description',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        description: { type: 'string', description: 'New group description' },
      },
      required: ['sessionId', 'groupId', 'description'],
    },
  },
  {
    name: 'update_group_settings',
    description: 'Update group settings (announcement/locked modes)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
        setting: { 
          type: 'string',
          enum: ['announcement', 'not_announcement', 'locked', 'unlocked'],
          description: 'Group setting to update'
        },
      },
      required: ['sessionId', 'groupId', 'setting'],
    },
  },
  {
    name: 'leave_group',
    description: 'Leave a group',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
      },
      required: ['sessionId', 'groupId'],
    },
  },
  {
    name: 'get_group_invite_code',
    description: 'Get group invite code',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
      },
      required: ['sessionId', 'groupId'],
    },
  },
  {
    name: 'revoke_group_invite',
    description: 'Revoke group invite code',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        groupId: { type: 'string', description: 'Group JID' },
      },
      required: ['sessionId', 'groupId'],
    },
  },

  // API Information
  {
    name: 'get_api_info',
    description: 'Get API information and available endpoints',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Main MCP Server implementation
class FlowChatMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'flowchat-baileys',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.httpClient = new AuthenticatedHttpClient();
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const authorization = request.meta?.authorization;

      try {
        const result = await this.executeTool(name, args || {}, authorization);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  async executeTool(toolName, args, authorization) {
    // Route tool calls to appropriate API endpoints
    switch (toolName) {
      // Session Management
      case 'create_session':
        return this.httpClient.request('POST', '/api/baileys/session/create', {
          sessionId: args.sessionId,
          webhookUrl: args.webhookUrl,
        }, authorization);

      case 'get_session_status':
        return this.httpClient.request('GET', `/api/baileys/session/${args.sessionId}/status`, {}, authorization);

      case 'list_sessions':
        return this.httpClient.request('GET', '/api/baileys/sessions', {}, authorization);

      case 'delete_session':
        return this.httpClient.request('DELETE', `/api/baileys/session/${args.sessionId}`, {}, authorization);

      case 'regenerate_qr':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/regenerate-qr`, {}, authorization);

      case 'cleanup_orphaned_sessions':
        return this.httpClient.request('POST', '/api/baileys/sessions/cleanup-orphaned', {}, authorization);

      // Message Operations
      case 'send_message':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/send-message`, {
          jid: args.jid,
          message: args.message,
          replyToId: args.replyToId,
        }, authorization);

      case 'send_media':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/send-media`, {
          jid: args.jid,
          mediaType: args.mediaType,
          mediaUrl: args.mediaUrl,
          caption: args.caption,
          fileName: args.fileName,
        }, authorization);

      case 'reply_message':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/reply-message`, {
          jid: args.jid,
          messageId: args.messageId,
          message: args.message,
        }, authorization);

      case 'mention_all':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/mention-all`, {
          groupId: args.groupId,
          message: args.message,
        }, authorization);

      case 'smart_reply':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/smart-reply`, {
          jid: args.jid,
          context: args.context,
          tone: args.tone,
          language: args.language,
        }, authorization);

      // Chat Controls
      case 'mark_read':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/mark-read`, {
          jid: args.jid,
          messageIds: args.messageIds,
        }, authorization);

      case 'typing_indicator':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/typing`, {
          jid: args.jid,
          isTyping: args.isTyping,
        }, authorization);

      // Media Operations
      case 'download_media':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/download-media`, {
          messageId: args.messageId,
          jid: args.jid,
        }, authorization);

      case 'list_downloads':
        return this.httpClient.request('GET', '/api/baileys/downloads', {
          sessionId: args.sessionId,
        }, authorization);

      // Message History
      case 'get_messages':
        return this.httpClient.request('GET', `/api/baileys/session/${args.sessionId}/messages`, {
          jid: args.jid,
          limit: args.limit,
          before: args.before,
        }, authorization);

      // Legacy Webhook Management
      case 'create_legacy_webhook':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/webhook`, {
          url: args.url,
          events: args.events,
        }, authorization);

      case 'get_legacy_webhook':
        return this.httpClient.request('GET', `/api/baileys/session/${args.sessionId}/webhook`, {}, authorization);

      case 'delete_legacy_webhook':
        return this.httpClient.request('DELETE', `/api/baileys/session/${args.sessionId}/webhook`, {}, authorization);

      // Advanced Webhook Management
      case 'create_webhook':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/webhooks`, {
          url: args.url,
          name: args.name,
          priority: args.priority,
          events: args.events,
        }, authorization);

      case 'list_webhooks':
        return this.httpClient.request('GET', `/api/baileys/session/${args.sessionId}/webhooks`, {}, authorization);

      case 'get_webhook':
        return this.httpClient.request('GET', `/api/baileys/session/${args.sessionId}/webhooks/${args.webhookId}`, {}, authorization);

      case 'update_webhook':
        return this.httpClient.request('PUT', `/api/baileys/session/${args.sessionId}/webhooks/${args.webhookId}`, {
          url: args.url,
          name: args.name,
          priority: args.priority,
          active: args.active,
        }, authorization);

      case 'delete_webhook':
        return this.httpClient.request('DELETE', `/api/baileys/session/${args.sessionId}/webhooks/${args.webhookId}`, {}, authorization);

      case 'toggle_webhook':
        return this.httpClient.request('PATCH', `/api/baileys/session/${args.sessionId}/webhooks/${args.webhookId}/toggle`, {}, authorization);

      case 'test_webhook':
        return this.httpClient.request('POST', `/api/baileys/session/${args.sessionId}/webhooks/${args.webhookId}/test`, {}, authorization);

      // Group Management
      case 'create_group':
        return this.httpClient.request('POST', `/api/baileys/groups/${args.sessionId}/create`, {
          subject: args.subject,
          participants: args.participants,
        }, authorization);

      case 'get_group_info':
        return this.httpClient.request('GET', `/api/baileys/groups/${args.sessionId}/${args.groupId}/info`, {}, authorization);

      case 'list_groups':
        return this.httpClient.request('GET', `/api/baileys/groups/${args.sessionId}/list`, {
          limit: args.limit,
          search: args.search,
        }, authorization);

      case 'add_group_participants':
        return this.httpClient.request('POST', `/api/baileys/groups/${args.sessionId}/${args.groupId}/add-participants`, {
          participants: args.participants,
        }, authorization);

      case 'remove_group_participants':
        return this.httpClient.request('POST', `/api/baileys/groups/${args.sessionId}/${args.groupId}/remove-participants`, {
          participants: args.participants,
        }, authorization);

      case 'promote_group_admins':
        return this.httpClient.request('POST', `/api/baileys/groups/${args.sessionId}/${args.groupId}/promote`, {
          participants: args.participants,
        }, authorization);

      case 'demote_group_admins':
        return this.httpClient.request('POST', `/api/baileys/groups/${args.sessionId}/${args.groupId}/demote`, {
          participants: args.participants,
        }, authorization);

      case 'update_group_subject':
        return this.httpClient.request('PUT', `/api/baileys/groups/${args.sessionId}/${args.groupId}/subject`, {
          subject: args.subject,
        }, authorization);

      case 'update_group_description':
        return this.httpClient.request('PUT', `/api/baileys/groups/${args.sessionId}/${args.groupId}/description`, {
          description: args.description,
        }, authorization);

      case 'update_group_settings':
        return this.httpClient.request('PUT', `/api/baileys/groups/${args.sessionId}/${args.groupId}/settings`, {
          setting: args.setting,
        }, authorization);

      case 'leave_group':
        return this.httpClient.request('POST', `/api/baileys/groups/${args.sessionId}/${args.groupId}/leave`, {}, authorization);

      case 'get_group_invite_code':
        return this.httpClient.request('GET', `/api/baileys/groups/${args.sessionId}/${args.groupId}/invite-code`, {}, authorization);

      case 'revoke_group_invite':
        return this.httpClient.request('POST', `/api/baileys/groups/${args.sessionId}/${args.groupId}/revoke-invite`, {}, authorization);

      // API Information
      case 'get_api_info':
        return this.httpClient.request('GET', '/api/baileys/info', {}, authorization);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('FlowChat MCP server running on stdio');
  }
}

// Export for use in other modules
module.exports = { FlowChatMCPServer, config };