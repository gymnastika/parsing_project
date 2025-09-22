После ЛЮБОГО изменения файлов ОБЯЗАТЕЛЬНО выполни: git add -A && git commit -m 'Auto-commit' && git push

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GYMNASTIKA RG Club UAE Parsing Platform - A web application for parsing and managing gymnastics-related business data with AI-powered search query generation, Apify web scraping, and Supabase database integration.

## Architecture

### Frontend (Browser-based)
- **Entry Point**: `index.html` - Single-page application with Russian language interface
- **Main Logic**: `script.js` - Contains `GymnastikaPlatform` class that manages authentication, navigation, and client initialization
- **Styling**: `styles.css` - CSS for responsive dashboard UI with sidebar navigation

### Backend (Node.js/Express)
- **Server**: `server.js` - Express server on port 3001 serving as proxy for Apify API calls
- **Static Files**: Serves all frontend files directly from root directory

### Core Libraries (`lib/` directory)
- **`pipeline-orchestrator.js`**: `PipelineOrchestrator` class - Main orchestration logic that coordinates AI and scraping workflows
- **`apify-client.js`**: `ApifyClient` class - Handles Google Maps scraping and web scraping tasks via Apify actors with automatic plan detection
- **`openai-client.js`**: `OpenAIClient` class - Manages OpenAI Assistant API for query generation and result validation  
- **`supabase-client.js`**: Database operations and authentication via Supabase
- **`auth-client.js`**: Authentication client with enhanced profile support (username, firstName, lastName)
- **`db-utils.js`**: Utility functions for database operations

### Configuration
- **`config/env.js`**: Browser-accessible environment variables including API keys for Supabase, OpenAI, and Apify
- **`config/supabase.js`**: Supabase client configuration and initialization
- **`.env`**: Server-side environment variables (not tracked in git)

## Development Commands

### Start Application
```bash
npm start          # Start production server on port 3001
npm run dev        # Start development server (same as start)
```

### Access Application
- **Frontend**: http://localhost:3001/index.html
- **Health Check**: http://localhost:3001/api/health
- **Test Pages**: `test-form.html`, `test-pipeline.html` - For UI component and pipeline testing
- **Server serves static files from root directory**

## API Architecture

### Backend Proxy Endpoints
- `POST /api/apify/:actorId/runs` - Proxy Apify actor execution requests (single actor IDs)
- `POST /api/apify/:actorScope/:actorName/runs` - Proxy Apify actor execution requests (scoped actors)
- `GET /api/apify/runs/:runId` - Get Apify run status  
- `GET /api/apify/datasets/:datasetId/items` - Fetch scraped data from Apify dataset
- `GET /api/apify/users/me` - Test Apify connection
- `GET /api/health` - Server health check

All Apify calls require `x-apify-token` header for authentication.

### Frontend API Clients
- **ApifyClient**: Executes Google Maps scraping via `compass/crawler-google-places` and `compass/google-maps-extractor` actors
- **OpenAIClient**: Uses OpenAI Assistants for query generation (`OPENAI_ASSISTANT_ID`) and result validation (`OPENAI_VALIDATION_ASSISTANT_ID`)
- **Pipeline Orchestrator**: Coordinates multi-stage parsing workflow combining AI query generation, Apify scraping, and result processing

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