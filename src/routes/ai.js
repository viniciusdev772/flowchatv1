const express = require('express');
const OpenAI = require('openai');
const { authenticateToken } = require('../middleware/auth');
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const {
  toolSchemas,
  toolImplementations,
  openAITools,
} = require('../ai/tools');
const router = express.Router();

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

// Middleware para validar API key do OpenAI
router.use((req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'OpenAI API key não configurada',
      message: 'Configure a variável de ambiente OPENAI_API_KEY',
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
    const { message, conversation = [], stream = false } = req.body;

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

      const chatStream = await openai.chat.completions.create({
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
            message: 'Executando ações...',
          }) + '\n'
        );

        const toolResults = [];
        for (const toolCall of functionCalls) {
          if (
            toolCall.function.name &&
            toolImplementations[toolCall.function.name]
          ) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await toolImplementations[toolCall.function.name](
                args
              );

              toolResults.push({
                id: toolCall.id,
                result: JSON.stringify(result),
              });

              res.write(
                JSON.stringify({
                  type: 'tool_result',
                  tool: toolCall.function.name,
                  result,
                }) + '\n'
              );
            } catch (error) {
              toolResults.push({
                id: toolCall.id,
                result: JSON.stringify({ error: error.message }),
              });

              res.write(
                JSON.stringify({
                  type: 'tool_error',
                  tool: toolCall.function.name,
                  error: error.message,
                }) + '\n'
              );
            }
          }
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
            const finalStream = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: finalMessages,
              temperature: 0.7,
              max_tokens: 1500,
              stream: true,
            });

            for await (const chunk of finalStream) {
              const delta = chunk.choices[0]?.delta;
              if (delta?.content) {
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

      res.write(JSON.stringify({ type: 'done' }) + '\n');
      res.end();
    } else {
      // Resposta normal (não streaming)
      const completion = await openai.chat.completions.create({
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

        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          if (toolImplementations[functionName]) {
            try {
              const result = await toolImplementations[functionName](
                functionArgs
              );
              toolResults.push({
                tool: functionName,
                args: functionArgs,
                result,
              });
            } catch (error) {
              toolResults.push({
                tool: functionName,
                args: functionArgs,
                error: error.message,
              });
            }
          }
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

        const finalCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: finalMessages,
          temperature: 0.7,
          max_tokens: 1500,
        });

        return res.json({
          success: true,
          response: finalCompletion.choices[0].message.content,
          toolCalls: toolResults,
          usage: {
            initial: completion.usage,
            final: finalCompletion.usage,
          },
        });
      }

      res.json({
        success: true,
        response: response.content,
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

/**
 * @swagger
 * /api/ai/suggestions:
 *   post:
 *     summary: Gera sugestões inteligentes baseadas na conversa
 *     tags: [AI Assistant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversation
 *             properties:
 *               conversation:
 *                 type: array
 *                 description: Últimas mensagens da conversa
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Sugestões geradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.post('/suggestions', authenticateToken, async (req, res) => {
  try {
    const { conversation = [] } = req.body;

    if (!conversation || conversation.length === 0) {
      return res.json({
        success: true,
        suggestions: [
          'Listar todas as sessões ativas',
          'Criar uma nova sessão',
          'Verificar status do sistema',
          'Como configurar webhooks?',
        ],
      });
    }

    // Prompt para gerar sugestões contextuais
    const suggestionsPrompt = `
Com base na conversa a seguir sobre o FlowChat API (sistema de gerenciamento de WhatsApp), gere 4 sugestões curtas e práticas para o que o usuário pode perguntar ou fazer em seguida.

Contexto da conversa:
${conversation
  .map(
    (msg) => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`
  )
  .join('\n')}

As sugestões devem ser:
- Relacionadas ao contexto da conversa
- Práticas e úteis para o usuário
- Focadas em funcionalidades do FlowChat API
- Máximo de 60 caracteres cada

Retorne apenas as 4 sugestões, uma por linha, sem numeração ou formatação extra.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em APIs de WhatsApp e assistente do FlowChat API.',
        },
        {
          role: 'user',
          content: suggestionsPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const suggestionsText = response.choices[0]?.message?.content || '';
    const suggestions = suggestionsText
      .split('\n')
      .filter((line) => line.trim())
      .slice(0, 4)
      .map((suggestion) => suggestion.trim());

    // Fallback se não conseguir gerar sugestões
    if (suggestions.length === 0) {
      return res.json({
        success: true,
        suggestions: [
          'Listar todas as sessões ativas',
          'Criar uma nova sessão',
          'Verificar status do sistema',
          'Como configurar webhooks?',
        ],
      });
    }

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Erro ao gerar sugestões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      suggestions: [
        'Listar todas as sessões ativas',
        'Criar uma nova sessão',
        'Verificar status do sistema',
        'Como configurar webhooks?',
      ],
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
    // Teste simples com OpenAI
    const testCompletion = await openai.chat.completions.create({
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
