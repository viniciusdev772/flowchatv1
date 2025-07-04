# FlowChat MCP Server (JavaScript)

Um servidor **Model Context Protocol (MCP)** completo para a API FlowChat Baileys WhatsApp, implementado em **JavaScript puro** com autenticação por **API Token**.

## 🚀 Recursos

### ✅ **Simplicidade JavaScript**
- **JavaScript puro** - sem TypeScript
- **API Token authentication** simples e eficaz
- **Rate limiting** (100 req/min configurável)
- **Error handling** robusto
- **Zero dependências** desnecessárias

### ⚡ **40+ Ferramentas Completas**
- **Gerenciamento de sessões** WhatsApp (6 tools)
- **Envio de mensagens** (5 tools) 
- **Controles de chat** (2 tools)
- **Operações de mídia** (2 tools)
- **Histórico de mensagens** (1 tool)
- **Webhooks legados e avançados** (10 tools)
- **Gerenciamento de grupos** (13 tools)
- **Informações da API** (1 tool)

### 🔒 **Segurança Simples e Eficaz**
- **API Token** com prefixo `baileys_`
- **Rate limiting** por usuário
- **Validation** automática de tokens
- **Error sanitization** para segurança

## 📦 Instalação

### 1. **Instalar dependências**
```bash
npm install @modelcontextprotocol/sdk axios
```

### 2. **Configurar variáveis de ambiente**
```bash
# Copiar exemplo
cp .env-mcp.example .env

# Editar .env (OBRIGATÓRIO!)
BAILEYS_API_URL=http://localhost:3000
BAILEYS_API_KEY=baileys_your_REAL_api_key_here  # ⚠️ OBRIGATÓRIO
API_TIMEOUT=30000
RATE_LIMIT=100
```

**⚠️ IMPORTANTE:** O `BAILEYS_API_KEY` deve ser um token **real e válido** da sua API. O servidor irá validar cada token fazendo uma chamada real para `/api/baileys/info`.

### 3. **Verificar configuração**
```bash
# Testar se API está funcionando
curl -H "Authorization: Bearer baileys_your_api_key_here" \
     http://localhost:3000/api/baileys/info
```

## 🏃‍♂️ Execução

### **Modo Simples**
```bash
node mcp-server.js
```

### **Modo Development (com watch)**
```bash
npm run dev
```

### **Como MCP Tool no Claude Desktop**
Adicione ao `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "flowchat": {
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {
        "BAILEYS_API_URL": "http://localhost:3000",
        "BAILEYS_API_KEY": "baileys_your_api_key_here"
      }
    }
  }
}
```

## 🛠️ Ferramentas Disponíveis

### **1. Gerenciamento de Sessões**
```javascript
// Criar nova sessão
create_session({
  sessionId: "minha-sessao-1",
  webhookUrl: "https://meusite.com/webhook" // opcional
})

// Ver status e QR code
get_session_status({ sessionId: "minha-sessao-1" })

// Listar todas as sessões
list_sessions({})

// Deletar sessão
delete_session({ sessionId: "minha-sessao-1" })

// Regenerar QR code
regenerate_qr({ sessionId: "minha-sessao-1" })

// Limpar sessões órfãs
cleanup_orphaned_sessions({})
```

### **2. Envio de Mensagens**
```javascript
// Mensagem de texto
send_message({
  sessionId: "minha-sessao-1",
  jid: "5511999999999@s.whatsapp.net",
  message: "Olá! Mensagem via MCP"
})

// Enviar mídia
send_media({
  sessionId: "minha-sessao-1", 
  jid: "5511999999999@s.whatsapp.net",
  mediaType: "image",
  mediaUrl: "https://example.com/image.jpg",
  caption: "Imagem enviada via MCP"
})

// Responder mensagem
reply_message({
  sessionId: "minha-sessao-1",
  jid: "5511999999999@s.whatsapp.net", 
  messageId: "msg_123",
  message: "Respondendo via MCP"
})

// Mencionar todos no grupo
mention_all({
  sessionId: "minha-sessao-1",
  groupId: "120363043716731234@g.us",
  message: "Atenção @todos!"
})

// Reply inteligente com IA
smart_reply({
  sessionId: "minha-sessao-1",
  jid: "5511999999999@s.whatsapp.net",
  context: "Cliente perguntou sobre preços",
  tone: "professional",
  language: "pt"
})
```

### **3. Controles de Chat**
```javascript
// Marcar como lido
mark_read({
  sessionId: "minha-sessao-1",
  jid: "5511999999999@s.whatsapp.net",
  messageIds: ["msg_123", "msg_124"]
})

// Indicador de digitação
typing_indicator({
  sessionId: "minha-sessao-1", 
  jid: "5511999999999@s.whatsapp.net",
  isTyping: true
})
```

### **4. Operações de Mídia**
```javascript
// Download de mídia
download_media({
  sessionId: "minha-sessao-1",
  messageId: "msg_123",
  jid: "5511999999999@s.whatsapp.net"
})

// Listar downloads
list_downloads({
  sessionId: "minha-sessao-1" // opcional
})
```

### **5. Webhooks (Legacy)**
```javascript
// Webhook simples (antigo)
create_legacy_webhook({
  sessionId: "minha-sessao-1",
  url: "https://meusite.com/webhook",
  events: ["messages.upsert"]
})

// Ver webhook legacy
get_legacy_webhook({ sessionId: "minha-sessao-1" })

// Deletar webhook legacy  
delete_legacy_webhook({ sessionId: "minha-sessao-1" })
```

### **6. Webhooks Avançados (Múltiplos)**
```javascript
// Criar webhook avançado
create_webhook({
  sessionId: "minha-sessao-1",
  url: "https://meusite.com/webhook/priority1", 
  name: "Webhook Principal",
  priority: 1,
  events: ["messages.upsert", "connection.update"]
})

// Listar todos os webhooks
list_webhooks({ sessionId: "minha-sessao-1" })

// Atualizar webhook
update_webhook({
  sessionId: "minha-sessao-1",
  webhookId: "webhook_123",
  url: "https://novosite.com/webhook",
  name: "Webhook Atualizado",
  active: true
})

// Testar webhook
test_webhook({
  sessionId: "minha-sessao-1",
  webhookId: "webhook_123"
})
```

### **7. Gerenciamento de Grupos**
```javascript
// Criar grupo
create_group({
  sessionId: "minha-sessao-1",
  subject: "Meu Grupo MCP",
  participants: ["5511888888888@s.whatsapp.net", "5511777777777@s.whatsapp.net"]
})

// Info do grupo
get_group_info({
  sessionId: "minha-sessao-1",
  groupId: "120363043716731234@g.us"
})

// Listar grupos
list_groups({
  sessionId: "minha-sessao-1",
  limit: 50,
  search: "trabalho"
})

// Adicionar participantes
add_group_participants({
  sessionId: "minha-sessao-1", 
  groupId: "120363043716731234@g.us",
  participants: ["5511666666666@s.whatsapp.net"]
})

// Promover admins
promote_group_admins({
  sessionId: "minha-sessao-1",
  groupId: "120363043716731234@g.us", 
  participants: ["5511888888888@s.whatsapp.net"]
})

// Configurar grupo
update_group_settings({
  sessionId: "minha-sessao-1",
  groupId: "120363043716731234@g.us",
  setting: "announcement" // só admins enviam mensagens
})
```

## 🔐 Autenticação

### **API Token (Simples e Seguro)**
```bash
# Formato obrigatório: baileys_
Authorization: Bearer baileys_your_api_key_here
```

### **Validação Real da API**
- ✅ Prefixo `baileys_` obrigatório
- ✅ **Validação real** contra endpoint `/api/baileys/info`
- ✅ **Cache inteligente** (5 min para tokens válidos)
- ✅ Rate limiting por token
- ✅ Auto-limpeza de cache expirado
- ✅ Logs detalhados de autenticação

## 📚 Exemplo Prático Completo

```javascript
// 1. Criar sessão
const session = await mcp.callTool('create_session', {
  sessionId: 'bot-vendas-1'
});

// 2. Verificar status (aguardar QR code scan)
const status = await mcp.callTool('get_session_status', {
  sessionId: 'bot-vendas-1'
});
console.log('QR Code:', status.qr);

// 3. Configurar webhook
await mcp.callTool('create_webhook', {
  sessionId: 'bot-vendas-1',
  url: 'https://meubot.com/webhook',
  name: 'Bot Vendas',
  priority: 1,
  events: ['messages.upsert']
});

// 4. Criar grupo de trabalho
const group = await mcp.callTool('create_group', {
  sessionId: 'bot-vendas-1',
  subject: 'Equipe Vendas 2025',
  participants: [
    '5511888888888@s.whatsapp.net',
    '5511777777777@s.whatsapp.net'
  ]
});

// 5. Enviar mensagem de boas-vindas
await mcp.callTool('send_message', {
  sessionId: 'bot-vendas-1',
  jid: group.id,
  message: 'Bem-vindos ao grupo! Bot ativo via MCP 🤖'
});

// 6. Configurar como grupo apenas para admins
await mcp.callTool('update_group_settings', {
  sessionId: 'bot-vendas-1', 
  groupId: group.id,
  setting: 'announcement'
});
```

## ⚙️ Configuração Avançada

### **Rate Limiting Personalizado**
```bash
# Aumentar limite
RATE_LIMIT=200

# Timeout maior para uploads
API_TIMEOUT=60000
```

### **Multiple Environments**
```bash
# Development
BAILEYS_API_URL=http://localhost:3000
BAILEYS_API_KEY=baileys_dev_key

# Production  
BAILEYS_API_URL=https://api.meusite.com
BAILEYS_API_KEY=baileys_prod_key_super_secret
```

### **Debugging**
```bash
# Ver logs detalhados
NODE_ENV=development node mcp-server.js

# Debug de network
DEBUG=axios node mcp-server.js
```

## 🚨 Troubleshooting

### **1. Erro de Autenticação**
```bash
# Verificar API key
curl -H "Authorization: Bearer baileys_your_key" \
     http://localhost:3000/api/baileys/info

# ❌ Error: Token deve começar com 'baileys_'
# ❌ Error: Token inválido (falha na validação real)
# ✅ Success: Token válido e autenticado
```

**Logs do MCP Server:**
```
Validating API key: baileys_abc123...
API key validation result: VALID
🧹 Cleaned 2 expired tokens from cache
```

### **2. Rate Limit Exceeded**
```bash
# Aguardar reset (1 minuto) ou aumentar limite
RATE_LIMIT=500 node mcp-server.js
```

### **3. Session não encontrada**
```javascript
// Listar sessões ativas
const sessions = await mcp.callTool('list_sessions', {});
console.log('Sessões ativas:', sessions);
```

### **4. Endpoint não encontrado**
```javascript
// Verificar API info
const info = await mcp.callTool('get_api_info', {});
console.log('Endpoints disponíveis:', info.endpoints);
```

## 📈 Monitoramento

### **Logs de Segurança**
- ✅ Tentativas de auth inválidas
- ✅ Rate limiting ativado  
- ✅ Endpoints não encontrados
- ✅ Timeouts de API

### **Health Check**
```javascript
// Verificar se API está online
const health = await mcp.callTool('get_api_info', {});
if (health.success) {
  console.log('✅ API Online');
} else {
  console.log('❌ API Offline');
}
```

## 🤝 Contribuição

1. Fork o repositório
2. Crie sua feature branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🌟 Vantagens do JavaScript

- ✅ **Mais simples** - sem compilação TypeScript
- ✅ **Menos dependências** - apenas essenciais
- ✅ **Deploy fácil** - um arquivo JavaScript
- ✅ **Debug simples** - console.log e done
- ✅ **Performance** - JavaScript nativo
- ✅ **Compatibilidade** - Node.js puro

---

**FlowChat MCP Server JavaScript** - Simplicidade e poder para WhatsApp API! 🚀