# 🔧 БЫСТРОЕ ИСПРАВЛЕНИЕ: Таблица parsing_tasks не найдена

## Проблема
```
ERROR 42P01: relation "parsing_tasks" does not exist
POST /api/parsing-tasks 500 (Internal Server Error)
```

## Причина
Таблица `parsing_tasks` не была создана в Supabase базе данных.

## Решение за 3 шага

### Шаг 1: Откройте Supabase SQL Editor
1. Перейдите в [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. В левом меню найдите **SQL Editor**
4. Нажмите **New query**

### Шаг 2: Выполните миграцию
1. Откройте файл `database/create_parsing_tasks_table.sql` в этом проекте
2. Скопируйте **весь SQL код** (все ~120 строк)
3. Вставьте в SQL Editor в Supabase
4. Нажмите кнопку **Run** (или Ctrl+Enter)

### Шаг 3: Проверьте успешность
Выполните этот запрос для проверки:
```sql
SELECT COUNT(*) FROM parsing_tasks;
```

**Ожидаемый результат**: `0` (таблица пустая, но существует)

## Что было создано?

✅ **Таблица parsing_tasks** - хранит фоновые задачи парсинга
✅ **4 индекса** - для быстрых запросов (user_id, status, created_at, task_type)
✅ **5 RLS политик** - безопасность на уровне строк
✅ **1 триггер** - auto-update для updated_at поля
✅ **Service Role доступ** - для background worker

## Проверка RLS Policies

Выполните этот запрос:
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'parsing_tasks';
```

**Должно показать 5 политик**:
- ✅ Users can view own parsing tasks
- ✅ Users can create own parsing tasks
- ✅ Users can update own parsing tasks
- ✅ Users can delete own parsing tasks
- ✅ Service role full access to parsing tasks

## После миграции

1. **Перезагрузите Railway приложение** (если используете)
2. **Попробуйте URL parsing снова**
3. **Проверьте что задача создается**:
   ```sql
   SELECT id, task_name, task_type, status FROM parsing_tasks ORDER BY created_at DESC LIMIT 5;
   ```

## Если все равно не работает

Проверьте:
1. ✅ Таблица создана: `\dt parsing_tasks` или `SELECT * FROM parsing_tasks LIMIT 1;`
2. ✅ RLS включен: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'parsing_tasks';`
3. ✅ User ID валидный: `SELECT id FROM auth.users WHERE id = 'ваш-user-id';`
4. ✅ Service Role Key в .env: `SUPABASE_SERVICE_ROLE_KEY=...`

## Важные примечания

⚠️ **Service Role Key**: Для background worker нужен SERVICE_ROLE_KEY в .env (не ANON_KEY!)
⚠️ **User Authentication**: Убедитесь что вы залогинены перед попыткой парсинга
⚠️ **Railway Deployment**: После миграции перезапустите Railway service

## Дополнительная информация

📖 Полная документация: `database/README.md`
📋 SQL миграция: `database/create_parsing_tasks_table.sql`
📝 Архитектура: `CLAUDE.md` → раздел "Database Setup"
