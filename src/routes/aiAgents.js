const express = require('express');
const { z } = require('zod');
const database = require('../config/database');
const router = express.Router();

// In-memory storage for AI agents (cache for performance)
const aiAgents = new Map();

// Zod validation schemas
const createAgentSchema = z.object({
  sessionId: z.string().min(1, 'Session ID é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().optional(),
  model: z.enum(['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro']),
  personality: z.enum([
    'professional',
    'friendly',
    'creative',
    'analytical',
    'casual',
    'empathetic',
  ]),
  specialization: z.enum([
    'general',
    'sales',
    'support',
    'education',
    'health',
    'finance',
  ]),
  creativity: z.number().min(0).max(100),
  learningEnabled: z.boolean(),
  autoReply: z.boolean(),
  smartReplies: z.boolean(),
  openaiApiKey: z.string().min(1, 'Chave da API OpenAI é obrigatória'),
  tools: z.array(z.string()).default(['web_search']),
  replyToGroups: z.boolean().default(true), // Nova opção para responder grupos
});

// AI Tools implementation
class AITools {
  constructor() {
    this.tools = {
      web_search: this.webSearch.bind(this),
    };
  }

  async webSearch(query, options = {}) {
    try {
      const fetch = require('node-fetch');
      const cheerio = require('cheerio');

      // Use SerpAPI if available, otherwise fallback to basic search
      if (process.env.SERPAPI_KEY) {
        const serpApiUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(
          query
        )}&api_key=${process.env.SERPAPI_KEY}&num=5`;
        const response = await fetch(serpApiUrl);
        const data = await response.json();

        return {
          query,
          results:
            data.organic_results?.map((result) => ({
              title: result.title,
              snippet: result.snippet,
              url: result.link,
              source: 'serpapi',
            })) || [],
          timestamp: new Date().toISOString(),
        };
      } else {
        // Fallback: basic web scraping (limited)
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          query
        )}`;
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        const html = await response.text();
        const $ = cheerio.load(html);

        const results = [];
        $('.g').each((i, elem) => {
          if (i >= 5) return false; // Limit to 5 results

          const title = $(elem).find('h3').text();
          const snippet =
            $(elem).find('.VwiC3b').text() || $(elem).find('.s3v9rd').text();
          const url = $(elem).find('a').attr('href');

          if (title && snippet && url) {
            results.push({
              title,
              snippet,
              url: url.startsWith('/url?q=')
                ? decodeURIComponent(url.split('/url?q=')[1].split('&')[0])
                : url,
              source: 'fallback',
            });
          }
        });

        return {
          query,
          results,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('Web search error:', error);
      return {
        query,
        results: [],
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async executeTool(toolName, params) {
    if (!this.tools[toolName]) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    return await this.tools[toolName](params);
  }

  getAvailableTools() {
    return Object.keys(this.tools);
  }
}

// AI Agent class
class AIAgent {
  constructor(config) {
    this.id = config.id || Date.now().toString();
    this.sessionId = config.sessionId;
    this.name = config.name;
    this.description = config.description;
    this.model = config.model;
    this.personality = config.personality;
    this.specialization = config.specialization;
    this.creativity = config.creativity;
    this.learningEnabled = config.learningEnabled;
    this.autoReply = config.autoReply;
    this.smartReplies = config.smartReplies;
    this.replyToGroups =
      config.replyToGroups !== undefined ? config.replyToGroups : true;
    this.openaiApiKey = config.openaiApiKey;
    this.tools = new AITools();
    this.enabledTools = config.tools || ['web_search'];
    this.isActive = config.isActive !== undefined ? config.isActive : true;
    this.createdAt = config.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.messageCount = config.messageCount || 0;
    this.conversationHistory = config.conversationHistory || [];
  }

  async processMessage(messageData, whatsappClient = null) {
    try {
      console.log(`[AI Agent ${this.id}] Processing message:`, JSON.stringify(messageData, null, 2));
      
      this.messageCount++;
      this.updatedAt = new Date().toISOString();

      // Extract rich message information
      const messageText = messageData.content || messageData.text || messageData.body || '';
      const isGroup = messageData.chat?.isGroup || false;
      const senderInfo = messageData.sender || {};
      const chatInfo = messageData.chat || {};

      console.log(`[AI Agent ${this.id}] Extracted - messageText: "${messageText}", isGroup: ${isGroup}, senderInfo:`, senderInfo);

      // Skip empty messages
      if (!messageText.trim()) {
        console.log(`[AI Agent ${this.id}] Skipping empty message`);
        return { shouldReply: false };
      }

      // Skip if agent doesn't want to reply to groups and this is a group message
      if (isGroup && !this.replyToGroups) {
        console.log(`Agent ${this.id} skipping group message (replyToGroups: false)`);
        return { shouldReply: false };
      }

      // Marcar mensagem como lida se cliente WhatsApp estiver disponível
      if (whatsappClient && messageData.messageId) {
        try {
          const key = {
            id: messageData.messageId,
            fromMe: false,
            remoteJid: chatInfo.id
          };
          await whatsappClient.readMessages([key]);
          console.log(`Message marked as read: ${messageData.messageId}`);
        } catch (readError) {
          console.error('Error marking message as read:', readError);
        }
      }

      // Create rich conversation entry
      const conversationEntry = {
        type: 'user',
        content: messageText,
        timestamp: messageData.timestamp || new Date().toISOString(),
        messageId: messageData.messageId,
        sender: {
          id: senderInfo.id,
          pushName: senderInfo.pushName,
          isMe: senderInfo.isMe || false
        },
        chat: {
          id: chatInfo.id,
          type: chatInfo.type || (isGroup ? 'group' : 'private'),
          isGroup: isGroup,
          name: chatInfo.name || (isGroup ? 'Grupo' : senderInfo.pushName || 'Contato')
        },
        messageType: messageData.messageType,
        hasQuotedMessage: !!messageData.quotedMessage
      };

      // Save to MongoDB instead of memory
      await this.saveConversationEntry(conversationEntry);

      // Generate AI response with rich context
      console.log(`[AI Agent ${this.id}] Generating AI response...`);
      const response = await this.generateResponse(messageData, conversationEntry);
      console.log(`[AI Agent ${this.id}] Generated response: "${response}"`);
      
      if (!response || response.trim() === '') {
        console.warn(`[AI Agent ${this.id}] Empty response generated, using fallback`);
        throw new Error('Empty response generated');
      }

      // Create response entry
      const responseEntry = {
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        inResponseTo: messageData.messageId,
        chat: conversationEntry.chat
      };

      // Save AI response to MongoDB
      await this.saveConversationEntry(responseEntry);

      // Save updated agent state to database (async, don't wait)
      this.save().catch((err) =>
        console.error('Error saving agent state:', err)
      );

      return {
        response,
        replyToMessageId: messageData.messageId,
        shouldReply: true,
        chatId: chatInfo.id,
        isGroup: isGroup,
        senderInfo: senderInfo
      };
    } catch (error) {
      console.error('Error processing message:', error);

      // Resposta de fallback baseada na personalidade do agente
      const fallbackResponses = {
        professional:
          'Sistema temporariamente indisponível. Posso ajudá-lo de outra forma?',
        friendly:
          'Opa! Algo deu errado aqui, mas estou pronto para conversar! Como posso ajudar?',
        creative:
          'Vamos tentar uma nova abordagem! Me conte o que você precisa.',
        analytical: 'Erro no processamento. Pode detalhar sua solicitação?',
        casual: 'Deu ruim aqui! Mas me fala aí, o que você precisa?',
        empathetic:
          'Entendo que isso pode ser frustrante. Vamos tentar de novo?',
      };

      return {
        response: fallbackResponses[this.personality] || 'Como posso ajudá-lo?',
        replyToMessageId: messageData.messageId,
        shouldReply: true,
      };
    }
  }

  async generateResponse(messageData, conversationEntry) {
    try {
      console.log(`[AI Agent ${this.id}] Starting generateResponse...`);
      
      const { ChatOpenAI } = require('@langchain/openai');
      const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

      // Validate API key
      if (!this.openaiApiKey || this.openaiApiKey.trim() === '') {
        console.error(`[AI Agent ${this.id}] OpenAI API key is missing or empty`);
        throw new Error('OpenAI API key is required');
      }
      
      console.log(`[AI Agent ${this.id}] API key validated, initializing ChatOpenAI...`);

      const llm = new ChatOpenAI({
        apiKey: this.openaiApiKey,
        model: this.model,
        temperature: this.creativity / 100,
        maxTokens: 500,
        timeout: 30000,
      });

      // Build context prompt with rich message information
      const personalityPrompts = {
        professional: 'Você é um assistente profissional, formal e objetivo.',
        friendly: 'Você é um assistente amigável, caloroso e acolhedor.',
        creative: 'Você é um assistente criativo, inovador e artístico.',
        analytical: 'Você é um assistente analítico, lógico e detalhado.',
        casual: 'Você é um assistente descontraído, informal e relaxado.',
        empathetic: 'Você é um assistente empático, compreensivo e sensível.',
      };

      const specializationPrompts = {
        general: 'Você é um assistente geral capaz de ajudar com diversas tarefas.',
        sales: 'Você é especializado em vendas e marketing, focado em conversão.',
        support: 'Você é especializado em suporte ao cliente e resolução de problemas.',
        education: 'Você é especializado em educação e ensino.',
        health: 'Você é especializado em saúde e bem-estar.',
        finance: 'Você é especializado em finanças e consultoria.',
      };

      // Rich context information
      const isGroup = conversationEntry.chat.isGroup;
      const senderName = conversationEntry.sender.pushName || 'Usuário';
      const chatName = conversationEntry.chat.name || '';
      const messageType = conversationEntry.messageType || 'text';

      const contextInfo = isGroup 
        ? `\nContexto: Você está em um grupo "${chatName}". A mensagem foi enviada por ${senderName}.`
        : `\nContexto: Você está em uma conversa privada com ${senderName}.`;

      const systemPrompt = `${personalityPrompts[this.personality]} ${specializationPrompts[this.specialization]}

Nome: ${this.name}
${this.description ? `Descrição: ${this.description}` : ''}
${contextInfo}

Regras importantes:
1. Sempre responda em português brasileiro
2. Seja útil e prestativo
3. Mantenha o tom de acordo com sua personalidade
4. Seja conciso mas informativo
5. ${isGroup ? 'Quando em grupos, você pode se dirigir às pessoas pelo nome quando relevante' : 'Adapte suas respostas ao contexto da conversa privada'}
6. ${isGroup ? 'Em grupos, seja respeitoso com todos os participantes' : 'Mantenha uma conversa natural e personalizada'}
7. Responda sempre, mesmo se não tiver certeza sobre algo
8. ${messageType !== 'text' ? `A mensagem recebida é do tipo: ${messageType}` : ''}`;

      const messageText = messageData.content || messageData.text || messageData.body || '';
      
      // Validate message content
      if (!messageText || messageText.trim() === '') {
        throw new Error('Empty message content');
      }
      
      // Prepare messages array for ChatOpenAI
      const messages = [new SystemMessage(systemPrompt)];

      // Load conversation history from MongoDB instead of memory
      const recentHistory = await this.loadConversationHistory(conversationEntry.chat.id, 6);
      
      // Add conversation history for context
      recentHistory.forEach((msg) => {
        if (msg.content && msg.content.trim() !== '') {
          if (msg.type === 'user') {
            const senderInfo = msg.sender?.pushName ? ` (${msg.sender.pushName})` : '';
            const messageContent = isGroup ? `${msg.content}${senderInfo}` : msg.content;
            messages.push(new HumanMessage(messageContent));
          } else {
            messages.push(new SystemMessage(`Assistente: ${msg.content}`));
          }
        }
      });

      // Add current message with sender context
      const currentMessageContent = isGroup ? `${messageText} (enviado por ${senderName})` : messageText;
      messages.push(new HumanMessage(currentMessageContent.trim()));

      console.log(`[AI Agent ${this.id}] Calling OpenAI with ${messages.length} messages...`);
      const response = await llm.invoke(messages);
      console.log(`[AI Agent ${this.id}] OpenAI response received:`, response);

      // Extract response content properly
      let responseContent = response.content || '';
      console.log(`[AI Agent ${this.id}] Extracted response content: "${responseContent}"`);

      // Se não conseguiu gerar resposta, criar uma resposta padrão baseada na personalidade
      if (!responseContent || responseContent.trim() === '') {
        const fallbackResponses = {
          professional: 'Entendo sua solicitação. Posso ajudá-lo de outra forma?',
          friendly: `Oi${isGroup ? ` ${senderName}` : ''}! Entendi sua mensagem. Como posso te ajudar melhor?`,
          creative: 'Que interessante! Vamos pensar em soluções criativas para isso.',
          analytical: 'Preciso de mais informações para analisar adequadamente sua solicitação.',
          casual: `Entendi${isGroup ? ` ${senderName}` : ''}! Como posso te dar uma mão com isso?`,
          empathetic: 'Compreendo sua situação. Estou aqui para ajudar no que precisar.',
        };
        responseContent = fallbackResponses[this.personality] || 'Como posso ajudá-lo?';
      }

      return responseContent.trim();
    } catch (error) {
      console.error('Error generating response:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);

      // Specific error handling
      let errorMessage = 'Erro interno do sistema';
      if (error.message.includes('API key')) {
        errorMessage = 'Chave da API OpenAI inválida ou não configurada';
      } else if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
        errorMessage = 'Timeout na conexão com OpenAI';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Limite de requisições excedido';
      } else if (error.message.includes('invalid_request_error')) {
        errorMessage = 'Parâmetros inválidos na requisição';
      } else if (error.message.includes('Empty message content')) {
        errorMessage = 'Mensagem vazia recebida';
      }

      console.error(`AI Agent Error [${this.id}]:`, errorMessage);

      // Resposta de fallback baseada na personalidade do agente
      const fallbackResponses = {
        professional: 'Momentaneamente indisponível. Como posso assistí-lo de outra forma?',
        friendly: 'Ops! Algo deu errado, mas estou aqui para ajudar. Me conte mais sobre o que precisa!',
        creative: 'Hmm, vamos tentar uma abordagem diferente! O que você gostaria de explorar?',
        analytical: 'Sistema temporariamente instável. Pode reformular sua pergunta?',
        casual: 'Eita! Deu um probleminha aqui. Mas me fala aí, no que posso te ajudar?',
        empathetic: 'Compreendo que isso pode ser frustrante. Vamos tentar novamente?',
      };

      return fallbackResponses[this.personality] || 'Como posso ajudá-lo hoje?';
    }
  }

  getStats() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      name: this.name,
      messageCount: this.messageCount,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      model: this.model,
      personality: this.personality,
      specialization: this.specialization,
      enabledTools: this.enabledTools,
      replyToGroups: this.replyToGroups,
    };
  }

  // Save agent to database
  async save() {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn('Database not available, agent saved only in memory');
        return;
      }

      const agentData = {
        _id: this.id,
        sessionId: this.sessionId,
        name: this.name,
        description: this.description,
        model: this.model,
        personality: this.personality,
        specialization: this.specialization,
        creativity: this.creativity,
        learningEnabled: this.learningEnabled,
        autoReply: this.autoReply,
        smartReplies: this.smartReplies,
        replyToGroups: this.replyToGroups,
        enabledTools: this.enabledTools,
        isActive: this.isActive,
        messageCount: this.messageCount,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        // Don't save API key for security - it's kept only in memory
        conversationHistory: this.conversationHistory.slice(-10), // Keep only last 10 messages in DB
      };

      await db
        .collection('ai_agents')
        .replaceOne({ _id: this.id }, agentData, { upsert: true });

      console.log(`AI Agent ${this.id} saved to database`);
    } catch (error) {
      console.error('Error saving AI agent to database:', error);
    }
  }

  async deactivate() {
    this.isActive = false;
    this.updatedAt = new Date().toISOString();
    await this.save();
  }

  async activate() {
    this.isActive = true;
    this.updatedAt = new Date().toISOString();
    await this.save();
  }

  // MongoDB conversation persistence methods
  async saveConversationEntry(conversationEntry) {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn('Database not available, conversation entry not saved');
        return;
      }

      const entryWithAgent = {
        ...conversationEntry,
        agentId: this.id,
        sessionId: this.sessionId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days TTL
      };

      await db.collection('ai_agent_conversations').insertOne(entryWithAgent);
      console.log(`Conversation entry saved for agent ${this.id}`);
    } catch (error) {
      console.error('Error saving conversation entry:', error);
    }
  }

  async loadConversationHistory(chatId, limit = 10) {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn('Database not available, using empty conversation history');
        return [];
      }

      const conversations = await db
        .collection('ai_agent_conversations')
        .find({
          agentId: this.id,
          'chat.id': chatId
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      // Return in chronological order (oldest first)
      return conversations.reverse();
    } catch (error) {
      console.error('Error loading conversation history:', error);
      return [];
    }
  }

  async clearConversationHistory(chatId = null) {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn('Database not available, conversation history not cleared');
        return;
      }

      const filter = { agentId: this.id };
      if (chatId) {
        filter['chat.id'] = chatId;
      }

      const result = await db.collection('ai_agent_conversations').deleteMany(filter);
      console.log(`Cleared ${result.deletedCount} conversation entries for agent ${this.id}`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      return 0;
    }
  }

  async getConversationStats() {
    try {
      const db = database.getDb();
      if (!db) {
        return { totalMessages: 0, uniqueChats: 0, groupMessages: 0, privateMessages: 0 };
      }

      const stats = await db.collection('ai_agent_conversations').aggregate([
        { $match: { agentId: this.id } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            uniqueChats: { $addToSet: '$chat.id' },
            groupMessages: {
              $sum: { $cond: [{ $eq: ['$chat.isGroup', true] }, 1, 0] }
            },
            privateMessages: {
              $sum: { $cond: [{ $eq: ['$chat.isGroup', false] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalMessages: 1,
            uniqueChats: { $size: '$uniqueChats' },
            groupMessages: 1,
            privateMessages: 1
          }
        }
      ]).toArray();

      return stats[0] || { totalMessages: 0, uniqueChats: 0, groupMessages: 0, privateMessages: 0 };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return { totalMessages: 0, uniqueChats: 0, groupMessages: 0, privateMessages: 0 };
    }
  }
}

// Database helper functions
async function loadAgentsFromDatabase() {
  try {
    const db = database.getDb();
    if (!db) {
      console.log('Database not available, using memory-only agents');
      return;
    }

    const agentsData = await db
      .collection('ai_agents')
      .find({ isActive: true })
      .toArray();

    for (const agentData of agentsData) {
      // Don't load if already in memory (API key required)
      if (!aiAgents.has(agentData._id)) {
        console.log(
          `Skipping agent ${agentData._id} - API key required for full functionality`
        );
        continue;
      }

      // Update memory agent with database data
      const memoryAgent = aiAgents.get(agentData._id);
      if (memoryAgent) {
        Object.assign(memoryAgent, agentData);
        memoryAgent.id = agentData._id;
      }
    }

    console.log(`Loaded ${agentsData.length} AI agents from database`);
  } catch (error) {
    console.error('Error loading agents from database:', error);
  }
}

async function saveAgentToDatabase(agent) {
  await agent.save();
}

async function deleteAgentFromDatabase(agentId) {
  try {
    const db = database.getDb();
    if (!db) return;

    await db.collection('ai_agents').deleteOne({ _id: agentId });
    console.log(`AI Agent ${agentId} deleted from database`);
  } catch (error) {
    console.error('Error deleting AI agent from database:', error);
  }
}

// Initialize agents from database on startup
loadAgentsFromDatabase();

// Routes

// Create AI Agent
router.post('/create', async (req, res) => {
  try {
    // Validate request body
    const validatedData = createAgentSchema.parse(req.body);

    // Check if agent already exists for this session
    const existingAgent = Array.from(aiAgents.values()).find(
      (agent) => agent.sessionId === validatedData.sessionId && agent.isActive
    );

    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um agente ativo para esta sessão',
      });
    }

    // Create new AI agent
    const agent = new AIAgent(validatedData);
    aiAgents.set(agent.id, agent);

    // Save to database
    await saveAgentToDatabase(agent);

    console.log(`AI Agent created: ${agent.id} for session ${agent.sessionId}`);

    res.json({
      success: true,
      message: 'Agente de IA criado com sucesso',
      agent: agent.getStats(),
    });
  } catch (error) {
    console.error('Error creating AI agent:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

// List AI Agents
router.get('/list', (req, res) => {
  try {
    const agents = Array.from(aiAgents.values()).map((agent) =>
      agent.getStats()
    );

    res.json({
      success: true,
      agents,
    });
  } catch (error) {
    console.error('Error listing AI agents:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar agentes',
    });
  }
});

// Get AI Agent by ID
router.get('/:agentId', (req, res) => {
  try {
    const agent = aiAgents.get(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    res.json({
      success: true,
      agent: agent.getStats(),
    });
  } catch (error) {
    console.error('Error getting AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter agente',
    });
  }
});

// Deactivate AI Agent
router.patch('/:agentId/deactivate', async (req, res) => {
  try {
    const agent = aiAgents.get(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    await agent.deactivate();

    res.json({
      success: true,
      message: 'Agente desativado com sucesso',
    });
  } catch (error) {
    console.error('Error deactivating AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar agente',
    });
  }
});

// Delete AI Agent
router.delete('/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const deleted = aiAgents.delete(agentId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    // Delete from database
    await deleteAgentFromDatabase(agentId);

    res.json({
      success: true,
      message: 'Agente removido com sucesso',
    });
  } catch (error) {
    console.error('Error deleting AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover agente',
    });
  }
});

// Process message with AI agent (internal endpoint)
router.post('/process-message', async (req, res) => {
  try {
    const { sessionId, message, whatsappClient } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        message: 'SessionId e message são obrigatórios',
      });
    }

    // Find active agent for this session
    const agent = Array.from(aiAgents.values()).find(
      (agent) => agent.sessionId === sessionId && agent.isActive
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum agente ativo encontrado para esta sessão',
      });
    }

    // Process message with AI
    const result = await agent.processMessage(message, whatsappClient);

    res.json({
      success: true,
      response: result.response,
      replyToMessageId: result.replyToMessageId,
      shouldReply: result.shouldReply,
      agentId: agent.id,
    });
  } catch (error) {
    console.error('Error processing message with AI agent:', error);

    // Sempre retornar uma resposta da IA mesmo com erro
    res.json({
      success: true,
      response: 'Como posso ajudá-lo hoje?',
      shouldReply: true,
      error: 'Erro interno processado',
    });
  }
});

// Get agent conversation history
router.get('/:agentId/conversations/:chatId', async (req, res) => {
  try {
    const agent = aiAgents.get(req.params.agentId);
    const { chatId } = req.params;
    const { limit = 50 } = req.query;

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    const history = await agent.loadConversationHistory(chatId, parseInt(limit));

    res.json({
      success: true,
      chatId,
      agentId: agent.id,
      conversations: history,
      total: history.length
    });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter histórico de conversas',
    });
  }
});

// Clear agent conversation history
router.delete('/:agentId/conversations/:chatId?', async (req, res) => {
  try {
    const agent = aiAgents.get(req.params.agentId);
    const { chatId } = req.params;

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    const deletedCount = await agent.clearConversationHistory(chatId);

    res.json({
      success: true,
      message: chatId 
        ? `Histórico limpo para o chat ${chatId}` 
        : 'Todo histórico de conversas limpo',
      deletedCount
    });
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar histórico de conversas',
    });
  }
});

// Get agent conversation statistics
router.get('/:agentId/stats', async (req, res) => {
  try {
    const agent = aiAgents.get(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    const basicStats = agent.getStats();
    const conversationStats = await agent.getConversationStats();

    res.json({
      success: true,
      agent: {
        ...basicStats,
        conversations: conversationStats
      }
    });
  } catch (error) {
    console.error('Error getting agent stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas do agente',
    });
  }
});

// Helper function para integração com WhatsApp
async function processWhatsAppMessage(whatsappClient, messageData, sessionId) {
  try {
    // Find active agent for this session
    const agent = Array.from(aiAgents.values()).find(
      (agent) => agent.sessionId === sessionId && agent.isActive
    );

    if (!agent) {
      console.log(`No active agent found for session: ${sessionId}`);
      return null;
    }

    // Extract rich message information
    const isGroup = messageData.chat?.isGroup || false;
    const chatId = messageData.chat?.id;
    const senderName = messageData.sender?.pushName || 'Usuário';

    console.log(`Processing message from ${senderName} in ${isGroup ? 'group' : 'private chat'}: ${chatId}`);

    // Process message with AI agent using rich message data
    const result = await agent.processMessage(messageData, whatsappClient);

    if (result.shouldReply && result.response) {
      try {
        // Send reply message with proper quoting
        const replyOptions = {};
        
        if (result.replyToMessageId) {
          replyOptions.quoted = {
            key: {
              id: result.replyToMessageId,
              fromMe: false,
              remoteJid: chatId,
              participant: isGroup ? messageData.sender?.id : undefined
            },
            message: {
              conversation: messageData.content || messageData.text || messageData.body
            }
          };
        }

        await whatsappClient.sendMessage(
          chatId,
          { text: result.response },
          replyOptions
        );

        console.log(`AI response sent to ${chatId} (${isGroup ? 'group' : 'private'}): ${result.response.substring(0, 100)}...`);
        return result;
      } catch (sendError) {
        console.error('Error sending WhatsApp message:', sendError);
        return null;
      }
    } else {
      console.log(`Agent ${agent.id} chose not to reply to message from ${senderName}`);
    }

    return result;
  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
    return null;
  }
}

// Export the AI Agent class, agents map and helper function for use in other modules
module.exports = { router, AIAgent, aiAgents, processWhatsAppMessage };
