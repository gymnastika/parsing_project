/**
 * OpenAI Assistant Client for GYMNASTIKA Platform
 * Handles communication with OpenAI Assistant API via secure proxy
 * 
 * SECURITY: All OpenAI API calls are now proxied through the server
 * to keep API keys secure and hidden from the browser
 */

class OpenAIClient {
    constructor() {
        this.assistantId = null;
        this.validationAssistantId = null;
        this.baseUrl = '/api/openai'; // Use local proxy instead of direct API
        this.initialized = false;
        this.serverBaseUrl = window.location.origin;
    }

    /**
     * Initialize OpenAI client - assistant IDs are retrieved from server
     * API key is securely stored on server and never exposed to browser
     */
    initialize() {
        // Assistant IDs are no longer needed in browser - they're stored on server
        // This is a security improvement: sensitive configuration stays on server
        
        this.initialized = true;
        console.log('🔒 OpenAI client initialized with secure proxy');
        console.log('✅ All API keys are now protected on server-side');
        return true;
    }

    /**
     * Check if client is properly initialized
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Generate search queries using first OpenAI Assistant
     * @param {string} searchQuery - The user's search query
     * @returns {Promise<Object>} - Object with queries, language, and region
     */
    async generateSearchQueries(searchQuery) {
        if (!this.isInitialized()) {
            throw new Error('OpenAI client not initialized. Please check your configuration.');
        }

        if (!searchQuery || searchQuery.trim() === '') {
            throw new Error('Search query cannot be empty');
        }

        try {
            console.log('🔍 Generating search queries with OpenAI Assistant:', searchQuery);
            console.log('🤖 ПЕРВЫЙ АССИСТЕНТ - ГЕНЕРАЦИЯ ЗАПРОСОВ:');
            console.log('📤 Исходный запрос пользователя:', searchQuery);
            console.log('🆔 Assistant ID:', this.assistantId);

            // Step 1: Create a thread
            const thread = await this.createThread();
            console.log('🧵 Thread ID:', thread.id);
            
            // Step 2: Add message to thread
            await this.addMessageToThread(thread.id, searchQuery);
            console.log('📝 Сообщение добавлено в thread:', searchQuery);
            
            // Step 3: Run the assistant (query generation)
            const run = await this.runAssistant(thread.id, 'query');
            console.log('🏃 Run ID:', run.id);
            
            // Step 4: Wait for completion and get result
            const result = await this.waitForRunCompletion(thread.id, run.id, 'query-generation');
            
            console.log('✅ ПЕРВЫЙ АССИСТЕНТ - РЕЗУЛЬТАТ:');
            console.log('📥 Полный ответ от первого ассистента:', JSON.stringify(result, null, 2));
            
            return result;

        } catch (error) {
            console.error('❌ Ошибка первого ассистента:', error);
            throw new Error(`Failed to generate search queries: ${error.message}`);
        }
    }

    /**
     * Validate results using second OpenAI Assistant
     * @param {Object} validationData - Data to validate
     * @returns {Promise<Object>} - Validation results
     */
    async validateResults(validationData) {
        if (!this.validationAssistantId) {
            console.warn('Validation assistant not configured - returning unvalidated results');
            // 🔍 АЛЬТЕРНАТИВНАЯ ВАЛИДАЦИЯ: берем топ-10 по рейтингу если есть, иначе первые 10
            let filteredResults = validationData.results || [];
            const requestedCount = validationData.requestedCount || 10;
            
            console.log(`🎯 АЛЬТЕРНАТИВНАЯ ВАЛИДАЦИЯ: фильтруем ${filteredResults.length} → ${requestedCount} результатов`);
            
            // Сортировка по рейтингу (если есть) и берем топ
            if (filteredResults.some(r => r.rating)) {
                filteredResults.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
                console.log('📈 Отсортированы по рейтингу');
            }
            
            // Обрезка до нужного количества
            filteredResults = filteredResults.slice(0, requestedCount);
            
            return {
                validResults: filteredResults,
                summary: `Валидация пропущена - второй ассистент не настроен. Взяты топ-${filteredResults.length} результатов`
            };
        }

        try {
            console.log('🔍 Validating results with OpenAI Validation Assistant');
            console.log('🤖 ВТОРОЙ АССИСТЕНТ - ВАЛИДАЦИЯ РЕЗУЛЬТАТОВ:');
            console.log('🆔 Validation Assistant ID:', this.validationAssistantId);
            console.log('📊 Количество результатов для валидации:', validationData.results?.length || 0);
            console.log('🎯 Запрашиваемое количество валидных результатов:', validationData.requestedCount || 10);

            // Step 1: Create a thread
            const thread = await this.createThread();
            console.log('🧵 Validation Thread ID:', thread.id);
            
            // Step 2: Add message to thread with validation data
            const message = JSON.stringify({
                originalQuery: validationData.originalQuery,
                requestedCount: validationData.requestedCount || 10, // ✅ Передаем количество
                resultsToValidate: validationData.results
            });
            console.log('📤 ПОЛНЫЙ ЗАПРОС ВТОРОМУ АССИСТЕНТУ:', message);
            await this.addMessageToThread(thread.id, message);
            
            // Step 3: Run the validation assistant
            const run = await this.runAssistant(thread.id, 'validation');
            console.log('🏃 Validation Run ID:', run.id);
            
            // Step 4: Wait for completion and get result
            const result = await this.waitForRunCompletion(thread.id, run.id, 'validation');
            
            console.log('✅ ВТОРОЙ АССИСТЕНТ - РЕЗУЛЬТАТ ВАЛИДАЦИИ:');
            console.log('📥 Полный ответ от второго ассистента:', JSON.stringify(result, null, 2));
            console.log('📈 Количество валидированных результатов:', result.validResults?.length || 0);
            
            return result;

        } catch (error) {
            console.error('❌ Ошибка второго ассистента:', error);
            // Return unvalidated results with error message
            return {
                validResults: validationData.results,
                summary: `Ошибка валидации: ${error.message}`
            };
        }
    }

    /**
     * Create a new thread via secure proxy
     */
    async createThread() {
        const response = await fetch(`${this.baseUrl}/threads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to create thread: ${response.status} ${errorData.error || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Add message to thread via secure proxy
     */
    async addMessageToThread(threadId, content) {
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: 'user',
                content: content
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to add message: ${response.status} ${errorData.error || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Run the assistant via secure proxy
     * Assistant ID is now handled on server-side for security
     */
    async runAssistant(threadId, assistantType = 'query') {
        // assistantType: 'query' for generation, 'validation' for validation
        // Server will determine which assistant ID to use based on type
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assistant_type: assistantType // Server will map this to actual assistant ID
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to run assistant: ${response.status} ${errorData.error || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Wait for run completion and get the result
     */
    async waitForRunCompletion(threadId, runId, responseType = 'query-generation', maxAttempts = 30) {
        console.log(`⏳ Ожидание завершения ${responseType === 'query-generation' ? 'первого' : 'второго'} ассистента...`);
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const run = await this.getRun(threadId, runId);
            console.log(`🔄 Попытка ${attempt + 1}/${maxAttempts}, статус: ${run.status}`);
            
            if (run.status === 'completed') {
                // Get the latest message from the thread
                const messages = await this.getThreadMessages(threadId);
                const lastMessage = messages.data[0];
                
                console.log(`📨 Получено сообщений: ${messages.data.length}`);
                console.log(`📋 Содержимое последнего сообщения:`, lastMessage);
                
                if (lastMessage && lastMessage.content && lastMessage.content[0]) {
                    const content = lastMessage.content[0].text.value;
                    console.log(`📄 Сырой текст ответа ассистента:`, content);
                    
                    try {
                        // Parse the JSON response
                        const parsedResponse = JSON.parse(content);
                        console.log(`✅ Распарсенный JSON ответ (${responseType}):`, parsedResponse);
                        
                        // Return structured response based on type
                        if (responseType === 'query-generation') {
                            const formatted = this.formatQueryGenerationResponse(parsedResponse);
                            console.log(`🎯 Отформатированный ответ первого ассистента:`, formatted);
                            return formatted;
                        } else if (responseType === 'validation') {
                            const formatted = this.formatValidationResponse(parsedResponse);
                            console.log(`🎯 Отформатированный ответ второго ассистента:`, formatted);
                            return formatted;
                        }
                        
                        return parsedResponse;
                        
                    } catch (parseError) {
                        console.warn('❌ Не удалось распарсить JSON ответ, попытка fallback обработки:', content);
                        console.warn('Ошибка парсинга:', parseError.message);
                        return this.handleFallbackResponse(content, responseType);
                    }
                }
            } else if (run.status === 'failed') {
                console.error('❌ Ассистент завершился с ошибкой:', run.last_error);
                throw new Error(`Assistant run failed: ${run.last_error?.message || 'Unknown error'}`);
            }
            
            // Wait before next attempt
            await this.delay(1000);
        }
        
        throw new Error('Timeout waiting for assistant response');
    }

    /**
     * Format query generation response
     */
    formatQueryGenerationResponse(response) {
        // Handle different response formats from first assistant
        if (Array.isArray(response)) {
            // Check if it's new format with array of query objects
            if (response.length > 0 && response[0].queries && response[0].language && response[0].region) {
                console.log(`🎯 New multi-language format: ${response.length} query objects`);
                return response; // Return array of query objects as-is
            }
            // Legacy format - just array of queries
            return {
                queries: response,
                language: 'en',
                region: 'US'
            };
        } else if (response.queries && Array.isArray(response.queries)) {
            // Old structured format
            return {
                queries: response.queries,
                language: response.language || 'en',
                region: response.region || response.country || 'US'
            };
        } else {
            throw new Error('Invalid query generation response format');
        }
    }

    /**
     * Format validation response
     */
    formatValidationResponse(response) {
        // Handle different response formats from validation assistant
        const validResults = response.validResults || response.results || response.websites || [];
        const summary = response.summary || response.validationSummary || 
                       (response.validation_summary && typeof response.validation_summary === 'object' 
                        ? JSON.stringify(response.validation_summary) 
                        : response.validation_summary) || 'Валидация завершена';
        
        console.log(`🔍 Validation parsing: found ${validResults.length} valid results`);
        console.log(`📊 First validation result sample:`, validResults[0]);
        
        // If validation assistant returns just URLs, convert to display format
        const formattedResults = validResults.map((item, index) => {
            // If item is just a URL string, format for display
            if (typeof item === 'string') {
                return {
                    name: `Организация ${index + 1}`,
                    website: item,
                    address: null,
                    rating: null,
                    reviews: null,
                    phone: null,
                    category: null
                };
            }
            // If item is already an object, return as is
            return item;
        });
        
        return {
            validResults: formattedResults,
            summary: summary
        };
    }

    /**
     * Handle fallback response parsing
     */
    handleFallbackResponse(content, responseType) {
        if (responseType === 'query-generation') {
            // Try to extract queries from text
            const lines = content.split('\n').filter(line => line.trim());
            return {
                queries: lines.length > 0 ? lines : [content],
                language: 'en',
                region: 'US'
            };
        } else if (responseType === 'validation') {
            return {
                validResults: [],
                summary: `Не удалось обработать ответ валидации: ${content.substring(0, 100)}...`
            };
        }
        
        return content;
    }

    /**
     * Get run status via secure proxy
     */
    async getRun(threadId, runId) {
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/runs/${runId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to get run: ${response.status} ${errorData.error || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get thread messages via secure proxy
     */
    async getThreadMessages(threadId) {
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/messages`);

        if (!response.ok) {
            throw new Error(`Failed to get messages: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get client status - secure proxy mode
     */
    getStatus() {
        return {
            initialized: this.initialized,
            proxyMode: true,
            secureConnection: true,
            canGenerateQueries: this.initialized,
            canValidateResults: this.initialized // Validation depends on server configuration
        };
    }
}

// Expose class globally for platform initialization
window.OpenAIClient = OpenAIClient;

// Create global instance
window.openaiClient = new OpenAIClient();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.openaiClient) {
        window.openaiClient.initialize();
    }
});

console.log('📝 OpenAI client loaded');