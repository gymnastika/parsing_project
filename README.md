# GYMNASTIKA RG Club UAE - Parsing Platform

🏆 **AI-Powered Business Data Parsing Platform для гимнастических клубов**

## 🎯 Описание

Веб-платформа для автоматизированного парсинга и анализа бизнес-данных с использованием искусственного интеллекта, веб-скрапинга и современных технологий.

## ⚡ Основные возможности

- **🤖 AI-генерация запросов** через OpenAI Assistant API
- **🗺️ Google Maps парсинг** через Apify актеры
- **🕷️ Веб-скрапинг** для извлечения контактных данных
- **📊 Многоэтапный pipeline** с прогресс-трекингом
- **🔐 Безопасная архитектура** с proxy endpoints
- **🌐 Русский интерфейс** для целевой аудитории
- **📱 Responsive design** для всех устройств

## 🏗️ Архитектура

```
Frontend (Browser)     Backend (Express)      External APIs
─────────────────     ──────────────────     ─────────────
• script.js           • server.js            • OpenAI Assistant
• GymnastikaPlatform  • Proxy endpoints      • Apify Actors
• SPA Navigation      • Security middleware  • Supabase DB
• Progress Tracking   • Input validation     • Google OAuth
```

## 🚀 Быстрый старт

```bash
# Клонирование репозитория
git clone https://github.com/gymnastika/parsing_project.git
cd parsing_project

# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env с вашими API ключами

# Запуск приложения
npm start
```

Приложение будет доступно по адресу: **http://localhost:3001**

## 📋 Требования

- **Node.js** 16+
- **npm** 8+
- **API ключи**: OpenAI, Apify, Supabase
- **Google OAuth** (для Gmail/Drive интеграции)

## 🔧 Конфигурация

### Основные настройки в `.env`:
```bash
# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_ASSISTANT_ID=asst_...
OPENAI_VALIDATION_ASSISTANT_ID=asst_...

# Apify
APIFY_API_TOKEN=apify_api_...

# Google OAuth
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 📊 Pipeline Workflow

1. **🎯 AI Query Generation** - OpenAI создает оптимизированные поисковые запросы
2. **🗺️ Google Maps Search** - Apify ищет организации в Google Maps
3. **🕷️ Web Scraping** - Извлечение email и контактов с сайтов
4. **🔍 Data Processing** - Дедупликация и фильтрация результатов
5. **📈 Relevance Scoring** - Сортировка по релевантности
6. **💾 Data Storage** - Сохранение в Supabase

## 🛡️ Безопасность

- ✅ **API ключи защищены** на сервере
- ✅ **Proxy endpoints** для всех внешних вызовов
- ✅ **Input validation** и sanitization
- ✅ **CORS настроен** для внутреннего использования
- ✅ **Security headers** через Helmet
- ✅ **.env файлы** исключены из Git

## 📚 Документация

Подробная документация доступна в папке `claudedocs/`:

- `CLAUDE.md` - Основные инструкции и паттерны
- `PIPELINE-FIXES.md` - История исправлений pipeline
- `SECURITY_CHECK_GUIDE.md` - Гид по безопасности
- `SUPABASE_SETUP.md` - Настройка базы данных

## 🧪 Тестирование

```bash
# Тестовые страницы
http://localhost:3001/test-form.html      # UI компоненты
http://localhost:3001/test-pipeline.html  # Pipeline тестирование

# Health check
http://localhost:3001/api/health
```

## 🤝 Разработка

### Структура проекта:
```
├── lib/                 # Основные библиотеки клиентов
├── config/              # Конфигурационные файлы
├── middleware/          # Express middleware
├── claudedocs/          # Документация и тесты
├── oauth/               # OAuth callbacks
└── BACKUP/              # Резервные копии
```

### Команды разработки:
```bash
npm start               # Запуск production сервера
npm run dev            # Запуск development сервера
```

## 📄 Лицензия

MIT License - см. файл LICENSE для деталей.

## 👥 Команда

**GYMNASTIKA RG Club UAE** - Проект управления гимнастическими клубами

---

**🤖 Создано с помощью Claude Code**
**📅 Последнее обновление**: 22 сентября 2025
**🧪 Тест auto-commit hooks**: Успешно протестировано