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

// Função utilitária para processar imagens base64 nas respostas da IA
async function processBase64Images(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Regex para detectar imagens base64 em formato markdown
  const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;

  let processedContent = content;
  let match;
  const promises = [];

  // Reset regex
  base64ImageRegex.lastIndex = 0;

  while ((match = base64ImageRegex.exec(content)) !== null) {
    const [fullMatch, alt, base64Data] = match;

    console.log(`Processing base64 image: ${alt || 'Unnamed'}`);

    // Criar promise para salvar a imagem
    const promise = (async () => {
      try {
        // Validar formato base64
        const matches = base64Data.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn('Invalid base64 format:', base64Data.substring(0, 50));
          return {
            fullMatch,
            replacement: `*[Erro: formato de imagem inválido]*`,
          };
        }

        const [, imageType, base64String] = matches;

        // Gerar nome único do arquivo
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const fileExtension = imageType === 'svg+xml' ? 'svg' : imageType;
        const fileName = `ai-image-${uniqueId}.${fileExtension}`;

        // Diretório para salvar imagens temporárias
        const tempDir = path.join(__dirname, '../../temp-images');

        // Garantir que o diretório existe
        try {
          await fs.access(tempDir);
        } catch {
          await fs.mkdir(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, fileName);

        // Converter base64 para buffer e salvar
        const imageBuffer = Buffer.from(base64String, 'base64');
        await fs.writeFile(filePath, imageBuffer);

        // URL para acessar a imagem
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

  // Se encontrou imagens, processar todas
  if (promises.length > 0) {
    console.log(`🖼️  Processing ${promises.length} base64 images...`);

    const results = await Promise.all(promises);

    // Substituir todas as imagens processadas
    results.forEach(({ fullMatch, replacement }) => {
      processedContent = processedContent.replace(fullMatch, replacement);
    });

    console.log('✅ All base64 images processed and replaced with local URLs');
  }

  return processedContent;
}

// Função para obter o token de API do usuário
async function getUserApiToken(userId) {
  try {
    const db = database.getDb();
    if (!db) {
      console.warn('Database não disponível, usando token padrão');
      return process.env.BAILEYS_API_TOKEN || 'baileys_default_token';
    }

    const tokensCollection = db.collection('api_tokens');

    // Garantir que userId seja um ObjectId
    const userObjectId =
      typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Buscar o token ativo mais recente do usuário
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

// Configuração do OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Função para criar instância do OpenAI com chave customizada
function createOpenAIInstance(customApiKey) {
  return new OpenAI({
    apiKey: customApiKey || process.env.OPENAI_API_KEY,
  });
}

// Middleware para validar API key do OpenAI
router.use((req, res, next) => {
  const customApiKey = req.body?.customApiKey;
  if (!process.env.OPENAI_API_KEY && !customApiKey) {
    return res.status(500).json({
      success: false,
      error: 'OpenAI API key não configurada',
      message:
        'Configure a variável de ambiente OPENAI_API_KEY ou forneça uma chave personalizada',
    });
  }
  next();
});

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Conversa com a assistente de IA
 *     tags: [AI Assistant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Mensagem para a assistente
 *               conversation:
 *                 type: array
 *                 description: Histórico da conversa (opcional)
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *               stream:
 *                 type: boolean
 *                 description: Se deve retornar resposta em streaming
 *                 default: false
 *     responses:
 *       200:
 *         description: Resposta da assistente
 *       500:
 *         description: Erro interno
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const {
      message,
      conversation = [],
      stream = false,
      customApiKey,
    } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem é obrigatória',
      });
    }

    // Obter token do usuário autenticado para usar nas tools
    const userToken = await getUserApiToken(req.user._id);

    // Injetar token do usuário nas tools
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

    // Usar instância personalizada do OpenAI se uma chave customizada foi fornecida
    const openaiInstance = createOpenAIInstance(customApiKey);

    // Sistema de prompts para a assistente - ATUALIZADO COM NOVAS FUNCIONALIDADES
    const systemPrompt = `Você é uma assistente de IA especializada EXCLUSIVAMENTE no FlowChat API - um sistema avançado de WhatsApp API multi-sessão.

SUAS CAPACIDADES AVANÇADAS INCLUEM:

📱 GERENCIAMENTO DE SESSÕES:
- Criar, listar, deletar e monitorar sessões WhatsApp
- Regenerar QR codes e verificar status de conexão
- Limpeza automática de sessões órfãs
- Estatísticas detalhadas de uso e performance

💬 MENSAGENS AVANÇADAS:
- Envio de mensagens, imagens, documentos, stickers e mídia
- Respostas com citação (reply) a mensagens específicas
- Controle de status de digitação (typing)
- Marcar mensagens como lidas
- Histórico completo de mensagens com filtros
- Envio de mídia com detecção automática de tipo

🔗 SISTEMA DE WEBHOOKS MODERNO:
- Até 3 webhooks por sessão com prioridades (1-3)
- Criar, listar, atualizar, deletar e testar webhooks
- Ativar/desativar webhooks individualmente
- Configuração de eventos específicos para escutar
- Sistema de fallback com delivery garantido

👥 GRUPOS AVANÇADOS:
- Gerenciamento completo de grupos (criar, info, configurações)
- Adicionar/remover participantes em massa
- Promover/despromover administradores
- Atualizar nome, descrição e configurações de permissão
- Códigos de convite (gerar, obter, revogar)
- Envio de mensagens para grupos com menções
- Histórico de mensagens do grupo

📊 MONITORAMENTO E DOWNLOADS:
- Informações detalhadas do sistema e estatísticas
- Download automático de mídias com URLs públicas
- Gerenciamento de downloads com expiração automática
- Limpeza de arquivos temporários

🔧 RECURSOS TÉCNICOS:
- Validação avançada com TypeBox (substituindo Zod)
- Integração completa com documentação Swagger
- Autenticação por tokens de usuário
- Fallback graceful para desenvolvimento sem BD
- Cache inteligente para performance otimizada
- **EXECUÇÃO PARALELA DE TOOLS**: Múltiplas ferramentas executam simultaneamente para máxima eficiência

REGRAS OBRIGATÓRIAS:
1. EXCLUSIVAMENTE sobre FlowChat API e WhatsApp
2. SEMPRE use as tools para executar ações práticas
3. Formato de telefone: OBRIGATORIAMENTE internacional (ex: 5511999999999)
4. Sessões: nomes únicos e descritivos
5. Webhooks: sempre especificar prioridade (1=alta, 3=baixa)
6. Grupos: validar permissões antes de modificações
7. Explicar CADA ação executada e seus resultados
8. Para dúvidas sobre APIs: consultar documentação em /api-docs

IMPORTANTE: Você tem acesso a TODAS as funcionalidades do Baileys API. Use as tools extensivamente para demonstrar as capacidades do sistema.

💡 **DICA DE PERFORMANCE**: Quando possível, combine múltiplas ações em uma única resposta (ex: criar sessão + listar sessões + verificar status). O sistema executará todas as ferramentas em paralelo automaticamente, proporcionando respostas mais rápidas e completas.

Responda em português brasileiro de forma técnica, prática e orientada a resultados.`;

    // Preparar mensagens para o OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation,
      { role: 'user', content: message },
    ];

    if (stream) {
      // Configurar streaming
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const chatStream = await openaiInstance.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: openAITools,
        tool_choice: 'auto',
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      });

      let functionCalls = [];
      let currentToolCall = null;
      let accumulatedContent = ''; // Acumular conteúdo para processar imagens

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

      // Executar function calls se houver
      if (functionCalls.length > 0) {
        // Injetar token do usuário nas tools (para streaming)
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

        // EXECUÇÃO PARALELA DE TOOLS - Melhor performance
        const toolResults = [];
        const toolPromises = functionCalls.map(async (toolCall, index) => {
          if (
            toolCall.function.name &&
            toolImplementations[toolCall.function.name]
          ) {
            try {
              // Notificar início da execução da tool
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

              // Notificar conclusão da tool
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

              // Notificar erro da tool
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

        // Aguardar todas as tools completarem em paralelo
        try {
          const results = await Promise.all(toolPromises);
          toolResults.push(...results.filter((r) => r !== null));

          // Notificar que todas as tools foram concluídas
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

        // Gerar resposta final após executar tools
        if (toolResults.length > 0) {
          res.write(
            JSON.stringify({
              type: 'thinking',
              message: 'Processando resultados...',
            }) + '\n'
          );

          // Preparar mensagens para resposta final
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

          try {
            const finalStream = await openaiInstance.chat.completions.create({
              model: 'gpt-4o',
              messages: finalMessages,
              temperature: 0.7,
              max_tokens: 1500,
              stream: true,
            });

            for await (const chunk of finalStream) {
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
          } catch (error) {
            res.write(
              JSON.stringify({
                type: 'content',
                content: `\n\nAções executadas com sucesso! ${functionCalls
                  .map((fc) => `✅ ${fc.function.name}`)
                  .join(', ')}`,
              }) + '\n'
            );
          }
        }
      }

      // Processar imagens base64 no conteúdo final
      if (accumulatedContent) {
        try {
          console.log('🔍 Checking for base64 images in AI response...');
          const processedContent = await processBase64Images(
            accumulatedContent
          );

          // Se o conteúdo foi modificado (imagens processadas), enviar atualização
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
    } else {
      // Resposta normal (não streaming)
      const completion = await openaiInstance.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: openAITools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2000,
      });

      const response = completion.choices[0].message;
      const toolCalls = response.tool_calls || [];

      // Executar function calls
      const toolResults = [];
      if (toolCalls.length > 0) {
        // Injetar token do usuário nas tools (para execução sem streaming)
        if (userToken) {
          toolImplementations.setUserToken(userToken);
        }

        // EXECUÇÃO PARALELA DE TOOLS PARA MODO NÃO-STREAMING
        const toolPromises = toolCalls.map(async (toolCall) => {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          if (toolImplementations[functionName]) {
            try {
              const result = await toolImplementations[functionName](
                functionArgs
              );
              return {
                tool: functionName,
                args: functionArgs,
                result,
              };
            } catch (error) {
              return {
                tool: functionName,
                args: functionArgs,
                error: error.message,
              };
            }
          }
          return null;
        });

        // Aguardar todas as tools completarem em paralelo
        try {
          const results = await Promise.all(toolPromises);
          toolResults.push(...results.filter((r) => r !== null));

          console.log(
            `✅ Executed ${toolResults.length} tools in parallel successfully`
          );
        } catch (error) {
          console.error(
            'Erro na execução paralela de tools (modo não-streaming):',
            error
          );
        }

        // Se houver tool calls, fazer uma segunda chamada para gerar resposta final
        const finalMessages = [
          ...messages,
          response,
          ...toolCalls.map((call, index) => ({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolResults[index]),
          })),
        ];

        const finalCompletion = await openaiInstance.chat.completions.create({
          model: 'gpt-4o',
          messages: finalMessages,
          temperature: 0.7,
          max_tokens: 1500,
        });

        // Processar imagens base64 na resposta final
        const finalResponse = finalCompletion.choices[0].message.content;
        const processedResponse = await processBase64Images(finalResponse);

        return res.json({
          success: true,
          response: processedResponse,
          toolCalls: toolResults,
          usage: {
            initial: completion.usage,
            final: finalCompletion.usage,
          },
        });
      }

      // Processar imagens base64 na resposta
      const processedResponse = await processBase64Images(response.content);

      res.json({
        success: true,
        response: processedResponse,
        toolCalls: [],
        usage: completion.usage,
      });
    }
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
 * /api/ai/tools:
 *   get:
 *     summary: Lista todas as tools disponíveis
 *     tags: [AI Assistant]
 *     responses:
 *       200:
 *         description: Lista de tools disponíveis
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

// ENDPOINT DE SUGESTÕES DESABILITADO - Funcionalidade removida para otimização
// /**
//  * @swagger
//  * /api/ai/suggestions:
//  *   post:
//  *     summary: Gera sugestões inteligentes baseadas na conversa (DESABILITADO)
//  *     deprecated: true
//  *     tags: [AI Assistant]
//  */
// router.post('/suggestions', authenticateToken, async (req, res) => {
//   res.status(410).json({
//     success: false,
//     error: 'Endpoint desabilitado',
//     message: 'Funcionalidade de sugestões foi removida para otimização',
//   });
// });

/**
 * @swagger
 * /api/management/ai/save-base64-image:
 *   post:
 *     summary: Salvar imagem base64 e retornar URL local
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
 *                 description: Dados da imagem em base64
 *               filename:
 *                 type: string
 *                 description: Nome do arquivo (opcional)
 *     responses:
 *       200:
 *         description: Imagem salva com sucesso
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

    // Extrair o tipo de imagem e os dados base64
    const matches = base64Data.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base64 format',
      });
    }

    const [, imageType, base64String] = matches;

    // Gerar nome único do arquivo
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const fileExtension = imageType === 'svg+xml' ? 'svg' : imageType;
    const fileName = filename || `image-${uniqueId}.${fileExtension}`;

    // Diretório para salvar imagens temporárias
    const tempDir = path.join(__dirname, '../../temp-images');

    // Garantir que o diretório existe
    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);

    // Converter base64 para buffer e salvar
    const imageBuffer = Buffer.from(base64String, 'base64');
    await fs.writeFile(filePath, imageBuffer);

    // URL para acessar a imagem
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
 * /api/ai/health:
 *   get:
 *     summary: Verifica saúde da assistente de IA
 *     tags: [AI Assistant]
 *     responses:
 *       200:
 *         description: Status da assistente
 */
router.get('/health', async (req, res) => {
  try {
    // Verificar se há chave customizada no localStorage (passada via header)
    const customApiKey = req.headers['x-custom-api-key'];
    const openaiInstance = createOpenAIInstance(customApiKey);

    // Teste simples com OpenAI
    const testCompletion = await openaiInstance.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 5,
    });

    res.json({
      success: true,
      status: 'healthy',
      openai: 'connected',
      model: 'gpt-4-turbo-preview',
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
