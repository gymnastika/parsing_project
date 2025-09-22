#!/usr/bin/env node

/**
 * GYMNASTIKA Platform Penetration Testing Suite
 * 
 * Advanced security testing including edge cases, boundary testing,
 * and real-world attack scenarios.
 * 
 * Usage: node tests/penetration-tests.js
 */

const http = require('http');
const crypto = require('crypto');

const CONFIG = {
    host: 'localhost',
    port: 3001,
    timeout: 10000,
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v')
};

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

let penTestResults = {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    passed: 0
};

function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body ? JSON.parse(body) : null,
                        rawBody: body
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: null,
                        rawBody: body
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
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        req.end();
    });
}

function reportVulnerability(severity, title, details) {
    penTestResults.total++;
    penTestResults[severity]++;
    
    const severityColors = {
        critical: colors.red,
        high: colors.red,
        medium: colors.yellow,
        low: colors.cyan
    };
    
    const severityIcons = {
        critical: '🚨',
        high: '⚠️ ',
        medium: '⚡',
        low: 'ℹ️ '
    };
    
    console.log(`${severityColors[severity]}${severityIcons[severity]} [${severity.toUpperCase()}] ${title}${colors.reset}`);
    if (details && CONFIG.verbose) {
        console.log(`   ${details}`);
    }
}

function reportSecure(title) {
    penTestResults.total++;
    penTestResults.passed++;
    if (CONFIG.verbose) {
        console.log(`${colors.green}✓${colors.reset} ${title}`);
    }
}

/**
 * Test HTTP Header Security
 */
async function testSecurityHeaders() {
    console.log(`\n${colors.blue}${colors.bright}🛡️ Security Headers Analysis${colors.reset}`);
    
    try {
        const response = await makeRequest({
            hostname: CONFIG.host,
            port: CONFIG.port,
            path: '/api/health',
            method: 'GET'
        });

        const headers = response.headers;

        // Check for security headers
        const securityHeaders = {
            'x-content-type-options': 'nosniff',
            'x-frame-options': ['DENY', 'SAMEORIGIN'],
            'x-xss-protection': '1; mode=block',
            'strict-transport-security': null, // Any HSTS header is good
            'content-security-policy': null
        };

        for (const [header, expectedValue] of Object.entries(securityHeaders)) {
            const actualValue = headers[header];
            
            if (!actualValue) {
                if (header === 'strict-transport-security' && CONFIG.host === 'localhost') {
                    reportSecure(`${header} header (not required for localhost)`);
                } else {
                    reportVulnerability('medium', `Missing ${header} header`, 
                        'Security header not present, could allow certain attacks');
                }
            } else if (expectedValue && Array.isArray(expectedValue)) {
                if (expectedValue.includes(actualValue)) {
                    reportSecure(`${header} header present and secure`);
                } else {
                    reportVulnerability('low', `Weak ${header} header value`, 
                        `Expected one of ${expectedValue.join(', ')}, got ${actualValue}`);
                }
            } else if (expectedValue && actualValue !== expectedValue) {
                reportVulnerability('low', `Weak ${header} header value`, 
                    `Expected ${expectedValue}, got ${actualValue}`);
            } else {
                reportSecure(`${header} header present and secure`);
            }
        }

    } catch (error) {
        reportVulnerability('high', 'Security headers test failed', error.message);
    }
}

/**
 * Test for Buffer Overflow/Large Payload Attacks
 */
async function testBufferOverflow() {
    console.log(`\n${colors.blue}${colors.bright}💾 Buffer Overflow & Large Payload Tests${colors.reset}`);
    
    const payloadSizes = [
        { size: '1KB', data: 'A'.repeat(1024) },
        { size: '10KB', data: 'B'.repeat(10 * 1024) },
        { size: '1MB', data: 'C'.repeat(1024 * 1024) },
        { size: '50MB', data: 'D'.repeat(50 * 1024 * 1024) }
    ];

    for (const payload of payloadSizes) {
        try {
            const startTime = Date.now();
            const response = await makeRequest({
                hostname: CONFIG.host,
                port: CONFIG.port,
                path: '/api/apify/test123/runs',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, {
                searchStringsArray: [payload.data]
            });
            const endTime = Date.now();

            if (response.statusCode === 413) {
                reportSecure(`${payload.size} payload properly rejected (413)`);
            } else if (response.statusCode === 400) {
                reportSecure(`${payload.size} payload blocked by validation`);
            } else if (endTime - startTime > 10000) {
                reportVulnerability('medium', `${payload.size} payload causes slow response`, 
                    `Response time: ${endTime - startTime}ms`);
            } else {
                reportVulnerability('low', `${payload.size} payload processed`, 
                    `Unexpectedly processed large payload`);
            }

        } catch (error) {
            if (error.message.includes('timeout')) {
                reportVulnerability('high', `${payload.size} payload causes timeout`, 
                    'Server may be vulnerable to DoS via large payloads');
            } else if (error.message.includes('ECONNRESET')) {
                reportSecure(`${payload.size} payload causes connection reset (good)`);
            } else {
                reportVulnerability('medium', `${payload.size} payload test error`, error.message);
            }
        }
    }
}

/**
 * Test Unicode and Encoding Attacks
 */
async function testEncodingAttacks() {
    console.log(`\n${colors.blue}${colors.bright}🔤 Unicode & Encoding Attack Tests${colors.reset}`);
    
    const encodingPayloads = [
        {
            name: 'Unicode normalization',
            payload: '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e'
        },
        {
            name: 'URL encoding',
            payload: '%3Cscript%3Ealert(1)%3C/script%3E'
        },
        {
            name: 'Double URL encoding',
            payload: '%253Cscript%253Ealert(1)%253C/script%253E'
        },
        {
            name: 'UTF-7 encoding',
            payload: '+ADw-script+AD4-alert(1)+ADw-/script+AD4-'
        },
        {
            name: 'Null byte injection',
            payload: '<script>alert(1)</script>\\x00'
        },
        {
            name: 'Unicode overlong UTF-8',
            payload: '\\xC0\\xBC' // Overlong encoding of '<'
        }
    ];

    for (const test of encodingPayloads) {
        try {
            const response = await makeRequest({
                hostname: CONFIG.host,
                port: CONFIG.port,
                path: '/api/apify/test123/runs',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, {
                searchStringsArray: [test.payload]
            });

            if (response.statusCode === 400) {
                reportSecure(`${test.name} encoding attack blocked`);
            } else if (response.rawBody && !response.rawBody.includes('<script>')) {
                reportSecure(`${test.name} encoding attack sanitized`);
            } else {
                reportVulnerability('high', `${test.name} encoding attack bypassed`, 
                    'Encoding may bypass input sanitization');
            }

        } catch (error) {
            reportVulnerability('medium', `${test.name} encoding test failed`, error.message);
        }
    }
}

/**
 * Test CORS Security
 */
async function testCORSSecurity() {
    console.log(`\n${colors.blue}${colors.bright}🌐 CORS Security Tests${colors.reset}`);
    
    const corsTests = [
        {
            name: 'Malicious origin',
            origin: 'http://evil.com',
            expectBlocked: true
        },
        {
            name: 'Null origin',
            origin: 'null',
            expectBlocked: true
        },
        {
            name: 'Wildcard bypass attempt',
            origin: 'http://localhost:3001.evil.com',
            expectBlocked: true
        },
        {
            name: 'Valid origin',
            origin: 'http://localhost:3001',
            expectBlocked: false
        }
    ];

    for (const test of corsTests) {
        try {
            const response = await makeRequest({
                hostname: CONFIG.host,
                port: CONFIG.port,
                path: '/api/health',
                method: 'OPTIONS',
                headers: {
                    'Origin': test.origin,
                    'Access-Control-Request-Method': 'POST'
                }
            });

            const corsHeader = response.headers['access-control-allow-origin'];
            
            if (test.expectBlocked) {
                if (!corsHeader || corsHeader !== test.origin) {
                    reportSecure(`CORS blocks ${test.name}`);
                } else {
                    reportVulnerability('high', `CORS allows ${test.name}`, 
                        'Malicious origin allowed by CORS policy');
                }
            } else {
                if (corsHeader === test.origin) {
                    reportSecure(`CORS allows ${test.name}`);
                } else {
                    reportVulnerability('medium', `CORS blocks ${test.name}`, 
                        'Valid origin blocked by CORS policy');
                }
            }

        } catch (error) {
            reportVulnerability('medium', `CORS test failed for ${test.name}`, error.message);
        }
    }
}

/**
 * Test HTTP Method Security
 */
async function testHTTPMethodSecurity() {
    console.log(`\n${colors.blue}${colors.bright}🔧 HTTP Method Security Tests${colors.reset}`);
    
    const methods = ['TRACE', 'TRACK', 'DEBUG', 'DELETE', 'PUT', 'PATCH'];
    
    for (const method of methods) {
        try {
            const response = await makeRequest({
                hostname: CONFIG.host,
                port: CONFIG.port,
                path: '/api/health',
                method: method
            });

            if (response.statusCode === 405) {
                reportSecure(`${method} method properly rejected`);
            } else if (response.statusCode === 404) {
                reportSecure(`${method} method returns 404 (acceptable)`);
            } else {
                reportVulnerability('medium', `${method} method allowed`, 
                    `Potentially dangerous HTTP method returns ${response.statusCode}`);
            }

        } catch (error) {
            reportSecure(`${method} method blocked by server`);
        }
    }
}

/**
 * Test Session/Token Security
 */
async function testTokenSecurity() {
    console.log(`\n${colors.blue}${colors.bright}🎫 Authentication Token Security${colors.reset}`);
    
    // Test for common token/session vulnerabilities
    const tokenTests = [
        {
            name: 'Authorization header injection',
            headers: { 'Authorization': 'Bearer ../../../etc/passwd' }
        },
        {
            name: 'Cookie injection',
            headers: { 'Cookie': 'session=admin; role=admin' }
        },
        {
            name: 'JWT manipulation attempt',
            headers: { 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.' }
        }
    ];

    for (const test of tokenTests) {
        try {
            const response = await makeRequest({
                hostname: CONFIG.host,
                port: CONFIG.port,
                path: '/api/health',
                method: 'GET',
                headers: test.headers
            });

            // Server should handle invalid tokens gracefully
            if (response.statusCode >= 200 && response.statusCode < 300) {
                reportSecure(`${test.name} handled gracefully`);
            } else if (response.statusCode === 401 || response.statusCode === 403) {
                reportSecure(`${test.name} properly rejected`);
            } else {
                reportVulnerability('low', `${test.name} unexpected response`, 
                    `Status code: ${response.statusCode}`);
            }

        } catch (error) {
            reportSecure(`${test.name} blocked by server`);
        }
    }
}

/**
 * Performance DoS Testing
 */
async function testPerformanceDoS() {
    console.log(`\n${colors.blue}${colors.bright}⚡ Performance DoS Tests${colors.reset}`);
    
    // Test rapid requests
    const requestCount = 50;
    const promises = [];
    
    const startTime = Date.now();
    
    for (let i = 0; i < requestCount; i++) {
        promises.push(
            makeRequest({
                hostname: CONFIG.host,
                port: CONFIG.port,
                path: '/api/health',
                method: 'GET'
            }).catch(() => ({ statusCode: 0 }))
        );
    }
    
    try {
        const responses = await Promise.all(promises);
        const endTime = Date.now();
        
        const successfulRequests = responses.filter(r => r.statusCode === 200).length;
        const rateLimitedRequests = responses.filter(r => r.statusCode === 429).length;
        
        const avgResponseTime = (endTime - startTime) / requestCount;
        
        if (rateLimitedRequests > 0) {
            reportSecure(`Rate limiting activated (${rateLimitedRequests}/${requestCount} blocked)`);
        } else if (avgResponseTime > 1000) {
            reportVulnerability('medium', 'Slow response under load', 
                `Average response time: ${avgResponseTime.toFixed(2)}ms`);
        } else {
            reportSecure(`Server handles concurrent load well (${avgResponseTime.toFixed(2)}ms avg)`);
        }
        
    } catch (error) {
        reportVulnerability('high', 'Server failed under load', error.message);
    }
}

/**
 * Generate Penetration Test Report
 */
function generatePenTestReport() {
    console.log(`\n${colors.cyan}${colors.bright}📋 Penetration Test Report${colors.reset}`);
    console.log('=' + '='.repeat(40));
    
    console.log(`\n${colors.yellow}Test Summary:${colors.reset}`);
    console.log(`• Total tests: ${penTestResults.total}`);
    console.log(`• ${colors.green}Passed: ${penTestResults.passed}${colors.reset}`);
    console.log(`• ${colors.red}Critical: ${penTestResults.critical}${colors.reset}`);
    console.log(`• ${colors.red}High: ${penTestResults.high}${colors.reset}`);
    console.log(`• ${colors.yellow}Medium: ${penTestResults.medium}${colors.reset}`);
    console.log(`• ${colors.cyan}Low: ${penTestResults.low}${colors.reset}`);
    
    const totalVulns = penTestResults.critical + penTestResults.high + penTestResults.medium + penTestResults.low;
    const securityScore = ((penTestResults.passed / penTestResults.total) * 100).toFixed(1);
    
    console.log(`\n${colors.yellow}Security Score: ${securityScore}%${colors.reset}`);
    
    if (penTestResults.critical > 0) {
        console.log(`\n${colors.red}${colors.bright}🚨 CRITICAL VULNERABILITIES FOUND!${colors.reset}`);
        console.log(`Immediate action required to secure the platform.`);
    } else if (penTestResults.high > 0) {
        console.log(`\n${colors.red}${colors.bright}⚠️  HIGH RISK VULNERABILITIES FOUND!${colors.reset}`);
        console.log(`Security improvements recommended.`);
    } else if (penTestResults.medium > 0) {
        console.log(`\n${colors.yellow}⚡ Medium risk issues found. Review recommended.${colors.reset}`);
    } else if (penTestResults.low > 0) {
        console.log(`\n${colors.cyan}ℹ️  Minor security improvements possible.${colors.reset}`);
    } else {
        console.log(`\n${colors.green}${colors.bright}🛡️  EXCELLENT SECURITY POSTURE!${colors.reset}`);
        console.log(`No critical vulnerabilities detected.`);
    }
}

/**
 * Main penetration test execution
 */
async function runPenTests() {
    console.log(`${colors.magenta}${colors.bright}`);
    console.log('🔍 GYMNASTIKA Platform Penetration Test Suite');
    console.log('============================================');
    console.log(`${colors.reset}`);

    try {
        await testSecurityHeaders();
        await testBufferOverflow();
        await testEncodingAttacks();
        await testCORSSecurity();
        await testHTTPMethodSecurity();
        await testTokenSecurity();
        await testPerformanceDoS();
        
        generatePenTestReport();
        
        process.exit(penTestResults.critical > 0 || penTestResults.high > 0 ? 1 : 0);
        
    } catch (error) {
        console.error(`\n${colors.red}💥 Penetration test execution failed: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

if (require.main === module) {
    runPenTests().catch(console.error);
}

module.exports = { runPenTests, penTestResults };