# Migration Guide: Add task_data Column to parsing_tasks

**Date**: October 1, 2025
**Purpose**: Enable user-configurable parsing parameters like `resultsPerQuery`

---

## 🎯 What This Migration Does

Adds `task_data` JSONB column to `parsing_tasks` table to store user-specified configuration:
- ✅ **resultsPerQuery**: Number of results per AI-generated query (10-100)
- ✅ **taskName**: User-friendly task name
- ✅ **searchQuery**: Original search query
- ✅ **categoryId**: Optional category UUID
- ✅ **websiteUrl**: For URL parsing tasks

---

## 📋 Prerequisites

- ✅ Supabase project with `parsing_tasks` table created
- ✅ Database access via SQL Editor
- ✅ `service_role` or `postgres` permissions

---

## 🚀 Migration Steps

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in sidebar
4. Click **New query**

### Step 2: Execute Migration SQL

Copy and paste the entire SQL from `ADD_TASK_DATA_COLUMN.sql`:

```sql
-- Migration: Add task_data column to parsing_tasks table
ALTER TABLE parsing_tasks
ADD COLUMN IF NOT EXISTS task_data JSONB DEFAULT '{}'::jsonb;

-- Add helpful comment
COMMENT ON COLUMN parsing_tasks.task_data IS 'JSON object storing task configuration: taskName, searchQuery, categoryId, resultsPerQuery (10-100), etc.';

-- Create index for faster queries on task_data
CREATE INDEX IF NOT EXISTS idx_parsing_tasks_task_data ON parsing_tasks USING GIN (task_data);
```

### Step 3: Click **Run** (or press Ctrl+Enter)

Expected result: `Success. No rows returned`

### Step 4: Verify Migration

Run verification query:

```sql
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'parsing_tasks'
AND column_name = 'task_data';
```

**Expected output:**

| column_name | data_type | column_default | is_nullable |
|-------------|-----------|----------------|-------------|
| task_data   | jsonb     | '{}'::jsonb    | YES         |

---

## 📊 task_data Structure

### Example for AI Search:
```json
{
  "taskName": "Гимнастика ОАЭ",
  "searchQuery": "гимнастика дубай",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "resultsPerQuery": 50,
  "websiteUrl": null
}
```

### Example for URL Parsing:
```json
{
  "taskName": "Парсинг сайта",
  "searchQuery": null,
  "categoryId": null,
  "resultsPerQuery": null,
  "websiteUrl": "https://example.com"
}
```

---

## ✅ Post-Migration Testing

### Test 1: Create Task with task_data
```javascript
// Frontend (script.js)
const taskData = {
    taskName: "Test Task",
    searchQuery: "тест",
    categoryId: null,
    resultsPerQuery: 75
};

// Should save to database automatically
```

### Test 2: Read task_data from Backend
```javascript
// Backend (server-pipeline-orchestrator.js)
const { task_data } = task;
const resultsPerQuery = task_data?.resultsPerQuery || 50;
console.log('User requested:', resultsPerQuery, 'results per query');
```

### Test 3: Query Tasks by task_data
```sql
-- Find all tasks with resultsPerQuery > 50
SELECT id, task_name, task_data->>'resultsPerQuery' as results_per_query
FROM parsing_tasks
WHERE (task_data->>'resultsPerQuery')::int > 50;
```

---

## 🔍 GIN Index Benefits

The GIN index on `task_data` enables fast queries like:

```sql
-- Find tasks by category
SELECT * FROM parsing_tasks
WHERE task_data @> '{"categoryId": "your-uuid-here"}';

-- Find tasks by resultsPerQuery range
SELECT * FROM parsing_tasks
WHERE (task_data->>'resultsPerQuery')::int BETWEEN 10 AND 50;
```

---

## ⚠️ Important Notes

### Backward Compatibility
- ✅ **Old tasks**: Will have `task_data = {}` (empty object)
- ✅ **New tasks**: Will have full configuration object
- ✅ **Code**: Uses fallback `task_data?.resultsPerQuery || 50`

### Default Values
- **resultsPerQuery**: 50 (if not specified)
- **taskName**: Required field
- **searchQuery**: NULL for url-parsing
- **websiteUrl**: NULL for ai-search
- **categoryId**: Optional UUID

### Data Types
- **JSONB**: Binary JSON for faster queries and indexing
- **GIN Index**: Generalized Inverted Index for JSONB operations
- **Nullable**: YES (allows empty task_data for old tasks)

---

## 🆘 Troubleshooting

### Error: "column task_data already exists"
**Cause**: Migration already executed
**Solution**: Skip migration, column exists

### Error: "permission denied for table parsing_tasks"
**Cause**: Insufficient database permissions
**Solution**: Use `service_role` key or `postgres` role

### Error: "index already exists"
**Cause**: GIN index already created
**Solution**: Skip index creation, it exists

---

## 📚 Related Files

- **Migration SQL**: `database/ADD_TASK_DATA_COLUMN.sql`
- **Frontend code**: `script.js:4767` (taskData creation)
- **Backend code**: `server-pipeline-orchestrator.js:72-95` (task_data extraction)
- **HTML form**: `index.html:340-346` (resultsPerQuery input)

---

**Status**: ✅ **OPTIONAL MIGRATION**
**Impact**: Enables user-configurable results count per query
**Backward Compatible**: Yes (old tasks work without migration)
**Recommended**: Yes (for new feature)

---

**Created by**: Claude Code
**Date**: October 1, 2025
