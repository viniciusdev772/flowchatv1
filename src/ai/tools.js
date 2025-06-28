const { Type } = require('@sinclair/typebox');

// Definições TypeBox para as tools - melhor performance e validação que Zod
const toolSchemas = {
  // ====== SESSÕES ======
  createSession: Type.Object({
    sessionId: Type.String({ description: 'ID único para a nova sessão', minLength: 1 }),
  }),

  listSessions: Type.Object({}),

  deleteSession: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão a ser deletada', minLength: 1 }),
  }),

  getSessionStatus: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
  }),

  regenerateQRCode: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão para regenerar QR code', minLength: 1 }),
  }),

  // ====== MENSAGENS ======
  sendMessage: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    message: Type.String({ description: 'Mensagem de texto a ser enviada', minLength: 1 }),
  }),

  sendImage: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    imageUrl: Type.String({ description: 'URL da imagem a ser enviada', format: 'uri' }),
    caption: Type.Optional(Type.String({ description: 'Legenda da imagem (opcional)' })),
  }),

  sendDocument: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    documentUrl: Type.String({ description: 'URL do documento a ser enviado', format: 'uri' }),
    fileName: Type.String({ description: 'Nome do arquivo', minLength: 1 }),
    caption: Type.Optional(Type.String({ description: 'Legenda do documento (opcional)' })),
  }),

  sendSticker: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    stickerUrl: Type.String({ description: 'URL do sticker (WebP) a ser enviado', format: 'uri' }),
  }),

  // Novas ferramentas para mensagens avançadas
  replyMessage: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    message: Type.String({ description: 'Mensagem de resposta', minLength: 1 }),
    quotedMessageId: Type.String({ description: 'ID da mensagem sendo respondida', minLength: 1 }),
  }),

  sendMedia: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    mediaUrl: Type.String({ description: 'URL da mídia a ser enviada', format: 'uri' }),
    mediaType: Type.Union([Type.Literal('image'), Type.Literal('video'), Type.Literal('audio'), Type.Literal('document')], { description: 'Tipo de mídia' }),
    caption: Type.Optional(Type.String({ description: 'Legenda da mídia (opcional)' })),
    fileName: Type.Optional(Type.String({ description: 'Nome do arquivo (opcional)' })),
  }),

  markAsRead: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    messageId: Type.String({ description: 'ID da mensagem específica (obrigatório)', minLength: 1 }),
  }),

  setTypingStatus: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone (formato: 5511999999999)', pattern: '^[1-9]\\d{1,14}$' }),
    isTyping: Type.Boolean({ description: 'Status de digitação (true/false)' }),
  }),

  getMessageHistory: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.Optional(Type.String({ description: 'Número de telefone específico (opcional)', pattern: '^[1-9]\\d{1,14}$' })),
    limit: Type.Optional(Type.Number({ description: 'Limite de mensagens (padrão: 50)', minimum: 1, maximum: 1000 })),
    before: Type.Optional(Type.String({ description: 'Buscar mensagens antes de um timestamp específico' })),
  }),

  // ====== WEBHOOKS AVANÇADOS ======
  // Sistema de webhooks moderno com até 3 webhooks por sessão
  createWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookUrl: Type.String({ description: 'URL do webhook', format: 'uri' }),
    priority: Type.Number({ description: 'Prioridade do webhook (1-3)', minimum: 1, maximum: 3, default: 1 }),
    events: Type.Optional(Type.Array(Type.String(), { description: 'Eventos específicos para escutar (opcional)' })),
    isActive: Type.Optional(Type.Boolean({ description: 'Status ativo do webhook (padrão: true)', default: true })),
  }),

  listWebhooks: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
  }),

  getWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
  }),

  updateWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
    webhookUrl: Type.Optional(Type.String({ description: 'Nova URL do webhook', format: 'uri' })),
    priority: Type.Optional(Type.Number({ description: 'Nova prioridade (1-3)', minimum: 1, maximum: 3 })),
    events: Type.Optional(Type.Array(Type.String(), { description: 'Novos eventos para escutar' })),
  }),

  deleteWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
  }),

  toggleWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
    isActive: Type.Boolean({ description: 'Novo status ativo do webhook' }),
  }),

  testWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
    testData: Type.Optional(Type.Object({}, { description: 'Dados de teste personalizados (opcional)' })),
  }),

  // Legacy webhook support
  setWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookUrl: Type.String({ description: 'URL do webhook', format: 'uri' }),
    priority: Type.Optional(Type.Number({ description: 'Prioridade do webhook (1-3)', minimum: 1, maximum: 3, default: 1 })),
  }),

  removeWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
  }),

  // ====== GRUPOS AVANÇADOS ======
  listGroups: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    includeParticipants: Type.Optional(Type.Boolean({ description: 'Incluir lista de participantes (padrão: false)' })),
    filter: Type.Optional(Type.String({ description: 'Filtro por nome do grupo (opcional)' })),
  }),

  createGroup: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupName: Type.String({ description: 'Nome do grupo', minLength: 1, maxLength: 100 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), { description: 'Array de números dos participantes', minItems: 1 }),
    description: Type.Optional(Type.String({ description: 'Descrição inicial do grupo (opcional)' })),
  }),

  getGroupInfo: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    includeParticipants: Type.Optional(Type.Boolean({ description: 'Incluir lista detalhada de participantes (padrão: true)' })),
  }),

  addGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), { description: 'Array de números a serem adicionados', minItems: 1 }),
  }),

  removeGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), { description: 'Array de números a serem removidos', minItems: 1 }),
  }),

  promoteGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), { description: 'Array de números a serem promovidos a admin', minItems: 1 }),
  }),

  demoteGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), { description: 'Array de números a serem despromovidos', minItems: 1 }),
  }),

  updateGroupName: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    subject: Type.String({ description: 'Novo nome do grupo', minLength: 1, maxLength: 100 }),
  }),

  updateGroupDescription: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    description: Type.String({ description: 'Nova descrição do grupo', maxLength: 500 }),
  }),

  updateGroupSettings: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    onlyAdminsCanSend: Type.Optional(Type.Boolean({ description: 'Se apenas admins podem enviar mensagens' })),
    onlyAdminsCanEditInfo: Type.Optional(Type.Boolean({ description: 'Se apenas admins podem editar informações' })),
  }),

  leaveGroup: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
  }),

  getGroupInviteCode: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
  }),

  revokeGroupInviteCode: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
  }),

  // Novas funcionalidades para grupos
  sendGroupMessage: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    message: Type.String({ description: 'Mensagem para o grupo', minLength: 1 }),
    mentionAll: Type.Optional(Type.Boolean({ description: 'Mencionar todos os participantes (padrão: false)' })),
    mentions: Type.Optional(Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), { description: 'Lista de participantes para mencionar' })),
  }),

  getGroupMessages: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    limit: Type.Optional(Type.Number({ description: 'Limite de mensagens (padrão: 50)', minimum: 1, maximum: 1000 })),
    before: Type.Optional(Type.String({ description: 'Buscar mensagens antes de um timestamp específico' })),
  }),

  // ====== SISTEMA E MONITORAMENTO ======
  getSystemInfo: Type.Object({
    includeStats: Type.Optional(Type.Boolean({ description: 'Incluir estatísticas detalhadas (padrão: true)' })),
    includeMemory: Type.Optional(Type.Boolean({ description: 'Incluir informações de memória (padrão: true)' })),
  }),

  cleanupOrphanedSessions: Type.Object({
    force: Type.Optional(Type.Boolean({ description: 'Forçar limpeza de todas as sessões órfãs (padrão: false)' })),
  }),

  getSessionStats: Type.Object({
    sessionId: Type.Optional(Type.String({ description: 'ID da sessão específica (opcional para estatísticas globais)', minLength: 1 })),
    period: Type.Optional(Type.Union([Type.Literal('1h'), Type.Literal('24h'), Type.Literal('7d'), Type.Literal('30d')], { description: 'Período para estatísticas (padrão: 24h)' })),
  }),

  // ====== DOWNLOADS E MÍDIA ======
  downloadMedia: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    messageId: Type.String({ description: 'ID da mensagem com mídia', minLength: 1 }),
    phone: Type.String({ description: 'Número de telefone origem', pattern: '^[1-9]\\d{1,14}$' }),
  }),

  listDownloads: Type.Object({
    sessionId: Type.Optional(Type.String({ description: 'Filtrar por sessão específica (opcional)', minLength: 1 })),
    limit: Type.Optional(Type.Number({ description: 'Limite de resultados (padrão: 50)', minimum: 1, maximum: 1000 })),
    mediaType: Type.Optional(Type.Union([Type.Literal('image'), Type.Literal('video'), Type.Literal('audio'), Type.Literal('document')], { description: 'Filtrar por tipo de mídia' })),
  }),

  getDownloadInfo: Type.Object({
    downloadId: Type.String({ description: 'ID do download', minLength: 1 }),
  }),

  cleanupExpiredDownloads: Type.Object({
    olderThan: Type.Optional(Type.Number({ description: 'Limpar downloads mais antigos que X dias (padrão: 7)', minimum: 1 })),
  }),
};

// Funções auxiliares
const formatPhoneToJid = (phone) => {
  return phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
};

// Implementações das tools
const toolImplementations = {
  // ====== SESSÕES ======
  async createSession({ sessionId }) {
    try {
      // Obter token do usuário autenticado do contexto da request
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ sessionId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        sessionId,
        qrCode: result.qrCode,
        qrCodeImage: result.qrCodeImage,
        message: `Sessão '${sessionId}' criada com sucesso. Use o QR code para autenticar.`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao criar sessão '${sessionId}': ${error.message}`,
      };
    }
  },

  async listSessions() {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/sessions`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        sessions: result.sessions || [],
        total: result.total || 0,
        message: `${result.total || 0} sessões encontradas`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Erro ao listar sessões: ${error.message}`,
      };
    }
  },

  async deleteSession({ sessionId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        sessionId,
        message: `Sessão '${sessionId}' deletada com sucesso`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao deletar sessão '${sessionId}': ${error.message}`,
      };
    }
  },

  async getSessionStatus({ sessionId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/status`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        sessionId: result.sessionId,
        isConnected: result.isConnected,
        connectionState: result.connectionState,
        user: result.user,
        message: `Status da sessão '${sessionId}': ${result.connectionState}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter status da sessão '${sessionId}': ${error.message}`,
      };
    }
  },

  async regenerateQRCode({ sessionId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/regenerate-qr`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        sessionId,
        qrCode: result.qrCode,
        qrCodeImage: result.qrCodeImage,
        message: `QR code regenerado para sessão '${sessionId}'`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao regenerar QR code para '${sessionId}': ${error.message}`,
      };
    }
  },

  // ====== MENSAGENS ======
  async sendMessage({ sessionId, phone, message }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            to: phone,
            message,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Mensagem enviada para ${phone}`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar mensagem para ${phone}: ${error.message}`,
      };
    }
  },

  async sendImage({ sessionId, phone, imageUrl, caption }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      // Para envio de imagem, usamos o endpoint send-media
      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            to: phone,
            media: imageUrl,
            caption,
            filename: 'image.jpg'
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Imagem enviada para ${phone}${
          caption ? ` com legenda: "${caption}"` : ''
        }`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar imagem para ${phone}: ${error.message}`,
      };
    }
  },

  async sendDocument({ sessionId, phone, documentUrl, fileName, caption }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      // Para envio de documento, usamos o endpoint send-media
      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            to: phone,
            media: documentUrl,
            filename: fileName,
            caption,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Documento "${fileName}" enviado para ${phone}`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar documento para ${phone}: ${error.message}`,
      };
    }
  },

  async sendSticker({ sessionId, phone, stickerUrl }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      // Para envio de sticker, usamos o endpoint send-media
      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            to: phone,
            media: stickerUrl,
            filename: 'sticker.webp'
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Sticker enviado para ${phone}`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar sticker para ${phone}: ${error.message}`,
      };
    }
  },

  // ====== WEBHOOKS ======
  async setWebhook({ sessionId, webhookUrl, priority = 1 }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            webhookUrl,
            priority,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Webhook configurado para sessão '${sessionId}': ${webhookUrl}`,
        webhookUrl,
        priority,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao configurar webhook para '${sessionId}': ${error.message}`,
      };
    }
  },

  async removeWebhook({ sessionId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhook`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Webhook removido da sessão '${sessionId}'`,
        sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao remover webhook da sessão '${sessionId}': ${error.message}`,
      };
    }
  },
  // ====== GRUPOS ======
  async listGroups({ sessionId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/list`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        groups: result.groups || [],
        total: result.total || 0,
        message: `${
          result.total || 0
        } grupos encontrados na sessão '${sessionId}'`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao listar grupos da sessão '${sessionId}': ${error.message}`,
      };
    }
  },

  async createGroup({ sessionId, groupName, participants }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            groupName,
            participants,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Grupo '${groupName}' criado com sucesso`,
        groupId: result.groupId,
        participants,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao criar grupo '${groupName}': ${error.message}`,
      };
    }
  },

  async getGroupInfo({ sessionId, groupId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/info`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        groupInfo: result.groupInfo,
        message: `Informações do grupo obtidas com sucesso`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter informações do grupo: ${error.message}`,
      };
    }
  },

  async addGroupParticipants({ sessionId, groupId, participants }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/add-participants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ participants }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `${participants.length} participantes adicionados ao grupo`,
        addedParticipants: result.addedParticipants,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao adicionar participantes: ${error.message}`,
      };
    }
  },

  async removeGroupParticipants({ sessionId, groupId, participants }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/remove-participants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ participants }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `${participants.length} participantes removidos do grupo`,
        removedParticipants: result.removedParticipants,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao remover participantes: ${error.message}`,
      };
    }
  },

  async promoteGroupParticipants({ sessionId, groupId, participants }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/promote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ participants }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `${participants.length} participantes promovidos a admin`,
        promotedParticipants: result.promotedParticipants,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao promover participantes: ${error.message}`,
      };
    }
  },

  async demoteGroupParticipants({ sessionId, groupId, participants }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/demote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ participants }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `${participants.length} admins despromovidos`,
        demotedParticipants: result.demotedParticipants,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao despromover participantes: ${error.message}`,
      };
    }
  },

  async updateGroupName({ sessionId, groupId, subject }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/subject`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ subject }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Nome do grupo atualizado para: "${subject}"`,
        newSubject: result.newSubject,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao atualizar nome do grupo: ${error.message}`,
      };
    }
  },

  async updateGroupDescription({ sessionId, groupId, description }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/description`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ description }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Descrição do grupo atualizada`,
        newDescription: result.newDescription,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao atualizar descrição do grupo: ${error.message}`,
      };
    }
  },

  async updateGroupSettings({
    sessionId,
    groupId,
    onlyAdminsCanSend,
    onlyAdminsCanEditInfo,
  }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            onlyAdminsCanSend,
            onlyAdminsCanEditInfo,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Configurações do grupo atualizadas`,
        settings: result.settings,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao atualizar configurações do grupo: ${error.message}`,
      };
    }
  },

  async leaveGroup({ sessionId, groupId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/leave`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Saiu do grupo com sucesso`,
        groupId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao sair do grupo: ${error.message}`,
      };
    }
  },

  async getGroupInviteCode({ sessionId, groupId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/invite-code`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        inviteCode: result.inviteCode,
        inviteLink: result.inviteLink,
        message: `Código de convite obtido: ${result.inviteLink}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter código de convite: ${error.message}`,
      };
    }
  },

  async revokeGroupInviteCode({ sessionId, groupId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/${groupId}/revoke-invite`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        newInviteCode: result.newInviteCode,
        newInviteLink: result.newInviteLink,
        message: `Código de convite revogado. Novo link: ${result.newInviteLink}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao revogar código de convite: ${error.message}`,
      };
    }
  },

  // ====== SISTEMA ======
  async getSystemInfo() {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/system/info`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        // Se não existe rota específica, usar informações locais
        return {
          success: true,
          info: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            timestamp: new Date().toISOString(),
          },
          message: 'Informações do sistema coletadas',
        };
      }

      const result = await response.json();
      return {
        success: true,
        info: result.info || result,
        message: 'Informações do sistema obtidas',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter informações do sistema: ${error.message}`,
      };
    }
  },

  async cleanupOrphanedSessions() {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/sessions/cleanup-orphaned`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Limpeza de sessões órfãs concluída',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha na limpeza de sessões órfãs: ${error.message}`,
      };
    }
  },

  // Método para definir o token do usuário (será usado no contexto da IA)
  setUserToken(token) {
    this.userToken = token;
  },

  // Método para obter o token do usuário
  getUserToken() {
    return this.userToken;
  },

  // ====== NOVAS IMPLEMENTAÇÕES DE FERRAMENTAS AVANÇADAS ======

  // Mensagens avançadas
  async replyMessage({ sessionId, phone, message, quotedMessageId }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/reply-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            messageId: quotedMessageId,
            reply: message,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Resposta enviada para mensagem ${quotedMessageId}`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar resposta para mensagem ${quotedMessageId}: ${error.message}`,
      };
    }
  },

  async sendMedia({ sessionId, phone, mediaUrl, mediaType, caption, fileName }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            to: phone,
            media: mediaUrl,
            caption,
            filename: fileName,
            voiceMessage: mediaType === 'audio'
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Mídia ${mediaType} enviada para ${phone}`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar mídia para ${phone}: ${error.message}`,
      };
    }
  },

  async markAsRead({ sessionId, phone, messageId }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      // Converter número para formato JID se necessário
      const jid = formatPhoneToJid(phone);

      if (!messageId) {
        throw new Error('messageId é obrigatório para marcar mensagem como lida');
      }

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/mark-read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            jid,
            messageId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Mensagem ${messageId} marcada como lida para ${phone}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao marcar como lida para ${phone}: ${error.message}`,
      };
    }
  },

  async setTypingStatus({ sessionId, phone, isTyping }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      // Converter número para formato JID se necessário
      const jid = formatPhoneToJid(phone);

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/typing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            jid,
            isTyping,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Status de digitação ${isTyping ? 'ativado' : 'desativado'} para ${phone}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao definir status de digitação para ${phone}: ${error.message}`,
      };
    }
  },

  async getMessageHistory({ sessionId, phone, limit = 50, before }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const params = new URLSearchParams();
      if (phone) params.append('phone', phone);
      if (limit) params.append('limit', limit);
      if (before) params.append('before', before);

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/messages?${params}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        messages: result.messages || [],
        total: result.total || 0,
        message: `${result.total || 0} mensagens encontradas`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter histórico de mensagens: ${error.message}`,
      };
    }
  },

  // Webhooks avançados
  async createWebhook({ sessionId, webhookUrl, priority = 1, events, isActive = true }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            webhookUrl,
            priority,
            events,
            isActive,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        webhookId: result.webhookId,
        message: `Webhook criado com sucesso para sessão '${sessionId}'`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao criar webhook para '${sessionId}': ${error.message}`,
      };
    }
  },

  async listWebhooks({ sessionId }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        webhooks: result.webhooks || [],
        total: result.total || 0,
        message: `${result.total || 0} webhooks encontrados para sessão '${sessionId}'`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao listar webhooks da sessão '${sessionId}': ${error.message}`,
      };
    }
  },

  async getWebhook({ sessionId, webhookId }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        webhook: result.webhook,
        message: `Webhook ${webhookId} obtido com sucesso`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter webhook ${webhookId}: ${error.message}`,
      };
    }
  },

  async updateWebhook({ sessionId, webhookId, webhookUrl, priority, events }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            webhookUrl,
            priority,
            events,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Webhook ${webhookId} atualizado com sucesso`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao atualizar webhook ${webhookId}: ${error.message}`,
      };
    }
  },

  async deleteWebhook({ sessionId, webhookId }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Webhook ${webhookId} deletado com sucesso`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao deletar webhook ${webhookId}: ${error.message}`,
      };
    }
  },

  async toggleWebhook({ sessionId, webhookId, isActive }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            isActive,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Webhook ${webhookId} ${isActive ? 'ativado' : 'desativado'} com sucesso`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao ${isActive ? 'ativar' : 'desativar'} webhook ${webhookId}: ${error.message}`,
      };
    }
  },

  async testWebhook({ sessionId, webhookId, testData }) {
    try {
      const userToken = this.getUserToken?.() || process.env.BAILEYS_API_TOKEN || 'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            testData: testData || { test: true, timestamp: new Date().toISOString() },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Teste do webhook ${webhookId} executado com sucesso`,
        testResult: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha no teste do webhook ${webhookId}: ${error.message}`,
      };
    }
  },
};

// Definição das tools para OpenAI
const openAITools = [
  // ====== SESSÕES ======
  {
    type: 'function',
    function: {
      name: 'createSession',
      description:
        'Cria uma nova sessão WhatsApp com ID específico e retorna QR code para autenticação',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID único para a nova sessão',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listSessions',
      description:
        'Lista todas as sessões WhatsApp ativas no sistema com seus status',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteSession',
      description: 'Remove/fecha uma sessão WhatsApp específica',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão a ser deletada',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSessionStatus',
      description: 'Verifica o status detalhado de conexão de uma sessão',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'regenerateQRCode',
      description: 'Regenera o QR code para uma sessão que não está conectada',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão para regenerar QR code',
          },
        },
        required: ['sessionId'],
      },
    },
  },

  // ====== MENSAGENS ======
  {
    type: 'function',
    function: {
      name: 'sendMessage',
      description: 'Envia uma mensagem de texto via WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão WhatsApp',
          },
          phone: {
            type: 'string',
            description:
              'Número de telefone no formato internacional (ex: 5511999999999)',
          },
          message: {
            type: 'string',
            description: 'Conteúdo da mensagem de texto a ser enviada',
          },
        },
        required: ['sessionId', 'phone', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendImage',
      description: 'Envia uma imagem via WhatsApp com legenda opcional',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão WhatsApp',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone no formato internacional',
          },
          imageUrl: {
            type: 'string',
            description: 'URL da imagem a ser enviada',
          },
          caption: {
            type: 'string',
            description: 'Legenda da imagem (opcional)',
          },
        },
        required: ['sessionId', 'phone', 'imageUrl'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendDocument',
      description: 'Envia um documento via WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão WhatsApp',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone no formato internacional',
          },
          documentUrl: {
            type: 'string',
            description: 'URL do documento a ser enviado',
          },
          fileName: {
            type: 'string',
            description: 'Nome do arquivo',
          },
          caption: {
            type: 'string',
            description: 'Legenda do documento (opcional)',
          },
        },
        required: ['sessionId', 'phone', 'documentUrl', 'fileName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendSticker',
      description: 'Envia um sticker (figurinha) via WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão WhatsApp',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone no formato internacional',
          },
          stickerUrl: {
            type: 'string',
            description: 'URL do sticker em formato WebP',
          },
        },
        required: ['sessionId', 'phone', 'stickerUrl'],
      },
    },
  },

  // ====== WEBHOOKS ======
  {
    type: 'function',
    function: {
      name: 'setWebhook',
      description: 'Configura um webhook para receber eventos de uma sessão',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookUrl: {
            type: 'string',
            description: 'URL do webhook que receberá os eventos',
          },
          priority: {
            type: 'number',
            description:
              'Prioridade do webhook (1-3, sendo 1 a maior prioridade)',
            minimum: 1,
            maximum: 3,
          },
        },
        required: ['sessionId', 'webhookUrl'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeWebhook',
      description: 'Remove o webhook configurado de uma sessão',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
        },
        required: ['sessionId'],
      },
    },
  },

  // ====== GRUPOS ======
  {
    type: 'function',
    function: {
      name: 'listGroups',
      description: 'Lista todos os grupos WhatsApp de uma sessão',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createGroup',
      description: 'Cria um novo grupo WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupName: {
            type: 'string',
            description: 'Nome do grupo',
          },
          participants: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array de números de telefone dos participantes',
          },
        },
        required: ['sessionId', 'groupName', 'participants'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getGroupInfo',
      description: 'Obtém informações detalhadas de um grupo específico',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
        },
        required: ['sessionId', 'groupId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addGroupParticipants',
      description: 'Adiciona participantes a um grupo WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
          participants: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              'Array de números dos participantes a serem adicionados',
          },
        },
        required: ['sessionId', 'groupId', 'participants'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeGroupParticipants',
      description: 'Remove participantes de um grupo WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
          participants: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array de números dos participantes a serem removidos',
          },
        },
        required: ['sessionId', 'groupId', 'participants'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'promoteGroupParticipants',
      description: 'Promove participantes a administradores do grupo',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
          participants: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array de números a serem promovidos a admin',
          },
        },
        required: ['sessionId', 'groupId', 'participants'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'demoteGroupParticipants',
      description: 'Remove privilégios de administrador de participantes',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
          participants: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array de números a serem despromovidos',
          },
        },
        required: ['sessionId', 'groupId', 'participants'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateGroupName',
      description: 'Atualiza o nome/assunto de um grupo',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
          subject: {
            type: 'string',
            description: 'Novo nome do grupo',
          },
        },
        required: ['sessionId', 'groupId', 'subject'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateGroupDescription',
      description: 'Atualiza a descrição de um grupo',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
          description: {
            type: 'string',
            description: 'Nova descrição do grupo',
          },
        },
        required: ['sessionId', 'groupId', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateGroupSettings',
      description:
        'Configura permissões do grupo (quem pode enviar mensagens e editar informações)',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
          onlyAdminsCanSend: {
            type: 'boolean',
            description: 'Se apenas admins podem enviar mensagens',
          },
          onlyAdminsCanEditInfo: {
            type: 'boolean',
            description: 'Se apenas admins podem editar informações do grupo',
          },
        },
        required: ['sessionId', 'groupId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leaveGroup',
      description: 'Remove a sessão atual de um grupo (sair do grupo)',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
        },
        required: ['sessionId', 'groupId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getGroupInviteCode',
      description: 'Obtém o código de convite do grupo para compartilhar',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
        },
        required: ['sessionId', 'groupId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'revokeGroupInviteCode',
      description: 'Revoga o código de convite atual do grupo e gera um novo',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          groupId: {
            type: 'string',
            description: 'ID do grupo',
          },
        },
        required: ['sessionId', 'groupId'],
      },
    },
  },

  // ====== WEBHOOKS AVANÇADOS ======
  {
    type: 'function',
    function: {
      name: 'createWebhook',
      description: 'Criar um novo webhook para uma sessão (até 3 por sessão)',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookUrl: {
            type: 'string',
            description: 'URL do webhook',
          },
          priority: {
            type: 'number',
            description: 'Prioridade do webhook (1-3)',
            minimum: 1,
            maximum: 3,
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            description: 'Eventos específicos para escutar (opcional)',
          },
          isActive: {
            type: 'boolean',
            description: 'Status ativo do webhook',
          },
        },
        required: ['sessionId', 'webhookUrl'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listWebhooks',
      description: 'Listar todos os webhooks configurados para uma sessão',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getWebhook',
      description: 'Obter detalhes de um webhook específico',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookId: {
            type: 'string',
            description: 'ID do webhook',
          },
        },
        required: ['sessionId', 'webhookId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateWebhook',
      description: 'Atualizar configurações de um webhook existente',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookId: {
            type: 'string',
            description: 'ID do webhook',
          },
          webhookUrl: {
            type: 'string',
            description: 'Nova URL do webhook',
          },
          priority: {
            type: 'number',
            description: 'Nova prioridade (1-3)',
            minimum: 1,
            maximum: 3,
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            description: 'Novos eventos para escutar',
          },
        },
        required: ['sessionId', 'webhookId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteWebhook',
      description: 'Deletar um webhook específico',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookId: {
            type: 'string',
            description: 'ID do webhook',
          },
        },
        required: ['sessionId', 'webhookId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggleWebhook',
      description: 'Ativar ou desativar um webhook específico',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookId: {
            type: 'string',
            description: 'ID do webhook',
          },
          isActive: {
            type: 'boolean',
            description: 'Novo status ativo do webhook',
          },
        },
        required: ['sessionId', 'webhookId', 'isActive'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'testWebhook',
      description: 'Testar um webhook enviando dados de teste',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookId: {
            type: 'string',
            description: 'ID do webhook',
          },
          testData: {
            type: 'object',
            description: 'Dados de teste personalizados (opcional)',
          },
        },
        required: ['sessionId', 'webhookId'],
      },
    },
  },

  // ====== MENSAGENS AVANÇADAS ======
  {
    type: 'function',
    function: {
      name: 'replyMessage',
      description: 'Responder a uma mensagem específica com citação',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone no formato internacional',
          },
          message: {
            type: 'string',
            description: 'Mensagem de resposta',
          },
          quotedMessageId: {
            type: 'string',
            description: 'ID da mensagem sendo respondida',
          },
        },
        required: ['sessionId', 'phone', 'message', 'quotedMessageId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendMedia',
      description: 'Enviar mídia com detecção automática de tipo',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone no formato internacional',
          },
          mediaUrl: {
            type: 'string',
            description: 'URL da mídia a ser enviada',
          },
          mediaType: {
            type: 'string',
            enum: ['image', 'video', 'audio', 'document'],
            description: 'Tipo de mídia',
          },
          caption: {
            type: 'string',
            description: 'Legenda da mídia (opcional)',
          },
          fileName: {
            type: 'string',
            description: 'Nome do arquivo (opcional)',
          },
        },
        required: ['sessionId', 'phone', 'mediaUrl', 'mediaType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'markAsRead',
      description: 'Marcar mensagem como lida',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone no formato internacional',
          },
          messageId: {
            type: 'string',
            description: 'ID da mensagem específica (obrigatório)',
          },
        },
        required: ['sessionId', 'phone', 'messageId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setTypingStatus',
      description: 'Controlar status de digitação',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone no formato internacional',
          },
          isTyping: {
            type: 'boolean',
            description: 'Status de digitação (true/false)',
          },
        },
        required: ['sessionId', 'phone', 'isTyping'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMessageHistory',
      description: 'Obter histórico de mensagens com filtros e paginação',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          phone: {
            type: 'string',
            description: 'Número de telefone específico (opcional)',
          },
          limit: {
            type: 'number',
            description: 'Limite de mensagens (padrão: 50)',
            minimum: 1,
            maximum: 1000,
          },
          before: {
            type: 'string',
            description: 'Buscar mensagens antes de um timestamp específico',
          },
        },
        required: ['sessionId'],
      },
    },
  },

  // ====== SISTEMA ======
  {
    type: 'function',
    function: {
      name: 'getSystemInfo',
      description: 'Obtém informações gerais do sistema e estatísticas de uso',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cleanupOrphanedSessions',
      description:
        'Remove sessões órfãs que não estão associadas a nenhum usuário',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

module.exports = {
  toolSchemas,
  toolImplementations,
  openAITools,
};
