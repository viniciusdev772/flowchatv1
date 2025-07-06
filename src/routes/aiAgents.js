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
  personality: z.enum(['professional', 'friendly', 'creative', 'analytical', 'casual', 'empathetic']),
  specialization: z.enum(['general', 'sales', 'support', 'education', 'health', 'finance']),
  creativity: z.number().min(0).max(100),
  learningEnabled: z.boolean(),
  autoReply: z.boolean(),
  smartReplies: z.boolean(),
  openaiApiKey: z.string().min(1, 'Chave da API OpenAI é obrigatória'),
  tools: z.array(z.string()).default(['web_search']),
  replyToGroups: z.boolean().default(true) // Nova opção para responder grupos
});

// AI Tools implementation
class AITools {
  constructor() {
    this.tools = {
      web_search: this.webSearch.bind(this)
    };
  }

  async webSearch(query, options = {}) {
    try {
      const fetch = require('node-fetch');
      const cheerio = require('cheerio');
      
      // Use SerpAPI if available, otherwise fallback to basic search
      if (process.env.SERPAPI_KEY) {
        const serpApiUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}&num=5`;
        const response = await fetch(serpApiUrl);
        const data = await response.json();
        
        return {
          query,
          results: data.organic_results?.map(result => ({
            title: result.title,
            snippet: result.snippet,
            url: result.link,
            source: 'serpapi'
          })) || [],
          timestamp: new Date().toISOString()
        };
      } else {
        // Fallback: basic web scraping (limited)
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const results = [];
        $('.g').each((i, elem) => {
          if (i >= 5) return false; // Limit to 5 results
          
          const title = $(elem).find('h3').text();
          const snippet = $(elem).find('.VwiC3b').text() || $(elem).find('.s3v9rd').text();
          const url = $(elem).find('a').attr('href');
          
          if (title && snippet && url) {
            results.push({
              title,
              snippet,
              url: url.startsWith('/url?q=') ? decodeURIComponent(url.split('/url?q=')[1].split('&')[0]) : url,
              source: 'fallback'
            });
          }
        });
        
        return {
          query,
          results,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Web search error:', error);
      return {
        query,
        results: [],
        error: error.message,
        timestamp: new Date().toISOString()
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
    this.replyToGroups = config.replyToGroups !== undefined ? config.replyToGroups : true;
    this.openaiApiKey = config.openaiApiKey;
    this.tools = new AITools();
    this.enabledTools = config.tools || ['web_search'];
    this.isActive = config.isActive !== undefined ? config.isActive : true;
    this.createdAt = config.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.messageCount = config.messageCount || 0;
    this.conversationHistory = config.conversationHistory || [];
  }

  async processMessage(message) {
    try {
      this.messageCount++;
      this.updatedAt = new Date().toISOString();
      
      // Add to conversation history
      this.conversationHistory.push({
        type: 'user',
        content: message.text || message.body,
        timestamp: new Date().toISOString(),
        from: message.from
      });

      // Keep only last 10 messages for context
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // Generate AI response
      const response = await this.generateResponse(message);
      
      // Add AI response to history
      this.conversationHistory.push({
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      });

      // Save updated state to database (async, don't wait)
      this.save().catch(err => console.error('Error saving agent state:', err));

      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
    }
  }

  async generateResponse(message) {
    try {
      const { OpenAI } = require('@langchain/openai');
      
      const llm = new OpenAI({
        openAIApiKey: this.openaiApiKey,
        modelName: this.model,
        temperature: this.creativity / 100,
        maxTokens: 500
      });

      // Build context prompt
      const personalityPrompts = {
        professional: 'Você é um assistente profissional, formal e objetivo.',
        friendly: 'Você é um assistente amigável, caloroso e acolhedor.',
        creative: 'Você é um assistente criativo, inovador e artístico.',
        analytical: 'Você é um assistente analítico, lógico e detalhado.',
        casual: 'Você é um assistente descontraído, informal e relaxado.',
        empathetic: 'Você é um assistente empático, compreensivo e sensível.'
      };

      const specializationPrompts = {
        general: 'Você é um assistente geral capaz de ajudar com diversas tarefas.',
        sales: 'Você é especializado em vendas e marketing, focado em conversão.',
        support: 'Você é especializado em suporte ao cliente e resolução de problemas.',
        education: 'Você é especializado em educação e ensino.',
        health: 'Você é especializado em saúde e bem-estar.',
        finance: 'Você é especializado em finanças e consultoria.'
      };

      const systemPrompt = `${personalityPrompts[this.personality]} ${specializationPrompts[this.specialization]}

Nome: ${this.name}
${this.description ? `Descrição: ${this.description}` : ''}

Regras importantes:
1. Sempre responda em português brasileiro
2. Seja útil e prestativo
3. Mantenha o tom de acordo com sua personalidade
4. Se precisar buscar informações na internet, use a ferramenta web_search
5. Seja conciso mas informativo
6. Adapte suas respostas ao contexto da conversa

Ferramentas disponíveis: ${this.enabledTools.join(', ')}`;

      // Check if user is asking for web search
      const messageText = message.text || message.body || '';
      const needsWebSearch = this.shouldUseWebSearch(messageText);
      
      let context = systemPrompt;
      
      if (needsWebSearch && this.enabledTools.includes('web_search')) {
        try {
          const searchQuery = this.extractSearchQuery(messageText);
          const searchResults = await this.tools.executeTool('web_search', searchQuery);
          
          context += `\n\nResultados da busca na internet para "${searchQuery}":\n`;
          searchResults.results.forEach((result, index) => {
            context += `${index + 1}. ${result.title}\n${result.snippet}\nURL: ${result.url}\n\n`;
          });
        } catch (error) {
          console.error('Web search failed:', error);
        }
      }

      // Add conversation history for context
      if (this.conversationHistory.length > 0) {
        context += '\n\nContexto da conversa:\n';
        this.conversationHistory.slice(-6).forEach(msg => {
          context += `${msg.type === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}\n`;
        });
      }

      context += `\n\nUsuário: ${messageText}\nAssistente:`;

      const response = await llm.call(context);
      return response.trim();
      
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Desculpe, não consegui processar sua solicitação no momento. Tente novamente mais tarde.';
    }
  }

  shouldUseWebSearch(message) {
    const searchTriggers = [
      'pesquisar', 'buscar', 'procurar', 'encontrar', 'pesquise', 'busque',
      'o que é', 'quem é', 'quando', 'onde', 'como', 'por que',
      'notícias', 'informações', 'dados', 'estatísticas',
      'preço', 'valor', 'custo', 'cotação'
    ];
    
    const messageLower = message.toLowerCase();
    return searchTriggers.some(trigger => messageLower.includes(trigger));
  }

  extractSearchQuery(message) {
    // Simple extraction - in production, use more sophisticated NLP
    const questionWords = ['o que é', 'quem é', 'quando', 'onde', 'como', 'por que'];
    let query = message;
    
    for (const qw of questionWords) {
      if (message.toLowerCase().includes(qw)) {
        query = message.toLowerCase().replace(qw, '').trim();
        break;
      }
    }
    
    // Remove common words
    const stopWords = ['pesquisar', 'buscar', 'procurar', 'encontrar', 'sobre', 'acerca de'];
    for (const sw of stopWords) {
      query = query.toLowerCase().replace(sw, '').trim();
    }
    
    return query || message;
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
      replyToGroups: this.replyToGroups
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
        conversationHistory: this.conversationHistory.slice(-10) // Keep only last 10 messages in DB
      };

      await db.collection('ai_agents').replaceOne(
        { _id: this.id },
        agentData,
        { upsert: true }
      );

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
}

// Database helper functions
async function loadAgentsFromDatabase() {
  try {
    const db = database.getDb();
    if (!db) {
      console.log('Database not available, using memory-only agents');
      return;
    }

    const agentsData = await db.collection('ai_agents').find({ isActive: true }).toArray();
    
    for (const agentData of agentsData) {
      // Don't load if already in memory (API key required)
      if (!aiAgents.has(agentData._id)) {
        console.log(`Skipping agent ${agentData._id} - API key required for full functionality`);
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
    const existingAgent = Array.from(aiAgents.values()).find(agent => 
      agent.sessionId === validatedData.sessionId && agent.isActive
    );
    
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um agente ativo para esta sessão'
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
      agent: agent.getStats()
    });
    
  } catch (error) {
    console.error('Error creating AI agent:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// List AI Agents
router.get('/list', (req, res) => {
  try {
    const agents = Array.from(aiAgents.values()).map(agent => agent.getStats());
    
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error listing AI agents:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar agentes'
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
        message: 'Agente não encontrado'
      });
    }
    
    res.json({
      success: true,
      agent: agent.getStats()
    });
  } catch (error) {
    console.error('Error getting AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter agente'
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
        message: 'Agente não encontrado'
      });
    }
    
    await agent.deactivate();
    
    res.json({
      success: true,
      message: 'Agente desativado com sucesso'
    });
  } catch (error) {
    console.error('Error deactivating AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar agente'
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
        message: 'Agente não encontrado'
      });
    }
    
    // Delete from database
    await deleteAgentFromDatabase(agentId);
    
    res.json({
      success: true,
      message: 'Agente removido com sucesso'
    });
  } catch (error) {
    console.error('Error deleting AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover agente'
    });
  }
});

// Process message with AI agent (internal endpoint)
router.post('/process-message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        message: 'SessionId e message são obrigatórios'
      });
    }
    
    // Find active agent for this session
    const agent = Array.from(aiAgents.values()).find(agent => 
      agent.sessionId === sessionId && agent.isActive
    );
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum agente ativo encontrado para esta sessão'
      });
    }
    
    // Process message with AI
    const response = await agent.processMessage(message);
    
    res.json({
      success: true,
      response,
      agentId: agent.id
    });
    
  } catch (error) {
    console.error('Error processing message with AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar mensagem'
    });
  }
});

// Export the AI Agent class and agents map for use in other modules
module.exports = { router, AIAgent, aiAgents };