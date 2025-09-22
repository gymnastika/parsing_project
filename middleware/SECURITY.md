# Security Middleware Documentation

## Overview

The GYMNASTIKA Platform implements comprehensive security middleware to protect against common web vulnerabilities and attacks. This document outlines the security features and validation rules implemented.

## Security Features

### 1. Input Validation & Sanitization

**Location**: `middleware/inputValidation.js`

#### XSS Protection
- **Method**: XSS library with whitelist approach
- **Scope**: All string inputs in request body and query parameters
- **Implementation**: Removes HTML tags, scripts, and dangerous content
- **Settings**: Zero HTML tags allowed, strips script/style tags

#### NoSQL Injection Prevention
- **Method**: express-mongo-sanitize middleware
- **Scope**: All incoming requests
- **Implementation**: Replaces MongoDB operators with safe characters
- **Alert**: Logs injection attempts with warning messages

#### Input Sanitization
- **Recursive**: Sanitizes nested objects and arrays
- **String Processing**: Removes angle brackets, trims whitespace
- **Key Sanitization**: Cleans object property names
- **Preservation**: Maintains non-string data types

### 2. Rate Limiting

#### General Rate Limiting
- **Limit**: 100 requests per 15-minute window
- **Scope**: All API endpoints (except /api/health)
- **Response**: 429 status with retry-after header
- **Headers**: Standard rate limit headers included

#### Strict Rate Limiting (Sensitive Endpoints)
- **Limit**: 10 requests per 15-minute window
- **Scope**: Sensitive operations (e.g., /api/apify/runs/:runId/abort)
- **Purpose**: Extra protection for destructive operations
- **Combined**: Applied alongside general rate limiting

### 3. Schema Validation

#### Apify Actor Run Validation
```javascript
{
  params: {
    actorId: /^[a-zA-Z0-9_~/-]+$/ (max 100 chars)
  },
  body: {
    searchStringsArray: Array of strings (max 10 items, 2000 chars each)
    locationQuery: String (max 10000 chars)
    maxCrawledPlacesPerSearch: Number (1-1000)
    language: 2-character language code
    memoryMbytes: Number (128-8192)
    timeoutSecs: Number (60-3600)
  }
}
```

#### OpenAI Thread Validation
```javascript
{
  params: {
    threadId: /^thread_[a-zA-Z0-9]+$/ (max 50 chars)
    runId: /^run_[a-zA-Z0-9]+$/ (max 50 chars)
  },
  body: {
    role: 'user' | 'assistant'
    content: String (max 10000 chars)
    assistant_type: 'query' | 'validation'
  }
}
```

#### Query Parameters Validation
- **status**: Must be one of RUNNING, SUCCEEDED, FAILED, ABORTED
- **limit**: Integer between 1 and 1000

### 4. Security Middleware Stacks

#### Base Security Middleware
Applied to all routes:
- MongoDB sanitization
- Input sanitization (XSS protection)
- General rate limiting

#### Sensitive Security Middleware
Applied to high-risk endpoints:
- Base security middleware
- Strict rate limiting

## Security Configuration

### Constants (SECURITY_CONFIG)
```javascript
{
  // Rate limiting
  RATE_LIMIT_WINDOW: 15 minutes
  RATE_LIMIT_MAX: 100 requests
  RATE_LIMIT_STRICT_MAX: 10 requests
  
  // String length limits
  MAX_STRING_LENGTH: 10000
  MAX_ID_LENGTH: 100
  MAX_QUERY_LENGTH: 2000
  
  // Security patterns
  SAFE_ID_PATTERN: /^[a-zA-Z0-9_-]+$/
  SAFE_ACTOR_ID_PATTERN: /^[a-zA-Z0-9_~/-]+$/
  THREAD_ID_PATTERN: /^thread_[a-zA-Z0-9]+$/
  RUN_ID_PATTERN: /^run_[a-zA-Z0-9]+$/
}
```

## Implementation

### Endpoint Protection Levels

#### Level 1: Base Security (Standard Endpoints)
- `/api/apify/:actorId/runs`
- `/api/apify/:actorScope/:actorName/runs`
- `/api/openai/threads`
- `/api/openai/threads/:threadId/messages`
- `/api/openai/threads/:threadId/runs`

#### Level 2: Enhanced Security (Sensitive Endpoints)
- `/api/apify/runs/:runId/abort` (destructive operation)

### Validation Error Response Format
```javascript
{
  "error": "Invalid input data",
  "details": [
    {
      "field": "body.searchStringsArray.0",
      "message": "validation error message",
      "value": "rejected value"
    }
  ],
  "timestamp": "2025-09-09T12:00:00.000Z"
}
```

### Rate Limit Response Format
```javascript
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

## Logging

### Security Events Logged
- **Input Sanitization**: 🧹 Sanitizing request input...
- **Validation Success**: ✅ Schema validation passed
- **Validation Failure**: ❌ Validation failed: [details]
- **NoSQL Injection**: 🚨 NoSQL injection attempt blocked
- **Rate Limiting**: Rate limit exceeded warnings

### Log Levels
- **Info**: Normal operation, validation success
- **Warn**: Validation failures, injection attempts
- **Error**: System errors, middleware failures

## Testing

### Security Test Cases

#### XSS Protection Test
```bash
curl -X POST localhost:3001/api/apify/test/runs \
  -H "Content-Type: application/json" \
  -d '{"searchStringsArray": ["<script>alert(1)</script>"]}'
```
**Expected**: XSS payload sanitized, validation may fail on empty string

#### Rate Limiting Test
```bash
for i in {1..15}; do
  curl -X POST localhost:3001/api/apify/runs/test/abort
done
```
**Expected**: First 10 succeed, rest return 429

#### Schema Validation Test
```bash
curl -X POST localhost:3001/api/apify/test/runs \
  -H "Content-Type: application/json" \
  -d '{"invalidField": "test", "maxCrawledPlacesPerSearch": 9999}'
```
**Expected**: Validation errors for unknown field and value out of range

## Security Headers

Additional security provided by helmet.js (configured in server.js):
- **CSP**: Content Security Policy
- **HSTS**: HTTP Strict Transport Security
- **X-Frame-Options**: Prevent clickjacking
- **X-XSS-Protection**: Browser XSS protection
- **X-Content-Type-Options**: Prevent MIME sniffing

## Best Practices

### For Developers
1. Always use validation middleware on new endpoints
2. Apply appropriate security level (base vs sensitive)
3. Test both valid and invalid inputs
4. Monitor security logs for unusual patterns
5. Keep validation rules updated with business requirements

### For Security
1. Regularly review validation rules
2. Monitor rate limiting effectiveness
3. Analyze blocked requests for attack patterns
4. Update security configurations based on threat landscape
5. Test middleware updates thoroughly

## Maintenance

### Regular Tasks
- [ ] Review and update string length limits
- [ ] Analyze blocked requests for new attack vectors
- [ ] Update validation patterns for new API requirements
- [ ] Monitor performance impact of validation
- [ ] Test rate limiting thresholds under load

### Security Updates
- [ ] Keep validation libraries updated
- [ ] Review new XSS attack vectors
- [ ] Update NoSQL injection patterns
- [ ] Monitor for new vulnerability disclosures
- [ ] Regular penetration testing

---

**Last Updated**: September 9, 2025
**Version**: 1.0.0
**Maintained by**: GYMNASTIKA Security Team