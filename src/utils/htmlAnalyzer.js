const WebScraper = require('./webScraper');

/**
 * Specialized HTML Analyzer for different content types
 */
class HtmlAnalyzer {
  constructor(options = {}) {
    this.scraper = new WebScraper(options);
  }

  /**
   * Analyze HTML content based on type
   */
  async analyze(url, analysisType = 'general', options = {}) {
    console.log(`🔍 Starting HTML analysis for: "${url}" (type: ${analysisType})`);
    
    try {
      // First scrape the page
      const scrapedData = await this.scraper.scrapeWithRetry(url, options);
      
      // Then perform specialized analysis
      let analysis;
      
      switch (analysisType.toLowerCase()) {
        case 'news':
          analysis = this.analyzeNewsArticle(scrapedData);
          break;
        case 'ecommerce':
          analysis = this.analyzeEcommercePage(scrapedData);
          break;
        case 'contact':
          analysis = this.analyzeContactInfo(scrapedData);
          break;
        case 'social':
          analysis = this.analyzeSocialMedia(scrapedData);
          break;
        case 'forms':
          analysis = this.analyzeForms(scrapedData);
          break;
        case 'job':
          analysis = this.analyzeJobPosting(scrapedData);
          break;
        case 'real-estate':
          analysis = this.analyzeRealEstate(scrapedData);
          break;
        case 'recipe':
          analysis = this.analyzeRecipe(scrapedData);
          break;
        case 'event':
          analysis = this.analyzeEvent(scrapedData);
          break;
        default:
          analysis = this.analyzeGeneralStructure(scrapedData);
      }
      
      // Enhance with scraped data
      analysis.scrapedData = {
        title: scrapedData.title,
        description: scrapedData.description,
        content: scrapedData.content,
        strategy: scrapedData.strategy,
        stats: scrapedData.stats
      };
      
      analysis.url = url;
      analysis.analysisType = analysisType;
      analysis.timestamp = new Date().toISOString();
      analysis.success = true;
      
      console.log(`✅ HTML analysis completed for ${analysisType} analysis`);
      
      return analysis;
      
    } catch (error) {
      console.error(`❌ HTML analysis failed: ${error.message}`);
      return {
        url: url,
        analysisType: analysisType,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze news article content
   */
  analyzeNewsArticle(data) {
    const content = data.content || '';
    const metaTags = data.metaTags || {};
    const jsonLd = data.jsonLd || [];
    
    // Extract structured data for news
    const newsData = jsonLd.find(ld => 
      ld['@type'] === 'NewsArticle' || 
      ld['@type'] === 'Article' ||
      (Array.isArray(ld['@type']) && ld['@type'].includes('NewsArticle'))
    );
    
    const analysis = {
      headline: data.title || data.headings?.h1?.[0] || 'No headline found',
      subheadline: data.headings?.h2?.[0] || '',
      
      // Author information
      author: this.extractAuthor(data, newsData),
      
      // Publication info
      publishDate: this.extractPublishDate(metaTags, newsData),
      modifiedDate: metaTags['article:modified_time'] || newsData?.dateModified || '',
      
      // Content analysis
      wordCount: data.stats?.wordCount || 0,
      readingTime: Math.ceil((data.stats?.wordCount || 0) / 200), // ~200 words per minute
      
      // Categories and tags
      category: metaTags['article:section'] || newsData?.articleSection || '',
      tags: this.extractTags(metaTags, newsData),
      
      // Media content
      images: data.images?.length || 0,
      videos: this.countVideos(content),
      
      // Social and engagement
      hasComments: this.hasComments(content),
      socialSharing: this.hasSocialSharing(data.links || []),
      
      // SEO and technical
      canonicalUrl: metaTags['canonical'] || '',
      ampUrl: metaTags['amphtml'] || '',
      
      // Content quality indicators
      hasQuotes: this.hasQuotes(content),
      hasCitations: this.hasCitations(content),
      hasTimestamps: this.hasTimestamps(content),
      
      // Article structure
      sectionCount: data.headings ? Object.values(data.headings).flat().length : 0,
      listCount: this.countLists(content),
      
      // Publisher info
      publisher: newsData?.publisher?.name || metaTags['og:site_name'] || '',
      
      // Language and location
      language: data.language || 'unknown',
      location: this.extractLocation(content, newsData),
    };
    
    // Add confidence score
    analysis.confidenceScore = this.calculateNewsConfidence(analysis, data);
    
    return analysis;
  }

  /**
   * Analyze e-commerce page
   */
  analyzeEcommercePage(data) {
    const content = data.content || '';
    const metaTags = data.metaTags || {};
    const jsonLd = data.jsonLd || [];
    
    // Find product structured data
    const productData = jsonLd.find(ld => 
      ld['@type'] === 'Product' ||
      (Array.isArray(ld['@type']) && ld['@type'].includes('Product'))
    );
    
    const analysis = {
      // Product information
      productName: productData?.name || data.title || '',
      brand: productData?.brand?.name || metaTags['product:brand'] || '',
      model: productData?.model || '',
      sku: productData?.sku || '',
      gtin: productData?.gtin || productData?.gtin13 || productData?.gtin12 || '',
      
      // Pricing
      price: this.extractPrice(data, productData),
      currency: productData?.offers?.priceCurrency || 'BRL',
      availability: this.extractAvailability(data, productData),
      
      // Product details
      description: productData?.description || data.description || '',
      category: productData?.category || '',
      
      // Images and media
      images: data.images?.length || 0,
      mainImage: data.images?.[0]?.src || '',
      videos: this.countVideos(content),
      
      // Reviews and ratings
      rating: this.extractRating(data, productData),
      reviewCount: this.extractReviewCount(data, productData),
      
      // Purchase options
      addToCartButton: this.hasAddToCartButton(content),
      buyNowButton: this.hasBuyNowButton(content),
      wishlistButton: this.hasWishlistButton(content),
      
      // Shipping and delivery
      freeShipping: this.hasFreeShipping(content),
      deliveryInfo: this.extractDeliveryInfo(content),
      
      // Store information
      seller: productData?.offers?.seller?.name || '',
      storeName: metaTags['og:site_name'] || '',
      
      // Technical specs
      specifications: this.extractSpecifications(data),
      dimensions: this.extractDimensions(content),
      weight: this.extractWeight(content),
      
      // SEO and marketing
      breadcrumbs: this.extractBreadcrumbs(data),
      relatedProducts: this.hasRelatedProducts(content),
      crossSells: this.hasCrossSells(content),
      
      // Trust indicators
      secureCheckout: this.hasSecureCheckout(content),
      returnPolicy: this.hasReturnPolicy(content),
      warranty: this.hasWarranty(content),
    };
    
    analysis.confidenceScore = this.calculateEcommerceConfidence(analysis, data);
    
    return analysis;
  }

  /**
   * Analyze contact information
   */
  analyzeContactInfo(data) {
    const content = data.content || '';
    const metaTags = data.metaTags || {};
    const jsonLd = data.jsonLd || [];
    
    // Find organization/business structured data
    const orgData = jsonLd.find(ld => 
      ld['@type'] === 'Organization' || 
      ld['@type'] === 'LocalBusiness' ||
      (Array.isArray(ld['@type']) && (ld['@type'].includes('Organization') || ld['@type'].includes('LocalBusiness')))
    );
    
    return {
      // Contact methods
      emails: this.extractEmails(content),
      phones: this.extractPhones(content),
      fax: this.extractFax(content),
      
      // Physical location
      addresses: this.extractAddresses(data, orgData),
      coordinates: this.extractCoordinates(orgData),
      
      // Business information
      businessName: orgData?.name || data.title || '',
      businessType: orgData?.['@type'] || '',
      industry: orgData?.industry || '',
      
      // Hours and availability
      businessHours: this.extractBusinessHours(content, orgData),
      timezone: this.extractTimezone(content),
      
      // Online presence
      website: orgData?.url || data.url || '',
      socialMedia: this.extractSocialLinks(data.links || []),
      
      // Contact forms
      contactForm: this.hasContactForm(data.forms || []),
      newsletter: this.hasNewsletterSignup(content),
      
      // Additional info
      description: orgData?.description || data.description || '',
      foundedYear: this.extractFoundedYear(content),
      employeeCount: this.extractEmployeeCount(content),
      
      // Location services
      hasMap: this.hasMap(content),
      hasDirections: this.hasDirections(content),
      parkingInfo: this.extractParkingInfo(content),
      
      // Accessibility
      accessibilityInfo: this.extractAccessibilityInfo(content),
      languages: this.extractLanguages(content),
    };
  }

  /**
   * Analyze social media presence
   */
  analyzeSocialMedia(data) {
    const links = data.links || [];
    const content = data.content || '';
    
    const platforms = {
      facebook: this.findSocialLinks(links, ['facebook.com', 'fb.com']),
      twitter: this.findSocialLinks(links, ['twitter.com', 'x.com']),
      instagram: this.findSocialLinks(links, ['instagram.com']),
      linkedin: this.findSocialLinks(links, ['linkedin.com']),
      youtube: this.findSocialLinks(links, ['youtube.com', 'youtu.be']),
      tiktok: this.findSocialLinks(links, ['tiktok.com']),
      pinterest: this.findSocialLinks(links, ['pinterest.com', 'pin.it']),
      snapchat: this.findSocialLinks(links, ['snapchat.com']),
      whatsapp: this.findSocialLinks(links, ['whatsapp.com', 'wa.me']),
      telegram: this.findSocialLinks(links, ['telegram.org', 't.me']),
    };
    
    return {
      platforms: platforms,
      totalPlatforms: Object.values(platforms).filter(p => p.length > 0).length,
      
      // Social features
      shareButtons: this.countSocialShareButtons(content),
      socialLogin: this.hasSocialLogin(content),
      socialFeeds: this.hasSocialFeeds(content),
      
      // Embedded content
      embeddedPosts: this.countEmbeddedPosts(content),
      socialWidgets: this.countSocialWidgets(content),
      
      // Engagement features
      followButtons: this.hasFollowButtons(content),
      likeButtons: this.hasLikeButtons(content),
      commentSections: this.hasCommentSections(content),
      
      // Marketing
      socialProof: this.hasSocialProof(content),
      testimonials: this.hasTestimonials(content),
      userGeneratedContent: this.hasUserGeneratedContent(content),
    };
  }

  /**
   * Analyze forms on the page
   */
  analyzeForms(data) {
    const forms = data.forms || [];
    const content = data.content || '';
    
    const formTypes = {
      contact: forms.filter(f => this.isContactForm(f)),
      newsletter: forms.filter(f => this.isNewsletterForm(f)),
      login: forms.filter(f => this.isLoginForm(f)),
      registration: forms.filter(f => this.isRegistrationForm(f)),
      search: forms.filter(f => this.isSearchForm(f)),
      payment: forms.filter(f => this.isPaymentForm(f)),
      survey: forms.filter(f => this.isSurveyForm(f)),
      upload: forms.filter(f => this.isUploadForm(f)),
    };
    
    return {
      totalForms: forms.length,
      formTypes: formTypes,
      
      // Form analysis
      formsWithValidation: forms.filter(f => this.hasValidation(f)).length,
      securedForms: forms.filter(f => this.isSecuredForm(f)).length,
      responsiveForms: this.hasResponsiveForms(content),
      
      // Input types
      inputTypes: this.analyzeInputTypes(forms),
      
      // Security features
      captcha: this.hasCaptcha(content),
      csrf: this.hasCSRF(content),
      encryption: this.hasEncryption(content),
      
      // Accessibility
      labelledInputs: this.hasLabelledInputs(forms),
      accessibleForms: this.hasAccessibleForms(content),
      
      // User experience
      autoComplete: this.hasAutoComplete(forms),
      placeholders: this.hasPlaceholders(forms),
      helpText: this.hasHelpText(content),
    };
  }

  /**
   * Analyze job posting
   */
  analyzeJobPosting(data) {
    const content = data.content || '';
    const jsonLd = data.jsonLd || [];
    
    const jobData = jsonLd.find(ld => 
      ld['@type'] === 'JobPosting' ||
      (Array.isArray(ld['@type']) && ld['@type'].includes('JobPosting'))
    );
    
    return {
      // Basic job info
      title: jobData?.title || data.title || '',
      company: jobData?.hiringOrganization?.name || '',
      location: this.extractJobLocation(data, jobData),
      
      // Job details
      employmentType: jobData?.employmentType || this.extractEmploymentType(content),
      workHours: jobData?.workHours || this.extractWorkHours(content),
      salary: this.extractSalary(data, jobData),
      
      // Requirements
      experience: this.extractExperience(content),
      education: this.extractEducation(content),
      skills: this.extractSkills(content),
      languages: this.extractJobLanguages(content),
      
      // Benefits
      benefits: this.extractBenefits(content),
      remote: this.isRemoteJob(content),
      
      // Application
      applicationProcess: this.extractApplicationProcess(content),
      deadline: this.extractApplicationDeadline(content),
      
      // Company info
      companySize: this.extractCompanySize(content),
      industry: this.extractIndustry(content),
    };
  }

  /**
   * Analyze real estate listing
   */
  analyzeRealEstate(data) {
    const content = data.content || '';
    const jsonLd = data.jsonLd || [];
    
    const realEstateData = jsonLd.find(ld => 
      ld['@type'] === 'RealEstateListing' ||
      (Array.isArray(ld['@type']) && ld['@type'].includes('RealEstateListing'))
    );
    
    return {
      // Property basic info
      price: this.extractPropertyPrice(data, realEstateData),
      propertyType: this.extractPropertyType(content),
      
      // Property details
      bedrooms: this.extractBedrooms(content),
      bathrooms: this.extractBathrooms(content),
      area: this.extractArea(content),
      lotSize: this.extractLotSize(content),
      
      // Location
      address: this.extractPropertyAddress(data, realEstateData),
      neighborhood: this.extractNeighborhood(content),
      
      // Features
      amenities: this.extractAmenities(content),
      parking: this.extractParkingSpaces(content),
      yearBuilt: this.extractYearBuilt(content),
      
      // Listing info
      listingType: this.extractListingType(content), // sale, rent, etc.
      mlsNumber: this.extractMLSNumber(content),
      agent: this.extractAgentInfo(content),
    };
  }

  /**
   * Analyze recipe content
   */
  analyzeRecipe(data) {
    const content = data.content || '';
    const jsonLd = data.jsonLd || [];
    
    const recipeData = jsonLd.find(ld => 
      ld['@type'] === 'Recipe' ||
      (Array.isArray(ld['@type']) && ld['@type'].includes('Recipe'))
    );
    
    return {
      // Recipe basic info
      name: recipeData?.name || data.title || '',
      description: recipeData?.description || data.description || '',
      
      // Timing
      prepTime: recipeData?.prepTime || this.extractPrepTime(content),
      cookTime: recipeData?.cookTime || this.extractCookTime(content),
      totalTime: recipeData?.totalTime || this.extractTotalTime(content),
      
      // Servings and yield
      servings: recipeData?.recipeYield || this.extractServings(content),
      
      // Ingredients and instructions
      ingredients: this.extractIngredients(data, recipeData),
      instructions: this.extractInstructions(data, recipeData),
      
      // Nutrition and dietary
      calories: this.extractCalories(content),
      dietaryRestrictions: this.extractDietaryInfo(content),
      
      // Recipe metadata
      cuisine: recipeData?.recipeCuisine || this.extractCuisine(content),
      category: recipeData?.recipeCategory || this.extractRecipeCategory(content),
      difficulty: this.extractDifficulty(content),
      
      // Media
      images: data.images?.length || 0,
      videos: this.countVideos(content),
      
      // User engagement
      rating: this.extractRecipeRating(data, recipeData),
      reviews: this.extractRecipeReviews(content),
    };
  }

  /**
   * Analyze event information
   */
  analyzeEvent(data) {
    const content = data.content || '';
    const jsonLd = data.jsonLd || [];
    
    const eventData = jsonLd.find(ld => 
      ld['@type'] === 'Event' ||
      (Array.isArray(ld['@type']) && ld['@type'].includes('Event'))
    );
    
    return {
      // Event basic info
      name: eventData?.name || data.title || '',
      description: eventData?.description || data.description || '',
      
      // Date and time
      startDate: eventData?.startDate || this.extractStartDate(content),
      endDate: eventData?.endDate || this.extractEndDate(content),
      
      // Location
      venue: this.extractVenue(data, eventData),
      address: this.extractEventAddress(data, eventData),
      
      // Pricing and tickets
      price: this.extractEventPrice(data, eventData),
      ticketing: this.extractTicketingInfo(content),
      
      // Event details
      category: this.extractEventCategory(content),
      organizer: this.extractOrganizer(data, eventData),
      
      // Capacity and attendance
      capacity: this.extractCapacity(content),
      availability: this.extractEventAvailability(content),
      
      // Additional info
      ageRestriction: this.extractAgeRestriction(content),
      dresscode: this.extractDresscode(content),
      accessibility: this.extractEventAccessibility(content),
    };
  }

  /**
   * General structure analysis
   */
  analyzeGeneralStructure(data) {
    const content = data.content || '';
    
    return {
      // Content structure
      title: data.title || '',
      headings: data.headings || {},
      paragraphs: data.stats?.paragraphs || 0,
      
      // Navigation and UX
      navigation: this.analyzeNavigation(data),
      breadcrumbs: this.extractBreadcrumbs(data),
      
      // Content types
      hasArticle: this.hasArticleContent(content),
      hasList: data.stats?.lists > 0,
      hasTables: (data.tables?.length || 0) > 0,
      hasMedia: (data.images?.length || 0) > 0 || this.countVideos(content) > 0,
      
      // Technical
      language: data.language || 'unknown',
      charset: data.charset || 'unknown',
      
      // SEO elements
      metaDescription: data.description || '',
      hasStructuredData: (data.jsonLd?.length || 0) > 0,
      
      // Interactive elements
      forms: (data.forms?.length || 0),
      buttons: this.countButtons(content),
      links: (data.links?.length || 0),
      
      // Content quality
      wordCount: data.stats?.wordCount || 0,
      readability: this.calculateReadability(content),
    };
  }

  // Helper methods for extraction (abbreviated for space)
  
  extractAuthor(data, structured) {
    return structured?.author?.name || 
           data.metaTags?.['article:author'] || 
           data.metaTags?.author || 
           this.findInContent(data.content, /(?:by|author|written by)\s*:?\s*([^,\n.]+)/i) || 
           '';
  }
  
  extractPublishDate(metaTags, structured) {
    return structured?.datePublished || 
           metaTags['article:published_time'] || 
           metaTags['publication_date'] || 
           '';
  }
  
  extractTags(metaTags, structured) {
    const tags = structured?.keywords || metaTags?.keywords || '';
    return typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [];
  }
  
  countVideos(content) {
    const videoMatches = content.match(/youtube|vimeo|video|mp4|webm/gi) || [];
    return videoMatches.length;
  }
  
  hasComments(content) {
    return /comment|discuss|reply/i.test(content);
  }
  
  hasSocialSharing(links) {
    const socialDomains = ['facebook.com', 'twitter.com', 'linkedin.com', 'whatsapp.com'];
    return links.some(link => socialDomains.some(domain => link.url.includes(domain)));
  }
  
  findInContent(content, regex) {
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }
  
  calculateNewsConfidence(analysis, data) {
    let score = 0;
    if (analysis.headline) score += 20;
    if (analysis.author) score += 15;
    if (analysis.publishDate) score += 15;
    if (analysis.wordCount > 300) score += 20;
    if (analysis.category) score += 10;
    if (analysis.images > 0) score += 10;
    if (data.jsonLd?.length > 0) score += 10;
    return Math.min(score, 100);
  }
  
  calculateEcommerceConfidence(analysis, data) {
    let score = 0;
    if (analysis.productName) score += 20;
    if (analysis.price) score += 25;
    if (analysis.addToCartButton) score += 20;
    if (analysis.images > 0) score += 15;
    if (analysis.brand) score += 10;
    if (data.jsonLd?.length > 0) score += 10;
    return Math.min(score, 100);
  }
  
  // Additional helper methods would be implemented here...
  // (Abbreviated for space - each would extract specific data patterns)
  
  extractEmails(content) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return content.match(emailRegex) || [];
  }
  
  extractPhones(content) {
    const phoneRegex = /(?:\+?55\s?)?(?:\(?[0-9]{2}\)?\s?)?(?:[0-9]{4,5}[-.\s]?[0-9]{4})/g;
    return content.match(phoneRegex) || [];
  }
  
  // Placeholder implementations for other methods
  extractFax(content) { return []; }
  extractAddresses(data, orgData) { return []; }
  extractCoordinates(orgData) { return null; }
  extractBusinessHours(content, orgData) { return []; }
  extractTimezone(content) { return ''; }
  extractSocialLinks(links) { return {}; }
  hasContactForm(forms) { return forms.length > 0; }
  hasNewsletterSignup(content) { return /newsletter|subscribe/i.test(content); }
  extractFoundedYear(content) { return ''; }
  extractEmployeeCount(content) { return ''; }
  hasMap(content) { return /map|location/i.test(content); }
  hasDirections(content) { return /directions|navigate/i.test(content); }
  extractParkingInfo(content) { return ''; }
  extractAccessibilityInfo(content) { return ''; }
  extractLanguages(content) { return []; }
  
  findSocialLinks(links, domains) {
    return links.filter(link => 
      domains.some(domain => link.url.includes(domain))
    ).map(link => link.url);
  }
  
  countSocialShareButtons(content) { return 0; }
  hasSocialLogin(content) { return false; }
  hasSocialFeeds(content) { return false; }
  countEmbeddedPosts(content) { return 0; }
  countSocialWidgets(content) { return 0; }
  hasFollowButtons(content) { return false; }
  hasLikeButtons(content) { return false; }
  hasCommentSections(content) { return false; }
  hasSocialProof(content) { return false; }
  hasTestimonials(content) { return false; }
  hasUserGeneratedContent(content) { return false; }
  
  isContactForm(form) { return /contact/i.test(form.action || ''); }
  isNewsletterForm(form) { return /newsletter|subscribe/i.test(form.action || ''); }
  isLoginForm(form) { return /login|signin/i.test(form.action || ''); }
  isRegistrationForm(form) { return /register|signup/i.test(form.action || ''); }
  isSearchForm(form) { return /search/i.test(form.action || ''); }
  isPaymentForm(form) { return /payment|checkout/i.test(form.action || ''); }
  isSurveyForm(form) { return /survey|poll/i.test(form.action || ''); }
  isUploadForm(form) { return form.inputs?.some(i => i.type === 'file'); }
  
  hasValidation(form) { return form.inputs?.some(i => i.required); }
  isSecuredForm(form) { return form.action?.startsWith('https://'); }
  hasResponsiveForms(content) { return false; }
  analyzeInputTypes(forms) { return {}; }
  hasCaptcha(content) { return /captcha|recaptcha/i.test(content); }
  hasCSRF(content) { return /csrf/i.test(content); }
  hasEncryption(content) { return /ssl|tls|encrypt/i.test(content); }
  hasLabelledInputs(forms) { return true; }
  hasAccessibleForms(content) { return false; }
  hasAutoComplete(forms) { return false; }
  hasPlaceholders(forms) { return forms.some(f => f.inputs?.some(i => i.placeholder)); }
  hasHelpText(content) { return false; }
  
  // Placeholder implementations for other specialized analysis methods
  extractPrice(data, productData) { return ''; }
  extractAvailability(data, productData) { return ''; }
  extractRating(data, productData) { return 0; }
  extractReviewCount(data, productData) { return 0; }
  hasAddToCartButton(content) { return /add.*cart|buy.*now/i.test(content); }
  hasBuyNowButton(content) { return /buy.*now|purchase/i.test(content); }
  hasWishlistButton(content) { return /wishlist|favorite/i.test(content); }
  hasFreeShipping(content) { return /free.*ship/i.test(content); }
  extractDeliveryInfo(content) { return ''; }
  extractSpecifications(data) { return []; }
  extractDimensions(content) { return ''; }
  extractWeight(content) { return ''; }
  extractBreadcrumbs(data) { return []; }
  hasRelatedProducts(content) { return /related.*product/i.test(content); }
  hasCrossSells(content) { return /also.*bought|recommend/i.test(content); }
  hasSecureCheckout(content) { return /secure.*checkout/i.test(content); }
  hasReturnPolicy(content) { return /return.*policy/i.test(content); }
  hasWarranty(content) { return /warranty|guarantee/i.test(content); }
  
  analyzeNavigation(data) { return {}; }
  hasArticleContent(content) { return content.length > 500; }
  countButtons(content) { return 0; }
  calculateReadability(content) { return 0; }
}

module.exports = HtmlAnalyzer;