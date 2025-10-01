/**
 * GYMNASTIKA Server-Side Pipeline Orchestrator 
 * Manages parsing pipeline with database persistence for "fire-and-forget" execution
 */

const ServerOpenAIClient = require('./server-openai-client');
const ServerApifyClient = require('./server-apify-client');
const ParsingTasksService = require('./parsing-tasks-service');

class ServerPipelineOrchestrator {
    constructor() {
        this.openaiClient = new ServerOpenAIClient();
        this.apifyClient = new ServerApifyClient();
        this.tasksService = new ParsingTasksService();
        
        this.isRunning = false;
        this.currentTaskId = null;
        
        // Initialize clients
        this.initializeClients();
        
        console.log('🏗️ Server Pipeline Orchestrator created with database persistence');
    }

    /**
     * Initialize OpenAI and Apify clients
     */
    async initializeClients() {
        try {
            const openaiSuccess = this.openaiClient.initialize();
            const apifySuccess = await this.apifyClient.initialize();
            
            if (!openaiSuccess) {
                console.error('❌ Failed to initialize OpenAI client');
            }
            
            if (!apifySuccess) {
                console.error('❌ Failed to initialize Apify client');
            }
            
            console.log('✅ Pipeline clients initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing pipeline clients:', error);
        }
    }

    /**
     * Execute the complete parsing pipeline with database persistence
     * @param {string} taskId - Database task ID for progress tracking
     * @returns {Promise<Object>} Pipeline results
     */
    async executeSearch(taskId) {
        if (this.isRunning) {
            throw new Error('Pipeline is already running');
        }

        try {
            this.isRunning = true;
            this.currentTaskId = taskId;
            
            // Get task data from database
            const task = await this.tasksService.getTask(taskId);
            if (!task) {
                throw new Error(`Task ${taskId} not found`);
            }

            console.log(`📊 Starting pipeline for task: ${task.task_name} (type: ${task.task_type})`);

            // Mark task as running
            await this.tasksService.markAsRunning(taskId);

            const { task_name: taskName, search_query: searchQuery, website_url: websiteUrl, task_type: taskType } = task;

            // Route to appropriate parsing method based on task type
            if (taskType === 'url-parsing') {
                console.log('🌐 Executing URL parsing workflow...');
                return await this.executeUrlParsingWorkflow(taskId, taskName, websiteUrl);
            }

            // Default: AI Search workflow
            await this.updateProgress(taskId, 'initializing', 0, 7, 'Запуск парсинга...');
            const resultCount = 10; // TESTING: Reduced from 50 to 10 for faster testing
            
            console.log('📊 Pipeline parameters:', {
                taskName,
                searchQuery: searchQuery || '(empty)',
                websiteUrl,
                resultCount
            });
            
            // Validate that clients are ready
            this.validateClients();
            
            // Stage 1: Generate search queries and region metadata
            await this.updateProgress(taskId, 'query-generation', 1, 7, 'Генерация поисковых запросов ИИ...');
            const queryData = await this.generateSearchQueries(searchQuery);
            
            // Save OpenAI data to database
            const queries = Array.isArray(queryData) ? 
                queryData.flatMap(obj => obj.queries) : 
                queryData.queries;
            await this.tasksService.saveOpenAIData(taskId, null, queries);
            
            // Stage 2: Execute parallel Apify searches
            await this.updateProgress(taskId, 'apify-search', 2, 7, 'Поиск в Google Maps через Apify...');
            const searchResults = await this.executeApifySearches(queryData, resultCount);
            
            // Stage 3: Aggregate and deduplicate results
            await this.updateProgress(taskId, 'aggregation', 3, 7, 'Обработка и дедупликация результатов...');
            const aggregatedResults = await this.aggregateResults(searchResults);
            console.log(`🔗 ПЕРЕХОД: Сырых результатов ${searchResults.length} → Уникальных ${aggregatedResults.length}`);
            
            // Stage 4: Web scraping for detailed organization information
            await this.updateProgress(taskId, 'web-scraping', 4, 7, `Скрапинг ${aggregatedResults.length} веб-сайтов...`);
            const detailedResults = await this.scrapeOrganizationDetails(aggregatedResults);
            console.log(`🔗 ПЕРЕХОД: Уникальных результатов ${aggregatedResults.length} → Скрапленных ${detailedResults.length}`);
            
            // Stage 5: Filter results with email
            await this.updateProgress(taskId, 'filtering', 5, 7, `Фильтрация ${detailedResults.length} результатов по email...`);
            const resultsWithContact = this.filterResultsWithEmail(detailedResults);
            console.log(`🔗 ПЕРЕХОД: Скрапленных результатов ${detailedResults.length} → С Email ${resultsWithContact.length}`);
            
            // Stage 6: Filter by relevance
            await this.updateProgress(taskId, 'relevance', 6, 7, `Сортировка ${resultsWithContact.length} результатов по релевантности...`);
            const relevantResults = this.filterByRelevance(resultsWithContact, searchQuery, resultCount);
            console.log(`🔗 ПЕРЕХОД: С Контактами ${resultsWithContact.length} → Релевантных ${relevantResults.length}`);
            
            // Stage 7: Save final results
            await this.updateProgress(taskId, 'saving', 7, 7, `Сохранение ${relevantResults.length} результатов в базу данных...`);
            
            // Format final results
            const queryInfo = Array.isArray(queryData) ? 
                {
                    queries: queryData.flatMap(obj => obj.queries),
                    languages: [...new Set(queryData.map(obj => obj.language))],
                    regions: [...new Set(queryData.map(obj => obj.region))]
                } : 
                {
                    queries: queryData.queries,
                    languages: [queryData.language],
                    regions: [queryData.region]
                };
            
            const finalResults = {
                success: true,
                taskName,
                originalQuery: searchQuery,
                websiteUrl,
                generatedQueries: queryInfo.queries,
                languages: queryInfo.languages,
                regions: queryInfo.regions,
                totalFound: aggregatedResults.length,
                scrapedCount: detailedResults.length,
                finalCount: relevantResults.length,
                results: relevantResults,
                validationSummary: `Найдено ${relevantResults.length} релевантных организаций с контактными данными (из ${detailedResults.length} проанализированных)`,
                timestamp: new Date().toISOString()
            };

            // Mark task as completed
            await this.tasksService.markAsCompleted(taskId, finalResults);
            
            console.log(`✅ Pipeline completed for task ${taskId}: ${relevantResults.length} results`);
            return finalResults;

        } catch (error) {
            console.error(`Pipeline error for task ${taskId}:`, error);
            
            // Mark task as failed
            if (taskId) {
                await this.tasksService.markAsFailed(taskId, error.message);
            }
            
            throw error;
        } finally {
            this.isRunning = false;
            this.currentTaskId = null;
        }
    }

    /**
     * Update task progress in database
     */
    async updateProgress(taskId, stage, current, total, message) {
        try {
            await this.tasksService.updateProgress(taskId, stage, current, total, message);
            console.log(`📊 Progress ${current}/${total}: ${message}`);
        } catch (error) {
            console.error(`Failed to update progress for task ${taskId}:`, error);
        }
    }

    /**
     * Generate search queries using OpenAI assistant
     */
    async generateSearchQueries(originalQuery) {
        try {
            const response = await this.openaiClient.generateSearchQueries(originalQuery);

            // Flatten and deduplicate all queries from OpenAI response
            const allQueries = [];
            const querySet = new Set();

            // Handle new multi-language format (array of query objects)
            if (Array.isArray(response) && response.length > 0 && response[0].queries) {
                console.log(`🌍 Multi-language format: ${response.length} query objects from OpenAI`);

                response.forEach(obj => {
                    if (obj.queries && Array.isArray(obj.queries)) {
                        obj.queries.forEach(q => {
                            // Deduplicate: only add if not already in set
                            if (!querySet.has(q)) {
                                querySet.add(q);
                                allQueries.push({
                                    query: q,
                                    language: obj.language || 'en',
                                    region: obj.region || 'US'
                                });
                            } else {
                                console.log(`⚠️ Skipping duplicate query: "${q}"`);
                            }
                        });
                    }
                });

                // Limit to maximum 3 unique queries
                const limitedQueries = allQueries.slice(0, 3);
                console.log(`✅ Deduplicated and limited to ${limitedQueries.length} unique queries (from ${response.reduce((sum, obj) => sum + (obj.queries?.length || 0), 0)} total)`);

                // Return in expected format (1 query per object)
                return limitedQueries.map(q => ({
                    queries: [q.query],
                    language: q.language,
                    region: q.region
                }));
            }

            // Handle legacy single object format
            if (!response.queries || !Array.isArray(response.queries)) {
                throw new Error('Invalid query generation response');
            }

            console.log(`🎯 Legacy format: ${response.queries.length} queries`);

            // Deduplicate and limit legacy format too
            const uniqueQueries = [...new Set(response.queries)].slice(0, 3);

            return [{
                queries: uniqueQueries,
                language: response.language || 'en',
                region: response.region || 'US'
            }];
        } catch (error) {
            console.error('Query generation failed:', error);
            // Fallback: use original query
            return [{
                queries: [originalQuery],
                language: 'en',
                region: 'US'
            }];
        }
    }



    /**
     * Calculate search buffer based on requested count
     */
    calculateSearchBuffer(requestedCount) {
        const fixedBuffer = 30; // TESTING: Reduced from 500 to 30 (30/3=10 per query)
        console.log(`📊 Fixed buffer strategy: ${fixedBuffer} results per query (requested: ${requestedCount})`);
        return fixedBuffer;
    }

    /**
     * Execute parallel searches using Apify
     */
    async executeApifySearches(queryDataArray, resultCount) {
        const queryObjects = Array.isArray(queryDataArray) ? queryDataArray : [queryDataArray];
        
        const totalBuffer = this.calculateSearchBuffer(resultCount);
        const totalQueries = queryObjects.reduce((sum, obj) => sum + obj.queries.length, 0);
        const resultsPerQuery = Math.max(Math.ceil(totalBuffer / totalQueries), resultCount);
        
        console.log(`🎯 Search strategy: requested ${resultCount}, total buffer ${totalBuffer}, divided by ${totalQueries} queries = ${resultsPerQuery} per query`);
        
        try {
            // ALWAYS PARALLEL EXECUTION - FREE plan logic removed
            console.log(`🚀 Execution strategy: PARALLEL (PAID plan only mode)`);
            return await this.executeParallelSearches(queryObjects, resultsPerQuery);

        } catch (error) {
            console.error('Apify search failed:', error);
            throw error;
        }
    }

    /**
     * Execute searches in parallel for paid plans
     */
    async executeParallelSearches(queryObjects, resultsPerQuery) {
        console.log(`⚡ Starting PARALLEL execution of ${queryObjects.length} language groups`);
        
        const languagePromises = queryObjects.map(async (queryObj, groupIndex) => {
            const { queries, language, region } = queryObj;
            const groupResults = [];
            
            console.log(`🌍 [${language.toUpperCase()}] Starting ${queries.length} queries for language group ${groupIndex + 1}`);
            
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                
                try {
                    console.log(`🔍 [${language.toUpperCase()}] Query ${i + 1}/${queries.length}: "${query}"`);
                    
                    const searchPromise = this.apifyClient.searchGoogleMaps({
                        searchTerms: query,
                        maxItems: resultsPerQuery,
                        language: language,
                        countryCode: region
                    });
                    
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Query timeout after 10 minutes`)), 10 * 60 * 1000);
                    });
                    
                    const searchResult = await Promise.race([searchPromise, timeoutPromise]);
                    
                    console.log(`✅ [${language.toUpperCase()}] Query "${query}" returned ${searchResult?.length || 0} results`);
                    
                    if (searchResult && searchResult.length > 0) {
                        groupResults.push(...searchResult);
                    }
                    
                    if (i < queries.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (queryError) {
                    console.error(`❌ [${language.toUpperCase()}] Query "${query}" failed:`, queryError.message);
                    continue;
                }
            }
            
            console.log(`🏁 [${language.toUpperCase()}] Language group completed: ${groupResults.length} results`);
            return groupResults;
        });
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Language groups processing timeout after 15 minutes')), 15 * 60 * 1000);
        });
        
        console.log(`⏳ Waiting for ${queryObjects.length} language groups to complete (max 15min)...`);
        
        let allGroupResults;
        try {
            const groupPromise = Promise.allSettled(languagePromises);
            const raceResult = await Promise.race([groupPromise, timeoutPromise]);
            allGroupResults = raceResult;
        } catch (timeoutError) {
            console.warn('⚠️ Language groups processing timed out, using partial results');
            const partialResults = await Promise.allSettled(languagePromises);
            allGroupResults = partialResults;
        }
        
        const successfulResults = [];
        let failedCount = 0;
        
        allGroupResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                successfulResults.push(...result.value);
                const language = queryObjects[index]?.language || `group-${index}`;
                console.log(`✅ [${language.toUpperCase()}] Successfully processed: ${result.value.length} results`);
            } else {
                failedCount++;
                const language = queryObjects[index]?.language || `group-${index}`;
                console.error(`❌ [${language.toUpperCase()}] Failed:`, result.reason?.message || 'Unknown error');
            }
        });
        
        console.log(`🎉 PARALLEL execution complete: ${successfulResults.length} total results from ${queryObjects.length} language groups`);
        
        if (failedCount > 0) {
            console.warn(`⚠️ ${failedCount} language groups failed but continuing with ${successfulResults.length} results`);
        }
        
        return successfulResults;
    }

    /**
     * Execute searches sequentially for free plans
     */
    async executeSequentialSearches(queryObjects, resultsPerQuery) {
        console.log(`🐌 Starting SEQUENTIAL execution of ${queryObjects.length} language groups`);
        
        const results = [];
        let totalQueries = 0;
        
        queryObjects.forEach(obj => totalQueries += obj.queries.length);
        
        let currentQueryIndex = 0;
        
        for (const queryObj of queryObjects) {
            const { queries, language, region } = queryObj;
            
            console.log(`🗣️ Processing ${queries.length} queries in language: ${language}, region: ${region}`);
            
            for (const query of queries) {
                currentQueryIndex++;
                
                try {
                    console.log(`🔍 Executing query ${currentQueryIndex}/${totalQueries}: "${query}" (${language}/${region})`);
                    
                    const searchResult = await this.apifyClient.searchGoogleMaps({
                        searchTerms: query,
                        maxItems: resultsPerQuery,
                        language: language,
                        countryCode: region
                    });
                    
                    console.log(`✅ Query "${query}" returned ${searchResult?.length || 0} results`);
                    
                    if (searchResult && searchResult.length > 0) {
                        results.push(...searchResult);
                    }
                    
                    if (currentQueryIndex < totalQueries) {
                        console.log('⏳ Waiting 2 seconds before next query...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                } catch (queryError) {
                    console.error(`❌ Query "${query}" failed:`, queryError.message);
                    continue;
                }
            }
        }
        
        console.log(`📊 SEQUENTIAL execution complete: ${results.length} results from ${totalQueries} queries`);
        
        
        return results;
    }

    /**
     * Aggregate and deduplicate results
     */
    async aggregateResults(searchResults) {
        console.log('='.repeat(80));
        console.log('📊 ЭТАП АГРЕГАЦИИ И ДЕДУПЛИКАЦИИ РЕЗУЛЬТАТОВ');
        console.log('='.repeat(80));
        console.log(`📥 Входные параметры:`);
        console.log(`  - Всего сырых результатов: ${searchResults.length}`);
        
        const seen = new Set();
        const uniqueResults = [];
        let duplicatesCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < searchResults.length; i++) {
            const result = searchResults[i];
            
            if (!result || !result.website) {
                console.log(`  ❌ Пропускаем (нет website): ${result?.title || result?.name || 'Unknown'}`);
                skippedCount++;
                continue;
            }
            
            const key = result.website.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                const cleanResult = {
                    name: result.title || result.name,
                    website: result.website,
                    address: result.address,
                    description: result.description || null,
                    rating: result.rating,
                    reviews: result.reviewsCount,
                    phone: result.phone,
                    category: result.category
                };
                uniqueResults.push(cleanResult);
            } else {
                duplicatesCount++;
            }
        }
        
        console.log(`📊 ИТОГИ АГРЕГАЦИИ:`);
        console.log(`  - Исходных результатов: ${searchResults.length}`);
        console.log(`  - Пропущено (нет website): ${skippedCount}`);
        console.log(`  - Удалено дублей: ${duplicatesCount}`);
        console.log(`  - Уникальных результатов: ${uniqueResults.length}`);
        console.log('='.repeat(80));
        
        return uniqueResults;
    }

    /**
     * Scrape detailed organization information
     */
    async scrapeOrganizationDetails(validatedResults) {
        try {
            console.log(`🌐 Starting organization details scraping for ${validatedResults.length} results...`);
            
            if (!validatedResults || validatedResults.length === 0) {
                console.warn('⚠️ No validated results to scrape');
                return [];
            }
            
            const urls = validatedResults
                .map(result => result.website || result.url || result.link || null)
                .filter(url => url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')));
                
            if (urls.length === 0) {
                console.warn('⚠️ No valid URLs found in validated results');
                return validatedResults.map(result => ({
                    ...result,
                    organizationName: result.name || 'Неизвестная организация',
                    email: null,
                    description: 'Данные недоступны - нет корректных ссылок',
                    country: 'Не определено',
                    scrapedAt: new Date().toISOString()
                }));
            }
            
            console.log(`🔍 Found ${urls.length} valid URLs for scraping`);
            
            let scrapedData = [];
            
            try {
                scrapedData = await this.apifyClient.scrapeWebsiteDetails(urls);
                
                console.log(`✅ Web scraping завершен: ${scrapedData.length} результатов`);
                console.log(`  - С email: ${scrapedData.filter(r => r.email).length}`);
                console.log(`  - Без email: ${scrapedData.filter(r => !r.email).length}`);
                
            } catch (scrapingError) {
                console.error(`❌ Ошибка web scraping:`, scrapingError.message);
                
                scrapedData = urls.map(url => ({
                    url,
                    organizationName: 'Не удалось извлечь',
                    email: null,
                    description: `Ошибка скрапинга: ${scrapingError.message}`,
                    country: 'Не определено',
                    scrapingError: scrapingError.message,
                    scrapedAt: new Date().toISOString()
                }));
            }
            
            const mergedResults = this.mergeGoogleMapsWithWebData(validatedResults, scrapedData);
            
            console.log(`🎯 Final merge completed: ${mergedResults.length} enhanced results`);
            
            return mergedResults;
            
        } catch (error) {
            console.error('❌ Organization details scraping failed:', error);
            
            return validatedResults.map(result => ({
                ...result,
                organizationName: result.name || 'Неизвестная организация',
                email: null,
                description: `Ошибка скрапинга: ${error.message}`,
                country: 'Не определено',
                scrapingError: error.message,
                scrapedAt: new Date().toISOString()
            }));
        }
    }

    /**
     * Merge Google Maps data with scraped website details
     */
    mergeGoogleMapsWithWebData(googleMapsResults, scrapedData) {
        console.log(`🔀 Merging ${googleMapsResults.length} Google Maps results with ${scrapedData.length} scraped results`);
        
        return googleMapsResults.map(gmResult => {
            const gmUrl = gmResult.website || gmResult.url || gmResult.link;
            const matchingScrapedData = scrapedData.find(scraped => {
                const scrapedUrl = scraped.url || scraped.website;
                return scrapedUrl === gmUrl;
            });
            
            if (matchingScrapedData) {
                return {
                    // Google Maps base data
                    name: gmResult.name || 'Неизвестная организация',
                    address: gmResult.address,
                    phone: gmResult.phone,
                    rating: gmResult.rating,
                    reviewsCount: gmResult.reviewsCount,
                    categories: gmResult.categories,
                    coordinates: gmResult.coordinates,
                    openingHours: gmResult.openingHours,
                    googleMapsUrl: gmResult.googleMapsUrl,
                    imageUrl: gmResult.imageUrl,
                    
                    // Enhanced data from web scraping
                    // PRIORITY: Google Maps name > Web scraper title > fallback
                    organizationName: gmResult.name || matchingScrapedData.title || matchingScrapedData.organizationName || 'Неизвестная организация',
                    email: matchingScrapedData.email,
                    description: matchingScrapedData.description || 'Описание недоступно',
                    website: matchingScrapedData.website || matchingScrapedData.url || gmUrl,
                    country: matchingScrapedData.country || 'Не определено',
                    allEmails: matchingScrapedData.allEmails || [],
                    
                    // Metadata
                    hasContactInfo: matchingScrapedData.hasContactInfo || false,
                    scrapedAt: matchingScrapedData.scrapedAt,
                    dataSource: 'google_maps_with_web_scraping',
                    scrapingError: matchingScrapedData.scrapingError || null
                };
            } else {
                return {
                    // Google Maps base data
                    name: gmResult.name || 'Неизвестная организация', 
                    address: gmResult.address,
                    phone: gmResult.phone,
                    rating: gmResult.rating,
                    reviewsCount: gmResult.reviewsCount,
                    categories: gmResult.categories,
                    coordinates: gmResult.coordinates,
                    openingHours: gmResult.openingHours,
                    googleMapsUrl: gmResult.googleMapsUrl,
                    imageUrl: gmResult.imageUrl,
                    
                    // Placeholder scraped data
                    organizationName: gmResult.name || 'Неизвестная организация',
                    email: null,
                    description: 'Веб-сайт недоступен для скрапинга',
                    website: gmUrl || null,
                    country: 'Не определено',
                    allEmails: [],
                    
                    // Metadata
                    hasContactInfo: false,
                    scrapedAt: new Date().toISOString(),
                    dataSource: 'google_maps_only',
                    scrapingError: 'URL не найден или недоступен'
                };
            }
        });
    }

    /**
     * Filter results to include only those with email
     */
    filterResultsWithEmail(results) {
        console.log('='.repeat(80));
        console.log('📧 ЭТАП ФИЛЬТРАЦИИ ПО EMAIL');
        console.log('='.repeat(80));

        if (!Array.isArray(results) || results.length === 0) {
            console.warn('⚠️ No results to filter for email');
            return [];
        }

        console.log(`📥 Входные параметры:`);
        console.log(`  - Всего результатов для фильтрации: ${results.length}`);

        let withEmail = 0;
        let withoutEmail = 0;

        const resultsWithEmail = results.filter((result, index) => {
            const hasEmail = result.email ||
                            (result.allEmails && result.allEmails.length > 0) ||
                            (result.description && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(result.description));

            if (hasEmail) {
                withEmail++;
            } else {
                withoutEmail++;
            }

            return hasEmail;
        });
        
        console.log(`\n📊 ИТОГИ ФИЛЬТРАЦИИ ПО EMAIL:`);
        console.log(`  - Исходных результатов: ${results.length}`);
        console.log(`  - С email: ${withEmail}`);
        console.log(`  - Без email: ${withoutEmail}`);
        console.log(`  - Успешность фильтрации: ${Math.round((withEmail)/results.length*100)}%`);
        console.log(`  - ФИНАЛЬНОЕ КОЛИЧЕСТВО: ${resultsWithEmail.length}`);
        console.log('='.repeat(80));

        return resultsWithEmail;
    }

    /**
     * Filter and sort results by relevance to original query
     */
    filterByRelevance(results, originalQuery, requestedCount = null) {
        console.log('='.repeat(80));
        console.log('🎯 ЭТАП ФИЛЬТРАЦИИ ПО РЕЛЕВАНТНОСТИ');
        console.log('='.repeat(80));
        console.log(`📥 Входные параметры:`);
        console.log(`  - Всего результатов: ${results.length}`);
        console.log(`  - Исходный запрос: "${originalQuery}"`);
        console.log(`  - Запрошено результатов: ${requestedCount || 'все'}`);
        
        if (!Array.isArray(results) || results.length === 0) {
            console.warn('⚠️ No results to filter by relevance');
            return [];
        }
        
        const keywords = originalQuery.toLowerCase()
            .split(/[,\s]+/)
            .filter(word => word.length > 2)
            .map(word => word.trim());
        
        console.log(`🔍 Извлеченные ключевые слова:`, keywords);
        
        const scoredResults = results.map((result, index) => {
            let score = 0;
            
            const searchableText = [
                result.name || result.organizationName || '',
                result.description || '',
                result.address || '',
                result.category || ''
            ].join(' ').toLowerCase();
            
            keywords.forEach(keyword => {
                if (searchableText.includes(keyword)) {
                    score += 10;
                }
            });
            
            if (result.email) score += 20;
            if (result.phone) score += 5;
            if (result.rating && parseFloat(result.rating) > 4) score += 5;
            if (result.reviewsCount && parseInt(result.reviewsCount) > 10) score += 3;
            if (result.description && result.description.length > 50) score += 2;
            
            return { ...result, relevanceScore: score };
        });
        
        scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        console.log(`📊 РЕЗУЛЬТАТЫ СКОРИНГА:`);
        console.log(`  - Средний скор: ${Math.round(scoredResults.reduce((sum, r) => sum + r.relevanceScore, 0) / scoredResults.length)}`);
        console.log(`  - Максимальный скор: ${Math.max(...scoredResults.map(r => r.relevanceScore))}`);
        console.log(`  - Минимальный скор: ${Math.min(...scoredResults.map(r => r.relevanceScore))}`);
        
        const finalResults = requestedCount ? 
            scoredResults.slice(0, requestedCount) : 
            scoredResults;
            
        console.log(`✅ Отфильтровано по релевантности: ${finalResults.length} результатов`);
        console.log('='.repeat(80));
        
        return finalResults;
    }

    /**
     * Validate that all required clients are ready
     */
    validateClients() {
        console.log('🔍 Validating pipeline clients...');
        
        if (!this.openaiClient || !this.openaiClient.isInitialized()) {
            throw new Error('OpenAI client not initialized. Please check API key and assistant ID.');
        }
        
        if (!this.apifyClient || !this.apifyClient.isInitialized()) {
            throw new Error('Apify client not initialized. Please check API token.');
        }
        
        console.log('✅ All pipeline clients validated successfully');
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentTaskId: this.currentTaskId,
            clientsReady: {
                openai: this.openaiClient ? this.openaiClient.isInitialized() : false,
                apify: this.apifyClient ? this.apifyClient.isInitialized() : false
            }
        };
    }

    /**
     * Execute URL parsing workflow (server-side)
     */
    async executeUrlParsingWorkflow(taskId, taskName, websiteUrl) {
        try {
            // Stage 1: Initializing
            await this.updateProgress(taskId, 'initializing', 0, 3, 'Инициализация парсинга URL...');

            if (!websiteUrl) {
                throw new Error('Website URL is required for URL parsing');
            }

            // Validate URL
            try {
                new URL(websiteUrl);
            } catch (error) {
                throw new Error('Invalid URL format');
            }

            console.log(`🌐 Starting URL parsing for: ${websiteUrl}`);

            // Stage 2: Web scraping
            await this.updateProgress(taskId, 'web-scraping', 1, 3, `Извлечение данных с сайта: ${websiteUrl}`);

            // Execute web scraping directly (pass simple object with URL)
            const scrapingResults = await this.scrapeOrganizationDetails([{
                url: websiteUrl,
                website: websiteUrl  // scrapeOrganizationDetails expects 'website' field
            }]);

            console.log(`🌐 Web scraping completed: ${scrapingResults.length} results`);

            // Stage 3: Complete
            await this.updateProgress(taskId, 'complete', 3, 3, '✅ Парсинг URL завершен успешно!');

            // Format results
            const formattedResults = scrapingResults.map(result => ({
                title: result.title || taskName,
                url: result.url || websiteUrl,
                email: result.email || null,
                phone: result.phone || null,
                address: result.location?.address || websiteUrl,
                extractedData: result.extractedData || {},
                source: 'url-parsing'
            }));

            // Mark task as completed
            await this.tasksService.markAsCompleted(taskId, formattedResults);

            return {
                success: true,
                results: formattedResults,
                metadata: {
                    websiteUrl,
                    taskName,
                    extractedCount: formattedResults.length
                }
            };

        } catch (error) {
            console.error('❌ URL parsing workflow error:', error);
            await this.updateProgress(taskId, 'error', 0, 3, `Ошибка: ${error.message}`);
            await this.tasksService.markAsFailed(taskId, error.message);
            throw error;
        }
    }

    /**
     * Cancel running task
     */
    async cancel(taskId) {
        if (this.currentTaskId === taskId && this.isRunning) {
            this.isRunning = false;
            await this.tasksService.cancelTask(taskId);
            console.log(`📋 Task ${taskId} cancelled`);
        }
    }
}

module.exports = ServerPipelineOrchestrator;