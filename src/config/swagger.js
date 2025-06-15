const swaggerJsdoc = require('swagger-jsdoc');

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Baileys Multi-Session WhatsApp API',
      version: '1.0.0',
      description:
        'API avançada do WhatsApp com Baileys, multi-sessões e comportamento humano para prevenção de banimentos',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    tags: [
      {
        name: 'Sessões',
        description: 'Gerenciamento de sessões do WhatsApp',
      },
      {
        name: 'Mensagens',
        description: 'Envio e controle de mensagens',
      },
      {
        name: 'Grupos',
        description: 'Gerenciamento de grupos do WhatsApp',
      },
      {
        name: 'Informações',
        description: 'Informações da API e documentação',
      },
    ],
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Servidor de desenvolvimento',
      },
    ],
    components: {
      schemas: {
        Session: {
          type: 'object',
          properties: {
            sessionId: {
              
              type: 'string',
              description: 'ID único da sessão',
            },
            isConnected: {
              type: 'boolean',
              description: 'Status de conexão da sessão',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da sessão',
            },
            user: {
              type: 'object',
              description: 'Informações do usuário conectado',
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indica se a operação foi bem-sucedida',
            },
            message: {
              type: 'string',
              description: 'Mensagem descritiva da operação',
            },
            data: {
              type: 'object',
              description: 'Dados retornados pela operação',
            },
          },
        },
        QrCodeResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Sessão criada com sucesso',
            },
            qrCode: {
              type: 'string',
              description: 'QR code para autenticação (texto)',
            },
            qrCodeImage: {
              type: 'string',
              format: 'uri',
              description: 'QR code como imagem em base64 (data URL)',
              example: 'data:image/png;base64,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',
              'x-display-name': 'QR Code Image',
            },
            sessionId: {
              type: 'string',
              example: 'minha-sessao-1',
            },
          },
        },
        Message: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Número do destinatário',
            },
            text: {
              type: 'string',
              description: 'Texto da mensagem',
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'document', 'audio'],
              description: 'Tipo da mensagem',
            },
          },
        },
        Group: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único do grupo',
            },
            subject: {
              type: 'string',
              description: 'Nome/assunto do grupo',
            },
            description: {
              type: 'string',
              description: 'Descrição do grupo',
              nullable: true,
            },
            owner: {
              type: 'string',
              description: 'ID do criador do grupo',
            },
            creation: {
              type: 'integer',
              description: 'Timestamp de criação do grupo',
            },
            size: {
              type: 'integer',
              description: 'Número de participantes',
            },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'ID do participante',
                  },
                  isAdmin: {
                    type: 'boolean',
                    description: 'Se o participante é admin',
                  },
                  isSuperAdmin: {
                    type: 'boolean',
                    description: 'Se o participante é super admin',
                  },
                },
              },
            },
            settings: {
              type: 'object',
              properties: {
                announce: {
                  type: 'boolean',
                  description: 'Se apenas admins podem enviar mensagens',
                },
                restrict: {
                  type: 'boolean',
                  description: 'Se apenas admins podem editar informações',
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/config/swagger.js'], // Documentação definida neste próprio arquivo
};

// Gerar spec do Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Configuração customizada do Swagger UI
const swaggerUiOptions = {
  customSiteTitle: 'Baileys API Documentation',
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .renderers .hljs { 
      max-height: none !important; 
    }
    .swagger-ui .response-col_description .renderers .hljs {
      max-height: 400px !important;
      overflow-y: auto !important;
    }
    .swagger-ui .model-example .hljs {
      max-height: 300px !important;
      overflow-y: auto !important;
    }
    /* Estilos para renderização de imagens base64 */
    .qr-code-image {
      max-width: 200px;
      max-height: 200px;
      border: 1px solid #ccc;
      margin: 10px 0;
      display: block;
      border-radius: 4px;
    }
    .base64-indicator {
      background: #f0f0f0;
      padding: 5px;
      border-radius: 3px;
      font-size: 12px;
      margin: 5px 0;
      color: #666;
    }
  `,
  customJs: `
    // Script para renderizar imagens base64 automaticamente
    window.addEventListener('DOMContentLoaded', function() {
      let observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Procurar por elementos que contêm dados base64
            const elements = document.querySelectorAll('.highlight-code, .microlight, .response-col_description');
            
            elements.forEach(function(element) {
              const content = element.textContent || element.innerText;
              
              if (content && content.includes('data:image/')) {
                // Encontrar todas as strings base64 de imagem
                const base64Regex = /"(data:image\\/[^"]+)"/g;
                let match;
                let hasImages = false;
                
                while ((match = base64Regex.exec(content)) !== null) {
                  const base64Data = match[1];
                  
                  // Verificar se já não renderizamos esta imagem
                  const existingImg = element.querySelector('img[src="' + base64Data + '"]');
                  if (!existingImg) {
                    // Criar container para a imagem
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'base64-image-container';
                    imgContainer.style.margin = '10px 0';
                    
                    // Criar indicador
                    const indicator = document.createElement('div');
                    indicator.className = 'base64-indicator';
                    indicator.textContent = '🖼️ QR Code Image (Base64 renderizada):';
                    
                    // Criar imagem
                    const img = document.createElement('img');
                    img.src = base64Data;
                    img.className = 'qr-code-image';
                    img.alt = 'QR Code';
                    img.title = 'QR Code gerado pela API';
                    
                    // Adicionar eventos de erro
                    img.onerror = function() {
                      indicator.textContent = '❌ Erro ao renderizar imagem base64';
                      indicator.style.color = '#d32f2f';
                    };
                    
                    img.onload = function() {
                      indicator.textContent = '✅ QR Code Image (Base64 renderizada):';
                      indicator.style.color = '#2e7d32';
                    };
                    
                    imgContainer.appendChild(indicator);
                    imgContainer.appendChild(img);
                    
                    // Inserir após o elemento de código
                    element.parentNode.insertBefore(imgContainer, element.nextSibling);
                    hasImages = true;
                  }
                }
              }
            });
          }
        });
      });
      
      // Observar mudanças no DOM
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Executar imediatamente para conteúdo já carregado
      setTimeout(function() {
        const event = new MutationRecord();
        event.type = 'childList';
        event.addedNodes = [document.body];
        observer.callback([event]);
      }, 1000);
    });
  `,
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestHeaders: false,
    tryItOutEnabled: true,
    syntaxHighlight: {
      activate: true,
      theme: 'agate'
    },
    onComplete: function() {
      // Trigger da renderização de imagens após carregar
      setTimeout(function() {
        const event = new Event('DOMContentLoaded');
        window.dispatchEvent(event);
      }, 500);
    }
  },
};

// ========================================
// DOCUMENTAÇÃO DAS ROTAS DA API
// ========================================

/**
 * @swagger
 * /api/session/create:
 *   post:
 *     tags:
 *       - Sessões
 *     summary: Criar nova sessão do WhatsApp
 *     description: Cria uma nova sessão do WhatsApp e retorna QR code para autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: ID único para identificar a sessão
 *                 example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: Sessão criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QrCodeResponse'
 *       400:
 *         description: Dados inválidos ou sessão já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/regenerate-qr:
 *   post:
 *     tags:
 *       - Sessões
 *     summary: Regenerar QR Code da sessão
 *     description: Regenera o QR code para uma sessão existente que não está conectada
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: QR Code regenerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QrCodeResponse'
 *       400:
 *         description: Sessão já conectada ou erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/status:
 *   get:
 *     tags:
 *       - Sessões
 *     summary: Obter status da sessão
 *     description: Retorna informações detalhadas sobre o status de uma sessão específica
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: Status da sessão obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessionId:
 *                   type: string
 *                   example: "minha-sessao-1"
 *                 isConnected:
 *                   type: boolean
 *                   example: true
 *                 connectionState:
 *                   type: string
 *                   example: "connected"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 connectedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 lastError:
 *                   type: string
 *                   nullable: true
 *                 user:
 *                   type: object
 *                   nullable: true
 *                 hasQrCode:
 *                   type: boolean
 *                 webhookUrl:
 *                   type: string
 *                   nullable: true
 *                 messageCount:
 *                   type: integer
 *                 queueLength:
 *                   type: integer
 *                 reconnectionAttempts:
 *                   type: integer
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     tags:
 *       - Sessões
 *     summary: Listar todas as sessões
 *     description: Retorna uma lista com todas as sessões ativas e seus status
 *     responses:
 *       200:
 *         description: Lista de sessões obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *                 total:
 *                   type: integer
 *                   example: 3
 */

/**
 * @swagger
 * /api/session/{sessionId}/send-message:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Enviar mensagem de texto
 *     description: Envia uma mensagem de texto para um número específico com comportamento humano simulado
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - message
 *             properties:
 *               to:
 *                 type: string
 *                 description: Número do destinatário (com ou sem @s.whatsapp.net)
 *                 example: "5511999999999"
 *               message:
 *                 type: string
 *                 description: Texto da mensagem
 *                 example: "Olá! Como você está?"
 *               quotedMessageId:
 *                 type: string
 *                 description: ID da mensagem a ser citada (opcional)
 *                 example: "3EB0C767B7CE45A3B3A36"
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Mensagem enviada com sucesso"
 *                 messageId:
 *                   type: string
 *                   example: "3EB0C767B7CE45A3B3A36"
 *                 messageData:
 *                   type: object
 *                   properties:
 *                     to:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                     messageType:
 *                       type: string
 *                       example: "text"
 *                     content:
 *                       type: string
 *                     quotedMessageId:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       example: "sent"
 *                 sessionInfo:
 *                   type: object
 *       400:
 *         description: Sessão não encontrada, não conectada ou dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/send-media:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Enviar mídia (imagem, vídeo, áudio, documento)
 *     description: Envia arquivos de mídia para um número específico
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - media
 *             properties:
 *               to:
 *                 type: string
 *                 description: Número do destinatário
 *                 example: "5511999999999"
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de mídia
 *               caption:
 *                 type: string
 *                 description: Legenda para a mídia (opcional)
 *                 example: "Confira esta imagem!"
 *               filename:
 *                 type: string
 *                 description: Nome personalizado do arquivo (opcional)
 *                 example: "minha-imagem.jpg"
 *     responses:
 *       200:
 *         description: Mídia enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Mídia enviada com sucesso"
 *                 messageId:
 *                   type: string
 *                 messageData:
 *                   type: object
 *                   properties:
 *                     to:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                     messageType:
 *                       type: string
 *                       enum: ["image", "video", "audio", "document"]
 *                     fileName:
 *                       type: string
 *                     fileSize:
 *                       type: integer
 *                     mimetype:
 *                       type: string
 *                     caption:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "sent"
 *       400:
 *         description: Dados inválidos ou arquivo não fornecido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/reply-message:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Responder uma mensagem específica
 *     description: Envia uma resposta citando uma mensagem específica pelo seu ID
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messageId
 *               - reply
 *             properties:
 *               messageId:
 *                 type: string
 *                 description: ID da mensagem a ser respondida
 *                 example: "3EB0C767B7CE45A3B3A36"
 *               reply:
 *                 type: string
 *                 description: Texto da resposta
 *                 example: "Obrigado pela mensagem!"
 *     responses:
 *       200:
 *         description: Resposta enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Resposta enviada com sucesso"
 *                 messageId:
 *                   type: string
 *                 quotedMessageId:
 *                   type: string
 *                 messageData:
 *                   type: object
 *                   properties:
 *                     isReply:
 *                       type: boolean
 *                       example: true
 *                     originalMessage:
 *                       type: object
 *       404:
 *         description: Mensagem original não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/smart-reply:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Resposta inteligente com comportamento humano avançado
 *     description: |
 *       Envia uma mensagem com simulação ultra-realista de comportamento humano, incluindo:
 *       - Tempo de leitura da mensagem anterior
 *       - Tempo de reflexão/pensamento baseado na complexidade
 *       - Digitação com pausas naturais em chunks
 *       - Simulação de correção de erros de digitação
 *       - Delays emocionais baseados no conteúdo
 *       - Tempos proporcionais ao tamanho da mensagem
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - message
 *             properties:
 *               to:
 *                 type: string
 *                 description: Número do destinatário
 *                 example: "5511999999999"
 *               message:
 *                 type: string
 *                 description: Texto da mensagem a ser enviada
 *                 example: "Esta é uma resposta com comportamento humano muito realista! Vou digitar como se fosse uma pessoa real."
 *               replyToMessage:
 *                 type: string
 *                 description: Texto da mensagem anterior (para calcular tempo de leitura)
 *                 example: "Você pode me ajudar com este problema complexo de matemática?"
 *               readingSpeed:
 *                 type: integer
 *                 default: 150
 *                 description: Velocidade de leitura em palavras por minuto (50-300)
 *                 example: 150
 *               typingSpeed:
 *                 type: integer
 *                 default: 40
 *                 description: Velocidade de digitação em palavras por minuto (20-80)
 *                 example: 40
 *               thinkingTime:
 *                 type: boolean
 *                 default: true
 *                 description: Simular tempo de reflexão antes de digitar
 *               naturalPauses:
 *                 type: boolean
 *                 default: true
 *                 description: Adicionar pausas naturais durante a digitação (chunks)
 *               typoSimulation:
 *                 type: boolean
 *                 default: false
 *                 description: Simular correção de erros de digitação (15% chance)
 *               emotionalDelay:
 *                 type: boolean
 *                 default: true
 *                 description: Delays extras para conteúdo emocional
 *               contextAwareness:
 *                 type: boolean
 *                 default: true
 *                 description: Considerar contexto da conversa para timing
 *               quotedMessageId:
 *                 type: string
 *                 description: ID da mensagem a ser citada (opcional)
 *                 example: "3EB0C767B7CE45A3B3A36"
 *     responses:
 *       200:
 *         description: Resposta inteligente enviada com comportamento humano avançado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Resposta inteligente enviada com comportamento humano avançado"
 *                 messageId:
 *                   type: string
 *                   example: "3EB0C767B7CE45A3B3A36"
 *                 behaviorStats:
 *                   type: object
 *                   description: Estatísticas detalhadas do comportamento simulado
 *                   properties:
 *                     readingTime:
 *                       type: integer
 *                       description: Tempo de leitura em millisegundos
 *                       example: 2400
 *                     thinkingTime:
 *                       type: integer
 *                       description: Tempo de reflexão em millisegundos
 *                       example: 3200
 *                     typingTime:
 *                       type: integer
 *                       description: Tempo total de digitação em millisegundos
 *                       example: 8500
 *                     totalTime:
 *                       type: integer
 *                       description: Tempo total do processo em millisegundos
 *                       example: 14100
 *                     wordCount:
 *                       type: integer
 *                       description: Número de palavras na mensagem
 *                       example: 15
 *                     messageLength:
 *                       type: integer
 *                       description: Número de caracteres na mensagem
 *                       example: 85
 *                     chunksUsed:
 *                       type: integer
 *                       description: Número de "rajadas" de digitação utilizadas
 *                       example: 3
 *                     typoSimulated:
 *                       type: boolean
 *                       description: Se foi simulada correção de erro
 *                       example: false
 *                 messageData:
 *                   type: object
 *                   properties:
 *                     to:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                     messageType:
 *                       type: string
 *                       example: "text"
 *                     content:
 *                       type: string
 *                     quotedMessageId:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       example: "sent"
 *                 sessionInfo:
 *                   type: object
 *       400:
 *         description: Dados inválidos ou sessão não conectada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/typing:
 *   post:
 *     tags:
 *       - Controles de Chat
 *     summary: Controlar status de digitação
 *     description: Ativa ou desativa o indicador de "digitando" para um chat específico
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jid
 *             properties:
 *               jid:
 *                 type: string
 *                 description: ID do chat (número@s.whatsapp.net)
 *                 example: "5511999999999@s.whatsapp.net"
 *               isTyping:
 *                 type: boolean
 *                 default: true
 *                 description: true para iniciar digitação, false para parar
 *     responses:
 *       200:
 *         description: Status de digitação atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Status de digitação iniciado"
 */

/**
 * @swagger
 * /api/session/{sessionId}/mark-read:
 *   post:
 *     tags:
 *       - Controles de Chat
 *     summary: Marcar mensagem como lida
 *     description: Marca uma mensagem específica como lida (visualizada)
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jid
 *               - messageId
 *             properties:
 *               jid:
 *                 type: string
 *                 description: ID do chat
 *                 example: "5511999999999@s.whatsapp.net"
 *               messageId:
 *                 type: string
 *                 description: ID da mensagem
 *                 example: "3EB0C767B7CE45A3B3A36"
 *     responses:
 *       200:
 *         description: Mensagem marcada como lida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Mensagem marcada como lida"
 */

/**
 * @swagger
 * /api/session/{sessionId}/messages:
 *   get:
 *     tags:
 *       - Histórico e Mídia
 *     summary: Listar mensagens armazenadas
 *     description: Retorna o histórico de mensagens armazenadas para uma sessão
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de mensagens a retornar
 *     responses:
 *       200:
 *         description: Lista de mensagens obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       messageId:
 *                         type: string
 *                       jid:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       isFromMe:
 *                         type: boolean
 *                       messageText:
 *                         type: string
 *                       isReply:
 *                         type: boolean
 *                       quotedMessage:
 *                         type: object
 *                         nullable: true
 *                 total:
 *                   type: integer
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/download-media:
 *   post:
 *     tags:
 *       - Histórico e Mídia
 *     summary: Baixar mídia de uma mensagem
 *     description: Baixa o arquivo de mídia de uma mensagem específica e salva no servidor
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messageId
 *             properties:
 *               messageId:
 *                 type: string
 *                 description: ID da mensagem que contém mídia
 *                 example: "3EB0C767B7CE45A3B3A36"
 *     responses:
 *       200:
 *         description: Mídia baixada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Mídia baixada com sucesso"
 *                 messageId:
 *                   type: string
 *                 downloadInfo:
 *                   type: object
 *                   properties:
 *                     fileName:
 *                       type: string
 *                     filePath:
 *                       type: string
 *                     fileSize:
 *                       type: integer
 *                     downloadedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Mensagem não contém mídia ou dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Mensagem não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}/webhook:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Configurar webhook para eventos
 *     description: |
 *       Configura uma URL de webhook para receber eventos em tempo real da sessão.
 *       
 *       **NOVO: Mídia em Base64**
 *       Os webhooks agora incluem automaticamente o conteúdo de arquivos de mídia em base64 para arquivos até 3MB:
 *       - Imagens (JPG, PNG, GIF, WebP)
 *       - Vídeos (MP4, MOV, AVI, etc.)
 *       - Áudios (MP3, WAV, OGG, etc.)
 *       - Documentos (PDF, DOC, etc.)
 *       - Stickers
 *       
 *       **Exemplo de payload recebido:**
 *       ```json
 *       {
 *         "sessionId": "minha-sessao-1",
 *         "eventType": "message.upsert",
 *         "timestamp": "2024-12-06T15:30:00.000Z",
 *         "data": {
 *           "messageId": "3EB0C767B7CE45A3B3A36",
 *           "messageType": "image",
 *           "content": "Confira esta foto!",
 *           "mediaData": {
 *             "mimetype": "image/jpeg",
 *             "fileLength": 524288,
 *             "width": 1920,
 *             "height": 1080
 *           },
 *           "mediaBase64": {
 *             "success": true,
 *             "base64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcU...",
 *             "size": 524288,
 *             "sizeFormatted": "512.00KB"
 *           },
 *           "chatInfo": {
 *             "type": "contact",
 *             "name": "João Silva",
 *             "number": "5511999999999"
 *           }
 *         }
 *       }
 *       ```
 *       
 *       **Para arquivos > 3MB:**
 *       ```json
 *       {
 *         "mediaBase64": {
 *           "error": "FILE_TOO_LARGE",
 *           "message": "Arquivo de 5.2MB excede o limite de 3MB",
 *           "fileSize": 5452595
 *         }
 *       }
 *       ```
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - webhookUrl
 *             properties:
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL do webhook para receber eventos
 *                 example: "https://meusite.com/webhook"
 *     responses:
 *       200:
 *         description: Webhook configurado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Webhook configurado com sucesso"
 *                 webhookUrl:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: URL inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Obter configuração do webhook
 *     description: Retorna a URL do webhook configurada para a sessão
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: Configuração do webhook obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 webhookUrl:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *       404:
 *         description: Sessão não encontrada ou webhook não configurado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   delete:
 *     tags:
 *       - Webhooks
 *     summary: Remover webhook
 *     description: Remove a configuração de webhook da sessão
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: Webhook removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Webhook removido com sucesso"
 *                 sessionId:
 *                   type: string
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/session/{sessionId}:
 *   delete:
 *     tags:
 *       - Sessões
 *     summary: Deletar sessão
 *     description: Remove uma sessão do WhatsApp e fecha todas as conexões associadas
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: Sessão deletada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Sessão deletada com sucesso"
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/info:
 *   get:
 *     tags:
 *       - Informações
 *     summary: Informações da API
 *     description: Retorna informações detalhadas sobre a API, features disponíveis e endpoints
 *     responses:
 *       200:
 *         description: Informações da API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "Baileys Multi-Session API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 description:
 *                   type: string
 *                 author:
 *                   type: string
 *                 features:
 *                   type: array
 *                   items:
 *                     type: string
 *                 activeSessions:
 *                   type: integer
 *                   description: Número de sessões ativas
 *                 endpoints:
 *                   type: object
 *                   description: Lista de todos os endpoints disponíveis
 */

/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - Informações
 *     summary: Página inicial
 *     description: Redireciona para a documentação Swagger
 *     responses:
 *       302:
 *         description: Redirecionamento para /api-docs
 */

// ========================================
// DOCUMENTAÇÃO DAS ROTAS DE GRUPOS
// ========================================

/**
 * @swagger
 * /api/groups/{sessionId}/create:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Criar novo grupo
 *     description: Cria um novo grupo do WhatsApp com os participantes especificados
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupName
 *               - participants
 *             properties:
 *               groupName:
 *                 type: string
 *                 description: Nome do grupo
 *                 example: "Meu Grupo Novo"
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de números dos participantes
 *                 example: ["5511999999999", "5511888888888"]
 *               description:
 *                 type: string
 *                 description: Descrição do grupo (opcional)
 *                 example: "Grupo para discussões importantes"
 *     responses:
 *       200:
 *         description: Grupo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Grupo criado com sucesso"
 *                 groupInfo:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "120363043716731234@g.us"
 *                     subject:
 *                       type: string
 *                       example: "Meu Grupo Novo"
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["5511999999999@s.whatsapp.net"]
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/info:
 *   get:
 *     tags:
 *       - Grupos
 *     summary: Obter informações do grupo
 *     description: Retorna informações detalhadas sobre um grupo específico
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     responses:
 *       200:
 *         description: Informações do grupo obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 groupInfo:
 *                   $ref: '#/components/schemas/Group'
 *       404:
 *         description: Sessão ou grupo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/add-participants:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Adicionar participantes ao grupo
 *     description: Adiciona novos participantes a um grupo existente
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participants
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de números dos participantes a adicionar
 *                 example: ["5511999999999", "5511888888888"]
 *     responses:
 *       200:
 *         description: Participantes adicionados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Participantes adicionados com sucesso"
 *                 results:
 *                   type: array
 *                   description: Resultados da operação para cada participante
 *                 addedParticipants:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/remove-participants:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Remover participantes do grupo
 *     description: Remove participantes de um grupo existente
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participants
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de números dos participantes a remover
 *                 example: ["5511999999999", "5511888888888"]
 *     responses:
 *       200:
 *         description: Participantes removidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Participantes removidos com sucesso"
 *                 results:
 *                   type: array
 *                   description: Resultados da operação para cada participante
 *                 removedParticipants:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/promote:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Promover participantes a admin
 *     description: Promove participantes do grupo para administradores
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participants
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de números dos participantes a promover
 *                 example: ["5511999999999", "5511888888888"]
 *     responses:
 *       200:
 *         description: Participantes promovidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Participantes promovidos a admin com sucesso"
 *                 results:
 *                   type: array
 *                   description: Resultados da operação para cada participante
 *                 promotedParticipants:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/demote:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Despromover admins
 *     description: Remove privilégios de administrador de participantes do grupo
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participants
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de números dos participantes a despromover
 *                 example: ["5511999999999", "5511888888888"]
 *     responses:
 *       200:
 *         description: Admins despromovidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Admins despromovidos com sucesso"
 *                 results:
 *                   type: array
 *                   description: Resultados da operação para cada participante
 *                 demotedParticipants:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/subject:
 *   put:
 *     tags:
 *       - Grupos
 *     summary: Atualizar nome do grupo
 *     description: Altera o nome/assunto do grupo
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Novo nome do grupo
 *                 example: "Novo Nome do Grupo"
 *     responses:
 *       200:
 *         description: Nome do grupo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Nome do grupo atualizado com sucesso"
 *                 newSubject:
 *                   type: string
 *                   example: "Novo Nome do Grupo"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/description:
 *   put:
 *     tags:
 *       - Grupos
 *     summary: Atualizar descrição do grupo
 *     description: Altera a descrição do grupo
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Nova descrição do grupo (deixe vazio para remover)
 *                 example: "Nova descrição do grupo"
 *     responses:
 *       200:
 *         description: Descrição do grupo atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Descrição do grupo atualizada com sucesso"
 *                 newDescription:
 *                   type: string
 *                   nullable: true
 *                   example: "Nova descrição do grupo"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/settings:
 *   put:
 *     tags:
 *       - Grupos
 *     summary: Configurar permissões do grupo
 *     description: Configura quem pode enviar mensagens e editar informações do grupo
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               onlyAdminsCanSend:
 *                 type: boolean
 *                 description: Se apenas admins podem enviar mensagens
 *                 example: true
 *               onlyAdminsCanEditInfo:
 *                 type: boolean
 *                 description: Se apenas admins podem editar informações do grupo
 *                 example: true
 *     responses:
 *       200:
 *         description: Configurações do grupo atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Configurações do grupo atualizadas com sucesso"
 *                 settings:
 *                   type: object
 *                   properties:
 *                     onlyAdminsCanSend:
 *                       type: boolean
 *                     onlyAdminsCanEditInfo:
 *                       type: boolean
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/leave:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Sair do grupo
 *     description: Remove a sessão atual do grupo especificado
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     responses:
 *       200:
 *         description: Saiu do grupo com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Saiu do grupo com sucesso"
 *       400:
 *         description: Erro ao sair do grupo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/list:
 *   get:
 *     tags:
 *       - Grupos
 *     summary: Listar grupos
 *     description: Retorna uma lista de todos os grupos da sessão
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: Lista de grupos obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 groups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "120363043716731234@g.us"
 *                       name:
 *                         type: string
 *                         example: "Meu Grupo"
 *                       unreadCount:
 *                         type: integer
 *                         example: 0
 *                       lastMessageTime:
 *                         type: integer
 *                         description: Timestamp da última mensagem
 *                       participants:
 *                         type: integer
 *                         description: Número de participantes
 *                 total:
 *                   type: integer
 *                   example: 5
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/invite-code:
 *   get:
 *     tags:
 *       - Grupos
 *     summary: Obter código de convite do grupo
 *     description: Retorna o código de convite do grupo para compartilhar
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     responses:
 *       200:
 *         description: Código de convite obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 inviteCode:
 *                   type: string
 *                   example: "ABCDEFGHIJKLMNOPqrstuvwxyz123456"
 *                 inviteLink:
 *                   type: string
 *                   example: "https://chat.whatsapp.com/ABCDEFGHIJKLMNOPqrstuvwxyz123456"
 *       400:
 *         description: Erro ao obter código de convite
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/groups/{sessionId}/{groupId}/revoke-invite:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Revogar código de convite do grupo
 *     description: Revoga o código de convite atual do grupo e gera um novo
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo
 *         example: "120363043716731234@g.us"
 *     responses:
 *       200:
 *         description: Código de convite revogado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Código de convite revogado com sucesso"
 *                 newInviteCode:
 *                   type: string
 *                   example: "ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvu"
 *                 newInviteLink:
 *                   type: string
 *                   example: "https://chat.whatsapp.com/ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvu"
 *       400:
 *         description: Erro ao revogar código de convite
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

module.exports = {
  swaggerSpec,
  swaggerUiOptions
};