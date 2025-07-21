const express = require('express');
const authRoutes = require('./auth');
const tokenRoutes = require('./tokens');
const sessionRoutes = require('./sessions');
const aiRoutes = require('./ai');
const mediaRoutes = require('./media');
const messageCollectorRoutes = require('../api/messageCollector');
const aiSummaryRoutes = require('../api/aiSummary');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Management API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Auth routes
router.use('/auth', authRoutes);

// Token routes
router.use('/tokens', tokenRoutes);

// Session routes
router.use('/sessions', sessionRoutes);

// Media routes
router.use('/media', mediaRoutes);

// AI Assistant routes
router.use('/ai', aiRoutes);

// Message Collector routes
router.use('/message-collector', messageCollectorRoutes);

// AI Summary routes
router.use('/ai-summary', aiSummaryRoutes);



// API info endpoint
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