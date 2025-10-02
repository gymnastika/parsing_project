# Google Drive Client Error Fix

**Date**: October 2, 2025
**Status**: ✅ FIXED

## Problem Description

When sending emails with pre-uploaded Google Drive files:
```
❌ Error sending email: Error: Google Drive client not available
    at GoogleOAuthHybrid.sendEmail (google-oauth-hybrid.js:621:27)
```

### User Impact
- Cannot send emails with files already uploaded to Google Drive
- Error occurs even when Drive client is not needed (files already uploaded)
- Confusing error message - user thinks Drive integration is broken

## Root Cause

### Issue 1: Unnecessary Drive Client Requirement
**File**: `lib/google-oauth-hybrid.js:616-622` (before fix)

Code required Google Drive client even when ALL files were already uploaded:

```javascript
// BEFORE (WRONG):
if (largeFileLinks.length > 0) {
    console.log(`☁️ Uploading ${largeFileLinks.length} large files to Google Drive...`);

    // ❌ Always requires Drive client, even if all files already uploaded
    if (!window.googleDriveClient) {
        throw new Error('Google Drive client not available');
    }

    for (let i = 0; i < largeFileLinks.length; i++) {
        const file = largeFileLinks[i];

        // Skip if already uploaded (but check happens AFTER error thrown)
        if (file.driveLink) {
            continue;
        }
        ...
    }
}
```

**Problem Flow**:
1. User attaches file, uploads to Drive manually (gets `driveUrl`)
2. File added to `largeFileLinks` array with `driveUrl` property
3. Code checks `largeFileLinks.length > 0` → true
4. Code throws error "Google Drive client not available" BEFORE checking if upload needed
5. Email send fails ❌

### Issue 2: Drive Link Property Mismatch
**File**: `lib/google-oauth-hybrid.js:667`

Code used `file.driveLink` but pre-uploaded files have `file.driveUrl`:

```javascript
// BEFORE (WRONG):
largeFileLinks.forEach(file => {
    finalBody += `• ${file.filename} (${(file.size / 1024 / 1024).toFixed(2)}MB): ${file.driveLink}\n`;
    // ❌ Uses driveLink only, but pre-uploaded files have driveUrl
});
```

**Result**: Pre-uploaded files show "undefined" in email body instead of actual link.

## Solution Implemented

### Fix 1: Conditional Drive Client Requirement
**File**: `lib/google-oauth-hybrid.js:617-626`

Only require Drive client if files actually need uploading:

```javascript
// AFTER (FIXED):
if (largeFileLinks.length > 0) {
    // 🔧 FIX: Check if any files actually need uploading (don't have driveLink)
    const filesToUpload = largeFileLinks.filter(file => !file.driveLink && !file.driveUrl);
    const alreadyUploaded = largeFileLinks.filter(file => file.driveLink || file.driveUrl);

    console.log(`☁️ Processing ${largeFileLinks.length} large files (${filesToUpload.length} to upload, ${alreadyUploaded.length} already on Drive)...`);

    // Only require Google Drive client if we have files to upload
    if (filesToUpload.length > 0 && !window.googleDriveClient) {
        throw new Error('Google Drive client not available - needed to upload new files');
    }

    for (let i = 0; i < largeFileLinks.length; i++) {
        const file = largeFileLinks[i];

        // 🔧 FIX: Skip upload if file already has driveLink OR driveUrl
        if (file.driveLink || file.driveUrl) {
            console.log(`✅ File already on Drive (${i + 1}/${largeFileLinks.length}): ${file.filename}`);
            continue;
        }
        ...
    }
}
```

**Benefits**:
- ✅ No error if all files already uploaded
- ✅ Clear error message if Drive client needed but missing
- ✅ Supports both `driveLink` and `driveUrl` properties

### Fix 2: Flexible Drive Link Resolution
**File**: `lib/google-oauth-hybrid.js:666-671`

Use whichever property is available:

```javascript
// AFTER (FIXED):
if (largeFileLinks.length > 0) {
    finalBody += '\n\n---\n\n📎 Прикрепленные файлы (большие файлы доступны через Google Drive):\n\n';
    largeFileLinks.forEach(file => {
        // 🔧 FIX: Use driveLink or driveUrl (whichever is available)
        const link = file.driveLink || file.driveUrl;
        const sizeText = file.size ? `(${(file.size / 1024 / 1024).toFixed(2)}MB)` : '';
        finalBody += `• ${file.filename} ${sizeText}: ${link}\n`;
    });
}
```

**Benefits**:
- ✅ Works with both newly uploaded files (`driveLink`) and pre-uploaded files (`driveUrl`)
- ✅ Handles missing size gracefully (pre-uploaded files may not have size)

## Flow Comparison

### Before Fix ❌
```
User Action: Attach file already on Drive (has driveUrl)
    ↓
File added to largeFileLinks with driveUrl
    ↓
Code: largeFileLinks.length > 0 → true
    ↓
Code: Check window.googleDriveClient
    ↓
❌ ERROR: "Google Drive client not available"
    ↓
Email send fails
```

### After Fix ✅
```
User Action: Attach file already on Drive (has driveUrl)
    ↓
File added to largeFileLinks with driveUrl
    ↓
Code: Filter files needing upload → 0 files
    ↓
Code: Filter already uploaded → 1 file
    ↓
Code: filesToUpload.length === 0 → Skip Drive client check
    ↓
Code: Loop through files, skip upload for file.driveUrl
    ↓
Code: Include driveUrl in email body
    ↓
✅ Email sent successfully with Drive link
```

## File Property Variations

### Newly Uploaded Files (via Drive Client)
```javascript
{
    filename: 'document.pdf',
    size: 5242880,
    driveLink: 'https://drive.google.com/file/d/abc123/view',
    mimeType: 'application/pdf'
}
```

### Pre-uploaded Files (attached from Drive)
```javascript
{
    filename: 'report.pdf',
    size: 10485760,  // May or may not exist
    driveUrl: 'https://drive.google.com/file/d/xyz789/view',
    driveFileId: 'xyz789'
}
```

### Small Files (inline attachments)
```javascript
{
    filename: 'image.jpg',
    content: 'base64-encoded-content',
    size: 204800,
    mimeType: 'image/jpeg'
}
```

## Testing Checklist

### Scenario 1: All Files Already on Drive ✅
- **Setup**: Attach 2 files with `driveUrl` (pre-uploaded)
- **Expected**: No error, email sent with Drive links in body
- **Result**: ✅ Works - no Drive client required

### Scenario 2: Mix of New and Pre-uploaded Files ✅
- **Setup**: Attach 1 new file (needs upload) + 1 pre-uploaded file (driveUrl)
- **Expected**: Drive client required for new file, pre-uploaded file skipped
- **Result**: ✅ Works if Drive client available
- **Result**: ❌ Clear error if Drive client missing (expected behavior)

### Scenario 3: All New Files Needing Upload ✅
- **Setup**: Attach 2 large new files (>25MB, no driveUrl)
- **Expected**: Drive client required, error if not available
- **Result**: ✅ Clear error message "Google Drive client not available - needed to upload new files"

### Scenario 4: Email Body Drive Links ✅
- **Setup**: Send email with pre-uploaded file (driveUrl)
- **Expected**: Email body contains actual Drive link, not "undefined"
- **Result**: ✅ Works - uses `driveUrl` as fallback

### Scenario 5: No Google Drive Client Available ✅
- **Setup**: All files already on Drive, Drive client not initialized
- **Expected**: Email sends successfully without Drive client
- **Result**: ✅ Works - Drive client not required

## Console Log Examples

### All Files Already Uploaded
```
☁️ Processing 2 large files (0 to upload, 2 already on Drive)...
✅ File already on Drive (1/2): report.pdf
✅ File already on Drive (2/2): document.pdf
📎 Adding Drive links to email body...
📮 Sending email via Gmail API proxy...
✅ Email sent successfully
```

### Mixed Files (1 new, 1 pre-uploaded)
```
☁️ Processing 2 large files (1 to upload, 1 already on Drive)...
✅ File already on Drive (1/2): old-report.pdf
📤 Uploading file 2/2: new-file.pdf
✅ Uploaded to Drive: https://drive.google.com/file/d/...
📎 Adding Drive links to email body...
📮 Sending email via Gmail API proxy...
✅ Email sent successfully
```

### Drive Client Missing (but not needed)
```
☁️ Processing 1 large files (0 to upload, 1 already on Drive)...
✅ File already on Drive (1/1): report.pdf
📎 Adding Drive links to email body...
📮 Sending email via Gmail API proxy...
✅ Email sent successfully
```

### Drive Client Missing (and needed) ❌
```
☁️ Processing 1 large files (1 to upload, 0 already on Drive)...
❌ Error: Google Drive client not available - needed to upload new files
```

## Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Error with pre-uploaded files | ❌ Always | ✅ Never |
| Drive client required | Always | Only when uploading new files |
| Error message clarity | "not available" | "not available - needed to upload new files" |
| Drive link in email | driveLink only (undefined for pre-uploaded) | driveLink OR driveUrl |
| Size display | Always shown (undefined for pre-uploaded) | Conditional (graceful if missing) |

## Files Modified

- **lib/google-oauth-hybrid.js:617-626**: Conditional Drive client requirement
- **lib/google-oauth-hybrid.js:632**: Support both driveLink and driveUrl in skip check
- **lib/google-oauth-hybrid.js:667-670**: Flexible link resolution in email body

## Related Fixes

This fix builds upon:
- **Google Drive Attachment Fix** (October 1, 2025): Recognized pre-uploaded files
- Reference: `database/GOOGLE_DRIVE_ATTACHMENT_FIX.md`

## Conclusion

✅ **Fix Complete**: Google Drive client error eliminated when files already uploaded.

**User Experience Improved**:
- No errors when using pre-uploaded Drive files
- Clear error message if Drive client actually needed
- Drive links display correctly in emails (driveUrl OR driveLink)
- File size handles missing values gracefully

**Code Quality**:
- Smart conditional logic prevents unnecessary errors
- Supports multiple file property formats
- Clear console logging for debugging
- Backward compatible with existing functionality
