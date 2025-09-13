const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const logger = require('pino')();
const { authenticateToken } = require('../middleware/auth');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

/**
 * @fileoverview This file defines the routes for managing message collectors.
 * @module api/messageCollector
 */

const activeCronJobs = new Map();

/**
 * Creates a new message collector in the database.
 * @param {string} sessionId - The ID of the WhatsApp session.
 * @param {string} groupId - The ID of the WhatsApp group.
 * @param {string} userId - The ID of the user.
 * @param {object} config - The configuration for the collector.
 * @returns {Promise<string|null>} The ID of the created collector, or null if an error occurred.
 */
async function createCollectorInDB(sessionId, groupId, userId, config) {
  try {
    const db = database.getDb();
    if (!db) throw new Error('Database não disponível');

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();


    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = (config.startHour || 0) * 60 + (config.startMinute || 0);
    const endTimeInMinutes = (config.endHour || 0) * 60 + (config.endMinute || 0);

    const isActive = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    const collectorId = uuidv4();

    await db.collection('messageCollectors').insertOne({
      _id: collectorId,
      sessionId,
      groupId,
      userId: new ObjectId(userId),
      config,
      status: 'active',
      isActive,
      totalMessages: 0,
      startTime: isActive ? now : null,
      endTime: null,
      createdAt: now,
      lastActivity: now,
    });

    return collectorId;
  } catch (error) {
    logger.error('Erro ao criar coletor no DB:', error);
    return null;
  }
}

/**
 * Updates the status of a message collector in the database.
 * @param {string} collectorId - The ID of the collector.
 * @param {object} updates - The updates to apply.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
async function updateCollectorStatus(collectorId, updates) {
  try {
    const db = database.getDb();
    if (!db) return false;

    await db.collection('messageCollectors').updateOne(
      { _id: collectorId },
      {
        $set: {
          ...updates,
          lastActivity: new Date(),
        },
      }
    );
    return true;
  } catch (error) {
    logger.error('Erro ao atualizar coletor:', error);
    return false;
  }
}

/**
 * Removes duplicate messages from a collector.
 * @param {string} collectorId - The ID of the collector.
 * @returns {Promise<object>} An object with the result of the operation.
 */
async function cleanDuplicateMessages(collectorId) {
  try {
    const db = database.getDb();
    if (!db) return { success: false, error: 'Database não disponível' };


    const messages = await db.collection('collectedMessages')
      .find({ collectorId })
      .sort({ collectedAt: 1 })
      .toArray();

    if (messages.length === 0) {
      return { success: true, removed: 0, total: 0 };
    }


    const seenIds = new Set();
    const duplicateIds = [];

    messages.forEach(msg => {
      if (seenIds.has(msg.id)) {
        duplicateIds.push(msg._id);
      } else {
        seenIds.add(msg.id);
      }
    });

    if (duplicateIds.length > 0) {

      await db.collection('collectedMessages').deleteMany({
        _id: { $in: duplicateIds }
      });


      const uniqueCount = messages.length - duplicateIds.length;
      await db.collection('messageCollectors').updateOne(
        { _id: collectorId },
        {
          $set: {
            totalMessages: uniqueCount,
            lastActivity: new Date()
          }
        }
      );

      logger.info(`🧹 Removidas ${duplicateIds.length} mensagens duplicadas do coletor ${collectorId}`);
    }

    return {
      success: true,
      removed: duplicateIds.length,
      total: messages.length,
      unique: messages.length - duplicateIds.length
    };
  } catch (error) {
    logger.error('Erro ao limpar mensagens duplicadas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Adds a message to the database for a specific collector.
 * @param {string} collectorId - The ID of the collector.
 * @param {object} messageData - The data of the message to add.
 * @returns {Promise<boolean>} True if the message was added successfully, false otherwise.
 */
async function addMessageToDB(collectorId, messageData) {
  try {
    const db = database.getDb();
    if (!db) return false;


    const existingMessage = await db.collection('collectedMessages').findOne({
      collectorId,
      id: messageData.id
    });

    if (existingMessage) {
      logger.debug(`⚠️  Mensagem duplicada ignorada: ${messageData.id}`);
      return false;
    }


    await db.collection('collectedMessages').insertOne({
      collectorId,
      ...messageData,
      collectedAt: new Date(),
    });


    await db.collection('messageCollectors').updateOne(
      { _id: collectorId },
      {
        $inc: { totalMessages: 1 },
        $set: { lastActivity: new Date() },
      }
    );

    logger.debug(`✅ Nova mensagem coletada: ${messageData.id}`);
    return true;
  } catch (error) {
    logger.error('Erro ao salvar mensagem:', error);
    return false;
  }
}

/**
 * Gets all active message collectors from the database.
 * @param {string|null} userId - The ID of the user to filter by.
 * @returns {Promise<Array<object>>} An array of active collectors.
 */
async function getActiveCollectors(userId = null) {
  try {
    const db = database.getDb();
    if (!db) return [];

    const query = { status: 'active' };
    if (userId) {
      query.userId = new ObjectId(userId);
    }

    return await db
      .collection('messageCollectors')
      .find(query)
      .toArray();
  } catch (error) {
    logger.error('Erro ao buscar coletores ativos:', error);
    return [];
  }
}

/**
 * Extracts the text from a message object.
 * @param {object} message - The message object.
 * @returns {string|null} The extracted text, or null if not found.
 */
function extractTextFromMessage(message) {
  if (!message.message) return null;


  if (message.message.conversation) {
    return message.message.conversation;
  }

  if (message.message.extendedTextMessage) {
    return message.message.extendedTextMessage.text;
  }

  if (message.message.quotedMessage) {

    return extractTextFromMessage({ message: message.message.quotedMessage });
  }


  if (message.message.imageMessage) return '[Imagem]';
  if (message.message.videoMessage) return '[Vídeo]';
  if (message.message.audioMessage) return '[Áudio]';
  if (message.message.documentMessage) return '[Documento]';
  if (message.message.stickerMessage) return '[Figurinha]';

  return null;
}

/**
 * Extracts relevant data from a message object.
 * @param {object} message - The message object.
 * @param {string} sessionId - The ID of the WhatsApp session.
 * @param {object} collectorConfig - The configuration of the collector.
 * @returns {Promise<object|null>} The extracted message data, or null if invalid.
 */
async function extractMessageData(message, sessionId, collectorConfig) {
  if (!message.message) return null;

  let messageData = {
    id: message.key.id,
    timestamp: new Date(message.messageTimestamp * 1000),
    from: message.key.participant || message.key.remoteJid,
    pushName: message.pushName || 'Usuário',
    sessionId: sessionId,
    groupId: message.key.remoteJid,
    text: null,
    mediaUrl: null,
    mediaType: null,
    hasMedia: false,
    caption: null,
    quotedMessage: null
  };


  const extractQuotedMessageInfo = (contextInfo) => {
    if (!contextInfo || !contextInfo.quotedMessage) return null;

    const quoted = contextInfo.quotedMessage;
    let quotedInfo = {
      id: contextInfo.stanzaId,
      participant: contextInfo.participant,
      text: null,
      mediaType: null,
      caption: null
    };


    if (quoted.conversation) {
      quotedInfo.text = quoted.conversation;
    } else if (quoted.extendedTextMessage) {
      quotedInfo.text = quoted.extendedTextMessage.text;
    } else if (quoted.imageMessage) {
      quotedInfo.mediaType = 'image';
      quotedInfo.caption = quoted.imageMessage.caption || null;
      quotedInfo.text = quotedInfo.caption || '[Imagem]';
    } else if (quoted.videoMessage) {
      quotedInfo.mediaType = 'video';
      quotedInfo.caption = quoted.videoMessage.caption || null;
      quotedInfo.text = quotedInfo.caption || '[Vídeo]';
    } else if (quoted.audioMessage) {
      quotedInfo.mediaType = 'audio';
      quotedInfo.text = '[Áudio]';
    } else if (quoted.documentMessage) {
      quotedInfo.mediaType = 'document';
      quotedInfo.caption = quoted.documentMessage.caption || null;
      quotedInfo.text = quotedInfo.caption || `[Documento: ${quoted.documentMessage.fileName || 'arquivo'}]`;
    } else if (quoted.stickerMessage) {
      quotedInfo.mediaType = 'sticker';
      quotedInfo.text = '[Figurinha]';
    }

    return quotedInfo;
  };


  if (message.message.conversation) {
    messageData.text = message.message.conversation;
  } else if (message.message.extendedTextMessage) {
    messageData.text = message.message.extendedTextMessage.text;


    if (message.message.extendedTextMessage.contextInfo) {
      messageData.quotedMessage = extractQuotedMessageInfo(message.message.extendedTextMessage.contextInfo);
    }
  } else if (message.message.imageMessage || message.message.videoMessage ||
             message.message.audioMessage || message.message.documentMessage ||
             message.message.stickerMessage) {

    messageData.hasMedia = true;


    if (message.message.imageMessage) {
      messageData.mediaType = 'image';
      messageData.caption = message.message.imageMessage.caption || null;
      messageData.text = messageData.caption || '[Imagem]';


      if (message.message.imageMessage.contextInfo) {
        messageData.quotedMessage = extractQuotedMessageInfo(message.message.imageMessage.contextInfo);
      }
    } else if (message.message.videoMessage) {
      messageData.mediaType = 'video';
      messageData.caption = message.message.videoMessage.caption || null;
      messageData.text = messageData.caption || '[Vídeo]';


      if (message.message.videoMessage.contextInfo) {
        messageData.quotedMessage = extractQuotedMessageInfo(message.message.videoMessage.contextInfo);
      }
    } else if (message.message.audioMessage) {
      messageData.mediaType = 'audio';
      messageData.text = '[Áudio]';


      if (message.message.audioMessage.contextInfo) {
        messageData.quotedMessage = extractQuotedMessageInfo(message.message.audioMessage.contextInfo);
      }
    } else if (message.message.documentMessage) {
      messageData.mediaType = 'document';
      messageData.caption = message.message.documentMessage.caption || null;
      const fileName = message.message.documentMessage.fileName || 'arquivo';
      messageData.text = messageData.caption || `[Documento: ${fileName}]`;


      if (message.message.documentMessage.contextInfo) {
        messageData.quotedMessage = extractQuotedMessageInfo(message.message.documentMessage.contextInfo);
      }
    } else if (message.message.stickerMessage) {
      messageData.mediaType = 'sticker';
      messageData.text = '[Figurinha]';


      if (message.message.stickerMessage.contextInfo) {
        messageData.quotedMessage = extractQuotedMessageInfo(message.message.stickerMessage.contextInfo);
      }
    }


    const shouldDownload = !collectorConfig || collectorConfig.downloadMedia !== false;

    if (shouldDownload) {
      try {
        const sock = global.whatsappSessions?.get(sessionId)?.sock;
        if (!sock) {
          logger.warn(`⚠️  Socket não encontrado para sessão ${sessionId}`);
        } else if (typeof global.downloadMediaToFile !== 'function') {
          logger.warn(`⚠️  Função downloadMediaToFile não disponível`);
        } else {
          logger.info(`📥 Tentando download de ${messageData.mediaType} para mensagem ${message.key.id}`);
          const mediaResult = await global.downloadMediaToFile(sock, message, sessionId);

          if (mediaResult && mediaResult.downloadUrl) {
            messageData.mediaUrl = mediaResult.downloadUrl;

            if (messageData.caption) {
              messageData.text = `${messageData.caption}\n${mediaResult.downloadUrl}`;
            } else {
              messageData.text = mediaResult.downloadUrl;
            }
            logger.info(`✅ Download de ${messageData.mediaType} bem-sucedido: ${mediaResult.downloadUrl}`);
          } else if (mediaResult && mediaResult.error) {
            logger.warn(`⚠️  Erro no download de ${messageData.mediaType}: ${mediaResult.message || mediaResult.error}`);
            messageData.text = `[${messageData.mediaType === 'image' ? 'Imagem' : messageData.mediaType === 'video' ? 'Vídeo' : messageData.mediaType === 'audio' ? 'Áudio' : messageData.mediaType === 'document' ? 'Documento' : messageData.mediaType === 'sticker' ? 'Figurinha' : 'Mídia'} - Erro no download]`;
          } else {
            logger.warn(`⚠️  Download de ${messageData.mediaType} retornou resultado inválido:`, mediaResult);
          }
        }
      } catch (error) {
        logger.error(`❌ Erro ao fazer download de ${messageData.mediaType}: ${error.message}`, error);

        messageData.text = `[${messageData.mediaType === 'image' ? 'Imagem' : messageData.mediaType === 'video' ? 'Vídeo' : messageData.mediaType === 'audio' ? 'Áudio' : messageData.mediaType === 'document' ? 'Documento' : messageData.mediaType === 'sticker' ? 'Figurinha' : 'Mídia'} - Erro]`;
      }
    }

  }

  return messageData;
}

/**
 * Sets up cron jobs for a message collector.
 * @param {string} collectorId - The ID of the collector.
 * @param {object} config - The configuration of the collector.
 * @returns {void}
 */
function setupCronJobs(collectorId, config) {
  const timezone = config.timezone || 'America/Sao_Paulo';
  const jobs = [];


  const now = new Date();
  if (config.endDate && now > config.endDate) {
    logger.info(`Coletor ${collectorId} expirado, não criando cron jobs`);
    return;
  }

  if (config.duration === 'days' && config.durationDays) {
    const endDate = new Date(config.createdAt);
    endDate.setDate(endDate.getDate() + config.durationDays);
    if (now > endDate) {
      logger.info(`Coletor ${collectorId} expirado por duração em dias, não criando cron jobs`);
      return;
    }
  }

  switch (config.scheduleType) {
    case 'daily':
      const startCron = `${config.startMinute || 0} ${config.startHour || 0} * * *`;
      const stopCron = `${config.endMinute || 0} ${config.endHour || 0} * * *`;

      jobs.push(cron.schedule(startCron, () => startCollection(collectorId, config), { scheduled: true, timezone }));
      jobs.push(cron.schedule(stopCron, () => stopCollection(collectorId, config), { scheduled: true, timezone }));
      break;

    case 'weekly':
      if (config.weekDays && config.weekDays.length > 0) {
        const daysStr = config.weekDays.join(',');
        const startWeeklyCron = `${config.startMinute || 0} ${config.startHour || 0} * * ${daysStr}`;
        const stopWeeklyCron = `${config.endMinute || 0} ${config.endHour || 0} * * ${daysStr}`;

        jobs.push(cron.schedule(startWeeklyCron, () => startCollection(collectorId, config), { scheduled: true, timezone }));
        jobs.push(cron.schedule(stopWeeklyCron, () => stopCollection(collectorId, config), { scheduled: true, timezone }));
      }
      break;

    case 'specific_days':
      if (config.specificDates && config.specificDates.length > 0) {
        config.specificDates.forEach(dateStr => {
          const date = new Date(dateStr);
          if (date > now) {
            const day = date.getDate();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();

            const startSpecificCron = `${config.startMinute || 0} ${config.startHour || 0} ${day} ${month} *`;
            const stopSpecificCron = `${config.endMinute || 0} ${config.endHour || 0} ${day} ${month} *`;

            jobs.push(cron.schedule(startSpecificCron, () => startCollection(collectorId, config), { scheduled: true, timezone }));
            jobs.push(cron.schedule(stopSpecificCron, () => stopCollection(collectorId, config), { scheduled: true, timezone }));
          }
        });
      }
      break;

    default:
      logger.warn(`Tipo de agendamento desconhecido: ${config.scheduleType}`);
      return;
  }


  if (jobs.length > 0) {
    activeCronJobs.set(collectorId, jobs);
    logger.info(`📅 Configurados ${jobs.length} cron jobs para coletor ${collectorId} (${config.scheduleType})`);
  }
}

/**
 * Starts the message collection for a specific collector.
 * @param {string} collectorId - The ID of the collector.
 * @param {object} config - The configuration of the collector.
 * @returns {Promise<void>}
 */
async function startCollection(collectorId, config) {

  const now = new Date();

  if (config.endDate && now > config.endDate) {
    logger.info(`Coletor ${collectorId} expirado por data final`);
    await updateCollectorStatus(collectorId, { status: 'completed', isActive: false });
    return;
  }

  if (config.duration === 'days' && config.durationDays) {
    const endDate = new Date(config.createdAt);
    endDate.setDate(endDate.getDate() + config.durationDays);
    if (now > endDate) {
      logger.info(`Coletor ${collectorId} expirado por duração em dias`);
      await updateCollectorStatus(collectorId, { status: 'completed', isActive: false });
      return;
    }
  }

  await updateCollectorStatus(collectorId, {
    isActive: true,
    startTime: now,
  });
  logger.info(`🕒 Cron: Iniciando coleta para ${collectorId} às ${String(config.startHour || 0).padStart(2, '0')}:${String(config.startMinute || 0).padStart(2, '0')}`);
}

/**
 * Stops the message collection for a specific collector.
 * @param {string} collectorId - The ID of the collector.
 * @param {object} config - The configuration of the collector.
 * @returns {Promise<void>}
 */
async function stopCollection(collectorId, config) {
  try {
    const db = database.getDb();
    if (!db) return;


    const collector = await db.collection('messageCollectors').findOne({ _id: collectorId });
    if (!collector) {
      logger.warn(`Coletor ${collectorId} não encontrado ao parar`);
      return;
    }

    await updateCollectorStatus(collectorId, {
      status: 'completed',
      isActive: false,
      endTime: new Date(),
    });

    logger.info(`🕒 Cron: Parando coleta para ${collectorId} às ${String(config.endHour || 0).padStart(2, '0')}:${String(config.endMinute || 0).padStart(2, '0')}`);


    if (collector.config?.autoSummary && collector.config?.summaryConfig?.summaryTime === 'end') {
      try {

        await updateCollectorStatus(collectorId, {
          pendingAutoSummary: true,
          autoSummaryPendingSince: new Date()
        });
        logger.info(`📝 Resumo automático marcado como pendente para coletor ${collectorId} - aguardando instruções adicionais`);
      } catch (summaryError) {
        logger.error('Erro ao marcar resumo automático pendente:', summaryError);
      }
    }


    if (config.scheduleType === 'daily' && shouldRestartCollector(collector)) {
      try {
        await restartCollectorWithNewName(collector);
      } catch (restartError) {
        logger.error('Erro ao reiniciar coletor:', restartError);
      }
    }

  } catch (error) {
    logger.error(`Erro ao parar coletor ${collectorId}:`, error);
  }
}

/**
 * Checks if a user has permission to access a WhatsApp session.
 * @param {string} sessionId - The ID of the WhatsApp session.
 * @param {string} userId - The ID of the user.
 * @returns {object} An object with the result of the permission check.
 */
function checkUserSessionPermission(sessionId, userId) {
  if (!global.whatsappSessions) {
    return {
      success: false,
      error: 'Sistema de sessões não inicializado',
      status: 500,
    };
  }

  const session = global.whatsappSessions.get(sessionId);
  if (!session || !session.userId) {
    return { success: false, error: 'Sessão não encontrada', status: 404 };
  }


  const sessionUserId = session.userId.toString();
  const requestUserId = userId.toString();

  if (sessionUserId !== requestUserId) {
    return {
      success: false,
      error: 'Você não tem permissão para essa sessão',
      status: 403,
    };
  }

  return { success: true, session };
}

/**
 * @swagger
 * /message-collector/start:
 *   post:
 *     summary: Start a new message collector
 *     description: Configures and starts a new message collector for a specific WhatsApp group.
 *     tags: [Message Collector]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *               groupId:
 *                 type: string
 *               startHour:
 *                 type: integer
 *               endHour:
 *                 type: integer
 *     responses:
 *       '200':
 *         description: The message collector was started successfully.
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
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const {
      sessionId,
      groupId,
      startHour,
      startMinute = 0,
      endHour,
      endMinute = 0,
      timezone,
      name,
      scheduleType = 'daily',
      weekDays = [],
      specificDates = [],
      duration = 'unlimited',
      durationDays = 7,
      endDate = '',
      downloadMedia = true,

      autoSummary = false,
      summaryConfig = {}
    } = req.body;
    const userId = req.user._id;

    if (
      !sessionId ||
      !groupId ||
      startHour === undefined ||
      endHour === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Parâmetros obrigatórios: sessionId, groupId, startHour, endHour',
      });
    }


    if (scheduleType === 'weekly' && (!weekDays || weekDays.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Para agendamento semanal, selecione pelo menos um dia da semana',
      });
    }

    if (scheduleType === 'specific_days' && (!specificDates || specificDates.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Para agendamento específico, selecione pelo menos uma data',
      });
    }

    if (duration === 'until_date' && !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Para duração com data final, especifique a data de término',
      });
    }


    const sessionCheck = checkUserSessionPermission(sessionId, userId);
    if (!sessionCheck.success) {
      return res.status(sessionCheck.status).json({
        success: false,
        message: sessionCheck.error,
      });
    }

    const config = {
      name: name || `Coleta ${groupId}`,
      startHour,
      startMinute,
      endHour,
      endMinute,
      timezone: timezone || 'America/Sao_Paulo',
      scheduleType,
      weekDays: scheduleType === 'weekly' ? weekDays : [],
      specificDates: scheduleType === 'specific_days' ? specificDates : [],
      duration,
      durationDays: duration === 'days' ? durationDays : null,
      endDate: duration === 'until_date' ? new Date(endDate) : null,
      downloadMedia: downloadMedia !== false,

      autoSummary: autoSummary || false,
      summaryConfig: {
        tone: summaryConfig?.tone || 'professional',
        style: summaryConfig?.style || 'bullet_points',
        focus: summaryConfig?.focus || 'general',
        sendToGroup: summaryConfig?.sendToGroup || false,
        summaryTime: summaryConfig?.summaryTime || 'end',
        customSummaryHour: summaryConfig?.customSummaryHour || 18
      },
      createdAt: new Date(),
      userId: new ObjectId(userId),
    };


    const collectorId = await createCollectorInDB(
      sessionId,
      groupId,
      userId,
      config
    );
    if (!collectorId) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar coletor no banco de dados',
      });
    }


    setupCronJobs(collectorId, config);

    res.json({
      success: true,
      message: 'Coletor de mensagens configurado e iniciado',
      collectorId: collectorId,
    });
  } catch (error) {
    logger.error('Erro ao iniciar coletor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @swagger
 * /message-collector/stop:
 *   post:
 *     summary: Stop a message collector
 *     description: Stops a specific message collector.
 *     tags: [Message Collector]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               collectorId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The message collector was stopped successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the collector.
 *       '404':
 *         description: Collector not found.
 *       '500':
 *         description: Internal server error.
 */
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const {
      collectorId,
      generateSummary = false,
      sendToGroup = false,
      summaryTone = 'professional',
      customInstructions = '',
      topParticipants = 5,
      customApiKey = null
    } = req.body;
    const userId = req.user._id;


    let collector;
    try {
      const db = database.getDb();
      if (!db) {
        return res.status(500).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }
      collector = await db
        .collection('messageCollectors')
        .findOne({ _id: collectorId });
      if (!collector) {
        return res.status(404).json({
          success: false,
          message: 'Coletor não encontrado',
        });
      }

      if (collector.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para esse coletor',
        });
      }

      const cronJobs = activeCronJobs.get(collectorId);
      if (cronJobs) {
        if (Array.isArray(cronJobs)) {
          cronJobs.forEach(job => job.stop());
        } else {

          if (cronJobs.startJob) cronJobs.startJob.stop();
          if (cronJobs.stopJob) cronJobs.stopJob.stop();
        }
        activeCronJobs.delete(collectorId);
        logger.info(`🛑 Cron jobs parados para coletor ${collectorId}`);
      }

      await updateCollectorStatus(collectorId, {
        status: 'completed',
        isActive: false,
        endTime: new Date(),
      });


      const shouldGenerateSummary = generateSummary ||
        (collector.config?.autoSummary && collector.config?.summaryConfig?.summaryTime === 'end');

      if (shouldGenerateSummary) {
        try {
          const summaryConfig = {
            tone: summaryTone || collector.config?.summaryConfig?.tone || 'professional',
            sendToGroup: sendToGroup || collector.config?.summaryConfig?.sendToGroup || false,
            customInstructions: customInstructions || collector.config?.summaryConfig?.customInstructions || '',
            topParticipants: Math.max(3, Math.min(20, parseInt(topParticipants) || collector.config?.summaryConfig?.topParticipants || 5)),
            customApiKey: customApiKey || null
          };


          const collectorWithSummaryConfig = {
            ...collector,
            config: {
              ...collector.config,
              summaryConfig: {
                ...collector.config?.summaryConfig,
                ...summaryConfig
              }
            }
          };

          await generateAndSendSummary(collectorId, collectorWithSummaryConfig);
          logger.info(`📝 Resumo gerado ao parar coletor ${collectorId}`);
        } catch (summaryError) {
          logger.error('Erro ao gerar resumo final:', summaryError);

        }
      }
    } catch (dbError) {
      logger.error('Erro ao parar coletor:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
    res.json({
      success: true,
      message: 'Coletor parado e mensagens salvas',
      summary: {
        totalMessages: collector.totalMessages,
        duration:
          collector.endTime && collector.startTime
            ? collector.endTime - collector.startTime
            : null,
        startTime: collector.startTime,
        endTime: collector.endTime,
      },
    });
  } catch (error) {
    logger.error('Erro ao parar coletor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @swagger
 * /message-collector/list:
 *   get:
 *     summary: List all message collectors
 *     description: Retrieves a list of all message collectors for the authenticated user.
 *     tags: [Message Collector]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A list of message collectors.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '500':
 *         description: Internal server error.
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    let collectors = [];

    try {
      const db = database.getDb();
      if (db) {
        collectors = await db
          .collection('messageCollectors')
          .find({ userId: new ObjectId(userId) })
          .sort({ createdAt: -1 })
          .toArray();
      }
    } catch (dbError) {
      logger.warn('Erro ao buscar coletores no banco:', dbError.message);
    }


    const activeCollectorsList = await getActiveCollectors(userId);
    const activeFormatted = activeCollectorsList.map((collector) => ({
      id: collector._id,
      sessionId: collector.sessionId,
      groupId: collector.groupId,
      isActive: collector.isActive,
      currentMessages: collector.totalMessages || 0,
      startTime: collector.startTime,
    }));


    const collectorsWithPendingInfo = collectors.map(collector => ({
      ...collector,
      hasPendingAutoSummary: !!collector.pendingAutoSummary,
      autoSummaryPendingSince: collector.autoSummaryPendingSince || null,
      isProcessingAutoSummary: !!collector.processingAutoSummary
    }));

    res.json({
      success: true,
      collectors: collectorsWithPendingInfo,
      active: activeFormatted,
    });
  } catch (error) {
    logger.error('Erro ao listar coletores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

/**
 * @swagger
 * /message-collector/generate-pending-summary:
 *   post:
 *     summary: Generate a pending summary
 *     description: Generates a summary for a collector that has a pending auto-summary.
 *     tags: [Message Collector]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               collectorId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The summary was generated successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the collector.
 *       '404':
 *         description: Collector not found or no pending summary.
 *       '500':
 *         description: Internal server error.
 */
router.post('/generate-pending-summary', authenticateToken, async (req, res) => {
  try {
    const {
      collectorId,
      customInstructions = '',
      topParticipants = 5,
      customApiKey = null
    } = req.body;
    const userId = req.user._id;

    if (!collectorId) {
      return res.status(400).json({
        success: false,
        message: 'collectorId é obrigatório'
      });
    }


    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }

    const collector = await db.collection('messageCollectors').findOne({
      _id: collectorId,
      userId: new ObjectId(userId),
      pendingAutoSummary: true
    });

    if (!collector) {
      return res.status(404).json({
        success: false,
        message: 'Coletor não encontrado ou sem resumo automático pendente'
      });
    }


    const pendingSince = new Date(collector.autoSummaryPendingSince);
    const hoursElapsed = (new Date() - pendingSince) / (1000 * 60 * 60);

    if (hoursElapsed > 24) {
      await updateCollectorStatus(collectorId, {
        pendingAutoSummary: false,
        autoSummaryPendingSince: null
      });
      return res.status(400).json({
        success: false,
        message: 'Resumo automático expirou (24h limite)'
      });
    }

    try {

      const enhancedSummaryConfig = {
        ...collector.config.summaryConfig,
        customInstructions: customInstructions || collector.config?.summaryConfig?.customInstructions || '',
        topParticipants: Math.max(3, Math.min(20, parseInt(topParticipants) || collector.config?.summaryConfig?.topParticipants || 5)),
        customApiKey: customApiKey || null
      };


      const collectorWithEnhancedConfig = {
        ...collector,
        config: {
          ...collector.config,
          summaryConfig: enhancedSummaryConfig
        }
      };


      await updateCollectorStatus(collectorId, {
        pendingAutoSummary: false,
        processingAutoSummary: true,
        processingStartedAt: new Date()
      });


      await generateAndSendSummary(collectorId, collectorWithEnhancedConfig);


      await updateCollectorStatus(collectorId, {
        processingAutoSummary: false,
        autoSummaryCompletedAt: new Date()
      });

      logger.info(`📝 Resumo automático com instruções adicionais gerado para coletor ${collectorId}`);

      res.json({
        success: true,
        message: 'Resumo automático gerado com sucesso',
        config: enhancedSummaryConfig
      });

    } catch (summaryError) {
      logger.error('Erro ao gerar resumo com instruções adicionais:', summaryError);


      await updateCollectorStatus(collectorId, {
        pendingAutoSummary: true,
        processingAutoSummary: false
      });

      res.status(500).json({
        success: false,
        message: 'Erro ao gerar resumo automático',
        error: summaryError.message
      });
    }

  } catch (error) {
    logger.error('Erro ao processar resumo pendente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});



/**
 * @swagger
 * /message-collector/delete-all:
 *   delete:
 *     summary: Delete all message collectors
 *     description: Deletes all message collectors for the authenticated user.
 *     tags: [Message Collector]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: All message collectors were deleted successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '500':
 *         description: Internal server error.
 */
router.delete('/delete-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }


    const collectors = await db.collection('messageCollectors')
      .find({ userId: new ObjectId(userId) })
      .toArray();

    if (collectors.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhum coletor encontrado para excluir',
        deletedCount: 0
      });
    }


    let stoppedJobs = 0;
    for (const collector of collectors) {
      const cronJobs = activeCronJobs.get(collector._id);
      if (cronJobs) {
        if (Array.isArray(cronJobs)) {
          cronJobs.forEach(job => job.stop());
        } else {

          if (cronJobs.startJob) cronJobs.startJob.stop();
          if (cronJobs.stopJob) cronJobs.stopJob.stop();
        }
        activeCronJobs.delete(collector._id);
        stoppedJobs++;
      }
    }


    const collectorIds = collectors.map(c => c._id);


    const messagesResult = await db.collection('collectedMessages')
      .deleteMany({ collectorId: { $in: collectorIds } });


    const collectorsResult = await db.collection('messageCollectors')
      .deleteMany({ userId: new ObjectId(userId) });

    logger.info(`🗑️ Usuário ${userId} excluiu todos os coletores: ${collectorsResult.deletedCount} coletores, ${messagesResult.deletedCount} mensagens`);

    res.json({
      success: true,
      message: 'Todos os coletores foram excluídos com sucesso',
      deletedCount: collectorsResult.deletedCount,
      deletedMessages: messagesResult.deletedCount,
      stoppedJobs
    });

  } catch (error) {
    logger.error('Erro ao excluir todos os coletores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir coletores',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /message-collector/delete/{collectorId}:
 *   delete:
 *     summary: Delete a message collector
 *     description: Deletes a specific message collector.
 *     tags: [Message Collector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The message collector was deleted successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the collector.
 *       '404':
 *         description: Collector not found.
 *       '500':
 *         description: Internal server error.
 */
router.delete('/delete/:collectorId', authenticateToken, async (req, res) => {
  try {
    const { collectorId } = req.params;
    const userId = req.user._id;

    const db = database.getDb();
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Banco de dados não disponível'
      });
    }


    const collector = await db.collection('messageCollectors')
      .findOne({ _id: collectorId, userId: new ObjectId(userId) });

    if (!collector) {
      return res.status(404).json({
        success: false,
        message: 'Coletor não encontrado ou sem permissão'
      });
    }


    const cronJobs = activeCronJobs.get(collectorId);
    if (cronJobs) {
      if (Array.isArray(cronJobs)) {
        cronJobs.forEach(job => job.stop());
      } else {

        if (cronJobs.startJob) cronJobs.startJob.stop();
        if (cronJobs.stopJob) cronJobs.stopJob.stop();
      }
      activeCronJobs.delete(collectorId);
      logger.info(`🛑 Cron jobs parados para coletor ${collectorId}`);
    }


    const messagesResult = await db.collection('collectedMessages')
      .deleteMany({ collectorId });


    const collectorResult = await db.collection('messageCollectors')
      .deleteOne({ _id: collectorId });

    logger.info(`🗑️ Coletor ${collectorId} excluído: ${messagesResult.deletedCount} mensagens removidas`);

    res.json({
      success: true,
      message: 'Coletor excluído com sucesso',
      deletedMessages: messagesResult.deletedCount
    });

  } catch (error) {
    logger.error('Erro ao excluir coletor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir coletor',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /message-collector/messages/{collectorId}:
 *   get:
 *     summary: Get messages from a collector
 *     description: Retrieves all messages from a specific message collector.
 *     tags: [Message Collector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: A list of messages.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the collector.
 *       '404':
 *         description: Collector not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/messages/:collectorId', authenticateToken, async (req, res) => {
  try {
    const { collectorId } = req.params;
    const userId = req.user._id;

    let collector = null;
    try {
      const db = database.getDb();
      if (db) {
        collector = await db
          .collection('messageCollectors')
          .findOne({ _id: collectorId });
      }
    } catch (dbError) {
      logger.warn('Erro ao buscar coletor:', dbError.message);
    }
    if (collector) {

      if (collector.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para esse coletor',
        });
      }

      let messages = [];
      try {
        const db = database.getDb();
        if (db) {

          const cleanResult = await cleanDuplicateMessages(collectorId);
          if (cleanResult.success && cleanResult.removed > 0) {
            logger.info(`🧹 Limpeza automática: ${cleanResult.removed} mensagens duplicadas removidas`);
          }

          messages = await db
            .collection('collectedMessages')
            .find({ collectorId })
            .sort({ collectedAt: 1 })
            .toArray();
        }
      } catch (dbError) {
        logger.warn('Erro ao buscar mensagens:', dbError.message);
      }
      return res.json({
        success: true,
        data: {
          sessionId: collector.sessionId,
          groupId: collector.groupId,
          isActive: collector.isActive,
          totalMessages: collector.totalMessages || 0,
          startTime: collector.startTime,
          endTime: collector.endTime,
          messages: messages,
        },
        isActive: collector.isActive,
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Coletor não encontrado',
    });
  } catch (error) {
    logger.error('Erro ao obter mensagens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});


/**
 * Integrates the message collector with the main application.
 * @param {object} app - The Express application object.
 * @returns {void}
 */
function integrateWithMainApp(app) {
  logger.info('🔗 Integrando Message Collector com sistema principal...');


  global.messageCollectorHook = async (message, sessionId) => {
    try {
      if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {

        const groupId = message.key.remoteJid;

        const db = database.getDb();
        if (!db) return;
        const collector = await db.collection('messageCollectors').findOne({
          sessionId,
          groupId,
          status: 'active',
          isActive: true,
        });
        if (collector) {
          logger.info(`📝 Processando mensagem para coletor ${collector._id}, downloadMedia: ${collector.downloadMedia}`);

          const messageData = await extractMessageData(message, sessionId, collector);
          if (!messageData || !messageData.text) {
            logger.warn(`⚠️  Dados de mensagem inválidos para ${message.key.id}`);
            return;
          }


          await addMessageToDB(collector._id, messageData);
          logger.debug(
            `📨 Mensagem coletada para ${collector._id} - Total: ${
              collector.totalMessages + 1
            }`
          );
        }
      }
    } catch (error) {
      logger.error('Erro no hook do message collector:', error);
    }
  };


  restoreCronJobs();

  logger.info('✅ Message Collector integrado - Hook global registrado');
}

/**
 * Restores all cron jobs for active collectors.
 * @returns {Promise<void>}
 */
async function restoreCronJobs() {
  try {
    const activeCollectors = await getActiveCollectors();
    for (const collector of activeCollectors) {
      setupCronJobs(collector._id, collector.config);
      logger.info(`🔄 Cron jobs restaurados para ${collector._id}`);
    }
  } catch (error) {
    logger.error('Erro ao restaurar cron jobs:', error);
  }
}

/**
 * Generates and sends a summary for a collector.
 * @param {string} collectorId - The ID of the collector.
 * @param {object} collector - The collector object.
 * @returns {Promise<void>}
 */
async function generateAndSendSummary(collectorId, collector) {
  try {
    const db = database.getDb();
    if (!db) return;


    const messages = await db.collection('collectedMessages')
      .find({ collectorId })
      .sort({ collectedAt: 1 })
      .toArray();

    if (messages.length === 0) {
      logger.info('Nenhuma mensagem para resumir');
      return;
    }


    const user = await db.collection('users').findOne({ _id: collector.userId });
    let customApiKey = collector.config?.summaryConfig?.customApiKey || user?.openaiApiKey || null;

    if (!customApiKey) {
      logger.warn(`⚠️ Usuário ${collector.userId} não tem chave OpenAI configurada - pulando geração de resumo`);
      return;
    }

    logger.info(`🔑 Usando chave OpenAI para resumo: ${customApiKey.substring(0, 10)}...`);


    let userToken = await db.collection('api_tokens').findOne({
      userId: collector.userId,
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (!userToken) {
      logger.error(`Token de API ativo não encontrado para usuário ${collector.userId}`);
      logger.info(`Gerando token automático para usuário ${collector.userId}...`);


      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const fullToken = `baileys_${token}`;

      const autoTokenRecord = {
        userId: collector.userId,
        name: 'Token Automático - Resumos',
        token: fullToken,
        expiresAt: null,
        createdAt: new Date(),
        lastUsedAt: null,
        isActive: true
      };

      await db.collection('api_tokens').insertOne(autoTokenRecord);
      logger.info(`✅ Token automático criado para usuário ${collector.userId}`);


      userToken = autoTokenRecord;
    } else {
      logger.info(`✅ Token encontrado para usuário ${collector.userId}: ${userToken.name}`);
    }


    const summaryData = {
      collectorId,
      tone: collector.config.summaryConfig.tone,
      style: collector.config.summaryConfig.style,
      focus: collector.config.summaryConfig.focus,
      maxTokens: 2000,
      includeStats: true,
      customApiKey
    };

    logger.info(`📝 Gerando resumo automático para coletor ${collectorId} com ${messages.length} mensagens`);
    logger.info(`📋 Configuração do resumo: ${JSON.stringify(collector.config.summaryConfig)}`);


    const BATCH_SIZE = 100;
    const DELAY_BETWEEN_CALLS = 60000;
    const MAX_ITERATIONS = 10;

    const batches = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      batches.push(messages.slice(i, i + BATCH_SIZE));
    }

    logger.info(`📊 Processando ${messages.length} mensagens em ${batches.length} lotes (máx: ${MAX_ITERATIONS})`);

    const batchesToProcess = batches.slice(0, MAX_ITERATIONS);
    const partialSummaries = [];


    const topParticipantsCount = collector.config?.summaryConfig?.topParticipants || 5;
    const participantsList = Array.from({length: topParticipantsCount}, (_, i) =>
      `${i + 1}. [Nome] - [X] mensagens`
    ).join('\n');


    const summaryTemplate = `
Siga este formato exato para o resumo:

Resumo do Grupo - [Nome do Grupo] 📆 - [Data]

👥 Top ${topParticipantsCount} Participantes Ativos:
${participantsList}

📌 Assunto Principal:
[Descrição geral dos temas mais discutidos]

💡 Assuntos Relevantes:
- [Categoria 1]:
  - [Detalhes específicos]
  - [Soluções ou discussões]
- [Categoria 2]:
  - [Detalhes específicos]
  - [Atualizações ou recursos]

🔗 Links Compartilhados:
- [Descrição]: [URL]

[Temas específicos com horários se aplicável]
Tema: [Nome do Tema] ⏰ [Horário início] – [Horário fim]
- Participantes: [Lista de nomes]
- Resumo: [Descrição do que foi discutido]

Destaques do Dia 🔍
- Técnicos: [Pontos técnicos principais]
- Inovação: [Novidades ou soluções]
- Colaboração: [Aspectos de trabalho em equipe]

Encerramento 🌟
[Frase de fechamento sobre o dia]
`;

    try {
      const fetch = require('node-fetch');


      for (let i = 0; i < batchesToProcess.length; i++) {
        const batch = batchesToProcess[i];
        const batchSummaryData = {
          ...summaryData,
          batchNumber: i + 1,
          totalBatches: batchesToProcess.length,
          customPrompt: i === 0 ?
            `Analise estas mensagens e crie um resumo parcial seguindo este template:\n\n${summaryTemplate}\n\nDados obrigatórios:\n- Nome do Grupo: ${collector.config?.name || collector.groupId || 'Grupo WhatsApp'}\n- Data: ${collector.startTime ? new Date(collector.startTime).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}\n\nIMPORTANTE - Links e Arquivos:\n- NUNCA inclua links de download internos (que contêm /api/baileys/download/ ou /download/ + ID) na seção de Links Compartilhados\n- Substitua referências a arquivos baixados por "[Arquivo compartilhado]"\n- Na seção "🔗 Links Compartilhados" inclua APENAS links externos relevantes (sites, ferramentas, plataformas)\n- Ignore completamente links de download interno do sistema\n\n${collector.config?.summaryConfig?.customInstructions ? `Instruções adicionais: ${collector.config.summaryConfig.customInstructions}\n\n` : ''}Este é o lote ${i + 1} de ${batchesToProcess.length}. Se for o primeiro lote, inclua estrutura completa. Se for lote subsequente, foque nos conteúdos específicos deste lote.` :
            `Continue o resumo analisando este lote ${i + 1} de ${batchesToProcess.length}. Foque nos conteúdos específicos deste lote mantendo a estrutura do template.\n\nIMPORTANTE - Links e Arquivos:\n- NUNCA inclua links de download internos na seção de Links Compartilhados\n- Inclua APENAS links externos relevantes\n${collector.config?.summaryConfig?.customInstructions ? `\n\nInstruções adicionais: ${collector.config.summaryConfig.customInstructions}` : ''}`
        };


        const batchMessages = await db.collection('collectedMessages')
          .find({
            collectorId,
            _id: { $in: batch.map(msg => msg._id) }
          })
          .sort({ collectedAt: 1 })
          .toArray();

        if (batchMessages.length === 0) {
          logger.warn(`⚠️ Lote ${i + 1} vazio, pulando...`);
          continue;
        }


        batchSummaryData.messages = batchMessages;

        logger.info(`🔄 Processando lote ${i + 1}/${batchesToProcess.length} com ${batchMessages.length} mensagens...`);

        const response = await fetch(`${process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`}/api/management/ai-summary/summarize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken.token}`
          },
          body: JSON.stringify(batchSummaryData)
        });

        if (response.ok) {
          const result = await response.json();
          const partialSummary = result.summary;
          partialSummaries.push({
            batchNumber: i + 1,
            summary: partialSummary,
            messageCount: batchMessages.length
          });

          logger.info(`✅ Lote ${i + 1} processado: ${partialSummary.length} caracteres`);
        } else {
          const error = await response.text();
          logger.error(`❌ Erro no lote ${i + 1}: ${response.status} - ${error}`);

        }


        if (i < batchesToProcess.length - 1) {
          logger.info(`⏳ Aguardando ${DELAY_BETWEEN_CALLS/1000}s para próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));
        }
      }


      if (partialSummaries.length > 0) {
        logger.info(`🔄 Consolidando ${partialSummaries.length} resumos parciais...`);


        const groupName = collector.config?.name || collector.groupId || 'Grupo WhatsApp';
        const startDate = collector.startTime ? new Date(collector.startTime).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

        const consolidationPrompt = `
Você recebeu ${partialSummaries.length} resumos parciais de um grupo do WhatsApp com total de ${messages.length} mensagens.

IMPORTANTE: Crie um resumo final CONSOLIDADO seguindo exatamente este template, substituindo os placeholders:

${summaryTemplate}

DADOS OBRIGATÓRIOS PARA O TEMPLATE:
- Nome do Grupo: ${groupName}
- Data da coleta: ${startDate}
- Total de mensagens: ${messages.length}

${collector.config?.summaryConfig?.customInstructions ? `INSTRUÇÕES ADICIONAIS: ${collector.config.summaryConfig.customInstructions}\n\n` : ''}Resumos parciais para consolidar:
${partialSummaries.map(ps => `--- Lote ${ps.batchNumber} (${ps.messageCount} mensagens) ---\n${ps.summary}`).join('\n\n')}

IMPORTANTE - Links e Arquivos:
- NUNCA inclua links de download internos (que contêm /api/baileys/download/ ou /download/ + ID) na seção de Links Compartilhados
- Substitua referências a arquivos baixados por "[Arquivo compartilhado]"
- Na seção "🔗 Links Compartilhados" inclua APENAS links externos relevantes (sites, ferramentas, plataformas)
- Ignore completamente links de download interno do sistema

Instruções de consolidação:
1. SUBSTITUA [Nome do Grupo] por: ${groupName}
2. SUBSTITUA [Data] por: ${startDate}
3. Consolide os top participantes somando suas mensagens
4. Unifique os assuntos principais em categorias coerentes
5. Combine APENAS links externos relevantes (ignore links de download internos)
6. Organize temas por horário se possível
7. Crie um resumo coeso e bem estruturado
8. Use emojis conforme o template
`;

        const finalResponse = await fetch(`${process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`}/api/management/ai-summary/summarize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken.token}`
          },
          body: JSON.stringify({
            collectorId,
            customPrompt: consolidationPrompt,
            maxTokens: 4000,
            includeStats: true,
            customApiKey
          })
        });

        if (finalResponse.ok) {
          const finalResult = await finalResponse.json();
          const finalSummary = finalResult.summary;

          logger.info(`✅ Resumo final consolidado: ${finalSummary.length} caracteres`);


          if (collector.config.summaryConfig.sendToGroup && finalSummary) {
            logger.info(`📨 Enviando resumo consolidado para o grupo ${collector.groupId}`);


            try {
              const whatsappSession = global.whatsappSessions?.get(collector.sessionId);
              if (whatsappSession && whatsappSession.sock) {
                const summaryMessage = `${finalSummary}\n\n_🤖 Gerado automaticamente pelo FlowChat AI_`;
                await whatsappSession.sock.sendMessage(collector.groupId, { text: summaryMessage });
                logger.info(`✅ Resumo consolidado enviado para o grupo ${collector.groupId}`);
              } else {
                logger.warn(`⚠️ Sessão WhatsApp não encontrada para ${collector.sessionId}`);
              }
            } catch (sendError) {
              logger.error('Erro ao enviar resumo para o grupo:', sendError);
            }
          }
        } else {
          const error = await finalResponse.text();
          logger.error(`❌ Erro na consolidação final: ${finalResponse.status} - ${error}`);
        }
      } else {
        logger.warn('⚠️ Nenhum resumo parcial foi gerado com sucesso');
      }

    } catch (apiError) {
      logger.error('Erro ao processar resumos em lotes:', apiError);
    }

  } catch (error) {
    logger.error('Erro ao gerar resumo automático:', error);
    throw error;
  }
}

/**
 * Checks if a collector should be restarted.
 * @param {object} collector - The collector object.
 * @returns {boolean} True if the collector should be restarted, false otherwise.
 */
function shouldRestartCollector(collector) {
  try {
    const config = collector.config;


    if (config.scheduleType !== 'daily') {
      return false;
    }


    if (config.duration === 'days') {
      const daysSinceStart = Math.floor((new Date() - new Date(collector.createdAt)) / (1000 * 60 * 60 * 24));
      if (daysSinceStart >= config.durationDays) {
        return false;
      }
    } else if (config.duration === 'until_date') {
      if (new Date() >= new Date(config.endDate)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Erro ao verificar se deve reiniciar coletor:', error);
    return false;
  }
}

/**
 * Restarts a collector with a new name.
 * @param {object} collector - The collector object.
 * @returns {Promise<void>}
 */
async function restartCollectorWithNewName(collector) {
  try {
    const db = database.getDb();
    if (!db) return;


    const daysSinceStart = Math.floor((new Date() - new Date(collector.createdAt)) / (1000 * 60 * 60 * 24)) + 1;


    const originalName = collector.config.name;
    let newName;

    if (daysSinceStart === 1) {
      newName = `${originalName} - Dia 2`;
    } else if (daysSinceStart < 7) {
      newName = `${originalName} - Dia ${daysSinceStart + 1}`;
    } else if (daysSinceStart < 14) {
      const weekNumber = Math.ceil((daysSinceStart + 1) / 7);
      newName = `${originalName} - Semana ${weekNumber}`;
    } else if (daysSinceStart < 30) {
      const weekNumber = Math.ceil((daysSinceStart + 1) / 7);
      newName = `${originalName} - Semana ${weekNumber} 🔥`;
    } else {
      const monthNumber = Math.ceil((daysSinceStart + 1) / 30);
      newName = `${originalName} - Mês ${monthNumber} 🚀`;
    }


    const newConfig = {
      ...collector.config,
      name: newName
    };

    const newCollectorId = await createCollectorInDB(
      collector.sessionId,
      collector.groupId,
      collector.userId,
      newConfig
    );

    if (newCollectorId) {

      setupCronJobs(newCollectorId, newConfig);

      logger.info(`🔄 Coletor reiniciado: ${collector._id} → ${newCollectorId} (${newName})`);


      if (daysSinceStart < 7) {
        logger.info(`📅 Início do ${daysSinceStart + 1}º dia de coleta para ${newName}`);
      } else if (daysSinceStart < 30) {
        logger.info(`🗓️ Continuando a maratona de coleta com ${newName}`);
      } else {
        logger.info(`🏆 Coleta veterana! ${newName} continua a jornada`);
      }
    } else {
      logger.error('Falha ao criar novo coletor para restart');
    }

  } catch (error) {
    logger.error('Erro ao reiniciar coletor com novo nome:', error);
  }
}


module.exports = router;


router.integrateWithMainApp = integrateWithMainApp;
router.getActiveCollectors = getActiveCollectors;
router.activeCronJobs = activeCronJobs;
