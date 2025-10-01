# 📋 ПОШАГОВАЯ ИНСТРУКЦИЯ: Создание таблицы parsing_tasks

## ⚠️ ВАЖНО: Ошибка "syntax error at end of input"

**Причина**: SQL код был скопирован не полностью (только начало CREATE TABLE)

**Решение**: Используйте упрощенную версию ниже

---

## ✅ МЕТОД 1: Упрощенная версия (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Откройте Supabase SQL Editor
1. Зайдите на https://app.supabase.com
2. Выберите ваш проект
3. В левом меню: **SQL Editor**
4. Кнопка: **New query**

### Шаг 2: Скопируйте SQL

**Используйте файл**: `database/create_parsing_tasks_SIMPLE.sql`

**ИЛИ скопируйте напрямую отсюда** (60 строк, весь SQL в одном блоке):

```sql
CREATE TABLE IF NOT EXISTS parsing_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    task_type TEXT NOT NULL DEFAULT 'ai-search',
    search_query TEXT,
    website_url TEXT,
    category_id UUID,
    status TEXT NOT NULL DEFAULT 'pending',
    current_stage TEXT NOT NULL DEFAULT 'initializing',
    progress JSONB DEFAULT '{"current": 0, "total": 0, "stage": "initializing", "message": ""}'::jsonb,
    openai_thread_id TEXT,
    generated_queries TEXT[],
    apify_runs JSONB,
    collected_results JSONB,
    final_results JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_task_type CHECK (task_type IN ('ai-search', 'url-parsing'))
);

CREATE INDEX IF NOT EXISTS idx_parsing_tasks_user_id ON parsing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_parsing_tasks_status ON parsing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_parsing_tasks_created_at ON parsing_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parsing_tasks_task_type ON parsing_tasks(task_type);

CREATE OR REPLACE FUNCTION update_parsing_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parsing_tasks_updated_at
    BEFORE UPDATE ON parsing_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_parsing_tasks_updated_at();

ALTER TABLE parsing_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parsing tasks" ON parsing_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own parsing tasks" ON parsing_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own parsing tasks" ON parsing_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own parsing tasks" ON parsing_tasks FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to parsing tasks" ON parsing_tasks FOR ALL USING (auth.jwt()->>'role' = 'service_role') WITH CHECK (auth.jwt()->>'role' = 'service_role');

GRANT ALL ON parsing_tasks TO authenticated;
GRANT ALL ON parsing_tasks TO service_role;
```

### Шаг 3: Проверьте что скопировали ВСЁ

**КРИТИЧНО**: Убедитесь что последняя строка:
```sql
GRANT ALL ON parsing_tasks TO service_role;
```

Если последняя строка другая - скопировали не полностью!

### Шаг 4: Выполните SQL
1. Вставьте в SQL Editor
2. Нажмите **Run** (или Ctrl+Enter)
3. Должно показать: **Success. No rows returned**

### Шаг 5: Проверка успешности

Выполните:
```sql
SELECT COUNT(*) FROM parsing_tasks;
```

**Ожидаемый результат**: `0` (таблица пустая но существует)

Если ошибка - таблица не создана.

---

## 🔍 ПРОВЕРКА ДЕТАЛЕЙ

### Проверка колонок (должно быть 20)
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'parsing_tasks'
ORDER BY ordinal_position;
```

### Проверка индексов (должно быть 5: 1 primary key + 4 созданных)
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'parsing_tasks';
```

### Проверка RLS (должно быть 5 policies)
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'parsing_tasks';
```

### Проверка триггера (должен быть 1)
```sql
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'parsing_tasks';
```

---

## ❌ Что делать если НЕ работает

### Ошибка: "syntax error at end of input"
**Причина**: Скопировали не весь SQL
**Решение**: Скопируйте снова, проверьте последнюю строку должна быть `GRANT ALL ON parsing_tasks TO service_role;`

### Ошибка: "table already exists"
**Решение**: Удалите и пересоздайте:
```sql
DROP TABLE IF EXISTS parsing_tasks CASCADE;
-- Потом выполните create_parsing_tasks_SIMPLE.sql снова
```

### Ошибка: "auth.users does not exist"
**Причина**: Supabase Auth не настроен
**Решение**: Убедитесь что в вашем проекте включен Supabase Authentication

### Ошибка: "permission denied"
**Причина**: Используете не admin user
**Решение**: Используйте postgres user или service_role в SQL Editor

---

## ✅ МЕТОД 2: Через файл (альтернатива)

Если копирование не работает:

1. Скачайте файл `database/create_parsing_tasks_SIMPLE.sql` из проекта
2. В Supabase SQL Editor нажмите кнопку **Upload**
3. Выберите скачанный файл
4. Нажмите **Run**

---

## 🎯 После успешного создания

1. **Перезапустите приложение** (Railway/локально)
2. **Попробуйте URL parsing снова**
3. **Проверьте что задача создалась**:
```sql
SELECT id, task_name, task_type, status
FROM parsing_tasks
ORDER BY created_at DESC
LIMIT 5;
```

4. **Если видите свою задачу** - всё работает! ✅

---

## 📝 Примечания

- ✅ Упрощенная версия **идентична** полной, просто без комментариев
- ✅ Все RLS политики и индексы включены
- ✅ Service Role доступ для background worker настроен
- ✅ Работает для обоих типов: 'ai-search' и 'url-parsing'

## 🆘 Нужна помощь?

Если всё равно не работает, отправьте:
1. Точный текст ошибки из Supabase
2. Скриншот SQL Editor с вашим запросом
3. Результат: `SELECT version();` (версия PostgreSQL)
