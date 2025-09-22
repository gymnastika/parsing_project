/**
 * Google OAuth Hybrid Client
 * GYMNASTIKA Management Platform
 * 
 * Hybrid approach combining Supabase Auth Google Provider with in-app account linking
 * Based on redirect-based OAuth flow for better reliability
 */

class GoogleOAuthHybrid {
    constructor() {
        this.supabaseClient = null;
        this.currentUser = null;
        this.isInitialized = false;
        this.callbackUrl = null;
        
        // Scopes for Gmail API access and Google Drive
        this.scopes = [
            'email',
            'profile', 
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly'
        ].join(' ');
        
        // Event listeners
        this.eventListeners = {
            'connected': [],
            'disconnected': [],
            'token_refreshed': [],
            'error': []
        };
    }

    /**
     * Initialize the hybrid OAuth client
     */
    async initialize() {
        try {
            console.log('🔑 Initializing Google OAuth Hybrid client...');
            
            // Get Supabase client from global initialization
            if (window.supabaseClient) {
                this.supabaseClient = window.supabaseClient;
            } else if (window.gymnastikaDB?.client) {
                this.supabaseClient = window.gymnastikaDB.client;
            } else {
                throw new Error('Supabase client not found. Initialize SupabaseDatabaseClient first.');
            }
            
            // Set callback URL for in-app OAuth flow
            this.callbackUrl = `${window.location.origin}/oauth/google-callback.html`;
            
            this.isInitialized = true;
            console.log('✅ Google OAuth Hybrid client initialized successfully');
            
            return true;
        } catch (error) {
            const errorMessage = error.message || 'Unknown initialization error';
            console.error('❌ Failed to initialize Google OAuth Hybrid client:', {
                error: errorMessage,
                stack: error.stack,
                name: error.name
            });
            throw new Error(`Google OAuth Hybrid initialization failed: ${errorMessage}`);
        }
    }
    
    /**
     * Set current user for the OAuth client
     */
    setUser(user) {
        this.currentUser = user;
        console.log(`👤 Google OAuth Hybrid user set: ${user?.username || user?.id}`);
    }
    
    /**
     * Start Google OAuth flow using Supabase Auth Provider
     */
    async authenticate() {
        if (!this.isInitialized) {
            throw new Error('Google OAuth Hybrid client not initialized');
        }
        
        if (!this.currentUser) {
            throw new Error('No current user set. Call setUser() first.');
        }
        
        try {
            console.log('🚀 Starting Google OAuth hybrid flow...');
            
            // Store current user context for post-OAuth processing
            const authState = {
                userId: this.currentUser.id,
                username: this.currentUser.username,
                timestamp: Date.now(),
                returnUrl: window.location.href
            };
            
            localStorage.setItem('google_oauth_state', JSON.stringify(authState));
            
            // Use Supabase Auth Google Provider with custom redirect
            const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: this.scopes,
                    redirectTo: this.callbackUrl,
                    queryParams: {
                        access_type: 'offline',         // Get refresh token
                        prompt: 'consent',              // Force consent screen for new permissions
                        include_granted_scopes: 'true'  // Include already granted scopes
                    }
                }
            });
            
            if (error) {
                throw error;
            }
            
            console.log('🔗 OAuth redirect initiated...');
            return { success: true, redirected: true };
            
        } catch (error) {
            const errorMessage = error.message || 'Unknown OAuth error';
            console.error('❌ Error starting Google OAuth hybrid flow:', {
                error: errorMessage,
                errorCode: error.code,
                stack: error.stack
            });
            localStorage.removeItem('google_oauth_state');
            this.emit('error', error);
            
            // Provide user-friendly error messages
            if (error.message?.includes('provider is not enabled')) {
                throw new Error('Google OAuth не настроен в Supabase. Обратитесь к администратору.');
            } else if (error.message?.includes('network')) {
                throw new Error('Ошибка сети. Проверьте подключение к интернету.');
            } else {
                throw new Error(`Ошибка Google OAuth: ${errorMessage}`);
            }
        }
    }
    
    /**
     * Handle OAuth callback and extract tokens
     * This method processes the callback after redirect
     */
    async handleCallback() {
        try {
            console.log('🔄 Handling Google OAuth callback...');
            
            // Get session from Supabase (should contain Google tokens)
            const { data: { session }, error } = await this.supabaseClient.auth.getSession();
            
            if (error) {
                throw new Error(`Failed to get session: ${error.message}`);
            }
            
            if (!session || !session.provider_token) {
                throw new Error('No valid Google session found');
            }
            
            // Get stored auth state
            const storedState = localStorage.getItem('google_oauth_state');
            if (!storedState) {
                throw new Error('No stored auth state found');
            }
            
            const authState = JSON.parse(storedState);
            localStorage.removeItem('google_oauth_state');
            
            // Extract Google tokens from Supabase session
            const googleTokens = {
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token,
                expires_at: new Date(session.expires_at * 1000).toISOString(),
                scope: this.scopes,
                connected_email: session.user.email,
                profile_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
                profile_picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture
            };
            
            console.log('📊 Extracted Google tokens:', {
                hasAccessToken: !!googleTokens.access_token,
                hasRefreshToken: !!googleTokens.refresh_token,
                email: googleTokens.connected_email,
                expiresAt: googleTokens.expires_at
            });
            
            // Store the integration for the original user
            await this.storeIntegration(authState.userId, googleTokens);
            
            console.log('✅ Google OAuth hybrid integration completed successfully');
            this.emit('connected', {
                email: googleTokens.connected_email,
                name: googleTokens.profile_name,
                picture: googleTokens.profile_picture
            });
            
            return {
                success: true,
                tokens: googleTokens,
                returnUrl: authState.returnUrl
            };
            
        } catch (error) {
            console.error('❌ Error handling Google OAuth callback:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Store Google integration in database
     */
    async storeIntegration(userId, tokenData, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            console.log('💾 storeIntegration called with:', {
                userId,
                userIdType: typeof userId,
                hasTokenData: !!tokenData,
                tokenDataKeys: tokenData ? Object.keys(tokenData) : [],
                retryAttempt: retryCount + 1
            });
            
            if (!userId) {
                throw new Error('User ID is required for storing integration');
            }
            
            if (!tokenData) {
                throw new Error('Token data is required for storing integration');
            }
            
            console.log(`💾 Storing Google integration for user ${userId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
            
            const { data, error } = await this.supabaseClient
                .from('google_integrations')
                .upsert({
                    user_id: userId,
                    email: tokenData.connected_email,
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_at: tokenData.expires_at,
                    scope: tokenData.scope,
                    token_type: 'Bearer',
                    connected_email: tokenData.connected_email,
                    profile_name: tokenData.profile_name,
                    profile_picture: tokenData.profile_picture,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                })
                .select()
                .single();
            
            if (error) {
                throw error;
            }
            
            console.log('✅ Google integration stored successfully');
            return data;
            
        } catch (error) {
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.log(`⏳ Retrying storage in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.storeIntegration(userId, tokenData, retryCount + 1);
            }
            
            console.error('❌ Failed to store Google integration:', error);
            throw error;
        }
    }
    
    /**
     * Get current Google integration for user
     */
    async getIntegration(userId) {
        try {
            console.log('🔍 getIntegration called with userId:', {
                userId,
                type: typeof userId,
                isNull: userId === null,
                isUndefined: userId === undefined
            });
            
            if (!userId) {
                console.error('❌ getIntegration: userId is null or undefined');
                return null;
            }
            
            const { data, error } = await this.supabaseClient
                .from('google_integrations')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            console.log('📊 getIntegration result:', {
                hasData: !!data,
                hasError: !!error,
                errorCode: error?.code,
                errorMessage: error?.message
            });
            
            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('ℹ️ No Google integration found for user:', userId);
                    return null; // No integration found
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            const errorMessage = error.message || 'Unknown database error';
            console.error('❌ Error getting Google integration:', {
                error: errorMessage,
                errorCode: error.code,
                details: error.details,
                hint: error.hint
            });
            
            // Log specific database errors
            if (error.code === '22P02') {
                console.error('💥 UUID format error - user_id is not a valid UUID:', userId);
            } else if (error.code === '42P01') {
                console.error('💥 Table does not exist - google_integrations table missing');
            }
            
            return null;
        }
    }
    
    /**
     * Refresh Google access token using refresh token
     */
    async refreshAccessToken(userId) {
        try {
            console.log('🔄 refreshAccessToken called with userId:', {
                userId,
                type: typeof userId,
                isNull: userId === null,
                isUndefined: userId === undefined
            });
            
            if (!userId) {
                throw new Error('User ID is required for token refresh');
            }
            
            const integration = await this.getIntegration(userId);
            if (!integration || !integration.refresh_token) {
                throw new Error('No refresh token available');
            }
            
            console.log('🔄 Refreshing Google access token...');
            
            // Use Supabase client to refresh the token
            // Note: This is a simplified approach - in production you might want
            // to handle token refresh through your backend for security
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: integration.refresh_token,
                    client_id: window.ENV?.GOOGLE_CLIENT_ID
                })
            });
            
            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }
            
            const tokenData = await response.json();
            
            // Update stored integration
            const updatedTokens = {
                access_token: tokenData.access_token,
                expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
                refresh_token: tokenData.refresh_token || integration.refresh_token
            };
            
            await this.supabaseClient
                .from('google_integrations')
                .update(updatedTokens)
                .eq('user_id', userId);
            
            console.log('✅ Google access token refreshed successfully');
            this.emit('token_refreshed', updatedTokens);
            
            return updatedTokens;
            
        } catch (error) {
            console.error('❌ Error refreshing Google access token:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Disconnect Google account
     */
    async disconnect(userId) {
        try {
            console.log('🔌 disconnect called with userId:', {
                userId,
                type: typeof userId,
                isNull: userId === null,
                isUndefined: userId === undefined
            });
            
            if (!userId) {
                throw new Error('User ID is required for disconnect');
            }
            
            const { error } = await this.supabaseClient
                .from('google_integrations')
                .delete()
                .eq('user_id', userId);
            
            if (error) {
                throw error;
            }
            
            console.log('✅ Google account disconnected successfully');
            this.emit('disconnected');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error disconnecting Google account:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Check if user has active Google integration
     */
    async isConnected(userId) {
        try {
            console.log('🔗 isConnected called with userId:', {
                userId,
                type: typeof userId,
                isNull: userId === null,
                isUndefined: userId === undefined
            });
            
            const integration = await this.getIntegration(userId);
            if (!integration) {
                console.log('❌ isConnected: No integration found for user:', userId);
                return false;
            }
            
            // Check if token is still valid (not expired)
            const expiresAt = new Date(integration.expires_at);
            const now = new Date();
            const isExpired = expiresAt <= now;
            
            if (isExpired && integration.refresh_token) {
                // Try to refresh the token
                try {
                    await this.refreshAccessToken(userId);
                    return true;
                } catch (error) {
                    console.warn('Could not refresh expired token:', error);
                    return false;
                }
            }
            
            return !isExpired;
            
        } catch (error) {
            console.error('❌ Error checking Google connection status:', error);
            return false;
        }
    }
    
    /**
     * Event emitter functionality
     */
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} event listener:`, error);
                }
            });
        }
    }
    
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
}

// Export for use in other modules
window.GoogleOAuthHybrid = GoogleOAuthHybrid;
console.log('📦 Google OAuth Hybrid client loaded');