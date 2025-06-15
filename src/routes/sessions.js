const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const database = require('../config/database');
const { ObjectId } = require('mongodb');

const router = express.Router();

// DEPRECATED: create-with-token endpoint was removed
// Frontend now calls Baileys API directly with Authorization header

// Get user sessions (using internal session store)
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Access global sessions from app.js
    const sessions = global.whatsappSessions;
    if (!sessions) {
      return res.status(500).json({
        success: false,
        message: 'Sistema de sessões não disponível'
      });
    }

    // Filter sessions by userId
    const userSessions = [];
    for (const [sessionId, sessionData] of sessions.entries()) {
      if (sessionData.userId && sessionData.userId.toString() === userId.toString()) {
        userSessions.push({
          sessionId,
          isConnected: sessionData.isConnected,
          connectionState: sessionData.connectionState || 'unknown',
          createdAt: sessionData.createdAt,
          connectedAt: sessionData.connectedAt || null,
          lastError: sessionData.lastError || null,
          user: sessionData.sock?.user || null,
          hasQrCode: !!sessionData.qrCode,
          qrCode: sessionData.qrCode || null,
          qrCodeImage: sessionData.qrCodeImage || null
        });
      }
    }

    res.json({
      success: true,
      sessions: userSessions,
      total: userSessions.length
    });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;