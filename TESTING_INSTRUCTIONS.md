# Testing Instructions - Login & History Functionality

## Prerequisites

### 1. Apply Database Schema
Before testing, you MUST apply the database schema to your Supabase project:

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy the entire contents of `supabase/schema.sql` and paste it into the query editor
6. Click "Run" to execute the schema
7. Verify that the `letters` and `profiles` tables were created successfully

### 2. Configure Email Settings (Optional but Recommended for Testing)
For easier testing, you can disable email confirmation:

1. In Supabase dashboard, go to "Authentication" → "Providers"
2. Scroll to "Email" provider
3. Toggle "Confirm email" to OFF (for development only)
4. Save changes

This allows immediate signup without email confirmation. For production, you should re-enable this.

## Test Plan

### Test 1: New User Signup
1. Open http://localhost:3000/login
2. Click "アカウントをお持ちでない方は 新規登録"
3. Enter a test email (e.g., `test@example.com`) and password (minimum 6 characters)
4. Click "アカウントを作成"
5. **Expected Result**:
   - If email confirmation is disabled: Should redirect to `/dashboard`
   - If email confirmation is enabled: Should show message "確認メールを送信しました..."
6. **Check Console**: Open browser console (F12) and look for:
   - "Migration: Starting for user..." (if you have localStorage data)
   - "Migration: Successful!" or "Migration: No LocalStorage data to migrate"
   - No error messages

### Test 2: Login with Existing User
1. Open http://localhost:3000/login
2. Enter your email and password
3. Click "ログイン"
4. **Expected Result**: Should redirect to `/dashboard`
5. **Check Console**: Look for:
   - No authentication errors
   - "Fetching histories for user: [user-id]"

### Test 3: Dashboard Access
1. After logging in, verify you're on `/dashboard`
2. **Expected Result**:
   - Should see 4 KPI cards (総手紙数, 今月の作成数, アポ獲得数, 返信数)
   - Should see sidebar with navigation (ホーム, 履歴一覧, 設定)
   - Should see "最近の履歴" section (may be empty if no letters yet)
3. **Check Console**: Look for:
   - "Fetched X histories from Supabase"
   - No RLS policy errors

### Test 4: Create First Letter
1. Click "手紙を作成する" button in dashboard
2. Should redirect to `/` (main page)
3. Fill in the form fields:
   - Check that "自社名", "氏名", "自社サービス概要" are auto-populated if you set them in settings
4. Click "手紙を作成する"
5. Wait for letter generation
6. **Expected Result**:
   - Letter appears in preview area
   - History sidebar should show the new letter
7. **Check Console**: Look for:
   - "Fetching histories for user: [user-id]"
   - "Fetched 1 histories from Supabase"
   - No database errors

### Test 5: History List
1. Go to `/dashboard/history`
2. **Expected Result**:
   - Should see list of all your letters
   - Each letter should show:
     - Company name
     - Target name
     - Status badge (下書き, 作成済, etc.)
     - Mode badge (Letter or Event)
     - Created date
   - Should have status filter dropdown
3. **Check Console**: Look for successful history fetch

### Test 6: Settings/Profile
1. Go to `/dashboard/settings`
2. Fill in default sender information:
   - 自社名
   - 氏名
   - 自社サービス概要
   - 自社URL
3. Click "保存する"
4. **Expected Result**: Should see success message "プロフィールを保存しました"
5. Go back to `/` (main page)
6. **Expected Result**: The form should be auto-populated with your saved information

### Test 7: Pin Functionality
1. In the history sidebar (on main page), hover over a letter
2. Click the pin icon at top-right
3. **Expected Result**:
   - Icon should turn yellow and filled
   - Letter should stay at top of list
   - Background should turn amber
4. Create another letter
5. **Expected Result**: Pinned letter should remain at top
6. **Check Console**: No errors

### Test 8: Status Change
1. In preview area (after generating a letter), find the status dropdown
2. Change status from "作成済" to "送付済"
3. **Expected Result**:
   - Status badge should update
   - History sidebar should refresh and show updated status
4. **Check Console**: No errors

## Common Issues and Debugging

### Issue: "No user found, returning empty array"
**Cause**: User is not authenticated
**Solution**:
1. Check that you're logged in
2. Open browser DevTools → Application → Cookies
3. Verify Supabase auth cookies exist (sb-*-auth-token)
4. If no cookies, try logging in again

### Issue: "履歴取得エラー: relation \"letters\" does not exist"
**Cause**: Database schema not applied
**Solution**: Follow step "1. Apply Database Schema" above

### Issue: "RLS policy violation" or "permission denied for table letters"
**Cause**: Row Level Security policies not applied or user not authenticated
**Solution**:
1. Verify schema.sql was executed completely
2. Check that you're logged in
3. In Supabase dashboard, go to Table Editor → letters → check RLS policies exist

### Issue: Email confirmation required but email not sent
**Cause**: Email confirmation enabled but email service not configured
**Solution**: Disable email confirmation for development (see Prerequisites section)

### Issue: History sidebar shows empty but letters exist in database
**Cause**: Possible auth issue or RLS policy issue
**Solution**:
1. Check console for errors
2. Verify user_id in database matches current user's ID
3. Check that RLS policies are enabled and correct

## Expected Console Output (Success)

When everything works, you should see console output like:
```
Migration: Starting for user abc123-def456-...
Migration: No LocalStorage data to migrate
Fetching histories for user: abc123-def456-...
Fetched 0 histories from Supabase
[After creating a letter]
Fetching histories for user: abc123-def456-...
Fetched 1 histories from Supabase
```

## Reporting Issues

If tests fail, please provide:
1. Which test step failed
2. Console output (full error messages)
3. Network tab errors (if any)
4. Screenshots of the issue
