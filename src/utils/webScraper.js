const cheerio = require('cheerio');
const jsdom = require('jsdom');
const UserAgent = require('user-agents');
const retry = require('retry');
const { JSDOM } = jsdom;




class WebScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.userAgent = new UserAgent();
    this.strategies = ['cheerio', 'jsdom', 'fallback'];
  }




  async scrapeWithRetry(url, options = {}) {
    const operation = retry.operation({
      retries: this.maxRetries,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000,
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          console.log(`🔄 Scraping attempt ${currentAttempt} for: ${url}`);
          const result = await this.scrapeWithStrategies(url, options);
          resolve(result);
        } catch (error) {
          console.error(`❌ Attempt ${currentAttempt} failed:`, error.message);

          if (operation.retry(error)) {
            return;
          }


          try {
            const fallbackResult = await this.basicFallback(url);
            resolve(fallbackResult);
          } catch (fallbackError) {
            reject(operation.mainError());
          }
        }
      });
    });
  }




  async scrapeWithStrategies(url, options = {}) {
    const errors = [];

    for (const strategy of this.strategies) {
      try {
        console.log(`🔧 Trying strategy: ${strategy}`);
        const result = await this.executeStrategy(strategy, url, options);
        if (result && result.content && result.content.length > 100) {
          console.log(`✅ Strategy ${strategy} succeeded`);
          result.strategy = strategy;
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ Strategy ${strategy} failed:`, error.message);
        errors.push({ strategy, error: error.message });
      }
    }

    throw new Error(`All strategies failed: ${errors.map(e => `${e.strategy}: ${e.error}`).join(', ')}`);
  }




  async executeStrategy(strategy, url, options = {}) {
    switch (strategy) {
      case 'cheerio':
        return await this.scrapeWithCheerio(url, options);
      case 'jsdom':
        return await this.scrapeWithJSDOM(url, options);
      case 'fallback':
        return await this.scrapeWithBasicFetch(url, options);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }




  async scrapeWithCheerio(url, options = {}) {
    const fetch = require('node-fetch');
    const headers = this.getHeaders(options);

    const response = await fetch(url, {
      headers,
      timeout: this.timeout,
      follow: 5,
      compress: true,
      size: 50000000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xml')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    return this.extractData($, url, 'cheerio');
  }




  async scrapeWithJSDOM(url, options = {}) {
    const fetch = require('node-fetch');
    const headers = this.getHeaders(options);

    const response = await fetch(url, {
      headers,
      timeout: this.timeout,
      follow: 5,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    const dom = new JSDOM(html, {
      url: url,
      referrer: url,
      contentType: "text/html",
      includeNodeLocations: true,
      storageQuota: 10000000,
      runScripts: "outside-only"
    });

    const document = dom.window.document;

    return this.extractDataFromDOM(document, url, 'jsdom');
  }




  async scrapeWithBasicFetch(url, options = {}) {
    const fetch = require('node-fetch');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; FlowChatBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const response = await fetch(url, {
      headers,
      timeout: 15000,
      follow: 3,
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    return {
      url: url,
      title: $('title').text().trim() || 'No title',
      content: $('body').text().trim().substring(0, 2000),
      strategy: 'fallback',
      timestamp: new Date().toISOString(),
      success: true
    };
  }




  extractData($, url, strategy) {
    const title = $('title').text().trim() || 'No title';
    const description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') || '';


    const mainContent = this.extractMainContent($);


    const jsonLd = this.extractJsonLd($);
    const metaTags = this.extractMetaTags($);
    const headings = this.extractHeadings($);
    const links = this.extractLinks($, url);
    const images = this.extractImages($, url);
    const tables = this.extractTables($);
    const forms = this.extractForms($);


    const textContent = this.cleanTextContent(mainContent);

    return {
      url: url,
      title: title,
      description: description,
      content: textContent,


      jsonLd: jsonLd,
      metaTags: metaTags,


      headings: headings,
      links: links.slice(0, 20),
      images: images.slice(0, 15),
      tables: tables,
      forms: forms,


      language: $('html').attr('lang') || metaTags.language || 'unknown',
      charset: metaTags.charset || 'utf-8',


      stats: {
        totalLinks: links.length,
        totalImages: images.length,
        totalTables: tables.length,
        totalForms: forms.length,
        contentLength: textContent.length,
        wordCount: textContent.split(/\s+/).length,
        paragraphs: $('p').length,
      },


      strategy: strategy,
      timestamp: new Date().toISOString(),
      success: true
    };
  }




  extractDataFromDOM(document, url, strategy) {
    const title = document.title || 'No title';
    const metaDesc = document.querySelector('meta[name="description"]');
    const description = metaDesc ? metaDesc.getAttribute('content') : '';

    const textContent = document.body ? document.body.textContent.trim() : '';
    const cleanContent = this.cleanTextContent(textContent);

    return {
      url: url,
      title: title,
      description: description,
      content: cleanContent.substring(0, 5000),

      headings: {
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).slice(0, 5),
        h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).slice(0, 8),
        h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()).slice(0, 10),
      },

      stats: {
        contentLength: cleanContent.length,
        wordCount: cleanContent.split(/\s+/).length,
        links: document.querySelectorAll('a[href]').length,
        images: document.querySelectorAll('img[src]').length,
      },

      strategy: strategy,
      timestamp: new Date().toISOString(),
      success: true
    };
  }




  extractMainContent($) {
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main-content',
      '.container .content',
      '.post-body',
      '.article-body'
    ];

    let mainContent = '';


    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        mainContent = element.text().trim();
        if (mainContent.length > 200) {
          break;
        }
      }
    }


    if (!mainContent || mainContent.length < 200) {
      const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
      mainContent = paragraphs.join(' ');
    }


    if (!mainContent || mainContent.length < 100) {

      $('script, style, nav, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement, .social-share, .comments').remove();
      mainContent = $('body').text().trim();
    }

    return mainContent;
  }




  extractJsonLd($) {
    const jsonLdData = [];

    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const data = JSON.parse($(script).html());
        jsonLdData.push(data);
      } catch (error) {

      }
    });

    return jsonLdData;
  }




  extractMetaTags($) {
    const metaTags = {};

    $('meta').each((i, meta) => {
      const $meta = $(meta);
      const name = $meta.attr('name') || $meta.attr('property') || $meta.attr('http-equiv');
      const content = $meta.attr('content');

      if (name && content) {
        metaTags[name] = content;
      }
    });

    return metaTags;
  }




  extractHeadings($) {
    return {
      h1: $('h1').map((i, el) => $(el).text().trim()).get().slice(0, 5),
      h2: $('h2').map((i, el) => $(el).text().trim()).get().slice(0, 8),
      h3: $('h3').map((i, el) => $(el).text().trim()).get().slice(0, 10),
      h4: $('h4').map((i, el) => $(el).text().trim()).get().slice(0, 5),
      h5: $('h5').map((i, el) => $(el).text().trim()).get().slice(0, 5),
      h6: $('h6').map((i, el) => $(el).text().trim()).get().slice(0, 5),
    };
  }




  extractLinks($, baseUrl) {
    const links = [];

    $('a[href]').each((i, link) => {
      const $link = $(link);
      const href = $link.attr('href');
      const text = $link.text().trim();

      if (href && text && href.length > 1 && text.length > 1) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          links.push({
            text: text.substring(0, 100),
            url: absoluteUrl,
            isExternal: !absoluteUrl.includes(new URL(baseUrl).hostname)
          });
        } catch (error) {

        }
      }
    });

    return links;
  }




  extractImages($, baseUrl) {
    const images = [];

    $('img[src]').each((i, img) => {
      const $img = $(img);
      const src = $img.attr('src');
      const alt = $img.attr('alt') || '';
      const title = $img.attr('title') || '';

      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href;
          images.push({
            src: absoluteUrl,
            alt: alt.substring(0, 200),
            title: title.substring(0, 100),
            width: $img.attr('width') || null,
            height: $img.attr('height') || null,
          });
        } catch (error) {

        }
      }
    });

    return images;
  }




  extractTables($) {
    const tables = [];

    $('table').each((i, table) => {
      if (i >= 5) return false;

      const $table = $(table);
      const headers = $table.find('th').map((j, th) => $(th).text().trim()).get();
      const rows = [];

      $table.find('tr').each((j, tr) => {
        if (j >= 10) return false;

        const cells = $(tr).find('td').map((k, td) => $(td).text().trim()).get();
        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (headers.length > 0 || rows.length > 0) {
        tables.push({
          headers: headers,
          rows: rows,
          rowCount: rows.length,
          columnCount: Math.max(headers.length, ...rows.map(r => r.length))
        });
      }
    });

    return tables;
  }




  extractForms($) {
    const forms = [];

    $('form').each((i, form) => {
      const $form = $(form);
      const action = $form.attr('action') || '';
      const method = $form.attr('method') || 'GET';

      const inputs = $form.find('input').map((j, input) => {
        const $input = $(input);
        return {
          type: $input.attr('type') || 'text',
          name: $input.attr('name') || '',
          placeholder: $input.attr('placeholder') || '',
          required: $input.attr('required') !== undefined
        };
      }).get();

      forms.push({
        action: action,
        method: method.toUpperCase(),
        inputs: inputs,
        textareas: $form.find('textarea').length,
        selects: $form.find('select').length,
        buttons: $form.find('button, input[type="submit"]').length
      });
    });

    return forms;
  }




  cleanTextContent(text) {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/[^\w\s\-.,!?;:()\[\]"']/g, '') // Remove special chars
      .trim();
  }




  getHeaders(options = {}) {
    const userAgent = options.userAgent || this.userAgent.toString();

    return {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
      ...options.headers
    };
  }




  async basicFallback(url) {
    const fetch = require('node-fetch');

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot)' },
        timeout: 10000,
      });

      const text = await response.text();

      return {
        url: url,
        title: 'Basic Fallback',
        content: text.substring(0, 1000),
        strategy: 'basic-fallback',
        timestamp: new Date().toISOString(),
        success: true,
        warning: 'Used basic fallback due to scraping failures'
      };
    } catch (error) {
      throw new Error(`All scraping methods failed including basic fallback: ${error.message}`);
    }
  }
}

module.exports = WebScraper;