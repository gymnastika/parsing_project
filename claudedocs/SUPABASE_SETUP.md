# 🗄️ Настройка Supabase для сохранения результатов парсинга

## 📋 Обзор интеграции

Интеграция позволяет:
- ✅ Автоматически сохранять результаты парсинга в Supabase
- ✅ Синхронизировать данные между устройствами
- ✅ Загружать историю парсинга из облачной базы данных
- ✅ Безопасность данных через RLS политики
- ✅ Fallback на localStorage при недоступности БД

## 🛠️ Шаги настройки

### 1. Создание таблицы в Supabase

В SQL Editor вашего Supabase проекта выполните команды из файла `supabase_schema.sql`:

```sql
-- Скопируйте и выполните весь код из supabase_schema.sql
```

### 2. Проверка настроек RLS

Убедитесь, что RLS включена:
```sql
-- Проверить статус RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'parsing_results';

-- Проверить политики
SELECT * FROM pg_policies WHERE tablename = 'parsing_results';
```

### 3. Настройка API ключей

В файле `config/env.js` должны быть настроены:
```javascript
SUPABASE_URL: 'https://your-project.supabase.co'
SUPABASE_ANON_KEY: 'your-anon-key'
```

## 🔄 Как работает интеграция

### Сохранение данных

1. **Автоматическое сохранение**: После завершения парсинга данные автоматически сохраняются в Supabase
2. **Fallback**: Если Supabase недоступна, данные сохраняются только в localStorage
3. **Статус сохранения**: В результатах парсинга добавляется поле `databaseSave` с информацией о статусе

### Загрузка данных

1. **Приоритет Supabase**: При загрузке раздела "База данных" сначала пытается загрузить из Supabase
2. **Fallback на localStorage**: Если Supabase недоступна, загружает из localStorage
3. **Индикатор источника**: В логах указывается источник данных (`supabase` или `local`)

### Просмотр результатов

1. **Базовая информация**: Загружается список задач парсинга
2. **Детальные результаты**: При клике "Просмотр" загружаются полные результаты конкретной задачи
3. **Трансформация данных**: Данные из Supabase автоматически преобразуются в формат интерфейса

## 📊 Структура данных

### Таблица `parsing_results`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор |
| `user_id` | UUID | ID пользователя |
| `task_name` | TEXT | Название задачи парсинга |
| `original_query` | TEXT | Исходный поисковый запрос |
| `organization_name` | TEXT | Название организации |
| `email` | TEXT | Email адрес |
| `description` | TEXT | Описание организации |
| `country` | TEXT | Страна |
| `source_url` | TEXT | Исходный URL |
| `website` | TEXT | Веб-сайт организации |
| `all_emails` | JSONB | Все найденные email'ы |
| `has_contact_info` | BOOLEAN | Есть ли контактная информация |
| `parsing_timestamp` | TIMESTAMPTZ | Дата и время парсинга |

### Функции базы данных

1. **`get_recent_parsing_results()`** - Получить последние результаты
2. **`search_parsing_results()`** - Поиск результатов по критериям
3. **`user_parsing_stats`** - Представление со статистикой пользователя

## 🔧 Методы API

### `gymnastikaDB.saveParsingResults(taskData, results)`
Сохраняет результаты парсинга в базу данных.

**Параметры:**
- `taskData`: `{ taskName, searchQuery }`
- `results`: массив результатов парсинга

**Возвращает:**
```javascript
{
    success: true,
    data: [...], // сохраненные записи
    count: 5,
    message: "Saved 5 parsing results"
}
```

### `gymnastikaDB.getRecentParsingResults(limit, offset)`
Получает последние результаты парсинга.

### `gymnastikaDB.getParsingResultsByTask(taskName)`
Получает все результаты для конкретной задачи.

### `gymnastikaDB.searchParsingResults(searchText, country, hasEmail, limit)`
Поиск результатов по критериям.

## 🚨 Устранение неполадок

### Проблема: Результаты не сохраняются в Supabase

**Проверьте:**
1. Настроены ли API ключи в `config/env.js`
2. Инициализирован ли `gymnastikaDB` (`gymnastikaDB.isInitialized === true`)
3. Аутентифицирован ли пользователь
4. Работают ли RLS политики

**В консоли должно быть:**
```
✅ Supabase client initialized
💾 Saving parsing results to Supabase database...
✅ Successfully saved X results to Supabase database
```

### Проблема: Данные не загружаются из Supabase

**Проверьте:**
1. Подключение к интернету
2. Корректность Supabase URL и ключей
3. RLS политики (пользователь должен видеть только свои данные)

**В консоли должно быть:**
```
🔄 Loading parsing results from Supabase database...
✅ Loaded X parsing tasks from Supabase database
📊 Using supabase data source with X results
```

### Проблема: Ошибки RLS

Если RLS блокирует доступ:
```sql
-- Проверить пользователя
SELECT auth.uid();

-- Проверить политики
SELECT * FROM pg_policies WHERE tablename = 'parsing_results';

-- Временно отключить RLS для отладки (НЕ ДЛЯ ПРОДАКШЕНА!)
ALTER TABLE parsing_results DISABLE ROW LEVEL SECURITY;
```

## 📈 Мониторинг

### Логи успешной интеграции

1. **При парсинге:**
```
💾 Saving parsing results to Supabase database...
✅ Successfully saved 10 results to Supabase database
```

2. **При загрузке:**
```
🔄 Loading parsing results from Supabase database...
✅ Loaded 15 parsing tasks from Supabase database
📊 Using supabase data source with 15 results
```

3. **При просмотре:**
```
🔄 Loading detailed results from Supabase...
✅ Loaded 10 detailed results from Supabase
```

### Логи fallback на localStorage

```
⚠️ Failed to load from Supabase, falling back to localStorage
📊 Using local data source with X results
```

## 🎯 Рекомендации

1. **Регулярные бэкапы**: Настройте автоматические бэкапы Supabase
2. **Мониторинг**: Отслеживайте логи для обнаружения проблем
3. **Тестирование**: Регулярно тестируйте сохранение и загрузку
4. **Безопасность**: Никогда не отключайте RLS в продакшене

## ✅ Проверка настройки

После настройки выполните:

1. **Создайте тестовую задачу парсинга**
2. **Проверьте сохранение в Supabase**:
   ```sql
   SELECT COUNT(*) FROM parsing_results;
   ```
3. **Перезагрузите страницу и проверьте загрузку из БД**
4. **Откройте задачу и проверьте детальные результаты**

Если все шаги выполнены успешно - интеграция настроена корректно! 🎉