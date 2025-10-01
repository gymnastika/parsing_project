# Category Save Fix - Quick Summary

**Date**: October 1, 2025
**Issue**: Parsing results not saving (400 error)
**Root Cause**: Missing `category_id` column in `parsing_results` table
**Fix**: Database migration required

---

## 🔴 CRITICAL: Immediate Action Required

### Problem
After parsing completes successfully, contacts don't save to database:
```
❌ Error inserting batch 1: Object
❌ Error saving results to database: Object
HTTP 400 Bad Request
```

### Root Cause
Code tries to save `category_id` but column doesn't exist in database schema.

### Quick Fix (1 minute)

**Open Supabase SQL Editor and run**:

```sql
-- Add category_id column
ALTER TABLE parsing_results ADD COLUMN category_id UUID;

-- Add foreign key
ALTER TABLE parsing_results
ADD CONSTRAINT parsing_results_category_id_fkey
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_parsing_results_category_id ON parsing_results(category_id);
```

**That's it!** ✅

---

## Verification

**Check migration success**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'parsing_results' AND column_name = 'category_id';
```

**Should return**: `category_id | uuid`

---

## Test After Migration

1. **Run new parsing task** with category selected
2. **Check Contacts section** → contacts should appear ✅
3. **Test category filter** → filtering should work ✅
4. **Test export** → CSV should download ✅

---

## Full Documentation

📖 **Detailed Guide**: `database/CATEGORY_ID_MIGRATION_GUIDE.md`
📜 **SQL Script**: `database/ADD_CATEGORY_ID_COLUMN.sql`

---

## What This Fixes

✅ Contacts save to database successfully
✅ Category column appears in History and Contacts tables
✅ Category filtering works correctly
✅ Export includes category data
✅ No more 400 errors

---

**Status**: ⏳ Waiting for user to execute SQL migration
**Priority**: 🔴 CRITICAL
**Time**: < 1 minute
**Risk**: 🟢 LOW (safe, reversible)
