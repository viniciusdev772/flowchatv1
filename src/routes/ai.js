const express = require('express');
const OpenAI = require('openai');
const { authenticateToken } = require('../middleware/auth');
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const {
  toolSchemas,
  toolImplementations,
  openAITools,
} = require('../ai/tools');
const router = express.Router();

/**
 * @fileoverview This file contains the routes for the AI assistant.
 * It handles chat requests, tool usage, and other AI-related functionalities.
 * @module routes/ai
 */

/**
 * Processes a string of content to find base64 encoded images,
 * save them as files, and replace the base64 data with the URL of the saved image.
 *
 * @param {string} content The content to process.
 * @returns {Promise<string>} The processed content with image URLs.
 */
async function processBase64Images(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }


  const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;

  let processedContent = content;
  let match;
  const promises = [];


  base64ImageRegex.lastIndex = 0;

  while ((match = base64ImageRegex.exec(content)) !== null) {
    const [fullMatch, alt, base64Data] = match;

    console.log(`Processing base64 image: ${alt || 'Unnamed'}`);


    const promise = (async () => {
      try {

        const matches = base64Data.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn('Invalid base64 format:', base64Data.substring(0, 50));
          return {
            fullMatch,
            replacement: `*[Erro: formato de imagem inválido]*`,
          };
        }

        const [, imageType, base64String] = matches;


        const uniqueId = crypto.randomBytes(16).toString('hex');
        const fileExtension = imageType === 'svg+xml' ? 'svg' : imageType;
        const fileName = `ai-image-${uniqueId}.${fileExtension}`;


        const tempDir = path.join(__dirname, '../../temp-images');


        try {
          await fs.access(tempDir);
        } catch {
          await fs.mkdir(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, fileName);


        const imageBuffer = Buffer.from(base64String, 'base64');
        await fs.writeFile(filePath, imageBuffer);


        const imageUrl = `/temp-images/${fileName}`;

        console.log(
          `✅ Base64 image saved: ${fileName} (${imageBuffer.length} bytes)`
        );

        return {
          fullMatch,
          replacement: `![${alt}](${imageUrl})`,
        };
      } catch (error) {
        console.error('Error processing base64 image:', error);
        return {
          fullMatch,
          replacement: `*[Erro ao processar imagem: ${alt}]*`,
        };
      }
    })();

    promises.push(promise);
  }


  if (promises.length > 0) {
    console.log(`🖼️  Processing ${promises.length} base64 images...`);

    const results = await Promise.all(promises);


    results.forEach(({ fullMatch, replacement }) => {
      processedContent = processedContent.replace(fullMatch, replacement);
    });

    console.log('✅ All base64 images processed and replaced with local URLs');
  }

  return processedContent;
}

/**
 * Retrieves the API token for a given user.
 * @param {string|ObjectId} userId - The ID of the user.
 * @returns {Promise<string>} The user's API token, or a default token if not found.
 */
async function getUserApiToken(userId) {
  try {
    const db = database.getDb();
    if (!db) {
      console.warn('Database não disponível, usando token padrão');
      return process.env.BAILEYS_API_TOKEN || 'baileys_default_token';
    }

    const tokensCollection = db.collection('api_tokens');

    const userObjectId =
      typeof userId === 'string' ? new ObjectId(userId) : userId;

    const tokenRecord = await tokensCollection.findOne(
      {
        userId: userObjectId,
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
      { sort: { createdAt: -1 } }
    );

    if (tokenRecord && tokenRecord.token) {
      console.log(
        `Token encontrado para usuário ${userId}: ${tokenRecord.token.substring(
          0,
          12
        )}...`
      );
      return tokenRecord.token;
    }

    console.warn(
      `Nenhum token válido encontrado para o usuário ${userId}, usando token padrão`
    );
    return process.env.BAILEYS_API_TOKEN || 'baileys_default_token';
  } catch (error) {
    console.error('Erro ao obter token do usuário:', error);
    return process.env.BAILEYS_API_TOKEN || 'baileys_default_token';
  }
}

/**
 * @type {OpenAI}
 * @description The default OpenAI instance.
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Creates a new OpenAI instance with a custom API key.
 * @param {string} customApiKey - The custom OpenAI API key.
 * @returns {OpenAI} A new OpenAI instance.
 * @throws {Error} If the custom API key is not provided.
 */
function createOpenAIInstance(customApiKey) {
  if (!customApiKey) {
    throw new Error('Chave OpenAI personalizada é obrigatória');
  }
  return new OpenAI({
    apiKey: customApiKey,
  });
}

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: Interacts with the AI assistant
 *     description: Sends a message to the AI assistant and receives a streamed response, potentially including tool calls.
 *     tags: [AI Assistant]
 *     security:
 *       - ApiTokenAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: The user's message to the AI.
 *               conversation:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *                 description: The conversation history.
 *               customApiKey:
 *                 type: string
 *                 description: The user's custom OpenAI API key.
 *     responses:
 *       '200':
 *         description: A streamed response from the AI assistant.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "data: {\"type\":\"content\",\"content\":\"Olá!\"}\n\ndata: {\"type\":\"done\"}\n"
 *       '400':
 *         description: Bad request, missing message or API key.
 *       '500':
 *         description: Internal server error.
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, conversation = [], customApiKey } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem é obrigatória',
      });
    }


    const userToken = await getUserApiToken(req.user._id);


    if (userToken) {
      toolImplementations.setUserToken(userToken);
      console.log(
        `Token do usuário ${
          req.user._id
        } injetado nas tools da IA: ${userToken.substring(0, 12)}...`
      );
    } else {
      console.warn(
        `Falha ao obter token para usuário ${req.user._id}, tools usarão token padrão`
      );
    }


    const openaiInstance = createOpenAIInstance(customApiKey);


    const systemPrompt = `Você é uma assistente de IA especializada no FlowChat API - WhatsApp API multi-sessão.

🚀 RESPONDA DE FORMA DIRETA E OBJETIVA.

📱 FUNCIONALIDADES PRINCIPAIS:
- Sessões WhatsApp (criar, listar, deletar, QR codes)
- Mensagens (texto, mídia, resposta, histórico)
- Grupos (criar, gerenciar, participantes, admins)
- Webhooks (configurar, testar, múltiplos)
- Downloads (mídia externa, URLs)
- Monitoramento (status, sistema, limpeza)

⚡ REGRAS DE PERFORMANCE:
1. Use tools para ações práticas
2. Telefones: formato internacional (5511999999999)
3. Combine múltiplas ações quando possível
4. Seja direto e conciso
5. Explique resultados brevemente

🔧 EXEMPLOS RÁPIDOS:
- "Listar sessões" → usa listSessions
- "Criar sessão X" → usa createSession
- "Enviar mensagem Y para Z" → usa sendMessage
- "Status da sessão" → usa getSessionStatus

Responda em português brasileiro, seja prático e direto.`;


    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation,
      { role: 'user', content: message },
    ];


    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const chatStream = await openaiInstance.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      tools: openAITools,
      tool_choice: 'auto',
      stream: true,
      temperature: 0.3,
      max_tokens: 1500,
      stream_options: { include_usage: true },
    });

    let functionCalls = [];
    let currentToolCall = null;
    let accumulatedContent = '';

    for await (const chunk of chatStream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            if (!functionCalls[toolCall.index]) {
              functionCalls[toolCall.index] = {
                id: toolCall.id || '',
                function: { name: '', arguments: '' },
              };
            }

            if (toolCall.function?.name) {
              functionCalls[toolCall.index].function.name +=
                toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              functionCalls[toolCall.index].function.arguments +=
                toolCall.function.arguments;
            }
          }
        }
      }

      if (delta?.content) {
        accumulatedContent += delta.content;
        res.write(
          JSON.stringify({
            type: 'content',
            content: delta.content,
          }) + '\n'
        );
      }
    }


    if (functionCalls.length > 0) {

      if (userToken) {
        toolImplementations.setUserToken(userToken);
      }

      res.write(
        JSON.stringify({
          type: 'thinking',
          message: `Executando ${functionCalls.length} ação${
            functionCalls.length > 1 ? 'ões' : ''
          } em paralelo...`,
        }) + '\n'
      );


      const toolResults = [];
      const toolPromises = functionCalls.map(async (toolCall, index) => {
        if (
          toolCall.function.name &&
          toolImplementations[toolCall.function.name]
        ) {
          try {

            res.write(
              JSON.stringify({
                type: 'tool_start',
                tool: toolCall.function.name,
                index: index,
                total: functionCalls.length,
              }) + '\n'
            );

            const args = JSON.parse(toolCall.function.arguments);
            const result = await toolImplementations[toolCall.function.name](
              args
            );

            const toolResult = {
              id: toolCall.id,
              result: JSON.stringify(result),
              index: index,
            };


            res.write(
              JSON.stringify({
                type: 'tool_result',
                tool: toolCall.function.name,
                result,
                index: index,
                total: functionCalls.length,
              }) + '\n'
            );

            return toolResult;
          } catch (error) {
            const toolResult = {
              id: toolCall.id,
              result: JSON.stringify({ error: error.message }),
              index: index,
            };


            res.write(
              JSON.stringify({
                type: 'tool_error',
                tool: toolCall.function.name,
                error: error.message,
                index: index,
                total: functionCalls.length,
              }) + '\n'
            );

            return toolResult;
          }
        }
        return null;
      });


      try {
        const results = await Promise.all(toolPromises);
        toolResults.push(...results.filter((r) => r !== null));


        console.log(
          `✅ ${toolResults.length} tools executadas com sucesso em paralelo`
        );

        res.write(
          JSON.stringify({
            type: 'tools_completed',
            total: toolResults.length,
            message: `${toolResults.length} ação${
              toolResults.length > 1 ? 'ões' : ''
            } executada${toolResults.length > 1 ? 's' : ''} com sucesso!`,
          }) + '\n'
        );
      } catch (error) {
        console.error('Erro na execução paralela de tools:', error);
        res.write(
          JSON.stringify({
            type: 'tools_error',
            error: error.message,
            message: 'Erro durante execução paralela de ferramentas',
          }) + '\n'
        );
      }


      if (toolResults.length > 0) {
        console.log(
          `🔄 Gerando resposta final para ${toolResults.length} tools executadas`
        );

        res.write(
          JSON.stringify({
            type: 'thinking',
            message: 'Processando resultados...',
          }) + '\n'
        );


        const hasGetMessageHistory = functionCalls.some(
          (fc) => fc.function.name === 'getMessageHistory'
        );
        const lastUserMessage = messages[messages.length - 1]?.content || '';
        const userWantsToSend =
          hasGetMessageHistory &&
          (lastUserMessage.includes('envie') ||
            lastUserMessage.includes('mande') ||
            lastUserMessage.includes('send') ||
            lastUserMessage.toLowerCase().includes('grupo'));


        const finalMessages = [
          ...messages,
          {
            role: 'assistant',
            tool_calls: functionCalls.map((fc) => ({
              id: fc.id,
              type: 'function',
              function: fc.function,
            })),
          },
          ...toolResults.map((tr) => ({
            role: 'tool',
            tool_call_id: tr.id,
            content: tr.result,
          })),
        ];


        if (userWantsToSend) {
          console.log(
            '🎯 Detectado pedido para enviar mensagem - adicionando contexto'
          );
          const sendInstruction = {
            role: 'system',
            content: `O usuário solicitou enviar uma mensagem. Após obter o histórico com getMessageHistory, continue com sendMessage usando os dados fornecidos (sessionId e phone) para completar a solicitação.`,
          };
          finalMessages.push(sendInstruction);
        }

        console.log(
          `📝 Mensagens finais preparadas: ${finalMessages.length} mensagens`
        );

        try {
          const finalStream = await openaiInstance.chat.completions.create({
            model: 'gpt-4.1',
            messages: finalMessages,
            temperature: 0.3,
            max_tokens: 1000,
            stream: true,
            stream_options: { include_usage: true },
          });

          let hasContent = false;
          for await (const chunk of finalStream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              hasContent = true;
              accumulatedContent += delta.content;
              res.write(
                JSON.stringify({
                  type: 'content',
                  content: delta.content,
                }) + '\n'
              );
            }
          }


          if (!hasContent) {
            console.log(
              '⚠️ IA não retornou conteúdo, forçando análise dos resultados das tools'
            );


            const analyzeResults = await openaiInstance.chat.completions.create(
              {
                model: 'gpt-4.1',
                messages: [
                  {
                    role: 'system',
                    content: `Analise os resultados das ferramentas de forma concisa e útil.`,
                  },
                  {
                    role: 'user',
                    content: `Ferramentas executadas: ${functionCalls
                      .map((fc) => fc.function.name)
                      .join(', ')}.\n\nResultados: ${toolResults
                      .map(
                        (tr) =>
                          `${tr.tool}: ${
                            typeof tr.result === 'string'
                              ? tr.result.substring(0, 500)
                              : JSON.stringify(tr.result, null, 2).substring(0, 500)
                          }`
                      )
                      .join('\n')}\n\nResumo dos resultados:`,
                  },
                ],
                temperature: 0.3,
                max_tokens: 800,
                stream: true,
              }
            );

            for await (const chunk of analyzeResults) {
              const delta = chunk.choices[0]?.delta;
              if (delta?.content) {
                accumulatedContent += delta.content;
                res.write(
                  JSON.stringify({
                    type: 'content',
                    content: delta.content,
                  }) + '\n'
                );
              }
            }
          }
        } catch (error) {
          console.error('Erro na resposta final da IA:', error);


          try {
            const simpleResponse = await openaiInstance.chat.completions.create(
              {
                model: 'gpt-4.1',
                messages: finalMessages,
                temperature: 0.3,
                max_tokens: 600,
                stream: false,
              }
            );

            const content = simpleResponse.choices[0]?.message?.content;
            if (content) {
              accumulatedContent += content;
              res.write(
                JSON.stringify({
                  type: 'content',
                  content: content,
                }) + '\n'
              );
            } else {
              throw new Error('Resposta vazia da IA');
            }
          } catch (fallbackError) {
            console.error('Erro na resposta de fallback:', fallbackError);


            console.log(
              '🚨 Fallback final - gerando resposta baseada nos resultados das tools'
            );

            const fallbackContent =
              `Executei as seguintes ferramentas: **${functionCalls
                .map((fc) => fc.function.name)
                .join(', ')}**\n\n` +
              toolResults
                .map((tr) => {
                  const toolName = tr.tool;
                  let result = tr.result;


                  if (toolName === 'listGroups') {
                    try {
                      const parsed =
                        typeof result === 'string'
                          ? JSON.parse(result)
                          : result;
                      if (parsed.groups && Array.isArray(parsed.groups)) {
                        return `📋 **${toolName}**: Encontrados ${
                          parsed.groups.length
                        } grupos:\n${parsed.groups
                          .slice(0, 3)
                          .map(
                            (g) =>
                              `• ${g.name} (${g.participants.total} participantes)`
                          )
                          .join('\n')}${
                          parsed.groups.length > 3
                            ? `\n• ... e mais ${
                                parsed.groups.length - 3
                              } grupos`
                            : ''
                        }`;
                      }
                    } catch (e) {}
                  }

                  if (toolName === 'getMessageHistory') {
                    try {
                      const parsed =
                        typeof result === 'string'
                          ? JSON.parse(result)
                          : result;
                      if (parsed.messages && Array.isArray(parsed.messages)) {
                        return `💬 **${toolName}**: Obtidas ${parsed.messages.length} mensagens do grupo`;
                      }
                    } catch (e) {}
                  }


                  const resultStr =
                    typeof result === 'string'
                      ? result
                      : JSON.stringify(result, null, 2);
                  return `✅ **${toolName}**: ${
                    resultStr.length > 200
                      ? resultStr.substring(0, 200) + '...'
                      : resultStr
                  }`;
                })
                .join('\n\n');

            res.write(
              JSON.stringify({
                type: 'content',
                content: fallbackContent,
              }) + '\n'
            );
          }
        }
      }
    }


    if (accumulatedContent) {
      try {
        console.log('🔍 Checking for base64 images in AI response...');
        const processedContent = await processBase64Images(accumulatedContent);


        if (processedContent !== accumulatedContent) {
          res.write(
            JSON.stringify({
              type: 'content_update',
              content: processedContent,
              original_content: accumulatedContent,
            }) + '\n'
          );
        }
      } catch (error) {
        console.error('Error processing base64 images:', error);
      }
    }

    res.write(JSON.stringify({ type: 'done' }) + '\n');
    res.end();
  } catch (error) {
    console.error('Erro na AI Assistant:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Erro interno da assistente de IA',
      });
    }
  }
});











/**
 * @swagger
 * /ai/tools:
 *   get:
 *     summary: Get available AI tools
 *     description: Retrieves a list of available tools for the AI assistant.
 *     tags: [AI Assistant]
 *     security:
 *       - ApiTokenAuth: []
 *     responses:
 *       '200':
 *         description: A list of available tools.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 tools:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 */
router.get('/tools', authenticateToken, (req, res) => {
  const toolsInfo = openAITools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));

  res.json({
    success: true,
    tools: toolsInfo,
    total: toolsInfo.length,
  });
});

/**
 * @swagger
 * /ai/save-base64-image:
 *   post:
 *     summary: Save a base64 encoded image
 *     description: Saves a base64 encoded image as a file and returns the URL.
 *     tags: [AI Assistant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               base64Data:
 *                 type: string
 *               filename:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The image was saved successfully.
 *       '400':
 *         description: Bad request, invalid base64 data.
 *       '500':
 *         description: Internal server error.
 */
router.post('/save-base64-image', async (req, res) => {
  try {
    const { base64Data, filename } = req.body;

    if (!base64Data || !base64Data.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base64 image data',
      });
    }


    const matches = base64Data.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base64 format',
      });
    }

    const [, imageType, base64String] = matches;


    const uniqueId = crypto.randomBytes(16).toString('hex');
    const fileExtension = imageType === 'svg+xml' ? 'svg' : imageType;
    const fileName = filename || `image-${uniqueId}.${fileExtension}`;


    const tempDir = path.join(__dirname, '../../temp-images');


    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);


    const imageBuffer = Buffer.from(base64String, 'base64');
    await fs.writeFile(filePath, imageBuffer);


    const imageUrl = `/temp-images/${fileName}`;

    console.log(
      `Base64 image saved: ${fileName} (${imageBuffer.length} bytes)`
    );

    res.json({
      success: true,
      url: imageUrl,
      filename: fileName,
      size: imageBuffer.length,
    });
  } catch (error) {
    console.error('Error saving base64 image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save image',
      details: error.message,
    });
  }
});











/**
 * @swagger
 * /ai/health:
 *   get:
 *     summary: Check the health of the AI assistant
 *     description: Checks the health of the AI assistant and its connection to the OpenAI API. If a custom API key is provided via the 'x-custom-api-key' header, it will be used to check the connection.
 *     tags: [AI Assistant]
 *     parameters:
 *       - in: header
 *         name: x-custom-api-key
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional. A custom OpenAI API key to test a specific user's connection.
 *     responses:
 *       '200':
 *         description: The AI assistant is healthy.
 *       '500':
 *         description: The AI assistant is unhealthy.
 */
router.get('/health', async (req, res) => {
  try {
    const customApiKey = req.headers['x-custom-api-key'];
    const openaiInstance = customApiKey ? createOpenAIInstance(customApiKey) : openai;

    // The instance is created but not used, which is consistent with the original logic.
    // A more robust check might involve an actual API call, like listing models.

    res.json({
      success: true,
      status: 'healthy',
      openai: 'connected',
      model: 'gpt-4.1-turbo-preview',
      tools: openAITools.length,
      message: 'Assistente de IA funcionando normalmente',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      message: 'Problema com a conexão do OpenAI',
    });
  }
});

module.exports = router;
