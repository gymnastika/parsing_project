# Google Drive 403 Error - Debugging Guide

**Date**: October 1, 2025
**Issue**: File uploads >25MB fail with "Failed to initiate resumable upload: 403"
**Status**: 🔍 **INVESTIGATING**

---

## 🔍 Current Investigation

### **What We Know**

1. ✅ **Token validation passes**: `✅ Token validation successful - Drive access confirmed`
2. ✅ **OAuth scopes are defined correctly** in code:
   ```javascript
   'https://www.googleapis.com/auth/drive.file'
   'https://www.googleapis.com/auth/drive.readonly'
   ```
3. ✅ **getValidAccessToken() is being used** (proactive refresh 5 min before expiry)
4. ❌ **Upload fails with 403**: Google Drive API rejects resumable upload initiation

### **Recent Changes**

**Fix #1 Applied** (lib/google-drive-client.js:60-84):
- Replaced manual token refresh logic
- Now uses `window.googleOAuth.getValidAccessToken()`
- Prevents race condition where token expires during upload

**Fix #2 Applied** (lib/google-drive-client.js:173-194):
- Enhanced token validation logging
- Now shows explicit scope details in console
- Better error messages when scope is missing

**Fix #3 Applied** (lib/google-drive-client.js:372-391):
- Detailed 403 error logging
- Shows Google API error response body
- Logs token prefix for verification

---

## 🧪 Testing Instructions

### **Step 1: Test Email Campaigns Table First**

Before testing Google Drive, make sure email campaigns work:

1. Execute SQL migration: `database/CREATE_EMAIL_CAMPAIGNS_TABLE.sql`
2. Open application → Рассылка email
3. Fill subject: "Test"
4. Fill body: "Test message"
5. Click "Next" button
6. **Expected**: Proceeds to step 2 (no error)

### **Step 2: Test Google Drive Upload with Enhanced Logging**

1. Open application → Рассылка email
2. Fill subject and body
3. Attach file >25MB (e.g., video file)
4. **Open browser console** (F12)
5. Watch for new logging output

### **Expected Console Output**

```
📊 Token validation response:
  - Expires in: 3599 seconds
  - User ID: 123456789
  - Scopes: email profile openid https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file ...
✅ Token validation successful - Drive access confirmed
  - drive.file scope: PRESENT
📤 Starting Google Drive upload...
```

**If 403 error occurs, you'll now see:**

```
🔴 Google Drive API error response: {
  "error": {
    "code": 403,
    "message": "Detailed error message here",
    "errors": [...]
  }
}
🔴 Upload initiation failed:
  - Status: 403 Forbidden
  - URL: https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable
  - Token (first 20 chars): ya29.a0AfB_byABCD...
  - Error details: {...}
```

---

## 🔎 Diagnostic Scenarios

### **Scenario A: Scope is MISSING from token**

**Console Output**:
```
📊 Token validation response:
  - Scopes: email profile openid https://www.googleapis.com/auth/gmail.send
❌ Missing Google Drive scope in token!
  - Token has scopes: email profile...
  - Required scope: https://www.googleapis.com/auth/drive.file
```

**Solution**: User needs to re-authenticate with Drive permissions
1. Go to Settings
2. Disconnect Google account
3. Reconnect with all permissions

### **Scenario B: Scope is PRESENT but 403 still occurs**

**Console Output**:
```
✅ Token validation successful - Drive access confirmed
  - drive.file scope: PRESENT
🔴 Upload initiation failed:
  - Status: 403 Forbidden
  - Error details: { "error": { "message": "..." } }
```

**Possible Causes**:
1. **Google Cloud Console misconfiguration**:
   - Drive API not enabled for OAuth Client ID
   - Incorrect redirect URIs
   - OAuth consent screen missing Drive API scope

2. **Token refresh issue**:
   - Refresh token invalid/expired
   - Token refresh logic not working
   - Old token cached

3. **User account restrictions**:
   - Google Workspace admin blocked Drive API
   - User account suspended/restricted
   - Requires additional verification

### **Scenario C: Different error code (not 403)**

**Console Output**:
```
🔴 Upload initiation failed:
  - Status: 401 Unauthorized
  OR
  - Status: 429 Too Many Requests
  OR
  - Status: 500 Internal Server Error
```

**Solutions**:
- **401**: Token completely invalid → force re-authentication
- **429**: Rate limit hit → implement retry with backoff
- **500**: Google API issue → retry later

---

## 🛠️ Fixes to Try

### **Fix Option 1: Force Re-authentication**

If scope is missing, user must reconnect:

```javascript
// In Settings section
1. Click "Disconnect Google"
2. Click "Connect Google Account"
3. Grant ALL permissions when prompted
4. Check console for scope confirmation
```

### **Fix Option 2: Check Google Cloud Console**

Verify OAuth Client ID configuration:

1. Go to https://console.cloud.google.com
2. Select your project
3. Navigate to: APIs & Services → Credentials
4. Click your OAuth 2.0 Client ID
5. Verify:
   - ✅ Redirect URIs include your callback URLs
   - ✅ Scopes tab shows Drive API scopes
6. Navigate to: APIs & Services → OAuth consent screen
7. Verify:
   - ✅ Scopes section includes:
     - `.../auth/drive.file`
     - `.../auth/drive.readonly`

### **Fix Option 3: Enable Drive API**

If Drive API is disabled:

1. Go to https://console.cloud.google.com
2. Navigate to: APIs & Services → Library
3. Search for "Google Drive API"
4. Click "Enable"
5. Wait 1-2 minutes for propagation
6. User must re-authenticate

### **Fix Option 4: Clear Token Cache**

Force fresh token retrieval:

```javascript
// In browser console (while logged in)
localStorage.clear();
// Then refresh page and login again
```

---

## 📊 Next Steps

Based on console output from Step 2 testing:

1. **If scope is missing**: Apply Fix Option 1 (re-auth)
2. **If scope present but 403**: Check Google Cloud Console (Fix Option 2 & 3)
3. **If different error**: Analyze error message from enhanced logging

---

## 🔗 Related Files

- **OAuth config**: `lib/google-oauth-hybrid.js:18-25` (scope definition)
- **Drive client**: `lib/google-drive-client.js` (upload logic)
- **Token refresh**: `lib/google-drive-client.js:60-84` (getAccessToken)
- **Token validation**: `lib/google-drive-client.js:165-198` (validateToken)
- **Upload initiation**: `lib/google-drive-client.js:357-394` (initiateResumableSession)

---

## 📝 Report Back

After testing, please provide:

1. **Full console output** from token validation to error
2. **Scopes shown** in "Token validation response"
3. **Error details** from "Upload initiation failed"
4. **Google Cloud Console** screenshots:
   - OAuth Client ID configuration
   - OAuth consent screen scopes
   - Drive API enabled status

This information will help identify the exact cause of the 403 error.

---

**Status**: ⏳ **WAITING FOR TEST RESULTS**
**Next Action**: Run test with file >25MB and share console output

---

**Created by**: Claude Code
**Date**: October 1, 2025
