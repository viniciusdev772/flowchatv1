const swaggerJsdoc = require('swagger-jsdoc');

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlowChat API',
      version: '1.0.0',
      description:
        'FlowChat API - Fluxo inteligente de mensagens WhatsApp com multi-sessões, webhooks avançados e automação segura',
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
      {
        name: 'AI Assistant',
        description: 'Assistente de IA especializada no FlowChat API',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Token',
          description:
            'Token de API do usuário. Use o formato: Bearer baileys_xxxxx',
        },
      },
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
              example: 'data:image/png;base64,iVBORw0K_exemplo',
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
              enum: ['text', 'image', 'document', 'audio', 'voice'],
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
      theme: 'agate',
    },
    onComplete: function () {
      // Trigger da renderização de imagens após carregar
      setTimeout(function () {
        const event = new Event('DOMContentLoaded');
        window.dispatchEvent(event);
      }, 500);
    },
  },
};

// ========================================
// DOCUMENTAÇÃO DAS ROTAS DA API
// ========================================

/**
 * @swagger
 * /api/baileys/session/create:
 *   post:
 *     tags:
 *       - Sessões
 *     summary: Criar nova sessão do WhatsApp
 *     description: Cria uma nova sessão do WhatsApp e retorna QR code para autenticação
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/regenerate-qr:
 *   post:
 *     tags:
 *       - Sessões
 *     summary: Regenerar QR Code da sessão
 *     description: Regenera o QR code para uma sessão existente que não está conectada
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/status:
 *   get:
 *     tags:
 *       - Sessões
 *     summary: Obter status da sessão
 *     description: Retorna informações detalhadas sobre o status de uma sessão específica
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/sessions:
 *   get:
 *     tags:
 *       - Sessões
 *     summary: Listar todas as sessões
 *     description: Retorna uma lista com todas as sessões ativas e seus status
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/sessions/cleanup-orphaned:
 *   post:
 *     tags:
 *       - Sessões
 *     summary: Limpar sessões órfãs
 *     description: Remove sessões que não estão associadas a nenhum usuário (userId null)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Limpeza de sessões órfãs concluída
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
 *                   example: "Limpeza de sessões órfãs concluída"
 *       401:
 *         description: Usuário não autenticado
 *       500:
 *         description: Erro interno do servidor
 */

/**
 * @swagger
 * /api/baileys/session/{sessionId}/send-message:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Enviar mensagem de texto
 *     description: Envia uma mensagem de texto para um número específico com comportamento humano simulado
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/send-media:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Enviar mídia (imagem, vídeo, áudio, documento, mensagem de voz)
 *     description: |
 *       Envia arquivos de mídia para um número específico, incluindo suporte para mensagens de voz.
 *
 *       **NOVO: Status "Gravando Áudio"**
 *       - Quando `voiceMessage=true` é enviado, o bot automaticamente mostra o status "gravando áudio..." no chat
 *       - Simula tempo de gravação realista (3-7 segundos) antes de enviar
 *       - Remove o status corretamente após enviar (sem mostrar "digitando")
 *       - Funciona apenas com arquivos de áudio (.mp3, .wav, .ogg, .m4a)
 *
 *       **NOVO: Caption para Mensagens de Voz**
 *       - Se `caption` for fornecida junto com `voiceMessage=true`, a legenda será enviada como uma **resposta à mensagem de voz**
 *       - Isso permite adicionar contexto às mensagens de voz mantendo a funcionalidade nativa do WhatsApp
 *       - A resposta é enviada automaticamente após a mensagem de voz
 *     security:
 *       - ApiKeyAuth: []
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
 *                 description: |
 *                   Legenda para a mídia (opcional).
 *
 *                   **Para mensagens de voz (`voiceMessage=true`):**
 *                   - A legenda será enviada como **resposta à mensagem de voz**
 *                   - Permite adicionar contexto sem quebrar a funcionalidade nativa
 *                 example: "Confira esta imagem!"
 *               filename:
 *                 type: string
 *                 description: Nome personalizado do arquivo (opcional)
 *                 example: "minha-imagem.jpg"
 *               voiceMessage:
 *                 type: boolean
 *                 description: |
 *                   Se true, áudios serão enviados como mensagem de voz (PTT).
 *
 *                   **Comportamento adicional:**
 *                   - Ativa automaticamente o status "gravando áudio..." no chat
 *                   - Simula tempo de gravação realista (3-7 segundos)
 *                   - Remove status corretamente após envio (sem "digitando")
 *                 example: true
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
 *                       enum: ["image", "video", "audio", "voice", "document"]
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
 *                     presenceUpdated:
 *                       type: boolean
 *                       description: Indica se o status "gravando" foi enviado (apenas para voice messages)
 *                       example: true
 *                     captionSentAsReply:
 *                       type: boolean
 *                       description: Indica se a caption foi enviada como resposta à mensagem de voz
 *                       example: true
 *                     captionMessageId:
 *                       type: string
 *                       description: ID da mensagem de caption (quando enviada como resposta)
 *                       nullable: true
 *                       example: "3EB0C767B7CE45A3B3A37"
 *       400:
 *         description: Dados inválidos ou arquivo não fornecido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/baileys/session/{sessionId}/reply-message:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Responder uma mensagem específica
 *     description: Envia uma resposta citando uma mensagem específica pelo seu ID
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/mention-all:
 *   post:
 *     tags:
 *       - Mensagens
 *     summary: Mencionar todos os participantes do grupo
 *     description: |
 *       Envia uma mensagem para um grupo mencionando todos os participantes.
 *
 *       **Modos disponíveis:**
 *       - **Modo Silencioso (`silentMode=true`)**: Usa caracteres invisíveis (U+200B, U+2800, U+200D) para mencionar sem @ azuis
 *       - **Modo Com Menções (`silentMode=false`)**: Envia com @ azul visível para cada participante
 *
 *       **Funcionalidade:**
 *       - Obtém automaticamente todos os participantes do grupo via `groupMetadata`
 *       - Suporte para IDs de grupo com ou sem sufixo `@g.us`
 *       - Verifica se o bot faz parte do grupo antes de enviar
 *       - Retorna informações detalhadas sobre o grupo e participantes
 *     security:
 *       - ApiKeyAuth: []
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
 *               - groupId
 *               - message
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: ID do grupo (com ou sem @g.us)
 *                 example: "120363043716731234@g.us"
 *               message:
 *                 type: string
 *                 description: Mensagem a ser enviada para todos
 *                 example: "Importante! Todos devem ler esta mensagem."
 *               silentMode:
 *                 type: boolean
 *                 default: true
 *                 description: |
 *                   **true**: Usa caracteres invisíveis (Zero Width Space) para mencionar sem @ azuis
 *                   **false**: Menciona visivelmente cada participante (@ azul + notificação)
 *
 *                   **Técnica de caracteres invisíveis:**
 *                   - U+200B (Zero Width Space): Caractere invisível entre palavras
 *                   - U+2800 (Braille Pattern): Compatível com WhatsApp mobile
 *                   - U+200D (Zero Width Joiner): Conecta caracteres invisibilmente
 *
 *                   **Resultado:** Todos são mencionados mas sem @ azuis visíveis
 *                 example: true
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso para o grupo
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
 *                   example: "Mensagem enviada para o grupo (modo silencioso)"
 *                 messageId:
 *                   type: string
 *                   example: "3EB0C767B7CE45A3B3A36"
 *                 groupInfo:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "120363043716731234@g.us"
 *                     name:
 *                       type: string
 *                       example: "Meu Grupo de Trabalho"
 *                     participantCount:
 *                       type: integer
 *                       example: 15
 *                     silentMode:
 *                       type: boolean
 *                       example: true
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
 *                     participantsReached:
 *                       type: integer
 *                       description: Total de participantes que receberam a mensagem
 *                       example: 1022
 *                     participantsMentioned:
 *                       type: integer
 *                       description: Número total de participantes mencionados (sempre igual ao total)
 *                       example: 1022
 *                     mentionType:
 *                       type: string
 *                       enum: ["invisible_mentions", "visible_mentions"]
 *                       description: Tipo de menção utilizada
 *                       example: "invisible_mentions"
 *                     invisibleCharacters:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Caracteres Unicode invisíveis utilizados (apenas modo silencioso)
 *                       example: ["U+200B", "U+2800", "U+200D"]
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       example: "sent"
 *                 sessionInfo:
 *                   type: object
 *       400:
 *         description: Dados inválidos ou grupo não acessível
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Grupo não encontrado ou sem participantes
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
 * /api/baileys/session/{sessionId}/smart-reply:
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
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/typing:
 *   post:
 *     tags:
 *       - Controles de Chat
 *     summary: Controlar status de digitação
 *     description: Ativa ou desativa o indicador de "digitando" para um chat específico
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/mark-read:
 *   post:
 *     tags:
 *       - Controles de Chat
 *     summary: Marcar mensagem como lida
 *     description: Marca uma mensagem específica como lida (visualizada)
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/messages:
 *   get:
 *     tags:
 *       - Histórico e Mídia
 *     summary: Listar mensagens armazenadas
 *     description: Retorna o histórico de mensagens armazenadas para uma sessão
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/download-media:
 *   post:
 *     tags:
 *       - Histórico e Mídia
 *     summary: Baixar mídia de uma mensagem
 *     description: Baixa o arquivo de mídia de uma mensagem específica e salva no servidor
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/session/{sessionId}/webhook:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: "Configurar webhook para eventos"
 *     description: |
 *       Configura uma URL de webhook para receber eventos em tempo real da sessão.
 *
 *       **Armazenamento:** Este endpoint salva webhooks no banco de dados MongoDB.
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
 *     security:
 *       - ApiKeyAuth: []
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
 *     summary: "Obter configuração do webhook"
 *     description: |
 *       Retorna a URL do webhook configurada para a sessão.
 *
 *       **Armazenamento:** Busca webhook no banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
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
 *     summary: "Remover webhook"
 *     description: |
 *       Remove a configuração de webhook da sessão.
 *
 *       **Armazenamento:** Remove webhook do banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
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

// ========================================
// DOCUMENTAÇÃO DOS NOVOS ENDPOINTS DE WEBHOOKS (MÚLTIPLOS)
// ========================================

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: "Listar webhooks da sessão"
 *     description: |
 *       Retorna todos os webhooks configurados para uma sessão (máximo 3).
 *
 *       **Armazenamento:** Busca webhooks no banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
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
 *         description: Lista de webhooks obtida com sucesso
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
 *                 webhooks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "webhook-123-456"
 *                       name:
 *                         type: string
 *                         example: "Principal"
 *                       url:
 *                         type: string
 *                         example: "https://meusite.com/webhook"
 *                       active:
 *                         type: boolean
 *                         example: true
 *                       priority:
 *                         type: integer
 *                         example: 1
 *                       events:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["*"]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                   example: 2
 *                 limit:
 *                   type: integer
 *                   example: 3
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: "Adicionar novo webhook"
 *     description: |
 *       Adiciona um novo webhook à sessão (máximo 3 por sessão).
 *
 *       **Armazenamento:** Salva webhook no banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
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
 *               - url
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do webhook
 *                 example: "Principal"
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL do webhook
 *                 example: "https://meusite.com/webhook"
 *               active:
 *                 type: boolean
 *                 description: Se o webhook está ativo
 *                 default: true
 *               priority:
 *                 type: integer
 *                 description: Prioridade de envio (1-3)
 *                 minimum: 1
 *                 maximum: 3
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Eventos para escutar
 *                 example: ["message.upsert", "connection.update"]
 *                 default: ["*"]
 *     responses:
 *       200:
 *         description: Webhook adicionado com sucesso
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
 *                   example: "Webhook adicionado com sucesso"
 *                 webhook:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "webhook-123-456"
 *                     name:
 *                       type: string
 *                       example: "Principal"
 *                     url:
 *                       type: string
 *                       example: "https://meusite.com/webhook"
 *                     active:
 *                       type: boolean
 *                       example: true
 *                     priority:
 *                       type: integer
 *                       example: 1
 *                     events:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["*"]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 sessionId:
 *                   type: string
 *                   example: "minha-sessao-1"
 *       400:
 *         description: Dados inválidos ou limite de webhooks excedido
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
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: "Obter webhook específico"
 *     description: |
 *       Retorna informações de um webhook específico.
 *
 *       **Armazenamento:** Busca webhook no banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do webhook
 *         example: "webhook-123-456"
 *     responses:
 *       200:
 *         description: Webhook encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 webhook:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "webhook-123-456"
 *                     name:
 *                       type: string
 *                       example: "Principal"
 *                     url:
 *                       type: string
 *                       example: "https://meusite.com/webhook"
 *                     active:
 *                       type: boolean
 *                       example: true
 *                     priority:
 *                       type: integer
 *                       example: 1
 *                     events:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["*"]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 sessionId:
 *                   type: string
 *                   example: "minha-sessao-1"
 *       404:
 *         description: Sessão ou webhook não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   put:
 *     tags:
 *       - Webhooks
 *     summary: "Atualizar webhook"
 *     description: |
 *       Atualiza as configurações de um webhook específico.
 *
 *       **Armazenamento:** Atualiza webhook no banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do webhook
 *         example: "webhook-123-456"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do webhook
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL do webhook
 *               active:
 *                 type: boolean
 *                 description: Se o webhook está ativo
 *               priority:
 *                 type: integer
 *                 description: Prioridade de envio (1-3)
 *                 minimum: 1
 *                 maximum: 3
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Eventos para escutar
 *     responses:
 *       200:
 *         description: Webhook atualizado com sucesso
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
 *                   example: "Webhook atualizado com sucesso"
 *                 webhook:
 *                   type: object
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Sessão ou webhook não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   delete:
 *     tags:
 *       - Webhooks
 *     summary: "Remover webhook específico"
 *     description: |
 *       Remove um webhook específico da sessão.
 *
 *       **Armazenamento:** Remove webhook do banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do webhook
 *         example: "webhook-123-456"
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
 *                 webhook:
 *                   type: object
 *                 sessionId:
 *                   type: string
 *       404:
 *         description: Sessão ou webhook não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}/toggle:
 *   patch:
 *     tags:
 *       - Webhooks
 *     summary: "Ativar/desativar webhook"
 *     description: |
 *       Alterna o status ativo/inativo de um webhook.
 *
 *       **Armazenamento:** Atualiza webhook no banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do webhook
 *         example: "webhook-123-456"
 *     responses:
 *       200:
 *         description: Status do webhook alterado
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
 *                   example: "Webhook ativado com sucesso"
 *                 webhook:
 *                   type: object
 *                 sessionId:
 *                   type: string
 *       404:
 *         description: Sessão ou webhook não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/baileys/session/{sessionId}/webhooks/{webhookId}/test:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: "Testar webhook"
 *     description: |
 *       Envia um payload de teste para verificar se o webhook está funcionando.
 *
 *       **Armazenamento:** Busca webhook no banco de dados MongoDB.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *         example: "minha-sessao-1"
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do webhook
 *         example: "webhook-123-456"
 *     responses:
 *       200:
 *         description: Teste do webhook executado
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
 *                   example: "Teste do webhook enviado"
 *                 webhook:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     url:
 *                       type: string
 *                 testResult:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     status:
 *                       type: integer
 *                       example: 200
 *                     statusText:
 *                       type: string
 *                       example: "OK"
 *                     response:
 *                       type: string
 *                       description: Resposta do webhook (limitada a 500 caracteres)
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Sessão ou webhook não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/baileys/session/{sessionId}:
 *   delete:
 *     tags:
 *       - Sessões
 *     summary: Deletar sessão
 *     description: Remove uma sessão do WhatsApp e fecha todas as conexões associadas
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/info:
 *   get:
 *     tags:
 *       - Informações
 *     summary: Informações da API
 *     description: Retorna informações detalhadas sobre a API, features disponíveis e endpoints
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/create:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Criar novo grupo
 *     description: Cria um novo grupo do WhatsApp com os participantes especificados
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/info:
 *   get:
 *     tags:
 *       - Grupos
 *     summary: Obter informações do grupo
 *     description: Retorna informações detalhadas sobre um grupo específico
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/add-participants:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Adicionar participantes ao grupo
 *     description: Adiciona novos participantes a um grupo existente
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/remove-participants:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Remover participantes do grupo
 *     description: Remove participantes de um grupo existente
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/promote:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Promover participantes a admin
 *     description: Promove participantes do grupo para administradores
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/demote:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Despromover admins
 *     description: Remove privilégios de administrador de participantes do grupo
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/subject:
 *   put:
 *     tags:
 *       - Grupos
 *     summary: Atualizar nome do grupo
 *     description: Altera o nome/assunto do grupo
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/description:
 *   put:
 *     tags:
 *       - Grupos
 *     summary: Atualizar descrição do grupo
 *     description: Altera a descrição do grupo
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/settings:
 *   put:
 *     tags:
 *       - Grupos
 *     summary: Configurar permissões do grupo
 *     description: Configura quem pode enviar mensagens e editar informações do grupo
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/leave:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Sair do grupo
 *     description: Remove a sessão atual do grupo especificado
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/list:
 *   get:
 *     tags:
 *       - Grupos
 *     summary: Listar grupos
 *     description: Retorna uma lista de todos os grupos da sessão
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/invite-code:
 *   get:
 *     tags:
 *       - Grupos
 *     summary: Obter código de convite do grupo
 *     description: Retorna o código de convite do grupo para compartilhar
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/baileys/groups/{sessionId}/{groupId}/revoke-invite:
 *   post:
 *     tags:
 *       - Grupos
 *     summary: Revogar código de convite do grupo
 *     description: Revoga o código de convite atual do grupo e gera um novo
 *     security:
 *       - ApiKeyAuth: []
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

/**
 * @swagger
 * /api/baileys/download/{downloadId}:
 *   get:
 *     tags:
 *       - Downloads
 *     summary: Baixar arquivo por ID
 *     description: Baixa um arquivo previamente processado usando seu ID único (acesso público sem autenticação)
 *     parameters:
 *       - in: path
 *         name: downloadId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único do download
 *         example: "download_1234567890abcdef"
 *     responses:
 *       200:
 *         description: Arquivo baixado com sucesso
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *           audio/*:
 *             schema:
 *               type: string
 *               format: binary
 *           video/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Arquivo não encontrado ou link expirado
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Arquivo não encontrado ou link expirado"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/baileys/downloads:
 *   get:
 *     tags:
 *       - Downloads
 *     summary: Listar downloads disponíveis
 *     description: Lista todos os downloads disponíveis com informações detalhadas
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: false
 *         schema:
 *           type: string
 *         description: ID da sessão para filtrar downloads
 *         example: "minha-sessao-1"
 *     responses:
 *       200:
 *         description: Lista de downloads obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 downloads:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       downloadId:
 *                         type: string
 *                         example: "download_1234567890abcdef"
 *                       fileName:
 *                         type: string
 *                         example: "imagem.jpg"
 *                       size:
 *                         type: number
 *                         example: 1024
 *                       sizeFormatted:
 *                         type: string
 *                         example: "1.00KB"
 *                       mimetype:
 *                         type: string
 *                         example: "image/jpeg"
 *                       messageType:
 *                         type: string
 *                         example: "imageMessage"
 *                       isPtt:
 *                         type: boolean
 *                         example: false
 *                       sessionId:
 *                         type: string
 *                         example: "minha-sessao-1"
 *                       messageId:
 *                         type: string
 *                         example: "msg_id_123"
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-12-01T10:00:00Z"
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-12-08T10:00:00Z"
 *                       isExpired:
 *                         type: boolean
 *                         example: false
 *                       downloadUrl:
 *                         type: string
 *                         example: "http://localhost:3000/api/baileys/download/download_1234567890abcdef"
 *                 total:
 *                   type: number
 *                   example: 1
 *                 sessionId:
 *                   type: string
 *                   nullable: true
 *                   example: "minha-sessao-1"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

module.exports = {
  swaggerSpec,
  swaggerUiOptions,
};
