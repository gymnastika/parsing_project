/**
 * Server-side Apify Client for GYMNASTIKA Platform
 * Direct Apify API integration for server-side operations
 */

const fetch = require('node-fetch');

class ServerApifyClient {
    constructor() {
        this.apiToken = process.env.APIFY_API_TOKEN;
        this.baseUrl = 'https://api.apify.com/v2';
        this.initialized = false;
        this.planInfo = null;
        this.defaultActors = {
            googleMaps: 'compass~crawler-google-places',
            googleMapsExtractor: 'compass~google-maps-extractor',
            emailExtractor: 'poiddata~google-maps-email-extractor',
            webScraper: 'apify~web-scraper'
        };
    }

    /**
     * Initialize Apify client with environment variables
     */
    async initialize() {
        if (!this.apiToken) {
            console.error('❌ APIFY_API_TOKEN not found in environment');
            return false;
        }

        this.initialized = true;
        
        // Auto-detect plan type
        await this.detectPlanType();
        
        console.log('🕷️ Server Apify client initialized');
        console.log(`📊 Plan: ${this.planInfo?.type || 'unknown'} (${this.planInfo?.maxConcurrent || 0} max concurrent)`);
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
            const response = await fetch(`${this.baseUrl}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`
                }
            });

            if (!response.ok) {
                console.warn('⚠️ Could not detect Apify plan type');
                this.planInfo = { type: 'paid', maxConcurrent: 10 };
                return;
            }

            const userData = await response.json();
            const user = userData.data;

            // ALWAYS PAID PLAN - FREE logic removed
            const maxConcurrent = user.plan?.maxConcurrentActorRuns || 10;
            this.planInfo = {
                type: 'paid',
                maxConcurrent: Math.min(maxConcurrent, 15)
            };
            console.log(`📊 Apify Plan Detected: PAID (${this.planInfo.maxConcurrent} concurrent)`);

        } catch (error) {
            console.warn('⚠️ Failed to detect Apify plan:', error.message);
            this.planInfo = { type: 'paid', maxConcurrent: 10 };
        }
    }

    /**
     * Search Google Maps using Apify crawler
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} - Array of search results
     */
    async searchGoogleMaps(params) {
        const {
            searchTerms,
            maxItems = 10, // TESTING: Reduced from 500 to 10 for faster testing
            language = 'en',
            countryCode = 'US'
        } = params;

        try {
            console.log(`🗺️ Google Maps search: "${searchTerms}" (${language}/${countryCode}, max: ${maxItems})`);

            // ALWAYS PAID PLAN - Use maximum resources
            const memoryMbytes = 4096; // 4GB memory
            const timeoutSecs = 600; // 10 minutes timeout

            const runInput = {
                searchStringsArray: [searchTerms],
                maxCrawledPlacesPerSearch: maxItems,
                language: language,
                locationQuery: '',
                countryCode: countryCode,
                exportPlaceUrls: false,
                scrapeReviewsCount: 0,
                scrapeDirectories: false,
                scrapeImages: false,
                includePeopleAlsoSearch: false,
                memoryMbytes: memoryMbytes,
                timeoutSecs: timeoutSecs
            };

            // Start the run
            const runResponse = await fetch(`${this.baseUrl}/acts/${this.defaultActors.googleMaps}/runs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(runInput)
            });

            if (!runResponse.ok) {
                const error = await runResponse.json();
                throw new Error(`Failed to start Google Maps search: ${error.error?.message || runResponse.statusText}`);
            }

            const run = await runResponse.json();
            const runId = run.data.id;

            console.log(`⏳ Started Google Maps run: ${runId}`);

            // Wait for completion
            const results = await this.waitForRunCompletion(runId);
            
            console.log(`✅ Google Maps search completed: ${results.length} results`);
            return results;

        } catch (error) {
            console.error(`❌ Google Maps search failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Scrape website details using Apify web scraper
     * @param {Array} urls - Array of URLs to scrape
     * @returns {Promise<Array>} - Array of scraped data
     */
    async scrapeWebsiteDetails(urls) {
        if (!Array.isArray(urls) || urls.length === 0) {
            throw new Error('URLs array is required and cannot be empty');
        }

        try {
            console.log(`🌐 Starting website scraping for ${urls.length} URLs`);

            // Configure for server environment
            const memoryMbytes = this.planInfo?.type === 'paid' ? 1024 : 512;
            const maxConcurrency = this.planInfo?.type === 'paid' ? 5 : 2;

            const runInput = {
                runMode: 'PRODUCTION',
                startUrls: urls.map(url => ({ url })),
                keepUrlFragments: false,
                respectRobotsTxtFile: false,
                linkSelector: 'a[href*="contact"], a[href*="about"], a[href*="связаться"], a[href*="контакт"], a[href*="о-нас"], a[href*="obout"], a[href*="reach"], a[href*="get-in-touch"]',
                globs: [
                    { glob: 'http?(s)://*/contact*' },
                    { glob: 'http?(s)://*/about*' },
                    { glob: 'http?(s)://*/связаться*' },
                    { glob: 'http?(s)://*/контакт*' },
                    { glob: 'http?(s)://*/о-нас*' }
                ],
                pseudoUrls: [],
                excludes: [
                    { glob: '/**/*.{png,jpg,jpeg,pdf,doc,docx,zip,mp4,mp3,css,js}' }
                ],
                pageFunction: `async function pageFunction(context) {
                    const $ = context.jQuery;
                    const url = context.request.url;
                    
                    try {
                        // Extract basic information
                        const title = $('title').first().text().trim();
                        const h1 = $('h1').first().text().trim();
                        
                        const organizationName = title || h1 || 'Unknown Organization';
                        
                        // Enhanced email extraction with multiple patterns
                        const bodyText = $('body').text();
                        const htmlContent = $('body').html();
                        
                        // Multiple email patterns for better detection
                        const emailPattern1 = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                        const emailPattern2 = /[a-zA-Z0-9._-]+\s*@\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                        const emailPattern3 = /[a-zA-Z0-9._%+-]+\s*\[?at\]?\s*[a-zA-Z0-9.-]+\s*\[?dot\]?\s*[a-zA-Z]{2,}/g;
                        
                        let allEmails = [];
                        
                        // Extract from text content
                        const textMatches1 = bodyText.match(emailPattern1) || [];
                        const textMatches2 = bodyText.match(emailPattern2) || [];
                        
                        // Extract from HTML (mailto links)
                        const mailtoLinks = $('a[href^="mailto:"]').map(function() {
                            const href = $(this).attr('href');
                            return href ? href.replace('mailto:', '').split('?')[0] : null;
                        }).get().filter(Boolean);
                        
                        // Extract from specific selectors common in UAE websites
                        const contactSelectors = [
                            'a[href*="@"]',
                            '.contact-email',
                            '.email',
                            '[class*="email"]',
                            '[id*="email"]',
                            'span:contains("@")',
                            'div:contains("@")',
                            'p:contains("@")'
                        ];
                        
                        contactSelectors.forEach(selector => {
                            $(selector).each(function() {
                                const text = $(this).text();
                                const matches = text.match(emailPattern1) || [];
                                allEmails = allEmails.concat(matches);
                            });
                        });
                        
                        // Combine all matches
                        allEmails = allEmails.concat(textMatches1, textMatches2, mailtoLinks);
                        
                        // Clean and deduplicate emails
                        allEmails = [...new Set(allEmails)]
                            .filter(email => email && email.includes('@') && email.includes('.'))
                            .filter(email => !email.match(/\.(png|jpg|jpeg|gif|css|js|pdf)$/i))
                            .map(email => email.trim().toLowerCase());
                        
                        const email = allEmails.length > 0 ? allEmails[0] : null;
                        
                        // Enhanced description from multiple sources
                        let description = $('meta[name="description"]').attr('content') || 
                                        $('meta[property="og:description"]').attr('content') ||
                                        $('p').first().text().trim() ||
                                        'No description';
                        
                        // Country detection from various sources
                        const country = $('meta[name="country"]').attr('content') ||
                                      $('[class*="country"]').text().trim() ||
                                      'Not specified';
                        
                        return {
                            title: organizationName,
                            organizationName: organizationName,
                            url: url,
                            website: url,
                            email: email,
                            allEmails: allEmails,
                            description: description.substring(0, 500),
                            country: country,
                            hasContactInfo: !!email,
                            scrapedAt: new Date().toISOString()
                        };
                        
                    } catch (error) {
                        return {
                            title: 'Error',
                            organizationName: 'Error',
                            url: url,
                            website: url,
                            email: null,
                            allEmails: [],
                            description: 'Failed to extract data',
                            country: 'Not specified',
                            hasContactInfo: false,
                            scrapingError: error.message,
                            scrapedAt: new Date().toISOString()
                        };
                    }
                }`,
                injectJQuery: true,
                proxyConfiguration: { useApifyProxy: true },
                proxyRotation: 'RECOMMENDED',
                initialCookies: [],
                useChrome: false,
                headless: true,
                ignoreSslErrors: true,
                ignoreCorsAndCsp: false,
                downloadMedia: false,
                downloadCss: false,
                maxRequestRetries: 3,
                maxPagesPerCrawl: urls.length * 3,
                maxResultsPerCrawl: urls.length * 3,
                maxCrawlingDepth: 1,
                maxConcurrency: maxConcurrency,
                pageLoadTimeoutSecs: 120,
                pageFunctionTimeoutSecs: 60,
                waitUntil: ['domcontentloaded'],
                closeCookieModals: true,
                maxScrollHeightPixels: 500,
                debugLog: false,
                browserLog: false,
                memoryMbytes: memoryMbytes,
                customData: {
                    scrapingType: 'server_side_scraping',
                    urlCount: urls.length,
                    timestamp: new Date().toISOString()
                }
            };

            // Start the run
            const runResponse = await fetch(`${this.baseUrl}/acts/${this.defaultActors.webScraper}/runs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(runInput)
            });

            if (!runResponse.ok) {
                const error = await runResponse.json();
                throw new Error(`Failed to start web scraping: ${error.error?.message || runResponse.statusText}`);
            }

            const run = await runResponse.json();
            const runId = run.data.id;

            console.log(`⏳ Started web scraping run: ${runId}`);

            // Wait for completion
            const results = await this.waitForRunCompletion(runId);
            
            console.log(`✅ Web scraping completed: ${results.length} results`);
            return results;

        } catch (error) {
            console.error(`❌ Web scraping failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Wait for run completion and get results
     */
    async waitForRunCompletion(runId, maxWait = 1800000) { // 30 minutes
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            try {
                // Check run status
                const statusResponse = await fetch(`${this.baseUrl}/actor-runs/${runId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`
                    }
                });

                if (!statusResponse.ok) {
                    throw new Error(`Failed to get run status: ${statusResponse.statusText}`);
                }

                const runStatus = await statusResponse.json();
                const status = runStatus.data.status;

                console.log(`📊 Run ${runId} status: ${status}`);

                if (status === 'SUCCEEDED') {
                    // Get results from dataset
                    const datasetId = runStatus.data.defaultDatasetId;
                    if (!datasetId) {
                        throw new Error('No dataset ID found in completed run');
                    }

                    const resultsResponse = await fetch(`${this.baseUrl}/datasets/${datasetId}/items`, {
                        headers: {
                            'Authorization': `Bearer ${this.apiToken}`,
                            'Accept': 'application/json'
                        }
                    });

                    if (!resultsResponse.ok) {
                        throw new Error(`Failed to get results: ${resultsResponse.statusText}`);
                    }

                    const results = await resultsResponse.json();
                    return Array.isArray(results) ? results : [];
                }

                if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
                    throw new Error(`Run ${status}: ${runStatus.data.statusMessage || 'Unknown error'}`);
                }

                // Wait 5 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                if (error.message.includes('Run FAILED') || error.message.includes('Run ABORTED')) {
                    throw error;
                }
                
                console.warn(`⚠️ Error checking run status: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        throw new Error(`Run timeout after ${maxWait / 1000} seconds`);
    }

    /**
     * Get status for monitoring
     */
    getStatus() {
        return {
            initialized: this.initialized,
            hasApiToken: !!this.apiToken,
            planInfo: this.planInfo
        };
    }
}

module.exports = ServerApifyClient;