# 🤝 Guia de Contribuição - FlowChat API

Obrigado pelo interesse em contribuir com a FlowChat API! Este guia vai te ajudar a começar e entender como colaborar de forma efetiva.

## 🌟 Como Contribuir

Existem várias maneiras de contribuir com o projeto:

### 🐛 Reportando Bugs
- Use o [template de bug report](.github/ISSUE_TEMPLATE/bug_report.yml)
- Inclua informações detalhadas para reproduzir o problema
- Verifique se o bug já não foi reportado

### ✨ Sugerindo Funcionalidades
- Use o [template de feature request](.github/ISSUE_TEMPLATE/feature_request.yml)
- Descreva claramente a funcionalidade e o problema que ela resolve
- Considere diferentes abordagens para implementação

### ❓ Fazendo Perguntas
- Use o [template de question](.github/ISSUE_TEMPLATE/question.yml)
- Verifique primeiro a documentação e FAQ
- Seja específico sobre o que você quer alcançar

### 🔧 Contribuindo com Código
- Fork o repositório
- Crie uma branch para sua feature/fix
- Implemente suas mudanças
- Submeta um Pull Request

## 🚀 Configuração do Ambiente de Desenvolvimento

### 1. Fork e Clone
```bash
# Fork no GitHub, depois clone seu fork
git clone https://github.com/SEU-USERNAME/flowchatv1.git
cd flowchatv1

# Adicione o repositório original como upstream
git remote add upstream https://github.com/viniciusdev772/flowchatv1.git
```

### 2. Instale Dependências
```bash
npm install
```

### 3. Configure Ambiente
```bash
# Copie e configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações
```

### 4. Inicie em Desenvolvimento
```bash
npm run dev
```

## 📋 Diretrizes de Código

### 🏗️ Estrutura do Projeto
```
flowchat-api/
├── main.js                 # Entrada principal do servidor
├── src/
│   ├── app.js             # Lógica principal do Baileys
│   ├── config/            # Configurações (DB, Swagger)
│   ├── controllers/       # Lógica de negócio
│   ├── middleware/        # Middleware customizado
│   ├── routes/            # Definições de rotas
│   ├── api/               # Handlers específicos da API
│   ├── ai/                # Ferramentas e integração IA
│   ├── utils/             # Utilitários diversos
│   └── scheduler/         # Sistema de tarefas agendadas
└── .github/               # Templates e configurações GitHub
```

### ✅ Padrões de Código

#### **JavaScript/Node.js**
- Use `const` e `let` ao invés de `var`
- Prefira arrow functions quando apropriado
- Use template literals para strings complexas
- Implemente error handling adequado
- Documente funções complexas com JSDoc

```javascript
/**
 * Envia mensagem via WhatsApp
 * @param {string} sessionId - ID da sessão
 * @param {string} number - Número do destinatário
 * @param {string} message - Mensagem a ser enviada
 * @returns {Promise<Object>} Resultado do envio
 */
const sendMessage = async (sessionId, number, message) => {
  try {
    // Implementação
  } catch (error) {
    logger.error('Erro ao enviar mensagem:', error);
    throw error;
  }
};
```

#### **API Endpoints**
- Use HTTP methods apropriados (GET, POST, PUT, DELETE)
- Implemente validação de entrada
- Retorne status codes consistentes
- Use middleware para funcionalidades comuns

```javascript
// Bom exemplo
router.post('/session/:sessionId/send-message', 
  validateSession,
  validateInput(['number', 'message']),
  async (req, res) => {
    try {
      const result = await sendMessage(req.params.sessionId, req.body.number, req.body.message);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

#### **Error Handling**
- Use try/catch para operações assíncronas
- Log erros com contexto apropriado
- Retorne mensagens de erro consistentes
- Não exponha informações sensíveis

### 🎯 Convenções de Naming

- **Arquivos**: camelCase (`userController.js`)
- **Funções**: camelCase (`sendMessage`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Classes**: PascalCase (`WhatsAppSession`)
- **Rotas**: kebab-case (`/send-message`)

## 🧪 Testes

### Executando Testes
```bash
# Executar todos os testes (quando implementados)
npm test

# Executar testes específicos
npm test -- --grep "webhook"
```

### Escrevendo Testes
- Teste casos de sucesso e falha
- Use dados de teste realistas
- Mock dependências externas
- Mantenha testes isolados

```javascript
describe('sendMessage', () => {
  it('should send message successfully', async () => {
    // Arrange
    const sessionId = 'test-session';
    const number = '5511999999999';
    const message = 'Test message';
    
    // Act
    const result = await sendMessage(sessionId, number, message);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
  
  it('should handle invalid session', async () => {
    // Test error case
  });
});
```

## 📝 Documentação

### README.md
- Mantenha atualizado com novas funcionalidades
- Inclua exemplos práticos
- Atualize lista de endpoints

### JSDoc
- Documente funções públicas
- Inclua tipos de parâmetros e retorno
- Adicione exemplos quando útil

### Swagger/OpenAPI
- Documente novos endpoints
- Inclua exemplos de request/response
- Mantenha schemas atualizados

## 🔄 Fluxo de Trabalho Git

### 1. Crie uma Branch
```bash
git checkout -b feature/nova-funcionalidade
# ou
git checkout -b fix/corrigir-bug
```

### 2. Faça Commits Organizados
```bash
# Use commits descritivos
git add .
git commit -m "feat: adiciona endpoint para agendar mensagens

- Implementa POST /session/:id/schedule-message
- Adiciona validação de data futura
- Inclui testes unitários"
```

### 3. Mantenha Branch Atualizada
```bash
git fetch upstream
git rebase upstream/main
```

### 4. Push e Pull Request
```bash
git push origin feature/nova-funcionalidade
# Crie PR no GitHub usando o template
```

## 💡 Convenções de Commit

Use o padrão [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Mudanças na documentação
- `style:` Formatação (sem mudança de lógica)
- `refactor:` Refatoração de código
- `test:` Adiciona ou corrige testes
- `chore:` Mudanças de build/configuração

```bash
# Exemplos
feat: adiciona suporte a múltiplos webhooks por sessão
fix: corrige erro de timeout em downloads de mídia
docs: atualiza README com novos endpoints
refactor: reorganiza estrutura de rotas
test: adiciona testes para operações de grupo
chore: atualiza dependências do projeto
```

## 🎯 Áreas de Contribuição Prioritárias

### 🔥 Alta Prioridade
- **Testes Automatizados**: Cobertura de testes é limitada
- **Documentação API**: Exemplos mais detalhados
- **Performance**: Otimizações de banco e memória
- **Monitoramento**: Métricas e health checks

### 🟡 Média Prioridade
- **Novos Endpoints**: Funcionalidades WhatsApp adicionais
- **Integração IA**: Mais ferramentas e capacidades
- **UI/Dashboard**: Interface web para gerenciamento
- **Internacionalização**: Suporte a múltiplos idiomas

### 🟢 Baixa Prioridade (mas bem-vindas!)
- **DevOps**: Melhorias em Docker/CI/CD
- **Exemplos**: Mais exemplos de uso
- **Bibliotecas Client**: SDKs para diferentes linguagens
- **Plugins**: Sistema de extensões

## 🛡️ Segurança

### Diretrizes de Segurança
- Nunca commit credenciais ou tokens
- Valide todos os inputs de usuário
- Use HTTPS em produção
- Implemente rate limiting apropriado
- Sanitize dados antes de armazenar

### Reportando Vulnerabilidades
Para questões de segurança sensíveis, contate diretamente:
📧 **vinil6006@gmail.com**

## 📞 Comunicação

### Canais de Comunicação
- **Issues GitHub**: Para bugs e feature requests
- **Pull Requests**: Para discussão de código
- **Email**: vinil6006@gmail.com para contato direto

### Diretrizes de Comunicação
- Seja respeitoso e construtivo
- Forneça contexto suficiente
- Use português ou inglês
- Seja paciente com revisões

## 🎉 Reconhecimento

### Contributors
Todos os contribuidores são reconhecidos no projeto:
- Nome adicionado ao README
- Crédito em releases quando aplicável
- Gratidão eterna da comunidade! 🙏

### Como Ser um Bom Contributor
1. **Seja consistente**: Siga os padrões do projeto
2. **Seja colaborativo**: Ajude outros contributors
3. **Seja paciente**: Code review leva tempo
4. **Seja proativo**: Procure maneiras de melhorar
5. **Seja respeitoso**: Valorize todas as contribuições

## 📚 Recursos Úteis

### Documentação Técnica
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)

### Ferramentas Recomendadas
- **IDE**: VS Code com extensões Node.js
- **Testing**: Jest (quando implementado)
- **Debugging**: Node.js Inspector
- **API Testing**: Postman ou Insomnia

## ❓ FAQ para Contributors

### P: Como posso começar se sou iniciante?
**R:** Comece com issues marcadas como "good first issue" ou "help wanted". Documente-se sobre o projeto e não hesite em fazer perguntas!

### P: Quanto tempo leva para um PR ser revisado?
**R:** Geralmente 2-7 dias, dependendo da complexidade. PRs menores são revisados mais rapidamente.

### P: Posso trabalhar em uma feature grande?
**R:** Sim! Mas primeiro abra uma issue para discussão e divida em PRs menores quando possível.

### P: Como reporto um bug de segurança?
**R:** Para vulnerabilidades, use o email vinil6006@gmail.com ao invés de issue pública.

---

## 🙏 Agradecimentos

**Obrigado por contribuir com a FlowChat API!** 

Cada contribuição, não importa o tamanho, ajuda a tornar este projeto melhor para toda a comunidade. Juntos estamos construindo uma ferramenta incrível para automação WhatsApp!

💰 **Apoie o projeto**: PIX `vinil6006@gmail.com`
⭐ **Dê uma estrela**: Se o projeto te ajudou!
🗣️ **Compartilhe**: Conte para outros desenvolvedores!

---
*Última atualização: Janeiro 2025*