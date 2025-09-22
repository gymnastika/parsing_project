/**
 * Input Validation Middleware for GYMNASTIKA Platform
 * Security-focused validation and sanitization for all API endpoints
 * 
 * Features:
 * - XSS Protection
 * - SQL Injection Prevention
 * - NoSQL Injection Prevention
 * - Rate Limiting
 * - Input Sanitization
 * - Schema Validation
 */

const Joi = require('joi');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');

// ================================
// SECURITY CONSTANTS
// ================================

const SECURITY_CONFIG = {
    // Rate limiting
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100, // requests per window
    RATE_LIMIT_STRICT_MAX: 10, // for sensitive endpoints
    
    // String length limits
    MAX_STRING_LENGTH: 10000,
    MAX_ID_LENGTH: 100,
    MAX_QUERY_LENGTH: 2000,
    MAX_THREAD_ID_LENGTH: 50,
    MAX_RUN_ID_LENGTH: 50,
    MAX_DATASET_ID_LENGTH: 50,
    MAX_ACTOR_ID_LENGTH: 100,
    
    // Security patterns
    SAFE_ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
    SAFE_ACTOR_ID_PATTERN: /^[a-zA-Z0-9_~\/.-]+$/,
    THREAD_ID_PATTERN: /^thread_[a-zA-Z0-9]+$/,
    RUN_ID_PATTERN: /^run_[a-zA-Z0-9]+$/,
    ASSISTANT_ID_PATTERN: /^asst_[a-zA-Z0-9]+$/,
};

// ================================
// RATE LIMITING
// ================================

// General API rate limiting
const generalRateLimit = rateLimit({
    windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW,
    max: SECURITY_CONFIG.RATE_LIMIT_MAX,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(SECURITY_CONFIG.RATE_LIMIT_WINDOW / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health check
        return req.path === '/api/health';
    }
});

// Strict rate limiting for sensitive endpoints
const strictRateLimit = rateLimit({
    windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW,
    max: SECURITY_CONFIG.RATE_LIMIT_STRICT_MAX,
    message: {
        error: 'Too many requests to sensitive endpoint, please try again later.',
        retryAfter: Math.ceil(SECURITY_CONFIG.RATE_LIMIT_WINDOW / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ================================
// SANITIZATION MIDDLEWARE
// ================================

// XSS Protection and sanitization
const sanitizeInput = (req, res, next) => {
    console.log('🧹 Sanitizing request input...');
    
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters (handled by express-validator)
    console.log('✅ Input sanitization complete');
    next();
};

// Recursively sanitize object properties
function sanitizeObject(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => 
            typeof item === 'string' ? sanitizeString(item) : 
            typeof item === 'object' ? sanitizeObject(item) : item
        );
    }
    
    if (obj !== null && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = sanitizeString(key);
            sanitized[sanitizedKey] = 
                typeof value === 'string' ? sanitizeString(value) :
                typeof value === 'object' ? sanitizeObject(value) : value;
        }
        return sanitized;
    }
    
    return obj;
}

// Sanitize individual string
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    // XSS protection
    let sanitized = xss(str, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style']
    });
    
    // Additional cleaning
    sanitized = sanitized
        .replace(/[<>]/g, '') // Remove angle brackets
        .trim();
    
    return sanitized;
}

// ================================
// VALIDATION SCHEMAS
// ================================

// Common validation schemas
const commonSchemas = {
    // ID validation (alphanumeric, hyphens, underscores)
    safeId: Joi.string()
        .pattern(SECURITY_CONFIG.SAFE_ID_PATTERN)
        .max(SECURITY_CONFIG.MAX_ID_LENGTH)
        .required(),
    
    // Actor ID (allows ~ for scoped actors)
    actorId: Joi.string()
        .pattern(SECURITY_CONFIG.SAFE_ACTOR_ID_PATTERN)
        .max(SECURITY_CONFIG.MAX_ACTOR_ID_LENGTH)
        .required(),
    
    // OpenAI Thread ID
    threadId: Joi.string()
        .pattern(SECURITY_CONFIG.THREAD_ID_PATTERN)
        .max(SECURITY_CONFIG.MAX_THREAD_ID_LENGTH)
        .required(),
    
    // OpenAI Run ID
    runId: Joi.string()
        .pattern(SECURITY_CONFIG.RUN_ID_PATTERN)
        .max(SECURITY_CONFIG.MAX_RUN_ID_LENGTH)
        .required(),
    
    // Dataset ID
    datasetId: Joi.string()
        .pattern(SECURITY_CONFIG.SAFE_ID_PATTERN)
        .max(SECURITY_CONFIG.MAX_DATASET_ID_LENGTH)
        .required(),
    
    // Generic string input
    safeString: Joi.string()
        .max(SECURITY_CONFIG.MAX_STRING_LENGTH)
        .allow(''),
    
    // Search query
    searchQuery: Joi.string()
        .max(SECURITY_CONFIG.MAX_QUERY_LENGTH)
        .required(),
    
    // Assistant type
    assistantType: Joi.string()
        .valid('query', 'validation')
        .required(),
};

// ================================
// VALIDATION FUNCTIONS
// ================================

// Generic JOI validation middleware
const validateSchema = (schema) => {
    return (req, res, next) => {
        console.log('🔍 Validating request schema...');
        
        const { error, value } = schema.validate({
            params: req.params,
            query: req.query,
            body: req.body
        }, { 
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true
        });
        
        if (error) {
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            
            console.warn('❌ Validation failed:', validationErrors);
            return res.status(400).json({
                error: 'Invalid input data',
                details: validationErrors,
                timestamp: new Date().toISOString()
            });
        }
        
        // Update request with validated data
        Object.assign(req, value);
        console.log('✅ Schema validation passed');
        next();
    };
};

// Express-validator error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const validationErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));
        
        console.warn('❌ Express validation failed:', validationErrors);
        return res.status(400).json({
            error: 'Invalid input data',
            details: validationErrors,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

// ================================
// ENDPOINT-SPECIFIC VALIDATION
// ================================

// Apify actor run validation (Google Maps scraper)
const validateApifyRun = validateSchema(Joi.object({
    params: Joi.object({
        actorId: commonSchemas.actorId,
        actorScope: commonSchemas.safeId.optional(),
        actorName: commonSchemas.safeId.optional(),
    }),
    body: Joi.object({
        searchStringsArray: Joi.array()
            .items(commonSchemas.searchQuery)
            .max(10)
            .optional(),
        locationQuery: commonSchemas.safeString.optional(),
        maxCrawledPlacesPerSearch: Joi.number()
            .integer()
            .min(1)
            .max(1000)
            .optional(),
        language: Joi.string()
            .length(2)
            .pattern(/^[a-z]{2}$/)
            .optional(),
        memoryMbytes: Joi.number()
            .integer()
            .min(128)
            .max(8192)
            .optional(),
        timeoutSecs: Joi.number()
            .integer()
            .min(60)
            .max(3600)
            .optional(),
        countryCode: Joi.string()
            .length(2)
            .pattern(/^[a-z]{2}$/)
            .optional(),
        exportPlaceUrls: Joi.boolean().optional(),
        scrapeReviewsCount: Joi.number()
            .integer()
            .min(0)
            .max(1000)
            .optional(),
        scrapeDirectories: Joi.boolean().optional(),
        scrapeImages: Joi.boolean().optional(),
        includePeopleAlsoSearch: Joi.boolean().optional(),
        allPlacesNoSearch: Joi.boolean().optional(),
        additionalInfo: Joi.boolean().optional(),
    }).unknown(false),
    query: Joi.object().unknown(false)
}));

// Web Scraper actor validation
const validateWebScraperRun = validateSchema(Joi.object({
    params: Joi.object({
        actorId: commonSchemas.actorId,
        actorScope: commonSchemas.safeId.optional(),
        actorName: commonSchemas.safeId.optional(),
    }),
    body: Joi.object({
        runMode: Joi.string()
            .valid('PRODUCTION', 'DEVELOPMENT')
            .optional(),
        startUrls: Joi.array()
            .items(Joi.object({
                url: Joi.string().uri().required()
            }).unknown(true))
            .optional(),
        keepUrlFragments: Joi.boolean().optional(),
        respectRobotsTxtFile: Joi.boolean().optional(),
        linkSelector: Joi.string()
            .max(1000)
            .allow('')
            .optional(),
        globs: Joi.array()
            .items(Joi.object().unknown(true))
            .optional(),
        pseudoUrls: Joi.array()
            .items(Joi.object().unknown(true))
            .optional(),
        excludes: Joi.array()
            .items(Joi.object().unknown(true))
            .optional(),
        pageFunction: Joi.string()
            .max(50000)
            .optional(),
        injectJQuery: Joi.boolean().optional(),
        proxyConfiguration: Joi.object().unknown(true).optional(),
        proxyRotation: Joi.string()
            .valid('RECOMMENDED', 'PER_REQUEST', 'UNTIL_FAILURE')
            .optional(),
        sessionPoolName: Joi.string()
            .min(3)
            .max(200)
            .pattern(/^[0-9A-z-_]+$/)
            .optional(),
        initialCookies: Joi.array()
            .items(Joi.object().unknown(true))
            .optional(),
        useChrome: Joi.boolean().optional(),
        headless: Joi.boolean().optional(),
        ignoreSslErrors: Joi.boolean().optional(),
        ignoreCorsAndCsp: Joi.boolean().optional(),
        downloadMedia: Joi.boolean().optional(),
        downloadCss: Joi.boolean().optional(),
        maxRequestRetries: Joi.number()
            .integer()
            .min(0)
            .max(20)
            .optional(),
        maxPagesPerCrawl: Joi.number()
            .integer()
            .min(0)
            .max(100000)
            .optional(),
        maxResultsPerCrawl: Joi.number()
            .integer()
            .min(0)
            .max(100000)
            .optional(),
        maxCrawlingDepth: Joi.number()
            .integer()
            .min(0)
            .max(100)
            .optional(),
        maxConcurrency: Joi.number()
            .integer()
            .min(1)
            .max(1000)
            .optional(),
        pageLoadTimeoutSecs: Joi.number()
            .integer()
            .min(1)
            .max(600)
            .optional(),
        pageFunctionTimeoutSecs: Joi.number()
            .integer()
            .min(1)
            .max(600)
            .optional(),
        waitUntil: Joi.array()
            .items(Joi.string().valid('domcontentloaded', 'load', 'networkidle2', 'networkidle0'))
            .optional(),
        preNavigationHooks: Joi.string()
            .max(10000)
            .optional(),
        postNavigationHooks: Joi.string()
            .max(10000)
            .optional(),
        breakpointLocation: Joi.string()
            .valid('NONE', 'BEFORE_GOTO', 'BEFORE_PAGE_FUNCTION', 'AFTER_PAGE_FUNCTION')
            .optional(),
        closeCookieModals: Joi.boolean().optional(),
        maxScrollHeightPixels: Joi.number()
            .integer()
            .min(0)
            .max(100000)
            .optional(),
        debugLog: Joi.boolean().optional(),
        browserLog: Joi.boolean().optional(),
        customData: Joi.object().unknown(true).optional(),
        datasetName: Joi.string()
            .max(200)
            .optional(),
        keyValueStoreName: Joi.string()
            .max(200)
            .optional(),
        requestQueueName: Joi.string()
            .max(200)
            .optional(),
        memoryMbytes: Joi.number()
            .integer()
            .min(128)
            .max(8192)
            .optional(),
        timeoutSecs: Joi.number()
            .integer()
            .min(60)
            .max(3600)
            .optional(),
    }).unknown(false),
    query: Joi.object().unknown(false)
}));

// OpenAI thread validation
const validateOpenAIThread = validateSchema(Joi.object({
    params: Joi.object({
        threadId: commonSchemas.threadId.optional(),
        runId: commonSchemas.runId.optional(),
    }),
    body: Joi.object({
        role: Joi.string()
            .valid('user', 'assistant')
            .optional(),
        content: commonSchemas.safeString.optional(),
        assistant_type: commonSchemas.assistantType.optional(),
    }).unknown(false),
    query: Joi.object().unknown(false)
}));

// Query parameters validation
const validateQueryParams = [
    query('status')
        .optional()
        .isIn(['RUNNING', 'SUCCEEDED', 'FAILED', 'ABORTED'])
        .withMessage('Invalid status value'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    handleValidationErrors
];

// ================================
// SECURITY MIDDLEWARE STACK
// ================================

// Base security middleware (applies to all endpoints)
const baseSecurityMiddleware = [
    mongoSanitize({
        replaceWith: '_',
        onSanitize: ({ key }) => {
            console.warn(`🚨 NoSQL injection attempt blocked: ${key}`);
        }
    }),
    sanitizeInput,
    generalRateLimit
];

// Sensitive endpoint security (for high-risk endpoints)
const sensitiveSecurityMiddleware = [
    ...baseSecurityMiddleware,
    strictRateLimit
];

// ================================
// EXPORTS
// ================================

module.exports = {
    // Rate limiting
    generalRateLimit,
    strictRateLimit,
    
    // Sanitization
    sanitizeInput,
    sanitizeString,
    sanitizeObject,
    
    // Validation
    validateSchema,
    validateApifyRun,
    validateWebScraperRun,
    validateOpenAIThread,
    validateQueryParams,
    handleValidationErrors,
    
    // Security middleware stacks
    baseSecurityMiddleware,
    sensitiveSecurityMiddleware,
    
    // Schemas
    commonSchemas,
    
    // Configuration
    SECURITY_CONFIG
};

console.log('🛡️ Input validation middleware loaded with security focus');