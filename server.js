const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const database = require('./src/config/database');
const managementRoutes = require('./src/routes');

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
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Request logging
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global rate limiting
    const globalLimiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    this.app.use(globalLimiter);

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

    // Keep existing Baileys routes (if they exist)
    // Note: The existing Baileys API routes should be mounted here
    // this.app.use('/api/baileys', baileysRoutes);

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

      // Start server
      this.server = this.app.listen(this.port, () => {
        console.log('🎉 ===========================================');
        console.log(`🚀 Server running on port ${this.port}`);
        console.log(`📱 Management API: http://localhost:${this.port}/api/management`);
        console.log(`💬 Baileys API: http://localhost:${this.port}/api/baileys`);
        console.log(`🏥 Health Check: http://localhost:${this.port}/api/management/health`);
        console.log(`📖 API Info: http://localhost:${this.port}/api/management/info`);
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