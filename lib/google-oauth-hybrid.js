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
                    email: tokenData.connected_email,
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
     * Send email via Gmail API
     * @param {string} userId - User ID for token retrieval
     * @param {Object} emailData - Email configuration
     * @param {string[]} emailData.to - Array of recipient email addresses
     * @param {string} emailData.subject - Email subject
     * @param {string} emailData.body - Email body (plain text or HTML)
     * @param {Array} emailData.attachments - Array of attachment objects {filename, content, mimeType, size}
     * @param {string} emailData.fromName - Sender display name (optional)
     * @returns {Promise<Object>} Send result with message ID
     */
    async sendEmail(userId, emailData) {
        try {
            console.log('📧 Starting email send process...', {
                userId,
                recipientCount: emailData.to?.length || 0,
                hasSubject: !!emailData.subject,
                hasBody: !!emailData.body,
                attachmentCount: emailData.attachments?.length || 0
            });

            // Validate input
            if (!userId) {
                throw new Error('User ID is required');
            }

            if (!emailData.to || emailData.to.length === 0) {
                throw new Error('At least one recipient is required');
            }

            if (!emailData.subject) {
                throw new Error('Email subject is required');
            }

            if (!emailData.body) {
                throw new Error('Email body is required');
            }

            // Get valid access token
            const accessToken = await this.getValidAccessToken(userId);
            console.log('✅ Retrieved valid access token');

            // Get sender email from integration
            const integration = await this.getIntegration(userId);
            const fromEmail = integration.connected_email;
            const fromName = emailData.fromName || integration.profile_name || fromEmail;

            console.log('📨 Sending from:', { fromName, fromEmail });

            // Process attachments - separate small and large files
            const smallAttachments = [];
            const largeFileLinks = [];

            if (emailData.attachments && emailData.attachments.length > 0) {
                const LARGE_FILE_THRESHOLD = 25 * 1024 * 1024; // 25MB

                for (const attachment of emailData.attachments) {
                    if (attachment.size > LARGE_FILE_THRESHOLD) {
                        console.log(`📦 Large file detected: ${attachment.filename} (${(attachment.size / 1024 / 1024).toFixed(2)}MB)`);
                        largeFileLinks.push(attachment);
                    } else {
                        console.log(`📎 Small file: ${attachment.filename} (${(attachment.size / 1024).toFixed(2)}KB)`);
                        smallAttachments.push(attachment);
                    }
                }
            }

            // Upload large files to Google Drive and get shareable links
            if (largeFileLinks.length > 0) {
                console.log(`☁️ Uploading ${largeFileLinks.length} large files to Google Drive...`);

                // Use Google Drive client to upload files
                if (!window.googleDriveClient) {
                    throw new Error('Google Drive client not available');
                }

                for (let i = 0; i < largeFileLinks.length; i++) {
                    const file = largeFileLinks[i];
                    console.log(`📤 Uploading file ${i + 1}/${largeFileLinks.length}: ${file.filename}`);

                    try {
                        const driveFile = await window.googleDriveClient.uploadFile(
                            file.content,
                            file.filename,
                            file.mimeType
                        );

                        // Update attachment with Drive link instead of content
                        largeFileLinks[i] = {
                            filename: file.filename,
                            driveLink: driveFile.webViewLink,
                            size: file.size
                        };

                        console.log(`✅ Uploaded to Drive: ${driveFile.webViewLink}`);
                    } catch (uploadError) {
                        console.error(`❌ Failed to upload ${file.filename}:`, uploadError);
                        throw new Error(`Failed to upload large file "${file.filename}" to Google Drive: ${uploadError.message}`);
                    }
                }
            }

            // Build email body with Drive links for large files
            let finalBody = emailData.body;

            if (largeFileLinks.length > 0) {
                finalBody += '\n\n---\n\n📎 Прикрепленные файлы (большие файлы доступны через Google Drive):\n\n';
                largeFileLinks.forEach(file => {
                    finalBody += `• ${file.filename} (${(file.size / 1024 / 1024).toFixed(2)}MB): ${file.driveLink}\n`;
                });
            }

            // Create MIME message
            const mimeMessage = this.createMimeMessage({
                from: { name: fromName, email: fromEmail },
                to: emailData.to,
                subject: emailData.subject,
                body: finalBody,
                attachments: smallAttachments // Only small attachments inline
            });

            // Send via Gmail API through server proxy
            console.log('📮 Sending email via Gmail API proxy...');
            const proxyUrl = window.ENV?.PROXY_BASE_URL || 'https://parsingproject-production.up.railway.app';
            const response = await fetch(`${proxyUrl}/api/gmail/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    access_token: accessToken,
                    message: {
                        raw: mimeMessage
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gmail API error: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Email sent successfully:', {
                messageId: result.id,
                threadId: result.threadId,
                labelIds: result.labelIds
            });

            return {
                success: true,
                messageId: result.id,
                threadId: result.threadId,
                recipientCount: emailData.to.length,
                attachmentCount: smallAttachments.length,
                largeFileCount: largeFileLinks.length
            };

        } catch (error) {
            console.error('❌ Error sending email:', error);
            throw error;
        }
    }

    /**
     * Encode text in RFC 2047 format for email headers (Subject, From, etc.)
     * Handles Unicode characters like кириллица
     * @private
     */
    encodeRFC2047(text) {
        // Check if encoding is needed (contains non-ASCII characters)
        if (/^[\x00-\x7F]*$/.test(text)) {
            return text; // Pure ASCII, no encoding needed
        }

        // Encode to UTF-8 base64
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        // Convert to base64
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);

        // RFC 2047 format: =?charset?encoding?encoded-text?=
        return `=?UTF-8?B?${base64}?=`;
    }

    /**
     * Create RFC 2822 formatted MIME message
     * @private
     */
    createMimeMessage(config) {
        const { from, to, subject, body, attachments = [] } = config;

        // Boundary for multipart message
        const boundary = '----=_Part_' + Date.now() + Math.random().toString(36).substring(2);

        // Build headers
        let message = '';
        message += `From: ${from.name} <${from.email}>\r\n`;
        message += `To: ${to.join(', ')}\r\n`;

        // Encode subject in RFC 2047 format for non-ASCII characters (кириллица)
        const encodedSubject = this.encodeRFC2047(subject);
        message += `Subject: ${encodedSubject}\r\n`;

        message += 'MIME-Version: 1.0\r\n';

        if (attachments.length > 0) {
            message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

            // Body part
            message += `--${boundary}\r\n`;
            message += 'Content-Type: text/plain; charset="UTF-8"\r\n';
            message += 'Content-Transfer-Encoding: 7bit\r\n\r\n';
            message += body + '\r\n\r\n';

            // Attachment parts
            attachments.forEach(attachment => {
                message += `--${boundary}\r\n`;
                message += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
                message += 'Content-Transfer-Encoding: base64\r\n';
                message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;

                // Content should already be base64 encoded
                // Handle both Data URL format and plain base64
                let base64Content = '';
                if (attachment.content) {
                    if (typeof attachment.content === 'string') {
                        // Remove data URL prefix if present (data:image/png;base64,...)
                        base64Content = attachment.content.includes(',')
                            ? attachment.content.split(',')[1]
                            : attachment.content;
                    } else {
                        console.error('❌ Attachment content is not a string:', typeof attachment.content);
                        base64Content = '';
                    }
                } else {
                    console.error('❌ Attachment content is undefined:', attachment.filename);
                    base64Content = '';
                }

                message += base64Content + '\r\n\r\n';
            });

            message += `--${boundary}--`;
        } else {
            message += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
            message += body;
        }

        // Encode entire message in base64url format (Gmail API requirement)
        // Use TextEncoder to handle Unicode characters (кириллица, эмодзи)
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        // Convert Uint8Array to base64
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(data[i]);
        }

        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
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
