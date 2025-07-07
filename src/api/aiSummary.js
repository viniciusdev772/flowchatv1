const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const logger = require('pino')();
const { authenticateToken } = require('../middleware/auth');

// Configuração do OpenAI
const OpenAI = require('openai');

// Função para obter cliente OpenAI
function getOpenAIClient(customApiKey = null) {
  const apiKey = customApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('API Key do OpenAI não configurada');
  }

  return new OpenAI({
    apiKey: apiKey,
  });
}

// Prompts para diferentes tipos de resumo
const SUMMARY_PROMPTS = {
  professional: {
    system:
      'Você é um assistente profissional especializado em análise de conversas de grupos. Analise as mensagens fornecidas e crie um resumo profissional, focando em pontos importantes, decisões tomadas e ações necessárias.',
    tone: 'profissional e objetivo',
  },
  casual: {
    system:
      'Você é um assistente amigável que analisa conversas de grupos. Crie um resumo casual e fácil de entender, destacando os principais tópicos discutidos e momentos interessantes.',
    tone: 'casual e amigável',
  },
  analytical: {
    system:
      'Você é um analista especializado em comunicação. Analise as mensagens do grupo de forma detalhada, identificando padrões, temas principais, sentimentos predominantes e insights relevantes.',
    tone: 'analítico e detalhado',
  },
  brief: {
    system:
      'Você é um assistente que cria resumos concisos. Analise as mensagens e forneça apenas os pontos mais importantes em formato de tópicos.',
    tone: 'conciso e direto',
  },
};

// Função para processar mensagens em lotes
function processMessagesInBatches(messages, batchSize = 100) {
  const batches = [];
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize));
  }
  return batches;
}

// Função para formatar mensagens para o prompt
function formatMessagesForPrompt(messages) {
  return messages
    .map((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const name = msg.pushName || 'Usuário';
      return `[${time}] ${name}: ${msg.text}`;
    })
    .join('\n');
}

// POST /api/ai-summary/summarize
// Criar resumo com IA das mensagens coletadas
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const {
      collectorId,
      tone = 'professional',
      customPrompt,
      maxTokens = 2000,
      includeStats = true,
      customApiKey,
    } = req.body;

    const userId = req.user._id;

    if (!collectorId) {
      return res.status(400).json({
        success: false,
        message: 'collectorId é obrigatório',
      });
    }

    // Buscar coletor primeiro para verificar permissões
    const db = database.getDb();
    const collector = await db.collection('messageCollectors').findOne({
      _id: collectorId,
      userId: new ObjectId(userId),
    });

    if (!collector) {
      return res.status(404).json({
        success: false,
        message: 'Coletor não encontrado ou sem permissão',
      });
    }

    // Buscar mensagens coletadas na collection separada
    const messages = await db
      .collection('collectedMessages')
      .find({ collectorId })
      .sort({ collectedAt: 1 })
      .toArray();

    if (messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma mensagem encontrada para resumir',
      });
    }

    // Configurar OpenAI
    const openai = getOpenAIClient(customApiKey);

    // Obter prompt baseado no tom
    const promptConfig = SUMMARY_PROMPTS[tone] || SUMMARY_PROMPTS.professional;

    let systemPrompt = customPrompt || promptConfig.system;

    // Adicionar contexto específico
    systemPrompt += `\n\nVocê receberá mensagens de um grupo do WhatsApp coletadas durante um período específico. 
    As mensagens estão no formato: [Hora] Nome: Mensagem
    
    ${
      includeStats
        ? 'Inclua no final um resumo estatístico com: total de mensagens, participantes mais ativos, horários de maior atividade.'
        : ''
    }
    
    Responda em português brasileiro com tom ${promptConfig.tone}.`;

    // Processar mensagens em lotes se necessário
    const batches = processMessagesInBatches(messages, 200);
    let summaries = [];

    // Set para rastrear streaming response
    const isStreaming =
      req.headers.accept && req.headers.accept.includes('text/stream');

    if (isStreaming) {
      // Configurar streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      res.write(
        `data: ${JSON.stringify({
          type: 'start',
          totalBatches: batches.length,
        })}\n\n`
      );
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const formattedMessages = formatMessagesForPrompt(batch);

      let userPrompt = `Analise as seguintes mensagens do grupo:\n\n${formattedMessages}`;

      if (batches.length > 1) {
        userPrompt += `\n\n(Esta é a parte ${i + 1} de ${
          batches.length
        } do total de mensagens)`;
      }

      if (isStreaming) {
        res.write(
          `data: ${JSON.stringify({
            type: 'batch_start',
            batch: i + 1,
            total: batches.length,
            messages: batch.length,
          })}\n\n`
        );
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: Math.floor(maxTokens / batches.length),
        temperature: 0.7,
        stream: isStreaming,
      });

      if (isStreaming) {
        // Streaming response
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            res.write(
              `data: ${JSON.stringify({ type: 'content', content })}\n\n`
            );
          }
        }
        res.write(
          `data: ${JSON.stringify({
            type: 'batch_complete',
            batch: i + 1,
          })}\n\n`
        );
      } else {
        // Non-streaming response
        summaries.push(completion.choices[0].message.content);
      }
    }

    // Salvar resumo no banco
    const summaryData = {
      collectorId,
      userId: new ObjectId(userId),
      tone,
      customPrompt,
      maxTokens,
      includeStats,
      totalMessages: messages.length,
      createdAt: new Date(),
      groupId: collector.groupId,
      sessionId: collector.sessionId,
      period: {
        startTime: collector.startTime,
        endTime: collector.endTime,
      },
    };

    if (isStreaming) {
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();

      // Salvar sem o conteúdo do resumo (já foi enviado via stream)
      await db.collection('aiSummaries').insertOne({
        ...summaryData,
        isStreamed: true,
      });
    } else {
      // Combinar resumos se houver múltiplos lotes
      let finalSummary = summaries.join('\n\n---\n\n');

      if (summaries.length > 1) {
        // Criar um resumo consolidado dos resumos
        const consolidationPrompt = `Você recebeu ${summaries.length} resumos parciais de um grupo do WhatsApp. 
        Crie um resumo final consolidado e coerente integrando todas as informações:

        ${finalSummary}`;

        const finalCompletion = await openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: consolidationPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        });

        finalSummary = finalCompletion.choices[0].message.content;
      }

      // Salvar resumo completo
      const savedSummary = await db.collection('aiSummaries').insertOne({
        ...summaryData,
        summary: finalSummary,
        isStreamed: false,
      });

      res.json({
        success: true,
        summary: finalSummary,
        summaryId: savedSummary.insertedId,
        stats: {
          totalMessages: messages.length,
          totalBatches: batches.length,
          tone,
          tokensUsed: maxTokens,
        },
      });
    }
  } catch (error) {
    logger.error('Erro ao criar resumo:', error);

    if (error.message.includes('API Key')) {
      return res.status(400).json({
        success: false,
        message: 'API Key do OpenAI inválida ou não configurada',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message,
    });
  }
});

// GET /api/ai-summary/list
// Listar resumos do usuário
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const db = database.getDb();

    const summaries = await db
      .collection('aiSummaries')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      success: true,
      summaries: summaries.map((summary) => ({
        id: summary._id,
        collectorId: summary.collectorId,
        groupId: summary.groupId,
        sessionId: summary.sessionId,
        tone: summary.tone,
        totalMessages: summary.totalMessages,
        createdAt: summary.createdAt,
        period: summary.period,
        hasCustomPrompt: !!summary.customPrompt,
        isStreamed: summary.isStreamed,
      })),
    });
  } catch (error) {
    logger.error('Erro ao listar resumos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

// GET /api/ai-summary/:summaryId
// Obter resumo específico
router.get('/:summaryId', authenticateToken, async (req, res) => {
  try {
    const { summaryId } = req.params;
    const userId = req.user._id;
    const db = database.getDb();

    const summary = await db.collection('aiSummaries').findOne({
      _id: new ObjectId(summaryId),
      userId: new ObjectId(userId),
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Resumo não encontrado',
      });
    }

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('Erro ao obter resumo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

// DELETE /api/ai-summary/:summaryId
// Deletar resumo
router.delete('/:summaryId', authenticateToken, async (req, res) => {
  try {
    const { summaryId } = req.params;
    const userId = req.user._id;
    const db = database.getDb();

    const result = await db.collection('aiSummaries').deleteOne({
      _id: new ObjectId(summaryId),
      userId: new ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resumo não encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Resumo deletado com sucesso',
    });
  } catch (error) {
    logger.error('Erro ao deletar resumo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

// POST /api/ai-summary/analyze-sentiment
// Análise de sentimento das mensagens
router.post('/analyze-sentiment', authenticateToken, async (req, res) => {
  try {
    const { collectorId, customApiKey } = req.body;
    const userId = req.user._id;

    // Buscar coletor e mensagens
    const db = database.getDb();
    const collector = await db.collection('messageCollectors').findOne({
      _id: collectorId,
      userId: new ObjectId(userId),
    });

    if (!collector) {
      return res.status(404).json({
        success: false,
        message: 'Coletor não encontrado ou sem permissão',
      });
    }

    // Buscar mensagens coletadas
    const collectedMessages = await db
      .collection('collectedMessages')
      .find({ collectorId })
      .limit(200) // Limitar para análise
      .toArray();

    if (!collectedMessages.length) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma mensagem encontrada para análise',
      });
    }

    const openai = getOpenAIClient(customApiKey);
    const messages = collectedMessages;
    const formattedMessages = formatMessagesForPrompt(messages);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Analise o sentimento geral das mensagens do grupo WhatsApp. 
          Classifique como: Positivo, Neutro, Negativo ou Misto.
          Identifique também os temas principais e momentos de maior emoção.
          Forneça uma análise em português brasileiro.`,
        },
        {
          role: 'user',
          content: `Analise o sentimento destas mensagens:\n\n${formattedMessages}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const analysis = completion.choices[0].message.content;

    // Salvar análise
    await db.collection('sentimentAnalysis').insertOne({
      collectorId,
      userId: new ObjectId(userId),
      analysis,
      totalMessages: messages.length,
      groupId: collector.groupId,
      sessionId: collector.sessionId,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      analysis,
      totalAnalyzed: messages.length,
    });
  } catch (error) {
    logger.error('Erro na análise de sentimento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

module.exports = router;
