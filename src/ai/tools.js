const { Type } = require('@sinclair/typebox');

// Definições TypeBox para as tools - melhor performance e validação que Zod
const toolSchemas = {
  // ====== SESSÕES ======
  createSession: Type.Object({
    sessionId: Type.String({
      description: 'ID único para a nova sessão',
      minLength: 1,
    }),
  }),

  listSessions: Type.Object({}),

  deleteSession: Type.Object({
    sessionId: Type.String({
      description: 'ID da sessão a ser deletada',
      minLength: 1,
    }),
  }),

  getSessionStatus: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
  }),

  regenerateQRCode: Type.Object({
    sessionId: Type.String({
      description: 'ID da sessão para regenerar QR code',
      minLength: 1,
    }),
  }),

  // ====== MENSAGENS ======
  sendMessage: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    message: Type.String({
      description: 'Mensagem de texto a ser enviada',
      minLength: 1,
    }),
  }),

  sendImage: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    imageUrl: Type.String({
      description: 'URL da imagem a ser enviada',
      format: 'uri',
    }),
    caption: Type.Optional(
      Type.String({ description: 'Legenda da imagem (opcional)' })
    ),
  }),

  sendDocument: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    documentUrl: Type.String({
      description: 'URL do documento a ser enviado',
      format: 'uri',
    }),
    fileName: Type.String({ description: 'Nome do arquivo', minLength: 1 }),
    caption: Type.Optional(
      Type.String({ description: 'Legenda do documento (opcional)' })
    ),
  }),

  sendSticker: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    stickerUrl: Type.String({
      description: 'URL do sticker (WebP) a ser enviado',
      format: 'uri',
    }),
  }),

  // Novas ferramentas para mensagens avançadas
  replyMessage: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    message: Type.String({ description: 'Mensagem de resposta', minLength: 1 }),
    quotedMessageId: Type.String({
      description: 'ID da mensagem sendo respondida',
      minLength: 1,
    }),
  }),

  sendMedia: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    mediaUrl: Type.String({
      description: 'URL da mídia a ser enviada',
      format: 'uri',
    }),
    mediaType: Type.Union(
      [
        Type.Literal('image'),
        Type.Literal('video'),
        Type.Literal('audio'),
        Type.Literal('document'),
      ],
      { description: 'Tipo de mídia' }
    ),
    caption: Type.Optional(
      Type.String({ description: 'Legenda da mídia (opcional)' })
    ),
    fileName: Type.Optional(
      Type.String({ description: 'Nome do arquivo (opcional)' })
    ),
  }),

  markAsRead: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    messageId: Type.String({
      description: 'ID da mensagem específica (obrigatório)',
      minLength: 1,
    }),
  }),

  setTypingStatus: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone (formato: 5511999999999)',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    isTyping: Type.Boolean({ description: 'Status de digitação (true/false)' }),
  }),

  getMessageHistory: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.Optional(
      Type.String({
        description: 'Número de telefone específico (opcional)',
        pattern: '^[1-9]\\d{1,14}$',
      })
    ),
    limit: Type.Optional(
      Type.Number({
        description: 'Limite de mensagens (padrão: 50)',
        minimum: 1,
        maximum: 1000,
      })
    ),
    before: Type.Optional(
      Type.String({
        description: 'Buscar mensagens antes de um timestamp específico',
      })
    ),
  }),

  // ====== WEBHOOKS AVANÇADOS ======
  // Sistema de webhooks moderno com até 3 webhooks por sessão
  createWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookUrl: Type.String({ description: 'URL do webhook', format: 'uri' }),
    priority: Type.Number({
      description: 'Prioridade do webhook (1-3)',
      minimum: 1,
      maximum: 3,
      default: 1,
    }),
    events: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Eventos específicos para escutar (opcional)',
      })
    ),
    isActive: Type.Optional(
      Type.Boolean({
        description: 'Status ativo do webhook (padrão: true)',
        default: true,
      })
    ),
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
    webhookUrl: Type.Optional(
      Type.String({ description: 'Nova URL do webhook', format: 'uri' })
    ),
    priority: Type.Optional(
      Type.Number({
        description: 'Nova prioridade (1-3)',
        minimum: 1,
        maximum: 3,
      })
    ),
    events: Type.Optional(
      Type.Array(Type.String(), { description: 'Novos eventos para escutar' })
    ),
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
    testData: Type.Optional(
      Type.Object(
        {},
        { description: 'Dados de teste personalizados (opcional)' }
      )
    ),
  }),

  // Legacy webhook support
  setWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookUrl: Type.String({ description: 'URL do webhook', format: 'uri' }),
    priority: Type.Optional(
      Type.Number({
        description: 'Prioridade do webhook (1-3)',
        minimum: 1,
        maximum: 3,
        default: 1,
      })
    ),
  }),

  removeWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
  }),

  // ====== GRUPOS AVANÇADOS ======
  listGroups: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    includeParticipants: Type.Optional(
      Type.Boolean({
        description: 'Incluir lista de participantes (padrão: false)',
      })
    ),
    filter: Type.Optional(
      Type.String({ description: 'Filtro por nome do grupo (opcional)' })
    ),
    limit: Type.Optional(
      Type.Number({
        description: 'Número máximo de grupos a retornar (1-50, padrão: 10)',
        minimum: 1,
        maximum: 50,
      })
    ),
    offset: Type.Optional(
      Type.Number({
        description: 'Posição inicial para paginação (padrão: 0)',
        minimum: 0,
      })
    ),
    search: Type.Optional(
      Type.String({
        description: 'Buscar grupos por nome (parcial, case-insensitive)',
        minLength: 1,
      })
    ),
  }),

  createGroup: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupName: Type.String({
      description: 'Nome do grupo',
      minLength: 1,
      maxLength: 100,
    }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), {
      description: 'Array de números dos participantes',
      minItems: 1,
    }),
    description: Type.Optional(
      Type.String({ description: 'Descrição inicial do grupo (opcional)' })
    ),
  }),

  getGroupInfo: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    includeParticipants: Type.Optional(
      Type.Boolean({
        description: 'Incluir lista detalhada de participantes (padrão: true)',
      })
    ),
  }),

  addGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), {
      description: 'Array de números a serem adicionados',
      minItems: 1,
    }),
  }),

  removeGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), {
      description: 'Array de números a serem removidos',
      minItems: 1,
    }),
  }),

  promoteGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), {
      description: 'Array de números a serem promovidos a admin',
      minItems: 1,
    }),
  }),

  demoteGroupParticipants: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    participants: Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), {
      description: 'Array de números a serem despromovidos',
      minItems: 1,
    }),
  }),

  updateGroupName: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    subject: Type.String({
      description: 'Novo nome do grupo',
      minLength: 1,
      maxLength: 100,
    }),
  }),

  updateGroupDescription: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    description: Type.String({
      description: 'Nova descrição do grupo',
      maxLength: 500,
    }),
  }),

  updateGroupSettings: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    onlyAdminsCanSend: Type.Optional(
      Type.Boolean({ description: 'Se apenas admins podem enviar mensagens' })
    ),
    onlyAdminsCanEditInfo: Type.Optional(
      Type.Boolean({ description: 'Se apenas admins podem editar informações' })
    ),
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
    message: Type.String({
      description: 'Mensagem para o grupo',
      minLength: 1,
    }),
    mentionAll: Type.Optional(
      Type.Boolean({
        description: 'Mencionar todos os participantes (padrão: false)',
      })
    ),
    mentions: Type.Optional(
      Type.Array(Type.String({ pattern: '^[1-9]\\d{1,14}$' }), {
        description: 'Lista de participantes para mencionar',
      })
    ),
  }),

  getGroupMessages: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    limit: Type.Optional(
      Type.Number({
        description: 'Limite de mensagens (padrão: 50)',
        minimum: 1,
        maximum: 1000,
      })
    ),
    before: Type.Optional(
      Type.String({
        description: 'Buscar mensagens antes de um timestamp específico',
      })
    ),
  }),

  // ====== SISTEMA E MONITORAMENTO ======
  getSystemInfo: Type.Object({
    includeStats: Type.Optional(
      Type.Boolean({
        description: 'Incluir estatísticas detalhadas (padrão: true)',
      })
    ),
    includeMemory: Type.Optional(
      Type.Boolean({
        description: 'Incluir informações de memória (padrão: true)',
      })
    ),
  }),

  cleanupOrphanedSessions: Type.Object({
    force: Type.Optional(
      Type.Boolean({
        description: 'Forçar limpeza de todas as sessões órfãs (padrão: false)',
      })
    ),
  }),

  getSessionStats: Type.Object({
    sessionId: Type.Optional(
      Type.String({
        description:
          'ID da sessão específica (opcional para estatísticas globais)',
        minLength: 1,
      })
    ),
    period: Type.Optional(
      Type.Union(
        [
          Type.Literal('1h'),
          Type.Literal('24h'),
          Type.Literal('7d'),
          Type.Literal('30d'),
        ],
        { description: 'Período para estatísticas (padrão: 24h)' }
      )
    ),
  }),

  // ====== DOWNLOADS E MÍDIA ======
  downloadMedia: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    messageId: Type.String({
      description: 'ID da mensagem com mídia',
      minLength: 1,
    }),
    phone: Type.String({
      description: 'Número de telefone origem',
      pattern: '^[1-9]\\d{1,14}$',
    }),
  }),

  listDownloads: Type.Object({
    sessionId: Type.Optional(
      Type.String({
        description: 'Filtrar por sessão específica (opcional)',
        minLength: 1,
      })
    ),
    limit: Type.Optional(
      Type.Number({
        description: 'Limite de resultados (padrão: 50)',
        minimum: 1,
        maximum: 1000,
      })
    ),
    mediaType: Type.Optional(
      Type.Union(
        [
          Type.Literal('image'),
          Type.Literal('video'),
          Type.Literal('audio'),
          Type.Literal('document'),
        ],
        { description: 'Filtrar por tipo de mídia' }
      )
    ),
  }),

  getDownloadInfo: Type.Object({
    downloadId: Type.String({ description: 'ID do download', minLength: 1 }),
  }),

  cleanupExpiredDownloads: Type.Object({
    olderThan: Type.Optional(
      Type.Number({
        description: 'Limpar downloads mais antigos que X dias (padrão: 7)',
        minimum: 1,
      })
    ),
  }),

  // ====== DOWNLOAD DE MÍDIA EXTERNA ======
  downloadFromUrl: Type.Object({
    url: Type.String({
      description: 'URL da mídia para baixar',
      format: 'uri',
    }),
    filename: Type.Optional(
      Type.String({
        description:
          'Nome do arquivo (opcional, será detectado automaticamente)',
        minLength: 1,
      })
    ),
    maxSize: Type.Optional(
      Type.Number({
        description: 'Tamanho máximo em MB (padrão: 50)',
        minimum: 1,
        maximum: 100,
      })
    ),
  }),

  downloadAndSend: Type.Object({
    url: Type.String({
      description: 'URL da mídia para baixar e enviar',
      format: 'uri',
    }),
    sessionId: Type.String({
      description: 'ID da sessão WhatsApp',
      minLength: 1,
    }),
    phone: Type.String({
      description: 'Número de telefone no formato internacional',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    caption: Type.Optional(
      Type.String({
        description: 'Legenda da mídia (opcional)',
        maxLength: 1000,
      })
    ),
    filename: Type.Optional(
      Type.String({ description: 'Nome do arquivo (opcional)', minLength: 1 })
    ),
    maxSize: Type.Optional(
      Type.Number({
        description: 'Tamanho máximo em MB (padrão: 50)',
        minimum: 1,
        maximum: 100,
      })
    ),
  }),

  // ====== CONTROLES DE CHAT (IMPLEMENTADOS) ======
  setTypingStatus: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone no formato internacional',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    isTyping: Type.Optional(
      Type.Boolean({ description: 'Se está digitando (padrão: true)' })
    ),
  }),

  markAsRead: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    phone: Type.String({
      description: 'Número de telefone no formato internacional',
      pattern: '^[1-9]\\d{1,14}$',
    }),
    messageId: Type.String({
      description: 'ID da mensagem para marcar como lida',
      minLength: 1,
    }),
  }),

  mentionAll: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    groupId: Type.String({ description: 'ID do grupo', minLength: 1 }),
    message: Type.String({
      description: 'Mensagem para mencionar todos',
      minLength: 1,
    }),
    silentMode: Type.Optional(
      Type.Boolean({ description: 'Usar menções silenciosas (padrão: true)' })
    ),
  }),

  // ====== WEBHOOKS AVANÇADOS COMPLETOS ======
  createAdvancedWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    name: Type.String({
      description: 'Nome identificador do webhook',
      minLength: 1,
    }),
    url: Type.String({ description: 'URL do webhook', format: 'uri' }),
    priority: Type.Optional(
      Type.Number({
        description: 'Prioridade (1-3, padrão: 1)',
        minimum: 1,
        maximum: 3,
      })
    ),
    events: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Eventos específicos (padrão: todos)',
      })
    ),
    active: Type.Optional(
      Type.Boolean({ description: 'Ativar webhook (padrão: true)' })
    ),
  }),

  updateAdvancedWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
    name: Type.Optional(Type.String({ description: 'Novo nome do webhook' })),
    url: Type.Optional(
      Type.String({ description: 'Nova URL do webhook', format: 'uri' })
    ),
    priority: Type.Optional(
      Type.Number({
        description: 'Nova prioridade (1-3)',
        minimum: 1,
        maximum: 3,
      })
    ),
    events: Type.Optional(
      Type.Array(Type.String(), { description: 'Novos eventos' })
    ),
    active: Type.Optional(Type.Boolean({ description: 'Novo status ativo' })),
  }),

  deleteAdvancedWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
  }),

  testAdvancedWebhook: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.String({ description: 'ID do webhook', minLength: 1 }),
    testData: Type.Optional(
      Type.Object({}, { description: 'Dados de teste personalizados' })
    ),
  }),

  // ====== ESTATÍSTICAS E MONITORAMENTO ======
  getSessionStats: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    period: Type.Optional(
      Type.Union(
        [
          Type.Literal('1h'),
          Type.Literal('24h'),
          Type.Literal('7d'),
          Type.Literal('30d'),
        ],
        { description: 'Período para estatísticas (padrão: 24h)' }
      )
    ),
  }),

  getWebhookLogs: Type.Object({
    sessionId: Type.String({ description: 'ID da sessão', minLength: 1 }),
    webhookId: Type.Optional(
      Type.String({ description: 'ID específico do webhook (opcional)' })
    ),
    limit: Type.Optional(
      Type.Number({
        description: 'Limite de logs (padrão: 50)',
        minimum: 1,
        maximum: 1000,
      })
    ),
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
            filename: 'image.jpg',
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
            filename: 'sticker.webp',
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
  async listGroups({
    sessionId,
    includeParticipants = false,
    filter,
    limit = 10,
    offset = 0,
    search,
  }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      // Construir query parameters
      const queryParams = new URLSearchParams({
        limit: Math.min(Math.max(limit, 1), 50).toString(), // Clamp between 1-50
        offset: Math.max(offset, 0).toString(),
      });

      // Adicionar parâmetros opcionais
      if (includeParticipants)
        queryParams.append('includeParticipants', 'true');
      if (filter) queryParams.append('filter', filter);
      if (search) queryParams.append('search', search);

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/list?${queryParams}`,
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
      const pagination = result.pagination || {};

      return {
        success: true,
        groups: result.groups || [],
        pagination: {
          total: pagination.total || 0,
          limit: pagination.limit || limit,
          offset: pagination.offset || offset,
          returned: pagination.returned || result.groups?.length || 0,
          hasMore: pagination.hasMore || false,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil((pagination.total || 0) / limit),
        },
        message: `Página ${Math.floor(offset / limit) + 1}: ${
          pagination.returned || 0
        } de ${
          pagination.total || 0
        } grupos encontrados na sessão '${sessionId}'${
          search ? ` (busca: "${search}")` : ''
        }${pagination.hasMore ? ' - Use offset para ver mais grupos' : ''}`,
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
      // Validação prévia dos parâmetros
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('sessionId é obrigatório e deve ser uma string');
      }
      if (
        !groupName ||
        typeof groupName !== 'string' ||
        groupName.trim().length === 0
      ) {
        throw new Error(
          'groupName é obrigatório e deve ser uma string não vazia'
        );
      }
      if (!Array.isArray(participants) || participants.length === 0) {
        throw new Error(
          'participants deve ser um array não vazio de números de telefone'
        );
      }

      // Validar formato dos números de telefone
      const validParticipants = participants.filter((phone) => {
        if (typeof phone !== 'string') return false;
        // Aceitar números com ou sem código do país
        const cleanPhone = phone.replace(/\D/g, ''); // Remove caracteres não numéricos
        return cleanPhone.length >= 10 && cleanPhone.length <= 15;
      });

      if (validParticipants.length === 0) {
        throw new Error(
          'Nenhum número de telefone válido encontrado nos participantes'
        );
      }

      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const requestBody = {
        groupName: groupName.trim(),
        participants: validParticipants,
      };

      console.log(
        `[createGroup] Criando grupo '${groupName}' com ${validParticipants.length} participantes`
      );

      // Verificar status da sessão antes de tentar criar grupo
      const statusResponse = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/status`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (!statusData.isConnected) {
          throw new Error(
            `Sessão '${sessionId}' não está conectada ao WhatsApp. Conecte a sessão primeiro.`
          );
        }
      }

      const response = await fetch(
        `http://localhost:3000/api/baileys/groups/${sessionId}/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          errorData.message ||
          errorData.error ||
          `Erro HTTP: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Grupo '${groupName}' criado com sucesso com ${validParticipants.length} participantes`,
        groupId: result.groupId,
        participants: validParticipants,
        data: result,
      };
    } catch (error) {
      console.error(
        `[createGroup] Erro ao criar grupo '${groupName}':`,
        error.message
      );
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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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

  async sendMedia({
    sessionId,
    phone,
    mediaUrl,
    mediaType,
    caption,
    fileName,
  }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
            voiceMessage: mediaType === 'audio',
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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      // Converter número para formato JID se necessário
      const jid = formatPhoneToJid(phone);

      if (!messageId) {
        throw new Error(
          'messageId é obrigatório para marcar mensagem como lida'
        );
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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
        message: `Status de digitação ${
          isTyping ? 'ativado' : 'desativado'
        } para ${phone}`,
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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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

  // ====== DOWNLOAD DE MÍDIA EXTERNA ======
  async downloadFromUrl({ url, filename, maxSize = 50 }) {
    try {
      const https = require('https');
      const http = require('http');
      const fs = require('fs');
      const path = require('path');
      const crypto = require('crypto');

      console.log(`📥 Iniciando download de: ${url}`);

      // Detectar protocolo
      const isHttps = url.startsWith('https://');
      const httpModule = isHttps ? https : http;

      return new Promise((resolve, reject) => {
        const request = httpModule.get(url, (response) => {
          // Verificar status HTTP
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Erro HTTP ${response.statusCode}: ${response.statusMessage}`
              )
            );
            return;
          }

          // Obter informações do arquivo
          const contentLength = parseInt(
            response.headers['content-length'] || '0'
          );
          const contentType =
            response.headers['content-type'] || 'application/octet-stream';

          // Verificar tamanho máximo
          const maxSizeBytes = maxSize * 1024 * 1024; // Converter MB para bytes
          if (contentLength > maxSizeBytes) {
            reject(
              new Error(
                `Arquivo muito grande: ${(contentLength / 1024 / 1024).toFixed(
                  2
                )}MB (máximo: ${maxSize}MB)`
              )
            );
            return;
          }

          // Detectar tipo de mídia e extensão
          let mediaType = 'document';
          let fileExtension = 'bin';

          if (contentType.startsWith('image/')) {
            mediaType = 'image';
            fileExtension = contentType.split('/')[1] || 'jpg';
          } else if (contentType.startsWith('video/')) {
            mediaType = 'video';
            fileExtension = contentType.split('/')[1] || 'mp4';
          } else if (contentType.startsWith('audio/')) {
            mediaType = 'audio';
            fileExtension = contentType.split('/')[1] || 'mp3';
          } else if (contentType.includes('pdf')) {
            fileExtension = 'pdf';
          } else if (contentType.includes('zip')) {
            fileExtension = 'zip';
          }

          // Gerar nome do arquivo se não fornecido
          const downloadId = crypto.randomBytes(16).toString('hex');
          const finalFilename =
            filename || `download_${downloadId}.${fileExtension}`;

          // Criar diretório de downloads se não existir
          const downloadsDir = path.join(process.cwd(), 'downloads');
          if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
          }

          const safeFileName = `${downloadId}_${finalFilename.replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          )}`;
          const filePath = path.join(downloadsDir, safeFileName);

          // Stream para arquivo
          const fileStream = fs.createWriteStream(filePath);
          let downloadedBytes = 0;

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;

            // Verificar limite durante download
            if (downloadedBytes > maxSizeBytes) {
              fileStream.destroy();
              fs.unlinkSync(filePath);
              reject(
                new Error(`Download cancelado: excedeu limite de ${maxSize}MB`)
              );
              return;
            }
          });

          response.pipe(fileStream);

          fileStream.on('finish', () => {
            console.log(
              `✅ Download concluído: ${finalFilename} (${(
                downloadedBytes / 1024
              ).toFixed(2)}KB)`
            );

            // Gerar URL de download
            const baseUrl =
              process.env.CORS_ORIGIN ||
              `http://localhost:${process.env.PORT || 3000}`;
            const serverUrl = baseUrl.replace(
              '5173',
              process.env.PORT || '3000'
            );
            const downloadUrl = `${serverUrl}/api/baileys/download/${downloadId}`;

            resolve({
              success: true,
              downloadId,
              filename: finalFilename,
              safeFileName,
              filePath,
              downloadUrl,
              mediaType,
              contentType,
              size: downloadedBytes,
              sizeFormatted: `${(downloadedBytes / 1024).toFixed(2)}KB`,
              message: `Mídia baixada com sucesso: ${finalFilename} (${mediaType})`,
            });
          });

          fileStream.on('error', (error) => {
            fs.unlinkSync(filePath);
            reject(error);
          });
        });

        request.on('error', (error) => {
          reject(new Error(`Erro na requisição: ${error.message}`));
        });

        // Timeout de 30 segundos
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Timeout: download demorou mais de 30 segundos'));
        });
      });
    } catch (error) {
      console.error('Erro no download:', error);
      return {
        success: false,
        error: error.message,
        message: `Falha ao baixar mídia de ${url}: ${error.message}`,
      };
    }
  },

  async downloadAndSend({
    url,
    sessionId,
    phone,
    caption,
    filename,
    maxSize = 50,
  }) {
    try {
      console.log(`🚀 Baixando e enviando mídia de ${url} para ${phone}`);

      // Primeiro, baixar a mídia
      const downloadResult = await this.downloadFromUrl({
        url,
        filename,
        maxSize,
      });

      if (!downloadResult.success) {
        return downloadResult;
      }

      // Determinar o método de envio baseado no tipo de mídia
      const {
        mediaType,
        downloadUrl,
        filename: finalFilename,
      } = downloadResult;

      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      let sendResult;

      // Enviar usando o método apropriado
      if (mediaType === 'image') {
        sendResult = await this.sendImage({
          sessionId,
          phone,
          imageUrl: downloadUrl,
          caption,
        });
      } else if (mediaType === 'video') {
        sendResult = await this.sendMedia({
          sessionId,
          phone,
          mediaUrl: downloadUrl,
          mediaType: 'video',
          caption,
          fileName: finalFilename,
        });
      } else if (mediaType === 'audio') {
        sendResult = await this.sendMedia({
          sessionId,
          phone,
          mediaUrl: downloadUrl,
          mediaType: 'audio',
          caption,
          fileName: finalFilename,
        });
      } else {
        // Documento
        sendResult = await this.sendDocument({
          sessionId,
          phone,
          documentUrl: downloadUrl,
          fileName: finalFilename,
          caption,
        });
      }

      if (sendResult.success) {
        return {
          success: true,
          downloadInfo: downloadResult,
          sendInfo: sendResult,
          message: `Mídia baixada e enviada com sucesso! ${finalFilename} (${downloadResult.sizeFormatted}) → ${phone}`,
        };
      } else {
        return {
          success: false,
          downloadInfo: downloadResult,
          sendError: sendResult,
          error: sendResult.error,
          message: `Mídia baixada mas falhou ao enviar: ${sendResult.message}`,
        };
      }
    } catch (error) {
      console.error('Erro no downloadAndSend:', error);
      return {
        success: false,
        error: error.message,
        message: `Falha ao baixar e enviar mídia: ${error.message}`,
      };
    }
  },

  // Webhooks avançados
  async createWebhook({
    sessionId,
    webhookUrl,
    priority = 1,
    events,
    isActive = true,
  }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
        message: `${
          result.total || 0
        } webhooks encontrados para sessão '${sessionId}'`,
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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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
        message: `Webhook ${webhookId} ${
          isActive ? 'ativado' : 'desativado'
        } com sucesso`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao ${
          isActive ? 'ativar' : 'desativar'
        } webhook ${webhookId}: ${error.message}`,
      };
    }
  },

  async testWebhook({ sessionId, webhookId, testData }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            testData: testData || {
              test: true,
              timestamp: new Date().toISOString(),
            },
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

  // ====== CONTROLES DE CHAT ======
  async setPresence({ sessionId, phone, presence }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/presence`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            phone,
            presence,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Status de presença atualizado para ${phone}: ${presence}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao atualizar status de presença para ${phone}: ${error.message}`,
      };
    }
  },

  async sendPresenceUpdate({ sessionId, phone, type }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/presence-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            phone,
            type,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Status de presença atualizado para ${phone}: ${type}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar atualização de status de presença para ${phone}: ${error.message}`,
      };
    }
  },

  // ====== MENSAGENS AVANÇADAS ======
  async sendLocation({ sessionId, phone, latitude, longitude, name, address }) {
    return {
      success: false,
      error: 'Endpoint não implementado',
      message: `Envio de localização não está implementado ainda. Use sendMessage para enviar texto com coordenadas: "Localização: ${latitude}, ${longitude} ${
        name ? '- ' + name : ''
      }${address ? ' (' + address + ')' : ''}"`,
    };
  },

  async sendContact({ sessionId, phone, contactName, contactPhone }) {
    return {
      success: false,
      error: 'Endpoint não implementado',
      message: `Envio de contato não está implementado ainda. Use sendMessage para enviar: "Contato: ${contactName} - ${contactPhone}"`,
    };
  },

  async sendReaction({ sessionId, messageId, emoji }) {
    return {
      success: false,
      error: 'Endpoint não implementado',
      message: `Envio de reações não está implementado ainda. Funcionalidade será adicionada em versão futura.`,
    };
  },

  async mentionAll({ sessionId, groupId, message, silentMode }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/mention-all`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            groupId,
            message,
            silentMode,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro HTTP: ${response.status}`);
      }

      return {
        success: true,
        message: `Mensagem para mencionar todos enviada para o grupo ${groupId}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar mensagem para mencionar todos: ${error.message}`,
      };
    }
  },

  // ====== WEBHOOKS AVANÇADOS COMPLETOS ======
  async createAdvancedWebhook({
    sessionId,
    name,
    url,
    priority,
    events,
    active,
  }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            name,
            url,
            priority: priority || 1,
            events: events || ['*'],
            active: active !== false,
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
        webhookId: result.webhook?.id,
        message: `Webhook '${name}' criado com sucesso para sessão '${sessionId}'`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao criar webhook '${name}' para '${sessionId}': ${error.message}`,
      };
    }
  },

  async updateAdvancedWebhook({
    sessionId,
    webhookId,
    name,
    url,
    priority,
    events,
    active,
  }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            name,
            url,
            priority,
            events,
            active,
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

  async deleteAdvancedWebhook({ sessionId, webhookId }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

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

  async testAdvancedWebhook({ sessionId, webhookId, testData }) {
    try {
      const userToken =
        this.getUserToken?.() ||
        process.env.BAILEYS_API_TOKEN ||
        'baileys_default_token';

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/webhooks/${webhookId}/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            testData: testData || {
              test: true,
              timestamp: new Date().toISOString(),
            },
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

  // ====== ESTATÍSTICAS E MONITORAMENTO ======
  async getSessionStats({ sessionId, period }) {
    try {
      // Usar o endpoint de status que existe para obter informações básicas
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
        stats: {
          sessionId: result.sessionId,
          isConnected: result.isConnected,
          connectionState: result.connectionState,
          messageCount: result.messageCount || 0,
          queueLength: result.queueLength || 0,
          reconnectionAttempts: result.reconnectionAttempts || 0,
          createdAt: result.createdAt,
          connectedAt: result.connectedAt,
          lastError: result.lastError,
          user: result.user,
          note: `Estatísticas básicas obtidas do status da sessão (período ${
            period || '24h'
          } não implementado ainda)`,
        },
        message: `Estatísticas básicas da sessão '${sessionId}' obtidas`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter estatísticas da sessão '${sessionId}': ${error.message}`,
      };
    }
  },

  async getWebhookLogs({ sessionId, webhookId, limit }) {
    return {
      success: false,
      error: 'Endpoint não implementado',
      message: `Logs de webhook não estão implementados ainda. Use listWebhooks para ver webhooks ativos da sessão '${sessionId}'.`,
    };
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

  // ====== DOWNLOAD DE MÍDIA EXTERNA ======
  {
    type: 'function',
    function: {
      name: 'downloadFromUrl',
      description:
        'Baixa mídia de uma URL externa e salva no servidor para uso posterior',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL da mídia para baixar',
          },
          filename: {
            type: 'string',
            description:
              'Nome do arquivo (opcional, será detectado automaticamente)',
          },
          maxSize: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            description: 'Tamanho máximo em MB (padrão: 50)',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'downloadAndSend',
      description:
        'Baixa mídia de uma URL externa e envia diretamente para um contato WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL da mídia para baixar e enviar',
          },
          sessionId: {
            type: 'string',
            description: 'ID da sessão WhatsApp',
          },
          phone: {
            type: 'string',
            pattern: '^[1-9]\\d{1,14}$',
            description: 'Número de telefone no formato internacional',
          },
          caption: {
            type: 'string',
            maxLength: 1000,
            description: 'Legenda da mídia (opcional)',
          },
          filename: {
            type: 'string',
            description: 'Nome do arquivo (opcional)',
          },
          maxSize: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            description: 'Tamanho máximo em MB (padrão: 50)',
          },
        },
        required: ['url', 'sessionId', 'phone'],
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
  {
    type: 'function',
    function: {
      name: 'setPresence',
      description: 'Definir o status de presença de um contato',
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
          presence: {
            type: 'string',
            enum: [
              'available',
              'unavailable',
              'composing',
              'recording',
              'paused',
            ],
            description: 'Tipo de presença a definir',
          },
        },
        required: ['sessionId', 'phone', 'presence'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendPresenceUpdate',
      description: 'Enviar atualização de status de presença',
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
          type: {
            type: 'string',
            enum: ['composing', 'recording', 'paused'],
            description:
              'Tipo de presença (composing=digitando, recording=gravando)',
          },
        },
        required: ['sessionId', 'phone', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendLocation',
      description: 'Enviar localização',
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
          latitude: {
            type: 'number',
            description: 'Latitude da localização',
          },
          longitude: {
            type: 'number',
            description: 'Longitude da localização',
          },
          name: {
            type: 'string',
            description: 'Nome do local (opcional)',
          },
          address: {
            type: 'string',
            description: 'Endereço do local (opcional)',
          },
        },
        required: ['sessionId', 'phone', 'latitude', 'longitude'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendContact',
      description: 'Enviar contato',
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
          contactName: {
            type: 'string',
            description: 'Nome do contato',
          },
          contactPhone: {
            type: 'string',
            description: 'Telefone do contato no formato internacional',
          },
        },
        required: ['sessionId', 'phone', 'contactName', 'contactPhone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendReaction',
      description: 'Enviar reação',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          messageId: {
            type: 'string',
            description: 'ID da mensagem para reagir',
          },
          emoji: {
            type: 'string',
            description: 'Emoji da reação (ex: 👍, ❤️, 😂)',
          },
        },
        required: ['sessionId', 'messageId', 'emoji'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mentionAll',
      description: 'Mencionar todos',
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
          message: {
            type: 'string',
            description: 'Mensagem para mencionar todos',
          },
          silentMode: {
            type: 'boolean',
            description: 'Usar menções silenciosas (padrão: true)',
          },
        },
        required: ['sessionId', 'groupId', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createAdvancedWebhook',
      description: 'Criar um novo webhook avançado',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          name: {
            type: 'string',
            description: 'Nome identificador do webhook',
          },
          url: {
            type: 'string',
            description: 'URL do webhook',
          },
          priority: {
            type: 'number',
            description: 'Prioridade (1-3, padrão: 1)',
            minimum: 1,
            maximum: 3,
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            description: 'Eventos específicos (padrão: todos)',
          },
          active: {
            type: 'boolean',
            description: 'Ativar webhook (padrão: true)',
          },
        },
        required: ['sessionId', 'name', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateAdvancedWebhook',
      description: 'Atualizar configurações de um webhook avançado',
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
          name: {
            type: 'string',
            description: 'Novo nome do webhook',
          },
          url: {
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
            description: 'Novos eventos',
          },
          active: {
            type: 'boolean',
            description: 'Novo status ativo',
          },
        },
        required: ['sessionId', 'webhookId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteAdvancedWebhook',
      description: 'Deletar um webhook avançado',
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
      name: 'testAdvancedWebhook',
      description: 'Testar um webhook avançado enviando dados de teste',
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
            description: 'Dados de teste personalizados',
          },
        },
        required: ['sessionId', 'webhookId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSessionStats',
      description: 'Obter estatísticas de uma sessão',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          period: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            description: 'Período para estatísticas (padrão: 24h)',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getWebhookLogs',
      description: 'Obter logs de um webhook específico',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID da sessão',
          },
          webhookId: {
            type: 'string',
            description: 'ID específico do webhook (opcional)',
          },
          limit: {
            type: 'number',
            description: 'Limite de logs (padrão: 50)',
            minimum: 1,
            maximum: 1000,
          },
        },
        required: ['sessionId'],
      },
    },
  },
];

module.exports = {
  toolSchemas,
  toolImplementations,
  openAITools,
};
