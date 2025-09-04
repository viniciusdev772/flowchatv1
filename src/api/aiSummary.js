const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const logger = require('pino')();
const { authenticateToken } = require('../middleware/auth');
const apiTokenAuth = require('../middleware/apiTokenAuth');


const OpenAI = require('openai');


function getOpenAIClient(customApiKey = null) {
  const apiKey = customApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('API Key do OpenAI não configurada');
  }

  return new OpenAI({
    apiKey: apiKey,
  });
}


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


function processMessagesInBatches(messages, batchSize = 100) {
  const batches = [];
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize));
  }
  return batches;
}


function filterInternalDownloadLinks(text) {
  if (!text) return text;



  const internalDownloadPattern = /https?:\/\/[^\s]+\/api\/baileys\/download\/[^\s]+/gi;
  const genericDownloadPattern = /https?:\/\/[^\s]+\/download\/[a-zA-Z0-9_]+/gi;


  let filteredText = text.replace(internalDownloadPattern, '[Arquivo compartilhado]');
  filteredText = filteredText.replace(genericDownloadPattern, '[Arquivo compartilhado]');

  return filteredText;
}


function formatMessagesForPrompt(messages) {
  return messages
    .map((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const name = msg.pushName || 'Usuário';


      let filteredText = filterInternalDownloadLinks(msg.text);


      let messageContent = '';


      if (msg.quotedMessage) {
        const quotedUser = msg.quotedMessage.participant ?
          msg.quotedMessage.participant.split('@')[0] : 'Usuário';
        const quotedText = msg.quotedMessage.text || '[Mídia]';
        messageContent += `(respondendo a ${quotedUser}: "${quotedText}") `;
      }


      if (msg.caption && msg.hasMedia) {

        const mediaType = msg.mediaType === 'image' ? 'imagem' :
                         msg.mediaType === 'video' ? 'vídeo' :
                         msg.mediaType === 'audio' ? 'áudio' :
                         msg.mediaType === 'document' ? 'documento' :
                         msg.mediaType === 'sticker' ? 'figurinha' : 'mídia';
        messageContent += `${msg.caption} [${mediaType} compartilhada]`;
      } else if (msg.hasMedia) {

        const mediaType = msg.mediaType === 'image' ? 'Imagem' :
                         msg.mediaType === 'video' ? 'Vídeo' :
                         msg.mediaType === 'audio' ? 'Áudio' :
                         msg.mediaType === 'document' ? 'Documento' :
                         msg.mediaType === 'sticker' ? 'Figurinha' : 'Mídia';
        messageContent += `[${mediaType} compartilhada]`;
      } else {

        messageContent += filteredText;
      }

      return `[${time}] ${name}: ${messageContent}`;
    })
    .join('\n');
}




router.post('/summarize', (req, res, next) => {

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer baileys_')) {

    apiTokenAuth(req, res, next);
  } else {

    authenticateToken(req, res, next);
  }
}, async (req, res) => {
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


    if (!['active', 'completed'].includes(collector.status)) {
      return res.status(400).json({
        success: false,
        message: 'Coletor deve estar ativo ou completado para gerar resumo',
      });
    }


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


    let effectiveApiKey = customApiKey;

    if (!effectiveApiKey) {

      const user = await db.collection('users').findOne({ _id: req.user._id });
      effectiveApiKey = user?.openaiApiKey;
    }

    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        message: 'Chave OpenAI não configurada. Configure sua chave em Configurações > API Keys',
        needsApiKey: true
      });
    }


    if (customApiKey && customApiKey !== req.user.openaiApiKey) {
      await db.collection('users').updateOne(
        { _id: req.user._id },
        { $set: { openaiApiKey: customApiKey, updatedAt: new Date() } }
      );
    }


    const openai = getOpenAIClient(effectiveApiKey);


    const topParticipantsCount = parseInt(req.body.topParticipants) || 5;
    const validatedCount = Math.max(3, Math.min(20, topParticipantsCount));
    const participantsList = Array.from({length: validatedCount}, (_, i) =>
      `${i + 1}. [Nome] - [X] mensagens`
    ).join('\n');


    const summaryTemplate = `
Siga este formato exato para o resumo:

Resumo do Grupo - [Nome do Grupo] 📆 - [Data]

👥 Top ${validatedCount} Participantes Ativos:
${participantsList}

📌 Assunto Principal:
[Descrição geral dos temas mais discutidos]

💡 Assuntos Relevantes:
- [Categoria 1]:
  - [Detalhes específicos]
  - [Soluções ou discussões]
- [Categoria 2]:
  - [Detalhes específicos]
  - [Atualizações ou recursos]

🔗 Links Compartilhados:
- [Descrição]: [URL]

[Temas específicos com horários se aplicável]
Tema: [Nome do Tema] ⏰ [Horário início] – [Horário fim]
- Participantes: [Lista de nomes]
- Resumo: [Descrição do que foi discutido]

Destaques do Dia 🔍
- Técnicos: [Pontos técnicos principais]
- Inovação: [Novidades ou soluções]
- Colaboração: [Aspectos de trabalho em equipe]

Encerramento 🌟
[Frase de fechamento sobre o dia]
`;


    const promptConfig = SUMMARY_PROMPTS[tone] || SUMMARY_PROMPTS.professional;


    const groupName = collector.config?.name || collector.groupId || 'Grupo WhatsApp';
    const startDate = collector.startTime ? new Date(collector.startTime).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

    let systemPrompt = customPrompt || `${promptConfig.system}\n\nIMPORTANTE: Siga exatamente este template estruturado, substituindo os placeholders:\n\n${summaryTemplate}\n\nDados do grupo:\n- Nome do Grupo: ${groupName}\n- Data da coleta: ${startDate}\n- Total de mensagens: ${messages.length}`;


    systemPrompt += `\n\nVocê receberá mensagens de um grupo do WhatsApp coletadas durante um período específico.
    As mensagens estão no formato: [Hora] Nome: Mensagem

    IMPORTANTE - Links e Arquivos:
    - NUNCA inclua links de download internos (que contêm /api/baileys/download/ ou /download/ + ID) na seção de Links Compartilhados
    - Substitua referências a arquivos baixados por "[Arquivo compartilhado]"
    - Na seção "🔗 Links Compartilhados" inclua APENAS links externos relevantes (sites, ferramentas, plataformas)
    - Ignore completamente links de download interno do sistema

    ${
      includeStats
        ? 'Inclua no final um resumo estatístico com: total de mensagens, participantes mais ativos, horários de maior atividade.'
        : ''
    }

    Responda em português brasileiro com tom ${promptConfig.tone}.`;


    const batches = processMessagesInBatches(messages, 200);
    let summaries = [];


    const isStreaming =
      req.headers.accept && req.headers.accept.includes('text/stream');

    if (isStreaming) {

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

        summaries.push(completion.choices[0].message.content);
      }
    }


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


      await db.collection('aiSummaries').insertOne({
        ...summaryData,
        isStreamed: true,
      });
    } else {

      let finalSummary = summaries.join('\n\n---\n\n');

      if (summaries.length > 1) {

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



router.post('/analyze-sentiment', authenticateToken, async (req, res) => {
  try {
    const { collectorId, customApiKey } = req.body;
    const userId = req.user._id;


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


    const collectedMessages = await db
      .collection('collectedMessages')
      .find({ collectorId })
      .limit(200)
      .toArray();

    if (!collectedMessages.length) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma mensagem encontrada para análise',
      });
    }


    let effectiveApiKey = customApiKey;

    if (!effectiveApiKey) {

      const user = await db.collection('users').findOne({ _id: req.user._id });
      effectiveApiKey = user?.openaiApiKey;
    }

    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        message: 'Chave OpenAI não configurada. Configure sua chave em Configurações > API Keys',
        needsApiKey: true
      });
    }


    if (customApiKey && customApiKey !== req.user.openaiApiKey) {
      await db.collection('users').updateOne(
        { _id: req.user._id },
        { $set: { openaiApiKey: customApiKey, updatedAt: new Date() } }
      );
    }

    const openai = getOpenAIClient(effectiveApiKey);
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
