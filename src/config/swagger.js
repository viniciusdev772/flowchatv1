const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');


/**
 * @type {import('swagger-jsdoc').Options}
 * @description Configuration options for swagger-jsdoc.
 * Defines the OpenAPI specification for the API.
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlowChat API',
      version: '1.0.0',
      description:
        'FlowChat API - An intelligent WhatsApp messaging flow with multi-sessions, advanced webhooks, and secure automation.',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    tags: [
      {
        name: 'Sessions',
        description: 'WhatsApp session management',
      },
      {
        name: 'Messages',
        description: 'Sending and controlling messages',
      },
      {
        name: 'Contacts',
        description: 'WhatsApp contact management',
      },
      {
        name: 'Groups',
        description: 'WhatsApp group management',
      },
      {
        name: 'Information',
        description: 'API information and documentation',
      },
      {
        name: 'AI Assistant',
        description: 'AI assistant specialized in the FlowChat API',
      },
    ],
    components: {
      securitySchemes: {
        ApiTokenAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Token',
          description:
            'User API token. Use the format: Bearer baileys_xxxxx',
        },
      },
      schemas: {
        Session: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Unique session ID',
            },
            isConnected: {
              type: 'boolean',
              description: 'Session connection status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Session creation date',
            },
            user: {
              type: 'object',
              description: 'Information about the connected user',
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the operation was successful',
            },
            message: {
              type: 'string',
              description: 'Descriptive message of the operation',
            },
            data: {
              type: 'object',
              description: 'Data returned by the operation',
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
              example: 'Session created successfully',
            },
            qrCode: {
              type: 'string',
              description: 'QR code for authentication (text)',
            },
            qrCodeImage: {
              type: 'string',
              format: 'uri',
              description: 'QR code as a base64 image (data URL)',
              example: 'data:image/png;base64,iVBORw0K_example',
              'x-display-name': 'QR Code Image',
            },
            sessionId: {
              type: 'string',
              example: 'my-session-1',
            },
          },
        },
        Message: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: "Recipient's number",
            },
            text: {
              type: 'string',
              description: 'Message text',
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'document', 'audio', 'voice'],
              description: 'Message type',
            },
          },
        },
        Group: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique group ID',
            },
            subject: {
              type: 'string',
              description: 'Group name/subject',
            },
            description: {
              type: 'string',
              description: 'Group description',
              nullable: true,
            },
            owner: {
              type: 'string',
              description: "Group creator's ID",
            },
            creation: {
              type: 'integer',
              description: 'Group creation timestamp',
            },
            size: {
              type: 'integer',
              description: 'Number of participants',
            },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: "Participant's ID",
                  },
                  isAdmin: {
                    type: 'boolean',
                    description: 'If the participant is an admin',
                  },
                  isSuperAdmin: {
                    type: 'boolean',
                    description: 'If the participant is a super admin',
                  },
                },
              },
            },
            settings: {
              type: 'object',
              properties: {
                announce: {
                  type: 'boolean',
                  description: 'If only admins can send messages',
                },
                restrict: {
                  type: 'boolean',
                  description: 'If only admins can edit information',
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/config/swagger.js', './src/api/*.js'],
};

/**
 * @type {object}
 * @description The generated Swagger specification.
 */
const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Generates the openapi.json file.
 * @returns {string} - The path to the generated file.
 * @throws {Error} - If there is an error generating the file.
 */
const generateOpenAPIFile = () => {
  try {
    const outputPath = path.join(__dirname, '../../openapi.json');
    fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
    console.log(`✅ OpenAPI file generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Error generating OpenAPI file:', error.message);
    throw error;
  }
};

/**
 * @type {import('swagger-ui-express').SwaggerUiOptions}
 * @description Configuration options for Swagger UI.
 */
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
    window.addEventListener('DOMContentLoaded', function() {
      let observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const elements = document.querySelectorAll('.highlight-code, .microlight, .response-col_description');
            elements.forEach(function(element) {
              const content = element.textContent || element.innerText;
              if (content && content.includes('data:image/')) {
                const base64Regex = /"(data:image\\/[^"]+)"/g;
                let match;
                let hasImages = false;
                while ((match = base64Regex.exec(content)) !== null) {
                  const base64Data = match[1];
                  const existingImg = element.querySelector('img[src="' + base64Data + '"]');
                  if (!existingImg) {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'base64-image-container';
                    imgContainer.style.margin = '10px 0';
                    const indicator = document.createElement('div');
                    indicator.className = 'base64-indicator';
                    indicator.textContent = '🖼️ QR Code Image (Base64 rendered):';
                    const img = document.createElement('img');
                    img.src = base64Data;
                    img.className = 'qr-code-image';
                    img.alt = 'QR Code';
                    img.title = 'QR Code generated by the API';
                    img.onerror = function() {
                      indicator.textContent = '❌ Error rendering base64 image';
                      indicator.style.color = '#d32f2f';
                    };
                    img.onload = function() {
                      indicator.textContent = '✅ QR Code Image (Base64 rendered):';
                      indicator.style.color = '#2e7d32';
                    };
                    imgContainer.appendChild(indicator);
                    imgContainer.appendChild(img);
                    element.parentNode.insertBefore(imgContainer, element.nextSibling);
                    hasImages = true;
                  }
                }
              }
            });
          }
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
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
      setTimeout(function () {
        const event = new Event('DOMContentLoaded');
        window.dispatchEvent(event);
      }, 500);
    },
  },
};

module.exports = {
  swaggerSpec,
  swaggerUiOptions,
  generateOpenAPIFile,
};
