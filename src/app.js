const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  delay,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec, swaggerUiOptions } = require('./config/swagger');
const QRCode = require('qrcode');
const crypto = require('crypto');
const database = require('./config/database');

// Polyfill para fetch em versões antigas do Node.js
let fetch;
if (typeof globalThis.fetch === 'undefined') {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    console.warn(
      'node-fetch não encontrado. Instale com: npm install node-fetch'
    );
    fetch = () => Promise.reject(new Error('fetch não disponível'));
  }
} else {
  fetch = globalThis.fetch;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Documentação Swagger
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions)
);

// Rota raiz redireciona para documentação
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Storage para uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// Logger personalizado
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
    },
  },
});

// Armazenar sessões ativas
const sessions = new Map();
const sessionQueues = new Map(); // Filas de mensagens para cada sessão
const messageRateLimit = new Map(); // Rate limiting por sessão
const reconnectionAttempts = new Map(); // Controle de tentativas de reconexão
const messageStore = new Map(); // Armazenamento de mensagens para reply por ID
const webhooks = new Map(); // Múltiplos webhooks por sessão (máximo 3)

// Estrutura de webhook:
// webhooks.set('sessionId', [
//   { id: 'webhook1', name: 'Principal', url: 'https://...', active: true, createdAt: '...', priority: 1 },
//   { id: 'webhook2', name: 'Backup', url: 'https://...', active: true, createdAt: '...', priority: 2 },
//   { id: 'webhook3', name: 'Analytics', url: 'https://...', active: false, createdAt: '...', priority: 3 }
// ])

// Disponibilizar sessions globalmente para o groups.js
global.whatsappSessions = sessions;

// Exportar função para acessar sessões (usado pelo groups.js)
function getSessions() {
  return sessions;
}

// Function to get session data enriched with MongoDB QR code data
async function getEnrichedSessionData(sessionId, sessionData) {
  try {
    // Base session data
    const enrichedData = {
      sessionId,
      isConnected: sessionData.isConnected,
      connectionState: sessionData.connectionState || 'unknown',
      createdAt: sessionData.createdAt,
      connectedAt: sessionData.connectedAt || null,
      lastError: sessionData.lastError || null,
      user: sessionData.sock?.user || null,
      hasQrCode: !!sessionData.qrCode,
      qrCode: sessionData.qrCode || null,
      qrCodeImage: sessionData.qrCodeImage || null
    };

    // If no QR code in memory but session is not connected, try to load from MongoDB
    if (!enrichedData.hasQrCode && !enrichedData.isConnected) {
      const qrData = await loadQRCodeData(sessionId);
      if (qrData) {
        enrichedData.hasQrCode = true;
        enrichedData.qrCode = qrData.qrCode;
        enrichedData.qrCodeImage = qrData.qrCodeImage;
        
        // Also update the in-memory session data
        sessionData.qrCode = qrData.qrCode;
        sessionData.qrCodeImage = qrData.qrCodeImage;
      }
    }

    return enrichedData;
  } catch (error) {
    logger.error(`Error enriching session data for ${sessionId}: ${error.message}`);
    // Return basic data on error
    return {
      sessionId,
      isConnected: sessionData.isConnected,
      connectionState: sessionData.connectionState || 'unknown',
      createdAt: sessionData.createdAt,
      connectedAt: sessionData.connectedAt || null,
      lastError: sessionData.lastError || null,
      user: sessionData.sock?.user || null,
      hasQrCode: !!sessionData.qrCode,
      qrCode: sessionData.qrCode || null,
      qrCodeImage: sessionData.qrCodeImage || null
    };
  }
}

// Function to get sessions for a specific user
function getUserSessions(userId) {
  const userSessions = new Map();
  for (const [sessionId, sessionData] of sessions.entries()) {
    if (sessionData.userId === userId) {
      userSessions.set(sessionId, sessionData);
    }
  }
  return userSessions;
}

// Function to check if user owns a session
function isUserSessionOwner(sessionId, userId) {
  const session = sessions.get(sessionId);
  if (!session || !session.userId) {
    return false;
  }
  
  // Convert both to strings for comparison (handles ObjectId vs string)
  const sessionUserId = session.userId.toString();
  const requestUserId = userId.toString();
  
  return sessionUserId === requestUserId;
}

// Middleware to check session ownership
function checkSessionOwnership(req, res, next) {
  const { sessionId } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
  }

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'sessionId é obrigatório'
    });
  }

  if (!isUserSessionOwner(sessionId, userId)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado: você não possui permissão para acessar esta sessão'
    });
  }

  next();
}

// Funções utilitárias para gerenciar webhooks
function getSessionWebhooks(sessionId) {
  return webhooks.get(sessionId) || [];
}

function addWebhookToSession(sessionId, webhookData) {
  const sessionWebhooks = getSessionWebhooks(sessionId);
  
  // Validar limite máximo de 3 webhooks
  if (sessionWebhooks.length >= 3) {
    throw new Error('Máximo de 3 webhooks permitidos por sessão');
  }
  
  // Validar se o nome já existe
  if (sessionWebhooks.some(w => w.name === webhookData.name)) {
    throw new Error('Nome do webhook já existe nesta sessão');
  }
  
  const newWebhook = {
    id: crypto.randomUUID(),
    name: webhookData.name || `Webhook ${sessionWebhooks.length + 1}`,
    url: webhookData.url,
    active: webhookData.active !== false, // true por padrão
    createdAt: new Date().toISOString(),
    priority: webhookData.priority || (sessionWebhooks.length + 1),
    events: webhookData.events || ['*'] // eventos para escutar, '*' = todos
  };
  
  sessionWebhooks.push(newWebhook);
  webhooks.set(sessionId, sessionWebhooks);
  
  // Save to MongoDB
  saveWebhookData(sessionId, sessionWebhooks);
  
  return newWebhook;
}

function removeWebhookFromSession(sessionId, webhookId) {
  const sessionWebhooks = getSessionWebhooks(sessionId);
  const webhookIndex = sessionWebhooks.findIndex(w => w.id === webhookId);
  
  if (webhookIndex === -1) {
    throw new Error('Webhook não encontrado');
  }
  
  const removedWebhook = sessionWebhooks.splice(webhookIndex, 1)[0];
  webhooks.set(sessionId, sessionWebhooks);
  
  // Save to MongoDB
  if (sessionWebhooks.length > 0) {
    saveWebhookData(sessionId, sessionWebhooks);
  } else {
    deleteWebhookData(sessionId);
  }
  
  return removedWebhook;
}

function updateWebhookInSession(sessionId, webhookId, updateData) {
  const sessionWebhooks = getSessionWebhooks(sessionId);
  const webhook = sessionWebhooks.find(w => w.id === webhookId);
  
  if (!webhook) {
    throw new Error('Webhook não encontrado');
  }
  
  // Validar se o novo nome já existe (se está sendo alterado)
  if (updateData.name && updateData.name !== webhook.name) {
    if (sessionWebhooks.some(w => w.name === updateData.name && w.id !== webhookId)) {
      throw new Error('Nome do webhook já existe nesta sessão');
    }
  }
  
  // Atualizar campos permitidos
  if (updateData.name !== undefined) webhook.name = updateData.name;
  if (updateData.url !== undefined) webhook.url = updateData.url;
  if (updateData.active !== undefined) webhook.active = updateData.active;
  if (updateData.priority !== undefined) webhook.priority = updateData.priority;
  if (updateData.events !== undefined) webhook.events = updateData.events;
  
  webhook.updatedAt = new Date().toISOString();
  
  webhooks.set(sessionId, sessionWebhooks);
  
  // Save to MongoDB
  saveWebhookData(sessionId, sessionWebhooks);
  
  return webhook;
}

function getActiveWebhooks(sessionId, eventType = null) {
  const sessionWebhooks = getSessionWebhooks(sessionId);
  return sessionWebhooks
    .filter(w => w.active)
    .filter(w => !eventType || w.events.includes('*') || w.events.includes(eventType))
    .sort((a, b) => a.priority - b.priority);
}

// Importar rotas de grupos
const groupsRouter = require('./api/groups');

// Configurações de comportamento humano
const HUMAN_BEHAVIOR = {
  MIN_TYPING_TIME: 1000, // Tempo mínimo digitando (1s)
  MAX_TYPING_TIME: 8000, // Tempo máximo digitando (8s)
  TYPING_SPEED: 50, // Caracteres por segundo (humano médio)
  MIN_DELAY_BETWEEN_MESSAGES: 2000, // Delay mínimo entre mensagens (2s)
  MAX_DELAY_BETWEEN_MESSAGES: 5000, // Delay máximo entre mensagens (5s)
  MAX_MESSAGES_PER_MINUTE: 10, // Máximo 10 mensagens por minuto
  SEEN_DELAY: 500, // Delay antes de marcar como visto (0.5s)
};

// Configurações de reconexão
const RECONNECTION_CONFIG = {
  MAX_ATTEMPTS: 5, // Máximo de tentativas de reconexão
  BASE_DELAY: 5000, // Delay base para reconexão (5s)
  MAX_DELAY: 60000, // Delay máximo para reconexão (60s)
  STREAM_ERROR_DELAY: 10000, // Delay específico para erros de stream (10s)
};

// Função para calcular tempo de digitação baseado no tamanho da mensagem
function calculateTypingTime(messageLength) {
  const baseTime = Math.max(
    HUMAN_BEHAVIOR.MIN_TYPING_TIME,
    Math.min(
      (messageLength / HUMAN_BEHAVIOR.TYPING_SPEED) * 1000,
      HUMAN_BEHAVIOR.MAX_TYPING_TIME
    )
  );

  // Adiciona variação aleatória de ±30%
  const variation = baseTime * 0.3;
  return baseTime + (Math.random() * variation * 2 - variation);
}

// Função para delay aleatório entre mensagens
function getRandomDelay() {
  return (
    Math.random() *
      (HUMAN_BEHAVIOR.MAX_DELAY_BETWEEN_MESSAGES -
        HUMAN_BEHAVIOR.MIN_DELAY_BETWEEN_MESSAGES) +
    HUMAN_BEHAVIOR.MIN_DELAY_BETWEEN_MESSAGES
  );
}

// Verificar rate limit
function checkRateLimit(sessionId) {
  const now = Date.now();
  const limit = messageRateLimit.get(sessionId) || [];

  // Remove mensagens antigas (mais de 1 minuto)
  const recentMessages = limit.filter((timestamp) => now - timestamp < 60000);

  if (recentMessages.length >= HUMAN_BEHAVIOR.MAX_MESSAGES_PER_MINUTE) {
    return false;
  }

  recentMessages.push(now);
  messageRateLimit.set(sessionId, recentMessages);
  return true;
}

// Função para simular comportamento humano ao enviar mensagem
async function sendMessageWithHumanBehavior(
  sock,
  jid,
  message,
  quotedMessage = null
) {
  try {
    // Verificar rate limit
    const sessionId = sock.user?.id;
    if (!checkRateLimit(sessionId)) {
      throw new Error(
        'Rate limit excedido. Muitas mensagens enviadas recentemente.'
      );
    }

    // 1. Marcar como visto primeiro (simula usuário lendo)
    await delay(HUMAN_BEHAVIOR.SEEN_DELAY);
    await sock.readMessages([
      {
        remoteJid: jid,
        id: message.id || crypto.randomBytes(10).toString('hex'),
      },
    ]);

    // 2. Iniciar indicador de digitação
    await sock.sendPresenceUpdate('composing', jid);

    // 3. Calcular tempo de digitação baseado no tamanho da mensagem
    const messageText =
      typeof message === 'string' ? message : message.text || '';
    const typingTime = calculateTypingTime(messageText.length);

    logger.info(
      `Simulando digitação por ${typingTime}ms para mensagem de ${messageText.length} caracteres`
    );
    await delay(typingTime);

    // 4. Parar indicador de digitação
    await sock.sendPresenceUpdate('paused', jid);

    // 5. Pequeno delay antes de enviar (simula finalização da mensagem)
    await delay(200 + Math.random() * 300);

    // 6. Enviar mensagem com tratamento adequado para replies
    const messageOptions =
      typeof message === 'string' ? { text: message } : message;

    // Configurações de envio com suporte a reply
    const sendOptions = {};
    if (quotedMessage) {
      sendOptions.quoted = quotedMessage;
    }

    const sentMessage = await sock.sendMessage(
      jid,
      messageOptions,
      sendOptions
    );

    // 7. Marcar como online após enviar
    await sock.sendPresenceUpdate('available', jid);

    return sentMessage;
  } catch (error) {
    logger.error(
      `Erro ao enviar mensagem com comportamento humano: ${error.message}`
    );
    throw error;
  }
}

// Função para processar fila de mensagens (evita envio simultâneo)
async function processMessageQueue(sessionId) {
  const queue = sessionQueues.get(sessionId);
  if (!queue || queue.processing) return;

  queue.processing = true;

  while (queue.messages.length > 0) {
    const { sock, jid, message, quotedMessage, resolve, reject } =
      queue.messages.shift();

    try {
      const result = await sendMessageWithHumanBehavior(
        sock,
        jid,
        message,
        quotedMessage
      );
      resolve(result);

      // Delay entre mensagens da fila
      if (queue.messages.length > 0) {
        await delay(getRandomDelay());
      }
    } catch (error) {
      reject(error);
    }
  }

  queue.processing = false;
}

// Função para adicionar mensagem à fila
function queueMessage(sessionId, sock, jid, message, quotedMessage = null) {
  return new Promise((resolve, reject) => {
    if (!sessionQueues.has(sessionId)) {
      sessionQueues.set(sessionId, { messages: [], processing: false });
    }

    const queue = sessionQueues.get(sessionId);
    queue.messages.push({ sock, jid, message, quotedMessage, resolve, reject });

    // Processar fila
    processMessageQueue(sessionId);
  });
}

// Função para salvar dados da sessão em arquivo e MongoDB
async function saveSessionData(sessionId, sessionData) {
  try {
    // Save to file (existing functionality)
    const sessionFile = `./auth_sessions/${sessionId}/session_data.json`;
    const dataToSave = {
      sessionId,
      isConnected: sessionData.isConnected,
      connectionState: sessionData.connectionState,
      createdAt: sessionData.createdAt,
      connectedAt: sessionData.connectedAt,
      lastError: sessionData.lastError,
      lastDisconnectTime: sessionData.lastDisconnectTime,
      user: sessionData.sock?.user || null,
      userId: sessionData.userId, // Include userId
    };
    fs.writeFileSync(sessionFile, JSON.stringify(dataToSave, null, 2));

    // Save to MongoDB if connected
    const db = database.getDb();
    if (db) {
      try {
        const sessions = db.collection('whatsapp_sessions');
        await sessions.updateOne(
          { sessionId },
          {
            $set: {
              ...dataToSave,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
        logger.info(`Session ${sessionId} saved to MongoDB`);
      } catch (dbError) {
        logger.warn(`Failed to save session to MongoDB: ${dbError.message}`);
      }
    }
  } catch (error) {
    logger.error(
      `Erro ao salvar dados da sessão ${sessionId}: ${error.message}`
    );
  }
}

// Function to save QR code data to MongoDB
async function saveQRCodeData(sessionId, qrCode, qrCodeImage) {
  const db = database.getDb();
  if (!db) return;

  try {
    const qrCodes = db.collection('qr_codes');
    await qrCodes.updateOne(
      { sessionId },
      {
        $set: {
          sessionId,
          qrCode,
          qrCodeImage,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes TTL
          isActive: true
        }
      },
      { upsert: true }
    );
    logger.info(`QR Code saved to MongoDB for session ${sessionId}`);
  } catch (error) {
    logger.warn(`Failed to save QR code to MongoDB: ${error.message}`);
  }
}

// Function to load QR code data from MongoDB
async function loadQRCodeData(sessionId) {
  const db = database.getDb();
  if (!db) return null;

  try {
    const qrCodes = db.collection('qr_codes');
    const qrData = await qrCodes.findOne({ 
      sessionId, 
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (qrData) {
      logger.info(`QR Code loaded from MongoDB for session ${sessionId}`);
      return {
        qrCode: qrData.qrCode,
        qrCodeImage: qrData.qrCodeImage
      };
    }
    
    return null;
  } catch (error) {
    logger.warn(`Failed to load QR code from MongoDB: ${error.message}`);
    return null;
  }
}

// Function to clear QR code data when session connects
async function clearQRCodeData(sessionId) {
  const db = database.getDb();
  if (!db) return;

  try {
    const qrCodes = db.collection('qr_codes');
    await qrCodes.updateOne(
      { sessionId },
      { $set: { isActive: false, clearedAt: new Date() } }
    );
    logger.info(`QR Code cleared from MongoDB for session ${sessionId}`);
  } catch (error) {
    logger.warn(`Failed to clear QR code from MongoDB: ${error.message}`);
  }
}

// Function to cleanup expired QR codes
async function cleanupExpiredQRCodes() {
  const db = database.getDb();
  if (!db) return;

  try {
    const qrCodes = db.collection('qr_codes');
    const result = await qrCodes.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    if (result.deletedCount > 0) {
      logger.info(`Cleaned up ${result.deletedCount} expired QR codes`);
    }
  } catch (error) {
    logger.warn(`Failed to cleanup expired QR codes: ${error.message}`);
  }
}

// Function to save webhook configuration to MongoDB
async function saveWebhookData(sessionId, webhookData) {
  const db = database.getDb();
  if (!db) return;

  try {
    const webhooksCollection = db.collection('webhooks');
    await webhooksCollection.updateOne(
      { sessionId },
      {
        $set: {
          sessionId,
          webhooks: webhookData,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    logger.info(`Webhook configuration saved to MongoDB for session ${sessionId}`);
  } catch (error) {
    logger.warn(`Failed to save webhook configuration to MongoDB: ${error.message}`);
  }
}

// Function to load webhook configuration from MongoDB
async function loadWebhookData(sessionId) {
  const db = database.getDb();
  if (!db) return null;

  try {
    const webhooksCollection = db.collection('webhooks');
    const webhookDoc = await webhooksCollection.findOne({ sessionId });
    
    if (webhookDoc && webhookDoc.webhooks) {
      logger.info(`Webhook configuration loaded from MongoDB for session ${sessionId}`);
      return webhookDoc.webhooks;
    }
    
    return null;
  } catch (error) {
    logger.warn(`Failed to load webhook configuration from MongoDB: ${error.message}`);
    return null;
  }
}

// Function to delete webhook configuration from MongoDB
async function deleteWebhookData(sessionId) {
  const db = database.getDb();
  if (!db) return;

  try {
    const webhooksCollection = db.collection('webhooks');
    await webhooksCollection.deleteOne({ sessionId });
    logger.info(`Webhook configuration deleted from MongoDB for session ${sessionId}`);
  } catch (error) {
    logger.warn(`Failed to delete webhook configuration from MongoDB: ${error.message}`);
  }
}

// Function to save message to MongoDB
async function saveMessageToMongoDB(sessionId, messageId, messageData) {
  const db = database.getDb();
  if (!db) return;

  try {
    // Get session to get userId
    const session = sessions.get(sessionId);
    if (!session || !session.userId) {
      return; // Skip if no user associated
    }

    // Get chat info if it's a group
    let chatInfo = null;
    if (messageData.jid.endsWith('@g.us') && session.sock) {
      try {
        chatInfo = await getContactOrGroupInfo(messageData.jid, session.sock);
      } catch (error) {
        logger.warn(`Failed to get group info for message: ${error.message}`);
      }
    }

    const messagesCollection = db.collection('messages');
    const document = {
      sessionId,
      messageId,
      userId: session.userId,
      jid: messageData.jid,
      timestamp: messageData.timestamp,
      message: messageData.message,
      isFromMe: messageData.message.key.fromMe,
      messageText: extractMessageText(messageData.message),
      messageType: getMessageType(messageData.message),
      chatInfo: chatInfo, // Include group info if available
      createdAt: new Date()
    };

    await messagesCollection.updateOne(
      { sessionId, messageId },
      { $set: document },
      { upsert: true }
    );
    
    // Save/update group info separately if it's a group
    if (chatInfo && chatInfo.type === 'group') {
      await saveGroupInfoToMongoDB(sessionId, messageData.jid, chatInfo);
    }
    
    logger.debug(`Message saved to MongoDB: ${sessionId}/${messageId}`);
  } catch (error) {
    logger.warn(`Failed to save message to MongoDB: ${error.message}`);
  }
}

// Function to save group info to MongoDB
async function saveGroupInfoToMongoDB(sessionId, groupJid, groupInfo) {
  const db = database.getDb();
  if (!db) return;

  try {
    const groupsCollection = db.collection('groups');
    const document = {
      sessionId,
      jid: groupJid,
      ...groupInfo,
      lastUpdated: new Date()
    };

    await groupsCollection.updateOne(
      { sessionId, jid: groupJid },
      { $set: document },
      { upsert: true }
    );
    
    logger.debug(`Group info saved to MongoDB: ${sessionId}/${groupJid}`);
  } catch (error) {
    logger.warn(`Failed to save group info to MongoDB: ${error.message}`);
  }
}

// Function to load messages from MongoDB
async function loadMessagesFromMongoDB(sessionId, limit = 50, offset = 0) {
  const db = database.getDb();
  if (!db) return [];

  try {
    const messagesCollection = db.collection('messages');
    const messages = await messagesCollection
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return messages.map(msg => ({
      messageId: msg.messageId,
      jid: msg.jid,
      timestamp: msg.timestamp,
      isFromMe: msg.isFromMe,
      messageText: msg.messageText,
      messageType: msg.messageType,
      chatInfo: msg.chatInfo || null, // Include saved group/contact info
      message: msg.message // Full message object for compatibility
    }));
  } catch (error) {
    logger.warn(`Failed to load messages from MongoDB: ${error.message}`);
    return [];
  }
}

// Helper function to extract message text
function extractMessageText(message) {
  return message.message?.conversation ||
         message.message?.extendedTextMessage?.text ||
         message.message?.imageMessage?.caption ||
         message.message?.videoMessage?.caption ||
         message.message?.documentMessage?.caption ||
         '[Media]';
}

// Helper function to get message type
function getMessageType(message) {
  if (message.message?.conversation) return 'text';
  if (message.message?.extendedTextMessage) return 'text';
  if (message.message?.imageMessage) return 'image';
  if (message.message?.videoMessage) return 'video';
  if (message.message?.audioMessage) return 'audio';
  if (message.message?.documentMessage) return 'document';
  if (message.message?.stickerMessage) return 'sticker';
  if (message.message?.locationMessage) return 'location';
  if (message.message?.contactMessage) return 'contact';
  return 'unknown';
}

// Função para carregar sessões existentes na inicialização
async function loadExistingSessions() {
  try {
    const authDir = './auth_sessions';
    if (!fs.existsSync(authDir)) {
      return;
    }

    const sessionDirs = fs.readdirSync(authDir).filter((dir) => {
      return fs.statSync(path.join(authDir, dir)).isDirectory();
    });

    logger.info(`Encontradas ${sessionDirs.length} sessões para recuperar`);

    for (const sessionId of sessionDirs) {
      try {
        let userId = null;
        
        // Try to load userId from MongoDB first
        const db = database.getDb();
        if (db) {
          try {
            const existingSession = await db.collection('whatsapp_sessions').findOne({ sessionId });
            if (existingSession && existingSession.userId) {
              userId = existingSession.userId;
              logger.info(`Recuperando sessão ${sessionId} para usuário ${userId}...`);
            }
          } catch (dbError) {
            logger.warn(`Erro ao buscar userId no MongoDB para sessão ${sessionId}: ${dbError.message}`);
          }
        }
        
        // Only recover session if we have a valid userId or if no database is available
        if (userId || !database.getDb()) {
          const sessionDataFile = path.join(
            authDir,
            sessionId,
            'session_data.json'
          );

          // Verificar se há dados salvos da sessão
          if (fs.existsSync(sessionDataFile)) {
            const savedData = JSON.parse(
              fs.readFileSync(sessionDataFile, 'utf8')
            );
            
            // Recover session with proper userId
            await createWhatsAppSession(sessionId, userId);
            
            // Try to recover QR code data from MongoDB if session is not connected
            const sessionData = sessions.get(sessionId);
            if (sessionData && !sessionData.isConnected) {
              const qrData = await loadQRCodeData(sessionId);
              if (qrData) {
                sessionData.qrCode = qrData.qrCode;
                sessionData.qrCodeImage = qrData.qrCodeImage;
                logger.info(`QR Code recovered from MongoDB for session ${sessionId}`);
              }
            }
            
            // Try to recover webhook configuration from MongoDB
            const webhookData = await loadWebhookData(sessionId);
            if (webhookData) {
              webhooks.set(sessionId, webhookData);
              logger.info(`Webhook configuration recovered from MongoDB for session ${sessionId}`);
            }
          } else {
            // Se não há dados salvos, mas existe diretório de auth, tentar criar sessão
            logger.info(
              `Criando nova sessão para diretório existente: ${sessionId}`
            );
            await createWhatsAppSession(sessionId, userId);
          }
        } else {
          logger.warn(`Skipping recovery of session ${sessionId} - no userId found in database. Session will need to be recreated by user.`);
        }
      } catch (error) {
        logger.error(`Erro ao recuperar sessão ${sessionId}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`Erro ao carregar sessões existentes: ${error.message}`);
  }
}

// Função para limpar sessões órfãs (sem userId)
async function cleanupOrphanedSessions() {
  try {
    const db = database.getDb();
    if (!db) {
      return;
    }

    // Find sessions with null userId
    const orphanedSessions = await db.collection('whatsapp_sessions').find({ 
      userId: null 
    }).toArray();

    if (orphanedSessions.length > 0) {
      logger.info(`Encontradas ${orphanedSessions.length} sessões órfãs (sem userId)`);
      
      for (const session of orphanedSessions) {
        const sessionId = session.sessionId;
        
        // Remove from memory if exists
        if (sessions.has(sessionId)) {
          const sessionData = sessions.get(sessionId);
          if (sessionData.sock) {
            try {
              await sessionData.sock.logout();
            } catch (error) {
              // Ignore logout errors
            }
          }
          sessions.delete(sessionId);
          logger.info(`Removida sessão órfã ${sessionId} da memória`);
        }
        
        // Remove from database
        await db.collection('whatsapp_sessions').deleteOne({ sessionId });
        logger.info(`Removida sessão órfã ${sessionId} do banco de dados`);
      }
    }
  } catch (error) {
    logger.error(`Erro ao limpar sessões órfãs: ${error.message}`);
  }
}

// Função para armazenar mensagem para reply
function storeMessage(sessionId, messageId, message) {
  try {
    if (!messageStore.has(sessionId)) {
      messageStore.set(sessionId, new Map());
    }

    const sessionMessages = messageStore.get(sessionId);
    const messageData = {
      message,
      timestamp: new Date(),
      jid: message.key.remoteJid,
    };
    
    sessionMessages.set(messageId, messageData);

    // Save to MongoDB asynchronously
    saveMessageToMongoDB(sessionId, messageId, messageData).catch(error => {
      logger.warn(`Failed to save message to MongoDB: ${error.message}`);
    });

    // Limitar o número de mensagens armazenadas por sessão (últimas 1000)
    if (sessionMessages.size > 1000) {
      const firstKey = sessionMessages.keys().next().value;
      sessionMessages.delete(firstKey);
    }
  } catch (error) {
    logger.error(`Erro ao armazenar mensagem: ${error.message}`);
  }
}

// Função para buscar mensagem por ID
function getMessageById(sessionId, messageId) {
  try {
    const sessionMessages = messageStore.get(sessionId);
    return sessionMessages?.get(messageId) || null;
  } catch (error) {
    logger.error(`Erro ao buscar mensagem: ${error.message}`);
    return null;
  }
}

// Função para buscar informações de contato/grupo (para webhooks)
async function getContactOrGroupInfo(jid, sock) {
  try {
    if (jid.endsWith('@g.us')) {
      // É um grupo - buscar metadados do grupo
      try {
        const groupMetadata = await sock.groupMetadata(jid);
        
        // Get admin list
        const admins = groupMetadata.participants
          ? groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id)
          : [];
        
        // Get super admins
        const superAdmins = groupMetadata.participants
          ? groupMetadata.participants.filter(p => p.admin === 'superadmin').map(p => p.id)
          : [];

        return {
          type: 'group',
          jid: jid,
          name: groupMetadata.subject || 'Grupo sem nome',
          participants: groupMetadata.participants?.length || 0,
          description: groupMetadata.desc || null,
          createdAt: groupMetadata.creation
            ? new Date(groupMetadata.creation * 1000).toISOString()
            : null,
          owner: groupMetadata.owner || null,
          admins: admins,
          superAdmins: superAdmins,
          announce: groupMetadata.announce || false, // Only admins can send messages
          restrict: groupMetadata.restrict || false, // Only admins can edit group info
          subjectTime: groupMetadata.subjectTime 
            ? new Date(groupMetadata.subjectTime * 1000).toISOString()
            : null,
          descTime: groupMetadata.descTime 
            ? new Date(groupMetadata.descTime * 1000).toISOString()
            : null,
          groupInviteCode: null // We'll try to get this separately if needed
        };
      } catch (error) {
        logger.warn(
          `Erro ao buscar metadados do grupo ${jid}: ${error.message}`
        );
        return {
          type: 'group',
          jid: jid,
          name: `Grupo ${jid.split('@')[0]}`,
          participants: 0,
          description: null,
          createdAt: null,
          owner: null,
          admins: [],
          superAdmins: [],
          announce: false,
          restrict: false,
          subjectTime: null,
          descTime: null,
          groupInviteCode: null
        };
      }
    } else if (jid.endsWith('@s.whatsapp.net')) {
      // É um contato individual - buscar nome
      try {
        // Tentar buscar nome do contato na agenda
        const contactInfo = await sock.onWhatsApp(jid.split('@')[0]);
        if (contactInfo && contactInfo.length > 0) {
          return {
            type: 'contact',
            name:
              contactInfo[0].name || contactInfo[0].notify || jid.split('@')[0],
            number: jid.split('@')[0],
            exists: contactInfo[0].exists,
            isRegistered: true,
          };
        }
      } catch (error) {
        logger.warn(
          `Erro ao buscar informações do contato ${jid}: ${error.message}`
        );
      }

      // Fallback para número apenas
      return {
        type: 'contact',
        name: jid.split('@')[0],
        number: jid.split('@')[0],
        exists: true,
        isRegistered: false,
      };
    }

    return {
      type: 'unknown',
      name: jid,
      number: jid,
      exists: false,
      isRegistered: false,
    };
  } catch (error) {
    logger.error(`Erro ao buscar informações para ${jid}: ${error.message}`);
    return {
      type: 'unknown',
      name: jid,
      number: jid,
      exists: false,
      isRegistered: false,
    };
  }
}

// Função para enviar webhook
async function sendWebhook(sessionId, eventType, data) {
  try {
    // Obter webhooks ativos para este evento
    const activeWebhooks = getActiveWebhooks(sessionId, eventType);
    if (activeWebhooks.length === 0) return;

    // Enriquecer dados com informações de contato/grupo se disponível
    let enrichedData = { ...data };

    if (data.remoteJid && eventType === 'message.upsert') {
      const session = sessions.get(sessionId);
      if (session && session.sock) {
        try {
          const chatInfo = await getContactOrGroupInfo(
            data.remoteJid,
            session.sock
          );
          enrichedData.chatInfo = chatInfo;

          // Se for grupo e há um participante, adicionar info do participante
          if (chatInfo.type === 'group' && data.participant) {
            try {
              const participantInfo = await getContactOrGroupInfo(
                data.participant,
                session.sock
              );
              enrichedData.participantInfo = {
                jid: data.participant,
                number: data.participant.split('@')[0],
                name: participantInfo.name,
                pushName: data.pushName || null,
              };
            } catch (error) {
              logger.warn(
                `Erro ao buscar info do participante ${data.participant}: ${error.message}`
              );
              enrichedData.participantInfo = {
                jid: data.participant,
                number: data.participant.split('@')[0],
                name: data.participant.split('@')[0],
                pushName: data.pushName || null,
              };
            }
          }
        } catch (error) {
          logger.warn(`Erro ao enriquecer dados do webhook: ${error.message}`);
        }
      }
    }

    const payload = {
      sessionId,
      eventType,
      timestamp: new Date().toISOString(),
      data: enrichedData,
    };

    // Enviar para todos os webhooks ativos em paralelo
    const webhookPromises = activeWebhooks.map(async (webhook) => {
      try {
        const webhookPayload = {
          ...payload,
          webhook: {
            id: webhook.id,
            name: webhook.name,
            priority: webhook.priority
          }
        };

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Baileys-API-Webhook/1.0.0',
            'X-Webhook-ID': webhook.id,
            'X-Webhook-Name': webhook.name,
            'X-Webhook-Priority': webhook.priority.toString()
          },
          body: JSON.stringify(webhookPayload),
          timeout: 15000, // 15 segundos timeout
        });

        if (!response.ok) {
          logger.warn(
            `Webhook ${webhook.name} (${webhook.id}) failed for session ${sessionId}: ${response.status} ${response.statusText}`
          );
          return { success: false, webhook: webhook.id, error: `${response.status} ${response.statusText}` };
        } else {
          logger.info(`Webhook ${webhook.name} sent successfully for session ${sessionId}`);
          return { success: true, webhook: webhook.id };
        }
      } catch (error) {
        logger.error(
          `Error sending webhook ${webhook.name} (${webhook.id}) for session ${sessionId}: ${error.message}`
        );
        return { success: false, webhook: webhook.id, error: error.message };
      }
    });

    // Aguardar todos os webhooks (máximo 15 segundos cada)
    const results = await Promise.allSettled(webhookPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const totalCount = activeWebhooks.length;
    
    if (successCount > 0) {
      logger.info(`Webhooks sent: ${successCount}/${totalCount} successful for session ${sessionId} event ${eventType}`);
    } else {
      logger.warn(`All webhooks failed for session ${sessionId} event ${eventType}`);
    }

  } catch (error) {
    logger.error(
      `Error in sendWebhook for session ${sessionId}: ${error.message}`
    );
  }
}

// Função para baixar mídia e converter para base64 (máximo 3MB)
async function downloadMediaAsBase64(sock, message) {
  try {
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB em bytes

    // Verificar tamanho do arquivo antes de baixar
    let fileLength = 0;
    if (message.message.imageMessage) {
      fileLength = message.message.imageMessage.fileLength;
    } else if (message.message.videoMessage) {
      fileLength = message.message.videoMessage.fileLength;
    } else if (message.message.audioMessage) {
      fileLength = message.message.audioMessage.fileLength;
    } else if (message.message.documentMessage) {
      fileLength = message.message.documentMessage.fileLength;
    } else if (message.message.stickerMessage) {
      fileLength = message.message.stickerMessage.fileLength;
    }

    // Se arquivo é maior que 3MB, não baixar
    if (fileLength > MAX_FILE_SIZE) {
      logger.warn(
        `Arquivo muito grande (${(fileLength / (1024 * 1024)).toFixed(
          2
        )}MB), não será incluído no webhook`
      );
      return {
        error: 'FILE_TOO_LARGE',
        message: `Arquivo de ${(fileLength / (1024 * 1024)).toFixed(
          2
        )}MB excede o limite de 3MB`,
        fileSize: fileLength,
      };
    }

    // Baixar o arquivo
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: () => sock.updateMediaMessage,
      }
    );

    // Verificar se o buffer não excede 3MB (double-check)
    if (buffer.length > MAX_FILE_SIZE) {
      logger.warn(
        `Buffer baixado excede 3MB (${(buffer.length / (1024 * 1024)).toFixed(
          2
        )}MB)`
      );
      return {
        error: 'BUFFER_TOO_LARGE',
        message: `Buffer de ${(buffer.length / (1024 * 1024)).toFixed(
          2
        )}MB excede o limite de 3MB`,
        actualSize: buffer.length,
      };
    }

    // Converter para base64
    const base64Data = buffer.toString('base64');

    logger.info(
      `Mídia convertida para base64: ${(buffer.length / 1024).toFixed(2)}KB`
    );

    return {
      success: true,
      base64: base64Data,
      size: buffer.length,
      sizeFormatted: `${(buffer.length / 1024).toFixed(2)}KB`,
    };
  } catch (error) {
    logger.error(`Erro ao baixar mídia para webhook: ${error.message}`);
    return {
      error: 'DOWNLOAD_FAILED',
      message: error.message,
    };
  }
}

// Função para extrair dados completos da mensagem (agora com mídia em base64)
async function extractMessageData(message, sock = null) {
  const messageData = {
    messageId: message.key.id,
    fromMe: message.key.fromMe,
    remoteJid: message.key.remoteJid,
    participant: message.key.participant,
    timestamp: message.messageTimestamp,
    pushName: message.pushName,
    messageType: null,
    content: null,
    quotedMessage: null,
    mediaData: null,
    mediaBase64: null, // Novo campo para dados em base64
    isGroup: message.key.remoteJid?.endsWith('@g.us') || false,
  };

  // Extrair conteúdo da mensagem
  if (message.message) {
    if (message.message.conversation) {
      messageData.messageType = 'text';
      messageData.content = message.message.conversation;
    } else if (message.message.extendedTextMessage) {
      messageData.messageType = 'text';
      messageData.content = message.message.extendedTextMessage.text;
      if (message.message.extendedTextMessage.contextInfo?.quotedMessage) {
        messageData.quotedMessage =
          message.message.extendedTextMessage.contextInfo;
      }
    } else if (message.message.imageMessage) {
      messageData.messageType = 'image';
      messageData.content = message.message.imageMessage.caption || '';
      messageData.mediaData = {
        mimetype: message.message.imageMessage.mimetype,
        fileSha256: message.message.imageMessage.fileSha256?.toString('base64'),
        fileLength: message.message.imageMessage.fileLength,
        width: message.message.imageMessage.width,
        height: message.message.imageMessage.height,
      };

      // Baixar e converter para base64 se sock foi fornecido
      if (sock) {
        messageData.mediaBase64 = await downloadMediaAsBase64(sock, message);
      }
    } else if (message.message.videoMessage) {
      messageData.messageType = 'video';
      messageData.content = message.message.videoMessage.caption || '';
      messageData.mediaData = {
        mimetype: message.message.videoMessage.mimetype,
        fileSha256: message.message.videoMessage.fileSha256?.toString('base64'),
        fileLength: message.message.videoMessage.fileLength,
        width: message.message.videoMessage.width,
        height: message.message.videoMessage.height,
        seconds: message.message.videoMessage.seconds,
      };

      // Baixar e converter para base64 se sock foi fornecido
      if (sock) {
        messageData.mediaBase64 = await downloadMediaAsBase64(sock, message);
      }
    } else if (message.message.audioMessage) {
      messageData.messageType = 'audio';
      messageData.mediaData = {
        mimetype: message.message.audioMessage.mimetype,
        fileSha256: message.message.audioMessage.fileSha256?.toString('base64'),
        fileLength: message.message.audioMessage.fileLength,
        seconds: message.message.audioMessage.seconds,
        ptt: message.message.audioMessage.ptt || false,
      };

      // Baixar e converter para base64 se sock foi fornecido
      if (sock) {
        messageData.mediaBase64 = await downloadMediaAsBase64(sock, message);
      }
    } else if (message.message.documentMessage) {
      messageData.messageType = 'document';
      messageData.content = message.message.documentMessage.caption || '';
      messageData.mediaData = {
        mimetype: message.message.documentMessage.mimetype,
        fileSha256:
          message.message.documentMessage.fileSha256?.toString('base64'),
        fileLength: message.message.documentMessage.fileLength,
        fileName: message.message.documentMessage.fileName,
        title: message.message.documentMessage.title,
      };

      // Baixar e converter para base64 se sock foi fornecido
      if (sock) {
        messageData.mediaBase64 = await downloadMediaAsBase64(sock, message);
      }
    } else if (message.message.stickerMessage) {
      messageData.messageType = 'sticker';
      messageData.mediaData = {
        mimetype: message.message.stickerMessage.mimetype,
        fileSha256:
          message.message.stickerMessage.fileSha256?.toString('base64'),
        fileLength: message.message.stickerMessage.fileLength,
        width: message.message.stickerMessage.width,
        height: message.message.stickerMessage.height,
      };

      // Baixar e converter para base64 se sock foi fornecido
      if (sock) {
        messageData.mediaBase64 = await downloadMediaAsBase64(sock, message);
      }
    } else if (message.message.contactMessage) {
      messageData.messageType = 'contact';
      messageData.content = {
        displayName: message.message.contactMessage.displayName,
        vcard: message.message.contactMessage.vcard,
      };
    } else if (message.message.locationMessage) {
      messageData.messageType = 'location';
      messageData.content = {
        latitude: message.message.locationMessage.degreesLatitude,
        longitude: message.message.locationMessage.degreesLongitude,
        name: message.message.locationMessage.name,
        address: message.message.locationMessage.address,
      };
    } else {
      messageData.messageType = 'unknown';
      messageData.content = 'Tipo de mensagem não suportado';
    }
  }

  return messageData;
}

// Criar sessão do WhatsApp
async function createWhatsAppSession(sessionId, userId = null) {
  try {
    if (sessions.has(sessionId)) {
      return { success: false, message: 'Sessão já existe' };
    }

    const authDir = `./auth_sessions/${sessionId}`;
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      logger: logger.child({ session: sessionId }),
      printQRInTerminal: false,
      browser: ['WhatsApp Business', 'Chrome', '4.0.0'],
      markOnlineOnConnect: false, // Importante para não receber notificações no app
      defaultQueryTimeoutMs: 60000,
      // Configurações para evitar detecção e melhorar estabilidade
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false, // Não sincronizar histórico
      shouldIgnoreJid: (jid) => false,
      // Configurações de getMessage para suporte adequado a replies
      getMessage: async (key) => {
        const messageData = getMessageById(sessionId, key.id);
        return messageData?.message || undefined;
      },
      // Configurações adicionais para estabilidade
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      emitOwnEvents: true,
    });

    let qrCode = null;
    let isConnected = false;
    let connectionState = 'connecting';

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
        // Atualizar o QR code na sessão armazenada
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.qrCode = qr;
          sessionData.isConnected = false;
          sessionData.connectionState = 'qr_generated';
          
          // Generate QR code image
          try {
            const QRCode = require('qrcode');
            sessionData.qrCodeImage = await QRCode.toDataURL(qr);
            
            // Save QR code to MongoDB for persistence
            await saveQRCodeData(sessionId, qr, sessionData.qrCodeImage);
          } catch (error) {
            logger.error(`Erro ao gerar QR code imagem: ${error.message}`);
          }
        }
        logger.info(`QR Code gerado para sessão ${sessionId}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';

        logger.info(
          `Conexão fechada para ${sessionId}. Status: ${statusCode}, Erro: ${errorMessage}`
        );

        // Verificar se é um erro de stream (código 515 ou erro de stream)
        const isStreamError =
          errorMessage.includes('Stream Errored') || statusCode === 515;

        // NUNCA reconectar se for logout intencional (401) ou banimento
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          statusCode !== 401 &&
          statusCode !== DisconnectReason.forbidden &&
          statusCode !== DisconnectReason.badSession;

        // Atualizar estado da sessão
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.isConnected = false;
          sessionData.connectionState = 'disconnected';
          sessionData.lastError = errorMessage;
          sessionData.lastDisconnectTime = new Date();
        }

        if (shouldReconnect) {
          // Log do motivo da reconexão
          logger.warn(
            `Reconexão necessária para ${sessionId}. Motivo: ${errorMessage} (Status: ${statusCode})`
          );

          // Controle de tentativas de reconexão com backoff exponencial
          const attempts = reconnectionAttempts.get(sessionId) || 0;

          if (attempts < RECONNECTION_CONFIG.MAX_ATTEMPTS) {
            reconnectionAttempts.set(sessionId, attempts + 1);

            // Calcular delay com backoff exponencial - mais conservador para evitar problemas
            let retryDelay;
            if (isStreamError || statusCode === 401) {
              // Para erros de stream ou autenticação, usar delay maior
              retryDelay =
                RECONNECTION_CONFIG.STREAM_ERROR_DELAY + attempts * 5000;
            } else {
              retryDelay = Math.min(
                RECONNECTION_CONFIG.BASE_DELAY * Math.pow(2, attempts),
                RECONNECTION_CONFIG.MAX_DELAY
              );
            }

            logger.info(
              `Tentando reconectar sessão ${sessionId} (tentativa ${
                attempts + 1
              }/${RECONNECTION_CONFIG.MAX_ATTEMPTS}) em ${retryDelay}ms...`
            );

            setTimeout(async () => {
              try {
                // Aguardar um pouco antes de limpar para dar tempo de finalizar processos
                await delay(1000);

                // Preserve userId before deleting session
                const currentSession = sessions.get(sessionId);
                const userId = currentSession?.userId || null;

                // Limpar sessão anterior antes de reconectar
                sessions.delete(sessionId);
                sessionQueues.delete(sessionId);
                messageRateLimit.delete(sessionId);

                // Criar nova sessão preservando userId
                await createWhatsAppSession(sessionId, userId);
              } catch (error) {
                logger.error(
                  `Erro na reconexão da sessão ${sessionId}: ${error.message}`
                );

                // Se falhou, incrementar tentativas para a próxima vez
                const currentAttempts =
                  reconnectionAttempts.get(sessionId) || 0;
                if (currentAttempts >= RECONNECTION_CONFIG.MAX_ATTEMPTS) {
                  logger.error(
                    `Máximo de tentativas de reconexão atingido para sessão ${sessionId}. Parando tentativas.`
                  );
                  reconnectionAttempts.delete(sessionId);
                  sessions.delete(sessionId);
                  sessionQueues.delete(sessionId);
                  messageRateLimit.delete(sessionId);
                }
              }
            }, retryDelay);
          } else {
            logger.error(
              `Máximo de tentativas de reconexão atingido para sessão ${sessionId}. Removendo sessão.`
            );
            reconnectionAttempts.delete(sessionId);
            sessions.delete(sessionId);
            sessionQueues.delete(sessionId);
            messageRateLimit.delete(sessionId);
          }
        } else {
          // Log do motivo de não reconectar
          if (statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
            logger.warn(
              `Sessão ${sessionId} foi deslogada intencionalmente (401). Não reconectando para evitar problemas.`
            );
          } else if (statusCode === DisconnectReason.forbidden) {
            logger.error(
              `Sessão ${sessionId} foi banida/bloqueada. Não reconectando.`
            );
          } else if (statusCode === DisconnectReason.badSession) {
            logger.error(`Sessão ${sessionId} corrompida. Não reconectando.`);
          }

          reconnectionAttempts.delete(sessionId);
          sessions.delete(sessionId);
          sessionQueues.delete(sessionId);
          messageRateLimit.delete(sessionId);
        }
      } else if (connection === 'open') {
        isConnected = true;
        connectionState = 'connected';

        // Limpar contador de tentativas de reconexão quando conectar com sucesso
        reconnectionAttempts.delete(sessionId);

        // Atualizar estado da sessão
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.isConnected = true;
          sessionData.connectionState = 'connected';
          sessionData.qrCode = null; // Limpar QR code quando conectado
          sessionData.qrCodeImage = null; // Limpar imagem QR code
          sessionData.lastError = null; // Limpar erros anteriores
          sessionData.connectedAt = new Date();

          // Clear QR code from MongoDB when session connects
          await clearQRCodeData(sessionId);

          // Salvar dados da sessão
          await saveSessionData(sessionId, sessionData);
        }
        logger.info(`Sessão ${sessionId} conectada com sucesso`);
      } else if (connection === 'connecting') {
        connectionState = 'connecting';
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.connectionState = 'connecting';
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Handler para mensagens recebidas
    sock.ev.on('messages.upsert', async (messageUpdate) => {
      const { messages } = messageUpdate;

      for (const message of messages) {
        // Armazenar todas as mensagens (enviadas e recebidas) para reply
        if (message.key?.id) {
          storeMessage(sessionId, message.key.id, message);
        }

        // Extrair dados completos da mensagem (incluindo mídia em base64 para webhooks)
        const messageData = await extractMessageData(message, sock);

        // Enviar webhook para todas as mensagens (enviadas e recebidas)
        await sendWebhook(sessionId, 'message.upsert', messageData);

        if (!message.key.fromMe && message.message) {
          // Processar mensagem recebida
          await handleIncomingMessage(sock, message, sessionId);
        }
      }
    });

    // Armazenar sessão
    const sessionData = {
      sock,
      qrCode,
      isConnected,
      connectionState,
      createdAt: new Date(),
      userId: userId, // Associate session with user
    };
    
    sessions.set(sessionId, sessionData);

    // Save initial session data to MongoDB
    await saveSessionData(sessionId, sessionData);

    return {
      success: true,
      message: 'Sessão criada com sucesso',
      qrCode,
      sessionId,
    };
  } catch (error) {
    logger.error(`Erro ao criar sessão ${sessionId}: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// Handler para mensagens recebidas (resposta automática inteligente)
async function handleIncomingMessage(sock, message, sessionId) {
  try {
    const jid = message.key.remoteJid;
    const messageText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      '';

    // Log da mensagem recebida
    logger.info(
      `Mensagem recebida na sessão ${sessionId} de ${jid}: ${messageText}`
    );

    // Simular delay de leitura humana
    await delay(500 + Math.random() * 1500);

    // Marcar como visto
    await sock.readMessages([message.key]);

    // Aqui você pode implementar sua lógica de resposta automática
    // Por exemplo, responder apenas se a mensagem contém certas palavras-chave

    if (
      messageText.toLowerCase().includes('oi') ||
      messageText.toLowerCase().includes('olá') ||
      messageText.toLowerCase().includes('ola')
    ) {
      const responses = [
        'Olá! Como posso ajudar você?',
        'Oi! Em que posso ser útil?',
        'Olá! Estou aqui para ajudar.',
        'Oi! Como você está?',
      ];

      const randomResponse =
        responses[Math.floor(Math.random() * responses.length)];

      // Usar a fila de mensagens para resposta automática
      //await queueMessage(sessionId, sock, jid, randomResponse, message);
    }
  } catch (error) {
    logger.error(`Erro ao processar mensagem recebida: ${error.message}`);
  }
}

// Função para baixar mídia
async function downloadMedia(sock, message, filename) {
  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: () => sock.updateMediaMessage,
      }
    );

    const mediaDir = './downloads';
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    const filePath = path.join(mediaDir, filename);
    fs.writeFileSync(filePath, buffer);

    return {
      success: true,
      filePath,
      buffer,
      size: buffer.length,
    };
  } catch (error) {
    logger.error(`Erro ao baixar mídia: ${error.message}`);
    return { success: false, error: error.message };
  }
}

app.post('/api/baileys/session/create', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id || req.user?._id; // Get user ID from API token middleware

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId é obrigatório',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    const result = await createWhatsAppSession(sessionId, userId);

    // Sempre retornar o QR code quando criar uma nova sessão
    if (result.success) {
      // Aguardar um pouco se o QR code ainda não foi gerado
      let attempts = 0;
      const maxAttempts = 10; // 5 segundos no máximo

      while (!result.qrCode && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const session = sessions.get(sessionId);
        if (session && session.qrCode) {
          result.qrCode = session.qrCode;
          break;
        }
        attempts++;
      }

      // Se há QR code, gerar sempre a imagem
      if (result.qrCode) {
        try {
          result.qrCodeImage = await QRCode.toDataURL(result.qrCode);
          // Salvar a imagem na sessão também
          const session = sessions.get(sessionId);
          if (session) {
            session.qrCodeImage = result.qrCodeImage;
          }
        } catch (error) {
          logger.error(`Erro ao gerar QR code imagem: ${error.message}`);
        }
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post('/api/baileys/session/:sessionId/regenerate-qr', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    if (session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão já conectada, não é possível regenerar QR code',
      });
    }

    // Preserve userId from current session
    const userId = session.userId;

    // Fechar sessão atual e criar nova
    try {
      if (session.sock) {
        await session.sock.logout();
      }
    } catch (error) {
      logger.warn(`Erro ao fechar sessão anterior: ${error.message}`);
    }

    // Remover sessão atual
    sessions.delete(sessionId);
    sessionQueues.delete(sessionId);
    messageRateLimit.delete(sessionId);
    reconnectionAttempts.delete(sessionId);

    // Criar nova sessão preservando userId
    const result = await createWhatsAppSession(sessionId, userId);

    if (result.success && result.qrCode) {
      try {
        result.qrCodeImage = await QRCode.toDataURL(result.qrCode);
      } catch (error) {
        logger.error(`Erro ao gerar QR code imagem: ${error.message}`);
      }
    }

    res.json(result);
  } catch (error) {
    logger.error(`Erro ao regenerar QR code: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get('/api/baileys/session/:sessionId/status', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    res.json({
      success: true,
      sessionId,
      isConnected: session.isConnected,
      connectionState: session.connectionState || 'unknown',
      createdAt: session.createdAt,
      connectedAt: session.connectedAt || null,
      lastError: session.lastError || null,
      lastDisconnectTime: session.lastDisconnectTime || null,
      user: session.sock.user || null,
      hasQrCode: !!session.qrCode,
      webhookUrl: webhooks.get(sessionId) || null,
      messageCount: messageStore.get(sessionId)?.size || 0,
      queueLength: sessionQueues.get(sessionId)?.messages?.length || 0,
      reconnectionAttempts: reconnectionAttempts.get(sessionId) || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get('/api/baileys/sessions', (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id; // Get user ID from API token middleware
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    // Filter sessions by userId
    const sessionList = Array.from(sessions.entries())
      .filter(([id, session]) => session.userId && session.userId.toString() === userId.toString())
      .map(([id, session]) => ({
        sessionId: id,
        isConnected: session.isConnected,
        connectionState: session.connectionState || 'unknown',
        createdAt: session.createdAt,
        connectedAt: session.connectedAt || null,
        lastError: session.lastError || null,
        user: session.sock.user || null,
        hasQrCode: !!session.qrCode,
      webhookUrl: webhooks.get(id) || null,
      messageCount: messageStore.get(id)?.size || 0,
      queueLength: sessionQueues.get(id)?.messages?.length || 0,
      reconnectionAttempts: reconnectionAttempts.get(id) || 0,
    }));

    res.json({
      success: true,
      sessions: sessionList,
      total: sessionList.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Endpoint para limpar sessões órfãs (sem userId) - apenas para administradores
app.post('/api/baileys/sessions/cleanup-orphaned', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    // Check if user is admin (you might want to add role checking here)
    // For now, allow any authenticated user to run cleanup on their orphaned sessions
    
    logger.info(`Usuário ${userId} solicitou limpeza de sessões órfãs`);
    await cleanupOrphanedSessions();
    
    res.json({
      success: true,
      message: 'Limpeza de sessões órfãs concluída',
    });
  } catch (error) {
    logger.error(`Erro na limpeza de sessões órfãs: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post('/api/baileys/session/:sessionId/send-message', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, message, quotedMessageId } = req.body;

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não encontrada ou não conectada',
      });
    }

    // Verificar se o número está no formato correto
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    let quotedMessage = null;
    if (quotedMessageId) {
      const originalMessage = getMessageById(sessionId, quotedMessageId);
      if (originalMessage) {
        quotedMessage = originalMessage.message;
      }
    }

    const result = await queueMessage(
      sessionId,
      session.sock,
      jid,
      { text: message },
      quotedMessage
    );

    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      messageId: result.key.id,
      messageData: {
        to: jid,
        sentAt: new Date().toISOString(),
        messageType: 'text',
        content: message,
        quotedMessageId: quotedMessageId || null,
        status: 'sent',
      },
      sessionInfo: {
        sessionId,
        isConnected: session.isConnected,
        user: session.sock.user,
      },
    });
  } catch (error) {
    logger.error(`Erro ao enviar mensagem: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post(
  '/api/baileys/session/:sessionId/send-media',
  checkSessionOwnership,
  upload.single('media'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { to, caption, filename } = req.body;

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Arquivo de mídia é obrigatório',
        });
      }

      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const mediaBuffer = fs.readFileSync(req.file.path);

      // Determinar tipo de mídia baseado na extensão
      const ext = path.extname(req.file.originalname).toLowerCase();
      let messageContent = {};

      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        messageContent = {
          image: mediaBuffer,
          caption: caption || '',
          fileName: filename || req.file.originalname,
        };
      } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
        messageContent = {
          video: mediaBuffer,
          caption: caption || '',
          fileName: filename || req.file.originalname,
        };
      } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        messageContent = {
          audio: mediaBuffer,
          fileName: filename || req.file.originalname,
          mimetype: req.file.mimetype,
        };
      } else {
        messageContent = {
          document: mediaBuffer,
          fileName: filename || req.file.originalname,
          mimetype: req.file.mimetype,
        };
      }

      const result = await queueMessage(
        sessionId,
        session.sock,
        jid,
        messageContent
      );

      // Remover arquivo temporário
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: 'Mídia enviada com sucesso',
        messageId: result.key.id,
        messageData: {
          to: jid,
          sentAt: new Date().toISOString(),
          messageType: ext.includes('.jpg', '.jpeg', '.png', '.gif', '.webp')
            ? 'image'
            : ext.includes('.mp4', '.mov', '.avi', '.mkv')
            ? 'video'
            : ext.includes('.mp3', '.wav', '.ogg', '.m4a')
            ? 'audio'
            : 'document',
          fileName: filename || req.file.originalname,
          fileSize: req.file.size,
          mimetype: req.file.mimetype,
          caption: caption || '',
          status: 'sent',
        },
        sessionInfo: {
          sessionId,
          isConnected: session.isConnected,
          user: session.sock.user,
        },
      });
    } catch (error) {
      logger.error(`Erro ao enviar mídia: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

app.post('/api/baileys/session/:sessionId/download-media', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: 'messageId é obrigatório',
      });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não encontrada ou não conectada',
      });
    }

    // Buscar a mensagem armazenada
    const messageData = getMessageById(sessionId, messageId);
    if (!messageData) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada',
      });
    }

    const message = messageData.message;

    // Verificar se a mensagem contém mídia
    const hasMedia =
      message.message?.imageMessage ||
      message.message?.videoMessage ||
      message.message?.audioMessage ||
      message.message?.documentMessage ||
      message.message?.stickerMessage;

    if (!hasMedia) {
      return res.status(400).json({
        success: false,
        message: 'Mensagem não contém mídia para download',
      });
    }

    // Gerar nome do arquivo baseado no tipo de mídia
    let filename = `media_${messageId}`;
    if (message.message.imageMessage) {
      filename += '.jpg';
    } else if (message.message.videoMessage) {
      filename += '.mp4';
    } else if (message.message.audioMessage) {
      filename += message.message.audioMessage.ptt ? '.ogg' : '.mp3';
    } else if (message.message.documentMessage) {
      filename = message.message.documentMessage.fileName || `${filename}.bin`;
    } else if (message.message.stickerMessage) {
      filename += '.webp';
    }

    // Baixar a mídia
    const downloadResult = await downloadMedia(session.sock, message, filename);

    if (downloadResult.success) {
      res.json({
        success: true,
        message: 'Mídia baixada com sucesso',
        messageId,
        downloadInfo: {
          fileName: filename,
          filePath: downloadResult.filePath,
          fileSize: downloadResult.size,
          downloadedAt: new Date().toISOString(),
        },
        sessionInfo: {
          sessionId,
          isConnected: session.isConnected,
          user: session.sock.user,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro ao baixar mídia',
        error: downloadResult.error,
      });
    }
  } catch (error) {
    logger.error(`Erro ao baixar mídia: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post('/api/baileys/session/:sessionId/mark-read', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid, messageId } = req.body;

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não encontrada ou não conectada',
      });
    }

    await session.sock.readMessages([
      {
        remoteJid: jid,
        id: messageId,
      },
    ]);

    res.json({
      success: true,
      message: 'Mensagem marcada como lida',
    });
  } catch (error) {
    logger.error(`Erro ao marcar como lida: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post('/api/baileys/session/:sessionId/typing', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid, isTyping = true } = req.body;

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não encontrada ou não conectada',
      });
    }

    const presence = isTyping ? 'composing' : 'paused';
    await session.sock.sendPresenceUpdate(presence, jid);

    res.json({
      success: true,
      message: `Status de digitação ${isTyping ? 'iniciado' : 'parado'}`,
    });
  } catch (error) {
    logger.error(`Erro ao enviar status de digitação: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post('/api/baileys/session/:sessionId/reply-message', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { messageId, reply } = req.body;

    if (!messageId || !reply) {
      return res.status(400).json({
        success: false,
        message: 'messageId e reply são obrigatórios',
      });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não encontrada ou não conectada',
      });
    }

    // Buscar a mensagem original
    const originalMessage = getMessageById(sessionId, messageId);
    if (!originalMessage) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada',
      });
    }

    const jid = originalMessage.jid;

    // Enviar resposta citando a mensagem original corretamente
    const result = await queueMessage(
      sessionId,
      session.sock,
      jid,
      { text: reply },
      originalMessage.message
    );

    res.json({
      success: true,
      message: 'Resposta enviada com sucesso',
      messageId: result.key.id,
      quotedMessageId: messageId,
      messageData: {
        to: jid,
        sentAt: new Date().toISOString(),
        messageType: 'text',
        content: reply,
        isReply: true,
        originalMessage: {
          messageId: messageId,
          jid: originalMessage.jid,
          timestamp: originalMessage.timestamp,
        },
        status: 'sent',
      },
      sessionInfo: {
        sessionId,
        isConnected: session.isConnected,
        user: session.sock.user,
      },
    });
  } catch (error) {
    logger.error(`Erro ao responder mensagem: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get('/api/baileys/session/:sessionId/messages', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0, source = 'auto' } = req.query;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    let messages = [];
    let total = 0;

    // Try to get messages from MongoDB first (persistent storage)
    if (source === 'auto' || source === 'mongodb') {
      try {
        const mongoMessages = await loadMessagesFromMongoDB(sessionId, parseInt(limit), parseInt(offset));
        if (mongoMessages.length > 0) {
          messages = mongoMessages;
          total = mongoMessages.length;
          
          // Get total count from MongoDB
          const db = database.getDb();
          if (db) {
            const messagesCollection = db.collection('messages');
            total = await messagesCollection.countDocuments({ sessionId });
          }
          
          return res.json({
            success: true,
            messages,
            total,
            source: 'mongodb',
            sessionId
          });
        }
      } catch (error) {
        logger.warn(`Failed to load messages from MongoDB: ${error.message}`);
      }
    }

    // Fallback to memory store if MongoDB is unavailable or source is 'memory'
    if (source === 'auto' || source === 'memory') {
      const sessionMessages = messageStore.get(sessionId);
      if (!sessionMessages) {
        return res.json({
          success: true,
          messages: [],
          total: 0,
          source: 'memory',
          sessionId
        });
      }

      // Convert Map to Array and apply pagination
      const messageEntries = Array.from(sessionMessages.entries());
      const totalInMemory = messageEntries.length;
      const paginatedEntries = messageEntries.slice(-parseInt(limit) - parseInt(offset), messageEntries.length - parseInt(offset));

      // Get contact info for unique JIDs (only if session is connected)
      const contactInfoCache = new Map();
      if (session.isConnected && session.sock) {
        const uniqueJids = [...new Set(paginatedEntries.map(([id, data]) => data.jid))];
        
        for (const jid of uniqueJids) {
          try {
            const contactInfo = await getContactOrGroupInfo(jid, session.sock);
            contactInfoCache.set(jid, contactInfo);
          } catch (error) {
            logger.warn(`Failed to get contact info for ${jid}: ${error.message}`);
          }
        }
      }

      messages = paginatedEntries.map(([id, data]) => {
        const message = data.message;
        const contactInfo = contactInfoCache.get(data.jid);

        const messageInfo = {
          messageId: id,
          jid: data.jid,
          chatInfo: contactInfo,
          timestamp: data.timestamp,
          isFromMe: message.key.fromMe,
          messageText: extractMessageText(message),
          messageType: getMessageType(message),
          isReply: false,
          quotedMessage: null,
          pushName: message.pushName || null
        };

        // Add participant info if it's a group
        if (contactInfo && contactInfo.type === 'group' && message.key.participant) {
          messageInfo.participant = {
            jid: message.key.participant,
            number: message.key.participant.split('@')[0],
            pushName: message.pushName || null,
          };
        }

        // Check if it's a reply
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
          const contextInfo = message.message.extendedTextMessage.contextInfo;
          messageInfo.isReply = true;
          messageInfo.quotedMessage = {
            messageId: contextInfo.stanzaId,
            participant: contextInfo.participant,
            text: contextInfo.quotedMessage?.conversation ||
                  contextInfo.quotedMessage?.extendedTextMessage?.text ||
                  '[Mídia citada]',
            fromMe: contextInfo.participant === message.key.remoteJid
          };
        }

        return messageInfo;
      });

      return res.json({
        success: true,
        messages: messages.reverse(), // Most recent first
        total: totalInMemory,
        source: 'memory',
        sessionId
      });
    }

    // If no messages found in either source
    res.json({
      success: true,
      messages: [],
      total: 0,
      source: 'none',
      sessionId
    });
  } catch (error) {
    logger.error(`Erro ao listar mensagens: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post('/api/baileys/session/:sessionId/webhook', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'webhookUrl é obrigatório',
      });
    }

    // Validar URL
    try {
      new URL(webhookUrl);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'URL do webhook inválida',
      });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    // COMPATIBILIDADE: Remover webhook "Principal" existente se houver
    const sessionWebhooks = getSessionWebhooks(sessionId);
    const existingPrincipal = sessionWebhooks.find(w => w.name === 'Principal');
    if (existingPrincipal) {
      removeWebhookFromSession(sessionId, existingPrincipal.id);
    }

    // Adicionar novo webhook como "Principal" (endpoint legado)
    const newWebhook = addWebhookToSession(sessionId, {
      name: 'Principal',
      url: webhookUrl,
      active: true,
      priority: 1,
      events: ['*']
    });

    res.json({
      success: true,
      message: 'Webhook configurado com sucesso',
      webhookUrl,
      sessionId,
      webhookInfo: {
        id: newWebhook.id,
        name: newWebhook.name,
        note: 'Endpoint legado - use /webhooks para gerenciamento completo'
      }
    });
  } catch (error) {
    logger.error(`Erro ao configurar webhook: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get('/api/baileys/session/:sessionId/webhook', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    // COMPATIBILIDADE: Buscar webhook "Principal" ou o primeiro ativo
    const sessionWebhooks = getSessionWebhooks(sessionId);
    const principalWebhook = sessionWebhooks.find(w => w.name === 'Principal') || sessionWebhooks.find(w => w.active);
    
    if (!principalWebhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook não configurado para esta sessão',
      });
    }

    res.json({
      success: true,
      webhookUrl: principalWebhook.url,
      sessionId,
      webhookInfo: {
        id: principalWebhook.id,
        name: principalWebhook.name,
        active: principalWebhook.active,
        priority: principalWebhook.priority,
        note: 'Endpoint legado - use /webhooks para informações completas'
      }
    });
  } catch (error) {
    logger.error(`Erro ao obter webhook: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.delete('/api/baileys/session/:sessionId/webhook', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    // COMPATIBILIDADE: Remover webhook "Principal" ou o primeiro ativo
    const sessionWebhooks = getSessionWebhooks(sessionId);
    const principalWebhook = sessionWebhooks.find(w => w.name === 'Principal') || sessionWebhooks.find(w => w.active);
    
    if (!principalWebhook) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum webhook encontrado para remover',
      });
    }

    const removedWebhook = removeWebhookFromSession(sessionId, principalWebhook.id);

    res.json({
      success: true,
      message: 'Webhook removido com sucesso',
      sessionId,
      removedWebhook: {
        id: removedWebhook.id,
        name: removedWebhook.name,
        url: removedWebhook.url,
        note: 'Endpoint legado - use /webhooks/:id para remoção específica'
      }
    });
  } catch (error) {
    logger.error(`Erro ao remover webhook: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ========================================
// NOVOS ENDPOINTS PARA MÚLTIPLOS WEBHOOKS
// ========================================

// Listar todos os webhooks de uma sessão
app.get('/api/baileys/session/:sessionId/webhooks', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    const sessionWebhooks = getSessionWebhooks(sessionId);

    res.json({
      success: true,
      sessionId,
      webhooks: sessionWebhooks,
      total: sessionWebhooks.length,
      limit: 3
    });
  } catch (error) {
    logger.error(`Erro ao listar webhooks: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Adicionar novo webhook à sessão
app.post('/api/baileys/session/:sessionId/webhooks', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, url, active, priority, events } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL do webhook é obrigatória',
      });
    }

    // Validar URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'URL inválida',
      });
    }

    const newWebhook = addWebhookToSession(sessionId, {
      name,
      url,
      active,
      priority,
      events
    });

    res.json({
      success: true,
      message: 'Webhook adicionado com sucesso',
      webhook: newWebhook,
      sessionId
    });

  } catch (error) {
    logger.error(`Erro ao adicionar webhook: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Obter webhook específico
app.get('/api/baileys/session/:sessionId/webhooks/:webhookId', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId, webhookId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    const sessionWebhooks = getSessionWebhooks(sessionId);
    const webhook = sessionWebhooks.find(w => w.id === webhookId);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook não encontrado',
      });
    }

    res.json({
      success: true,
      webhook,
      sessionId
    });

  } catch (error) {
    logger.error(`Erro ao obter webhook: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Atualizar webhook específico
app.put('/api/baileys/session/:sessionId/webhooks/:webhookId', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId, webhookId } = req.params;
    const { name, url, active, priority, events } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    // Validar URL se fornecida
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'URL inválida',
        });
      }
    }

    const updatedWebhook = updateWebhookInSession(sessionId, webhookId, {
      name,
      url,
      active,
      priority,
      events
    });

    res.json({
      success: true,
      message: 'Webhook atualizado com sucesso',
      webhook: updatedWebhook,
      sessionId
    });

  } catch (error) {
    logger.error(`Erro ao atualizar webhook: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Remover webhook específico
app.delete('/api/baileys/session/:sessionId/webhooks/:webhookId', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId, webhookId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    const removedWebhook = removeWebhookFromSession(sessionId, webhookId);

    res.json({
      success: true,
      message: 'Webhook removido com sucesso',
      webhook: removedWebhook,
      sessionId
    });

  } catch (error) {
    logger.error(`Erro ao remover webhook: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Ativar/desativar webhook específico
app.patch('/api/baileys/session/:sessionId/webhooks/:webhookId/toggle', checkSessionOwnership, (req, res) => {
  try {
    const { sessionId, webhookId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    const sessionWebhooks = getSessionWebhooks(sessionId);
    const webhook = sessionWebhooks.find(w => w.id === webhookId);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook não encontrado',
      });
    }

    webhook.active = !webhook.active;
    webhook.updatedAt = new Date().toISOString();
    webhooks.set(sessionId, sessionWebhooks);

    res.json({
      success: true,
      message: `Webhook ${webhook.active ? 'ativado' : 'desativado'} com sucesso`,
      webhook,
      sessionId
    });

  } catch (error) {
    logger.error(`Erro ao alternar webhook: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Testar webhook específico
app.post('/api/baileys/session/:sessionId/webhooks/:webhookId/test', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId, webhookId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    const sessionWebhooks = getSessionWebhooks(sessionId);
    const webhook = sessionWebhooks.find(w => w.id === webhookId);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook não encontrado',
      });
    }

    // Enviar payload de teste
    const testPayload = {
      sessionId,
      eventType: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Este é um teste do webhook',
        webhookId: webhook.id,
        webhookName: webhook.name
      }
    };

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Baileys-Webhook/1.0',
        },
        body: JSON.stringify(testPayload),
        timeout: 10000, // 10 segundos
      });

      const success = response.ok;
      const responseText = await response.text();

      res.json({
        success: true,
        message: 'Teste do webhook enviado',
        webhook: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url
        },
        testResult: {
          success,
          status: response.status,
          statusText: response.statusText,
          response: responseText.substring(0, 500), // Limitar resposta
          timestamp: new Date().toISOString()
        }
      });

    } catch (fetchError) {
      res.json({
        success: true,
        message: 'Teste do webhook enviado',
        webhook: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url
        },
        testResult: {
          success: false,
          error: fetchError.message,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    logger.error(`Erro ao testar webhook: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Função avançada para simular comportamento humano realista
async function sendMessageWithAdvancedHumanBehavior(
  sock,
  jid,
  message,
  options = {}
) {
  const {
    readingSpeed = 150, // palavras por minuto (velocidade média de leitura)
    typingSpeed = 40, // palavras por minuto (velocidade média de digitação)
    thinkingTime = true, // tempo para "pensar" na resposta
    naturalPauses = true, // pausas naturais durante digitação
    typoSimulation = false, // simular erros de digitação (correções)
    emotionalDelay = true, // delay baseado no conteúdo emocional
    contextAwareness = true, // considerar contexto da conversa
  } = options;

  try {
    const sessionId = sock.user?.id;
    if (!checkRateLimit(sessionId)) {
      throw new Error(
        'Rate limit excedido. Muitas mensagens enviadas recentemente.'
      );
    }

    const messageText =
      typeof message === 'string' ? message : message.text || '';
    const messageLength = messageText.length;
    const wordCount = messageText
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    // 1. TEMPO DE LEITURA (se foi resposta a uma mensagem)
    let readingTime = 0;
    if (options.replyToMessage && contextAwareness) {
      const replyMessageLength = options.replyToMessage.length || 0;
      const replyWordCount = options.replyToMessage.split(/\s+/).length || 0;
      // Tempo de leitura: palavras/minuto convertido para ms
      readingTime = (replyWordCount / readingSpeed) * 60000;
      // Adicionar tempo extra para compreensão
      readingTime += Math.random() * 2000 + 1000; // 1-3 segundos extras

      logger.info(
        `Simulando leitura de ${replyWordCount} palavras por ${readingTime.toFixed(
          0
        )}ms`
      );
      await delay(readingTime);
    }

    // 2. TEMPO DE REFLEXÃO/PENSAMENTO
    let thinkingDelay = 0;
    if (thinkingTime) {
      // Baseado na complexidade da mensagem
      const complexityFactor = Math.min(wordCount / 10, 3); // Max 3x multiplier
      thinkingDelay = (1000 + Math.random() * 2000) * (1 + complexityFactor);

      // Delay emocional baseado no conteúdo
      if (emotionalDelay) {
        const emotionalWords = [
          'amor',
          'ódio',
          'raiva',
          'feliz',
          'triste',
          'problema',
          'urgente',
          'importante',
        ];
        const hasEmotionalContent = emotionalWords.some((word) =>
          messageText.toLowerCase().includes(word)
        );
        if (hasEmotionalContent) {
          thinkingDelay += Math.random() * 3000 + 1000; // 1-4 segundos extras
        }
      }

      logger.info(`Tempo de reflexão: ${thinkingDelay.toFixed(0)}ms`);
      await delay(thinkingDelay);
    }

    // 3. MARCAR COMO VISTO
    await delay(300 + Math.random() * 200); // Delay natural antes de marcar como visto
    await sock.readMessages([
      {
        remoteJid: jid,
        id: message.id || crypto.randomBytes(10).toString('hex'),
      },
    ]);

    // 4. INICIAR DIGITAÇÃO
    await sock.sendPresenceUpdate('composing', jid);

    // 5. SIMULAÇÃO AVANÇADA DE DIGITAÇÃO
    let totalTypingTime = 0;

    if (naturalPauses && wordCount > 5) {
      // Simular digitação com pausas naturais
      const wordsPerChunk = Math.random() * 8 + 3; // 3-11 palavras por "rajada"
      const chunks = Math.ceil(wordCount / wordsPerChunk);

      for (let i = 0; i < chunks; i++) {
        // Tempo de digitação para este chunk
        const chunkWords = Math.min(
          wordsPerChunk,
          wordCount - i * wordsPerChunk
        );
        const chunkTypingTime = (chunkWords / typingSpeed) * 60000;

        // Adicionar variação natural (±30%)
        const variation = chunkTypingTime * 0.3;
        const actualChunkTime =
          chunkTypingTime + (Math.random() * variation * 2 - variation);

        totalTypingTime += actualChunkTime;

        // Simular digitação do chunk
        await delay(actualChunkTime);

        // Pausa entre chunks (exceto no último)
        if (i < chunks - 1) {
          // Pausas mais longas ocasionalmente (pensar em como continuar)
          const pauseDuration =
            Math.random() < 0.3
              ? Math.random() * 2000 + 1000 // Pausa longa (1-3s)
              : Math.random() * 800 + 200; // Pausa normal (0.2-1s)

          await delay(pauseDuration);
          totalTypingTime += pauseDuration;
        }
      }
    } else {
      // Digitação contínua para mensagens curtas
      const baseTypingTime = (wordCount / typingSpeed) * 60000;
      const variation = baseTypingTime * 0.25;
      totalTypingTime =
        baseTypingTime + (Math.random() * variation * 2 - variation);

      // Tempo mínimo e máximo
      totalTypingTime = Math.max(1000, Math.min(totalTypingTime, 15000));

      await delay(totalTypingTime);
    }

    // 6. SIMULAÇÃO DE ERROS DE DIGITAÇÃO (opcional)
    if (typoSimulation && Math.random() < 0.15 && messageLength > 20) {
      // 15% chance de "corrigir" algo durante digitação
      logger.info('Simulando correção de erro de digitação...');

      // Parar de digitar, pausar, continuar
      await sock.sendPresenceUpdate('paused', jid);
      await delay(500 + Math.random() * 1000); // Pausa para "perceber o erro"
      await sock.sendPresenceUpdate('composing', jid);
      await delay(800 + Math.random() * 1200); // Tempo para corrigir

      totalTypingTime += 2000;
    }

    // 7. FINALIZAÇÃO DA DIGITAÇÃO
    await sock.sendPresenceUpdate('paused', jid);

    // Pequena pausa antes de enviar (finalizar pensamento)
    const finalPause = Math.random() * 500 + 300;
    await delay(finalPause);

    // 8. ENVIAR MENSAGEM
    const messageOptions =
      typeof message === 'string' ? { text: message } : message;
    const sendOptions = {};
    if (options.quotedMessage) {
      sendOptions.quoted = options.quotedMessage;
    }

    const sentMessage = await sock.sendMessage(
      jid,
      messageOptions,
      sendOptions
    );

    // 9. VOLTAR ONLINE
    await delay(200 + Math.random() * 300);
    await sock.sendPresenceUpdate('available', jid);

    // Retornar estatísticas do comportamento
    return {
      sentMessage,
      behaviorStats: {
        readingTime: Math.round(readingTime),
        thinkingTime: Math.round(thinkingDelay),
        typingTime: Math.round(totalTypingTime),
        totalTime: Math.round(readingTime + thinkingDelay + totalTypingTime),
        wordCount,
        messageLength,
        chunksUsed:
          naturalPauses && wordCount > 5
            ? Math.ceil(wordCount / (Math.random() * 8 + 3))
            : 1,
        typoSimulated: typoSimulation && Math.random() < 0.15,
      },
    };
  } catch (error) {
    logger.error(
      `Erro ao enviar mensagem com comportamento avançado: ${error.message}`
    );
    throw error;
  }
}

app.post('/api/baileys/session/:sessionId/smart-reply', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      to,
      message,
      replyToMessage = null,
      readingSpeed = 150, // palavras por minuto
      typingSpeed = 40, // palavras por minuto
      thinkingTime = true,
      naturalPauses = true,
      typoSimulation = false,
      emotionalDelay = true,
      contextAwareness = true,
      quotedMessageId = null,
      // Parâmetros em português
      para,
      mensagem,
      mensagemResposta,
      velocidadeLeitura,
      velocidadeDigitacao,
      tempoReflexao,
      pausasNaturais,
      simularErros,
      delayEmocional,
      conscienciaContexto,
      idMensagemCitada,
    } = req.body;

    // Mapear parâmetros em português para inglês (priorizar português se fornecido)
    const finalTo = para || to;
    const finalMessage = mensagem || message;
    const finalReplyToMessage = mensagemResposta || replyToMessage;
    const finalReadingSpeed = velocidadeLeitura || readingSpeed;
    const finalTypingSpeed = velocidadeDigitacao || typingSpeed;
    const finalThinkingTime =
      tempoReflexao !== undefined ? tempoReflexao : thinkingTime;
    const finalNaturalPauses =
      pausasNaturais !== undefined ? pausasNaturais : naturalPauses;
    const finalTypoSimulation =
      simularErros !== undefined ? simularErros : typoSimulation;
    const finalEmotionalDelay =
      delayEmocional !== undefined ? delayEmocional : emotionalDelay;
    const finalContextAwareness =
      conscienciaContexto !== undefined
        ? conscienciaContexto
        : contextAwareness;
    const finalQuotedMessageId = idMensagemCitada || quotedMessageId;

    if (!finalTo || !finalMessage) {
      return res.status(400).json({
        success: false,
        message: 'Campos "to"/"para" e "message"/"mensagem" são obrigatórios',
      });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Sessão não encontrada ou não conectada',
      });
    }

    const jid = finalTo.includes('@') ? finalTo : `${finalTo}@s.whatsapp.net`;

    // Buscar mensagem citada se fornecida
    let quotedMessage = null;
    if (finalQuotedMessageId) {
      const originalMessage = getMessageById(sessionId, finalQuotedMessageId);
      if (originalMessage) {
        quotedMessage = originalMessage.message;
      }
    }

    // Preparar opções para comportamento humano avançado
    const behaviorOptions = {
      readingSpeed: finalReadingSpeed,
      typingSpeed: finalTypingSpeed,
      thinkingTime: finalThinkingTime,
      naturalPauses: finalNaturalPauses,
      typoSimulation: finalTypoSimulation,
      emotionalDelay: finalEmotionalDelay,
      contextAwareness: finalContextAwareness,
      replyToMessage: finalReplyToMessage,
      quotedMessage,
    };

    // Enviar com comportamento humano avançado
    const result = await sendMessageWithAdvancedHumanBehavior(
      session.sock,
      jid,
      { text: finalMessage },
      behaviorOptions
    );

    res.json({
      success: true,
      message: 'Resposta inteligente enviada com comportamento humano avançado',
      messageId: result.sentMessage.key.id,
      behaviorStats: result.behaviorStats,
      messageData: {
        para: jid,
        enviadoEm: new Date().toISOString(),
        tipoMensagem: 'texto',
        conteudo: finalMessage,
        idMensagemCitada: finalQuotedMessageId || null,
        status: 'enviado',
      },
      infoSessao: {
        sessionId,
        conectado: session.isConnected,
        usuario: session.sock.user,
      },
    });
  } catch (error) {
    logger.error(`Erro na resposta inteligente: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.delete('/api/baileys/session/:sessionId', checkSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    // Fechar conexão
    if (session.sock) {
      await session.sock.logout();
    }

    // Remover da memória
    sessions.delete(sessionId);
    sessionQueues.delete(sessionId);
    messageRateLimit.delete(sessionId);
    reconnectionAttempts.delete(sessionId);

    res.json({
      success: true,
      message: 'Sessão deletada com sucesso',
    });
  } catch (error) {
    logger.error(`Erro ao deletar sessão: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get('/api/baileys/info', (req, res) => {
  res.json({
    name: 'Baileys Multi-Session API',
    version: '1.0.0',
    description:
      'API avançada do WhatsApp com comportamento humano e multi-sessões',
    author: 'Desenvolvido com foco em segurança e prevenção de banimentos',
    features: [
      'Multi-sessões simultâneas',
      'Simulação de comportamento humano',
      'Rate limiting inteligente',
      'Download de todos os tipos de mídia',
      'Resposta em grupos e conversas privadas',
      'Prevenção de banimentos',
      'Reply por ID de mensagem',
      'Histórico de mensagens',
      'Recuperação automática de sessões',
      'Tratamento robusto de erros 401/515',
      'Documentação Swagger completa',
      'Sistema de webhooks em tempo real',
      'Respostas enriquecidas com metadados',
      'Download de mídia funcional',
      'Código limpo sem imports desnecessários',
    ],
    activeSessions: sessions.size,
    endpoints: {
      // Gerenciamento de Sessões
      'POST /api/baileys/session/create': 'Criar nova sessão',
      'GET /api/baileys/session/:id/status': 'Status da sessão',
      'GET /api/baileys/sessions': 'Listar todas as sessões',
      'DELETE /api/baileys/session/:id': 'Deletar sessão',

      // QR Code
      'GET /api/baileys/session/:id/qr': 'Obter QR Code (JSON)',
      'GET /api/baileys/session/:id/qr-image': 'Obter QR Code (Imagem PNG)',
      'POST /api/baileys/session/:id/regenerate-qr': 'Regenerar QR Code',

      // Envio de Mensagens
      'POST /api/baileys/session/:id/send-message': 'Enviar mensagem de texto',
      'POST /api/baileys/session/:id/send-media':
        'Enviar mídia (imagem/vídeo/áudio/documento)',
      'POST /api/baileys/session/:id/reply-message': 'Responder mensagem por ID',
      'POST /api/baileys/session/:id/smart-reply':
        'Resposta inteligente com comportamento humano',

      // Controles de Chat
      'POST /api/baileys/session/:id/typing': 'Controlar status de digitação',
      'POST /api/baileys/session/:id/mark-read': 'Marcar mensagem como lida',

      // Histórico e Mídia
      'GET /api/baileys/session/:id/messages': 'Listar mensagens armazenadas',
      'POST /api/baileys/session/:id/download-media': 'Baixar mídia das mensagens',

      // Webhooks (Legado)
      'POST /api/baileys/session/:id/webhook': 'Configurar webhook principal (legado)',
      'GET /api/baileys/session/:id/webhook': 'Obter webhook principal (legado)',
      'DELETE /api/baileys/session/:id/webhook': 'Remover webhook principal (legado)',

      // Webhooks (Múltiplos - Sistema Avançado)
      'GET /api/baileys/session/:id/webhooks': 'Listar todos os webhooks (máx 3)',
      'POST /api/baileys/session/:id/webhooks': 'Adicionar novo webhook',
      'GET /api/baileys/session/:id/webhooks/:webhookId': 'Obter webhook específico',
      'PUT /api/baileys/session/:id/webhooks/:webhookId': 'Atualizar webhook',
      'DELETE /api/baileys/session/:id/webhooks/:webhookId': 'Remover webhook específico',
      'PATCH /api/baileys/session/:id/webhooks/:webhookId/toggle': 'Ativar/desativar webhook',
      'POST /api/baileys/session/:id/webhooks/:webhookId/test': 'Testar webhook',

      // Grupos
      'POST /api/baileys/groups/:sessionId/create': 'Criar novo grupo',
      'GET /api/baileys/groups/:sessionId/:groupId/info': 'Obter informações do grupo',
      'POST /api/baileys/groups/:sessionId/:groupId/add-participants': 'Adicionar participantes',
      'POST /api/baileys/groups/:sessionId/:groupId/remove-participants': 'Remover participantes',
      'POST /api/baileys/groups/:sessionId/:groupId/promote': 'Promover participantes a admin',
      'POST /api/baileys/groups/:sessionId/:groupId/demote': 'Despromover admins',
      'PUT /api/baileys/groups/:sessionId/:groupId/subject': 'Atualizar nome do grupo',
      'PUT /api/baileys/groups/:sessionId/:groupId/description': 'Atualizar descrição do grupo',
      'PUT /api/baileys/groups/:sessionId/:groupId/settings': 'Configurar permissões do grupo',
      'POST /api/baileys/groups/:sessionId/:groupId/leave': 'Sair do grupo',
      'GET /api/baileys/groups/:sessionId/list': 'Listar grupos',
      'GET /api/baileys/groups/:sessionId/:groupId/invite-code': 'Obter código de convite',
      'POST /api/baileys/groups/:sessionId/:groupId/revoke-invite': 'Revogar código de convite',

      // Informações
      'GET /api/baileys/info': 'Informações da API',
      'GET /': 'Redireciona para documentação Swagger',
    },
  });
});

// Usar rotas de grupos
app.use('/api/baileys/groups', groupsRouter);

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  logger.error(`Erro não tratado: ${error.message}`);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});

// Função de inicialização (chamada pelo main.js)
async function initializeApp() {
  // Criar diretórios necessários
  const dirs = ['./auth_sessions', './uploads', './downloads'];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  logger.info('Diretórios criados e API pronta para uso!');

  // Carregar sessões existentes após inicialização
  logger.info('Carregando sessões existentes...');
  await loadExistingSessions();
  
  // Limpar sessões órfãs (sem userId)
  logger.info('Limpando sessões órfãs...');
  await cleanupOrphanedSessions();
  
  // Setup MongoDB collections with proper indexes
  const db = database.getDb();
  if (db) {
    try {
      // Create TTL index for QR codes collection
      const qrCodes = db.collection('qr_codes');
      await qrCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      
      // Create index for webhooks collection
      const webhooksCollection = db.collection('webhooks');
      await webhooksCollection.createIndex({ sessionId: 1 });
      
      // Create indexes for messages collection
      const messagesCollection = db.collection('messages');
      await messagesCollection.createIndex({ sessionId: 1, timestamp: -1 });
      await messagesCollection.createIndex({ sessionId: 1, messageId: 1 }, { unique: true });
      await messagesCollection.createIndex({ userId: 1 });
      
      // Create indexes for groups collection
      const groupsCollection = db.collection('groups');
      await groupsCollection.createIndex({ sessionId: 1, jid: 1 }, { unique: true });
      await groupsCollection.createIndex({ sessionId: 1 });
      await groupsCollection.createIndex({ jid: 1 });
      
      logger.info('MongoDB indexes created successfully');
    } catch (error) {
      logger.warn(`Failed to create MongoDB indexes: ${error.message}`);
    }
  }
  
  // Initial cleanup of expired QR codes
  logger.info('Limpando QR codes expirados...');
  await cleanupExpiredQRCodes();
  
  // Setup periodic cleanup of expired QR codes (every 10 minutes)
  setInterval(async () => {
    try {
      await cleanupExpiredQRCodes();
    } catch (error) {
      logger.error(`Erro na limpeza automática de QR codes: ${error.message}`);
    }
  }, 10 * 60 * 1000); // 10 minutes
  
  logger.info('Carregamento de sessões concluído!');
}

// Limpeza ao fechar aplicação
process.on('SIGINT', async () => {
  logger.info('Fechando aplicação...');

  // Fechar todas as sessões
  for (const [sessionId, session] of sessions) {
    try {
      if (session.sock) {
        await session.sock.logout();
      }
    } catch (error) {
      logger.error(`Erro ao fechar sessão ${sessionId}: ${error.message}`);
    }
  }

  process.exit(0);
});

// Disponibilizar função de criação de sessão globalmente
global.createWhatsAppSession = createWhatsAppSession;

module.exports = { app, getSessions, initializeApp, createWhatsAppSession, getEnrichedSessionData };
