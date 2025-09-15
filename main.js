#!/usr/bin/env node






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


const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./src/config/swagger');

/**
 * @class Server
 * @description A class to represent the main server.
 */
class Server {
  /**
   * Creates an instance of Server.
   */
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Sets up the middleware for the server.
   * @returns {void}
   */
  setupMiddleware() {

    this.app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      })
    );
    this.app.use(
      cors({
        origin: function (origin, callback) {

          if (!origin) return callback(null, true);


          const allowedOrigins = [
            'http://localhost:3000',
            'https://localhost:3000',
            'http://127.0.0.1:3000',
          ];


          if (process.env.CORS_ORIGIN) {
            allowedOrigins.push(process.env.CORS_ORIGIN);
          }


          if (origin && origin.includes('.baileys.marketcodebrasil.com.br')) {
            console.log('CORS allowed baileys subdomain:', origin);
            return callback(null, true);
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

            if (process.env.NODE_ENV === 'production') {
              console.log('⚠️ Allowing origin in production for debug:', origin);
              callback(null, true);
            } else {
              callback(new Error('Not allowed by CORS'));
            }
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
        optionsSuccessStatus: 200,
      })
    );


    this.app.options('*', (req, res) => {
      res.status(200).end();
    });


    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }


    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));


    this.app.use(
      cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret-key')
    );


    const sessionConfig = {
      secret: process.env.SESSION_SECRET || 'your-session-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: 'auto',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      },
      name: 'sessionId',
    };


    try {
      const client = database.getClient();
      if (database.getDb() && client) {
        sessionConfig.store = MongoStore.create({
          client: client,
          dbName: process.env.DB_NAME,
          collectionName: 'sessions',
          ttl: 24 * 60 * 60,
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


    this.app.use((req, res, next) => {
      req.timestamp = new Date().toISOString();
      next();
    });
  }

  /**
   * Sets up the routes for the server.
   * @returns {void}
   */
  setupRoutes() {

    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Baileys WhatsApp API Documentation',
      })
    );



    this.app.use('/api/management', managementRoutes);


    this.app.use('/', baileysApp);


    this.app.use('/temp-images', express.static(path.join(__dirname, 'temp-images')));


    this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


    this.app.use(express.static(path.join(__dirname, 'frontend/dist')));


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


    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
    });
  }

  /**
   * Sets up the error handling for the server.
   * @returns {void}
   */
  setupErrorHandling() {

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

  /**
   * Starts the server.
   * @returns {Promise<void>}
   */
  async start() {
    try {

      try {
        await database.connect();
      } catch (dbError) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️  Continuing without database in development mode');
        } else {
          throw dbError;
        }
      }


      await initializeApp();



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


      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Gracefully shuts down the server.
   * @returns {Promise<void>}
   */
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


const server = new Server();
server.start();

module.exports = server;
