const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const logger = require('pino')();
const { authenticateToken } = require('../middleware/auth');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

// Map apenas para jobs de cron (não podem ser persistidos no DB)
const activeCronJobs = new Map(); // collectorKey -> cron job

// Funções auxiliares para persistência no MongoDB
async function createCollectorInDB(sessionId, groupId, userId, config) {
  try {
    const db = database.getDb();
    if (!db) throw new Error('Database não disponível');

    const now = new Date();
    const currentHour = now.getHours();
    const isActive =
      currentHour >= config.startHour && currentHour < config.endHour;
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

// Função para limpar mensagens duplicadas de um coletor específico
async function cleanDuplicateMessages(collectorId) {
  try {
    const db = database.getDb();
    if (!db) return { success: false, error: 'Database não disponível' };

    // Buscar todas as mensagens do coletor
    const messages = await db.collection('collectedMessages')
      .find({ collectorId })
      .sort({ collectedAt: 1 })
      .toArray();

    if (messages.length === 0) {
      return { success: true, removed: 0, total: 0 };
    }

    // Encontrar duplicatas (manter a primeira ocorrência)
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
      // Deletar duplicatas
      await db.collection('collectedMessages').deleteMany({
        _id: { $in: duplicateIds }
      });

      // Atualizar contador no coletor
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

async function addMessageToDB(collectorId, messageData) {
  try {
    const db = database.getDb();
    if (!db) return false;

    // Verificar se a mensagem já existe usando o ID único do WhatsApp
    const existingMessage = await db.collection('collectedMessages').findOne({
      collectorId,
      id: messageData.id
    });

    if (existingMessage) {
      logger.debug(`⚠️  Mensagem duplicada ignorada: ${messageData.id}`);
      return false; // Não é erro, apenas mensagem duplicada
    }

    // Adicionar mensagem à collection de mensagens coletadas
    await db.collection('collectedMessages').insertOne({
      collectorId,
      ...messageData,
      collectedAt: new Date(),
    });

    // Incrementar contador no coletor
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

async function getActiveCollectors() {
  try {
    const db = database.getDb();
    if (!db) return [];

    return await db
      .collection('messageCollectors')
      .find({ status: 'active' })
      .toArray();
  } catch (error) {
    logger.error('Erro ao buscar coletores ativos:', error);
    return [];
  }
}

// Função para extrair texto das mensagens
function extractTextFromMessage(message) {
  if (!message.message) return null;

  // Extrair texto de diferentes tipos de mensagem
  if (message.message.conversation) {
    return message.message.conversation;
  }

  if (message.message.extendedTextMessage) {
    return message.message.extendedTextMessage.text;
  }

  if (message.message.quotedMessage) {
    // Tentar extrair texto de mensagem citada
    return extractTextFromMessage({ message: message.message.quotedMessage });
  }

  // Para outros tipos, retornar indicador do tipo
  if (message.message.imageMessage) return '[Imagem]';
  if (message.message.videoMessage) return '[Vídeo]';
  if (message.message.audioMessage) return '[Áudio]';
  if (message.message.documentMessage) return '[Documento]';
  if (message.message.stickerMessage) return '[Figurinha]';

  return null;
}

// Função para extrair dados completos da mensagem (incluindo mídia)
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
    hasMedia: false
  };

  // Extrair texto de diferentes tipos de mensagem
  if (message.message.conversation) {
    messageData.text = message.message.conversation;
  } else if (message.message.extendedTextMessage) {
    messageData.text = message.message.extendedTextMessage.text;
  } else if (message.message.quotedMessage) {
    // Tentar extrair texto de mensagem citada
    const quotedText = extractTextFromMessage({ message: message.message.quotedMessage });
    messageData.text = quotedText;
  } else if (message.message.imageMessage || message.message.videoMessage || 
             message.message.audioMessage || message.message.documentMessage || 
             message.message.stickerMessage) {
    // Mensagem com mídia - tentar fazer download
    messageData.hasMedia = true;
    
    // Determinar tipo de mídia
    if (message.message.imageMessage) {
      messageData.mediaType = 'image';
      messageData.text = '[Imagem]';
    } else if (message.message.videoMessage) {
      messageData.mediaType = 'video';
      messageData.text = '[Vídeo]';
    } else if (message.message.audioMessage) {
      messageData.mediaType = 'audio';
      messageData.text = '[Áudio]';
    } else if (message.message.documentMessage) {
      messageData.mediaType = 'document';
      messageData.text = '[Documento]';
    } else if (message.message.stickerMessage) {
      messageData.mediaType = 'sticker';
      messageData.text = '[Figurinha]';
    }

    // Verificar se deve fazer download da mídia (padrão: sempre tentar, só pular se explicitamente false)
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
            messageData.text = mediaResult.downloadUrl; // Usar URL como texto para display
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
        // Manter o texto placeholder se o download falhar
        messageData.text = `[${messageData.mediaType === 'image' ? 'Imagem' : messageData.mediaType === 'video' ? 'Vídeo' : messageData.mediaType === 'audio' ? 'Áudio' : messageData.mediaType === 'document' ? 'Documento' : messageData.mediaType === 'sticker' ? 'Figurinha' : 'Mídia'} - Erro]`;
      }
    }
    // Se downloadMedia for false, manter apenas o placeholder [Tipo]
  }

  return messageData;
}

// Função para configurar cron jobs baseado no tipo de agendamento
function setupCronJobs(collectorId, config) {
  const timezone = config.timezone || 'America/Sao_Paulo';
  const jobs = [];

  // Verificar se o coletor já expirou
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
      const startCron = `0 ${config.startHour} * * *`;
      const stopCron = `0 ${config.endHour} * * *`;
      
      jobs.push(cron.schedule(startCron, () => startCollection(collectorId, config), { scheduled: true, timezone }));
      jobs.push(cron.schedule(stopCron, () => stopCollection(collectorId, config), { scheduled: true, timezone }));
      break;

    case 'weekly':
      if (config.weekDays && config.weekDays.length > 0) {
        const daysStr = config.weekDays.join(',');
        const startWeeklyCron = `0 ${config.startHour} * * ${daysStr}`;
        const stopWeeklyCron = `0 ${config.endHour} * * ${daysStr}`;
        
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
            
            const startSpecificCron = `0 ${config.startHour} ${day} ${month} *`;
            const stopSpecificCron = `0 ${config.endHour} ${day} ${month} *`;
            
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

  // Armazenar jobs para cleanup posterior
  if (jobs.length > 0) {
    activeCronJobs.set(collectorId, jobs);
    logger.info(`📅 Configurados ${jobs.length} cron jobs para coletor ${collectorId} (${config.scheduleType})`);
  }
}

// Função auxiliar para iniciar coleta
async function startCollection(collectorId, config) {
  // Verificar se ainda está dentro do período de duração
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
  logger.info(`🕒 Cron: Iniciando coleta para ${collectorId} às ${config.startHour}h`);
}

// Função auxiliar para parar coleta
async function stopCollection(collectorId, config) {
  await updateCollectorStatus(collectorId, {
    isActive: false,
    endTime: new Date(),
  });
  logger.info(`🕒 Cron: Parando coleta para ${collectorId} às ${config.endHour}h`);
}

// Função auxiliar para verificar se o usuário possui a sessão (mesma lógica do app principal)
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

  // Verificar se o usuário é dono da sessão
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

// POST /api/message-collector/start
// Iniciar coleta de mensagens para um grupo
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { 
      sessionId, 
      groupId, 
      startHour, 
      endHour, 
      timezone, 
      name,
      scheduleType = 'daily',
      weekDays = [],
      specificDates = [],
      duration = 'unlimited',
      durationDays = 7,
      endDate = '',
      downloadMedia = true,
      // Novas opções para resumo automático
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

    // Validações específicas para cada tipo de agendamento
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

    // Verificar se o usuário possui a sessão
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
      endHour,
      timezone: timezone || 'America/Sao_Paulo',
      scheduleType,
      weekDays: scheduleType === 'weekly' ? weekDays : [],
      specificDates: scheduleType === 'specific_days' ? specificDates : [],
      duration,
      durationDays: duration === 'days' ? durationDays : null,
      endDate: duration === 'until_date' ? new Date(endDate) : null,
      downloadMedia: downloadMedia !== false, // padrão true, só false se explicitamente definido
      // Configurações de resumo automático
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

    // Criar coletor no banco de dados
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

    // Configurar cron jobs
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

// POST /api/message-collector/stop
// Parar coleta de mensagens
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const { 
      collectorId, 
      generateSummary = false, 
      sendToGroup = false, 
      summaryTone = 'professional' 
    } = req.body;
    const userId = req.user._id;

    // Buscar coletor pelo UUID
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
      // Verificar permissão do usuário
      if (collector.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para esse coletor',
        });
      }
      // Parar cron jobs
      const cronJobs = activeCronJobs.get(collectorId);
      if (cronJobs) {
        if (Array.isArray(cronJobs)) {
          cronJobs.forEach(job => job.stop());
        } else {
          // Compatibilidade com formato antigo
          if (cronJobs.startJob) cronJobs.startJob.stop();
          if (cronJobs.stopJob) cronJobs.stopJob.stop();
        }
        activeCronJobs.delete(collectorId);
        logger.info(`🛑 Cron jobs parados para coletor ${collectorId}`);
      }
      // Atualizar status para completed
      await updateCollectorStatus(collectorId, {
        status: 'completed',
        isActive: false,
        endTime: new Date(),
      });

      // Gerar resumo se solicitado pelo usuário OU se configurado automaticamente
      const shouldGenerateSummary = generateSummary || 
        (collector.config?.autoSummary && collector.config?.summaryConfig?.summaryTime === 'end');
        
      if (shouldGenerateSummary) {
        try {
          const summaryConfig = {
            tone: summaryTone,
            sendToGroup: sendToGroup || collector.config?.summaryConfig?.sendToGroup || false
          };
          
          // Temporariamente adicionar configuração do resumo manual
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
          // Não falhar a operação de parar o coletor por causa do resumo
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

// GET /api/message-collector/list
// Listar coletores do usuário
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

    // Buscar coletores ativos diretamente do banco
    const activeCollectorsList = await getActiveCollectors();
    const activeFormatted = activeCollectorsList.map((collector) => ({
      id: collector._id,
      sessionId: collector.sessionId,
      groupId: collector.groupId,
      isActive: collector.isActive,
      currentMessages: collector.totalMessages || 0,
      startTime: collector.startTime,
    }));

    res.json({
      success: true,
      collectors,
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

// GET /api/message-collector/messages/:collectorId
// Obter mensagens coletadas
router.get('/messages/:collectorId', authenticateToken, async (req, res) => {
  try {
    const { collectorId } = req.params;
    const userId = req.user._id;
    // Buscar coletor pelo UUID
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
      // Verificar permissão do usuário
      if (collector.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para esse coletor',
        });
      }
      // Buscar mensagens coletadas e limpar duplicatas automaticamente
      let messages = [];
      try {
        const db = database.getDb();
        if (db) {
          // Limpar duplicatas antes de buscar
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
    // Caso não encontre o coletor
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

// Função para integrar com o sistema principal
function integrateWithMainApp(app) {
  logger.info('🔗 Integrando Message Collector com sistema principal...');

  // Hook global para capturar mensagens de todas as sessões - agora usando MongoDB
  global.messageCollectorHook = async (message, sessionId) => {
    try {
      if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
        // É uma mensagem de grupo
        const groupId = message.key.remoteJid;
        // Buscar coletor ativo por sessionId e groupId
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
          // Extrair dados completos da mensagem (incluindo mídia)
          const messageData = await extractMessageData(message, sessionId, collector);
          if (!messageData || !messageData.text) {
            logger.warn(`⚠️  Dados de mensagem inválidos para ${message.key.id}`);
            return;
          }
          
          // Salvar mensagem no banco
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

  // Restaurar cron jobs de coletores ativos na inicialização
  restoreCronJobs();

  logger.info('✅ Message Collector integrado - Hook global registrado');
}

// Função para restaurar cron jobs na inicialização
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

// Função para gerar e enviar resumo automaticamente
async function generateAndSendSummary(collectorId, collector) {
  try {
    const db = database.getDb();
    if (!db) return;

    // Buscar mensagens coletadas
    const messages = await db.collection('collectedMessages')
      .find({ collectorId })
      .sort({ collectedAt: 1 })
      .toArray();

    if (messages.length === 0) {
      logger.info('Nenhuma mensagem para resumir');
      return;
    }

    // Buscar chave API do usuário e token de autenticação
    const user = await db.collection('users').findOne({ _id: collector.userId });
    const customApiKey = user?.openaiApiKey || null;
    
    // Buscar token de API válido do usuário para autenticação interna
    let userToken = await db.collection('api_tokens').findOne({ 
      userId: collector.userId,
      isActive: true,
      $or: [
        { expiresAt: null }, // Token sem expiração
        { expiresAt: { $gt: new Date() } } // Token não expirado
      ]
    });
    
    if (!userToken) {
      logger.error(`Token de API ativo não encontrado para usuário ${collector.userId}`);
      logger.info(`Gerando token automático para usuário ${collector.userId}...`);
      
      // Gerar token automático para resumos
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const fullToken = `baileys_${token}`;
      
      const autoTokenRecord = {
        userId: collector.userId,
        name: 'Token Automático - Resumos',
        token: fullToken,
        expiresAt: null, // Sem expiração
        createdAt: new Date(),
        lastUsedAt: null,
        isActive: true
      };
      
      await db.collection('api_tokens').insertOne(autoTokenRecord);
      logger.info(`✅ Token automático criado para usuário ${collector.userId}`);
      
      // Usar o token recém-criado
      userToken = autoTokenRecord;
    } else {
      logger.info(`✅ Token encontrado para usuário ${collector.userId}: ${userToken.name}`);
    }

    // Gerar resumo usando a API de AI Summary
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

    // Processar mensagens em lotes para respeitar limites de tokens da OpenAI
    const BATCH_SIZE = 100; // Mensagens por lote (ajustável conforme necessário)
    const DELAY_BETWEEN_CALLS = 60000; // 1 minuto entre chamadas para respeitar rate limit
    const MAX_ITERATIONS = 10;
    
    const batches = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      batches.push(messages.slice(i, i + BATCH_SIZE));
    }
    
    logger.info(`📊 Processando ${messages.length} mensagens em ${batches.length} lotes (máx: ${MAX_ITERATIONS})`);
    
    const batchesToProcess = batches.slice(0, MAX_ITERATIONS);
    const partialSummaries = [];
    
    // Template de resumo para a IA seguir
    const summaryTemplate = `
Siga este formato exato para o resumo:

Resumo do Grupo - [Nome do Grupo] 📆 - [Data]

👥 Top 5 Participantes Ativos:
1. [Nome] - [X] mensagens
2. [Nome] - [X] mensagens
3. [Nome] - [X] mensagens
4. [Nome] - [X] mensagens
5. [Nome] - [X] mensagens

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
      
      // Processar cada lote
      for (let i = 0; i < batchesToProcess.length; i++) {
        const batch = batchesToProcess[i];
        const batchSummaryData = {
          ...summaryData,
          batchNumber: i + 1,
          totalBatches: batchesToProcess.length,
          customPrompt: i === 0 ? 
            `Analise estas mensagens e crie um resumo parcial seguindo este template:\n\n${summaryTemplate}\n\nDados obrigatórios:\n- Nome do Grupo: ${collector.config?.name || collector.groupId || 'Grupo WhatsApp'}\n- Data: ${collector.startTime ? new Date(collector.startTime).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}\n\nEste é o lote ${i + 1} de ${batchesToProcess.length}. Se for o primeiro lote, inclua estrutura completa. Se for lote subsequente, foque nos conteúdos específicos deste lote.` :
            `Continue o resumo analisando este lote ${i + 1} de ${batchesToProcess.length}. Foque nos conteúdos específicos deste lote mantendo a estrutura do template.`
        };
        
        // Filtrar mensagens deste lote
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
        
        // Substituir mensagens no summaryData para este lote específico
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
          // Continuar processando outros lotes mesmo se um falhar
        }
        
        // Aguardar entre chamadas para respeitar rate limit (exceto no último lote)
        if (i < batchesToProcess.length - 1) {
          logger.info(`⏳ Aguardando ${DELAY_BETWEEN_CALLS/1000}s para próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));
        }
      }
      
      // Consolidar resumos parciais em um resumo final
      if (partialSummaries.length > 0) {
        logger.info(`🔄 Consolidando ${partialSummaries.length} resumos parciais...`);
        
        // Extrair informações do coletor para o template
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

Resumos parciais para consolidar:
${partialSummaries.map(ps => `--- Lote ${ps.batchNumber} (${ps.messageCount} mensagens) ---\n${ps.summary}`).join('\n\n')}

Instruções de consolidação:
1. SUBSTITUA [Nome do Grupo] por: ${groupName}
2. SUBSTITUA [Data] por: ${startDate}
3. Consolide os top participantes somando suas mensagens
4. Unifique os assuntos principais em categorias coerentes
5. Combine todos os links compartilhados
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
            maxTokens: 4000, // Mais tokens para o resumo final
            includeStats: true,
            customApiKey
          })
        });

        if (finalResponse.ok) {
          const finalResult = await finalResponse.json();
          const finalSummary = finalResult.summary;
          
          logger.info(`✅ Resumo final consolidado: ${finalSummary.length} caracteres`);
          
          // Se configurado para enviar para o grupo, fazer isso aqui
          if (collector.config.summaryConfig.sendToGroup && finalSummary) {
            logger.info(`📨 Enviando resumo consolidado para o grupo ${collector.groupId}`);
            
            // Enviar mensagem usando a API do Baileys
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

// Exportar o router diretamente para compatibilidade com Express
module.exports = router;

// Exportar outras funcionalidades como propriedades do router
router.integrateWithMainApp = integrateWithMainApp;
router.getActiveCollectors = getActiveCollectors;
router.activeCronJobs = activeCronJobs;
