const express = require('express');
const router = express.Router();

/**
 * @fileoverview This file defines the routes for managing WhatsApp groups.
 * @module api/groups
 */

/**
 * Extracts the text from a message object.
 * @param {object} message - The message object.
 * @returns {string} The extracted text.
 */
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

/**
 * Gets the type of a message.
 * @param {object} message - The message object.
 * @returns {string} The message type.
 */
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

/**
 * Middleware to check if a WhatsApp session is valid and connected.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
const checkSession = (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user?.id || req.user?._id;


  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
    });
  }


  const sessions = global.whatsappSessions;

  if (!sessions || !sessions.has(sessionId)) {
    return res.status(404).json({
      success: false,
      message: 'Sessão não encontrada',
    });
  }

  const session = sessions.get(sessionId);


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

/**
 * Formats a group ID to the correct JID format.
 * @param {string} groupId - The group ID.
 * @returns {string} The formatted group JID.
 */
const formatGroupJid = (groupId) => {
  if (groupId.includes('@g.us')) {
    return groupId;
  }
  return `${groupId}@g.us`;
};

/**
 * Formats a user ID to the correct JID format.
 * @param {string} userId - The user ID.
 * @returns {string} The formatted user JID.
 */
const formatUserJid = (userId) => {
  if (userId.includes('@s.whatsapp.net')) {
    return userId;
  }
  return `${userId}@s.whatsapp.net`;
};


/**
 * @swagger
 * /groups/{sessionId}/create:
 *   post:
 *     summary: Create a new WhatsApp group
 *     description: Creates a new WhatsApp group with the provided name and participants.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupName:
 *                 type: string
 *                 description: The name of the group.
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of participant JIDs to add to the group.
 *               description:
 *                 type: string
 *                 description: The group description.
 *     responses:
 *       '200':
 *         description: The group was created successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
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


    const formattedParticipants = participants.map(formatUserJid);


    const groupInfo = await req.whatsappSession.sock.groupCreate(
      groupName,
      formattedParticipants
    );


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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/info:
 *   get:
 *     summary: Get group information
 *     description: Retrieves metadata for a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     responses:
 *       '200':
 *         description: Successfully retrieved group metadata.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:sessionId/:groupId/info', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const formattedGroupId = formatGroupJid(groupId);


    const groupMetadata = await req.whatsappSession.sock.groupMetadata(
      formattedGroupId
    );

    res.json({
      success: true,
      groupMetadata,
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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/add-participants:
 *   post:
 *     summary: Add participants to a group
 *     description: Adds one or more participants to a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of participant JIDs to add to the group.
 *     responses:
 *       '200':
 *         description: Participants added successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/remove-participants:
 *   post:
 *     summary: Remove participants from a group
 *     description: Removes one or more participants from a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of participant JIDs to remove from the group.
 *     responses:
 *       '200':
 *         description: Participants removed successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/promote:
 *   post:
 *     summary: Promote participants to admin
 *     description: Promotes one or more participants to admin status in a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of participant JIDs to promote to admin.
 *     responses:
 *       '200':
 *         description: Participants promoted successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/demote:
 *   post:
 *     summary: Demote participants from admin
 *     description: Demotes one or more participants from admin status in a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of participant JIDs to demote from admin.
 *     responses:
 *       '200':
 *         description: Participants demoted successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/subject:
 *   put:
 *     summary: Update group subject
 *     description: Updates the subject (name) of a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *                 description: The new subject for the group.
 *     responses:
 *       '200':
 *         description: Group subject updated successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/description:
 *   put:
 *     summary: Update group description
 *     description: Updates the description of a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: The new description for the group.
 *     responses:
 *       '200':
 *         description: Group description updated successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
router.put(
  '/:sessionId/:groupId/description',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const { description } = req.body;

      const formattedGroupId = formatGroupJid(groupId);


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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/settings:
 *   put:
 *     summary: Update group settings
 *     description: Updates the settings of a specific WhatsApp group, such as who can send messages or edit group info.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               onlyAdminsCanSend:
 *                 type: boolean
 *                 description: Set to true to allow only admins to send messages.
 *               onlyAdminsCanEditInfo:
 *                 type: boolean
 *                 description: Set to true to allow only admins to edit group info.
 *     responses:
 *       '200':
 *         description: Group settings updated successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
router.put('/:sessionId/:groupId/settings', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { onlyAdminsCanSend, onlyAdminsCanEditInfo } = req.body;

    const formattedGroupId = formatGroupJid(groupId);


    if (typeof onlyAdminsCanSend === 'boolean') {
      await req.whatsappSession.sock.groupSettingUpdate(
        formattedGroupId,
        onlyAdminsCanSend ? 'announcement' : 'not_announcement'
      );
    }


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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/leave:
 *   post:
 *     summary: Leave a group
 *     description: Leaves a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     responses:
 *       '200':
 *         description: Successfully left the group.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
router.post('/:sessionId/:groupId/leave', checkSession, async (req, res) => {
  try {
    const { groupId } = req.params;
    const formattedGroupId = formatGroupJid(groupId);


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


/**
 * @swagger
 * /groups/{sessionId}/list:
 *   get:
 *     summary: List all groups
 *     description: Retrieves a paginated list of all WhatsApp groups the user is participating in.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The maximum number of groups to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: The number of groups to skip before starting to collect the result set.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: A search term to filter groups by name.
 *       - in: query
 *         name: includeParticipants
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include the list of participants in the response.
 *     responses:
 *       '200':
 *         description: A list of groups.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:sessionId/list', checkSession, async (req, res) => {
  try {
    const sock = req.whatsappSession.sock;


    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const search = req.query.search?.trim();
    const includeParticipants = req.query.includeParticipants === 'true';

    console.log(
      `📋 Listing groups - limit: ${limit}, offset: ${offset}, search: "${
        search || 'none'
      }"`
    );


    const groups = await sock.groupFetchAllParticipating();
    let groupEntries = Object.entries(groups);


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


    const totalGroups = groupEntries.length;
    const paginatedEntries = groupEntries.slice(offset, offset + limit);


    const groupList = [];

    for (const [groupId, groupData] of paginatedEntries) {
      try {

        const groupMetadata = await sock.groupMetadata(groupId);


        const participants = Array.isArray(groupMetadata.participants)
          ? groupMetadata.participants
          : [];


        let enrichedParticipants = participants;
        if (includeParticipants) {
          enrichedParticipants = await Promise.all(
            participants.map(async (p) => {
              try {

                const profilePicUrl = await sock
                  .profilePictureUrl(p.id, 'preview')
                  .catch(() => null);


                const statusResult = await sock
                  .fetchStatus(p.id)
                  .catch(() => null);


                const onWhatsAppResult = await sock
                  .onWhatsApp(p.id.split('@')[0])
                  .catch(() => null);

                return {
                  ...p,
                  profilePicture: profilePicUrl,
                  statusResult: statusResult,
                  onWhatsAppResult: onWhatsAppResult,
                  number: p.id.includes('@') ? p.id.split('@')[0] : p.id,
                };
              } catch (error) {
                console.warn(
                  `Erro ao buscar dados do participante ${p.id}:`,
                  error.message
                );
                return {
                  ...p,
                  profilePicture: null,
                  statusResult: null,
                  onWhatsAppResult: null,
                  number: p.id.includes('@') ? p.id.split('@')[0] : p.id,
                };
              }
            })
          );
        }


        const admins = enrichedParticipants
          .filter((p) => p.admin === 'admin')
          .map((p) => p.id);

        const superAdmins = enrichedParticipants
          .filter((p) => p.admin === 'superadmin')
          .map((p) => p.id);

        const regularParticipants = enrichedParticipants
          .filter((p) => !p.admin || p.admin === null)
          .map((p) => p.id);
        const groupInfo = {
          jid: groupId,
          name: groupMetadata.subject || groupData.subject || 'Grupo sem nome',
          description: groupMetadata.desc || null,
          owner: groupMetadata.owner || null,
          participants: {
            total: enrichedParticipants.length,
            adminsCount: admins.length,
            superAdminsCount: superAdmins.length,
            regularCount: regularParticipants.length,

            ...(includeParticipants && {
              admins: admins,
              superAdmins: superAdmins,
              regular: regularParticipants,
              all: enrichedParticipants.map((p) => ({
                id: p.id,
                admin: p.admin || null,
                isAdmin: p.admin === 'admin',
                isSuperAdmin: p.admin === 'superadmin',
                fullData: p,
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
          size: groupMetadata.size || enrichedParticipants.length,
        };

        groupList.push(groupInfo);
      } catch (metaError) {
        console.warn(
          `Erro ao obter metadados do grupo ${groupId}:`,
          metaError.message
        );
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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/invite-code:
 *   get:
 *     summary: Get group invite code
 *     description: Retrieves the invite code for a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     responses:
 *       '200':
 *         description: Successfully retrieved the invite code.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
router.get(
  '/:sessionId/:groupId/invite-code',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const formattedGroupId = formatGroupJid(groupId);


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


/**
 * @swagger
 * /groups/{sessionId}/{groupId}/revoke-invite:
 *   post:
 *     summary: Revoke group invite code
 *     description: Revokes the current invite code for a specific WhatsApp group and generates a new one.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *     responses:
 *       '200':
 *         description: Successfully revoked the invite code.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
router.post(
  '/:sessionId/:groupId/revoke-invite',
  checkSession,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const formattedGroupId = formatGroupJid(groupId);


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




/**
 * @swagger
 * /groups/{sessionId}/{groupId}/messages:
 *   get:
 *     summary: Get group messages
 *     description: Retrieves a paginated list of messages from a specific WhatsApp group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp group.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: The maximum number of messages to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: The number of messages to skip before starting to collect the result set.
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: A timestamp to fetch messages before this point.
 *       - in: query
 *         name: includeParticipants
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include the group participant information in the response.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: A search term to filter messages by text.
 *     responses:
 *       '200':
 *         description: A list of messages.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or group not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:sessionId/:groupId/messages', checkSession, async (req, res) => {
  try {
    const { sessionId, groupId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const before = req.query.before;
    const includeParticipants = req.query.includeParticipants === 'true';
    const search = req.query.search?.trim();

    console.log(
      `📨 Getting group messages - groupId: ${groupId}, limit: ${limit}, offset: ${offset}`
    );

    const formattedGroupId = formatGroupJid(groupId);
    const session = req.whatsappSession;


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


    const db = require('../config/database').getDb();
    let messages = [];
    let total = 0;
    let source = 'memory';

    if (db) {
      try {
        const messagesCollection = db.collection('messages');


        const query = {
          sessionId: sessionId,
          jid: formattedGroupId,
        };


        if (before) {
          query.timestamp = { $lt: parseInt(before) };
        }


        const dbMessages = await messagesCollection
          .find(query)
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();


        total = await messagesCollection.countDocuments(query);


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


          if (msg.message?.key?.participant) {
            messageInfo.participant = {
              jid: msg.message.key.participant,
              number: msg.message.key.participant.includes('@')
                ? msg.message.key.participant.split('@')[0]
                : msg.message.key.participant,
              pushName: msg.message.pushName || null,
            };
          }


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


        if (search) {
          const searchLower = search.toLowerCase();
          messages = messages.filter(
            (msg) =>
              msg.messageText &&
              msg.messageText.toLowerCase().includes(searchLower)
          );
          total = messages.length;
        }

        source = 'database';
        console.log(`✅ Found ${messages.length} messages from database`);
      } catch (dbError) {
        console.warn(
          'Erro ao buscar mensagens no MongoDB, usando memória:',
          dbError.message
        );

      }
    }


    if (messages.length === 0 && source === 'memory') {
      const messageStore = global.messageStore;
      if (messageStore && messageStore.has(sessionId)) {
        const sessionMessages = messageStore.get(sessionId);
        const allMessages = Array.from(sessionMessages.values());


        let groupMessages = allMessages.filter(
          (data) => data.jid === formattedGroupId
        );


        if (search) {
          const searchLower = search.toLowerCase();
          groupMessages = groupMessages.filter((data) => {
            const messageText = extractMessageText(data.message);
            return (
              messageText && messageText.toLowerCase().includes(searchLower)
            );
          });
        }


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


          if (message.key.participant) {
            messageInfo.participant = {
              jid: message.key.participant,
              number: message.key.participant.includes('@')
                ? message.key.participant.split('@')[0]
                : message.key.participant,
              pushName: message.pushName || null,
            };
          }


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
              fullData: p,
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


    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      messages: messages.reverse(),
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


/**
 * @swagger
 * /groups/{sessionId}/messages/search:
 *   get:
 *     summary: Search for messages in groups
 *     description: Searches for messages across all groups based on a search term and/or group name.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: The maximum number of messages to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: The number of messages to skip before starting to collect the result set.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: A search term to filter messages by text.
 *       - in: query
 *         name: groupName
 *         schema:
 *           type: string
 *         description: A search term to filter messages by group name.
 *       - in: query
 *         name: includeParticipants
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include the group participant information in the response.
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: A timestamp to fetch messages before this point.
 *     responses:
 *       '200':
 *         description: A list of messages that match the search criteria.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:sessionId/messages/search', checkSession, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const search = req.query.search?.trim();
    const groupName = req.query.groupName?.trim();
    const includeParticipants = req.query.includeParticipants === 'true';
    const before = req.query.before;

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


    const db = require('../config/database').getDb();

    if (db) {
      try {
        const messagesCollection = db.collection('messages');


        const query = {
          sessionId: sessionId,
          jid: { $regex: '@g.us$' },
        };


        if (before) {
          query.timestamp = { $lt: parseInt(before) };
        }


        let dbMessages = await messagesCollection
          .find(query)
          .sort({ timestamp: -1 })
          .toArray();


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


        const groupsMap = new Map();
        messages = paginatedMessages.map((msg) => {

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


    if (messages.length === 0 && source === 'memory') {
      const messageStore = global.messageStore;
      if (messageStore && messageStore.has(sessionId)) {
        const sessionMessages = messageStore.get(sessionId);
        const allMessages = Array.from(sessionMessages.values());


        let groupMessages = allMessages.filter((data) =>
          data.jid.endsWith('@g.us')
        );


        if (search) {
          const searchLower = search.toLowerCase();
          groupMessages = groupMessages.filter((data) => {
            const messageText = extractMessageText(data.message);
            return (
              messageText && messageText.toLowerCase().includes(searchLower)
            );
          });
        }


        groupMessages.sort((a, b) => b.timestamp - a.timestamp);

        total = groupMessages.length;
        const paginatedMessages = groupMessages.slice(offset, offset + limit);


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
              fullData: p,
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


    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      messages: messages.reverse(),
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


/**
 * @swagger
 * /groups/{sessionId}/contacts:
 *   get:
 *     summary: List all contacts
 *     description: Retrieves a paginated list of all contacts for the session.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the WhatsApp session.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: The maximum number of contacts to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: The number of contacts to skip before starting to collect the result set.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: A search term to filter contacts by name or phone number.
 *     responses:
 *       '200':
 *         description: A list of contacts.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:sessionId/contacts', checkSession, async (req, res) => {
  try {
    const sock = req.whatsappSession.sock;


    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const search = req.query.search?.trim();

    console.log(
      `📞 Listing contacts - limit: ${limit}, offset: ${offset}, search: "${
        search || 'none'
      }"`
    );

    let contacts = [];


    if (sock.store && sock.store.contacts) {
      const contactsStore = sock.store.contacts;
      contacts = Object.entries(contactsStore).map(([jid, contact]) => ({
        jid,
        name:
          contact.name ||
          contact.notify ||
          contact.verifiedName ||
          'Contato sem nome',
        notify: contact.notify || '',
        status: contact.status || '',
        imgUrl: contact.imgUrl || null,
        lid: contact.lid || null,
        isContact: true,
      }));
    } else {

      console.log('📞 Store não disponível, extraindo contatos dos chats...');

      try {

        const chats = await sock.fetchChats();


        const individualChats = chats.filter(
          (chat) =>
            chat.id.endsWith('@s.whatsapp.net') &&
            !chat.id.endsWith('@g.us') &&
            !chat.id.endsWith('@broadcast')
        );


        contacts = individualChats.map((chat) => ({
          jid: chat.id,
          name: chat.name || chat.notify || extractPhoneFromJid(chat.id),
          notify: chat.notify || '',
          status: '',
          imgUrl: null,
          lid: null,
          isContact: true,
          lastMessage: chat.lastMessage
            ? {
                timestamp: chat.lastMessage.messageTimestamp,
                text: extractMessageText(chat.lastMessage) || '[Mídia]',
              }
            : null,
        }));
      } catch (error) {
        console.warn('Erro ao buscar chats para contatos:', error.message);


        return res.json({
          success: true,
          contacts: [],
          total: 0,
          returned: 0,
          message:
            'Nenhum contato encontrado. Envie algumas mensagens primeiro para que os contatos apareçam.',
        });
      }
    }


    if (search) {
      const searchLower = search.toLowerCase();
      contacts = contacts.filter((contact) => {
        const name = (contact.name || '').toLowerCase();
        const phone = extractPhoneFromJid(contact.jid);
        return name.includes(searchLower) || phone.includes(search);
      });
      console.log(
        `🔍 Search "${search}" filtered to ${contacts.length} contacts`
      );
    }


    contacts.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });


    const totalContacts = contacts.length;
    const paginatedContacts = contacts.slice(offset, offset + limit);

    console.log(
      `📞 Retrieved ${paginatedContacts.length} contacts (${totalContacts} total)`
    );

    res.json({
      success: true,
      contacts: paginatedContacts,
      total: totalContacts,
      returned: paginatedContacts.length,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < totalContacts,
      },
    });
  } catch (error) {
    console.error('Erro ao listar contatos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao listar contatos',
      error: error.message,
    });
  }
});


/**
 * Extracts the phone number from a JID.
 * @param {string} jid - The JID.
 * @returns {string} The extracted phone number.
 */
function extractPhoneFromJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0] || '';
}

module.exports = router;
