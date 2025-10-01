# Migration Guide: Create email_campaigns Table

**Date**: October 1, 2025
**Purpose**: Enable email campaign management and persistence in the application

---

## 🎯 What This Migration Does

Creates the `email_campaigns` table to store:
- ✅ **Email campaign drafts** - Save work in progress
- ✅ **Campaign metadata** - Subject, body, attachments
- ✅ **Campaign status** - draft, scheduled, sent, failed
- ✅ **Recipient tracking** - Count of sent/failed emails
- ✅ **Scheduling** - Schedule campaigns for future sending

---

## 🔍 Problem Being Solved

**Error**: `Database error: Could not find the table 'public.email_campaigns' in the schema cache`

**Impact**:
- Email wizard "Next" button fails after step 1
- Cannot save email campaign drafts
- Cannot proceed to recipient selection (step 2)
- All email campaign functionality blocked

**User Experience**: Users fill out email form, click "Next", and get error instead of moving to step 2.

---

## 📋 Prerequisites

- ✅ Supabase project with database access
- ✅ Access to SQL Editor in Supabase Dashboard
- ✅ `service_role` or `postgres` permissions

---

## 🚀 Migration Steps

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in sidebar
4. Click **New query**

### Step 2: Execute Migration SQL

Copy and paste the entire SQL from `CREATE_EMAIL_CAMPAIGNS_TABLE.sql`:

```sql
-- Migration: Create email_campaigns table
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
    campaign_type TEXT NOT NULL DEFAULT 'manual' CHECK (campaign_type IN ('manual', 'automated')),
    recipients_source TEXT NOT NULL DEFAULT 'database' CHECK (recipients_source IN ('database', 'contacts', 'category', 'custom', 'imported')),
    recipient_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes, triggers, and RLS policies (full SQL in file)
```

### Step 3: Click **Run** (or press Ctrl+Enter)

Expected result: `Success. No rows returned`

### Step 4: Verify Migration

Run verification query:

```sql
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'email_campaigns'
ORDER BY ordinal_position;
```

**Expected output** (14 columns):

| column_name | data_type | column_default | is_nullable |
|-------------|-----------|----------------|-------------|
| id | uuid | gen_random_uuid() | NO |
| user_id | uuid | - | NO |
| subject | text | - | NO |
| body | text | - | NO |
| attachments | jsonb | '[]'::jsonb | YES |
| status | text | 'draft' | NO |
| campaign_type | text | 'manual' | NO |
| recipients_source | text | 'database' | NO |
| recipient_count | integer | 0 | YES |
| sent_count | integer | 0 | YES |
| failed_count | integer | 0 | YES |
| scheduled_at | timestamptz | - | YES |
| sent_at | timestamptz | - | YES |
| created_at | timestamptz | NOW() | YES |
| updated_at | timestamptz | NOW() | YES |

### Step 5: Verify RLS Policies

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'email_campaigns';
```

**Expected output** (5 policies):

| policyname | cmd |
|------------|-----|
| Users can view own email campaigns | SELECT |
| Users can create own email campaigns | INSERT |
| Users can update own email campaigns | UPDATE |
| Users can delete own email campaigns | DELETE |
| Service role full access to email campaigns | ALL |

---

## 📊 Table Schema Details

### **Core Fields**
- **id**: UUID primary key, auto-generated
- **user_id**: Foreign key to auth.users (CASCADE delete)
- **subject**: Email subject line (required)
- **body**: Email body content, can contain HTML (required)

### **Attachments**
- **attachments**: JSONB array storing attachment metadata
```json
[
  {
    "name": "file.pdf",
    "url": "https://drive.google.com/...",
    "size": 1024000,
    "type": "application/pdf",
    "storage": "google_drive"
  }
]
```

### **Status Tracking**
- **status**: Campaign lifecycle status
  - `draft` - Being composed (default)
  - `scheduled` - Scheduled for future sending
  - `sending` - Currently being sent
  - `sent` - Successfully sent
  - `failed` - Send failed
  - `cancelled` - Manually cancelled

### **Campaign Configuration**
- **campaign_type**: `manual` (user-initiated) or `automated` (triggered)
- **recipients_source**: Where recipients come from
  - `database` - From parsing_results
  - `contacts` - From contacts list
  - `category` - Filtered by category
  - `custom` - Custom list
  - `imported` - Imported CSV

### **Statistics**
- **recipient_count**: Total recipients
- **sent_count**: Successfully sent emails
- **failed_count**: Failed sends

### **Timestamps**
- **scheduled_at**: When to send (null = send immediately)
- **sent_at**: When actually sent (null = not sent yet)
- **created_at**: Campaign creation time
- **updated_at**: Last modification time (auto-updated by trigger)

---

## ✅ Post-Migration Testing

### Test 1: Create Draft Campaign

1. Open application email section
2. Fill in subject: "Test Campaign"
3. Fill in body: "Test message"
4. Click "Next" button
5. **Expected**: No error, proceeds to step 2

### Test 2: Verify Database Entry

```sql
SELECT id, user_id, subject, status, created_at
FROM email_campaigns
ORDER BY created_at DESC
LIMIT 5;
```

Should show your test campaign with `status = 'draft'`

### Test 3: Check RLS (as authenticated user)

Try to view campaigns in application:
- Should only see your own campaigns
- Cannot see other users' campaigns

### Test 4: Test Updated_at Trigger

```sql
-- Update a campaign
UPDATE email_campaigns
SET subject = 'Updated Subject'
WHERE id = 'your-campaign-id';

-- Verify updated_at changed
SELECT id, subject, created_at, updated_at
FROM email_campaigns
WHERE id = 'your-campaign-id';
```

`updated_at` should be more recent than `created_at`

---

## 🆘 Troubleshooting

### Error: "relation 'email_campaigns' already exists"
**Cause**: Table already created
**Solution**: Skip migration, table exists

### Error: "permission denied for table email_campaigns"
**Cause**: Insufficient database permissions
**Solution**: Use `service_role` key or `postgres` role

### Error: "foreign key violation"
**Cause**: Invalid user_id
**Solution**: Ensure user is authenticated before saving campaign

### Error: "new row violates check constraint"
**Cause**: Invalid status, campaign_type, or recipients_source value
**Solution**: Use only allowed values from CHECK constraints:
- status: draft, scheduled, sending, sent, failed, cancelled
- campaign_type: manual, automated
- recipients_source: database, contacts, category, custom, imported

---

## 🔗 Related Files

- **Migration SQL**: `database/CREATE_EMAIL_CAMPAIGNS_TABLE.sql`
- **Backend code**: `lib/auth-client.js:724-776` (saveEmailCampaign)
- **Frontend code**: `script.js:4781-4830` (saveEmailCampaignAndContinue)
- **Email wizard**: `index.html:710-805` (email compose form)

---

## 📈 Impact

**Before Migration**:
- ❌ Email wizard fails at step 1
- ❌ Cannot save campaign drafts
- ❌ Error: "table 'email_campaigns' not found"

**After Migration**:
- ✅ Email wizard step 1 → step 2 works
- ✅ Campaign drafts saved to database
- ✅ Full email campaign management enabled
- ✅ Campaign history and tracking available

---

## 🎯 Next Steps

After successful migration:

1. **Test email workflow**:
   - Create campaign draft
   - Select recipients
   - Schedule or send immediately

2. **Monitor campaign table**:
   ```sql
   SELECT status, COUNT(*)
   FROM email_campaigns
   GROUP BY status;
   ```

3. **Set up cleanup job** (optional):
   ```sql
   -- Delete old draft campaigns (>30 days)
   DELETE FROM email_campaigns
   WHERE status = 'draft'
   AND created_at < NOW() - INTERVAL '30 days';
   ```

---

**Status**: ✅ **REQUIRED FOR EMAIL FUNCTIONALITY**
**Impact**: Critical - blocks entire email feature
**Backward Compatible**: Yes (new feature, no existing data)

---

**Created by**: Claude Code
**Date**: October 1, 2025
