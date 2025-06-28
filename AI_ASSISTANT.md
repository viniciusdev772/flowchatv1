# 🤖 Assistente de IA - FlowChat API

Uma assistente de IA avançada integrada ao FlowChat API que permite gerenciar sessões WhatsApp, enviar mensagens, configurar webhooks e muito mais através de linguagem natural.

## 🚀 Características Principais

- **Conversação Natural**: Interaja com a API usando linguagem natural em português
- **Execução Real**: A IA executa ações reais no sistema, não simulações
- **Streaming em Tempo Real**: Respostas transmitidas em tempo real com animações estilo ChatGPT
- **Tools Funcionais**: 10+ ferramentas integradas para operações completas da API
- **Interface Moderna**: UI inspirada no ChatGPT com animações fluidas

## 🛠️ Configuração

### 1. Configurar OpenAI API Key

Você precisa de uma chave da OpenAI para usar a assistente:

1. Acesse [OpenAI Platform](https://platform.openai.com/api-keys)
2. Crie uma nova API key
3. Adicione no arquivo `.env`:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Instalar Dependências

```bash
npm install openai zod
```

### 3. Reiniciar o Servidor

```bash
npm run dev
```

## 🎯 Capacidades da IA

A assistente pode realizar as seguintes operações:

### 📱 Gerenciamento de Sessões
- ✅ Criar novas sessões WhatsApp
- ✅ Listar todas as sessões ativas
- ✅ Deletar sessões específicas
- ✅ Verificar status de conexão
- ✅ Obter QR codes para autenticação

### 💬 Mensagens
- ✅ Enviar mensagens para números específicos
- ✅ Buscar mensagens (em desenvolvimento)
- ✅ Verificar histórico de conversas

### 👥 Grupos
- ✅ Listar grupos da sessão
- ✅ Criar novos grupos
- ✅ Gerenciar participantes

### 🔗 Webhooks
- ✅ Configurar webhooks para eventos
- ✅ Definir prioridades de webhook
- ✅ Gerenciar URLs de callback

### 📊 Sistema
- ✅ Obter informações do sistema
- ✅ Verificar estatísticas de uso
- ✅ Monitorar performance

## 💻 Como Usar

### Acesso Direto
Visite: `http://localhost:3000/ai`

### Exemplos de Comandos

#### Gerenciamento de Sessões
```
"Criar uma nova sessão chamada 'vendas'"
"Listar todas as sessões ativas"
"Deletar a sessão 'teste'"
"Qual o status da sessão 'vendas'?"
"Preciso do QR code da sessão 'vendas'"
```

#### Envio de Mensagens
```
"Enviar 'Olá!' para o número 5511999999999 usando a sessão 'vendas'"
"Mandar uma mensagem de boas vindas para +55 11 98888-7777"
```

#### Grupos WhatsApp
```
"Criar um grupo chamado 'Equipe Vendas' com os números: 5511999999999, 5511888888888"
"Listar todos os grupos da sessão 'vendas'"
```

#### Webhooks
```
"Configurar webhook https://meusite.com/webhook para a sessão 'vendas'"
"Definir webhook com prioridade 1 para receber eventos"
```

#### Sistema
```
"Como está o sistema?"
"Quantas sessões estão ativas?"
"Mostrar informações do servidor"
```

## 🔧 API Endpoints

### POST /api/management/ai/chat
Endpoint principal para conversar com a IA

```javascript
{
  "message": "Criar nova sessão chamada teste",
  "conversation": [], // histórico opcional
  "stream": true // para respostas em streaming
}
```

### GET /api/management/ai/tools
Lista todas as ferramentas disponíveis

### GET /api/management/ai/health
Verifica saúde da assistente de IA

## 🎨 Interface

### Recursos da UI
- **Streaming em Tempo Real**: Texto aparece gradualmente como no ChatGPT
- **Animações de Pensamento**: Indicadores visuais quando a IA está processando
- **Execução de Tools**: Visualização em tempo real das ações executadas
- **Histórico Completo**: Conversa persistente durante a sessão
- **Quick Actions**: Botões com comandos comuns
- **Parar Streaming**: Possibilidade de interromper respostas longas

### Indicadores Visuais
- 🤖 **Avatar da IA**: Indica mensagens da assistente
- ⚡ **Indicador de Pensamento**: Quando a IA está processando
- 🔧 **Execução de Tools**: Mostra ações sendo executadas
- ✅ **Sucesso**: Ações completadas com êxito
- ❌ **Erro**: Falhas nas operações

## 🛡️ Segurança

- **Validação Zod**: Todos os parâmetros são validados com schemas Zod
- **Sanitização**: Inputs são sanitizados antes da execução
- **Rate Limiting**: Proteção contra spam de requisições
- **Logs Detalhados**: Todas as ações são registradas
- **Autenticação**: Integração com sistema de auth existente

## 🔍 Debugging

### Logs da IA
```bash
# Ver logs da assistente
npm run dev

# Os logs incluem:
# - Chamadas de tools executadas
# - Parâmetros validados
# - Resultados das operações
# - Erros detalhados
```

### Verificar Saúde
```bash
curl http://localhost:3000/api/management/ai/health
```

### Testar Tools Manualmente
```bash
curl -X GET http://localhost:3000/api/management/ai/tools
```

## 🚨 Resolução de Problemas

### IA Não Responde
1. Verificar se OPENAI_API_KEY está configurada
2. Confirmar conexão com internet
3. Verificar logs do servidor
4. Testar endpoint de health

### Erro de Autenticação OpenAI
```bash
# Verificar se a chave é válida
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

### Tools Não Funcionam
1. Verificar se as rotas da API Baileys estão funcionando
2. Testar endpoints manualmente
3. Verificar logs de erro
4. Confirmar sessões ativas

## 📈 Performance

### Otimizações Implementadas
- **Streaming**: Respostas em tempo real para melhor UX
- **Cache de Ferramentas**: Tools são carregadas uma única vez
- **Validação Eficiente**: Schemas Zod otimizados
- **Abort Controllers**: Possibilidade de cancelar requests
- **Memory Management**: Limpeza automática de recursos

### Monitoramento
- Tempo de resposta da IA
- Uso de tokens OpenAI
- Taxa de sucesso das operações
- Performance das tools

## 🔮 Roadmap

### Próximas Funcionalidades
- [ ] Busca inteligente em mensagens
- [ ] Análise de sentimentos
- [ ] Agendamento de mensagens
- [ ] Relatórios automáticos
- [ ] Integração com ChatGPT-4 Vision
- [ ] Suporte a múltiplos idiomas
- [ ] Templates de mensagens IA

### Melhorias Planejadas
- [ ] Voice-to-text para comandos
- [ ] Sugestões contextuais
- [ ] Histórico persistente
- [ ] Exportação de conversas
- [ ] API webhooks para IA

## 📞 Suporte

Para dúvidas sobre a assistente de IA:

1. Verifique este documento
2. Teste o endpoint de health
3. Consulte os logs do servidor
4. Acesse a documentação da API em `/api-docs`

---

**Nota**: A assistente de IA executa ações reais na API. Use com cuidado em ambientes de produção.