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
  // Configure SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write('data: {"type": "heartbeat", "timestamp": "' + new Date().toISOString() + '"}\n\n');
  }, 30000);

  // Send initial connection event
  res.write('data: {"type": "connected", "timestamp": "' + new Date().toISOString() + '"}\n\n');

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    console.log('SSE client disconnected');
  });

  req.on('error', (err) => {
    clearInterval(heartbeat);
    console.error('SSE connection error:', err);
  });

  // Check if tool execution is requested
  const toolName = req.query.tool;
  const argsParam = req.query.args;

  if (toolName) {
    try {
      // Parse arguments
      let args = {};
      if (argsParam) {
        try {
          args = JSON.parse(argsParam);
        } catch (parseError) {
          res.write('data: {"type": "error", "message": "Invalid JSON in args parameter", "timestamp": "' + new Date().toISOString() + '"}\n\n');
          res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');
          clearInterval(heartbeat);
          res.end();
          return;
        }
      }

      // Initialize MCP server
      const mcpServer = initializeMCPServer();
      const authorization = req.headers.authorization;

      // Send start event
      res.write('data: {"type": "start", "toolName": "' + toolName + '", "timestamp": "' + new Date().toISOString() + '"}\n\n');

      // Validate tool exists
      const tools = mcpServer.getTools();
      const tool = tools.find(t => t.name === toolName);

      if (!tool) {
        res.write('data: {"type": "error", "message": "Ferramenta não encontrada: ' + toolName + '", "timestamp": "' + new Date().toISOString() + '"}\n\n');
        res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');
        clearInterval(heartbeat);
        res.end();
        return;
      }

      // Send tool info
      res.write('data: {"type": "tool_info", "tool": ' + JSON.stringify(tool) + ', "timestamp": "' + new Date().toISOString() + '"}\n\n');

      // Execute tool
      res.write('data: {"type": "executing", "message": "Executando ferramenta...", "timestamp": "' + new Date().toISOString() + '"}\n\n');

      const result = await mcpServer.executeTool(toolName, args, authorization);

      // Send success result
      res.write('data: {"type": "success", "result": ' + JSON.stringify(result) + ', "timestamp": "' + new Date().toISOString() + '"}\n\n');
      res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');

      // Clean up and close connection for tool execution
      clearInterval(heartbeat);
      res.end();

    } catch (error) {
      // Send error
      res.write('data: {"type": "error", "message": "' + error.message + '", "timestamp": "' + new Date().toISOString() + '"}\n\n');
      res.write('data: {"type": "end", "timestamp": "' + new Date().toISOString() + '"}\n\n');

      // Clean up
      clearInterval(heartbeat);
      res.end();
    }
  }

  // If no tool specified, keep connection alive for real-time events
  // The connection will stay open until client disconnects
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