const archiver = require('archiver');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * ZIP File Generator for Web Scraping Data
 */
class ZipGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'downloads', 'exports');
    this.compressionLevel = options.compressionLevel || 6;
    this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB
  }

  /**
   * Initialize output directory
   */
  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating output directory:', error);
      throw error;
    }
  }

  /**
   * Generate ZIP file with scraped data
   */
  async generateScrapingZip(data, options = {}) {
    await this.ensureOutputDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const urlHash = crypto.createHash('md5').update(data.url || 'unknown').digest('hex').substring(0, 8);
    const fileName = `scraped-${urlHash}-${timestamp}.zip`;
    const filePath = path.join(this.outputDir, fileName);

    const output = require('fs').createWriteStream(filePath);
    const archive = archiver('zip', {
      zlib: { level: this.compressionLevel }
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`✅ ZIP file created: ${fileName} (${archive.pointer()} bytes)`);
        resolve({
          fileName: fileName,
          filePath: filePath,
          size: archive.pointer(),
          url: `/downloads/exports/${fileName}`
        });
      });

      archive.on('error', (err) => {
        console.error('❌ ZIP creation error:', err);
        reject(err);
      });

      archive.pipe(output);

      // Add main data as JSON
      archive.append(JSON.stringify(data, null, 2), { name: 'scraped-data.json' });

      // Add HTML content if available
      if (data.rawHtml) {
        archive.append(data.rawHtml, { name: 'page.html' });
      }

      // Add text content
      if (data.content) {
        archive.append(data.content, { name: 'content.txt' });
      }

      // Add structured data
      if (data.jsonLd && data.jsonLd.length > 0) {
        archive.append(JSON.stringify(data.jsonLd, null, 2), { name: 'structured-data.json' });
      }

      // Add metadata
      const metadata = this.generateMetadata(data);
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      // Add CSV files for structured data
      if (data.tables && data.tables.length > 0) {
        data.tables.forEach((table, index) => {
          const csv = this.tableToCsv(table);
          archive.append(csv, { name: `table-${index + 1}.csv` });
        });
      }

      // Add links as CSV
      if (data.links && data.links.length > 0) {
        const linksCsv = this.linksToCsv(data.links);
        archive.append(linksCsv, { name: 'links.csv' });
      }

      // Add images list as CSV
      if (data.images && data.images.length > 0) {
        const imagesCsv = this.imagesToCsv(data.images);
        archive.append(imagesCsv, { name: 'images.csv' });
      }

      // Add readable HTML report
      const htmlReport = this.generateHtmlReport(data);
      archive.append(htmlReport, { name: 'report.html' });

      // Add README
      const readme = this.generateReadme(data);
      archive.append(readme, { name: 'README.md' });

      archive.finalize();
    });
  }

  /**
   * Generate ZIP file with search results
   */
  async generateSearchZip(searchData, options = {}) {
    await this.ensureOutputDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const queryHash = crypto.createHash('md5').update(searchData.query || 'search').digest('hex').substring(0, 8);
    const fileName = `search-${queryHash}-${timestamp}.zip`;
    const filePath = path.join(this.outputDir, fileName);

    const output = require('fs').createWriteStream(filePath);
    const archive = archiver('zip', {
      zlib: { level: this.compressionLevel }
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`✅ Search ZIP file created: ${fileName} (${archive.pointer()} bytes)`);
        resolve({
          fileName: fileName,
          filePath: filePath,
          size: archive.pointer(),
          url: `/downloads/exports/${fileName}`
        });
      });

      archive.on('error', (err) => {
        console.error('❌ Search ZIP creation error:', err);
        reject(err);
      });

      archive.pipe(output);

      // Add main search data as JSON
      archive.append(JSON.stringify(searchData, null, 2), { name: 'search-results.json' });

      // Add results as CSV
      if (searchData.results && searchData.results.length > 0) {
        const resultsCsv = this.searchResultsToCsv(searchData.results);
        archive.append(resultsCsv, { name: 'results.csv' });
      }

      // Add results by source
      const resultsBySource = this.groupResultsBySource(searchData.results || []);
      for (const [source, results] of Object.entries(resultsBySource)) {
        if (results.length > 0) {
          archive.append(JSON.stringify(results, null, 2), { name: `results-${source}.json` });
        }
      }

      // Add HTML report
      const htmlReport = this.generateSearchHtmlReport(searchData);
      archive.append(htmlReport, { name: 'search-report.html' });

      // Add README
      const readme = this.generateSearchReadme(searchData);
      archive.append(readme, { name: 'README.md' });

      archive.finalize();
    });
  }

  /**
   * Generate metadata object
   */
  generateMetadata(data) {
    return {
      url: data.url,
      title: data.title,
      scrapingDate: new Date().toISOString(),
      strategy: data.strategy,
      stats: data.stats,
      language: data.language,
      charset: data.charset,
      generatedBy: 'FlowChat API Web Scraper',
      version: '2.0.0'
    };
  }

  /**
   * Convert table to CSV
   */
  tableToCsv(table) {
    const rows = [];
    
    if (table.headers && table.headers.length > 0) {
      rows.push(table.headers.map(h => this.escapeCsv(h)).join(','));
    }
    
    if (table.rows && table.rows.length > 0) {
      table.rows.forEach(row => {
        rows.push(row.map(cell => this.escapeCsv(cell)).join(','));
      });
    }
    
    return rows.join('\n');
  }

  /**
   * Convert links to CSV
   */
  linksToCsv(links) {
    const headers = ['Text', 'URL', 'Is External'];
    const rows = [headers.join(',')];
    
    links.forEach(link => {
      const row = [
        this.escapeCsv(link.text || ''),
        this.escapeCsv(link.url || ''),
        this.escapeCsv(link.isExternal ? 'Yes' : 'No')
      ].join(',');
      rows.push(row);
    });
    
    return rows.join('\n');
  }

  /**
   * Convert images to CSV
   */
  imagesToCsv(images) {
    const headers = ['URL', 'Alt Text', 'Title', 'Width', 'Height'];
    const rows = [headers.join(',')];
    
    images.forEach(img => {
      const row = [
        this.escapeCsv(img.src || ''),
        this.escapeCsv(img.alt || ''),
        this.escapeCsv(img.title || ''),
        this.escapeCsv(img.width || ''),
        this.escapeCsv(img.height || '')
      ].join(',');
      rows.push(row);
    });
    
    return rows.join('\n');
  }

  /**
   * Convert search results to CSV
   */
  searchResultsToCsv(results) {
    const headers = ['Title', 'URL', 'Snippet', 'Source', 'Relevance Score'];
    const rows = [headers.join(',')];
    
    results.forEach(result => {
      const row = [
        this.escapeCsv(result.title || ''),
        this.escapeCsv(result.url || ''),
        this.escapeCsv(result.snippet || ''),
        this.escapeCsv(result.source || ''),
        this.escapeCsv((result.relevanceScore || 0).toString())
      ].join(',');
      rows.push(row);
    });
    
    return rows.join('\n');
  }

  /**
   * Group search results by source
   */
  groupResultsBySource(results) {
    const grouped = {};
    
    results.forEach(result => {
      const source = result.source || 'unknown';
      if (!grouped[source]) {
        grouped[source] = [];
      }
      grouped[source].push(result);
    });
    
    return grouped;
  }

  /**
   * Escape CSV values
   */
  escapeCsv(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  /**
   * Generate HTML report for scraped data
   */
  generateHtmlReport(data) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Scraping Report - ${this.escapeHtml(data.title || 'Unknown')}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-box { background: #e9e9e9; padding: 15px; border-radius: 5px; text-align: center; }
        .content { background: #f9f9f9; padding: 15px; border-radius: 5px; max-height: 300px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .link { color: #0066cc; text-decoration: none; }
        .link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Web Scraping Report</h1>
        <p><strong>URL:</strong> <a href="${data.url}" class="link" target="_blank">${this.escapeHtml(data.url || '')}</a></p>
        <p><strong>Title:</strong> ${this.escapeHtml(data.title || 'Unknown')}</p>
        <p><strong>Scraped:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        <p><strong>Strategy:</strong> ${this.escapeHtml(data.strategy || 'Unknown')}</p>
    </div>

    ${data.stats ? `
    <div class="section">
        <h2>Statistics</h2>
        <div class="stats">
            <div class="stat-box">
                <h3>${data.stats.contentLength || 0}</h3>
                <p>Characters</p>
            </div>
            <div class="stat-box">
                <h3>${data.stats.wordCount || 0}</h3>
                <p>Words</p>
            </div>
            <div class="stat-box">
                <h3>${data.stats.totalLinks || 0}</h3>
                <p>Links</p>
            </div>
            <div class="stat-box">
                <h3>${data.stats.totalImages || 0}</h3>
                <p>Images</p>
            </div>
        </div>
    </div>
    ` : ''}

    ${data.content ? `
    <div class="section">
        <h2>Main Content</h2>
        <div class="content">
            ${this.escapeHtml(data.content.substring(0, 2000))}${data.content.length > 2000 ? '...' : ''}
        </div>
    </div>
    ` : ''}

    ${data.headings ? `
    <div class="section">
        <h2>Headings Structure</h2>
        <div class="content">
            ${Object.entries(data.headings).map(([level, headings]) => 
              headings.length > 0 ? `<p><strong>${level.toUpperCase()}:</strong> ${headings.map(h => this.escapeHtml(h)).join(', ')}</p>` : ''
            ).join('')}
        </div>
    </div>
    ` : ''}

    ${data.links && data.links.length > 0 ? `
    <div class="section">
        <h2>Links (Top 10)</h2>
        <table>
            <thead>
                <tr>
                    <th>Text</th>
                    <th>URL</th>
                    <th>External</th>
                </tr>
            </thead>
            <tbody>
                ${data.links.slice(0, 10).map(link => `
                <tr>
                    <td>${this.escapeHtml(link.text || '')}</td>
                    <td><a href="${link.url}" class="link" target="_blank">${this.escapeHtml(link.url || '')}</a></td>
                    <td>${link.isExternal ? 'Yes' : 'No'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="section">
        <p><em>Generated by FlowChat API Web Scraper v2.0.0</em></p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate HTML report for search results
   */
  generateSearchHtmlReport(searchData) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Results Report - ${this.escapeHtml(searchData.query || 'Unknown')}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-box { background: #e9e9e9; padding: 15px; border-radius: 5px; text-align: center; }
        .result { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
        .result-title { color: #0066cc; font-size: 18px; margin-bottom: 5px; }
        .result-url { color: #006600; font-size: 14px; margin-bottom: 10px; }
        .result-snippet { color: #333; }
        .source-tag { background: #007acc; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Search Results Report</h1>
        <p><strong>Query:</strong> "${this.escapeHtml(searchData.query || '')}"</p>
        <p><strong>Searched:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        <p><strong>Sources:</strong> ${searchData.sources ? searchData.sources.join(', ') : 'None'}</p>
    </div>

    ${searchData.performance ? `
    <div class="section">
        <h2>Search Performance</h2>
        <div class="stats">
            <div class="stat-box">
                <h3>${searchData.total || 0}</h3>
                <p>Total Results</p>
            </div>
            <div class="stat-box">
                <h3>${searchData.sources ? searchData.sources.length : 0}</h3>
                <p>Sources Used</p>
            </div>
            <div class="stat-box">
                <h3>${searchData.performance.successRate || '0%'}</h3>
                <p>Success Rate</p>
            </div>
            <div class="stat-box">
                <h3>${searchData.duplicatesRemoved || 0}</h3>
                <p>Duplicates Removed</p>
            </div>
        </div>
    </div>
    ` : ''}

    <div class="section">
        <h2>Search Results</h2>
        ${searchData.results && searchData.results.length > 0 ? 
          searchData.results.map(result => `
            <div class="result">
                <div class="result-title">
                    <a href="${result.url}" target="_blank" style="color: #0066cc; text-decoration: none;">
                        ${this.escapeHtml(result.title || 'No title')}
                    </a>
                    <span class="source-tag">${result.source || 'unknown'}</span>
                </div>
                <div class="result-url">${this.escapeHtml(result.url || '')}</div>
                <div class="result-snippet">${this.escapeHtml(result.snippet || '')}</div>
            </div>
          `).join('') : 
          '<p>No results found.</p>'
        }
    </div>

    <div class="section">
        <p><em>Generated by FlowChat API Web Search v2.0.0</em></p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate README file for scraped data
   */
  generateReadme(data) {
    return `# Web Scraping Export

## Overview
This ZIP file contains data scraped from: ${data.url || 'Unknown URL'}

**Generated:** ${new Date().toISOString()}
**Strategy:** ${data.strategy || 'Unknown'}

## Files Included

- \`scraped-data.json\` - Complete scraped data in JSON format
- \`content.txt\` - Main text content
- \`metadata.json\` - Scraping metadata and statistics
- \`report.html\` - Visual HTML report (open in browser)
- \`README.md\` - This file

${data.tables && data.tables.length > 0 ? `
### Data Tables
${data.tables.map((_, index) => `- \`table-${index + 1}.csv\` - Extracted table data`).join('\n')}
` : ''}

${data.links && data.links.length > 0 ? '- `links.csv` - All extracted links\n' : ''}
${data.images && data.images.length > 0 ? '- `images.csv` - All extracted images\n' : ''}
${data.jsonLd && data.jsonLd.length > 0 ? '- `structured-data.json` - JSON-LD structured data\n' : ''}
${data.rawHtml ? '- `page.html` - Original HTML content\n' : ''}

## Statistics

${data.stats ? `
- **Content Length:** ${data.stats.contentLength || 0} characters
- **Word Count:** ${data.stats.wordCount || 0} words
- **Links:** ${data.stats.totalLinks || 0}
- **Images:** ${data.stats.totalImages || 0}
- **Tables:** ${data.stats.totalTables || 0}
- **Forms:** ${data.stats.totalForms || 0}
` : 'No statistics available'}

## Usage

1. Extract this ZIP file to a folder
2. Open \`report.html\` in your web browser for a visual overview
3. Import CSV files into spreadsheet applications
4. Use JSON files for programmatic data processing

## Generated By

FlowChat API Web Scraper v2.0.0
https://github.com/your-repo/flowchat-api`;
  }

  /**
   * Generate README file for search results
   */
  generateSearchReadme(searchData) {
    return `# Web Search Export

## Overview
This ZIP file contains search results for: "${searchData.query || 'Unknown Query'}"

**Generated:** ${new Date().toISOString()}
**Sources Used:** ${searchData.sources ? searchData.sources.join(', ') : 'None'}

## Files Included

- \`search-results.json\` - Complete search data in JSON format
- \`results.csv\` - Search results in CSV format
- \`search-report.html\` - Visual HTML report (open in browser)
- \`README.md\` - This file

${searchData.sources ? searchData.sources.map(source => `- \`results-${source}.json\` - Results from ${source}`).join('\n') : ''}

## Search Statistics

${searchData.performance ? `
- **Total Results:** ${searchData.total || 0}
- **Sources Attempted:** ${searchData.performance.sourcesAttempted || 0}
- **Sources Successful:** ${searchData.performance.sourcesSuccessful || 0}
- **Success Rate:** ${searchData.performance.successRate || '0%'}
- **Duplicates Removed:** ${searchData.duplicatesRemoved || 0}
` : 'No statistics available'}

## Sources

${searchData.sources && searchData.sources.length > 0 ? 
  searchData.sources.map(source => `- ${source}`).join('\n') : 
  'No successful sources'}

${searchData.errors && searchData.errors.length > 0 ? `
## Errors
${searchData.errors.map(error => `- ${error.source}: ${error.error}`).join('\n')}
` : ''}

## Usage

1. Extract this ZIP file to a folder
2. Open \`search-report.html\` in your web browser for a visual overview
3. Import \`results.csv\` into spreadsheet applications
4. Use JSON files for programmatic data processing

## Generated By

FlowChat API Web Search v2.0.0
https://github.com/your-repo/flowchat-api`;
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Clean up old ZIP files
   */
  async cleanupOldFiles(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
    try {
      const files = await fs.readdir(this.outputDir);
      const now = Date.now();
      
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(this.outputDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            console.log(`🗑️ Cleaned up old ZIP file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

module.exports = ZipGenerator;