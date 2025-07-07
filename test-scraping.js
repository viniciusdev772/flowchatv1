// Test script for new web scraping functionality
const WebSearchEngine = require('./src/utils/webSearch');
const WebScraper = require('./src/utils/webScraper');
const HtmlAnalyzer = require('./src/utils/htmlAnalyzer');
const ZipGenerator = require('./src/utils/zipGenerator');

async function testWebScraping() {
  console.log('🧪 Testing enhanced web scraping functionality...\n');

  // Test 1: Web Search
  console.log('1️⃣ Testing Web Search Engine...');
  try {
    const searchEngine = new WebSearchEngine({
      timeout: 10000,
      maxRetries: 1,
      maxResultsPerSource: 3,
      maxTotalResults: 6
    });
    
    const searchResults = await searchEngine.search('Node.js web scraping');
    console.log(`✅ Search completed: ${searchResults.total} results from ${searchResults.sources.length} sources`);
    console.log(`📊 Sources used: ${searchResults.sources.join(', ')}`);
    
    if (searchResults.results.length > 0) {
      console.log(`📄 First result: ${searchResults.results[0].title}`);
    }
  } catch (error) {
    console.error(`❌ Search test failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Web Scraping
  console.log('2️⃣ Testing Web Scraper...');
  try {
    const scraper = new WebScraper({
      timeout: 15000,
      maxRetries: 2
    });
    
    const scrapedData = await scraper.scrapeWithRetry('https://example.com');
    console.log(`✅ Scraping completed using strategy: ${scrapedData.strategy}`);
    console.log(`📄 Title: ${scrapedData.title}`);
    console.log(`📊 Content length: ${scrapedData.content?.length || 0} chars`);
    console.log(`🔗 Links found: ${scrapedData.stats?.totalLinks || 0}`);
    console.log(`🖼️ Images found: ${scrapedData.stats?.totalImages || 0}`);
  } catch (error) {
    console.error(`❌ Scraping test failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: HTML Analysis
  console.log('3️⃣ Testing HTML Analyzer...');
  try {
    const analyzer = new HtmlAnalyzer({
      timeout: 15000,
      maxRetries: 2
    });
    
    const analysisResult = await analyzer.analyze('https://example.com', 'general');
    console.log(`✅ Analysis completed for type: ${analysisResult.analysisType}`);
    console.log(`📄 Success: ${analysisResult.success}`);
    
    if (analysisResult.success && analysisResult.scrapedData) {
      console.log(`📊 Word count: ${analysisResult.scrapedData.stats?.wordCount || 0}`);
      console.log(`🔗 Strategy used: ${analysisResult.scrapedData.strategy}`);
    }
  } catch (error) {
    console.error(`❌ Analysis test failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: ZIP Generation
  console.log('4️⃣ Testing ZIP Generator...');
  try {
    const zipGenerator = new ZipGenerator({
      outputDir: require('path').join(__dirname, 'downloads', 'exports'),
      compressionLevel: 6
    });
    
    // Create sample data for ZIP
    const sampleData = {
      url: 'https://example.com',
      title: 'Example Website',
      content: 'This is sample content for testing ZIP generation.',
      stats: {
        contentLength: 50,
        wordCount: 10,
        totalLinks: 5,
        totalImages: 2
      },
      strategy: 'test',
      timestamp: new Date().toISOString(),
      success: true
    };
    
    const zipResult = await zipGenerator.generateScrapingZip(sampleData);
    console.log(`✅ ZIP file created: ${zipResult.fileName}`);
    console.log(`📦 Size: ${Math.round(zipResult.size / 1024)} KB`);
    console.log(`🔗 Download URL: ${zipResult.url}`);
  } catch (error) {
    console.error(`❌ ZIP generation test failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 5: Search + ZIP
  console.log('5️⃣ Testing Search + ZIP Generation...');
  try {
    const searchEngine = new WebSearchEngine({
      timeout: 8000,
      maxRetries: 1,
      maxResultsPerSource: 2,
      maxTotalResults: 4
    });
    
    const zipGenerator = new ZipGenerator();
    
    const searchResults = await searchEngine.search('JavaScript testing');
    const zipResult = await zipGenerator.generateSearchZip(searchResults);
    
    console.log(`✅ Search ZIP created: ${zipResult.fileName}`);
    console.log(`📦 Size: ${Math.round(zipResult.size / 1024)} KB`);
    console.log(`📊 ${searchResults.total} results archived`);
  } catch (error) {
    console.error(`❌ Search + ZIP test failed: ${error.message}`);
  }

  console.log('\n🎉 All tests completed!');
}

// Run tests
testWebScraping().catch(console.error);