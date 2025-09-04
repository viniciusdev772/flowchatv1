const cheerio = require('cheerio');
const UserAgent = require('user-agents');
const retry = require('retry');




class WebSearchEngine {
  constructor(options = {}) {
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 2;
    this.userAgent = new UserAgent();
    this.maxResultsPerSource = options.maxResultsPerSource || 8;
    this.maxTotalResults = options.maxTotalResults || 15;
  }




  async search(query, options = {}) {
    console.log(`🔍 Starting multi-source search for: "${query}"`);

    const searchSources = [
      { name: 'DuckDuckGo', method: this.searchDuckDuckGo.bind(this), emoji: '🦆' },
      { name: 'Bing', method: this.searchBing.bind(this), emoji: '🔍' },
      { name: 'Yahoo', method: this.searchYahoo.bind(this), emoji: '🟣' },
      { name: 'Searx', method: this.searchSearx.bind(this), emoji: '🌐' },
      { name: 'Brave', method: this.searchBrave.bind(this), emoji: '🦁' },
      { name: 'Yandex', method: this.searchYandex.bind(this), emoji: '🐻' },
    ];

    const searchPromises = searchSources.map(source =>
      this.searchWithRetry(source, query, options)
    );


    const searchResponses = await Promise.allSettled(
      searchPromises.map(promise =>
        Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Search timeout')), this.timeout)
          )
        ])
      )
    );


    const allResults = [];
    const sourcesUsed = [];
    const sourceErrors = [];

    for (let i = 0; i < searchResponses.length; i++) {
      const response = searchResponses[i];
      const source = searchSources[i];

      if (response.status === 'fulfilled' && response.value.results.length > 0) {
        allResults.push(...response.value.results);
        sourcesUsed.push(source.name);
        console.log(`${source.emoji} ${source.name}: ${response.value.results.length} results`);
      } else {
        const error = response.reason?.message || 'Unknown error';
        sourceErrors.push({ source: source.name, error });
        console.warn(`${source.emoji} ${source.name} failed: ${error}`);
      }
    }


    const uniqueResults = this.removeDuplicates(allResults);
    const finalResults = uniqueResults.slice(0, this.maxTotalResults);

    const searchData = {
      query,
      results: finalResults,
      timestamp: new Date().toISOString(),
      sources: sourcesUsed,
      total: finalResults.length,
      totalFound: allResults.length,
      duplicatesRemoved: allResults.length - uniqueResults.length,
      errors: sourceErrors,
      performance: {
        sourcesAttempted: searchSources.length,
        sourcesSuccessful: sourcesUsed.length,
        successRate: ((sourcesUsed.length / searchSources.length) * 100).toFixed(1) + '%'
      }
    };

    console.log(`✅ Search completed: ${finalResults.length} unique results from ${sourcesUsed.length}/${searchSources.length} sources`);

    return searchData;
  }




  async searchWithRetry(source, query, options) {
    const operation = retry.operation({
      retries: this.maxRetries,
      factor: 1.5,
      minTimeout: 500,
      maxTimeout: 2000,
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          const results = await source.method(query, options);
          resolve({ source: source.name, results });
        } catch (error) {
          if (operation.retry(error)) {
            return;
          }
          resolve({ source: source.name, results: [], error: operation.mainError().message });
        }
      });
    });
  }




  async searchDuckDuckGo(query, options = {}) {
    const fetch = require('node-fetch');
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=br-pt`;

    const response = await fetch(searchUrl, {
      headers: this.getHeaders(),
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.result').each((i, elem) => {
      if (i >= this.maxResultsPerSource) return false;

      const $elem = $(elem);
      const titleLink = $elem.find('.result__title a');
      const title = titleLink.text().trim();
      const url = titleLink.attr('href');
      const snippet = $elem.find('.result__snippet').text().trim();

      if (title && url && snippet) {
        results.push({
          title: this.cleanText(title, 150),
          snippet: this.cleanText(snippet, 300),
          url: url.startsWith('//') ? `https:${url}` : url,
          source: 'duckduckgo',
          relevanceScore: this.calculateRelevance(title, snippet, query)
        });
      }
    });

    return results;
  }




  async searchBing(query, options = {}) {
    const fetch = require('node-fetch');
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=pt-BR&cc=BR`;

    const response = await fetch(searchUrl, {
      headers: this.getHeaders(),
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.b_algo').each((i, elem) => {
      if (i >= this.maxResultsPerSource) return false;

      const $elem = $(elem);
      const titleLink = $elem.find('h2 a');
      const title = titleLink.text().trim();
      const url = titleLink.attr('href');
      const snippet = $elem.find('.b_caption p, .b_snippet').first().text().trim();

      if (title && url && snippet) {
        results.push({
          title: this.cleanText(title, 150),
          snippet: this.cleanText(snippet, 300),
          url: url,
          source: 'bing',
          relevanceScore: this.calculateRelevance(title, snippet, query)
        });
      }
    });

    return results;
  }




  async searchYahoo(query, options = {}) {
    const fetch = require('node-fetch');
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&ei=UTF-8&fr=yfp-t`;

    const response = await fetch(searchUrl, {
      headers: this.getHeaders(),
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.algo, .Sr').each((i, elem) => {
      if (i >= this.maxResultsPerSource) return false;

      const $elem = $(elem);
      const titleLink = $elem.find('h3 a, .title a');
      const title = titleLink.text().trim();
      const url = titleLink.attr('href');
      const snippet = $elem.find('.compText, .abstract').text().trim();

      if (title && url && snippet) {
        results.push({
          title: this.cleanText(title, 150),
          snippet: this.cleanText(snippet, 300),
          url: url,
          source: 'yahoo',
          relevanceScore: this.calculateRelevance(title, snippet, query)
        });
      }
    });

    return results;
  }




  async searchSearx(query, options = {}) {
    const fetch = require('node-fetch');
    const searxInstances = [
      'https://searx.be',
      'https://searx.bar',
      'https://search.privacyguides.net'
    ];


    for (const instance of searxInstances) {
      try {
        const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&language=pt-BR&format=html`;

        const response = await fetch(searchUrl, {
          headers: this.getHeaders(),
          timeout: 8000,
        });

        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];

        $('.result').each((i, elem) => {
          if (i >= this.maxResultsPerSource) return false;

          const $elem = $(elem);
          const titleLink = $elem.find('h3 a');
          const title = titleLink.text().trim();
          const url = titleLink.attr('href');
          const snippet = $elem.find('.content').text().trim();

          if (title && url && snippet) {
            results.push({
              title: this.cleanText(title, 150),
              snippet: this.cleanText(snippet, 300),
              url: url,
              source: 'searx',
              relevanceScore: this.calculateRelevance(title, snippet, query)
            });
          }
        });

        if (results.length > 0) {
          return results;
        }
      } catch (error) {
        continue;
      }
    }

    return [];
  }




  async searchBrave(query, options = {}) {
    const fetch = require('node-fetch');
    const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;

    const response = await fetch(searchUrl, {
      headers: this.getHeaders(),
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('[data-type="web"] .snippet, .fdb').each((i, elem) => {
      if (i >= this.maxResultsPerSource) return false;

      const $elem = $(elem);
      const titleLink = $elem.find('.snippet-title a, .title a');
      const title = titleLink.text().trim();
      const url = titleLink.attr('href');
      const snippet = $elem.find('.snippet-description, .snippet-content').text().trim();

      if (title && url && snippet) {
        results.push({
          title: this.cleanText(title, 150),
          snippet: this.cleanText(snippet, 300),
          url: url,
          source: 'brave',
          relevanceScore: this.calculateRelevance(title, snippet, query)
        });
      }
    });

    return results;
  }




  async searchYandex(query, options = {}) {
    const fetch = require('node-fetch');
    const searchUrl = `https://yandex.com/search/?text=${encodeURIComponent(query)}&lr=21601`;

    const response = await fetch(searchUrl, {
      headers: this.getHeaders(),
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.organic, .serp-item').each((i, elem) => {
      if (i >= this.maxResultsPerSource) return false;

      const $elem = $(elem);
      const titleLink = $elem.find('.organic__url, .organic__title-wrapper a');
      const title = $elem.find('.organic__title-wrapper, .organic__title').text().trim();
      const url = titleLink.attr('href');
      const snippet = $elem.find('.organic__text, .text-container').text().trim();

      if (title && url && snippet) {
        results.push({
          title: this.cleanText(title, 150),
          snippet: this.cleanText(snippet, 300),
          url: url.startsWith('//') ? `https:${url}` : url,
          source: 'yandex',
          relevanceScore: this.calculateRelevance(title, snippet, query)
        });
      }
    });

    return results;
  }




  removeDuplicates(results) {
    const seen = new Set();
    const unique = [];


    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    for (const result of results) {

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




  calculateRelevance(title, snippet, query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const text = (title + ' ' + snippet).toLowerCase();

    let score = 0;

    for (const word of queryWords) {
      if (word.length < 3) continue;


      if (title.toLowerCase().includes(word)) {
        score += 3;
      }


      if (snippet.toLowerCase().includes(word)) {
        score += 1;
      }


      if (text.includes(query.toLowerCase())) {
        score += 5;
      }
    }

    return score;
  }




  cleanText(text, maxLength = 200) {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLength);
  }




  getHeaders() {
    return {
      'User-Agent': this.userAgent.toString(),
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
    };
  }
}

module.exports = WebSearchEngine;