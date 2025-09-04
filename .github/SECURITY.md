# 🛡️ Política de Segurança - FlowChat API

## 📋 Versões Suportadas

Atualmente oferecemos suporte de segurança para as seguintes versões:

| Versão | Suportada          |
| ------ | ------------------ |
| 1.0.x  | ✅ Sim            |
| < 1.0  | ❌ Não            |

## 🚨 Reportando Vulnerabilidades

A segurança é uma prioridade máxima para a FlowChat API. Se você descobrir uma vulnerabilidade de segurança, siga estas diretrizes:

### 🔒 Para Vulnerabilidades Sensíveis

**NÃO** abra uma issue pública. Em vez disso:

1. **Envie um email privado** para: **vinil6006@gmail.com**
2. **Inclua no assunto**: `[SECURITY] FlowChat API - Vulnerabilidade`
3. **Forneça detalhes completos**:
   - Descrição da vulnerabilidade
   - Passos para reproduzir
   - Impacto potencial
   - Versão afetada
   - Prova de conceito (se aplicável)

### ⏰ Tempo de Resposta

- **Confirmação**: 24-48 horas
- **Análise inicial**: 3-7 dias
- **Correção**: 7-30 dias (dependendo da gravidade)
- **Divulgação pública**: Após correção estar disponível

### 🏆 Reconhecimento

Contribuidores que reportam vulnerabilidades legítimas serão:
- Reconhecidos publicamente (se desejarem)
- Creditados no changelog de segurança
- Adicionados ao hall da fama de segurança

## 🔐 Práticas de Segurança Implementadas

### Autenticação e Autorização
- ✅ Sistema de autenticação dupla (JWT + API Tokens)
- ✅ Tokens com prefixo "baileys_" para identificação
- ✅ Validação de propriedade de sessão
- ✅ Middleware de autenticação em todas as rotas protegidas

### Proteção de Dados
- ✅ Senhas hasheadas com bcrypt
- ✅ Sanitização de entrada com express-mongo-sanitize
- ✅ Validação rigorosa de parâmetros
- ✅ Não exposição de informações sensíveis em logs

### Segurança de Rede
- ✅ Cabeçalhos de segurança com Helmet
- ✅ Proteção CSRF implementada
- ✅ CORS configurado adequadamente
- ✅ Rate limiting (recomendado para produção)

### Segurança de Arquivos
- ✅ Validação de tipos de arquivo em uploads
- ✅ Sanitização de nomes de arquivo
- ✅ Limitação de tamanho de uploads
- ✅ Armazenamento seguro em diretórios controlados

### Logs e Monitoramento
- ✅ Logging estruturado com Pino
- ✅ Não exposição de dados sensíveis em logs
- ✅ Monitoramento de tentativas de autenticação
- ✅ Health checks para detecção de anomalias

## 🚫 Vulnerabilidades NÃO Cobertas

As seguintes questões **não** são consideradas vulnerabilidades de segurança:

### Configuração de Ambiente
- Uso de credenciais padrão ou fracas (responsabilidade do usuário)
- Configuração inadequada de firewall/rede
- Uso em ambiente de desenvolvimento não seguro

### Limitações Conhecidas
- Rate limiting não configurado (deve ser implementado em produção)
- MongoDB sem autenticação (configuração de ambiente)
- Execução sem HTTPS (configuração de deploy)

### Fora do Escopo
- Ataques de engenharia social
- Vulnerabilidades em dependências de terceiros (reporte ao fornecedor)
- DoS através de uso legítimo intensivo

## 📋 Checklist de Segurança para Deploy

### ✅ Configuração Obrigatória
- [ ] Variáveis de ambiente com valores seguros
- [ ] MongoDB com autenticação habilitada
- [ ] HTTPS configurado (certificado SSL válido)
- [ ] Firewall configurado (portas necessárias apenas)

### ✅ Configuração Recomendada
- [ ] Rate limiting implementado
- [ ] Logs centralizados e monitorados
- [ ] Backups automáticos configurados
- [ ] Monitoramento de recursos do sistema

### ✅ Hardening de Sistema
- [ ] Sistema operacional atualizado
- [ ] Usuário não-root para execução
- [ ] Permissões de arquivo adequadas
- [ ] Serviços desnecessários desabilitados

## 🛠️ Ferramentas de Segurança Recomendadas

### Análise de Código
```bash
# Audit de dependências NPM
npm audit

# Scan de vulnerabilidades
npm audit fix
```

### Testes de Penetração
Para organizações que desejam realizar testes de penetração:
1. Entre em contato antes: vinil6006@gmail.com
2. Defina escopo e limitações
3. Use ambiente de teste isolado
4. Compartilhe resultados responsavelmente

## 🔄 Atualizações de Segurança

### Como se Manter Informado
- ⭐ **Star o repositório** para notificações
- 👁️ **Watch releases** para updates
- 📧 **Subscribe** nas issues de segurança

### Tipos de Update
- 🔥 **Critical**: Correção imediata necessária
- 🟡 **High**: Atualize em 7 dias
- 🟢 **Medium/Low**: Atualize na próxima manutenção

## 📞 Contato de Segurança

**Email Seguro**: vinil6006@gmail.com
**Assunto**: `[SECURITY] FlowChat API - [TIPO]`

### Informações Úteis para Reports
- **Descrição clara** da vulnerabilidade
- **Passos detalhados** para reprodução
- **Impacto potencial** e cenários de exploração
- **Versão específica** afetada
- **Configurações de ambiente** relevantes

## 🙏 Agradecimentos

Agradecemos a todos os pesquisadores de segurança e contribuidores que ajudam a manter a FlowChat API segura para toda a comunidade.

### Hall da Fama de Segurança
*Aguardando os primeiros reports! 🏆*

---

**Lembre-se**: A segurança é responsabilidade compartilhada. Ajude-nos a manter este projeto seguro reportando vulnerabilidades responsavelmente.

*Última atualização: Janeiro 2025*