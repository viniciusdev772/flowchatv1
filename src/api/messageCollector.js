const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const logger = require('pino')();

// Simulação de cron até conseguirmos instalar a dependência
const activeCollectors = new Map(); // sessionId -> collector config

/**
 * Coletor de mensagens para grupos
 * Coleta mensagens durante horário especificado
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
  }

  start() {
    this.isActive = true;
    this.startTime = new Date();
    this.messages = [];
    logger.info(`Coletor iniciado para grupo ${this.groupId} na sessão ${this.sessionId}`);
  }

  stop() {
    this.isActive = false;
    this.endTime = new Date();
    logger.info(`Coletor parado para grupo ${this.groupId}. Total de mensagens: ${this.messages.length}`);
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

// Middleware para verificar autenticação
const requireAuth = async (req, res, next) => {
  try {
    // Usar a mesma verificação de sessão do sistema principal
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro na verificação de autenticação'
    });
  }
};

// POST /api/message-collector/start
// Iniciar coleta de mensagens para um grupo
router.post('/start', requireAuth, async (req, res) => {
  try {
    const { sessionId, groupId, startHour, endHour, timezone, name } = req.body;
    const userId = req.session.userId;

    if (!sessionId || !groupId || startHour === undefined || endHour === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros obrigatórios: sessionId, groupId, startHour, endHour'
      });
    }

    // Verificar se o usuário possui a sessão
    const { db } = database.getDatabase();
    const userSession = await db.collection('userSessions').findOne({
      userId: new ObjectId(userId),
      sessionId: sessionId
    });

    if (!userSession) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para essa sessão'
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
    await db.collection('messageCollectors').insertOne({
      _id: collectorKey,
      sessionId,
      groupId,
      userId: new ObjectId(userId),
      config,
      status: 'configured',
      createdAt: new Date()
    });

    // Por enquanto, iniciar imediatamente (depois implementaremos o cron)
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
router.post('/stop', requireAuth, async (req, res) => {
  try {
    const { sessionId, groupId } = req.body;
    const userId = req.session.userId;

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
    const { db } = database.getDatabase();
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
router.get('/list', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { db } = database.getDatabase();

    const collectors = await db.collection('messageCollectors')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();

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
router.get('/messages/:collectorId', requireAuth, async (req, res) => {
  try {
    const { collectorId } = req.params;
    const userId = req.session.userId;
    const { db } = database.getDatabase();

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
    const collectedData = await db.collection('collectedMessages').findOne({
      $or: [
        { _id: collectorId },
        { sessionId: collectorId.split(':')[0], groupId: collectorId.split(':')[1] }
      ],
      userId: new ObjectId(userId)
    });

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
  // Esta função será chamada pelo app principal para registrar o handler de mensagens
  if (global.whatsappSessions) {
    // Adicionar handler para capturar mensagens
    Object.values(global.whatsappSessions).forEach(session => {
      if (session.sock && session.sock.ev) {
        session.sock.ev.on('messages.upsert', (messageUpdate) => {
          const { messages } = messageUpdate;
          
          messages.forEach(message => {
            if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
              // É uma mensagem de grupo
              const groupId = message.key.remoteJid;
              const sessionId = session.sessionId;
              const collectorKey = `${sessionId}:${groupId}`;
              
              const collector = activeCollectors.get(collectorKey);
              if (collector && collector.isActive) {
                collector.addMessage(message);
              }
            }
          });
        });
      }
    });
  }
}

module.exports = {
  router,
  integrateWithMainApp,
  MessageCollector,
  activeCollectors
};