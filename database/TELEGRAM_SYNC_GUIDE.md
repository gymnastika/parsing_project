# Telegram Settings Cross-Device Sync

**Date**: October 1, 2025
**Purpose**: Sync Telegram bot settings across browsers/devices via Supabase

---

## 🎯 Problem

**Before**: Telegram settings stored in `localStorage` (browser-specific)
- ❌ Login from different browser → need to reconnect Telegram bot
- ❌ Clear browser data → lose bot configuration
- ❌ Use mobile device → can't access saved settings

**After**: Telegram settings stored in Supabase database
- ✅ Login from any browser → bot settings automatically loaded
- ✅ Cross-device sync → same settings everywhere
- ✅ Persistent storage → never lose configuration

---

## 🚀 Migration Steps

### Step 1: Create Table in Supabase

1. Open Supabase Dashboard → SQL Editor
2. Execute SQL from `CREATE_TELEGRAM_INTEGRATIONS_TABLE.sql`
3. Verify table created:
   ```sql
   SELECT * FROM telegram_integrations LIMIT 1;
   ```

### Step 2: Test Integration

1. Open application → Settings → Telegram Integration
2. Enter bot token and chat ID
3. Click "Save"
4. **Expected**: Settings saved to database
5. Logout and login from different browser
6. Go to Settings → Telegram Integration
7. **Expected**: Bot token and chat ID pre-filled ✅

---

## 📊 Table Schema

```sql
telegram_integrations (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE,          -- One integration per user
    bot_token TEXT NOT NULL,      -- Format: 123456:ABC-DEF...
    bot_name TEXT,                -- @BotUsername
    chat_id TEXT,                 -- Telegram chat ID
    is_active BOOLEAN,            -- Active/inactive status
    last_verified_at TIMESTAMPTZ, -- Last successful test
    created_at, updated_at
)
```

---

## 🔐 Security

- ✅ **RLS Policies**: Users only see their own integration
- ✅ **One per user**: UNIQUE constraint on `user_id`
- ✅ **Encrypted**: Supabase encrypts data at rest
- ⚠️ **Bot tokens**: Sensitive - stored encrypted in database

---

## 📝 Code Changes

**Frontend** (`script.js`):
- Already has `loadTelegramSettings()` - reads from Supabase
- Already has `saveTelegramSettings()` - writes to Supabase
- Uses table name: `telegram_integrations` (будет исправлено если используется другое имя)

**No code changes needed** - just execute SQL migration! ✅

---

## ✅ Testing Checklist

1. [ ] Execute SQL migration
2. [ ] Configure Telegram bot in Settings
3. [ ] Click "Test Connection" → success
4. [ ] Logout from application
5. [ ] Login from different browser
6. [ ] Go to Settings → Telegram Integration
7. [ ] Verify bot token and chat ID are pre-filled
8. [ ] Click "Test Connection" → success

---

## 🆘 Troubleshooting

### Settings not syncing across browsers
**Check**: RLS policies enabled
```sql
SELECT * FROM pg_policies WHERE tablename = 'telegram_integrations';
```

### Multiple integrations for same user
**Check**: UNIQUE constraint exists
```sql
SELECT COUNT(*) FROM telegram_integrations WHERE user_id = 'your-user-id';
```
Should return 1 or 0, never >1

### Old localStorage data
**Clear**: localStorage.removeItem('telegramBotToken')
Code has automatic fallback to localStorage if database is empty

---

**Status**: ⏳ **READY FOR MIGRATION**
**Impact**: Enables cross-device Telegram settings sync
**Breaking Changes**: None (backward compatible with localStorage)

---

**Created by**: Claude Code
**Date**: October 1, 2025
