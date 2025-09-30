/**
 * Apify Client for GYMNASTIKA Platform
 * Handles Google Maps scraping and other web scraping tasks via secure proxy
 * 
 * SECURITY: All Apify API calls are now proxied through the server
 * to keep API tokens secure and hidden from the browser
 */

class ApifyClient {
    constructor() {
        // Use backend proxy - handle both development and file:// protocol
        this.baseUrl = window.location.origin && window.location.origin !== 'null' 
            ? window.location.origin + '/api/apify'
            : 'http://localhost:3001/api/apify';
        this.initialized = false;
        this.planInfo = null; // Store plan information
        this.defaultActors = {
            googleMaps: 'compass/crawler-google-places',
            googleMapsExtractor: 'compass/google-maps-extractor',
            emailExtractor: 'poidata/google-maps-email-extractor',
            webScraper: 'apify/web-scraper'
        };
    }

    /**
     * Initialize Apify client - API token is securely stored on server
     */
    async initialize() {
        // API token is no longer needed in browser - it's stored on server
        // This is a security improvement: sensitive credentials stay on server
        
        this.initialized = true;
        
        // Auto-detect plan type via secure proxy
        await this.detectPlanType();
        
        console.log('🔒 Apify client initialized with secure proxy');
        console.log('✅ All API tokens are now protected on server-side');
        return true;
    }

    /**
     * Check if client is properly initialized
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Auto-detect Apify plan type based on account limits
     */
    async detectPlanType() {
        try {
            console.log('🔍 Detecting Apify plan type...');
            
            const userInfo = await this.getUserInfo();
            const plan = this.analyzePlanType(userInfo);
            
            this.planInfo = plan;
            console.log(`📊 Apify Plan Detected: ${plan.type.toUpperCase()}`);
            console.log(`💾 Memory Limits: ${plan.maxMemoryMB}MB per task, Max Concurrent: ${plan.maxConcurrent}`);
            
            return plan;
        } catch (error) {
            console.warn('⚠️ Could not detect plan type, using PAID defaults:', error.message);
            this.planInfo = {
                type: 'paid',
                maxMemoryMB: 4096,
                maxConcurrent: 5,
                bufferMultiplier: 12,
                timeoutSecs: 600
            };
            return this.planInfo;
        }
    }

    /**
     * Get user account information via secure proxy
     */
    async getUserInfo() {
        console.log('📡 Fetching user info from:', `${this.baseUrl}/users/me`);
        const response = await fetch(`${this.baseUrl}/users/me`);

        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.status}`);
        }

        const userInfo = await response.json();
        console.log('👤 User info received:', JSON.stringify(userInfo, null, 2));
        return userInfo;
    }

    /**
     * Analyze plan type from user info - ALWAYS PAID PLAN
     */
    analyzePlanType(userInfo) {
        // ALWAYS use PAID plan configuration
        const maxConcurrent = userInfo.plan?.maxConcurrentActorRuns || 5;
        const maxMemory = (userInfo.plan?.maxActorMemoryGbytes || 4) * 1024; // GB to MB

        const planType = {
            type: 'paid',
            maxMemoryMB: Math.min(maxMemory, 8192), // Cap at 8GB
            maxConcurrent: Math.min(maxConcurrent, 10), // Use up to 10 concurrent
            bufferMultiplier: 12,
            timeoutSecs: 600
        };

        console.log(`🚀 PAID plan config: ${planType.maxConcurrent} concurrent, ${planType.maxMemoryMB}MB memory`);
        return planType;
    }

    /**
     * DEPRECATED - Always return PAID plan now
     */
    detectPaidPlanIndicators(userInfo) {
        console.log('🔍 Plan info:', {
            planId: userInfo.plan?.id,
            isPaying: userInfo.isPaying,
            maxConcurrentActorRuns: userInfo.plan?.maxConcurrentActorRuns,
            monthlyBasePriceUsd: userInfo.plan?.monthlyBasePriceUsd
        });

        // ALWAYS PAID PLAN
        console.log('✅ PAID plan mode (FREE logic removed)');
        return true;
    }

    /**
     * Get plan-optimized parameters
     */
    getPlanOptimizedParams(baseMaxResults) {
        if (!this.planInfo) {
            return {
                maxResults: baseMaxResults * 6,
                memoryMB: 1024,
                timeoutSecs: 180
            };
        }

        return {
            maxResults: Math.floor(baseMaxResults * this.planInfo.bufferMultiplier),
            memoryMB: this.planInfo.maxMemoryMB,
            timeoutSecs: this.planInfo.timeoutSecs
        };
    }

    /**
     * Search Google Maps for businesses
     * @param {Object} params - Search parameters
     * @param {string} params.searchTerms - Search query (e.g., "школы гимнастики Дубай")
     * @param {string} params.searchQuery - Alternative for searchTerms (backward compatibility)
     * @param {string} params.location - Location filter (city, country, coordinates)
     * @param {number} params.maxItems - Maximum results to return (default: 10)
     * @param {number} params.maxResults - Alternative for maxItems (backward compatibility)
     * @param {string} params.language - Language for results (e.g., 'en', 'ru', 'ar')
     * @param {string} params.countryCode - Country code for geo-targeting (e.g., 'US', 'AE', 'RU')
     * @param {boolean} params.includeEmails - Extract email addresses (default: false)
     * @returns {Promise<Array>} - Array of business results
     */
    async searchGoogleMaps(params) {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized. Please check your configuration.');
        }

        const {
            searchTerms,
            searchQuery, // Backward compatibility
            location = '',
            maxItems,
            maxResults, // Backward compatibility
            language = 'en',
            countryCode = 'US',
            includeEmails = false
        } = params;

        // Normalize country code to lowercase as required by Apify actor
        const normalizedCountryCode = countryCode.toLowerCase();

        // Handle backward compatibility and parameter variations
        const finalSearchTerms = searchTerms || searchQuery;
        const finalMaxItems = maxItems || maxResults || 10;

        if (!finalSearchTerms) {
            throw new Error('Search terms are required (searchTerms or searchQuery parameter)');
        }

        try {
            // PAID PLAN - No memory tracking, let Apify manage resources
            console.log('🔍 Starting Google Maps search:', finalSearchTerms, `[${language}/${normalizedCountryCode}]`);

            // Prepare search terms - handle both string and array inputs
            let searchTermsArray;
            if (Array.isArray(finalSearchTerms)) {
                searchTermsArray = finalSearchTerms;
            } else {
                searchTermsArray = location ? 
                    [`${finalSearchTerms} ${location}`] : 
                    [finalSearchTerms];
            }

            // Configure actor input with memory optimization
            const input = {
                searchStringsArray: searchTermsArray, // FIXED: Use correct field name for Apify
                maxCrawledPlacesPerSearch: finalMaxItems, // FIXED: Use correct field name, no artificial limit
                language: language,
                locationQuery: location, // FIXED: Use correct field name
                countryCode: normalizedCountryCode,
                exportPlaceUrls: false, // Reduce data size
                scrapeReviewsCount: 0, // Don't scrape reviews to save memory
                scrapeDirectories: false, // Disable to save memory
                scrapeImages: false, // Disable images
                includePeopleAlsoSearch: false,
                // PAID PLAN - Use maximum resources
                memoryMbytes: 4096, // 4GB for PAID plan
                timeoutSecs: 600 // 10 minute timeout for complex queries
            };

            // Choose actor based on email requirement
            const actorId = includeEmails ? 
                this.defaultActors.emailExtractor : 
                this.defaultActors.googleMaps;

            console.log(`📡 Using actor: ${actorId}`);
            
            // Run the actor
            const runResult = await this.runActor(actorId, input);
            
            // Get results
            const results = await this.getResults(runResult.defaultDatasetId);
            
            // Format results for consistency
            const formattedResults = this.formatGoogleMapsResults(results);
            
            console.log(`✅ Found ${formattedResults.length} results for: ${finalSearchTerms} [${language}/${normalizedCountryCode}]`);
            return formattedResults;

        } catch (error) {
            console.error('❌ Proxy Google Maps search failed:', error);
            
            // Check if this is a memory limit error
            if (error.message && error.message.includes('memory limit')) {
                console.log('💾 Memory limit exceeded, attempting automated cleanup...');
                
                try {
                    const cleaned = await this.abortAllRunningTasks();
                    if (cleaned > 0) {
                        console.log(`🧹 Cleaned ${cleaned} tasks, waiting 5 seconds then retrying direct API...`);
                        await this.delay(5000);
                        
                        // Try direct call after cleanup
                        const directResults = await this.scrapeGoogleMapsDirect(
                            finalSearchTerms.split(',').map(s => s.trim()),
                            location,
                            Math.min(maxItems, 5) // Use even smaller limit after cleanup
                        );
                        console.log(`✅ Direct API succeeded after cleanup with ${directResults.length} results`);
                        return this.formatGoogleMapsResults(directResults);
                    }
                } catch (cleanupError) {
                    console.error('❌ Cleanup also failed:', cleanupError);
                }
                
                throw new Error(`Превышен лимит памяти Apify (8GB). Рекомендации:
                1. Нажмите кнопку "🧹 Очистить задачи" для освобождения памяти
                2. Уменьшите количество результатов (попробуйте 5-10 вместо ${maxItems})
                3. Подождите 5-10 минут пока завершатся активные задачи
                4. Рассмотрите платный план Apify для увеличения лимитов
                
                Подробности: ${error.message}`);
            }
            
            console.log('🔄 Attempting direct API fallback...');
            
            // Try direct API call as fallback
            try {
                const directResults = await this.scrapeGoogleMapsDirect(
                    finalSearchTerms.split(',').map(s => s.trim()),
                    location,
                    maxItems
                );
                console.log(`✅ Direct fallback succeeded with ${directResults.length} results`);
                return this.formatGoogleMapsResults(directResults);
                
            } catch (directError) {
                console.error('❌ Direct API fallback also failed:', directError);
                throw new Error(`Both proxy and direct Google Maps search failed. Proxy: ${error.message}, Direct: ${directError.message}`);
            }
        }
    }

    /**
     * Scrape website using Apify Web Scraper
     * @param {Object} params - Scraping parameters
     * @param {Array<string>} params.urls - URLs to scrape
     * @param {Object} params.selectors - CSS selectors for data extraction
     * @param {string} params.pageFunction - Custom JavaScript function for page processing
     * @param {boolean} params.followLinks - Whether to follow links for crawling (default: false)
     * @param {string} params.linkSelector - CSS selector for links to follow
     * @param {number} params.maxPages - Maximum number of pages to scrape (default: 10)
     * @param {string} params.runMode - DEVELOPMENT or PRODUCTION (default: PRODUCTION)
     * @param {boolean} params.injectJQuery - Inject jQuery into pages (default: true)
     * @param {Object} params.proxyConfiguration - Proxy settings
     * @returns {Promise<Array>} - Array of scraped results
     */
    async scrapeWebsite(params) {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized. Please check your configuration.');
        }

        const {
            urls,
            selectors = {},
            pageFunction = null,
            followLinks = false,
            linkSelector = 'a[href]',
            maxPages = 10,
            runMode = 'PRODUCTION',
            injectJQuery = true,
            proxyConfiguration = { useApifyProxy: true }
        } = params;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            throw new Error('URLs array is required for web scraping');
        }

        try {
            console.log('🌐 Starting web scraping for:', urls.length, 'URLs');

            // Prepare start URLs in the required format
            const startUrls = urls.map(url => ({ url }));

            // Generate page function if selectors provided but no custom function
            const finalPageFunction = pageFunction || this.createPageFunction(selectors);

            // Configure input for Web Scraper
            const input = {
                runMode,
                startUrls,
                keepUrlFragments: false,
                respectRobotsTxtFile: true,
                linkSelector: followLinks ? linkSelector : '',
                globs: followLinks ? [{ glob: '**/*' }] : [],
                pseudoUrls: [],
                excludes: [
                    { glob: '/**/*.{png,jpg,jpeg,pdf,zip,rar,doc,docx,xls,xlsx}' }
                ],
                pageFunction: finalPageFunction,
                injectJQuery,
                proxyConfiguration,
                proxyRotation: 'RECOMMENDED',
                initialCookies: [],
                useChrome: false,
                headless: true,
                ignoreSslErrors: false,
                ignoreCorsAndCsp: false,
                downloadMedia: false,
                downloadCss: true,
                maxRequestRetries: 3,
                maxPagesPerCrawl: maxPages,
                maxResultsPerCrawl: maxPages,
                maxCrawlingDepth: followLinks ? 2 : 0,
                maxConcurrency: 10,
                pageLoadTimeoutSecs: 60,
                pageFunctionTimeoutSecs: 60,
                waitUntil: ['networkidle2'],
                breakpointLocation: 'NONE',
                closeCookieModals: true,
                maxScrollHeightPixels: 5000,
                debugLog: runMode === 'DEVELOPMENT',
                browserLog: false,
                customData: {}
            };

            console.log(`📡 Using Web Scraper actor: ${this.defaultActors.webScraper}`);
            
            // Run the Web Scraper actor
            const runResult = await this.runActor(this.defaultActors.webScraper, input);
            
            // Get results
            const results = await this.getResults(runResult.defaultDatasetId);
            
            // Format results for consistency
            const formattedResults = this.formatWebScrapingResults(results);
            
            console.log(`✅ Scraped ${formattedResults.length} pages successfully`);
            return formattedResults;

        } catch (error) {
            console.error('Error during web scraping:', error);
            throw new Error(`Web scraping failed: ${error.message}`);
        }
    }

    /**
     * Run any Apify actor
     * @param {string} actorId - Actor ID or name
     * @param {Object} input - Input data for the actor
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Run result object
     */
    async runActor(actorId, input = {}, options = {}) {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized.');
        }

        const {
            timeout = 900000, // 15 minutes default timeout for slow websites
            waitForFinish = true
        } = options;

        try {
            // ✅ ИСПРАВЛЕНИЕ: Правильное формирование URL для обоих форматов actor ID
            // Одиночные ID (moJRLRc85AitArpNN) и ID с организацией (compass/crawler-google-places)
            let requestUrl;
            if (actorId.includes('/')) {
                // Для ID с организацией - заменяем '/' на '~' для старого формата
                const actorPath = actorId.replace('/', '~');
                requestUrl = `${this.baseUrl}/${actorPath}/runs`;
            } else {
                // Для одиночных ID используем новый маршрут
                requestUrl = `${this.baseUrl}/${actorId}/runs`;
            }
            
            console.log(`🔗 Actor ID: ${actorId}`);
            console.log(`🌐 Request URL: ${requestUrl}`);
            console.log(`📦 Input size: ${JSON.stringify(input).length} characters`);
            console.log(`🔑 Using server-side API token (secure proxy)`);
            
            // Start the actor run via backend proxy
            console.log(`📤 Sending POST request to start actor...`);
            const runResponse = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(input)
            });

            console.log(`📥 Response status: ${runResponse.status} ${runResponse.statusText}`);
            console.log(`📋 Response headers:`, Object.fromEntries(runResponse.headers.entries()));

            if (!runResponse.ok) {
                const errorText = await runResponse.text();
                console.error(`❌ Actor start failed - Status: ${runResponse.status}`);
                console.error(`❌ Error response text:`, errorText);
                throw new Error(`Failed to start actor: ${runResponse.status} ${errorText}`);
            }

            const runData = await runResponse.json();
            console.log(`🚀 Started actor run: ${runData.data.id}`);

            if (!waitForFinish) {
                return runData.data;
            }

            // Wait for completion
            const completedRun = await this.waitForRunCompletion(runData.data.id, timeout);
            return completedRun;

        } catch (error) {
            console.error('Error running actor:', error);
            throw error;
        }
    }

    /**
     * Wait for actor run completion
     * @param {string} runId - Run ID to monitor
     * @param {number} timeout - Maximum wait time in milliseconds
     * @returns {Promise<Object>} - Completed run data
     */
    async waitForRunCompletion(runId, timeout = 900000) {
        const startTime = Date.now();
        const pollInterval = 2000; // Poll every 2 seconds

        while (Date.now() - startTime < timeout) {
            try {
                const runData = await this.getRunStatus(runId);
                
                console.log(`⏳ Actor run status: ${runData.status}`);

                if (runData.status === 'SUCCEEDED') {
                    console.log('✅ Actor run completed successfully');
                    return runData;
                } else if (runData.status === 'FAILED' || runData.status === 'TIMED-OUT' || runData.status === 'ABORTED') {
                    throw new Error(`Actor run failed with status: ${runData.status}`);
                }

                // Wait before next poll
                await this.delay(pollInterval);

            } catch (error) {
                if (error.message.includes('failed with status')) {
                    throw error;
                }
                console.warn('Error polling run status:', error.message);
                await this.delay(pollInterval);
            }
        }

        throw new Error('Actor run timeout exceeded');
    }

    /**
     * Get actor run status
     * @param {string} runId - Run ID
     * @returns {Promise<Object>} - Run status data
     */
    async getRunStatus(runId) {
        const response = await fetch(`${this.baseUrl}/runs/${runId}`);

        if (!response.ok) {
            throw new Error(`Failed to get run status: ${response.status}`);
        }

        const data = await response.json();
        return data.data;
    }

    /**
     * Get results from dataset
     * @param {string} datasetId - Dataset ID
     * @returns {Promise<Array>} - Array of results
     */
    async getResults(datasetId) {
        if (!datasetId) {
            throw new Error('Dataset ID is required');
        }

        try {
            const response = await fetch(`${this.baseUrl}/datasets/${datasetId}/items`, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get results: ${response.status}`);
            }

            const data = await response.json();
            return data || [];

        } catch (error) {
            console.error('Error getting results:', error);
            throw error;
        }
    }

    /**
     * Format Google Maps results for consistent output
     * @param {Array} rawResults - Raw results from Apify
     * @returns {Array} - Formatted results
     */
    formatGoogleMapsResults(rawResults) {
        return rawResults.map(result => ({
            title: result.title || result.name || 'Unknown',
            address: result.address || result.location?.address || 'No address',
            phone: result.phoneNumber || result.phone || null,
            website: result.website || result.url || null,
            email: result.email || null,
            rating: result.rating || result.totalScore || null,
            reviewsCount: result.reviewsCount || result.reviewCount || null,
            categories: result.categories || result.category ? [result.category] : [],
            coordinates: {
                lat: result.location?.lat || result.latitude || null,
                lng: result.location?.lng || result.longitude || null
            },
            openingHours: result.openingHours || result.hours || null,
            googleMapsUrl: result.url || result.googleMapsUrl || null,
            description: result.description || null,
            imageUrl: result.imageUrl || result.image || null
        }));
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get client status and statistics
     */
    getStatus() {
        return {
            initialized: this.initialized,
            hasToken: !!this.apiToken,
            tokenValid: this.apiToken && this.apiToken.startsWith('apify_api_'),
            availableActors: this.defaultActors
        };
    }

    /**
     * Create page function for data extraction based on selectors
     * @param {Object} selectors - CSS selectors for data extraction
     * @returns {string} - JavaScript function as string
     */
    createPageFunction(selectors = {}) {
        const selectorEntries = Object.entries(selectors);
        
        if (selectorEntries.length === 0) {
            // Default page function for general content extraction
            return `async function pageFunction(context) {
                const $ = context.jQuery;
                const pageTitle = $('title').first().text();
                const h1 = $('h1').first().text();
                const h2 = $('h2').first().text();
                const description = $('meta[name="description"]').attr('content') || '';
                const mainContent = $('main, .content, .main-content, article').first().text().substring(0, 500);
                const allLinks = [];
                $('a[href]').each(function() {
                    const href = $(this).attr('href');
                    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                        allLinks.push(href);
                    }
                });

                context.log.info(\`Scraped: \${context.request.url} - \${pageTitle}\`);

                return {
                    url: context.request.url,
                    title: pageTitle,
                    h1: h1,
                    h2: h2, 
                    description: description,
                    mainContent: mainContent,
                    links: allLinks.slice(0, 20), // Limit to 20 links
                    scrapedAt: new Date().toISOString()
                };
            }`;
        }

        // Generate custom page function based on provided selectors
        const extractionCode = selectorEntries.map(([key, selector]) => {
            // Handle different types of selectors
            if (selector.includes('[href]')) {
                return `const ${key} = [];
                $('${selector}').each(function() {
                    const href = $(this).attr('href');
                    if (href) ${key}.push(href);
                });`;
            } else if (selector.includes('[src]')) {
                return `const ${key} = [];
                $('${selector}').each(function() {
                    const src = $(this).attr('src');
                    if (src) ${key}.push(src);
                });`;
            } else if (selector.includes('meta')) {
                return `const ${key} = $('${selector}').attr('content') || '';`;
            } else {
                return `const ${key} = $('${selector}').map(function() {
                    return $(this).text().trim();
                }).get().join(' | ');`;
            }
        }).join('\\n                ');

        const returnObject = selectorEntries.map(([key]) => `${key}: ${key}`).join(',\\n                    ');

        return `async function pageFunction(context) {
            const $ = context.jQuery;
            
            // Extract data using provided selectors
            ${extractionCode}

            // Basic page info
            const pageTitle = $('title').first().text();
            const url = context.request.url;

            context.log.info(\`Scraped: \${url} - \${pageTitle}\`);

            return {
                url: url,
                title: pageTitle,
                ${returnObject},
                scrapedAt: new Date().toISOString()
            };
        }`;
    }

    /**
     * Format web scraping results for consistent output
     * @param {Array} rawResults - Raw results from Apify Web Scraper
     * @returns {Array} - Formatted results
     */
    formatWebScrapingResults(rawResults) {
        if (!Array.isArray(rawResults)) {
            return [];
        }

        return rawResults.map(result => {
            // Ensure consistent structure
            const formatted = {
                url: result.url || 'Unknown URL',
                title: result.title || result.pageTitle || 'No title',
                content: result.mainContent || result.text || result.h1 || 'No content',
                scrapedAt: result.scrapedAt || new Date().toISOString(),
                ...result // Include all other fields
            };

            // Clean up undefined values
            Object.keys(formatted).forEach(key => {
                if (formatted[key] === undefined || formatted[key] === null) {
                    delete formatted[key];
                }
            });

            return formatted;
        });
    }

    /**
     * Test connection to Apify API
     */
    async testConnection() {
        if (!this.isInitialized()) {
            throw new Error('Client not initialized');
        }

        try {
            const response = await fetch(`${this.baseUrl}/users/me`);

            if (!response.ok) {
                throw new Error(`Connection test failed: ${response.status}`);
            }

            const userData = await response.json();
            console.log('✅ Apify connection test successful:', userData.data.username);
            return true;

        } catch (error) {
            console.error('❌ Apify connection test failed:', error);
            throw error;
        }
    }

    // ==========================================
    // DIRECT API METHODS (based on apify.md)
    // ==========================================

    /**
     * Direct Apify API call - bypasses proxy server
     * @param {Object} params - Search parameters
     * @returns {Promise<string>} - Run ID
     */
    async startDirectApifyRun(params) {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized.');
        }

        // Use the direct actor ID from configuration
        const DIRECT_ACTOR_ID = window.ENV?.APIFY_DIRECT_ACTOR_ID || 'nwua9Gu5YrADL7ZDj';
        
        console.log(`🚀 Starting direct Apify Google Maps scraping with ${params.searchStringsArray.length} queries`);
        
        // Use proxy endpoint instead of direct API call
        const proxyUrl = `${this.baseUrl}/${DIRECT_ACTOR_ID}/runs`;
        console.log(`🔗 Direct Apify Proxy URL: ${proxyUrl}`);
        console.log(`📦 Direct Apify params:`, JSON.stringify(params, null, 2));
        
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Direct Apify scraping failed: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log(`✅ Direct Apify run started with ID: ${data.data.id}`);
        
        return data.data.id;
    }

    /**
     * Check direct Apify run status
     * @param {string} runId - Run ID
     * @returns {Promise<Object>} - Status object
     */
    async checkDirectRunStatus(runId) {
        // Use existing proxy endpoint for run status
        const response = await fetch(`${this.baseUrl}/runs/${runId}`);

        if (!response.ok) {
            throw new Error(`Failed to check direct Apify run status: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            status: data.data.status,
            defaultDatasetId: data.data.defaultDatasetId
        };
    }

    /**
     * Get direct Apify results
     * @param {string} datasetId - Dataset ID
     * @returns {Promise<Array>} - Results array
     */
    async getDirectResults(datasetId) {
        console.log(`📥 Fetching direct results from dataset: ${datasetId}`);
        
        // Use existing proxy endpoint for dataset items
        const response = await fetch(`${this.baseUrl}/datasets/${datasetId}/items`);

        if (!response.ok) {
            throw new Error(`Failed to get direct Apify results: ${response.statusText}`);
        }

        const results = await response.json();
        console.log(`📊 Retrieved ${results.length} direct results from Apify`);
        
        return results.map((item) => ({
            title: item.title || item.name || 'Unknown',
            address: item.address || '',
            website: item.website || item.url || '',
            phone: item.phone || item.phoneNumber || '',
            email: item.email || '',
            description: item.description || item.about || '',
            category: item.categoryName || item.category || '',
            placeId: item.placeId || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            isVerified: item.isVerified || false,
            totalScore: item.totalScore || 0,
            reviewsCount: item.reviewsCount || 0
        }));
    }

    /**
     * Wait for direct Apify completion
     * @param {string} runId - Run ID
     * @param {number} maxWaitMinutes - Max wait time
     * @returns {Promise<Array>} - Results
     */
    async waitForDirectCompletion(runId, maxWaitMinutes = 10) {
        const maxAttempts = maxWaitMinutes * 6; // 10 seconds between checks
        let attempts = 0;

        while (attempts < maxAttempts) {
            const { status, defaultDatasetId } = await this.checkDirectRunStatus(runId);
            console.log(`⏳ Direct Apify status: ${status} (${attempts}/${maxAttempts})`);
            
            if (status === 'SUCCEEDED' && defaultDatasetId) {
                return await this.getDirectResults(defaultDatasetId);
            }
            
            if (status === 'FAILED') {
                throw new Error('Direct Apify scraping failed');
            }
            
            await this.delay(10000); // 10 seconds
            attempts++;
        }
        
        throw new Error(`Direct Apify scraping timed out after ${maxWaitMinutes} minutes`);
    }

    /**
     * Main function for direct Google Maps scraping (like in apify.md)
     * @param {Array} searchQueries - Array of search strings
     * @param {string} location - Location query
     * @param {number} maxResults - Max results to return
     * @returns {Promise<Array>} - Results array
     */
    async scrapeGoogleMapsDirect(searchQueries, location, maxResults = 50) {
        const params = {
            searchStringsArray: searchQueries, // Correct field name
            locationQuery: location, // Correct field name 
            maxCrawledPlacesPerSearch: Math.ceil(maxResults / searchQueries.length * 2), // Correct field name, get 2x more for filtering
            language: 'en',
            exportPlaceUrls: false, // Reduce data to save memory
            scrapeDirectEmailAndPhone: true, // Keep emails
            skipClosedPlaces: true,
            // Memory optimization for direct calls
            memoryMbytes: 1024, // Use 1GB instead of default 4GB
            timeoutSecs: 180 // 3 minute timeout
        };
        
        console.log(`🎯 Direct Apify search: ${searchQueries.length} queries in ${location}`);
        searchQueries.forEach((q, i) => console.log(`   ${i+1}. "${q}"`));
        
        const runId = await this.startDirectApifyRun(params);
        const results = await this.waitForDirectCompletion(runId, 15); // 15 minutes wait
        
        // Return all results - websites will be filtered later in pipeline
        console.log(`✅ Direct Apify completed: ${results.length} total results`);
        console.log(`📊 Results breakdown: ${results.filter(r => r.website).length} with websites, ${results.filter(r => r.email).length} with emails`);
        
        return results.slice(0, maxResults);
    }

    /**
     * Simple delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==========================================
    // TASK MANAGEMENT METHODS (memory cleanup)
    // ==========================================

    /**
     * Get all user's runs (to find active ones)
     * @returns {Promise<Array>} - Array of user runs
     */
    async getUserRuns() {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized.');
        }

        try {
            // Use proxy endpoint instead of direct API call
            const response = await fetch(`${this.baseUrl}/runs?status=RUNNING&limit=100`);
            
            if (!response.ok) {
                throw new Error(`Failed to get user runs: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`📊 Found ${data.data.items.length} running tasks`);
            return data.data.items;
        } catch (error) {
            console.error('❌ Error getting user runs:', error);
            throw error;
        }
    }

    /**
     * Abort a specific run
     * @param {string} runId - Run ID to abort
     * @returns {Promise<boolean>} - Success status
     */
    async abortRun(runId) {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized.');
        }

        try {
            // Use proxy endpoint instead of direct API call
            const response = await fetch(`${this.baseUrl}/runs/${runId}/abort`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                console.warn(`⚠️ Failed to abort run ${runId}: ${response.statusText}`);
                return false;
            }

            console.log(`✅ Aborted run: ${runId}`);
            return true;
        } catch (error) {
            console.error(`❌ Error aborting run ${runId}:`, error);
            return false;
        }
    }

    /**
     * Abort all running tasks to free up memory
     * @returns {Promise<number>} - Number of aborted tasks
     */
    async abortAllRunningTasks() {
        try {
            console.log('🧹 Cleaning up running tasks to free memory...');
            
            const runningTasks = await this.getUserRuns();
            let abortedCount = 0;

            for (const task of runningTasks) {
                const success = await this.abortRun(task.id);
                if (success) {
                    abortedCount++;
                }
                // Small delay between aborts
                await this.delay(200);
            }

            console.log(`✅ Cleanup complete: ${abortedCount}/${runningTasks.length} tasks aborted`);
            return abortedCount;
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            return 0;
        }
    }

    /**
     * Get account usage information
     * @returns {Promise<Object>} - Account usage data
     */
    async getAccountUsage() {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized.');
        }

        try {
            // Use existing proxy endpoint for user info
            const response = await fetch(`${this.baseUrl}/users/me`);
            
            if (!response.ok) {
                throw new Error(`Failed to get account info: ${response.statusText}`);
            }

            const userData = await response.json();
            
            // Note: Usage endpoint not available through proxy, skip usage data
            let usage = null;

            return {
                user: userData.data,
                usage: usage?.data || null
            };
        } catch (error) {
            console.error('❌ Error getting account usage:', error);
            throw error;
        }
    }

    /**
     * Check if there's enough memory available
     * @param {number} requiredMB - Required memory in MB
     * @returns {Promise<boolean>} - Whether memory is available
     */
    async checkMemoryAvailability(requiredMB = 1024) {
        try {
            const runningTasks = await this.getUserRuns();
            
            // Estimate memory usage (assuming 4GB per task by default)
            const estimatedUsedMemory = runningTasks.length * 4096; // 4GB per task
            const memoryLimit = 8192; // Free plan limit
            const availableMemory = memoryLimit - estimatedUsedMemory;
            
            console.log(`💾 Memory check: ${estimatedUsedMemory}MB/${memoryLimit}MB used, ${requiredMB}MB requested`);
            
            return availableMemory >= requiredMB;
        } catch (error) {
            console.error('❌ Error checking memory availability:', error);
            return false; // Assume no memory available on error
        }
    }

    /**
     * Scrape detailed information from websites using Apify Web Scraper
     * @param {Array} urls - Array of URLs to scrape
     * @param {Object} options - Scraping options
     * @returns {Promise<Array>} - Scraped data with organization details
     */
    async scrapeWebsiteDetails(urls) {
        if (!this.isInitialized()) {
            throw new Error('Apify client not initialized.');
        }

        if (!Array.isArray(urls) || urls.length === 0) {
            console.warn('⚠️ No URLs provided for web scraping');
            return [];
        }

        try {
            console.log(`🌐 Starting website details scraping for ${urls.length} URLs`);

            // Get plan-optimized parameters
            const planParams = this.getPlanOptimizedParams(urls.length);
            console.log(`📊 Using plan-optimized settings: ${planParams.maxConcurrency} concurrency, ${planParams.memoryMB}MB memory`);

            // Prepare URLs for scraping (filter valid URLs)
            const validUrls = urls
                .filter(url => {
                    // ✅ УЛУЧШЕННАЯ ФИЛЬТРАЦИЯ: Исключаем некорректные URLs
                    return url && 
                           typeof url === 'string' && 
                           (url.startsWith('http://') || url.startsWith('https://')) &&
                           !url.includes('google.com/maps') && // Исключить ссылки на Google Maps
                           !url.includes('maps.google.com') && // Исключить старые ссылки на карты
                           !url.includes('goo.gl/maps') && // Исключить короткие ссылки на карты
                           !url.includes('maps.app.goo.gl') && // Исключить новые ссылки на карты
                           !url.includes('facebook.com') && // Исключить социальные сети (обычно блокируют скрапинг)
                           !url.includes('instagram.com') &&
                           !url.includes('linkedin.com') &&
                           !url.includes('twitter.com') &&
                           !url.includes('tiktok.com') &&
                           !url.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx|zip|mp4|mp3)$/i); // Исключить файлы
                })
                .map(url => ({ url }));

            if (validUrls.length === 0) {
                console.warn('⚠️ No valid URLs found for scraping');
                return [];
            }

            console.log(`✅ ${validUrls.length} valid URLs prepared for scraping`);
            
            // 🔍 ДИАГНОСТИКА: Показать первые несколько URLs для проверки
            console.log(`📋 URLs для скрапинга (первые 5):`, validUrls.slice(0, 5).map((item, index) => 
                `${index + 1}. ${item.url}`
            ));
            
            if (validUrls.length > 5) {
                console.log(`... и еще ${validUrls.length - 5} URLs`);
            }

            // Configure Web Scraper input - STRICT URL-only scraping
            const input = {
                runMode: "PRODUCTION",
                startUrls: validUrls,
                keepUrlFragments: false,
                respectRobotsTxtFile: false, // Skip robots.txt for faster processing
                linkSelector: "", // ✅ NO link following
                globs: [], // ✅ NO additional URL patterns  
                pseudoUrls: [], // ✅ NO URL expansion
                excludes: [
                    { glob: "/**/*.{png,jpg,jpeg,pdf,doc,docx,zip,mp4,mp3,css,js}" }
                ],
                pageFunction: this.createOrganizationPageFunction(),
                injectJQuery: true,
                proxyConfiguration: {
                    useApifyProxy: true // ✅ ИСПРАВЛЕНО: Включить базовые прокси (обязательно для apify/web-scraper)
                },
                proxyRotation: "RECOMMENDED",
                initialCookies: [],
                useChrome: false,
                headless: true,
                ignoreSslErrors: true,
                ignoreCorsAndCsp: false,
                downloadMedia: false,
                downloadCss: false,
                maxRequestRetries: 2, // ✅ ИСПРАВЛЕНО: Увеличено с 1 до 2 для надежности
                maxPagesPerCrawl: validUrls.length, // ✅ EXACT count
                maxResultsPerCrawl: validUrls.length, // ✅ EXACT count
                maxCrawlingDepth: 0, // ✅ ZERO depth = no crawling
                maxConcurrency: Math.min(planParams.maxConcurrency || 2, 3), // Conservative
                pageLoadTimeoutSecs: 120, // ✅ ИСПРАВЛЕНО: Увеличено до 120 секунд для медленных сайтов ОАЭ
                pageFunctionTimeoutSecs: 60, // ✅ ИСПРАВЛЕНО: Увеличено до 60 секунд для медленных сайтов ОАЭ
                waitUntil: ["domcontentloaded"], // Don't wait for full loading
                closeCookieModals: true,
                maxScrollHeightPixels: 500, // Minimal scrolling
                debugLog: false,
                browserLog: false,
                memoryMbytes: 512, // ✅ ИСПРАВЛЕНО: Минимальная память для бесплатного аккаунта
                customData: {
                    scrapingType: 'url_only_scraping', // ✅ Clear purpose
                    urlCount: validUrls.length,
                    timestamp: new Date().toISOString()
                }
            };

            console.log(`🕷️ Executing Web Scraper actor: ${this.defaultActors.webScraper}`);
            console.log(`📋 Configuration: ${input.maxConcurrency} concurrency, ${input.memoryMbytes}MB memory`);
            console.log(`⏱️ Timeouts: ${input.pageLoadTimeoutSecs}s page load, ${input.pageFunctionTimeoutSecs}s function`);

            // Run the Web Scraper actor
            console.log(`🚀 Starting Web Scraper actor run...`);
            console.log(`🔧 Full input configuration:`, JSON.stringify(input, null, 2));
            console.log(`🎯 API endpoint: ${this.baseUrl}/actors/${this.defaultActors.webScraper}/runs`);
            console.log(`🔑 API token present: ${this.apiToken ? 'YES (' + this.apiToken.substring(0, 15) + '...)' : 'NO'}`);
            
            const runResult = await this.runActor(this.defaultActors.webScraper, input);
            console.log(`📋 Raw runResult:`, runResult);

            if (!runResult || !runResult.defaultDatasetId) {
                console.error(`❌ Web Scraper failed: no dataset returned`);
                console.error(`📊 Run result:`, runResult);
                throw new Error('Web scraper run failed - no dataset returned');
            }

            console.log(`✅ Web Scraper completed successfully!`);
            console.log(`📊 Run ID: ${runResult.id}, Dataset: ${runResult.defaultDatasetId}`);

            // Get scraping results
            console.log(`📊 Fetching scraping results from dataset: ${runResult.defaultDatasetId}`);
            const results = await this.getResults(runResult.defaultDatasetId);

            console.log(`✅ Web scraping complete: ${results.length} results extracted`);
            
            // ✅ УЛУЧШЕННАЯ ОБРАБОТКА: Проверка на частичные результаты
            if (results.length === 0 && validUrls.length > 0) {
                console.warn(`⚠️ Web Scraper returned 0 results but had ${validUrls.length} URLs to process`);
                console.warn(`🔍 This might indicate:
  - All websites failed to load (timeout/connection issues)
  - pageFunction crashed on all pages
  - Proxy/rate limiting issues
  - Invalid pageFunction syntax`);
                
                // Вместо падения, возвращаем частичные данные с информацией о проблеме
                throw new Error(`Web scraper processed ${validUrls.length} URLs but returned 0 results - likely timeout or pageFunction issues`);
            }
            
            if (results.length < validUrls.length / 2) {
                console.warn(`⚠️ Partial success: Got ${results.length} results from ${validUrls.length} URLs (${Math.round(results.length/validUrls.length*100)}% success rate)`);
                console.warn(`🔧 Consider: increasing timeouts, reducing concurrency, or checking problematic URLs`);
            }

            // Format and validate results
            const formattedResults = this.formatOrganizationResults(results);
            
            // ✅ ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА: Показать статистику извлечения
            const withEmails = formattedResults.filter(r => r.email).length;
            const withoutEmails = formattedResults.length - withEmails;
            
            console.log(`🎯 Formatted ${formattedResults.length} organization details:`);
            console.log(`  📧 С email адресами: ${withEmails} (${Math.round(withEmails/formattedResults.length*100)}%)`);
            console.log(`  ❌ Без email адресов: ${withoutEmails} (${Math.round(withoutEmails/formattedResults.length*100)}%)`);
            
            if (withEmails === 0 && formattedResults.length > 0) {
                console.warn(`⚠️ Внимание: ни один сайт не содержит email адресов. Возможные причины:
  - Сайты блокируют ботов
  - Email адреса находятся за формами обратной связи
  - Нужно добавить поиск на /contact или /contacts страницах`);
            }
            
            return formattedResults;

        } catch (error) {
            console.error('❌ Website scraping failed:', error);
            console.error('🔍 Full error details:', {
                message: error.message,
                stack: error.stack ? error.stack.substring(0, 500) : 'No stack trace',
                errorType: error.constructor.name,
                urls: urls.slice(0, 5).map(url => typeof url === 'string' ? url : url), // Показать первые 5 URL
                urlCount: urls.length
            });
            
            // 🔄 УЛУЧШЕННАЯ ОБРАБОТКА: Попробовать определить тип ошибки
            let errorDescription = 'Неизвестная ошибка скрапинга';
            if (error.message.includes('timeout')) {
                errorDescription = 'Превышено время ожидания загрузки сайта';
                console.warn('⏰ Timeout error detected - consider increasing pageLoadTimeoutSecs');
            } else if (error.message.includes('memory')) {
                errorDescription = 'Недостаточно памяти для обработки';
                console.warn('💾 Memory error detected - consider reducing concurrent requests');
            } else if (error.message.includes('proxy')) {
                errorDescription = 'Проблемы с прокси-сервером';
                console.warn('🔐 Proxy error detected - consider changing proxy settings');
            } else if (error.message.includes('rate limit')) {
                errorDescription = 'Превышен лимит запросов';
                console.warn('🚦 Rate limit error detected - need to wait');
            } else if (error.message.includes('no dataset')) {
                errorDescription = 'Web Scraper не вернул результаты';
                console.warn('📊 No dataset error - Web Scraper may have failed to start');
            }
            
            console.log(`📋 Returning ${urls.length} fallback results with error description: ${errorDescription}`);
            
            // Return fallback data structure with enhanced error info
            return urls.map(url => ({
                url: typeof url === 'string' ? url : url.url || 'Unknown URL',
                organizationName: 'Не удалось извлечь',
                email: null,
                description: errorDescription, // ✅ Более информативное описание ошибки
                country: 'Не определено',
                scrapingError: error.message,
                errorType: error.constructor.name,
                scrapedAt: new Date().toISOString()
            }));
        }
    }

    /**
     * Create simplified pageFunction compatible with standard apify/web-scraper
     */
    createOrganizationPageFunction() {
        return `async function pageFunction(context) {
            const $ = context.jQuery;
            const url = context.request.url;
            
            try {
                // Extract basic information
                const title = $('title').first().text().trim();
                const h1 = $('h1').first().text().trim();
                
                const organizationName = title || h1 || 'Unknown Organization';
                
                // Simple email extraction for standard web-scraper
                const bodyText = $('body').text();
                const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                const email = emailMatch ? emailMatch[0] : null;
                
                // Basic description from meta tag
                const description = $('meta[name="description"]').attr('content') || 'No description';
                
                return {
                    title: organizationName,
                    url: url,
                    email: email,
                    description: description
                };
                
            } catch (error) {
                return {
                    title: 'Error',
                    url: url,
                    email: null,
                    description: 'Failed to extract data'
                };
            }
        }`;
    }

    /**
     * Format organization scraping results
     */
    formatOrganizationResults(rawResults) {
        if (!Array.isArray(rawResults)) {
            return [];
        }

        return rawResults.map(result => ({
            url: result.url || 'Unknown URL',
            organizationName: result.organizationName || 'Неизвестная организация',
            email: result.email || null,
            description: result.description || 'Описание недоступно',
            website: result.website || result.url,
            country: result.country || 'Не определено',
            allEmails: result.allEmails || [],
            scrapedAt: result.scrapedAt || new Date().toISOString(),
            pageTitle: result.pageTitle || '',
            hasContactInfo: result.hasContactInfo || false,
            scrapingError: result.scrapingError || null
        }));
    }
}

// Export class globally first
window.ApifyClient = ApifyClient;

// Create global instance
window.apifyClient = new ApifyClient();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    if (window.apifyClient) {
        await window.apifyClient.initialize();
    }
});

console.log('📝 Apify client loaded');