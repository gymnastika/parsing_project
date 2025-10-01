# Быстрое исправление: Удаление колонки Country

**Дата**: 1 октября 2025
**Проблема**: Ошибка "cannot drop columns from view" при попытке удалить колонку country

---

## 🎯 Что произошло

1. ✅ Вы успешно удалили колонку "Страна" из UI приложения
2. ❌ При попытке удалить колонку из БД получили две ошибки:
   - Первая: "cannot drop column... other objects depend on it"
   - Вторая: "cannot drop columns from view"

---

## 🔍 Почему возникли ошибки

### Ошибка 1: Зависимость VIEW
- В БД есть VIEW `user_parsing_stats`
- Он использует `COUNT(DISTINCT country)`
- Нельзя удалить колонку пока VIEW от неё зависит

### Ошибка 2: Неправильная структура VIEW
- Первый SQL скрипт не учитывал `WHERE (user_id = auth.uid())`
- Это условие есть в вашем реальном VIEW
- Без него VIEW пересоздался неправильно

---

## ✅ РЕШЕНИЕ: Используйте правильный SQL скрипт

### Шаг 1: Откройте Supabase SQL Editor

https://supabase.com/dashboard → Ваш проект → SQL Editor → New query

### Шаг 2: Скопируйте ВЕСЬ SQL

Из файла: **`database/REMOVE_COUNTRY_FINAL_CORRECT.sql`**

Или скопируйте отсюда:

```sql
-- Шаг 1: Пересоздать VIEW БЕЗ country
CREATE OR REPLACE VIEW user_parsing_stats AS
SELECT
    user_id,
    COUNT(*) AS total_results,
    COUNT(
        CASE
            WHEN (email IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS results_with_email,
    COUNT(DISTINCT task_name) AS unique_tasks,
    -- count(DISTINCT country) AS unique_countries,  ← УДАЛЕНО
    MIN(parsing_timestamp) AS first_parsing,
    MAX(parsing_timestamp) AS last_parsing,
    ROUND((((COUNT(
        CASE
            WHEN (email IS NOT NULL) THEN 1
            ELSE NULL::integer
        END))::numeric / (COUNT(*))::numeric) * (100)::numeric), 2) AS email_success_rate
FROM parsing_results
WHERE (user_id = auth.uid())  -- ← ВАЖНО: Сохраняем!
GROUP BY user_id;

-- Шаг 2: Удалить индекс
DROP INDEX IF EXISTS idx_parsing_results_country;

-- Шаг 3: Удалить колонку
ALTER TABLE parsing_results DROP COLUMN IF EXISTS country;
```

### Шаг 3: Выполните (Run)

Нажмите кнопку **Run** или `Ctrl+Enter`

### Шаг 4: Проверьте результат

Выполните проверочный запрос:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'parsing_results'
AND column_name = 'country';
```

**Ожидаемый результат**: 0 строк (колонка удалена) ✅

---

## 📝 Ключевые отличия правильного SQL

| Параметр | Первая версия ❌ | Правильная версия ✅ |
|----------|------------------|---------------------|
| WHERE clause | Отсутствовал | `WHERE (user_id = auth.uid())` |
| CASE syntax | Упрощенный | Точное соответствие вашему VIEW |
| Структура | Из документации | Из реальной базы данных |

---

## 🎉 После успешного выполнения

- ✅ Колонка `country` удалена из `parsing_results`
- ✅ Индекс `idx_parsing_results_country` удален
- ✅ VIEW `user_parsing_stats` работает БЕЗ `unique_countries`
- ✅ Сохранен фильтр `WHERE (user_id = auth.uid())`
- ✅ Приложение работает корректно

---

## ⚠️ Напоминание

Эта миграция **НЕ обязательна**!

Приложение работает корректно даже БЕЗ удаления колонки из БД.

Удаление - только для чистоты схемы базы данных.

---

## 🆘 Если что-то пошло не так

1. **Сделайте скриншот ошибки**
2. **Скопируйте полный текст ошибки**
3. **Сообщите разработчику** с деталями

---

**Создано**: Claude Code
**Файлы**:
- `database/REMOVE_COUNTRY_FINAL_CORRECT.sql` - правильный SQL
- `database/COUNTRY_COLUMN_REMOVAL_GUIDE.md` - полная документация
- `database/DIAGNOSE_DATABASE_STRUCTURE.sql` - диагностика
