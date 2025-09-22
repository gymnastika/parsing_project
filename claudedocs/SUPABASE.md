# SUPABASE Database Setup Instructions

This document contains SQL commands and setup instructions for the GYMNASTIKA Management Platform Supabase database.

## Prerequisites

1. Supabase project created and configured
2. Access to Supabase SQL Editor
3. Environment variables properly configured in `config/env.js`

## Database Schema Setup

### ⚠️ CRITICAL: Use the Complete Setup Script

**For fixing registration issues, use the complete setup script:**

1. Open your Supabase project → SQL Editor
2. Copy and run the complete script from: `SUPABASE_SETUP.sql`
3. This script handles all edge cases and provides verification

### Alternative: Manual Setup

If you prefer step-by-step commands, run the following SQL in your Supabase SQL Editor to create the `profiles` table:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Create index for faster name searches
CREATE INDEX IF NOT EXISTS idx_profiles_names ON public.profiles(first_name, last_name);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
```

### 2. Set Up Row Level Security (RLS)

Enable RLS and create security policies:

```sql
-- Enable Row Level Security on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Policy: Allow profile creation during registration
CREATE POLICY "Allow profile creation" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy: Authenticated users can view all profiles (for staff list functionality)
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
    FOR SELECT
    USING (auth.role() = 'authenticated');
```

### 3. Update Existing Tables (If Already Created)

If you already have a profiles table without the email field, run this migration:

```sql
-- Add email column to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Update existing profiles with email from auth.users table
UPDATE public.profiles 
SET email = auth_users.email 
FROM auth.users 
WHERE profiles.id = auth_users.id 
AND profiles.email IS NULL;

-- Make email field required after populating existing data
ALTER TABLE public.profiles 
ALTER COLUMN email SET NOT NULL;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
```

### 4. Create Profile Auto-Creation Trigger (Optional)

This trigger automatically creates a profile when a new user registers:

```sql
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
```

## Verification Queries

After setup, you can verify everything is working correctly:

### Check Table Structure
```sql
-- Verify profiles table structure
\d public.profiles;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';
```

### Test Data Access
```sql
-- View all profiles (as authenticated user)
SELECT id, username, first_name, last_name, created_at FROM public.profiles;

-- Count total profiles
SELECT COUNT(*) FROM public.profiles;
```

## Security Configuration

### Authentication Settings

In your Supabase project dashboard, navigate to **Authentication > Settings** and configure:

**IMPORTANT**: To fix "email not confirmed" login issues, disable email confirmation.

1. **Auth Settings**:
   - Email confirmation: **DISABLED** (for development/internal use)
   - Password requirements: Minimum 6 characters
   - JWT expiry: 3600 seconds (1 hour)
   - Enable sign ups: Enabled

2. **How to Disable Email Confirmation** (CRITICAL for fixing login issues):
   - In Supabase Dashboard → Authentication → Settings
   - Scroll to "Email Confirmation" section
   - **UNCHECK** "Enable email confirmations"
   - Click "Save"
   - This allows users to login immediately after registration

3. **Email Templates** (only if email confirmation is enabled):
   - Customize registration confirmation email
   - Configure from email address

### API Security

1. **RLS Policies**: Already configured above
2. **Service Role Key**: Keep secure, never expose in frontend
3. **Anon Key**: Safe to use in frontend (limited permissions)

## Usage Examples

### Frontend Integration

The frontend authentication client (`lib/auth-client.js`) will:

1. Register new users with profile data
2. Authenticate existing users
3. Manage user sessions
4. Handle profile updates

### Registration Flow

1. User submits registration form with secret code
2. Frontend validates secret code: `GYMN-2025-SECURE`
3. Supabase Auth creates user account
4. Profile record created automatically (via trigger) or manually (via auth client)
5. User receives email confirmation (if enabled)
6. User can log in after confirmation

### Profile Management

```javascript
// Example: Get user profile
const profile = await gymnastikaAuth.getUserProfile();

// Example: Update profile
await gymnastikaAuth.updateProfile({
    first_name: 'New First Name',
    last_name: 'New Last Name'
});

// Example: Check username availability
const exists = await gymnastikaDB.checkUsernameExists('newusername');
```

## Database Migration Strategy

For future schema changes:

1. **Always backup** before making changes
2. Use **migrations** for schema updates
3. Test changes in **development** environment first
4. **Version control** your SQL scripts

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**:
   - Ensure user is authenticated
   - Check policy conditions match your use case
   - Verify `auth.uid()` returns expected user ID

2. **Profile Creation Failures**:
   - Check foreign key constraint (user must exist in auth.users)
   - Verify username uniqueness
   - Ensure required fields are not null

3. **Username Conflicts**:
   - Handle unique constraint violations in frontend
   - Provide clear error messages to users
   - Consider username availability checking

### Debug Queries

```sql
-- Check current user ID
SELECT auth.uid();

-- View authentication status
SELECT auth.role();

-- Check profiles table permissions
SELECT 
    schemaname, 
    tablename, 
    tableowner, 
    hasindexes, 
    hasrules, 
    hastriggers 
FROM pg_tables 
WHERE tablename = 'profiles';
```

## Next Steps

After completing this database setup:

1. **Test Registration**: Try registering a new user through the frontend
2. **Test Login**: Verify login functionality works correctly
3. **Verify Profiles**: Check that profiles are created and accessible
4. **Test Profile Updates**: Try updating profile information
5. **Monitor Logs**: Check Supabase logs for any errors

## Security Notes

⚠️ **Important Security Considerations**:

- Never commit real API keys to version control
- Use environment variables for sensitive configuration
- The secret code (`GYMN-2025-SECURE`) is client-side only - not database enforced
- Consider implementing server-side secret validation for production
- Regularly rotate API keys and access tokens
- Monitor authentication logs for suspicious activity

## Support

For issues with this setup:

1. Check Supabase documentation: https://supabase.io/docs
2. Review authentication guides: https://supabase.io/docs/guides/auth
3. Check RLS documentation: https://supabase.io/docs/guides/auth/row-level-security

---

**Created for**: GYMNASTIKA Management Platform  
**Database**: Supabase PostgreSQL  
**Version**: 1.1  
**Last Updated**: January 2025  
**Changelog**: Added email field to profiles table, disabled email confirmation instructions, migration scripts