const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

// Import basic validation middleware (rate limiting removed for internal use)
const {
    validateApifyRun,
    validateWebScraperRun,
    validateOpenAIThread,
    validateQueryParams
} = require('./middleware/inputValidation');

// Import parsing tasks service and background worker
const ParsingTasksService = require('./lib/parsing-tasks-service');
const BackgroundWorker = require('./lib/background-worker');

// Import Railway Volume manager
const { ensureDirectories } = require('./lib/volume-manager');

const app = express();
const PORT = 3001;

// Initialize parsing tasks service
const tasksService = new ParsingTasksService();

// Initialize background worker
const backgroundWorker = new BackgroundWorker({
    pollInterval: 5000,        // Check every 5 seconds
    maxConcurrentTasks: 2,     // Process max 2 tasks simultaneously 
    maxRetries: 3              // Retry failed tasks up to 3 times
});

// Initialize Railway Volume storage
console.log('🔧 Initializing Railway Volume storage...');
ensureDirectories();

// Start background worker
console.log('🔄 Starting background worker...');
backgroundWorker.start();

// ================================
// BASIC CONFIGURATION FOR INTERNAL USE
// ================================

// Simplified CORS for internal company use (3-5 users)
const corsOptions = {
    origin: '*', // Allow all origins for internal use
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma'
    ]
};

// Security Headers with Helmet
if (process.env.ENABLE_SECURITY_HEADERS === 'true') {
    app.use(helmet({
        contentSecurityPolicy: process.env.CSP_ENABLED === 'true' ? {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
                fontSrc: ["'self'", "fonts.gstatic.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "https:", "*.supabase.co", "*.googleusercontent.com"],
                connectSrc: ["'self'", "*.supabase.co", "api.openai.com", "api.apify.com", "assets.codepen.io", "*.lottiefiles.com"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
            },
        } : false,
        hsts: process.env.HSTS_ENABLED === 'true' ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        } : false,
        frameguard: { action: 'deny' },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));
}

// Apply simplified CORS for internal company use
app.use(cors(corsOptions));
console.log('🏢 Internal CORS enabled - no restrictions for company use');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Note: Rate limiting removed for internal use (3-5 users max)

// Dynamic validation middleware for Apify actors
const getApifyValidation = (req, res, next) => {
    const { actorId, actorScope, actorName } = req.params;
    
    // Determine actual actor ID
    let fullActorId = actorId;
    if (!fullActorId && actorScope && actorName) {
        if (actorScope.includes('~')) {
            fullActorId = actorScope; // Already in correct format
        } else {
            fullActorId = `${actorScope}/${actorName}`;
        }
    }
    
    console.log(`🔍 Determining validation for actor: ${fullActorId}`);
    
    // Use Web Scraper validation for web-scraper actor
    if (fullActorId && fullActorId.includes('web-scraper')) {
        console.log('🕷️ Using Web Scraper validation');
        return validateWebScraperRun(req, res, next);
    } else {
        console.log('🗺️ Using Google Maps Scraper validation');
        return validateApifyRun(req, res, next);
    }
};

// Serve static files
app.use(express.static('.'));

// Proxy endpoint for Apify API - handle single actor IDs (like moJRLRc85AitArpNN)
app.post('/api/apify/:actorId/runs', getApifyValidation, async (req, res) => {
    try {
        const { actorId } = req.params;
        // Use server-side API token instead of requiring it from client
        const apiToken = process.env.APIFY_API_TOKEN;
        
        if (!apiToken) {
            return res.status(500).json({ error: 'Apify API token not configured on server' });
        }

        console.log(`🔍 Proxying Apify request for single actor: ${actorId}`);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const fullUrl = `https://api.apify.com/v2/acts/${actorId}/runs`;
        console.log(`🌐 Making request to: ${fullUrl}`);

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Apify API error:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ Apify run started:', data.data.id);
        res.json(data);

    } catch (error) {
        console.error('❌ Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Apify API - handle nested actor IDs (scope/name format)
app.post('/api/apify/:actorScope/:actorName/runs', getApifyValidation, async (req, res) => {
    try {
        const { actorScope, actorName } = req.params;
        // Use server-side API token instead of requiring it from client
        const apiToken = process.env.APIFY_API_TOKEN;
        
        if (!apiToken) {
            return res.status(500).json({ error: 'Apify API token not configured on server' });
        }

        // ✅ ИСПРАВЛЕНИЕ: Корректная обработка actor ID с организацией
        // Поддерживаем как apify~web-scraper, так и compass~crawler-google-places
        let actorId;
        if (actorScope.includes('~')) {
            // Уже правильный формат (например, apify~web-scraper)
            actorId = actorScope;
        } else {
            // Стандартный формат (например, compass/crawler-google-places)
            actorId = `${actorScope}~${actorName}`;
        }

        console.log(`🔍 Proxying Apify request for actor: ${actorId}`);
        console.log(`📝 Original params: scope=${actorScope}, name=${actorName}`);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const fullUrl = `https://api.apify.com/v2/acts/${actorId}/runs`;
        console.log(`🌐 Making request to: ${fullUrl}`);

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Apify API error:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ Apify run started:', data.data.id);
        res.json(data);

    } catch (error) {
        console.error('❌ Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Apify run status
app.get('/api/apify/runs/:runId', async (req, res) => {
    try {
        const { runId } = req.params;
        // Use server-side API token instead of requiring it from client
        const apiToken = process.env.APIFY_API_TOKEN;
        
        if (!apiToken) {
            return res.status(500).json({ error: 'Apify API token not configured on server' });
        }

        const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('❌ Run status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Apify dataset
app.get('/api/apify/datasets/:datasetId/items', async (req, res) => {
    try {
        const { datasetId } = req.params;
        // Use server-side API token instead of requiring it from client
        const apiToken = process.env.APIFY_API_TOKEN;
        
        if (!apiToken) {
            return res.status(500).json({ error: 'Apify API token not configured on server' });
        }

        const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('❌ Dataset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Apify user runs (for memory management)
app.get('/api/apify/runs', validateQueryParams, async (req, res) => {
    try {
        const { status, limit } = req.query;
        // Use server-side API token instead of requiring it from client
        const apiToken = process.env.APIFY_API_TOKEN;
        
        if (!apiToken) {
            return res.status(500).json({ error: 'Apify API token not configured on server' });
        }

        let url = `https://api.apify.com/v2/actor-runs?token=${apiToken}`;
        if (status) url += `&status=${status}`;
        if (limit) url += `&limit=${limit}`;

        const response = await fetch(url);

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error('❌ Apify runs error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Apify run abort
app.post('/api/apify/runs/:runId/abort', async (req, res) => {
    try {
        const { runId } = req.params;
        // Use server-side API token instead of requiring it from client
        const apiToken = process.env.APIFY_API_TOKEN;
        
        if (!apiToken) {
            return res.status(500).json({ error: 'Apify API token not configured on server' });
        }

        const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${apiToken}`, {
            method: 'POST'
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error('❌ Apify abort error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================
// TELEGRAM API PROXY ENDPOINTS  
// ================================

// Proxy endpoint for Telegram Bot API - Test Bot Connection
app.post('/api/telegram/bot/test', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Telegram bot token is required' });
        }
        
        console.log('📱 Proxying Telegram Bot API test request');
        
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }
        
        res.json(data);
        
    } catch (error) {
        console.error('❌ Telegram Bot API test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Telegram Bot API - Send Message 
app.post('/api/telegram/bot/sendMessage', async (req, res) => {
    try {
        const { token, chatId, message, parseMode } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Telegram bot token is required' });
        }
        
        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID is required' });
        }
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        console.log('📱 Proxying Telegram Bot API sendMessage request');
        
        const telegramApiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        const telegramData = {
            chat_id: chatId,
            text: message,
            parse_mode: parseMode || 'HTML'
        };
        
        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(telegramData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }
        
        res.json(data);
        
    } catch (error) {
        console.error('❌ Telegram Bot API sendMessage error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================
// GOOGLE OAUTH ENDPOINTS
// ================================

// Exchange OAuth authorization code for tokens
app.post('/api/google/oauth/exchange', async (req, res) => {
    try {
        console.log('🔄 Exchanging Google OAuth code for tokens...');

        const { code, redirect_uri } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error('❌ Google OAuth credentials not configured');
            return res.status(500).json({ error: 'Google OAuth not configured on server' });
        }

        // Exchange code for tokens with Google
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code: code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('❌ Google token exchange failed:', errorData);
            return res.status(tokenResponse.status).json({
                error: 'Failed to exchange code for tokens',
                details: errorData
            });
        }

        const tokens = await tokenResponse.json();
        console.log('✅ Successfully exchanged code for tokens');

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        if (!userInfoResponse.ok) {
            console.error('❌ Failed to get Google user info');
            return res.status(500).json({ error: 'Failed to get user information' });
        }

        const userInfo = await userInfoResponse.json();
        console.log('✅ Got Google user info:', { email: userInfo.email, name: userInfo.name });

        // Calculate expires_at timestamp
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        // Return tokens and user info
        res.json({
            success: true,
            tokens: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt,
                scope: tokens.scope,
                token_type: tokens.token_type || 'Bearer'
            },
            userInfo: {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                verified_email: userInfo.verified_email
            }
        });

    } catch (error) {
        console.error('❌ Error in Google OAuth exchange:', error);
        res.status(500).json({
            error: 'Internal server error during token exchange',
            message: error.message
        });
    }
});

// Refresh Google OAuth access token
app.post('/api/google/oauth/refresh', async (req, res) => {
    try {
        console.log('🔄 Refreshing Google OAuth access token...');

        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error('❌ Google OAuth credentials not configured');
            return res.status(500).json({ error: 'Google OAuth not configured on server' });
        }

        // Refresh the access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refresh_token,
                grant_type: 'refresh_token'
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('❌ Google token refresh failed:', errorData);
            return res.status(tokenResponse.status).json({
                error: 'Failed to refresh access token',
                details: errorData
            });
        }

        const tokens = await tokenResponse.json();
        console.log('✅ Successfully refreshed access token');

        // Calculate new expires_at timestamp
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        res.json({
            success: true,
            tokens: {
                access_token: tokens.access_token,
                expires_at: expiresAt,
                scope: tokens.scope,
                token_type: tokens.token_type || 'Bearer'
            }
        });

    } catch (error) {
        console.error('❌ Error in Google OAuth refresh:', error);
        res.status(500).json({
            error: 'Internal server error during token refresh',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'GYMNASTIKA Parsing API Server',
        timestamp: new Date().toISOString()
    });
});

// TEMPORARY: Environment variables check for Railway debugging
app.get('/api/debug/env', (req, res) => {
    res.json({
        status: 'env-check',
        environment: process.env.NODE_ENV || 'undefined',
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasApifyToken: !!process.env.APIFY_API_TOKEN,
        supabaseUrlValue: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 20)}...` : 'NOT_SET',
        timestamp: new Date().toISOString()
    });
});

// Apify user info endpoint (for connection testing)
app.get('/api/apify/users/me', async (req, res) => {
    try {
        // Use server-side API token instead of requiring it from client
        const apiToken = process.env.APIFY_API_TOKEN;
        
        if (!apiToken) {
            return res.status(500).json({ error: 'Apify API token not configured on server' });
        }

        const response = await fetch('https://api.apify.com/v2/users/me', {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error('❌ Apify user info error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================
// OPENAI API PROXY ENDPOINTS
// ================================

// Proxy endpoint for OpenAI Assistants API - Create Thread
app.post('/api/openai/threads', validateOpenAIThread, async (req, res) => {
    try {
        console.log('🤖 Proxying OpenAI Create Thread request');
        
        const response = await fetch('https://api.openai.com/v1/threads', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ OpenAI Create Thread error:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ OpenAI thread created:', data.id);
        res.json(data);

    } catch (error) {
        console.error('❌ OpenAI Thread proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Proxy endpoint for OpenAI Assistants API - Add Message to Thread
app.post('/api/openai/threads/:threadId/messages', validateOpenAIThread, async (req, res) => {
    try {
        const { threadId } = req.params;
        console.log('🤖 Proxying OpenAI Add Message request for thread:', threadId);
        
        const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ OpenAI Add Message error:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ OpenAI message added:', data.id);
        res.json(data);

    } catch (error) {
        console.error('❌ OpenAI Message proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Proxy endpoint for OpenAI Assistants API - Run Assistant
app.post('/api/openai/threads/:threadId/runs', validateOpenAIThread, async (req, res) => {
    try {
        const { threadId } = req.params;
        const { assistant_type } = req.body;
        
        // Map assistant type to actual assistant ID stored in environment
        let assistantId;
        if (assistant_type === 'validation') {
            assistantId = process.env.OPENAI_VALIDATION_ASSISTANT_ID;
            console.log('🤖 Using validation assistant:', assistantId);
        } else {
            // Default to query generation assistant
            assistantId = process.env.OPENAI_ASSISTANT_ID;
            console.log('🤖 Using query generation assistant:', assistantId);
        }

        if (!assistantId) {
            return res.status(400).json({ 
                error: `Assistant ID not configured for type: ${assistant_type}` 
            });
        }

        console.log('🤖 Proxying OpenAI Run Assistant request for thread:', threadId);
        
        const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                assistant_id: assistantId
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ OpenAI Run Assistant error:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ OpenAI assistant run started:', data.id);
        res.json(data);

    } catch (error) {
        console.error('❌ OpenAI Run proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Proxy endpoint for OpenAI Assistants API - Get Run Status
app.get('/api/openai/threads/:threadId/runs/:runId', validateOpenAIThread, async (req, res) => {
    try {
        const { threadId, runId } = req.params;
        console.log('🤖 Proxying OpenAI Get Run Status request:', { threadId, runId });
        
        const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ OpenAI Get Run Status error:', response.status, data);
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error('❌ OpenAI Run Status proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Proxy endpoint for OpenAI Assistants API - Get Thread Messages
app.get('/api/openai/threads/:threadId/messages', validateOpenAIThread, async (req, res) => {
    try {
        const { threadId } = req.params;
        console.log('🤖 Proxying OpenAI Get Messages request for thread:', threadId);
        
        const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ OpenAI Get Messages error:', response.status, data);
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error('❌ OpenAI Messages proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================
// PARSING TASKS API ENDPOINTS
// ================================

// Helper function to extract user ID from request
const getUserId = (req) => {
    // Try to get user ID from header (sent by frontend)
    const userId = req.headers['x-user-id'];
    if (!userId) {
        throw new Error('User ID required');
    }
    return userId;
};

// Create a new parsing task
app.post('/api/tasks', async (req, res) => {
    try {
        console.log('📝 Creating new parsing task:', req.body);
        
        const userId = getUserId(req);
        const taskData = req.body;

        // Validate required fields
        if (!taskData.taskName) {
            return res.status(400).json({ error: 'Task name is required' });
        }

        if (taskData.type === 'ai-search' && !taskData.searchQuery) {
            return res.status(400).json({ error: 'Search query is required for AI search tasks' });
        }

        if (taskData.type === 'url-parsing' && !taskData.websiteUrl) {
            return res.status(400).json({ error: 'Website URL is required for URL parsing tasks' });
        }

        // Create the task
        const task = await tasksService.createTask(userId, taskData);
        
        console.log(`✅ Created task ${task.id} for user ${userId}`);
        res.json(task);

    } catch (error) {
        console.error('❌ Error creating parsing task:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's active tasks (pending or running) - MUST be before /:taskId route
app.get('/api/tasks/active', async (req, res) => {
    try {
        const userId = getUserId(req);
        const activeTasks = await tasksService.getActiveTasks(userId);
        
        console.log(`📊 Found ${activeTasks.length} active tasks for user ${userId}`);
        res.json(activeTasks);
    } catch (error) {
        console.error('❌ Error getting active tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get task status
app.get('/api/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = getUserId(req);
        
        const task = await tasksService.getTask(taskId);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Security: Only allow users to see their own tasks
        if (task.user_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(task);

    } catch (error) {
        console.error(`❌ Error getting task ${req.params.taskId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const userId = getUserId(req);
        const limit = parseInt(req.query.limit) || 50;
        
        const tasks = await tasksService.getUserTasks(userId, limit);
        
        res.json(tasks);

    } catch (error) {
        console.error('❌ Error getting user tasks:', error);
        res.status(500).json({ error: error.message });
    }
});


// Get server stats (optional - for monitoring)
app.get('/api/tasks/stats', async (req, res) => {
    try {
        const [pendingTasks, runningTasks] = await Promise.all([
            tasksService.getPendingTasks(),
            tasksService.getRunningTasks()
        ]);
        
        res.json({
            pending: pendingTasks.length,
            running: runningTasks.length,
            server_time: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting server stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get background worker status
app.get('/api/worker/status', async (req, res) => {
    try {
        const workerStatus = backgroundWorker.getStatus();
        const healthCheck = await backgroundWorker.healthCheck();
        
        res.json({
            worker: workerStatus,
            health: healthCheck
        });

    } catch (error) {
        console.error('❌ Error getting worker status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel a running task (enhanced with worker integration)
app.post('/api/tasks/:taskId/cancel', async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = getUserId(req);
        
        // Check if task exists and belongs to user
        const task = await tasksService.getTask(taskId);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.user_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
            return res.status(400).json({ error: 'Task cannot be cancelled' });
        }

        // Try to cancel in background worker first
        let cancelledInWorker = false;
        try {
            cancelledInWorker = await backgroundWorker.cancelTask(taskId);
        } catch (workerError) {
            console.warn(`⚠️ Could not cancel task ${taskId} in worker:`, workerError.message);
        }

        // Always cancel in database
        const updatedTask = await tasksService.cancelTask(taskId);
        
        console.log(`🛑 Cancelled task ${taskId} by user ${userId} (worker: ${cancelledInWorker ? 'yes' : 'no'})`);
        res.json(updatedTask);

    } catch (error) {
        console.error(`❌ Error cancelling task ${req.params.taskId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// ================================
// PARSING TASKS ENDPOINTS (for persistent parsing)
// ================================

// Create new parsing task
app.post('/api/parsing-tasks', async (req, res) => {
    try {
        console.log('📥 Received parsing task request:', JSON.stringify(req.body, null, 2));

        const { userId, taskData } = req.body;

        if (!userId || !taskData) {
            console.error('❌ Missing required fields:', { userId: !!userId, taskData: !!taskData });
            return res.status(400).json({ error: 'userId and taskData are required' });
        }

        console.log('📋 Creating task with data:', {
            userId,
            taskName: taskData.taskName,
            type: taskData.type,
            hasSearchQuery: !!taskData.searchQuery,
            hasWebsiteUrl: !!taskData.websiteUrl
        });

        const task = await tasksService.createTask(userId, taskData);
        console.log(`✅ Created parsing task ${task.id} for user ${userId}`);

        res.json(task);
    } catch (error) {
        console.error('❌ Error creating parsing task:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Mark task as running
app.patch('/api/parsing-tasks/:taskId/running', async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await tasksService.markAsRunning(taskId);

        console.log(`▶️ Marked task ${taskId} as running`);
        res.json(task);
    } catch (error) {
        console.error(`❌ Error marking task ${taskId} as running:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Update task progress
app.patch('/api/parsing-tasks/:taskId/progress', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { stage, current, total, message } = req.body;

        const task = await tasksService.updateProgress(taskId, stage, current, total, message);
        res.json(task);
    } catch (error) {
        console.error(`❌ Error updating task ${taskId} progress:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Mark task as completed
app.patch('/api/parsing-tasks/:taskId/completed', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { results } = req.body;

        const task = await tasksService.markAsCompleted(taskId, results);
        console.log(`✅ Marked task ${taskId} as completed`);

        res.json(task);
    } catch (error) {
        console.error(`❌ Error marking task ${taskId} as completed:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Mark task as failed
app.patch('/api/parsing-tasks/:taskId/failed', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { error: errorMessage } = req.body;

        const task = await tasksService.markAsFailed(taskId, errorMessage);
        console.log(`❌ Marked task ${taskId} as failed:`, errorMessage);

        res.json(task);
    } catch (error) {
        console.error(`❌ Error marking task ${taskId} as failed:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get active tasks for user
app.get('/api/parsing-tasks/active', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const activeTasks = await tasksService.getActiveTasks(userId);
        res.json(activeTasks);
    } catch (error) {
        console.error('❌ Error getting active tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================================
// UTILITY ENDPOINTS
// ================================

// Serve favicon
app.get('/favicon.ico', (req, res) => {
    res.status(204).send();
});

const server = app.listen(PORT, () => {
    console.log(`🚀 GYMNASTIKA Parsing Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${path.resolve('.')}`);
    console.log(`🔗 Open: http://localhost:${PORT}/index.html`);
    console.log(`🔒 Security headers: ${process.env.ENABLE_SECURITY_HEADERS === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🛡️ CSP: ${process.env.CSP_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log('✅ Background worker started and ready to process tasks');
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
    
    try {
        // Stop accepting new connections
        console.log('🔌 Closing server...');
        server.close();
        
        // Stop background worker gracefully
        console.log('🔄 Stopping background worker...');
        await backgroundWorker.stop();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});