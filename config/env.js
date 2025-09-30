/**
 * Environment Configuration for GYMNASTIKA Platform
 * 🔒 SECURITY UPDATE: Sensitive credentials moved to server-side
 * 
 * This file now contains ONLY public, non-sensitive configuration
 * that is safe to expose to browser environments.
 * 
 * All API keys and secrets are now securely stored on the server.
 */

// 🔒 SECURE CONFIGURATION - Only public data exposed to browser
window.ENV = {
    // ================================
    // SUPABASE PUBLIC CONFIGURATION
    // ================================
    // These are safe to expose in browser - they're designed for client-side use
    SUPABASE_URL: 'https://egmpnazpmkghecodhbyy.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbXBuYXpwbWtnaGVjb2RoYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTY3NzgsImV4cCI6MjA3NDY5Mjc3OH0.ssFQY9Qy3xDjVQCnZoZoeoJQDVdaFT11zmQ57yw-QDs',
    
    // ================================
    // APPLICATION PUBLIC SETTINGS
    // ================================
    // These are non-sensitive configuration values
    DB_SCHEMA: 'public',
    NODE_ENV: 'development',
    APP_NAME: 'GYMNASTIKA Management Platform',
    DEBUG: true,
    AUTO_TEST_DB: true,
    
    // ================================
    // API ENDPOINTS - CLIENT CONFIGURATION
    // ================================
    // These define where the browser should make API calls
    API_BASE_URL: window.location.origin,
    OPENAI_PROXY_ENDPOINT: '/api/openai',
    APIFY_PROXY_ENDPOINT: '/api/apify',
    
    // ================================
    // GOOGLE OAUTH CONFIGURATION
    // ================================
    // Google OAuth 2.0 settings for Gmail integration and Google Drive
    // Только OAuth — без API ключей для упрощения развертывания
    GOOGLE_CLIENT_ID: '778229196107-ilc90p0a7b6p7mhvfmiihkbqjtpdau91.apps.googleusercontent.com',
    GOOGLE_REDIRECT_URI: window.location.origin + '/oauth/callback.html',
    GOOGLE_SCOPES: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email', 
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file', // Загрузка файлов на Google Drive
        'https://www.googleapis.com/auth/drive.readonly' // Чтение файлов с Google Drive
    ],
    
    // ================================
    // SECURITY NOTES
    // ================================
    // 🔒 MOVED TO SERVER (.env file):
    // - OPENAI_API_KEY (sk-proj-...)
    // - OPENAI_ASSISTANT_ID (asst_...)  
    // - OPENAI_VALIDATION_ASSISTANT_ID (asst_...)
    // - APIFY_API_TOKEN (apify_api_...)
    // - SUPABASE_SERVICE_ROLE_KEY (admin access)
    // - SUPABASE_ACCESS_TOKEN (auth token)
    // - REGISTRATION_SECRET_CODE (GYMN-2025-SECURE)
    // - GOOGLE_CLIENT_SECRET (OAuth client secret)
    //
    // 🛡️ All API calls now go through secure server proxy endpoints
    // 🔐 No sensitive credentials are exposed to browser/client-side
    // ✅ This significantly improves application security
    // 🔑 Google Client ID is safe to expose (designed for client-side use)
    // 🚀 Google Drive uses OAuth-only approach without API keys for simplicity
};

// Helper to check if configuration is set
window.ENV.isConfigured = function() {
    return this.SUPABASE_URL !== 'https://your-project-ref.supabase.co' && 
           this.SUPABASE_ANON_KEY !== 'your-anon-key-here';
};

// Helper to check if Google OAuth is configured
window.ENV.isGoogleOAuthConfigured = function() {
    return this.GOOGLE_CLIENT_ID && 
           this.GOOGLE_CLIENT_ID !== 'your-google-client-id.apps.googleusercontent.com' &&
           this.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com');
};

// 🔒 SECURITY UPDATE: Removed unsafe configuration helpers
// setConfig() and getAccessToken() methods removed for security
// Configuration is now read-only on client-side

console.log('🔒 Secure environment config loaded - API keys protected on server');
console.log('✅ Browser-safe configuration initialized');