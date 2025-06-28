const { z } = require('zod');

// Definições Zod para as tools
const toolSchemas = {
  // ====== SESSÕES ======
  createSession: z.object({
    sessionId: z.string().describe('ID único para a nova sessão'),
  }),

  listSessions: z.object({}),

  deleteSession: z.object({
    sessionId: z.string().describe('ID da sessão a ser deletada'),
  }),

  getSessionStatus: z.object({
    sessionId: z.string().describe('ID da sessão'),
  }),

  regenerateQRCode: z.object({
    sessionId: z.string().describe('ID da sessão para regenerar QR code'),
  }),

  // ====== MENSAGENS ======
  sendMessage: z.object({
    sessionId: z.string().describe('ID da sessão'),
    phone: z.string().describe('Número de telefone (formato: 5511999999999)'),
    message: z.string().describe('Mensagem de texto a ser enviada'),
  }),

  sendImage: z.object({
    sessionId: z.string().describe('ID da sessão'),
    phone: z.string().describe('Número de telefone (formato: 5511999999999)'),
    imageUrl: z.string().url().describe('URL da imagem a ser enviada'),
    caption: z.string().optional().describe('Legenda da imagem (opcional)'),
  }),

  sendDocument: z.object({
    sessionId: z.string().describe('ID da sessão'),
    phone: z.string().describe('Número de telefone (formato: 5511999999999)'),
    documentUrl: z.string().url().describe('URL do documento a ser enviado'),
    fileName: z.string().describe('Nome do arquivo'),
    caption: z.string().optional().describe('Legenda do documento (opcional)'),
  }),

  sendSticker: z.object({
    sessionId: z.string().describe('ID da sessão'),
    phone: z.string().describe('Número de telefone (formato: 5511999999999)'),
    stickerUrl: z
      .string()
      .url()
      .describe('URL do sticker (WebP) a ser enviado'),
  }),

  // ====== WEBHOOKS ======
  setWebhook: z.object({
    sessionId: z.string().describe('ID da sessão'),
    webhookUrl: z.string().url().describe('URL do webhook'),
    priority: z
      .number()
      .min(1)
      .max(3)
      .default(1)
      .describe('Prioridade do webhook (1-3)'),
  }),

  removeWebhook: z.object({
    sessionId: z.string().describe('ID da sessão'),
  }),

  // ====== GRUPOS ======
  listGroups: z.object({
    sessionId: z.string().describe('ID da sessão'),
  }),

  createGroup: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupName: z.string().describe('Nome do grupo'),
    participants: z
      .array(z.string())
      .describe('Array de números dos participantes'),
  }),

  getGroupInfo: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
  }),

  addGroupParticipants: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
    participants: z
      .array(z.string())
      .describe('Array de números a serem adicionados'),
  }),

  removeGroupParticipants: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
    participants: z
      .array(z.string())
      .describe('Array de números a serem removidos'),
  }),

  promoteGroupParticipants: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
    participants: z
      .array(z.string())
      .describe('Array de números a serem promovidos a admin'),
  }),

  demoteGroupParticipants: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
    participants: z
      .array(z.string())
      .describe('Array de números a serem despromovidos'),
  }),

  updateGroupName: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
    subject: z.string().describe('Novo nome do grupo'),
  }),

  updateGroupDescription: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
    description: z.string().describe('Nova descrição do grupo'),
  }),

  updateGroupSettings: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
    onlyAdminsCanSend: z
      .boolean()
      .optional()
      .describe('Se apenas admins podem enviar mensagens'),
    onlyAdminsCanEditInfo: z
      .boolean()
      .optional()
      .describe('Se apenas admins podem editar informações'),
  }),

  leaveGroup: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
  }),

  getGroupInviteCode: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
  }),

  revokeGroupInviteCode: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupId: z.string().describe('ID do grupo'),
  }),

  // ====== SISTEMA ======
  getSystemInfo: z.object({}),

  cleanupOrphanedSessions: z.object({}),
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
        `http://localhost:3000/api/baileys/session/${sessionId}/delete`,
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
            phone,
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

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            phone,
            imageUrl,
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

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            phone,
            documentUrl,
            fileName,
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

      const response = await fetch(
        `http://localhost:3000/api/baileys/session/${sessionId}/send-sticker`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            phone,
            stickerUrl,
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
