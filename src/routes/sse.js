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
 * /api/sse:
 *   post:
 *     tags:
 *       - SSE
 *     summary: MCP Streamable HTTP endpoint (2025 padrão)
 *     description: Endpoint MCP que suporta HTTP POST + SSE streaming seguindo padrão MCP 2025
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method:
 *                 type: string
 *                 example: "tools/call"
 *               params:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "list_sessions"
 *                   arguments:
 *                     type: object
 *                     example: {}
 *               streaming:
 *                 type: boolean
 *                 default: false
 *                 description: Se deve usar SSE streaming
 *     responses:
 *       200:
 *         description: Resposta MCP (JSON ou SSE stream)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Token inválido
 *       400:
 *         description: Parâmetros inválidos
 */
router.post('/', apiTokenAuth, async (req, res) => {
  const { method, params, streaming = false } = req.body;
  
  // Validate MCP request format
  if (!method || !params) {
    return res.status(400).json({
      success: false,
      message: 'Formato de requisição MCP inválido. Necessário: method e params'
    });
  }

  try {
    const mcpServer = initializeMCPServer();
    const authorization = req.headers.authorization;

    // Handle MCP tools/call method
    if (method === 'tools/call') {
      const { name: toolName, arguments: args = {} } = params;
      
      if (!toolName) {
        return res.status(400).json({
          success: false,
          message: 'Nome da ferramenta é obrigatório'
        });
      }

      // Validate tool exists
      const tools = mcpServer.getTools();
      const tool = tools.find(t => t.name === toolName);
      
      if (!tool) {
        return res.status(404).json({
          success: false,
          message: `Ferramenta não encontrada: ${toolName}`
        });
      }

      // Execute with streaming if requested
      if (streaming) {
        // Configure SSE headers (padrão MCP 2025)
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
          'Access-Control-Allow-Credentials': 'true'
        });

        // Send MCP response start
        res.write('data: ' + JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{
              type: 'text',
              text: 'Iniciando execução da ferramenta...',
              meta: { toolName, streaming: true }
            }]
          }
        }) + '\n\n');

        try {
          const result = await mcpServer.executeTool(toolName, args, authorization);
          
          // Send final result
          res.write('data: ' + JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result),
                meta: { toolName, final: true }
              }]
            }
          }) + '\n\n');
          
        } catch (error) {
          // Send error via SSE
          res.write('data: ' + JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32603,
              message: error.message
            }
          }) + '\n\n');
        }
        
        res.end();
        
      } else {
        // Standard JSON response (sem streaming)
        try {
          const result = await mcpServer.executeTool(toolName, args, authorization);
          
          res.json({
            jsonrpc: '2.0',
            id: 1,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result)
              }]
            }
          });
          
        } catch (error) {
          res.status(500).json({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32603,
              message: error.message
            }
          });
        }
      }
      
    } else if (method === 'tools/list') {
      // List available tools
      const tools = mcpServer.getTools();
      
      res.json({
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: tools
        }
      });
      
    } else {
      // Unsupported method
      res.status(400).json({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: `Método não suportado: ${method}`
        }
      });
    }
    
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/sse/tools:
 *   get:
 *     tags:
 *       - SSE
 *     summary: Lista ferramentas MCP via SSE
 *     description: Retorna lista de ferramentas disponíveis via Server-Sent Events
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Stream SSE com lista de ferramentas
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/tools', apiTokenAuth, (req, res) => {
  // Configure SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Credentials': 'true'
  });

  try {
    const mcpServer = initializeMCPServer();
    const tools = mcpServer.getTools();

    // Send tools list
    res.write('data: {"type": "tools_list", "tools": ' + JSON.stringify(tools) + ', "count": ' + tools.length + ', "timestamp": "' + new Date().toISOString() + '"}\n\n');

    // Send categorized count
    const categories = {
      'Session Management': tools.filter(t => ['create_session', 'get_session_status', 'list_sessions', 'delete_session', 'regenerate_qr', 'cleanup_orphaned_sessions'].includes(t.name)).length,
      'Message Operations': tools.filter(t => ['send_message', 'send_media', 'reply_message', 'mention_all', 'smart_reply'].includes(t.name)).length,
      'Chat Controls': tools.filter(t => ['mark_read', 'typing_indicator'].includes(t.name)).length,
      'Media Operations': tools.filter(t => ['download_media', 'list_downloads'].includes(t.name)).length,
      'Message History': tools.filter(t => ['get_messages'].includes(t.name)).length,
      'Webhook Management': tools.filter(t => t.name.includes('webhook')).length,
      'Group Management': tools.filter(t => t.name.includes('group')).length,
      'API Information': tools.filter(t => ['get_api_info'].includes(t.name)).length
    };

    res.write('data: {"type": "categories", "categories": ' + JSON.stringify(categories) + ', "timestamp": "' + new Date().toISOString() + '"}\n\n');
    res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');

  } catch (error) {
    res.write('data: {"type": "error", "message": "' + error.message + '", "timestamp": "' + new Date().toISOString() + '"}\n\n');
    res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');
  }

  res.end();
});

/**
 * @swagger
 * /api/sse/status:
 *   get:
 *     tags:
 *       - SSE
 *     summary: Status do servidor MCP via SSE
 *     description: Retorna status do servidor MCP via Server-Sent Events
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Stream SSE com status do servidor
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/status', apiTokenAuth, (req, res) => {
  // Configure SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Credentials': 'true'
  });

  try {
    const mcpServer = initializeMCPServer();
    const tools = mcpServer.getTools();

    const status = {
      status: 'running',
      initialized: !!mcpServerInstance,
      toolCount: tools.length,
      apiBaseUrl: process.env.BASE_URL || 'http://localhost:3000',
      hasApiKey: !!process.env.BAILEYS_API_KEY,
      rateLimit: parseInt(process.env.RATE_LIMIT || '100'),
      timeout: parseInt(process.env.API_TIMEOUT || '30000'),
      timestamp: new Date().toISOString()
    };

    res.write('data: {"type": "status", "status": ' + JSON.stringify(status) + ', "timestamp": "' + new Date().toISOString() + '"}\n\n');
    res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');

  } catch (error) {
    res.write('data: {"type": "error", "message": "' + error.message + '", "timestamp": "' + new Date().toISOString() + '"}\n\n');
    res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');
  }

  res.end();
});

module.exports = router;