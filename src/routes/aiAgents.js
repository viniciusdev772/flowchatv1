const express = require('express');
const { z } = require('zod');
const database = require('../config/database');
const WebSearchEngine = require('../utils/webSearch');
const WebScraper = require('../utils/webScraper');
const HtmlAnalyzer = require('../utils/htmlAnalyzer');
const ZipGenerator = require('../utils/zipGenerator');
const router = express.Router();

// Using MongoDB only - no in-memory storage

// Zod validation schemas
const createAgentSchema = z.object({
  sessionId: z.string().min(1, 'Session ID é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().optional(),
  model: z.enum(['gpt-4.1', 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo']),
  personality: z.enum([
    'professional',
    'friendly',
    'creative',
    'analytical',
    'casual',
    'empathetic',
  ]),
  specialization: z.enum([
    'general',
    'sales',
    'support',
    'education',
    'health',
    'finance',
  ]),
  creativity: z.number().min(0).max(100),
  learningEnabled: z.boolean(),
  autoReply: z.boolean(),
  smartReplies: z.boolean(),
  openaiApiKey: z.string().min(1, 'Chave da API OpenAI é obrigatória'),
  tools: z.array(z.string()).default(['web_search', 'web_scrape', 'html_analysis', 'generate_zip']),
  replyToGroups: z.boolean().default(true), // Nova opção para responder grupos
});

// Web Search Tool - now implemented directly in OpenAI SDK calls

// Initialize utility instances
const webSearchEngine = new WebSearchEngine({
  timeout: 12000,
  maxRetries: 2,
  maxResultsPerSource: 6,
  maxTotalResults: 12
});

const webScraper = new WebScraper({
  timeout: 25000,
  maxRetries: 3
});

const htmlAnalyzer = new HtmlAnalyzer({
  timeout: 25000,
  maxRetries: 3
});

const zipGenerator = new ZipGenerator({
  outputDir: require('path').join(process.cwd(), 'downloads', 'exports'),
  compressionLevel: 6
});

// Enhanced web search with multiple sources and robust error handling
async function executeWebSearch(query) {
  try {
    console.log(`🔍 Starting enhanced multi-source search for: "${query}"`);
    const searchResults = await webSearchEngine.search(query);
    console.log(`✅ Search completed: ${searchResults.total} results from ${searchResults.sources.length} sources`);
    return JSON.stringify(searchResults);
  } catch (error) {
    console.error(`❌ Enhanced search failed: ${error.message}`);
    // Fallback to basic search
    return await executeBasicWebSearch(query);
  }
}

// Fallback basic web search
async function executeBasicWebSearch(query) {
  const fetch = require('node-fetch');
  const cheerio = require('cheerio');
  
  console.log(`🔍 AI Agent performing multi-source web search for: "${query}"`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

// Enhanced web scraping with robust error handling and multiple strategies  
async function executeWebScrape(url) {
  try {
    console.log(`🌐 Starting enhanced web scraping for: "${url}"`);
    const scrapedData = await webScraper.scrapeWithRetry(url, {
      includeRawHtml: true // Include raw HTML for ZIP generation
    });
    console.log(`✅ Scraping completed using strategy: ${scrapedData.strategy}`);
    return JSON.stringify(scrapedData);
  } catch (error) {
    console.error(`❌ Enhanced scraping failed: ${error.message}`);
    // Fallback to basic scraping
    return await executeBasicWebScrape(url);
  }
}

// Fallback basic web scraping
async function executeBasicWebScrape(url) {
  const fetch = require('node-fetch');
  const cheerio = require('cheerio');
  
  console.log(`🌐 AI Agent downloading website: "${url}"`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  try {
    // Validate URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }

    const response = await fetch(url, { 
      headers, 
      timeout: 15000,
      follow: 5, // Follow up to 5 redirects
      compress: true
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error(`Content type not supported: ${contentType}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract comprehensive information
    const pageData = {
      url: url,
      title: $('title').text().trim() || 'No title',
      description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
      
      // Text content
      headings: {
        h1: $('h1').map((i, el) => $(el).text().trim()).get().slice(0, 5),
        h2: $('h2').map((i, el) => $(el).text().trim()).get().slice(0, 8),
        h3: $('h3').map((i, el) => $(el).text().trim()).get().slice(0, 10)
      },
      
      // Main content - try to find article content
      content: extractMainContent($),
      
      // Links
      links: $('a[href]').map((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && text && href.startsWith('http')) {
          return { text, url: href };
        }
      }).get().slice(0, 10),
      
      // Images
      images: $('img[src]').map((i, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt') || '';
        if (src) {
          return { src: src.startsWith('http') ? src : new URL(src, url).href, alt };
        }
      }).get().slice(0, 8),
      
      // Meta information
      meta: {
        author: $('meta[name="author"]').attr('content') || $('meta[property="article:author"]').attr('content') || '',
        publishDate: $('meta[property="article:published_time"]').attr('content') || $('meta[name="date"]').attr('content') || '',
        keywords: $('meta[name="keywords"]').attr('content') || '',
        language: $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || ''
      },
      
      // Structure info
      structure: {
        totalLinks: $('a[href]').length,
        totalImages: $('img[src]').length,
        totalHeadings: $('h1, h2, h3, h4, h5, h6').length,
        hasNavigation: $('nav').length > 0,
        hasFooter: $('footer').length > 0,
        hasAside: $('aside').length > 0
      },
      
      timestamp: new Date().toISOString(),
      contentLength: html.length,
      textLength: $.text().length
    };

    console.log(`✅ Website downloaded successfully. Content: ${pageData.textLength} chars, ${pageData.structure.totalLinks} links, ${pageData.structure.totalImages} images`);
    
    return JSON.stringify(pageData);
    
  } catch (error) {
    console.error(`❌ Website download failed: ${error.message}`);
    return JSON.stringify({
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
}


// Helper function to extract main content from HTML
function extractMainContent($) {
  // Try different strategies to find main content
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
    '#main-content'
  ];
  
  let mainContent = '';
  
  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      mainContent = element.text().trim();
      if (mainContent.length > 100) { // If we found substantial content
        break;
      }
    }
  }
  
  // Fallback: get text from body, but clean it up
  if (!mainContent || mainContent.length < 100) {
    // Remove script, style, nav, footer, aside content
    $('script, style, nav, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement').remove();
    mainContent = $('body').text().trim();
  }
  
  // Clean up whitespace and limit length
  mainContent = mainContent.replace(/\s+/g, ' ').trim();
  
  // Return first 2000 characters to avoid overwhelming the AI
  return mainContent.substring(0, 2000) + (mainContent.length > 2000 ? '...' : '');
}

// Enhanced HTML analysis with specialized parsers
async function executeHtmlAnalysis(url, analysisType = 'general') {
  try {
    console.log(`🔍 Starting HTML analysis for: "${url}" (type: ${analysisType})`);
    const analysisResult = await htmlAnalyzer.analyze(url, analysisType);
    console.log(`✅ HTML analysis completed for ${analysisType} analysis`);
    return JSON.stringify(analysisResult);
  } catch (error) {
    console.error(`❌ HTML analysis failed: ${error.message}`);
    return JSON.stringify({
      error: error.message,
      url: url,
      analysisType: analysisType,
      timestamp: new Date().toISOString()
    });
  }
}

// Generate ZIP file with scraped data or search results
async function generateZipFile(data, type = 'scraping') {
  try {
    console.log(`📦 Generating ZIP file for ${type} data`);
    let zipResult;
    
    if (type === 'scraping' && data.url) {
      zipResult = await zipGenerator.generateScrapingZip(data);
    } else if (type === 'search' && data.query) {
      zipResult = await zipGenerator.generateSearchZip(data);
    } else {
      throw new Error('Invalid data type for ZIP generation. Requires scraping data with URL or search data with query.');
    }
    
    console.log(`✅ ZIP file created: ${zipResult.fileName}`);
    return JSON.stringify(zipResult);
  } catch (error) {
    console.error(`❌ ZIP generation failed: ${error.message}`);
    return JSON.stringify({
      error: error.message,
      type: type,
      timestamp: new Date().toISOString()
    });
  }
}

// Specific analysis functions
function analyzeNewsArticle($) {
  return {
    headline: $('h1').first().text().trim(),
    subheadline: $('h2').first().text().trim(),
    author: $('meta[name="author"]').attr('content') || $('.author').text().trim(),
    publishDate: $('meta[property="article:published_time"]').attr('content') || $('time').attr('datetime'),
    category: $('meta[property="article:section"]').attr('content') || $('.category').text().trim(),
    tags: $('meta[name="keywords"]').attr('content') || $('.tags').text().trim(),
    wordCount: $('article, .article-content, .post-content').text().trim().split(/\s+/).length,
    imageCount: $('article img, .article-content img').length,
    videoCount: $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
    hasComments: $('.comments, #comments, .comment-section').length > 0,
    socialSharing: $('[href*="facebook.com"], [href*="twitter.com"], [href*="whatsapp.com"]').length > 0
  };
}

function analyzeEcommercePage($) {
  return {
    productName: $('h1, .product-title, .product-name').first().text().trim(),
    price: $('.price, .product-price, [class*="price"]').first().text().trim(),
    description: $('.product-description, .product-summary').first().text().trim().substring(0, 500),
    images: $('img').length,
    reviews: $('.review, .rating, [class*="review"]').length,
    inStock: $('[class*="stock"], [class*="availability"]').text().toLowerCase().includes('stock'),
    addToCartButton: $('[class*="add-to-cart"], [class*="buy"], button[type="submit"]').length > 0,
    breadcrumbs: $('.breadcrumb, .breadcrumbs').text().trim(),
    category: $('.category, .product-category').text().trim(),
    brand: $('.brand, .product-brand').text().trim()
  };
}

function analyzeContactInfo($) {
  const text = $('body').text();
  return {
    emails: extractEmails(text),
    phones: extractPhones(text),
    addresses: extractAddresses($),
    socialMedia: extractSocialLinks($),
    contactForm: $('form[class*="contact"], form[id*="contact"]').length > 0,
    contactPage: $('a[href*="contact"]').length > 0,
    businessHours: extractBusinessHours(text),
    location: $('.address, .location, [class*="address"]').text().trim()
  };
}

function analyzeSocialMedia($) {
  return {
    platforms: {
      facebook: $('[href*="facebook.com"]').length,
      twitter: $('[href*="twitter.com"]').length,
      instagram: $('[href*="instagram.com"]').length,
      linkedin: $('[href*="linkedin.com"]').length,
      youtube: $('[href*="youtube.com"]').length,
      tiktok: $('[href*="tiktok.com"]').length,
      whatsapp: $('[href*="whatsapp.com"]').length
    },
    shareButtons: $('.share, [class*="share"]').length,
    socialLogin: $('[class*="social-login"], [class*="oauth"]').length > 0,
    embedPosts: $('blockquote[class*="twitter"], iframe[src*="facebook"], iframe[src*="instagram"]').length
  };
}

function analyzeForms($) {
  const forms = $('form');
  return {
    totalForms: forms.length,
    formTypes: forms.map((i, form) => {
      const $form = $(form);
      const action = $form.attr('action') || '';
      const method = $form.attr('method') || 'GET';
      const inputs = $form.find('input').length;
      const textareas = $form.find('textarea').length;
      const selects = $form.find('select').length;
      return {
        action,
        method,
        inputs,
        textareas,
        selects,
        hasSubmit: $form.find('input[type="submit"], button[type="submit"]').length > 0
      };
    }).get(),
    hasContactForm: $('form[class*="contact"], form[id*="contact"]').length > 0,
    hasSearchForm: $('form[class*="search"], form[id*="search"]').length > 0,
    hasLoginForm: $('form[class*="login"], form[id*="login"]').length > 0,
    hasRegistrationForm: $('form[class*="register"], form[id*="register"]').length > 0
  };
}

function analyzeGeneralStructure($) {
  return {
    title: $('title').text().trim(),
    headings: {
      h1: $('h1').length,
      h2: $('h2').length,
      h3: $('h3').length,
      h4: $('h4').length,
      h5: $('h5').length,
      h6: $('h6').length
    },
    content: {
      paragraphs: $('p').length,
      lists: $('ul, ol').length,
      tables: $('table').length,
      images: $('img').length,
      videos: $('video').length,
      iframes: $('iframe').length
    },
    navigation: {
      hasNav: $('nav').length > 0,
      menuItems: $('nav a, .menu a, .navigation a').length,
      hasBreadcrumbs: $('.breadcrumb, .breadcrumbs').length > 0
    },
    structure: {
      hasHeader: $('header').length > 0,
      hasFooter: $('footer').length > 0,
      hasAside: $('aside').length > 0,
      hasMain: $('main').length > 0,
      hasArticle: $('article').length > 0,
      hasSection: $('section').length > 0
    },
    forms: $('form').length,
    links: $('a[href]').length,
    externalLinks: $('a[href^="http"]').length,
    hasJavaScript: $('script').length,
    hasCSS: $('style, link[rel="stylesheet"]').length,
    language: $('html').attr('lang') || 'unknown'
  };
}

// Helper functions for contact analysis
function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

function extractPhones(text) {
  const phoneRegex = /(?:\+?55\s?)?(?:\(?[0-9]{2}\)?\s?)?(?:[0-9]{4,5}[-.\s]?[0-9]{4})/g;
  return text.match(phoneRegex) || [];
}

function extractAddresses($) {
  const addressSelectors = ['.address', '.location', '[class*="address"]', '[class*="location"]'];
  const addresses = [];
  
  addressSelectors.forEach(selector => {
    $(selector).each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 10) {
        addresses.push(text);
      }
    });
  });
  
  return addresses;
}

function extractSocialLinks($) {
  const socialPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'whatsapp'];
  const links = {};
  
  socialPlatforms.forEach(platform => {
    const link = $(`a[href*="${platform}.com"]`).first().attr('href');
    if (link) {
      links[platform] = link;
    }
  });
  
  return links;
}

function extractBusinessHours(text) {
  const hoursRegex = /(?:segunda|terça|quarta|quinta|sexta|sábado|domingo|seg|ter|qua|qui|sex|sab|dom).*?(?:[0-9]{1,2}:[0-9]{2}|[0-9]{1,2}h)/gi;
  return text.match(hoursRegex) || [];
}

  const allResults = [];
  const searchSources = [];
  const searchPromises = [];

  // Perform all searches in parallel for better performance
  searchPromises.push(
    searchDuckDuckGo(query, fetch, cheerio, headers)
      .then(results => ({ source: 'duckduckgo', results, emoji: '🦆' }))
      .catch(error => ({ source: 'duckduckgo', results: [], error: error.message, emoji: '🦆' }))
  );

  searchPromises.push(
    searchBing(query, fetch, cheerio, headers)
      .then(results => ({ source: 'bing', results, emoji: '🔍' }))
      .catch(error => ({ source: 'bing', results: [], error: error.message, emoji: '🔍' }))
  );

  searchPromises.push(
    searchYahoo(query, fetch, cheerio, headers)
      .then(results => ({ source: 'yahoo', results, emoji: '🟣' }))
      .catch(error => ({ source: 'yahoo', results: [], error: error.message, emoji: '🟣' }))
  );

  searchPromises.push(
    searchSearx(query, fetch, cheerio, headers)
      .then(results => ({ source: 'searx', results, emoji: '🌐' }))
      .catch(error => ({ source: 'searx', results: [], error: error.message, emoji: '🌐' }))
  );

  searchPromises.push(
    searchBrave(query, fetch, cheerio, headers)
      .then(results => ({ source: 'brave', results, emoji: '🦁' }))
      .catch(error => ({ source: 'brave', results: [], error: error.message, emoji: '🦁' }))
  );

  searchPromises.push(
    searchYandex(query, fetch, cheerio, headers)
      .then(results => ({ source: 'yandex', results, emoji: '🐻' }))
      .catch(error => ({ source: 'yandex', results: [], error: error.message, emoji: '🐻' }))
  );

  // Wait for all searches to complete (with timeout)
  const searchResponses = await Promise.allSettled(
    searchPromises.map(promise => 
      Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ])
    )
  );

  // Process results
  for (const response of searchResponses) {
    if (response.status === 'fulfilled') {
      const { source, results, error, emoji } = response.value;
      if (results && results.length > 0) {
        allResults.push(...results);
        searchSources.push(source);
        console.log(`${emoji} ${source}: ${results.length} results`);
      } else if (error) {
        console.error(`${emoji} ${source} search failed:`, error);
      }
    }
  }


  // Remove duplicates and limit results
  const uniqueResults = removeDuplicateResults(allResults);
  const finalResults = uniqueResults.slice(0, 12); // Max 12 results total

  const searchResults = {
    query,
    results: finalResults,
    timestamp: new Date().toISOString(),
    sources: searchSources,
    total: finalResults.length,
    totalFound: allResults.length,
    duplicatesRemoved: allResults.length - uniqueResults.length
  };

  console.log(`✅ Multi-source search completed: ${finalResults.length} unique results from ${searchSources.length} sources`);
  
  return JSON.stringify(searchResults);
}

// DuckDuckGo search function
async function searchDuckDuckGo(query, fetch, cheerio, headers) {
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, { headers, timeout: 8000 });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.result').each((i, elem) => {
    if (i >= 6) return false;
    
    const $elem = $(elem);
    const titleLink = $elem.find('.result__title a');
    const title = titleLink.text().trim();
    const url = titleLink.attr('href');
    const snippet = $elem.find('.result__snippet').text().trim();
    
    if (title && url && snippet) {
      results.push({
        title,
        snippet,
        url: url.startsWith('//') ? `https:${url}` : url,
        source: 'duckduckgo',
      });
    }
  });

  return results;
}

// Bing search function  
async function searchBing(query, fetch, cheerio, headers) {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=pt-BR`;
  const response = await fetch(searchUrl, { headers, timeout: 8000 });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.b_algo').each((i, elem) => {
    if (i >= 6) return false;
    
    const $elem = $(elem);
    const titleLink = $elem.find('h2 a');
    const title = titleLink.text().trim();
    const url = titleLink.attr('href');
    const snippet = $elem.find('.b_caption p, .b_snippet').first().text().trim();
    
    if (title && url && snippet) {
      results.push({
        title,
        snippet,
        url,
        source: 'bing',
      });
    }
  });

  return results;
}

// Yahoo search function
async function searchYahoo(query, fetch, cheerio, headers) {
  const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&ei=UTF-8&lang=pt-BR`;
  const response = await fetch(searchUrl, { headers, timeout: 8000 });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.algo').each((i, elem) => {
    if (i >= 5) return false;
    
    const $elem = $(elem);
    const titleLink = $elem.find('h3 a');
    const title = titleLink.text().trim();
    const url = titleLink.attr('href');
    const snippet = $elem.find('.compText').text().trim();
    
    if (title && url && snippet) {
      results.push({
        title,
        snippet,
        url,
        source: 'yahoo',
      });
    }
  });

  return results;
}

// Searx search function (open source metasearch engine)
async function searchSearx(query, fetch, cheerio, headers) {
  const searchUrl = `https://searx.be/search?q=${encodeURIComponent(query)}&language=pt-BR&format=html`;
  const response = await fetch(searchUrl, { headers, timeout: 8000 });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.result').each((i, elem) => {
    if (i >= 5) return false;
    
    const $elem = $(elem);
    const titleLink = $elem.find('h3 a');
    const title = titleLink.text().trim();
    const url = titleLink.attr('href');
    const snippet = $elem.find('.content').text().trim();
    
    if (title && url && snippet) {
      results.push({
        title,
        snippet,
        url,
        source: 'searx',
      });
    }
  });

  return results;
}

// Brave search function
async function searchBrave(query, fetch, cheerio, headers) {
  const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const response = await fetch(searchUrl, { headers, timeout: 8000 });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('[data-type="web"] .snippet').each((i, elem) => {
    if (i >= 5) return false;
    
    const $elem = $(elem);
    const titleLink = $elem.find('.snippet-title');
    const title = titleLink.text().trim();
    const url = titleLink.find('a').attr('href');
    const snippet = $elem.find('.snippet-description').text().trim();
    
    if (title && url && snippet) {
      results.push({
        title,
        snippet,
        url,
        source: 'brave',
      });
    }
  });

  return results;
}

// Yandex search function
async function searchYandex(query, fetch, cheerio, headers) {
  const searchUrl = `https://yandex.com/search/?text=${encodeURIComponent(query)}&lr=21601`; // lr=21601 for Brazil
  const response = await fetch(searchUrl, { headers, timeout: 8000 });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.organic').each((i, elem) => {
    if (i >= 5) return false;
    
    const $elem = $(elem);
    const titleLink = $elem.find('.organic__url');
    const title = $elem.find('.organic__title-wrapper').text().trim();
    const url = titleLink.attr('href');
    const snippet = $elem.find('.organic__text').text().trim();
    
    if (title && url && snippet) {
      results.push({
        title,
        snippet,
        url: url.startsWith('//') ? `https:${url}` : url,
        source: 'yandex',
      });
    }
  });

  return results;
}

// Remove duplicate results based on URL and title similarity
function removeDuplicateResults(results) {
  const seen = new Set();
  const unique = [];
  
  for (const result of results) {
    // Create a key based on normalized URL and title
    const urlKey = result.url.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
    const titleKey = result.title.toLowerCase().substring(0, 50);
    const key = `${urlKey}|${titleKey}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }
  
  return unique;
}

// AI Agent class
class AIAgent {
  constructor(config) {
    this.id = config.id || Date.now().toString();
    this.sessionId = config.sessionId;
    this.name = config.name;
    this.description = config.description;
    this.model = config.model;
    this.personality = config.personality;
    this.specialization = config.specialization;
    this.creativity = config.creativity;
    this.learningEnabled = config.learningEnabled;
    this.autoReply = config.autoReply;
    this.smartReplies = config.smartReplies;
    this.replyToGroups =
      config.replyToGroups !== undefined ? config.replyToGroups : true;
    this.openaiApiKey = config.openaiApiKey;
    this.enabledTools = config.tools || ['web_search'];
    this.isActive = config.isActive !== undefined ? config.isActive : true;
    this.createdAt = config.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.messageCount = config.messageCount || 0;
    // conversationHistory removed - now using MongoDB only for persistent history
  }

  // Method to send tool execution notifications to user
  async sendToolNotification(message, chatId, whatsappClient) {
    if (!whatsappClient || !chatId) {
      console.log(`📱 Tool notification (no WhatsApp client): ${message}`);
      return;
    }
    
    try {
      // Send typing indicator
      await whatsappClient.sendPresenceUpdate('composing', chatId);
      
      // Small delay for natural feeling
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send notification message
      await whatsappClient.sendMessage(chatId, { text: message });
      
      // Return to available presence
      await whatsappClient.sendPresenceUpdate('available');
      
      console.log(`📱 Tool notification sent: ${message}`);
    } catch (error) {
      console.error('Error sending tool notification:', error);
    }
  }

  async processMessage(messageData, whatsappClient = null) {
    try {
      this.messageCount++;
      this.updatedAt = new Date().toISOString();

      // Extract rich message information
      const messageText =
        messageData.content || messageData.text || messageData.body || '';
      const isGroup = messageData.chat?.isGroup || false;
      const senderInfo = messageData.sender || {};
      const chatInfo = messageData.chat || {};

      // Skip empty messages
      if (!messageText.trim()) {
        return { shouldReply: false };
      }

      // Verificação robusta de grupo usando funções oficiais da Baileys
      const {
        isJidGroup,
        isJidBroadcast,
        isJidStatusBroadcast,
        isJidNewsletter,
      } = require('@whiskeysockets/baileys');
      const chatJid = chatInfo.id;
      const isRealGroup =
        isJidGroup(chatJid) &&
        !isJidBroadcast(chatJid) &&
        !isJidStatusBroadcast(chatJid) &&
        !isJidNewsletter(chatJid);

      // Use verificação mais rigorosa
      const finalIsGroup = isGroup || isRealGroup;

      // Skip if agent doesn't want to reply to groups and this is a group message
      if (finalIsGroup && !this.replyToGroups) {
        console.log(
          `🚫 Agent ${this.id} SKIPPING group message from ${chatJid} (replyToGroups: false)`
        );
        console.log(
          `Group verification in processMessage: messageData.isGroup=${isGroup}, baileys.isJidGroup=${isRealGroup}, final=${finalIsGroup}`
        );
        return { shouldReply: false };
      } else if (finalIsGroup) {
        console.log(
          `✅ Agent ${this.id} PROCESSING group message from ${chatJid} (replyToGroups: true)`
        );
      }

      // Marcar mensagem(ns) como lida se cliente WhatsApp estiver disponível
      if (whatsappClient && this.autoReply) {
        try {
          // Se há múltiplas partes, marcar todas como lidas
          if (
            messageData.isMultiPart &&
            messageData.allMessageKeys &&
            messageData.allMessageKeys.length > 1
          ) {
            await whatsappClient.readMessages(messageData.allMessageKeys);
            console.log(
              `${messageData.allMessageKeys.length} messages marked as read (multi-part)`
            );
          } else if (messageData.messageId) {
            const key = {
              id: messageData.messageId,
              fromMe: false,
              remoteJid: chatInfo.id,
            };
            await whatsappClient.readMessages([key]);
            console.log(`Message marked as read: ${messageData.messageId}`);
          }
        } catch (readError) {
          console.error('Error marking message as read:', readError);
        }
      }

      // Create rich conversation entry with comprehensive context
      const conversationEntry = {
        type: 'user',
        content: messageText,
        timestamp: messageData.timestamp || new Date().toISOString(),
        messageId: messageData.messageId,
        sender: {
          id: senderInfo.id,
          pushName: senderInfo.pushName,
          isMe: senderInfo.isMe || false,
        },
        chat: {
          id: chatInfo.id,
          type: chatInfo.type || (finalIsGroup ? 'group' : 'private'),
          isGroup: finalIsGroup,
          name:
            chatInfo.name ||
            (finalIsGroup ? 'Grupo' : senderInfo.pushName || 'Contato'),
        },
        messageType: messageData.messageType || 'text',
        hasQuotedMessage: !!messageData.quotedMessage,
        // Additional context for better conversation continuity
        isMultiPart: messageData.isMultiPart || false,
        partCount: messageData.partCount || 1,
        contextData: {
          userAgent: 'whatsapp',
          platform: 'baileys',
          sessionId: this.sessionId,
        },
      };

      // Save to MongoDB instead of memory
      await this.saveConversationEntry(conversationEntry);

      // Generate AI response with rich context
      const response = await this.generateResponse(
        messageData,
        conversationEntry,
        whatsappClient
      );

      if (!response || response.trim() === '') {
        throw new Error('Empty response generated');
      }

      // Create response entry
      const responseEntry = {
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        inResponseTo: messageData.messageId,
        chat: conversationEntry.chat,
      };

      // Save AI response to MongoDB
      await this.saveConversationEntry(responseEntry);

      // Save updated agent state to database (async, don't wait)
      this.save().catch((err) =>
        console.error('Error saving agent state:', err)
      );

      return {
        response,
        replyToMessageId: messageData.messageId,
        shouldReply: true,
        chatId: chatInfo.id,
        isGroup: isGroup,
        senderInfo: senderInfo,
      };
    } catch (error) {
      console.error('Error processing message:', error);

      // Resposta de fallback baseada na personalidade do agente
      const fallbackResponses = {
        professional:
          'Sistema temporariamente indisponível. Posso ajudá-lo de outra forma?',
        friendly:
          'Opa! Algo deu errado aqui, mas estou pronto para conversar! Como posso ajudar?',
        creative:
          'Vamos tentar uma nova abordagem! Me conte o que você precisa.',
        analytical: 'Erro no processamento. Pode detalhar sua solicitação?',
        casual: 'Deu ruim aqui! Mas me fala aí, o que você precisa?',
        empathetic:
          'Entendo que isso pode ser frustrante. Vamos tentar de novo?',
      };

      return {
        response: fallbackResponses[this.personality] || 'Como posso ajudá-lo?',
        replyToMessageId: messageData.messageId,
        shouldReply: true,
      };
    }
  }

  async generateResponse(messageData, conversationEntry, whatsappClient = null) {
    try {
      const OpenAI = require('openai');

      // Validate API key
      if (!this.openaiApiKey || this.openaiApiKey.trim() === '') {
        console.error(
          `❌ Agent ${this.id} missing OpenAI API key - response generation failed`
        );
        throw new Error('OpenAI API key is required');
      }

      const openai = new OpenAI({
        apiKey: this.openaiApiKey,
        timeout: 30000,
      });

      // Log para debug
      console.log(
        `🤖 Agent ${this.id} generating response with model ${this.model}`
      );

      // Build context prompt with rich message information
      const personalityPrompts = {
        professional: 'Você é um assistente profissional, formal e objetivo.',
        friendly: 'Você é um assistente amigável, caloroso e acolhedor.',
        creative: 'Você é um assistente criativo, inovador e artístico.',
        analytical: 'Você é um assistente analítico, lógico e detalhado.',
        casual: 'Você é um assistente descontraído, informal e relaxado.',
        empathetic: 'Você é um assistente empático, compreensivo e sensível.',
      };

      const specializationPrompts = {
        general:
          'Você é um assistente geral capaz de ajudar com diversas tarefas.',
        sales:
          'Você é especializado em vendas e marketing, focado em conversão.',
        support:
          'Você é especializado em suporte ao cliente e resolução de problemas.',
        education: 'Você é especializado em educação e ensino.',
        health: 'Você é especializado em saúde e bem-estar.',
        finance: 'Você é especializado em finanças e consultoria.',
      };

      // Rich context information
      const isGroup = conversationEntry.chat.isGroup;
      const senderName = conversationEntry.sender.pushName || 'Usuário';
      const chatName = conversationEntry.chat.name || '';
      const messageType = conversationEntry.messageType || 'text';

      const multiPartInfo = messageData.isMultiPart
        ? `\n\nIMPORTANTE: Esta mensagem foi enviada em ${messageData.partCount} partes separadas e você está recebendo o texto completo combinado.`
        : '';

      const contextInfo = isGroup
        ? `\nContexto: Você está em um grupo "${chatName}". A mensagem foi enviada por ${senderName}.${multiPartInfo}`
        : `\nContexto: Você está em uma conversa privada com ${senderName}.${multiPartInfo}`;

      const systemPrompt = `${personalityPrompts[this.personality]} ${
        specializationPrompts[this.specialization]
      }

Nome: ${this.name}
${this.description ? `Descrição: ${this.description}` : ''}
${contextInfo}

FERRAMENTAS DISPONÍVEIS:
Você tem acesso a ferramentas que são executadas automaticamente pelo sistema quando você as solicita.

Ferramentas disponíveis:
- web_search: Busca informações atualizadas na internet via múltiplos buscadores
  Use quando precisar de: notícias atuais, preços, clima, eventos recentes, informações que podem estar desatualizadas

- web_scrape: Baixa e analisa o conteúdo completo de um site específico
  Use quando precisar de: conteúdo detalhado de uma página, estrutura de um site, análise completa de uma URL

- html_analysis: Analisa a estrutura HTML e extrai informações específicas de um site
  Use quando precisar de: análise especializada (notícias, e-commerce, contatos, redes sociais, formulários)
  Tipos disponíveis: 'news', 'ecommerce', 'contact', 'social', 'forms', 'general'

- generate_zip: Gera arquivo ZIP com dados coletados para download
  Use quando o usuário solicitar: exportação de dados, arquivo ZIP, download de resultados
  Tipos disponíveis: 'scraping' (dados de site), 'search' (resultados de pesquisa)

IMPORTANTE: Quando decidir usar uma ferramenta, informe ao usuário que está processando a solicitação antes de executar.

Regras importantes:
1. Sempre responda em português brasileiro
2. Seja útil e prestativo  
3. Mantenha o tom de acordo com sua personalidade
4. Seja conciso mas informativo
5. ${
        isGroup
          ? 'Quando em grupos, você pode se dirigir às pessoas pelo nome quando relevante'
          : 'Adapte suas respostas ao contexto da conversa privada'
      }
6. ${
        isGroup
          ? 'Em grupos, seja respeitoso com todos os participantes'
          : 'Mantenha uma conversa natural e personalizada'
      }
7. Use as ferramentas disponíveis quando apropriado para dar respostas mais precisas e atualizadas  
8. ${
        messageType !== 'text'
          ? `A mensagem recebida é do tipo: ${messageType}`
          : ''
      }
9. Quando usar ferramentas, primeiro avise o usuário que está buscando informações
10. Após obter resultados, forneça as informações de forma natural e útil`;

      const messageText =
        messageData.content || messageData.text || messageData.body || '';

      // Validate message content
      if (!messageText || messageText.trim() === '') {
        throw new Error('Empty message content');
      }

      // Prepare messages array for OpenAI API
      const messages = [{ role: 'system', content: systemPrompt }];

      // Load conversation history from MongoDB for context (reduced to 8 messages to save tokens)
      const recentHistory = await this.loadConversationHistory(
        conversationEntry.chat.id,
        8
      );
      console.log(
        `📚 Loaded ${recentHistory.length} previous messages for context from chat ${conversationEntry.chat.id}`
      );

      // Add conversation history for context (with token optimization)
      let totalTokensEstimate = 0;
      recentHistory.forEach((msg) => {
        // Estimate tokens (roughly 4 chars per token) and limit total context
        const contentLength = msg.content?.length || 0;
        const estimatedTokens = Math.ceil(contentLength / 4);
        
        if (totalTokensEstimate + estimatedTokens > 1500) { // Limit context to ~1500 tokens
          return; // Skip this message to stay within token limits
        }
        
        if (msg.type === 'user' && msg.content && msg.content.trim() !== '') {
          const senderInfo = msg.sender?.pushName
            ? ` (${msg.sender.pushName})`
            : '';
          const messageContent = isGroup
            ? `${msg.content}${senderInfo}`
            : msg.content;
          messages.push({ role: 'user', content: messageContent });
          totalTokensEstimate += estimatedTokens;
        } else if (msg.type === 'assistant' && msg.content && msg.content.trim() !== '') {
          messages.push({ role: 'assistant', content: msg.content });
          totalTokensEstimate += estimatedTokens;
        } else if (msg.type === 'tool_call' && msg.toolResult) {
          // Add simplified tool call context
          const toolContext = msg.toolResult.summary || `[${msg.toolName}: ${msg.toolArgs?.query || 'executado'}]`;
          if (toolContext.length < 100) { // Only add if short
            messages.push({ role: 'system', content: toolContext });
            totalTokensEstimate += Math.ceil(toolContext.length / 4);
          }
        }
      });
      
      console.log(`🎯 Estimated context tokens: ~${totalTokensEstimate}`);

      // Add current message with sender context
      const currentMessageContent = isGroup
        ? `${messageText} (enviado por ${senderName})`
        : messageText;
      messages.push({ role: 'user', content: currentMessageContent.trim() });

      // Create chat completion with tools
      console.log(`📨 Creating chat completion with ${messages.length} messages`);
      
      // Check if we should attempt tool use (only for specific model versions)
      const supportsTools =
        this.model.includes('gpt-4') || this.model.includes('gpt-3.5-turbo');

      let response;
      
      if (supportsTools) {
        try {
          console.log(
            `🔧 Attempting response with tools for model: ${this.model}`
          );
          
          // Create chat completion with tools (optimized for quota management)
          response = await openai.chat.completions.create({
            model: this.model,
            messages: messages,
            temperature: this.creativity / 100,
            max_tokens: 800, // Reduced from 1000 to save quota
            tools: [
              {
                type: "function",
                function: {
                  name: "web_search",
                  description: "Busca informações atualizadas na internet via DuckDuckGo, Bing, Yahoo e outros buscadores. Use quando precisar de informações atuais, notícias, preços, eventos, clima, etc.",
                  parameters: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string",
                        description: "Termo de busca para procurar na internet"
                      }
                    },
                    required: ["query"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "web_scrape",
                  description: "Baixa e analisa o conteúdo completo de um site específico. Extrai título, descrição, conteúdo principal, links, imagens e estrutura HTML. Use quando precisar analisar uma página específica.",
                  parameters: {
                    type: "object",
                    properties: {
                      url: {
                        type: "string",
                        description: "URL completa do site a ser analisado (deve começar com http:// ou https://)"
                      }
                    },
                    required: ["url"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "html_analysis",
                  description: "Analisa a estrutura HTML e extrai informações específicas de um site. Tipos disponíveis: 'news' (notícias), 'ecommerce' (loja), 'contact' (contato), 'social' (redes sociais), 'forms' (formulários), 'general' (geral).",
                  parameters: {
                    type: "object",
                    properties: {
                      url: {
                        type: "string",
                        description: "URL completa do site a ser analisado"
                      },
                      analysisType: {
                        type: "string",
                        description: "Tipo de análise: 'news', 'ecommerce', 'contact', 'social', 'forms', 'general'",
                        enum: ["news", "ecommerce", "contact", "social", "forms", "general"]
                      }
                    },
                    required: ["url"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "generate_zip",
                  description: "Gera um arquivo ZIP com dados de scraping ou pesquisa para download. Use quando o usuário solicitar um arquivo ZIP, exportação ou download de dados coletados.",
                  parameters: {
                    type: "object",
                    properties: {
                      data: {
                        type: "string",
                        description: "Dados em formato JSON string para incluir no ZIP"
                      },
                      type: {
                        type: "string",
                        description: "Tipo de dados: 'scraping' para dados de site ou 'search' para resultados de pesquisa",
                        enum: ["scraping", "search"]
                      }
                    },
                    required: ["data", "type"]
                  }
                }
              }
            ],
            tool_choice: "auto"
          });

          console.log(
            `📤 Initial response received. Tool calls: ${
              response.choices[0]?.message?.tool_calls?.length || 0
            }`
          );

          // Process tool calls if any
          let toolCalls = response.choices[0]?.message?.tool_calls;
          
          while (toolCalls && toolCalls.length > 0) {
            console.log(
              `🔧 Processing ${toolCalls.length} tool calls`
            );

            // Add the AI message with tool calls to conversation
            messages.push({
              role: "assistant",
              content: response.choices[0].message.content,
              tool_calls: toolCalls
            });

            // Execute tool calls
            for (const toolCall of toolCalls) {
              let toolResult;

              console.log(
                `🛠️ Executing tool: ${toolCall.function.name} with args:`,
                toolCall.function.arguments
              );

              if (toolCall.function.name === 'web_search') {
                const args = JSON.parse(toolCall.function.arguments);
                console.log(
                  `🔍 Model requested web search: "${args.query}"`
                );
                
                // Send notification to user that search is starting
                await this.sendToolNotification(
                  `🔍 Buscando em múltiplas fontes: "${args.query}"...\n🌐 Consultando: DuckDuckGo, Bing, Yahoo, Searx, Brave, Yandex`,
                  conversationEntry.chat.id,
                  whatsappClient
                );
                
                toolResult = await executeWebSearch(args.query);
                
                // Parse results to get count
                const searchData = JSON.parse(toolResult);
                const resultCount = searchData.results?.length || 0;
                
                console.log(
                  `✅ Search completed, result length: ${toolResult.length}`
                );
                
                // Save tool call to conversation history for context
                const toolCallEntry = {
                  type: 'tool_call',
                  toolName: toolCall.function.name,
                  toolArgs: args,
                  toolResult: searchData,
                  timestamp: new Date().toISOString(),
                  chat: conversationEntry.chat,
                  agentId: this.id,
                  sessionId: this.sessionId
                };
                await this.saveConversationEntry(toolCallEntry);
                
                // Small delay before completion notification
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Send completion notification with detailed info
                const sourcesUsed = searchData.sources?.join(', ') || 'N/A';
                const duplicatesInfo = searchData.duplicatesRemoved > 0 ? ` (${searchData.duplicatesRemoved} duplicatas removidas)` : '';
                
                await this.sendToolNotification(
                  `✅ Busca concluída!\n📊 ${resultCount} resultados únicos de ${searchData.sources?.length || 0} fontes\n🌐 Fontes: ${sourcesUsed}${duplicatesInfo}`,
                  conversationEntry.chat.id,
                  whatsappClient
                );
                
              } else if (toolCall.function.name === 'web_scrape') {
                const args = JSON.parse(toolCall.function.arguments);
                console.log(
                  `🌐 Model requested web scraping: "${args.url}"`
                );
                
                // Send notification to user that scraping is starting
                await this.sendToolNotification(
                  `🌐 Baixando e analisando site: "${args.url}"...\n📊 Extraindo conteúdo, links, imagens e estrutura`,
                  conversationEntry.chat.id,
                  whatsappClient
                );
                
                toolResult = await executeWebScrape(args.url);
                
                // Parse results to get info
                const scrapeData = JSON.parse(toolResult);
                
                console.log(
                  `✅ Web scraping completed for: ${args.url}`
                );
                
                // Save tool call to conversation history for context
                const toolCallEntry = {
                  type: 'tool_call',
                  toolName: toolCall.function.name,
                  toolArgs: args,
                  toolResult: scrapeData,
                  timestamp: new Date().toISOString(),
                  chat: conversationEntry.chat,
                  agentId: this.id,
                  sessionId: this.sessionId
                };
                await this.saveConversationEntry(toolCallEntry);
                
                // Small delay before completion notification
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Send completion notification with detailed info
                if (scrapeData.error) {
                  await this.sendToolNotification(
                    `❌ Erro ao baixar site:\n${scrapeData.error}`,
                    conversationEntry.chat.id,
                    whatsappClient
                  );
                } else {
                  await this.sendToolNotification(
                    `✅ Site analisado com sucesso!\n📄 ${scrapeData.textLength || 0} caracteres de texto\n🔗 ${scrapeData.structure?.totalLinks || 0} links encontrados\n🖼️ ${scrapeData.structure?.totalImages || 0} imagens encontradas`,
                    conversationEntry.chat.id,
                    whatsappClient
                  );
                }
                
              } else if (toolCall.function.name === 'html_analysis') {
                const args = JSON.parse(toolCall.function.arguments);
                const analysisType = args.analysisType || 'general';
                console.log(
                  `🔍 Model requested HTML analysis: "${args.url}" (type: ${analysisType})`
                );
                
                // Send notification to user that analysis is starting
                await this.sendToolNotification(
                  `🔍 Analisando estrutura HTML: "${args.url}"...\n📋 Tipo de análise: ${analysisType}\n🔬 Extraindo informações específicas`,
                  conversationEntry.chat.id,
                  whatsappClient
                );
                
                toolResult = await executeHtmlAnalysis(args.url, analysisType);
                
                // Parse results to get info
                const analysisData = JSON.parse(toolResult);
                
                console.log(
                  `✅ HTML analysis completed for: ${args.url} (${analysisType})`
                );
                
                // Save tool call to conversation history for context
                const toolCallEntry = {
                  type: 'tool_call',
                  toolName: toolCall.function.name,
                  toolArgs: args,
                  toolResult: analysisData,
                  timestamp: new Date().toISOString(),
                  chat: conversationEntry.chat,
                  agentId: this.id,
                  sessionId: this.sessionId
                };
                await this.saveConversationEntry(toolCallEntry);
                
                // Small delay before completion notification
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Send completion notification with detailed info
                if (analysisData.error) {
                  await this.sendToolNotification(
                    `❌ Erro na análise HTML:\n${analysisData.error}`,
                    conversationEntry.chat.id,
                    whatsappClient
                  );
                } else {
                  let analysisInfo = '';
                  switch (analysisType) {
                    case 'news':
                      analysisInfo = `📰 Título: ${analysisData.headline || 'N/A'}\n👤 Autor: ${analysisData.author || 'N/A'}\n📅 Data: ${analysisData.publishDate || 'N/A'}`;
                      break;
                    case 'ecommerce':
                      analysisInfo = `🛍️ Produto: ${analysisData.productName || 'N/A'}\n💰 Preço: ${analysisData.price || 'N/A'}\n📦 Em estoque: ${analysisData.inStock ? 'Sim' : 'Não'}`;
                      break;
                    case 'contact':
                      analysisInfo = `📧 E-mails: ${analysisData.emails?.length || 0}\n📞 Telefones: ${analysisData.phones?.length || 0}\n🌐 Redes sociais: ${Object.keys(analysisData.socialMedia || {}).length}`;
                      break;
                    default:
                      analysisInfo = `📄 Título: ${analysisData.title || 'N/A'}\n🔗 Links: ${analysisData.links || 0}\n🖼️ Imagens: ${analysisData.content?.images || 0}`;
                  }
                  
                  await this.sendToolNotification(
                    `✅ Análise HTML concluída!\n📋 Tipo: ${analysisType}\n${analysisInfo}`,
                    conversationEntry.chat.id,
                    whatsappClient
                  );
                }
                
              } else if (toolCall.function.name === 'generate_zip') {
                const args = JSON.parse(toolCall.function.arguments);
                const dataType = args.type || 'scraping';
                console.log(
                  `📦 Model requested ZIP generation: type ${dataType}`
                );
                
                // Send notification to user that ZIP generation is starting
                await this.sendToolNotification(
                  `📦 Gerando arquivo ZIP para download...\n📋 Tipo: ${dataType}\n⏳ Preparando dados para exportação`,
                  conversationEntry.chat.id,
                  whatsappClient
                );
                
                try {
                  const data = JSON.parse(args.data);
                  toolResult = await executeZipGeneration(data, dataType);
                  
                  // Parse results to get info
                  const zipData = JSON.parse(toolResult);
                  
                  console.log(
                    `✅ ZIP generation completed: ${zipData.fileName}`
                  );
                  
                  // Save tool call to conversation history for context
                  const toolCallEntry = {
                    type: 'tool_call',
                    toolName: toolCall.function.name,
                    toolArgs: args,
                    toolResult: zipData,
                    timestamp: new Date().toISOString(),
                    chat: conversationEntry.chat,
                    agentId: this.id,
                    sessionId: this.sessionId
                  };
                  await this.saveConversationEntry(toolCallEntry);
                  
                  // Small delay before completion notification
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  // Send completion notification with download link
                  if (zipData.success) {
                    await this.sendToolNotification(
                      `✅ Arquivo ZIP criado com sucesso!\n📁 Nome: ${zipData.fileName}\n💾 Tamanho: ${Math.round(zipData.size / 1024)} KB\n🔗 Download: ${zipData.downloadUrl}`,
                      conversationEntry.chat.id,
                      whatsappClient
                    );
                  } else {
                    await this.sendToolNotification(
                      `❌ Erro ao gerar ZIP:\n${zipData.error}`,
                      conversationEntry.chat.id,
                      whatsappClient
                    );
                  }
                } catch (parseError) {
                  console.error('Error parsing ZIP data:', parseError);
                  toolResult = JSON.stringify({
                    success: false,
                    error: 'Erro ao processar dados para ZIP'
                  });
                  
                  await this.sendToolNotification(
                    `❌ Erro ao processar dados para ZIP: ${parseError.message}`,
                    conversationEntry.chat.id,
                    whatsappClient
                  );
                }
                
              } else {
                toolResult = JSON.stringify({
                  error: `Unknown tool: ${toolCall.function.name}`,
                });
                console.log(`❌ Unknown tool: ${toolCall.function.name}`);
                
                // Send error notification
                await this.sendToolNotification(
                  `❌ Ferramenta desconhecida: ${toolCall.function.name}`,
                  conversationEntry.chat.id,
                  whatsappClient
                );
              }

              // Add tool result to conversation
              messages.push({
                role: "tool",
                content: toolResult,
                tool_call_id: toolCall.id
              });
            }

            // Get response after tool execution
            console.log(`🔄 Getting final response after tool execution`);
            response = await openai.chat.completions.create({
              model: this.model,
              messages: messages,
              temperature: this.creativity / 100,
              max_tokens: 600, // Reduced for final response to save quota
            });
            
            // Check again for more tool calls
            toolCalls = response.choices[0]?.message?.tool_calls;
          }
        } catch (toolError) {
          console.log(
            `⚠️ Tool execution failed, falling back to regular response:`,
            toolError.message
          );
          console.log(`Error stack:`, toolError.stack);
          // Fallback to regular completion without tools
          response = await openai.chat.completions.create({
            model: this.model,
            messages: messages,
            temperature: this.creativity / 100,
            max_tokens: 600, // Reduced to save quota
          });
        }
      } else {
        console.log(
          `🚫 Model ${this.model} does not support tools, using regular response`
        );
        response = await openai.chat.completions.create({
          model: this.model,
          messages: messages,
          temperature: this.creativity / 100,
          max_tokens: 600, // Reduced to save quota
        });
      }

      // Extract response content from OpenAI SDK format
      let responseContent = '';

      if (response && response.choices && response.choices[0]) {
        responseContent = response.choices[0].message?.content || '';
      }

      console.log(`📝 Response content extracted:`, {
        hasContent: !!responseContent,
        contentLength: responseContent?.length || 0,
        contentPreview: responseContent?.substring(0, 100) || 'EMPTY',
        responseType: typeof response,
        hasChoices: !!response.choices,
        choicesLength: response.choices?.length || 0,
        messageContent: response.choices?.[0]?.message?.content?.substring(0, 50) || 'NONE'
      });

      // Se não conseguiu gerar resposta, criar uma resposta padrão baseada na personalidade
      if (!responseContent || responseContent.trim() === '') {
        console.log(
          `❌ Empty response detected, using fallback for personality: ${this.personality}`
        );

        const fallbackResponses = {
          professional:
            'Entendo sua solicitação. Posso ajudá-lo de outra forma?',
          friendly: `Oi${
            isGroup ? ` ${senderName}` : ''
          }! Entendi sua mensagem. Como posso te ajudar melhor?`,
          creative:
            'Que interessante! Vamos pensar em soluções criativas para isso.',
          analytical:
            'Preciso de mais informações para analisar adequadamente sua solicitação.',
          casual: `Entendi${
            isGroup ? ` ${senderName}` : ''
          }! Como posso te dar uma mão com isso?`,
          empathetic:
            'Compreendo sua situação. Estou aqui para ajudar no que precisar.',
        };
        responseContent =
          fallbackResponses[this.personality] || 'Como posso ajudá-lo?';
        console.log(`🔄 Using fallback response: "${responseContent}"`);
      } else {
        console.log(
          `✅ Valid response generated: "${responseContent.substring(
            0,
            100
          )}..."`
        );
      }

      return responseContent.trim();
    } catch (error) {
      console.error('Error generating response:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);

      // Specific error handling with quota management
      let errorMessage = 'Erro interno do sistema';
      let useExtendedFallback = false;
      
      if (error.message.includes('API key')) {
        errorMessage = 'Chave da API OpenAI inválida ou não configurada';
      } else if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exceeded')) {
        errorMessage = 'Quota da API OpenAI excedida - usando modo econômico';
        useExtendedFallback = true;
        console.warn(`⚠️ OpenAI quota exceeded for agent ${this.id}. Switching to fallback mode.`);
      } else if (
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET')
      ) {
        errorMessage = 'Timeout na conexão com OpenAI';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Limite de requisições excedido';
        useExtendedFallback = true;
      } else if (error.message.includes('invalid_request_error')) {
        errorMessage = 'Parâmetros inválidos na requisição';
      } else if (error.message.includes('Empty message content')) {
        errorMessage = 'Mensagem vazia recebida';
      }

      console.error(`AI Agent Error [${this.id}]:`, errorMessage);

      // Resposta de fallback baseada na personalidade do agente
      const fallbackResponses = {
        professional:
          'Momentaneamente indisponível. Como posso assistí-lo de outra forma?',
        friendly:
          'Ops! Algo deu errado, mas estou aqui para ajudar. Me conte mais sobre o que precisa!',
        creative:
          'Hmm, vamos tentar uma abordagem diferente! O que você gostaria de explorar?',
        analytical:
          'Sistema temporariamente instável. Pode reformular sua pergunta?',
        casual:
          'Eita! Deu um probleminha aqui. Mas me fala aí, no que posso te ajudar?',
        empathetic:
          'Compreendo que isso pode ser frustrante. Vamos tentar novamente?',
      };

      // Extended fallback for quota issues
      const quotaFallbackResponses = {
        professional:
          'Sistema em modo econômico devido ao alto volume de consultas. Ainda posso ajudá-lo com informações básicas.',
        friendly:
          'Oi! Estou em modo econômico agora para economizar recursos, mas ainda posso conversar! Como posso ajudar?',
        creative:
          'Modo criativo econômico ativado! Vamos ser mais diretos - me conte o que você precisa.',
        analytical:
          'Sistema operando em modo reduzido. Posso fornecer respostas básicas sem consultas externas.',
        casual:
          'Opa! Tô em modo econômico aqui, mas ainda posso bater um papo! Me fala o que precisa.',
        empathetic:
          'Entendo que você precisa de ajuda. Estou em modo econômico, mas farei o meu melhor para ajudá-lo.',
      };

      const responseText = useExtendedFallback 
        ? quotaFallbackResponses[this.personality] || 'Sistema em modo econômico. Como posso ajudá-lo de forma simples?'
        : fallbackResponses[this.personality] || 'Como posso ajudá-lo hoje?';

      // Log quota issues for monitoring
      if (useExtendedFallback) {
        console.warn(`💰 Agent ${this.id} using quota fallback response. Consider upgrading OpenAI plan.`);
      }

      return responseText;
    }
  }

  getStats() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      name: this.name,
      messageCount: this.messageCount,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      model: this.model,
      personality: this.personality,
      specialization: this.specialization,
      enabledTools: this.enabledTools,
      replyToGroups: this.replyToGroups,
    };
  }

  // Save agent to database
  async save() {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn('Database not available, agent saved only in memory');
        return;
      }

      const agentData = {
        _id: this.id,
        sessionId: this.sessionId,
        name: this.name,
        description: this.description,
        model: this.model,
        personality: this.personality,
        specialization: this.specialization,
        creativity: this.creativity,
        learningEnabled: this.learningEnabled,
        autoReply: this.autoReply,
        smartReplies: this.smartReplies,
        replyToGroups: this.replyToGroups,
        enabledTools: this.enabledTools,
        isActive: this.isActive,
        messageCount: this.messageCount,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        // Save API key to preserve across server restarts (stored securely in database)
        openaiApiKey: this.openaiApiKey || '',
        // conversationHistory now handled separately in ai_agent_conversations collection
      };

      await db
        .collection('ai_agents')
        .replaceOne({ _id: this.id }, agentData, { upsert: true });

      const hasApiKey = this.openaiApiKey && this.openaiApiKey.trim() !== '';
      console.log(
        `✅ AI Agent ${this.id} saved to database - ${
          hasApiKey ? 'with API key' : 'without API key'
        }`
      );
    } catch (error) {
      console.error('Error saving AI agent to database:', error);
    }
  }

  async deactivate() {
    this.isActive = false;
    this.updatedAt = new Date().toISOString();
    await this.save();
  }

  async activate() {
    this.isActive = true;
    this.updatedAt = new Date().toISOString();
    await this.save();
  }

  // MongoDB conversation persistence methods with automatic summarization
  async saveConversationEntry(conversationEntry) {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn('Database not available, conversation entry not saved');
        return;
      }

      // Create a copy to avoid mutating the original
      let entryToSave = { ...conversationEntry };
      
      // Summarize content if it's too long to save tokens
      if (entryToSave.content && entryToSave.content.length > 500) {
        entryToSave.originalLength = entryToSave.content.length;
        entryToSave.content = await this.summarizeContent(entryToSave.content, entryToSave.type);
        entryToSave.wasSummarized = true;
        console.log(`📝 Content summarized: ${entryToSave.originalLength} → ${entryToSave.content.length} chars`);
      }

      // Summarize tool results if they're too large
      if (entryToSave.toolResult && typeof entryToSave.toolResult === 'object') {
        const toolResultStr = JSON.stringify(entryToSave.toolResult);
        if (toolResultStr.length > 1000) {
          entryToSave.toolResult = await this.summarizeToolResult(entryToSave.toolResult, entryToSave.toolName);
          entryToSave.toolResultWasSummarized = true;
          console.log(`🔧 Tool result summarized for ${entryToSave.toolName}`);
        }
      }

      const entryWithAgent = {
        ...entryToSave,
        agentId: this.id,
        sessionId: this.sessionId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days TTL
      };

      await db.collection('ai_agent_conversations').insertOne(entryWithAgent);
      console.log(
        `💾 Conversation entry saved: ${conversationEntry.type} message for agent ${this.id} in chat ${conversationEntry.chat?.id}`
      );
      
      // Log additional details for debugging
      if (conversationEntry.type === 'tool_call') {
        console.log(`🔧 Tool call saved: ${conversationEntry.toolName} with ${conversationEntry.toolResult?.results?.length || 0} results`);
      } else {
        console.log(`💬 Content preview: "${entryToSave.content?.substring(0, 50) || 'N/A'}..."`);
      }
    } catch (error) {
      console.error('Error saving conversation entry:', error);
    }
  }

  // Summarize content to reduce token usage
  async summarizeContent(content, messageType) {
    try {
      // Don't summarize if content is already short
      if (content.length <= 500) {
        return content;
      }

      // For very short messages, just truncate
      if (content.length <= 800) {
        return content.substring(0, 400) + '... [mensagem truncada]';
      }

      // Use a lightweight summarization approach to avoid API calls
      // Extract key sentences based on punctuation and length
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
      
      if (sentences.length <= 3) {
        // If few sentences, just truncate
        return content.substring(0, 400) + '... [conteúdo resumido]';
      }

      // Take first sentence, middle sentence, and last sentence
      const summary = [
        sentences[0]?.trim(),
        sentences[Math.floor(sentences.length / 2)]?.trim(),
        sentences[sentences.length - 1]?.trim()
      ].filter(Boolean).join('. ') + '.';

      // If summary is still too long, truncate
      if (summary.length > 400) {
        return summary.substring(0, 400) + '... [resumo]';
      }

      return summary + ' [resumo automático]';
      
    } catch (error) {
      console.error('Error summarizing content:', error);
      // Fallback to simple truncation
      return content.substring(0, 400) + '... [erro no resumo - truncado]';
    }
  }

  // Summarize tool results to reduce token usage
  async summarizeToolResult(toolResult, toolName) {
    try {
      if (!toolResult || typeof toolResult !== 'object') {
        return toolResult;
      }

      switch (toolName) {
        case 'web_search':
          return {
            query: toolResult.query,
            total: toolResult.total || 0,
            sources: toolResult.sources || [],
            summary: `Encontrados ${toolResult.total || 0} resultados de ${toolResult.sources?.length || 0} fontes`,
            // Keep only first 3 results with limited content
            results: (toolResult.results || []).slice(0, 3).map(r => ({
              title: r.title?.substring(0, 100) || '',
              snippet: r.snippet?.substring(0, 150) || '',
              url: r.url,
              source: r.source
            })),
            wasSummarized: true
          };

        case 'web_scrape':
          return {
            url: toolResult.url,
            title: toolResult.title?.substring(0, 100) || '',
            description: toolResult.description?.substring(0, 200) || '',
            textLength: toolResult.textLength || 0,
            structure: toolResult.structure || {},
            summary: `Site analisado: ${toolResult.textLength || 0} chars, ${toolResult.structure?.totalLinks || 0} links`,
            // Summarize content
            content: toolResult.content?.substring(0, 300) + '...' || '',
            wasSummarized: true
          };

        case 'html_analysis':
          return {
            url: toolResult.url,
            analysisType: toolResult.analysisType,
            title: toolResult.title?.substring(0, 100) || '',
            summary: `Análise ${toolResult.analysisType} concluída para ${toolResult.url}`,
            // Keep key fields but limit content
            keyFindings: this.extractKeyFindings(toolResult, toolResult.analysisType),
            wasSummarized: true
          };

        default:
          // Generic summarization for unknown tool results
          const summary = {
            summary: `Resultado da ferramenta ${toolName}`,
            wasSummarized: true
          };
          
          // Keep only essential fields
          Object.keys(toolResult).slice(0, 5).forEach(key => {
            if (typeof toolResult[key] === 'string' && toolResult[key].length > 200) {
              summary[key] = toolResult[key].substring(0, 200) + '...';
            } else if (typeof toolResult[key] !== 'object') {
              summary[key] = toolResult[key];
            }
          });
          
          return summary;
      }
    } catch (error) {
      console.error('Error summarizing tool result:', error);
      return {
        summary: `Erro ao resumir resultado de ${toolName}`,
        wasSummarized: true,
        error: error.message
      };
    }
  }

  // Extract key findings from HTML analysis
  extractKeyFindings(analysisData, analysisType) {
    switch (analysisType) {
      case 'news':
        return {
          headline: analysisData.headline?.substring(0, 100),
          author: analysisData.author,
          publishDate: analysisData.publishDate,
          category: analysisData.category
        };
      case 'ecommerce':
        return {
          productName: analysisData.productName?.substring(0, 100),
          price: analysisData.price,
          inStock: analysisData.inStock,
          brand: analysisData.brand
        };
      case 'contact':
        return {
          emailCount: analysisData.emails?.length || 0,
          phoneCount: analysisData.phones?.length || 0,
          socialCount: Object.keys(analysisData.socialMedia || {}).length,
          hasContactForm: analysisData.contactForm
        };
      default:
        return {
          title: analysisData.title?.substring(0, 100),
          linksCount: analysisData.links || 0,
          imagesCount: analysisData.content?.images || 0
        };
    }
  }

  async loadConversationHistory(chatId, limit = 10) {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn(
          'Database not available, using empty conversation history'
        );
        return [];
      }

      const conversations = await db
        .collection('ai_agent_conversations')
        .find({
          agentId: this.id,
          'chat.id': chatId,
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      // Log for debugging
      if (conversations.length > 0) {
        console.log(
          `📖 Found ${conversations.length} conversation entries for chat ${chatId}`
        );
        const oldestMsg = conversations[conversations.length - 1];
        const newestMsg = conversations[0];
        console.log(
          `📅 History span: ${oldestMsg.createdAt} to ${newestMsg.createdAt}`
        );
        
        // Log types of messages for debugging
        const messageTypes = conversations.reduce((acc, msg) => {
          acc[msg.type] = (acc[msg.type] || 0) + 1;
          return acc;
        }, {});
        console.log(`📊 Message types in history:`, messageTypes);
      } else {
        console.log(`📖 No conversation history found for chat ${chatId}`);
      }

      // Return in chronological order (oldest first)
      return conversations.reverse();
    } catch (error) {
      console.error('Error loading conversation history:', error);
      return [];
    }
  }

  async clearConversationHistory(chatId = null) {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn(
          'Database not available, conversation history not cleared'
        );
        return;
      }

      const filter = { agentId: this.id };
      if (chatId) {
        filter['chat.id'] = chatId;
      }

      const result = await db
        .collection('ai_agent_conversations')
        .deleteMany(filter);
      console.log(
        `Cleared ${result.deletedCount} conversation entries for agent ${this.id}`
      );
      return result.deletedCount;
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      return 0;
    }
  }

  async getConversationStats() {
    try {
      const db = database.getDb();
      if (!db) {
        return {
          totalMessages: 0,
          uniqueChats: 0,
          groupMessages: 0,
          privateMessages: 0,
        };
      }

      const stats = await db
        .collection('ai_agent_conversations')
        .aggregate([
          { $match: { agentId: this.id } },
          {
            $group: {
              _id: null,
              totalMessages: { $sum: 1 },
              uniqueChats: { $addToSet: '$chat.id' },
              groupMessages: {
                $sum: { $cond: [{ $eq: ['$chat.isGroup', true] }, 1, 0] },
              },
              privateMessages: {
                $sum: { $cond: [{ $eq: ['$chat.isGroup', false] }, 1, 0] },
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalMessages: 1,
              uniqueChats: { $size: '$uniqueChats' },
              groupMessages: 1,
              privateMessages: 1,
            },
          },
        ])
        .toArray();

      return (
        stats[0] || {
          totalMessages: 0,
          uniqueChats: 0,
          groupMessages: 0,
          privateMessages: 0,
        }
      );
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return {
        totalMessages: 0,
        uniqueChats: 0,
        groupMessages: 0,
        privateMessages: 0,
      };
    }
  }
}

// Database helper functions
async function getAllAgentsFromDatabase() {
  try {
    const db = database.getDb();
    if (!db) return [];

    const agents = await db
      .collection('ai_agents')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return agents.map(agentData => new AIAgent({
      ...agentData,
      id: agentData._id,
      openaiApiKey: agentData.openaiApiKey || '',
    }));
  } catch (error) {
    console.error('Error getting all agents from database:', error);
    return [];
  }
}

// Function to check agent health
function checkAgentHealth(agent) {
  const hasApiKey = agent.openaiApiKey && agent.openaiApiKey.trim() !== '';
  const isActive = agent.isActive;
  const hasAutoReply = agent.autoReply;

  return {
    healthy: hasApiKey && isActive && hasAutoReply,
    hasApiKey,
    isActive,
    hasAutoReply,
    issues: [
      !hasApiKey && 'Missing API key',
      !isActive && 'Agent inactive',
      !hasAutoReply && 'Auto-reply disabled',
    ].filter(Boolean),
  };
}

// Removed duplicate getAgentFromDatabase function

// Function to get agent from database (no memory caching)
async function getAgentFromDatabase(agentId) {
  try {
    const db = database.getDb();
    if (!db) return null;

    const agentData = await db
      .collection('ai_agents')
      .findOne({ _id: agentId });

    if (agentData) {
      return new AIAgent({
        ...agentData,
        id: agentData._id,
        openaiApiKey: agentData.openaiApiKey || '',
      });
    }
    return null;
  } catch (error) {
    console.error('Error getting agent from database:', error);
    return null;
  }
}

// Function to find agent by sessionId
async function findAgentBySessionId(sessionId, activeOnly = true) {
  try {
    const db = database.getDb();
    if (!db) return null;

    const query = { sessionId: sessionId };
    if (activeOnly) {
      query.isActive = true;
    }

    const agentData = await db
      .collection('ai_agents')
      .findOne(query);

    if (agentData) {
      return new AIAgent({
        ...agentData,
        id: agentData._id,
        openaiApiKey: agentData.openaiApiKey || '',
      });
    }
    return null;
  } catch (error) {
    console.error('Error finding agent by sessionId:', error);
    return null;
  }
}

async function saveAgentToDatabase(agent) {
  await agent.save();
}

async function deleteAgentFromDatabase(agentId) {
  try {
    const db = database.getDb();
    if (!db) return;

    await db.collection('ai_agents').deleteOne({ _id: agentId });
    console.log(`AI Agent ${agentId} deleted from database`);
  } catch (error) {
    console.error('Error deleting AI agent from database:', error);
  }
}

// No initialization needed - agents loaded from database on demand

// Routes

// Create AI Agent
router.post('/create', async (req, res) => {
  try {
    // Validate request body
    const validatedData = createAgentSchema.parse(req.body);

    // Check if agent already exists for this session
    const existingAgent = await findAgentBySessionId(validatedData.sessionId, true);

    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um agente ativo para esta sessão',
      });
    }

    // Create new AI agent
    const agent = new AIAgent(validatedData);

    // Save to database
    await saveAgentToDatabase(agent);

    console.log(`AI Agent created: ${agent.id} for session ${agent.sessionId}`);

    res.json({
      success: true,
      message: 'Agente de IA criado com sucesso',
      agent: agent.getStats(),
    });
  } catch (error) {
    console.error('Error creating AI agent:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
});

// List AI Agents
router.get('/list', async (req, res) => {
  try {
    const agentInstances = await getAllAgentsFromDatabase();
    const agents = agentInstances.map((agent) => {
      const stats = agent.getStats();
      const health = checkAgentHealth(agent);
      return {
        ...stats,
        health: health,
      };
    });

    res.json({
      success: true,
      agents,
      summary: {
        total: agents.length,
        healthy: agents.filter((a) => a.health.healthy).length,
        needApiKey: agents.filter((a) => !a.health.hasApiKey).length,
        inactive: agents.filter((a) => !a.health.isActive).length,
      },
    });
  } catch (error) {
    console.error('Error listing AI agents:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar agentes',
    });
  }
});

// Get AI Agent by ID
router.get('/:agentId', async (req, res) => {
  try {
    const agent = await getAgentFromDatabase(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    res.json({
      success: true,
      agent: agent.getStats(),
    });
  } catch (error) {
    console.error('Error getting AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter agente',
    });
  }
});

// Update AI Agent API Key
router.patch('/:agentId/api-key', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { openaiApiKey } = req.body;

    if (!openaiApiKey || openaiApiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'API key da OpenAI é obrigatória',
      });
    }

    // Get agent from memory or database
    let agent = await getAgentFromDatabase(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    // Update API key
    agent.openaiApiKey = openaiApiKey;
    agent.updatedAt = new Date().toISOString();

    // Save to database (without API key for security)
    await agent.save();

    res.json({
      success: true,
      message: 'API key atualizada com sucesso',
      agent: agent.getStats(),
    });
  } catch (error) {
    console.error('Error updating agent API key:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar API key',
    });
  }
});

// Update AI Agent Settings
router.patch('/:agentId/settings', async (req, res) => {
  try {
    const { agentId } = req.params;
    const {
      replyToGroups,
      autoReply,
      smartReplies,
      name,
      description,
      personality,
      specialization,
      creativity,
    } = req.body;

    // Get agent from memory or database
    let agent = await getAgentFromDatabase(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    // Update settings (only update provided values)
    if (replyToGroups !== undefined) {
      agent.replyToGroups = Boolean(replyToGroups);
      console.log(
        `Agent ${agentId} replyToGroups updated to: ${agent.replyToGroups}`
      );
    }
    if (autoReply !== undefined) agent.autoReply = Boolean(autoReply);
    if (smartReplies !== undefined) agent.smartReplies = Boolean(smartReplies);
    if (name !== undefined) agent.name = name;
    if (description !== undefined) agent.description = description;
    if (personality !== undefined) agent.personality = personality;
    if (specialization !== undefined) agent.specialization = specialization;
    if (creativity !== undefined) agent.creativity = Number(creativity);

    agent.updatedAt = new Date().toISOString();

    // Save to database
    await agent.save();

    res.json({
      success: true,
      message: 'Configurações do agente atualizadas com sucesso',
      agent: agent.getStats(),
    });
  } catch (error) {
    console.error('Error updating agent settings:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configurações do agente',
    });
  }
});

// Activate AI Agent
router.patch('/:agentId/activate', async (req, res) => {
  try {
    const agent = await getAgentFromDatabase(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    await agent.activate();

    res.json({
      success: true,
      message: 'Agente ativado com sucesso',
    });
  } catch (error) {
    console.error('Error activating AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar agente',
    });
  }
});

// Deactivate AI Agent
router.patch('/:agentId/deactivate', async (req, res) => {
  try {
    const agent = await getAgentFromDatabase(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    await agent.deactivate();

    res.json({
      success: true,
      message: 'Agente desativado com sucesso',
    });
  } catch (error) {
    console.error('Error deactivating AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar agente',
    });
  }
});

// Delete AI Agent
router.delete('/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    // Check if agent exists in database
    const agent = await getAgentFromDatabase(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    // Delete from database
    await deleteAgentFromDatabase(agentId);

    res.json({
      success: true,
      message: 'Agente removido com sucesso',
    });
  } catch (error) {
    console.error('Error deleting AI agent:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover agente',
    });
  }
});

// Process message with AI agent (internal endpoint)
router.post('/process-message', async (req, res) => {
  try {
    const { sessionId, message, whatsappClient } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        message: 'SessionId e message são obrigatórios',
      });
    }

    // Find active agent for this session
    const agent = await findAgentBySessionId(sessionId, true);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum agente ativo encontrado para esta sessão',
      });
    }

    // Process message with AI
    const result = await agent.processMessage(message, whatsappClient);

    res.json({
      success: true,
      response: result.response,
      replyToMessageId: result.replyToMessageId,
      shouldReply: result.shouldReply,
      agentId: agent.id,
    });
  } catch (error) {
    console.error('Error processing message with AI agent:', error);

    // Sempre retornar uma resposta da IA mesmo com erro
    res.json({
      success: true,
      response: 'Como posso ajudá-lo hoje?',
      shouldReply: true,
      error: 'Erro interno processado',
    });
  }
});

// Get agent conversation history
router.get('/:agentId/conversations/:chatId', async (req, res) => {
  try {
    const agent = await getAgentFromDatabase(req.params.agentId);
    const { chatId } = req.params;
    const { limit = 50 } = req.query;

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    const history = await agent.loadConversationHistory(
      chatId,
      parseInt(limit)
    );

    res.json({
      success: true,
      chatId,
      agentId: agent.id,
      conversations: history,
      total: history.length,
    });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter histórico de conversas',
    });
  }
});

// Clear agent conversation history
router.delete('/:agentId/conversations/:chatId?', async (req, res) => {
  try {
    const agent = await getAgentFromDatabase(req.params.agentId);
    const { chatId } = req.params;

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    const deletedCount = await agent.clearConversationHistory(chatId);

    res.json({
      success: true,
      message: chatId
        ? `Histórico limpo para o chat ${chatId}`
        : 'Todo histórico de conversas limpo',
      deletedCount,
    });
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar histórico de conversas',
    });
  }
});

// Get agent conversation statistics
router.get('/:agentId/stats', async (req, res) => {
  try {
    const agent = await getAgentFromDatabase(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado',
      });
    }

    const basicStats = agent.getStats();
    const conversationStats = await agent.getConversationStats();

    res.json({
      success: true,
      agent: {
        ...basicStats,
        conversations: conversationStats,
      },
    });
  } catch (error) {
    console.error('Error getting agent stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas do agente',
    });
  }
});

// Test web search endpoint
router.post('/test-search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query é obrigatória',
      });
    }

    console.log(`🧪 Testing web search for: "${query}"`);
    const result = await executeWebSearch(query);
    const parsedResult = JSON.parse(result);

    res.json({
      success: true,
      message: 'Busca realizada com sucesso',
      data: parsedResult,
    });
  } catch (error) {
    console.error('Error testing web search:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar busca na internet',
      error: error.message,
    });
  }
});

// Helper function para integração com WhatsApp
async function processWhatsAppMessage(whatsappClient, messageData, sessionId) {
  try {
    // Find active agent for this session
    let agent = await findAgentBySessionId(sessionId, true);

    if (!agent) {
      console.log(`No active agent found for session: ${sessionId}`);
      return null;
    }

    // Extract rich message information
    const isGroup = messageData.chat?.isGroup || false;
    const chatId = messageData.chat?.id;
    const senderName = messageData.sender?.pushName || 'Usuário';

    // Verificação adicional usando funções oficiais da Baileys
    const {
      isJidGroup,
      isJidBroadcast,
      isJidStatusBroadcast,
      isJidNewsletter,
    } = require('@whiskeysockets/baileys');
    const isRealGroup =
      isJidGroup(chatId) &&
      !isJidBroadcast(chatId) &&
      !isJidStatusBroadcast(chatId) &&
      !isJidNewsletter(chatId);

    // Use a verificação mais rigorosa
    const finalIsGroup = isGroup || isRealGroup;

    console.log(
      `Processing message from ${senderName} in ${
        finalIsGroup ? 'group' : 'private chat'
      }: ${chatId}`
    );
    console.log(
      `Group verification: messageData.isGroup=${isGroup}, baileys.isJidGroup=${isRealGroup}, final=${finalIsGroup}`
    );

    // Skip if this is a group message and agent doesn't want to reply to groups
    if (finalIsGroup && !agent.replyToGroups) {
      console.log(
        `🚫 Agent ${agent.id} SKIPPING group message from ${chatId} (replyToGroups: false)`
      );
      return null;
    } else if (finalIsGroup) {
      console.log(
        `✅ Agent ${agent.id} PROCESSING group message from ${chatId} (replyToGroups: true)`
      );
    }

    // Process message with AI agent using rich message data
    const result = await agent.processMessage(messageData, whatsappClient);

    if (result.shouldReply && result.response) {
      try {
        // Delay aleatório de 5-10 segundos antes da resposta
        const responseDelay = 5000 + Math.random() * 5000; // 5-10 segundos
        console.log(
          `AI agent ${agent.id} aguardando ${Math.round(
            responseDelay / 1000
          )}s antes de responder...`
        );
        await new Promise((resolve) => setTimeout(resolve, responseDelay));

        // Show typing indicator
        await whatsappClient.sendPresenceUpdate('composing', chatId);

        // Simulate typing time based on response length
        const typingTime = Math.min(
          Math.max(result.response.length * 50, 1000),
          8000
        );
        await new Promise((resolve) => setTimeout(resolve, typingTime));

        // Send reply message with proper quoting
        const replyOptions = {};

        if (result.replyToMessageId) {
          replyOptions.quoted = {
            key: {
              id: result.replyToMessageId,
              fromMe: false,
              remoteJid: chatId,
              participant: isGroup ? messageData.sender?.id : undefined,
            },
            message: {
              conversation:
                messageData.content || messageData.text || messageData.body,
            },
          };
        }

        // Log informativo sobre resposta a múltiplas mensagens
        if (messageData.isMultiPart) {
          console.log(
            `Respondendo à sequência de ${messageData.partCount} mensagens de ${senderName}`
          );
        }

        await whatsappClient.sendMessage(
          chatId,
          { text: result.response },
          replyOptions
        );

        // Update presence to available
        await whatsappClient.sendPresenceUpdate('available');

        console.log(
          `AI response sent to ${chatId} (${
            isGroup ? 'group' : 'private'
          }): ${result.response.substring(0, 100)}...`
        );
        return result;
      } catch (sendError) {
        console.error('Error sending WhatsApp message:', sendError);
        return null;
      }
    } else {
      console.log(
        `Agent ${agent.id} chose not to reply to message from ${senderName}`
      );
    }

    return result;
  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
    return null;
  }
}

// Download ZIP files endpoint
router.get('/download/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const path = require('path');
    const fs = require('fs').promises;
    
    // Validate file name for security
    if (!fileName.match(/^[a-zA-Z0-9_-]+\.zip$/)) {
      return res.status(400).json({
        success: false,
        message: 'Nome de arquivo inválido'
      });
    }
    
    const filePath = path.join(process.cwd(), 'downloads', 'exports', fileName);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    
    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log(`📦 File downloaded: ${fileName} (${stats.size} bytes)`);
    
  } catch (error) {
    console.error('Error serving download:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao baixar arquivo'
    });
  }
});

// Cleanup old ZIP files (run periodically)
setInterval(async () => {
  try {
    await zipGenerator.cleanupOldFiles();
  } catch (error) {
    console.error('Error during ZIP cleanup:', error);
  }
}, 24 * 60 * 60 * 1000); // Run daily

// Export the AI Agent class and helper functions for use in other modules
module.exports = {
  router,
  AIAgent,
  processWhatsAppMessage,
  getAgentFromDatabase,
  findAgentBySessionId,
  getAllAgentsFromDatabase,
  checkAgentHealth,
};
