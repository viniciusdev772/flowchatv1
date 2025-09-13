/**
 * @fileoverview This is the main application file. It sets up the Express server, manages WhatsApp sessions, and defines the API routes.
 * @module app
 */
const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  delay,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');


const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const {
  swaggerSpec,
  swaggerUiOptions,
  generateOpenAPIFile,
} = require('./config/swagger');
const QRCode = require('qrcode');
const crypto = require('crypto');
const database = require('./config/database');
const apiTokenAuth = require('./middleware/apiTokenAuth');

/**
 * Creates a unique session ID by combining the user ID and session ID.
 * @param {string} userId - The ID of the user.
 * @param {string} sessionId - The ID of the session.
 * @returns {string} The unique session ID.
 */
function createUniqueSessionId(userId, sessionId) {
  return `${userId}_${sessionId}`;
}

/**
 * Extracts the original session ID from a unique session ID.
 * @param {string} uniqueSessionId - The unique session ID.
 * @returns {string} The original session ID.
 */
function extractOriginalSessionId(uniqueSessionId) {
  const parts = uniqueSessionId.split('_');
  return parts.slice(1).join('_');
}


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


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/downloads', express.static(path.join(process.cwd(), 'downloads')));


app.use('/api/baileys', (req, res, next) => {

  if (req.path.startsWith('/download/')) {
    logger.info(`🔓 Download público acessado: ${req.path} - IP: ${req.ip}`);
    return next();
  }

  return apiTokenAuth(req, res, next);
});


app.get('/openapi.json', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="openapi.json"');
    res.json(swaggerSpec);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar arquivo OpenAPI',
      error: error.message,
    });
  }
});


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

        setTimeout(function() {

          let topbar = document.querySelector('.topbar-wrapper .topbar');
          if (!topbar) {
            topbar = document.querySelector('.topbar');
          }

          if (topbar) {

            const downloadContainer = document.createElement('div');
            downloadContainer.className = 'download-contents';
            downloadContainer.innerHTML = \`
              <a href="/openapi.json" class="download-btn" download="openapi.json">
                📥 Download JSON
              </a>
            \`;


            topbar.appendChild(downloadContainer);
          } else {

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
    `,
  })
);




const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });


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


const sessions = new Map();
const sessionQueues = new Map();
const messageRateLimit = new Map();
const reconnectionAttempts = new Map();
const messageStore = new Map();
const webhooks = new Map();
const messageParts = new Map();
const messageTimers = new Map();









global.whatsappSessions = sessions;

/**
 * Gets all active WhatsApp sessions.
 * @returns {Map<string, object>} A map of active sessions.
 */
function getSessions() {
  return sessions;
}

/**
 * Gets enriched data for a specific session.
 * @param {string} sessionId - The ID of the session.
 * @param {object} sessionData - The session data.
 * @returns {Promise<object>} The enriched session data.
 */
async function getEnrichedSessionData(sessionId, sessionData) {
  try {

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


    if (!enrichedData.hasQrCode && !enrichedData.isConnected) {
      const qrData = await loadQRCodeData(sessionId);
      if (qrData) {
        enrichedData.hasQrCode = true;
        enrichedData.qrCode = qrData.qrCode;
        enrichedData.qrCodeImage = qrData.qrCodeImage;


        sessionData.qrCode = qrData.qrCode;
        sessionData.qrCodeImage = qrData.qrCodeImage;
      }
    }

    return enrichedData;
  } catch (error) {
    logger.error(
      `Error enriching session data for ${sessionId}: ${error.message}`
    );

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

/**
 * Gets all sessions for a specific user.
 * @param {string} userId - The ID of the user.
 * @returns {Map<string, object>} A map of user sessions.
 */
function getUserSessions(userId) {
  const userSessions = new Map();
  for (const [sessionId, sessionData] of sessions.entries()) {
    if (sessionData.userId === userId) {
      userSessions.set(sessionId, sessionData);
    }
  }
  return userSessions;
}

/**
 * Checks if a user is the owner of a session.
 * @param {string} sessionId - The ID of the session.
 * @param {string} userId - The ID of the user.
 * @returns {boolean} True if the user is the owner, false otherwise.
 */
function isUserSessionOwner(sessionId, userId) {
  const session = sessions.get(sessionId);
  if (!session || !session.userId) {
    return false;
  }


  const sessionUserId = session.userId.toString();
  const requestUserId = userId.toString();

  return sessionUserId === requestUserId;
}

/**
 * Middleware to check if the user owns the session.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
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


/**
 * Gets all webhooks for a specific session from memory.
 * @param {string} sessionId - The ID of the session.
 * @returns {Array<object>} An array of webhooks.
 */
function getSessionWebhooks(sessionId) {

  const sessionWebhooks = webhooks.get(sessionId) || [];
  logger.info(
    `Getting webhooks for session ${sessionId} from memory: found ${sessionWebhooks.length} webhooks`
  );
  return sessionWebhooks;
}

/**
 * Gets all webhooks for a specific session from the database.
 * @param {string} sessionId - The ID of the session.
 * @returns {Promise<Array<object>>} An array of webhooks.
 */
async function getSessionWebhooksFromDB(sessionId) {
  try {
    const db = database.getDb();
    if (!db) {
      logger.warn('Database not available, falling back to memory webhooks');
      return getSessionWebhooks(sessionId);
    }

    const webhooksCollection = db.collection('webhooks');



    const sessionWebhooks = await webhooksCollection
      .find({
        sessionId: sessionId,
        active: true,
      })
      .sort({ priority: 1, createdAt: 1 })
      .toArray();


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

    return getSessionWebhooks(sessionId);
  }
}

/**
 * Adds a webhook to a session.
 * @param {string} sessionId - The ID of the session.
 * @param {object} webhookData - The webhook data.
 * @param {string|null} userId - The ID of the user.
 * @returns {object} The new webhook object.
 */
function addWebhookToSession(sessionId, webhookData, userId = null) {
  const sessionWebhooks = getSessionWebhooks(sessionId);


  if (sessionWebhooks.length >= 3) {
    throw new Error('Máximo de 3 webhooks permitidos por sessão');
  }


  if (sessionWebhooks.some((w) => w.name === webhookData.name)) {
    throw new Error('Nome do webhook já existe nesta sessão');
  }

  const newWebhook = {
    id: crypto.randomUUID(),
    userId: userId,
    sessionId: sessionId,
    name: webhookData.name || `Webhook ${sessionWebhooks.length + 1}`,
    url: webhookData.url,
    active: webhookData.active !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
    priority: webhookData.priority || sessionWebhooks.length + 1,
    events: webhookData.events || ['*'],
  };

  sessionWebhooks.push(newWebhook);
  webhooks.set(sessionId, sessionWebhooks);


  saveWebhookData(sessionId, newWebhook, userId);

  return newWebhook;
}

/**
 * Removes a webhook from a session.
 * @param {string} sessionId - The ID of the session.
 * @param {string} webhookId - The ID of the webhook to remove.
 * @param {string|null} userId - The ID of the user.
 * @returns {object} The removed webhook object.
 */
function removeWebhookFromSession(sessionId, webhookId, userId = null) {
  const sessionWebhooks = getSessionWebhooks(sessionId);
  const webhookIndex = sessionWebhooks.findIndex((w) => w.id === webhookId);

  if (webhookIndex === -1) {
    throw new Error('Webhook não encontrado');
  }

  const removedWebhook = sessionWebhooks.splice(webhookIndex, 1)[0];
  webhooks.set(sessionId, sessionWebhooks);


  if (sessionWebhooks.length > 0) {
    saveWebhookData(sessionId, sessionWebhooks, userId);
  } else {
    deleteWebhookData(sessionId, userId);
  }

  return removedWebhook;
}

/**
 * Updates a webhook in a session.
 * @param {string} sessionId - The ID of the session.
 * @param {string} webhookId - The ID of the webhook to update.
 * @param {object} updateData - The data to update.
 * @param {string|null} userId - The ID of the user.
 * @returns {object} The updated webhook object.
 */
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


  if (updateData.name && updateData.name !== webhook.name) {
    if (
      sessionWebhooks.some(
        (w) => w.name === updateData.name && w.id !== webhookId
      )
    ) {
      throw new Error('Nome do webhook já existe nesta sessão');
    }
  }


  if (updateData.name !== undefined) webhook.name = updateData.name;
  if (updateData.url !== undefined) webhook.url = updateData.url;
  if (updateData.active !== undefined) webhook.active = updateData.active;
  if (updateData.priority !== undefined) webhook.priority = updateData.priority;
  if (updateData.events !== undefined) webhook.events = updateData.events;

  webhook.updatedAt = new Date().toISOString();

  webhooks.set(sessionId, sessionWebhooks);


  saveWebhookData(sessionId, sessionWebhooks, userId);

  return webhook;
}

/**
 * Gets all active webhooks for a specific session from memory.
 * @param {string} sessionId - The ID of the session.
 * @param {string|null} eventType - The type of event to filter by.
 * @returns {Array<object>} An array of active webhooks.
 */
function getActiveWebhooks(sessionId, eventType = null) {

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

/**
 * Gets all active webhooks for a specific session from the database.
 * @param {string} sessionId - The ID of the session.
 * @param {string|null} eventType - The type of event to filter by.
 * @returns {Promise<Array<object>>} An array of active webhooks.
 */
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


const groupsRouter = require('./api/groups');


const {
  router: messageCollectorRouter,
  integrateWithMainApp,
} = require('./api/messageCollector');
const aiSummaryRouter = require('./api/aiSummary');


const { router: aiAgentsRouter } = require('./routes/aiAgents');


const whatsappTasksRouter = require('./api/whatsappTasks');


const taskScheduler = require('./scheduler/taskScheduler');


const HUMAN_BEHAVIOR = {
  MIN_TYPING_TIME: 1000,
  MAX_TYPING_TIME: 8000,
  TYPING_SPEED: 50,
  MIN_DELAY_BETWEEN_MESSAGES: 2000,
  MAX_DELAY_BETWEEN_MESSAGES: 5000,
  MAX_MESSAGES_PER_MINUTE: 10,
  SEEN_DELAY: 500,
  AUTO_MARK_READ: process.env.AUTO_MARK_READ === 'true',
};


const RECONNECTION_CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_DELAY: 5000,
  MAX_DELAY: 60000,
  STREAM_ERROR_DELAY: 10000,
};


/**
 * Calculates the typing time for a message.
 * @param {number} messageLength - The length of the message.
 * @returns {number} The typing time in milliseconds.
 */
function calculateTypingTime(messageLength) {
  const baseTime = Math.max(
    HUMAN_BEHAVIOR.MIN_TYPING_TIME,
    Math.min(
      (messageLength / HUMAN_BEHAVIOR.TYPING_SPEED) * 1000,
      HUMAN_BEHAVIOR.MAX_TYPING_TIME
    )
  );


  const variation = baseTime * 0.3;
  return baseTime + (Math.random() * variation * 2 - variation);
}

/**
 * Gets a random delay between messages.
 * @returns {number} The delay in milliseconds.
 */
function getRandomDelay() {
  return (
    Math.random() *
      (HUMAN_BEHAVIOR.MAX_DELAY_BETWEEN_MESSAGES -
        HUMAN_BEHAVIOR.MIN_DELAY_BETWEEN_MESSAGES) +
    HUMAN_BEHAVIOR.MIN_DELAY_BETWEEN_MESSAGES
  );
}

/**
 * Checks if a session has exceeded the message rate limit.
 * @param {string} sessionId - The ID of the session.
 * @returns {boolean} True if the rate limit has not been exceeded, false otherwise.
 */
function checkRateLimit(sessionId) {
  const now = Date.now();
  const limit = messageRateLimit.get(sessionId) || [];


  const recentMessages = limit.filter((timestamp) => now - timestamp < 60000);

  if (recentMessages.length >= HUMAN_BEHAVIOR.MAX_MESSAGES_PER_MINUTE) {
    return false;
  }

  recentMessages.push(now);
  messageRateLimit.set(sessionId, recentMessages);
  return true;
}

/**
 * Sends a message with human-like behavior.
 * @param {object} sock - The Baileys socket instance.
 * @param {string} jid - The JID of the recipient.
 * @param {string|object} message - The message to send.
 * @param {object|null} quotedMessage - The message to quote.
 * @returns {Promise<object>} The sent message object.
 */
async function sendMessageWithHumanBehavior(
  sock,
  jid,
  message,
  quotedMessage = null
) {
  try {

    const sessionId = sock.user?.id;
    if (!checkRateLimit(sessionId)) {
      throw new Error(
        'Rate limit excedido. Muitas mensagens enviadas recentemente.'
      );
    }


    const {
      getAgentFromDatabase,
      findAgentBySessionId,
    } = require('./routes/aiAgents');


    let activeAgent = await findAgentBySessionId(sessionId, true);


    if (activeAgent && !activeAgent.autoReply) {
      activeAgent = null;
    }


    if (activeAgent && HUMAN_BEHAVIOR.AUTO_MARK_READ) {
      await delay(HUMAN_BEHAVIOR.SEEN_DELAY);
      await sock.readMessages([
        {
          remoteJid: jid,
          id: message.id || crypto.randomBytes(10).toString('hex'),
        },
      ]);
    }


    await sock.sendPresenceUpdate('composing', jid);


    const messageText =
      typeof message === 'string' ? message : message.text || '';
    const typingTime = calculateTypingTime(messageText.length);

    logger.info(
      `Simulando digitação por ${typingTime}ms para mensagem de ${messageText.length} caracteres`
    );
    await delay(typingTime);


    await sock.sendPresenceUpdate('paused', jid);


    await delay(200 + Math.random() * 300);


    const messageOptions =
      typeof message === 'string' ? { text: message } : message;


    const sendOptions = {};
    if (quotedMessage) {
      sendOptions.quoted = quotedMessage;
    }

    const sentMessage = await sock.sendMessage(
      jid,
      messageOptions,
      sendOptions
    );


    await sock.sendPresenceUpdate('available', jid);

    return sentMessage;
  } catch (error) {
    logger.error(
      `Erro ao enviar mensagem com comportamento humano: ${error.message}`
    );
    throw error;
  }
}

/**
 * Processes the message queue for a session.
 * @param {string} sessionId - The ID of the session.
 * @returns {Promise<void>}
 */
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


      if (queue.messages.length > 0) {
        await delay(getRandomDelay());
      }
    } catch (error) {
      reject(error);
    }
  }

  queue.processing = false;
}

/**
 * Queues a message to be sent.
 * @param {string} sessionId - The ID of the session.
 * @param {object} sock - The Baileys socket instance.
 * @param {string} jid - The JID of the recipient.
 * @param {string|object} message - The message to send.
 * @param {object|null} quotedMessage - The message to quote.
 * @returns {Promise<object>} A promise that resolves with the sent message object.
 */
function queueMessage(sessionId, sock, jid, message, quotedMessage = null) {
  return new Promise((resolve, reject) => {
    if (!sessionQueues.has(sessionId)) {
      sessionQueues.set(sessionId, { messages: [], processing: false });
    }

    const queue = sessionQueues.get(sessionId);
    queue.messages.push({ sock, jid, message, quotedMessage, resolve, reject });


    processMessageQueue(sessionId);
  });
}


/**
 * Saves session data to a file and the database.
 * @param {string} sessionId - The ID of the session.
 * @param {object} sessionData - The session data.
 * @returns {Promise<void>}
 */
async function saveSessionData(sessionId, sessionData) {
  try {

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
      userId: sessionData.userId,
    };
    fs.writeFileSync(sessionFile, JSON.stringify(dataToSave, null, 2));


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

/**
 * Saves QR code data to the database.
 * @param {string} sessionId - The ID of the session.
 * @param {string} qrCode - The QR code string.
 * @param {string} qrCodeImage - The QR code image data URL.
 * @returns {Promise<void>}
 */
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
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
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

/**
 * Loads QR code data from the database.
 * @param {string} sessionId - The ID of the session.
 * @returns {Promise<object|null>} The QR code data, or null if not found.
 */
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

/**
 * Clears QR code data from the database.
 * @param {string} sessionId - The ID of the session.
 * @returns {Promise<void>}
 */
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

/**
 * Cleans up expired QR codes from the database.
 * @returns {Promise<void>}
 */
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

/**
 * Saves webhook data to the database.
 * @param {string} sessionId - The ID of the session.
 * @param {object} webhookData - The webhook data.
 * @param {string|null} userId - The ID of the user.
 * @returns {Promise<void>}
 */
async function saveWebhookData(sessionId, webhookData, userId = null) {
  const db = database.getDb();
  if (!db) return;

  try {
    const webhooksCollection = db.collection('webhooks');


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

/**
 * Loads webhook data from the database.
 * @param {string} sessionId - The ID of the session.
 * @returns {Promise<object|null>} The webhook data, or null if not found.
 */
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

/**
 * Deletes webhook data from the database.
 * @param {string} sessionId - The ID of the session.
 * @param {string|null} userId - The ID of the user.
 * @returns {Promise<void>}
 */
async function deleteWebhookData(sessionId, userId = null) {
  const db = database.getDb();
  if (!db) return;

  try {
    const webhooksCollection = db.collection('webhooks');

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

/**
 * Checks if a webhook URL is already in use.
 * @param {string} url - The webhook URL.
 * @param {string|null} excludeSessionId - The session ID to exclude from the check.
 * @param {string|null} excludeUserId - The user ID to exclude from the check.
 * @returns {Promise<object>} An object with the result of the check.
 */
async function checkWebhookUrlDuplication(
  url,
  excludeSessionId = null,
  excludeUserId = null
) {
  const db = database.getDb();
  if (!db) return { isDuplicate: false, sessions: [] };

  try {
    const webhooksCollection = db.collection('webhooks');


    const query = { url: url };


    if (excludeSessionId) {
      query.sessionId = { $ne: excludeSessionId };
    }

    const duplicateWebhooks = await webhooksCollection.find(query).toArray();

    if (duplicateWebhooks.length === 0) {
      return { isDuplicate: false, sessions: [] };
    }


    const sessionInfo = duplicateWebhooks.reduce((acc, webhook) => {
      if (!acc.find((s) => s.sessionId === webhook.sessionId)) {
        acc.push({
          sessionId: webhook.sessionId,
          userId: webhook.userId,
          webhookName: webhook.name,
          createdAt: webhook.createdAt,
        });
      }
      return acc;
    }, []);

    return {
      isDuplicate: true,
      sessions: sessionInfo,
      count: duplicateWebhooks.length,
      message: `Esta URL já está sendo usada por ${sessionInfo.length} sessão(ões). Isso pode causar eventos duplicados.`,
    };
  } catch (error) {
    logger.warn(`Failed to check webhook URL duplication: ${error.message}`);
    return { isDuplicate: false, sessions: [], error: error.message };
  }
}

/**
 * Saves a message to the database.
 * @param {string} sessionId - The ID of the session.
 * @param {string} messageId - The ID of the message.
 * @param {object} messageData - The message data.
 * @returns {Promise<void>}
 */
async function saveMessageToMongoDB(sessionId, messageId, messageData) {
  const db = database.getDb();
  if (!db) return;

  try {

    const session = sessions.get(sessionId);
    if (!session || !session.userId) {
      return;
    }


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
      chatInfo: chatInfo,
      createdAt: new Date(),
    };

    await messagesCollection.updateOne(
      { sessionId, messageId },
      { $set: document },
      { upsert: true }
    );


    if (chatInfo && chatInfo.type === 'group') {
      await saveGroupInfoToMongoDB(sessionId, messageData.jid, chatInfo);
    }

    logger.debug(`Message saved to MongoDB: ${sessionId}/${messageId}`);
  } catch (error) {
    logger.warn(`Failed to save message to MongoDB: ${error.message}`);
  }
}

/**
 * Saves group info to the database.
 * @param {string} sessionId - The ID of the session.
 * @param {string} groupJid - The JID of the group.
 * @param {object} groupInfo - The group info.
 * @returns {Promise<void>}
 */
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

/**
 * Loads messages from the database.
 * @param {string} sessionId - The ID of the session.
 * @param {number} limit - The number of messages to load.
 * @param {number} offset - The number of messages to skip.
 * @returns {Promise<Array<object>>} An array of messages.
 */
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
      chatInfo: msg.chatInfo || null,
      message: msg.message,
    }));
  } catch (error) {
    logger.warn(`Failed to load messages from MongoDB: ${error.message}`);
    return [];
  }
}


/**
 * Extracts the text from a message object.
 * @param {object} message - The message object.
 * @returns {string} The extracted text.
 */
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

/**
 * Gets the type of a message.
 * @param {object} message - The message object.
 * @returns {string} The message type.
 */
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

/**
 * Applies a field mapping to a data object.
 * @param {object} data - The data object.
 * @param {object} fieldMapping - The field mapping.
 * @returns {object} The data object with the field mapping applied.
 */
function applyFieldMapping(data, fieldMapping) {
  if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
    return data;
  }


  if (Array.isArray(data)) {
    return data.map((item) => applyFieldMapping(item, fieldMapping));
  }


  if (typeof data === 'object' && data !== null) {
    const mappedData = {};

    Object.keys(data).forEach((originalKey) => {

      const customKey = fieldMapping[originalKey] || originalKey;


      if (
        typeof data[originalKey] === 'object' &&
        data[originalKey] !== null &&
        !Array.isArray(data[originalKey])
      ) {
        mappedData[customKey] = applyFieldMapping(
          data[originalKey],
          fieldMapping
        );
      } else if (Array.isArray(data[originalKey])) {
        mappedData[customKey] = data[originalKey].map((item) =>
          typeof item === 'object'
            ? applyFieldMapping(item, fieldMapping)
            : item
        );
      } else {
        mappedData[customKey] = data[originalKey];
      }
    });

    return mappedData;
  }

  return data;
}


/**
 * Loads existing sessions from the file system and database.
 * @returns {Promise<void>}
 */
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


        if (userId || !database.getDb()) {
          const sessionDataFile = path.join(
            authDir,
            sessionId,
            'session_data.json'
          );


          if (fs.existsSync(sessionDataFile)) {
            const savedData = JSON.parse(
              fs.readFileSync(sessionDataFile, 'utf8')
            );


            await createWhatsAppSession(sessionId, userId);


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

/**
 * Cleans up orphaned sessions from the database.
 * @returns {Promise<void>}
 */
async function cleanupOrphanedSessions() {
  try {
    const db = database.getDb();
    if (!db) {
      return;
    }


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


        if (sessions.has(sessionId)) {
          const sessionData = sessions.get(sessionId);
          if (sessionData.sock) {
            try {
              await sessionData.sock.logout();
            } catch (error) {

            }
          }
          sessions.delete(sessionId);
          logger.info(`Removida sessão órfã ${sessionId} da memória`);
        }


        await db.collection('whatsapp_sessions').deleteOne({ sessionId });
        logger.info(`Removida sessão órfã ${sessionId} do banco de dados`);
      }
    }
  } catch (error) {
    logger.error(`Erro ao limpar sessões órfãs: ${error.message}`);
  }
}


/**
 * Stores a message in memory and the database.
 * @param {string} sessionId - The ID of the session.
 * @param {string} messageId - The ID of the message.
 * @param {object} message - The message object.
 * @returns {void}
 */
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


    saveMessageToMongoDB(sessionId, messageId, messageData).catch((error) => {
      logger.warn(`Failed to save message to MongoDB: ${error.message}`);
    });


    if (sessionMessages.size > 1000) {
      const firstKey = sessionMessages.keys().next().value;
      sessionMessages.delete(firstKey);
    }
  } catch (error) {
    logger.error(`Erro ao armazenar mensagem: ${error.message}`);
  }
}

/**
 * Gets a message by its ID.
 * @param {string} sessionId - The ID of the session.
 * @param {string} messageId - The ID of the message.
 * @returns {object|null} The message object, or null if not found.
 */
function getMessageById(sessionId, messageId) {
  try {
    const sessionMessages = messageStore.get(sessionId);
    return sessionMessages?.get(messageId) || null;
  } catch (error) {
    logger.error(`Erro ao buscar mensagem: ${error.message}`);
    return null;
  }
}


/**
 * Gets contact or group information.
 * @param {string} jid - The JID of the contact or group.
 * @param {object} sock - The Baileys socket instance.
 * @returns {Promise<object>} The contact or group information.
 */
async function getContactOrGroupInfo(jid, sock) {
  try {

    if (!jid || typeof jid !== 'string') {
      logger.warn(`getContactOrGroupInfo chamado com jid inválido: ${jid}`);
      return {
        type: 'unknown',
        id: jid || 'unknown',
        lid: null,
        name: 'ID inválido',
        notify: null,
        verifiedName: null,
        imgUrl: null,
        status: null,
        number: 'unknown',
        exists: false,
        isRegistered: false,
      };
    }

    if (jid.endsWith('@g.us')) {

      try {
        const groupMetadata = await sock.groupMetadata(jid);


        const admins = groupMetadata.participants
          ? groupMetadata.participants
              .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
              .map((p) => p.id)
          : [];


        const superAdmins = groupMetadata.participants
          ? groupMetadata.participants
              .filter((p) => p.admin === 'superadmin')
              .map((p) => p.id)
          : [];

        return {
          type: 'group',
          id: jid,
          lid: null,
          name: groupMetadata.subject || 'Grupo sem nome',
          notify: null,
          verifiedName: null,
          imgUrl: null,
          status: null,
          jid: jid,
          participants: groupMetadata.participants?.length || 0,
          description: groupMetadata.desc || null,
          createdAt: groupMetadata.creation
            ? new Date(groupMetadata.creation * 1000).toISOString()
            : null,
          owner: groupMetadata.owner || null,
          admins: admins,
          superAdmins: superAdmins,
          announce: groupMetadata.announce || false,
          restrict: groupMetadata.restrict || false,
          subjectTime: groupMetadata.subjectTime
            ? new Date(groupMetadata.subjectTime * 1000).toISOString()
            : null,
          descTime: groupMetadata.descTime
            ? new Date(groupMetadata.descTime * 1000).toISOString()
            : null,
          groupInviteCode: null,
        };
      } catch (error) {
        logger.warn(
          `Erro ao buscar metadados do grupo ${jid}: ${error.message}`
        );
        return {
          type: 'group',
          id: jid,
          lid: null,
          name: `Grupo ${jid.includes('@') ? jid.split('@')[0] : jid}`,
          notify: null,
          verifiedName: null,
          imgUrl: null,
          status: null,
          jid: jid,
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

      try {
        let contactData = {
          id: jid,
          lid: null,
          name: null,
          notify: null,
          verifiedName: null,
          imgUrl: null,
          status: null
        };


        if (sock.store && sock.store.contacts && sock.store.contacts[jid]) {
          const storeContact = sock.store.contacts[jid];
          contactData.name = storeContact.name || null;
          contactData.notify = storeContact.notify || null;
          contactData.verifiedName = storeContact.verifiedName || null;
          contactData.imgUrl = storeContact.imgUrl || null;
          contactData.status = storeContact.status || null;
          contactData.lid = storeContact.lid || null;
        }


        const contactInfo = await sock.onWhatsApp(
          jid.includes('@') ? jid.split('@')[0] : jid
        );

        if (contactInfo && contactInfo.length > 0) {
          const whatsappContact = contactInfo[0];


          if (!contactData.name && whatsappContact.name) {
            contactData.name = whatsappContact.name;
          }
          if (!contactData.notify && whatsappContact.notify) {
            contactData.notify = whatsappContact.notify;
          }

          return {
            type: 'contact',
            ...contactData,
            number: jid.includes('@') ? jid.split('@')[0] : jid,
            exists: whatsappContact.exists || false,
            isRegistered: true,
          };
        } else {

          return {
            type: 'contact',
            ...contactData,
            name: contactData.name || (jid.includes('@') ? jid.split('@')[0] : jid),
            number: jid.includes('@') ? jid.split('@')[0] : jid,
            exists: true,
            isRegistered: false,
          };
        }
      } catch (error) {
        logger.warn(
          `Erro ao buscar informações do contato ${jid}: ${error.message}`
        );


        return {
          type: 'contact',
          id: jid,
          lid: null,
          name: jid.includes('@') ? jid.split('@')[0] : jid,
          notify: null,
          verifiedName: null,
          imgUrl: null,
          status: null,
          number: jid.includes('@') ? jid.split('@')[0] : jid,
          exists: true,
          isRegistered: false,
        };
      }
    }

    return {
      type: 'unknown',
      id: jid,
      lid: null,
      name: jid,
      notify: null,
      verifiedName: null,
      imgUrl: null,
      status: null,
      number: jid,
      exists: false,
      isRegistered: false,
    };
  } catch (error) {
    logger.error(`Erro ao buscar informações para ${jid}: ${error.message}`);
    return {
      type: 'unknown',
      id: jid,
      lid: null,
      name: jid,
      notify: null,
      verifiedName: null,
      imgUrl: null,
      status: null,
      number: jid,
      exists: false,
      isRegistered: false,
    };
  }
}

/**
 * Sends a webhook.
 * @param {string} sessionId - The ID of the session.
 * @param {string} eventType - The type of the event.
 * @param {object} data - The event data.
 * @returns {Promise<void>}
 */
async function sendWebhook(sessionId, eventType, data) {
  try {

    const supportedEvents = [
      'messages.upsert',
      'messages.update',
      'messages.delete',
      'group-participants.update',
    ];

    if (!supportedEvents.includes(eventType)) {
      logger.debug(`Skipping webhook for unsupported event type: ${eventType}`);
      return;
    }

    logger.info(
      `Attempting to send webhook for session ${sessionId}, event: ${eventType}`
    );


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


    if (eventType === 'messages.upsert' && data) {

      const isUnsupportedMessage =
        data.messageType === 'unknown' ||
        data.content === 'Tipo de mensagem não suportado' ||
        (data.messageType === null &&
          data.content === 'Tipo de mensagem não suportado') ||

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


    let enrichedData = { ...data };

    if (data.chat?.id && eventType === 'messages.upsert') {
      const session = sessions.get(sessionId);
      if (session && session.sock) {
        try {
          const chatInfo = await getContactOrGroupInfo(
            data.chat.id,
            session.sock
          );


          enrichedData.chat = {
            ...enrichedData.chat,
            name: chatInfo.name,
            type: chatInfo.type,
            isGroup: chatInfo.type === 'group',
          };


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

            enrichedData.chat.contact = {
              name: chatInfo.name,
              number: data.chat?.id ? data.chat.id.split('@')[0] : 'unknown',
              isRegistered: chatInfo.isRegistered,
            };
          }


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


    const payload = {
      sessionId,
      eventType,
      timestamp: new Date().toISOString(),
      data: enrichedData,
    };


    let filteredWebhooks = activeWebhooks;


    function isGroupRelatedEvent(eventType, data) {
      switch (eventType) {
        case 'messages.upsert':
          return data.chat?.isGroup === true;
        case 'messages.update':
        case 'messages.delete':

          return data.messageKey?.remoteJid?.endsWith('@g.us') || false;
        case 'group-participants.update':

          return true;
        default:
          return false;
      }
    }


    if (isGroupRelatedEvent(eventType, enrichedData)) {
      filteredWebhooks = activeWebhooks.filter(
        (webhook) => !webhook.ignoreGroups
      );

      if (filteredWebhooks.length < activeWebhooks.length) {
        logger.info(
          `Filtered ${
            activeWebhooks.length - filteredWebhooks.length
          } webhooks that ignore groups for session ${sessionId}, event: ${eventType}`
        );
      }
    }


    if (filteredWebhooks.length === 0) {
      logger.warn(
        `No webhooks available after filtering for session ${sessionId}, event: ${eventType}`
      );
      return;
    }


    const webhookPromises = filteredWebhooks.map(async (webhook) => {
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
          timeout: 15000,
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


    const results = await Promise.allSettled(webhookPromises);

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const totalCount = filteredWebhooks.length;

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


/**
 * Sends a v2 webhook.
 * @param {string} sessionId - The ID of the session.
 * @param {string} eventType - The type of the event.
 * @param {object} originalMessage - The original message object.
 * @param {object|null} baileysRawEvent - The raw Baileys event.
 * @returns {Promise<void>}
 */
async function sendWebhookV2(
  sessionId,
  eventType,
  originalMessage,
  baileysRawEvent = null
) {
  const { isJidGroup } = require('@whiskeysockets/baileys');

  try {

    const activeWebhooks = await getActiveWebhooksFromDB(sessionId, eventType);
    const v2Webhooks = activeWebhooks.filter(
      (webhook) => webhook.version === 'v2'
    );

    if (v2Webhooks.length === 0) {
      return;
    }


    let payload = {
      event: eventType,
      session: sessionId,
      timestamp: Date.now(),
      data: null,
    };


    switch (eventType) {
      case 'messages.upsert':

        payload.data = {
          messages: baileysRawEvent?.messages || [originalMessage.message],
          type: baileysRawEvent?.type || 'notify',

          processed: {
            messageId: originalMessage.messageId,
            from: originalMessage.sender?.id,
            fromName: originalMessage.sender?.name,
            to: originalMessage.chat?.id,
            toName: originalMessage.chat?.name,
            isGroup: originalMessage.chat?.isGroup || false,
            messageType: originalMessage.messageType,
            content: originalMessage.content,
            timestamp: originalMessage.timestamp,

            ...(originalMessage.mediaData && {
              media: originalMessage.mediaData,
            }),

            ...(originalMessage.mediaDownload && {
              mediaUrl: originalMessage.mediaDownload,
            }),

            ...(originalMessage.quotedMessage && {
              quotedMessage: originalMessage.quotedMessage,
            }),
          },
        };
        break;

      case 'messages.update':
        payload.data = baileysRawEvent;
        break;

      case 'messages.delete':
        payload.data = baileysRawEvent;
        break;

      case 'group-participants.update':
        payload.data = baileysRawEvent;
        break;

      case 'connection.update':
        payload.data = baileysRawEvent;
        break;

      default:
        payload.data = baileysRawEvent || originalMessage;
    }


    let filteredWebhooks = v2Webhooks;

    if (eventType === 'messages.upsert' && payload.data.messages) {
      const hasGroupMessage = payload.data.messages.some((msg) => {
        const jid = msg.key?.remoteJid;
        return jid && isJidGroup(jid);
      });

      if (hasGroupMessage) {
        filteredWebhooks = v2Webhooks.filter(
          (webhook) => !webhook.ignoreGroups
        );
      }
    }

    if (filteredWebhooks.length === 0) {
      return;
    }


    const webhookPromises = filteredWebhooks.map(async (webhook) => {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FlowChat-Webhook/2.0',
            'X-Webhook-Version': 'v2',
            'X-Session-ID': sessionId,
            'X-Event-Type': eventType,
          },
          body: JSON.stringify(payload),
          timeout: 15000,
        });

        if (response.ok) {
          logger.debug(`Webhook v2 ${webhook.name} sent successfully`);
          return { success: true, webhook: webhook.id };
        } else {
          logger.warn(`Webhook v2 ${webhook.name} failed: ${response.status}`);
          return {
            success: false,
            webhook: webhook.id,
            error: response.status,
          };
        }
      } catch (error) {
        logger.error(`Webhook v2 ${webhook.name} error: ${error.message}`);
        return { success: false, webhook: webhook.id, error: error.message };
      }
    });

    await Promise.allSettled(webhookPromises);
  } catch (error) {
    logger.error(`Error in sendWebhookV2: ${error.message}`);
  }
}

/**
 * Sends a v1 webhook directly.
 * @param {string} sessionId - The ID of the session.
 * @param {string} eventType - The type of the event.
 * @param {object} data - The event data.
 * @param {Array<object>} webhooksList - The list of webhooks to send to.
 * @returns {Promise<void>}
 */
async function sendWebhookV1Direct(sessionId, eventType, data, webhooksList) {
  try {
    if (webhooksList.length === 0) return;



    await sendWebhook(sessionId, eventType, data);
  } catch (error) {
    logger.error(`Error in sendWebhookV1Direct: ${error.message}`);
  }
}


/**
 * Detects the type of a message.
 * @param {object} msgContent - The message content.
 * @returns {string} The message type.
 */
function detectMessageType(msgContent) {
  if (msgContent.conversation) return 'text';
  if (msgContent.extendedTextMessage) return 'text';
  if (msgContent.imageMessage) return 'image';
  if (msgContent.videoMessage) return 'video';
  if (msgContent.audioMessage)
    return msgContent.audioMessage.ptt ? 'voice' : 'audio';
  if (msgContent.documentMessage) return 'document';
  if (msgContent.stickerMessage) return 'sticker';
  if (msgContent.contactMessage) return 'contact';
  if (msgContent.contactsArrayMessage) return 'contacts';
  if (msgContent.locationMessage) return 'location';
  if (msgContent.liveLocationMessage) return 'liveLocation';
  if (msgContent.reactionMessage) return 'reaction';
  if (msgContent.pollCreationMessage) return 'poll';
  if (msgContent.pollUpdateMessage) return 'pollUpdate';
  return 'unknown';
}

/**
 * Extracts the text content from a message.
 * @param {object} msgContent - The message content.
 * @returns {string|null} The extracted text, or null if not found.
 */
function extractTextContent(msgContent) {
  if (msgContent.conversation) return msgContent.conversation;
  if (msgContent.extendedTextMessage?.text)
    return msgContent.extendedTextMessage.text;
  if (msgContent.imageMessage?.caption) return msgContent.imageMessage.caption;
  if (msgContent.videoMessage?.caption) return msgContent.videoMessage.caption;
  if (msgContent.documentMessage?.caption)
    return msgContent.documentMessage.caption;
  return null;
}

/**
 * Extracts media information from a message.
 * @param {object} msgContent - The message content.
 * @returns {object|null} The extracted media information, or null if not found.
 */
function extractMediaInfo(msgContent) {
  const media =
    msgContent.imageMessage ||
    msgContent.videoMessage ||
    msgContent.audioMessage ||
    msgContent.documentMessage ||
    msgContent.stickerMessage;

  if (!media) return null;

  return {
    mimetype: media.mimetype,
    fileSize: media.fileLength,
    width: media.width,
    height: media.height,
    duration: media.seconds,
    fileName: media.fileName || media.title,
    url: media.url,
    directPath: media.directPath,
    isAnimated: media.isAnimated || media.gifPlayback,
    isVoice: media.ptt,
  };
}

/**
 * Extracts quoted message information from a message.
 * @param {object} msgContent - The message content.
 * @returns {object|null} The extracted quoted message information, or null if not found.
 */
function extractQuotedMessage(msgContent) {
  const contextInfo =
    msgContent.extendedTextMessage?.contextInfo ||
    msgContent.imageMessage?.contextInfo ||
    msgContent.videoMessage?.contextInfo ||
    msgContent.audioMessage?.contextInfo ||
    msgContent.documentMessage?.contextInfo ||
    msgContent.stickerMessage?.contextInfo;

  if (!contextInfo?.quotedMessage) return null;

  const quoted = contextInfo.quotedMessage;
  return {
    messageId: contextInfo.stanzaId,
    participant: contextInfo.participant,
    messageType: detectMessageType(quoted),
    text: extractTextContent(quoted),
    media: extractMediaInfo(quoted),
  };
}

/**
 * Extracts contact information from a message.
 * @param {object} msgContent - The message content.
 * @returns {object|null} The extracted contact information, or null if not found.
 */
function extractContactInfo(msgContent) {
  if (msgContent.contactMessage) {
    return {
      displayName: msgContent.contactMessage.displayName,
      vcard: msgContent.contactMessage.vcard,
    };
  }
  if (msgContent.contactsArrayMessage) {
    return {
      contacts: msgContent.contactsArrayMessage.contacts || [],
    };
  }
  return null;
}

/**
 * Extracts location information from a message.
 * @param {object} msgContent - The message content.
 * @returns {object|null} The extracted location information, or null if not found.
 */
function extractLocationInfo(msgContent) {
  const location = msgContent.locationMessage || msgContent.liveLocationMessage;
  if (!location) return null;

  return {
    latitude: location.degreesLatitude,
    longitude: location.degreesLongitude,
    name: location.name,
    address: location.address,
    url: location.url,
    isLive: !!msgContent.liveLocationMessage,
  };
}

/**
 * Extracts mentions from a message.
 * @param {object} msgContent - The message content.
 * @returns {Array<string>} An array of mentioned JIDs.
 */
function extractMentions(msgContent) {
  const contextInfo =
    msgContent.extendedTextMessage?.contextInfo ||
    msgContent.imageMessage?.contextInfo ||
    msgContent.videoMessage?.contextInfo;

  return contextInfo?.mentionedJid || [];
}

/**
 * Extracts reaction information from a message.
 * @param {object} msgContent - The message content.
 * @returns {object|null} The extracted reaction information, or null if not found.
 */
function extractReactionInfo(msgContent) {
  if (!msgContent.reactionMessage) return null;

  return {
    emoji: msgContent.reactionMessage.text,
    targetMessageId: msgContent.reactionMessage.key?.id,
    targetRemoteJid: msgContent.reactionMessage.key?.remoteJid,
  };
}

/**
 * Extracts poll information from a message.
 * @param {object} msgContent - The message content.
 * @returns {object|null} The extracted poll information, or null if not found.
 */
function extractPollInfo(msgContent) {
  if (msgContent.pollCreationMessage) {
    return {
      type: 'creation',
      name: msgContent.pollCreationMessage.name,
      options: msgContent.pollCreationMessage.options || [],
      selectableCount: msgContent.pollCreationMessage.selectableOptionsCount,
    };
  }
  if (msgContent.pollUpdateMessage) {
    return {
      type: 'update',
      pollCreationMessageKey:
        msgContent.pollUpdateMessage.pollCreationMessageKey,
      vote: msgContent.pollUpdateMessage.vote,
    };
  }
  return null;
}


async function sendWebhookV2Direct(
  sessionId,
  eventType,
  originalMessage,
  baileysRawEvent,
  webhooksList
) {
  const { isJidGroup } = require('@whiskeysockets/baileys');

  try {
    if (webhooksList.length === 0) return;


    let payload = {
      event: eventType,
      session: sessionId,
      timestamp: Date.now(),
      data: null,
    };


    switch (eventType) {
      case 'messages.upsert':

        const messages = baileysRawEvent?.messages || [];
        const processedMessages = messages.map((msg) => {
          const msgContent = msg.message || {};


          return {

            hasMedia: !!(
              msgContent.imageMessage ||
              msgContent.videoMessage ||
              msgContent.audioMessage ||
              msgContent.documentMessage ||
              msgContent.stickerMessage
            ),
            hasQuoted: !!(
              msgContent.extendedTextMessage?.contextInfo?.quotedMessage ||
              msgContent.imageMessage?.contextInfo?.quotedMessage ||
              msgContent.videoMessage?.contextInfo?.quotedMessage ||
              msgContent.audioMessage?.contextInfo?.quotedMessage ||
              msgContent.documentMessage?.contextInfo?.quotedMessage ||
              msgContent.stickerMessage?.contextInfo?.quotedMessage
            ),
            isGroup: msg.key?.remoteJid?.endsWith('@g.us') || false,
            isBusinessAccount: !!msg.key?.previousRemoteJid?.includes('@lid'),
            fromMe: msg.key?.fromMe || false,
            isForwarded: !!(
              msgContent.imageMessage?.contextInfo?.isForwarded ||
              msgContent.videoMessage?.contextInfo?.isForwarded ||
              msgContent.extendedTextMessage?.contextInfo?.isForwarded ||
              msgContent.audioMessage?.contextInfo?.isForwarded ||
              msgContent.documentMessage?.contextInfo?.isForwarded
            ),
            hasMentions: !!(
              msgContent.extendedTextMessage?.contextInfo?.mentionedJid
                ?.length ||
              msgContent.imageMessage?.contextInfo?.mentionedJid?.length ||
              msgContent.videoMessage?.contextInfo?.mentionedJid?.length
            ),
            isVoiceMessage: !!msgContent.audioMessage?.ptt,
            isViewOnce: !!(
              msgContent.imageMessage?.viewOnce ||
              msgContent.videoMessage?.viewOnce
            ),
            isAnimated: !!(
              msgContent.stickerMessage?.isAnimated ||
              msgContent.videoMessage?.gifPlayback
            ),
            hasCaption: !!(
              msgContent.imageMessage?.caption ||
              msgContent.videoMessage?.caption ||
              msgContent.documentMessage?.caption
            ),
            isContact: !!(
              msgContent.contactMessage || msgContent.contactsArrayMessage
            ),
            isLocation: !!(
              msgContent.locationMessage || msgContent.liveLocationMessage
            ),
            isReaction: !!msgContent.reactionMessage,
            isPoll: !!(
              msgContent.pollCreationMessage || msgContent.pollUpdateMessage
            ),
            isSystemMessage: !!msg.messageStubType,


            messageId: msg.key?.id,
            timestamp: msg.messageTimestamp,
            key: msg.key || {},
            pushName: msg.pushName,
            status: msg.status,


            messageType: detectMessageType(msgContent),
            text: extractTextContent(msgContent),


            media: extractMediaInfo(msgContent),
            quotedMessage: extractQuotedMessage(msgContent),
            contact: extractContactInfo(msgContent),
            location: extractLocationInfo(msgContent),
            mentions: extractMentions(msgContent),
            reaction: extractReactionInfo(msgContent),
            poll: extractPollInfo(msgContent),


            mediaDownload: null,
          };
        });


        if (
          originalMessage &&
          originalMessage.mediaDownload &&
          processedMessages.length === 1
        ) {
          processedMessages[0].mediaDownload = originalMessage.mediaDownload;
        }

        payload.data = {

          summary: {
            hasMediaMessages: processedMessages.some((m) => m.hasMedia),
            hasQuotedMessages: processedMessages.some((m) => m.hasQuoted),
            hasGroupMessages: processedMessages.some((m) => m.isGroup),
            hasBusinessMessages: processedMessages.some(
              (m) => m.isBusinessAccount
            ),
            messagesCount: processedMessages.length,
            messageTypes: [
              ...new Set(processedMessages.map((m) => m.messageType)),
            ],
          },

          raw: {
            messages: messages,
            type: baileysRawEvent?.type || 'notify',
            requestId: baileysRawEvent?.requestId,
          },

          processed: processedMessages,

          legacy: originalMessage
            ? {
                messageId: originalMessage.messageId,
                from: originalMessage.sender?.id,
                fromName: originalMessage.sender?.name,
                to: originalMessage.chat?.id,
                toName: originalMessage.chat?.name,
                isGroup: originalMessage.chat?.isGroup || false,
                messageType: originalMessage.messageType,
                content: originalMessage.content,
                timestamp: originalMessage.timestamp,
                mediaUrl: originalMessage.mediaDownload,
              }
            : null,
        };
        break;

      case 'messages.update':
        payload.data = baileysRawEvent;
        break;

      case 'messages.delete':
        payload.data = baileysRawEvent;
        break;

      case 'group-participants.update':
        payload.data = baileysRawEvent;
        break;

      case 'connection.update':
        payload.data = baileysRawEvent;
        break;

      default:
        payload.data = baileysRawEvent || originalMessage;
    }


    let filteredWebhooks = webhooksList;

    if (eventType === 'messages.upsert' && payload.data.messages) {
      const hasGroupMessage = payload.data.messages.some((msg) => {
        const jid = msg.key?.remoteJid;
        return jid && isJidGroup(jid);
      });

      if (hasGroupMessage) {
        filteredWebhooks = webhooksList.filter(
          (webhook) => !webhook.ignoreGroups
        );
      }
    }

    if (filteredWebhooks.length === 0) {
      return;
    }


    const webhookPromises = filteredWebhooks.map(async (webhook) => {
      try {

        let finalPayload = payload;

        if (webhook.selectedFields && webhook.selectedFields.length > 0) {

          finalPayload = {
            event: eventType,
            session: sessionId,
            timestamp: Date.now(),
            data: null,
          };

          if (eventType === 'messages.upsert' && payload.data.processed) {
            const customMessages = payload.data.processed.map((msg, index) => {
              const customMsg = {};


              const rawMessage = payload.data.raw.messages[index];
              const matchingOriginalMessage =
                originalMessage && originalMessage.messageId === msg.messageId
                  ? originalMessage
                  : null;


              webhook.selectedFields.forEach((field) => {
                switch (field) {
                  case 'key':
                    customMsg.key = msg.key;
                    break;
                  case 'remoteJid':
                    customMsg.remoteJid = msg.key?.remoteJid;
                    break;
                  case 'previousRemoteJid':
                    customMsg.previousRemoteJid = msg.key?.previousRemoteJid;
                    break;
                  case 'senderPn':
                    customMsg.senderPn = msg.key?.senderPn;
                    break;
                  case 'isBusinessAccount':
                    customMsg.isBusinessAccount = msg.isBusinessAccount;
                    break;
                  case 'id':
                    customMsg.id = msg.messageId;
                    break;
                  case 'fromMe':
                    customMsg.fromMe = msg.fromMe;
                    break;
                  case 'conversation':
                    customMsg.conversation = msg.text;
                    break;
                  case 'messageType':
                    customMsg.messageType = msg.messageType;
                    break;
                  case 'pushName':
                    customMsg.pushName = msg.pushName;
                    break;
                  case 'mediaUrl':

                    customMsg.mediaUrl =
                      msg.mediaDownload?.downloadUrl || msg.media?.url || null;
                    break;
                  case 'timestamp':
                    customMsg.timestamp = msg.timestamp;
                    break;
                  case 'participant':
                    customMsg.participant = msg.key?.participant;
                    break;
                  case 'quotedMessage':
                    customMsg.quotedMessage = msg.quotedMessage;
                    break;
                  case 'isGroup':
                    customMsg.isGroup = msg.isGroup;
                    break;
                  case 'groupName':

                    customMsg.groupName = msg.isGroup
                      ? global.whatsappSessions?.[sessionId]?.groupName || null
                      : null;
                    break;
                }
              });

              return customMsg;
            });

            finalPayload.data = {
              messages: customMessages,
              selectedFields: webhook.selectedFields,
            };
          } else {

            finalPayload.data = payload.data;
          }
        }


        if (
          webhook.fieldMapping &&
          Object.keys(webhook.fieldMapping).length > 0
        ) {
          finalPayload = applyFieldMapping(finalPayload, webhook.fieldMapping);
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FlowChat-Webhook/2.0',
            'X-Webhook-Version': 'v2',
            'X-Session-ID': sessionId,
            'X-Event-Type': eventType,
            'X-Selected-Fields': webhook.selectedFields
              ? webhook.selectedFields.join(',')
              : 'all',
            'X-Field-Mapping': webhook.fieldMapping
              ? JSON.stringify(webhook.fieldMapping)
              : 'none',
          },
          body: JSON.stringify(finalPayload),
          timeout: 15000,
        });

        if (response.ok) {
          logger.debug(`Webhook v2 ${webhook.name} sent successfully`);
          return { success: true, webhook: webhook.id };
        } else {
          logger.warn(`Webhook v2 ${webhook.name} failed: ${response.status}`);
          return {
            success: false,
            webhook: webhook.id,
            error: response.status,
          };
        }
      } catch (error) {
        logger.error(`Webhook v2 ${webhook.name} error: ${error.message}`);
        return { success: false, webhook: webhook.id, error: error.message };
      }
    });

    await Promise.allSettled(webhookPromises);
  } catch (error) {
    logger.error(`Error in sendWebhookV2Direct: ${error.message}`);
  }
}

/**
 * Sends a v2 webhook directly.
 * @param {string} sessionId - The ID of the session.
 * @param {string} eventType - The type of the event.
 * @param {object} originalMessage - The original message object.
 * @param {object} baileysRawEvent - The raw Baileys event.
 * @param {Array<object>} webhooksList - The list of webhooks to send to.
 * @returns {Promise<void>}
 */
async function sendWebhooksByVersion(
  sessionId,
  eventType,
  processedData,
  baileysRawEvent = null
) {
  try {

    const activeWebhooks = await getActiveWebhooksFromDB(sessionId, eventType);

    if (activeWebhooks.length === 0) {
      logger.debug(
        `No active webhooks found for session ${sessionId}, event: ${eventType}`
      );
      return;
    }


    const v1Webhooks = activeWebhooks.filter(
      (webhook) => !webhook.version || webhook.version === 'v1'
    );
    const v2Webhooks = activeWebhooks.filter(
      (webhook) => webhook.version === 'v2'
    );

    logger.info(
      `Session ${sessionId} webhooks: ${v1Webhooks.length} v1, ${v2Webhooks.length} v2 for event ${eventType}`
    );


    if (v1Webhooks.length > 0) {
      await sendWebhookV1Direct(
        sessionId,
        eventType,
        processedData,
        v1Webhooks
      );
    }


    if (v2Webhooks.length > 0) {
      await sendWebhookV2Direct(
        sessionId,
        eventType,
        processedData,
        baileysRawEvent,
        v2Webhooks
      );
    }
  } catch (error) {
    logger.error(
      `Error in sendWebhooksByVersion for session ${sessionId}: ${error.message}`
    );
  }
}


const DOWNLOADS_COLLECTION = 'downloaded_files';


/**
 * Creates indexes for the downloads collection in the database.
 * @returns {Promise<void>}
 */
async function createDownloadIndexes() {
  try {
    const db = database.getDb();
    if (!db) {
      logger.warn('MongoDB não disponível - índices de download não criados');
      return;
    }

    const collection = db.collection(DOWNLOADS_COLLECTION);


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


setTimeout(createDownloadIndexes, 5000);


logger.info(
  '🔄 Sistema de downloads migrado para MongoDB - metadados persistidos permanentemente'
);

/**
 * Saves download metadata to the database.
 * @param {object} downloadMetadata - The download metadata.
 * @returns {Promise<boolean>} True if the metadata was saved successfully, false otherwise.
 */
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

/**
 * Gets download metadata from the database.
 * @param {string} downloadId - The ID of the download.
 * @returns {Promise<object|null>} The download metadata, or null if not found.
 */
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

/**
 * Deletes download metadata from the database.
 * @param {string} downloadId - The ID of the download.
 * @returns {Promise<boolean>} True if the metadata was deleted successfully, false otherwise.
 */
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

/**
 * Gets all expired downloads from the database.
 * @returns {Promise<Array<object>>} An array of expired downloads.
 */
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

/**
 * Gets all downloads from the database.
 * @param {string|null} sessionId - The ID of the session to filter by.
 * @returns {Promise<Array<object>>} An array of downloads.
 */
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


/**
 * Cleans up expired files from the disk and database.
 * @returns {Promise<void>}
 */
async function cleanupExpiredFiles() {
  const fs = require('fs');
  let cleanedCount = 0;

  try {

    const expiredDownloads = await getExpiredDownloads();

    for (const metadata of expiredDownloads) {
      try {

        if (fs.existsSync(metadata.filePath)) {
          fs.unlinkSync(metadata.filePath);
          cleanedCount++;
        }


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


setInterval(cleanupExpiredFiles, 6 * 60 * 60 * 1000);


setTimeout(cleanupExpiredFiles, 60 * 1000);

/**
 * Generates a unique download ID.
 * @returns {string} The download ID.
 */
function generateDownloadId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${random}`;
}

/**
 * Gets the file extension for a given mimetype.
 * @param {string} mimetype - The mimetype.
 * @param {string|null} messageType - The message type.
 * @param {boolean} isPtt - Whether the audio is a push-to-talk message.
 * @returns {string} The file extension.
 */
function getFileExtension(mimetype, messageType = null, isPtt = false) {
  const mimeToExt = {

    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',


    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/3gpp': '3gp',
    'video/x-ms-wmv': 'wmv',


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


    'audio/mp4; codecs=opus': 'opus',
    'audio/ogg; codecs=opus': 'opus',
    'audio/webm; codecs=opus': 'opus',


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


    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
  };


  if (isPtt || messageType === 'audio') {

    if (
      !mimetype ||
      mimetype.includes('application/octet-stream') ||
      mimetype === 'application/ogg'
    ) {
      return 'ogg';
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

    return 'ogg';
  }


  if (mimetype) {

    const lowerMime = mimetype.toLowerCase();

    if (lowerMime.includes('image')) {
      if (lowerMime.includes('jpeg') || lowerMime.includes('jpg')) return 'jpg';
      if (lowerMime.includes('png')) return 'png';
      if (lowerMime.includes('gif')) return 'gif';
      if (lowerMime.includes('webp')) return 'webp';
      return 'jpg';
    }

    if (lowerMime.includes('video')) {
      if (lowerMime.includes('mp4')) return 'mp4';
      if (lowerMime.includes('webm')) return 'webm';
      if (lowerMime.includes('quicktime') || lowerMime.includes('mov'))
        return 'mov';
      return 'mp4';
    }

    if (lowerMime.includes('audio')) {
      if (lowerMime.includes('mpeg') || lowerMime.includes('mp3')) return 'mp3';
      if (lowerMime.includes('mp4') || lowerMime.includes('m4a')) return 'm4a';
      if (lowerMime.includes('ogg')) return 'ogg';
      if (lowerMime.includes('opus')) return 'opus';
      if (lowerMime.includes('wav')) return 'wav';
      return 'mp3';
    }
  }


  const exactMatch = mimeToExt[mimetype];
  if (exactMatch) {
    return exactMatch;
  }


  if (messageType === 'image') return 'jpg';
  if (messageType === 'video') return 'mp4';
  if (messageType === 'audio') return 'ogg';
  if (messageType === 'document') return 'pdf';
  if (messageType === 'sticker') return 'webp';

  return 'bin';
}


/**
 * Downloads media from a message and saves it to a file.
 * @param {object} sock - The Baileys socket instance.
 * @param {object} message - The message object.
 * @param {string} sessionId - The ID of the session.
 * @returns {Promise<object>} An object with the result of the download.
 */
async function downloadMediaToFile(sock, message, sessionId) {
  try {
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const fs = require('fs');
    const path = require('path');

    logger.info(
      `🔍 Iniciando download de mídia para sessão ${sessionId}, mensagem ${message.key.id}`
    );


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


    if (!messageType) {
      logger.warn('Tipo de mídia não identificado na mensagem');
      return {
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Tipo de mídia não suportado ou não identificado',
      };
    }


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


    const downloadId = generateDownloadId();
    const fileExtension = getFileExtension(mimetype, messageType, isPtt);


    let fileName;
    if (originalFileName) {

      fileName = originalFileName;
    } else if (isPtt) {

      fileName = `voice_${downloadId}.${fileExtension}`;
    } else if (messageType === 'audio') {

      fileName = `audio_${downloadId}.${fileExtension}`;
    } else {

      fileName = `${messageType}_${downloadId}.${fileExtension}`;
    }

    const safeFileName = `${downloadId}_${fileName.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )}`;


    if (isPtt || messageType === 'audio') {
      logger.info(
        `📁 Arquivo de áudio: ${fileName} (${fileExtension}) - PTT: ${isPtt}`
      );
    }


    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }


    const filePath = path.join(downloadsDir, safeFileName);


    fs.writeFileSync(filePath, buffer);


    const baseUrl =
      process.env.CORS_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;
    const serverUrl = baseUrl.replace('5173', process.env.PORT || '3000');


    const downloadUrl = `${serverUrl}/api/baileys/download/${downloadId}`;


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
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };


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

/**
 * Downloads media from a message and returns it as a base64 string.
 * @param {object} sock - The Baileys socket instance.
 * @param {object} message - The message object.
 * @returns {Promise<object>} An object with the base64 string or an error.
 */
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


/**
 * Extracts all relevant data from a message.
 * @param {object} message - The message object.
 * @param {object|null} sock - The Baileys socket instance.
 * @returns {Promise<object|null>} The extracted message data, or null if invalid.
 */
async function extractMessageData(message, sock = null) {
  const isGroup = message.key.remoteJid?.endsWith('@g.us') || false;
  const isBusinessAccount =
    message.key.previousRemoteJid?.includes('@lid') || false;

  const messageData = {
    messageId: message.key.id,
    timestamp: message.messageTimestamp,
    key: message.key || {},
    messageType: null,
    content: null,
    quotedMessage: null,
    mediaData: null,
    mediaDownload: null,


    chat: {
      id: message.key.remoteJid,
      previousId: message.key.previousRemoteJid || null,
      type: isGroup ? 'group' : 'private',
      isGroup: isGroup,
      isBusinessAccount: isBusinessAccount,
    },


    sender: {
      id: isGroup ? message.key.participant : message.key.remoteJid,
      pushName: message.pushName,
      isMe: message.key.fromMe,
      senderPn: message.key.senderPn || null,
    },


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
      unknownData: null,

      isBusinessAccount: isBusinessAccount,
      previousRemoteJid: message.key.previousRemoteJid || null,
      senderPn: message.key.senderPn || null,
    },
  };


  const extractUrls = (text) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };


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


  const checkForwarded = (contextInfo) => {
    return !!(
      contextInfo &&
      (contextInfo.forwardingScore > 0 || contextInfo.isForwarded)
    );
  };


  const extractMediaDetails = (mediaMsg, mediaType) => {
    const details = {
      fileLength: mediaMsg.fileLength || null,
      mimetype: mediaMsg.mimetype || null,
      fileSha256: mediaMsg.fileSha256
        ? mediaMsg.fileSha256.toString('base64')
        : null,
      fileEncSha256: mediaMsg.fileEncSha256
        ? mediaMsg.fileEncSha256.toString('base64')
        : null,
      mediaKey: mediaMsg.mediaKey ? mediaMsg.mediaKey.toString('base64') : null,
      directPath: mediaMsg.directPath || null,
      url: mediaMsg.url || null,
      width: mediaMsg.width || null,
      height: mediaMsg.height || null,
      duration: mediaMsg.seconds || null,
    };


    if (mediaType === 'audio') {
      details.ptt = mediaMsg.ptt || false;
      details.waveform = mediaMsg.waveform
        ? Array.from(mediaMsg.waveform)
        : null;
    } else if (mediaType === 'document') {
      details.fileName = mediaMsg.fileName || null;
      details.title = mediaMsg.title || null;
      details.pageCount = mediaMsg.pageCount || null;
    } else if (mediaType === 'sticker') {
      details.isAnimated = mediaMsg.isAnimated || false;
    }

    return details;
  };


  const extractQuotedMessage = (contextInfo) => {
    if (!contextInfo?.quotedMessage || !contextInfo.stanzaId) return null;

    const quoted = contextInfo.quotedMessage;
    let quotedContent = '';
    let quotedType = 'unknown';
    let quotedMediaData = null;


    if (quoted.conversation) {
      quotedContent = quoted.conversation;
      quotedType = 'text';
    } else if (quoted.extendedTextMessage) {
      quotedContent = quoted.extendedTextMessage.text;
      quotedType = 'text';
    }

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
      id: contextInfo.stanzaId,
      messageId: contextInfo.stanzaId,
      participant: contextInfo.participant,
      remoteJid: contextInfo.remoteJid,
      content: quotedContent,
      text: quotedContent,
      messageType: quotedType,
      mediaData: quotedMediaData,
      fromMe: contextInfo.participant === message.key.remoteJid,

      isForwarded: contextInfo.isForwarded || false,
      forwardingScore: contextInfo.forwardingScore || 0,
      mentions: contextInfo.mentionedJid || [],
    };
  };


  if (message.message) {
    if (message.message.conversation) {
      messageData.messageType = 'text';
      messageData.content = message.message.conversation;


      messageData.metadata.urls = extractUrls(messageData.content);
      messageData.metadata.mentions = extractMentions(messageData.content);
    } else if (message.message.extendedTextMessage) {
      messageData.messageType = 'text';
      messageData.content = message.message.extendedTextMessage.text;


      messageData.metadata.urls = extractUrls(messageData.content);


      if (message.message.extendedTextMessage.contextInfo) {
        const contextInfo = message.message.extendedTextMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(
          messageData.content,
          contextInfo
        );
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }
    } else if (message.message.imageMessage) {
      messageData.messageType = 'image';
      messageData.content = message.message.imageMessage.caption || '';
      messageData.metadata.caption =
        message.message.imageMessage.caption || null;


      messageData.metadata.urls = extractUrls(messageData.content);


      messageData.mediaData = {
        mimetype: message.message.imageMessage.mimetype,
        fileSha256: message.message.imageMessage.fileSha256?.toString('base64'),
        fileLength: message.message.imageMessage.fileLength,
        width: message.message.imageMessage.width,
        height: message.message.imageMessage.height,
      };


      messageData.metadata.mediaDetails = extractMediaDetails(
        message.message.imageMessage,
        'image'
      );


      if (message.message.imageMessage.contextInfo) {
        const contextInfo = message.message.imageMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(
          messageData.content,
          contextInfo
        );
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }


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
      messageData.metadata.caption =
        message.message.videoMessage.caption || null;


      messageData.metadata.urls = extractUrls(messageData.content);

      messageData.mediaData = {
        mimetype: message.message.videoMessage.mimetype,
        fileSha256: message.message.videoMessage.fileSha256?.toString('base64'),
        fileLength: message.message.videoMessage.fileLength,
        width: message.message.videoMessage.width,
        height: message.message.videoMessage.height,
        seconds: message.message.videoMessage.seconds,
      };


      messageData.metadata.mediaDetails = extractMediaDetails(
        message.message.videoMessage,
        'video'
      );


      if (message.message.videoMessage.contextInfo) {
        const contextInfo = message.message.videoMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(
          messageData.content,
          contextInfo
        );
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }


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


      messageData.metadata.mediaDetails = extractMediaDetails(
        message.message.audioMessage,
        'audio'
      );


      if (message.message.audioMessage.contextInfo) {
        const contextInfo = message.message.audioMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }


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
      messageData.metadata.caption =
        message.message.documentMessage.caption || null;


      messageData.metadata.urls = extractUrls(messageData.content);

      messageData.mediaData = {
        mimetype: message.message.documentMessage.mimetype,
        fileSha256:
          message.message.documentMessage.fileSha256?.toString('base64'),
        fileLength: message.message.documentMessage.fileLength,
        fileName: message.message.documentMessage.fileName,
        title: message.message.documentMessage.title,
      };


      messageData.metadata.mediaDetails = extractMediaDetails(
        message.message.documentMessage,
        'document'
      );


      if (message.message.documentMessage.contextInfo) {
        const contextInfo = message.message.documentMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(
          messageData.content,
          contextInfo
        );
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }


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


      messageData.metadata.mediaDetails = extractMediaDetails(
        message.message.stickerMessage,
        'sticker'
      );


      if (message.message.stickerMessage.contextInfo) {
        const contextInfo = message.message.stickerMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }


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


      messageData.metadata.contactData = messageData.content;


      if (message.message.contactMessage.contextInfo) {
        const contextInfo = message.message.contactMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


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


      messageData.metadata.locationData = messageData.content;


      if (message.message.locationMessage.contextInfo) {
        const contextInfo = message.message.locationMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


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


      messageData.metadata.locationData = messageData.content;
      messageData.metadata.caption =
        message.message.liveLocationMessage.caption || null;


      messageData.metadata.urls = extractUrls(
        messageData.content.caption || ''
      );


      if (message.message.liveLocationMessage.contextInfo) {
        const contextInfo = message.message.liveLocationMessage.contextInfo;
        messageData.metadata.mentions = extractMentions(
          messageData.content.caption || '',
          contextInfo
        );
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


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


      messageData.metadata.contactsData = messageData.content;


      if (message.message.contactsArrayMessage.contextInfo) {
        const contextInfo = message.message.contactsArrayMessage.contextInfo;
        messageData.metadata.mentions = extractMentions('', contextInfo);
        messageData.metadata.forwarded = checkForwarded(contextInfo);
        if (contextInfo.ephemeralExpiration) {
          messageData.metadata.ephemeral = contextInfo.ephemeralExpiration;
        }


        if (contextInfo.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
      }
    } else if (message.message.protocolMessage) {

      logger.debug(
        `Mensagem de protocolo ignorada: ${message.message.protocolMessage.type}`
      );
      return null;
    } else if (
      message.message.senderKeyDistributionMessage ||
      message.message.fastRatchetKeySenderKeyDistributionMessage
    ) {

      logger.debug('Mensagem de distribuição de chave ignorada');
      return null;
    } else {

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
        rawMessage: message.message,
      };
    }
  }

  return messageData;
}


/**
 * Creates a proxy agent from a proxy configuration.
 * @param {object} proxyConfig - The proxy configuration.
 * @returns {HttpsProxyAgent|SocksProxyAgent|null} The proxy agent, or null if not applicable.
 */
function createProxyAgent(proxyConfig) {
  if (!proxyConfig || !proxyConfig.enabled) {
    return null;
  }

  try {
    const { type, host, port, username, password } = proxyConfig;

    if (!host || !port) {
      logger.warn(
        'Configuração de proxy incompleta: host e port são obrigatórios'
      );
      return null;
    }

    let proxyUrl;
    if (username && password) {
      proxyUrl = `${type}://${username}:${password}@${host}:${port}`;
    } else {
      proxyUrl = `${type}://${host}:${port}`;
    }

    logger.info(`Criando agent de proxy: ${type}://${host}:${port}`);

    switch (type.toLowerCase()) {
      case 'http':
      case 'https':
        return new HttpsProxyAgent(proxyUrl);
      case 'socks4':
      case 'socks5':
        return new SocksProxyAgent(proxyUrl);
      default:
        logger.error(`Tipo de proxy não suportado: ${type}`);
        return null;
    }
  } catch (error) {
    logger.error(`Erro ao criar agent de proxy: ${error.message}`);
    return null;
  }
}

/**
 * Creates a new WhatsApp session.
 * @param {string} sessionId - The ID of the session.
 * @param {string|null} userId - The ID of the user.
 * @param {object|null} proxyConfig - The proxy configuration.
 * @param {string} pairingMethod - The pairing method ('qr' or 'code').
 * @param {string|null} phoneNumber - The phone number for pairing code.
 * @returns {Promise<object>} An object with the result of the session creation.
 */
async function createWhatsAppSession(
  sessionId,
  userId = null,
  proxyConfig = null,
  pairingMethod = 'qr',
  phoneNumber = null
) {
  try {
    if (sessions.has(sessionId)) {
      return { success: false, message: 'Sessão já existe' };
    }

    const authDir = `./auth_sessions/${sessionId}`;
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);


    const proxyAgent = createProxyAgent(proxyConfig);
    const { version, isLatest } = await fetchLatestBaileysVersion();



    const msgRetryCounterCache = new Map();


    const socketConfig = {
      auth: {
        creds: state.creds,

        keys: makeCacheableSignalKeyStore(state.keys, logger.child({ session: sessionId })),
      },
      version,
      logger: logger.child({ session: sessionId }),
      msgRetryCounterCache,
      fireInitQueries: true,
      qrTimeout: 45_000,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      defaultQueryTimeoutMs: 60000,

      generateHighQualityLinkPreview: true,
      syncFullHistory: false,

      shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: (jid) => false,

      getMessage: async (key) => {
        const messageData = getMessageById(sessionId, key.id);
        return messageData?.message || undefined;
      },

      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      emitOwnEvents: false,
    };


    if (proxyAgent) {
      socketConfig.agent = proxyAgent;
      logger.info(
        `Sessão ${sessionId} configurada com proxy: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`
      );
    }

    const sock = makeWASocket(socketConfig);

    let qrCode = null;
    let pairingCode = null;
    let isConnected = false;
    let connectionState = 'connecting';

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;

        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.qrCode = qr;
          sessionData.isConnected = false;
          sessionData.connectionState = 'qr_generated';


          try {
            const QRCode = require('qrcode');
            sessionData.qrCodeImage = await QRCode.toDataURL(qr);


            await saveQRCodeData(sessionId, qr, sessionData.qrCodeImage);
          } catch (error) {
            logger.error(`Erro ao gerar QR code imagem: ${error.message}`);
          }
        }
        logger.info(`QR Code gerado para sessão ${sessionId}`);


        await sendWebhookV2(sessionId, 'connection.update', null, update);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';

        logger.info(
          `Conexão fechada para ${sessionId}. Status: ${statusCode}, Erro: ${errorMessage}`
        );


        const isStreamError =
          errorMessage.includes('Stream Errored') || statusCode === 515;


        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          statusCode !== 401 &&
          statusCode !== DisconnectReason.forbidden &&
          statusCode !== DisconnectReason.badSession;


        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.isConnected = false;
          sessionData.connectionState = 'disconnected';
          sessionData.lastError = errorMessage;
          sessionData.lastDisconnectTime = new Date();
        }



        if (shouldReconnect) {

          logger.warn(
            `Reconexão necessária para ${sessionId}. Motivo: ${errorMessage} (Status: ${statusCode})`
          );


          const attempts = reconnectionAttempts.get(sessionId) || 0;

          if (attempts < RECONNECTION_CONFIG.MAX_ATTEMPTS) {
            reconnectionAttempts.set(sessionId, attempts + 1);


            let retryDelay;
            if (isStreamError || statusCode === 401) {

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

                await delay(1000);


                const currentSession = sessions.get(sessionId);
                const userId = currentSession?.userId || null;


                sessions.delete(sessionId);
                sessionQueues.delete(sessionId);
                messageRateLimit.delete(sessionId);


                await createWhatsAppSession(sessionId, userId);
              } catch (error) {
                logger.error(
                  `Erro na reconexão da sessão ${sessionId}: ${error.message}`
                );


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


        reconnectionAttempts.delete(sessionId);


        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.isConnected = true;
          sessionData.connectionState = 'connected';
          sessionData.qrCode = null;
          sessionData.qrCodeImage = null;
          sessionData.lastError = null;
          sessionData.connectedAt = new Date();


          await clearQRCodeData(sessionId);


          await saveSessionData(sessionId, sessionData);
        }
        logger.info(`Sessão ${sessionId} conectada com sucesso`);


        await sendWebhookV2(sessionId, 'connection.update', null, update);
      } else if (connection === 'connecting') {
        connectionState = 'connecting';
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.connectionState = 'connecting';
        }


        await sendWebhookV2(sessionId, 'connection.update', null, update);
      }
    });

    sock.ev.on('creds.update', (creds) => {

      if (creds.pairingCode && pairingMethod === 'code') {
        pairingCode = creds.pairingCode;
        logger.info(
          `Código de pareamento gerado para sessão ${sessionId}: ${pairingCode}`
        );


        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.pairingCode = pairingCode;
          sessionData.connectionState = 'pairing_code_generated';
        }
      }


      saveCreds(creds);
    });


    sock.ev.on('messages.upsert', async (messageUpdate) => {
      const { messages } = messageUpdate;

      for (const message of messages) {

        if (message.key.remoteJid?.includes('@lid') && message.key.senderPn) {

          message.key.previousRemoteJid = message.key.remoteJid;

          message.key.remoteJid = message.key.senderPn;

          logger.info(
            `@lid processado - Original JID: ${message.key.previousRemoteJid}, Novo JID: ${message.key.remoteJid}`
          );
        }


        if (message.key?.id) {
          storeMessage(sessionId, message.key.id, message);
        }


        const messageData = await extractMessageData(message, sock);


        logger.info(
          `Current webhooks in memory: ${JSON.stringify(
            Array.from(webhooks.entries())
          )}`
        );


        if (messageData !== null) {
          await sendWebhooksByVersion(
            sessionId,
            'messages.upsert',
            messageData,
            messageUpdate
          );
        } else {
          logger.debug(
            `Mensagem ignorada para webhook - SessionID: ${sessionId}, MessageID: ${message.key?.id}`
          );
        }


        if (global.messageCollectorHook && message) {
          global.messageCollectorHook(message, sessionId);
        }

        if (!message.key.fromMe && message.message) {

          await handleMessageParts(sock, message, sessionId);
        }
      }
    });


    sock.ev.on('messages.update', async (messageUpdates) => {
      for (const update of messageUpdates) {

        if (update.key?.remoteJid?.includes('@lid') && update.key.senderPn) {
          update.key.previousRemoteJid = update.key.remoteJid;
          update.key.remoteJid = update.key.senderPn;
        }

        logger.info(
          `Message update received for session ${sessionId}:`,
          update
        );

        const updateData = {
          messageKey: update.key,
          update: update.update || {},
          timestamp: Date.now(),
          sessionId: sessionId,
        };

        await sendWebhooksByVersion(sessionId, 'messages.update', updateData, [
          update,
        ]);
      }
    });


    sock.ev.on('messages.delete', async (deleteEvent) => {
      logger.info(`Messages deleted for session ${sessionId}:`, deleteEvent);

      const deleteData = {
        ...deleteEvent,
        timestamp: Date.now(),
        sessionId: sessionId,
      };

      await sendWebhooksByVersion(
        sessionId,
        'messages.delete',
        deleteData,
        deletedMessages
      );
    });


    sock.ev.on('group-participants.update', async (groupUpdate) => {
      logger.info(
        `Group participants update for session ${sessionId}:`,
        groupUpdate
      );

      const groupData = {
        groupId: groupUpdate.id,
        participants: groupUpdate.participants,
        action: groupUpdate.action,
        author: groupUpdate.author,
        timestamp: Date.now(),
        sessionId: sessionId,
      };

      await sendWebhooksByVersion(
        sessionId,
        'group-participants.update',
        groupData,
        groupUpdate
      );
    });


    const sessionData = {
      sock,
      qrCode,
      pairingCode,
      isConnected,
      connectionState,
      createdAt: new Date(),
      userId: userId,
      proxyConfig: proxyConfig,
      pairingMethod: pairingMethod,
      phoneNumber: phoneNumber,
    };

    sessions.set(sessionId, sessionData);


    await saveSessionData(sessionId, sessionData);


    if (
      pairingMethod === 'code' &&
      phoneNumber &&
      !sock.authState.creds.registered
    ) {

      const cleanPhone = phoneNumber.replace(/\D/g, '');
      try {
        logger.info(
          `Solicitando código de pareamento para ${cleanPhone} (original: ${phoneNumber}) na sessão ${sessionId}`
        );
        const generatedCode = await sock.requestPairingCode(cleanPhone);
        pairingCode = generatedCode;


        sessionData.pairingCode = pairingCode;
        sessionData.connectionState = 'pairing_code_generated';
        sessions.set(sessionId, sessionData);

        logger.info(`Código de pareamento gerado: ${pairingCode}`);
      } catch (error) {
        logger.error(
          `Erro ao solicitar código de pareamento: ${error.message}`
        );
      }
    } else if (
      pairingMethod === 'code' &&
      phoneNumber &&
      sock.authState.creds.registered
    ) {
      logger.info(
        `Sessão ${sessionId} já está registrada, código de pareamento não necessário`
      );
      sessionData.connectionState = 'already_registered';
    }


    let message = 'Sessão criada com sucesso';
    if (pairingMethod === 'code' && phoneNumber) {
      if (sock.authState.creds.registered) {
        message = 'Sessão já registrada, conexão estabelecida';
      } else if (pairingCode) {
        message = 'Código de pareamento gerado com sucesso';
      } else {
        message = 'Sessão criada, aguardando registro';
      }
    }

    return {
      success: true,
      message,
      qrCode: pairingMethod === 'qr' ? qrCode : null,
      pairingCode: pairingMethod === 'code' ? pairingCode : null,
      pairingMethod,
      phoneNumber: pairingMethod === 'code' ? phoneNumber : null,
      sessionId,
      isRegistered: sock.authState.creds.registered || false,
    };
  } catch (error) {
    logger.error(`Erro ao criar sessão ${sessionId}: ${error.message}`);
    return { success: false, message: error.message };
  }
}



/**
 * Handles multipart messages.
 * @param {object} sock - The Baileys socket instance.
 * @param {object} message - The message object.
 * @param {string} sessionId - The ID of the session.
 * @returns {Promise<void>}
 */
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


  if (!messageParts.has(senderKey)) {
    messageParts.set(senderKey, []);
  }


  const messagePart = {
    text: messageText,
    timestamp: Date.now(),
    messageKey: message.key,
    pushName: message.pushName || 'Usuário',
    senderId: senderId,
  };

  const parts = messageParts.get(senderKey);
  parts.push(messagePart);


  if (messageTimers.has(senderKey)) {
    clearTimeout(messageTimers.get(senderKey));
  }


  let waitTime = 8000;


  if (/[.!?:]$/.test(messageText.trim())) {
    waitTime = 5000;
  }


  if (messageText.length < 20) {
    waitTime = 10000;
  }


  if (parts.length > 3) {
    waitTime = 12000;
  }


  if (messageText.trim().endsWith('...')) {
    waitTime = 15000;
  }

  logger.info(
    `Mensagem ${parts.length} recebida de ${senderId}. Aguardando ${
      waitTime / 1000
    }s por mais mensagens...`
  );


  const timer = setTimeout(async () => {
    const currentParts = messageParts.get(senderKey) || [];
    if (currentParts.length > 0) {

      const fullText = currentParts.map((part) => part.text).join('\n');
      const firstMessage = currentParts[0];
      const lastMessage = currentParts[currentParts.length - 1];


      const completeMessage = {
        key: lastMessage.messageKey,
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


      await processCompleteMessage(
        sock,
        completeMessage,
        sessionId,
        currentParts
      );


      messageParts.set(senderKey, []);
    }
    messageTimers.delete(senderKey);
  }, waitTime);

  messageTimers.set(senderKey, timer);
}

/**
 * Checks if a message is from a group.
 * @param {object} message - The message object.
 * @returns {boolean} True if the message is from a group, false otherwise.
 */
function isMessageFromGroup(message) {
  const {
    isJidGroup,
    isJidBroadcast,
    isJidStatusBroadcast,
    isJidNewsletter,
  } = require('@whiskeysockets/baileys');

  const jid = message.key.remoteJid;
  const participant = message.key.participant;


  const isGroup = isJidGroup(jid);
  const isBroadcast = isJidBroadcast(jid);
  const isStatusBroadcast = isJidStatusBroadcast(jid);
  const isNewsletter = isJidNewsletter(jid);


  logger.debug(
    `Message analysis: jid=${jid}, participant=${participant}, isGroup=${isGroup}, isBroadcast=${isBroadcast}, isStatus=${isStatusBroadcast}, isNewsletter=${isNewsletter}`
  );


  return isGroup && !isBroadcast && !isStatusBroadcast && !isNewsletter;
}

/**
 * Processes a complete message after all parts have been received.
 * @param {object} sock - The Baileys socket instance.
 * @param {object} message - The message object.
 * @param {string} sessionId - The ID of the session.
 * @param {Array<object>} allMessageParts - An array of all message parts.
 * @returns {Promise<void>}
 */
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


    await delay(500 + Math.random() * 1500);


    const {
      getAgentFromDatabase,
      findAgentBySessionId,
    } = require('./routes/aiAgents');



    let activeAgent = await findAgentBySessionId(sessionId, true);


    if (activeAgent && !activeAgent.autoReply) {
      activeAgent = null;
    }


    if (activeAgent && HUMAN_BEHAVIOR.AUTO_MARK_READ) {

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

        await sock.readMessages([message.key]);
        logger.info(`✓ Mensagem marcada como lida`);
      }
    }


    const isGroupMessage = isMessageFromGroup(message);


    if (activeAgent && messageText.trim()) {

      if (isGroupMessage && !activeAgent.replyToGroups) {
        logger.info(
          `🚫 Agent ${activeAgent.id} SKIPPING group message from ${jid} (replyToGroups: ${activeAgent.replyToGroups})`
        );
        logger.debug(
          `Group verification details: jid=${jid}, isGroup=${isGroupMessage}, agentReplyToGroups=${activeAgent.replyToGroups}`
        );
        return;
      }


      if (isGroupMessage) {

        let contextInfo = null;
        if (message.message.extendedTextMessage?.contextInfo) {
          contextInfo = message.message.extendedTextMessage.contextInfo;
        } else if (message.message.imageMessage?.contextInfo) {
          contextInfo = message.message.imageMessage.contextInfo;
        } else if (message.message.videoMessage?.contextInfo) {
          contextInfo = message.message.videoMessage.contextInfo;
        } else if (message.message.audioMessage?.contextInfo) {
          contextInfo = message.message.audioMessage.contextInfo;
        } else if (message.message.documentMessage?.contextInfo) {
          contextInfo = message.message.documentMessage.contextInfo;
        } else if (message.message.stickerMessage?.contextInfo) {
          contextInfo = message.message.stickerMessage.contextInfo;
        }


        let isReplyingToAgent = false;
        if (contextInfo?.quotedMessage && contextInfo.stanzaId) {
          console.log(
            `🔍 Group message has quoted message - checking if replying to agent. Quoted ID: ${contextInfo.stanzaId}, Chat: ${jid}`
          );
          isReplyingToAgent = await activeAgent.isQuotedMessageFromAgent(
            contextInfo.stanzaId,
            jid
          );
          console.log(`📊 isReplyingToAgent result: ${isReplyingToAgent}`);
        }


        const isAgentMentioned = activeAgent.isAgentMentioned(messageText);


        if (!isReplyingToAgent && !isAgentMentioned) {
          return;
        }
      }
      try {

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
          quotedMessage: null,
        };


        let contextInfo = null;
        if (message.message.extendedTextMessage?.contextInfo) {
          contextInfo = message.message.extendedTextMessage.contextInfo;
        } else if (message.message.imageMessage?.contextInfo) {
          contextInfo = message.message.imageMessage.contextInfo;
        } else if (message.message.videoMessage?.contextInfo) {
          contextInfo = message.message.videoMessage.contextInfo;
        } else if (message.message.audioMessage?.contextInfo) {
          contextInfo = message.message.audioMessage.contextInfo;
        } else if (message.message.documentMessage?.contextInfo) {
          contextInfo = message.message.documentMessage.contextInfo;
        } else if (message.message.stickerMessage?.contextInfo) {
          contextInfo = message.message.stickerMessage.contextInfo;
        }

        if (contextInfo?.quotedMessage) {
          messageData.quotedMessage = extractQuotedMessage(contextInfo);
        }
        messageData.isMultiPart = allMessageParts.length > 1;
        messageData.partCount = allMessageParts.length;
        messageData.allMessageKeys = allMessageParts.map(
          (part) => part.messageKey
        );

        const aiResult = await activeAgent.processMessage(messageData, sock);

        if (
          aiResult &&
          aiResult.shouldReply &&
          aiResult.response &&
          aiResult.response.trim()
        ) {

          const responseDelay = 5000 + Math.random() * 5000;
          logger.info(
            `AI agent ${activeAgent.id} aguardando ${Math.round(
              responseDelay / 1000
            )}s antes de responder...`
          );
          await delay(responseDelay);


          const typingTime = Math.min(
            Math.max(
              aiResult.response.length * 50,
              HUMAN_BEHAVIOR.MIN_TYPING_TIME
            ),
            HUMAN_BEHAVIOR.MAX_TYPING_TIME
          );


          await sock.sendPresenceUpdate('composing', jid);
          await delay(typingTime);


          const quotedMessage = {
            key: message.key,
            message: message.message,
          };


          if (allMessageParts.length > 1) {
            logger.info(
              `Respondendo à sequência de ${allMessageParts.length} mensagens`
            );
          }

          const sentMessage = await sock.sendMessage(
            jid,
            {
              text: aiResult.response,
            },
            {
              quoted: quotedMessage,
            }
          );


          await sock.sendPresenceUpdate('available');


          if (sentMessage && sentMessage.key && sentMessage.key.id) {
            await activeAgent.updateConversationEntryWithMessageId(
              messageData.messageId,
              sentMessage.key.id,
              jid
            );
          }

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


        const fallbackResponse =
          'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
        const quotedMessage = {
          key: message.key,
          message: message.message,
        };


        if (
          activeAgent &&
          HUMAN_BEHAVIOR.AUTO_MARK_READ &&
          allMessageParts.length > 1
        ) {
          const messageKeys = allMessageParts.map((part) => part.messageKey);
          await sock.readMessages(messageKeys);
        }

        const fallbackSentMessage = await sock.sendMessage(
          jid,
          { text: fallbackResponse },
          { quoted: quotedMessage }
        );


        if (
          fallbackSentMessage &&
          fallbackSentMessage.key &&
          fallbackSentMessage.key.id
        ) {
          await activeAgent.updateConversationEntryWithMessageId(
            messageData.messageId,
            fallbackSentMessage.key.id,
            jid
          );
        }
      }
    } else {

    }
  } catch (error) {
    logger.error(`Erro ao processar mensagem recebida: ${error.message}`);
  }
}

/**
 * Downloads media from a message.
 * @param {object} sock - The Baileys socket instance.
 * @param {object} message - The message object.
 * @param {string} filename - The filename to save the media as.
 * @returns {Promise<object>} An object with the result of the download.
 */
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


/**
 * Middleware to handle dual authentication (API token or JWT).
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
const dualAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;


  if (authHeader && authHeader.startsWith('Bearer baileys_')) {
    return apiTokenAuth(req, res, next);
  }


  const { authenticateToken } = require('./middleware/auth');
  return authenticateToken(req, res, next);
};

/**
 * @swagger
 * /api/baileys/session/create:
 *   post:
 *     summary: Create a new WhatsApp session
 *     description: Creates a new WhatsApp session with the provided session ID.
 *     tags: [Session Management]
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
 *     responses:
 *       '200':
 *         description: The session was created successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '500':
 *         description: Internal server error.
 */
app.post('/api/baileys/session/create', dualAuth, async (req, res) => {
  try {
    const { sessionId, proxy, pairingMethod = 'qr', phoneNumber } = req.body;
    const userId = req.user?.id || req.user?._id;

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


    if (pairingMethod === 'code' && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Número de telefone é obrigatório quando usar pareamento por código',
      });
    }

    if (pairingMethod === 'code' && phoneNumber) {

      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return res.status(400).json({
          success: false,
          message: 'Número de telefone deve ter entre 10 e 15 dígitos',
        });
      }
    }

    if (!['qr', 'code'].includes(pairingMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Método de pareamento deve ser "qr" ou "code"',
      });
    }


    let proxyConfig = null;
    if (proxy && proxy.enabled) {
      const { type, host, port, username, password } = proxy;

      if (!host || !port) {
        return res.status(400).json({
          success: false,
          message:
            'Configuração de proxy inválida: host e port são obrigatórios',
        });
      }

      if (
        !['http', 'https', 'socks4', 'socks5'].includes(type?.toLowerCase())
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Tipo de proxy inválido. Tipos suportados: http, https, socks4, socks5',
        });
      }

      proxyConfig = {
        enabled: true,
        type: type.toLowerCase(),
        host,
        port: parseInt(port),
        username: username || null,
        password: password || null,
      };
    }


    const uniqueSessionId = `${userId}_${sessionId}`;

    const result = await createWhatsAppSession(
      uniqueSessionId,
      userId,
      proxyConfig,
      pairingMethod,
      phoneNumber
    );


    if (result.success) {

      let attempts = 0;
      const maxAttempts = 10;

      while (!result.qrCode && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const session = sessions.get(uniqueSessionId);
        if (session && session.qrCode) {
          result.qrCode = session.qrCode;
          break;
        }
        attempts++;
      }


      if (result.qrCode) {
        try {
          result.qrCodeImage = await QRCode.toDataURL(result.qrCode);

          const session = sessions.get(uniqueSessionId);
          if (session) {
            session.qrCodeImage = result.qrCodeImage;
          }
        } catch (error) {
          logger.error(`Erro ao gerar QR code imagem: ${error.message}`);
        }
      }
    }


    const response = {
      ...result,
      sessionId: sessionId,
      internalSessionId: uniqueSessionId,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/baileys/session/{sessionId}/regenerate-qr:
 *   post:
 *     summary: Regenerate the QR code for a session
 *     description: Regenerates the QR code for a specific WhatsApp session.
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The QR code was regenerated successfully.
 *       '400':
 *         description: Bad request, session already connected.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
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


      const userId = session.userId;


      try {
        if (session.sock) {
          await session.sock.logout();
        }
      } catch (error) {
        logger.warn(`Erro ao fechar sessão anterior: ${error.message}`);
      }


      sessions.delete(sessionId);
      sessionQueues.delete(sessionId);
      messageRateLimit.delete(sessionId);
      reconnectionAttempts.delete(sessionId);


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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/status:
 *   get:
 *     summary: Get the status of a session
 *     description: Retrieves the status of a specific WhatsApp session.
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The session status was retrieved successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
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

/**
 * @swagger
 * /api/baileys/sessions:
 *   get:
 *     summary: List all sessions
 *     description: Retrieves a list of all WhatsApp sessions for the authenticated user.
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A list of sessions.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '500':
 *         description: Internal server error.
 */
app.get('/api/baileys/sessions', (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
    }


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

/**
 * @swagger
 * /api/baileys/sessions/cleanup-orphaned:
 *   post:
 *     summary: Clean up orphaned sessions
 *     description: Cleans up orphaned sessions that are no longer associated with a user.
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: The orphaned sessions were cleaned up successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '500':
 *         description: Internal server error.
 */
app.post('/api/baileys/sessions/cleanup-orphaned', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
    }




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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/send-message:
 *   post:
 *     summary: Send a text message
 *     description: Sends a text message to a specific contact or group.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The message was sent successfully.
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/send-media:
 *   post:
 *     summary: Send a media message
 *     description: Sends a media message (image, video, audio, or document) to a specific contact or group.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *               media:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: The media message was sent successfully.
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


      const ext = path.extname(req.file.originalname).toLowerCase();
      const isVoiceMessage = voiceMessage === 'true' || voiceMessage === true;
      const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);


      if (isAudio && isVoiceMessage) {
        try {
          await session.sock.sendPresenceUpdate('recording', jid);
          logger.info(`Status "gravando" enviado para ${jid}`);


          const recordingTime = Math.floor(Math.random() * 4000) + 3000;
          await delay(recordingTime);
        } catch (presenceError) {
          logger.warn(
            `Erro ao enviar status de gravação: ${presenceError.message}`
          );

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
          ptt: isVoiceMessage,
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


      if (isAudio && isVoiceMessage) {
        try {
          await session.sock.sendPresenceUpdate('unavailable', jid);
          logger.info(`Status "gravando" removido para ${jid}`);


          await delay(1000);
          await session.sock.sendPresenceUpdate('available', jid);
          logger.info(`Status voltou para "disponível" para ${jid}`);
        } catch (presenceError) {
          logger.warn(
            `Erro ao remover status de gravação: ${presenceError.message}`
          );
        }


        if (caption && caption.trim()) {
          try {

            await delay(500);


            const captionResult = await queueMessage(
              sessionId,
              session.sock,
              jid,
              {
                text: caption.trim(),
              },
              result
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
          caption: isAudio && isVoiceMessage && caption ? '' : caption || '',
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


/**
 * @swagger
 * /api/baileys/session/{sessionId}/mention-all:
 *   post:
 *     summary: Mention all participants in a group
 *     description: Sends a message to a group mentioning all participants.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The message was sent successfully.
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


      const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;

      try {

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


          const zeroWidthSpace = '\u200B';
          const invisibleChar = '\u2800';
          const zwjoiner = '\u200D';


          const messageWithInvisibleMentions =
            message + zeroWidthSpace + invisibleChar + zwjoiner;

          result = await queueMessage(sessionId, session.sock, jid, {
            text: messageWithInvisibleMentions,
            mentions: participantIds,
          });
        } else {

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
            participantsReached: participants.length,
            participantsMentioned: participants.length,
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/download-media:
 *   post:
 *     summary: Download media from a message
 *     description: Downloads media from a specific message.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messageId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The media was downloaded successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or message not found.
 *       '500':
 *         description: Internal server error.
 */
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


      const messageData = getMessageById(sessionId, messageId);
      if (!messageData) {
        return res.status(404).json({
          success: false,
          message: 'Mensagem não encontrada',
        });
      }

      const message = messageData.message;


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


/**
 * @swagger
 * /api/baileys/download/{downloadId}:
 *   get:
 *     summary: Download a media file
 *     description: Downloads a media file that was previously downloaded from a message.
 *     tags: [Messaging]
 *     parameters:
 *       - in: path
 *         name: downloadId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The media file was downloaded successfully.
 *       '404':
 *         description: File not found or link expired.
 *       '410':
 *         description: Download link expired.
 *       '500':
 *         description: Internal server error.
 */
app.get('/api/baileys/download/:downloadId', async (req, res) => {
  try {
    const { downloadId } = req.params;
    const fs = require('fs');
    const path = require('path');


    const fileMetadata = await getDownloadMetadata(downloadId);
    if (!fileMetadata) {

      return res.status(404).send('Arquivo não encontrado ou link expirado');
    }


    const now = new Date();
    const expiresAt = new Date(fileMetadata.expiresAt);
    if (now > expiresAt) {

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


    if (!fs.existsSync(fileMetadata.filePath)) {
      await deleteDownloadMetadata(downloadId);
      return res.status(404).send('Arquivo não encontrado no servidor');
    }


    res.setHeader(
      'Content-Type',
      fileMetadata.mimetype || 'application/octet-stream'
    );
    res.setHeader('Content-Length', fileMetadata.size);


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


    res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Accept-Ranges', 'bytes');


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


    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition,X-File-Name,X-File-Type'
    );


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


    logger.info(
      `Arquivo baixado: ${fileMetadata.originalFileName} (${downloadId}) por IP: ${req.ip}`
    );
  } catch (error) {
    logger.error(`Erro na rota de download: ${error.message}`);
    res.status(500).send('Erro interno do servidor');
  }
});

/**
 * @swagger
 * /api/baileys/downloads:
 *   get:
 *     summary: List all downloaded files
 *     description: Retrieves a list of all downloaded files.
 *     tags: [Messaging]
 *     responses:
 *       '200':
 *         description: A list of downloaded files.
 *       '500':
 *         description: Internal server error.
 */
app.get('/api/baileys/downloads', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/mark-read:
 *   post:
 *     summary: Mark a message as read
 *     description: Marks a specific message as read.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jid:
 *                 type: string
 *               messageId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The message was marked as read successfully.
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/typing:
 *   post:
 *     summary: Set typing status
 *     description: Sets the typing status for a specific chat.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jid:
 *                 type: string
 *               isTyping:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: The typing status was set successfully.
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/reply-message:
 *   post:
 *     summary: Reply to a message
 *     description: Replies to a specific message.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messageId:
 *                 type: string
 *               reply:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The reply was sent successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or message not found.
 *       '500':
 *         description: Internal server error.
 */
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


      const originalMessage = getMessageById(sessionId, messageId);
      if (!originalMessage) {
        return res.status(404).json({
          success: false,
          message: 'Mensagem não encontrada',
        });
      }

      const jid = originalMessage.jid;


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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/messages:
 *   get:
 *     summary: Get messages from a session
 *     description: Retrieves a paginated list of messages from a specific session.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: A list of messages.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
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


        const messageEntries = Array.from(sessionMessages.entries());
        const totalInMemory = messageEntries.length;
        const paginatedEntries = messageEntries.slice(
          -parseInt(limit) - parseInt(offset),
          messageEntries.length - parseInt(offset)
        );


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
          messages: messages.reverse(),
          total: totalInMemory,
          source: 'memory',
          sessionId,
        });
      }


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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhook:
 *   post:
 *     summary: Set the webhook for a session (legacy)
 *     description: Sets the main webhook for a specific WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhookUrl:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The webhook was set successfully.
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


      try {
        new URL(webhookUrl);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'URL do webhook inválida',
        });
      }


      const duplicationCheck = await checkWebhookUrlDuplication(
        webhookUrl,
        sessionId,
        userId
      );

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


      await webhooksCollection.deleteMany({
        userId: userId,
        sessionId: sessionId,
        name: 'Principal',
      });


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


      const response = {
        success: true,
        message: 'Webhook configurado com sucesso',
        webhookUrl,
        sessionId,
        webhookInfo: {
          id: newWebhook.id,
          name: newWebhook.name,
          note: 'Endpoint legado - use /webhooks para gerenciamento completo',
        },
      };


      if (duplicationCheck.isDuplicate) {
        response.warning = {
          type: 'duplicate_url',
          message: duplicationCheck.message,
          duplicatedSessions: duplicationCheck.sessions.map((session) => ({
            sessionId: session.sessionId.substring(0, 8) + '...',
            webhookName: session.webhookName,
            createdAt: session.createdAt,
          })),
          recommendation:
            'Recomendamos usar URLs únicas para cada sessão para evitar eventos duplicados e facilitar o debugging.',
        };
      }

      res.json(response);
    } catch (error) {
      logger.error(`Erro ao configurar webhook: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhook:
 *   get:
 *     summary: Get the webhook for a session (legacy)
 *     description: Retrieves the main webhook for a specific WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The webhook was retrieved successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or webhook not found.
 *       '500':
 *         description: Internal server error.
 */
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


      const principalWebhook = await webhooksCollection.findOne({
        userId: userId,
        sessionId: sessionId,
        name: 'Principal',
      });

      if (!principalWebhook) {

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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhook:
 *   delete:
 *     summary: Delete the webhook for a session (legacy)
 *     description: Deletes the main webhook for a specific WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The webhook was deleted successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or webhook not found.
 *       '500':
 *         description: Internal server error.
 */
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


      const principalWebhook = await webhooksCollection.findOne({
        userId: userId,
        sessionId: sessionId,
        name: 'Principal',
      });

      let webhookToRemove = principalWebhook;

      if (!principalWebhook) {

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






/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks:
 *   get:
 *     summary: List all webhooks for a session
 *     description: Retrieves a list of all webhooks for a specific WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: A list of webhooks.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks:
 *   post:
 *     summary: Create a new webhook
 *     description: Creates a new webhook for a specific WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The webhook was created successfully.
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
app.post(
  '/api/baileys/session/:sessionId/webhooks',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const {
        name,
        url,
        active,
        priority,
        events,
        ignoreGroups,
        version,
        selectedFields,
      } = req.body;
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


      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'URL inválida',
        });
      }


      const duplicationCheck = await checkWebhookUrlDuplication(
        url,
        sessionId,
        userId
      );

      const db = database.getDb();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'Banco de dados não disponível',
        });
      }

      const webhooksCollection = db.collection('webhooks');


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


      const newWebhook = {
        id: crypto.randomUUID(),
        userId: userId,
        sessionId: sessionId,
        name: name || `Webhook ${existingCount + 1}`,
        url: url,
        active: active !== undefined ? active : true,
        priority: priority || existingCount + 1,
        events: events || [
          'messages.upsert',
          'messages.update',
          'messages.delete',
          'group-participants.update',
        ],
        ignoreGroups: ignoreGroups || false,
        version: version || 'v1',
        selectedFields: selectedFields || [],
        fieldMapping: req.body.fieldMapping || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await webhooksCollection.insertOne(newWebhook);


      const response = {
        success: true,
        message: 'Webhook adicionado com sucesso',
        webhook: {
          ...newWebhook,
          id: newWebhook.id,
        },
        sessionId,
      };


      if (duplicationCheck.isDuplicate) {
        response.warning = {
          type: 'duplicate_url',
          message: duplicationCheck.message,
          duplicatedSessions: duplicationCheck.sessions.map((session) => ({
            sessionId: session.sessionId.substring(0, 8) + '...',
            webhookName: session.webhookName,
            createdAt: session.createdAt,
          })),
          recommendation:
            'Recomendamos usar URLs únicas para cada sessão para evitar eventos duplicados e facilitar o debugging.',
        };
      }

      res.json(response);
    } catch (error) {
      logger.error(`Erro ao adicionar webhook: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);


/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}:
 *   get:
 *     summary: Get a specific webhook
 *     description: Retrieves a specific webhook for a WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The webhook was retrieved successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or webhook not found.
 *       '500':
 *         description: Internal server error.
 */
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}:
 *   put:
 *     summary: Update a webhook
 *     description: Updates a specific webhook for a WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       '200':
 *         description: The webhook was updated successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or webhook not found.
 *       '500':
 *         description: Internal server error.
 */
app.put(
  '/api/baileys/session/:sessionId/webhooks/:webhookId',
  apiTokenAuth,
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId, webhookId } = req.params;
      const {
        name,
        url,
        active,
        priority,
        events,
        ignoreGroups,
        version,
        selectedFields,
      } = req.body;
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


      const updateData = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (url !== undefined) updateData.url = url;
      if (active !== undefined) updateData.active = active;
      if (priority !== undefined) updateData.priority = priority;
      if (events !== undefined) updateData.events = events;
      if (ignoreGroups !== undefined) updateData.ignoreGroups = ignoreGroups;
      if (version !== undefined) updateData.version = version;
      if (selectedFields !== undefined)
        updateData.selectedFields = selectedFields;
      if (req.body.fieldMapping !== undefined)
        updateData.fieldMapping = req.body.fieldMapping;


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


      const updatedWebhook = await webhooksCollection.findOne({
        $and: [
          { userId: userId },
          { sessionId: sessionId },
          {
            $or: [{ id: webhookId }, { _id: webhookId }],
          },
        ],
      });


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


/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}:
 *   delete:
 *     summary: Delete a webhook
 *     description: Deletes a specific webhook for a WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The webhook was deleted successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or webhook not found.
 *       '500':
 *         description: Internal server error.
 */
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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}/toggle:
 *   patch:
 *     summary: Toggle a webhook
 *     description: Toggles the active status of a specific webhook for a WhatsApp session.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The webhook was toggled successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or webhook not found.
 *       '500':
 *         description: Internal server error.
 */
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


/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}/test:
 *   post:
 *     summary: Test a webhook
 *     description: Sends a test event to a specific webhook.
 *     tags: [Webhook Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The test event was sent successfully.
 *       '400':
 *         description: Bad request, failed to send test event.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or webhook not found.
 *       '500':
 *         description: Internal server error.
 */
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

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Baileys-API-Webhook-Test/1.0',
          },
          body: JSON.stringify(testPayload),
          timeout: 10000,
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


        try {
          const responseText = await response.text();
          if (responseText) {
            responseData.test.response = responseText.substring(0, 1000);
          }
        } catch (e) {

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


/**
 * Sends a message with advanced human-like behavior.
 * @param {object} sock - The Baileys socket instance.
 * @param {string} jid - The JID of the recipient.
 * @param {string|object} message - The message to send.
 * @param {object} options - The options for human-like behavior.
 * @returns {Promise<object>} The sent message object and behavior stats.
 */
async function sendMessageWithAdvancedHumanBehavior(
  sock,
  jid,
  message,
  options = {}
) {
  const {
    readingSpeed = 150,
    typingSpeed = 40,
    thinkingTime = true,
    naturalPauses = true,
    typoSimulation = false,
    emotionalDelay = true,
    contextAwareness = true,
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


    let readingTime = 0;
    if (options.replyToMessage && contextAwareness) {
      const replyMessageLength = options.replyToMessage.length || 0;
      const replyWordCount = options.replyToMessage.split(/\s+/).length || 0;

      readingTime = (replyWordCount / readingSpeed) * 60000;

      readingTime += Math.random() * 2000 + 1000;

      logger.info(
        `Simulando leitura de ${replyWordCount} palavras por ${readingTime.toFixed(
          0
        )}ms`
      );
      await delay(readingTime);
    }


    let thinkingDelay = 0;
    if (thinkingTime) {

      const complexityFactor = Math.min(wordCount / 10, 3);
      thinkingDelay = (1000 + Math.random() * 2000) * (1 + complexityFactor);


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
          thinkingDelay += Math.random() * 3000 + 1000;
        }
      }

      logger.info(`Tempo de reflexão: ${thinkingDelay.toFixed(0)}ms`);
      await delay(thinkingDelay);
    }


    const {
      getAgentFromDatabase,
      findAgentBySessionId,
    } = require('./routes/aiAgents');


    let activeAgent = await findAgentBySessionId(sessionId, true);


    if (activeAgent && !activeAgent.autoReply) {
      activeAgent = null;
    }

    if (activeAgent && HUMAN_BEHAVIOR.AUTO_MARK_READ) {
      await delay(300 + Math.random() * 200);
      await sock.readMessages([
        {
          remoteJid: jid,
          id: message.id || crypto.randomBytes(10).toString('hex'),
        },
      ]);
    }


    await sock.sendPresenceUpdate('composing', jid);


    let totalTypingTime = 0;

    if (naturalPauses && wordCount > 5) {

      const wordsPerChunk = Math.random() * 8 + 3;
      const chunks = Math.ceil(wordCount / wordsPerChunk);

      for (let i = 0; i < chunks; i++) {

        const chunkWords = Math.min(
          wordsPerChunk,
          wordCount - i * wordsPerChunk
        );
        const chunkTypingTime = (chunkWords / typingSpeed) * 60000;


        const variation = chunkTypingTime * 0.3;
        const actualChunkTime =
          chunkTypingTime + (Math.random() * variation * 2 - variation);

        totalTypingTime += actualChunkTime;


        await delay(actualChunkTime);


        if (i < chunks - 1) {

          const pauseDuration =
            Math.random() < 0.3
              ? Math.random() * 2000 + 1000
              : Math.random() * 800 + 200;

          await delay(pauseDuration);
          totalTypingTime += pauseDuration;
        }
      }
    } else {

      const baseTypingTime = (wordCount / typingSpeed) * 60000;
      const variation = baseTypingTime * 0.25;
      totalTypingTime =
        baseTypingTime + (Math.random() * variation * 2 - variation);


      totalTypingTime = Math.max(1000, Math.min(totalTypingTime, 15000));

      await delay(totalTypingTime);
    }


    if (typoSimulation && Math.random() < 0.15 && messageLength > 20) {

      logger.info('Simulando correção de erro de digitação...');


      await sock.sendPresenceUpdate('paused', jid);
      await delay(500 + Math.random() * 1000);
      await sock.sendPresenceUpdate('composing', jid);
      await delay(800 + Math.random() * 1200);

      totalTypingTime += 2000;
    }


    await sock.sendPresenceUpdate('paused', jid);


    const finalPause = Math.random() * 500 + 300;
    await delay(finalPause);


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


    await delay(200 + Math.random() * 300);
    await sock.sendPresenceUpdate('available', jid);


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

/**
 * @swagger
 * /api/baileys/session/{sessionId}/smart-reply:
 *   post:
 *     summary: Send a smart reply
 *     description: Sends a reply with advanced human-like behavior.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The smart reply was sent successfully.
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
        readingSpeed = 150,
        typingSpeed = 40,
        thinkingTime = true,
        naturalPauses = true,
        typoSimulation = false,
        emotionalDelay = true,
        contextAwareness = true,
        quotedMessageId = null,

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


      let quotedMessage = null;
      if (finalQuotedMessageId) {
        const originalMessage = getMessageById(sessionId, finalQuotedMessageId);
        if (originalMessage) {
          quotedMessage = originalMessage.message;
        }
      }


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

/**
 * @swagger
 * /api/baileys/session/{sessionId}:
 *   delete:
 *     summary: Delete a session
 *     description: Deletes a specific WhatsApp session.
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The session was deleted successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session not found.
 *       '500':
 *         description: Internal server error.
 */
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


      if (session.sock) {
        await session.sock.logout();
      }


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



























































/**
 * @swagger
 * /api/baileys/session/{sessionId}/contacts/check:
 *   post:
 *     summary: Check if contacts exist on WhatsApp
 *     description: Checks if a list of phone numbers exist on WhatsApp.
 *     tags: [Contact Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               numbers:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: The contacts were checked successfully.
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
app.post(
  '/api/baileys/session/:sessionId/contacts/check',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { numbers } = req.body;

      if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Numbers array is required and cannot be empty',
        });
      }

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }


      const uniqueNumbers = [...new Set(numbers)];
      const formattedNumbers = uniqueNumbers.map((num) => {

        const cleaned = num.replace(/[^\d+]/g, '');

        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
      });

      const results = await session.sock.onWhatsApp(...formattedNumbers);

      res.json({
        success: true,
        results: results.map((result) => ({
          jid: result.jid,
          exists: result.exists,
          number: result.jid ? result.jid.replace('@s.whatsapp.net', '') : null,
        })),
      });
    } catch (error) {
      console.error('Error checking contacts:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking contacts',
        error: error.message,
      });
    }
  }
);

































































/**
 * @swagger
 * /api/baileys/session/{sessionId}/contacts/info:
 *   post:
 *     summary: Get contact information
 *     description: Retrieves information for a list of contacts.
 *     tags: [Contact Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: The contact information was retrieved successfully.
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
app.post(
  '/api/baileys/session/:sessionId/contacts/info',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { contacts } = req.body;

      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contacts array is required and cannot be empty',
        });
      }

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }

      const contactsInfo = [];

      for (const jid of contacts) {
        try {
          const contactInfo = await getContactOrGroupInfo(jid, session.sock);
          contactsInfo.push({
            jid,
            ...contactInfo,
          });
        } catch (error) {
          contactsInfo.push({
            jid,
            type: 'unknown',
            name: null,
            exists: false,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        contacts: contactsInfo,
      });
    } catch (error) {
      console.error('Error getting contact info:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting contact information',
        error: error.message,
      });
    }
  }
);
























































/**
 * @swagger
 * /api/baileys/session/{sessionId}/contacts/profile:
 *   get:
 *     summary: Get a contact's profile picture
 *     description: Retrieves the profile picture URL for a specific contact.
 *     tags: [Contact Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: jid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The profile picture URL was retrieved successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 *       '403':
 *         description: Forbidden, user does not have permission to access the session.
 *       '404':
 *         description: Session or profile picture not found.
 *       '500':
 *         description: Internal server error.
 */
app.get(
  '/api/baileys/session/:sessionId/contacts/profile',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { jid, type = 'image' } = req.query;

      if (!jid) {
        return res.status(400).json({
          success: false,
          message: 'JID parameter is required',
        });
      }

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }

      const profilePic = await session.sock.profilePictureUrl(jid, type);

      if (!profilePic) {
        return res.status(404).json({
          success: false,
          message: 'Profile picture not found',
        });
      }

      res.json({
        success: true,
        profilePicture: {
          url: profilePic,
          jid,
          type,
        },
      });
    } catch (error) {
      console.error('Error getting profile picture:', error);

      if (error.message?.includes('not-authorized')) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this profile picture',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error getting profile picture',
        error: error.message,
      });
    }
  }
);

















































/**
 * @swagger
 * /api/baileys/session/{sessionId}/contacts/status:
 *   get:
 *     summary: Get a contact's status
 *     description: Retrieves the status for a specific contact.
 *     tags: [Contact Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: jid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: The contact status was retrieved successfully.
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
app.get(
  '/api/baileys/session/:sessionId/contacts/status',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { jid } = req.query;

      if (!jid) {
        return res.status(400).json({
          success: false,
          message: 'JID parameter is required',
        });
      }

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }


      const [statusResult] = await session.sock.fetchStatus(jid);

      res.json({
        success: true,
        data: {
          jid,
          status: statusResult?.status || null,
          setAt: statusResult?.setAt || null,
        },
      });
    } catch (error) {
      console.error('Error getting contact status:', error);

      if (error.message?.includes('not-authorized')) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this contact status',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error getting contact status',
        error: error.message,
      });
    }
  }
);




















































/**
 * @swagger
 * /api/baileys/session/{sessionId}/contacts/block:
 *   post:
 *     summary: Block contacts
 *     description: Blocks a list of contacts.
 *     tags: [Contact Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: The contacts were blocked successfully.
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
app.post(
  '/api/baileys/session/:sessionId/contacts/block',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { contacts } = req.body;

      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contacts array is required and cannot be empty',
        });
      }

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }


      const blockedContacts = [];
      const failedContacts = [];

      for (const jid of contacts) {
        try {
          await session.sock.updateBlockStatus(jid, 'block');
          blockedContacts.push(jid);
        } catch (error) {
          console.error(`Erro ao bloquear ${jid}:`, error);
          failedContacts.push({ jid, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `${blockedContacts.length} contatos bloqueados com sucesso`,
        data: {
          blocked: blockedContacts,
          failed: failedContacts,
        },
      });
    } catch (error) {
      console.error('Error blocking contacts:', error);
      res.status(500).json({
        success: false,
        message: 'Error blocking contacts',
        error: error.message,
      });
    }
  }
);




















































/**
 * @swagger
 * /api/baileys/session/{sessionId}/contacts/unblock:
 *   post:
 *     summary: Unblock contacts
 *     description: Unblocks a list of contacts.
 *     tags: [Contact Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: The contacts were unblocked successfully.
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
app.post(
  '/api/baileys/session/:sessionId/contacts/unblock',
  checkSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { contacts } = req.body;

      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contacts array is required and cannot be empty',
        });
      }

      const session = sessions.get(sessionId);
      if (!session || !session.isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Sessão não encontrada ou não conectada',
        });
      }


      const unblockedContacts = [];
      const failedContacts = [];

      for (const jid of contacts) {
        try {
          await session.sock.updateBlockStatus(jid, 'unblock');
          unblockedContacts.push(jid);
        } catch (error) {
          console.error(`Erro ao desbloquear ${jid}:`, error);
          failedContacts.push({ jid, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `${unblockedContacts.length} contatos desbloqueados com sucesso`,
        data: {
          unblocked: unblockedContacts,
          failed: failedContacts,
        },
      });
    } catch (error) {
      console.error('Error unblocking contacts:', error);
      res.status(500).json({
        success: false,
        message: 'Error unblocking contacts',
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/baileys/info:
 *   get:
 *     summary: Get API information
 *     description: Retrieves information about the API.
 *     tags: [System]
 *     responses:
 *       '200':
 *         description: The API information was retrieved successfully.
 */
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
      'Gerenciamento completo de contatos',
      'Verificação de números no WhatsApp',
      'Foto de perfil e status de contatos',
      'Bloqueio e desbloqueio de contatos',
      'Código limpo sem imports desnecessários',
    ],
    activeSessions: sessions.size,
    endpoints: {

      'POST /api/baileys/session/create': 'Criar nova sessão',
      'GET /api/baileys/session/:id/status': 'Status da sessão',
      'GET /api/baileys/sessions': 'Listar todas as sessões',
      'DELETE /api/baileys/session/:id': 'Deletar sessão',


      'GET /api/baileys/session/:id/qr': 'Obter QR Code (JSON)',
      'GET /api/baileys/session/:id/qr-image': 'Obter QR Code (Imagem PNG)',
      'POST /api/baileys/session/:id/regenerate-qr': 'Regenerar QR Code',


      'POST /api/baileys/session/:id/send-message': 'Enviar mensagem de texto',
      'POST /api/baileys/session/:id/send-media':
        'Enviar mídia (imagem/vídeo/áudio/documento)',
      'POST /api/baileys/session/:id/reply-message':
        'Responder mensagem por ID',
      'POST /api/baileys/session/:id/smart-reply':
        'Resposta inteligente com comportamento humano',


      'POST /api/baileys/session/:id/typing': 'Controlar status de digitação',
      'POST /api/baileys/session/:id/mark-read': 'Marcar mensagem como lida',


      'GET /api/baileys/session/:id/messages': 'Listar mensagens armazenadas',
      'POST /api/baileys/session/:id/download-media':
        'Baixar mídia das mensagens',


      'POST /api/baileys/session/:id/webhook':
        'Configurar webhook principal (legado)',
      'GET /api/baileys/session/:id/webhook':
        'Obter webhook principal (legado)',
      'DELETE /api/baileys/session/:id/webhook':
        'Remover webhook principal (legado)',


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


      'POST /api/baileys/session/:id/contacts/check':
        'Verificar números no WhatsApp',
      'POST /api/baileys/session/:id/contacts/info':
        'Obter informações de contatos',
      'GET /api/baileys/session/:id/contacts/profile': 'Obter foto de perfil',
      'GET /api/baileys/session/:id/contacts/status': 'Obter status do contato',
      'POST /api/baileys/session/:id/contacts/block': 'Bloquear contatos',
      'POST /api/baileys/session/:id/contacts/unblock': 'Desbloquear contatos',


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


      'POST /api/baileys/agents/create': 'Criar novo agente de IA',
      'GET /api/baileys/agents/list': 'Listar todos os agentes',
      'GET /api/baileys/agents/:agentId': 'Obter informações do agente',
      'PATCH /api/baileys/agents/:agentId/deactivate': 'Desativar agente',
      'DELETE /api/baileys/agents/:agentId': 'Remover agente',
      'POST /api/baileys/agents/process-message':
        'Processar mensagem com agente',


      'POST /api/baileys/session/:sessionId/lid/resolve':
        'Resolver LID para número de telefone',


      'GET /api/baileys/info': 'Informações da API',
      'GET /': 'Redireciona para documentação Swagger',
    },
  });
});


app.use('/api/baileys/groups', groupsRouter);


app.use('/api/baileys/agents', aiAgentsRouter);


app.use('/api/baileys/tasks', whatsappTasksRouter);


const lidResolverRouter = require('./api/lidResolver');
app.use('/api/baileys/session', lidResolverRouter);




app.use((error, req, res, next) => {
  logger.error(`Erro não tratado: ${error.message}`);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});


/**
 * Initializes the application.
 * @returns {Promise<void>}
 */
async function initializeApp() {

  const dirs = ['./auth_sessions', './uploads', './downloads'];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  logger.info('Diretórios criados e API pronta para uso!');


  logger.info('Carregando sessões existentes...');
  await loadExistingSessions();


  logger.info('Limpando sessões órfãs...');
  await cleanupOrphanedSessions();


  const db = database.getDb();
  if (db) {
    try {

      const qrCodes = db.collection('qr_codes');
      await qrCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });


      const webhooksCollection = db.collection('webhooks');
      await webhooksCollection.createIndex({ sessionId: 1 });


      const messagesCollection = db.collection('messages');
      await messagesCollection.createIndex({ sessionId: 1, timestamp: -1 });
      await messagesCollection.createIndex(
        { sessionId: 1, messageId: 1 },
        { unique: true }
      );
      await messagesCollection.createIndex({ userId: 1 });


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


  logger.info('Limpando QR codes expirados...');
  await cleanupExpiredQRCodes();


  setInterval(async () => {
    try {
      await cleanupExpiredQRCodes();
    } catch (error) {
      logger.error(`Erro na limpeza automática de QR codes: ${error.message}`);
    }
  }, 10 * 60 * 1000);

  logger.info('Carregamento de sessões concluído!');


  logger.info('Integrando sistema de coleta de mensagens...');
  try {
    integrateWithMainApp(app);
    logger.info('Sistema de coleta de mensagens integrado com sucesso!');
  } catch (error) {
    logger.error(`Erro ao integrar sistema de coleta: ${error.message}`);
  }


  logger.info('Inicializando Task Scheduler...');
  try {
    await taskScheduler.initialize();
    logger.info('Task Scheduler inicializado com sucesso!');
  } catch (error) {
    logger.error(`Erro ao inicializar Task Scheduler: ${error.message}`);
  }
}


process.on('SIGINT', async () => {
  logger.info('Fechando aplicação...');


  try {
    taskScheduler.stopAll();
    logger.info('Task Scheduler parado com sucesso');
  } catch (error) {
    logger.error(`Erro ao parar Task Scheduler: ${error.message}`);
  }


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
