const express = require('express');
const router = express.Router();

// Middleware para verificar se a sessão existe, está conectada e pertence ao usuário
const checkSession = (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user?.id || req.user?._id;
  
  // Check if user is authenticated
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
  }
  
  // Acessar o objeto global sessions diretamente
  const sessions = global.whatsappSessions;
  
  if (!sessions || !sessions.has(sessionId)) {
    return res.status(404).json({
      success: false,
      message: 'Sessão não encontrada'
    });
  }
  
  const session = sessions.get(sessionId);
  
  // Check session ownership
  if (session.userId && session.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado: você não possui permissão para acessar esta sessão'
    });
  }
  
  if (!session.isConnected) {
    return res.status(400).json({
      success: false,
      message: 'Sessão não está conectada'
    });
  }
  
  req.whatsappSession = session;
  next();
};

// Função auxiliar para formatar JID do grupo
const formatGroupJid = (groupId) => {
  if (groupId.includes('@g.us')) {
    return groupId;
  }
  return `${groupId}@g.us`;
};

// Função auxiliar para formatar JID do usuário
const formatUserJid = (userId) => {
  if (userId.includes('@s.whatsapp.net')) {
    return userId;
  }
  return `${userId}@s.whatsapp.net`;
};

// Criar grupo
router.post('/:sessionId/create', checkSession, async (req, res) => {
  try {
    const { groupName, participants, description } = req.body;
    
    if (!groupName || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nome do grupo e lista de participantes são obrigatórios'
      });
    }
    
    // Formatar JIDs dos participantes
    const formattedParticipants = participants.map(formatUserJid);
    
    // Criar o grupo
    const groupInfo = await req.whatsappSession.sock.groupCreate(groupName, formattedParticipants);
    
    // Adicionar descrição se fornecida
    if (description && description.trim()) {
      await req.whatsappSession.sock.groupUpdateDescription(groupInfo.id, description);
    }
    
    res.json({
      success: true,
      message: 'Grupo criado com sucesso',
      groupInfo: {
        id: groupInfo.id,
        subject: groupInfo.subject,
        participants: formattedParticipants,
        description: description || null,
        createdAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao criar grupo',
      error: error.message
    });
  }
});

// Obter informações do grupo
router.get('/:sessionId/:groupId/info', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const formattedGroupId = formatGroupJid(groupId);
    
    // Obter metadados do grupo
    const groupMetadata = await req.whatsappSession.sock.groupMetadata(formattedGroupId);
    
    res.json({
      success: true,
      groupInfo: {
        id: groupMetadata.id,
        subject: groupMetadata.subject,
        description: groupMetadata.desc || null,
        owner: groupMetadata.owner,
        creation: groupMetadata.creation,
        size: groupMetadata.size,
        participants: groupMetadata.participants.map(p => ({
          id: p.id,
          isAdmin: p.admin === 'admin',
          isSuperAdmin: p.admin === 'superadmin'
        })),
        settings: {
          announce: groupMetadata.announce,
          restrict: groupMetadata.restrict
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter informações do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao obter informações do grupo',
      error: error.message
    });
  }
});

// Adicionar participantes ao grupo
router.post('/:sessionId/:groupId/add-participants', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { participants } = req.body;
    
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de participantes é obrigatória'
      });
    }
    
    const formattedGroupId = formatGroupJid(groupId);
    const formattedParticipants = participants.map(formatUserJid);
    
    // Adicionar participantes
    const result = await req.whatsappSession.sock.groupParticipantsUpdate(
      formattedGroupId,
      formattedParticipants,
      'add'
    );
    
    res.json({
      success: true,
      message: 'Participantes adicionados com sucesso',
      results: result,
      addedParticipants: formattedParticipants
    });
    
  } catch (error) {
    console.error('Erro ao adicionar participantes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao adicionar participantes',
      error: error.message
    });
  }
});

// Remover participantes do grupo
router.post('/:sessionId/:groupId/remove-participants', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { participants } = req.body;
    
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de participantes é obrigatória'
      });
    }
    
    const formattedGroupId = formatGroupJid(groupId);
    const formattedParticipants = participants.map(formatUserJid);
    
    // Remover participantes
    const result = await req.whatsappSession.sock.groupParticipantsUpdate(
      formattedGroupId,
      formattedParticipants,
      'remove'
    );
    
    res.json({
      success: true,
      message: 'Participantes removidos com sucesso',
      results: result,
      removedParticipants: formattedParticipants
    });
    
  } catch (error) {
    console.error('Erro ao remover participantes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao remover participantes',
      error: error.message
    });
  }
});

// Promover participantes a admin
router.post('/:sessionId/:groupId/promote', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { participants } = req.body;
    
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de participantes é obrigatória'
      });
    }
    
    const formattedGroupId = formatGroupJid(groupId);
    const formattedParticipants = participants.map(formatUserJid);
    
    // Promover participantes
    const result = await req.whatsappSession.sock.groupParticipantsUpdate(
      formattedGroupId,
      formattedParticipants,
      'promote'
    );
    
    res.json({
      success: true,
      message: 'Participantes promovidos a admin com sucesso',
      results: result,
      promotedParticipants: formattedParticipants
    });
    
  } catch (error) {
    console.error('Erro ao promover participantes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao promover participantes',
      error: error.message
    });
  }
});

// Despromover admins
router.post('/:sessionId/:groupId/demote', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { participants } = req.body;
    
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de participantes é obrigatória'
      });
    }
    
    const formattedGroupId = formatGroupJid(groupId);
    const formattedParticipants = participants.map(formatUserJid);
    
    // Despromover participantes
    const result = await req.whatsappSession.sock.groupParticipantsUpdate(
      formattedGroupId,
      formattedParticipants,
      'demote'
    );
    
    res.json({
      success: true,
      message: 'Admins despromovidos com sucesso',
      results: result,
      demotedParticipants: formattedParticipants
    });
    
  } catch (error) {
    console.error('Erro ao despromover participantes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao despromover participantes',
      error: error.message
    });
  }
});

// Atualizar nome do grupo
router.put('/:sessionId/:groupId/subject', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { subject } = req.body;
    
    if (!subject || subject.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nome do grupo é obrigatório'
      });
    }
    
    const formattedGroupId = formatGroupJid(groupId);
    
    // Atualizar nome do grupo
    await req.whatsappSession.sock.groupUpdateSubject(formattedGroupId, subject.trim());
    
    res.json({
      success: true,
      message: 'Nome do grupo atualizado com sucesso',
      newSubject: subject.trim()
    });
    
  } catch (error) {
    console.error('Erro ao atualizar nome do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar nome do grupo',
      error: error.message
    });
  }
});

// Atualizar descrição do grupo
router.put('/:sessionId/:groupId/description', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description } = req.body;
    
    const formattedGroupId = formatGroupJid(groupId);
    
    // Atualizar descrição do grupo
    await req.whatsappSession.sock.groupUpdateDescription(formattedGroupId, description || '');
    
    res.json({
      success: true,
      message: 'Descrição do grupo atualizada com sucesso',
      newDescription: description || null
    });
    
  } catch (error) {
    console.error('Erro ao atualizar descrição do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar descrição do grupo',
      error: error.message
    });
  }
});

// Configurar permissões do grupo
router.put('/:sessionId/:groupId/settings', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { onlyAdminsCanSend, onlyAdminsCanEditInfo } = req.body;
    
    const formattedGroupId = formatGroupJid(groupId);
    
    // Configurar se apenas admins podem enviar mensagens
    if (typeof onlyAdminsCanSend === 'boolean') {
      await req.whatsappSession.sock.groupSettingUpdate(
        formattedGroupId,
        onlyAdminsCanSend ? 'announcement' : 'not_announcement'
      );
    }
    
    // Configurar se apenas admins podem editar informações do grupo
    if (typeof onlyAdminsCanEditInfo === 'boolean') {
      await req.whatsappSession.sock.groupSettingUpdate(
        formattedGroupId,
        onlyAdminsCanEditInfo ? 'locked' : 'unlocked'
      );
    }
    
    res.json({
      success: true,
      message: 'Configurações do grupo atualizadas com sucesso',
      settings: {
        onlyAdminsCanSend: onlyAdminsCanSend,
        onlyAdminsCanEditInfo: onlyAdminsCanEditInfo
      }
    });
    
  } catch (error) {
    console.error('Erro ao atualizar configurações do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar configurações do grupo',
      error: error.message
    });
  }
});

// Sair do grupo
router.post('/:sessionId/:groupId/leave', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const formattedGroupId = formatGroupJid(groupId);
    
    // Sair do grupo
    await req.whatsappSession.sock.groupLeave(formattedGroupId);
    
    res.json({
      success: true,
      message: 'Saiu do grupo com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao sair do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao sair do grupo',
      error: error.message
    });
  }
});

// Listar grupos
router.get('/:sessionId/list', checkSession, async (req, res) => {
  try {
    // Get session from sessions map (global)
    const sessions = global.whatsappSessions;
    const sessionData = sessions.get(req.params.sessionId);
    
    if (!sessionData || !sessionData.sock || !sessionData.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não conectada'
      });
    }

    // Get groups from MongoDB first if available, then fallback to store
    let groups = [];
    
    try {
      const db = require('../config/database').getDb();
      if (db) {
        const groupsCollection = db.collection('groups');
        const mongoGroups = await groupsCollection
          .find({ sessionId: req.params.sessionId })
          .sort({ lastUpdated: -1 })
          .toArray();
        
        if (mongoGroups.length > 0) {
          groups = mongoGroups.map(group => ({
            jid: group.jid,
            name: group.name,
            participants: group.participants,
            description: group.description,
            owner: group.owner,
            admins: group.admins || [],
            superAdmins: group.superAdmins || [],
            announce: group.announce || false,
            restrict: group.restrict || false,
            createdAt: group.createdAt,
            lastUpdated: group.lastUpdated
          }));
          
          return res.json({
            success: true,
            groups: groups,
            total: groups.length,
            source: 'mongodb'
          });
        }
      }
    } catch (error) {
      console.warn('Failed to get groups from MongoDB:', error.message);
    }

    // Fallback: get groups from store (if supported)
    try {
      const store = sessionData.sock.store;
      if (store && store.chats) {
        const groupChats = Object.values(store.chats).filter(chat => 
          chat.id && chat.id.endsWith('@g.us')
        );

        const groupPromises = groupChats.map(async chat => {
          try {
            const groupMetadata = await sessionData.sock.groupMetadata(chat.id);
            
            const admins = groupMetadata.participants
              ? groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id)
              : [];
            
            const superAdmins = groupMetadata.participants
              ? groupMetadata.participants.filter(p => p.admin === 'superadmin').map(p => p.id)
              : [];

            return {
              jid: chat.id,
              name: groupMetadata.subject || 'Grupo sem nome',
              participants: groupMetadata.participants?.length || 0,
              description: groupMetadata.desc || null,
              owner: groupMetadata.owner || null,
              admins: admins,
              superAdmins: superAdmins,
              announce: groupMetadata.announce || false,
              restrict: groupMetadata.restrict || false,
              createdAt: groupMetadata.creation 
                ? new Date(groupMetadata.creation * 1000).toISOString()
                : null,
              unreadCount: chat.unreadCount || 0,
              lastMessageTime: chat.conversationTimestamp || null
            };
          } catch (error) {
            console.warn(`Error getting metadata for group ${chat.id}:`, error.message);
            return {
              jid: chat.id,
              name: chat.name || chat.subject || 'Grupo',
              participants: 0,
              description: null,
              owner: null,
              admins: [],
              superAdmins: [],
              announce: false,
              restrict: false,
              createdAt: null,
              unreadCount: chat.unreadCount || 0,
              lastMessageTime: chat.conversationTimestamp || null
            };
          }
        });

        groups = await Promise.all(groupPromises);
      }
    } catch (error) {
      console.warn('Failed to get groups from store:', error.message);
    }
    
    res.json({
      success: true,
      groups: groups,
      total: groups.length,
      source: 'store'
    });
    
  } catch (error) {
    console.error('Erro ao listar grupos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao listar grupos',
      error: error.message
    });
  }
});

// Obter código de convite do grupo
router.get('/:sessionId/:groupId/invite-code', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const formattedGroupId = formatGroupJid(groupId);
    
    // Obter código de convite
    const inviteCode = await req.whatsappSession.sock.groupInviteCode(formattedGroupId);
    
    res.json({
      success: true,
      inviteCode: inviteCode,
      inviteLink: `https://chat.whatsapp.com/${inviteCode}`
    });
    
  } catch (error) {
    console.error('Erro ao obter código de convite:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao obter código de convite',
      error: error.message
    });
  }
});

// Revogar código de convite do grupo
router.post('/:sessionId/:groupId/revoke-invite', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const formattedGroupId = formatGroupJid(groupId);
    
    // Revogar código de convite
    const newInviteCode = await req.whatsappSession.sock.groupRevokeInvite(formattedGroupId);
    
    res.json({
      success: true,
      message: 'Código de convite revogado com sucesso',
      newInviteCode: newInviteCode,
      newInviteLink: `https://chat.whatsapp.com/${newInviteCode}`
    });
    
  } catch (error) {
    console.error('Erro ao revogar código de convite:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao revogar código de convite',
      error: error.message
    });
  }
});

module.exports = router;