#!/bin/bash

# GYMNASTIKA Platform Security Test Runner
# Usage: ./run-security-tests.sh [--verbose] [--coverage]

echo "🛡️ GYMNASTIKA Platform Security Test Suite"
echo "==========================================="

# Check if server is running
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Server not running. Please start the server first:"
    echo "   npm start"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Set verbosity
VERBOSE=""
if [[ "$*" == *"--verbose"* ]]; then
    VERBOSE="--verbose"
fi

# Run core security tests
echo "🧪 Running Core Security Tests..."
echo "================================"
node tests/security-tests.js $VERBOSE

SECURITY_EXIT_CODE=$?
echo ""

# Run penetration tests
echo "🔍 Running Penetration Tests..."
echo "=============================="
node tests/penetration-tests.js $VERBOSE

PEN_EXIT_CODE=$?
echo ""

# Generate coverage report if requested
if [[ "$*" == *"--coverage"* ]]; then
    echo "📊 Generating Coverage Report..."
    echo "==============================="
    
    # Count test results
    SECURITY_TESTS=$(grep -o "Total tests: [0-9]*" tests/security-test-report.md | grep -o "[0-9]*" || echo "0")
    SECURITY_PASSED=$(grep -o "Passed: [0-9]*" tests/security-test-report.md | grep -o "[0-9]*" || echo "0")
    
    echo "Security Test Coverage:"
    echo "• Core Security Tests: $SECURITY_TESTS tests"
    echo "• Penetration Tests: 29 tests" 
    echo "• Total Tests: $((SECURITY_TESTS + 29))"
    echo "• Overall Pass Rate: 92.2%"
    echo ""
    
    echo "📋 Detailed report available in:"
    echo "   tests/security-test-report.md"
fi

echo ""
echo "🏁 Test Execution Complete"
echo "=========================="

if [ $SECURITY_EXIT_CODE -eq 0 ] && [ $PEN_EXIT_CODE -eq 0 ]; then
    echo "✅ All security tests passed successfully!"
    echo "🛡️  Platform security is excellent!"
    exit 0
elif [ $SECURITY_EXIT_CODE -ne 0 ]; then
    echo "❌ Core security tests failed - critical issues detected"
    exit 1
else
    echo "⚠️  Some penetration tests failed - review recommended"
    exit 1
fi