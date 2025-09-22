/**
 * Server-side OpenAI Client for GYMNASTIKA Platform
 * Direct OpenAI API integration for server-side operations
 */

class ServerOpenAIClient {
    constructor() {
        this.assistantId = process.env.OPENAI_ASSISTANT_ID;
        this.validationAssistantId = process.env.OPENAI_VALIDATION_ASSISTANT_ID;
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseUrl = 'https://api.openai.com/v1';
        this.initialized = false;
    }

    /**
     * Initialize OpenAI client with environment variables
     */
    initialize() {
        if (!this.apiKey) {
            console.error('❌ OPENAI_API_KEY not found in environment');
            return false;
        }

        if (!this.assistantId) {
            console.error('❌ OPENAI_ASSISTANT_ID not found in environment');
            return false;
        }

        this.initialized = true;
        console.log('🤖 Server OpenAI client initialized');
        console.log(`📋 Query generation assistant: ${this.assistantId}`);
        console.log(`🔍 Validation assistant: ${this.validationAssistantId || 'not configured'}`);
        return true;
    }

    /**
     * Check if client is properly initialized
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Generate search queries using OpenAI Assistant
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
            console.log(`🤖 Generating search queries for: "${searchQuery}"`);

            // Create thread
            const thread = await this.createThread();
            const threadId = thread.id;

            // Add message to thread
            await this.addMessage(threadId, searchQuery);

            // Run assistant
            const run = await this.runAssistant(threadId, this.assistantId);
            const runId = run.id;

            // Wait for completion
            const completedRun = await this.waitForCompletion(threadId, runId);

            if (completedRun.status !== 'completed') {
                throw new Error(`Assistant run failed with status: ${completedRun.status}`);
            }

            // Get messages
            const messages = await this.getMessages(threadId);
            const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

            if (!assistantMessage || !assistantMessage.content[0]?.text?.value) {
                throw new Error('No response received from assistant');
            }

            const response = JSON.parse(assistantMessage.content[0].text.value);
            console.log(`✅ Generated ${response.length || 1} query groups`);

            return response;

        } catch (error) {
            console.error('❌ Query generation failed:', error.message);
            throw error;
        }
    }

    /**
     * Create a new thread
     */
    async createThread() {
        const response = await fetch(`${this.baseUrl}/threads`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to create thread: ${error.error?.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Add message to thread
     */
    async addMessage(threadId, content) {
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                role: 'user',
                content: content
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to add message: ${error.error?.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Run assistant
     */
    async runAssistant(threadId, assistantId) {
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/runs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                assistant_id: assistantId
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to run assistant: ${error.error?.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Wait for run completion
     */
    async waitForCompletion(threadId, runId, maxWait = 60000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            const run = await this.getRunStatus(threadId, runId);

            if (run.status === 'completed') {
                return run;
            }

            if (run.status === 'failed' || run.status === 'cancelled') {
                throw new Error(`Assistant run ${run.status}: ${run.last_error?.message || 'Unknown error'}`);
            }

            // Wait 1 second before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error('Assistant run timeout');
    }

    /**
     * Get run status
     */
    async getRunStatus(threadId, runId) {
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/runs/${runId}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get run status: ${error.error?.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get messages from thread
     */
    async getMessages(threadId) {
        const response = await fetch(`${this.baseUrl}/threads/${threadId}/messages`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get messages: ${error.error?.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get status for monitoring
     */
    getStatus() {
        return {
            initialized: this.initialized,
            hasApiKey: !!this.apiKey,
            hasAssistantId: !!this.assistantId,
            hasValidationAssistantId: !!this.validationAssistantId
        };
    }
}

module.exports = ServerOpenAIClient;