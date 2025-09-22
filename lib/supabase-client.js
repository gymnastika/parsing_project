/**
 * Supabase Database Client
 * GYMNASTIKA Management Platform
 * 
 * This module provides a wrapper around the Supabase client for database operations
 */

class SupabaseDatabaseClient {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.connectionStatus = 'disconnected';
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        
        this.eventListeners = {
            'connection': [],
            'error': [],
            'ready': []
        };
    }

    /**
     * Initialize the Supabase client
     */
    async initialize(config = null) {
        try {
            // Use provided config or load from global config
            const supabaseConfig = config || window.SupabaseConfig;
            
            if (!supabaseConfig || !supabaseConfig.url || !supabaseConfig.anonKey) {
                throw new Error('Supabase configuration not found. Please configure Supabase first.');
            }

            // Validate configuration
            if (window.SupabaseConfigHelper && !window.SupabaseConfigHelper.isConfigured()) {
                const errors = window.SupabaseConfigHelper.getConfigErrors();
                throw new Error(`Configuration errors: ${errors.join(', ')}`);
            }

            // Check if Supabase library is loaded
            if (typeof supabase === 'undefined') {
                throw new Error('Supabase library not loaded. Please include the Supabase CDN script.');
            }

            this.connectionStatus = 'connecting';
            this.emit('connection', { status: 'connecting' });

            // Create Supabase client
            this.client = supabase.createClient(
                supabaseConfig.url,
                supabaseConfig.anonKey,
                supabaseConfig.options || {}
            );

            // Set access token if available for authenticated requests
            if (supabaseConfig.accessToken) {
                await this.client.auth.setSession({
                    access_token: supabaseConfig.accessToken,
                    token_type: 'bearer'
                });
                console.log('🔑 Access token configured for authenticated requests');
            }

            // Connection successful - client created
            this.isInitialized = true;
            this.connectionStatus = 'connected';
            this.retryAttempts = 0;

            this.emit('ready', { client: this.client });
            this.emit('connection', { status: 'connected' });

            console.log('✅ Supabase client initialized successfully');
            return true;

        } catch (error) {
            this.connectionStatus = 'error';
            this.emit('error', error);
            
            console.error('❌ Failed to initialize Supabase client:', error.message);
            
            // Retry logic
            if (this.retryAttempts < this.maxRetries) {
                this.retryAttempts++;
                console.log(`🔄 Retrying connection (${this.retryAttempts}/${this.maxRetries})...`);
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.initialize(config);
            }
            
            throw error;
        }
    }

    /**
     * Get the Supabase client instance
     */
    getClient() {
        if (!this.isInitialized) {
            throw new Error('Supabase client not initialized. Call initialize() first.');
        }
        return this.client;
    }

    /**
     * Check if client is ready
     */
    isReady() {
        return this.isInitialized && this.connectionStatus === 'connected';
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            connectionStatus: this.connectionStatus,
            retryAttempts: this.retryAttempts
        };
    }

    /**
     * Test database connection
     */
    async testConnection() {
        if (!this.isReady()) {
            return { success: false, error: 'Client not ready' };
        }

        try {
            // Test connection by getting current session (doesn't require special RPC functions)
            const { error } = await this.client.auth.getSession();
                
            if (error && error.message !== 'No session found') {
                throw error;
            }

            return { 
                success: true, 
                message: 'Database connection successful',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get current authenticated user
     */
    async getCurrentUser() {
        if (!this.isReady()) {
            throw new Error('Supabase client not ready');
        }

        try {
            const { data: { user }, error } = await this.client.auth.getUser();
            if (error) {
                throw new Error(`Error getting current user: ${error.message}`);
            }
            return user;
        } catch (error) {
            console.error('Error getting current user:', error);
            throw error;
        }
    }

    /**
     * Profile management operations
     */

    /**
     * Get all profiles (for staff list)
     */
    async getAllProfiles() {
        return await this.safeQuery(
            client => client
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false }),
            'Failed to fetch profiles'
        );
    }

    /**
     * Get profile by user ID
     */
    async getProfile(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.safeQuery(
            client => client
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single(),
            'Failed to fetch user profile'
        );
    }

    /**
     * Get profile by username
     */
    async getProfileByUsername(username) {
        if (!username) {
            throw new Error('Username is required');
        }

        return await this.safeQuery(
            client => client
                .from('profiles')
                .select('*')
                .eq('username', username)
                .single(),
            'Failed to fetch profile by username'
        );
    }

    /**
     * Create new profile
     */
    async createProfile(profileData) {
        const { id, username, firstName, lastName } = profileData;

        if (!id || !username || !firstName || !lastName) {
            throw new Error('All profile fields are required (id, username, firstName, lastName)');
        }

        return await this.safeQuery(
            client => client
                .from('profiles')
                .insert([
                    {
                        id: id,
                        username: username,
                        first_name: firstName,
                        last_name: lastName
                    }
                ])
                .select()
                .single(),
            'Failed to create profile'
        );
    }

    /**
     * Update profile
     */
    async updateProfile(userId, updates) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (!updates || Object.keys(updates).length === 0) {
            throw new Error('Updates object is required');
        }

        // Map camelCase to snake_case for database
        const dbUpdates = {};
        if (updates.firstName) dbUpdates.first_name = updates.firstName;
        if (updates.lastName) dbUpdates.last_name = updates.lastName;
        if (updates.username) dbUpdates.username = updates.username;

        return await this.safeQuery(
            client => client
                .from('profiles')
                .update(dbUpdates)
                .eq('id', userId)
                .select()
                .single(),
            'Failed to update profile'
        );
    }

    /**
     * Delete profile
     */
    async deleteProfile(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.safeQuery(
            client => client
                .from('profiles')
                .delete()
                .eq('id', userId),
            'Failed to delete profile'
        );
    }

    /**
     * Check if username exists
     */
    async checkUsernameExists(username) {
        if (!username) {
            throw new Error('Username is required');
        }

        try {
            const result = await this.safeQuery(
                client => client
                    .from('profiles')
                    .select('username')
                    .eq('username', username)
                    .single(),
                'Failed to check username'
            );

            return !!result.data;
        } catch (error) {
            // If no rows found, username doesn't exist
            if (error.message.includes('PGRST116')) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get user stats (for dashboard)
     */
    async getUserStats() {
        return await this.safeQuery(
            client => client
                .from('profiles')
                .select('id', { count: 'exact', head: true }),
            'Failed to get user statistics'
        );
    }

    /**
     * Basic database operations - additional utility methods
     */

    /**
     * Event system
     */
    on(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.eventListeners[event]) {
            const index = this.eventListeners[event].indexOf(callback);
            if (index > -1) {
                this.eventListeners[event].splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        if (this.client) {
            // Supabase client doesn't have explicit disconnect, but we can clean up
            this.client = null;
        }
        
        this.isInitialized = false;
        this.connectionStatus = 'disconnected';
        this.emit('connection', { status: 'disconnected' });
        
        console.log('📡 Supabase client disconnected');
    }

    /**
     * Utility: Safe query execution with error handling
     */
    async safeQuery(queryFn, errorMessage = 'Database query failed') {
        if (!this.isReady()) {
            throw new Error('Database not ready');
        }

        try {
            const result = await queryFn(this.client);
            
            if (result.error) {
                throw new Error(`${errorMessage}: ${result.error.message}`);
            }
            
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    /**
     * ==========================================
     * PARSING RESULTS OPERATIONS
     * ==========================================
     */

    /**
     * Save parsing results to the database
     * Save parsing results with email to the database
     */
    async saveParsingResults(taskData, results) {
        try {
            console.log('💾 Saving parsing results to Supabase...', {
                taskName: taskData.taskName,
                resultsCount: results.length
            });

            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to save parsing results');
            }

            // Filter results to include only those with email
            const resultsWithContact = results.filter(result => {
                return result.email && result.email.trim() !== '';
            });
            
            console.log(`📧 Filtered results: ${results.length} total → ${resultsWithContact.length} with email`);
            
            if (resultsWithContact.length === 0) {
                console.warn('⚠️ No results with email to save');
                return {
                    success: true,
                    data: [],
                    count: 0,
                    message: 'No results with contact information to save'
                };
            }

            // Prepare parsing results for batch insert
            const parsingRecords = resultsWithContact.map((result, index) => {
                console.log(`💾 Preparing record ${index + 1} for database:`, {
                    organizationName: result.organizationName,
                    title: result.title,
                    name: result.name,
                    email: result.email || 'No email'
                });
                
                return {
                    user_id: user.id,
                    task_name: taskData.taskName || 'Unnamed Task',
                    original_query: taskData.searchQuery || '',
                    organization_name: result.organizationName || result.title || result.name || 'Unknown Organization',
                    email: result.email || null,

                    description: result.description || 'No description available',
                    country: result.country || 'Not specified',
                    source_url: result.url || '',
                    website: result.website || result.url || '',
                    all_emails: JSON.stringify(result.allEmails || []),
                    page_title: result.pageTitle || '',
                    has_contact_info: result.hasContactInfo || false,
                    scraping_error: result.scrapingError || null,
                    error_type: result.errorType || null,
                    scraped_at: result.scrapedAt || new Date().toISOString(),
                    parsing_timestamp: new Date().toISOString()
                };
            });

            // Batch insert parsing results
            const { data, error } = await this.client
                .from('parsing_results')
                .insert(parsingRecords)
                .select();

            if (error) {
                console.error('❌ Error saving parsing results:', error);
                throw error;
            }

            console.log(`✅ Successfully saved ${data.length} parsing results to Supabase`);
            
            return {
                success: true,
                data,
                count: data.length,
                message: `Saved ${data.length} parsing results`
            };

        } catch (error) {
            console.error('💥 Failed to save parsing results:', error);
            throw error;
        }
    }

    /**
     * Get recent parsing results for current user
     */
    async getRecentParsingResults(limit = 50, offset = 0) {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to fetch parsing results');
            }

            const { data, error } = await this.client
                .rpc('get_recent_parsing_results', {
                    p_user_id: user.id,
                    p_limit: limit,
                    p_offset: offset
                });

            if (error) {
                console.error('❌ Error fetching recent parsing results:', error);
                throw error;
            }

            console.log(`📊 Fetched ${data.length} recent parsing results`);
            return {
                success: true,
                data,
                count: data.length
            };

        } catch (error) {
            console.error('💥 Failed to fetch recent parsing results:', error);
            throw error;
        }
    }

    /**
     * Get parsing results by task name
     */
    async getParsingResultsByTask(taskName) {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to fetch parsing results');
            }

            const { data, error } = await this.client
                .from('parsing_results')
                .select('*')
                .eq('user_id', user.id)
                .eq('task_name', taskName)
                .order('parsing_timestamp', { ascending: false });

            if (error) {
                console.error('❌ Error fetching parsing results by task:', error);
                throw error;
            }

            console.log(`📊 Fetched ${data.length} results for task: ${taskName}`);
            return {
                success: true,
                data,
                count: data.length
            };

        } catch (error) {
            console.error('💥 Failed to fetch parsing results by task:', error);
            throw error;
        }
    }

    /**
     * Search parsing results
     */
    async searchParsingResults(searchText = '', country = null, hasEmail = null, limit = 50) {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to search parsing results');
            }

            const { data, error } = await this.client
                .rpc('search_parsing_results', {
                    p_user_id: user.id,
                    p_search_text: searchText,
                    p_country: country,
                    p_has_email: hasEmail,
                    p_limit: limit
                });

            if (error) {
                console.error('❌ Error searching parsing results:', error);
                throw error;
            }

            console.log(`🔍 Found ${data.length} parsing results matching search criteria`);
            return {
                success: true,
                data,
                count: data.length
            };

        } catch (error) {
            console.error('💥 Failed to search parsing results:', error);
            throw error;
        }
    }

    /**
     * Get user parsing statistics
     */
    async getUserParsingStats() {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to fetch parsing statistics');
            }

            const { data, error } = await this.client
                .from('user_parsing_stats')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('❌ Error fetching parsing statistics:', error);
                throw error;
            }

            console.log('📈 Fetched user parsing statistics:', data);
            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('💥 Failed to fetch parsing statistics:', error);
            throw error;
        }
    }

    /**
     * Update parsing result by ID (with user authorization)
     */
    async updateParsingResult(id, updateData) {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to update parsing results');
            }

            // Add user_id to ensure authorization
            const dataWithUserId = {
                ...updateData,
                user_id: user.id,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('parsing_results')
                .update(dataWithUserId)
                .eq('id', id)
                .eq('user_id', user.id)
                .select();

            if (error) {
                console.error('❌ Error updating parsing result:', error);
                throw error;
            }

            if (data.length === 0) {
                throw new Error('Parsing result not found or not authorized to update');
            }

            console.log('✅ Updated parsing result:', data[0].id);
            return {
                success: true,
                data: data[0]
            };

        } catch (error) {
            console.error('💥 Failed to update parsing result:', error);
            return {
                success: false,
                error: error.message || 'Unknown error occurred'
            };
        }
    }

    /**
     * Delete parsing results by ID
     */
    async deleteParsingResult(id) {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to delete parsing results');
            }

            const { data, error } = await this.client
                .from('parsing_results')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id)
                .select();

            if (error) {
                console.error('❌ Error deleting parsing result:', error);
                throw error;
            }

            if (data.length === 0) {
                throw new Error('Parsing result not found or not authorized to delete');
            }

            console.log('🗑️ Deleted parsing result:', data[0].id);
            return {
                success: true,
                data: data[0]
            };

        } catch (error) {
            console.error('💥 Failed to delete parsing result:', error);
            throw error;
        }
    }

    /**
     * Get unique task names for current user
     */
    async getTaskNames() {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to fetch task names');
            }

            const { data, error } = await this.client
                .from('parsing_results')
                .select('task_name')
                .eq('user_id', user.id)
                .distinct('task_name')
                .order('task_name');

            if (error) {
                console.error('❌ Error fetching task names:', error);
                throw error;
            }

            const taskNames = data.map(item => item.task_name);
            console.log(`📝 Fetched ${taskNames.length} unique task names`);
            
            return {
                success: true,
                data: taskNames,
                count: taskNames.length
            };

        } catch (error) {
            console.error('💥 Failed to fetch task names:', error);
            throw error;
        }
    }

    /**
     * Get unique countries for current user
     */
    async getCountries() {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User must be authenticated to fetch countries');
            }

            const { data, error } = await this.client
                .from('parsing_results')
                .select('country')
                .eq('user_id', user.id)
                .not('country', 'is', null)
                .distinct('country')
                .order('country');

            if (error) {
                console.error('❌ Error fetching countries:', error);
                throw error;
            }

            const countries = data.map(item => item.country);
            console.log(`🌍 Fetched ${countries.length} unique countries`);
            
            return {
                success: true,
                data: countries,
                count: countries.length
            };

        } catch (error) {
            console.error('💥 Failed to fetch countries:', error);
            throw error;
        }
    }
}

// Global instance
window.gymnastikaDB = new SupabaseDatabaseClient();
window.SupabaseClient = window.gymnastikaDB; // Alias for backward compatibility
window.SupabaseClient = window.gymnastikaDB; // Alias for backward compatibility
window.SupabaseClient = window.gymnastikaDB; // Alias for backward compatibility

// Create alias for script.js compatibility
window.SupabaseClient = window.gymnastikaDB;

// Global database client loaded
console.log('📊 GYMNASTIKA Database Client ready');

// Initialize actual Supabase client when config is available
function initializeSupabaseClient() {
    try {
        if (typeof supabase !== 'undefined' && window.SupabaseConfig) {
            const { url, anonKey, options } = window.SupabaseConfig;
            window.supabaseClient = supabase.createClient(url, anonKey, options);
            console.log('✅ Supabase client initialized globally');
        }
    } catch (error) {
        console.warn('⚠️ Could not initialize Supabase client:', error);
    }
}

// Create alias for script.js compatibility
window.SupabaseClient = window.gymnastikaDB;

// Initialize when DOM is ready or config is available
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupabaseClient);
} else {
    initializeSupabaseClient();
}
// Create alias for script.js compatibility
window.SupabaseClient = window.gymnastikaDB;
