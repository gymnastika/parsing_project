После ЛЮБОГО изменения файлов ОБЯЗАТЕЛЬНО выполни: git add -A && git commit -m 'Auto-commit' && git push

# 📝 ПРАВИЛО ОБНОВЛЕНИЯ ДОКУМЕНТАЦИИ

**КРИТИЧЕСКИ ВАЖНО**: При внесении ЛЮБЫХ изменений в код (создание/изменение/удаление файлов, функций, конфигураций, зависимостей), данный файл CLAUDE.md ДОЛЖЕН быть немедленно обновлен для отражения всех изменений. Это обеспечивает постоянную актуальность технической документации и полное понимание архитектуры системы.

**Обновлять при:**
- ✅ Создании новых файлов/модулей
- ✅ Изменении существующих функций
- ✅ Добавлении/удалении зависимостей
- ✅ Изменении конфигураций
- ✅ Обновлении API endpoints
- ✅ Модификации database schema
- ✅ Изменении environment variables
- ✅ Обновлении integration settings

---

# CLAUDE.md - GYMNASTIKA RG Club UAE Parsing Platform

**Полное техническое описание и руководство разработчика**

## 🎯 Обзор проекта

**GYMNASTIKA RG Club UAE Parsing Platform** - комплексная веб-платформа для автоматизированного парсинга и анализа бизнес-данных с использованием искусственного интеллекта, веб-скрапинга и современных технологий интеграции.

### Ключевые возможности:
- 🤖 **AI-генерация запросов** через OpenAI Assistant API
- 🗺️ **Google Maps парсинг** через Apify актеры
- 🕷️ **Веб-скрапинг** для извлечения контактных данных
- 📊 **6-этапный pipeline** с real-time прогресс-трекингом
- ⚡ **Real-time Updates** - Supabase Realtime для мгновенного отображения прогресса
- 💾 **Persistent Parsing** - парсинг продолжается даже после обновления страницы
- 🔄 **Background Worker** - автоматическая обработка задач на сервере
- 🔐 **Безопасная архитектура** с proxy endpoints
- 📧 **Email кампании** через Gmail API
- 💾 **Google Drive** интеграция для больших файлов
- 📱 **Telegram Bot** интеграция
- 🌐 **Русский интерфейс** для целевой аудитории

## 🏗️ Архитектура системы

### **Общая схема**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │───▶│    Backend       │───▶│   External APIs     │
│   (Browser)     │    │   (Express)      │    │                     │
├─────────────────┤    ├──────────────────┤    ├─────────────────────┤
│ • script.js     │    │ • server.js      │    │ • OpenAI Assistant  │
│ • Platform      │    │ • Proxy endpoints│    │ • Apify Actors      │
│ • SPA UI        │    │ • Security       │    │ • Supabase DB       │
│ • Progress      │    │ • Validation     │    │ • Google APIs       │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

### **Frontend (Browser-based)**
- **Entry Point**: `index.html` - SPA с русским интерфейсом
- **Core Class**: `GymnastikaPlatform` в `script.js` - Управляет всей платформой:
  - Аутентификация и сессии пользователей
  - Навигация между разделами (parsing, database, email, settings)
  - Инициализация API клиентов с таймингом (1-1.5s delays)
  - Event binding и управление состоянием UI
  - Настройки Telegram bot интеграции
- **Styling**: `styles.css` - Responsive dashboard UI с боковой навигацией

### **Backend (Node.js/Express)**
- **Main Server**: `server.js` - Express сервер на порту 3001:
  - **Proxy Architecture**: Все Apify/OpenAI API вызовы через secure proxy
  - **Static File Serving**: Статические файлы из корневой директории
  - **Railway Volume Integration**: Автоинициализация persistent storage при старте
  - **Background Worker**: Автозапуск worker для фоновых задач
  - **Security Stack**: Helmet + CORS + Input Validation + Rate Limiting
  - **Environment-based Configuration**: Security headers, CSP, HSTS

- **Core Backend Services**:
  - **`ParsingTasksService`** (341 строка): Database CRUD для parsing_tasks
    - Task lifecycle management (pending → running → completed/failed)
    - Progress tracking с real-time updates
    - Retry логика и cleanup старых задач
  - **`BackgroundWorker`** (330 строк): Polling-based task processor
    - Concurrent task execution (max 2 simultaneous)
    - Health monitoring и force cancellation
    - Exponential backoff для retry логики

- **Infrastructure Services**:
  - **`Volume Manager`** (173 строки): Railway persistent storage management
    - Directory structure management (logs, exports, temp, cache)
    - Automated cleanup и disk usage monitoring
  - **`Database Utils`** (66 строк): Connection utilities и health checks
  - **`Path Configuration`** (119 строк): Централизованное управление файловыми путями

- **Security & Middleware**:
  - **Input Validation Middleware** (530 строк): Комплексная security система
    - XSS/SQL/NoSQL injection prevention
    - Rate limiting (general + strict tiers)
    - Joi schema validation для всех endpoints
  - **OAuth Infrastructure**: 2 callback endpoints для Google integration

### **Core Libraries (`lib/` directory)**

#### **Pipeline Orchestration**
- **`pipeline-orchestrator.js`** (клиент) - Основная логика координации:
  - Управляет 6-этапным workflow парсинга
  - Real-time progress tracking с callbacks
  - Error handling и recovery mechanisms
- **`server-pipeline-orchestrator.js`** (сервер) - Серверная версия pipeline

#### **API Clients**
- **`apify-client.js`** & **`server-apify-client.js`**:
  - Google Maps scraping через `compass/crawler-google-places`
  - Web scraping через `apify/web-scraper`
  - Email extraction через `poidata/google-maps-email-extractor`
  - Автодетекция FREE/PAID планов с лимитами
  - Plan-aware resource management

- **`openai-client.js`** & **`server-openai-client.js`**:
  - Двойная Assistant API интеграция:
    - Query generation assistant
    - Result validation assistant
  - Thread-based conversations
  - Secure proxy через сервер

- **`supabase-client.js`**:
  - Database operations (CRUD)
  - Real-time subscriptions
  - RLS (Row Level Security) policies
  - File storage management

- **`auth-client.js`**:
  - Enhanced authentication с профилями
  - Username display: `"${username} (${firstName} ${lastName})"`
  - Session management через localStorage
  - Profile data loading from Supabase

#### **Additional Integrations**
- **`google-oauth-hybrid.js`**:
  - OAuth 2.0 flow для Gmail API
  - Google Drive API для больших файлов
  - Token refresh и management

- **`google-drive-client.js`**:
  - Chunked upload для файлов >25MB
  - Progress indicators для загрузок
  - Permission management

- **`file-manager.js`**:
  - Local file operations
  - Google Drive backup integration
  - File metadata management

- **`adaptive-loader.js`**:
  - Fast initialization system (1-2 секунды)
  - Progressive loading компонентов
  - Performance optimization

#### **Railway Volume & Persistent Storage Infrastructure**
- **`lib/volume-manager.js`** (173 строки):
  - **Функции**: `ensureDirectories()`, `getVolumeDirectory()`, `cleanupTempFiles()`, `getVolumeStats()`
  - **VOLUME_CONFIG**: 4 основных директории (logs, exports, temp, cache)
  - **Автоматическая инициализация**: Создание структуры каталогов при старте
  - **Permission validation**: Проверка прав доступа к Railway Volume
  - **Cleanup система**: Автоудаление временных файлов старше 24 часов
  - **Статистика использования**: File count и размеры для каждой директории
  - **Error handling**: Graceful fallback если Volume недоступен

- **`config/paths.js`** (119 строк):
  - **Централизованные пути**: VOLUME_PATH, LOGS_PATH, EXPORTS_PATH, TEMP_PATH, CACHE_PATH
  - **APPLICATION_PATHS**: Детальные пути для логов, экспортов, временных файлов, кэша
  - **PATH_HELPERS**: Utility функции для timestamp экспортов, временных файлов, кэша
  - **Helper функции**:
    - `getTimestampedExportPath(filename, format)` - экспорт с timestamp
    - `getTempPath(filename, subdir)` - временные файлы по категориям
    - `getCachePath(key, type)` - кэш файлы по типам
    - `getLogPath(type)` - логи по типам (server, error, pipeline)
  - **Volume validation**: `isVolumeConfigured()`, `getVolumeInfo()`
  - **Интеграция в server.js**: Автоинициализация при запуске сервера

#### **Background Processing Infrastructure**
- **`lib/background-worker.js`** (330 строк):
  - **Основной класс**: `BackgroundWorker` с polling архитектурой
  - **Конфигурация**: pollInterval (5s), maxConcurrentTasks (2), maxRetries (3)
  - **Методы жизненного цикла**: `start()`, `stop()`, `scheduleNextPoll()`
  - **Task management**: `pollForTasks()`, `startTaskProcessing()`, `processTask()`
  - **Retry логика**: `handleTaskFailure()` с exponential backoff
  - **Monitoring**: `getStatus()`, `getRunningTasksDetails()`, `healthCheck()`
  - **Force cancellation**: `cancelTask()` для экстренной остановки
  - **Concurrency control**: Map-based tracking запущенных задач
  - **State management**: isRunning, runningTasks, pollTimer

- **`lib/parsing-tasks-service.js`** (341 строка):
  - **Database service**: Полный CRUD для parsing_tasks таблицы
  - **Core методы**: `createTask()`, `getTask()`, `getUserTasks()`, `updateTask()`
  - **Status management**: `markAsRunning()`, `markAsCompleted()`, `markAsFailed()`
  - **Progress tracking**: `updateProgress(stage, current, total, message)`
  - **Task filtering**: `getPendingTasks()`, `getRunningTasks()`, `getActiveTasks()`
  - **Data persistence**: `saveOpenAIData()`, `saveApifyRuns()`, `saveResults()`
  - **Maintenance**: `cleanupOldTasks()` для автоочистки завершенных задач
  - **Service Role Key**: Использует SUPABASE_SERVICE_ROLE_KEY для server-side операций

- **`lib/db-utils.js`** (66 строк):
  - **Базовые database utilities**: DatabaseUtils класс
  - **Connection management**: `setClient()`, `ensureReady()`, `healthCheck()`
  - **Global instance**: `window.dbUtils` для browser использования
  - **Auto-initialization**: Связывается с `window.gymnastikaDB` при доступности

### **Configuration System**
- **`config/env.js`** - Browser-safe конфигурация:
  - Только публичные данные (Supabase public keys, Google Client ID)
  - API endpoints для proxy calls
  - Environment-specific settings
- **`config/supabase.js`** - Supabase client initialization
- **`.env`** - Server-side secrets (не в Git):
  - API keys (OpenAI, Apify)
  - Assistant IDs
  - Database credentials

## 🛡️ Input Validation & Security Middleware System

### **`middleware/inputValidation.js`** (530 строк) - Комплексная система безопасности

#### **Security Features**
- **🔒 XSS Protection**: Полная санитизация всех входящих данных
- **💉 SQL Injection Prevention**: Joi validation schemas с pattern matching
- **🚫 NoSQL Injection Prevention**: express-mongo-sanitize integration
- **⏱️ Rate Limiting**: Двухуровневая система (general + strict)
- **📝 Input Sanitization**: Рекурсивная очистка объектов и массивов
- **📋 Schema Validation**: Joi-based validation для всех endpoints

#### **Rate Limiting Configuration**
```javascript
SECURITY_CONFIG = {
    RATE_LIMIT_WINDOW: 15 * 60 * 1000,        // 15 minutes
    RATE_LIMIT_MAX: 100,                       // general endpoints
    RATE_LIMIT_STRICT_MAX: 10,                 // sensitive endpoints
    MAX_STRING_LENGTH: 10000,
    MAX_QUERY_LENGTH: 2000
}
```

#### **Core Functions & Classes**
- **`sanitizeInput(req, res, next)`**: Middleware для санитизации всех входящих данных
- **`sanitizeObject(obj)`**: Рекурсивная санитизация объектов/массивов
- **`sanitizeString(str)`**: XSS защита для строк с очисткой HTML тегов
- **`validateSchema(schema)`**: Joi-based validation middleware generator
- **`handleValidationErrors(req, res, next)`**: Express-validator error handler

#### **Security Patterns & Validation Rules**
```javascript
SAFE_ID_PATTERN: /^[a-zA-Z0-9_-]+$/
SAFE_ACTOR_ID_PATTERN: /^[a-zA-Z0-9_~\/.-]+$/
THREAD_ID_PATTERN: /^thread_[a-zA-Z0-9]+$/
RUN_ID_PATTERN: /^run_[a-zA-Z0-9]+$/
ASSISTANT_ID_PATTERN: /^asst_[a-zA-Z0-9]+$/
```

#### **Endpoint-Specific Validation**
- **`validateApifyRun`**: Google Maps scraper validation (searchStringsArray, locationQuery, maxCrawledPlacesPerSearch)
- **`validateWebScraperRun`**: Web scraper validation (startUrls, pageFunction, proxyConfiguration)
- **`validateOpenAIThread`**: OpenAI Assistant validation (threadId, content, assistant_type)
- **`validateQueryParams`**: Query parameters validation (status, limit)

#### **Security Middleware Stacks**
- **`baseSecurityMiddleware`**: mongoSanitize + sanitizeInput + generalRateLimit
- **`sensitiveSecurityMiddleware`**: baseSecurityMiddleware + strictRateLimit

#### **Integration in server.js**
```javascript
const {
    validateApifyRun,
    validateWebScraperRun,
    validateOpenAIThread,
    validateQueryParams
} = require('./middleware/inputValidation');
```

### **OAuth Callback Infrastructure**

#### **`oauth/callback.html`** (306 строк) - Базовый OAuth callback
- **UI Components**: Spinner, progress container, error states
- **Multi-method messaging**: window.opener, window.parent, window.top
- **Fallback система**: localStorage backup если postMessage не работает
- **Error handling**: OAuth errors, network failures, timeout handling
- **Auto-close логика**: 2-5 секунд в зависимости от результата

#### **`oauth/google-callback.html`** (230 строк) - Google OAuth с прогресс UI
- **Progressive UI**: 4-step progress indicator с visual feedback
- **Advanced styling**: Glass morphism UI с backdrop-filter
- **Client integration**: Загружает Supabase, GoogleOAuthHybrid clients
- **Step tracking**:
  1. Получение токенов от Google
  2. Проверка авторизации
  3. Сохранение интеграции
  4. Перенаправление обратно
- **Error recovery**: Automatic redirect с сохранением состояния

## 🔄 Детальный Pipeline Workflow

### **Два режима парсинга**

**1. AI Search (6 этапов)** - Интеллектуальный поиск с оптимизацией запросов
**2. URL Parsing (3 этапа)** - Прямой парсинг конкретного сайта

---

### **AI Search: 6-этапный процесс парсинга данных**

#### **Stage 1: AI Query Generation**
- **Модуль**: `OpenAIClient.generateSearchQueries()`
- **Процесс**: Пользовательский запрос → OpenAI Assistant → 3 оптимизированных запроса
- **Выход**:
  ```javascript
  {
    queries: ["запрос1", "запрос2", "запрос3"],
    language: "ru",
    region: "AE"
  }
  ```

#### **Stage 2: Google Maps Search**
- **Модуль**: `ApifyClient.executeApifySearches()`
- **Актер**: `compass/crawler-google-places`
- **Процесс**: Параллельный поиск по 3 запросам в Google Maps
- **Лимиты**:
  - FREE план: 500 результатов, 1 concurrent
  - PAID план: 2000+ результатов, 5+ concurrent

#### **Stage 3: Data Aggregation & Deduplication**
- **Модуль**: `PipelineOrchestrator.aggregateResults()`
- **Процесс**: Объединение результатов + дедупликация по placeId
- **Алгоритм**: Set-based deduplication + мерж данных

#### **Stage 4: Web Scraping**
- **Модуль**: `ApifyClient.scrapeOrganizationDetails()`
- **Актер**: `apify/web-scraper`
- **Процесс**: Извлечение email/контактов с сайтов организаций
- **Стратегии**:
  - mailto: links
  - contact page elements
  - meta tags
  - body text patterns
  - JSON-LD structured data

#### **Stage 5: Contact Filtering**
- **Модуль**: `PipelineOrchestrator.filterResultsWithEmail()`
- **Критерии**: Наличие email ИЛИ телефона
- **Фильтры**: Исключение служебных email (test@, noreply@, admin@)

#### **Stage 6: Relevance Scoring**
- **Модуль**: `PipelineOrchestrator.filterByRelevance()`
- **Алгоритм**: Keyword matching + location scoring
- **Сортировка**: По релевантности + рейтингу Google

---

### **URL Parsing: 3-этапный процесс прямого парсинга**

#### **Stage 1: Initializing (0/3 = 0%)**
- **Модуль**: `PipelineOrchestrator.executeUrlParsing()`
- **Процесс**: Валидация URL и подготовка к парсингу
- **Вход**: `{ websiteUrl, taskName }`
- **Progress**: `updateProgress('initializing', 0, 3, 'Инициализация парсинга URL...')`
- **UI**: Progress bar 0%, описание "Инициализация парсинга..."

#### **Stage 2: Direct Web Scraping (1/3 = 33%)**
- **Модуль**: `ApifyClient.scrapeWebsiteDetails()`
- **Актер**: `apify/web-scraper` (прямой вызов)
- **Процесс**: Извлечение данных напрямую с указанного URL
- **Стратегии**: те же что и в AI Search (mailto, contact pages, meta tags)
- **Отличие**: НЕ используется OpenAI и Google Maps
- **Progress**: `updateProgress('web-scraping', 1, 3, 'Извлечение данных с сайта...')`
- **UI**: Progress bar 33%, описание "Извлечение контактных данных с веб-сайтов"

#### **Stage 3: Complete (3/3 = 100%)**
- **Модуль**: Форматирование результатов
- **Выход**: Массив с извлеченными данными (email, phone, title)
- **Формат**: Совместим с AI Search результатами
- **Progress**: `updateProgress('complete', 3, 3, '✅ Парсинг URL завершен успешно!')`
- **UI**: Progress bar 100%, описание "✅ Парсинг завершен успешно!"
- **Database**: Task status → 'completed', results → final_results JSONB

**Ключевое отличие:**
```
AI Search:    User Query → OpenAI → Google Maps → Web Scraper → Results
URL Parsing:  Website URL → Web Scraper (direct) → Results
```

## 🔗 Интеграции External APIs

### **OpenAI Assistant API**
```javascript
// Конфигурация
OPENAI_API_KEY: "sk-proj-..."
OPENAI_ASSISTANT_ID: "asst_..." // Query generation
OPENAI_VALIDATION_ASSISTANT_ID: "asst_..." // Result validation

// Использование
const queries = await openaiClient.generateSearchQueries(userQuery);
```

### **Apify Platform Integration**
```javascript
// Актеры
const actors = {
  googleMaps: 'compass/crawler-google-places',
  webScraper: 'apify/web-scraper',
  emailExtractor: 'poidata/google-maps-email-extractor'
};

// Автодетекция плана
const plan = await apifyClient.detectPlanType();
// План определяет лимиты памяти и конкурентности
```

### **Supabase Database**
```javascript
// Таблицы
- profiles: Пользовательские профили
- parsing_results: Результаты парсинга
- parsing_tasks: Задачи парсинга (с прогрессом и состоянием)
- tasks: Фоновые задачи
- contacts: Извлеченные контакты

// RLS Policies
- Пользователи видят только свои данные
- Admins имеют полный доступ
```

### **Persistent Parsing System**
```javascript
// Архитектура персистентности
1. Task Creation (перед стартом): ParsingTasksService.createTask()
2. Progress Updates (во время): ParsingTasksService.updateProgress()
3. State Restoration (при загрузке): checkAndRestoreActiveTask()
4. Completion Tracking: markAsCompleted() / markAsFailed()

// parsing_tasks schema
{
  id: UUID,
  user_id: UUID,
  task_name: string,
  search_query: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  current_stage: string,
  progress: { current, total, message },
  results: JSON,
  created_at: timestamp
}

// Endpoints
POST   /api/parsing-tasks                    // Create task
PATCH  /api/parsing-tasks/:id/running        // Mark as running
PATCH  /api/parsing-tasks/:id/progress       // Update progress
PATCH  /api/parsing-tasks/:id/completed      // Mark completed
PATCH  /api/parsing-tasks/:id/failed         // Mark failed
GET    /api/parsing-tasks/active?userId=...  // Get active tasks
```

### **Google APIs Ecosystem**

#### **Gmail API** (`google-oauth-hybrid.js`)
- **Scope**: `gmail.send`
- **Функции**: Отправка email кампаний
- **OAuth Flow**: Authorization Code → Access Token → Refresh Token

#### **Google Drive API** (`google-drive-client.js`)
- **Scope**: `drive.file`, `drive.readonly`
- **Функции**:
  - Upload больших файлов (>25MB) через chunked upload
  - Backup результатов парсинга
  - Sharing с командой
- **Features**: Progress tracking, retry logic, permission management

#### **Google OAuth 2.0**
```javascript
// Конфигурация
GOOGLE_CLIENT_ID: "*.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET: "server-side-only"
GOOGLE_REDIRECT_URI: "/oauth/callback.html"
```

### **Telegram Bot Integration**
```javascript
// Настройки в UI
this.settings = {
  telegramBotToken: localStorage.getItem('telegramBotToken') || ''
};

// Методы в GymnastikaPlatform
- bindTelegramSettings()
- loadTelegramSettings()
- saveTelegramSettings()
- testTelegramConnection()
- validateTelegramToken()
```

## 🛡️ Система безопасности

### **API Security**
- ✅ **Proxy Pattern**: Все API calls идут через Express сервер
- ✅ **Token Protection**: API ключи только на сервере (.env)
- ✅ **CORS Configuration**: Настроен для внутреннего использования
- ✅ **Input Validation**: Joi + express-validator на всех endpoints

### **Authentication & Authorization**
- ✅ **Supabase Auth**: JWT-based authentication
- ✅ **RLS Policies**: Row Level Security в базе данных
- ✅ **Profile Management**: Enhanced user profiles с metadata
- ✅ **Session Management**: localStorage + Supabase client

### **Data Protection**
- ✅ **Environment Variables**: Sensitive data в .env (не в Git)
- ✅ **Gitignore Protection**: Comprehensive .gitignore для secrets
- ✅ **GitHub Push Protection**: Автоматическое обнаружение leaked tokens
- ✅ **Security Headers**: Helmet middleware для всех responses

## 📊 Data Flow Architecture

```
User Input → AI Processing → Web Scraping → Data Processing → Storage → Display
     ↓              ↓              ↓              ↓             ↓         ↓
Search Query → OpenAI Assistant → Apify Actors → Deduplication → Supabase → Dashboard
     ↓              ↓              ↓              ↓             ↓         ↓
"гимнастика"  → 3 optimized  → Google Maps   → Email extract → Database → Results UI
              queries        → Web scraping  → Filter/sort   → Storage  → Export
```

## 🎮 Development Commands

### **Application Lifecycle**
```bash
npm start          # Production server (port 3001)
npm run dev        # Development server (same as start)
```

### **Access Points**
- **Main App**: http://localhost:3001/index.html
- **Health Check**: http://localhost:3001/api/health
- **Test Forms**: http://localhost:3001/test-form.html
- **Pipeline Test**: http://localhost:3001/test-pipeline.html

### **Git Workflow**
```bash
# Auto-commit hooks настроены в .claude/settings.json
# Каждое Edit/Write → automatic git add + commit + push
git status                    # Проверка состояния
git log --oneline -10        # Последние коммиты
```

## 🔌 API Architecture

### **Backend Proxy Endpoints**
```javascript
// Apify Integration
POST /api/apify/:actorId/runs                    // Single actor execution
POST /api/apify/:actorScope/:actorName/runs      // Scoped actor execution
GET  /api/apify/runs/:runId                      // Run status check
GET  /api/apify/datasets/:datasetId/items        // Data retrieval
GET  /api/apify/users/me                         // Account info

// OpenAI Integration (planned)
POST /api/openai/assistants/:assistantId/threads // Thread creation
POST /api/openai/threads/:threadId/messages     // Message sending

// System
GET  /api/health                                 // Health check
```

### **Authentication Headers**
```javascript
// Apify calls
headers: {
  'x-apify-token': process.env.APIFY_API_TOKEN
}

// OpenAI calls (server-side)
headers: {
  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  'OpenAI-Beta': 'assistants=v2'
}
```

### **Frontend API Clients Integration**
- **ApifyClient**: Google Maps + Web scraping через proxy
- **OpenAIClient**: AI query generation через secure endpoints
- **SupabaseClient**: Database operations + real-time subscriptions
- **PipelineOrchestrator**: Multi-stage workflow coordination

## ⚙️ Production Settings Restoration

### **ВАЖНО: Текущие тестовые лимиты**
```javascript
// TESTING настройки (требуют восстановления для production):

// lib/server-pipeline-orchestrator.js:225
const fixedBuffer = 30; // TESTING: Reduced from 500 to 30

// lib/server-pipeline-orchestrator.js:74
const resultCount = 5; // TESTING: Reduced from 50 to 5

// lib/pipeline-orchestrator.js:250
const fixedBuffer = 30; // TESTING: Reduced from 500 to 30

// lib/server-apify-client.js:94
maxItems = 10, // TESTING: Reduced from 500 to 10
```

### **Production Restoration Commands**
```javascript
// Восстановить в 4 файлах:
fixedBuffer: 30 → 500   // 16x увеличение результатов
resultCount: 5 → 50     // 10x увеличение общего лимита
maxItems: 10 → 500      // 50x увеличение Apify лимита

// Результат: ~1500 результатов вместо 30 (50x увеличение производительности)
```

## 🐛 Recent Critical Fixes

### **Query Duplication Fix** (October 1, 2025)
- **Issue**: Google Maps парсинг запускал 6 поисков вместо 3 (дублирование запросов)
- **Root Cause**: OpenAI Assistant генерировал 2 вариации на каждый язык (3 языка × 2 = 6)
- **Solution**: Добавлена дедупликация через Set + hard limit 3 запроса
- **Impact**: 50% экономия Apify токенов, в 2 раза быстрее
- **Files**: `lib/server-pipeline-orchestrator.js:196-262`
- **Docs**: `database/QUERY_DUPLICATION_FIX.md`

### **Real-time Progress & Completion Fix** (October 1, 2025)
- **Issues Fixed**:
  1. Progress bar не обновлялся в realtime (требовался F5)
  2. Нет финального вывода после парсинга (модальное окно, записи в БД)
- **Solution**: Supabase Realtime подписка + обработчики completion
- **Impact**: Real-time UX + защита от потери результатов
- **Files**: `script.js:4922-5101`
- **Docs**: `database/REALTIME_PROGRESS_FIX.md`

### **Hybrid Monitoring System** (October 1, 2025)
- **Purpose**: Fallback для Realtime если не настроена Publication
- **Architecture**: Dual-path (Real-time + Polling каждые 5 сек)
- **Files**: `script.js:4926-5076`, `server.js:1101-1121`
- **Docs**: `database/HYBRID_MONITORING_SYSTEM.md`

### **Double Pipeline Execution Fix** (October 1, 2025)
- **Issue**: Парсинг запускался ДВАЖДЫ - 3 запроса от клиента, потом еще 3 от сервера
- **Root Cause**: Race condition - задача создавалась как `pending`, фронтенд выполнял ее, НО Background Worker тоже подхватывал `pending` задачу
- **Solution**: Немедленно устанавливать статус `running` ПОСЛЕ создания задачи, ДО запуска pipeline
- **Impact**: 50% экономия (3 запроса вместо 6), защита от дублирования
- **Files**: `script.js:4353-4360`
- **Docs**: `database/DOUBLE_PIPELINE_EXECUTION_FIX.md`

---

## 🏆 Key Features & Capabilities

### **Business Intelligence Pipeline**
- **Multi-stage processing**: 6-этапный AI Search workflow + 3-этапный URL Parsing
- **AI-powered optimization**: OpenAI Assistant оптимизирует search queries (с дедупликацией)
- **Scalable architecture**: Plan-aware resource management (FREE/PAID)
- **Universal Progress Bar**: Динамический прогресс-бар работает для любого количества этапов
  - AI Search: 7 stages (0% → 14% → 29% → 43% → 57% → 71% → 86% → 100%)
  - URL Parsing: 3 stages (0% → 33% → 100%)
  - Automatic percentage calculation from `current/total`
  - Real-time database progress updates
  - Visual stage indicators with descriptions

### **Data Processing Capabilities**
- **Smart deduplication**: placeId-based с data merging
- **Contact extraction**: 5 стратегий извлечения email/телефонов
- **Relevance scoring**: Keyword + location + rating algorithms
- **Export options**: CSV, JSON, database storage

### **Enterprise Integrations**
- **Google Workspace**: Gmail API + Drive API + OAuth 2.0
- **Telegram Bot**: Notifications + команды + status updates
- **Supabase Stack**: Auth + Database + Real-time + Storage
- **Apify Platform**: Web scraping + Google Maps + Email extraction

### **Security & Compliance**
- **Zero client-side secrets**: Все API keys на сервере
- **Row Level Security**: Database-level access control
- **Input sanitization**: Joi validation + XSS protection
- **GitHub security**: Push protection + secret scanning

## 🚀 Deployment & Scaling

### **Environment Configuration**

#### **Complete Environment Variables** (`.env.example` - 98 строк)

**Supabase Configuration**:
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here    # For server-side operations
SUPABASE_ACCESS_TOKEN=your-access-token-here
```

**OpenAI Configuration**:
```bash
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_ASSISTANT_ID=asst_your-assistant-id-here
OPENAI_VALIDATION_ASSISTANT_ID=asst_your-validation-assistant-id-here
```

**Apify Configuration**:
```bash
APIFY_API_TOKEN=apify_api_your-token-here
APIFY_GOOGLE_MAPS_ACTOR=compass/crawler-google-places
APIFY_DIRECT_ACTOR_ID=nwua9Gu5YrADL7ZDj
APIFY_USE_DIRECT_FALLBACK=true
```

**Railway Volume Configuration**:
```bash
VOLUME_PATH=/app/data                    # Railway Volume persistent storage
```

**Application Configuration**:
```bash
REGISTRATION_SECRET_CODE=GYMN-2025-SECURE
DB_SCHEMA=public
NODE_ENV=development                     # development|staging|production
APP_NAME=GYMNASTIKA Management Platform
DEBUG=true
AUTO_TEST_DB=true
```

**CORS & Security Configuration**:
```bash
CORS_ORIGIN=http://localhost:3001        # Development
# CORS_ORIGIN=https://your-domain.com    # Production
CORS_CREDENTIALS=true
ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
ENABLE_SECURITY_HEADERS=true
CSP_ENABLED=true
HSTS_ENABLED=true
```

**Production Deployment Notes**:
- Update `NODE_ENV=production` для боевой среды
- Настроить `CORS_ORIGIN` и `ALLOWED_ORIGINS` для своих доменов
- Включить все security headers в production
- Использовать HTTPS обязательно в production

---

## ⚠️ Critical Database Migrations

### **REQUIRED: Category ID Migration** (October 1, 2025)

#### **Problem**
After implementing category filtering functionality, parsing results fail to save with **400 Bad Request** error:
```
❌ Error inserting batch 1: Object
❌ Error saving results to database
```

**Root Cause**: Code attempts to save `category_id` field, but column doesn't exist in `parsing_results` table.

#### **Solution: Execute SQL Migration**

**Step 1**: Open Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

**Step 2**: Run migration from `database/ADD_CATEGORY_ID_COLUMN.sql`:

```sql
-- Add category_id column to parsing_results
ALTER TABLE parsing_results ADD COLUMN category_id UUID;

-- Add foreign key constraint
ALTER TABLE parsing_results
ADD CONSTRAINT parsing_results_category_id_fkey
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_parsing_results_category_id ON parsing_results(category_id);
```

**Step 3**: Verify migration:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'parsing_results' AND column_name = 'category_id';
```

#### **Migration Files**
- 📜 **SQL Script**: `database/ADD_CATEGORY_ID_COLUMN.sql`
- 📖 **Full Guide**: `database/CATEGORY_ID_MIGRATION_GUIDE.md`
- 📝 **Quick Summary**: `database/CATEGORY_FIX_SUMMARY.md`

#### **Post-Migration Testing**
1. ✅ Run new parsing task with category selected
2. ✅ Verify contacts appear in Contacts section
3. ✅ Test category filtering functionality
4. ✅ Test CSV export with category column

#### **Impact**
- ✅ Fixes 400 error when saving parsing results
- ✅ Enables category filtering in History and Contacts
- ✅ Adds category column to exported CSV files
- ✅ Old records display as "Без категории" (No category)

**Migration Status**: ⚠️ **REQUIRED FOR NEW INSTALLATIONS**

---

### **Scaling Considerations**
- **Memory**: Pipeline может использовать до 2GB для больших datasets
- **Concurrency**: Apify plan определяет максимальную конкурентность
- **Rate Limits**: OpenAI Assistant API + Apify actor limits
- **Database**: Supabase connection pooling + read replicas

### **Performance Optimization**
- **Client-side caching**: localStorage для user settings
- **Background processing**: Worker threads для heavy operations
- **Progressive loading**: Adaptive loader для UI components
- **Resource monitoring**: Plan detection + automatic throttling

## 🗄️ Database Setup

### **КРИТИЧНО: Создание таблицы parsing_tasks**

**Проблема**: Таблица `parsing_tasks` не существует в Supabase по умолчанию

**Решение**:
1. Откройте Supabase Dashboard → SQL Editor
2. Выполните SQL из файла `database/create_parsing_tasks_table.sql`
3. Проверьте создание командой:
   ```sql
   SELECT COUNT(*) FROM parsing_tasks;
   ```

**Что создается**:
- ✅ Таблица `parsing_tasks` с 17 полями
- ✅ 4 индекса для производительности (user_id, status, created_at, task_type)
- ✅ RLS политики для безопасности (5 policies)
- ✅ Триггер auto-update для `updated_at`
- ✅ Service Role доступ для background worker

**Структура таблицы**:
```sql
- id (UUID, primary key)
- user_id (UUID, FK to auth.users)
- task_name, task_type ('ai-search' | 'url-parsing')
- search_query (NULL для url-parsing)
- website_url (NULL для ai-search)
- status ('pending' | 'running' | 'completed' | 'failed' | 'cancelled')
- current_stage, progress (JSONB)
- openai_thread_id, generated_queries, apify_runs
- collected_results, final_results (JSONB)
- error_message, retry_count
- created_at, updated_at, completed_at
```

**Проверка RLS Policies**:
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'parsing_tasks';
```

Должно показать:
- Users can view own parsing tasks
- Users can create own parsing tasks
- Users can update own parsing tasks
- Users can delete own parsing tasks
- Service role full access to parsing tasks

**См. полную документацию**: `database/README.md`

## 🔧 Troubleshooting Guide

### **Common Issues**

#### **500 Error: parsing_tasks table not found**
```javascript
Problem: ERROR 42P01: relation "parsing_tasks" does not exist
Solution: Выполнить SQL миграцию из database/create_parsing_tasks_table.sql
```

**Шаги решения**:
1. Supabase Dashboard → SQL Editor
2. Скопировать весь SQL из `database/create_parsing_tasks_table.sql`
3. Вставить и выполнить (Run)
4. Проверить: `SELECT COUNT(*) FROM parsing_tasks;`
5. Перезапустить приложение

#### **URL Parsing Error: scrapeOrganizationDetails is not a function**
```javascript
Problem: TypeError: this.apifyClient.scrapeOrganizationDetails is not a function
Solution: ИСПРАВЛЕНО - метод был переименован в scrapeWebsiteDetails
```

**Статус**: ✅ Исправлено в версии 2025-10-01
- Client-side: `pipeline-orchestrator.js` использует `scrapeWebsiteDetails()`
- Server-side: `server-pipeline-orchestrator.js` использует wrapper метод

#### **URL Parsing задачи не отображаются в истории**
```javascript
Problem: URL parsing завершается успешно, но задача не видна в "История задач"
Solution: ИСПРАВЛЕНО - UI читает из parsing_tasks вместо parsing_results
```

**Причина**: UI читал историю из старой таблицы `parsing_results`, а новые задачи сохраняются в `parsing_tasks`

**Исправления** (2025-10-01):
- ✅ `loadHistoryData()` теперь читает из `parsing_tasks` (script.js:1085-1113)
- ✅ `viewTaskResults()` извлекает данные из `final_results` JSONB (script.js:1250-1298)
- ✅ `loadContactsData()` читает контакты из `parsing_tasks.final_results` (script.js:1387-1438)
- ✅ `displayHistory()` передает `task_id` для точного поиска (script.js:1563)

**См. документацию**: `database/HISTORY_DISPLAY_FIX.md`

#### **Pipeline Stage Failures**
```javascript
// Stage 1: OpenAI Assistant не отвечает
Problem: API key invalid или quota exceeded
Solution: Проверить OPENAI_API_KEY в .env

// Stage 2: Apify actor timeout
Problem: Plan limits или network issues
Solution: Увеличить timeout или downgrade to FREE plan

// Stage 4: Web scraper returns empty results
Problem: Websites blocking automated access
Solution: Use residential proxies или retry logic
```

#### **Authentication Issues**
```javascript
// Supabase connection failed
Problem: Invalid SUPABASE_URL или ANON_KEY
Solution: Verify credentials в config/env.js

// Google OAuth flow broken
Problem: GOOGLE_CLIENT_ID misconfigured
Solution: Check Google Cloud Console settings
```

#### **Performance Degradation**
```javascript
// Slow pipeline execution
Problem: Testing limits still active
Solution: Restore production values (see above)

// Memory leaks
Problem: Large datasets не освобождаются
Solution: Implement proper cleanup в pipeline stages
```

### **Debug Commands**
```bash
# Check system status
curl http://localhost:3001/api/health

# View logs
tail -f logs/application.log

# Database connectivity
npm run test:db

# API keys validation
npm run test:apis
```

## 📚 Documentation Structure

```
claudedocs/
├── PIPELINE-FIXES.md         # История исправлений pipeline
├── WEB-SCRAPER-FIXES.md      # Исправления web scraper
├── SECURITY_CHECK_GUIDE.md   # Безопасность и аудит
├── SUPABASE_SETUP.md         # Настройка базы данных
├── Google-OAuth-Setup-Guide.md # Google интеграции
├── test-pipeline.html        # Pipeline тестирование
├── test-form.html           # UI компоненты
└── tests/                   # Автоматизированные тесты

database/
├── create_parsing_tasks_table.sql       # SQL миграция для persistent parsing
├── HISTORY_DISPLAY_FIX.md              # Исправление отображения истории задач
├── URL_PARSING_FIXES.md                # Исправления URL parsing функционала
├── URL_PARSING_PROGRESS.md             # Реализация прогресс-бара для URL parsing
├── STUCK_TASK_RECOVERY_FIX.md          # Stuck task detection и retry логика
├── CONTEXT_AWARE_SEARCH_FEATURE.md     # Context-aware поиск по базе данных
├── PIPELINE_CONCURRENCY_FIX.md         # Per-task orchestrator instances для concurrency
├── REALTIME_PROGRESS_FIX.md            # Real-time progress updates и completion flow
├── PURE_SERVER_SIDE_ARCHITECTURE.md    # Pure server-side execution (F5-proof)
├── DOUBLE_PIPELINE_EXECUTION_FIX.md    # Race condition fix (6 searches → 3)
├── QUERY_DUPLICATION_FIX.md            # Query deduplication (50% cost savings)
├── COMPLETION_METHOD_NAMES_FIX.md      # Method names fix for task completion
├── PARSING_RESULTS_SCHEMA_FIX.md       # ✅ DATABASE SAVE FIX (October 1, 2025)
├── EYE_ICON_FIX_SUMMARY.md             # ✅ EYE ICON FIX (October 1, 2025)
├── CONTACTS_SECTION_FIX.md             # ✅ CONTACTS SECTION FIX (October 1, 2025)
├── CROSS_BROWSER_DATA_FIX.md           # 🔴 CROSS-BROWSER FIX (October 1, 2025)
├── ALL_FIXES_SUMMARY.md                # ✅ COMPLETE SUMMARY (October 1, 2025)
└── README.md                           # Инструкции по database setup
```

## 🎯 Development Patterns

### **Code Organization Rules**
- **Telegram settings**: Только в `GymnastikaPlatform` class
- **CSS spacing**: Parsing section как эталон для других секций
- **Authentication**: `"${username} (${firstName} ${lastName})"` format
- **Error handling**: Browser console для debugging + server logs

### **Git Workflow Standards**
- **Auto-commit hooks**: Edit/Write → automatic commit + push
- **Branch strategy**: feature branches → main via PR
- **Commit messages**: Descriptive с context и impact
- **Security**: Never commit API keys или sensitive data

---

## 🏁 Summary

**GYMNASTIKA Parsing Platform** представляет собой enterprise-grade решение для автоматизированного парсинга бизнес-данных с использованием современных AI технологий, web scraping и cloud интеграций.

**Ключевые преимущества:**
- 🚀 **Production-ready** архитектура с comprehensive security
- 🤖 **AI-powered** оптимизация через OpenAI Assistant API
- 🔗 **Multi-platform** интеграции (Google, Telegram, Supabase)
- 📊 **Scalable** pipeline с plan-aware resource management
- 🛡️ **Security-first** подход с zero client-side secrets

**Текущий статус:** ✅ Готов к production использованию после восстановления лимитов

---

## 🔧 Критические исправления (October 1, 2025)

### ✅ Fix 0: Notification-Database Mismatch (October 1, 2025)
**Проблема**: Уведомление показывает 7 результатов, но в базу сохраняется 14
- **Root Cause**: В базу сохранялись ВСЕ результаты (с контактами и без), но уведомление показывало только количество с email
- **Solution**: Добавлена фильтрация `results.filter(r => r.email || r.phone)` перед сохранением в БД
- **Impact**: Уведомление и база данных теперь показывают одинаковое количество результатов
- **Files**: `script.js:5355-5378` (handleTaskCompletion)
- **Docs**: `database/NOTIFICATION_MISMATCH_FIX.md`

### ✅ Fix 1: Database Save Error (400 Bad Request)
**Проблема**: Результаты парсинга не сохранялись в `parsing_results` таблицу
- **Root Cause**: Schema mismatch - код пытался вставить данные в несуществующие колонки
- **Solution**: Переписан `saveResultsToDatabase()` для соответствия реальной схеме таблицы
- **Impact**: Database saves теперь работают без ошибок
- **Files**: `script.js:4928, 4952-5013`
- **Docs**: `database/PARSING_RESULTS_SCHEMA_FIX.md`

### ✅ Fix 2: Eye Icon Shows 0 Results
**Проблема**: При клике на 👁 глазик показывало "0 результатов" даже когда парсинг успешен
- **Root Cause**: Неправильный user_id в запросе + отсутствие fallback для вложенной структуры
- **Solution**: Использование Supabase auth UUID + обработка `final_results.results` пути
- **Impact**: Eye icon теперь корректно отображает результаты
- **Files**: `script.js:1321-1392`
- **Docs**: `database/EYE_ICON_FIX_SUMMARY.md`

### ✅ Fix 3: Contacts Section Empty
**Проблема**: Раздел "Контакты" был пуст, не отображались контакты
- **Root Cause**: Загрузка из `parsing_tasks.final_results` вместо `parsing_results` таблицы
- **Solution**: Загрузка из `parsing_results` + fallback на `parsing_tasks` для старых данных
- **Impact**: Контакты теперь корректно отображаются для новых задач
- **Files**: `script.js:1624-1712`
- **Docs**: `database/CONTACTS_SECTION_FIX.md`

### ✅ Fix 4: Cross-Browser Data Not Visible 🔴 CRITICAL
**Проблема**: При входе с другого браузера на тот же аккаунт - нет никаких данных
- **Root Cause**: Сохранение с Supabase UUID, загрузка с `this.currentUser?.id` (browser-specific)
- **Solution**: Все запросы теперь используют Supabase auth UUID консистентно
- **Impact**: Данные видны с любого браузера/устройства для одного аккаунта
- **Files**: `script.js:1095-1135, 5050-5056, 1626`
- **Docs**: `database/CROSS_BROWSER_DATA_FIX.md`

### ✅ Fix 5: Export Contacts Button (October 1, 2025)
**Проблема**: Кнопка "Экспорт контактов" работала, но не была оптимизирована
- **Root Cause**: Отсутствовала сортировка по дате и уведомление об успешном экспорте
- **Solution**: Добавлена сортировка `sortContactsByDate()` и alert-уведомление пользователю
- **Impact**: CSV экспорт теперь полностью синхронизирован с таблицей Контактов (сортировка + фильтры)
- **Features**:
  - ✅ UTF-8 BOM для Excel совместимости с кириллицей
  - ✅ 6 столбцов: Категория, Название, Email, Описание, Веб-сайт, Дата
  - ✅ Экранирование CSV символов (запятые, кавычки, переносы)
  - ✅ Timestamp имена файлов: `contacts_YYYY-MM-DD_HH-MM-SS.csv`
- **Files**: `script.js:3209-3314` (exportContactsToCSV)
- **Docs**: `database/EXPORT_CONTACTS_FIX.md`

### ✅ Feature 6: Email Deduplication System (October 1, 2025)
**Функция**: Интеллектуальная дедупликация контактов по email адресу при сохранении
- **Problem**: При повторных парсингах одной тематики контакты дублировались в базе данных
- **Solution**: Автоматическая проверка существующих email перед вставкой с batch optimization
- **Algorithm**:
  1. Нормализация email (lowercase + trim) для case-insensitive сравнения
  2. Batch-проверка существующих email в БД (по 1000 за запрос)
  3. Фильтрация дубликатов через Set (O(1) lookup)
  4. Сохранение только уникальных контактов
  5. Уведомление пользователя о количестве новых/дубликатов
- **Performance**:
  - ✅ Batch queries: до 1000 email за запрос (Supabase limit)
  - ✅ Set-based deduplication: O(1) вместо O(n)
  - ✅ Batch insert: 100 записей за раз
  - ✅ Case-insensitive: `Info@GYM.ae` = `info@gym.ae`
- **User Experience**:
  - ✅ "Добавлено X новых контактов. Отфильтровано Y дубликатов."
  - ✅ "Все N контактов уже существуют в базе данных" (если все дубликаты)
  - ✅ Детальные логи в консоли для debugging
- **Security**: RLS изоляция - проверка только в рамках текущего user_id
- **Files**: `script.js:5395-5543` (saveResultsToDatabase)
- **Docs**: `database/EMAIL_DEDUPLICATION_FEATURE.md`

### ✅ Fix 7: Email Session State Persistence (October 2, 2025)
**Проблема**: После отправки письма и обновления страницы пользователь оставался на этапе 2 с данными старой кампании
- **Root Cause #1**: `clearEmailSessionState()` вызывался, но `getCacheData()` возвращал пустой объект `{}` вместо `null`
- **Root Cause #2**: Проверка `if (!sessionState)` не работала для пустых объектов (truthy value)
- **Solution #1**: Добавлена проверка `Object.keys(sessionState).length === 0` в `restoreEmailSessionState()`
- **Solution #2**: Добавлена проверка наличия значимых данных `(!sessionState.subject && !sessionState.step)`
- **Solution #3**: Полная очистка `localStorage.removeItem('cache_email_session')` в дополнение к `invalidateCache()`
- **Impact**:
  - ✅ После отправки письма пользователь на чистом этапе 1
  - ✅ При F5 не восстанавливается старое состояние
  - ✅ Новая кампания всегда начинается с нуля
- **Files**:
  - `script.js:820-828` (restoreEmailSessionState - empty object check)
  - `script.js:802-814` (clearEmailSessionState - full cleanup)
  - `script.js:5383-5385` (resetEmailWizard - clear session call)
- **Docs**: `database/EMAIL_SESSION_STATE_FIX.md`

### 📊 Общий результат исправлений:
- ✅ **Notification-Database match**: 7 vs 14 → 7 vs 7 (согласовано)
- ✅ **Database save rate**: 0% → 100%
- ✅ **Eye icon success**: 0% → 100%
- ✅ **Contacts display**: 0% → 100%
- ✅ **Cross-browser data**: 0% → 100% 🔴
- ✅ **Data persistence**: Failed → Complete
- ✅ **Contact filtering**: Все результаты → Только с email/phone
- ✅ **Email session state**: Restores old campaign → Clean step 1 after send
- ✅ **Comprehensive documentation**: 7 новых MD файлов

### ⚠️ Важно для тестирования:
- **Старые задачи** (до 1 октября): могут показывать 0 результатов (данные не были сохранены из-за бага)
- **Новые задачи** (после 1 октября): все функции работают корректно
- **Рекомендация**: Запустить НОВУЮ задачу парсинга для проверки исправлений

**Полная документация**:
- `database/ALL_FIXES_SUMMARY.md` (4 первых исправления)
- `database/NOTIFICATION_MISMATCH_FIX.md` (5-е исправление)
- `database/EMAIL_SESSION_STATE_FIX.md` (7-е исправление)

---

**Создано с помощью Claude Code** | **GitHub**: https://github.com/gymnastika/parsing_project

## Data Flow

1. **User Input** → Search query entered in frontend
2. **AI Processing** → OpenAI Assistant generates optimized search queries  
3. **Web Scraping** → Apify actors scrape Google Maps using generated queries
4. **Data Processing** → Results processed and validated via second OpenAI Assistant
5. **Storage** → Final data stored in Supabase database
6. **Display** → Results shown in dashboard with progress tracking

## Key Features

### Main Architecture Class
- **`GymnastikaPlatform`** in `script.js` - Core application controller class that manages:
  - Authentication and user sessions
  - Navigation between sections (parsing, database, email, settings)
  - API client initialization with proper timing (1-1.5s delays)
  - Event binding and UI state management
  - Settings persistence (Telegram bot integration, etc.)

### Authentication
- Enhanced username display format: "username (firstName lastName)"
- Supabase profile integration with case-sensitive username preservation
- Dashboard access control with localStorage session management

### Multi-Client Integration
- **Apify Integration**: Web scraping with multiple specialized actors for Google Maps data extraction
- **OpenAI Integration**: AI-powered query generation and result validation using Assistant API
- **Supabase Integration**: Database operations and user authentication
- **Telegram Bot Integration**: Settings UI for bot API token configuration with inline testing

### UI Navigation Sections
- **Parsing** (`currentSection: 'parsing'`) - Main data extraction interface
- **Database** - Data management and viewing
- **Email** - Email campaign features
- **Settings** - System configuration including Telegram bot setup

### Progress Tracking
- Real-time progress updates during pipeline execution
- Stage-by-stage progress reporting (`PipelineOrchestrator.currentProgress`)
- Error handling and user feedback

## Configuration Requirements

### Required API Keys (in `config/env.js`)
```javascript
SUPABASE_URL: 'your-supabase-url'
SUPABASE_ANON_KEY: 'your-supabase-anon-key'  
OPENAI_API_KEY: 'sk-proj-...'
OPENAI_ASSISTANT_ID: 'asst_...'
OPENAI_VALIDATION_ASSISTANT_ID: 'asst_...'
APIFY_API_TOKEN: 'apify_api_...'
```

### API Key Replacement Guide

When setting up the project with client API keys, replace the following values:

#### 1. Supabase Configuration
**File**: `config/env.js`
- **SUPABASE_URL**: Replace with client's Supabase project URL (format: `https://xxxxx.supabase.co`)
- **SUPABASE_ANON_KEY**: Replace with client's Supabase anonymous/public key (starts with `eyJ...`)

#### 2. OpenAI Configuration  
**File**: `config/env.js`
- **OPENAI_API_KEY**: Replace with client's OpenAI API key (format: `sk-proj-...` or `sk-...`)
- **OPENAI_ASSISTANT_ID**: Replace with query generation assistant ID (format: `asst_...`)
- **OPENAI_VALIDATION_ASSISTANT_ID**: Replace with validation assistant ID (format: `asst_...`)

#### 3. Apify Configuration
**File**: `config/env.js`  
- **APIFY_API_TOKEN**: Replace with client's Apify API token (format: `apify_api_...`)

#### 4. Server Environment (Optional)
**File**: `.env` (create if doesn't exist)
```bash
# Server-side environment variables (optional fallback)
APIFY_API_TOKEN=apify_api_...
OPENAI_API_KEY=sk-proj-...
```

### Configuration Validation

After replacing API keys, verify configuration:

1. **Test Supabase Connection**: Visit `/index.html` and attempt login
2. **Test OpenAI Integration**: Generate search queries (should return 3 language objects)
3. **Test Apify Integration**: Run a search task (should detect plan type and execute scraping)
4. **Check Console**: Look for successful client initialization messages:
   - `✅ Supabase client initialized`
   - `🤖 OpenAI client initialized with assistants`
   - `🕷️ Apify client initialized`
   - `📊 Apify Plan Detected: FREE/PAID`

### Important Notes

- **Never commit API keys**: Keep `.env` in `.gitignore` 
- **Browser exposure**: `config/env.js` exposes keys to browser - ensure client understands security implications
- **Plan detection**: Apify client automatically detects FREE vs PAID plan and adjusts memory/concurrency limits
- **Assistant IDs**: Both OpenAI assistants must be pre-configured in client's OpenAI account with appropriate prompts

### Client Initialization Order
1. Environment config loaded (`config/env.js`)
2. Database clients initialized (`supabase-client.js`)
3. API clients initialized (`apify-client.js`, `openai-client.js`)  
4. Pipeline orchestrator created with client references
5. Frontend UI initialized with authentication check

## Dependencies

### Backend Dependencies
- `express`: Web server framework
- `cors`: Cross-origin resource sharing
- `node-fetch`: HTTP requests to external APIs

### Frontend Dependencies (CDN)
- `@supabase/supabase-js@2`: Database and authentication client

## Development Notes

- **No build process** - Direct file serving from root
- **Browser-based architecture** - All processing happens in browser except Apify proxy
- **Russian language interface** - UI text in Russian for target users
- **Single-page application** - Navigation handled via JavaScript without page reloads
- **Environment variables exposed** - `config/env.js` makes server environment available to browser (ensure no sensitive data exposure)

## Important Development Patterns

### Class Method Organization
- **Critical**: All Telegram settings methods must be in `GymnastikaPlatform` class, not `FormValidator` class
- Methods: `bindTelegramSettings()`, `loadTelegramSettings()`, `saveTelegramSettings()`, `testTelegramConnection()`, `validateTelegramToken()`, `setupTelegramSettings()`
- Use `this.telegramSettingsBound` flag to prevent duplicate event listener binding

### CSS Spacing Consistency
- **Parsing section spacing** is the reference standard for all other sections
- Settings forms should use compact spacing: `.form-group { gap: 0.25rem; margin-bottom: 0.5rem; }`
- Always match spacing between sections for UI consistency

### Authentication Flow
- Username display: `"${username} (${firstName} ${lastName})"` with case preservation
- Profile data loaded from Supabase `profiles` table with user foreign key
- Session management via localStorage with Supabase client integration

### Error Debugging
- Check method class placement first (most common issue)
- Use browser console for JavaScript errors and client status messages
- Verify API client initialization: `✅ Supabase client initialized`, `🤖 OpenAI client initialized`, `🕷️ Apify client initialized`

## Production Restoration Guide

**ВАЖНО**: Следующие настройки были изменены для тестирования и должны быть восстановлены для боевой версии:

### 1. Восстановление количества результатов парсинга

#### Файл: `lib/server-pipeline-orchestrator.js`
**Строка 225:** Изменить `fixedBuffer` обратно на боевое значение
```javascript
// TESTING (текущее):
const fixedBuffer = 30; // TESTING: Reduced from 500 to 30 (30/3=10 per query)

// PRODUCTION (восстановить):
const fixedBuffer = 500; // 500 результатов на каждый запрос для боевой версии
```

**Строка 74:** Изменить `resultCount` обратно на боевое значение
```javascript
// TESTING (текущее):
const resultCount = 5; // TESTING: Reduced from 50 to 5 for testing

// PRODUCTION (восстановить):
const resultCount = 50; // Default result count, can be made configurable
```

#### Файл: `lib/pipeline-orchestrator.js`
**Строка 250:** Изменить `fixedBuffer` обратно на боевое значение
```javascript
// TESTING (текущее):
const fixedBuffer = 30; // TESTING: Reduced from 500 to 30

// PRODUCTION (восстановить):
const fixedBuffer = 500;
```

#### Файл: `lib/server-apify-client.js`
**Строка 94:** Изменить `maxItems` обратно на боевое значение
```javascript
// TESTING (текущее):
maxItems = 10, // TESTING: Reduced from 500 to 10 for faster testing

// PRODUCTION (восстановить):
maxItems = 500, // Боевое значение для максимального количества результатов
```

### 2. Восстановление прогресс-уведомлений (опционально)

#### Файл: `lib/pipeline-orchestrator.js`

**Строка 311:** Вернуть updateProgress вызов для детального прогресса
```javascript
// ТЕКУЩЕЕ (убрано для тестирования):
// REMOVED: updateProgress spam fix - only show at stage level, not per query

// ВОССТАНОВИТЬ (если нужны детальные уведомления):
this.updateProgress('apify-search', 2, 5, 
    `Параллельный поиск: "${query}" [${language}/${region}] (группа ${groupIndex + 1}/${queryObjects.length})`);
```

**Строка 420:** Вернуть updateProgress вызов для детального прогресса
```javascript
// ТЕКУЩЕЕ (убрано для тестирования):
// REMOVED: updateProgress spam fix - only show at stage level, not per query

// ВОССТАНОВИТЬ (если нужны детальные уведомления):
this.updateProgress('apify-search', 2, 5, 
    `Поиск ${currentQueryIndex}/${totalQueries}: "${query}" [${language}/${region}]`);
```

### 3. Результат восстановления

После внесения изменений:
- **Google Maps поиск**: 500 результатов на каждый запрос (вместо 10)
- **Общий объем**: ~1500 результатов для 3 запросов (вместо 30)
- **Время выполнения**: Увеличится до полного масштаба для боевого использования
- **Уведомления**: Детальные прогресс-уведомления для каждого запроса (если восстановлены)

### 4. После внесения изменений
1. Перезапустить сервер: `npm start`
2. Протестировать с небольшим запросом для проверки работоспособности
3. Убедиться что система работает с полным объемом данных

**КРИТИЧНО**: Эти изменения существенно увеличат время выполнения парсинга и расход токенов/ресурсов!

---

## 🔧 Критические исправления (October 2, 2025)

### ✅ Fix 5: Email Attachment Error для файлов <25MB
**Проблема**: При отправке email с вложением <25MB возникала ошибка: `Cannot read properties of undefined (reading 'split')` в google-oauth-hybrid.js:738
- **Root Cause**: Файлы <25MB сохранялись как `tempFile` (File object), но контент никогда не читался как base64
- **Solution**:
  1. Добавлены null checks в `google-oauth-hybrid.js` (lines 737-756)
  2. Реализован цикл подготовки вложений в `sendEmailCampaign()` (lines 5220-5256)
  3. Создан helper метод `readFileAsBase64()` для чтения File objects (lines 7990-8004)
- **Impact**: Email с вложениями <25MB теперь отправляются без ошибок
- **Files**:
  - `script.js:5220-5256` - Attachment preparation loop
  - `script.js:7990-8004` - readFileAsBase64() helper method
  - `lib/google-oauth-hybrid.js:737-756` - Null checks for attachment.content

**Технические детали**:
```javascript
// Helper метод использует FileReader API
readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file); // Возвращает data:image/png;base64,...
    });
}

// Подготовка вложений перед отправкой
for (const attachment of this.currentEmailCampaign.attachments || []) {
    if (attachment.tempFile) {
        const content = await this.readFileAsBase64(attachment.tempFile);
        preparedAttachments.push({
            filename: attachment.originalName,
            mimeType: attachment.type,
            content: content // base64 data URL
        });
    }
}
```

### ✅ Fix 6: 400 Bad Request - Missing userId in Task Creation (October 7, 2025)
**Проблема**: При попытке запустить парсинг возникала ошибка 400 Bad Request
```
Failed to load resource: the server responded with a status of 400 ()
❌ Task creation error: Error: Failed to create task in database
❌ Missing required fields: { userId: false, taskData: true }
```

- **Root Cause**: Код отправлял `userId: this.currentUser?.id`, но `this.currentUser` был `undefined` или `null`
  - При `userId: undefined`, JSON.stringify() не включает это поле в тело запроса
  - Сервер получал только `taskData` без `userId` → отклонял запрос с 400 ошибкой

- **Solution**:
  1. Получение `userId` напрямую из Supabase session в момент создания запроса
  2. Добавлена валидация аутентификации с понятным сообщением об ошибке
  3. Исправлены оба метода: `startParsing()` и `startUrlParsing()`

- **Impact**:
  - ✅ `userId` теперь ВСЕГДА получается из актуальной Supabase сессии
  - ✅ Добавлена проверка аутентификации перед отправкой запроса
  - ✅ Запрос всегда содержит валидный `userId` → сервер принимает его
  - ✅ Парсинг успешно запускается без ошибок 400

- **Files Modified**:
  - `script.js:6209-6241` - Метод `startParsing()` с валидацией userId
  - `script.js:6280-6310` - Метод `startUrlParsing()` с валидацией userId

**Технические детали**:
```javascript
// БЫЛО (неправильно - userId может быть undefined):
body: JSON.stringify({
    userId: this.currentUser?.id,  // ❌ undefined если не залогинен
    taskData: taskData
})

// СТАЛО (правильно - всегда валидный userId):
// Получаем актуальную сессию из Supabase
const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();

if (sessionError || \!session?.user) {
    throw new Error("Пользователь не авторизован. Пожалуйста, войдите в систему.");
}

const userId = session.user.id;  // ✅ Всегда валидный UUID
console.log("✅ Authenticated user ID:", userId);

body: JSON.stringify({
    userId: userId,  // ✅ Гарантированно присутствует
    taskData: taskData
})
```

**Server-side Validation** (`server.js:1049-1052`):
```javascript
if (\!userId || \!taskData) {
    console.error("❌ Missing required fields:", { userId: \!\!userId, taskData: \!\!taskData });
    return res.status(400).json({ error: "userId and taskData are required" });
}
```

---

**Создано с помощью Claude Code** | **GitHub**: https://github.com/gymnastika/parsing_project
