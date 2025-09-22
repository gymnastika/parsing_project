/**
 * Supabase Configuration and Client Setup
 * GYMNASTIKA Management Platform Database Integration
 */

// Environment Configuration
const SUPABASE_CONFIG = {
    // Default configuration - replace with your actual Supabase project details
    url: 'https://your-project-ref.supabase.co',
    anonKey: 'your-anon-key-here',
    
    // Client options
    options: {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true, // Critical for OAuth callbacks (Google, etc)
            storage: window.localStorage,
            debug: false, // Enable for OAuth debugging if needed
            flowType: 'implicit', // Implicit flow for SPA applications
            storageKey: 'sb-auth-token', // Consistent storage key
        },
        
        db: {
            schema: 'public'
        },
        
        global: {
            headers: {
                'X-App-Name': 'GYMNASTIKA-Platform'
            }
        },
        
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
};

// Load environment variables if available
function loadEnvironmentConfig() {
    // Priority 1: Load from window.ENV (env.js file)
    if (window.ENV && window.ENV.isConfigured()) {
        SUPABASE_CONFIG.url = window.ENV.SUPABASE_URL;
        SUPABASE_CONFIG.anonKey = window.ENV.SUPABASE_ANON_KEY;
        if (window.ENV.SUPABASE_SERVICE_ROLE_KEY && window.ENV.SUPABASE_SERVICE_ROLE_KEY !== 'your-service-role-key') {
            SUPABASE_CONFIG.serviceKey = window.ENV.SUPABASE_SERVICE_ROLE_KEY;
        }
        if (window.ENV.SUPABASE_ACCESS_TOKEN) {
            SUPABASE_CONFIG.accessToken = window.ENV.SUPABASE_ACCESS_TOKEN;
        }
        if (window.ENV.DB_SCHEMA) {
            SUPABASE_CONFIG.options.db.schema = window.ENV.DB_SCHEMA;
        }
        console.log('✅ Loaded configuration from env.js');
        return;
    }
    
    // Priority 2: Try localStorage (for client-side configuration)
    try {
        const storedConfig = localStorage.getItem('supabase_config');
        if (storedConfig) {
            const config = JSON.parse(storedConfig);
            if (config.url && config.url !== 'https://your-project-ref.supabase.co') {
                SUPABASE_CONFIG.url = config.url;
                SUPABASE_CONFIG.anonKey = config.anonKey;
                console.log('✅ Loaded configuration from localStorage');
                return;
            }
        }
    } catch (error) {
        console.warn('Could not load stored Supabase config:', error);
    }
    
    // Priority 3: Process environment (Node.js/build tools)
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.SUPABASE_URL) {
            SUPABASE_CONFIG.url = process.env.SUPABASE_URL;
            SUPABASE_CONFIG.anonKey = process.env.SUPABASE_ANON_KEY;
            console.log('✅ Loaded configuration from process.env');
            return;
        }
    }
    
    console.log('⚠️ Using default configuration - needs setup');
}

// Parse .env file content
function parseEnvFile(content) {
    const env = {};
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            }
        }
    });
    return env;
}

// Validate configuration
function validateConfig() {
    const errors = [];
    
    if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url === 'https://your-project-ref.supabase.co') {
        errors.push('Supabase URL not configured');
    }
    
    if (!SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.anonKey === 'your-anon-key-here') {
        errors.push('Supabase Anonymous Key not configured');
    }
    
    if (!SUPABASE_CONFIG.url.startsWith('https://')) {
        errors.push('Supabase URL must use HTTPS');
    }
    
    return errors;
}

// Configuration helper functions
const SupabaseConfigHelper = {
    // Set configuration programmatically
    setConfig(url, anonKey, options = {}) {
        SUPABASE_CONFIG.url = url;
        SUPABASE_CONFIG.anonKey = anonKey;
        SUPABASE_CONFIG.options = { ...SUPABASE_CONFIG.options, ...options };
        
        // Store in localStorage for persistence
        try {
            localStorage.setItem('supabase_config', JSON.stringify({
                url,
                anonKey,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Could not store Supabase config:', error);
        }
    },
    
    // Get current configuration
    getConfig() {
        return { ...SUPABASE_CONFIG };
    },
    
    // Check if configuration is valid
    isConfigured() {
        const errors = validateConfig();
        return errors.length === 0;
    },
    
    // Get validation errors
    getConfigErrors() {
        return validateConfig();
    },
    
    // Clear stored configuration
    clearConfig() {
        try {
            localStorage.removeItem('supabase_config');
        } catch (error) {
            console.warn('Could not clear stored config:', error);
        }
    }
};

// Initialize configuration
function initializeSupabaseConfig() {
    loadEnvironmentConfig();
    
    // Export configuration
    window.SupabaseConfig = SUPABASE_CONFIG;
    window.SupabaseConfigHelper = SupabaseConfigHelper;

    // Console information for developers
    if (console && console.info) {
        const errors = validateConfig();
        if (errors.length > 0) {
            console.warn('🔧 Supabase Configuration Issues:', errors);
            console.info('💡 Use SupabaseConfigHelper.setConfig(url, anonKey) to configure');
            console.info('💡 Or edit config/env.js with your credentials');
        } else {
            console.info('✅ Supabase configuration loaded successfully');
        }
    }
}

// Initialize immediately if env.js is loaded, otherwise wait
if (window.ENV) {
    initializeSupabaseConfig();
} else {
    document.addEventListener('DOMContentLoaded', initializeSupabaseConfig);
}