const express = require('express');
const authRoutes = require('./auth');
const tokenRoutes = require('./tokens');
const sessionRoutes = require('./sessions');
const advancedRateLimit = require('../middleware/advancedRateLimit');

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

// Rate limit statistics endpoint (development only)
router.get('/rate-limit-stats', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint disponível apenas em desenvolvimento'
      });
    }

    const stats = await advancedRateLimit.getPenaltyStatistics();
    
    res.json({
      success: true,
      data: {
        statistics: stats,
        message: 'Estatísticas de penalizações progressivas',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas',
      error: error.message
    });
  }
});

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
        monitoring: {
          rateLimitStats: 'GET /api/management/rate-limit-stats (dev only)'
        }
      }
    }
  });
});

module.exports = router;