/**
 * Pipeline Orchestrator for GYMNASTIKA Platform
 * Manages the unified parsing pipeline with AI and Apify integration
 */

class PipelineOrchestrator {
    constructor() {
        // Use existing global instances instead of creating new ones
        this.openaiClient = window.openaiClient;
        this.apifyClient = window.apifyClient;
        
        if (!this.openaiClient) {
            console.warn('⚠️ OpenAI client not found on window object');
            this.openaiClient = new OpenAIClient();
        }
        
        if (!this.apifyClient) {
            console.warn('⚠️ Apify client not found on window object');
            if (window.ApifyClient) {
                this.apifyClient = new window.ApifyClient();
            } else {
                throw new Error('ApifyClient class not available. Please ensure lib/apify-client.js is loaded.');
            }
        }
        
        this.isRunning = false;
        this.currentProgress = {
            stage: '',
            current: 0,
            total: 0,
            message: ''
        };
        
        // Progress callbacks
        this.onProgressUpdate = null;
        this.onStageComplete = null;
        this.onError = null;
        
        console.log('🏗️ Pipeline Orchestrator created with clients:', {
            openaiClient: !!this.openaiClient,
            apifyClient: !!this.apifyClient
        });
    }

    /**
     * Execute the complete parsing pipeline
     * @param {Object} params - Pipeline parameters
     * @param {string} params.taskName - Name of the parsing task
     * @param {string} params.searchQuery - Original search query
     * @param {number} params.resultCount - Number of results to return
     * @returns {Promise<Object>} Pipeline results
     */
    async executeSearch(params) {
        if (this.isRunning) {
            throw new Error('Pipeline is already running');
        }

        try {
            this.isRunning = true;
            this.updateProgress('initializing', 0, 6, 'Запуск парсинга...');

            const { taskName, searchQuery, resultCount } = params;
            
            console.log('📊 Pipeline parameters:', {
                taskName,
                searchQuery: searchQuery || '(empty)',
                resultCount,
                hasSearchQuery: !!searchQuery
            });
            
            // Validate that clients are ready
            this.validateClients();
            
            // Stage 1: Generate search queries and region metadata
            this.updateProgress('query-generation', 1, 6, 'Генерация поисковых запросов ИИ...');
            const queryData = await this.generateSearchQueries(searchQuery);
            
            // Stage 2: Execute parallel Apify searches
            this.updateProgress('apify-search', 2, 6, 'Поиск в Google Maps через Apify...');
            const searchResults = await this.executeApifySearches(queryData, resultCount);
            
            // Stage 3: Aggregate and deduplicate results
            this.updateProgress('aggregation', 3, 6, 'Обработка и дедупликация результатов...');
            const aggregatedResults = await this.aggregateResults(searchResults);
            console.log(`🔗 ПЕРЕХОД: Сырых результатов ${searchResults.length} → Уникальных ${aggregatedResults.length}`);
            
            // Stage 4: Web scraping for detailed organization information (MOVED BEFORE validation)
            this.updateProgress('web-scraping', 4, 6, `Скрапинг ${aggregatedResults.length} веб-сайтов...`);
            const detailedResults = await this.scrapeOrganizationDetails(aggregatedResults);
            console.log(`🔗 ПЕРЕХОД: Уникальных результатов ${aggregatedResults.length} → Скрапленных ${detailedResults.length}`);
            
            // Stage 5: Filter results with contact info (email OR phone, NO AI validation)
            this.updateProgress('filtering', 5, 7, `Фильтрация ${detailedResults.length} результатов по контактам (email/телефон)...`);
            const resultsWithContact = this.filterResultsWithEmail(detailedResults);
            console.log(`🔗 ПЕРЕХОД: Скрапленных результатов ${detailedResults.length} → С Контактами ${resultsWithContact.length}`);
            
            // Stage 6: ✅ НОВЫЙ ЭТАП - Фильтрация по релевантности
            this.updateProgress('relevance', 6, 7, `Сортировка ${resultsWithContact.length} результатов по релевантности...`);
            const relevantResults = this.filterByRelevance(resultsWithContact, searchQuery, resultCount);
            console.log(`🔗 ПЕРЕХОД: С Контактами ${resultsWithContact.length} → Релевантных ${relevantResults.length}`);
            
            // Stage 7: Finalize and format
            this.updateProgress('complete', 7, 7, `Завершено! Найдено ${relevantResults.length} релевантных организаций`);
            // Format query info for display
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
                generatedQueries: queryInfo.queries,
                languages: queryInfo.languages,
                regions: queryInfo.regions,
                totalFound: aggregatedResults.length,
                validatedCount: relevantResults.length, // ✅ Обновлено: используем relevantResults после фильтрации по релевантности
                scrapedCount: detailedResults.length,
                finalCount: relevantResults.length, // ✅ Финальное количество после всех фильтров
                results: relevantResults, // ✅ Результаты после фильтрации по email и релевантности
                validationSummary: `Найдено ${relevantResults.length} релевантных организаций с контактными данными (из ${detailedResults.length} проанализированных)`, // ✅ Обновленное описание
                timestamp: new Date().toISOString()
            };

            // Save to local history
            this.saveToHistory(finalResults);
            
            // 💾 Save to Supabase database
            try {
                // 🔍 ENHANCED DEBUG: Check database client state
                console.log('🔍 DEBUG: Database client state check:', {
                    'window.gymnastikaDB exists': !!window.gymnastikaDB,
                    'window.gymnastikaDB.isInitialized': window.gymnastikaDB?.isInitialized,
                    'window.gymnastikaDB.isReady()': window.gymnastikaDB?.isReady ? window.gymnastikaDB.isReady() : 'method not available',
                    'window.gymnastikaDB.getStatus()': window.gymnastikaDB?.getStatus ? window.gymnastikaDB.getStatus() : 'method not available',
                    'window.SupabaseClient exists': !!window.SupabaseClient,
                    'window.SupabaseClient === window.gymnastikaDB': window.SupabaseClient === window.gymnastikaDB
                });
                
                // 🔧 ENHANCED FIX: Try to initialize database if not already initialized
                if (window.gymnastikaDB && !window.gymnastikaDB.isInitialized) {
                    console.log('🔄 Database client exists but not initialized, attempting initialization...');
                    try {
                        await window.gymnastikaDB.initialize();
                        console.log('✅ Database client initialized successfully');
                    } catch (initError) {
                        console.error('❌ Failed to initialize database client:', initError);
                    }
                }
                
                if (window.gymnastikaDB && window.gymnastikaDB.isInitialized) {
                    console.log('💾 Saving parsing results to Supabase database...');
                    
                    const taskData = {
                        taskName,
                        searchQuery
                    };
                    
                    console.log('💾 Saving to database with taskData:', {
                        taskName: taskData.taskName,
                        searchQuery: taskData.searchQuery || '(empty)',
                        resultsCount: relevantResults.length
                    });
                    
                    const saveResult = await window.gymnastikaDB.saveParsingResults(taskData, relevantResults);
                    console.log(`✅ Successfully saved ${saveResult.count} results to Supabase database`);
                    
                    // Add database save info to final results
                    finalResults.databaseSave = {
                        success: true,
                        count: saveResult.count,
                        message: saveResult.message,
                        savedAt: new Date().toISOString()
                    };
                } else {
                    console.warn('⚠️ Supabase database not initialized - results saved to local storage only');
                    console.warn('🔍 DEBUG: Database initialization details:', {
                        'gymnastikaDB exists': !!window.gymnastikaDB,
                        'isInitialized value': window.gymnastikaDB?.isInitialized,
                        'isReady value': window.gymnastikaDB?.isReady ? window.gymnastikaDB.isReady() : 'not available'
                    });
                    finalResults.databaseSave = {
                        success: false,
                        message: 'Database not available - saved locally only'
                    };
                }
            } catch (dbError) {
                console.error('❌ Failed to save to Supabase database:', dbError);
                console.error('🔍 DEBUG: Database error details:', {
                    errorMessage: dbError.message,
                    errorStack: dbError.stack,
                    databaseState: window.gymnastikaDB?.getStatus ? window.gymnastikaDB.getStatus() : 'getStatus not available'
                });
                finalResults.databaseSave = {
                    success: false,
                    error: dbError.message,
                    message: 'Database save failed - results saved locally only'
                };
            }
            
            this.onStageComplete?.('complete', finalResults);
            return finalResults;

        } catch (error) {
            console.error('Pipeline error:', error);
            this.onError?.(error);
            
            // Return error result instead of throwing
            return {
                success: false,
                error: error.message,
                taskName: params.taskName || 'Unknown Task',
                originalQuery: params.searchQuery || '',
                results: [],
                validationSummary: `Ошибка парсинга: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Alias method for executeSearch to maintain compatibility with script.js
     * @param {Object} params - Pipeline parameters  
     * @returns {Promise<Object>} Pipeline results
     */
    async executePipeline(params) {
        return await this.executeSearch(params);
    }

    /**
     * Generate search queries using first OpenAI assistant
     */
    async generateSearchQueries(originalQuery) {
        try {
            const response = await this.openaiClient.generateSearchQueries(originalQuery);
            
            // Handle new multi-language format (array of query objects)
            if (Array.isArray(response) && response.length > 0 && response[0].queries) {
                console.log(`🌍 Multi-language format: ${response.length} query objects`);
                return response; // Return array of query objects
            }
            
            // Handle legacy single object format
            if (!response.queries || !Array.isArray(response.queries)) {
                throw new Error('Invalid query generation response');
            }
            
            console.log(`🎯 Legacy format: ${response.queries.length} queries`);
            
            return [{
                queries: response.queries,
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
        // 🎯 TESTING: 30 результатов для быстрого тестирования (30/3=10 per query)
        const fixedBuffer = 30; // TESTING: Reduced from 500 to 30
        
        console.log(`📊 Fixed buffer strategy: ${fixedBuffer} results per query (requested: ${requestedCount})`);
        
        return fixedBuffer;
    }

    /**
     * Execute parallel searches using Apify
     */
    async executeApifySearches(queryDataArray, resultCount) {
        // Handle both new format (array) and legacy format (single object)
        const queryObjects = Array.isArray(queryDataArray) ? queryDataArray : [queryDataArray];
        
        // Calculate total buffer and divide by number of query groups
        const totalBuffer = this.calculateSearchBuffer(resultCount);
        const totalQueries = queryObjects.reduce((sum, obj) => sum + obj.queries.length, 0);
        const resultsPerQuery = Math.max(Math.ceil(totalBuffer / totalQueries), resultCount);
        
        console.log(`🎯 Search strategy: requested ${resultCount}, total buffer ${totalBuffer}, divided by ${totalQueries} queries = ${resultsPerQuery} per query`);
        console.log(`🌍 Query objects: ${queryObjects.length} language groups`);
        
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
        
        // Create promises for all language groups with timeout protection
        const languagePromises = queryObjects.map(async (queryObj, groupIndex) => {
            const { queries, language, region } = queryObj;
            const groupResults = [];
            
            console.log(`🌍 [${language.toUpperCase()}] Starting ${queries.length} queries for language group ${groupIndex + 1}`);
            
            // Execute queries within each language group sequentially to avoid overwhelming single language endpoint
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                
                // REMOVED: updateProgress spam fix - only show at stage level, not per query
                
                try {
                    console.log(`🔍 [${language.toUpperCase()}] Query ${i + 1}/${queries.length}: "${query}"`);
                    
                    // Add timeout wrapper to prevent individual queries from hanging
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
                    
                    // Small delay between queries in same language group
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
        
        // Add timeout wrapper for the entire language group processing
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Language groups processing timeout after 15 minutes')), 15 * 60 * 1000);
        });
        
        // Wait for all language groups to complete or timeout - use allSettled to handle partial failures
        console.log(`⏳ Waiting for ${queryObjects.length} language groups to complete (max 15min)...`);
        
        let allGroupResults;
        try {
            const groupPromise = Promise.allSettled(languagePromises);
            const raceResult = await Promise.race([groupPromise, timeoutPromise]);
            allGroupResults = raceResult;
        } catch (timeoutError) {
            console.warn('⚠️ Language groups processing timed out, using partial results');
            // Get whatever results are available
            const partialResults = await Promise.allSettled(languagePromises);
            allGroupResults = partialResults;
        }
        
        // Process results from Promise.allSettled - extract successful values and log failures
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
        console.log(`📊 Success rate: ${queryObjects.length - failedCount}/${queryObjects.length} language groups succeeded`);
        
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
        
        // Calculate total queries for progress tracking
        queryObjects.forEach(obj => totalQueries += obj.queries.length);
        
        let currentQueryIndex = 0;
        
        for (const queryObj of queryObjects) {
            const { queries, language, region } = queryObj;
            
            console.log(`🗣️ Processing ${queries.length} queries in language: ${language}, region: ${region}`);
            
            for (const query of queries) {
                currentQueryIndex++;
                
                // REMOVED: updateProgress spam fix - only show at stage level, not per query
                
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
                    
                    // Small delay between queries to prevent overload
                    if (currentQueryIndex < totalQueries) {
                        console.log('⏳ Waiting 2 seconds before next query...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                } catch (queryError) {
                    console.error(`❌ Query "${query}" failed:`, queryError.message);
                    
                    // Log the error details for debugging
                    if (queryError.stack) {
                        console.error('Error stack:', queryError.stack);
                    }
                    
                    // Continue with next query instead of failing completely
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
        
        console.log(`🔍 Обработка каждого результата:`);
        
        for (let i = 0; i < searchResults.length; i++) {
            const result = searchResults[i];
            console.log(`Результат ${i + 1}/${searchResults.length}:`, {
                title: result?.title || result?.name || 'Без названия',
                website: result?.website || 'Без сайта',
                address: result?.address || 'Без адреса',
                phone: result?.phone || 'Без телефона'
            });
            
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
                    description: result.description || null, // ✅ Добавлено сохранение описания из Google Maps для лучшей фильтрации
                    rating: result.rating,
                    reviews: result.reviewsCount,
                    phone: result.phone,
                    category: result.category
                };
                uniqueResults.push(cleanResult);
                console.log(`  ✅ Добавлен как уникальный`);
            } else {
                duplicatesCount++;
                console.log(`  🔄 Дублирует: ${key}`);
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
     * Validate results using second OpenAI assistant
     */
    async validateResults(results, originalQuery, resultCount = 10) {
        try {
            console.log('='.repeat(80));
            console.log('🧠 ЭТАП ВАЛИДАЦИИ РЕЗУЛЬТАТОВ');
            console.log('='.repeat(80));
            console.log(`📊 Входные параметры:`);
            console.log(`  - Всего результатов для валидации: ${results.length}`);
            console.log(`  - Исходный запрос: "${originalQuery}"`);
            console.log(`  - Запрашиваемое финальное количество: ${resultCount}`);
            
            if (results.length === 0) {
                console.warn('⚠️ No results to validate');
                return {
                    validResults: [],
                    summary: 'Нет данных для валидации'
                };
            }
            
            // Send more results to AI but ask for specific count
            const validationLimit = Math.min(results.length, Math.max(30, resultCount * 2));
            
            // 🗺️ Создаем мапу для сохранения оригинальных данных
            const originalDataMap = new Map();
            results.forEach(result => {
                if (result.website) {
                    originalDataMap.set(result.website.toLowerCase(), result);
                }
            });
            console.log(`🗺️ Создана мапа оригинальных данных: ${originalDataMap.size} записей`);

            const validationData = {
                originalQuery,
                requestedCount: resultCount, // ✅ Передаем количество для AI
                results: results.slice(0, validationLimit)
            };
            
            console.log(`🎯 Стратегия валидации:`);
            console.log(`  - Имеется результатов: ${results.length}`);
            console.log(`  - Отправляется на валидацию: ${validationData.results.length} (лимит: ${validationLimit})`);
            console.log(`  - Запрашивается финальных: ${resultCount}`);
            
            console.log(`📋 ДЕТАЛИ РЕЗУЛЬТАТОВ ПЕРЕД ВАЛИДАЦИЕЙ (первые 3):`);
            validationData.results.slice(0, 3).forEach((result, index) => {
                console.log(`Результат ${index + 1}:`, {
                    name: result.name || 'Не указано',
                    website: result.website || 'Не указано',
                    address: result.address || 'Не указано',
                    rating: result.rating || 'Не указано',
                    phone: result.phone || 'Не указано'
                });
            });
            
            const validationResult = await this.openaiClient.validateResults(validationData);
            
            console.log(`📤 РЕЗУЛЬТАТ ВАЛИДАЦИИ ОТ ВТОРОГО АССИСТЕНТА:`);
            console.log(`  - Получено валидных результатов: ${validationResult.validResults?.length || 0}`);
            console.log(`  - Резюме валидации: ${validationResult.summary || 'Не указано'}`);
            
            // 🔄 ВСЕГДА восстанавливаем оригинальные данные из мапы (независимо от того, работал ли AI ассистент)
            console.log(`🔄 ВОССТАНОВЛЕНИЕ ОРИГИНАЛЬНЫХ ДАННЫХ:`);
            if (validationResult.validResults && Array.isArray(validationResult.validResults)) {
                const restoredResults = validationResult.validResults.map((result, index) => {
                    const website = result.website;
                    const originalData = originalDataMap.get(website?.toLowerCase());
                    
                    console.log(`  🔍 Обработка результата ${index + 1}: ${website}`);
                    
                    if (originalData) {
                        console.log(`  ✅ Восстановлены данные для: ${originalData.name || website}`);
                        return originalData; // Возвращаем полные оригинальные данные
                    } else {
                        console.log(`  ⚠️ Не найдены данные для: ${website} (оставляем как есть)`);
                        return result; // Если не найдены, оставляем как есть
                    }
                });
                
                validationResult.validResults = restoredResults;
                console.log(`📊 Восстановлено данных: ${restoredResults.length} результатов`);
                
                // 🔍 Детальный лог первых 3 восстановленных результатов
                console.log(`📋 ВОССТАНОВЛЕННЫЕ РЕЗУЛЬТАТЫ (первые 3):`);
                restoredResults.slice(0, 3).forEach((result, index) => {
                    console.log(`Восстановлен ${index + 1}:`, {
                        name: result.name || 'Не указано',
                        website: result.website || 'Не указано',
                        address: result.address || 'Не указано',
                        rating: result.rating || 'Не указано',
                        phone: result.phone || 'Не указано'
                    });
                });
            } else {
                console.log(`⚠️ Нет данных для восстановления`);
            }
            
            // Ensure we don't exceed requested count
            if (validationResult.validResults && validationResult.validResults.length > resultCount) {
                console.log(`✂️ ОБРЕЗКА: ${validationResult.validResults.length} → ${resultCount} результатов`);
                validationResult.validResults = validationResult.validResults.slice(0, resultCount);
            }
            
            console.log(`✅ ФИНАЛ ВАЛИДАЦИИ: ${validationResult.validResults?.length || 0} результатов (запрашивалось: ${resultCount})`);
            console.log('='.repeat(80));
            
            return validationResult;
            
        } catch (error) {
            console.error('❌ Result validation failed:', error);
            // Return unvalidated results with warning
            return {
                validResults: results,
                summary: `Валидация не удалась: ${error.message}`
            };
        }
    }

    // ❌ УДАЛЕН: validateScrapedResults - второй ассистент убран полностью
    // Теперь используется прямая фильтрация по email без AI валидации

    /**
     * Update progress and notify observers
     */
    updateProgress(stage, current, total, message) {
        this.currentProgress = { stage, current, total, message };
        this.onProgressUpdate?.(this.currentProgress);
    }

    /**
     * Save results to local history
     */
    saveToHistory(results) {
        try {
            const history = JSON.parse(localStorage.getItem('parsing-history') || '[]');
            history.unshift(results);
            
            // Keep only last 100 results
            if (history.length > 100) {
                history.splice(100);
            }
            
            localStorage.setItem('parsing-history', JSON.stringify(history));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    /**
     * Get parsing history
     */
    getHistory() {
        try {
            return JSON.parse(localStorage.getItem('parsing-history') || '[]');
        } catch (error) {
            console.error('Failed to load history:', error);
            return [];
        }
    }

    /**
     * Cancel running pipeline
     */
    cancel() {
        this.isRunning = false;
        this.updateProgress('cancelled', 0, 5, 'Парсинг отменен');
    }

    /**
     * Validate that all required clients are ready
     */
    validateClients() {
        console.log('🔍 Validating pipeline clients...');
        
        // Check OpenAI client
        if (!this.openaiClient || !this.openaiClient.isInitialized()) {
            console.error('❌ OpenAI client validation failed');
            console.log('OpenAI client exists:', !!this.openaiClient);
            console.log('OpenAI client status:', this.openaiClient ? this.openaiClient.getStatus() : 'not found');
            throw new Error('OpenAI client not initialized. Please check API key and assistant ID.');
        }
        
        // Check Apify client
        if (!this.apifyClient || !this.apifyClient.isInitialized()) {
            console.error('❌ Apify client validation failed');
            console.log('Apify client exists:', !!this.apifyClient);
            console.log('Apify client status:', this.apifyClient ? this.apifyClient.getStatus() : 'not found');
            throw new Error('Apify client not initialized. Please check API token.');
        }
        
        console.log('✅ All pipeline clients validated successfully');
    }

    /**
     * Scrape detailed organization information from validated URLs
     */
    async scrapeOrganizationDetails(validatedResults) {
        try {
            console.log(`🌐 Starting organization details scraping for ${validatedResults.length} results...`);
            
            if (!validatedResults || validatedResults.length === 0) {
                console.warn('⚠️ No validated results to scrape');
                return [];
            }
            
            // Extract URLs from validated results (handle different data formats)
            const urls = validatedResults
                .map(result => {
                    // Handle different result formats
                    return result.website || result.url || result.link || null;
                })
                .filter(url => url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')));
                
            if (urls.length === 0) {
                console.warn('⚠️ No valid URLs found in validated results');
                // Return original results with placeholder scraping data
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
            
            // 🚀 ПРЯМАЯ ОБРАБОТКА: Передаем все URLs одним запросом (батчинг убран после удаления валидации)
            console.log(`🚀 Запуск прямого web scraping для ${urls.length} URLs...`);
            
            // ✅ ИСПРАВЛЕНИЕ: Объявляем scrapedData ВНЕ блока try/catch
            let scrapedData = [];
            
            try {
                // Perform web scraping for all URLs at once
                scrapedData = await this.apifyClient.scrapeWebsiteDetails(urls);
                
                console.log(`✅ Web scraping завершен: ${scrapedData.length} результатов`);
                console.log(`  - С email: ${scrapedData.filter(r => r.email).length}`);
                console.log(`  - Без email: ${scrapedData.filter(r => !r.email).length}`);
                
            } catch (scrapingError) {
                console.error(`❌ Ошибка web scraping:`, scrapingError.message);
                
                // Создаем fallback данные для всех URL
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
            
            // Merge original Google Maps data with scraped website details
            const mergedResults = this.mergeGoogleMapsWithWebData(validatedResults, scrapedData);
            
            console.log(`🎯 Final merge completed: ${mergedResults.length} enhanced results`);
            
            return mergedResults;
            
        } catch (error) {
            console.error('❌ Organization details scraping failed:', error);
            
            // Return fallback: original results with error indication
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
            // Find matching scraped data by URL
            const gmUrl = gmResult.website || gmResult.url || gmResult.link;
            const matchingScrapedData = scrapedData.find(scraped => {
                const scrapedUrl = scraped.url || scraped.website;
                return scrapedUrl === gmUrl;
            });
            
            if (matchingScrapedData) {
                // Log scraped data for debugging
                console.log(`🔍 Scraped data for ${gmResult.name}:`, {
                    title: matchingScrapedData.title,
                    organizationName: matchingScrapedData.organizationName,
                    email: matchingScrapedData.email,
                    url: matchingScrapedData.url,
                    website: matchingScrapedData.website
                });
                
                // Merge data with preference for scraped details
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
                    organizationName: matchingScrapedData.title || matchingScrapedData.organizationName || gmResult.name || 'Неизвестная организация',
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
                // No matching scraped data - return Google Maps data with placeholders
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
     * Filter results to include those with contact info (email OR phone)
     */
    filterResultsWithEmail(results) {
        console.log('='.repeat(80));
        console.log('📧📞 ЭТАП ФИЛЬТРАЦИИ ПО КОНТАКТНЫМ ДАННЫМ (EMAIL + ТЕЛЕФОН)');
        console.log('='.repeat(80));
        
        if (!Array.isArray(results) || results.length === 0) {
            console.warn('⚠️ No results to filter for contact info');
            return [];
        }
        
        console.log(`📥 Входные параметры:`);
        console.log(`  - Всего результатов для фильтрации: ${results.length}`);
        
        let withEmail = 0;
        let withPhoneOnly = 0;
        let withBoth = 0;
        let withoutContact = 0;
        
        const resultsWithContact = results.filter((result, index) => {
            console.log(`\nРезультат ${index + 1}/${results.length}: "${result.organizationName || result.name}"`);
            console.log(`  - Email: ${result.email || 'НЕТ'}`);
            console.log(`  - AllEmails: ${result.allEmails?.length || 0} emails`);
            console.log(`  - Phone: ${result.phone || 'НЕТ'}`);
            console.log(`  - Description contains email: ${result.description && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(result.description) ? 'ДА' : 'НЕТ'}`);
            
            // Check various email fields
            const hasEmail = result.email || 
                            (result.allEmails && result.allEmails.length > 0) ||
                            // Also check if email might be in description
                            (result.description && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(result.description));
            
            // Check phone fields  
            const hasPhone = result.phone || result.phoneNumber;
            
            // ✅ НОВАЯ ЛОГИКА: Принимаем если есть email ИЛИ телефон
            const hasContactInfo = hasEmail || hasPhone;
            
            if (hasEmail && hasPhone) {
                console.log(`  ✅ ПРИНЯТ - есть и email и телефон (идеально!)`);
                withBoth++;
            } else if (hasEmail && !hasPhone) {
                console.log(`  ✅ ПРИНЯТ - есть email (без телефона)`);
                withEmail++;
            } else if (!hasEmail && hasPhone) {
                console.log(`  ✅ ПРИНЯТ - есть телефон (без email)`);
                withPhoneOnly++;
            } else {
                console.log(`  ❌ ОТФИЛЬТРОВАН - нет ни email ни телефона`);
                withoutContact++;
            }
            
            return hasContactInfo;
        });
        
        console.log(`\n📊 ИТОГИ ФИЛЬТРАЦИИ ПО КОНТАКТНЫМ ДАННЫМ:`);
        console.log(`  - Исходных результатов: ${results.length}`);
        console.log(`  - С email и телефоном: ${withBoth}`);
        console.log(`  - Только с email: ${withEmail}`);
        console.log(`  - Только с телефоном: ${withPhoneOnly}`);
        console.log(`  - Всего с контактами: ${withBoth + withEmail + withPhoneOnly}`);
        console.log(`  - Без контактов: ${withoutContact}`);
        console.log(`  - Успешность фильтрации: ${Math.round((withBoth + withEmail + withPhoneOnly)/results.length*100)}%`);
        console.log(`  - ФИНАЛЬНОЕ КОЛИЧЕСТВО: ${resultsWithContact.length}`);
        
        // 🎯 УЛУЧШЕНИЕ: если слишком мало результатов с контактами, показать рекомендации
        const totalWithContact = withBoth + withEmail + withPhoneOnly;
        if (totalWithContact < 5 && results.length > totalWithContact) {
            console.log(`\n⚠️ РЕКОМЕНДАЦИИ ДЛЯ УВЕЛИЧЕНИЯ РЕЗУЛЬТАТОВ:`);
            console.log(`  1. Улучшить email/phone extraction алгоритм в web scraper`);
            console.log(`  2. Добавить поиск на /contact, /kontakt страницах`);
            console.log(`  3. Увеличить количество результатов для валидации (сейчас: ${results.length})`);
            console.log(`  4. ✅ ВКЛЮЧЕНЫ организации с телефонами без email'ов (новое!)`);
            
            // Показать примеры организаций без контактов для анализа
            console.log(`\n📋 ОРГАНИЗАЦИИ БЕЗ КОНТАКТОВ (первые 3):`);
            const withoutContactResults = results.filter(result => {
                const hasEmail = result.email || 
                                (result.allEmails && result.allEmails.length > 0) ||
                                (result.description && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(result.description));
                const hasPhone = result.phone || result.phoneNumber;
                return !hasEmail && !hasPhone;
            });
            
            withoutContactResults.slice(0, 3).forEach((result, index) => {
                console.log(`Без контактов ${index + 1}: ${result.organizationName || result.name}`);
                console.log(`  Website: ${result.website}`);
                console.log(`  Address: ${result.address || 'Нет'}`);
            });
        }
        
        console.log('='.repeat(80));
        
        return resultsWithContact;
    }

    /**
     * Filter and sort results by relevance to original query
     * ✅ Новая функция для улучшенной фильтрации по релевантности
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
        
        // Извлекаем ключевые слова из запроса
        const keywords = originalQuery.toLowerCase()
            .split(/[,\s]+/)
            .filter(word => word.length > 2)
            .map(word => word.trim());
        
        console.log(`🔍 Извлеченные ключевые слова:`, keywords);
        
        // Добавляем скор релевантности к каждому результату
        const scoredResults = results.map((result, index) => {
            let score = 0;
            
            // Текст для поиска совпадений
            const searchableText = [
                result.name || result.organizationName || '',
                result.description || '',
                result.address || '',
                result.category || ''
            ].join(' ').toLowerCase();
            
            // Подсчет релевантности
            keywords.forEach(keyword => {
                if (searchableText.includes(keyword)) {
                    score += 10; // +10 за каждое совпадение ключевого слова
                }
            });
            
            // Бонусы за качество данных
            if (result.email) score += 20; // +20 за наличие email
            if (result.phone) score += 5; // +5 за наличие телефона
            if (result.rating && parseFloat(result.rating) > 4) score += 5; // +5 за высокий рейтинг
            if (result.reviewsCount && parseInt(result.reviewsCount) > 10) score += 3; // +3 за много отзывов
            if (result.description && result.description.length > 50) score += 2; // +2 за подробное описание
            
            // Логирование первых 5 результатов для отладки
            if (index < 5) {
                console.log(`Результат ${index + 1}: "${result.name}" - Скор: ${score}`);
                console.log(`  - Совпадения: ${keywords.filter(k => searchableText.includes(k)).join(', ')}`);
                console.log(`  - Email: ${result.email ? 'ДА' : 'НЕТ'}`);
                console.log(`  - Рейтинг: ${result.rating || 'НЕТ'}`);
            }
            
            return { ...result, relevanceScore: score };
        });
        
        // Сортировка по релевантности (по убыванию скора)
        scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        console.log(`📊 РЕЗУЛЬТАТЫ СКОРИНГА:`);
        console.log(`  - Средний скор: ${Math.round(scoredResults.reduce((sum, r) => sum + r.relevanceScore, 0) / scoredResults.length)}`);
        console.log(`  - Максимальный скор: ${Math.max(...scoredResults.map(r => r.relevanceScore))}`);
        console.log(`  - Минимальный скор: ${Math.min(...scoredResults.map(r => r.relevanceScore))}`);
        
        // Обрезка до запрошенного количества если указано
        const finalResults = requestedCount ? 
            scoredResults.slice(0, requestedCount) : 
            scoredResults;
            
        console.log(`✅ Отфильтровано по релевантности: ${finalResults.length} результатов`);
        console.log('='.repeat(80));
        
        return finalResults;
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            progress: this.currentProgress,
            clientsReady: {
                openai: this.openaiClient ? this.openaiClient.isInitialized() : false,
                apify: this.apifyClient ? this.apifyClient.isInitialized() : false
            }
        };
    }
}

// Export for use in other modules
window.PipelineOrchestrator = PipelineOrchestrator;