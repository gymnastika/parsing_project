# Database Migrations

## Persistent Parsing Tasks Table

### Quick Setup

**Рекомендуется**: Используйте упрощенную версию для избежания ошибок копирования

1. **Зайдите в Supabase Dashboard** → SQL Editor
2. **Скопируйте содержимое файла**:
   - `create_parsing_tasks_SIMPLE.sql` (рекомендуется, без комментариев)
   - ИЛИ `create_parsing_tasks_table.sql` (полная версия с комментариями)
3. **Вставьте в SQL Editor** и нажмите "Run"
4. **Проверьте создание**: Должна появиться таблица `parsing_tasks` с 20 колонками

⚠️ **При ошибке "syntax error at end of input"**: Используйте `create_parsing_tasks_SIMPLE.sql`

📖 **Пошаговая инструкция**: См. `STEP_BY_STEP.md`

### Проверка успешности

Выполните этот запрос для проверки:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'parsing_tasks'
ORDER BY ordinal_position;
```

Должны увидеть все колонки таблицы.

### Проверка RLS Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'parsing_tasks';
```

Должны увидеть 5 политик:
- Users can view own parsing tasks
- Users can create own parsing tasks
- Users can update own parsing tasks
- Users can delete own parsing tasks
- Service role full access to parsing tasks

### Тестовый INSERT

После создания таблицы, протестируйте insert:

```sql
-- Замените 'ваш-user-id' на реальный user_id из auth.users
INSERT INTO parsing_tasks (
    user_id,
    task_name,
    website_url,
    task_type,
    status,
    current_stage
) VALUES (
    'ваш-user-id',
    'Test URL Parsing',
    'https://example.com',
    'url-parsing',
    'pending',
    'initializing'
) RETURNING id, task_name, task_type, status;
```

Если запрос выполнился успешно - таблица работает правильно!

## Table Structure

### Main Fields

- **id**: UUID primary key
- **user_id**: FK to auth.users (owner of task)
- **task_name**: Human-readable task name
- **task_type**: 'ai-search' or 'url-parsing'

### Input Data (conditional)

- **search_query**: For ai-search (NULL for url-parsing)
- **website_url**: For url-parsing (NULL for ai-search)
- **category_id**: Optional category reference

### Status & Progress

- **status**: pending → running → completed/failed/cancelled
- **current_stage**: Current pipeline stage name
- **progress**: JSONB with {current, total, stage, message}

### Results Storage

- **openai_thread_id**: OpenAI thread ID
- **generated_queries**: AI-generated queries array
- **apify_runs**: Apify run metadata (JSONB)
- **collected_results**: Raw results (JSONB)
- **final_results**: Processed results (JSONB)

### Timestamps

- **created_at**: Task creation time
- **updated_at**: Last update (auto-updated via trigger)
- **completed_at**: Completion timestamp

## Security

### Row Level Security (RLS)

✅ **Enabled** - Users can only access their own tasks

### Policies

1. **SELECT**: Users see only their tasks
2. **INSERT**: Users create only for themselves
3. **UPDATE**: Users update only their tasks
4. **DELETE**: Users delete only their tasks
5. **Service Role**: Full access for background worker

## Performance

### Indexes Created

- `user_id` - For user task queries
- `status` - For pending/running task queries
- `created_at DESC` - For recent tasks sorting
- `task_type` - For filtering by parsing type

## Background Worker Integration

The table is designed to work with `BackgroundWorker` class:

1. Worker polls for `status = 'pending'` tasks
2. Updates `status = 'running'` when picked up
3. Updates `progress` during execution
4. Sets `status = 'completed'` with `final_results`
5. Sets `status = 'failed'` with `error_message` on errors

## Migration History

- **2025-10-01**: Initial table creation with URL parsing support
