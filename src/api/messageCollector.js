const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const logger = require('pino')();
const { authenticateToken } = require('../middleware/auth');
const cron = require('node-cron');

// Map apenas para jobs de cron (não podem ser persistidos no DB)
const activeCronJobs = new Map(); // collectorKey -> cron job

// Funções auxiliares para persistência no MongoDB
async function createCollectorInDB(collectorKey, sessionId, groupId, userId, config) {
  try {
    const db = database.getDb();
    if (!db) throw new Error('Database não disponível');

    const now = new Date();
    const currentHour = now.getHours();
    const isActive = currentHour >= config.startHour && currentHour < config.endHour;

    await db.collection('messageCollectors').insertOne({
      _id: collectorKey,
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
      lastActivity: now
    });

    return true;
  } catch (error) {
    logger.error('Erro ao criar coletor no DB:', error);
    return false;
  }
}

async function updateCollectorStatus(collectorKey, updates) {
  try {
    const db = database.getDb();
    if (!db) return false;

    await db.collection('messageCollectors').updateOne(
      { _id: collectorKey },
      { 
        $set: { 
          ...updates,
          lastActivity: new Date()
        }
      }
    );
    return true;
  } catch (error) {
    logger.error('Erro ao atualizar coletor:', error);
    return false;
  }
}

async function addMessageToDB(collectorKey, messageData) {
  try {
    const db = database.getDb();
    if (!db) return false;

    // Adicionar mensagem à collection de mensagens coletadas
    await db.collection('collectedMessages').insertOne({
      collectorKey,
      ...messageData,
      collectedAt: new Date()
    });

    // Incrementar contador no coletor
    await db.collection('messageCollectors').updateOne(
      { _id: collectorKey },
      { 
        $inc: { totalMessages: 1 },
        $set: { lastActivity: new Date() }
      }
    );

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

    return await db.collection('messageCollectors')
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

// Função para configurar cron jobs
function setupCronJobs(collectorKey, config) {
  const startCron = `0 ${config.startHour} * * *`;
  const stopCron = `0 ${config.endHour} * * *`;
  
  // Job para iniciar coleta diariamente
  const startJob = cron.schedule(startCron, async () => {
    await updateCollectorStatus(collectorKey, { 
      isActive: true, 
      startTime: new Date(),
      totalMessages: 0 
    });
    logger.info(`🕒 Cron: Iniciando coleta para ${collectorKey} às ${config.startHour}h`);
  }, {
    scheduled: true,
    timezone: config.timezone || 'America/Sao_Paulo'
  });

  // Job para parar coleta diariamente
  const stopJob = cron.schedule(stopCron, async () => {
    await updateCollectorStatus(collectorKey, { 
      isActive: false, 
      endTime: new Date() 
    });
    logger.info(`🕒 Cron: Parando coleta para ${collectorKey} às ${config.endHour}h`);
  }, {
    scheduled: true,
    timezone: config.timezone || 'America/Sao_Paulo'
  });

  // Armazenar jobs para cleanup posterior
  activeCronJobs.set(collectorKey, { startJob, stopJob });
}

// Função auxiliar para verificar se o usuário possui a sessão (mesma lógica do app principal)
function checkUserSessionPermission(sessionId, userId) {
  if (!global.whatsappSessions) {
    return { success: false, error: 'Sistema de sessões não inicializado', status: 500 };
  }

  const session = global.whatsappSessions.get(sessionId);
  if (!session || !session.userId) {
    return { success: false, error: 'Sessão não encontrada', status: 404 };
  }

  // Verificar se o usuário é dono da sessão
  const sessionUserId = session.userId.toString();
  const requestUserId = userId.toString();
  
  if (sessionUserId !== requestUserId) {
    return { success: false, error: 'Você não tem permissão para essa sessão', status: 403 };
  }

  return { success: true, session };
}

// POST /api/message-collector/start
// Iniciar coleta de mensagens para um grupo
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { sessionId, groupId, startHour, endHour, timezone, name } = req.body;
    const userId = req.user._id;

    if (!sessionId || !groupId || startHour === undefined || endHour === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros obrigatórios: sessionId, groupId, startHour, endHour'
      });
    }

    // Verificar se o usuário possui a sessão
    const sessionCheck = checkUserSessionPermission(sessionId, userId);
    if (!sessionCheck.success) {
      return res.status(sessionCheck.status).json({
        success: false,
        message: sessionCheck.error
      });
    }

    const config = {
      name: name || `Coleta ${groupId}`,
      startHour,
      endHour,
      timezone: timezone || 'America/Sao_Paulo',
      createdAt: new Date(),
      userId: new ObjectId(userId)
    };

    // Criar coletor no banco de dados
    const collectorKey = `${sessionId}:${groupId}`;
    
    const success = await createCollectorInDB(collectorKey, sessionId, groupId, userId, config);
    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar coletor no banco de dados'
      });
    }

    // Configurar cron jobs
    setupCronJobs(collectorKey, config);

    res.json({
      success: true,
      message: 'Coletor de mensagens configurado e iniciado',
      collectorId: collectorKey
    });

  } catch (error) {
    logger.error('Erro ao iniciar coletor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/message-collector/stop
// Parar coleta de mensagens
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const { sessionId, groupId } = req.body;
    const userId = req.user._id;

    // Verificar se o usuário possui a sessão
    const sessionCheck = checkUserSessionPermission(sessionId, userId);
    if (!sessionCheck.success) {
      return res.status(sessionCheck.status).json({
        success: false,
        message: sessionCheck.error
      });
    }

    const collectorKey = `${sessionId}:${groupId}`;
    
    // Verificar se o coletor existe no banco
    try {
      const db = database.getDb();
      if (!db) {
        return res.status(500).json({
          success: false,
          message: 'Banco de dados não disponível'
        });
      }

      const collector = await db.collection('messageCollectors').findOne({ _id: collectorKey });
      if (!collector) {
        return res.status(404).json({
          success: false,
          message: 'Coletor não encontrado'
        });
      }

      // Parar cron jobs
      const cronJobs = activeCronJobs.get(collectorKey);
      if (cronJobs) {
        cronJobs.startJob.stop();
        cronJobs.stopJob.stop();
        activeCronJobs.delete(collectorKey);
      }

      // Atualizar status para completed
      await updateCollectorStatus(collectorKey, {
        status: 'completed',
        isActive: false,
        endTime: new Date()
      });

    } catch (dbError) {
      logger.error('Erro ao parar coletor:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }

    res.json({
      success: true,
      message: 'Coletor parado e mensagens salvas',
      summary: {
        totalMessages: collectedData.totalMessages,
        duration: collectedData.endTime - collectedData.startTime,
        startTime: collectedData.startTime,
        endTime: collectedData.endTime
      }
    });

  } catch (error) {
    logger.error('Erro ao parar coletor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
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
        collectors = await db.collection('messageCollectors')
          .find({ userId: new ObjectId(userId) })
          .sort({ createdAt: -1 })
          .toArray();
      }
    } catch (dbError) {
      logger.warn('Erro ao buscar coletores no banco:', dbError.message);
    }

    // Buscar coletores ativos diretamente do banco
    const activeCollectorsList = await getActiveCollectors();
    const activeFormatted = activeCollectorsList.map(collector => ({
      id: collector._id,
      sessionId: collector.sessionId,
      groupId: collector.groupId,
      isActive: collector.isActive,
      currentMessages: collector.totalMessages || 0,
      startTime: collector.startTime
    }));

    res.json({
      success: true,
      collectors,
      active: activeFormatted
    });

  } catch (error) {
    logger.error('Erro ao listar coletores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/message-collector/messages/:collectorId
// Obter mensagens coletadas
router.get('/messages/:collectorId', authenticateToken, async (req, res) => {
  try {
    const { collectorId } = req.params;
    const userId = req.user._id;

    // Buscar coletor no banco
    let collector = null;
    try {
      const db = database.getDb();
      if (db) {
        collector = await db.collection('messageCollectors').findOne({ _id: collectorId });
      }
    } catch (dbError) {
      logger.warn('Erro ao buscar coletor:', dbError.message);
    }

    if (collector) {
      // Buscar mensagens coletadas
      let messages = [];
      try {
        const db = database.getDb();
        if (db) {
          messages = await db.collection('collectedMessages')
            .find({ collectorKey: collectorId })
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
          messages: messages
        },
        isActive: collector.isActive
      });
    }

    // Buscar nas mensagens salvas
    let collectedData = null;
    try {
      const db = database.getDb();
      if (db) {
        collectedData = await db.collection('collectedMessages').findOne({
          $or: [
            { _id: collectorId },
            { sessionId: collectorId.split(':')[0], groupId: collectorId.split(':')[1] }
          ],
          userId: new ObjectId(userId)
        });
      }
    } catch (dbError) {
      logger.warn('Erro ao buscar mensagens no banco:', dbError.message);
    }

    if (!collectedData) {
      return res.status(404).json({
        success: false,
        message: 'Mensagens coletadas não encontradas'
      });
    }

    res.json({
      success: true,
      data: collectedData,
      isActive: false
    });

  } catch (error) {
    logger.error('Erro ao obter mensagens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
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
        const collectorKey = `${sessionId}:${groupId}`;
        
        // Verificar se existe coletor ativo para este grupo
        const db = database.getDb();
        if (!db) return;

        const collector = await db.collection('messageCollectors').findOne({
          _id: collectorKey,
          status: 'active',
          isActive: true
        });

        if (collector) {
          // Extrair dados da mensagem
          const messageText = extractTextFromMessage(message);
          if (!messageText) return;

          const messageData = {
            id: message.key.id,
            timestamp: new Date(message.messageTimestamp * 1000),
            from: message.key.participant || message.key.remoteJid,
            text: messageText,
            pushName: message.pushName || 'Usuário',
            sessionId: sessionId,
            groupId: groupId
          };

          // Salvar mensagem no banco
          await addMessageToDB(collectorKey, messageData);
          logger.debug(`📨 Mensagem coletada para ${collectorKey} - Total: ${collector.totalMessages + 1}`);
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

// Exportar o router diretamente para compatibilidade com Express
module.exports = router;

// Exportar outras funcionalidades como propriedades do router
router.integrateWithMainApp = integrateWithMainApp;
router.getActiveCollectors = getActiveCollectors;
router.activeCronJobs = activeCronJobs;