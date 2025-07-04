const express = require('express');
const { FlowChatMCPServer } = require('../../mcp-server');
const apiTokenAuth = require('../middleware/apiTokenAuth');

const router = express.Router();

// Initialize MCP server instance
let mcpServerInstance = null;

// Initialize MCP server
function initializeMCPServer() {
  if (!mcpServerInstance) {
    mcpServerInstance = new FlowChatMCPServer();
  }
  return mcpServerInstance;
}

/**
 * @swagger
 * /api/management/mcp/tools:
 *   get:
 *     tags:
 *       - MCP Server
 *     summary: Lista todas as ferramentas MCP disponíveis
 *     description: Retorna lista completa de ferramentas do Model Context Protocol
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de ferramentas MCP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tools:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           inputSchema:
 *                             type: object
 *       401:
 *         description: Token inválido
 */
router.get('/tools', apiTokenAuth, (req, res) => {
  try {
    const mcpServer = initializeMCPServer();
    const tools = mcpServer.getTools();
    
    res.json({
      success: true,
      data: {
        tools: tools,
        count: tools.length,
        categories: {
          'Session Management': tools.filter(t => ['create_session', 'get_session_status', 'list_sessions', 'delete_session', 'regenerate_qr', 'cleanup_orphaned_sessions'].includes(t.name)).length,
          'Message Operations': tools.filter(t => ['send_message', 'send_media', 'reply_message', 'mention_all', 'smart_reply'].includes(t.name)).length,
          'Chat Controls': tools.filter(t => ['mark_read', 'typing_indicator'].includes(t.name)).length,
          'Media Operations': tools.filter(t => ['download_media', 'list_downloads'].includes(t.name)).length,
          'Message History': tools.filter(t => ['get_messages'].includes(t.name)).length,
          'Webhook Management': tools.filter(t => t.name.includes('webhook')).length,
          'Group Management': tools.filter(t => t.name.includes('group')).length,
          'API Information': tools.filter(t => ['get_api_info'].includes(t.name)).length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter ferramentas MCP',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/management/mcp/tools/{toolName}:
 *   get:
 *     tags:
 *       - MCP Server
 *     summary: Obter detalhes de uma ferramenta específica
 *     description: Retorna informações detalhadas sobre uma ferramenta MCP específica
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: toolName
 *         required: true
 *         description: Nome da ferramenta
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes da ferramenta
 *       404:
 *         description: Ferramenta não encontrada
 */
router.get('/tools/:toolName', apiTokenAuth, (req, res) => {
  try {
    const mcpServer = initializeMCPServer();
    const tools = mcpServer.getTools();
    const tool = tools.find(t => t.name === req.params.toolName);
    
    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Ferramenta não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: {
        tool: tool,
        usage: `Use esta ferramenta através do MCP Client com os parâmetros especificados no inputSchema`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter detalhes da ferramenta',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/management/mcp/execute:
 *   post:
 *     tags:
 *       - MCP Server
 *     summary: Executar ferramenta MCP via SSE
 *     description: Executa uma ferramenta MCP e retorna resultado via Server-Sent Events
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toolName:
 *                 type: string
 *                 description: Nome da ferramenta a executar
 *               arguments:
 *                 type: object
 *                 description: Argumentos para a ferramenta
 *             required:
 *               - toolName
 *     responses:
 *       200:
 *         description: Stream de execução da ferramenta
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido
 */
router.post('/execute', apiTokenAuth, async (req, res) => {
  const { toolName, arguments: args = {} } = req.body;
  
  if (!toolName) {
    return res.status(400).json({
      success: false,
      message: 'Nome da ferramenta é obrigatório'
    });
  }
  
  // Configure SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Credentials': 'true'
  });
  
  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write('data: {"type": "heartbeat", "timestamp": "' + new Date().toISOString() + '"}\n\n');
  }, 30000);
  
  try {
    const mcpServer = initializeMCPServer();
    const authorization = req.headers.authorization;
    
    // Send start event
    res.write('data: {"type": "start", "toolName": "' + toolName + '", "timestamp": "' + new Date().toISOString() + '"}\n\n');
    
    // Validate tool exists
    const tools = mcpServer.getTools();
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      res.write('data: {"type": "error", "message": "Ferramenta não encontrada: ' + toolName + '"}\n\n');
      res.end();
      clearInterval(heartbeat);
      return;
    }
    
    // Send tool info
    res.write('data: {"type": "tool_info", "tool": ' + JSON.stringify(tool) + '}\n\n');
    
    // Execute tool
    res.write('data: {"type": "executing", "message": "Executando ferramenta..."}\n\n');
    
    const result = await mcpServer.executeTool(toolName, args, authorization);
    
    // Send success result
    res.write('data: {"type": "success", "result": ' + JSON.stringify(result) + ', "timestamp": "' + new Date().toISOString() + '"}\n\n');
    res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');
    
  } catch (error) {
    // Send error
    res.write('data: {"type": "error", "message": "' + error.message + '", "timestamp": "' + new Date().toISOString() + '"}\n\n');
    res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');
  }
  
  // Clean up
  clearInterval(heartbeat);
  res.end();
});

/**
 * @swagger
 * /api/management/mcp/validate:
 *   post:
 *     tags:
 *       - MCP Server
 *     summary: Validar parâmetros de ferramenta
 *     description: Valida se os parâmetros fornecidos são válidos para uma ferramenta específica
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toolName:
 *                 type: string
 *               arguments:
 *                 type: object
 *     responses:
 *       200:
 *         description: Resultado da validação
 */
router.post('/validate', apiTokenAuth, (req, res) => {
  const { toolName, arguments: args = {} } = req.body;
  
  if (!toolName) {
    return res.status(400).json({
      success: false,
      message: 'Nome da ferramenta é obrigatório'
    });
  }
  
  try {
    const mcpServer = initializeMCPServer();
    const tools = mcpServer.getTools();
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Ferramenta não encontrada'
      });
    }
    
    // Basic validation against schema
    const schema = tool.inputSchema;
    const validation = validateArguments(args, schema);
    
    res.json({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        tool: tool.name,
        providedArgs: Object.keys(args),
        requiredArgs: schema.required || []
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao validar parâmetros',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/management/mcp/status:
 *   get:
 *     tags:
 *       - MCP Server
 *     summary: Status do servidor MCP
 *     description: Retorna informações sobre o status do servidor MCP
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Status do servidor MCP
 */
router.get('/status', apiTokenAuth, (req, res) => {
  try {
    const mcpServer = initializeMCPServer();
    const tools = mcpServer.getTools();
    
    res.json({
      success: true,
      data: {
        status: 'running',
        initialized: !!mcpServerInstance,
        toolCount: tools.length,
        apiBaseUrl: process.env.BASE_URL || 'http://localhost:3000',
        hasApiKey: !!process.env.BAILEYS_API_KEY,
        rateLimit: parseInt(process.env.RATE_LIMIT || '100'),
        timeout: parseInt(process.env.API_TIMEOUT || '30000'),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter status do MCP',
      error: error.message
    });
  }
});

// Helper function for basic argument validation
function validateArguments(args, schema) {
  const errors = [];
  const required = schema.required || [];
  
  // Check required fields
  for (const field of required) {
    if (!(field in args)) {
      errors.push(`Campo obrigatório ausente: ${field}`);
    }
  }
  
  // Check types if properties are defined
  if (schema.properties) {
    for (const [key, value] of Object.entries(args)) {
      if (schema.properties[key]) {
        const expectedType = schema.properties[key].type;
        const actualType = typeof value;
        
        if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Campo ${key} deve ser um array`);
        } else if (expectedType !== 'array' && expectedType !== actualType) {
          errors.push(`Campo ${key} deve ser do tipo ${expectedType}, recebido ${actualType}`);
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = router;