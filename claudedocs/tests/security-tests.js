#!/usr/bin/env node

/**
 * GYMNASTIKA Platform Security Test Suite
 * 
 * Comprehensive security testing for input validation middleware
 * and API endpoint protection.
 * 
 * Usage: node tests/security-tests.js
 */

const http = require('http');
const https = require('https');

// Test configuration
const CONFIG = {
    host: 'localhost',
    port: 3001,
    timeout: 5000,
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v')
};

// Test results tracking
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    coverage: {
        xss_protection: [],
        schema_validation: [],
        rate_limiting: [],
        nosql_injection: [],
        input_sanitization: []
    }
};

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bright: '\x1b[1m'
};

/**
 * HTTP request helper
 */
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsedBody = body ? JSON.parse(body) : null;
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: parsedBody,
                        rawBody: body
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: null,
                        rawBody: body,
                        parseError: e.message
                    });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(CONFIG.timeout, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

/**
 * Test assertion helper
 */
function assert(condition, message) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        if (CONFIG.verbose) {
            console.log(`${colors.green}✓${colors.reset} ${message}`);
        }
        return true;
    } else {
        testResults.failed++;
        console.log(`${colors.red}✗${colors.reset} ${message}`);
        return false;
    }
}

/**
 * Test group helper
 */
function describe(name, tests) {
    console.log(`\n${colors.blue}${colors.bright}${name}${colors.reset}`);
    return tests();
}

/**
 * Sleep helper for rate limiting tests
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * XSS Protection Tests
 */
async function testXSSProtection() {
    return describe('🛡️ XSS Protection', async () => {
        const xssPayloads = [
            '<script>alert("xss")</script>',
            '<img src="x" onerror="alert(1)">',
            'javascript:alert(1)',
            '<svg onload="alert(1)">',
            '"><script>alert(1)</script>',
            '<iframe src="javascript:alert(1)"></iframe>'
        ];

        for (const payload of xssPayloads) {
            try {
                const response = await makeRequest({
                    hostname: CONFIG.host,
                    port: CONFIG.port,
                    path: '/api/apify/test123/runs',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, {
                    searchStringsArray: [payload]
                });

                // Should either sanitize (validation error) or process safely
                const isSafe = response.statusCode === 400 || 
                             (response.body && !response.rawBody.includes(payload));
                
                assert(isSafe, `XSS payload blocked/sanitized: ${payload.substring(0, 30)}...`);
                testResults.coverage.xss_protection.push({
                    payload,
                    blocked: isSafe,
                    response: response.statusCode
                });
            } catch (error) {
                assert(false, `XSS test failed with error: ${error.message}`);
            }
        }
    });
}

/**
 * Schema Validation Tests
 */
async function testSchemaValidation() {
    return describe('📋 Schema Validation', async () => {
        const invalidPayloads = [
            {
                name: 'Unknown field',
                data: { invalidField: 'test', searchStringsArray: ['test'] },
                expectedError: 'not allowed'
            },
            {
                name: 'Oversized array',
                data: { searchStringsArray: new Array(20).fill('test') },
                expectedError: 'must contain less than or equal to 10 items'
            },
            {
                name: 'Invalid number range',
                data: { searchStringsArray: ['test'], maxCrawledPlacesPerSearch: 9999 },
                expectedError: 'must be less than or equal to 1000'
            },
            {
                name: 'Invalid language code',
                data: { searchStringsArray: ['test'], language: 'invalid' },
                expectedError: 'length must be 2 characters long'
            },
            {
                name: 'Empty required field',
                data: { searchStringsArray: [''] },
                expectedError: 'not allowed to be empty'
            }
        ];

        for (const test of invalidPayloads) {
            try {
                const response = await makeRequest({
                    hostname: CONFIG.host,
                    port: CONFIG.port,
                    path: '/api/apify/test123/runs',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, test.data);

                const isValidationError = response.statusCode === 400 && 
                                        response.body && 
                                        response.body.error === 'Invalid input data';

                assert(isValidationError, `Schema validation rejected: ${test.name}`);
                testResults.coverage.schema_validation.push({
                    test: test.name,
                    rejected: isValidationError,
                    response: response.statusCode
                });
            } catch (error) {
                assert(false, `Schema validation test failed: ${error.message}`);
            }
        }
    });
}

/**
 * Rate Limiting Tests
 */
async function testRateLimiting() {
    return describe('⏱️ Rate Limiting', async () => {
        console.log('Testing sensitive endpoint rate limiting...');
        
        let blockedCount = 0;
        const testRequests = 15;
        
        // Test strict rate limiting on abort endpoint
        for (let i = 0; i < testRequests; i++) {
            try {
                const response = await makeRequest({
                    hostname: CONFIG.host,
                    port: CONFIG.port,
                    path: '/api/apify/runs/test-run-id/abort',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.statusCode === 429) {
                    blockedCount++;
                }

                // Small delay between requests
                if (i < testRequests - 1) await sleep(100);
                
            } catch (error) {
                // Connection errors might occur due to rate limiting
                if (CONFIG.verbose) console.log(`Request ${i + 1}: ${error.message}`);
            }
        }

        // Should have blocked some requests (sensitive endpoint limit is 10)
        const rateLimitWorking = blockedCount > 0;
        assert(rateLimitWorking, `Rate limiting active (blocked ${blockedCount}/${testRequests} requests)`);
        
        testResults.coverage.rate_limiting.push({
            endpoint: '/api/apify/runs/:runId/abort',
            totalRequests: testRequests,
            blockedRequests: blockedCount,
            effective: rateLimitWorking
        });
    });
}

/**
 * NoSQL Injection Tests
 */
async function testNoSQLInjection() {
    return describe('🚫 NoSQL Injection Protection', async () => {
        const injectionPayloads = [
            { $gt: '' },
            { $ne: null },
            { $where: 'this.password' },
            { $regex: '.*' },
            { $or: [{ password: 'a' }, { password: 'b' }] }
        ];

        for (const payload of injectionPayloads) {
            try {
                const response = await makeRequest({
                    hostname: CONFIG.host,
                    port: CONFIG.port,
                    path: '/api/apify/test123/runs',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, {
                    searchStringsArray: ['test'],
                    maliciousQuery: payload
                });

                // Should be sanitized or rejected
                const isSafe = response.statusCode === 400 || 
                             !response.rawBody.includes('$gt') &&
                             !response.rawBody.includes('$ne') &&
                             !response.rawBody.includes('$where');

                assert(isSafe, `NoSQL injection blocked: ${JSON.stringify(payload).substring(0, 30)}...`);
                testResults.coverage.nosql_injection.push({
                    payload: JSON.stringify(payload),
                    blocked: isSafe,
                    response: response.statusCode
                });
            } catch (error) {
                assert(false, `NoSQL injection test failed: ${error.message}`);
            }
        }
    });
}

/**
 * Input Sanitization Tests
 */
async function testInputSanitization() {
    return describe('🧹 Input Sanitization', async () => {
        const sanitizationTests = [
            {
                name: 'HTML tag removal',
                input: '<div>test content</div>',
                shouldBeSanitized: true
            },
            {
                name: 'Script tag removal',
                input: '<script>malicious()</script>normal content',
                shouldBeSanitized: true
            },
            {
                name: 'Whitespace trimming',
                input: '   test content   ',
                shouldBeSanitized: true
            },
            {
                name: 'Normal content preservation',
                input: 'normal search query',
                shouldBeSanitized: false
            }
        ];

        for (const test of sanitizationTests) {
            try {
                const response = await makeRequest({
                    hostname: CONFIG.host,
                    port: CONFIG.port,
                    path: '/api/apify/test123/runs',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, {
                    searchStringsArray: [test.input]
                });

                let sanitized = false;
                
                if (test.shouldBeSanitized) {
                    // Content should be modified or rejected
                    sanitized = response.statusCode === 400 || 
                               (response.body && JSON.stringify(response.body).indexOf(test.input) === -1);
                } else {
                    // Normal content should pass through
                    sanitized = response.statusCode !== 400 || 
                               (response.body && JSON.stringify(response.body).indexOf('validation') === -1);
                }

                assert(sanitized, `Input sanitization: ${test.name}`);
                testResults.coverage.input_sanitization.push({
                    test: test.name,
                    input: test.input,
                    sanitized,
                    response: response.statusCode
                });
            } catch (error) {
                assert(false, `Input sanitization test failed: ${error.message}`);
            }
        }
    });
}

/**
 * Server Health Check
 */
async function testServerHealth() {
    return describe('🏥 Server Health', async () => {
        try {
            const response = await makeRequest({
                hostname: CONFIG.host,
                port: CONFIG.port,
                path: '/api/health',
                method: 'GET'
            });

            const isHealthy = response.statusCode === 200 && 
                            response.body && 
                            response.body.status === 'ok';

            assert(isHealthy, 'Server is healthy and responding');
            return isHealthy;
        } catch (error) {
            assert(false, `Server health check failed: ${error.message}`);
            return false;
        }
    });
}

/**
 * Generate Coverage Report
 */
function generateCoverageReport() {
    console.log(`\n${colors.cyan}${colors.bright}📊 Security Coverage Report${colors.reset}`);
    
    const coverage = testResults.coverage;
    
    console.log(`\n${colors.yellow}XSS Protection Coverage:${colors.reset}`);
    console.log(`• Payloads tested: ${coverage.xss_protection.length}`);
    console.log(`• Blocked/Sanitized: ${coverage.xss_protection.filter(t => t.blocked).length}`);
    
    console.log(`\n${colors.yellow}Schema Validation Coverage:${colors.reset}`);
    console.log(`• Validation rules tested: ${coverage.schema_validation.length}`);
    console.log(`• Properly rejected: ${coverage.schema_validation.filter(t => t.rejected).length}`);
    
    console.log(`\n${colors.yellow}Rate Limiting Coverage:${colors.reset}`);
    coverage.rate_limiting.forEach(test => {
        console.log(`• ${test.endpoint}: ${test.blockedRequests}/${test.totalRequests} blocked`);
    });
    
    console.log(`\n${colors.yellow}NoSQL Injection Coverage:${colors.reset}`);
    console.log(`• Injection patterns tested: ${coverage.nosql_injection.length}`);
    console.log(`• Blocked: ${coverage.nosql_injection.filter(t => t.blocked).length}`);
    
    console.log(`\n${colors.yellow}Input Sanitization Coverage:${colors.reset}`);
    console.log(`• Sanitization tests: ${coverage.input_sanitization.length}`);
    console.log(`• Working correctly: ${coverage.input_sanitization.filter(t => t.sanitized).length}`);
}

/**
 * Main test execution
 */
async function runSecurityTests() {
    console.log(`${colors.magenta}${colors.bright}`);
    console.log('🛡️ GYMNASTIKA Platform Security Test Suite');
    console.log('===========================================');
    console.log(`${colors.reset}`);

    console.log(`Testing server at ${CONFIG.host}:${CONFIG.port}`);
    console.log(`Verbose mode: ${CONFIG.verbose ? 'ON' : 'OFF'}`);

    try {
        // Check if server is running
        const serverHealthy = await testServerHealth();
        if (!serverHealthy) {
            console.log(`\n${colors.red}❌ Server is not responding. Please start the server first.${colors.reset}`);
            console.log(`Run: npm start`);
            process.exit(1);
        }

        // Run security tests
        await testXSSProtection();
        await testSchemaValidation();
        await testRateLimiting();
        await testNoSQLInjection();
        await testInputSanitization();

        // Generate report
        generateCoverageReport();

        // Final results
        console.log(`\n${colors.bright}📋 Test Results Summary${colors.reset}`);
        console.log(`Total tests: ${testResults.total}`);
        console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);

        const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
        console.log(`Pass rate: ${passRate}%`);

        if (testResults.failed === 0) {
            console.log(`\n${colors.green}${colors.bright}🎉 All security tests passed! Platform is secure.${colors.reset}`);
        } else {
            console.log(`\n${colors.red}${colors.bright}⚠️  Some security tests failed. Review issues above.${colors.reset}`);
        }

        process.exit(testResults.failed > 0 ? 1 : 0);

    } catch (error) {
        console.error(`\n${colors.red}💥 Test execution failed: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runSecurityTests().catch(console.error);
}

module.exports = { runSecurityTests, testResults };