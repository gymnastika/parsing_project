# 🕷️ ПРЯМОЙ ТЕСТ WEB SCRAPER - НАСТРОЕНО!

## 🎯 Что добавлено:

### 1. **Новые кнопки тестирования**
- **🕷️ Тест Web Scraper напрямую** - тестирует 5 URLs из результатов
- **🔍 Тест одного URL** - тестирует только chessmos.com

### 2. **Тестовые URLs**
```
https://www.chessmos.com/
https://gmnsm.com/
http://roseballet.ae/
https://yu-taekwondo.ae/
http://www.aspiregymnasticsdubai.com/
```

### 3. **Максимальное логирование**
Добавлено детальное логирование в:
- `scrapeWebsiteDetails()` - полная конфигурация актора
- `runActor()` - HTTP запросы, статусы, заголовки
- Консоль браузера покажет каждый шаг

## 🧪 Как тестировать:

### Шаг 1: Откройте тестовую страницу
```
http://localhost:3001/test-pipeline.html
```

### Шаг 2: Нажмите новую кнопку
**🕷️ Тест Web Scraper напрямую**

### Шаг 3: Следите за консолью браузера (F12)
Ищите логи:
```
🕷️ Starting DIRECT Web Scraper test...
📋 Test URLs: [5 URLs]
🔗 Actor ID: moJRLRc85AitArpNN → Path: moJRLRc85AitArpNN
🌐 Request URL: http://localhost:3001/api/apify/moJRLRc85AitArpNN/runs
📤 Sending POST request to start actor...
📥 Response status: 200 OK (или ошибка)
```

## 🔍 Что покажет диагностика:

### ✅ Если работает:
- `Response status: 200 OK`
- `✅ Web Scraper completed successfully!`
- Реальные данные с email'ами

### ❌ Если не работает:
- `Response status: 4XX/5XX` 
- Детальный текст ошибки
- Точная причина проблемы

## 🎯 Возможные проблемы:

1. **401 Unauthorized** = Неправильный API ключ
2. **404 Not Found** = Неправильный ID актора
3. **403 Forbidden** = Нет доступа к актору
4. **429 Rate Limit** = Превышен лимит запросов
5. **500 Server Error** = Проблема на стороне Apify

## 📊 Ожидаемый результат:

После нажатия кнопки в консоли должно появиться:
```
🕷️ Starting DIRECT Web Scraper test...
🔗 Actor ID: moJRLRc85AitArpNN
📤 Sending POST request...
📥 Response status: 200 OK
✅ Web Scraper completed successfully!
🎯 Formatted 5 organization details
```

И в результатах - **реальные названия организаций и email'ы!**

---
**Статус: ГОТОВО К ДИАГНОСТИКЕ** 🔧