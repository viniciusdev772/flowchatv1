# FlowChat API - Documentação Completa de Recursos

## Sumário Executivo

FlowChat API é uma solução avançada para automação WhatsApp com arquitetura multi-sessão, sistema de webhooks inteligente, AI Assistant integrado e interface frontend React 19 moderna. Este sistema oferece mais de 50 endpoints organizados em APIs especializadas com recursos avançados de IA, coleta de mensagens e análise inteligente.

---

## 1. ARQUITETURA GERAL DO SISTEMA

### 1.1 Visão Geral da Arquitetura
- **Backend**: Node.js + Express.js com arquitetura classe-based
- **WhatsApp Integration**: Baileys v6.7.18 para conexões WhatsApp
- **Frontend**: React 19 + Vite com design Apple Liquid Glass
- **Banco de Dados**: MongoDB com fallback gracioso para desenvolvimento
- **Autenticação**: Sistema dual (sessões de usuário + tokens API)
- **Segurança**: Middleware em camadas (CSRF, Helmet, CORS)

### 1.2 Estrutura de Diretórios
```
/
├── main.js                 # Entrada do servidor classe-based
├── src/
│   ├── app.js             # Core Baileys WhatsApp logic
│   ├── config/            # Database e Swagger
│   ├── middleware/        # Auth, CSRF, Security
│   ├── routes/            # Rotas de gerenciamento
│   ├── api/               # APIs especializadas
│   ├── controllers/       # Business logic
│   └── ai/                # Ferramentas e integração IA
├── frontend/              # React 19 application
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── pages/         # Páginas principais
│   │   └── App.jsx        # Router principal
│   └── dist/              # Build de produção
├── uploads/               # Uploads de arquivos
├── downloads/             # Cache de downloads de mídia
└── auth_sessions/         # Persistência de autenticação WhatsApp
```

### 1.3 Ports e Configuração
- **Backend**: Porta 3000 (configurável via PORT)
- **Frontend**: Porta 5173 (Vite dev server)
- **CORS**: http://localhost:5173 por padrão
- **Documentação**: `/api-docs` (Swagger UI)

---

## 2. APIS E ENDPOINTS

### 2.1 Management API (`/api/management/*`)

#### 2.1.1 Authentication (`/api/management/auth/*`)
- **POST** `/register` - Registro de usuário
- **POST** `/login` - Login do usuário
- **GET** `/profile` - Perfil do usuário (com cache 5min)
- **PUT** `/profile` - Atualizar perfil
- **POST** `/change-password` - Alterar senha

#### 2.1.2 Token Management (`/api/management/tokens/*`)
- **POST** `/generate` - Gerar token API
- **GET** `/list` - Listar tokens do usuário
- **DELETE** `/:tokenId` - Revogar token
- **PUT** `/:tokenId` - Atualizar token

#### 2.1.3 Session Management (`/api/management/sessions/*`)
- **POST** `/create-with-token` - Criar sessão com token
- **GET** `/list` - Listar sessões do usuário

#### 2.1.4 Media Management (`/api/management/media/*`)
- **GET** `/sessions` - Listar sessões com mídia
- **GET** `/session/:sessionId` - Mídia de sessão específica
- **GET** `/download/:sessionId/:filename` - Download de arquivo
- **GET** `/preview/:sessionId/:filename` - Preview de arquivo

#### 2.1.5 AI Assistant (`/api/management/ai/*`)
- **POST** `/chat` - Chat streaming com IA
- **GET** `/tools` - Listar ferramentas disponíveis
- **GET** `/health` - Status da IA

#### 2.1.6 Message Collector (`/api/management/message-collector/*`)
- **POST** `/start` - Iniciar coleta de mensagens
- **POST** `/stop` - Parar coleta
- **GET** `/list` - Listar coletores
- **GET** `/messages/:collectorId` - Mensagens coletadas

#### 2.1.7 AI Summary (`/api/management/ai-summary/*`)
- **POST** `/summarize` - Criar resumo IA
- **GET** `/list` - Listar resumos
- **GET** `/:summaryId` - Obter resumo específico
- **DELETE** `/:summaryId` - Deletar resumo
- **POST** `/analyze-sentiment` - Análise de sentimento

### 2.2 Baileys API (`/api/baileys/*`)

#### 2.2.1 Session Management
- **POST** `/session/create` - Criar sessão WhatsApp
- **GET** `/session/qr/:sessionId` - Obter QR Code
- **DELETE** `/session/delete/:sessionId` - Deletar sessão
- **GET** `/session/status/:sessionId` - Status da sessão
- **GET** `/session/info/:sessionId` - Informações da sessão
- **GET** `/sessions/list` - Listar todas as sessões

#### 2.2.2 Message Operations
- **POST** `/message/send` - Enviar mensagem
- **POST** `/message/send-media` - Enviar mídia
- **POST** `/message/send-file` - Enviar arquivo
- **POST** `/message/send-location` - Enviar localização
- **POST** `/message/send-contact` - Enviar contato
- **GET** `/message/history/:sessionId` - Histórico de mensagens
- **POST** `/message/react` - Reagir a mensagem
- **POST** `/message/mark-read` - Marcar como lida

#### 2.2.3 Group Management
- **POST** `/groups/create` - Criar grupo
- **GET** `/groups/list/:sessionId` - Listar grupos
- **GET** `/groups/info/:sessionId/:groupId` - Info do grupo
- **POST** `/groups/add-participant` - Adicionar membro
- **POST** `/groups/remove-participant` - Remover membro
- **POST** `/groups/promote-admin` - Promover admin
- **POST** `/groups/demote-admin` - Rebaixar admin
- **POST** `/groups/leave` - Sair do grupo
- **POST** `/groups/update-subject` - Atualizar nome
- **POST** `/groups/update-description` - Atualizar descrição
- **POST** `/groups/settings` - Configurações do grupo
- **GET** `/groups/invite-code/:sessionId/:groupId` - Código de convite
- **POST** `/groups/revoke-invite` - Revogar convite

#### 2.2.4 Contact Operations
- **GET** `/contacts/:sessionId` - Listar contatos
- **GET** `/contact/profile/:sessionId/:jid` - Perfil do contato
- **POST** `/contact/block` - Bloquear contato
- **POST** `/contact/unblock` - Desbloquear contato

#### 2.2.5 Status Operations
- **GET** `/status/privacy/:sessionId` - Configurações de privacidade
- **POST** `/status/update-privacy` - Atualizar privacidade
- **GET** `/status/profile/:sessionId` - Status do perfil

#### 2.2.6 Media Downloads
- **GET** `/download/:downloadId` - Download público de mídia
- **GET** `/media/info/:sessionId/:messageId` - Info da mídia

#### 2.2.7 Webhook Management
- **POST** `/webhook/set` - Configurar webhook
- **GET** `/webhook/list/:sessionId` - Listar webhooks
- **DELETE** `/webhook/remove` - Remover webhook
- **POST** `/webhook/test` - Testar webhook

### 2.3 Utility Endpoints
- **GET** `/api` - Informações da API
- **GET** `/api-docs` - Documentação Swagger
- **GET** `/api/management/health` - Health check
- **GET** `/api/management/info` - Informações da Management API
- **GET** `/openapi.json` - Download do OpenAPI JSON

---

## 3. SISTEMA DE AUTENTICAÇÃO E SEGURANÇA

### 3.1 Autenticação Dual
- **Sessões de Usuário**: Para frontend com cookie seguro
- **Tokens API**: Prefixo "baileys_" para acesso programático
- **MongoDB Session Store**: Persistência com connect-mongo

### 3.2 Middleware de Segurança
- **Helmet**: Headers de segurança configurados
- **CORS**: Origin configurável com credentials
- **CSRF**: Proteção com token validation
- **Rate Limiting**: Limitação de requests

### 3.3 Controle de Acesso
- Sessões vinculadas a usuários específicos
- Tokens com escopo definido
- Verificação de ownership nas operações
- Logs de auditoria detalhados

---

## 4. SISTEMA DE WEBHOOKS

### 4.1 Recursos dos Webhooks
- **Múltiplos Webhooks**: Até 3 webhooks por sessão
- **Sistema de Prioridades**: Ordering por importância
- **Eventos Suportados**: `messages.upsert`, `connection.update`
- **Formato de Dados**: JSON estruturado com mídia Base64

### 4.2 Processamento de Mídia
- **Auto-download**: Download automático de todas as mídias
- **URLs Diretas**: Acesso público sem autenticação
- **Suporte Completo**: Imagens, vídeos, áudios, documentos, stickers
- **Mensagens Citadas**: Extração completa com download de mídia
- **Metadados**: Informações detalhadas de arquivo

### 4.3 Estrutura de Dados do Webhook
```json
{
  "sessionId": "string",
  "messageId": "string",
  "from": "string",
  "to": "string",
  "groupName": "string",
  "timestamp": "ISO8601",
  "hasQuotedMessage": boolean,
  "quotedMessage": {
    "text": "string",
    "mediaType": "string",
    "downloadUrl": "string"
  },
  "mediaInfo": {
    "hasMedia": boolean,
    "mediaType": "string",
    "downloadUrl": "string",
    "fileName": "string"
  }
}
```

---

## 5. INTEGRAÇÃO IA (AI ASSISTANT)

### 5.1 AI Assistant Features
- **Chat Streaming**: Respostas em tempo real
- **Tool Execution**: Execução paralela de ferramentas
- **OpenAI Integration**: Suporte a modelos GPT-4, GPT-3.5
- **Custom API Keys**: Configuração de chaves personalizadas
- **Context Awareness**: Contexto de conversa mantido

### 5.2 Ferramentas de IA Disponíveis
- **WhatsApp Operations**: Envio de mensagens, gestão de grupos
- **System Monitoring**: Status de sessões, health checks
- **Media Processing**: Download e processamento de mídia
- **Group Management**: Criação, configuração, moderação
- **Message History**: Busca e análise de histórico

### 5.3 AI Agent System
- **Multi-Agent Support**: Múltiplos agentes IA simultâneos
- **Personalização**: Personalidade, especialização configurável
- **Auto-Reply**: Respostas automáticas inteligentes
- **Learning Enabled**: Aprendizado baseado em interações
- **Web Search Integration**: Busca na web com múltiplas fontes

### 5.4 Message Collector & Summarization
- **Coleta Automatizada**: Monitoramento de grupos 24/7
- **Análise Inteligente**: Processamento com IA
- **Múltiplos Tons**: Professional, Casual, Analytical, Brief
- **Análise de Sentimento**: Detecção de emoções e temas
- **Export Features**: Download em markdown

---

## 6. FRONTEND (REACT 19)

### 6.1 Estrutura da Interface
- **Design System**: Apple Liquid Glass inspirado
- **Componentes**: shadcn/ui com Tailwind CSS
- **Animações**: Framer Motion com detecção de performance
- **Roteamento**: React Router DOM v7

### 6.2 Páginas Principais
- **Home**: Landing page com recursos destacados
- **Login**: Autenticação com validação
- **Dashboard**: Painel principal de gerenciamento
- **AI Assistant**: Chat streaming com IA
- **AI Agent**: Configuração de agentes IA
- **AI Tasks**: Gerenciamento de tarefas automatizadas

### 6.3 Componentes Especializados

#### 6.3.1 AIStreamingChat
- Chat em tempo real com streaming
- Tool execution visualization
- Auto-scroll inteligente
- Markdown rendering avançado
- Progress indicators para tools

#### 6.3.2 WebhookManager
- Configuração visual de webhooks
- Teste de conectividade
- Preview de dados
- Management de prioridades

#### 6.3.3 MessageCollectorManager
- Interface para coleta de mensagens
- Configuração de horários
- Visualização de dados coletados
- Integração com AI Summary

#### 6.3.4 AISummaryPanel
- Geração de resumos IA
- Múltiplos estilos de resumo
- Análise de sentimento
- Export de resultados

#### 6.3.5 MediaManager
- Upload e gestão de arquivos
- Preview de mídias
- Organização por sessão
- Download batch

### 6.4 UI Components Library
- **Buttons**: Variações com animações
- **Cards**: Layouts responsivos
- **Forms**: Validação integrada
- **Modals/Dialogs**: Overlays modernos
- **Progress**: Indicadores de progresso
- **Tabs**: Navegação entre seções
- **Toast**: Notificações elegantes

---

## 7. BANCO DE DADOS (MONGODB)

### 7.1 Collections Principais

#### 7.1.1 Core Collections
- **users**: Usuários do sistema
- **sessions**: Sessões Express
- **api_tokens**: Tokens de API
- **whatsapp_sessions**: Sessões WhatsApp

#### 7.1.2 Messaging Collections
- **messages**: Histórico de mensagens
- **webhooks**: Configurações de webhook
- **downloads**: Metadados de downloads
- **groups**: Informações de grupos

#### 7.1.3 AI & Analytics Collections
- **messageCollectors**: Configurações de coleta
- **collectedMessages**: Mensagens coletadas
- **aiSummaries**: Resumos gerados por IA
- **sentimentAnalysis**: Análises de sentimento
- **ai_agents**: Configurações de agentes IA
- **ai_agent_conversations**: Conversas dos agentes

#### 7.1.4 Task Management Collections
- **whatsapp_tasks**: Tarefas agendadas
- **task_executions**: Execuções de tarefas
- **qr_codes**: QR codes gerados

### 7.2 Indexação e Performance
- Índices otimizados para consultas frequentes
- TTL indexes para limpeza automática
- Agregação pipelines para analytics
- Connection pooling configurado

### 7.3 Backup e Segurança
- Expiração automática de downloads (7 dias)
- Cleanup automático a cada 6 horas
- Sanitização de dados MongoDB
- Validação de esquemas

---

## 8. CARACTERÍSTICAS TÉCNICAS AVANÇADAS

### 8.1 Session Management
- **Global State**: `global.whatsappSessions` Map
- **Persistent Auth**: Armazenamento em `auth_sessions/`
- **Auto-Reconnection**: Reconexão automática
- **QR Code Generation**: Geração dinâmica para auth

### 8.2 Media Processing
- **Smart Download**: URLs únicos com expiração
- **Format Detection**: Detecção automática de tipos
- **Compression**: Otimização de tamanhos
- **Streaming**: Suporte a streams grandes

### 8.3 Message Processing Pipeline
- **extractMessageData()**: Processamento central
- **enrichWebhookMessage()**: Enriquecimento de dados
- **downloadMediaToFile()**: Download otimizado
- **extractQuotedMessage()**: Processamento de citações

### 8.4 Error Handling
- **Graceful Degradation**: Funcionamento sem MongoDB em dev
- **Retry Logic**: Tentativas automáticas
- **Logging Detalhado**: Pino logger configurado
- **Fallback Mechanisms**: Alternativas para falhas

---

## 9. AUTOMAÇÃO E TAREFAS

### 9.1 Task Scheduler
- **Cron Integration**: node-cron para agendamento
- **Task Types**: Envio de mensagens, backup, limpeza
- **Execution Tracking**: Logs de execução detalhados
- **Error Recovery**: Recuperação automática de falhas

### 9.2 Message Automation
- **Auto-Reply**: Respostas automáticas inteligentes
- **Scheduled Messages**: Mensagens agendadas
- **Bulk Operations**: Operações em lote
- **Template Support**: Templates de mensagem

### 9.3 Group Automation
- **Member Management**: Adição/remoção automática
- **Moderation**: Moderação automatizada
- **Welcome Messages**: Mensagens de boas-vindas
- **Auto-Promotion**: Promoção baseada em critérios

---

## 10. MONITORAMENTO E ANALYTICS

### 10.1 Health Monitoring
- **System Health**: Endpoint dedicado `/api/management/health`
- **Connection Status**: Status de todas as sessões
- **Resource Usage**: Monitoramento de recursos
- **Performance Metrics**: Métricas de performance

### 10.2 Analytics Features
- **Message Analytics**: Estatísticas de mensagens
- **User Behavior**: Análise de comportamento
- **Sentiment Tracking**: Rastreamento de sentimento
- **Engagement Metrics**: Métricas de engajamento

### 10.3 Logging System
- **Structured Logging**: Pino logger configurado
- **Request Tracking**: Rastreamento de requests
- **Error Monitoring**: Monitoramento de erros
- **Audit Trail**: Trilha de auditoria

---

## 11. DESENVOLVIMENTO E DEPLOYMENT

### 11.1 Development Commands
```bash
# Backend development
npm run dev                # Hot reload com nodemon
npm start                  # Produção

# Frontend development  
npm run frontend           # Vite dev server
npm run frontend:build     # Build produção
npm run frontend:preview   # Preview build

# Full stack development
npm run dev:full           # Backend + Frontend simultâneo

# Dependencies
npm run install:frontend   # Instalar deps frontend

# Utilities
node -c src/app.js         # Validar sintaxe
node test-scraping.js      # Testar scraping
```

### 11.2 Environment Variables
```bash
# Database
MONGODB_URI=mongodb://user:pass@host:port/db
DB_NAME=baileys

# Security
SESSION_SECRET=your-session-secret
COOKIE_SECRET=your-cookie-secret

# Network
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Features
AUTO_MARK_READ=true
```

### 11.3 Docker Support
- **docker-compose.yml**: Configuração completa
- **Nginx Proxy**: Profile opcional
- **Volume Persistence**: Dados persistentes
- **Environment Variables**: Configuração via env

---

## 12. RECURSOS DE SEGURANÇA

### 12.1 Authentication Security
- **Password Hashing**: bcryptjs para senhas
- **JWT Tokens**: Tokens seguros com expiração
- **Session Management**: Sessões seguras com MongoDB
- **API Key Validation**: Validação rigorosa de tokens

### 12.2 Data Protection
- **Input Sanitization**: Sanitização de entradas
- **SQL Injection Protection**: Proteção automática
- **XSS Prevention**: Headers de segurança
- **CSRF Protection**: Tokens CSRF validados

### 12.3 Communication Security
- **HTTPS Ready**: Suporte a SSL/TLS
- **Secure Headers**: Helmet middleware
- **CORS Configuration**: Configuração restritiva
- **Rate Limiting**: Proteção contra abuse

---

## 13. EXTENSIBILIDADE E CUSTOMIZAÇÃO

### 13.1 Plugin Architecture
- **Tool System**: Sistema de ferramentas extensível
- **Hook System**: Hooks para customização
- **Middleware Stack**: Middleware personalizável
- **Event System**: Sistema de eventos robusto

### 13.2 Configuration Options
- **Feature Flags**: Flags para ativar/desativar recursos
- **Theme Customization**: Temas personalizáveis
- **Webhook Templates**: Templates configuráveis
- **AI Prompt Customization**: Prompts personalizáveis

### 13.3 Integration Capabilities
- **REST API**: API completa para integração
- **Webhook System**: Integração via webhooks
- **Database Direct**: Acesso direto ao banco
- **Event Streaming**: Eventos em tempo real

---

## 14. PERFORMANCE E OTIMIZAÇÃO

### 14.1 Backend Optimizations
- **Connection Pooling**: Pool de conexões MongoDB
- **Caching Strategy**: Cache em memória para perfis
- **Async Processing**: Processamento assíncrono
- **Resource Management**: Gestão eficiente de recursos

### 14.2 Frontend Optimizations
- **Code Splitting**: Divisão automática de código
- **Lazy Loading**: Carregamento sob demanda
- **Performance Detection**: Detecção de performance do device
- **Memory Management**: Gestão eficiente de memória

### 14.3 Database Optimizations
- **Query Optimization**: Consultas otimizadas
- **Index Strategy**: Estratégia de indexação
- **Aggregation Pipelines**: Pipelines eficientes
- **Data Cleanup**: Limpeza automática de dados

---

## 15. TROUBLESHOOTING E DEBUGGING

### 15.1 Common Issues
- **Connection Problems**: Problemas de conexão WhatsApp
- **QR Code Issues**: Problemas com QR codes
- **Media Download Failures**: Falhas de download
- **Webhook Delivery Issues**: Problemas de entrega

### 15.2 Debug Tools
- **Comprehensive Logging**: Logs detalhados
- **Error Tracking**: Rastreamento de erros
- **Performance Monitoring**: Monitoramento de performance
- **Health Checks**: Verificações de saúde

### 15.3 Support Features
- **API Documentation**: Documentação completa
- **Swagger UI**: Interface interativa
- **Test Endpoints**: Endpoints para teste
- **Debug Mode**: Modo de debug avançado

---

## 16. ROADMAP E FUTURAS IMPLEMENTAÇÕES

### 16.1 Planned Features
- **Multi-language Support**: Suporte a múltiplos idiomas
- **Advanced Analytics**: Analytics avançados
- **Mobile App**: Aplicativo móvel
- **Enterprise Features**: Recursos empresariais

### 16.2 API Enhancements
- **GraphQL Support**: Suporte a GraphQL
- **WebSocket Integration**: WebSockets para real-time
- **Advanced Caching**: Cache distribuído
- **Microservices Architecture**: Arquitetura de microserviços

### 16.3 AI Improvements
- **Advanced NLP**: Processamento de linguagem natural
- **Predictive Analytics**: Analytics preditivos
- **Custom Models**: Modelos customizados
- **Voice Processing**: Processamento de voz

---

## CONCLUSÃO

FlowChat API representa uma solução completa e avançada para automação WhatsApp, oferecendo:

- **50+ Endpoints** organizados em APIs especializadas
- **Sistema de IA** completo com agents e summarization
- **Interface moderna** em React 19 com design Apple-inspired
- **Arquitetura robusta** com MongoDB e sistema de webhooks
- **Segurança avançada** com autenticação dual e middleware em camadas
- **Extensibilidade** através de sistema de plugins e tools
- **Performance otimizada** com caching e processamento assíncrono

O sistema é projetado para atender desde uso pessoal até implementações empresariais, com recursos de monitoramento, analytics e automação avançados.

---

**Versão da Documentação**: 1.0.0  
**Data**: 2025-01-21  
**Autor**: FlowChat Development Team  
**Licença**: MIT  

---

*Esta documentação cobre todos os recursos identificados através da análise completa do código-fonte. Para informações técnicas específicas, consulte o código-fonte e a documentação Swagger em `/api-docs`.*