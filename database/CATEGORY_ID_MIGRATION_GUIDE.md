# Category ID Migration Guide

**Date**: October 1, 2025
**Issue**: 400 Bad Request error when saving parsing results
**Status**: ⚠️ **REQUIRES DATABASE MIGRATION**
**Priority**: 🔴 **CRITICAL** - Contacts not saving to database

---

## 🐛 Problem Description

### Error Symptoms

**After parsing completes**:
```
❌ Error inserting batch 1: Object
❌ Error saving results to database: Object
Failed to load resource: the server responded with a status of 400
```

**Contacts section**:
- Shows "Нет контактов для экспорта" (No contacts to export)
- Table is empty even though parsing succeeded
- Eye icon (👁) shows 0 results

### Console Logs
```
📝 Saving with: task_name="2439039839REIFSDK", category_id="a986f4c5-023a-49da-a07a-c95ddcdb5cfe", user_id="3bea54d0-..."
❌ Error inserting batch 1: Object
```

---

## 🔍 Root Cause

**Code tries to save `category_id` field, but column doesn't exist in `parsing_results` table**

### Schema Mismatch

**Code attempts to INSERT** (script.js:5066-5068):
```javascript
const records = results.map(result => ({
    user_id: supabaseUserId,
    task_name: taskName,
    original_query: originalQuery,
    category_id: categoryId,  // ❌ Column doesn't exist!
    // ... other fields
}));
```

**Current database schema** (parsing_results table):
```sql
-- category_id column is MISSING!
create table parsing_results (
    id uuid primary key,
    user_id uuid not null,
    task_name text not null,
    original_query text not null,
    organization_name text not null,
    email text null,
    -- ... other columns ...
    -- ❌ NO category_id column!
);
```

**Result**: Supabase rejects the INSERT with 400 Bad Request because `category_id` column doesn't exist

---

## ✅ Solution: Database Migration

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Execute Migration SQL

Copy and paste the following SQL from `database/ADD_CATEGORY_ID_COLUMN.sql`:

```sql
-- Add category_id column to parsing_results table
ALTER TABLE parsing_results
ADD COLUMN category_id UUID;

-- Add foreign key constraint
ALTER TABLE parsing_results
ADD CONSTRAINT parsing_results_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES categories(id)
ON DELETE SET NULL;

-- Add index for faster filtering by category
CREATE INDEX idx_parsing_results_category_id
ON parsing_results(category_id);

-- Add column comment for documentation
COMMENT ON COLUMN parsing_results.category_id
IS 'Reference to category for filtering and grouping contacts. NULL for uncategorized results.';
```

**Click "Run" button** ▶️

### Step 3: Verify Migration Success

**Run verification query**:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'parsing_results'
AND column_name = 'category_id';
```

**Expected result**:
```
column_name  | data_type | is_nullable
-------------+-----------+-------------
category_id  | uuid      | YES
```

✅ If you see this result, migration was successful!

---

## 🧪 Testing After Migration

### Test 1: Create New Parsing Task

1. **Create a category** (if not exists):
   - Go to Settings → Categories
   - Create test category "Test Category"

2. **Run new parsing task**:
   - Go to Parsing section
   - Select "Test Category" from dropdown
   - Enter search query
   - Submit parsing

3. **Check results**:
   - Wait for parsing to complete
   - Go to Contacts section
   - **Expected**: Contacts appear in table ✅
   - **Expected**: Category column shows "Test Category" ✅

### Test 2: Verify Category Filtering

1. **Check filter dropdown**:
   - Go to Contacts section
   - Category filter dropdown should show your categories

2. **Test filtering**:
   - Select "Test Category" from filter
   - **Expected**: Only contacts from that category shown ✅

3. **Test export**:
   - Click "Экспорт контактов" button
   - **Expected**: CSV file downloads with category column ✅

---

## 📊 What Changes After Migration

### Before Migration ❌
- Parsing completes but results don't save (400 error)
- Contacts section empty
- Eye icon shows 0 results
- Category filtering doesn't work

### After Migration ✅
- Parsing results save successfully to database
- Contacts appear in Contacts section
- Eye icon shows correct result count
- Category column displays in History and Contacts tables
- Category filtering works
- Export includes category data

### For Old Data
- Old parsing results (before migration) will have `category_id = NULL`
- They will display as "Без категории" (No category) in UI
- They will appear when "Все категории" (All categories) filter is selected

---

## 🔄 Migration Safety

**This migration is 100% safe**:

✅ **Non-destructive**: Adds column, doesn't modify/delete existing data
✅ **Nullable**: Old records continue to work with NULL category_id
✅ **Foreign Key**: ON DELETE SET NULL prevents orphaned references
✅ **Indexed**: Performance optimized for category filtering
✅ **Reversible**: Can rollback if needed (see below)

### Rollback (if needed)

**To undo this migration**:
```sql
DROP INDEX IF EXISTS idx_parsing_results_category_id;
ALTER TABLE parsing_results DROP COLUMN IF EXISTS category_id;
```

**Note**: This will remove category association from all contacts

---

## 📝 Related Files

### Modified Code Files
- ✅ `lib/parsing-tasks-service.js:62` - Saves category_id to parsing_tasks
- ✅ `script.js:5066` - Saves category_id to parsing_results
- ✅ `script.js:1705-1714` - Loads category_id for Contacts display
- ✅ `script.js:1115-1125` - Loads category_id for History display

### Migration Files
- ✅ `database/ADD_CATEGORY_ID_COLUMN.sql` - SQL migration script
- ✅ `database/CATEGORY_ID_MIGRATION_GUIDE.md` - This guide

### Related Documentation
- `database/PARSING_RESULTS_SCHEMA_FIX.md` - Original schema fix
- `database/ALL_FIXES_SUMMARY.md` - Complete fixes summary
- `CLAUDE.md` - Project documentation

---

## 🚀 Next Steps

1. ✅ **Execute SQL migration** in Supabase SQL Editor
2. ✅ **Verify migration** with verification query
3. ✅ **Test new parsing** with category selection
4. ✅ **Verify contacts** appear in Contacts section
5. ✅ **Test category filtering** and export functionality

**After completing these steps**, category functionality will be fully operational! 🎉

---

## ❓ Troubleshooting

### Problem: Migration fails with "column already exists"
**Solution**: Column was already added. Skip migration and proceed to testing.

### Problem: Foreign key constraint fails
**Solution**: Ensure `categories` table exists with proper schema. Run:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'categories';
```

### Problem: 400 error persists after migration
**Solution**:
1. Verify migration with verification query
2. Check browser console for exact error message
3. Clear browser cache and reload page
4. Check Supabase logs for detailed error

### Problem: Old contacts still not showing
**Solution**: Old contacts are in `parsing_tasks.final_results`, not `parsing_results` table. Run new parsing task to populate database properly.

---

**Migration Status**: ⏳ **PENDING USER EXECUTION**
**Estimated Time**: < 1 minute
**Risk Level**: 🟢 **LOW** (Safe, reversible migration)
**Impact**: 🔴 **HIGH** (Fixes critical save functionality)

**Created by**: Claude Code
**Date**: October 1, 2025
