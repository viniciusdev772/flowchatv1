#!/usr/bin/env node

/**
 * Converte documentação Markdown para PDF
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

// Configuração do marked para melhor renderização
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  headerPrefix: 'header-'
});

// CSS para styling do PDF
const pdfStyles = `
<style>
  @page {
    margin: 2cm;
    size: A4;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: none;
    margin: 0;
    padding: 20px;
  }
  
  h1 {
    color: #2563eb;
    border-bottom: 3px solid #2563eb;
    padding-bottom: 10px;
    margin-top: 40px;
    page-break-before: always;
  }
  
  h1:first-child {
    page-break-before: auto;
    margin-top: 0;
  }
  
  h2 {
    color: #1e40af;
    border-bottom: 2px solid #93c5fd;
    padding-bottom: 5px;
    margin-top: 30px;
  }
  
  h3 {
    color: #1e3a8a;
    margin-top: 25px;
  }
  
  h4 {
    color: #1e40af;
    margin-top: 20px;
  }
  
  h5, h6 {
    color: #374151;
    margin-top: 15px;
  }
  
  code {
    background-color: #f3f4f6;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9em;
  }
  
  pre {
    background-color: #1f2937;
    color: #f9fafb;
    padding: 15px;
    border-radius: 8px;
    overflow-x: auto;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.85em;
    line-height: 1.4;
  }
  
  pre code {
    background: none;
    padding: 0;
    color: inherit;
  }
  
  blockquote {
    border-left: 4px solid #3b82f6;
    margin: 20px 0;
    padding: 10px 20px;
    background-color: #eff6ff;
    font-style: italic;
  }
  
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 20px 0;
    font-size: 0.9em;
  }
  
  th, td {
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
  }
  
  th {
    background-color: #f3f4f6;
    font-weight: 600;
  }
  
  tr:nth-child(even) {
    background-color: #f9fafb;
  }
  
  ul, ol {
    margin: 15px 0;
    padding-left: 25px;
  }
  
  li {
    margin: 5px 0;
  }
  
  .toc {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin: 30px 0;
    page-break-inside: avoid;
  }
  
  .toc h2 {
    margin-top: 0;
    color: #1e40af;
    border-bottom: 1px solid #cbd5e1;
  }
  
  .toc ul {
    margin: 10px 0;
  }
  
  .toc a {
    color: #2563eb;
    text-decoration: none;
  }
  
  .toc a:hover {
    text-decoration: underline;
  }
  
  .page-break {
    page-break-before: always;
  }
  
  .no-break {
    page-break-inside: avoid;
  }
  
  strong {
    color: #1f2937;
    font-weight: 600;
  }
  
  em {
    color: #374151;
  }
  
  hr {
    border: none;
    border-top: 2px solid #e5e7eb;
    margin: 30px 0;
  }
  
  .footer {
    position: fixed;
    bottom: 1cm;
    right: 1cm;
    font-size: 10px;
    color: #6b7280;
  }
  
  .header {
    position: fixed;
    top: 1cm;
    right: 1cm;
    font-size: 10px;
    color: #6b7280;
  }
  
  @media print {
    body {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
    }
    
    pre, blockquote, table {
      page-break-inside: avoid;
    }
    
    img {
      max-width: 100% !important;
      page-break-inside: avoid;
    }
  }
</style>
`;

async function convertMarkdownToPdf(inputFile, outputFile) {
  try {
    console.log('📖 Lendo arquivo Markdown...');
    const markdownContent = fs.readFileSync(inputFile, 'utf8');
    
    console.log('🔄 Convertendo Markdown para HTML...');
    const htmlContent = marked(markdownContent);
    
    // Criar HTML completo com estilos
    const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FlowChat API - Documentação Completa</title>
      ${pdfStyles}
    </head>
    <body>
      <div class="header">FlowChat API Documentation</div>
      ${htmlContent}
      <div class="footer">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>
    </body>
    </html>
    `;
    
    console.log('🚀 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    console.log('📄 Carregando conteúdo HTML...');
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    console.log('🖨️  Gerando PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2cm',
        right: '1.5cm',
        bottom: '2cm',
        left: '1.5cm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 10px; color: #6b7280; margin: 0 auto;">FlowChat API - Documentação Completa</div>',
      footerTemplate: '<div style="font-size: 10px; color: #6b7280; margin: 0 auto;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
      preferCSSPageSize: true
    });
    
    console.log('💾 Salvando PDF...');
    fs.writeFileSync(outputFile, pdfBuffer);
    
    await browser.close();
    
    console.log('✅ PDF criado com sucesso!');
    console.log(`📄 Arquivo: ${outputFile}`);
    console.log(`📊 Tamanho: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    return outputFile;
  } catch (error) {
    console.error('❌ Erro ao converter para PDF:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const inputFile = path.join(__dirname, 'FLOWCHAT_RECURSOS_COMPLETO.md');
  const outputFile = path.join(__dirname, 'FLOWCHAT_RECURSOS_COMPLETO.pdf');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Arquivo não encontrado: ${inputFile}`);
    process.exit(1);
  }
  
  convertMarkdownToPdf(inputFile, outputFile)
    .then(() => {
      console.log('🎉 Conversão concluída com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na conversão:', error.message);
      process.exit(1);
    });
}

module.exports = { convertMarkdownToPdf };