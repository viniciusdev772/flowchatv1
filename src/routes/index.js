const express = require('express');
const authRoutes = require('./auth');
const tokenRoutes = require('./tokens');
const sessionRoutes = require('./sessions');
const aiRoutes = require('./ai');

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

// AI Assistant routes
router.use('/ai', aiRoutes);

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
        ai: {
          chat: 'POST /api/management/ai/chat',
          tools: 'GET /api/management/ai/tools',
          health: 'GET /api/management/ai/health'
        }
      }
    }
  });
});

module.exports = router;