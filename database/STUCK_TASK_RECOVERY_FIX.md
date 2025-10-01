# 🔄 Stuck Task Recovery - Page Reload Resilience

## Дата: 2025-10-01
## Статус: ✅ ИСПРАВЛЕНО

---

## 📋 Проблема из отчета пользователя

**Сообщение пользователя**:
> "Смотри, какая у меня проблема возникла. Я когда сейчас запустил новый парсинг, у меня показался прогресс бар, и я обновил страницу прогресс бар у меня остался, но в консоли я не вижу чтобы продолжался у меня вот этот парсинг. И, соответственно, у меня он просто завис. Прогресс бар. При этом Supabase у меня вроде как отображаются данные, но они как-то то ли не синхронизированы, то ли че непосредственно с интерфейсом и получается очень странно. То есть у меня прогресс бар просто при обновлении теперь постоянно висит и никак не изменяется."

**Данные из Supabase**:
```json
{
  "id": "34d6886d-326d-484a-ac78-a15288881632",
  "task_name": "Не тест",
  "task_type": "ai-search",
  "search_query": "Спарси министерства спорта в дубае",
  "status": "running",
  "current_stage": "query-generation",
  "progress": {
    "stage": "query-generation",
    "total": 100,
    "current": 25,
    "message": "Генерация поисковых запросов ИИ..."
  },
  "updated_at": "2025-10-01 07:10:46.507049+00"
}
```

### Симптомы:
1. ❌ Запущен парсинг → прогресс-бар 25%
2. ❌ Пользователь обновил страницу (F5)
3. ❌ Прогресс-бар "завис" на 25%
4. ❌ В консоли нет активности парсинга
5. ❌ Задача в Supabase: `status='running'`
6. ❌ На Apify запросы не ушли (парсинг фактически остановился)
7. ❌ Задача больше не прогрессирует

---

## 🔍 Root Cause Analysis

### **Проблема 1: Client-side парсинг прерывается при F5**

**Текущая архитектура**:
```javascript
// script.js - Client-side execution
async startAISearch(params) {
    // 1. Create task in DB (status='pending')
    const response = await fetch('/api/parsing-tasks', ...);
    const { taskId } = await response.json();
    this.currentTaskId = taskId;

    // 2. Start client-side pipeline
    await this.orchestrator.runFullPipeline({
        searchQuery: params.searchQuery,
        taskId: taskId,
        updateProgress: (progress) => {
            // Update UI progress bar
            this.updateModernProgress(progress);
        }
    });
}
```

**Что происходит при F5**:
1. JavaScript контекст полностью сбрасывается
2. `this.orchestrator.runFullPipeline()` promise прерывается
3. `this.currentTaskId` теряется
4. Задача в DB остается `status='running'`
5. Парсинг НЕ продолжается

### **Проблема 2: checkAndRestoreActiveTask только восстанавливает UI**

**Текущий код** (`script.js:4837-4917`):
```javascript
async checkAndRestoreActiveTask() {
    const activeTasks = await fetch('/api/parsing-tasks/active?userId=...');

    if (activeTasks.length > 0) {
        const activeTask = activeTasks[0];
        this.currentTaskId = activeTask.id;

        // ✅ Show progress bar
        progressBar.classList.add('active');

        // ✅ Restore progress state
        this.updateModernProgress({
            stage: activeTask.current_stage,
            current: activeTask.progress.current,
            message: activeTask.progress.message
        });

        // ❌ BUT: Does NOT resume parsing!
        // No call to orchestrator.runFullPipeline()
    }
}
```

**Проблема**: Только UI восстанавливается, но сам процесс парсинга НЕ возобновляется.

### **Проблема 3: Background Worker обрабатывает только pending**

**Текущий код** (`lib/background-worker.js:101-140`):
```javascript
async pollForTasks() {
    // Get ONLY pending tasks
    const pendingTasks = await this.tasksService.getPendingTasks(availableSlots);

    // Process each pending task
    for (const task of pendingTasks) {
        await this.startTaskProcessing(task);
    }
}
```

**Проблема**:
- Worker забирает только `status='pending'` задачи
- Когда задача начинается → `status='running'`
- При F5 задача остается `status='running'`
- Worker **НЕ** подхватывает зависшие `running` задачи

### **Проблема 4: Нет механизма обнаружения зависших задач**

**Отсутствуют методы**:
- `getStuckTasks()` - найти зависшие running задачи
- `resetStuckTask()` - сбросить обратно в pending
- `checkAndResetStuckTasks()` - автоматическая проверка

**Результат**: Задачи остаются "зависшими" навсегда.

---

## ✅ Решение

### **Architecture: Stuck Task Recovery System**

```
┌─────────────────────────────────────────┐
│  User starts parsing                    │
│  status: pending → running              │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  User presses F5 (page reload)          │
│  Client-side process terminated         │
│  Task stuck in status='running'         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Background Worker polls (every 5s)     │
│  Checks: updated_at > 2 minutes old?    │
└───────────────┬─────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
   NOT STUCK        STUCK TASK
   (skip)           (reset it)
        │               │
        │               ▼
        │    ┌──────────────────────────┐
        │    │  Reset to pending        │
        │    │  Increment retry_count   │
        │    └──────────┬───────────────┘
        │               │
        │               ▼
        │    ┌──────────────────────────┐
        │    │  Worker picks up task    │
        │    │  Processes from scratch  │
        │    └──────────────────────────┘
        │
        └───────────────────────────────────┐
                                            │
                                            ▼
                                ┌───────────────────┐
                                │  Parsing completes│
                                │  status='completed'│
                                └───────────────────┘
```

---

## 🏗️ Implementation

### **1. ParsingTasksService: Add getStuckTasks()**

**File**: `lib/parsing-tasks-service.js` (lines 199-230)

```javascript
/**
 * Get stuck/orphaned running tasks (for recovery)
 * Tasks in 'running' status for more than timeout threshold
 */
async getStuckTasks(timeoutMinutes = 5, limit = 10) {
    if (!this.enabled) {
        return [];
    }

    try {
        // Calculate cutoff time (tasks older than this are considered stuck)
        const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

        const { data, error } = await this.supabase
            .from('parsing_tasks')
            .select('*')
            .eq('status', 'running')
            .lt('updated_at', cutoffTime) // updated_at older than cutoff
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            throw error;
        }

        return data || [];

    } catch (error) {
        console.error('❌ Error getting stuck tasks:', error);
        throw error;
    }
}
```

**Логика**:
- Ищет задачи с `status='running'`
- `updated_at` старше чем `timeoutMinutes` (по умолчанию 5 минут)
- Это значит задача не обновлялась и застряла
- Возвращает до `limit` зависших задач

### **2. ParsingTasksService: Add resetStuckTask()**

**File**: `lib/parsing-tasks-service.js` (lines 348-369)

```javascript
/**
 * Reset stuck task back to pending for retry
 */
async resetStuckTask(taskId) {
    try {
        const task = await this.getTask(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        const retryCount = (task.retry_count || 0) + 1;

        return this.updateTask(taskId, {
            status: 'pending',
            retry_count: retryCount,
            error_message: `Task was stuck in 'running' status, reset to pending (retry ${retryCount})`
        });
    } catch (error) {
        console.error(`❌ Error resetting stuck task ${taskId}:`, error);
        throw error;
    }
}
```

**Логика**:
- Получает текущую задачу
- Инкрементирует `retry_count`
- Меняет `status='pending'`
- Добавляет `error_message` с объяснением
- Worker подхватит задачу в следующем poll cycle

### **3. BackgroundWorker: Add checkAndResetStuckTasks()**

**File**: `lib/background-worker.js` (lines 143-188)

```javascript
/**
 * Check for stuck tasks and reset them to pending
 */
async checkAndResetStuckTasks() {
    try {
        // Get tasks stuck in 'running' status for more than 2 minutes
        const stuckTasks = await this.tasksService.getStuckTasks(2, 10);

        if (stuckTasks.length === 0) {
            return;
        }

        console.log(`⚠️ Found ${stuckTasks.length} stuck tasks, resetting to pending...`);

        for (const task of stuckTasks) {
            try {
                // Skip if we're currently processing this task
                if (this.runningTasks.has(task.id)) {
                    console.log(`⏭️ Task ${task.id} is actually running, skipping reset`);
                    continue;
                }

                // Check retry limit
                const retryCount = task.retry_count || 0;
                if (retryCount >= this.maxRetries) {
                    console.log(`❌ Task ${task.id} exceeded max retries (${this.maxRetries}), marking as failed`);
                    await this.tasksService.markAsFailed(
                        task.id,
                        `Task exceeded max retry limit (${this.maxRetries} retries)`
                    );
                    continue;
                }

                // Reset task to pending for retry
                console.log(`🔄 Resetting stuck task ${task.id} to pending (retry ${retryCount + 1}/${this.maxRetries})`);
                await this.tasksService.resetStuckTask(task.id);

            } catch (error) {
                console.error(`❌ Error resetting stuck task ${task.id}:`, error);
            }
        }

    } catch (error) {
        console.error('❌ Error checking stuck tasks:', error);
    }
}
```

**Логика**:
1. **Находит зависшие задачи**: `getStuckTasks(2 минуты, 10 задач)`
2. **Пропускает активные**: Если задача в `runningTasks` Map → skip
3. **Проверяет retry limit**: Если `retry_count >= maxRetries` → mark as failed
4. **Сбрасывает в pending**: `resetStuckTask()` для повторной обработки

### **4. BackgroundWorker: Integrate into pollForTasks()**

**File**: `lib/background-worker.js` (lines 101-141)

```javascript
async pollForTasks() {
    try {
        // Check if tasks service is available
        if (!this.tasksService.enabled) {
            return;
        }

        // STEP 1: Check for stuck tasks and reset them
        await this.checkAndResetStuckTasks();

        // STEP 2: Check if we have capacity for more tasks
        const availableSlots = this.maxConcurrentTasks - this.runningTasks.size;
        if (availableSlots <= 0) {
            return;
        }

        // STEP 3: Get pending tasks from database
        const pendingTasks = await this.tasksService.getPendingTasks(availableSlots);

        if (pendingTasks.length === 0) {
            return;
        }

        console.log(`📋 Found ${pendingTasks.length} pending tasks, processing...`);

        // STEP 4: Start processing each task
        for (const task of pendingTasks) {
            if (this.runningTasks.size >= this.maxConcurrentTasks) {
                break;
            }

            await this.startTaskProcessing(task);
        }

    } catch (error) {
        console.error('❌ Error polling for tasks:', error);
    }
}
```

**Ключевое изменение**:
- **STEP 1** добавлен: `checkAndResetStuckTasks()` ПЕРЕД получением pending задач
- Каждые 5 секунд worker проверяет зависшие задачи
- Если находит → reset to pending
- Затем подхватывает эти задачи как обычные pending

---

## 🧪 Тестирование

### **Test Case 1: Stuck Task Recovery After F5**

**Шаги**:
1. Запустить AI Search парсинг
2. Дождаться прогресс-бара (~25%, "query-generation")
3. Нажать F5 (обновить страницу)
4. Проверить Supabase: задача `status='running'`
5. Подождать 2+ минуты
6. Проверить server logs

**Ожидаемый результат**:
- ✅ Background Worker логи: `⚠️ Found 1 stuck tasks, resetting to pending...`
- ✅ Лог: `🔄 Resetting stuck task ... to pending (retry 1/3)`
- ✅ Задача в Supabase: `status='pending'`, `retry_count=1`
- ✅ Worker подхватывает задачу: `📋 Found 1 pending tasks, processing...`
- ✅ Парсинг продолжается с начала
- ✅ Задача завершается: `status='completed'`

### **Test Case 2: Progress Bar Recovery**

**Шаги**:
1. Запустить парсинг
2. Нажать F5
3. Подождать пока Background Worker reset задачу
4. Обновить страницу снова

**Ожидаемый результат**:
- ✅ После второго F5: прогресс-бар НЕ показывается
- ✅ `checkAndRestoreActiveTask()` не находит активных задач
- ✅ UI чистый и готов к новому парсингу
- ✅ Задача обрабатывается на сервере в фоне

### **Test Case 3: Retry Limit Exceeded**

**Шаги**:
1. Запустить парсинг
2. Нажать F5 (retry_count=1)
3. Подождать 2 минуты
4. Нажать F5 снова (retry_count=2)
5. Подождать 2 минуты
6. Нажать F5 третий раз (retry_count=3)
7. Подождать 2 минуты

**Ожидаемый результат**:
- ✅ После 3 retry попыток: задача marked as failed
- ✅ Лог: `❌ Task ... exceeded max retries (3), marking as failed`
- ✅ Supabase: `status='failed'`, `error_message='Task exceeded max retry limit (3 retries)'`
- ✅ Worker больше не трогает эту задачу

### **Test Case 4: Task Actually Running (False Positive)**

**Шаги**:
1. Запустить парсинг на сервере (через Background Worker)
2. Задача выполняется > 2 минуты (большой парсинг)
3. Worker poll cycle проверяет stuck tasks

**Ожидаемый результат**:
- ✅ Worker: `⏭️ Task ... is actually running, skipping reset`
- ✅ Задача НЕ сбрасывается в pending
- ✅ Продолжает выполняться до завершения
- ✅ `runningTasks.has(taskId)` предотвращает reset

### **Test Case 5: Concurrent Stuck Tasks**

**Шаги**:
1. Запустить 5 парсингов
2. Нажать F5 для всех
3. Подождать 2 минуты

**Ожидаемый результат**:
- ✅ Worker: `⚠️ Found 5 stuck tasks, resetting to pending...`
- ✅ Все 5 задач reset to pending
- ✅ Worker обрабатывает по 2 одновременно (`maxConcurrentTasks=2`)
- ✅ Остальные 3 в очереди
- ✅ Все завершаются успешно

---

## 📊 Configuration

### **Background Worker Settings** (`server.js:30-34`)

```javascript
const backgroundWorker = new BackgroundWorker({
    pollInterval: 5000,        // Check every 5 seconds
    maxConcurrentTasks: 2,     // Process max 2 tasks simultaneously
    maxRetries: 3              // Retry failed tasks up to 3 times
});
```

### **Stuck Task Detection**

```javascript
// In checkAndResetStuckTasks()
const stuckTasks = await this.tasksService.getStuckTasks(2, 10);
//                                                       ↑  ↑
//                                                       │  │
//                                      Timeout: 2 minutes │
//                                                Limit: 10 tasks
```

**Параметры**:
- **`timeoutMinutes: 2`** - Задача считается зависшей если `updated_at` старше 2 минут
- **`limit: 10`** - Максимум 10 зависших задач за один poll cycle
- **`maxRetries: 3`** - После 3 неудачных попыток → failed

### **Poll Cycle Flow**

```
Every 5 seconds:
├─ Check stuck tasks (updated_at > 2 min old)
├─ Reset stuck tasks to pending (retry_count++)
├─ Get pending tasks (status='pending')
├─ Process up to 2 tasks concurrently
└─ Wait 5 seconds → repeat
```

---

## 🔗 Связь с другими features

### **Связь с TASK_DELETION_FEATURE.md**:
- **Тот feature**: Удаление задач из истории
- **Этот fix**: Автоматическое восстановление зависших задач
- **Паттерн**: Управление жизненным циклом задач

### **Связь с URL_PARSING_DATA_FIX.md**:
- **Тот fix**: Email валидация при сохранении
- **Этот fix**: Парсинг продолжается даже после F5
- **Паттерн**: Resilient task processing

### **Связь с PHONE_FIELD_REMOVAL.md**:
- **Тот fix**: Упрощение валидации данных
- **Этот fix**: Упрощение recovery логики
- **Паттерн**: Simplicity → Reliability

**Общий паттерн**: Background processing + Resilient task management = Надежная система парсинга

---

## 💡 Future Enhancements

### **1. Real-time Progress Sync via WebSockets**

**Проблема**: Прогресс-бар не обновляется в реальном времени если парсинг на сервере

**Решение**:
```javascript
// Server-side: WebSocket broadcast
wss.clients.forEach(client => {
    if (client.userId === task.user_id) {
        client.send(JSON.stringify({
            type: 'progress',
            taskId: task.id,
            progress: { stage, current, total, message }
        }));
    }
});

// Client-side: WebSocket listener
const ws = new WebSocket('ws://localhost:3001');
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'progress') {
        this.updateModernProgress(data.progress);
    }
};
```

### **2. Task Pause/Resume Instead of Full Restart**

**Проблема**: Stuck task перезапускается с нуля

**Решение**:
```javascript
// Save checkpoint before F5
async saveCheckpoint(taskId, checkpoint) {
    await this.tasksService.updateTask(taskId, {
        checkpoint: {
            stage: 'apify-search',
            completedQueries: ['query1', 'query2'],
            collectedResults: [...]
        }
    });
}

// Resume from checkpoint
async resumeFromCheckpoint(task) {
    const checkpoint = task.checkpoint;
    if (checkpoint) {
        // Continue from last saved stage
        await this.orchestrator.runPipelineFromStage(checkpoint.stage, checkpoint);
    } else {
        // Start from beginning
        await this.orchestrator.runFullPipeline(...);
    }
}
```

### **3. Dead Letter Queue for Failed Tasks**

**Проблема**: После 3 retries задача просто fails без возможности ручного восстановления

**Решение**:
```javascript
// Create DLQ table
CREATE TABLE dead_letter_queue (
    id UUID PRIMARY KEY,
    task_id UUID,
    task_data JSONB,
    failure_reason TEXT,
    retry_count INT,
    created_at TIMESTAMP
);

// Move failed task to DLQ
async moveToDeadLetterQueue(task) {
    await this.supabase.from('dead_letter_queue').insert({
        task_id: task.id,
        task_data: task,
        failure_reason: task.error_message,
        retry_count: task.retry_count
    });
}

// Manual recovery UI
<button onclick="retryFromDLQ(taskId)">Повторить вручную</button>
```

### **4. Health Check Endpoint**

**Проблема**: Нет способа мониторить Background Worker извне

**Решение**:
```javascript
// Server endpoint
app.get('/api/health/worker', (req, res) => {
    const status = backgroundWorker.healthCheck();
    res.json({
        isRunning: status.isRunning,
        runningTasks: status.runningTasksCount,
        lastPollTime: status.lastPollTime,
        stuckTasksFound: status.stuckTasksFound,
        uptime: status.uptime
    });
});

// Client monitoring
setInterval(async () => {
    const health = await fetch('/api/health/worker').then(r => r.json());
    if (!health.isRunning) {
        alert('⚠️ Background Worker остановлен!');
    }
}, 60000); // Check every minute
```

---

## 🎯 Summary

**Проблема**: При обновлении страницы (F5) парсинг прерывался, прогресс-бар "зависал", задача оставалась в `status='running'` и больше не обрабатывалась.

**Root Causes**:
1. **Client-side парсинг**: Выполняется в браузере, F5 прерывает процесс
2. **UI-only recovery**: `checkAndRestoreActiveTask()` восстанавливал только UI, не процесс
3. **Worker ignores running**: Background Worker обрабатывал только `pending` задачи
4. **No stuck detection**: Отсутствовал механизм обнаружения зависших задач

**Решение**:
1. ✅ `getStuckTasks(timeoutMinutes)` - находит задачи в `running` старше N минут
2. ✅ `resetStuckTask(taskId)` - сбрасывает задачу в `pending` с increment `retry_count`
3. ✅ `checkAndResetStuckTasks()` - автоматическая проверка в Background Worker
4. ✅ Интеграция в `pollForTasks()` - STEP 1 перед обработкой pending задач
5. ✅ Retry limit enforcement - после 3 попыток → failed
6. ✅ False positive prevention - пропускает реально работающие задачи

**Результат**:
- ✅ Задача автоматически восстанавливается после F5 (через 2+ минуты)
- ✅ Worker reset задачу в pending
- ✅ Парсинг продолжается с начала
- ✅ Прогресс-бар исчезает при следующем F5 (задача уже processing на сервере)
- ✅ Retry limit предотвращает бесконечные retry
- ✅ Система resilient к page reloads

**Параметры**:
- Poll interval: **5 секунд**
- Stuck timeout: **2 минуты**
- Max retries: **3 попытки**
- Max concurrent: **2 задачи**

**Дата исправления**: 2025-10-01
**Тестирование**: Требуется проверка пользователем (F5 test)
**Коммит**: Готов к push

**Создано с помощью Claude Code** | **GitHub**: https://github.com/gymnastika/parsing_project
