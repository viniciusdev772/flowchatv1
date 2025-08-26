# 📄 Gerador de PDF - FlowChat API

Este script converte a documentação de deploy (`DEPLOYMENT_GUIDE.md`) para um arquivo PDF profissional.

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
# Instalar dependências necessárias
npm install marked puppeteer

# Ou usando o script
npm run install-deps
```

### 2. Gerar PDF

```bash
# Executar o conversor
node pdf-converter.js

# Ou usando npm script
npm run generate-pdf
```

### 3. Resultado

O arquivo `DEPLOYMENT_GUIDE.pdf` será gerado no diretório atual com:

- ✅ **Design profissional** com cores e tipografia otimizada
- ✅ **Syntax highlighting** para blocos de código
- ✅ **Cabeçalho e rodapé** com numeração de páginas
- ✅ **Quebras de página** automáticas e inteligentes
- ✅ **Badges coloridos** para status e avisos
- ✅ **Layout responsivo** otimizado para impressão

## 📦 Dependências

- **marked**: Para converter Markdown para HTML
- **puppeteer**: Para gerar PDF usando Chromium

## 🎨 Características do PDF

### Estilização
- **Fonte**: System fonts (Apple/Windows/Linux)
- **Layout**: A4 com margens otimizadas
- **Cores**: Palette azul/cinza profissional
- **Código**: Syntax highlighting escuro

### Elementos Especiais
- **Badges**: Status coloridos (✅⚠️❌)
- **Alertas**: Caixas destacadas para avisos importantes
- **Tabelas**: Formatação zebrada para melhor leitura
- **Links**: Preservados e destacados

## 🔧 Troubleshooting

### Erro: "Cannot find module"
```bash
# Instalar dependências
npm install marked puppeteer
```

### Erro: "DEPLOYMENT_GUIDE.md not found"
```bash
# Verificar se o arquivo existe
ls DEPLOYMENT_GUIDE.md

# Executar no diretório correto
```

### Puppeteer não funciona
```bash
# Linux: Instalar dependências do Chromium
sudo apt-get install -y libgbm-dev gconf-service libasound2-dev

# Windows: Executar como administrador
```

## 📋 Output Esperado

```
🚀 FlowChat API - PDF Converter
================================
📖 Lendo arquivo: DEPLOYMENT_GUIDE.md
🔄 Convertendo Markdown para HTML...
🌐 Iniciando Puppeteer...
📄 Gerando HTML...
🔧 Configurando opções do PDF...
📋 Gerando PDF...
✅ PDF gerado com sucesso!
📁 Arquivo: DEPLOYMENT_GUIDE.pdf
📊 Tamanho: 2.45 MB
📅 Data: 26/08/2025 00:59:23
🎉 Conversão concluída!
```

## 📝 Personalização

Para personalizar o PDF, edite as variáveis no `pdf-converter.js`:

```javascript
// Alterar arquivos
const INPUT_FILE = 'SEU_ARQUIVO.md';
const OUTPUT_FILE = 'SEU_PDF.pdf';

// Alterar CSS
const CSS_STYLES = `...`;
```

---

**🎯 Objetivo**: Gerar documentação PDF profissional para deploy do FlowChat API.