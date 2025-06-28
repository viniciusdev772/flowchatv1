#!/usr/bin/env node

/**
 * Baileys Multi-Session WhatsApp API
 * Entry point - starts the Express application
 */

const express = require('express');
const path = require('path');
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

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./src/config/swagger');

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
    this.app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      })
    ); // CORS configuration
    this.app.use(
      cors({
        origin: function (origin, callback) {
          // Allow requests with no origin (mobile apps, curl, etc.)
          if (!origin) return callback(null, true);

          // Allow all origins
          return callback(null, true);

          // Add CORS_ORIGIN from environment if it exists
          if (
            process.env.CORS_ORIGIN &&
            !allowedOrigins.includes(process.env.CORS_ORIGIN)
          ) {
            allowedOrigins.push(process.env.CORS_ORIGIN);
          }

          if (allowedOrigins.includes(origin)) {
            console.log('CORS allowed origin:', origin);
            callback(null, true);
          } else {
            console.log(
              'CORS blocked origin:',
              origin,
              'Allowed:',
              allowedOrigins
            );
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-CSRF-Token',
          'csrf-token',
        ],
        exposedHeaders: ['X-CSRF-Token', 'X-New-CSRF-Token'],
        optionsSuccessStatus: 200, // For legacy browser support
      })
    );

    // Handle preflight OPTIONS requests explicitly
    this.app.options('*', (req, res) => {
      res.status(200).end();
    });

    // Request logging
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parsing with signature
    this.app.use(
      cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret-key')
    );

    // Session configuration
    const sessionConfig = {
      secret: process.env.SESSION_SECRET || 'your-session-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict',
      },
      name: 'sessionId', // Hide default session name
    };

    // Add MongoDB store if database is available
    try {
      const client = database.getClient();
      if (database.getDb() && client) {
        sessionConfig.store = MongoStore.create({
          client: client,
          dbName: process.env.DB_NAME,
          collectionName: 'sessions',
          ttl: 24 * 60 * 60, // 24 hours
        });
        console.log('✅ Using MongoDB for session storage');
      } else {
        console.log('⚠️  Using memory store for sessions (development mode)');
      }
    } catch (error) {
      console.log(
        '⚠️  MongoDB session store failed, using memory store:',
        error.message
      );
    }

    this.app.use(session(sessionConfig));

    // Request timestamp middleware
    this.app.use((req, res, next) => {
      req.timestamp = new Date().toISOString();
      next();
    });
  }

  setupRoutes() {
    // Swagger Documentation (before other routes)
    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Baileys WhatsApp API Documentation',
      })
    );

    // API routes
    // Management API routes
    this.app.use('/api/management', managementRoutes);

    // Mount Baileys app routes (already includes /api/baileys prefix)
    this.app.use('/', baileysApp);

    // Serve static files from frontend build
    this.app.use(express.static(path.join(__dirname, 'frontend/dist')));

    // API info endpoint (fallback for /api requests)
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: 'Baileys API Server',
        timestamp: req.timestamp,
        endpoints: {
          baileys: '/api/baileys/*',
          management: '/api/management/*',
          health: '/api/management/health',
          docs: '/api-docs',
        },
      });
    });

    // Catch-all handler for SPA - must be last
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
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
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
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
        console.log(
          `📱 Management API: http://localhost:${this.port}/api/management`
        );
        console.log(
          `💬 Baileys API: http://localhost:${this.port}/api/baileys`
        );
        console.log(
          `🏥 Health Check: http://localhost:${this.port}/api/management/health`
        );
        console.log(`📖 API Docs: http://localhost:${this.port}/api-docs`);
        console.log(`🖥️  Frontend: http://localhost:${this.port}`);
        console.log(`📋 API Info: http://localhost:${this.port}/api`);
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
