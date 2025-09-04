# FlowChat API

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/viniciusdev772/flowchatv1)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red.svg)](https://github.com/viniciusdev772/flowchatv1)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/viniciusdev772/flowchatv1/pulls)

[![Node.js](https://img.shields.io/badge/node.js-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-%3E%3D4.0-green.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-supported-2496ED.svg)](https://www.docker.com/)

[![CI/CD](https://github.com/viniciusdev772/flowchatv1/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/viniciusdev772/flowchatv1/actions)
[![Code Quality](https://github.com/viniciusdev772/flowchatv1/workflows/Code%20Quality%20%26%20Security/badge.svg)](https://github.com/viniciusdev772/flowchatv1/actions)
[![Sourcery](https://img.shields.io/badge/Sourcery-enabled-brightgreen.svg)](https://sourcery.ai)
[![Security](https://img.shields.io/badge/Security-audited-success.svg)](https://github.com/viniciusdev772/flowchatv1/security)

[![Issues](https://img.shields.io/github/issues/viniciusdev772/flowchatv1)](https://github.com/viniciusdev772/flowchatv1/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/viniciusdev772/flowchatv1)](https://github.com/viniciusdev772/flowchatv1/pulls)
[![Stars](https://img.shields.io/github/stars/viniciusdev772/flowchatv1)](https://github.com/viniciusdev772/flowchatv1/stargazers)
[![Forks](https://img.shields.io/github/forks/viniciusdev772/flowchatv1)](https://github.com/viniciusdev772/flowchatv1/network)

> **Fluxo inteligente de mensagens WhatsApp com multi-sessões e automação segura**

FlowChat API é uma sofisticada API WhatsApp multi-sessão construída com Node.js, Express e a biblioteca Baileys. Fornece recursos abrangentes de automação WhatsApp com integração de IA, gerenciamento avançado de webhooks, operações de grupo e processamento de mídia.

## 🌟 Projeto Open Source

**Este é um projeto 100% open source!** Contribuições da comunidade são não apenas bem-vindas, mas essenciais para o crescimento e melhoria contínua da FlowChat API. 

**🤝 Como você pode contribuir:**
- 🐛 Reportar bugs e problemas
- ✨ Sugerir novas funcionalidades  
- 📝 Melhorar a documentação
- 🔧 Submeter correções e melhorias
- ⭐ Dar uma estrela no projeto
- 🗣️ Compartilhar com a comunidade

**💡 Ideias para contribuições:**
- Novos endpoints para automação WhatsApp
- Otimizações de performance
- Testes automatizados
- Tradução da documentação
- Integração com outras plataformas
- Melhorias na interface de webhook

## 🚀 Recursos Principais

### ✨ Gerenciamento de Sessões Avançado
- **Suporte Multi-usuário**: Cada sessão vinculada a usuário específico com verificação de permissões
- **Autenticação Persistente**: Sessões armazenadas no diretório `auth_sessions/`
- **Reconexão Automática**: Recuperação de conexão integrada e regeneração de código QR
- **Propriedade de Sessão**: Validação rígida de propriedade usuário-sessão

### 🔗 Sistema de Webhook Sofisticado
- **Entrega Baseada em Prioridade**: Até 3 webhooks por sessão com prioridades configuráveis
- **Transmissão de Eventos**: Eventos `connection.update` e `messages.upsert` em tempo real
- **Teste de Webhook**: Endpoints integrados de validação e teste de webhook
- **Suporte a Mensagens Citadas**: Extração completa e download de conteúdo de mídia citado

### 📱 Processamento Completo de Mídia
- **Pipeline de Download Automático**: Download automático de mídia com geração de ID único
- **Codificação Base64**: Mídia convertida para Base64 para transmissão via webhook
- **Detecção de Tipo de Arquivo**: Detecção inteligente de extensão incluindo PTT (Push-to-Talk)
- **Persistência MongoDB**: Metadados de download armazenados com expiração de 7 dias
- **Downloads Públicos**: Endpoint `/download/:downloadId` para acesso direto à mídia

### 🤖 Integração de IA e Automação
- **Integração OpenAI**: Suporte a chave API customizada com respostas streaming
- **Ferramentas de IA**: 20+ ferramentas para integração com operações WhatsApp
- **Coleta de Mensagens**: Monitoramento automatizado de mensagens de grupo com agendamento baseado em tempo
- **Resumos Inteligentes**: Resumo de mensagens alimentado por IA com múltiplos tons (Profissional, Casual, Analítico, Breve)
- **Análise de Sentimento**: Detecção avançada de emoção e tema

### 👥 Gerenciamento de Grupos
- **Operações Abrangentes**: Recursos completos de administração para gerenciamento de grupos
- **Gerenciamento de Participantes**: Adicionar, remover, promover, rebaixar membros
- **Manipulação de Metadados**: Informações do grupo, configurações e gerenciamento de link de convite
- **Operações em Lote**: Funcionalidade para mencionar todos os participantes

## 🛡️ Segurança e Performance

### 🔐 Sistema de Autenticação Dupla
1. **Sessões de Usuário**: Autenticação baseada em JWT para acesso frontend
2. **Tokens de API**: Tokens com prefixo "baileys_" para acesso de API externa
3. **Cache de Usuário**: Cache em memória de 5 minutos para otimização de performance
4. **Middleware de Segurança**: Proteção CSRF, validação de token API, cabeçalhos de segurança Helmet

### ⚡ Otimizações de Performance
- **Cache de Perfil de Usuário**: Cache de 5 minutos reduzindo consultas DB em 60-80%
- **Execução Paralela de Ferramentas**: Ferramentas de IA executam simultaneamente para respostas mais rápidas
- **Pool de Conexões**: Otimização de conexão MongoDB
- **Entrega de Arquivos Estáticos**: Entrega eficiente de mídia
- **Degradação Elegante**: Continua operação com funcionalidade reduzida quando serviços indisponíveis

## 📋 Requisitos

- **Node.js**: v14.0.0 ou superior
- **MongoDB**: v4.0 ou superior (opcional para desenvolvimento)
- **Memória**: Mínimo 512MB RAM
- **Armazenamento**: 1GB para cache de mídia e sessões

## 🔧 Instalação

### 1. Clone o Repositório
```bash
git clone https://github.com/viniciusdev772/flowchatv1.git
cd flowchatv1
```

### 2. Instale as Dependências
```bash
npm install
```

### 3. Configure as Variáveis de Ambiente
Crie um arquivo `.env` baseado no `.env.example`:

```env
# Configuração do Servidor
PORT=3000
NODE_ENV=development

# Configuração do Banco de Dados
MONGODB_URI=mongodb://localhost:27017/flowchat
DB_NAME=flowchat

# Segurança
SESSION_SECRET=sua-chave-secreta-session
COOKIE_SECRET=sua-chave-secreta-cookie
CORS_ORIGIN=http://localhost:5173

# Configurações WhatsApp
AUTO_MARK_READ=true

# IA (Opcional)
OPENAI_API_KEY=sua-chave-openai
```

### 4. Inicie o Servidor

**Modo Desenvolvimento:**
```bash
npm run dev
```

**Modo Produção:**
```bash
npm start
```

## 🌐 Endpoints da API

### 🔑 Management API (`/api/management/`)

#### Autenticação & Usuários
```http
GET    /health                    # Health check do servidor
GET    /info                     # Informações da API
POST   /auth/register            # Registro de usuário
POST   /auth/login               # Autenticação
GET    /auth/profile             # Perfil do usuário (cached)
PUT    /auth/profile             # Atualizar perfil
POST   /auth/change-password     # Alterar senha
POST   /auth/logout              # Logout
```

#### Gerenciamento de Tokens
```http
POST   /tokens/generate          # Gerar tokens API
GET    /tokens/list              # Listar tokens do usuário
DELETE /tokens/:tokenId          # Revogar tokens
GET    /tokens/:tokenId/full     # Detalhes completos do token
```

#### Gerenciamento de Sessões
```http
GET    /sessions/list            # Listar sessões com dados enriquecidos
GET    /sessions/:sessionId/groups # Listar grupos da sessão
```

#### Gerenciamento de Mídia
```http
GET    /media/sessions                          # Listar todas as sessões de mídia
GET    /media/session/:sessionId               # Listar arquivos de mídia da sessão
GET    /media/download/:sessionId/:filename    # Download de arquivos de mídia
GET    /media/preview/:sessionId/:filename     # Preview de arquivos de imagem
```

#### Assistente de IA
```http
POST   /ai/chat                  # Chat streaming de IA com execução de ferramentas
GET    /ai/tools                 # Listar ferramentas de IA disponíveis
GET    /ai/health                # Health check do sistema de IA
POST   /ai/save-base64-image     # Salvar imagens base64 como arquivos
```

#### Coletor de Mensagens
```http
POST   /message-collector/start             # Iniciar coleta automatizada
POST   /message-collector/stop              # Parar coleta de mensagens
GET    /message-collector/list              # Listar coletores ativos
GET    /message-collector/messages/:id      # Obter mensagens coletadas
```

#### Resumos de IA
```http
POST   /ai-summary/summarize            # Gerar resumos de IA
GET    /ai-summary/list                 # Listar resumos gerados
GET    /ai-summary/:summaryId           # Obter resumo específico
DELETE /ai-summary/:summaryId           # Deletar resumo
POST   /ai-summary/analyze-sentiment    # Análise de sentimento
```

### 📱 Baileys WhatsApp API (`/api/baileys/`)

#### Operações de Sessão
```http
POST   /session/create                      # Criar nova sessão WhatsApp
GET    /session/:sessionId/status           # Status da sessão e info de conexão
POST   /session/:sessionId/regenerate-qr    # Gerar novo código QR
DELETE /session/:sessionId                  # Deletar sessão
GET    /sessions                            # Listar todas as sessões
POST   /sessions/cleanup-orphaned           # Limpar sessões órfãs
```

#### Mensagens
```http
POST   /session/:sessionId/send-message     # Enviar mensagens de texto
POST   /session/:sessionId/send-media       # Enviar mídia com suporte a upload
POST   /session/:sessionId/reply-message    # Responder mensagens específicas
POST   /session/:sessionId/smart-reply      # Respostas inteligentes alimentadas por IA
POST   /session/:sessionId/mention-all      # Mencionar todos os participantes
```

#### Gerenciamento de Mensagens
```http
GET    /session/:sessionId/messages         # Obter histórico com paginação
POST   /session/:sessionId/mark-read        # Marcar mensagens como lidas
POST   /session/:sessionId/typing           # Controlar indicadores de digitação
POST   /session/:sessionId/download-media   # Download de mídia de mensagem
```

#### Downloads de Mídia
```http
GET    /download/:downloadId                # Endpoint público de download
GET    /downloads                           # Listar downloads por sessão
```

#### Operações de Contato
```http
POST   /session/:sessionId/contacts/check      # Verificar números WhatsApp
POST   /session/:sessionId/contacts/info       # Obter informações de contato
GET    /session/:sessionId/contacts/profile    # Obter fotos de perfil
GET    /session/:sessionId/contacts/status     # Obter status de contato
POST   /session/:sessionId/contacts/block      # Bloquear contatos
POST   /session/:sessionId/contacts/unblock    # Desbloquear contatos
```

#### Sistema de Webhook

**Webhook Único (Legacy):**
```http
POST   /session/:sessionId/webhook          # Configurar webhook principal
GET    /session/:sessionId/webhook          # Obter configuração
DELETE /session/:sessionId/webhook          # Remover webhook
```

**Multi-Webhook Avançado (até 3 por sessão):**
```http
GET    /session/:sessionId/webhooks                 # Listar todos os webhooks
POST   /session/:sessionId/webhooks                 # Adicionar webhook com prioridade
GET    /session/:sessionId/webhooks/:webhookId      # Obter webhook específico
PUT    /session/:sessionId/webhooks/:webhookId      # Atualizar webhook
DELETE /session/:sessionId/webhooks/:webhookId      # Remover webhook
PATCH  /session/:sessionId/webhooks/:webhookId/toggle # Toggle status do webhook
POST   /session/:sessionId/webhooks/:webhookId/test   # Testar entrega do webhook
```

### 👥 Operações de Grupo (`/api/baileys/groups/`)

```http
POST   /:sessionId/create                      # Criar novos grupos
GET    /:sessionId/:groupId/info               # Informações e metadados do grupo
POST   /:sessionId/:groupId/add-participants   # Adicionar membros
POST   /:sessionId/:groupId/remove-participants # Remover membros
POST   /:sessionId/:groupId/promote            # Promover para admin
POST   /:sessionId/:groupId/demote             # Rebaixar de admin
PUT    /:sessionId/:groupId/subject            # Atualizar nome do grupo
PUT    /:sessionId/:groupId/description        # Atualizar descrição
PUT    /:sessionId/:groupId/settings           # Configurar permissões
POST   /:sessionId/:groupId/leave              # Sair do grupo
GET    /:sessionId/list                        # Listar todos os grupos
GET    /:sessionId/:groupId/invite-code        # Obter link de convite
POST   /:sessionId/:groupId/revoke-invite      # Revogar link de convite
```

#### Utilitários
```http
POST   /session/:sessionId/lid/resolve         # Resolver LID para números
GET    /info                                   # Informações completas da API
```

## 🔗 Integração de Webhook

### Estrutura de Dados do Webhook

**Evento de Mensagem:**
```json
{
  "sessionId": "user123_session1",
  "event": "messages.upsert",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "message_id"
    },
    "message": {
      "conversation": "Texto da mensagem",
      "messageTimestamp": 1640000000
    },
    "pushName": "Nome do Contato",
    "messageType": "text",
    "isGroup": false,
    "groupMetadata": null,
    "hasQuotedMessage": false,
    "quotedMessage": null,
    "mediaUrl": null,
    "mediaBase64": null
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Evento de Conexão:**
```json
{
  "sessionId": "user123_session1",
  "event": "connection.update",
  "data": {
    "connection": "open",
    "lastDisconnect": null,
    "qr": null
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Configuração de Webhook

**Webhook Único:**
```javascript
// POST /api/baileys/session/:sessionId/webhook
{
  "url": "https://seu-servidor.com/webhook",
  "events": ["messages.upsert", "connection.update"]
}
```

**Multi-Webhook com Prioridades:**
```javascript
// POST /api/baileys/session/:sessionId/webhooks
{
  "url": "https://webhook-primario.com/webhook",
  "events": ["messages.upsert"],
  "priority": 1,
  "active": true,
  "name": "Webhook Principal"
}
```

## 🤖 Integração de IA

### Configuração do Assistant

**Configurar API Key:**
```http
POST /api/management/ai/chat
Content-Type: application/json

{
  "message": "Configure minha chave da OpenAI",
  "apiKey": "sk-proj-sua-chave-openai",
  "model": "gpt-4o-mini"
}
```

### Ferramentas de IA Disponíveis

A FlowChat API inclui 20+ ferramentas de IA para automação WhatsApp:

- **Operações de Sessão**: Criar, deletar, gerenciar sessões
- **Envio de Mensagens**: Texto, mídia, respostas inteligentes
- **Gerenciamento de Grupos**: CRUD completo de grupos
- **Webhook Management**: Configuração e teste de webhooks
- **Análise de Mídia**: Download e processamento de arquivos
- **Web Scraping**: Extração de dados de websites
- **Pesquisa Web**: Integração com mecanismos de busca
- **Geração de Arquivos**: ZIP, imagens, documentos

### Exemplo de Chat com IA

```javascript
// Chat streaming com execução de ferramentas
const response = await fetch('/api/management/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Envie 'Olá!' para o grupo 'Teste' na sessão 'user123_session1'",
    stream: true
  })
});

// Resposta em streaming
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

## 📊 Monitoramento e Logs

### Health Check
```http
GET /api/management/health
```

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600.123,
  "memory": {
    "used": "150.5 MB",
    "total": "512 MB"
  },
  "database": "connected",
  "sessions": {
    "active": 5,
    "total": 10
  }
}
```

### Logs do Sistema

O sistema utiliza **Pino** para logging estruturado:

```bash
# Logs em desenvolvimento (pretty print)
npm run dev

# Logs em produção (JSON structured)
npm start
```

## 🐳 Deploy com Docker

### Docker Compose Completo

```yaml
version: '3.8'

services:
  flowchat-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/flowchat
      - NODE_ENV=production
    depends_on:
      - mongo
    volumes:
      - ./auth_sessions:/app/auth_sessions
      - ./uploads:/app/uploads
      - ./downloads:/app/downloads

  mongo:
    image: mongo:5
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

### Deploy
```bash
# Build e start
docker-compose up -d

# Verificar logs
docker-compose logs -f flowchat-api

# Parar serviços
docker-compose down
```

## 📚 Exemplos de Uso

### 1. Criar Sessão e Enviar Mensagem

```javascript
// 1. Criar sessão
const sessionResponse = await fetch('/api/baileys/session/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer baileys_seu-token-api'
  },
  body: JSON.stringify({
    sessionId: 'minha_sessao_1'
  })
});

// 2. Aguardar QR Code e escanear no WhatsApp
const statusResponse = await fetch('/api/baileys/session/minha_sessao_1/status');
const status = await statusResponse.json();
console.log('QR Code:', status.qr);

// 3. Enviar mensagem
await fetch('/api/baileys/session/minha_sessao_1/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer baileys_seu-token-api'
  },
  body: JSON.stringify({
    number: "5511999999999",
    message: "Olá! Mensagem enviada via FlowChat API 🚀"
  })
});
```

### 2. Configurar Webhook Multi-Prioridade

```javascript
// Webhook principal (prioridade 1)
await fetch('/api/baileys/session/minha_sessao_1/webhooks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer baileys_seu-token-api'
  },
  body: JSON.stringify({
    url: "https://meu-sistema.com/webhook-principal",
    events: ["messages.upsert"],
    priority: 1,
    name: "Sistema Principal"
  })
});

// Webhook de backup (prioridade 2)
await fetch('/api/baileys/session/minha_sessao_1/webhooks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer baileys_seu-token-api'
  },
  body: JSON.stringify({
    url: "https://backup.com/webhook",
    events: ["messages.upsert", "connection.update"],
    priority: 2,
    name: "Sistema Backup"
  })
});
```

### 3. Operações de Grupo Avançadas

```javascript
// Criar grupo
const groupResponse = await fetch('/api/baileys/groups/minha_sessao_1/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer baileys_seu-token-api'
  },
  body: JSON.stringify({
    subject: "Grupo de Desenvolvimento",
    description: "Discussões sobre projetos de desenvolvimento",
    participants: [
      "5511999999999@s.whatsapp.net",
      "5511888888888@s.whatsapp.net"
    ]
  })
});

const { groupId } = await groupResponse.json();

// Mencionar todos os membros
await fetch(`/api/baileys/session/minha_sessao_1/mention-all`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer baileys_seu-token-api'
  },
  body: JSON.stringify({
    groupId: groupId,
    message: "📢 Atenção pessoal! Reunião hoje às 15h."
  })
});
```

### 4. Coleta Automatizada de Mensagens

```javascript
// Iniciar coleta de mensagens
await fetch('/api/management/message-collector/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer seu-jwt-token'
  },
  body: JSON.stringify({
    sessionId: "minha_sessao_1",
    groupId: "123456@g.us",
    groupName: "Grupo de Vendas",
    startHour: 8,
    endHour: 18,
    timezone: "America/Sao_Paulo",
    active: true
  })
});

// Obter mensagens coletadas
const messagesResponse = await fetch('/api/management/message-collector/messages/collector_id');
const messages = await messagesResponse.json();

// Gerar resumo com IA
await fetch('/api/management/ai-summary/summarize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer seu-jwt-token'
  },
  body: JSON.stringify({
    collectorId: "collector_id",
    tone: "professional",
    customPrompt: "Foque em leads e oportunidades de vendas"
  })
});
```

## 🔧 Desenvolvimento

### Estrutura do Projeto

```
flowchat-api/
├── main.js                 # Entrada principal do servidor
├── src/
│   ├── app.js             # Lógica principal do Baileys WhatsApp
│   ├── config/            # Configurações (DB, Swagger)
│   ├── controllers/       # Controladores de negócio
│   ├── middleware/        # Middleware personalizado
│   ├── routes/            # Definições de rotas
│   ├── api/               # Handlers de API específicos
│   ├── ai/                # Ferramentas e integração de IA
│   ├── utils/             # Utilitários (scraping, web search)
│   └── scheduler/         # Sistema de agendamento de tarefas
├── auth_sessions/         # Persistência de autenticação WhatsApp
├── uploads/               # Arquivos enviados
├── downloads/             # Cache de mídia baixada
└── sessions/              # Dados de sessão temporários
```

### Scripts de Desenvolvimento

```bash
# Desenvolvimento com hot reload
npm run dev

# Start em produção
npm start

# Teste utilitários de scraping
node test-scraping.js

# Verificar sintaxe
node -c src/app.js
node -c main.js
```

### 🤝 Contribuição

**Pull Requests são muito bem-vindos!** Leia nosso [Guia de Contribuição](CONTRIBUTING.md) para começar.

**Processo rápido:**
1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças seguindo [Conventional Commits](https://conventionalcommits.org/)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request usando nosso [template](.github/pull_request_template.md)

**Áreas que precisam de ajuda:**
- 🧪 Testes automatizados
- 📝 Documentação e exemplos
- ⚡ Otimizações de performance
- 🔧 Novas funcionalidades WhatsApp
- 🐛 Correções de bugs

Veja issues marcadas com [`good first issue`](https://github.com/viniciusdev772/flowchatv1/labels/good%20first%20issue) para começar!

## ❓ FAQ

### P: Posso usar sem MongoDB?
**R:** Sim! Em modo desenvolvimento, a API continua funcionando sem MongoDB com funcionalidade reduzida (dados em memória).

### P: Quantas sessões simultâneas suporta?
**R:** Limitado pela memória disponível. Cada sessão consome ~50-100MB. Em produção, recomenda-se máximo 20-30 sessões por GB de RAM.

### P: Como funciona a persistência de sessão?
**R:** As sessões WhatsApp são persistidas no diretório `auth_sessions/` como arquivos JSON. Ao reiniciar, as sessões são restauradas automaticamente.

### P: Posso usar múltiplos webhooks?
**R:** Sim! Suporte a até 3 webhooks por sessão com sistema de prioridades. O webhook com prioridade 1 recebe primeiro, depois prioridade 2, e assim por diante.

### P: Como funciona o download de mídia?
**R:** Toda mídia é automaticamente baixada e disponibilizada via endpoint público `/download/:downloadId` com expiração de 7 dias.

## 🆘 Suporte

### Logs e Debugging

```bash
# Verificar logs do sistema
npm run dev

# Verificar status das sessões
curl http://localhost:3000/api/baileys/sessions

# Health check
curl http://localhost:3000/api/management/health
```

### Problemas Comuns

**QR Code não aparece:**
- Verifique se a sessão foi criada corretamente
- Use `/session/:sessionId/regenerate-qr` para regenerar

**Webhook não recebe eventos:**
- Verifique se a URL está acessível publicamente
- Use `/webhooks/:webhookId/test` para testar entrega
- Verifique logs do servidor para erros de entrega

**Erro de conexão com MongoDB:**
- Em desenvolvimento, a API continua funcionando sem DB
- Verifique a string de conexão MONGODB_URI
- Certifique-se de que o MongoDB está executando

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) - Biblioteca WhatsApp Web API
- [OpenAI](https://openai.com/) - Integração de IA
- [Express.js](https://expressjs.com/) - Framework web
- [MongoDB](https://www.mongodb.com/) - Sistema de banco de dados

---

⭐ **Se este projeto foi útil, considere dar uma estrela!** ⭐

📧 **Contato**: [vinil6006@gmail.com](mailto:vinil6006@gmail.com)
💰 **PIX**: vinil6006@gmail.com