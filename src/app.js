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
const { swaggerSpec, swaggerUiOptions, generateOpenAPIFile } = require('./config/swagger');
const QRCode = require('qrcode');
const crypto = require('crypto');
const database = require('./config/database');
const apiTokenAuth = require('./middleware/apiTokenAuth');

// Helper function to create unique session ID for each user
function createUniqueSessionId(userId, sessionId) {
  return `${userId}_${sessionId}`;
}

// Helper function to extract original session ID from unique session ID
function extractOriginalSessionId(uniqueSessionId) {
  const parts = uniqueSessionId.split('_');
  return parts.slice(1).join('_'); // Handle case where sessionId itself contains underscores
}

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

// Servir arquivos de download estaticamente
app.use('/downloads', express.static(path.join(process.cwd(), 'downloads')));

// Apply API token authentication to all /api/baileys routes EXCEPT download routes
app.use('/api/baileys', (req, res, next) => {
  // Permitir download direto sem autenticação
  if (req.path.startsWith('/download/')) {
    logger.info(`🔓 Download público acessado: ${req.path} - IP: ${req.ip}`);
    return next();
  }
  // Aplicar autenticação para outras rotas
  return apiTokenAuth(req, res, next);
});

// Rota para download do OpenAPI JSON (caminho diferente para evitar conflito)
app.get('/openapi.json', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="openapi.json"');
    res.json(swaggerSpec);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao gerar arquivo OpenAPI',
      error: error.message 
    });
  }
});

// Documentação Swagger - middleware genérico
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    ...swaggerUiOptions,
    customCss: `
      ${swaggerUiOptions.customCss}
      .topbar-wrapper .download-contents {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .download-btn {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .download-btn:hover {
        background: #2563eb;
        color: white;
        text-decoration: none;
      }
    `,
    customJsStr: `
      window.onload = function() {
        // Esperar o Swagger UI carregar completamente
        setTimeout(function() {
          // Procurar pela topbar
          let topbar = document.querySelector('.topbar-wrapper .topbar');
          if (!topbar) {
            topbar = document.querySelector('.topbar');
          }
          
          if (topbar) {
            // Criar container para downloads
            const downloadContainer = document.createElement('div');
            downloadContainer.className = 'download-contents';
            downloadContainer.innerHTML = \`
              <a href="/openapi.json" class="download-btn" download="openapi.json">
                📥 Download JSON
              </a>
            \`;
            
            // Adicionar à topbar
            topbar.appendChild(downloadContainer);
          } else {
            // Fallback: adicionar após a descrição
            setTimeout(function() {
              const infoSection = document.querySelector('.info');
              if (infoSection) {
                const downloadDiv = document.createElement('div');
                downloadDiv.style.marginTop = '20px';
                downloadDiv.style.padding = '15px';
                downloadDiv.style.backgroundColor = '#f8f9fa';
                downloadDiv.style.borderRadius = '8px';
                downloadDiv.style.border = '1px solid #e9ecef';
                downloadDiv.innerHTML = \`
                  <h4 style="margin-bottom: 10px; color: #495057;">📥 Downloads</h4>
                  <a href="/openapi.json" class="download-btn" download="openapi.json">
                    Download OpenAPI JSON
                  </a>
                \`;
                infoSection.appendChild(downloadDiv);
              }
            }, 500);
          }
        }, 1000);
      };
    `
  })
);

// Rota raiz redireciona para documentação

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
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    },
  }),
});

// Armazenar sessões ativas
const sessions = new Map();
const sessionQueues = new Map(); // Filas de mensagens para cada sessão
const messageRateLimit = new Map(); // Rate limiting por sessão
const reconnectionAttempts = new Map(); // Controle de tentativas de reconexão
const messageStore = new Map(); // Armazenamento de mensagens para reply por ID
const webhooks = new Map(); // Múltiplos webhooks por sessão (máximo 3)
const messageParts = new Map(); // Buffer para mensagens picotadas por chat
const messageTimers = new Map(); // Timers para processar mensagens completas

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
      qrCodeImage: sessionData.qrCodeImage || null,
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
    logger.error(
      `Error enriching session data for ${sessionId}: ${error.message}`
    );
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
      qrCodeImage: sessionData.qrCodeImage || null,
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
      message: 'Usuário não autenticado',
    });
  }

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'sessionId é obrigatório',
    });
  }

  if (!isUserSessionOwner(sessionId, userId)) {
    return res.status(403).json({
      success: false,
      message:
        'Acesso negado: você não possui permissão para acessar esta sessão',
    });
  }

  next();
}

// Funções utilitárias para gerenciar webhooks
function getSessionWebhooks(sessionId) {
  // Legacy function - still used for memory fallback
  const sessionWebhooks = webhooks.get(sessionId) || [];
  logger.info(
    `Getting webhooks for session ${sessionId} from memory: found ${sessionWebhooks.length} webhooks`
  );
  return sessionWebhooks;
}

// New async function to get webhooks from MongoDB
async function getSessionWebhooksFromDB(sessionId) {
  try {
    const db = database.getDb();
    if (!db) {
      logger.warn('Database not available, falling back to memory webhooks');
      return getSessionWebhooks(sessionId);
    }

    const webhooksCollection = db.collection('webhooks');

    // Extract userId from session if available, or use the session directly for now
    // Since we don't have user context here, we'll search by sessionId only
    const sessionWebhooks = await webhooksCollection
      .find({
        sessionId: sessionId,
        active: true,
      })
      .sort({ priority: 1, createdAt: 1 })
      .toArray();

    // Convert MongoDB _id to id for compatibility
    const webhooks = sessionWebhooks.map((webhook) => ({
      ...webhook,
      id: webhook.id || webhook._id.toString(),
    }));

    logger.info(
      `Getting webhooks for session ${sessionId} from MongoDB: found ${webhooks.length} webhooks`
    );
    return webhooks;
  } catch (error) {
    logger.error(
      `Error getting webhooks from DB for session ${sessionId}: ${error.message}`
    );
    // Fallback to memory webhooks on error
    return getSessionWebhooks(sessionId);
  }
}

function addWebhookToSession(sessionId, webhookData, userId = null) {
  const sessionWebhooks = getSessionWebhooks(sessionId);

  // Validar limite máximo de 3 webhooks
  if (sessionWebhooks.length >= 3) {
    throw new Error('Máximo de 3 webhooks permitidos por sessão');
  }

  // Validar se o nome já existe
  if (sessionWebhooks.some((w) => w.name === webhookData.name)) {
    throw new Error('Nome do webhook já existe nesta sessão');
  }

  const newWebhook = {
    id: crypto.randomUUID(),
    userId: userId,
    sessionId: sessionId,
    name: webhookData.name || `Webhook ${sessionWebhooks.length + 1}`,
    url: webhookData.url,
    active: webhookData.active !== false, // true por padrão
    createdAt: new Date(),
    updatedAt: new Date(),
    priority: webhookData.priority || sessionWebhooks.length + 1,
    events: webhookData.events || ['*'], // eventos para escutar, '*' = todos
  };

  sessionWebhooks.push(newWebhook);
  webhooks.set(sessionId, sessionWebhooks);

  // Save to MongoDB
  saveWebhookData(sessionId, newWebhook, userId);

  return newWebhook;
}

function removeWebhookFromSession(sessionId, webhookId, userId = null) {
  const sessionWebhooks = getSessionWebhooks(sessionId);
  const webhookIndex = sessionWebhooks.findIndex((w) => w.id === webhookId);

  if (webhookIndex === -1) {
    throw new Error('Webhook não encontrado');
  }

  const removedWebhook = sessionWebhooks.splice(webhookIndex, 1)[0];
  webhooks.set(sessionId, sessionWebhooks);

  // Save to MongoDB
  if (sessionWebhooks.length > 0) {
    saveWebhookData(sessionId, sessionWebhooks, userId);
  } else {
    deleteWebhookData(sessionId, userId);
  }

  return removedWebhook;
}

function updateWebhookInSession(
  sessionId,
  webhookId,
  updateData,
  userId = null
) {
  const sessionWebhooks = getSessionWebhooks(sessionId);
  const webhook = sessionWebhooks.find((w) => w.id === webhookId);

  if (!webhook) {
    throw new Error('Webhook não encontrado');
  }

  // Validar se o novo nome já existe (se está sendo alterado)
  if (updateData.name && updateData.name !== webhook.name) {
    if (
      sessionWebhooks.some(
        (w) => w.name === updateData.name && w.id !== webhookId
      )
    ) {
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
  saveWebhookData(sessionId, sessionWebhooks, userId);

  return webhook;
}

function getActiveWebhooks(sessionId, eventType = null) {
  // Legacy function - still used for memory fallback
  const sessionWebhooks = getSessionWebhooks(sessionId);
  logger.info(
    `Session ${sessionId} has ${sessionWebhooks.length} total webhooks (memory)`
  );

  const activeWebhooks = sessionWebhooks
    .filter((w) => w.active)
    .filter(
      (w) =>
        !eventType || w.events.includes('*') || w.events.includes(eventType)
    )
    .sort((a, b) => a.priority - b.priority);

  logger.info(
    `Session ${sessionId} has ${activeWebhooks.length} active webhooks for event ${eventType} (memory)`
  );

  return activeWebhooks;
}

// New async function to get active webhooks from MongoDB
async function getActiveWebhooksFromDB(sessionId, eventType = null) {
  const sessionWebhooks = await getSessionWebhooksFromDB(sessionId);
  logger.info(
    `Session ${sessionId} has ${sessionWebhooks.length} total webhooks (DB)`
  );

  const activeWebhooks = sessionWebhooks
    .filter((w) => w.active)
    .filter(
      (w) =>
        !eventType || w.events.includes('*') || w.events.includes(eventType)
    )
    .sort((a, b) => a.priority - b.priority);

  logger.info(
    `Session ${sessionId} has ${activeWebhooks.length} active webhooks for event ${eventType} (DB)`
  );

  return activeWebhooks;
}

// Importar rotas de grupos
const groupsRouter = require('./api/groups');

// Importar novas APIs para coleta e resumo de mensagens
const {
  router: messageCollectorRouter,
  integrateWithMainApp,
} = require('./api/messageCollector');
const aiSummaryRouter = require('./api/aiSummary');

// Importar rotas de agentes de IA
const { router: aiAgentsRouter } = require('./routes/aiAgents');

// Configurações de comportamento humano
const HUMAN_BEHAVIOR = {
  MIN_TYPING_TIME: 1000, // Tempo mínimo digitando (1s)
  MAX_TYPING_TIME: 8000, // Tempo máximo digitando (8s)
  TYPING_SPEED: 50, // Caracteres por segundo (humano médio)
  MIN_DELAY_BETWEEN_MESSAGES: 2000, // Delay mínimo entre mensagens (2s)
  MAX_DELAY_BETWEEN_MESSAGES: 5000, // Delay máximo entre mensagens (5s)
  MAX_MESSAGES_PER_MINUTE: 10, // Máximo 10 mensagens por minuto
  SEEN_DELAY: 500, // Delay antes de marcar como visto (0.5s)
  AUTO_MARK_READ: process.env.AUTO_MARK_READ === 'true', // false por padrão, true apenas se definido como 'true'
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

    // Check for active AI agent for this session (only mark as read if agent is active)
    const { getAgentFromDatabase, findAgentBySessionId } = require('./routes/aiAgents');

    // Get active agent with auto-reply enabled from database
    let activeAgent = await findAgentBySessionId(sessionId, true);
    
    // Additional check for autoReply setting
    if (activeAgent && !activeAgent.autoReply) {
      activeAgent = null;
    }

    // 1. Marcar como visto primeiro (simula usuário lendo) - apenas se agente ativo e configurado
    if (activeAgent && HUMAN_BEHAVIOR.AUTO_MARK_READ) {
      await delay(HUMAN_BEHAVIOR.SEEN_DELAY);
      await sock.readMessages([
        {
          remoteJid: jid,
          id: message.id || crypto.randomBytes(10).toString('hex'),
        },
      ]);
    }

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
              updatedAt: new Date(),
            },
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
          isActive: true,
        },
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
      expiresAt: { $gt: new Date() },
    });

    if (qrData) {
      logger.info(`QR Code loaded from MongoDB for session ${sessionId}`);
      return {
        qrCode: qrData.qrCode,
        qrCodeImage: qrData.qrCodeImage,
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
      expiresAt: { $lt: new Date() },
    });
    if (result.deletedCount > 0) {
      logger.info(`Cleaned up ${result.deletedCount} expired QR codes`);
    }
  } catch (error) {
    logger.warn(`Failed to cleanup expired QR codes: ${error.message}`);
  }
}

// Function to save webhook configuration to MongoDB
async function saveWebhookData(sessionId, webhookData, userId = null) {
  const db = database.getDb();
  if (!db) return;

  try {
    const webhooksCollection = db.collection('webhooks');

    // If webhookData is a single webhook object, save it as individual document
    if (webhookData.id) {
      await webhooksCollection.insertOne({
        ...webhookData,
        userId: userId,
        sessionId: sessionId,
        createdAt: webhookData.createdAt || new Date(),
        updatedAt: new Date(),
      });
      logger.info(
        `Individual webhook saved to MongoDB for session ${sessionId}`
      );
    } else {
      // Legacy support: save as array (deprecated)
      await webhooksCollection.updateOne(
        { sessionId },
        {
          $set: {
            sessionId,
            userId: userId,
            webhooks: webhookData,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      logger.info(
        `Webhook configuration saved to MongoDB for session ${sessionId}`
      );
    }
  } catch (error) {
    logger.warn(
      `Failed to save webhook configuration to MongoDB: ${error.message}`
    );
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
      logger.info(
        `Webhook configuration loaded from MongoDB for session ${sessionId}`
      );
      return webhookDoc.webhooks;
    }

    return null;
  } catch (error) {
    logger.warn(
      `Failed to load webhook configuration from MongoDB: ${error.message}`
    );
    return null;
  }
}

// Function to delete webhook configuration from MongoDB
async function deleteWebhookData(sessionId, userId = null) {
  const db = database.getDb();
  if (!db) return;

  try {
    const webhooksCollection = db.collection('webhooks');
    // Delete both legacy format (single doc with webhooks array) and new format (individual docs)
    if (userId) {
      await webhooksCollection.deleteMany({ sessionId, userId });
    } else {
      await webhooksCollection.deleteMany({ sessionId });
    }
    logger.info(
      `Webhook configuration deleted from MongoDB for session ${sessionId}`
    );
  } catch (error) {
    logger.warn(
      `Failed to delete webhook configuration from MongoDB: ${error.message}`
    );
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
      createdAt: new Date(),
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
      lastUpdated: new Date(),
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

    return messages.map((msg) => ({
      messageId: msg.messageId,
      jid: msg.jid,
      timestamp: msg.timestamp,
      isFromMe: msg.isFromMe,
      messageText: msg.messageText,
      messageType: msg.messageType,
      chatInfo: msg.chatInfo || null, // Include saved group/contact info
      message: msg.message, // Full message object for compatibility
    }));
  } catch (error) {
    logger.warn(`Failed to load messages from MongoDB: ${error.message}`);
    return [];
  }
}

// Helper function to extract message text
function extractMessageText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    message.message?.documentMessage?.caption ||
    '[Media]'
  );
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
            const existingSession = await db
              .collection('whatsapp_sessions')
              .findOne({ sessionId });
            if (existingSession && existingSession.userId) {
              userId = existingSession.userId;
              logger.info(
                `Recuperando sessão ${sessionId} para usuário ${userId}...`
              );
            }
          } catch (dbError) {
            logger.warn(
              `Erro ao buscar userId no MongoDB para sessão ${sessionId}: ${dbError.message}`
            );
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
                logger.info(
                  `QR Code recovered from MongoDB for session ${sessionId}`
                );
              }
            }

            // Try to recover webhook configuration from MongoDB
            const webhookData = await loadWebhookData(sessionId);
            if (webhookData) {
              webhooks.set(sessionId, webhookData);
              logger.info(
                `Webhook configuration recovered from MongoDB for session ${sessionId}: ${JSON.stringify(
                  webhookData
                )}`
              );
            } else {
              logger.info(
                `No webhook configuration found in MongoDB for session ${sessionId}`
              );
            }
          } else {
            // Se não há dados salvos, mas existe diretório de auth, tentar criar sessão
            logger.info(
              `Criando nova sessão para diretório existente: ${sessionId}`
            );
            await createWhatsAppSession(sessionId, userId);
          }
        } else {
          logger.warn(
            `Skipping recovery of session ${sessionId} - no userId found in database. Session will need to be recreated by user.`
          );
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
    const orphanedSessions = await db
      .collection('whatsapp_sessions')
      .find({
        userId: null,
      })
      .toArray();

    if (orphanedSessions.length > 0) {
      logger.info(
        `Encontradas ${orphanedSessions.length} sessões órfãs (sem userId)`
      );

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
    saveMessageToMongoDB(sessionId, messageId, messageData).catch((error) => {
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
    // Validate jid parameter
    if (!jid || typeof jid !== 'string') {
      logger.warn(`getContactOrGroupInfo chamado com jid inválido: ${jid}`);
      return {
        type: 'unknown',
        name: 'ID inválido',
        number: 'unknown',
        exists: false,
        isRegistered: false,
      };
    }

    if (jid.endsWith('@g.us')) {
      // É um grupo - buscar metadados do grupo
      try {
        const groupMetadata = await sock.groupMetadata(jid);

        // Get admin list
        const admins = groupMetadata.participants
          ? groupMetadata.participants
              .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
              .map((p) => p.id)
          : [];

        // Get super admins
        const superAdmins = groupMetadata.participants
          ? groupMetadata.participants
              .filter((p) => p.admin === 'superadmin')
              .map((p) => p.id)
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
          groupInviteCode: null, // We'll try to get this separately if needed
        };
      } catch (error) {
        logger.warn(
          `Erro ao buscar metadados do grupo ${jid}: ${error.message}`
        );
        return {
          type: 'group',
          jid: jid,
          name: `Grupo ${jid.includes('@') ? jid.split('@')[0] : jid}`,
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
          groupInviteCode: null,
        };
      }
    } else if (jid.endsWith('@s.whatsapp.net')) {
      // É um contato individual - buscar nome
      try {
        // Tentar buscar nome do contato na agenda
        const contactInfo = await sock.onWhatsApp(
          jid.includes('@') ? jid.split('@')[0] : jid
        );
        if (contactInfo && contactInfo.length > 0) {
          return {
            type: 'contact',
            name:
              contactInfo[0].name ||
              contactInfo[0].notify ||
              (jid.includes('@') ? jid.split('@')[0] : jid),
            number: jid.includes('@') ? jid.split('@')[0] : jid,
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
        name: jid.includes('@') ? jid.split('@')[0] : jid,
        number: jid.includes('@') ? jid.split('@')[0] : jid,
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
    // Define supported events
    const supportedEvents = [
      'messages.upsert',
      'messages.update', 
      'messages.delete',
      'group-participants.update'
    ];
    
    if (!supportedEvents.includes(eventType)) {
      logger.debug(`Skipping webhook for unsupported event type: ${eventType}`);
      return;
    }

    logger.info(
      `Attempting to send webhook for session ${sessionId}, event: ${eventType}`
    );

    // Obter webhooks ativos para este evento
    const activeWebhooks = await getActiveWebhooksFromDB(sessionId, eventType);
    logger.info(
      `Found ${activeWebhooks.length} active webhooks for session ${sessionId}, event: ${eventType}`
    );

    if (activeWebhooks.length === 0) {
      logger.warn(
        `No active webhooks found for session ${sessionId}, event: ${eventType}`
      );
      return;
    }

    // Filtrar mensagens de tipo não suportado para evitar spam de webhooks
    if (eventType === 'messages.upsert' && data) {
      // Lista de critérios para filtrar mensagens não suportadas
      const isUnsupportedMessage =
        data.messageType === 'unknown' ||
        data.content === 'Tipo de mensagem não suportado' ||
        (data.messageType === null &&
          data.content === 'Tipo de mensagem não suportado') ||
        // Filtrar mensagens vazias ou malformadas
        (!data.messageType &&
          !data.content &&
          !data.mediaData &&
          !data.mediaDownload);

      if (isUnsupportedMessage) {
        logger.info(
          `🚫 Mensagem filtrada (tipo não suportado) - Session: ${sessionId}, Type: ${
            data.messageType || 'null'
          }, Content: "${data.content || 'empty'}"`
        );
        return;
      }
    }

    // Enriquecer dados com informações de contato/grupo se disponível
    let enrichedData = { ...data };

    if (data.chat?.id && eventType === 'messages.upsert') {
      const session = sessions.get(sessionId);
      if (session && session.sock) {
        try {
          const chatInfo = await getContactOrGroupInfo(
            data.chat.id,
            session.sock
          );

          // Enhanced chat information organization
          enrichedData.chat = {
            ...enrichedData.chat,
            name: chatInfo.name,
            type: chatInfo.type,
            isGroup: chatInfo.type === 'group',
          };

          // Add group-specific information
          if (chatInfo.type === 'group') {
            enrichedData.chat.group = {
              name: chatInfo.name,
              description: chatInfo.description,
              participantCount: chatInfo.participantCount,
              isAnnounce: chatInfo.isAnnounce,
              isRestrict: chatInfo.isRestrict,
              createdAt: chatInfo.createdAt,
              admins: chatInfo.admins || [],
              superAdmins: chatInfo.superAdmins || [],
            };
          } else {
            // Add private chat information
            enrichedData.chat.contact = {
              name: chatInfo.name,
              number: data.chat?.id ? data.chat.id.split('@')[0] : 'unknown',
              isRegistered: chatInfo.isRegistered,
            };
          }

          // Enhanced participant information for group messages
          if (
            chatInfo.type === 'group' &&
            data.sender.id &&
            !data.sender.isMe
          ) {
            try {
              const participantInfo = await getContactOrGroupInfo(
                data.sender.id,
                session.sock
              );

              enrichedData.sender = {
                ...enrichedData.sender,
                name: participantInfo.name,
                number: data.sender?.id
                  ? data.sender.id.split('@')[0]
                  : 'unknown',
                isRegistered: participantInfo.isRegistered,
              };
            } catch (error) {
              logger.warn(
                `Erro ao buscar info do participante ${data.sender.id}: ${error.message}`
              );

              enrichedData.sender = {
                ...enrichedData.sender,
                name: data.sender?.id
                  ? data.sender.id.split('@')[0]
                  : 'unknown',
                number: data.sender?.id
                  ? data.sender.id.split('@')[0]
                  : 'unknown',
              };
            }
          } else if (chatInfo.type === 'private') {
            // For private messages, enhance sender info
            enrichedData.sender = {
              ...enrichedData.sender,
              name: chatInfo.name,
              number: data.chat?.id ? data.chat.id.split('@')[0] : 'unknown',
              isRegistered: chatInfo.isRegistered,
            };
          }
        } catch (error) {
          logger.warn(`Erro ao enriquecer dados do webhook: ${error.message}`);
        }
      }
    }

    // Create organized payload structure
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
            priority: webhook.priority,
          },
        };

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Baileys-API-Webhook/1.0.0',
            'X-Webhook-ID': webhook.id,
            'X-Webhook-Name': webhook.name,
            'X-Webhook-Priority': webhook.priority.toString(),
          },
          body: JSON.stringify(webhookPayload),
          timeout: 15000, // 15 segundos timeout
        });

        if (!response.ok) {
          logger.warn(
            `Webhook ${webhook.name} (${webhook.id}) failed for session ${sessionId}: ${response.status} ${response.statusText}`
          );
          return {
            success: false,
            webhook: webhook.id,
            error: `${response.status} ${response.statusText}`,
          };
        } else {
          logger.info(
            `Webhook ${webhook.name} sent successfully for session ${sessionId}`
          );
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

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const totalCount = activeWebhooks.length;

    if (successCount > 0) {
      logger.info(
        `Webhooks sent: ${successCount}/${totalCount} successful for session ${sessionId} event ${eventType}`
      );
    } else {
      logger.warn(
        `All webhooks failed for session ${sessionId} event ${eventType}`
      );
    }
  } catch (error) {
    logger.error(
      `Error in sendWebhook for session ${sessionId}: ${error.message}`
    );
  }
}

// Coleção MongoDB para armazenar metadados dos arquivos baixados
const DOWNLOADS_COLLECTION = 'downloaded_files';

// Função para criar índices do MongoDB para downloads
async function createDownloadIndexes() {
  try {
    const db = database.getDb();
    if (!db) {
      logger.warn('MongoDB não disponível - índices de download não criados');
      return;
    }

    const collection = db.collection(DOWNLOADS_COLLECTION);

    // Índices para melhorar performance
    await collection.createIndex({ downloadId: 1 }, { unique: true });
    await collection.createIndex({ sessionId: 1 });
    await collection.createIndex({ expiresAt: 1 });
    await collection.createIndex({ messageId: 1 });
    await collection.createIndex({ createdAt: -1 });

    logger.info('📊 Índices MongoDB criados para downloads');
  } catch (error) {
    logger.warn(
      `Erro ao criar índices MongoDB para downloads: ${error.message}`
    );
  }
}

// Executar criação de índices após inicialização
setTimeout(createDownloadIndexes, 5000); // 5 segundos após startup

// Log sobre a migração para MongoDB
logger.info(
  '🔄 Sistema de downloads migrado para MongoDB - metadados persistidos permanentemente'
);

// Funções para gerenciar downloads no MongoDB
async function saveDownloadMetadata(downloadMetadata) {
  try {
    const db = database.getDb();
    if (!db) {
      logger.warn(
        'MongoDB não disponível - metadados de download não persistidos'
      );
      return false;
    }

    await db.collection(DOWNLOADS_COLLECTION).insertOne({
      ...downloadMetadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.debug(
      `💾 Metadados salvos no MongoDB: ${downloadMetadata.downloadId}`
    );
    return true;
  } catch (error) {
    logger.error(`Erro ao salvar metadados de download: ${error.message}`);
    return false;
  }
}

async function getDownloadMetadata(downloadId) {
  try {
    const db = database.getDb();
    if (!db) {
      logger.warn('MongoDB não disponível - usando fallback em memória');
      return null;
    }

    const metadata = await db.collection(DOWNLOADS_COLLECTION).findOne({
      downloadId: downloadId,
    });

    return metadata;
  } catch (error) {
    logger.error(`Erro ao buscar metadados de download: ${error.message}`);
    return null;
  }
}

async function deleteDownloadMetadata(downloadId) {
  try {
    const db = database.getDb();
    if (!db) {
      logger.warn(
        'MongoDB não disponível - não foi possível remover metadados'
      );
      return false;
    }

    const result = await db.collection(DOWNLOADS_COLLECTION).deleteOne({
      downloadId: downloadId,
    });

    return result.deletedCount > 0;
  } catch (error) {
    logger.error(`Erro ao remover metadados de download: ${error.message}`);
    return false;
  }
}

async function getExpiredDownloads() {
  try {
    const db = database.getDb();
    if (!db) {
      return [];
    }

    const now = new Date();
    const expiredDownloads = await db
      .collection(DOWNLOADS_COLLECTION)
      .find({
        expiresAt: { $lt: now },
      })
      .toArray();

    return expiredDownloads;
  } catch (error) {
    logger.error(`Erro ao buscar downloads expirados: ${error.message}`);
    return [];
  }
}

async function getAllDownloads(sessionId = null) {
  try {
    const db = database.getDb();
    if (!db) {
      return [];
    }

    const query = sessionId ? { sessionId } : {};
    const downloads = await db
      .collection(DOWNLOADS_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return downloads;
  } catch (error) {
    logger.error(`Erro ao listar downloads: ${error.message}`);
    return [];
  }
}

// Função para limpar arquivos expirados (executa a cada 6 horas)
async function cleanupExpiredFiles() {
  const fs = require('fs');
  let cleanedCount = 0;

  try {
    // Buscar downloads expirados no MongoDB
    const expiredDownloads = await getExpiredDownloads();

    for (const metadata of expiredDownloads) {
      try {
        // Remover arquivo do disco
        if (fs.existsSync(metadata.filePath)) {
          fs.unlinkSync(metadata.filePath);
          cleanedCount++;
        }

        // Remover metadados do MongoDB
        await deleteDownloadMetadata(metadata.downloadId);
      } catch (error) {
        logger.warn(
          `Erro ao remover arquivo expirado ${metadata.downloadId}: ${error.message}`
        );
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        `🧹 Limpeza automática: ${cleanedCount} arquivos expirados removidos do disco e MongoDB`
      );
    } else {
      logger.debug(`🧹 Limpeza automática: nenhum arquivo expirado encontrado`);
    }
  } catch (error) {
    logger.error(`Erro na limpeza automática: ${error.message}`);
  }
}

// Executar limpeza automática a cada 6 horas
setInterval(cleanupExpiredFiles, 6 * 60 * 60 * 1000); // 6 horas em millisegundos

// Executar limpeza inicial após 1 minuto do startup
setTimeout(cleanupExpiredFiles, 60 * 1000);

// Função para gerar ID único para download
function generateDownloadId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${random}`;
}

// Função para obter extensão do arquivo baseada no mimetype e tipo de mensagem
function getFileExtension(mimetype, messageType = null, isPtt = false) {
  const mimeToExt = {
    // Imagens
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',

    // Vídeos
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/3gpp': '3gp',
    'video/x-ms-wmv': 'wmv',

    // Áudios comuns
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/flac': 'flac',
    'audio/x-m4a': 'm4a',

    // Áudios específicos do WhatsApp
    'audio/mp4; codecs=opus': 'opus',
    'audio/ogg; codecs=opus': 'opus',
    'audio/webm; codecs=opus': 'opus',

    // Documentos
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/xml': 'xml',
    'text/xml': 'xml',

    // Arquivos comprimidos
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
  };

  // Tratamento especial para mensagens de voz (PTT)
  if (isPtt || messageType === 'audio') {
    // WhatsApp geralmente usa Opus para mensagens de voz
    if (
      !mimetype ||
      mimetype.includes('application/octet-stream') ||
      mimetype === 'application/ogg'
    ) {
      return 'ogg'; // Formato padrão para mensagens de voz do WhatsApp
    }
    if (mimetype.includes('opus')) {
      return 'opus';
    }
    if (mimetype.includes('ogg')) {
      return 'ogg';
    }
    if (mimetype.includes('mp4') || mimetype.includes('m4a')) {
      return 'm4a';
    }
    if (mimetype.includes('webm')) {
      return 'webm';
    }
    // Fallback para áudio não identificado
    return 'ogg';
  }

  // Tratamento para mimetypes mal formatados ou incompletos
  if (mimetype) {
    // Verificar se contém palavras-chave conhecidas
    const lowerMime = mimetype.toLowerCase();

    if (lowerMime.includes('image')) {
      if (lowerMime.includes('jpeg') || lowerMime.includes('jpg')) return 'jpg';
      if (lowerMime.includes('png')) return 'png';
      if (lowerMime.includes('gif')) return 'gif';
      if (lowerMime.includes('webp')) return 'webp';
      return 'jpg'; // fallback para imagens
    }

    if (lowerMime.includes('video')) {
      if (lowerMime.includes('mp4')) return 'mp4';
      if (lowerMime.includes('webm')) return 'webm';
      if (lowerMime.includes('quicktime') || lowerMime.includes('mov'))
        return 'mov';
      return 'mp4'; // fallback para vídeos
    }

    if (lowerMime.includes('audio')) {
      if (lowerMime.includes('mpeg') || lowerMime.includes('mp3')) return 'mp3';
      if (lowerMime.includes('mp4') || lowerMime.includes('m4a')) return 'm4a';
      if (lowerMime.includes('ogg')) return 'ogg';
      if (lowerMime.includes('opus')) return 'opus';
      if (lowerMime.includes('wav')) return 'wav';
      return 'mp3'; // fallback para áudios
    }
  }

  // Busca exata no mapeamento
  const exactMatch = mimeToExt[mimetype];
  if (exactMatch) {
    return exactMatch;
  }

  // Fallback baseado no tipo de mensagem
  if (messageType === 'image') return 'jpg';
  if (messageType === 'video') return 'mp4';
  if (messageType === 'audio') return 'ogg';
  if (messageType === 'document') return 'pdf';
  if (messageType === 'sticker') return 'webp';

  return 'bin';
}

// Função para baixar mídia e salvar no disco com link único
async function downloadMediaToFile(sock, message, sessionId) {
  try {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB para arquivos salvos no disco
    const fs = require('fs');
    const path = require('path');

    logger.info(
      `🔍 Iniciando download de mídia para sessão ${sessionId}, mensagem ${message.key.id}`
    );

    // Verificar tamanho do arquivo e extrair metadados antes de baixar
    let fileLength = 0;
    let mimetype = '';
    let originalFileName = '';
    let messageType = '';
    let isPtt = false;

    if (message.message.imageMessage) {
      fileLength = message.message.imageMessage.fileLength;
      mimetype = message.message.imageMessage.mimetype;
      messageType = 'image';
    } else if (message.message.videoMessage) {
      fileLength = message.message.videoMessage.fileLength;
      mimetype = message.message.videoMessage.mimetype;
      messageType = 'video';
    } else if (message.message.audioMessage) {
      fileLength = message.message.audioMessage.fileLength;
      mimetype = message.message.audioMessage.mimetype;
      messageType = 'audio';
      isPtt = message.message.audioMessage.ptt || false;

      // Log para debug de mensagens de voz
      logger.info(
        `🎤 Áudio detectado - PTT: ${isPtt}, Mimetype: ${
          mimetype || 'undefined'
        }, Tamanho: ${fileLength}`
      );
    } else if (message.message.documentMessage) {
      fileLength = message.message.documentMessage.fileLength;
      mimetype = message.message.documentMessage.mimetype;
      originalFileName = message.message.documentMessage.fileName;
      messageType = 'document';
    } else if (message.message.stickerMessage) {
      fileLength = message.message.stickerMessage.fileLength || 0;
      mimetype = message.message.stickerMessage.mimetype || 'image/webp';
      messageType = 'sticker';
    }

    // Verificar se conseguiu identificar o tipo de mídia
    if (!messageType) {
      logger.warn('Tipo de mídia não identificado na mensagem');
      return {
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Tipo de mídia não suportado ou não identificado',
      };
    }

    // Se arquivo é maior que 50MB, não baixar
    if (fileLength > MAX_FILE_SIZE) {
      logger.warn(
        `Arquivo muito grande (${(fileLength / (1024 * 1024)).toFixed(
          2
        )}MB), não será baixado`
      );
      return {
        error: 'FILE_TOO_LARGE',
        message: `Arquivo de ${(fileLength / (1024 * 1024)).toFixed(
          2
        )}MB excede o limite de 50MB`,
        fileSize: fileLength,
      };
    }

    // Baixar o arquivo
    logger.info(
      `📥 Fazendo download do ${messageType} (${(fileLength / 1024).toFixed(
        2
      )}KB)`
    );
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: () => sock.updateMediaMessage,
      }
    );

    if (!buffer || buffer.length === 0) {
      logger.warn(`⚠️  Buffer de mídia vazio ou inválido para ${messageType}`);
      return {
        error: 'EMPTY_BUFFER',
        message: 'Arquivo de mídia vazio ou corrompido',
      };
    }

    logger.info(
      `✅ Buffer de ${messageType} baixado com sucesso (${buffer.length} bytes)`
    );

    // Gerar ID único e nome do arquivo com detecção inteligente de extensão
    const downloadId = generateDownloadId();
    const fileExtension = getFileExtension(mimetype, messageType, isPtt);

    // Gerar nome de arquivo mais descritivo baseado no tipo
    let fileName;
    if (originalFileName) {
      // Usar nome original do documento
      fileName = originalFileName;
    } else if (isPtt) {
      // Mensagem de voz
      fileName = `voice_${downloadId}.${fileExtension}`;
    } else if (messageType === 'audio') {
      // Áudio regular
      fileName = `audio_${downloadId}.${fileExtension}`;
    } else {
      // Outros tipos de mídia
      fileName = `${messageType}_${downloadId}.${fileExtension}`;
    }

    const safeFileName = `${downloadId}_${fileName.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )}`;

    // Log para debug de arquivos de voz
    if (isPtt || messageType === 'audio') {
      logger.info(
        `📁 Arquivo de áudio: ${fileName} (${fileExtension}) - PTT: ${isPtt}`
      );
    }

    // Criar diretório se não existir
    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Caminho completo do arquivo
    const filePath = path.join(downloadsDir, safeFileName);

    // Salvar arquivo no disco
    fs.writeFileSync(filePath, buffer);

    // Obter URL base do servidor
    const baseUrl =
      process.env.CORS_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;
    const serverUrl = baseUrl.replace('5173', process.env.PORT || '3000'); // Replace frontend port with backend port

    // Gerar link único de download
    const downloadUrl = `${serverUrl}/api/baileys/download/${downloadId}`;

    // Preparar metadados do arquivo para salvar no MongoDB
    const fileMetadata = {
      downloadId,
      originalFileName: fileName,
      safeFileName,
      filePath,
      mimetype,
      size: buffer.length,
      downloadUrl,
      sessionId,
      messageId: message.key.id,
      messageType,
      isPtt: isPtt || false,
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    };

    // Salvar metadados no MongoDB
    const saveSuccess = await saveDownloadMetadata(fileMetadata);
    if (!saveSuccess) {
      logger.warn(
        `⚠️  Metadados de download não persistidos no MongoDB para ${downloadId}`
      );
    }

    logger.info(
      `📥 Mídia salva: ${fileName} (${(buffer.length / 1024).toFixed(2)}KB)`
    );
    logger.info(`🔗 Link direto de download: ${downloadUrl}`);

    // Para compatibilidade, também retornar base64 se for menor que 3MB
    let base64Data = null;
    if (buffer.length <= 3 * 1024 * 1024) {
      base64Data = buffer.toString('base64');
    }

    return {
      success: true,
      downloadId,
      downloadUrl,
      fileName: originalFileName || fileName,
      mimetype,
      size: buffer.length,
      sizeFormatted: `${(buffer.length / 1024).toFixed(2)}KB`,
      base64: base64Data,
      expiresAt: fileMetadata.expiresAt,
    };
  } catch (error) {
    logger.error(`Erro ao baixar mídia: ${error.message}`);
    return {
      error: 'DOWNLOAD_FAILED',
      message: error.message,
    };
  }
}

// Função legacy para compatibilidade - baixar mídia e converter para base64 (máximo 3MB)
async function downloadMediaAsBase64(sock, message) {
  const downloadResult = await downloadMediaToFile(sock, message, 'legacy');

  if (downloadResult.success && downloadResult.base64) {
    return {
      success: true,
      base64: downloadResult.base64,
      size: downloadResult.size,
      sizeFormatted: downloadResult.sizeFormatted,
    };
  } else if (downloadResult.success) {
    // Se arquivo foi baixado mas é muito grande para base64
    return {
      error: 'FILE_TOO_LARGE_FOR_BASE64',
      message:
        'Arquivo baixado mas muito grande para base64 (>3MB). Use downloadUrl.',
      downloadUrl: downloadResult.downloadUrl,
      size: downloadResult.size,
      sizeFormatted: downloadResult.sizeFormatted,
    };
  } else {
    return downloadResult;
  }
}

// Função para extrair dados completos da mensagem (agora com mídia em base64)
async function extractMessageData(message, sock = null) {
  const isGroup = message.key.remoteJid?.endsWith('@g.us') || false;

  const messageData = {
    messageId: message.key.id,
    timestamp: message.messageTimestamp,
    messageType: null,
    content: null,
    quotedMessage: null,
    mediaData: null,
    mediaDownload: null,

    // Chat info structure
    chat: {
      id: message.key.remoteJid,
      type: isGroup ? 'group' : 'private',
      isGroup: isGroup,
    },

    // Sender info structure
    sender: {
      id: isGroup ? message.key.participant : message.key.remoteJid,
      pushName: message.pushName,
      isMe: message.key.fromMe,
    },

    // Enhanced message metadata
    metadata: {
      fromMe: message.key.fromMe || false,
      status: message.status || null,
      broadcast: message.broadcast || false,
      messageStubType: message.messageStubType || null,
      messageStubParameters: message.messageStubParameters || null,
      ephemeral: null,
      forwarded: false,
      starred: false,
      mentions: [],
      urls: [],
      deviceType: null,
      userAgent: null,
      edited: false,
      messageContextInfo: null,
      caption: null,
      mediaDetails: null,
      locationData: null,
      contactData: null,
      contactsData: null,
      unknownData: null
    }
  };

  // Helper function to extract URLs from text
  const extractUrls = (text) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Helper function to extract mentions from text and contextInfo
  const extractMentions = (text, contextInfo = null) => {
    const mentions = [];
    if (text) {
      const mentionRegex = /@(\d+)/g;
      let match;
      while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[1] + '@s.whatsapp.net');
      }
    }
    if (contextInfo && contextInfo.mentionedJid) {
      mentions.push(...contextInfo.mentionedJid);
    }
    return [...new Set(mentions)];
  };

  // Helper function to check if message is forwarded
  const checkForwarded = (contextInfo) => {
    return !!(contextInfo && (contextInfo.forwardingScore > 0 || contextInfo.isForwarded));
  };

  // Helper function to extract detailed media information
  const extractMediaDetails = (mediaMsg, mediaType) => {
    const details = {
      fileLength: mediaMsg.fileLength || null,
      mimetype: mediaMsg.mimetype || null,
      fileSha256: mediaMsg.fileSha256 ? mediaMsg.fileSha256.toString('base64') : null,
      fileEncSha256: mediaMsg.fileEncSha256 ? mediaMsg.fileEncSha256.toString('base64') : null,
      mediaKey: mediaMsg.mediaKey ? mediaMsg.mediaKey.toString('base64') : null,
      directPath: mediaMsg.directPath || null,
      url: mediaMsg.url || null,
      width: mediaMsg.width || null,
      height: mediaMsg.height || null,
      duration: mediaMsg.seconds || null
    };
    
    // Type-specific fields
    if (mediaType === 'audio') {
      details.ptt = mediaMsg.ptt || false;
      details.waveform = mediaMsg.waveform ? Array.from(mediaMsg.waveform) : null;
    } else if (mediaType === 'document') {
      details.fileName = mediaMsg.fileName || null;
      details.title = mediaMsg.title || null;
      details.pageCount = mediaMsg.pageCount || null;
    } else if (mediaType === 'sticker') {
      details.isAnimated = mediaMsg.isAnimated || false;
    }
    
    return details;
  };

  // Helper function to extract quoted message from contextInfo (based on official Baileys WAProto)
  const extractQuotedMessage = (contextInfo) => {
    if (!contextInfo?.quotedMessage || !contextInfo.stanzaId) return null;

    const quoted = contextInfo.quotedMessage;
    let quotedContent = '';
    let quotedType = 'unknown';
    let quotedMediaData = null;

    // Text messages
    if (quoted.conversation) {
      quotedContent = quoted.conversation;
      quotedType = 'text';
    } else if (quoted.extendedTextMessage) {
      quotedContent = quoted.extendedTextMessage.text;
      quotedType = 'text';
    }
    // Media messages with captions
    else if (quoted.imageMessage) {
      quotedContent = quoted.imageMessage.caption || '';
      quotedType = 'image';
      quotedMediaData = {
        mimetype: quoted.imageMessage.mimetype,
        width: quoted.imageMessage.width,
        height: quoted.imageMessage.height,
        fileLength: quoted.imageMessage.fileLength,
      };
    } else if (quoted.videoMessage) {
      quotedContent = quoted.videoMessage.caption || '';
      quotedType = 'video';
      quotedMediaData = {
        mimetype: quoted.videoMessage.mimetype,
        width: quoted.videoMessage.width,
        height: quoted.videoMessage.height,
        seconds: quoted.videoMessage.seconds,
        fileLength: quoted.videoMessage.fileLength,
      };
    } else if (quoted.audioMessage) {
      quotedContent = '';
      quotedType = 'audio';
      quotedMediaData = {
        mimetype: quoted.audioMessage.mimetype,
        seconds: quoted.audioMessage.seconds,
        ptt: quoted.audioMessage.ptt || false,
        fileLength: quoted.audioMessage.fileLength,
      };
    } else if (quoted.documentMessage) {
      quotedContent = quoted.documentMessage.caption || '';
      quotedType = 'document';
      quotedMediaData = {
        mimetype: quoted.documentMessage.mimetype,
        fileName: quoted.documentMessage.fileName,
        title: quoted.documentMessage.title,
        fileLength: quoted.documentMessage.fileLength,
      };
    } else if (quoted.stickerMessage) {
      quotedContent = '';
      quotedType = 'sticker';
      quotedMediaData = {
        mimetype: quoted.stickerMessage.mimetype,
        width: quoted.stickerMessage.width,
        height: quoted.stickerMessage.height,
        fileLength: quoted.stickerMessage.fileLength,
      };
    }
    // Other message types
    else if (quoted.contactMessage) {
      quotedContent = quoted.contactMessage.displayName || '';
      quotedType = 'contact';
    } else if (quoted.locationMessage) {
      quotedContent = quoted.locationMessage.name || '';
      quotedType = 'location';
      quotedMediaData = {
        latitude: quoted.locationMessage.degreesLatitude,
        longitude: quoted.locationMessage.degreesLongitude,
        address: quoted.locationMessage.address,
      };
    } else if (quoted.liveLocationMessage) {
      quotedContent = quoted.liveLocationMessage.caption || '';
      quotedType = 'liveLocation';
      quotedMediaData = {
        latitude: quoted.liveLocationMessage.degreesLatitude,
        longitude: quoted.liveLocationMessage.degreesLongitude,
      };
    } else if (quoted.contactsArrayMessage) {
      quotedContent = `${
        quoted.contactsArrayMessage.contacts?.length || 0
      } contatos`;
      quotedType = 'contactsArray';
    }

    return {
      messageId: contextInfo.stanzaId,
      participant: contextInfo.participant,
      remoteJid: contextInfo.remoteJid,
      content: quotedContent,
      messageType: quotedType,
      mediaData: quotedMediaData,
      fromMe: contextInfo.participant === message.key.remoteJid,
      // Additional contextInfo fields that might be useful
      isForwarded: contextInfo.isForwarded || false,
      forwardingScore: contextInfo.forwardingScore || 0,
      mentions: contextInfo.mentionedJid || [],
    };
  };

  // Extrair conteúdo da mensagem
  if (message.message) {
    if (message.message.conversation) {
      messageData.messageType = 'text';
      messageData.content = message.message.conversation;
      
      // Extract URLs and mentions from simple text messages
      messageData.metadata.urls = extractUrls(messageData.content);
      messageData.metadata.mentions = extractMentions(messageData.content);
    } else if (message.message.extendedTextMessage) {
      messageData.messageType = 'text';
      messageData.content = message.message.extendedTextMessage.text;

      // Extract URLs and mentions
      messageData.metadata.urls = extractUrls(messageData.content);
      
      // Extract contextInfo metadata
      if (message.message.extendedTextMessage.contextInfo) {
        const contextInfo = message.message.extendedTextMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(messageData.content, contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }
    } else if (message.message.imageMessage) {
      messageData.messageType = 'image';
      messageData.content = message.message.imageMessage.caption || '';
      messageData.metadata.caption = message.message.imageMessage.caption || null;
      
      // Extract URLs from caption
      messageData.metadata.urls = extractUrls(messageData.content);
      
      // Enhanced media data
      messageData.mediaData = {
        mimetype: message.message.imageMessage.mimetype,
        fileSha256: message.message.imageMessage.fileSha256?.toString('base64'),
        fileLength: message.message.imageMessage.fileLength,
        width: message.message.imageMessage.width,
        height: message.message.imageMessage.height,
      };
      
      // Detailed media metadata
      messageData.metadata.mediaDetails = extractMediaDetails(message.message.imageMessage, 'image');

      // Extract contextInfo metadata
      if (message.message.imageMessage.contextInfo) {
        const contextInfo = message.message.imageMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(messageData.content, contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }

      // Baixar mídia automaticamente se sock foi fornecido
      if (sock) {
        const sessionId = global.whatsappSessions
          ? Object.keys(global.whatsappSessions).find(
              (id) => global.whatsappSessions[id] === sock
            ) || 'unknown'
          : 'unknown';
        messageData.mediaDownload = await downloadMediaToFile(
          sock,
          message,
          sessionId
        );
      }
    } else if (message.message.videoMessage) {
      messageData.messageType = 'video';
      messageData.content = message.message.videoMessage.caption || '';
      messageData.metadata.caption = message.message.videoMessage.caption || null;
      
      // Extract URLs from caption
      messageData.metadata.urls = extractUrls(messageData.content);
      
      messageData.mediaData = {
        mimetype: message.message.videoMessage.mimetype,
        fileSha256: message.message.videoMessage.fileSha256?.toString('base64'),
        fileLength: message.message.videoMessage.fileLength,
        width: message.message.videoMessage.width,
        height: message.message.videoMessage.height,
        seconds: message.message.videoMessage.seconds,
      };
      
      // Detailed media metadata
      messageData.metadata.mediaDetails = extractMediaDetails(message.message.videoMessage, 'video');

      // Extract contextInfo metadata
      if (message.message.videoMessage.contextInfo) {
        const contextInfo = message.message.videoMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(messageData.content, contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }

      // Baixar mídia automaticamente se sock foi fornecido
      if (sock) {
        const sessionId = global.whatsappSessions
          ? Object.keys(global.whatsappSessions).find(
              (id) => global.whatsappSessions[id] === sock
            ) || 'unknown'
          : 'unknown';
        messageData.mediaDownload = await downloadMediaToFile(
          sock,
          message,
          sessionId
        );
      }
    } else if (message.message.audioMessage) {
      messageData.messageType = 'audio';
      messageData.content = '';
      
      messageData.mediaData = {
        mimetype: message.message.audioMessage.mimetype,
        fileSha256: message.message.audioMessage.fileSha256?.toString('base64'),
        fileLength: message.message.audioMessage.fileLength,
        seconds: message.message.audioMessage.seconds,
        ptt: message.message.audioMessage.ptt || false,
      };
      
      // Detailed media metadata
      messageData.metadata.mediaDetails = extractMediaDetails(message.message.audioMessage, 'audio');

      // Extract contextInfo metadata
      if (message.message.audioMessage.contextInfo) {
        const contextInfo = message.message.audioMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }

      // Baixar mídia automaticamente se sock foi fornecido
      if (sock) {
        const sessionId = global.whatsappSessions
          ? Object.keys(global.whatsappSessions).find(
              (id) => global.whatsappSessions[id] === sock
            ) || 'unknown'
          : 'unknown';
        messageData.mediaDownload = await downloadMediaToFile(
          sock,
          message,
          sessionId
        );
      }
    } else if (message.message.documentMessage) {
      messageData.messageType = 'document';
      messageData.content = message.message.documentMessage.caption || '';
      messageData.metadata.caption = message.message.documentMessage.caption || null;
      
      // Extract URLs from caption
      messageData.metadata.urls = extractUrls(messageData.content);
      
      messageData.mediaData = {
        mimetype: message.message.documentMessage.mimetype,
        fileSha256:
          message.message.documentMessage.fileSha256?.toString('base64'),
        fileLength: message.message.documentMessage.fileLength,
        fileName: message.message.documentMessage.fileName,
        title: message.message.documentMessage.title,
      };
      
      // Detailed media metadata
      messageData.metadata.mediaDetails = extractMediaDetails(message.message.documentMessage, 'document');

      // Extract contextInfo metadata
      if (message.message.documentMessage.contextInfo) {
        const contextInfo = message.message.documentMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(messageData.content, contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }

      // Baixar mídia automaticamente se sock foi fornecido
      if (sock) {
        const sessionId = global.whatsappSessions
          ? Object.keys(global.whatsappSessions).find(
              (id) => global.whatsappSessions[id] === sock
            ) || 'unknown'
          : 'unknown';
        messageData.mediaDownload = await downloadMediaToFile(
          sock,
          message,
          sessionId
        );
      }
    } else if (message.message.stickerMessage) {
      messageData.messageType = 'sticker';
      messageData.content = '';
      
      messageData.mediaData = {
        mimetype: message.message.stickerMessage.mimetype,
        fileSha256:
          message.message.stickerMessage.fileSha256?.toString('base64'),
        fileLength: message.message.stickerMessage.fileLength,
        width: message.message.stickerMessage.width,
        height: message.message.stickerMessage.height,
      };
      
      // Detailed media metadata
      messageData.metadata.mediaDetails = extractMediaDetails(message.message.stickerMessage, 'sticker');

      // Extract contextInfo metadata
      if (message.message.stickerMessage.contextInfo) {
        const contextInfo = message.message.stickerMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }

      // Baixar mídia automaticamente se sock foi fornecido
      if (sock) {
        const sessionId = global.whatsappSessions
          ? Object.keys(global.whatsappSessions).find(
              (id) => global.whatsappSessions[id] === sock
            ) || 'unknown'
          : 'unknown';
        messageData.mediaDownload = await downloadMediaToFile(
          sock,
          message,
          sessionId
        );
      }
    } else if (message.message.contactMessage) {
      messageData.messageType = 'contact';
      messageData.content = {
        displayName: message.message.contactMessage.displayName,
        vcard: message.message.contactMessage.vcard,
      };
      
      // Store contact data in metadata
      messageData.metadata.contactData = messageData.content;

      // Extract contextInfo metadata
      if (message.message.contactMessage.contextInfo) {
        const contextInfo = message.message.contactMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }
    } else if (message.message.locationMessage) {
      messageData.messageType = 'location';
      messageData.content = {
        latitude: message.message.locationMessage.degreesLatitude,
        longitude: message.message.locationMessage.degreesLongitude,
        name: message.message.locationMessage.name,
        address: message.message.locationMessage.address,
      };
      
      // Store location data in metadata
      messageData.metadata.locationData = messageData.content;

      // Extract contextInfo metadata
      if (message.message.locationMessage.contextInfo) {
        const contextInfo = message.message.locationMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }
    } else if (message.message.liveLocationMessage) {
      messageData.messageType = 'liveLocation';
      messageData.content = {
        latitude: message.message.liveLocationMessage.degreesLatitude,
        longitude: message.message.liveLocationMessage.degreesLongitude,
        caption: message.message.liveLocationMessage.caption,
        sequenceNumber: message.message.liveLocationMessage.sequenceNumber,
      };
      
      // Store location data in metadata
      messageData.metadata.locationData = messageData.content;
      messageData.metadata.caption = message.message.liveLocationMessage.caption || null;
      
      // Extract URLs from caption
      messageData.metadata.urls = extractUrls(messageData.content.caption || '');

      // Extract contextInfo metadata
      if (message.message.liveLocationMessage.contextInfo) {
        const contextInfo = message.message.liveLocationMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(messageData.content.caption || '', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }
    } else if (message.message.contactsArrayMessage) {
      messageData.messageType = 'contactsArray';
      messageData.content = {
        displayName: message.message.contactsArrayMessage.displayName,
        contactsCount:
          message.message.contactsArrayMessage.contacts?.length || 0,
      };
      
      // Store contacts data in metadata
      messageData.metadata.contactsData = messageData.content;

      // Extract contextInfo metadata
      if (message.message.contactsArrayMessage.contextInfo) {
        const contextInfo = message.message.contactsArrayMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }
        
        // Extract quoted message if present
        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }
    } else if (message.message.protocolMessage) {
      // Filtrar mensagens de protocolo (como mensagens deletadas, etc.)
      logger.debug(
        `Mensagem de protocolo ignorada: ${message.message.protocolMessage.type}`
      );
      return null; // Retorna null para indicar que deve ser ignorada
    } else if (
      message.message.senderKeyDistributionMessage ||
      message.message.fastRatchetKeySenderKeyDistributionMessage
    ) {
      // Filtrar mensagens de distribuição de chave (protocolo interno)
      logger.debug('Mensagem de distribuição de chave ignorada');
      return null; // Retorna null para indicar que deve ser ignorada
    } else {
      // Log detalhado para debug de tipos não suportados
      const messageKeys = message.message ? Object.keys(message.message) : [];
      logger.warn(
        `Tipo de mensagem não suportado encontrado: ${messageKeys.join(
          ', '
        )} - MessageID: ${message.key?.id}`
      );

      messageData.messageType = 'unknown';
      messageData.content = 'Tipo de mensagem não suportado';
      messageData.metadata.unknownData = {
        availableKeys: messageKeys,
        rawMessage: message.message
      };
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

        // QR code generated - no webhook needed
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

        // Connection closed - no webhook needed

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

        // Connection established - no webhook needed
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

        // Debug: Log all webhooks in memory
        logger.info(
          `Current webhooks in memory: ${JSON.stringify(
            Array.from(webhooks.entries())
          )}`
        );

        // Enviar webhook apenas se messageData não for null (filtra mensagens de protocolo)
        if (messageData !== null) {
          await sendWebhook(sessionId, 'messages.upsert', messageData);
        } else {
          logger.debug(
            `Mensagem ignorada para webhook - SessionID: ${sessionId}, MessageID: ${message.key?.id}`
          );
        }

        // Hook para message collector - coletar mensagens de grupos
        if (global.messageCollectorHook && message) {
          global.messageCollectorHook(message, sessionId);
        }

        if (!message.key.fromMe && message.message) {
          // Processar mensagem recebida
          await handleMessageParts(sock, message, sessionId);
        }
      }
    });

    // Handler para atualizações de mensagens (status de entrega, edições, etc.)
    sock.ev.on('messages.update', async (messageUpdates) => {
      for (const update of messageUpdates) {
        logger.info(`Message update received for session ${sessionId}:`, update);
        
        const updateData = {
          messageKey: update.key,
          update: update.update || {},
          timestamp: Date.now(),
          sessionId: sessionId
        };
        
        await sendWebhook(sessionId, 'messages.update', updateData);
      }
    });

    // Handler para mensagens deletadas
    sock.ev.on('messages.delete', async (deleteEvent) => {
      logger.info(`Messages deleted for session ${sessionId}:`, deleteEvent);
      
      const deleteData = {
        ...deleteEvent,
        timestamp: Date.now(),
        sessionId: sessionId
      };
      
      await sendWebhook(sessionId, 'messages.delete', deleteData);
    });

    // Handler para mudanças de participantes em grupos
    sock.ev.on('group-participants.update', async (groupUpdate) => {
      logger.info(`Group participants update for session ${sessionId}:`, groupUpdate);
      
      const groupData = {
        groupId: groupUpdate.id,
        participants: groupUpdate.participants,
        action: groupUpdate.action, // add, remove, promote, demote
        author: groupUpdate.author,
        timestamp: Date.now(),
        sessionId: sessionId
      };
      
      await sendWebhook(sessionId, 'group-participants.update', groupData);
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
// Função para capturar mensagens múltiplas e processar com delay inteligente
async function handleMessageParts(sock, message, sessionId) {
  const jid = message.key.remoteJid;
  const messageText =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    '';

  if (!messageText.trim()) return;

  const chatKey = `${sessionId}_${jid}`;
  const senderId = message.key.participant || message.key.remoteJid;
  const senderKey = `${chatKey}_${senderId}`;

  // Inicializar buffer para este remetente específico se não existir
  if (!messageParts.has(senderKey)) {
    messageParts.set(senderKey, []);
  }

  // Adicionar mensagem ao buffer
  const messagePart = {
    text: messageText,
    timestamp: Date.now(),
    messageKey: message.key,
    pushName: message.pushName || 'Usuário',
    senderId: senderId,
  };

  const parts = messageParts.get(senderKey);
  parts.push(messagePart);

  // Limpar timer anterior se existir
  if (messageTimers.has(senderKey)) {
    clearTimeout(messageTimers.get(senderKey));
  }

  // Lógica inteligente para determinar tempo de espera
  let waitTime = 8000; // Base: 8 segundos

  // Se a mensagem termina com pontuação, pode ser final
  if (/[.!?:]$/.test(messageText.trim())) {
    waitTime = 5000; // 5 segundos se termina com pontuação
  }

  // Se a mensagem é muito curta, provavelmente há mais
  if (messageText.length < 20) {
    waitTime = 10000; // 10 segundos para mensagens curtas
  }

  // Se já há várias partes, aumentar tempo de espera
  if (parts.length > 3) {
    waitTime = 12000; // 12 segundos se já há muitas partes
  }

  // Se a mensagem termina com "..." pode ter continuação
  if (messageText.trim().endsWith('...')) {
    waitTime = 15000; // 15 segundos se termina com reticências
  }

  logger.info(
    `Mensagem ${parts.length} recebida de ${senderId}. Aguardando ${
      waitTime / 1000
    }s por mais mensagens...`
  );

  // Definir timer para processar mensagem completa
  const timer = setTimeout(async () => {
    const currentParts = messageParts.get(senderKey) || [];
    if (currentParts.length > 0) {
      // Combinar todas as partes em uma mensagem completa
      const fullText = currentParts.map((part) => part.text).join('\n'); // Usar quebra de linha para preservar separação
      const firstMessage = currentParts[0];
      const lastMessage = currentParts[currentParts.length - 1];

      // Criar objeto de mensagem completa usando a última mensagem como base
      const completeMessage = {
        key: lastMessage.messageKey, // Usar última mensagem para reply
        pushName: firstMessage.pushName,
        message: {
          conversation: fullText,
          extendedTextMessage: { text: fullText },
        },
      };

      logger.info(
        `Processando mensagem completa (${
          currentParts.length
        } partes) de ${senderId}: ${fullText.substring(0, 150)}...`
      );

      // Processar mensagem completa com todas as partes
      await processCompleteMessage(
        sock,
        completeMessage,
        sessionId,
        currentParts
      );

      // Limpar buffer
      messageParts.set(senderKey, []);
    }
    messageTimers.delete(senderKey);
  }, waitTime);

  messageTimers.set(senderKey, timer);
}

// Função robusta para verificar se é mensagem de grupo usando Baileys
function isMessageFromGroup(message) {
  const {
    isJidGroup,
    isJidBroadcast,
    isJidStatusBroadcast,
    isJidNewsletter,
  } = require('@whiskeysockets/baileys');

  const jid = message.key.remoteJid;
  const participant = message.key.participant;

  // Verificações usando funções oficiais da Baileys
  const isGroup = isJidGroup(jid);
  const isBroadcast = isJidBroadcast(jid);
  const isStatusBroadcast = isJidStatusBroadcast(jid);
  const isNewsletter = isJidNewsletter(jid);

  // Log detalhado para debug
  logger.debug(
    `Message analysis: jid=${jid}, participant=${participant}, isGroup=${isGroup}, isBroadcast=${isBroadcast}, isStatus=${isStatusBroadcast}, isNewsletter=${isNewsletter}`
  );

  // Retorna verdadeiro apenas para grupos reais (não broadcasts ou newsletters)
  return isGroup && !isBroadcast && !isStatusBroadcast && !isNewsletter;
}

async function processCompleteMessage(
  sock,
  message,
  sessionId,
  allMessageParts = []
) {
  try {
    const jid = message.key.remoteJid;
    const messageText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      '';

    // Simular delay de leitura humana
    await delay(500 + Math.random() * 1500);

    // Check for active AI agent for this session
    const { getAgentFromDatabase, findAgentBySessionId } = require('./routes/aiAgents');

    // First check memory, then try to load from database
    // Get active agent with auto-reply enabled from database
    let activeAgent = await findAgentBySessionId(sessionId, true);
    
    // Additional check for autoReply setting
    if (activeAgent && !activeAgent.autoReply) {
      activeAgent = null;
    }

    // Marcar como visto apenas se há agente ativo e configurado para auto-read
    if (activeAgent && HUMAN_BEHAVIOR.AUTO_MARK_READ) {
      // Se há múltiplas partes, marcar todas como lidas
      if (allMessageParts.length > 1) {
        const messageKeys = allMessageParts.map((part) => part.messageKey);
        logger.info(
          `Marcando ${messageKeys.length} mensagens da sequência como lidas...`
        );
        await sock.readMessages(messageKeys);
        logger.info(
          `✓ Todas as ${messageKeys.length} mensagens foram marcadas como lidas`
        );
      } else {
        // Apenas uma mensagem, marcar normalmente
        await sock.readMessages([message.key]);
        logger.info(`✓ Mensagem marcada como lida`);
      }
    }

    // Check if message is from a group using robust verification
    const isGroupMessage = isMessageFromGroup(message);

    // Process message only if agent exists and wants to reply to this type of chat
    if (activeAgent && messageText.trim()) {
      // Skip if this is a group message and agent doesn't want to reply to groups
      if (isGroupMessage && !activeAgent.replyToGroups) {
        logger.info(
          `🚫 Agent ${activeAgent.id} SKIPPING group message from ${jid} (replyToGroups: ${activeAgent.replyToGroups})`
        );
        logger.debug(
          `Group verification details: jid=${jid}, isGroup=${isGroupMessage}, agentReplyToGroups=${activeAgent.replyToGroups}`
        );
        return; // Exit early, don't process group messages when disabled
      }

      // Debug log for group message processing
      if (isGroupMessage) {
        logger.info(
          `✅ Agent ${activeAgent.id} PROCESSING group message from ${jid} (replyToGroups: ${activeAgent.replyToGroups})`
        );
      } else {
        logger.info(
          `✅ Agent ${activeAgent.id} PROCESSING private message from ${jid}`
        );
      }
      try {
        logger.info(
          `Processing message with AI agent ${activeAgent.id} for session ${sessionId}`
        );

        // Process message with AI agent
        const messageData = {
          content: messageText,
          text: messageText,
          body: messageText,
          messageId: message.key.id,
          timestamp: new Date().toISOString(),
          messageType: 'text',
          sender: {
            id: message.key.participant || message.key.remoteJid,
            pushName: message.pushName || 'Usuário',
            isMe: message.key.fromMe,
          },
          chat: {
            id: jid,
            isGroup: isGroupMessage,
            type: isGroupMessage ? 'group' : 'private',
            name: isGroupMessage ? 'Grupo' : 'Contato',
          },
          // Adicionar informações sobre mensagens múltiplas
          isMultiPart: allMessageParts.length > 1,
          partCount: allMessageParts.length,
          allMessageKeys: allMessageParts.map((part) => part.messageKey),
        };

        const aiResult = await activeAgent.processMessage(messageData, sock);

        if (
          aiResult &&
          aiResult.shouldReply &&
          aiResult.response &&
          aiResult.response.trim()
        ) {
          // Delay aleatório de 5-10 segundos antes da resposta
          const responseDelay = 5000 + Math.random() * 5000; // 5-10 segundos
          logger.info(
            `AI agent ${activeAgent.id} aguardando ${Math.round(
              responseDelay / 1000
            )}s antes de responder...`
          );
          await delay(responseDelay);

          // Simulate typing time based on response length
          const typingTime = Math.min(
            Math.max(
              aiResult.response.length * 50,
              HUMAN_BEHAVIOR.MIN_TYPING_TIME
            ),
            HUMAN_BEHAVIOR.MAX_TYPING_TIME
          );

          // Show typing indicator
          await sock.sendPresenceUpdate('composing', jid);
          await delay(typingTime);

          // Send AI response with quoted message (resposta à última mensagem da sequência)
          const quotedMessage = {
            key: message.key,
            message: message.message,
          };

          // Se há múltiplas partes, adicionar informação no log
          if (allMessageParts.length > 1) {
            logger.info(
              `Respondendo à sequência de ${allMessageParts.length} mensagens`
            );
          }

          await sock.sendMessage(
            jid,
            {
              text: aiResult.response,
            },
            {
              quoted: quotedMessage,
            }
          );

          // Update presence to available
          await sock.sendPresenceUpdate('available');

          logger.info(
            `AI agent ${
              activeAgent.id
            } responded to ${jid}: ${aiResult.response.substring(0, 100)}...`
          );
        }
      } catch (error) {
        logger.error(
          `Error processing message with AI agent: ${error.message}`
        );

        // Fallback to simple response on AI error with quoted message
        const fallbackResponse =
          'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
        const quotedMessage = {
          key: message.key,
          message: message.message,
        };

        // Marcar todas as mensagens como lidas mesmo em caso de erro
        if (
          activeAgent &&
          HUMAN_BEHAVIOR.AUTO_MARK_READ &&
          allMessageParts.length > 1
        ) {
          const messageKeys = allMessageParts.map((part) => part.messageKey);
          await sock.readMessages(messageKeys);
        }

        await sock.sendMessage(
          jid,
          { text: fallbackResponse },
          { quoted: quotedMessage }
        );
      }
    } else {
      // Original simple auto-reply logic (only if no AI agent is active)
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

// Dual authentication middleware for session creation
const dualAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // If Authorization header exists and starts with 'Bearer baileys_', use API token auth
  if (authHeader && authHeader.startsWith('Bearer baileys_')) {
    return apiTokenAuth(req, res, next);
  }

  // Otherwise, use web authentication (cookies/JWT)
  const { authenticateToken } = require('./middleware/auth');
  return authenticateToken(req, res, next);
};

app.post('/api/baileys/session/create', dualAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id || req.user?._id; // Get user ID from authentication middleware

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

    // Create unique session ID by combining user ID and session name
    const uniqueSessionId = `${userId}_${sessionId}`;

    const result = await createWhatsAppSession(uniqueSessionId, userId);

    // Sempre retornar o QR code quando criar uma nova sessão
    if (result.success) {
      // Aguardar um pouco se o QR code ainda não foi gerado
      let attempts = 0;
      const maxAttempts = 10; // 5 segundos no máximo

      while (!result.qrCode && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const session = sessions.get(uniqueSessionId);
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
          const session = sessions.get(uniqueSessionId);
          if (session) {
            session.qrCodeImage = result.qrCodeImage;
          }
        } catch (error) {
          logger.error(`Erro ao gerar QR code imagem: ${error.message}`);
        }
      }
    }

    // Return response with original sessionId for user, but internally use uniqueSessionId
    const response = {
      ...result,
      sessionId: sessionId, // Show original sessionId to user
      internalSessionId: uniqueSessionId, // For debugging purposes
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post(
  '/api/baileys/session/:sessionId/regenerate-qr',
  checkSessionOwnership,
  async (req, res) => {
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
  }
);

app.get(
  '/api/baileys/session/:sessionId/status',
  checkSessionOwnership,
  (req, res) => {
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
  }
);

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
      .filter(
        ([id, session]) =>
          session.userId && session.userId.toString() === userId.toString()
      )
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

app.post(
  '/api/baileys/session/:sessionId/send-message',
  checkSessionOwnership,
  async (req, res) => {
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
  }
);

app.post(
  '/api/baileys/session/:sessionId/send-media',
  checkSessionOwnership,
  upload.single('media'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { to, caption, filename, voiceMessage } = req.body;

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
      const isVoiceMessage = voiceMessage === 'true' || voiceMessage === true;
      const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);

      // Enviar status "gravando" se for mensagem de voz
      if (isAudio && isVoiceMessage) {
        try {
          await session.sock.sendPresenceUpdate('recording', jid);
          logger.info(`Status "gravando" enviado para ${jid}`);

          // Simular tempo de gravação mais longo (3-7 segundos)
          const recordingTime = Math.floor(Math.random() * 4000) + 3000;
          await delay(recordingTime);
        } catch (presenceError) {
          logger.warn(
            `Erro ao enviar status de gravação: ${presenceError.message}`
          );
          // Continuar mesmo se o status falhar
        }
      }

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
      } else if (isAudio) {
        messageContent = {
          audio: mediaBuffer,
          fileName: filename || req.file.originalname,
          mimetype: req.file.mimetype,
          ptt: isVoiceMessage, // ptt = Push to Talk (mensagem de voz)
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

      let captionMessageId = null;

      // Parar status de gravação após enviar (marcar como offline para não mostrar "digitando")
      if (isAudio && isVoiceMessage) {
        try {
          await session.sock.sendPresenceUpdate('unavailable', jid);
          logger.info(`Status "gravando" removido para ${jid}`);

          // Aguardar um pouco e depois voltar ao status disponível
          await delay(1000);
          await session.sock.sendPresenceUpdate('available', jid);
          logger.info(`Status voltou para "disponível" para ${jid}`);
        } catch (presenceError) {
          logger.warn(
            `Erro ao remover status de gravação: ${presenceError.message}`
          );
        }

        // Enviar caption como resposta à mensagem de voz se fornecida
        if (caption && caption.trim()) {
          try {
            // Aguardar um pouco para garantir que a mensagem foi entregue
            await delay(500);

            // Enviar caption como resposta à mensagem de voz
            const captionResult = await queueMessage(
              sessionId,
              session.sock,
              jid,
              {
                text: caption.trim(),
              },
              result // Referenciar a mensagem de voz completa
            );

            captionMessageId = captionResult.key.id;
            logger.info(
              `Caption enviada como resposta à mensagem de voz: ${captionMessageId}`
            );
          } catch (captionError) {
            logger.warn(
              `Erro ao enviar caption para mensagem de voz: ${captionError.message}`
            );
          }
        }
      }

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
            : isAudio
            ? isVoiceMessage
              ? 'voice'
              : 'audio'
            : 'document',
          fileName: filename || req.file.originalname,
          fileSize: req.file.size,
          mimetype: req.file.mimetype,
          caption: isAudio && isVoiceMessage && caption ? '' : caption || '', // Caption vazia para voice se será enviada como reply
          status: 'sent',
          presenceUpdated: isAudio && isVoiceMessage,
          captionSentAsReply:
            isAudio && isVoiceMessage && !!caption && !!captionMessageId,
          captionMessageId: captionMessageId,
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

// Rota para mencionar todos os participantes do grupo (silenciosamente)
app.post(
  '/api/baileys/session/:sessionId/mention-all',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { groupId, message, silentMode = true } = req.body;

      if (!groupId || !message) {
        return res.status(400).json({
          success: false,
          message: 'groupId e message são obrigatórios',
        });
      }

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }

      // Verificar se é um ID de grupo válido
      const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;

      try {
        // Obter metadados do grupo para listar participantes
        const groupMetadata = await session.sock.groupMetadata(jid);

        if (!groupMetadata || !groupMetadata.participants) {
          return res.status(404).json({
            success: false,
            message: 'Grupo não encontrado ou sem participantes',
          });
        }

        const participants = groupMetadata.participants;
        const participantIds = participants.map((p) => p.id);

        let result;

        if (silentMode) {
          // Modo silencioso: usar caracteres invisíveis para mencionar sem @ azuis
          // Adiciona Zero Width Space (U+200B) e caracteres invisíveis para bypass das notificações
          const zeroWidthSpace = '\u200B'; // Unicode Zero Width Space
          const invisibleChar = '\u2800'; // Unicode U+2800 (mais compatível com WhatsApp)
          const zwjoiner = '\u200D'; // Zero Width Joiner

          // Criar menções invisíveis usando caracteres zero-width
          const messageWithInvisibleMentions =
            message + zeroWidthSpace + invisibleChar + zwjoiner;

          result = await queueMessage(sessionId, session.sock, jid, {
            text: messageWithInvisibleMentions,
            mentions: participantIds, // Menciona todos mas com caracteres invisíveis
          });
        } else {
          // Modo com menções visíveis: enviar com @ azul para todos os participantes
          result = await queueMessage(sessionId, session.sock, jid, {
            text: message,
            mentions: participantIds,
          });
        }

        res.json({
          success: true,
          message: silentMode
            ? 'Mensagem enviada para o grupo (modo silencioso)'
            : 'Mensagem enviada mencionando todos os participantes',
          messageId: result.key.id,
          groupInfo: {
            id: jid,
            name: groupMetadata.subject,
            participantCount: participants.length,
            silentMode: silentMode,
          },
          messageData: {
            to: jid,
            sentAt: new Date().toISOString(),
            messageType: 'text',
            content: message,
            participantsReached: participants.length, // Todos do grupo recebem a mensagem
            participantsMentioned: participants.length, // Em ambos os modos todos são mencionados
            mentionType: silentMode ? 'invisible_mentions' : 'visible_mentions',
            invisibleCharacters: silentMode
              ? ['U+200B', 'U+2800', 'U+200D']
              : null,
            status: 'sent',
          },
          sessionInfo: {
            sessionId,
            isConnected: session.isConnected,
            user: session.sock.user,
          },
        });
      } catch (groupError) {
        logger.error(`Erro ao obter dados do grupo: ${groupError.message}`);
        res.status(400).json({
          success: false,
          message:
            'Erro ao acessar dados do grupo. Verifique se o bot faz parte do grupo.',
          error: groupError.message,
        });
      }
    } catch (error) {
      logger.error(`Erro ao mencionar todos: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

app.post(
  '/api/baileys/session/:sessionId/download-media',
  checkSessionOwnership,
  async (req, res) => {
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
        filename =
          message.message.documentMessage.fileName || `${filename}.bin`;
      } else if (message.message.stickerMessage) {
        filename += '.webp';
      }

      // Baixar a mídia
      const downloadResult = await downloadMedia(
        session.sock,
        message,
        filename
      );

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
  }
);

// Rota para servir arquivos de mídia baixados via link único
app.get('/api/baileys/download/:downloadId', async (req, res) => {
  try {
    const { downloadId } = req.params;
    const fs = require('fs');
    const path = require('path');

    // Buscar metadados no MongoDB
    const fileMetadata = await getDownloadMetadata(downloadId);
    if (!fileMetadata) {
      // Retornar erro simples para browsers
      return res.status(404).send('Arquivo não encontrado ou link expirado');
    }

    // Verificar se o arquivo não expirou (7 dias)
    const now = new Date();
    const expiresAt = new Date(fileMetadata.expiresAt);
    if (now > expiresAt) {
      // Remover arquivo expirado do MongoDB e do disco
      await deleteDownloadMetadata(downloadId);
      try {
        if (fs.existsSync(fileMetadata.filePath)) {
          fs.unlinkSync(fileMetadata.filePath);
        }
      } catch (cleanupError) {
        logger.warn(`Erro ao limpar arquivo expirado: ${cleanupError.message}`);
      }

      return res.status(410).send('Link de download expirado');
    }

    // Verificar se o arquivo ainda existe no disco
    if (!fs.existsSync(fileMetadata.filePath)) {
      await deleteDownloadMetadata(downloadId);
      return res.status(404).send('Arquivo não encontrado no servidor');
    }

    // Configurar headers apropriados para download direto
    res.setHeader(
      'Content-Type',
      fileMetadata.mimetype || 'application/octet-stream'
    );
    res.setHeader('Content-Length', fileMetadata.size);

    // Escapar nome do arquivo para Content-Disposition (suporte UTF-8)
    const cleanFileName = fileMetadata.originalFileName.replace(
      /[^\w\s.-]/g,
      '_'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodeURIComponent(
        cleanFileName
      )}`
    );

    // Headers de segurança e controle de cache
    res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Accept-Ranges', 'bytes');

    // Headers informativos
    res.setHeader('X-Download-ID', downloadId);
    res.setHeader('X-File-Name', fileMetadata.originalFileName);
    res.setHeader('X-Session-ID', fileMetadata.sessionId);
    res.setHeader(
      'X-File-Type',
      fileMetadata.originalFileName.includes('voice_')
        ? 'voice-message'
        : 'media'
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Header para melhor compatibilidade com downloads
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition,X-File-Name,X-File-Type'
    );

    // Enviar arquivo
    const fileStream = fs.createReadStream(fileMetadata.filePath);

    fileStream.on('error', (error) => {
      logger.error(
        `Erro ao transmitir arquivo ${downloadId}: ${error.message}`
      );
      if (!res.headersSent) {
        res.status(500).send('Erro ao transmitir arquivo');
      }
    });

    fileStream.pipe(res);

    // Log do download
    logger.info(
      `Arquivo baixado: ${fileMetadata.originalFileName} (${downloadId}) por IP: ${req.ip}`
    );
  } catch (error) {
    logger.error(`Erro na rota de download: ${error.message}`);
    res.status(500).send('Erro interno do servidor');
  }
});

// Rota para listar downloads disponíveis (opcional, para debug)
app.get('/api/baileys/downloads', async (req, res) => {
  try {
    const sessionId = req.query.sessionId; // Opcional: filtrar por sessão
    const allDownloads = await getAllDownloads(sessionId);
    const now = new Date();

    const downloads = allDownloads.map((metadata) => {
      const isExpired = now > new Date(metadata.expiresAt);
      return {
        downloadId: metadata.downloadId,
        fileName: metadata.originalFileName,
        size: metadata.size,
        sizeFormatted: `${(metadata.size / 1024).toFixed(2)}KB`,
        mimetype: metadata.mimetype,
        messageType: metadata.messageType,
        isPtt: metadata.isPtt,
        sessionId: metadata.sessionId,
        messageId: metadata.messageId,
        uploadedAt: metadata.uploadedAt,
        expiresAt: metadata.expiresAt,
        isExpired,
        downloadUrl: isExpired ? null : metadata.downloadUrl,
      };
    });

    res.json({
      success: true,
      downloads,
      total: downloads.length,
      active: downloads.filter((d) => !d.isExpired).length,
      expired: downloads.filter((d) => d.isExpired).length,
      sessionFilter: sessionId || null,
    });
  } catch (error) {
    logger.error(`Erro ao listar downloads: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

app.post(
  '/api/baileys/session/:sessionId/mark-read',
  checkSessionOwnership,
  async (req, res) => {
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
  }
);

app.post(
  '/api/baileys/session/:sessionId/typing',
  checkSessionOwnership,
  async (req, res) => {
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
  }
);

app.post(
  '/api/baileys/session/:sessionId/reply-message',
  checkSessionOwnership,
  async (req, res) => {
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
  }
);

app.get(
  '/api/baileys/session/:sessionId/messages',
  checkSessionOwnership,
  async (req, res) => {
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
          const mongoMessages = await loadMessagesFromMongoDB(
            sessionId,
            parseInt(limit),
            parseInt(offset)
          );
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
              sessionId,
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
            sessionId,
          });
        }

        // Convert Map to Array and apply pagination
        const messageEntries = Array.from(sessionMessages.entries());
        const totalInMemory = messageEntries.length;
        const paginatedEntries = messageEntries.slice(
          -parseInt(limit) - parseInt(offset),
          messageEntries.length - parseInt(offset)
        );

        // Get contact info for unique JIDs (only if session is connected)
        const contactInfoCache = new Map();
        if (session.isConnected && session.sock) {
          const uniqueJids = [
            ...new Set(paginatedEntries.map(([id, data]) => data.jid)),
          ];

          for (const jid of uniqueJids) {
            try {
              const contactInfo = await getContactOrGroupInfo(
                jid,
                session.sock
              );
              contactInfoCache.set(jid, contactInfo);
            } catch (error) {
              logger.warn(
                `Failed to get contact info for ${jid}: ${error.message}`
              );
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
            pushName: message.pushName || null,
          };

          // Add participant info if it's a group
          if (
            contactInfo &&
            contactInfo.type === 'group' &&
            message.key.participant
          ) {
            messageInfo.participant = {
              jid: message.key.participant,
              number:
                message.key.participant && message.key.participant.includes('@')
                  ? message.key.participant.split('@')[0]
                  : message.key.participant || 'unknown',
              pushName: message.pushName || null,
            };
          }

          // Check if it's a reply
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
              fromMe: contextInfo.participant === message.key.remoteJid,
            };
          }

          return messageInfo;
        });

        return res.json({
          success: true,
          messages: messages.reverse(), // Most recent first
          total: totalInMemory,
          source: 'memory',
          sessionId,
        });
      }

      // If no messages found in either source
      res.json({
        success: true,
        messages: [],
        total: 0,
        source: 'none',
        sessionId,
      });
    } catch (error) {
      logger.error(`Erro ao listar mensagens: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

app.post(
  '/api/baileys/session/:sessionId/webhook',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { webhookUrl } = req.body;
      const userId = req.user.id;

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

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // Remover webhook "Principal" existente se houver
      await webhooksCollection.deleteMany({
        userId: userId,
        sessionId: sessionId,
        name: 'Principal',
      });

      // Criar novo webhook
      const newWebhook = {
        id: crypto.randomUUID(),
        userId: userId,
        sessionId: sessionId,
        name: 'Principal',
        url: webhookUrl,
        active: true,
        priority: 1,
        events: ['*'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await webhooksCollection.insertOne(newWebhook);

      res.json({
        success: true,
        message: 'Webhook configurado com sucesso',
        webhookUrl,
        sessionId,
        webhookInfo: {
          id: newWebhook.id,
          name: newWebhook.name,
          note: 'Endpoint legado - use /webhooks para gerenciamento completo',
        },
      });
    } catch (error) {
      logger.error(`Erro ao configurar webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

app.get(
  '/api/baileys/session/:sessionId/webhook',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // Buscar webhook "Principal" ou o primeiro ativo
      const principalWebhook = await webhooksCollection.findOne({
        userId: userId,
        sessionId: sessionId,
        name: 'Principal',
      });

      if (!principalWebhook) {
        // Se não tem Principal, busca o primeiro ativo
        const activeWebhook = await webhooksCollection.findOne({
          userId: userId,
          sessionId: sessionId,
          active: true,
        });

        if (!activeWebhook) {
          return res.status(404).json({
            success: false,
            message: 'Webhook não configurado para esta sessão',
          });
        }
      }

      const webhook = principalWebhook || activeWebhook;

      res.json({
        success: true,
        webhookUrl: webhook.url,
        sessionId,
        webhookInfo: {
          id: webhook.id,
          name: webhook.name,
          active: webhook.active,
          priority: webhook.priority,
          note: 'Endpoint legado - use /webhooks para informações completas',
        },
      });
    } catch (error) {
      logger.error(`Erro ao obter webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

app.delete(
  '/api/baileys/session/:sessionId/webhook',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // Buscar webhook "Principal" ou o primeiro ativo
      const principalWebhook = await webhooksCollection.findOne({
        userId: userId,
        sessionId: sessionId,
        name: 'Principal',
      });

      let webhookToRemove = principalWebhook;

      if (!principalWebhook) {
        // Se não tem Principal, busca o primeiro ativo
        webhookToRemove = await webhooksCollection.findOne({
          userId: userId,
          sessionId: sessionId,
          active: true,
        });
      }

      if (!webhookToRemove) {
        return res.status(404).json({
          success: false,
          message: 'Nenhum webhook encontrado para remover',
        });
      }

      await webhooksCollection.deleteOne({ _id: webhookToRemove._id });

      res.json({
        success: true,
        message: 'Webhook removido com sucesso',
        sessionId,
        removedWebhook: {
          id: webhookToRemove.id,
          name: webhookToRemove.name,
          url: webhookToRemove.url,
          note: 'Endpoint legado - use /webhooks/:id para remoção específica',
        },
      });
    } catch (error) {
      logger.error(`Erro ao remover webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ========================================
// NOVOS ENDPOINTS PARA MÚLTIPLOS WEBHOOKS
// ========================================

// Listar todos os webhooks de uma sessão
app.get(
  '/api/baileys/session/:sessionId/webhooks',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      const sessionWebhooks = await webhooksCollection
        .find({
          userId: userId,
          sessionId: sessionId,
        })
        .sort({ priority: 1, createdAt: 1 })
        .toArray();

      // Convert MongoDB _id to id for frontend compatibility
      const webhooks = sessionWebhooks.map((webhook) => ({
        ...webhook,
        id: webhook.id || webhook._id.toString(),
      }));

      res.json({
        success: true,
        sessionId,
        webhooks: webhooks,
        total: webhooks.length,
        limit: 3,
      });
    } catch (error) {
      logger.error(`Erro ao listar webhooks: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Adicionar novo webhook à sessão
app.post(
  '/api/baileys/session/:sessionId/webhooks',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { name, url, active, priority, events } = req.body;
      const userId = req.user.id;

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

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // Verificar limite de 3 webhooks por sessão
      const existingCount = await webhooksCollection.countDocuments({
        userId: userId,
        sessionId: sessionId,
      });

      if (existingCount >= 3) {
        return res.status(400).json({
          success: false,
          message: 'Máximo de 3 webhooks permitidos por sessão',
        });
      }

      // Criar novo webhook
      const newWebhook = {
        id: crypto.randomUUID(),
        userId: userId,
        sessionId: sessionId,
        name: name || `Webhook ${existingCount + 1}`,
        url: url,
        active: active !== undefined ? active : true,
        priority: priority || existingCount + 1,
        events: events || ['messages.upsert', 'messages.update', 'messages.delete', 'group-participants.update'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await webhooksCollection.insertOne(newWebhook);

      res.json({
        success: true,
        message: 'Webhook adicionado com sucesso',
        webhook: {
          ...newWebhook,
          id: newWebhook.id,
        },
        sessionId,
      });
    } catch (error) {
      logger.error(`Erro ao adicionar webhook: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Obter webhook específico
app.get(
  '/api/baileys/session/:sessionId/webhooks/:webhookId',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId, webhookId } = req.params;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // Search by both id field and _id field for compatibility
      const webhook = await webhooksCollection.findOne({
        $and: [
          { userId: userId },
          { sessionId: sessionId },
          {
            $or: [{ id: webhookId }, { _id: webhookId }],
          },
        ],
      });

      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado',
        });
      }

      // Convert MongoDB _id to id for frontend compatibility
      const responseWebhook = {
        ...webhook,
        id: webhook.id || webhook._id.toString(),
      };

      res.json({
        success: true,
        webhook: responseWebhook,
        sessionId,
      });
    } catch (error) {
      logger.error(`Erro ao obter webhook específico: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Atualizar webhook específico
app.put(
  '/api/baileys/session/:sessionId/webhooks/:webhookId',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId, webhookId } = req.params;
      const { name, url, active, priority, events } = req.body;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
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

      const webhooksCollection = db.collection('webhooks');

      // Build update object with only provided fields
      const updateData = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (url !== undefined) updateData.url = url;
      if (active !== undefined) updateData.active = active;
      if (priority !== undefined) updateData.priority = priority;
      if (events !== undefined) updateData.events = events;

      // Search by both id field and _id field for compatibility
      const result = await webhooksCollection.updateOne(
        {
          $and: [
            { userId: userId },
            { sessionId: sessionId },
            {
              $or: [{ id: webhookId }, { _id: webhookId }],
            },
          ],
        },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado',
        });
      }

      // Get updated webhook
      const updatedWebhook = await webhooksCollection.findOne({
        $and: [
          { userId: userId },
          { sessionId: sessionId },
          {
            $or: [{ id: webhookId }, { _id: webhookId }],
          },
        ],
      });

      // Convert MongoDB _id to id for frontend compatibility
      const responseWebhook = {
        ...updatedWebhook,
        id: updatedWebhook.id || updatedWebhook._id.toString(),
      };

      res.json({
        success: true,
        message: 'Webhook atualizado com sucesso',
        webhook: responseWebhook,
        sessionId,
      });
    } catch (error) {
      logger.error(`Erro ao atualizar webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Remover webhook específico
app.delete(
  '/api/baileys/session/:sessionId/webhooks/:webhookId',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId, webhookId } = req.params;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // Search by both id field and _id field for compatibility
      const result = await webhooksCollection.deleteOne({
        $and: [
          { userId: userId },
          { sessionId: sessionId },
          {
            $or: [{ id: webhookId }, { _id: webhookId }],
          },
        ],
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado',
        });
      }

      res.json({
        success: true,
        message: 'Webhook removido com sucesso',
        sessionId,
      });
    } catch (error) {
      logger.error(`Erro ao remover webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Ativar/desativar webhook específico
app.patch(
  '/api/baileys/session/:sessionId/webhooks/:webhookId/toggle',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId, webhookId } = req.params;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // First get current webhook to toggle its active state
      const currentWebhook = await webhooksCollection.findOne({
        $and: [
          { userId: userId },
          { sessionId: sessionId },
          {
            $or: [{ id: webhookId }, { _id: webhookId }],
          },
        ],
      });

      if (!currentWebhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado',
        });
      }

      // Toggle the active state
      const newActiveState = !currentWebhook.active;

      const result = await webhooksCollection.updateOne(
        {
          $and: [
            { userId: userId },
            { sessionId: sessionId },
            {
              $or: [{ id: webhookId }, { _id: webhookId }],
            },
          ],
        },
        {
          $set: {
            active: newActiveState,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado',
        });
      }

      res.json({
        success: true,
        message: `Webhook ${
          newActiveState ? 'ativado' : 'desativado'
        } com sucesso`,
        active: newActiveState,
        sessionId,
      });
    } catch (error) {
      logger.error(`Erro ao alternar webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Testar webhook específico
app.post(
  '/api/baileys/session/:sessionId/webhooks/:webhookId/test',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId, webhookId } = req.params;
      const userId = req.user.id;

      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada',
        });
      }

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');

      // Search by both id field and _id field for compatibility
      const webhook = await webhooksCollection.findOne({
        $and: [
          { userId: userId },
          { sessionId: sessionId },
          {
            $or: [{ id: webhookId }, { _id: webhookId }],
          },
        ],
      });

      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado',
        });
      }

      // Create test payload
      const testPayload = {
        event: 'webhook.test',
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        data: {
          message: 'Este é um teste do webhook',
          webhookId: webhook.id || webhook._id.toString(),
          webhookName: webhook.name,
        },
      };

      try {
        // Send test request to webhook URL
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Baileys-API-Webhook-Test/1.0',
          },
          body: JSON.stringify(testPayload),
          timeout: 10000, // 10 second timeout
        });

        const responseData = {
          success: true,
          message: 'Teste de webhook enviado com sucesso',
          webhook: {
            id: webhook.id || webhook._id.toString(),
            name: webhook.name,
            url: webhook.url,
          },
          test: {
            status: response.status,
            statusText: response.statusText,
            timestamp: new Date().toISOString(),
          },
          sessionId,
        };

        // Try to get response text, but don't fail if it's not JSON
        try {
          const responseText = await response.text();
          if (responseText) {
            responseData.test.response = responseText.substring(0, 1000); // Limit response size
          }
        } catch (e) {
          // Ignore response text errors
        }

        res.json(responseData);
      } catch (fetchError) {
        logger.error(
          `Erro ao testar webhook ${webhookId}: ${fetchError.message}`
        );
        res.status(400).json({
          success: false,
          message: 'Falha ao testar webhook',
          error: fetchError.message,
          webhook: {
            id: webhook.id || webhook._id.toString(),
            name: webhook.name,
            url: webhook.url,
          },
          sessionId,
        });
      }
    } catch (error) {
      logger.error(`Erro ao testar webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

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

    // 3. MARCAR COMO VISTO - apenas se há agente ativo e configurado
    const { getAgentFromDatabase, findAgentBySessionId } = require('./routes/aiAgents');

    // Get active agent with auto-reply enabled from database
    let activeAgent = await findAgentBySessionId(sessionId, true);
    
    // Additional check for autoReply setting
    if (activeAgent && !activeAgent.autoReply) {
      activeAgent = null;
    }

    if (activeAgent && HUMAN_BEHAVIOR.AUTO_MARK_READ) {
      await delay(300 + Math.random() * 200); // Delay natural antes de marcar como visto
      await sock.readMessages([
        {
          remoteJid: jid,
          id: message.id || crypto.randomBytes(10).toString('hex'),
        },
      ]);
    }

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

app.post(
  '/api/baileys/session/:sessionId/smart-reply',
  checkSessionOwnership,
  async (req, res) => {
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
        message:
          'Resposta inteligente enviada com comportamento humano avançado',
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
  }
);

app.delete(
  '/api/baileys/session/:sessionId',
  checkSessionOwnership,
  async (req, res) => {
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
  }
);

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
      'POST /api/baileys/session/:id/reply-message':
        'Responder mensagem por ID',
      'POST /api/baileys/session/:id/smart-reply':
        'Resposta inteligente com comportamento humano',

      // Controles de Chat
      'POST /api/baileys/session/:id/typing': 'Controlar status de digitação',
      'POST /api/baileys/session/:id/mark-read': 'Marcar mensagem como lida',

      // Histórico e Mídia
      'GET /api/baileys/session/:id/messages': 'Listar mensagens armazenadas',
      'POST /api/baileys/session/:id/download-media':
        'Baixar mídia das mensagens',

      // Webhooks (Legado)
      'POST /api/baileys/session/:id/webhook':
        'Configurar webhook principal (legado)',
      'GET /api/baileys/session/:id/webhook':
        'Obter webhook principal (legado)',
      'DELETE /api/baileys/session/:id/webhook':
        'Remover webhook principal (legado)',

      // Webhooks (Múltiplos - Sistema Avançado)
      'GET /api/baileys/session/:id/webhooks':
        'Listar todos os webhooks (máx 3)',
      'POST /api/baileys/session/:id/webhooks': 'Adicionar novo webhook',
      'GET /api/baileys/session/:id/webhooks/:webhookId':
        'Obter webhook específico',
      'PUT /api/baileys/session/:id/webhooks/:webhookId': 'Atualizar webhook',
      'DELETE /api/baileys/session/:id/webhooks/:webhookId':
        'Remover webhook específico',
      'PATCH /api/baileys/session/:id/webhooks/:webhookId/toggle':
        'Ativar/desativar webhook',
      'POST /api/baileys/session/:id/webhooks/:webhookId/test':
        'Testar webhook',

      // Grupos
      'POST /api/baileys/groups/:sessionId/create': 'Criar novo grupo',
      'GET /api/baileys/groups/:sessionId/:groupId/info':
        'Obter informações do grupo',
      'POST /api/baileys/groups/:sessionId/:groupId/add-participants':
        'Adicionar participantes',
      'POST /api/baileys/groups/:sessionId/:groupId/remove-participants':
        'Remover participantes',
      'POST /api/baileys/groups/:sessionId/:groupId/promote':
        'Promover participantes a admin',
      'POST /api/baileys/groups/:sessionId/:groupId/demote':
        'Despromover admins',
      'PUT /api/baileys/groups/:sessionId/:groupId/subject':
        'Atualizar nome do grupo',
      'PUT /api/baileys/groups/:sessionId/:groupId/description':
        'Atualizar descrição do grupo',
      'PUT /api/baileys/groups/:sessionId/:groupId/settings':
        'Configurar permissões do grupo',
      'POST /api/baileys/groups/:sessionId/:groupId/leave': 'Sair do grupo',
      'GET /api/baileys/groups/:sessionId/list': 'Listar grupos',
      'GET /api/baileys/groups/:sessionId/:groupId/invite-code':
        'Obter código de convite',
      'POST /api/baileys/groups/:sessionId/:groupId/revoke-invite':
        'Revogar código de convite',

      // Agentes de IA
      'POST /api/baileys/agents/create': 'Criar novo agente de IA',
      'GET /api/baileys/agents/list': 'Listar todos os agentes',
      'GET /api/baileys/agents/:agentId': 'Obter informações do agente',
      'PATCH /api/baileys/agents/:agentId/deactivate': 'Desativar agente',
      'DELETE /api/baileys/agents/:agentId': 'Remover agente',
      'POST /api/baileys/agents/process-message':
        'Processar mensagem com agente',

      // LID Resolver
      'POST /api/baileys/session/:sessionId/lid/resolve': 'Resolver LID para número de telefone',

      // Informações
      'GET /api/baileys/info': 'Informações da API',
      'GET /': 'Redireciona para documentação Swagger',
    },
  });
});

// Usar rotas de grupos
app.use('/api/baileys/groups', groupsRouter);

// Usar rotas de agentes de IA
app.use('/api/baileys/agents', aiAgentsRouter);

// Usar rotas de LID resolver
const lidResolverRouter = require('./api/lidResolver');
app.use('/api/baileys/session', lidResolverRouter);

// APIs movidas para /api/management para usar autenticação consistente

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
      await messagesCollection.createIndex(
        { sessionId: 1, messageId: 1 },
        { unique: true }
      );
      await messagesCollection.createIndex({ userId: 1 });

      // Create indexes for groups collection
      const groupsCollection = db.collection('groups');
      await groupsCollection.createIndex(
        { sessionId: 1, jid: 1 },
        { unique: true }
      );
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

  // Integrar sistema de coleta de mensagens
  logger.info('Integrando sistema de coleta de mensagens...');
  try {
    integrateWithMainApp(app);
    logger.info('Sistema de coleta de mensagens integrado com sucesso!');
  } catch (error) {
    logger.error(`Erro ao integrar sistema de coleta: ${error.message}`);
  }
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

// Disponibilizar funções globalmente
global.createWhatsAppSession = createWhatsAppSession;
global.downloadMediaToFile = downloadMediaToFile;

module.exports = {
  app,
  getSessions,
  initializeApp,
  createWhatsAppSession,
  getEnrichedSessionData,
  saveDownloadMetadata,
  downloadMediaToFile,
};
