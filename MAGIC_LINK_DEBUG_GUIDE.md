# Magic Link → パスワード設定 デバッグガイド

## 問題の症状

Magic Linkをクリックしても、パスワード設定画面 (`/setup-password`) に行かず、ダッシュボード (`/dashboard`) に直接遷移してしまう。

## 🔍 診断手順

### Step 1: Supabase設定の確認（最重要）

#### 1-1. Email Provider設定

1. https://app.supabase.com にアクセス
2. プロジェクトを選択
3. 左サイドバー **Authentication** → **Providers**
4. **Email** プロバイダーを確認

**重要な設定:**
```
✅ Enable Email Provider: ON
❌ Confirm email: OFF にする
```

**Confirm emailをOFFにする理由:**
- Magic Link自体がメール確認の役割を果たすため
- ONだと通常のサインアップと混同される
- OFFにしないとパスワード設定フローが正常に動作しない

#### 1-2. URL Configuration

1. **Authentication** → **URL Configuration**
2. 以下を確認・設定:

**Site URL:**
```
http://localhost:3000
```

**Redirect URLs:**
```
http://localhost:3000/*
http://localhost:3000/auth/callback
http://localhost:3000/setup-password
http://localhost:3000/dashboard
```

#### 1-3. Email Templates

1. **Authentication** → **Email Templates**
2. **Magic Link** テンプレートを確認
3. リンクが以下のようになっているか確認:

```html
<a href="{{ .ConfirmationURL }}">Magic Link</a>
```

**ConfirmationURL が正しく設定されているか確認**

### Step 2: コンソールログの確認

デバッグログを追加したので、以下の手順で確認してください。

#### 2-1. ターミナルでログ確認

開発サーバーを起動している **ターミナル** を確認してください。
```bash
npm run dev
```

#### 2-2. Magic Link をクリック

新規ユーザーでMagic Linkを送信し、メール内のリンクをクリックしてください。

#### 2-3. ターミナルに出力されるログを確認

**期待されるログの流れ:**

```
========== AUTH CALLBACK START ==========
Request URL: http://localhost:3000/auth/callback?code=xxxxx
Code present: true
Exchanging code for session...
✅ Session established successfully
User ID: user-id-123
User email: test@example.com
User metadata: {}
User app_metadata: {...}
password_set flag: false
❌ Password NOT set
➡️  Redirecting to: /setup-password
Full redirect URL: http://localhost:3000/setup-password
========== AUTH CALLBACK END ==========

========== MIDDLEWARE ==========
Path: /setup-password
User: test@example.com
User ID: user-id-123

========== SETUP-PASSWORD PAGE MOUNT ==========
User: test@example.com
Loading: false
✅ User authenticated: test@example.com
User metadata: {}
```

**もし以下のログが出たら問題:**

```
password_set flag: true
✅ Password already set
➡️  Redirecting to: /dashboard
```

これは、すでに `password_set: true` が設定されているため。

### Step 3: 問題のパターン別対処法

#### パターンA: `/auth/callback` に来ない

**ログ:**
```
# ログに何も出力されない
```

**原因:**
- Magic Link の URL が間違っている
- Supabase の Redirect URLs 設定が間違っている

**対処法:**
1. Supabase Dashboard → URL Configuration を確認
2. `http://localhost:3000/auth/callback` が登録されているか
3. Email Templates で `{{ .ConfirmationURL }}` が使われているか

#### パターンB: コールバックは来るが `/dashboard` にリダイレクト

**ログ:**
```
password_set flag: true
✅ Password already set
➡️  Redirecting to: /dashboard
```

**原因:**
- 既に `password_set: true` が設定されている
- テスト用ユーザーが既にパスワード設定済み

**対処法:**

**方法1: 新しいメールアドレスでテスト**
```
完全に新しいメールアドレスで登録してテスト
```

**方法2: 既存ユーザーのメタデータをリセット**

ブラウザのコンソールで実行:
```javascript
// ログイン後に実行
const { data } = await supabase.auth.updateUser({
  data: { password_set: false }
});
console.log('Reset password_set flag');

// またはメタデータを完全に削除
const { data } = await supabase.auth.updateUser({
  data: {}
});
```

**方法3: Supabase Dashboard でユーザーを削除**
```
1. Authentication → Users
2. テストユーザーを削除
3. 新規登録からやり直し
```

#### パターンC: `/setup-password` に来るが即座に `/dashboard` へ

**ログ:**
```
========== SETUP-PASSWORD PAGE MOUNT ==========
User: test@example.com
# その後すぐにダッシュボードへ
```

**原因:**
- setup-password ページの何かが即座にリダイレクトしている
- AuthContext の処理が干渉している可能性

**対処法:**
```typescript
// src/app/setup-password/page.tsx のログを確認
// 何が原因でリダイレクトしているか特定
```

#### パターンD: Confirm email が ON になっている

**症状:**
- Magic Link 送信後、「確認メール」が別途送られる
- Magic Link をクリックしても「メールを確認してください」と表示される

**対処法:**
1. Supabase Dashboard → Authentication → Providers → Email
2. **Confirm email を OFF にする**
3. 既存ユーザーは削除して新規登録

### Step 4: 完全リセット手順

すべてクリアにして最初からテストしたい場合:

#### 4-1. Supabase側

```
1. Authentication → Users → テストユーザーをすべて削除
2. Authentication → Providers → Email
   - Confirm email: OFF
3. Authentication → URL Configuration
   - Redirect URLs に http://localhost:3000/auth/callback 追加
```

#### 4-2. ブラウザ側

```
1. シークレットモード/プライベートブラウジングで開く
2. または、ブラウザの Cookie とキャッシュをクリア
```

#### 4-3. コード側

```bash
# 開発サーバーを再起動
npm run dev
```

### Step 5: 実際のテストフロー

1. **完全に新しいメールアドレス** で登録
2. `/login` → 「新規登録」タブ
3. メールアドレス入力 → 「登録用リンクを送信」
4. **ターミナルのログを注視**
5. メールのMagic Linkをクリック
6. **ターミナルに以下が出力されるか確認:**
   ```
   ❌ Password NOT set
   ➡️  Redirecting to: /setup-password
   ```
7. `/setup-password` ページが表示されるか確認
8. パスワード入力 → 設定
9. **ターミナルに以下が出力されるか確認:**
   ```
   Password_set flag set to true
   ```

## 🔧 トラブルシューティング

### Q: ログが全く出力されない

**A:** 開発サーバーのターミナルを確認していますか？

- ❌ ブラウザのコンソール（F12）
- ✅ `npm run dev` を実行しているターミナル

サーバーサイドのログはブラウザには表示されません。

### Q: `password_set: true` が勝手に設定されている

**A:** 過去のテストで設定した可能性があります。

**解決方法:**
1. 新しいメールアドレスでテスト
2. または、既存ユーザーのメタデータをリセット
3. または、Supabaseでユーザーを削除

### Q: Confirm email を OFF にできない

**A:** Supabase の Free プランでは一部制限がある可能性があります。

**代替案:**
- Pro プランにアップグレード
- または、確認済みユーザーとしてマークする処理を追加

### Q: Magic Link が届かない

**A:** 以下を確認:

1. 迷惑メールフォルダ
2. Supabase の Email Provider が有効か
3. 開発環境では Supabase Inbucket を使用
   - Supabase Dashboard → Settings → API → Inbucket URL

### Q: `/setup-password` に遷移するが画面が表示されない

**A:** ミドルウェアがリダイレクトしている可能性

**確認:**
```
========== MIDDLEWARE ==========
Path: /setup-password
User: test@example.com
```

このログが出ていれば、ミドルウェアは通過しています。

## 📋 チェックリスト

テストする前に、以下をすべて確認してください:

### Supabase設定
- [ ] Email Provider が有効
- [ ] **Confirm email が OFF**
- [ ] Redirect URLs に `/auth/callback` が登録済み
- [ ] Site URL が `http://localhost:3000`

### コード
- [ ] 最新のコードが反映されている（git pull）
- [ ] 開発サーバーが再起動されている

### テスト環境
- [ ] 新しいメールアドレスを使用
- [ ] または、既存ユーザーのメタデータをリセット
- [ ] シークレットモード/プライベートブラウジング使用

### ログ確認
- [ ] ターミナルでログを確認している
- [ ] `========== AUTH CALLBACK START ==========` が出力される
- [ ] `password_set flag: false` が出力される
- [ ] `➡️  Redirecting to: /setup-password` が出力される

## 🎯 期待される動作

### 初回登録（新規ユーザー）

```
1. Magic Link クリック
   ↓
2. ターミナルログ:
   password_set flag: false
   ➡️  Redirecting to: /setup-password
   ↓
3. パスワード設定画面が表示される
   ↓
4. パスワード入力・設定
   ↓
5. ターミナルログ:
   Password_set flag set to true
   ↓
6. ダッシュボードへ遷移
```

### 2回目以降（パスワード設定済み）

```
1. Magic Link クリック
   ↓
2. ターミナルログ:
   password_set flag: true
   ➡️  Redirecting to: /dashboard
   ↓
3. ダッシュボードへ直接遷移
   （パスワード設定画面はスキップ）
```

## 📞 それでも解決しない場合

以下の情報を共有してください:

1. **ターミナルログ全文**（Magic Linkクリック時）
2. **Supabaseの設定スクリーンショット**
   - Email Provider設定
   - URL Configuration
3. **ブラウザのURL**（遷移先）
4. **新規ユーザーかどうか**

この情報があれば、さらに詳細な診断が可能です。
