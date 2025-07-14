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
  tools: z
    .array(z.string())
    .default(['web_search', 'web_scrape', 'html_analysis']),
  replyToGroups: z.boolean().default(true), // Nova opção para responder grupos
});

// Web Search Tool - now implemented directly in OpenAI SDK calls

// Initialize utility instances
const webSearchEngine = new WebSearchEngine({
  timeout: 12000,
  maxRetries: 2,
  maxResultsPerSource: 6,
  maxTotalResults: 12,
});

const webScraper = new WebScraper({
  timeout: 25000,
  maxRetries: 3,
});

const htmlAnalyzer = new HtmlAnalyzer({
  timeout: 25000,
  maxRetries: 3,
});

const zipGenerator = new ZipGenerator({
  outputDir: require('path').join(process.cwd(), 'downloads', 'exports'),
  compressionLevel: 6,
});

// Enhanced web search with multiple sources and robust error handling
async function executeWebSearch(query) {
  try {
    console.log(`🔍 Starting enhanced multi-source search for: "${query}"`);
    const searchResults = await webSearchEngine.search(query);
    console.log(
      `✅ Search completed: ${searchResults.total} results from ${searchResults.sources.length} sources`
    );
    
    // Enhance results with deep search suggestions
    if (searchResults.results && searchResults.results.length > 0) {
      searchResults.deepSearchSuggestions = generateDeepSearchSuggestions(query, searchResults.results);
      searchResults.relatedQueries = generateRelatedQueries(query, searchResults.results);
    }
    
    return JSON.stringify(searchResults);
  } catch (error) {
    console.error(`❌ Enhanced search failed: ${error.message}`);
    // Fallback to basic search
    try {
      return await executeBasicWebSearch(query);
    } catch (fallbackError) {
      console.error(`❌ Basic search also failed: ${fallbackError.message}`);
      // Ultimate fallback - return helpful error message
      return JSON.stringify({
        query,
        results: [],
        timestamp: new Date().toISOString(),
        sources: [],
        total: 0,
        totalFound: 0,
        duplicatesRemoved: 0,
        error: `Não foi possível realizar a busca por "${query}". Motivo: ${fallbackError.message}`,
        message: `Busca temporariamente indisponível. Tente novamente em alguns minutos ou reformule sua consulta.`,
        suggestions: [
          'Tente novamente em alguns minutos',
          'Use termos mais simples',
          'Divida a busca em partes menores',
          'Verifique sua conexão com a internet',
        ],
      });
    }
  }
}

// Generate deep search suggestions based on results
function generateDeepSearchSuggestions(query, results) {
  const suggestions = [];
  
  // Suggest specific site analysis for top results
  if (results.length > 0) {
    suggestions.push(`Analisar detalhadamente: ${results[0].url}`);
  }
  
  // Suggest related searches based on content
  const commonTerms = extractCommonTerms(results);
  if (commonTerms.length > 0) {
    suggestions.push(`Buscar mais sobre: ${commonTerms.slice(0, 3).join(', ')}`);
  }
  
  // Suggest time-specific searches
  if (query.includes('hoje') || query.includes('atual') || query.includes('recente')) {
    suggestions.push(`Buscar histórico: ${query.replace(/hoje|atual|recente/g, '').trim()}`);
  }
  
  return suggestions;
}

// Generate related queries for deeper search
function generateRelatedQueries(query, results) {
  const relatedQueries = [];
  
  // Extract key terms from titles and descriptions
  const keyTerms = new Set();
  results.forEach(result => {
    const words = (result.title + ' ' + result.description).toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4 && !['sobre', 'para', 'com', 'sem', 'mais', 'menos', 'como', 'quando', 'onde', 'porque'].includes(word));
    
    words.forEach(word => keyTerms.add(word));
  });
  
  // Generate variations
  const terms = Array.from(keyTerms).slice(0, 5);
  terms.forEach(term => {
    if (!query.toLowerCase().includes(term)) {
      relatedQueries.push(`${query} ${term}`);
    }
  });
  
  return relatedQueries.slice(0, 3);
}

// Extract common terms from search results
function extractCommonTerms(results) {
  const termCount = {};
  
  results.forEach(result => {
    const text = (result.title + ' ' + result.description).toLowerCase();
    const words = text.split(/\s+/).filter(word => word.length > 4);
    
    words.forEach(word => {
      termCount[word] = (termCount[word] || 0) + 1;
    });
  });
  
  return Object.entries(termCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);
}

// AI-powered decision system for tool chaining
async function shouldContinueWithTools(originalMessage, toolResults, context = {}) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || context.apiKey,
    });

    // Prepare context about what tools were executed and their results
    const toolSummary = toolResults.map(result => {
      return `${result.toolName}: ${result.success ? 'OK' : 'ERRO'}`;
    }).join(', ');

    const decisionPrompt = `Usuário: "${originalMessage}"

Executado: ${toolSummary}

Decidir se continuar com mais ferramentas:
1. Análise site + só web_search → web_scrape
2. URLs encontradas não analisadas → web_scrape  
3. Resposta completa → parar

JSON:
{"shouldContinue": true/false, "nextTool": "web_search|web_scrape|html_analysis|null", "reason": "breve", "parameters": {"url": "se_aplicável"} ou null}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Modelo mais rápido e barato para decisões
      messages: [
        {
          role: 'system',
          content: 'Você é um sistema de decisão autônomo. Responda APENAS com JSON válido, sem explicações adicionais.'
        },
        {
          role: 'user',
          content: decisionPrompt
        }
      ],
      temperature: 0.1, // Baixa temperatura para decisões consistentes
      max_tokens: 150,
    });

    const decisionText = response.choices[0].message.content.trim();
    
    // Parse JSON response
    const decision = JSON.parse(decisionText);
    
    console.log('🤖 AI Decision:', decision);
    return decision;
    
  } catch (error) {
    console.error('❌ Error in AI decision system:', error);
    // Fallback to safe decision
    return {
      shouldContinue: false,
      nextTool: null,
      reason: 'Error in decision system',
      parameters: null
    };
  }
}

// Simplified message enhancement (no keywords)
function enhanceMessageWithSearchContext(message) {
  // Ensure we have a string
  if (typeof message !== 'string') {
    console.warn('enhanceMessageWithSearchContext received non-string:', typeof message, message);
    return String(message || '');
  }
  
  // Just return the message as-is, let AI decide what tools to use
  return message;
}

// Enhanced web scraping with robust error handling and multiple strategies
async function executeWebScrape(url) {
  try {
    console.log(`🌐 AI Agent downloading website: "${url}"`);

    // Validate URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }

    const scrapingResult = await webScraper.scrapeWithRetry(url);

    console.log(
      `✅ Website scraped successfully using ${
        scrapingResult.strategy
      }. Content: ${scrapingResult.stats?.contentLength || 0} chars, ${
        scrapingResult.stats?.totalLinks || 0
      } links, ${scrapingResult.stats?.totalImages || 0} images`
    );

    return JSON.stringify(scrapingResult);
  } catch (error) {
    console.error(`❌ Enhanced web scraping failed: ${error.message}`);

    // Return useful error information
    return JSON.stringify({
      error: `Não foi possível acessar o site: ${error.message}`,
      url: url,
      timestamp: new Date().toISOString(),
      suggestion: 'Verifique se a URL está correta e se o site está acessível',
      fallbackContent: `Site solicitado: ${url}. Erro: ${error.message}. Posso ajudá-lo de outra forma?`,
    });
  }
}

// Enhanced HTML analysis with specialized parsers
async function executeHtmlAnalysis(url, analysisType = 'general') {
  try {
    console.log(
      `🔍 Starting HTML analysis for: "${url}" (type: ${analysisType})`
    );
    const analysisResult = await htmlAnalyzer.analyze(url, analysisType);
    console.log(`✅ HTML analysis completed for ${analysisType} analysis`);
    return JSON.stringify(analysisResult);
  } catch (error) {
    console.error(`❌ HTML analysis failed: ${error.message}`);
    return JSON.stringify({
      error: error.message,
      url: url,
      analysisType: analysisType,
      timestamp: new Date().toISOString(),
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
      throw new Error(
        'Invalid data type for ZIP generation. Requires scraping data with URL or search data with query.'
      );
    }

    console.log(`✅ ZIP file created: ${zipResult.fileName}`);
    return JSON.stringify(zipResult);
  } catch (error) {
    console.error(`❌ ZIP generation failed: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido na geração do ZIP',
      type: type,
      timestamp: new Date().toISOString(),
    });
  }
}

// Fallback basic web search
async function executeBasicWebSearch(query) {
  const fetch = require('node-fetch');
  const cheerio = require('cheerio');

  console.log(`🔍 AI Agent performing multi-source web search for: "${query}"`);

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  // Specific analysis functions (moved outside to proper scope)
  function analyzeNewsArticle($) {
    return {
      headline: $('h1').first().text().trim(),
      subheadline: $('h2').first().text().trim(),
      author:
        $('meta[name="author"]').attr('content') || $('.author').text().trim(),
      publishDate:
        $('meta[property="article:published_time"]').attr('content') ||
        $('time').attr('datetime'),
      category:
        $('meta[property="article:section"]').attr('content') ||
        $('.category').text().trim(),
      tags:
        $('meta[name="keywords"]').attr('content') || $('.tags').text().trim(),
      wordCount: $('article, .article-content, .post-content')
        .text()
        .trim()
        .split(/\s+/).length,
      imageCount: $('article img, .article-content img').length,
      videoCount: $('video, iframe[src*="youtube"], iframe[src*="vimeo"]')
        .length,
      hasComments: $('.comments, #comments, .comment-section').length > 0,
      socialSharing:
        $(
          '[href*="facebook.com"], [href*="twitter.com"], [href*="whatsapp.com"]'
        ).length > 0,
    };
  }

  function analyzeEcommercePage($) {
    return {
      productName: $('h1, .product-title, .product-name').first().text().trim(),
      price: $('.price, .product-price, [class*="price"]')
        .first()
        .text()
        .trim(),
      description: $('.product-description, .product-summary')
        .first()
        .text()
        .trim()
        .substring(0, 500),
      images: $('img').length,
      reviews: $('.review, .rating, [class*="review"]').length,
      inStock: $('[class*="stock"], [class*="availability"]')
        .text()
        .toLowerCase()
        .includes('stock'),
      addToCartButton:
        $('[class*="add-to-cart"], [class*="buy"], button[type="submit"]')
          .length > 0,
      breadcrumbs: $('.breadcrumb, .breadcrumbs').text().trim(),
      category: $('.category, .product-category').text().trim(),
      brand: $('.brand, .product-brand').text().trim(),
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
      location: $('.address, .location, [class*="address"]').text().trim(),
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
        whatsapp: $('[href*="whatsapp.com"]').length,
      },
      shareButtons: $('.share, [class*="share"]').length,
      socialLogin: $('[class*="social-login"], [class*="oauth"]').length > 0,
      embedPosts: $(
        'blockquote[class*="twitter"], iframe[src*="facebook"], iframe[src*="instagram"]'
      ).length,
    };
  }

  function analyzeForms($) {
    const forms = $('form');
    return {
      totalForms: forms.length,
      formTypes: forms
        .map((i, form) => {
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
            hasSubmit:
              $form.find('input[type="submit"], button[type="submit"]').length >
              0,
          };
        })
        .get(),
      hasContactForm:
        $('form[class*="contact"], form[id*="contact"]').length > 0,
      hasSearchForm: $('form[class*="search"], form[id*="search"]').length > 0,
      hasLoginForm: $('form[class*="login"], form[id*="login"]').length > 0,
      hasRegistrationForm:
        $('form[class*="register"], form[id*="register"]').length > 0,
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
        h6: $('h6').length,
      },
      content: {
        paragraphs: $('p').length,
        lists: $('ul, ol').length,
        tables: $('table').length,
        images: $('img').length,
        videos: $('video').length,
        iframes: $('iframe').length,
      },
      navigation: {
        hasNav: $('nav').length > 0,
        menuItems: $('nav a, .menu a, .navigation a').length,
        hasBreadcrumbs: $('.breadcrumb, .breadcrumbs').length > 0,
      },
      structure: {
        hasHeader: $('header').length > 0,
        hasFooter: $('footer').length > 0,
        hasAside: $('aside').length > 0,
        hasMain: $('main').length > 0,
        hasArticle: $('article').length > 0,
        hasSection: $('section').length > 0,
      },
      forms: $('form').length,
      links: $('a[href]').length,
      externalLinks: $('a[href^="http"]').length,
      hasJavaScript: $('script').length,
      hasCSS: $('style, link[rel="stylesheet"]').length,
      language: $('html').attr('lang') || 'unknown',
    };
  }

  // Helper functions for contact analysis
  function extractEmails(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(emailRegex) || [];
  }

  function extractPhones(text) {
    const phoneRegex =
      /(?:\+?55\s?)?(?:\(?[0-9]{2}\)?\s?)?(?:[0-9]{4,5}[-.\s]?[0-9]{4})/g;
    return text.match(phoneRegex) || [];
  }

  function extractAddresses($) {
    const addressSelectors = [
      '.address',
      '.location',
      '[class*="address"]',
      '[class*="location"]',
    ];
    const addresses = [];

    addressSelectors.forEach((selector) => {
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
    const socialPlatforms = [
      'facebook',
      'twitter',
      'instagram',
      'linkedin',
      'youtube',
      'tiktok',
      'whatsapp',
    ];
    const links = {};

    socialPlatforms.forEach((platform) => {
      const link = $(`a[href*="${platform}.com"]`).first().attr('href');
      if (link) {
        links[platform] = link;
      }
    });

    return links;
  }

  function extractBusinessHours(text) {
    const hoursRegex =
      /(?:segunda|terça|quarta|quinta|sexta|sábado|domingo|seg|ter|qua|qui|sex|sab|dom).*?(?:[0-9]{1,2}:[0-9]{2}|[0-9]{1,2}h)/gi;
    return text.match(hoursRegex) || [];
  }

  const allResults = [];
  const searchSources = [];
  const searchPromises = [];

  // Perform all searches in parallel for better performance
  searchPromises.push(
    searchDuckDuckGo(query, fetch, cheerio, headers)
      .then((results) => ({ source: 'duckduckgo', results, emoji: '🦆' }))
      .catch((error) => ({
        source: 'duckduckgo',
        results: [],
        error: error.message,
        emoji: '🦆',
      }))
  );

  searchPromises.push(
    searchBing(query, fetch, cheerio, headers)
      .then((results) => ({ source: 'bing', results, emoji: '🔍' }))
      .catch((error) => ({
        source: 'bing',
        results: [],
        error: error.message,
        emoji: '🔍',
      }))
  );

  searchPromises.push(
    searchYahoo(query, fetch, cheerio, headers)
      .then((results) => ({ source: 'yahoo', results, emoji: '🟣' }))
      .catch((error) => ({
        source: 'yahoo',
        results: [],
        error: error.message,
        emoji: '🟣',
      }))
  );

  searchPromises.push(
    searchSearx(query, fetch, cheerio, headers)
      .then((results) => ({ source: 'searx', results, emoji: '🌐' }))
      .catch((error) => ({
        source: 'searx',
        results: [],
        error: error.message,
        emoji: '🌐',
      }))
  );

  searchPromises.push(
    searchBrave(query, fetch, cheerio, headers)
      .then((results) => ({ source: 'brave', results, emoji: '🦁' }))
      .catch((error) => ({
        source: 'brave',
        results: [],
        error: error.message,
        emoji: '🦁',
      }))
  );

  searchPromises.push(
    searchYandex(query, fetch, cheerio, headers)
      .then((results) => ({ source: 'yandex', results, emoji: '🐻' }))
      .catch((error) => ({
        source: 'yandex',
        results: [],
        error: error.message,
        emoji: '🐻',
      }))
  );

  // Wait for all searches to complete (with timeout)
  const searchResponses = await Promise.allSettled(
    searchPromises.map((promise) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        ),
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
    duplicatesRemoved: allResults.length - uniqueResults.length,
  };

  console.log(
    `✅ Multi-source search completed: ${finalResults.length} unique results from ${searchSources.length} sources`
  );

  // If no results were found, provide a helpful response
  if (finalResults.length === 0) {
    const fallbackResults = {
      query,
      results: [],
      timestamp: new Date().toISOString(),
      sources: searchSources,
      total: 0,
      totalFound: 0,
      duplicatesRemoved: 0,
      message: `Não foram encontrados resultados para "${query}". Tente usar termos diferentes ou mais específicos.`,
      suggestions: [
        'Verifique a ortografia dos termos de busca',
        'Use palavras-chave mais específicas',
        'Tente sinônimos ou termos relacionados',
        'Use aspas para buscar frases exatas',
      ],
    };

    return JSON.stringify(fallbackResults);
  }

  return JSON.stringify(searchResults);
}

// DuckDuckGo search function
async function searchDuckDuckGo(query, fetch, cheerio, headers) {
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(
    query
  )}`;
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
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(
    query
  )}&setlang=pt-BR`;
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
    const snippet = $elem
      .find('.b_caption p, .b_snippet')
      .first()
      .text()
      .trim();

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
  const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(
    query
  )}&ei=UTF-8&lang=pt-BR`;
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
  const searchUrl = `https://searx.be/search?q=${encodeURIComponent(
    query
  )}&language=pt-BR&format=html`;
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
  const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(
    query
  )}&source=web`;
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
  const searchUrl = `https://yandex.com/search/?text=${encodeURIComponent(
    query
  )}&lr=21601`; // lr=21601 for Brazil
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
      await new Promise((resolve) => setTimeout(resolve, 500));

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
        quotedMessage: messageData.quotedMessage || null,
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

  async generateResponse(
    messageData,
    conversationEntry,
    whatsappClient = null
  ) {
    // Variable to store executed tool results - moved outside try-catch for proper scope
    const executedToolResults = [];

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
${contextInfo}

FERRAMENTAS DISPONÍVEIS - Use automaticamente quando necessário:

🔍 web_search: Busca informações atualizadas na internet via múltiplos buscadores (DuckDuckGo, Bing, Yahoo)
- USE AUTOMATICAMENTE para: notícias, preços, clima, eventos, dados atuais, estatísticas
- Para perguntas sobre informações recentes ou atuais

🌐 web_scrape: Baixa e analisa o conteúdo completo de um site específico + gera ZIP automaticamente
- USE AUTOMATICAMENTE para: análise detalhada de páginas, extração de dados específicos
- Combine com web_search para encontrar sites relevantes primeiro

🔬 html_analysis: Analisa estrutura HTML e extrai informações específicas
- USE AUTOMATICAMENTE para: análise especializada (notícias, e-commerce, contatos, etc.)
- Use após web_scrape para análises mais profundas

SEJA PROATIVO: Execute ferramentas IMEDIATAMENTE quando detectar necessidade de informações atualizadas. NÃO peça permissão - execute diretamente.

Regras:
1. Responda em português brasileiro
2. Seja útil e prestativo  
3. Mantenha o tom de acordo com sua personalidade
4. Use ferramentas para informações atualizadas
5. ${
        isGroup
          ? 'Em grupos, seja respeitoso com todos'
          : 'Mantenha conversa natural'
      }
6. CONTEXTO DE RESPOSTAS: Quando você vir "[🤖 CONTEXTO IMPORTANTE:]", significa que o usuário está respondendo diretamente a uma sua mensagem anterior. Analise cuidadosamente:
   - O que você disse anteriormente (mostrado entre aspas)
   - A resposta atual do usuário
   - Como a resposta se relaciona com sua mensagem anterior
   - Se há ambiguidade, pedidos de esclarecimento, concordância/discordância, etc.`;

      const messageText =
        messageData.content || messageData.text || messageData.body || '';

      // Validate message content
      if (!messageText || messageText.trim() === '') {
        throw new Error('Empty message content');
      }

      // Prepare messages array for OpenAI API
      const messages = [{ role: 'system', content: systemPrompt }];

      // Load conversation history from MongoDB for context (reduced to 3 messages to save tokens)
      const recentHistory = await this.loadConversationHistory(
        conversationEntry.chat.id,
        3
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

        if (totalTokensEstimate + estimatedTokens > 500) {
          // Limit context to ~500 tokens
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
        } else if (
          msg.type === 'assistant' &&
          msg.content &&
          msg.content.trim() !== ''
        ) {
          messages.push({ role: 'assistant', content: msg.content });
          totalTokensEstimate += estimatedTokens;
        } else if (msg.type === 'tool_call' && msg.toolResult) {
          // Add simplified tool call context
          const toolContext =
            msg.toolResult.summary ||
            `[${msg.toolName}: ${msg.toolArgs?.query || 'executado'}]`;
          if (toolContext.length < 100) {
            // Only add if short
            messages.push({ role: 'system', content: toolContext });
            totalTokensEstimate += Math.ceil(toolContext.length / 4);
          }
        }
      });

      console.log(`🎯 Estimated context tokens: ~${totalTokensEstimate}`);

      // Add current message with sender context and quoted message info
      let currentMessageContent = isGroup
        ? `${messageText} (enviado por ${senderName})`
        : messageText;
      
      // Add quoted message context if available - check if user is replying to agent's message
      if (messageData.quotedMessage) {
        const quotedText = messageData.quotedMessage.text || '[Mensagem não textual]';
        const quotedSender = messageData.quotedMessage.participant 
          ? messageData.quotedMessage.participant.split('@')[0] 
          : 'Usuário';
        
        // Check if the quoted message is from this agent by looking at conversation history
        const isReplyingToAgent = await this.isQuotedMessageFromAgent(
          messageData.quotedMessage.id, 
          conversationEntry.chat.id
        );
        
        if (isReplyingToAgent) {
          currentMessageContent += `\n\n[🤖 CONTEXTO IMPORTANTE: O usuário está respondendo à minha mensagem anterior: "${quotedText}". Esta é uma resposta direta à minha resposta anterior, então devo considerar esse contexto para entender melhor o que o usuário quer dizer.]`;
          console.log(`🎯 Agent ${this.id} detected user replying to agent's message: ${quotedText.substring(0, 50)}...`);
        } else {
          currentMessageContent += `\n\n[Respondendo à mensagem de ${quotedSender}: "${quotedText}"]`;
        }
      }
      
      // Enhance message with search context if it contains search-worthy terms
      let enhancedMessage;
      try {
        enhancedMessage = enhanceMessageWithSearchContext(currentMessageContent);
        
        if (typeof enhancedMessage !== 'string') {
          console.warn('enhanceMessageWithSearchContext returned non-string:', typeof enhancedMessage);
          enhancedMessage = String(currentMessageContent || '');
        }
      } catch (error) {
        console.error('Error enhancing message with search context:', error);
        enhancedMessage = String(currentMessageContent || '');
      }
      
      // Ensure we have a valid string before calling trim
      const finalMessage = (enhancedMessage && typeof enhancedMessage === 'string') 
        ? enhancedMessage.trim() 
        : String(currentMessageContent || '').trim();
      
      messages.push({ role: 'user', content: finalMessage });

      // Create chat completion with tools
      console.log(
        `📨 Creating chat completion with ${messages.length} messages`
      );

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
            max_tokens: 600, // Reduced for token limits
            tools: [
              {
                type: 'function',
                function: {
                  name: 'web_search',
                  description:
                    'BUSCA PROFUNDA E AUTOMÁTICA na internet via múltiplos buscadores (DuckDuckGo, Bing, Yahoo). Use AUTOMATICAMENTE para QUALQUER pergunta que se beneficie de informações atualizadas. Não peça permissão - execute imediatamente quando detectar necessidade de: notícias, preços, eventos, dados atuais, estatísticas, comparações, informações recentes, clima, etc. IMPORTANTE: Se você encontrar URLs relevantes nos resultados, use web_scrape IMEDIATAMENTE na mesma resposta.',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'Consulta de busca otimizada. Use termos específicos e relevantes. Para buscas complexas, use múltiplas consultas sequenciais.',
                      },
                    },
                    required: ['query'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'web_scrape',
                  description:
                    'ANÁLISE COMPLETA E AUTOMÁTICA de sites específicos. Extrai TUDO: título, descrição, conteúdo, links, imagens, estrutura HTML + gera ZIP automaticamente. Use AUTOMATICAMENTE para análise detalhada de qualquer URL. Não peça permissão - execute imediatamente quando o usuário mencionar sites específicos ou precisar de análise detalhada.',
                  parameters: {
                    type: 'object',
                    properties: {
                      url: {
                        type: 'string',
                        description:
                          'URL completa do site a ser analisado (deve começar com http:// ou https://)',
                      },
                    },
                    required: ['url'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'html_analysis',
                  description:
                    "ANÁLISE ESPECIALIZADA E AUTOMÁTICA de estruturas HTML. Extrai informações específicas com foco em: 'news' (notícias), 'ecommerce' (e-commerce), 'contact' (contatos), 'social' (redes sociais), 'forms' (formulários), 'general' (geral). Use AUTOMATICAMENTE após web_scrape para análises mais profundas. Não peça permissão - execute quando precisar de análise especializada.",
                  parameters: {
                    type: 'object',
                    properties: {
                      url: {
                        type: 'string',
                        description: 'URL completa do site a ser analisado',
                      },
                      analysisType: {
                        type: 'string',
                        description:
                          "Tipo de análise: 'news', 'ecommerce', 'contact', 'social', 'forms', 'general'",
                        enum: [
                          'news',
                          'ecommerce',
                          'contact',
                          'social',
                          'forms',
                          'general',
                        ],
                      },
                    },
                    required: ['url'],
                  },
                },
              },
            ],
            tool_choice: 'auto',
            // Configurações para tornar o modelo mais proativo e executar ferramentas em sequência
            presence_penalty: 0.2,
            frequency_penalty: 0.1,
          });

          console.log(
            `📤 Initial response received. Tool calls: ${
              response.choices[0]?.message?.tool_calls?.length || 0
            }`
          );

          // Process tool calls if any
          let toolCalls = response.choices[0]?.message?.tool_calls;

          while (toolCalls && toolCalls.length > 0) {
            console.log(`🔧 Processing ${toolCalls.length} tool calls`);

            // Add the AI message with tool calls to conversation
            messages.push({
              role: 'assistant',
              content: response.choices[0].message.content,
              tool_calls: toolCalls,
            });

            // Execute tool calls
            for (const toolCall of toolCalls) {
              let toolResult = '';

              try {
                console.log(
                  `🛠️ Executing tool: ${toolCall.function.name} with args:`,
                  toolCall.function.arguments
                );

                if (toolCall.function.name === 'web_search') {
                  const args = JSON.parse(toolCall.function.arguments);
                  console.log(`🔍 Model requested web search: "${args.query}"`);

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

                  // Store successful tool result
                  executedToolResults.push({
                    toolName: 'web_search',
                    args: args,
                    result: searchData,
                    success: !searchData.error,
                  });

                  // Save tool call to conversation history for context
                  const toolCallEntry = {
                    type: 'tool_call',
                    toolName: toolCall.function.name,
                    toolArgs: args,
                    toolResult: searchData,
                    timestamp: new Date().toISOString(),
                    chat: conversationEntry.chat,
                    agentId: this.id,
                    sessionId: this.sessionId,
                  };
                  await this.saveConversationEntry(toolCallEntry);

                  // Small delay before completion notification
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Send completion notification with detailed info
                  const sourcesUsed = searchData.sources?.join(', ') || 'N/A';
                  const duplicatesInfo =
                    searchData.duplicatesRemoved > 0
                      ? ` (${searchData.duplicatesRemoved} duplicatas removidas)`
                      : '';

                  await this.sendToolNotification(
                    `✅ Busca concluída!\n📊 ${resultCount} resultados únicos de ${
                      searchData.sources?.length || 0
                    } fontes\n🌐 Fontes: ${sourcesUsed}${duplicatesInfo}`,
                    conversationEntry.chat.id,
                    whatsappClient
                  );
                  
                  // AI-based tool chaining is now handled in the main iteration loop below
                } else if (toolCall.function.name === 'web_scrape') {
                  const args = JSON.parse(toolCall.function.arguments);
                  console.log(`🌐 Model requested web scraping: "${args.url}"`);

                  // Send notification to user that scraping is starting
                  await this.sendToolNotification(
                    `🌐 Baixando e analisando site: "${args.url}"...\n📊 Extraindo conteúdo, links, imagens e estrutura\n📦 Preparando arquivo ZIP para download`,
                    conversationEntry.chat.id,
                    whatsappClient
                  );

                  toolResult = await executeWebScrape(args.url);

                  // Parse results to get info
                  const scrapeData = JSON.parse(toolResult);

                  console.log(`✅ Web scraping completed for: ${args.url}`);

                  // Auto-generate ZIP file after successful scraping
                  let zipData = null;
                  if (!scrapeData.error) {
                    try {
                      console.log(`📦 Auto-generating ZIP file for scraped data`);
                      const zipResult = await generateZipFile(scrapeData, 'scraping');
                      zipData = JSON.parse(zipResult);
                      console.log(`✅ ZIP file automatically generated: ${zipData.fileName}`);
                    } catch (zipError) {
                      console.error(`❌ ZIP generation failed: ${zipError.message}`);
                      // Don't fail the entire scraping process if ZIP fails
                    }
                  }

                  // Store successful tool result with ZIP info
                  executedToolResults.push({
                    toolName: 'web_scrape',
                    args: args,
                    result: scrapeData,
                    zipData: zipData,
                    success: !scrapeData.error,
                  });

                  // Save tool call to conversation history for context
                  const toolCallEntry = {
                    type: 'tool_call',
                    toolName: toolCall.function.name,
                    toolArgs: args,
                    toolResult: scrapeData,
                    zipData: zipData,
                    timestamp: new Date().toISOString(),
                    chat: conversationEntry.chat,
                    agentId: this.id,
                    sessionId: this.sessionId,
                  };
                  await this.saveConversationEntry(toolCallEntry);

                  // Small delay before completion notification
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Send completion notification with detailed info
                  if (scrapeData.error) {
                    await this.sendToolNotification(
                      `❌ Erro ao baixar site:\n${scrapeData.error}`,
                      conversationEntry.chat.id,
                      whatsappClient
                    );
                  } else {
                    let notificationText = `✅ Site analisado com sucesso!\n📄 ${
                      scrapeData.stats?.contentLength || scrapeData.content?.length || 0
                    } caracteres de texto\n🔗 ${
                      scrapeData.stats?.totalLinks || scrapeData.links?.length || 0
                    } links encontrados\n🖼️ ${
                      scrapeData.stats?.totalImages || scrapeData.images?.length || 0
                    } imagens encontradas`;
                    
                    // Add ZIP information if available
                    if (zipData && zipData.success) {
                      notificationText += `\n📦 ZIP criado: ${zipData.fileName}\n💾 Tamanho: ${zipData.size || 'N/A'}\n🔗 Download: ${zipData.downloadUrl || 'Disponível via API'}`;
                    } else if (zipData && !zipData.success) {
                      notificationText += `\n⚠️ ZIP: Erro na criação (${zipData.error || 'Erro desconhecido'})`;
                    }
                    
                    await this.sendToolNotification(
                      notificationText,
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

                  toolResult = await executeHtmlAnalysis(
                    args.url,
                    analysisType
                  );

                  // Parse results to get info
                  const analysisData = JSON.parse(toolResult);

                  console.log(
                    `✅ HTML analysis completed for: ${args.url} (${analysisType})`
                  );

                  // Store successful tool result
                  executedToolResults.push({
                    toolName: 'html_analysis',
                    args: args,
                    result: analysisData,
                    success: !analysisData.error,
                  });

                  // Save tool call to conversation history for context
                  const toolCallEntry = {
                    type: 'tool_call',
                    toolName: toolCall.function.name,
                    toolArgs: args,
                    toolResult: analysisData,
                    timestamp: new Date().toISOString(),
                    chat: conversationEntry.chat,
                    agentId: this.id,
                    sessionId: this.sessionId,
                  };
                  await this.saveConversationEntry(toolCallEntry);

                  // Small delay before completion notification
                  await new Promise((resolve) => setTimeout(resolve, 1000));

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
                        analysisInfo = `📰 Título: ${
                          analysisData.headline || 'N/A'
                        }\n👤 Autor: ${
                          analysisData.author || 'N/A'
                        }\n📅 Data: ${analysisData.publishDate || 'N/A'}`;
                        break;
                      case 'ecommerce':
                        analysisInfo = `🛍️ Produto: ${
                          analysisData.productName || 'N/A'
                        }\n💰 Preço: ${
                          analysisData.price || 'N/A'
                        }\n📦 Em estoque: ${
                          analysisData.inStock ? 'Sim' : 'Não'
                        }`;
                        break;
                      case 'contact':
                        analysisInfo = `📧 E-mails: ${
                          analysisData.emails?.length || 0
                        }\n📞 Telefones: ${
                          analysisData.phones?.length || 0
                        }\n🌐 Redes sociais: ${
                          Object.keys(analysisData.socialMedia || {}).length
                        }`;
                        break;
                      default:
                        analysisInfo = `📄 Título: ${
                          analysisData.title || 'N/A'
                        }\n🔗 Links: ${analysisData.links || 0}\n🖼️ Imagens: ${
                          analysisData.content?.images || 0
                        }`;
                    }

                    await this.sendToolNotification(
                      `✅ Análise HTML concluída!\n📋 Tipo: ${analysisType}\n${analysisInfo}`,
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
              } catch (toolExecutionError) {
                console.error(
                  `❌ Tool execution error for ${toolCall.function.name}:`,
                  toolExecutionError
                );
                toolResult = JSON.stringify({
                  error: `Tool execution failed: ${toolExecutionError.message}`,
                  toolName: toolCall.function.name,
                });

                // Send error notification
                await this.sendToolNotification(
                  `❌ Erro na execução da ferramenta ${toolCall.function.name}:\n${toolExecutionError.message}`,
                  conversationEntry.chat.id,
                  whatsappClient
                );
              }

              // Add tool result to conversation - This is critical for OpenAI API
              messages.push({
                role: 'tool',
                content: toolResult,
                tool_call_id: toolCall.id,
              });

              console.log(
                `✅ Tool result added to conversation for tool_call_id: ${toolCall.id}`
              );
            }

            // Implement iterative tool chaining with AI decisions
            let maxIterations = 1; // Reduced to prevent token overflow
            let currentIteration = 0;
            
            while (currentIteration < maxIterations) {
              // Check token count before continuing
              const currentTokenCount = messages.reduce((total, msg) => {
                return total + Math.ceil((msg.content?.length || 0) / 4);
              }, 0);
              
              if (currentTokenCount > 15000) { // More conservative limit
                console.log(`🚫 Token limit approaching (${currentTokenCount}), stopping chaining`);
                break;
              }
              
              // Get current tool results for AI decision
              const currentToolResults = executedToolResults.filter(result => result.success);
              const originalMessage = conversationEntry.messageText || '';
              
              if (currentToolResults.length === 0) {
                console.log(`🤖 No successful tools executed, stopping chaining`);
                break;
              }
              
              // Ask AI if we should continue
              console.log(`🤖 Iteration ${currentIteration + 1}: Consulting AI decision system...`);
              
              // Add delay to prevent rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const aiDecision = await shouldContinueWithTools(originalMessage, currentToolResults, {
                apiKey: this.openaiApiKey
              });
              
              if (!aiDecision.shouldContinue) {
                console.log(`🤖 AI decided to stop at iteration ${currentIteration + 1}: ${aiDecision.reason}`);
                break;
              }
              
              console.log(`🤖 AI decided to continue with ${aiDecision.nextTool}: ${aiDecision.reason}`);
              
              // Build tools array based on AI decision
              const availableTools = [];
              
              if (aiDecision.nextTool === 'web_scrape') {
                availableTools.push({
                  type: 'function',
                  function: {
                    name: 'web_scrape',
                    description: 'EXECUTE IMEDIATAMENTE para análise completa do site.',
                    parameters: {
                      type: 'object',
                      properties: {
                        url: {
                          type: 'string',
                          description: 'URL para análise detalhada',
                        },
                      },
                      required: ['url'],
                    },
                  },
                });
              }
              
              if (aiDecision.nextTool === 'html_analysis') {
                availableTools.push({
                  type: 'function',
                  function: {
                    name: 'html_analysis',
                    description: 'EXECUTE IMEDIATAMENTE para análise especializada.',
                    parameters: {
                      type: 'object',
                      properties: {
                        url: {
                          type: 'string',
                          description: 'URL para análise',
                        },
                        analysisType: {
                          type: 'string',
                          enum: ['news', 'ecommerce', 'contact', 'social', 'forms', 'general'],
                          description: 'Tipo de análise',
                        },
                      },
                      required: ['url'],
                    },
                  },
                });
              }
              
              if (aiDecision.nextTool === 'web_search') {
                availableTools.push({
                  type: 'function',
                  function: {
                    name: 'web_search',
                    description: 'EXECUTE IMEDIATAMENTE para busca adicional.',
                    parameters: {
                      type: 'object',
                      properties: {
                        query: {
                          type: 'string',
                          description: 'Consulta de busca',
                        },
                      },
                      required: ['query'],
                    },
                  },
                });
              }
              
              if (availableTools.length === 0) {
                console.log(`🤖 No tools available for AI decision: ${aiDecision.nextTool}`);
                break;
              }
              
              // Add instruction to force tool execution
              const instructionMessage = `DECISÃO IA: ${aiDecision.reason}. Execute ${aiDecision.nextTool} IMEDIATAMENTE.`;
              if (aiDecision.parameters && aiDecision.parameters.url) {
                instructionMessage += ` URL: ${aiDecision.parameters.url}`;
              }
              
              messages.push({
                role: 'system',
                content: `${instructionMessage}\n\nIMPORTANTE: Execute a próxima ferramenta IMEDIATAMENTE. NÃO termine sua resposta sem executar a análise completa.`
              });
              
              // Make call to execute next tool
              const iterationResponse = await openai.chat.completions.create({
                model: this.model,
                messages: messages,
                temperature: this.creativity / 100,
                max_tokens: 500, // Reduced for chaining calls
                tools: availableTools,
                tool_choice: 'auto',
              });
              
              // Process iteration response
              if (iterationResponse.choices[0].message.tool_calls) {
                const iterationToolCalls = iterationResponse.choices[0].message.tool_calls;
                console.log(`🔄 Processing ${iterationToolCalls.length} iteration tool calls`);
                
                // Add iteration response to conversation
                messages.push({
                  role: 'assistant',
                  content: iterationResponse.choices[0].message.content,
                  tool_calls: iterationToolCalls,
                });
                
                // Execute iteration tools
                for (const toolCall of iterationToolCalls) {
                  let toolResult = '';
                  
                  if (toolCall.function.name === 'web_scrape') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`🌐 Iteration web scraping: "${args.url}"`);
                    
                    await this.sendToolNotification(
                      `🌐 Continuando análise: "${args.url}"...\n📊 Extraindo conteúdo completo`,
                      conversationEntry.chat.id,
                      whatsappClient
                    );
                    
                    toolResult = await executeWebScrape(args.url);
                    const scrapeData = JSON.parse(toolResult);
                    
                    // Store iteration tool result
                    executedToolResults.push({
                      toolName: 'web_scrape',
                      args: args,
                      result: scrapeData,
                      zipData: scrapeData.zipData,
                      success: !scrapeData.error,
                    });
                    
                  } else if (toolCall.function.name === 'html_analysis') {
                    const args = JSON.parse(toolCall.function.arguments);
                    const analysisType = args.analysisType || 'general';
                    console.log(`🔍 Iteration HTML analysis: "${args.url}" (${analysisType})`);
                    
                    await this.sendToolNotification(
                      `🔍 Continuando análise especializada: "${args.url}"...\n📋 Tipo: ${analysisType}`,
                      conversationEntry.chat.id,
                      whatsappClient
                    );
                    
                    toolResult = await executeHtmlAnalysis(args.url, analysisType);
                    const analysisData = JSON.parse(toolResult);
                    
                    // Store iteration tool result
                    executedToolResults.push({
                      toolName: 'html_analysis',
                      args: args,
                      result: analysisData,
                      success: !analysisData.error,
                    });
                    
                  } else if (toolCall.function.name === 'web_search') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`🔍 Iteration web search: "${args.query}"`);
                    
                    await this.sendToolNotification(
                      `🔍 Continuando busca: "${args.query}"...\n🌐 Consultando múltiplas fontes`,
                      conversationEntry.chat.id,
                      whatsappClient
                    );
                    
                    toolResult = await executeWebSearch(args.query);
                    const searchData = JSON.parse(toolResult);
                    
                    // Store iteration tool result
                    executedToolResults.push({
                      toolName: 'web_search',
                      args: args,
                      result: searchData,
                      success: !searchData.error,
                    });
                  }
                  
                  // Add tool result to conversation
                  messages.push({
                    role: 'tool',
                    content: toolResult,
                    tool_call_id: toolCall.id,
                  });
                }
              } else {
                console.log(`🤖 No tool calls in iteration ${currentIteration + 1}, stopping`);
                break;
              }
              
              currentIteration++;
            }
            

            // Get response after tool execution
            console.log(`🔄 Getting final response after tool execution`);
            try {
              response = await openai.chat.completions.create({
                model: this.model,
                messages: messages,
                temperature: this.creativity / 100,
                max_tokens: 500, // Reduced for final response to save quota
              });

              // Check again for more tool calls
              toolCalls = response.choices[0]?.message?.tool_calls;
            } catch (finalResponseError) {
              console.error(
                'Error getting final response after tool execution:',
                finalResponseError
              );
              // Break the loop to prevent infinite attempts
              toolCalls = null;

              // If we have tool results, use them for response
              if (executedToolResults.length > 0) {
                console.log(
                  `🔧 Using tool results for response due to final response error`
                );
                break;
              }

              throw finalResponseError;
            }
          }
        } catch (toolError) {
          console.log(
            `⚠️ Tool execution failed, falling back to regular response:`,
            toolError.message
          );
          console.log(`Error stack:`, toolError.stack);

          // If we have successful tool results, don't fallback completely
          if (executedToolResults.length > 0) {
            console.log(
              `🔧 Found ${executedToolResults.length} successful tool results, using them instead of fallback`
            );
            // We'll handle this in the error handler below
            throw toolError;
          }

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
        messageContent:
          response.choices?.[0]?.message?.content?.substring(0, 50) || 'NONE',
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

      // First, check if we have any successful tool executions
      if (executedToolResults.length > 0) {
        console.log(
          `🔧 Found ${executedToolResults.length} executed tools, generating response from results`
        );

        try {
          let responseFromTools = '';

          for (const toolResult of executedToolResults) {
            if (toolResult.success && toolResult.result) {
              if (toolResult.toolName === 'web_scrape') {
                const data = toolResult.result;
                responseFromTools += `Analisei o site ${toolResult.args.url} e encontrei:\n\n`;
                responseFromTools += `📄 **Título**: ${data.title || 'N/A'}\n`;
                responseFromTools += `📝 **Descrição**: ${
                  data.description || 'N/A'
                }\n`;
                responseFromTools += `📊 **Conteúdo**: ${
                  data.content ? data.content.substring(0, 500) + '...' : 'N/A'
                }\n`;
                responseFromTools += `🔗 **Links encontrados**: ${
                  data.structure?.totalLinks || data.links?.length || 0
                }\n`;
                responseFromTools += `🖼️ **Imagens**: ${
                  data.structure?.totalImages || data.images?.length || 0
                }\n`;

                // Add ZIP download information
                if (toolResult.zipData && toolResult.zipData.success) {
                  responseFromTools += `📦 **ZIP criado**: ${toolResult.zipData.fileName}\n`;
                  responseFromTools += `💾 **Tamanho**: ${toolResult.zipData.size || 'N/A'}\n`;
                  if (toolResult.zipData.downloadUrl) {
                    responseFromTools += `🔗 **Download**: ${toolResult.zipData.downloadUrl}\n`;
                  }
                  responseFromTools += `\n*Arquivo ZIP contém todos os dados do site incluindo HTML, conteúdo, links, imagens e metadados.*\n`;
                }

                if (data.headings) {
                  responseFromTools += `\n📌 **Principais tópicos**:\n`;
                  if (data.headings.h1?.length > 0) {
                    responseFromTools +=
                      data.headings.h1
                        .slice(0, 3)
                        .map((h) => `• ${h}`)
                        .join('\n') + '\n';
                  }
                }
              } else if (toolResult.toolName === 'web_search') {
                const data = toolResult.result;
                responseFromTools += `Encontrei ${
                  data.results?.length || 0
                } resultados para "${toolResult.args.query}":\n\n`;

                if (data.results && data.results.length > 0) {
                  data.results.slice(0, 5).forEach((result, index) => {
                    responseFromTools += `${index + 1}. **${result.title}**\n`;
                    responseFromTools += `   ${result.snippet}\n`;
                    responseFromTools += `   🔗 ${result.url}\n\n`;
                  });

                  if (data.sources?.length > 0) {
                    responseFromTools += `\n📍 Fontes consultadas: ${data.sources.join(
                      ', '
                    )}\n`;
                  }
                  
                  // Add deep search suggestions if available
                  if (data.deepSearchSuggestions && data.deepSearchSuggestions.length > 0) {
                    responseFromTools += `\n🎯 **Sugestões para busca profunda:**\n`;
                    data.deepSearchSuggestions.forEach((suggestion, index) => {
                      responseFromTools += `${index + 1}. ${suggestion}\n`;
                    });
                  }
                  
                  // Add related queries if available
                  if (data.relatedQueries && data.relatedQueries.length > 0) {
                    responseFromTools += `\n🔗 **Buscas relacionadas:**\n`;
                    data.relatedQueries.forEach((query, index) => {
                      responseFromTools += `${index + 1}. ${query}\n`;
                    });
                  }
                  
                  responseFromTools += `\n`;
                }
              } else if (toolResult.toolName === 'html_analysis') {
                const data = toolResult.result;
                const analysisType = toolResult.args.analysisType || 'general';
                responseFromTools += `Análise ${analysisType} do site ${toolResult.args.url}:\n\n`;

                if (analysisType === 'news' && data.headline) {
                  responseFromTools += `📰 **Título**: ${data.headline}\n`;
                  responseFromTools += `👤 **Autor**: ${
                    data.author || 'N/A'
                  }\n`;
                  responseFromTools += `📅 **Data**: ${
                    data.publishDate || 'N/A'
                  }\n`;
                  responseFromTools += `🏷️ **Categoria**: ${
                    data.category || 'N/A'
                  }\n`;
                } else if (analysisType === 'ecommerce' && data.productName) {
                  responseFromTools += `🛍️ **Produto**: ${data.productName}\n`;
                  responseFromTools += `💰 **Preço**: ${data.price || 'N/A'}\n`;
                  responseFromTools += `📦 **Disponibilidade**: ${
                    data.inStock ? 'Em estoque' : 'Indisponível'
                  }\n`;
                  responseFromTools += `🏪 **Marca**: ${data.brand || 'N/A'}\n`;
                } else if (analysisType === 'contact') {
                  responseFromTools += `📧 **E-mails encontrados**: ${
                    data.emails?.length || 0
                  }\n`;
                  responseFromTools += `📞 **Telefones**: ${
                    data.phones?.length || 0
                  }\n`;
                  responseFromTools += `🌐 **Redes sociais**: ${
                    Object.keys(data.socialMedia || {}).length
                  }\n`;
                  responseFromTools += `📝 **Formulário de contato**: ${
                    data.contactForm ? 'Sim' : 'Não'
                  }\n`;
                } else {
                  responseFromTools += `📄 **Título**: ${
                    data.title || 'N/A'
                  }\n`;
                  responseFromTools += `🔗 **Total de links**: ${
                    data.links || 0
                  }\n`;
                  responseFromTools += `🖼️ **Total de imagens**: ${
                    data.content?.images || 0
                  }\n`;
                  responseFromTools += `📊 **Estrutura**: ${
                    data.structure ? JSON.stringify(data.structure) : 'N/A'
                  }\n`;
                }
              }
            }
          }

          if (responseFromTools) {
            console.log(`✅ Generated response from tool results`);
            return responseFromTools.trim();
          }
        } catch (toolResponseError) {
          console.error(
            'Error generating response from tools:',
            toolResponseError
          );
        }
      }

      // Try to handle the user's request manually if OpenAI fails
      const messageText =
        messageData.content || messageData.text || messageData.body || '';
      const lowerMessage = messageText.toLowerCase();

      // Check if user is asking for web scraping or search
      if (
        lowerMessage.includes('http') ||
        lowerMessage.includes('www.') ||
        lowerMessage.includes('site') ||
        lowerMessage.includes('página')
      ) {
        // Try to extract URL and perform scraping
        const urlMatch = messageText.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          try {
            console.log(`🔄 Manual web scraping attempt for: ${urlMatch[0]}`);
            // Fixed: Use the globally available function instead of undefined one
            const scrapingResult = await this.executeWebScrapeHelper(
              urlMatch[0]
            );
            const scrapedData = JSON.parse(scrapingResult);

            if (!scrapedData.error) {
              return (
                `Analisei o site ${urlMatch[0]} e encontrei:\n\n` +
                `📄 **Título**: ${scrapedData.title || 'N/A'}\n` +
                `📝 **Descrição**: ${scrapedData.description || 'N/A'}\n` +
                `📊 **Conteúdo**: ${
                  scrapedData.content
                    ? scrapedData.content.substring(0, 500) + '...'
                    : 'N/A'
                }\n` +
                `🔗 **Links encontrados**: ${
                  scrapedData.structure?.totalLinks || 0
                }\n` +
                `🖼️ **Imagens**: ${scrapedData.structure?.totalImages || 0}`
              );
            }
          } catch (scrapingError) {
            console.error('Manual scraping failed:', scrapingError);
          }
        }
      }

      // Check if user is asking for search
      if (
        lowerMessage.includes('buscar') ||
        lowerMessage.includes('pesquisar') ||
        lowerMessage.includes('procurar')
      ) {
        try {
          console.log(`🔄 Manual search attempt for: ${messageText}`);
          const searchResult = await executeBasicWebSearch(messageText);
          const searchData = JSON.parse(searchResult);

          if (searchData.results && searchData.results.length > 0) {
            let response = `Encontrei ${searchData.results.length} resultados para sua pesquisa:\n\n`;
            searchData.results.slice(0, 3).forEach((result, index) => {
              response += `${index + 1}. **${result.title}**\n`;
              response += `   ${result.snippet}\n`;
              response += `   🔗 ${result.url}\n\n`;
            });
            return response;
          }
        } catch (searchError) {
          console.error('Manual search failed:', searchError);
        }
      }

      // Specific error handling with quota management
      let errorMessage = 'Erro interno do sistema';
      let useExtendedFallback = false;

      if (error.message.includes('API key')) {
        errorMessage = 'Chave da API OpenAI inválida ou não configurada';
      } else if (
        error.message.includes('429') ||
        error.message.includes('quota') ||
        error.message.includes('exceeded')
      ) {
        errorMessage = 'Quota da API OpenAI excedida - usando modo econômico';
        useExtendedFallback = true;
        console.warn(
          `⚠️ OpenAI quota exceeded for agent ${this.id}. Switching to fallback mode.`
        );
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

      // If tools were successfully executed, don't show generic fallback message
      if (executedToolResults.length > 0) {
        console.log(`🔧 Tools were executed, not showing generic fallback`);
        return 'Desculpe, não consegui processar completamente sua solicitação, mas executei as ferramentas solicitadas. Verifique os resultados acima.';
      }

      // Resposta de fallback baseada na personalidade do agente - mais útil e menos genérica
      const fallbackResponses = {
        professional:
          'Posso ajudá-lo de forma alternativa. Qual informação específica você precisa?',
        friendly:
          'Ops! Vou tentar uma abordagem diferente para te ajudar. Me conte mais sobre o que precisa!',
        creative:
          'Vamos explorar outras possibilidades! Qual é o seu objetivo principal?',
        analytical:
          'Deixe-me analisar isso de outra forma. Pode fornecer mais detalhes?',
        casual:
          'Beleza! Vou tentar outro caminho. O que você tá procurando exatamente?',
        empathetic:
          'Entendo sua necessidade. Vamos encontrar uma solução juntos. Como posso ajudar?',
      };

      // Extended fallback for quota issues
      const quotaFallbackResponses = {
        professional:
          'Sistema operando em modo econômico. Posso analisar sites e fazer pesquisas na internet. Envie uma URL ou me diga o que precisa pesquisar.',
        friendly:
          'Oi! Estou em modo econômico, mas ainda posso te ajudar! Posso pesquisar na internet ou analisar sites para você. Me mande uma URL ou diga o que quer pesquisar!',
        creative:
          'Modo econômico ativado! Mas ainda posso ser criativo analisando sites e pesquisando informações. Me conte o que você precisa!',
        analytical:
          'Sistema em modo econômico. Posso executar análises de sites e pesquisas na web. Forneça uma URL ou termo de pesquisa.',
        casual:
          'Tô em modo econômico, mas ainda posso pesquisar coisas na internet e analisar sites! Me manda uma URL ou fala o que quer pesquisar.',
        empathetic:
          'Entendo que você precisa de ajuda. Estou em modo econômico, mas ainda posso pesquisar informações e analisar sites para você. Como posso ajudar?',
      };

      const responseText = useExtendedFallback
        ? quotaFallbackResponses[this.personality] ||
          'Sistema em modo econômico. Como posso ajudá-lo de forma simples?'
        : fallbackResponses[this.personality] || 'Como posso ajudá-lo hoje?';

      // Log quota issues for monitoring
      if (useExtendedFallback) {
        console.warn(
          `💰 Agent ${this.id} using quota fallback response. Consider upgrading OpenAI plan.`
        );
      }

      return responseText;
    }
  }

  // Helper method to make executeWebScrape available in the class scope
  async executeWebScrapeHelper(url) {
    return await executeWebScrape(url);
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
  // Check if a quoted message was sent by this agent
  async isQuotedMessageFromAgent(quotedMessageId, chatId) {
    try {
      const db = database.getDb();
      if (!db || !quotedMessageId) {
        return false;
      }

      // Look for the quoted message in the agent's conversation history
      // Check by sentMessageId (the actual WhatsApp message ID)
      const agentMessage = await db.collection('ai_agent_conversations').findOne({
        agentId: this.id,
        'chat.id': chatId,
        type: 'assistant',
        sentMessageId: quotedMessageId,
        expiresAt: { $gt: new Date() } // Make sure it's not expired
      });

      const isFromAgent = !!agentMessage;
      
      if (isFromAgent) {
        console.log(`✅ Agent ${this.id} confirmed: quoted message ${quotedMessageId} was sent by this agent`);
      }

      return isFromAgent;
    } catch (error) {
      console.error('Error checking if quoted message is from agent:', error);
      return false;
    }
  }

  // Update conversation entry with the actual WhatsApp message ID after sending
  async updateConversationEntryWithMessageId(inResponseTo, sentMessageId, chatId) {
    try {
      const db = database.getDb();
      if (!db) {
        console.warn('Database not available, cannot update conversation entry with message ID');
        return;
      }

      // Find the most recent assistant message for this agent and chat that was in response to the given message
      const updateResult = await db.collection('ai_agent_conversations').updateOne(
        {
          agentId: this.id,
          'chat.id': chatId,
          type: 'assistant',
          inResponseTo: inResponseTo,
          sentMessageId: { $exists: false } // Only update if not already set
        },
        {
          $set: {
            sentMessageId: sentMessageId,
            updatedAt: new Date()
          }
        },
        { sort: { createdAt: -1 } } // Get the most recent one
      );

      if (updateResult.modifiedCount > 0) {
        console.log(`✅ Updated conversation entry with sent message ID: ${sentMessageId}`);
      } else {
        console.log(`⚠️ No conversation entry found to update with message ID: ${sentMessageId}`);
      }
    } catch (error) {
      console.error('Error updating conversation entry with message ID:', error);
    }
  }

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
        entryToSave.content = await this.summarizeContent(
          entryToSave.content,
          entryToSave.type
        );
        entryToSave.wasSummarized = true;
        console.log(
          `📝 Content summarized: ${entryToSave.originalLength} → ${entryToSave.content.length} chars`
        );
      }

      // Summarize tool results if they're too large
      if (
        entryToSave.toolResult &&
        typeof entryToSave.toolResult === 'object'
      ) {
        const toolResultStr = JSON.stringify(entryToSave.toolResult);
        if (toolResultStr.length > 1000) {
          entryToSave.toolResult = await this.summarizeToolResult(
            entryToSave.toolResult,
            entryToSave.toolName
          );
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
        console.log(
          `🔧 Tool call saved: ${conversationEntry.toolName} with ${
            conversationEntry.toolResult?.results?.length || 0
          } results`
        );
      } else {
        console.log(
          `💬 Content preview: "${
            entryToSave.content?.substring(0, 50) || 'N/A'
          }..."`
        );
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
      const sentences = content
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 10);

      if (sentences.length <= 3) {
        // If few sentences, just truncate
        return content.substring(0, 400) + '... [conteúdo resumido]';
      }

      // Take first sentence, middle sentence, and last sentence
      const summary =
        [
          sentences[0]?.trim(),
          sentences[Math.floor(sentences.length / 2)]?.trim(),
          sentences[sentences.length - 1]?.trim(),
        ]
          .filter(Boolean)
          .join('. ') + '.';

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
            summary: `Encontrados ${toolResult.total || 0} resultados de ${
              toolResult.sources?.length || 0
            } fontes`,
            // Keep only first 3 results with limited content
            results: (toolResult.results || []).slice(0, 3).map((r) => ({
              title: r.title?.substring(0, 100) || '',
              snippet: r.snippet?.substring(0, 150) || '',
              url: r.url,
              source: r.source,
            })),
            wasSummarized: true,
          };

        case 'web_scrape':
          return {
            url: toolResult.url,
            title: toolResult.title?.substring(0, 100) || '',
            description: toolResult.description?.substring(0, 200) || '',
            textLength: toolResult.textLength || 0,
            structure: toolResult.structure || {},
            summary: `Site analisado: ${toolResult.textLength || 0} chars, ${
              toolResult.structure?.totalLinks || 0
            } links`,
            // Summarize content
            content: toolResult.content?.substring(0, 300) + '...' || '',
            wasSummarized: true,
          };

        case 'html_analysis':
          return {
            url: toolResult.url,
            analysisType: toolResult.analysisType,
            title: toolResult.title?.substring(0, 100) || '',
            summary: `Análise ${toolResult.analysisType} concluída para ${toolResult.url}`,
            // Keep key fields but limit content
            keyFindings: this.extractKeyFindings(
              toolResult,
              toolResult.analysisType
            ),
            wasSummarized: true,
          };

        default:
          // Generic summarization for unknown tool results
          const summary = {
            summary: `Resultado da ferramenta ${toolName}`,
            wasSummarized: true,
          };

          // Keep only essential fields
          Object.keys(toolResult)
            .slice(0, 5)
            .forEach((key) => {
              if (
                typeof toolResult[key] === 'string' &&
                toolResult[key].length > 200
              ) {
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
        error: error.message,
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
          category: analysisData.category,
        };
      case 'ecommerce':
        return {
          productName: analysisData.productName?.substring(0, 100),
          price: analysisData.price,
          inStock: analysisData.inStock,
          brand: analysisData.brand,
        };
      case 'contact':
        return {
          emailCount: analysisData.emails?.length || 0,
          phoneCount: analysisData.phones?.length || 0,
          socialCount: Object.keys(analysisData.socialMedia || {}).length,
          hasContactForm: analysisData.contactForm,
        };
      default:
        return {
          title: analysisData.title?.substring(0, 100),
          linksCount: analysisData.links || 0,
          imagesCount: analysisData.content?.images || 0,
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

    return agents.map(
      (agentData) =>
        new AIAgent({
          ...agentData,
          id: agentData._id,
          openaiApiKey: agentData.openaiApiKey || '',
        })
    );
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

    const agentData = await db.collection('ai_agents').findOne(query);

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
    const existingAgent = await findAgentBySessionId(
      validatedData.sessionId,
      true
    );

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

        const sentMessage = await whatsappClient.sendMessage(
          chatId,
          { text: result.response },
          replyOptions
        );

        // Update presence to available
        await whatsappClient.sendPresenceUpdate('available');

        // Update the conversation entry with the sent message ID for future reference
        if (sentMessage && sentMessage.key && sentMessage.key.id) {
          try {
            await agent.updateConversationEntryWithMessageId(
              result.replyToMessageId,
              sentMessage.key.id,
              chatId
            );
            console.log(`💾 Agent message ID saved: ${sentMessage.key.id}`);
          } catch (updateError) {
            console.error('Error updating conversation entry with message ID:', updateError);
          }
        }

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
        message: 'Nome de arquivo inválido',
      });
    }

    const filePath = path.join(process.cwd(), 'downloads', 'exports', fileName);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado',
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
      message: 'Erro ao baixar arquivo',
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
