const express = require('express');
const crypto = require('crypto');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { ObjectId } = require('mongodb');

const router = express.Router();

// Generate API token for user
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { name, expiresIn } = req.body;
    const userId = req.user._id;
    
    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nome do token é obrigatório'
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Calculate expiration date
    let expiresAt = null;
    if (expiresIn && expiresIn !== 'never') {
      const days = parseInt(expiresIn);
      if (isNaN(days) || days <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Prazo de expiração inválido'
        });
      }
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    const tokenData = {
      userId,
      name: name.trim(),
      token: hashedToken,
      expiresAt,
      createdAt: new Date(),
      lastUsedAt: null,
      isActive: true
    };

    // Save to database if available
    const db = database.getDb();
    if (db) {
      await db.collection('api_tokens').insertOne(tokenData);
    }

    // Return the unhashed token (only time it's shown)
    res.json({
      success: true,
      message: 'Token de API gerado com sucesso',
      token: `baileys_${token}`,
      tokenInfo: {
        name: tokenData.name,
        expiresAt: tokenData.expiresAt,
        createdAt: tokenData.createdAt
      }
    });

  } catch (error) {
    console.error('Error generating API token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// List user's API tokens
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const db = database.getDb();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const tokens = await db.collection('api_tokens')
      .find({ userId })
      .project({ token: 0 }) // Don't return the actual token
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      tokens: tokens.map(token => ({
        _id: token._id,
        name: token.name,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        lastUsedAt: token.lastUsedAt,
        isActive: token.isActive,
        isExpired: token.expiresAt && new Date() > token.expiresAt
      }))
    });

  } catch (error) {
    console.error('Error listing API tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Revoke API token
router.delete('/:tokenId', authenticateToken, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const userId = req.user._id;
    
    const db = database.getDb();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const result = await db.collection('api_tokens').updateOne(
      { _id: new ObjectId(tokenId), userId },
      { $set: { isActive: false, revokedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Token não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Token revogado com sucesso'
    });

  } catch (error) {
    console.error('Error revoking API token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;