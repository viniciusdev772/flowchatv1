const express = require('express');
const router = express.Router();

// Funções auxiliares para processamento de mensagens
function extractMessageText(message) {
  try {
    if (!message || !message.message) return '';

    const msgContent = message.message;

    if (msgContent.conversation) {
      return msgContent.conversation;
    }
    if (msgContent.extendedTextMessage?.text) {
      return msgContent.extendedTextMessage.text;
    }
    if (msgContent.imageMessage?.caption) {
      return msgContent.imageMessage.caption;
    }
    if (msgContent.videoMessage?.caption) {
      return msgContent.videoMessage.caption;
    }
    if (msgContent.documentMessage?.caption) {
      return msgContent.documentMessage.caption;
    }

    return '';
  } catch (error) {
    return '';
  }
}

function getMessageType(message) {
  try {
    if (!message || !message.message) return 'unknown';

    const msgContent = message.message;

    if (msgContent.conversation || msgContent.extendedTextMessage) {
      return 'text';
    }
    if (msgContent.imageMessage) {
      return 'image';
    }
    if (msgContent.videoMessage) {
      return 'video';
    }
    if (msgContent.audioMessage) {
      return 'audio';
    }
    if (msgContent.documentMessage) {
      return 'document';
    }
    if (msgContent.stickerMessage) {
      return 'sticker';
    }
    if (msgContent.locationMessage) {
      return 'location';
    }
    if (msgContent.contactMessage) {
      return 'contact';
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

// Middleware para verificar se a sessão existe, está conectada e pertence ao usuário
const checkSession = (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user?.id || req.user?._id;

  // Check if user is authenticated
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
    });
  }

  // Acessar o objeto global sessions diretamente
  const sessions = global.whatsappSessions;

  if (!sessions || !sessions.has(sessionId)) {
    return res.status(404).json({
      success: false,
      message: 'Sessão não encontrada',
    });
  }

  const session = sessions.get(sessionId);

  // Check session ownership
  if (session.userId && session.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message:
        'Acesso negado: você não possui permissão para acessar esta sessão',
    });
  }

  if (!session.isConnected) {
    return res.status(400).json({
      success: false,
      message: 'Sessão não está conectada',
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

    if (
      !groupName ||
      !Array.isArray(participants) ||
      participants.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Nome do grupo e lista de participantes são obrigatórios',
      });
    }

    // Formatar JIDs dos participantes
    const formattedParticipants = participants.map(formatUserJid);

    // Criar o grupo
    const groupInfo = await req.whatsappSession.sock.groupCreate(
      groupName,
      formattedParticipants
    );

    // Adicionar descrição se fornecida
    if (description && description.trim()) {
      await req.whatsappSession.sock.groupUpdateDescription(
        groupInfo.id,
        description
      );
    }

    res.json({
      success: true,
      message: 'Grupo criado com sucesso',
      groupInfo: {
        id: groupInfo.id,
        subject: groupInfo.subject,
        participants: formattedParticipants,
        description: description || null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao criar grupo',
      error: error.message,
    });
  }
});

// Obter informações do grupo
router.get('/:sessionId/:groupId/info', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const formattedGroupId = formatGroupJid(groupId);

    // Obter metadados do grupo
    const groupMetadata = await req.whatsappSession.sock.groupMetadata(
      formattedGroupId
    );

    res.json({
      success: true,
      groupInfo: {
        id: groupMetadata.id,
        subject: groupMetadata.subject,
        description: groupMetadata.desc || null,
        owner: groupMetadata.owner,
        creation: groupMetadata.creation,
        size: groupMetadata.size,
        participants: groupMetadata.participants.map((p) => ({
          id: p.id,
          isAdmin: p.admin === 'admin',
          isSuperAdmin: p.admin === 'superadmin',
        })),
        settings: {
          announce: groupMetadata.announce,
          restrict: groupMetadata.restrict,
        },
      },
    });
  } catch (error) {
    console.error('Erro ao obter informações do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao obter informações do grupo',
      error: error.message,
    });
  }
});

// Adicionar participantes ao grupo
router.post(
  '/:sessionId/:groupId/add-participants',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const { participants } = req.body;

      if (!Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Lista de participantes é obrigatória',
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
        addedParticipants: formattedParticipants,
      });
    } catch (error) {
      console.error('Erro ao adicionar participantes:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao adicionar participantes',
        error: error.message,
      });
    }
  }
);

// Remover participantes do grupo
router.post(
  '/:sessionId/:groupId/remove-participants',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const { participants } = req.body;

      if (!Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Lista de participantes é obrigatória',
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
        removedParticipants: formattedParticipants,
      });
    } catch (error) {
      console.error('Erro ao remover participantes:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao remover participantes',
        error: error.message,
      });
    }
  }
);

// Promover participantes a admin
router.post('/:sessionId/:groupId/promote', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { participants } = req.body;

    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de participantes é obrigatória',
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
      promotedParticipants: formattedParticipants,
    });
  } catch (error) {
    console.error('Erro ao promover participantes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao promover participantes',
      error: error.message,
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
        message: 'Lista de participantes é obrigatória',
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
      demotedParticipants: formattedParticipants,
    });
  } catch (error) {
    console.error('Erro ao despromover participantes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao despromover participantes',
      error: error.message,
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
        message: 'Nome do grupo é obrigatório',
      });
    }

    const formattedGroupId = formatGroupJid(groupId);

    // Atualizar nome do grupo
    await req.whatsappSession.sock.groupUpdateSubject(
      formattedGroupId,
      subject.trim()
    );

    res.json({
      success: true,
      message: 'Nome do grupo atualizado com sucesso',
      newSubject: subject.trim(),
    });
  } catch (error) {
    console.error('Erro ao atualizar nome do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar nome do grupo',
      error: error.message,
    });
  }
});

// Atualizar descrição do grupo
router.put(
  '/:sessionId/:groupId/description',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const { description } = req.body;

      const formattedGroupId = formatGroupJid(groupId);

      // Atualizar descrição do grupo
      await req.whatsappSession.sock.groupUpdateDescription(
        formattedGroupId,
        description || ''
      );

      res.json({
        success: true,
        message: 'Descrição do grupo atualizada com sucesso',
        newDescription: description || null,
      });
    } catch (error) {
      console.error('Erro ao atualizar descrição do grupo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao atualizar descrição do grupo',
        error: error.message,
      });
    }
  }
);

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
        onlyAdminsCanEditInfo: onlyAdminsCanEditInfo,
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar configurações do grupo',
      error: error.message,
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
      message: 'Saiu do grupo com sucesso',
    });
  } catch (error) {
    console.error('Erro ao sair do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao sair do grupo',
      error: error.message,
    });
  }
});

// Listar grupos
router.get('/:sessionId/list', checkSession, async (req, res) => {
  try {
    const sock = req.whatsappSession.sock;

    // Parâmetros de paginação e busca
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50); // Min 1, Max 50, Default 10
    const offset = Math.max(parseInt(req.query.offset) || 0, 0); // Min 0, Default 0
    const search = req.query.search?.trim(); // Parâmetro de busca opcional
    const includeParticipants = req.query.includeParticipants === 'true';

    console.log(
      `📋 Listing groups - limit: ${limit}, offset: ${offset}, search: "${
        search || 'none'
      }"`
    );

    // Obter lista de grupos diretamente do Baileys
    const groups = await sock.groupFetchAllParticipating();
    let groupEntries = Object.entries(groups);

    // Aplicar busca por nome se fornecida
    if (search) {
      const searchLower = search.toLowerCase();
      groupEntries = groupEntries.filter(([groupId, groupData]) => {
        const groupName = (groupData.subject || 'Grupo sem nome').toLowerCase();
        return groupName.includes(searchLower);
      });
      console.log(
        `🔍 Search "${search}" filtered to ${groupEntries.length} groups`
      );
    }

    // Aplicar paginação após filtros
    const totalGroups = groupEntries.length;
    const paginatedEntries = groupEntries.slice(offset, offset + limit);

    // Processar e formatar os dados dos grupos
    const groupList = [];

    for (const [groupId, groupData] of paginatedEntries) {
      try {
        // Obter metadados atualizados do grupo
        const groupMetadata = await sock.groupMetadata(groupId);

        // Verificar se os participants existem e são um array
        const participants = Array.isArray(groupMetadata.participants)
          ? groupMetadata.participants
          : [];

        // Separar participantes por tipo
        const admins = participants
          .filter((p) => p.admin === 'admin')
          .map((p) => p.id);

        const superAdmins = participants
          .filter((p) => p.admin === 'superadmin')
          .map((p) => p.id);

        const regularParticipants = participants
          .filter((p) => !p.admin || p.admin === null)
          .map((p) => p.id);
        const groupInfo = {
          jid: groupId,
          name: groupMetadata.subject || groupData.subject || 'Grupo sem nome',
          description: groupMetadata.desc || null,
          owner: groupMetadata.owner || null,
          participants: {
            total: participants.length,
            adminsCount: admins.length,
            superAdminsCount: superAdmins.length,
            regularCount: regularParticipants.length,
            // Incluir listas detalhadas só se solicitado
            ...(includeParticipants && {
              admins: admins,
              superAdmins: superAdmins,
              regular: regularParticipants,
              all: participants.map((p) => ({
                id: p.id,
                admin: p.admin || null,
                isAdmin: p.admin === 'admin',
                isSuperAdmin: p.admin === 'superadmin',
              })),
            }),
          },
          settings: {
            announce: groupMetadata.announce || false,
            restrict: groupMetadata.restrict || false,
          },
          createdAt: groupMetadata.creation
            ? new Date(groupMetadata.creation * 1000).toISOString()
            : null,
          size: groupMetadata.size || participants.length,
        };

        groupList.push(groupInfo);
      } catch (metaError) {
        console.warn(
          `Erro ao obter metadados do grupo ${groupId}:`,
          metaError.message
        ); // Em caso de erro, usar dados básicos do groupData
        const basicInfo = {
          jid: groupId,
          name: groupData.subject || 'Grupo',
          description: null,
          owner: null,
          participants: {
            total: 0,
            adminsCount: 0,
            superAdminsCount: 0,
            regularCount: 0,
          },
          settings: {
            announce: false,
            restrict: false,
          },
          createdAt: null,
          size: 0,
          error: 'Não foi possível obter metadados completos',
        };

        groupList.push(basicInfo);
      }
    }

    // Ordenar grupos por nome
    groupList.sort((a, b) => a.name.localeCompare(b.name));

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalGroups / limit);

    console.log(
      `✅ Returning ${groupList.length} groups (page ${currentPage}/${totalPages})`
    );

    res.json({
      success: true,
      groups: groupList,
      pagination: {
        total: totalGroups,
        limit: limit,
        offset: offset,
        returned: groupList.length,
        hasMore: offset + limit < totalGroups,
        currentPage: currentPage,
        totalPages: totalPages,
        // Informações de navegação úteis para a IA
        nextOffset: offset + limit < totalGroups ? offset + limit : null,
        prevOffset: offset > 0 ? Math.max(0, offset - limit) : null,
      },
      filters: {
        search: search || null,
        includeParticipants: includeParticipants,
      },
      source: 'baileys',
    });
  } catch (error) {
    console.error('Erro ao listar grupos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao listar grupos',
      error: error.message,
    });
  }
});

// Obter código de convite do grupo
router.get(
  '/:sessionId/:groupId/invite-code',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const formattedGroupId = formatGroupJid(groupId);

      // Obter código de convite
      const inviteCode = await req.whatsappSession.sock.groupInviteCode(
        formattedGroupId
      );

      res.json({
        success: true,
        inviteCode: inviteCode,
        inviteLink: `https://chat.whatsapp.com/${inviteCode}`,
      });
    } catch (error) {
      console.error('Erro ao obter código de convite:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao obter código de convite',
        error: error.message,
      });
    }
  }
);

// Revogar código de convite do grupo
router.post(
  '/:sessionId/:groupId/revoke-invite',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const formattedGroupId = formatGroupJid(groupId);

      // Revogar código de convite
      const newInviteCode = await req.whatsappSession.sock.groupRevokeInvite(
        formattedGroupId
      );

      res.json({
        success: true,
        message: 'Código de convite revogado com sucesso',
        newInviteCode: newInviteCode,
        newInviteLink: `https://chat.whatsapp.com/${newInviteCode}`,
      });
    } catch (error) {
      console.error('Erro ao revogar código de convite:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao revogar código de convite',
        error: error.message,
      });
    }
  }
);

// ====== ROTAS PARA MENSAGENS DE GRUPOS ======

// Obter mensagens de um grupo específico
router.get('/:sessionId/:groupId/messages', checkSession, async (req, res) => {
  try {
    const { sessionId, groupId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const before = req.query.before; // timestamp para buscar mensagens antes
    const includeParticipants = req.query.includeParticipants === 'true';
    const search = req.query.search?.trim(); // busca por texto nas mensagens

    console.log(
      `📨 Getting group messages - groupId: ${groupId}, limit: ${limit}, offset: ${offset}`
    );

    const formattedGroupId = formatGroupJid(groupId);
    const session = req.whatsappSession;

    // Verificar se o grupo existe
    try {
      const groupMetadata = await session.sock.groupMetadata(formattedGroupId);
      if (!groupMetadata) {
        return res.status(404).json({
          success: false,
          message: 'Grupo não encontrado',
        });
      }
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Grupo não encontrado ou inacessível',
        error: error.message,
      });
    }

    // Buscar mensagens do MongoDB se disponível
    const db = require('../config/database').getDb();
    let messages = [];
    let total = 0;
    let source = 'memory';

    if (db) {
      try {
        const messagesCollection = db.collection('messages');

        // Construir query para filtrar por grupo
        const query = {
          sessionId: sessionId,
          jid: formattedGroupId,
        };

        // Adicionar filtro de timestamp se fornecido
        if (before) {
          query.timestamp = { $lt: parseInt(before) };
        }

        // Buscar mensagens com paginação
        const dbMessages = await messagesCollection
          .find(query)
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();

        // Contar total de mensagens
        total = await messagesCollection.countDocuments(query);

        // Processar mensagens
        messages = dbMessages.map((msg) => {
          const messageInfo = {
            messageId: msg.messageId,
            jid: msg.jid,
            timestamp: msg.timestamp,
            isFromMe: msg.isFromMe,
            messageText: msg.messageText,
            messageType: msg.messageType,
            pushName: msg.message?.pushName || null,
            chatInfo: msg.chatInfo || null,
          };

          // Adicionar informações do participante se for mensagem de grupo
          if (msg.message?.key?.participant) {
            messageInfo.participant = {
              jid: msg.message.key.participant,
              number: msg.message.key.participant.includes('@')
                ? msg.message.key.participant.split('@')[0]
                : msg.message.key.participant,
              pushName: msg.message.pushName || null,
            };
          }

          // Verificar se é uma resposta
          if (
            msg.message?.message?.extendedTextMessage?.contextInfo
              ?.quotedMessage
          ) {
            const contextInfo =
              msg.message.message.extendedTextMessage.contextInfo;
            messageInfo.isReply = true;
            messageInfo.quotedMessage = {
              messageId: contextInfo.stanzaId,
              participant: contextInfo.participant,
              text:
                contextInfo.quotedMessage?.conversation ||
                contextInfo.quotedMessage?.extendedTextMessage?.text ||
                '[Mídia citada]',
            };
          }

          return messageInfo;
        });

        // Aplicar filtro de busca por texto se fornecido
        if (search) {
          const searchLower = search.toLowerCase();
          messages = messages.filter(
            (msg) =>
              msg.messageText &&
              msg.messageText.toLowerCase().includes(searchLower)
          );
          total = messages.length; // Recalcular total após filtro
        }

        source = 'database';
        console.log(`✅ Found ${messages.length} messages from database`);
      } catch (dbError) {
        console.warn(
          'Erro ao buscar mensagens no MongoDB, usando memória:',
          dbError.message
        );
        // Fallback para busca em memória
      }
    }

    // Fallback: buscar da memória se MongoDB não disponível ou falhou
    if (messages.length === 0 && source === 'memory') {
      const messageStore = global.messageStore;
      if (messageStore && messageStore.has(sessionId)) {
        const sessionMessages = messageStore.get(sessionId);
        const allMessages = Array.from(sessionMessages.values());

        // Filtrar por grupo
        let groupMessages = allMessages.filter(
          (data) => data.jid === formattedGroupId
        );

        // Aplicar filtro de busca por texto
        if (search) {
          const searchLower = search.toLowerCase();
          groupMessages = groupMessages.filter((data) => {
            const messageText = extractMessageText(data.message);
            return (
              messageText && messageText.toLowerCase().includes(searchLower)
            );
          });
        }

        // Ordenar por timestamp (mais recentes primeiro)
        groupMessages.sort((a, b) => b.timestamp - a.timestamp);

        total = groupMessages.length;
        const paginatedMessages = groupMessages.slice(offset, offset + limit);

        messages = paginatedMessages.map((data) => {
          const message = data.message;
          const messageInfo = {
            messageId: data.messageId,
            jid: data.jid,
            timestamp: data.timestamp,
            isFromMe: message.key.fromMe,
            messageText: extractMessageText(message),
            messageType: getMessageType(message),
            pushName: message.pushName || null,
            chatInfo: null,
          };

          // Adicionar informações do participante
          if (message.key.participant) {
            messageInfo.participant = {
              jid: message.key.participant,
              number: message.key.participant.includes('@')
                ? message.key.participant.split('@')[0]
                : message.key.participant,
              pushName: message.pushName || null,
            };
          }

          // Verificar se é uma resposta
          if (
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage
          ) {
            const contextInfo = message.message.extendedTextMessage.contextInfo;
            messageInfo.isReply = true;
            messageInfo.quotedMessage = {
              messageId: contextInfo.stanzaId,
              participant: contextInfo.participant,
              text:
                contextInfo.quotedMessage?.conversation ||
                contextInfo.quotedMessage?.extendedTextMessage?.text ||
                '[Mídia citada]',
            };
          }

          return messageInfo;
        });

        console.log(`✅ Found ${messages.length} messages from memory`);
      }
    }

    // Obter informações do grupo se solicitado
    let groupInfo = null;
    if (includeParticipants) {
      try {
        const groupMetadata = await session.sock.groupMetadata(
          formattedGroupId
        );
        const participants = Array.isArray(groupMetadata.participants)
          ? groupMetadata.participants
          : [];

        groupInfo = {
          jid: formattedGroupId,
          name: groupMetadata.subject || 'Grupo sem nome',
          description: groupMetadata.desc || null,
          owner: groupMetadata.owner || null,
          participants: {
            total: participants.length,
            admins: participants
              .filter((p) => p.admin === 'admin')
              .map((p) => p.id),
            superAdmins: participants
              .filter((p) => p.admin === 'superadmin')
              .map((p) => p.id),
            regular: participants
              .filter((p) => !p.admin || p.admin === null)
              .map((p) => p.id),
            all: participants.map((p) => ({
              id: p.id,
              admin: p.admin || null,
              isAdmin: p.admin === 'admin',
              isSuperAdmin: p.admin === 'superadmin',
            })),
          },
          settings: {
            announce: groupMetadata.announce || false,
            restrict: groupMetadata.restrict || false,
          },
          createdAt: groupMetadata.creation
            ? new Date(groupMetadata.creation * 1000).toISOString()
            : null,
        };
      } catch (groupError) {
        console.warn('Erro ao obter informações do grupo:', groupError.message);
      }
    }

    // Calcular paginação
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      messages: messages.reverse(), // Mais recentes primeiro
      groupInfo: groupInfo,
      pagination: {
        total: total,
        limit: limit,
        offset: offset,
        returned: messages.length,
        hasMore: offset + limit < total,
        currentPage: currentPage,
        totalPages: totalPages,
        nextOffset: offset + limit < total ? offset + limit : null,
        prevOffset: offset > 0 ? Math.max(0, offset - limit) : null,
      },
      filters: {
        search: search || null,
        includeParticipants: includeParticipants,
        before: before || null,
      },
      source: source,
      sessionId: sessionId,
      groupId: formattedGroupId,
    });
  } catch (error) {
    console.error('Erro ao obter mensagens do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao obter mensagens do grupo',
      error: error.message,
    });
  }
});

// Buscar mensagens em todos os grupos da sessão
router.get('/:sessionId/messages/search', checkSession, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const search = req.query.search?.trim();
    const groupName = req.query.groupName?.trim(); // filtro por nome do grupo
    const includeParticipants = req.query.includeParticipants === 'true';
    const before = req.query.before; // timestamp

    console.log(
      `🔍 Searching group messages - search: "${search}", groupName: "${groupName}"`
    );

    if (!search && !groupName) {
      return res.status(400).json({
        success: false,
        message:
          'Parâmetro de busca (search) ou nome do grupo (groupName) é obrigatório',
      });
    }

    const session = req.whatsappSession;
    let messages = [];
    let total = 0;
    let source = 'memory';
    let groupsFound = [];

    // Buscar mensagens do MongoDB se disponível
    const db = require('../config/database').getDb();

    if (db) {
      try {
        const messagesCollection = db.collection('messages');

        // Construir query para filtrar mensagens de grupos
        const query = {
          sessionId: sessionId,
          jid: { $regex: '@g.us$' }, // apenas grupos
        };

        // Adicionar filtro de timestamp se fornecido
        if (before) {
          query.timestamp = { $lt: parseInt(before) };
        }

        // Buscar mensagens de grupos
        let dbMessages = await messagesCollection
          .find(query)
          .sort({ timestamp: -1 })
          .toArray();

        // Aplicar filtros
        if (search) {
          const searchLower = search.toLowerCase();
          dbMessages = dbMessages.filter(
            (msg) =>
              msg.messageText &&
              msg.messageText.toLowerCase().includes(searchLower)
          );
        }

        if (groupName) {
          const groupNameLower = groupName.toLowerCase();
          dbMessages = dbMessages.filter((msg) => {
            const chatInfo = msg.chatInfo;
            if (chatInfo && chatInfo.type === 'group' && chatInfo.name) {
              return chatInfo.name.toLowerCase().includes(groupNameLower);
            }
            return false;
          });
        }

        total = dbMessages.length;
        const paginatedMessages = dbMessages.slice(offset, offset + limit);

        // Processar mensagens e extrair grupos únicos
        const groupsMap = new Map();
        messages = paginatedMessages.map((msg) => {
          // Adicionar grupo ao mapa se não existir
          if (msg.chatInfo && msg.chatInfo.type === 'group') {
            if (!groupsMap.has(msg.jid)) {
              groupsMap.set(msg.jid, {
                jid: msg.jid,
                name: msg.chatInfo.name || 'Grupo sem nome',
                participants: msg.chatInfo.participants || 0,
                description: msg.chatInfo.description || null,
              });
            }
          }

          const messageInfo = {
            messageId: msg.messageId,
            jid: msg.jid,
            timestamp: msg.timestamp,
            isFromMe: msg.isFromMe,
            messageText: msg.messageText,
            messageType: msg.messageType,
            pushName: msg.message?.pushName || null,
            chatInfo: msg.chatInfo || null,
          };

          // Adicionar informações do participante se for mensagem de grupo
          if (msg.message?.key?.participant) {
            messageInfo.participant = {
              jid: msg.message.key.participant,
              number: msg.message.key.participant.includes('@')
                ? msg.message.key.participant.split('@')[0]
                : msg.message.key.participant,
              pushName: msg.message.pushName || null,
            };
          }

          return messageInfo;
        });

        groupsFound = Array.from(groupsMap.values());
        source = 'database';
        console.log(
          `✅ Found ${messages.length} messages from ${groupsFound.length} groups in database`
        );
      } catch (dbError) {
        console.warn(
          'Erro ao buscar mensagens no MongoDB, usando memória:',
          dbError.message
        );
      }
    }

    // Fallback: buscar da memória se MongoDB não disponível
    if (messages.length === 0 && source === 'memory') {
      const messageStore = global.messageStore;
      if (messageStore && messageStore.has(sessionId)) {
        const sessionMessages = messageStore.get(sessionId);
        const allMessages = Array.from(sessionMessages.values());

        // Filtrar apenas mensagens de grupos
        let groupMessages = allMessages.filter((data) =>
          data.jid.endsWith('@g.us')
        );

        // Aplicar filtros
        if (search) {
          const searchLower = search.toLowerCase();
          groupMessages = groupMessages.filter((data) => {
            const messageText = extractMessageText(data.message);
            return (
              messageText && messageText.toLowerCase().includes(searchLower)
            );
          });
        }

        // Ordenar por timestamp
        groupMessages.sort((a, b) => b.timestamp - a.timestamp);

        total = groupMessages.length;
        const paginatedMessages = groupMessages.slice(offset, offset + limit);

        // Obter informações dos grupos únicos
        const groupsMap = new Map();
        for (const data of paginatedMessages) {
          if (!groupsMap.has(data.jid)) {
            try {
              const groupMetadata = await session.sock.groupMetadata(data.jid);
              groupsMap.set(data.jid, {
                jid: data.jid,
                name: groupMetadata.subject || 'Grupo sem nome',
                participants: groupMetadata.participants?.length || 0,
                description: groupMetadata.desc || null,
              });
            } catch (error) {
              groupsMap.set(data.jid, {
                jid: data.jid,
                name: 'Grupo',
                participants: 0,
                description: null,
              });
            }
          }
        }

        // Filtrar por nome do grupo se especificado
        if (groupName) {
          const groupNameLower = groupName.toLowerCase();
          const filteredGroups = Array.from(groupsMap.entries()).filter(
            ([jid, info]) => info.name.toLowerCase().includes(groupNameLower)
          );

          const filteredGroupJids = new Set(filteredGroups.map(([jid]) => jid));
          const filteredMessages = paginatedMessages.filter((data) =>
            filteredGroupJids.has(data.jid)
          );

          groupsFound = filteredGroups.map(([jid, info]) => info);
          total = filteredMessages.length;

          messages = filteredMessages.map((data) => {
            const message = data.message;
            return {
              messageId: data.messageId,
              jid: data.jid,
              timestamp: data.timestamp,
              isFromMe: message.key.fromMe,
              messageText: extractMessageText(message),
              messageType: getMessageType(message),
              pushName: message.pushName || null,
              chatInfo: groupsMap.get(data.jid),
              participant: message.key.participant
                ? {
                    jid: message.key.participant,
                    number: message.key.participant.includes('@')
                      ? message.key.participant.split('@')[0]
                      : message.key.participant,
                    pushName: message.pushName || null,
                  }
                : null,
            };
          });
        } else {
          groupsFound = Array.from(groupsMap.values());
          messages = paginatedMessages.map((data) => {
            const message = data.message;
            return {
              messageId: data.messageId,
              jid: data.jid,
              timestamp: data.timestamp,
              isFromMe: message.key.fromMe,
              messageText: extractMessageText(message),
              messageType: getMessageType(message),
              pushName: message.pushName || null,
              chatInfo: groupsMap.get(data.jid),
              participant: message.key.participant
                ? {
                    jid: message.key.participant,
                    number: message.key.participant.includes('@')
                      ? message.key.participant.split('@')[0]
                      : message.key.participant,
                    pushName: message.pushName || null,
                  }
                : null,
            };
          });
        }

        console.log(
          `✅ Found ${messages.length} messages from ${groupsFound.length} groups in memory`
        );
      }
    }

    // Adicionar informações detalhadas dos participantes se solicitado
    if (includeParticipants && groupsFound.length > 0) {
      for (const group of groupsFound) {
        try {
          const groupMetadata = await session.sock.groupMetadata(group.jid);
          const participants = Array.isArray(groupMetadata.participants)
            ? groupMetadata.participants
            : [];

          group.participants = {
            total: participants.length,
            admins: participants
              .filter((p) => p.admin === 'admin')
              .map((p) => p.id),
            superAdmins: participants
              .filter((p) => p.admin === 'superadmin')
              .map((p) => p.id),
            regular: participants
              .filter((p) => !p.admin || p.admin === null)
              .map((p) => p.id),
            all: participants.map((p) => ({
              id: p.id,
              admin: p.admin || null,
              isAdmin: p.admin === 'admin',
              isSuperAdmin: p.admin === 'superadmin',
            })),
          };
        } catch (error) {
          console.warn(
            `Erro ao obter participantes do grupo ${group.jid}:`,
            error.message
          );
        }
      }
    }

    // Calcular paginação
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      messages: messages.reverse(), // Mais recentes primeiro
      groups: groupsFound,
      pagination: {
        total: total,
        limit: limit,
        offset: offset,
        returned: messages.length,
        hasMore: offset + limit < total,
        currentPage: currentPage,
        totalPages: totalPages,
        nextOffset: offset + limit < total ? offset + limit : null,
        prevOffset: offset > 0 ? Math.max(0, offset - limit) : null,
      },
      filters: {
        search: search || null,
        groupName: groupName || null,
        includeParticipants: includeParticipants,
        before: before || null,
      },
      source: source,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens em grupos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar mensagens em grupos',
      error: error.message,
    });
  }
});

module.exports = router;
