#!/usr/bin/env node

/**
 * FlowChat API - PDF Converter
 * Converte DEPLOYMENT_GUIDE.md para PDF usando puppeteer
 */

const fs = require('fs');
const path = require('path');

// Função para gerar TOC HTML
function generateTOC(toc) {
  if (toc.length === 0) return '';
  
  let tocHtml = `
    <div class="toc-page" style="page-break-after: always;">
      <h1 style="text-align: center; margin-bottom: 40px; border-bottom: none;">📖 Índice</h1>
      <div class="toc-content">
  `;
  
  toc.forEach((item, index) => {
    const dots = '·'.repeat(Math.max(50 - item.text.length, 10));
    const pageNum = index + 1; // Estimativa simples de páginas
    
    tocHtml += `
      <div class="toc-item toc-level-${item.level}">
        <a href="#${item.anchor}">
          <span class="toc-text">${item.text}</span>
          <span class="toc-dots">${dots}</span>
          <span class="toc-page">${pageNum}</span>
        </a>
      </div>
    `;
  });
  
  tocHtml += `
      </div>
    </div>
  `;
  
  return tocHtml;
}

async function convertToPDF() {
  try {
    // Verificar se marked e puppeteer estão instalados
    let marked, puppeteer;
    
    try {
      marked = require('marked');
      puppeteer = require('puppeteer');
    } catch (error) {
      console.error('❌ Dependências não encontradas!');
      console.log('📦 Instale as dependências:');
      console.log('   npm install marked puppeteer');
      console.log('   ou');
      console.log('   yarn add marked puppeteer');
      process.exit(1);
    }

    const INPUT_FILE = 'DEPLOYMENT_GUIDE.md';
    const OUTPUT_FILE = 'DEPLOYMENT_GUIDE.pdf';

    // CSS para estilizar o PDF
    const CSS_STYLES = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        line-height: 1.7;
        color: #1f2937;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        font-size: 14px;
        background: #ffffff;
      }
      
      h1 {
        color: #2563eb;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        border-bottom: 3px solid #2563eb;
        padding-bottom: 15px;
        font-size: 2.5em;
        font-weight: 700;
        margin-top: 40px;
        margin-bottom: 30px;
        page-break-before: always;
        text-align: center;
      }
      
      h1:first-child {
        page-break-before: auto;
        margin-top: 0;
      }
      
      h2 {
        color: #1f2937;
        background: linear-gradient(90deg, #f3f4f6, transparent);
        border-left: 5px solid #2563eb;
        padding: 15px 20px;
        margin: 35px -20px 20px -20px;
        font-size: 1.8em;
        font-weight: 600;
        border-radius: 8px;
        position: relative;
      }
      
      h2::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: 5px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        border-radius: 0 4px 4px 0;
      }
      
      h3 {
        color: #374151;
        margin-top: 25px;
        margin-bottom: 12px;
        font-size: 1.3em;
      }
      
      h4 {
        color: #4b5563;
        margin-top: 20px;
        margin-bottom: 10px;
        font-size: 1.1em;
      }
      
      p {
        margin-bottom: 15px;
        text-align: justify;
      }
      
      code {
        background-color: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
        font-size: 0.9em;
        color: #dc2626;
      }
      
      pre {
        background: linear-gradient(135deg, #1f2937, #111827);
        color: #f9fafb;
        padding: 24px;
        border-radius: 12px;
        overflow-x: auto;
        margin: 24px 0;
        font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
        font-size: 0.9em;
        line-height: 1.5;
        border-left: 4px solid #3b82f6;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        page-break-inside: avoid;
        position: relative;
      }
      
      pre::before {
        content: '💻 Code';
        position: absolute;
        top: 8px;
        right: 16px;
        background: #374151;
        color: #9ca3af;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.7em;
        font-weight: 500;
      }
      
      pre code {
        background: none;
        color: #f9fafb;
        padding: 0;
        border-radius: 0;
        font-size: inherit;
      }
      
      blockquote {
        border-left: 4px solid #fbbf24;
        background-color: #fffbeb;
        padding: 15px 20px;
        margin: 20px 0;
        font-style: italic;
        color: #92400e;
        border-radius: 4px;
      }
      
      ul, ol {
        padding-left: 30px;
        margin-bottom: 15px;
      }
      
      li {
        margin-bottom: 8px;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 0.9em;
      }
      
      th, td {
        border: 1px solid #d1d5db;
        padding: 12px;
        text-align: left;
      }
      
      th {
        background-color: #f3f4f6;
        font-weight: 600;
        color: #374151;
      }
      
      tr:nth-child(even) {
        background-color: #f9fafb;
      }
      
      .warning {
        background-color: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 6px;
        padding: 15px;
        margin: 20px 0;
        color: #92400e;
      }
      
      .info {
        background-color: #dbeafe;
        border: 1px solid #3b82f6;
        border-radius: 6px;
        padding: 15px;
        margin: 20px 0;
        color: #1e40af;
      }
      
      .success {
        background-color: #d1fae5;
        border: 1px solid #10b981;
        border-radius: 6px;
        padding: 15px;
        margin: 20px 0;
        color: #065f46;
      }
      
      /* Estilos para TOC (Índice) */
      .toc-page {
        background: linear-gradient(135deg, #f8fafc, #f1f5f9);
        padding: 40px;
        border-radius: 16px;
        margin: 20px 0;
      }
      
      .toc-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      }
      
      .toc-item {
        margin: 12px 0;
        border-bottom: 1px solid #f3f4f6;
        padding-bottom: 8px;
      }
      
      .toc-item:last-child {
        border-bottom: none;
      }
      
      .toc-item a {
        text-decoration: none;
        color: #374151;
        display: flex;
        align-items: center;
        font-weight: 500;
        transition: all 0.2s ease;
        padding: 8px 0;
      }
      
      .toc-item a:hover {
        color: #2563eb;
        background: #f8fafc;
        padding-left: 10px;
      }
      
      .toc-level-1 a {
        font-size: 1.1em;
        font-weight: 600;
        color: #1f2937;
      }
      
      .toc-level-2 a {
        font-size: 1em;
        color: #4b5563;
        padding-left: 20px;
      }
      
      .toc-text {
        flex-shrink: 0;
        margin-right: 10px;
      }
      
      .toc-dots {
        flex-grow: 1;
        color: #d1d5db;
        font-size: 0.8em;
        letter-spacing: 2px;
        overflow: hidden;
      }
      
      .toc-page {
        flex-shrink: 0;
        background: #2563eb;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: 600;
        margin-left: 10px;
      }
      
      /* Headers com links clicáveis */
      .header-1, .header-2, .header-3 {
        position: relative;
      }
      
      .header-1:hover::before, .header-2:hover::before, .header-3:hover::before {
        content: '🔗';
        position: absolute;
        left: -30px;
        opacity: 0.6;
        font-size: 0.8em;
      }
      
      @media print {
        @page {
          margin: 2cm;
          @bottom-center {
            content: "FlowChat API - Deployment Guide | Página " counter(page);
            font-size: 10px;
            color: #6b7280;
          }
        }
        
        body {
          font-size: 12px;
        }
        
        h1 {
          font-size: 1.8em;
        }
        
        h2 {
          font-size: 1.4em;
        }
        
        pre {
          font-size: 10px;
        }
      }
    </style>
    `;

    console.log('🚀 FlowChat API - PDF Converter');
    console.log('================================');
    
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`❌ Arquivo ${INPUT_FILE} não encontrado!`);
    }
    
    console.log(`📖 Lendo arquivo: ${INPUT_FILE}`);
    const markdownContent = fs.readFileSync(INPUT_FILE, 'utf8');
    
    console.log('🔄 Convertendo Markdown para HTML...');
    
    // Configurar marked com TOC personalizado
    const renderer = new marked.Renderer();
    const toc = [];
    
    // Capturar headers para TOC
    const originalHeading = renderer.heading;
    renderer.heading = function(text, level, raw) {
      // Garantir que text seja string
      const textStr = String(text || '');
      const anchor = textStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      
      // Adicionar ao TOC apenas h1 e h2
      if (level <= 2) {
        toc.push({
          text: textStr.replace(/[📋🌟⚡🔧🏗️🐳🔐📦🌐🔒📈🔧📡🤖🔄⚡📞]/g, '').trim(),
          level: level,
          anchor: anchor
        });
      }
      
      return `<h${level} id="${anchor}" class="header-${level}">${textStr}</h${level}>`;
    };
    
    marked.setOptions({
      renderer: renderer,
      breaks: true,
      gfm: true,
      headerIds: true,
      mangle: false
    });
    
    const htmlContent = marked.marked(markdownContent);
    
    // Gerar TOC HTML
    const tocHtml = generateTOC(toc);
    
    const fullHTML = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FlowChat API - Deployment Guide</title>
      <meta name="description" content="Guia completo para deploy da API WhatsApp mais avançada">
      <meta name="author" content="FlowChat API Team">
      ${CSS_STYLES}
    </head>
    <body>
      ${tocHtml}
      ${htmlContent}
      
      <!-- Navigation buttons -->
      <div style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
        <button onclick="window.scrollTo(0,0)" style="background: #2563eb; color: white; border: none; padding: 10px; border-radius: 50%; cursor: pointer; margin: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          ⬆️
        </button>
      </div>
    </body>
    </html>
    `;
    
    console.log('🌐 Iniciando Puppeteer...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    console.log('📄 Gerando HTML...');
    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });
    
    console.log('🔧 Configurando opções do PDF...');
    
    const pdfOptions = {
      path: OUTPUT_FILE,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; color: #6b7280; width: 100%; text-align: center; margin-top: 10px;">
          FlowChat API - Deployment Guide
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; color: #6b7280; width: 100%; text-align: center; margin-bottom: 10px;">
          Página <span class="pageNumber"></span> de <span class="totalPages"></span> | Generated on ${new Date().toLocaleDateString('pt-BR')}
        </div>
      `,
      printBackground: true,
      preferCSSPageSize: true
    };
    
    console.log('📋 Gerando PDF...');
    await page.pdf(pdfOptions);
    await browser.close();
    
    if (fs.existsSync(OUTPUT_FILE)) {
      const stats = fs.statSync(OUTPUT_FILE);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log('✅ PDF gerado com sucesso!');
      console.log(`📁 Arquivo: ${OUTPUT_FILE}`);
      console.log(`📊 Tamanho: ${fileSizeInMB} MB`);
      console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
      console.log('');
      console.log('🎉 Conversão concluída!');
      console.log('');
      console.log('📖 Para usar:');
      console.log('   node pdf-converter.js');
    } else {
      throw new Error('❌ Erro ao gerar PDF');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a conversão:', error.message);
    console.log('');
    console.log('🔧 Solução:');
    console.log('1. Instale as dependências: npm install marked puppeteer');
    console.log('2. Certifique-se de que DEPLOYMENT_GUIDE.md existe');
    console.log('3. Execute: node pdf-converter.js');
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  convertToPDF();
}

module.exports = { convertToPDF };