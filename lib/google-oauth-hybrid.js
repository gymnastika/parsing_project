/**
 * Google OAuth Direct Client (NO Supabase Auth)
 * GYMNASTIKA Management Platform
 *
 * Direct Google OAuth 2.0 implementation for Gmail API access
 * Tokens are stored in profiles table, NOT creating new auth users
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
     * Initialize the OAuth client
     */
    async initialize() {
        try {
            console.log('🔑 Initializing Google OAuth Direct client...');

            // Get Supabase client from global initialization
            if (window.supabaseClient) {
                this.supabaseClient = window.supabaseClient;
            } else if (window.gymnastikaDB?.client) {
                this.supabaseClient = window.gymnastikaDB.client;
            } else {
                throw new Error('Supabase client not found. Initialize SupabaseDatabaseClient first.');
            }

            // Set callback URL for OAuth flow
            this.callbackUrl = `${window.location.origin}/oauth/google-callback.html`;

            this.isInitialized = true;
            console.log('✅ Google OAuth Direct client initialized successfully');

            return true;
        } catch (error) {
            const errorMessage = error.message || 'Unknown initialization error';
            console.error('❌ Failed to initialize Google OAuth Direct client:', {
                error: errorMessage,
                stack: error.stack,
                name: error.name
            });
            throw new Error(`Google OAuth Direct initialization failed: ${errorMessage}`);
        }
    }

    /**
     * Set current user for the OAuth client
     */
    setUser(user) {
        this.currentUser = user;
        console.log(`👤 Google OAuth Direct user set: ${user?.username || user?.id}`);
    }

    /**
     * Start Direct Google OAuth flow (NO Supabase Auth)
     */
    async authenticate() {
        if (!this.isInitialized) {
            throw new Error('Google OAuth Direct client not initialized');
        }

        if (!this.currentUser) {
            throw new Error('No current user set. Call setUser() first.');
        }

        try {
            console.log('🚀 Starting Direct Google OAuth flow...');

            // Store current user context for post-OAuth processing
            const authState = {
                userId: this.currentUser.id,
                username: this.currentUser.username,
                timestamp: Date.now(),
                returnUrl: window.location.href
            };

            localStorage.setItem('google_oauth_state', JSON.stringify(authState));

            // Build Direct Google OAuth URL (NO Supabase)
            const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
            const params = new URLSearchParams({
                client_id: window.ENV.GOOGLE_CLIENT_ID,
                redirect_uri: this.callbackUrl,
                response_type: 'code',
                scope: this.scopes,
                access_type: 'offline',     // Get refresh token
                prompt: 'consent',          // Force consent for refresh token
                include_granted_scopes: 'true',
                state: JSON.stringify({ userId: this.currentUser.id })
            });

            const authUrl = `${oauth2Endpoint}?${params}`;
            console.log('🔗 Redirecting to Google OAuth...');

            // Redirect to Google OAuth
            window.location.href = authUrl;

            return { success: true, redirected: true };

        } catch (error) {
            const errorMessage = error.message || 'Unknown OAuth error';
            console.error('❌ Error starting Direct Google OAuth flow:', {
                error: errorMessage,
                errorCode: error.code,
                stack: error.stack
            });
            localStorage.removeItem('google_oauth_state');
            this.emit('error', error);

            throw new Error(`Ошибка Google OAuth: ${errorMessage}`);
        }
    }

    /**
     * Handle OAuth callback and exchange code for tokens
     * This method processes the callback after redirect
     */
    async handleCallback(code) {
        try {
            console.log('🔄 Handling Google OAuth callback...');

            if (!code) {
                throw new Error('No authorization code received');
            }

            // Get stored auth state
            const storedState = localStorage.getItem('google_oauth_state');
            if (!storedState) {
                throw new Error('No stored auth state found');
            }

            const authState = JSON.parse(storedState);
            localStorage.removeItem('google_oauth_state');

            // Exchange code for tokens via backend
            console.log('🔄 Exchanging code for tokens via backend...');
            const response = await fetch('/api/google/oauth/exchange', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    redirect_uri: this.callbackUrl
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to exchange code for tokens');
            }

            const data = await response.json();
            console.log('✅ Successfully exchanged code for tokens');

            // Prepare token data for storage
            const googleTokens = {
                access_token: data.tokens.access_token,
                refresh_token: data.tokens.refresh_token,
                expires_at: data.tokens.expires_at,
                scope: data.tokens.scope,
                token_type: data.tokens.token_type,
                connected_email: data.userInfo.email,
                profile_name: data.userInfo.name,
                profile_picture: data.userInfo.picture
            };

            console.log('📊 Got Google tokens and user info:', {
                hasAccessToken: !!googleTokens.access_token,
                hasRefreshToken: !!googleTokens.refresh_token,
                email: googleTokens.connected_email,
                name: googleTokens.profile_name,
                expiresAt: googleTokens.expires_at
            });

            // Store the integration for the original user
            await this.storeIntegration(authState.userId, googleTokens);

            console.log('✅ Google OAuth Direct integration completed successfully');
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
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_at: tokenData.expires_at,
                    scope: tokenData.scope,
                    token_type: tokenData.token_type || 'Bearer',
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
     * Check if user has active Google integration
     */
    async checkIntegration(userId) {
        try {
            console.log(`🔍 Checking Google integration for user ${userId}`);

            const { data, error } = await this.supabaseClient
                .from('google_integrations')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No integration found
                    console.log('ℹ️ No Google integration found for user');
                    return null;
                }
                throw error;
            }

            console.log('✅ Found Google integration:', {
                email: data.connected_email,
                expiresAt: data.expires_at
            });

            return data;

        } catch (error) {
            console.error('❌ Error checking Google integration:', error);
            throw error;
        }
    }

    /**
     * Disconnect Google account
     */
    async disconnect(userId) {
        try {
            console.log(`🔌 Disconnecting Google integration for user ${userId}`);

            const { error } = await this.supabaseClient
                .from('google_integrations')
                .delete()
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            console.log('✅ Google integration disconnected successfully');
            this.emit('disconnected');

            return { success: true };

        } catch (error) {
            console.error('❌ Error disconnecting Google integration:', error);
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(userId) {
        try {
            console.log(`🔄 Refreshing access token for user ${userId}`);

            // Get current integration
            const integration = await this.checkIntegration(userId);
            if (!integration || !integration.refresh_token) {
                throw new Error('No refresh token available');
            }

            // Refresh token via backend
            const response = await fetch('/api/google/oauth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh_token: integration.refresh_token
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to refresh token');
            }

            const data = await response.json();
            console.log('✅ Successfully refreshed access token');

            // Update stored tokens
            const { error } = await this.supabaseClient
                .from('google_integrations')
                .update({
                    access_token: data.tokens.access_token,
                    expires_at: data.tokens.expires_at,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            console.log('✅ Access token refreshed and stored');
            this.emit('token_refreshed', {
                expiresAt: data.tokens.expires_at
            });

            return data.tokens;

        } catch (error) {
            console.error('❌ Error refreshing access token:', error);
            throw error;
        }
    }

    /**
     * Get valid access token (refresh if expired)
     */
    async getValidAccessToken(userId) {
        try {
            const integration = await this.checkIntegration(userId);
            if (!integration) {
                throw new Error('No Google integration found');
            }

            // Check if token is expired or will expire in next 5 minutes
            const expiresAt = new Date(integration.expires_at);
            const now = new Date();
            const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

            if (expiresAt <= fiveMinutesFromNow) {
                console.log('⏰ Access token expired or expiring soon, refreshing...');
                const refreshed = await this.refreshAccessToken(userId);
                return refreshed.access_token;
            }

            console.log('✅ Access token is still valid');
            return integration.access_token;

        } catch (error) {
            console.error('❌ Error getting valid access token:', error);
            throw error;
        }
    }

    /**
     * Event emitter
     */
    on(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }
}

// Make class available globally
if (typeof window !== 'undefined') {
    window.GoogleOAuthHybrid = GoogleOAuthHybrid;
}
