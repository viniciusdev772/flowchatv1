const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const database = require('../config/database');
const { ObjectId } = require('mongodb');
const { getEnrichedSessionData } = require('../app');

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

    // Filter sessions by userId and enrich with MongoDB data
    const userSessions = [];
    for (const [sessionId, sessionData] of sessions.entries()) {
      if (sessionData.userId && sessionData.userId.toString() === userId.toString()) {
        // Get enriched session data that includes QR codes from MongoDB
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

// Get groups for a specific session
router.get('/:sessionId/groups', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const search = req.query.search?.trim();
    
    // Access global sessions from app.js
    const sessions = global.whatsappSessions;
    if (!sessions || !sessions.has(sessionId)) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada'
      });
    }

    const session = sessions.get(sessionId);

    // Check if user owns this session
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

    // Get groups from WhatsApp
    const sock = session.sock;
    const groups = await sock.groupFetchAllParticipating();
    let groupEntries = Object.entries(groups);

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      groupEntries = groupEntries.filter(([groupId, groupData]) => {
        const groupName = (groupData.subject || 'Grupo sem nome').toLowerCase();
        return groupName.includes(searchLower);
      });
    }

    // Apply limit
    const limitedEntries = groupEntries.slice(0, limit);

    // Process and format group data
    const groupList = [];
    for (const [groupId, groupData] of limitedEntries) {
      try {
        // Get group metadata
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
        // Fallback to basic info
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

    // Sort groups by name
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