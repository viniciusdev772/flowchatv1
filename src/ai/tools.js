const { z } = require('zod');

// Definições Zod para as tools
const toolSchemas = {
  // Tool para criar uma nova sessão WhatsApp
  createSession: z.object({
    sessionId: z.string().describe('ID único para a nova sessão'),
    description: z.string().optional().describe('Descrição opcional da sessão')
  }),

  // Tool para listar sessões ativas
  listSessions: z.object({}),

  // Tool para deletar uma sessão
  deleteSession: z.object({
    sessionId: z.string().describe('ID da sessão a ser deletada')
  }),

  // Tool para enviar mensagem via WhatsApp
  sendMessage: z.object({
    sessionId: z.string().describe('ID da sessão'),
    phone: z.string().describe('Número de telefone (formato: 5511999999999)'),
    message: z.string().describe('Mensagem a ser enviada')
  }),

  // Tool para configurar webhook
  setWebhook: z.object({
    sessionId: z.string().describe('ID da sessão'),
    webhookUrl: z.string().url().describe('URL do webhook'),
    priority: z.number().min(1).max(3).default(1).describe('Prioridade do webhook (1-3)')
  }),

  // Tool para listar grupos de uma sessão
  listGroups: z.object({
    sessionId: z.string().describe('ID da sessão')
  }),

  // Tool para criar grupo
  createGroup: z.object({
    sessionId: z.string().describe('ID da sessão'),
    groupName: z.string().describe('Nome do grupo'),
    participants: z.array(z.string()).describe('Array de números dos participantes')
  }),

  // Tool para obter QR code
  getQRCode: z.object({
    sessionId: z.string().describe('ID da sessão')
  }),

  // Tool para verificar status da sessão
  getSessionStatus: z.object({
    sessionId: z.string().describe('ID da sessão')
  }),

  // Tool para buscar conversas/mensagens
  searchMessages: z.object({
    sessionId: z.string().describe('ID da sessão'),
    query: z.string().describe('Termo de busca'),
    limit: z.number().optional().default(10).describe('Limite de resultados')
  }),

  // Tool para obter informações do sistema
  getSystemInfo: z.object({})
};

// Implementações das tools
const toolImplementations = {
  async createSession({ sessionId, description }) {
    try {
      // Usar a lógica existente do app.js
      const response = await fetch(`http://localhost:3000/api/baileys/${sessionId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao criar sessão: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        sessionId,
        message: `Sessão '${sessionId}' criada com sucesso`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao criar sessão: ${error.message}`
      };
    }
  },

  async listSessions() {
    try {
      const sessions = global.whatsappSessions || new Map();
      const sessionsList = Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        status: session.status || 'unknown',
        connected: session.sock?.user ? true : false,
        phone: session.sock?.user?.id || null
      }));

      return {
        success: true,
        sessions: sessionsList,
        total: sessionsList.length,
        message: `${sessionsList.length} sessões encontradas`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Erro ao listar sessões: ${error.message}`
      };
    }
  },

  async deleteSession({ sessionId }) {
    try {
      const response = await fetch(`http://localhost:3000/api/baileys/${sessionId}/close`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao deletar sessão: ${response.statusText}`);
      }
      
      return {
        success: true,
        sessionId,
        message: `Sessão '${sessionId}' deletada com sucesso`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao deletar sessão: ${error.message}`
      };
    }
  },

  async sendMessage({ sessionId, phone, message }) {
    try {
      const response = await fetch(`http://localhost:3000/api/baileys/${sessionId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          message
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao enviar mensagem: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        message: `Mensagem enviada para ${phone}`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao enviar mensagem: ${error.message}`
      };
    }
  },

  async setWebhook({ sessionId, webhookUrl, priority }) {
    try {
      const response = await fetch(`http://localhost:3000/api/baileys/${sessionId}/set-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          priority
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao configurar webhook: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        message: `Webhook configurado para sessão '${sessionId}'`,
        webhookUrl,
        priority,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao configurar webhook: ${error.message}`
      };
    }
  },

  async listGroups({ sessionId }) {
    try {
      const response = await fetch(`http://localhost:3000/api/baileys/groups/${sessionId}/list`);
      
      if (!response.ok) {
        throw new Error(`Erro ao listar grupos: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        groups: result.groups || [],
        total: result.groups?.length || 0,
        message: `${result.groups?.length || 0} grupos encontrados`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao listar grupos: ${error.message}`
      };
    }
  },

  async createGroup({ sessionId, groupName, participants }) {
    try {
      const response = await fetch(`http://localhost:3000/api/baileys/groups/${sessionId}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName,
          participants
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao criar grupo: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        message: `Grupo '${groupName}' criado com sucesso`,
        groupId: result.groupId,
        participants,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao criar grupo: ${error.message}`
      };
    }
  },

  async getQRCode({ sessionId }) {
    try {
      const response = await fetch(`http://localhost:3000/api/baileys/${sessionId}/qr`);
      
      if (!response.ok) {
        throw new Error(`Erro ao obter QR code: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        qrCode: result.qr,
        message: result.qr ? 'QR code disponível' : 'QR code não disponível ou sessão já conectada'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter QR code: ${error.message}`
      };
    }
  },

  async getSessionStatus({ sessionId }) {
    try {
      const response = await fetch(`http://localhost:3000/api/baileys/${sessionId}/status`);
      
      if (!response.ok) {
        throw new Error(`Erro ao obter status: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        status: result.status,
        connected: result.connected,
        phone: result.phone,
        message: `Status da sessão '${sessionId}': ${result.status}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter status: ${error.message}`
      };
    }
  },

  async searchMessages({ sessionId, query, limit }) {
    try {
      // Esta seria uma funcionalidade avançada - por enquanto retornamos uma simulação
      return {
        success: true,
        results: [],
        query,
        message: `Busca por '${query}' na sessão '${sessionId}' (funcionalidade em desenvolvimento)`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha na busca: ${error.message}`
      };
    }
  },

  async getSystemInfo() {
    try {
      const sessions = global.whatsappSessions || new Map();
      const activeSessions = Array.from(sessions.values()).filter(s => s.sock?.user).length;
      
      return {
        success: true,
        info: {
          totalSessions: sessions.size,
          activeSessions,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform
        },
        message: 'Informações do sistema coletadas'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Falha ao obter informações: ${error.message}`
      };
    }
  }
};

// Definição das tools para OpenAI
const openAITools = [
  {
    type: "function",
    function: {
      name: "createSession",
      description: "Cria uma nova sessão WhatsApp com ID específico",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID único para a nova sessão"
          },
          description: {
            type: "string", 
            description: "Descrição opcional da sessão"
          }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listSessions",
      description: "Lista todas as sessões WhatsApp ativas no sistema",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteSession",
      description: "Remove/fecha uma sessão WhatsApp específica",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID da sessão a ser deletada"
          }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sendMessage",
      description: "Envia uma mensagem de texto via WhatsApp",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID da sessão WhatsApp"
          },
          phone: {
            type: "string",
            description: "Número de telefone no formato internacional (ex: 5511999999999)"
          },
          message: {
            type: "string",
            description: "Conteúdo da mensagem a ser enviada"
          }
        },
        required: ["sessionId", "phone", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "setWebhook", 
      description: "Configura um webhook para receber eventos de uma sessão",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID da sessão"
          },
          webhookUrl: {
            type: "string",
            description: "URL do webhook que receberá os eventos"
          },
          priority: {
            type: "number",
            description: "Prioridade do webhook (1-3, sendo 1 a maior prioridade)",
            minimum: 1,
            maximum: 3
          }
        },
        required: ["sessionId", "webhookUrl"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listGroups",
      description: "Lista todos os grupos WhatsApp de uma sessão",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID da sessão"
          }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createGroup",
      description: "Cria um novo grupo WhatsApp",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID da sessão"
          },
          groupName: {
            type: "string",
            description: "Nome do grupo"
          },
          participants: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Array de números de telefone dos participantes"
          }
        },
        required: ["sessionId", "groupName", "participants"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getQRCode",
      description: "Obtém o QR code para autenticação de uma sessão",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID da sessão"
          }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getSessionStatus",
      description: "Verifica o status de conexão de uma sessão",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID da sessão"
          }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getSystemInfo",
      description: "Obtém informações gerais do sistema e estatísticas",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

module.exports = {
  toolSchemas,
  toolImplementations,
  openAITools
};