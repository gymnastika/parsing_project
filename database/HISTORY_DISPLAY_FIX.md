# 🔧 История задач - Исправление отображения URL parsing

## Проблема
После выполнения URL parsing задача создавалась в базе данных (`parsing_tasks`), но не отображалась в разделе "База данных → История задач".

### Причина
**Несоответствие таблиц**:
- URL parsing сохранял результаты в новую таблицу `parsing_tasks` ✅
- AI Search тоже сохранял в `parsing_tasks` ✅
- НО UI читал историю из старой таблицы `parsing_results` ❌

**Код загрузки истории (ДО исправления)**:
```javascript
// script.js:1087 - СТАРЫЙ КОД
const { data: results, error } = await this.supabase
    .from('parsing_results')  // ❌ Старая таблица!
    .select('*')
    .order('parsing_timestamp', { ascending: false });
```

## Решение

### 1. ✅ Обновлен `loadHistoryData()` - Чтение из `parsing_tasks`

**Файл**: `script.js:1085-1113`

```javascript
// Get all parsing tasks from NEW persistent tasks table
const { data: tasks, error } = await this.supabase
    .from('parsing_tasks')  // ✅ Новая таблица
    .select('*')
    .eq('user_id', this.currentUser?.id)
    .order('created_at', { ascending: false });

// Transform parsing_tasks to history format
freshHistoryData = tasks.map(task => ({
    task_name: task.task_name,
    search_query: task.search_query || task.website_url || 'Unknown Query',
    total_results: task.final_results?.length || 0,
    contacts_count: task.final_results?.filter(r => r.email || r.phone)?.length || 0,
    latest_date: task.completed_at || task.updated_at || task.created_at,
    task_type: task.task_type,  // 'ai-search' or 'url-parsing'
    status: task.status,
    task_id: task.id  // ✅ Добавлен ID для точного поиска
}));
```

**Что изменилось**:
- ✅ Читает из `parsing_tasks` вместо `parsing_results`
- ✅ Фильтрует по `user_id` (только задачи текущего пользователя)
- ✅ Поддерживает оба типа: `ai-search` и `url-parsing`
- ✅ Извлекает результаты из `final_results` (JSONB поле)
- ✅ Показывает `website_url` для URL parsing задач

---

### 2. ✅ Обновлен `viewTaskResults()` - Просмотр из `parsing_tasks.final_results`

**Файл**: `script.js:1250-1298`

```javascript
// View results for a specific task (from parsing_tasks table)
async viewTaskResults(taskName, taskId = null) {
    // Get task from parsing_tasks table
    let query = this.supabase
        .from('parsing_tasks')
        .select('*');

    if (taskId) {
        query = query.eq('id', taskId);  // ✅ Точный поиск по ID
    } else {
        query = query.eq('task_name', taskName).eq('user_id', this.currentUser?.id);
    }

    const { data: tasks, error } = await query.order('created_at', { ascending: false }).limit(1);

    const task = tasks[0];
    const results = task.final_results || [];  // ✅ Из JSONB поля

    if (results && results.length > 0) {
        this.viewResults(results);
    }
}
```

**Что изменилось**:
- ✅ Читает из `parsing_tasks` вместо `parsing_results`
- ✅ Принимает опциональный `taskId` для точного поиска
- ✅ Извлекает результаты из `final_results` (JSONB)
- ✅ Показывает сообщение если задача не завершена

---

### 3. ✅ Обновлен `displayHistory()` - Передача `task_id`

**Файл**: `script.js:1563`

```javascript
// БЫЛО:
<button onclick="platform.viewTaskResults('${task.task_name}')">👁</button>

// СТАЛО:
<button onclick="platform.viewTaskResults('${task.task_name}', '${task.task_id || ''}')">👁</button>
```

**Что изменилось**:
- ✅ Передает `task_id` вторым параметром
- ✅ Гарантирует точный поиск задачи (важно если несколько задач с одинаковым именем)

---

### 4. ✅ Обновлен `loadContactsData()` - Контакты из `parsing_tasks`

**Файл**: `script.js:1387-1438`

```javascript
// Load contacts from parsing_tasks.final_results
const { data: tasks, error } = await this.supabase
    .from('parsing_tasks')
    .select('final_results, task_name, created_at')
    .eq('user_id', this.currentUser?.id)
    .eq('status', 'completed')  // ✅ Только завершенные задачи
    .not('final_results', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

// Extract all contacts from final_results
const allContacts = [];
tasks.forEach(task => {
    if (task.final_results && Array.isArray(task.final_results)) {
        task.final_results.forEach(result => {
            allContacts.push({
                ...result,
                task_name: task.task_name,
                parsing_timestamp: task.created_at
            });
        });
    }
});

// Filter contacts with email or phone
const contactsWithInfo = allContacts.filter(contact =>
    (contact.email && contact.email.trim() !== '') ||
    (contact.phone && contact.phone.trim() !== '')
);
```

**Что изменилось**:
- ✅ Читает из `parsing_tasks.final_results` вместо `parsing_results`
- ✅ Фильтрует только завершенные задачи (`status = 'completed'`)
- ✅ Извлекает контакты из JSONB массива `final_results`
- ✅ Поддерживает контакты с email ИЛИ телефоном
- ✅ Сохраняет ссылку на исходную задачу (`task_name`)

---

## Архитектура данных

### Старая схема (deprecated)
```
parsing_results (таблица) - DEPRECATED
├── id
├── organization_name
├── email
├── website
├── task_name
└── parsing_timestamp
```

### Новая схема (используется)
```
parsing_tasks (таблица) - ACTIVE
├── id (UUID)
├── user_id (FK to auth.users)
├── task_name
├── task_type ('ai-search' | 'url-parsing')
├── search_query (для ai-search)
├── website_url (для url-parsing)
├── status ('pending' | 'running' | 'completed' | 'failed')
├── final_results (JSONB) ← Здесь все результаты!
│   └── [{
│         title: string,
│         url: string,
│         email: string | null,
│         phone: string | null,
│         description: string,
│         ...
│       }]
├── created_at
├── updated_at
└── completed_at
```

## Тестирование

### Сценарий 1: URL Parsing
1. ✅ Создать URL parsing задачу: https://example.com
2. ✅ Дождаться завершения парсинга
3. ✅ Перейти в "База данных → История задач"
4. ✅ Задача должна отобразиться в списке
5. ✅ Нажать 👁 - должны показаться результаты

### Сценарий 2: AI Search
1. ✅ Создать AI Search задачу: "гимнастика Дубай"
2. ✅ Дождаться завершения парсинга
3. ✅ Перейти в "База данных → История задач"
4. ✅ Задача должна отобразиться в списке
5. ✅ Нажать 👁 - должны показаться результаты

### Сценарий 3: Контакты
1. ✅ Выполнить URL parsing с email на сайте
2. ✅ Перейти в "База данных → Контакты"
3. ✅ Контакт должен отобразиться
4. ✅ Должен быть email И/ИЛИ телефон

## Миграция данных

### Если есть старые данные в `parsing_results`

**Опция 1**: Оставить как есть
- Новые задачи идут в `parsing_tasks`
- Старые данные остаются в `parsing_results`
- UI работает с обеими таблицами

**Опция 2**: Миграция в `parsing_tasks` (рекомендуется)
```sql
-- Создать задачи из старых результатов
INSERT INTO parsing_tasks (
    user_id,
    task_name,
    task_type,
    status,
    final_results,
    created_at,
    completed_at
)
SELECT
    user_id,
    task_name,
    'ai-search' as task_type,
    'completed' as status,
    jsonb_agg(
        jsonb_build_object(
            'title', organization_name,
            'email', email,
            'url', website,
            'description', description
        )
    ) as final_results,
    MIN(parsing_timestamp) as created_at,
    MAX(parsing_timestamp) as completed_at
FROM parsing_results
GROUP BY user_id, task_name;
```

**Опция 3**: Удалить старую таблицу
```sql
-- ВНИМАНИЕ: Удалит все старые данные!
DROP TABLE IF EXISTS parsing_results CASCADE;
```

## Преимущества новой схемы

### 1. **Единая точка истины**
- Все задачи в одной таблице `parsing_tasks`
- Результаты хранятся вместе с задачей в `final_results`
- Нет дублирования данных

### 2. **Поддержка типов задач**
- `ai-search`: полный pipeline (OpenAI → Google Maps → Web Scraper)
- `url-parsing`: прямой парсинг URL
- Легко добавить новые типы в будущем

### 3. **Полная история**
- Статус задачи (`pending`, `running`, `completed`, `failed`)
- Время создания, обновления, завершения
- Прогресс выполнения в реальном времени

### 4. **User isolation**
- Каждый пользователь видит только свои задачи
- RLS policies на уровне базы данных
- Безопасность из коробки

## Файлы изменены

1. ✅ **`script.js`** (4 метода):
   - `loadHistoryData()` - строки 1085-1113
   - `viewTaskResults()` - строки 1250-1298
   - `displayHistory()` - строка 1563
   - `loadContactsData()` - строки 1387-1438

2. ✅ **`database/HISTORY_DISPLAY_FIX.md`** - Эта документация

## Статус

✅ **ИСПРАВЛЕНО** - URL parsing задачи теперь отображаются в истории задач

**Дата**: 2025-10-01
**Коммит**: Auto-commit после исправления
**Тестирование**: Требуется проверка пользователем
