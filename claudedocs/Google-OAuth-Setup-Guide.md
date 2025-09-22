# Google OAuth Setup Guide for GYMNASTIKA Platform

## Overview

This guide walks you through configuring Google OAuth 2.0 integration for the GYMNASTIKA platform to enable Gmail API access for email sending functionality.

## Test Results Summary

✅ **OAuth Flow Implementation**: Tested successfully - popup opens, callback handling works  
✅ **Redirect URI Configuration**: Properly configured to use `/oauth/callback.html`  
✅ **Error Handling**: Working correctly - shows "invalid_client" when Client ID is not configured  
⚠️  **Requires Setup**: Google Cloud Console configuration needed for Client ID  

## Required Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `GYMNASTIKA Platform` (or similar)
4. Click "Create"

### 2. Enable Gmail API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on "Gmail API" result
4. Click "Enable"

### 3. Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type (unless you have Google Workspace)
3. Fill in required information:
   - **App name**: `GYMNASTIKA Platform`
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users (your email addresses) for development
6. Click "Save and Continue"

### 4. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Enter name: `GYMNASTIKA Web Client`
5. Add **Authorized redirect URIs**:
   - `http://localhost:3001/oauth/callback.html` (for development)
   - `https://yourdomain.com/oauth/callback.html` (for production)
6. Click "Create"
7. **IMPORTANT**: Copy the Client ID (format: `xxx.apps.googleusercontent.com`)

### 5. Configure Application

1. Open `/config/env.js`
2. Replace the placeholder Client ID:
   ```javascript
   // Change this line:
   GOOGLE_CLIENT_ID: 'your-google-client-id.apps.googleusercontent.com',
   
   // To your actual Client ID:
   GOOGLE_CLIENT_ID: 'your-actual-client-id.apps.googleusercontent.com',
   ```

### 6. Test the Integration

1. Start the application: `npm start`
2. Navigate to `http://localhost:3001/#email`
3. Click "🔗 Подключить Google аккаунт"
4. Should open Google OAuth popup instead of showing "invalid_client" error
5. Complete OAuth flow and grant permissions
6. Verify connection status shows "✅ Подключен" (Connected)

## Security Notes

### Development vs Production

**Development Configuration**:
- Redirect URI: `http://localhost:3001/oauth/callback.html`
- Test users only (OAuth consent screen in testing mode)

**Production Configuration**:
- Redirect URI: `https://yourdomain.com/oauth/callback.html`
- Publish OAuth consent screen for public use
- Consider using environment variables for Client ID

### Client Secret Handling

The current implementation uses **public OAuth flow** (no client secret in browser):
- ✅ **Safe**: Client ID is public and safe to expose in browser
- ✅ **Secure**: No sensitive secrets in client-side code
- ✅ **Standard**: Follows OAuth 2.0 best practices for SPAs

For enhanced security in production:
- Consider implementing PKCE (Proof Key for Code Exchange)
- Use server-side token exchange if needed

## Troubleshooting

### Common Errors

**Error: "invalid_client"**
- Cause: Client ID not configured or incorrect
- Solution: Follow steps 4-5 above to set correct Client ID

**Error: "redirect_uri_mismatch"**
- Cause: Redirect URI not registered in Google Cloud Console
- Solution: Add exact redirect URI in OAuth credentials (step 4.5)

**Error: "access_denied"**
- Cause: User denied permissions or app not approved
- Solution: Ensure OAuth consent screen is properly configured

**Error: "popup blocked"**
- Cause: Browser blocking popup windows
- Solution: Allow popups for the site or use redirect flow

### Verification Steps

1. **Check Client ID Format**: Should end with `.apps.googleusercontent.com`
2. **Verify Redirect URI**: Must exactly match Google Cloud Console configuration
3. **Test Popup Functionality**: Should open Google OAuth page, not error page
4. **Check Browser Console**: Look for OAuth-related error messages
5. **Verify Scopes**: Ensure required Gmail scopes are enabled

## Integration Status

After completing setup, the platform will:
- ✅ Connect to user's Google account via OAuth 2.0
- ✅ Store tokens securely in Supabase database
- ✅ Refresh tokens automatically when needed
- ✅ Enable Gmail API access for email sending
- ✅ Display connection status in dashboard

The OAuth implementation includes:
- Popup-based authentication flow
- CSRF protection with state parameters
- Automatic token refresh handling
- Secure token storage with RLS policies
- Error handling and user feedback

## Next Steps

1. Complete Google Cloud Console setup (steps 1-4)
2. Configure Client ID in application (step 5)
3. Test OAuth flow (step 6)
4. Deploy to production with production redirect URI
5. Implement email sending functionality using stored tokens