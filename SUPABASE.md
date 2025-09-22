# SUPABASE Database Schema - Complete Setup Guide

**GYMNASTIKA RG Club UAE Parsing Platform**  
**Complete database migration script for transferring the system to a new Supabase account**

## Prerequisites

1. New Supabase project created
2. Access to Supabase SQL Editor
3. Environment variables configured in `config/env.js`

## Complete Database Setup Script

Copy and execute this complete SQL script in your Supabase SQL Editor:

```sql
-- ==========================================
-- GYMNASTIKA PLATFORM - COMPLETE DATABASE SETUP
-- Run this entire script in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- 1. PROFILES TABLE (User Management)
-- ==========================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    -- Telegram Integration Fields (Added recently)
    telegram_bot_token TEXT,
    telegram_bot_name TEXT,
    telegram_chat_id TEXT,
    telegram_connected_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_names ON public.profiles(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ==========================================
-- 2. PARSING RESULTS TABLE (Main Data Storage)
-- ==========================================

-- Create parsing_results table
CREATE TABLE IF NOT EXISTS public.parsing_results (
    -- Primary fields
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Parsing metadata
    task_name TEXT NOT NULL,
    original_query TEXT NOT NULL,
    parsing_timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Organization data
    organization_name TEXT NOT NULL,
    email TEXT,
    description TEXT,
    country TEXT,
    
    -- URL and website information
    source_url TEXT NOT NULL,
    website TEXT,
    
    -- Additional data
    all_emails JSONB DEFAULT '[]'::jsonb,
    page_title TEXT,
    has_contact_info BOOLEAN DEFAULT false,
    
    -- Error handling
    scraping_error TEXT,
    error_type TEXT,
    
    -- Timestamps
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for parsing_results
CREATE INDEX IF NOT EXISTS idx_parsing_results_user_id ON parsing_results(user_id);
CREATE INDEX IF NOT EXISTS idx_parsing_results_task_name ON parsing_results(task_name);
CREATE INDEX IF NOT EXISTS idx_parsing_results_email ON parsing_results(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parsing_results_country ON parsing_results(country);
CREATE INDEX IF NOT EXISTS idx_parsing_results_parsing_timestamp ON parsing_results(parsing_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_parsing_results_has_contact_info ON parsing_results(has_contact_info) WHERE has_contact_info = true;

-- ==========================================
-- 3. GOOGLE INTEGRATIONS TABLE (OAuth Storage)
-- ==========================================

-- Create google_integrations table
CREATE TABLE IF NOT EXISTS public.google_integrations (
    -- Primary fields
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Google OAuth tokens
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    
    -- Profile information
    connected_email TEXT NOT NULL,
    profile_name TEXT,
    profile_picture TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for google_integrations
CREATE INDEX IF NOT EXISTS idx_google_integrations_user_id ON google_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_email ON google_integrations(email);
CREATE INDEX IF NOT EXISTS idx_google_integrations_expires_at ON google_integrations(expires_at);

-- ==========================================
-- 4. TRIGGERS AND FUNCTIONS
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_parsing_results_updated_at 
    BEFORE UPDATE ON parsing_results 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_google_integrations_updated_at 
    BEFORE UPDATE ON google_integrations 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- 5. PROFILE AUTO-CREATION (Optional)
-- ==========================================

-- Function to automatically create profile after user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, first_name, last_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parsing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;

-- PROFILES TABLE POLICIES
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Allow profile creation" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- PARSING RESULTS TABLE POLICIES
CREATE POLICY "Users can view own parsing results" ON parsing_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parsing results" ON parsing_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parsing results" ON parsing_results
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own parsing results" ON parsing_results
    FOR DELETE USING (auth.uid() = user_id);

-- GOOGLE INTEGRATIONS TABLE POLICIES
CREATE POLICY "Users can view own google integrations" ON google_integrations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own google integrations" ON google_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google integrations" ON google_integrations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google integrations" ON google_integrations
    FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 7. UTILITY VIEWS AND FUNCTIONS
-- ==========================================

-- User parsing statistics view
CREATE OR REPLACE VIEW user_parsing_stats AS
SELECT 
    user_id,
    COUNT(*) as total_results,
    COUNT(*) FILTER (WHERE email IS NOT NULL) as results_with_email,
    COUNT(DISTINCT task_name) as unique_tasks,
    COUNT(DISTINCT country) as unique_countries,
    MIN(parsing_timestamp) as first_parsing,
    MAX(parsing_timestamp) as last_parsing,
    ROUND(
        (COUNT(*) FILTER (WHERE email IS NOT NULL)::decimal / COUNT(*) * 100), 2
    ) as email_success_rate
FROM parsing_results 
GROUP BY user_id;

-- Function to get recent parsing results
CREATE OR REPLACE FUNCTION get_recent_parsing_results(
    p_user_id UUID DEFAULT auth.uid(),
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    task_name TEXT,
    organization_name TEXT,
    email TEXT,
    description TEXT,
    country TEXT,
    website TEXT,
    parsing_timestamp TIMESTAMPTZ,
    has_contact_info BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.task_name,
        pr.organization_name,
        pr.email,
        pr.description,
        pr.country,
        pr.website,
        pr.parsing_timestamp,
        pr.has_contact_info
    FROM parsing_results pr
    WHERE pr.user_id = p_user_id
    ORDER BY pr.parsing_timestamp DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search parsing results
CREATE OR REPLACE FUNCTION search_parsing_results(
    p_user_id UUID DEFAULT auth.uid(),
    p_search_text TEXT DEFAULT '',
    p_country TEXT DEFAULT NULL,
    p_has_email BOOLEAN DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    task_name TEXT,
    organization_name TEXT,
    email TEXT,
    description TEXT,
    country TEXT,
    website TEXT,
    parsing_timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.task_name,
        pr.organization_name,
        pr.email,
        pr.description,
        pr.country,
        pr.website,
        pr.parsing_timestamp
    FROM parsing_results pr
    WHERE pr.user_id = p_user_id
    AND (p_search_text = '' OR 
         pr.organization_name ILIKE '%' || p_search_text || '%' OR
         pr.description ILIKE '%' || p_search_text || '%' OR
         pr.task_name ILIKE '%' || p_search_text || '%')
    AND (p_country IS NULL OR pr.country = p_country)
    AND (p_has_email IS NULL OR 
         (p_has_email = true AND pr.email IS NOT NULL) OR
         (p_has_email = false AND pr.email IS NULL))
    ORDER BY pr.parsing_timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for expired Google tokens
CREATE OR REPLACE FUNCTION cleanup_expired_google_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.google_integrations 
    WHERE expires_at < (NOW() - INTERVAL '30 days');
    
    RAISE NOTICE 'Cleaned up expired Google tokens';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. PERMISSIONS
-- ==========================================

-- Grant permissions to authenticated users
GRANT ALL ON parsing_results TO authenticated;
GRANT ALL ON google_integrations TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON user_parsing_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_parsing_results TO authenticated;
GRANT EXECUTE ON FUNCTION search_parsing_results TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_google_tokens TO authenticated;

-- ==========================================
-- 9. TABLE COMMENTS (Documentation)
-- ==========================================

COMMENT ON TABLE parsing_results IS 'Stores parsing results from Google Maps and website scraping';
COMMENT ON TABLE google_integrations IS 'Stores Google OAuth integration data for Gmail API access';
COMMENT ON TABLE profiles IS 'Extended user profile information including Telegram integration';

COMMENT ON COLUMN parsing_results.user_id IS 'Reference to auth.users - owner of parsing results';
COMMENT ON COLUMN parsing_results.task_name IS 'Name of the parsing task';
COMMENT ON COLUMN parsing_results.original_query IS 'Original search query used for parsing';
COMMENT ON COLUMN parsing_results.all_emails IS 'JSON array of all discovered email addresses';

COMMENT ON COLUMN profiles.telegram_bot_token IS 'Telegram bot token for user-specific bot integration';
COMMENT ON COLUMN profiles.telegram_bot_name IS 'Name of connected Telegram bot';
COMMENT ON COLUMN profiles.telegram_chat_id IS 'Telegram Chat ID for sending notifications to user';
COMMENT ON COLUMN profiles.telegram_connected_at IS 'Timestamp when Telegram was connected';

COMMENT ON COLUMN google_integrations.access_token IS 'Google OAuth access token (should be encrypted in production)';
COMMENT ON COLUMN google_integrations.refresh_token IS 'Google OAuth refresh token (should be encrypted in production)';

-- ==========================================
-- SETUP COMPLETED
-- ==========================================

SELECT 'GYMNASTIKA Platform database setup completed successfully!' as result;
```

## Authentication Configuration

### Critical: Disable Email Confirmation

In Supabase Dashboard → Authentication → Settings:

1. **UNCHECK "Enable email confirmations"**
2. Click "Save"  
3. This allows immediate login after registration

### Additional Auth Settings

- **Password requirements**: Minimum 6 characters
- **JWT expiry**: 3600 seconds (1 hour)
- **Enable sign ups**: Enabled

## Environment Configuration

Update your `config/env.js` with new project values:

```javascript
SUPABASE_URL: 'https://your-new-project.supabase.co'
SUPABASE_ANON_KEY: 'your-new-anon-key'
OPENAI_API_KEY: 'sk-proj-...'
OPENAI_ASSISTANT_ID: 'asst_...'
OPENAI_VALIDATION_ASSISTANT_ID: 'asst_...'
APIFY_API_TOKEN: 'apify_api_...'
```

## Database Tables Overview

| Table | Purpose | Key Features |
|-------|---------|-------------|
| **profiles** | User management | Username, names, email, Telegram integration |
| **parsing_results** | Main data storage | Scraped organizations, emails, metadata |
| **google_integrations** | OAuth tokens | Gmail API access, token refresh |
| **email_campaigns** | Email campaigns | Subject, body, attachments, campaign tracking |

## Features Included

### Core Functionality
- ✅ User authentication and profiles
- ✅ Parsing results storage with full metadata
- ✅ Google OAuth integration for Gmail
- ✅ Telegram bot integration (recently added)
- ✅ Email campaigns management with attachments

### Security Features  
- ✅ Row Level Security (RLS) on all tables
- ✅ User-specific data isolation
- ✅ Secure OAuth token storage
- ✅ Automatic profile creation

### Data Management
- ✅ Advanced search and filtering
- ✅ User statistics and analytics
- ✅ Automatic timestamps and updates
- ✅ Data cleanup functions

## Verification Queries

After setup, verify with these queries:

```sql
-- Check table creation
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('profiles', 'parsing_results', 'google_integrations');

-- Test user functions
SELECT auth.uid();
SELECT * FROM user_parsing_stats;
```

## Migration Notes

### From Existing System
1. Export data from old Supabase project
2. Run this complete setup script  
3. Import data with proper user_id mapping
4. Update environment variables
5. Test authentication and functionality

### Data Preservation
- All existing parsing results will be preserved
- User profiles maintain username format: "username (firstName lastName)"
- Google OAuth connections require re-authorization
- Telegram connections are stored per-user in profiles table

## Troubleshooting

### Common Issues

1. **RLS Blocking Access**: Check `auth.uid()` returns valid user ID
2. **Profile Creation Fails**: Ensure username is unique and under 20 characters  
3. **Google Token Errors**: Check token expiration and refresh logic
4. **Telegram Integration**: Verify profile table has telegram_* columns

### Debug Commands

```sql
-- Check current user
SELECT auth.uid(), auth.role();

-- View all policies
SELECT * FROM pg_policies WHERE tablename = 'your_table_name';

-- Check table structure
\d public.profiles
\d public.parsing_results
\d public.google_integrations
```

## Security Considerations

⚠️ **Important**:
- API keys in `config/env.js` are exposed to browser
- Consider encrypting OAuth tokens in production
- Regularly rotate API keys and tokens
- Monitor authentication logs for security
- Use HTTPS in production

## System Integration

### Frontend Components
- `lib/auth-client.js` - Authentication & profile management
- `lib/supabase-client.js` - Database operations wrapper  
- `script.js` - Main application with Telegram integration
- `config/env.js` - Environment configuration (browser-exposed)

### Key Methods
- `saveTelegramConnection()` - Store bot token in user profile
- `getTelegramConnection()` - Retrieve user's Telegram settings  
- `saveParsingResults()` - Store scraping results with metadata
- `getRecentParsingResults()` - Load user's parsing history

This schema supports the complete GYMNASTIKA platform functionality including multi-language parsing, email extraction, Google OAuth, and Telegram bot integration with proper user isolation and security.