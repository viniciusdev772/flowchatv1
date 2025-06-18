#!/usr/bin/env node

/**
 * Baileys Multi-Session WhatsApp API
 * Entry point - starts the Express application
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const database = require('./src/config/database');
const managementRoutes = require('./src/routes');
const { app: baileysApp, initializeApp } = require('./src/app');
const apiTokenAuth = require('./src/middleware/apiTokenAuth');

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'csrf-token'],
      exposedHeaders: ['X-CSRF-Token', 'X-New-CSRF-Token']
    }));

    // Request logging
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parsing with signature
    this.app.use(cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret-key'));

    // Session configuration
    const sessionConfig = {
      secret: process.env.SESSION_SECRET || 'your-session-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      },
      name: 'sessionId' // Hide default session name
    };

    // Add MongoDB store if database is available
    try {
      const client = database.getClient();
      if (database.getDb() && client) {
        sessionConfig.store = MongoStore.create({
          client: client,
          dbName: process.env.DB_NAME,
          collectionName: 'sessions',
          ttl: 24 * 60 * 60 // 24 hours
        });
        console.log('✅ Using MongoDB for session storage');
      } else {
        console.log('⚠️  Using memory store for sessions (development mode)');
      }
    } catch (error) {
      console.log('⚠️  MongoDB session store failed, using memory store:', error.message);
    }

    this.app.use(session(sessionConfig));


    // Request timestamp middleware
    this.app.use((req, res, next) => {
      req.timestamp = new Date().toISOString();
      next();
    });
  }

  setupRoutes() {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Baileys API Server',
        timestamp: req.timestamp,
        endpoints: {
          baileys: '/api/baileys/*',
          management: '/api/management/*',
          health: '/api/management/health'
        }
      });
    });

    // Management API routes
    this.app.use('/api/management', managementRoutes);

    // Apply API token authentication to Baileys routes (except session creation)
    this.app.use('/api/baileys', (req, res, next) => {
      // Skip API token auth for session creation - it has its own dual auth
      if (req.path === '/session/create' && req.method === 'POST') {
        return next();
      }
      return apiTokenAuth(req, res, next);
    });

    // Mount Baileys app routes
    this.app.use('/', baileysApp);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      
      if (res.headersSent) {
        return next(error);
      }

      let statusCode = 500;
      let message = 'Internal server error';

      if (error.name === 'ValidationError') {
        statusCode = 400;
        message = error.message;
      } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
      } else if (error.code === 11000) {
        statusCode = 409;
        message = 'Duplicate entry';
      }

      res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  }

  async start() {
    try {
      // Try to connect to database
      try {
        await database.connect();
      } catch (dbError) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️  Continuing without database in development mode');
        } else {
          throw dbError;
        }
      }

      // Initialize Baileys app first
      await initializeApp();

      // Start server
      this.server = this.app.listen(this.port, () => {
        console.log('🎉 ===========================================');
        console.log(`🚀 Server running on port ${this.port}`);
        console.log(`📱 Management API: http://localhost:${this.port}/api/management`);
        console.log(`💬 Baileys API: http://localhost:${this.port}/api/baileys`);
        console.log(`🏥 Health Check: http://localhost:${this.port}/api/management/health`);
        console.log(`📖 API Info: http://localhost:${this.port}/api/management/info`);
        console.log(`Acesse http://localhost:${this.port}/api-docs para ver a documentação`);
        console.log(`Acesse http://localhost:${this.port}/api/baileys/info para informações da API`);
        console.log('🎉 ===========================================');
        
        if (process.env.NODE_ENV === 'development') {
          console.log('');
          console.log('💡 Development Mode Features:');
          console.log('   - Works without MongoDB');
          console.log('   - Mock authentication available');
          console.log('   - Enhanced error logging');
          console.log('');
        }
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  async gracefulShutdown() {
    console.log('Starting graceful shutdown...');

    if (this.server) {
      this.server.close(async () => {
        console.log('HTTP server closed');
        
        try {
          await database.disconnect();
          console.log('Database connection closed');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    }
  }
}

// Create and start server
const server = new Server();
server.start();

module.exports = server;