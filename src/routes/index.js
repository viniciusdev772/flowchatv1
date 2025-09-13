const express = require('express');
const authRoutes = require('./auth');
const tokenRoutes = require('./tokens');
const sessionRoutes = require('./sessions');
const aiRoutes = require('./ai');
const mediaRoutes = require('./media');
const messageCollectorRoutes = require('../api/messageCollector');
const aiSummaryRoutes = require('../api/aiSummary');

const router = express.Router();

/**
 * @fileoverview This file defines the main router for the application.
 * It combines all the other route modules into a single router.
 * @module routes/index
 */

/**
 * @name GET /health
 * @description Health check endpoint.
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Management API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * @description Mounts the authentication routes.
 * @name /auth
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {object} router - The auth router.
 */
router.use('/auth', authRoutes);

/**
 * @description Mounts the token routes.
 * @name /tokens
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {object} router - The tokens router.
 */
router.use('/tokens', tokenRoutes);

/**
 * @description Mounts the session routes.
 * @name /sessions
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {object} router - The sessions router.
 */
router.use('/sessions', sessionRoutes);

/**
 * @description Mounts the media routes.
 * @name /media
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {object} router - The media router.
 */
router.use('/media', mediaRoutes);

/**
 * @description Mounts the AI routes.
 * @name /ai
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {object} router - The AI router.
 */
router.use('/ai', aiRoutes);

/**
 * @description Mounts the message collector routes.
 * @name /message-collector
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {object} router - The message collector router.
 */
router.use('/message-collector', messageCollectorRoutes);

/**
 * @description Mounts the AI summary routes.
 * @name /ai-summary
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {object} router - The AI summary router.
 */
router.use('/ai-summary', aiSummaryRoutes);

/**
 * @name GET /info
 * @description Provides information about the API, including available endpoints.
 * @function
 * @memberof module:routes/index
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Baileys Management API',
      version: '1.0.0',
      description: 'User management and authentication API for Baileys WhatsApp API',
      endpoints: {
        health: 'GET /api/management/health',
        info: 'GET /api/management/info',
        auth: {
          register: 'POST /api/management/auth/register',
          login: 'POST /api/management/auth/login',
          profile: 'GET /api/management/auth/profile',
          updateProfile: 'PUT /api/management/auth/profile',
          changePassword: 'POST /api/management/auth/change-password'
        },
        tokens: {
          generate: 'POST /api/management/tokens/generate',
          list: 'GET /api/management/tokens/list',
          revoke: 'DELETE /api/management/tokens/:tokenId'
        },
        sessions: {
          createWithToken: 'POST /api/management/sessions/create-with-token',
          list: 'GET /api/management/sessions/list'
        },
        media: {
          sessions: 'GET /api/management/media/sessions',
          sessionMedia: 'GET /api/management/media/session/:sessionId',
          download: 'GET /api/management/media/download/:sessionId/:filename',
          preview: 'GET /api/management/media/preview/:sessionId/:filename'
        },
        ai: {
          chat: 'POST /api/management/ai/chat',
          tools: 'GET /api/management/ai/tools',
          health: 'GET /api/management/ai/health'
        },
        messageCollector: {
          start: 'POST /api/management/message-collector/start',
          stop: 'POST /api/management/message-collector/stop',
          list: 'GET /api/management/message-collector/list',
          messages: 'GET /api/management/message-collector/messages/:collectorId'
        },
        aiSummary: {
          summarize: 'POST /api/management/ai-summary/summarize',
          list: 'GET /api/management/ai-summary/list',
          get: 'GET /api/management/ai-summary/:summaryId',
          delete: 'DELETE /api/management/ai-summary/:summaryId',
          sentiment: 'POST /api/management/ai-summary/analyze-sentiment'
        },
      }
    }
  });
});

module.exports = router;