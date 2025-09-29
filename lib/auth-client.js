/**
 * Supabase Authentication Client
 * GYMNASTIKA Management Platform
 * 
 * Handles all authentication operations including registration, login, and user management
 */

class SupabaseAuthClient {
    constructor() {
        this.client = null;
        this.currentUser = null;
        this.initialized = false;
        this.secretCode = window.ENV?.REGISTRATION_SECRET_CODE || 'GYMN-2025-SECURE';
        
        // Event listeners for auth state changes
        this.eventListeners = {
            'authStateChange': [],
            'userUpdate': [],
            'error': []
        };
    }

    /**
     * Initialize the Supabase Auth client
     */
    async initialize() {
        try {
            if (!window.ENV?.SUPABASE_URL || !window.ENV?.SUPABASE_ANON_KEY) {
                throw new Error('Supabase configuration not found in environment variables');
            }

            if (typeof supabase === 'undefined') {
                throw new Error('Supabase library not loaded. Please include the Supabase CDN script.');
            }

            // Create Supabase client with unified auth configuration
            this.client = supabase.createClient(
                window.ENV.SUPABASE_URL,
                window.ENV.SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true, // Critical for OAuth callbacks (Google, etc)
                        storage: window.localStorage,
                        debug: false, // Enable for OAuth debugging if needed
                        flowType: 'implicit', // Implicit flow for SPA applications
                        storageKey: 'sb-auth-token', // Consistent storage key
                    }
                }
            );

            // Set up auth state listener
            this.client.auth.onAuthStateChange((event, session) => {
                this.handleAuthStateChange(event, session);
            });

            // Get current session
            const { data: { session }, error } = await this.client.auth.getSession();
            if (error) {
                console.warn('Error getting initial session:', error.message);
            } else if (session) {
                this.currentUser = session.user;
            }

            this.initialized = true;
            console.log('✅ Supabase Auth client initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize Supabase Auth client:', error);
            throw error;
        }
    }

    /**
     * Handle authentication state changes
     */
    handleAuthStateChange(event, session) {
        console.log('🔐 Auth state change:', event);
        
        switch (event) {
            case 'SIGNED_IN':
                this.currentUser = session?.user || null;
                this.emit('authStateChange', { event, user: this.currentUser, session });
                break;
            case 'SIGNED_OUT':
                this.currentUser = null;
                this.emit('authStateChange', { event, user: null, session: null });
                break;
            case 'TOKEN_REFRESHED':
                this.currentUser = session?.user || null;
                this.emit('authStateChange', { event, user: this.currentUser, session });
                break;
        }
    }

    /**
     * Generate deterministic phone number from username
     * @param {string} username - Username to convert to phone
     * @returns {string} - Generated phone number in international format
     */
    generatePhoneFromUsername(username) {
        // Create hash from username
        const hash = username.toLowerCase().split('').reduce((acc, char) =>
            acc + char.charCodeAt(0), 0);

        // Generate 7-digit number from hash
        const phoneNum = String(Math.abs(hash)).padStart(7, '0').slice(0, 7);

        // Return in international format (Russia +7900 prefix)
        return `+7900${phoneNum}`;
    }

    /**
     * Register a new user with phone authentication
     * @param {Object} userData - User registration data
     * @param {string} userData.phone - Generated phone number
     * @param {string} userData.password - User password
     * @param {string} userData.firstName - User first name
     * @param {string} userData.lastName - User last name
     * @param {string} userData.username - Unique username
     * @param {string} userData.secretCode - Secret registration code
     */
    async register(userData) {
        if (!this.initialized) {
            throw new Error('Auth client not initialized');
        }

        const { phone, password, firstName, lastName, username, secretCode } = userData;

        // Validate secret code
        if (secretCode !== this.secretCode) {
            throw new Error('Неверный секретный код. Обратитесь к администратору для получения кода.');
        }

        // Validate required fields
        if (!phone || !password || !firstName || !lastName || !username) {
            throw new Error('Все поля обязательны для заполнения');
        }

        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            throw new Error('Username должен содержать от 3 до 20 символов (буквы, цифры, подчеркивание)');
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Неверный формат email адреса');
        }

        // Validate password strength
        if (password.length < 6) {
            throw new Error('Пароль должен содержать минимум 6 символов');
        }

        try {
            console.log('🔍 Starting registration process for:', { email, username });
            
            // Check if username already exists
            const { data: existingUsers, error: checkError } = await this.client
                .from('profiles')
                .select('username')
                .eq('username', username);

            if (checkError) {
                console.error('⚠️ Error checking username availability:', {
                    message: checkError.message,
                    details: checkError.details,
                    hint: checkError.hint,
                    code: checkError.code,
                    fullError: checkError
                });
                throw new Error(`Ошибка проверки доступности username: ${checkError.message}`);
            }

            if (existingUsers && existingUsers.length > 0) {
                throw new Error('Пользователь с таким username уже существует');
            }

            console.log('✅ Username available, proceeding with Supabase auth registration...');

            // Register user with Supabase Auth using phone (no SMS needed)
            const { data, error } = await this.client.auth.signUp({
                phone: phone,
                password: password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        username: username
                    }
                }
            });

            console.log('📧 Supabase Auth response:', {
                user: data.user ? 'Created' : 'Not created',
                session: data.session ? 'Created' : 'Not created',
                error: error ? error.message : 'None'
            });

            if (error) {
                console.error('🚨 Supabase Auth Error Details:', {
                    message: error.message,
                    status: error.status,
                    details: error
                });

                if (error.message.includes('User already registered')) {
                    throw new Error('Пользователь с таким email уже зарегистрирован. Проверьте Supabase Dashboard → Authentication → Users');
                }
                throw new Error(`Ошибка регистрации: ${error.message}`);
            }

            if (!data.user) {
                throw new Error('Ошибка создания пользователя');
            }

            // If user was created and confirmed, create profile
            if (data.user && !data.user.email_confirmed_at) {
                console.log('📧 Пожалуйста, подтвердите email для завершения регистрации');
            }

            // Create user profile
            if (data.user) {
                await this.createUserProfile({
                    id: data.user.id,
                    username,
                    firstName,
                    lastName,
                    email
                });
            }

            console.log('✅ Регистрация прошла успешно');
            return {
                user: data.user,
                session: data.session,
                needsConfirmation: !data.session
            };

        } catch (error) {
            console.error('❌ Registration error:', error);
            throw error;
        }
    }

    /**
     * Create user profile in the profiles table
     */
    async createUserProfile({ id, username, firstName, lastName, email }) {
        try {
            console.log('📝 Creating profile for user:', { id, username, email });
            
            const { data, error } = await this.client
                .from('profiles')
                .insert([
                    {
                        id: id,
                        username: username,
                        first_name: firstName,
                        last_name: lastName,
                        email: email
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('❌ Profile creation error details:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    userData: { id, username, email }
                });
                
                // Handle specific error cases
                if (error.code === '23505') { // Unique constraint violation
                    if (error.message.includes('username')) {
                        throw new Error('Пользователь с таким username уже существует');
                    } else if (error.message.includes('id') || error.message.includes('pkey')) {
                        throw new Error('Пользователь с таким ID уже существует. Попробуйте повторно войти в систему.');
                    } else {
                        throw new Error('Данные пользователя уже существуют в системе');
                    }
                } else if (error.code === '23502') { // Not null violation
                    throw new Error('Не все обязательные поля заполнены');
                } else {
                    throw new Error(`Ошибка создания профиля: ${error.message}`);
                }
            }

            console.log('✅ User profile created successfully:', data);
            return data;

        } catch (error) {
            console.error('❌ Failed to create user profile:', error);
            throw error;
        }
    }

    /**
     * Sign in user
     * @param {string} username - Username
     * @param {string} password - User password
     */
    async login(username, password) {
        if (!this.initialized) {
            throw new Error('Auth client not initialized');
        }

        if (!username || !password) {
            throw new Error('Пользователь и пароль обязательны');
        }

        try {
            console.log('🔍 Looking up user by username:', username);
            
            // First, find the user's email by username
            const { data: profile, error: profileError } = await this.client
                .from('profiles')
                .select('email, username, first_name, last_name')
                .eq('username', username)
                .single();

            console.log('📊 Profile lookup result:', {
                profile,
                error: profileError
            });

            if (profileError) {
                if (profileError.code === 'PGRST116') {
                    // Check if profiles table exists and has any data
                    const { data: allProfiles, error: listError } = await this.client
                        .from('profiles')
                        .select('username')
                        .limit(5);
                    
                    console.log('📋 Available usernames in database:', 
                        allProfiles ? allProfiles.map(p => p.username) : 'None or error'
                    );
                }
                throw new Error('Пользователь с таким именем не найден');
            }

            if (!profile) {
                throw new Error('Пользователь с таким именем не найден');
            }

            // Use the found email to authenticate with Supabase
            const { data, error } = await this.client.auth.signInWithPassword({
                email: profile.email,
                password: password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Неверный пользователь или пароль');
                }
                if (error.message.includes('Email not confirmed')) {
                    throw new Error('Email не подтвержден. Проверьте почту или обратитесь к администратору.');
                }
                throw new Error(`Ошибка входа: ${error.message}`);
            }

            if (!data.session) {
                throw new Error('Не удалось создать сессию');
            }

            // Combine Supabase Auth user with profile data
            const userWithProfile = {
                ...data.user,
                profile: {
                    username: profile.username,
                    firstName: profile.first_name,
                    lastName: profile.last_name,
                    email: profile.email
                }
            };
            
            this.currentUser = userWithProfile;
            console.log('✅ Успешный вход в систему');
            
            return {
                user: userWithProfile,
                session: data.session
            };

        } catch (error) {
            console.error('❌ Login error:', error);
            throw error;
        }
    }

    /**
     * Sign out user
     */
    async logout() {
        if (!this.initialized) {
            throw new Error('Auth client not initialized');
        }

        try {
            const { error } = await this.client.auth.signOut();

            if (error) {
                throw new Error(`Ошибка выхода: ${error.message}`);
            }

            this.currentUser = null;
            console.log('✅ Успешный выход из системы');
            return true;

        } catch (error) {
            console.error('❌ Logout error:', error);
            throw error;
        }
    }

    /**
     * Get current user
     */
    async getCurrentUser() {
        if (!this.initialized) {
            throw new Error('Auth client not initialized');
        }

        try {
            const { data: { user }, error } = await this.client.auth.getUser();

            if (error) {
                throw new Error(`Ошибка получения пользователя: ${error.message}`);
            }

            if (!user) {
                this.currentUser = null;
                return null;
            }

            // Get user profile data
            console.log('🔍 Looking for profile for user ID:', user.id);
            const { data: profile, error: profileError } = await this.client
                .from('profiles')
                .select('username, first_name, last_name, email')
                .eq('id', user.id)
                .single();

            console.log('📊 Profile query result:', { profile, profileError });

            // Combine Supabase Auth user with profile data
            const userWithProfile = profile ? {
                ...user,
                profile: {
                    username: profile.username,
                    firstName: profile.first_name,
                    lastName: profile.last_name,
                    email: profile.email
                }
            } : user;

            console.log('👤 Final userWithProfile:', userWithProfile);

            this.currentUser = userWithProfile;
            return userWithProfile;

        } catch (error) {
            console.error('❌ Get current user error:', error);
            throw error;
        }
    }

    /**
     * Get user profile from profiles table
     */
    async getUserProfile() {
        if (!this.currentUser) {
            throw new Error('Пользователь не авторизован');
        }

        try {
            const { data, error } = await this.client
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error('Профиль пользователя не найден');
                }
                throw new Error(`Ошибка загрузки профиля: ${error.message}`);
            }

            return data;

        } catch (error) {
            console.error('❌ Get user profile error:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(updates) {
        if (!this.currentUser) {
            throw new Error('Пользователь не авторизован');
        }

        try {
            const { data, error } = await this.client
                .from('profiles')
                .update(updates)
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) {
                throw new Error(`Ошибка обновления профиля: ${error.message}`);
            }

            this.emit('userUpdate', { profile: data });
            console.log('✅ Profile updated successfully');
            return data;

        } catch (error) {
            console.error('❌ Update profile error:', error);
            throw error;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.currentUser;
    }

    /**
     * Get client initialization status
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Get client status
     */
    getStatus() {
        return {
            isInitialized: this.initialized,
            isAuthenticated: this.isAuthenticated(),
            currentUser: this.currentUser,
            hasClient: !!this.client
        };
    }

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
                    console.error(`Error in auth event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Save Telegram bot connection to user profile
     */
    async saveTelegramConnection(botToken, botName, chatId) {
        if (!this.currentUser) {
            throw new Error('Пользователь не авторизован');
        }

        try {
            const { data, error } = await this.client
                .from('profiles')
                .update({
                    telegram_bot_token: botToken,
                    telegram_bot_name: botName,
                    telegram_chat_id: chatId,
                    telegram_connected_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) {
                console.error('❌ Telegram connection save error:', error);
                throw new Error(`Ошибка сохранения подключения Telegram: ${error.message}`);
            }

            console.log('✅ Telegram connection saved successfully');
            return data;

        } catch (error) {
            console.error('❌ Failed to save Telegram connection:', error);
            throw error;
        }
    }

    /**
     * Get Telegram bot connection from user profile
     */
    async getTelegramConnection() {
        if (!this.currentUser) {
            throw new Error('Пользователь не авторизован');
        }

        try {
            const { data, error } = await this.client
                .from('profiles')
                .select('telegram_bot_token, telegram_bot_name, telegram_chat_id, telegram_connected_at')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // No profile found
                }
                throw new Error(`Ошибка загрузки Telegram подключения: ${error.message}`);
            }

            // Return connection data if token exists
            if (data.telegram_bot_token) {
                return {
                    token: data.telegram_bot_token,
                    botName: data.telegram_bot_name,
                    chatId: data.telegram_chat_id,
                    connectedAt: data.telegram_connected_at
                };
            }

            return null;

        } catch (error) {
            console.error('❌ Get Telegram connection error:', error);
            throw error;
        }
    }

    /**
     * Remove Telegram bot connection from user profile
     */
    async removeTelegramConnection() {
        if (!this.currentUser) {
            throw new Error('Пользователь не авторизован');
        }

        try {
            const { data, error } = await this.client
                .from('profiles')
                .update({
                    telegram_bot_token: null,
                    telegram_bot_name: null,
                    telegram_chat_id: null,
                    telegram_connected_at: null
                })
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) {
                console.error('❌ Telegram connection remove error:', error);
                throw new Error(`Ошибка удаления подключения Telegram: ${error.message}`);
            }

            console.log('✅ Telegram connection removed successfully');
            return data;

        } catch (error) {
            console.error('❌ Failed to remove Telegram connection:', error);
            throw error;
        }
    }

    // ==========================================
    // EMAIL CAMPAIGNS METHODS
    // ==========================================

    /**
     * Save email campaign draft to database
     * @param {Object} campaignData - Campaign data object
     * @param {string} campaignData.subject - Email subject
     * @param {string} campaignData.body - Email body
     * @param {Array} campaignData.attachments - File attachments
     * @returns {Promise<Object>} Saved campaign data
     */
    async saveEmailCampaign(campaignData) {
        try {
            console.log('💾 Saving email campaign...', campaignData);

            if (!this.client) {
                throw new Error('Auth client not initialized');
            }

            // Validate required fields
            if (!campaignData.subject || !campaignData.body) {
                throw new Error('Subject and body are required fields');
            }

            // Get current user
            const { data: { user }, error: userError } = await this.client.auth.getUser();
            if (userError) {
                throw new Error(`Authentication error: ${userError.message}`);
            }
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Prepare campaign data
            const campaignRecord = {
                user_id: user.id,
                subject: campaignData.subject.trim(),
                body: campaignData.body.trim(),
                attachments: campaignData.attachments || [],
                status: 'draft',
                campaign_type: 'manual',
                recipients_source: 'database'
            };

            // Insert into email_campaigns table
            const { data, error } = await this.client
                .from('email_campaigns')
                .insert([campaignRecord])
                .select()
                .single();

            if (error) {
                console.error('❌ Email campaign save error:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            console.log('✅ Email campaign saved successfully:', data);
            return data;

        } catch (error) {
            console.error('❌ Failed to save email campaign:', error);
            throw error;
        }
    }

    /**
     * Get user's email campaigns
     * @param {string} status - Filter by status (optional)
     * @param {number} limit - Limit number of results (default: 20)
     * @returns {Promise<Array>} List of campaigns
     */
    async getEmailCampaigns(status = null, limit = 20) {
        try {
            console.log('📥 Loading email campaigns...');

            if (!this.client) {
                throw new Error('Auth client not initialized');
            }

            // Build query
            let query = this.client
                .from('email_campaigns')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            // Add status filter if provided
            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ Email campaigns fetch error:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            console.log(`✅ Loaded ${data?.length || 0} email campaigns`);
            return data || [];

        } catch (error) {
            console.error('❌ Failed to load email campaigns:', error);
            throw error;
        }
    }

    /**
     * Update email campaign
     * @param {string} campaignId - Campaign ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated campaign data
     */
    async updateEmailCampaign(campaignId, updateData) {
        try {
            console.log('📝 Updating email campaign...', campaignId, updateData);

            if (!this.client) {
                throw new Error('Auth client not initialized');
            }

            if (!campaignId) {
                throw new Error('Campaign ID is required');
            }

            // Update campaign
            const { data, error } = await this.client
                .from('email_campaigns')
                .update(updateData)
                .eq('id', campaignId)
                .select()
                .single();

            if (error) {
                console.error('❌ Email campaign update error:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            console.log('✅ Email campaign updated successfully:', data);
            return data;

        } catch (error) {
            console.error('❌ Failed to update email campaign:', error);
            throw error;
        }
    }

    /**
     * Delete email campaign
     * @param {string} campaignId - Campaign ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteEmailCampaign(campaignId) {
        try {
            console.log('🗑️ Deleting email campaign...', campaignId);

            if (!this.client) {
                throw new Error('Auth client not initialized');
            }

            if (!campaignId) {
                throw new Error('Campaign ID is required');
            }

            const { error } = await this.client
                .from('email_campaigns')
                .delete()
                .eq('id', campaignId);

            if (error) {
                console.error('❌ Email campaign delete error:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            console.log('✅ Email campaign deleted successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to delete email campaign:', error);
            throw error;
        }
    }

    /**
     * Get email campaign by ID
     * @param {string} campaignId - Campaign ID
     * @returns {Promise<Object>} Campaign data
     */
    async getEmailCampaign(campaignId) {
        try {
            console.log('🔍 Loading email campaign...', campaignId);

            if (!this.client) {
                throw new Error('Auth client not initialized');
            }

            if (!campaignId) {
                throw new Error('Campaign ID is required');
            }

            const { data, error } = await this.client
                .from('email_campaigns')
                .select('*')
                .eq('id', campaignId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error('Campaign not found');
                }
                console.error('❌ Email campaign fetch error:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            console.log('✅ Email campaign loaded:', data);
            return data;

        } catch (error) {
            console.error('❌ Failed to load email campaign:', error);
            throw error;
        }
    }
}

// Export class globally for use by main platform
window.AuthClient = SupabaseAuthClient;

// Global instance
window.gymnastikaAuth = new SupabaseAuthClient();

// Global auth client loaded
console.log('🔐 GYMNASTIKA Auth Client ready');