const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const database = require('../config/database');
const { ObjectId } = require('mongodb');
const { getEnrichedSessionData } = require('../app');

const router = express.Router();

/**
 * @fileoverview This file defines the routes for managing WhatsApp sessions.
 * @module routes/sessions
 */

/**
 * @swagger
 * /sessions/list:
 *   get:
 *     summary: List all active sessions for the authenticated user
 *     description: Retrieves a list of all active WhatsApp sessions associated with the authenticated user.
 *     tags: [Sessions]
 *     security:
 *       - ApiTokenAuth: []
 *     responses:
 *       '200':
 *         description: A list of active sessions.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *                 total:
 *                   type: integer
 *       '500':
 *         description: Internal server error.
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const sessions = global.whatsappSessions;
    if (!sessions) {
      return res.status(500).json({
        success: false,
        message: 'Sistema de sessões não disponível'
      });
    }

    const userSessions = [];
    for (const [sessionId, sessionData] of sessions.entries()) {
      if (sessionData.userId && sessionData.userId.toString() === userId.toString()) {
        const enrichedData = await getEnrichedSessionData(sessionId, sessionData);
        userSessions.push(enrichedData);
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

/**
 * @swagger
 * /sessions/{sessionId}/groups:
 *   get:
 *     summary: Get all groups for a session
 *     description: Retrieves a list of all groups that the WhatsApp session is a part of.
 *     tags: [Groups]
 *     security:
 *       - ApiTokenAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the session.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: The maximum number of groups to return.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: A search term to filter groups by name.
 *     responses:
 *       '200':
 *         description: A list of groups.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 groups:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Group'
 *                 total:
 *                   type: integer
 *                 returned:
 *                   type: integer
 *                 sessionId:
 *                   type: string
 *                 filters:
 *                   type: object
 *       '400':
 *         description: Session not connected.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:sessionId/groups', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const search = req.query.search?.trim();

    const sessions = global.whatsappSessions;
    if (!sessions || !sessions.has(sessionId)) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada'
      });
    }

    const session = sessions.get(sessionId);

    if (session.userId && session.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: você não possui permissão para esta sessão'
      });
    }

    if (!session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não está conectada'
      });
    }

    const sock = session.sock;
    const groups = await sock.groupFetchAllParticipating();
    let groupEntries = Object.entries(groups);

    if (search) {
      const searchLower = search.toLowerCase();
      groupEntries = groupEntries.filter(([groupId, groupData]) => {
        const groupName = (groupData.subject || 'Grupo sem nome').toLowerCase();
        return groupName.includes(searchLower);
      });
    }

    const limitedEntries = groupEntries.slice(0, limit);

    const groupList = [];
    for (const [groupId, groupData] of limitedEntries) {
      try {
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = Array.isArray(groupMetadata.participants)
          ? groupMetadata.participants
          : [];

        const groupInfo = {
          jid: groupId,
          name: groupMetadata.subject || groupData.subject || 'Grupo sem nome',
          description: groupMetadata.desc || null,
          participants: {
            total: participants.length,
          },
          settings: {
            announce: groupMetadata.announce || false,
            restrict: groupMetadata.restrict || false,
          },
          createdAt: groupMetadata.creation
            ? new Date(groupMetadata.creation * 1000).toISOString()
            : null,
        };

        groupList.push(groupInfo);
      } catch (metaError) {
        console.warn(`Erro ao obter metadados do grupo ${groupId}:`, metaError.message);

        const basicInfo = {
          jid: groupId,
          name: groupData.subject || 'Grupo',
          description: null,
          participants: {
            total: 0,
          },
          settings: {
            announce: false,
            restrict: false,
          },
          createdAt: null,
          error: 'Metadados não disponíveis'
        };
        groupList.push(basicInfo);
      }
    }

    groupList.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      groups: groupList,
      total: groupEntries.length,
      returned: groupList.length,
      sessionId: sessionId,
      filters: {
        search: search || null,
        limit: limit
      }
    });
  } catch (error) {
    console.error('Error listing groups for session:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;