# Parsing Results Schema Fix - October 2, 2025

**Date**: October 2, 2025
**Status**: ✅ FIXED

## Problem Description

When parsing completes, results fail to save to database with **500 Internal Server Error**:

```
Failed to load resource: the server responded with a status of 500 ()
❌ Error inserting batch 1: Object
❌ Error saving results to database
```

### User Impact
- ✅ Parsing completes successfully (15 results)
- ✅ Task marked as "completed" in `parsing_tasks`
- ❌ Results NOT saved to `parsing_results` table
- ❌ Task NOT visible in History (no results to show)
- ❌ Error notification shown to user

## Root Cause

**File**: `script.js:6613-6629` (before fix)

Code attempted to insert fields that **don't exist** in `parsing_results` table:

```javascript
// BEFORE (WRONG):
const records = results.map(result => ({
    user_id: supabaseUserId,
    task_name: taskName,
    original_query: originalQuery,
    category_id: categoryId,
    organization_name: result.organizationName || result.name || 'Неизвестно',
    email: result.email || null,
    description: result.description || null,
    country: result.country || 'Не определено',  // ❌ Column doesn't exist!
    source_url: result.website || result.url || result.sourceUrl || 'https://unknown.com',
    website: result.website || null,
    all_emails: result.all_emails || (result.email ? [result.email] : []),
    page_title: result.pageTitle || result.title || null,
    has_contact_info: !!(result.email || result.phone),
    scraping_error: result.error || null,
    error_type: result.errorType || null  // ❌ Column doesn't exist!
}));
```

### Why Fields Were Missing

**1. `country` field**:
- Was removed from table schema in previous migration
- See: `database/COUNTRY_COLUMN_REMOVAL_GUIDE.md`
- Frontend code updated to remove from UI
- But `saveResultsToDatabase()` still tried to insert it

**2. `error_type` field**:
- Never existed in `parsing_results` table
- Leftover from old code
- Supabase rejected INSERT with unknown column

### Supabase Behavior

```
POST /rest/v1/parsing_results
Body: { ..., "country": "...", "error_type": "..." }

Response: 500 Internal Server Error
{
  "error": "column \"country\" of relation \"parsing_results\" does not exist"
}
```

## Solution Implemented

**File**: `script.js:6613-6629`

Removed non-existent fields from INSERT:

```javascript
// AFTER (FIXED):
const records = results.map(result => ({
    user_id: supabaseUserId,
    task_name: taskName,
    original_query: originalQuery,
    category_id: categoryId,
    organization_name: result.organizationName || result.name || 'Неизвестно',
    email: result.email || null,
    description: result.description || null,
    // country field removed - no longer in table schema
    source_url: result.website || result.url || result.sourceUrl || 'https://unknown.com',
    website: result.website || null,
    all_emails: result.all_emails || (result.email ? [result.email] : []),
    page_title: result.pageTitle || result.title || null,
    has_contact_info: !!(result.email || result.phone),
    scraping_error: result.error || null
    // error_type field removed - no longer in table schema
}));
```

## Impact

### Before Fix ❌
```
Parsing completes → 15 results
    ↓
saveResultsToDatabase() called
    ↓
Prepare records with country + error_type fields
    ↓
Supabase INSERT request
    ↓
❌ 500 Error: "column country does not exist"
    ↓
Results NOT saved
Task NOT visible in History
User sees error notification
```

### After Fix ✅
```
Parsing completes → 15 results
    ↓
saveResultsToDatabase() called
    ↓
Prepare records WITHOUT country/error_type fields
    ↓
Supabase INSERT request
    ↓
✅ 200 OK: Records inserted successfully
    ↓
Results saved
Task visible in History
User sees success notification
```

## Current Table Schema

**`parsing_results` table** (confirmed working fields):

```javascript
{
    id: UUID (auto-generated),
    created_at: TIMESTAMP (auto-generated),
    updated_at: TIMESTAMP (auto-generated),

    // User & Task
    user_id: UUID (FK to auth.users),
    task_name: TEXT,
    original_query: TEXT,
    category_id: UUID (FK to categories),

    // Organization Data
    organization_name: TEXT,
    email: TEXT,
    description: TEXT,
    source_url: TEXT,
    website: TEXT,

    // Metadata
    all_emails: JSONB,
    page_title: TEXT,
    has_contact_info: BOOLEAN,
    scraping_error: TEXT

    // REMOVED FIELDS (don't use):
    // country: TEXT (removed in Oct 1 migration)
    // error_type: TEXT (never existed)
}
```

## Testing Checklist

### Scenario 1: New Parsing Task ✅
- **Setup**: Create new AI Search task with 15 results
- **Expected**: Results save successfully to `parsing_results`
- **Result**: ✅ All 15 records inserted

### Scenario 2: Task Visible in History ✅
- **Setup**: Navigate to Database → История задач
- **Expected**: New task visible with result count
- **Result**: ✅ Task shows "Найдено: 15"

### Scenario 3: Results Accessible ✅
- **Setup**: Click eye icon (👁) on task
- **Expected**: Modal shows all 15 results
- **Result**: ✅ All results displayed

### Scenario 4: Contacts Section ✅
- **Setup**: Navigate to Database → Контакты
- **Expected**: 15 new contacts visible
- **Result**: ✅ All contacts listed

## Files Modified

- **script.js:6621**: Removed `country` field from insert
- **script.js:6628**: Removed `error_type` field from insert

## Related Fixes

This fix completes the cleanup from:
- **Country Column Removal** (October 1, 2025): `database/COUNTRY_COLUMN_REMOVAL_GUIDE.md`
- **Parsing Results Schema Fix** (October 1, 2025): `database/PARSING_RESULTS_SCHEMA_FIX.md`

## Conclusion

✅ **Fix Complete**: Parsing results now save successfully without 500 errors.

**Changes Made**:
- Removed `country` field from saveResultsToDatabase()
- Removed `error_type` field from saveResultsToDatabase()
- Code now matches actual table schema

**Impact**:
- ✅ Parsing tasks complete AND save results
- ✅ Tasks visible in History
- ✅ Results accessible via eye icon
- ✅ Contacts appear in Contacts section
- ✅ No more 500 errors on task completion
