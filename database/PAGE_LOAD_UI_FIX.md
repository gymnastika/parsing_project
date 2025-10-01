# 🔧 Page Load UI State Fix

## Дата: 2025-10-01
## Статус: ✅ ИСПРАВЛЕНО

---

## 📋 Проблемы из отчета пользователя

**Сообщение пользователя**: "Теперь у меня в разделе AI поиск пропала кнопка начать парсинг, и у меня сейчас на 2 вкладках (AI поиск и По URL) постоянно висит прогресс бар при обновлении страницы. И плюс ещё кнопка пропала"

**Скриншот**: `Снимок экрана 2025-10-01 в 10.46.25.png`

### Симптомы:
1. ❌ Кнопка "Начать парсинг" **ОТСУТСТВУЕТ** в AI Search форме
2. ❌ Прогресс-бар **постоянно виден** при перезагрузке страницы
3. ❌ Это происходит на ОБЕИХ вкладках (AI поиск и По URL)
4. ❌ Даже когда нет активного парсинга

---

## 🔍 Root Cause Analysis

### Проблема 1: Generic selector в `checkAndRestoreActiveTask()`

**Файл**: `script.js:4569`

**Код при загрузке страницы**:
```javascript
async checkAndRestoreActiveTask() {
    // ...
    const activeTask = activeTasks[0];
    this.currentTaskId = activeTask.id;

    // ❌ GENERIC SELECTOR - находит только ПЕРВУЮ кнопку!
    const submitBtn = document.querySelector('.submit-btn');
    const progressBar = document.getElementById('modernProgressBar');
    const progressDesc = document.getElementById('progressDescription');

    if (submitBtn) submitBtn.style.display = 'none';  // ❌ Скрывает ОДНУ кнопку!
    if (progressBar) progressBar.classList.add('active');  // ❌ Показывает прогресс-бар!
    // ...
}
```

**Последствия**:
1. Находит `.submit-btn` → это AI Search кнопка (первая в DOM)
2. Скрывает ТОЛЬКО AI Search кнопку
3. URL Parsing кнопка остается видимой
4. Прогресс-бар становится активным

### Проблема 2: Восстановление "застрявших" задач

**Файл**: `script.js:4547-4594`

**Логика**:
```javascript
// Получаем активные задачи из БД
const activeTasks = await response.json();
if (!activeTasks || activeTasks.length === 0) return;

// Берем первую задачу
const activeTask = activeTasks[0];
this.currentTaskId = activeTask.id;

// Восстанавливаем UI для ЛЮБОЙ активной задачи
// Даже если она "застряла" в статусе 'running' часы/дни назад!
```

**Проблема**: Задачи которые завершились с ошибкой или были прерваны могут оставаться в статусе `'running'` в базе данных. При перезагрузке страницы эти "зомби" задачи восстанавливаются!

### Проблема 3: Нет fallback для чистого состояния

Если есть активные задачи (даже старые), метод восстанавливает UI. Если задач НЕТ, метод просто возвращается (`return`), НЕ очищая UI!

```javascript
if (!activeTasks || activeTasks.length === 0) return;  // ❌ Не вызывает resetParsingUI()!
```

---

## ✅ Исправления

### Fix 1: Специфичные селекторы для обеих кнопок

**Файл**: `script.js:4589-4599`

**Было**:
```javascript
const submitBtn = document.querySelector('.submit-btn');  // ❌ Generic
if (submitBtn) submitBtn.style.display = 'none';
```

**Стало**:
```javascript
// ✅ FIX: Use specific selectors for both buttons
const aiSearchBtn = document.querySelector('#parsingForm .submit-btn');
const urlParsingBtn = document.querySelector('#urlParsingForm .submit-btn');
const progressBar = document.getElementById('modernProgressBar');
const progressDesc = document.getElementById('progressDescription');

// Hide both submit buttons
if (aiSearchBtn) {
    aiSearchBtn.style.display = 'none';
    console.log('✅ AI Search button hidden for active task');
}
if (urlParsingBtn) {
    urlParsingBtn.style.display = 'none';
    console.log('✅ URL Parsing button hidden for active task');
}

// Show progress bar
if (progressBar) {
    progressBar.classList.add('active');
    console.log('✅ Progress bar activated for active task');
}
if (progressDesc) {
    progressDesc.classList.add('active');
}
```

### Fix 2: Проверка возраста задачи (30-минутный timeout)

**Файл**: `script.js:4565-4578`

**Добавлено**:
```javascript
// Get the most recent active task
const activeTask = activeTasks[0];

// ✅ Check if task is actually recent (within last 30 minutes)
const taskTime = new Date(activeTask.created_at).getTime();
const now = Date.now();
const thirtyMinutes = 30 * 60 * 1000;

if (now - taskTime > thirtyMinutes) {
    console.log('⏰ Active task is too old (>30min), not restoring UI');
    // Task is too old, likely stuck - don't restore UI
    this.resetParsingUI();
    return;
}
```

**Логика**:
- Если задача создана >30 минут назад → считаем "застрявшей"
- НЕ восстанавливаем UI для старых задач
- Вызываем `resetParsingUI()` для очистки состояния

### Fix 3: Гарантированная очистка UI когда нет задач

**Файл**: `script.js:4560-4564`

**Было**:
```javascript
if (!activeTasks || activeTasks.length === 0) return;  // ❌ Просто выход
```

**Стало**:
```javascript
if (!activeTasks || activeTasks.length === 0) {
    // ✅ No active tasks - ensure UI is clean
    this.resetParsingUI();
    return;
}
```

### Fix 4: Fallback при ошибках

**Файл**: `script.js:4624-4628`

**Было**:
```javascript
} catch (error) {
    console.warn('⚠️ Failed to restore active task:', error.message);
    // Don't block app initialization if restore fails
}
```

**Стало**:
```javascript
} catch (error) {
    console.warn('⚠️ Failed to restore active task:', error.message);
    // Ensure clean UI if restore fails
    this.resetParsingUI();
}
```

---

## 🧪 Тестирование

### Тест 1: Страница загружается с чистым UI когда нет задач
**Шаги**:
1. Убедиться что нет активных задач в БД
2. Обновить страницу (F5)
3. Проверить UI

**Ожидаемый результат**:
- ✅ Обе кнопки "Начать парсинг" видимы (AI Search и URL Parsing)
- ✅ Прогресс-бар скрыт (нет класса 'active')
- ✅ Консоль: `✅ No active tasks - ensure UI is clean`

### Тест 2: Старые "застрявшие" задачи НЕ восстанавливаются
**Шаги**:
1. Создать задачу в БД со статусом 'running' и старой датой (>30 минут)
2. Обновить страницу
3. Проверить UI и консоль

**Ожидаемый результат**:
- ✅ Обе кнопки видимы
- ✅ Прогресс-бар скрыт
- ✅ Консоль: `⏰ Active task is too old (>30min), not restoring UI`

### Тест 3: Недавние активные задачи восстанавливаются правильно
**Шаги**:
1. Запустить парсинг
2. Обновить страницу СРАЗУ (пока парсинг активен)
3. Проверить UI

**Ожидаемый результат**:
- ✅ ОБЕ кнопки скрыты
- ✅ Прогресс-бар виден с правильным прогрессом
- ✅ Консоль: `✅ AI Search button hidden for active task`
- ✅ Консоль: `✅ URL Parsing button hidden for active task`
- ✅ Консоль: `✅ Progress bar activated for active task`

### Тест 4: Ошибки восстановления не ломают UI
**Шаги**:
1. Симулировать ошибку API (отключить сеть или изменить endpoint)
2. Обновить страницу
3. Проверить UI

**Ожидаемый результат**:
- ✅ Обе кнопки видимы (fallback на `resetParsingUI()`)
- ✅ Прогресс-бар скрыт
- ✅ Приложение инициализируется без ошибок

---

## 📊 Влияние на систему

### До исправлений:
- ❌ Generic selector скрывал ТОЛЬКО AI Search кнопку
- ❌ Прогресс-бар показывался для ЛЮБОЙ активной задачи (даже старой)
- ❌ "Застрявшие" задачи восстанавливались при каждой загрузке
- ❌ Нет fallback для чистого UI при отсутствии задач
- ❌ Пользователь не мог запустить новый парсинг

### После исправлений:
- ✅ Специфичные селекторы управляют ОБЕИМИ кнопками
- ✅ Только НЕДАВНИЕ задачи (<30 мин) восстанавливаются
- ✅ Старые "застрявшие" задачи игнорируются
- ✅ Гарантированная очистка UI при отсутствии задач
- ✅ Fallback при ошибках
- ✅ Пользователь всегда может запустить парсинг

---

## 🔗 Связь с другими fixes

### AI_SEARCH_FIXES.md:
- **Fix 3**: Исправил селектор в `startUrlParsing()` (`#urlParsingForm .submit-btn`)
- **Этот fix**: Исправил селектор в `checkAndRestoreActiveTask()` (тот же паттерн)

### PROGRESS_BAR_PERSISTENCE_FIX.md:
- **Тот fix**: Добавил `resetParsingUI()` в `switchTab()`
- **Этот fix**: Добавил `resetParsingUI()` в `checkAndRestoreActiveTask()` как fallback

### PROGRESS_BAR_TAB_SWITCH_FIX.md:
- **Тот fix**: Проверка `currentTaskId` в `switchTab()` перед сбросом
- **Этот fix**: Проверка возраста задачи перед восстановлением `currentTaskId`

**Общий паттерн**: Специфичные селекторы + умная логика восстановления состояния

---

## 💡 Дополнительные рекомендации

### 1. Автоматическая очистка "застрявших" задач

Добавить в backend cron job для автоматической очистки:
```javascript
// Каждые 30 минут помечать старые 'running' задачи как 'failed'
UPDATE parsing_tasks
SET status = 'failed', error = 'Task timeout - exceeded 30 minutes'
WHERE status = 'running'
  AND created_at < NOW() - INTERVAL '30 minutes'
```

### 2. Heartbeat для активных задач

Парсинг должен периодически отправлять "живой" сигнал:
```javascript
setInterval(async () => {
    if (this.currentTaskId) {
        await fetch(`/api/parsing-tasks/${this.currentTaskId}/heartbeat`, {
            method: 'POST'
        });
    }
}, 60000); // Каждую минуту
```

### 3. Визуальный индикатор восстановленных задач

При восстановлении показать уведомление:
```javascript
this.showNotification('🔄 Восстановлен активный парсинг', 'info');
```

---

## 🎯 Summary

**Проблемы**:
1. Кнопка "Начать парсинг" отсутствовала при загрузке страницы
2. Прогресс-бар постоянно виден после перезагрузки
3. Generic selector скрывал только одну кнопку

**Root Causes**:
1. `checkAndRestoreActiveTask()` использовал generic selector `.submit-btn`
2. Восстанавливались ЛЮБЫЕ активные задачи (даже "застрявшие" старые)
3. Нет fallback для очистки UI при отсутствии задач

**Решения**:
1. ✅ Специфичные селекторы для обеих кнопок (`#parsingForm .submit-btn`, `#urlParsingForm .submit-btn`)
2. ✅ Проверка возраста задачи (<30 минут для восстановления)
3. ✅ Вызов `resetParsingUI()` когда нет задач или при ошибках
4. ✅ Детальное логирование для отладки

**Результат**:
- ✅ Обе кнопки корректно управляются при загрузке
- ✅ Только недавние активные задачи восстанавливаются
- ✅ Старые "застрявшие" задачи игнорируются
- ✅ Гарантированное чистое UI при отсутствии задач

**Дата исправления**: 2025-10-01
**Тестирование**: Требуется проверка пользователем
**Коммит**: Готов к push
