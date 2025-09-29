# Production Values Restoration Guide

## Critical Changes Required for Full Performance

### 1. Server Pipeline Orchestrator
**File**: `lib/server-pipeline-orchestrator.js`

**Line 227**:
```javascript
// CURRENT (testing):
const fixedBuffer = 30; // TESTING: Reduced from 500 to 30

// CHANGE TO (production):
const fixedBuffer = 500; // Production: 500 results per query
```

**Line 74**:
```javascript
// CURRENT (testing):
const resultCount = 5; // TESTING: Reduced from 50 to 5

// CHANGE TO (production):
const resultCount = 50; // Production: 50 final results
```

### 2. Client Pipeline Orchestrator
**File**: `lib/pipeline-orchestrator.js`

**Line 281**:
```javascript
// CURRENT (testing):
const fixedBuffer = 30; // TESTING: Reduced from 500 to 30

// CHANGE TO (production):
const fixedBuffer = 500; // Production: 500 results per query
```

### 3. Server Apify Client
**File**: `lib/server-apify-client.js`

**Line 94**:
```javascript
// CURRENT (testing):
maxItems = 10, // TESTING: Reduced from 500 to 10

// CHANGE TO (production):
maxItems = 500, // Production: 500 items per search
```

### 4. Client Apify Client (if needed)
**File**: `lib/apify-client.js`

**Lines to check for testing limits and restore to production values**

## Expected Performance Impact

After restoration:
- **~1500 total results** instead of 30 (50x increase)
- **3-10 concurrent requests** instead of 1 (3-10x parallelization)
- **2-3 minutes total time** instead of 5-10 minutes (3-5x faster)
- **Much better data quality** due to larger result pool

## Verification Steps

1. Check all `fixedBuffer` values = 500
2. Check all `maxItems` values = 500
3. Check all `resultCount` values = 50
4. Test with small query first
5. Monitor performance and memory usage

## Rollback Plan

If performance issues occur:
1. Reduce `maxConcurrent` from 10 to 5
2. Reduce `fixedBuffer` from 500 to 300
3. Monitor and adjust based on actual usage
