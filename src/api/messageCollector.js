const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const logger = require('pino')();
const { authenticateToken } = require('../middleware/auth');
const cron = require('node-cron');

// Map para armazenar coletores ativos e seus jobs de cron
const activeCollectors = new Map(); // collectorKey -> collector config
const activeCronJobs = new Map(); // collectorKey -> cron job

/**
 * Coletor de mensagens para grupos com agendamento real
 * Coleta mensagens durante horário especificado usando node-cron
 */
class MessageCollector {
  constructor(sessionId, groupId, config) {
    this.sessionId = sessionId;
    this.groupId = groupId;
    this.config = config;
    this.isActive = false;
    this.messages = [];
    this.startTime = null;
    this.endTime = null;
    this.startCronJob = null;
    this.stopCronJob = null;
  }

  // Criar expressões cron para início e fim
  createCronExpression(hour) {
    return `0 ${hour} * * *`; // A cada dia no horário especificado
  }

  start() {
    this.isActive = true;
    this.startTime = new Date();
    this.messages = [];
    
    // Configurar cron jobs para início e fim da coleta
    const startCron = this.createCronExpression(this.config.startHour);
    const stopCron = this.createCronExpression(this.config.endHour);
    
    // Job para iniciar coleta diariamente
    this.startCronJob = cron.schedule(startCron, () => {
      if (!this.isActive) {
        this.isActive = true;
        this.messages = [];
        logger.info(`🕒 Cron: Iniciando coleta para grupo ${this.groupId} às ${this.config.startHour}h`);
      }
    }, {
      scheduled: true,
      timezone: this.config.timezone || 'America/Sao_Paulo'
    });

    // Job para parar coleta diariamente
    this.stopCronJob = cron.schedule(stopCron, () => {
      if (this.isActive) {
        this.stop();
        logger.info(`🕒 Cron: Parando coleta para grupo ${this.groupId} às ${this.config.endHour}h`);
      }
    }, {
      scheduled: true,
      timezone: this.config.timezone || 'America/Sao_Paulo'
    });

    // Verificar se deve estar ativo agora
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour >= this.config.startHour && currentHour < this.config.endHour) {
      this.isActive = true;
    } else {
      this.isActive = false;
    }
    
    logger.info(`Coletor configurado para grupo ${this.groupId} na sessão ${this.sessionId} (${this.config.startHour}h-${this.config.endHour}h) - Ativo: ${this.isActive}`);
  }

  stop() {
    this.isActive = false;
    this.endTime = new Date();
    
    // Parar cron jobs
    if (this.startCronJob) {
      this.startCronJob.stop();
      this.startCronJob = null;
    }
    if (this.stopCronJob) {
      this.stopCronJob.stop();
      this.stopCronJob = null;
    }
    
    logger.info(`Coletor parado para grupo ${this.groupId}. Total de mensagens: ${this.messages.length}`);
  }

  destroy() {
    // Limpar recursos completamente
    this.stop();
    this.messages = [];
  }

  addMessage(message) {
    if (!this.isActive) return;

    // Extrair apenas texto das mensagens
    const messageText = this.extractTextFromMessage(message);
    if (!messageText) return;

    const collectedMessage = {
      id: message.key.id,
      timestamp: new Date(message.messageTimestamp * 1000),
      from: message.key.participant || message.key.remoteJid,
      text: messageText,
      pushName: message.pushName || 'Usuário',
    };

    this.messages.push(collectedMessage);
  }

  extractTextFromMessage(message) {
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
      return this.extractTextFromMessage({ message: message.message.quotedMessage });
    }

    // Para outros tipos, retornar indicador do tipo
    if (message.message.imageMessage) return '[Imagem]';
    if (message.message.videoMessage) return '[Vídeo]';
    if (message.message.audioMessage) return '[Áudio]';
    if (message.message.documentMessage) return '[Documento]';
    if (message.message.stickerMessage) return '[Figurinha]';

    return null;
  }

  getCollectedMessages() {
    return {
      sessionId: this.sessionId,
      groupId: this.groupId,
      startTime: this.startTime,
      endTime: this.endTime,
      totalMessages: this.messages.length,
      messages: this.messages,
      config: this.config
    };
  }
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

    // Criar coletor
    const collector = new MessageCollector(sessionId, groupId, config);
    const collectorKey = `${sessionId}:${groupId}`;
    activeCollectors.set(collectorKey, collector);

    // Salvar configuração no banco
    try {
      const db = database.getDb();
      if (db) {
        await db.collection('messageCollectors').insertOne({
          _id: collectorKey,
          sessionId,
          groupId,
          userId: new ObjectId(userId),
          config,
          status: 'configured',
          createdAt: new Date()
        });
      }
    } catch (dbError) {
      logger.warn('Erro ao salvar no banco, continuando sem persistência:', dbError.message);
    }

    // Iniciar o coletor com cron jobs reais
    collector.start();

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
    const collector = activeCollectors.get(collectorKey);

    if (!collector) {
      return res.status(404).json({
        success: false,
        message: 'Coletor não encontrado'
      });
    }

    collector.stop();

    // Salvar mensagens coletadas no banco
    try {
      const db = database.getDb();
      if (db) {
        const collectedData = collector.getCollectedMessages();
        
        await db.collection('collectedMessages').insertOne({
          ...collectedData,
          userId: new ObjectId(userId),
          createdAt: new Date()
        });

        // Atualizar status
        await db.collection('messageCollectors').updateOne(
          { _id: collectorKey },
          { 
            $set: { 
              status: 'completed',
              completedAt: new Date(),
              totalMessages: collectedData.totalMessages
            }
          }
        );
      }
    } catch (dbError) {
      logger.warn('Erro ao salvar mensagens no banco:', dbError.message);
    }

    // Limpar coletor da memória
    collector.destroy();
    activeCollectors.delete(collectorKey);

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

    const activeCollectorsList = Array.from(activeCollectors.entries()).map(([key, collector]) => ({
      id: key,
      sessionId: collector.sessionId,
      groupId: collector.groupId,
      isActive: collector.isActive,
      currentMessages: collector.messages.length,
      startTime: collector.startTime
    }));

    res.json({
      success: true,
      collectors,
      active: activeCollectorsList
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

    // Verificar se é um coletor ativo
    const activeCollector = activeCollectors.get(collectorId);
    if (activeCollector) {
      const data = activeCollector.getCollectedMessages();
      return res.json({
        success: true,
        data,
        isActive: true
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
  
  // Hook global para capturar mensagens de todas as sessões
  global.messageCollectorHook = (message, sessionId) => {
    try {
      if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
        // É uma mensagem de grupo
        const groupId = message.key.remoteJid;
        const collectorKey = `${sessionId}:${groupId}`;
        
        const collector = activeCollectors.get(collectorKey);
        if (collector && collector.isActive) {
          collector.addMessage(message);
          logger.debug(`📨 Mensagem coletada para ${collectorKey}: ${collector.messages.length} total`);
        }
      }
    } catch (error) {
      logger.error('Erro no hook do message collector:', error);
    }
  };

  logger.info('✅ Message Collector integrado - Hook global registrado');
}

// Exportar o router diretamente para compatibilidade com Express
module.exports = router;

// Exportar outras funcionalidades como propriedades do router
router.integrateWithMainApp = integrateWithMainApp;
router.MessageCollector = MessageCollector;
router.activeCollectors = activeCollectors;