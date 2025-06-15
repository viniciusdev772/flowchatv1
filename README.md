# Baileys Multi-Session WhatsApp API

API avançada do WhatsApp com Baileys, multi-sessões, comportamento humano e gerenciamento completo de grupos.

## 🚀 Estrutura do Projeto

```
baileys/
├── main.js                 # Entry point principal
├── package.json            # Dependências e scripts
├── src/                    # Código fonte
│   ├── app.js             # Aplicação Express principal
│   ├── api/               # Rotas da API
│   │   └── groups.js      # API de gerenciamento de grupos
│   ├── config/            # Configurações
│   │   └── swagger.js     # Documentação Swagger
│   └── utils/             # Utilitários (vazio por enquanto)
├── auth_sessions/          # Sessões de autenticação do WhatsApp
├── uploads/               # Arquivos enviados
└── downloads/             # Mídias baixadas
```

## 📦 Instalação

```bash
npm install
```

## 🔧 Scripts Disponíveis

```bash
# Iniciar em produção
npm start

# Desenvolvimento com hot reload
npm run dev

# Monitoramento (mesmo que dev)
npm run monitor
```

## 🎯 Funcionalidades Principais

### 📱 Gerenciamento de Sessões
- Criação e gerenciamento de múltiplas sessões
- QR Code para autenticação
- Reconexão automática
- Status detalhado de cada sessão

### 💬 Mensagens
- Envio de mensagens de texto
- Envio de mídias (imagem, vídeo, áudio, documento)
- Resposta inteligente com comportamento humano
- Reply por ID de mensagem
- Controle de digitação e leitura

### 👥 Grupos (NOVO!)
- **Criar grupo** - `POST /api/baileys/groups/{sessionId}/create`
- **Obter informações** - `GET /api/baileys/groups/{sessionId}/{groupId}/info`
- **Adicionar participantes** - `POST /api/baileys/groups/{sessionId}/{groupId}/add-participants`
- **Remover/banir participantes** - `POST /api/baileys/groups/{sessionId}/{groupId}/remove-participants`
- **Promover a admin** - `POST /api/baileys/groups/{sessionId}/{groupId}/promote`
- **Despromover admin** - `POST /api/baileys/groups/{sessionId}/{groupId}/demote`
- **Atualizar nome** - `PUT /api/baileys/groups/{sessionId}/{groupId}/subject`
- **Atualizar descrição** - `PUT /api/baileys/groups/{sessionId}/{groupId}/description`
- **Configurar permissões** - `PUT /api/baileys/groups/{sessionId}/{groupId}/settings`
- **Sair do grupo** - `POST /api/baileys/groups/{sessionId}/{groupId}/leave`
- **Listar grupos** - `GET /api/baileys/groups/{sessionId}/list`
- **Código de convite** - `GET /api/baileys/groups/{sessionId}/{groupId}/invite-code`
- **Revogar convite** - `POST /api/baileys/groups/{sessionId}/{groupId}/revoke-invite`

### 🔗 Webhooks (NOVO! Sistema Múltiplo)
- **Até 3 webhooks por sessão** com prioridades
- Eventos em tempo real para todos os webhooks ativos
- Mídia automática em Base64
- Metadados enriquecidos
- Controle individual (ativar/desativar/testar)
- Sistema de eventos customizável
- Retrocompatibilidade com endpoints legados

### 🛡️ Segurança
- Rate limiting inteligente
- Comportamento humano simulado
- Prevenção de banimentos
- Tratamento robusto de erros

## 📚 Documentação

Acesse a documentação completa em:
- **Swagger UI**: http://localhost:3000/api-docs
- **API Info**: http://localhost:3000/api/baileys/info

## 🏃‍♂️ Início Rápido

1. **Clone e instale**:
```bash
git clone <repo>
cd baileys
npm install
```

2. **Inicie o servidor**:
```bash
npm run dev
```

3. **Crie uma sessão**:
```bash
curl -X POST http://localhost:3000/api/baileys/session/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "minha-sessao"}'
```

4. **Escaneie o QR Code** no WhatsApp Web

5. **Crie um grupo**:
```bash
curl -X POST http://localhost:3000/api/baileys/groups/minha-sessao/create \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Meu Grupo Teste",
    "participants": ["5511999999999"],
    "description": "Grupo criado via API"
  }'
```

## 🔧 Tecnologias

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Baileys** - Biblioteca WhatsApp Web
- **Swagger** - Documentação da API
- **Pino** - Logger estruturado
- **Multer** - Upload de arquivos
- **QRCode** - Geração de QR codes

## 📝 Logs Limpos

Os logs agora estão configurados para UTF-8 sem emojis problemáticos:

```
API Baileys rodando na porta 3000
Acesse http://localhost:3000/api/info para ver informações da API
Diretórios criados e API pronta para uso!
Carregando sessões existentes...
Encontradas 0 sessões para recuperar
Carregamento de sessões concluído!
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.