const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const database = require('../config/database');
const { ObjectId } = require('mongodb');

const router = express.Router();

// Create WhatsApp session using stored token
router.post('/create-with-token', authenticateToken, async (req, res) => {
  try {
    const { sessionId, tokenId } = req.body;
    const userId = req.user._id;

    if (!sessionId || !tokenId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId e tokenId são obrigatórios'
      });
    }

    const db = database.getDb();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    // Find the token in database
    const tokenDoc = await db.collection('api_tokens').findOne({
      _id: new ObjectId(tokenId),
      userId: userId,
      isActive: true
    });

    if (!tokenDoc) {
      return res.status(404).json({
        success: false,
        message: 'Token não encontrado ou inativo'
      });
    }

    // Check if token is expired
    if (tokenDoc.expiresAt && new Date() > tokenDoc.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Token expirado'
      });
    }

    // Direct approach: Call createWhatsAppSession directly since we've already validated the token ownership
    try {
      // Import the createWhatsAppSession function directly
      const { createWhatsAppSession } = require('../app');
      
      if (!createWhatsAppSession) {
        // Fallback: call the function directly from global scope
        const result = await global.createWhatsAppSession?.(sessionId, userId);
        
        if (!result) {
          return res.status(500).json({
            success: false,
            message: 'Função de criação de sessão não disponível'
          });
        }
        
        if (result.success) {
          res.json({
            success: true,
            message: 'Sessão criada com sucesso',
            sessionData: result
          });
        } else {
          res.status(400).json({
            success: false,
            message: result.message || 'Erro ao criar sessão'
          });
        }
      } else {
        const result = await createWhatsAppSession(sessionId, userId);
        
        if (result.success) {
          res.json({
            success: true,
            message: 'Sessão criada com sucesso',
            sessionData: result
          });
        } else {
          res.status(400).json({
            success: false,
            message: result.message || 'Erro ao criar sessão'
          });
        }
      }
    } catch (error) {
      console.error('Error creating session directly:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar sessão: ' + error.message
      });
    }

  } catch (error) {
    console.error('Error creating session with token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

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