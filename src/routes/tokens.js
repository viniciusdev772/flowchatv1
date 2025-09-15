const express = require('express');
const crypto = require('crypto');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { ObjectId } = require('mongodb');
const { getSessions } = require('../app');

const router = express.Router();

/**
 * @fileoverview This file defines the routes for managing API tokens.
 * @module routes/tokens
 */

/**
 * @swagger
 * /tokens/generate:
 *   post:
 *     summary: Generate a new API token
 *     description: Creates a new API token for the authenticated user.
 *     tags: [Tokens]
 *     security:
 *       - ApiTokenAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: A descriptive name for the token.
 *               expiresIn:
 *                 type: string
 *                 description: The expiration time for the token (e.g., '7d', '30d', 'never').
 *     responses:
 *       '200':
 *         description: The newly generated API token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 tokenInfo:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         description: Bad request, missing name or invalid expiration.
 *       '500':
 *         description: Internal server error.
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { name, expiresIn } = req.body;
    const userId = req.user._id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nome do token é obrigatório'
      });
    }
    const token = crypto.randomBytes(32).toString('hex');

    const fullToken = `baileys_${token}`;

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

    const tokenRecord = {
      userId,
      name: name.trim(),
      token: fullToken,
      expiresAt,
      createdAt: new Date(),
      lastUsedAt: null,
      isActive: true
    };

    const db = database.getDb();
    if (db) {
      await db.collection('api_tokens').insertOne(tokenRecord);
    }
    res.json({
      success: true,
      message: 'Token de API gerado com sucesso',
      token: fullToken,
      tokenInfo: {
        name: tokenRecord.name,
        expiresAt: tokenRecord.expiresAt,
        createdAt: tokenRecord.createdAt
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

/**
 * @swagger
 * /tokens/list:
 *   get:
 *     summary: List API tokens
 *     description: Retrieves a list of API tokens for the authenticated user.
 *     tags: [Tokens]
 *     security:
 *       - ApiTokenAuth: []
 *     responses:
 *       '200':
 *         description: A list of API tokens.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *       '503':
 *         description: Database not available.
 *       '500':
 *         description: Internal server error.
 */
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
      .project({ token: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    const sessions = getSessions();
    const userSessions = [];

    for (const [sessionId, sessionData] of sessions.entries()) {
      if (sessionData.userId && sessionData.userId.toString() === userId.toString()) {
        userSessions.push({
          sessionId,
          qrCode: sessionData.qrCode,
          qrCodeImage: sessionData.qrCodeImage,
          isConnected: sessionData.isConnected,
          connectionState: sessionData.connectionState,
          createdAt: sessionData.createdAt
        });
      }
    }

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
      })),
      sessions: userSessions
    });

  } catch (error) {
    console.error('Error listing API tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /tokens/{tokenId}:
 *   delete:
 *     summary: Revoke an API token
 *     description: Revokes an API token, making it inactive.
 *     tags: [Tokens]
 *     security:
 *       - ApiTokenAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the token to revoke.
 *     responses:
 *       '200':
 *         description: Token revoked successfully.
 *       '404':
 *         description: Token not found.
 *       '503':
 *         description: Database not available.
 *       '500':
 *         description: Internal server error.
 */
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

/**
 * @swagger
 * /tokens/{tokenId}/full:
 *   get:
 *     summary: Get a full API token
 *     description: Retrieves the full API token string for a given token ID.
 *     tags: [Tokens]
 *     security:
 *       - ApiTokenAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the token to retrieve.
 *     responses:
 *       '200':
 *         description: The full API token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *       '401':
 *         description: Token expired.
 *       '404':
 *         description: Token not found.
 *       '503':
 *         description: Database not available.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:tokenId/full', authenticateToken, async (req, res) => {
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

    const token = await db.collection('api_tokens').findOne({
      _id: new ObjectId(tokenId),
      userId,
      isActive: true
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token não encontrado'
      });
    }

    if (token.expiresAt && new Date() > token.expiresAt) {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    res.json({
      success: true,
      token: token.token
    });

  } catch (error) {
    console.error('Error getting full token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;